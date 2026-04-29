"""Game engine adapter for FastAPI backend.

Wraps the original StoryEngine + GameState from the terminal game,
adapting the sync API for async HTTP/WebSocket use.

PRESERVE: All game rules, emotional states, infection mechanics,
memory fragment logic, inventory types, and repair outcomes from the
original code. Only refactors the COMMUNICATION LAYER.
"""

import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# Add original game source to Python path
GAME_SOURCE_DIR = os.environ.get(
    "GAME_SOURCE_DIR",
    str(Path.home() / ".claude" / "projects" / "ai-text-adventure"),
)
if GAME_SOURCE_DIR not in sys.path:
    sys.path.insert(0, GAME_SOURCE_DIR)

from backend.llm_client import AsyncLLMClient
from backend.scene_selector import select_scene, get_scene_transition
from backend.state_manager import SessionManager
from backend.viewer_counter import calculate_viewer_count


class GameEngine:
    """Wraps the original game engine for HTTP/WebSocket access.

    Manages:
      - Session lifecycle (create, load, save, delete)
      - Player input processing (delegates to StoryEngine)
      - LLM streaming via AsyncLLMClient
      - Scene selection and viewer count (backend-computed)
    """

    def __init__(self, state_dir: Optional[Path] = None):
        self._session_manager = SessionManager(state_dir)
        self._llm_client = AsyncLLMClient()
        self._story_engine = None  # Lazy init
        self._scene_cache: dict[str, str] = {}  # session_id -> current_scene
        self._glitch_counters: dict[str, int] = {}  # session_id -> glitch events

    @property
    def story_engine(self):
        """Lazy-init the original StoryEngine."""
        if self._story_engine is None:
            try:
                from engine.story_engine import StoryEngine
                self._story_engine = StoryEngine()
            except ImportError as e:
                raise RuntimeError(
                    f"Failed to import original game engine. "
                    f"Check GAME_SOURCE_DIR={GAME_SOURCE_DIR}. Error: {e}"
                )
        return self._story_engine

    # ── Session Management ───────────────────────────────────────────────

    def new_session(self) -> str:
        """Create a new game session with fresh GameState."""
        session_id = self._session_manager.create_session()

        try:
            from game.game_state import GameState
            from game.player import Player, Profession
            from engine.memory_manager import shared_memory_manager

            # Initialize fresh game state
            state = GameState()
            state.player = Player.create("player", Profession.WARRIOR, "male")
            state.touch()

            # Ensure memory manager is initialized
            shared_memory_manager()

            session = self._session_manager.get_session(session_id)
            session.game_state = state.to_dict()
            session.created_at = datetime.now(timezone.utc).isoformat()
            session.last_activity = session.created_at
            self._session_manager.save_session(session_id)

            self._scene_cache[session_id] = "fog_highway"
            self._glitch_counters[session_id] = 0

        except ImportError as e:
            raise RuntimeError(
                f"Failed to initialize game state. "
                f"Check GAME_SOURCE_DIR={GAME_SOURCE_DIR}. Error: {e}"
            )

        return session_id

    def _get_state(self, session_id: str):
        """Load GameState object from session."""
        from game.game_state import GameState

        session = self._session_manager.get_session(session_id)
        if session is None or session.game_state is None:
            return None
        return GameState.from_dict(session.game_state)

    def _save_state(self, session_id: str, state) -> None:
        """Persist GameState back to session."""
        session = self._session_manager.get_session(session_id)
        if session:
            session.game_state = state.to_dict()
            session.last_activity = datetime.now(timezone.utc).isoformat()
            self._session_manager.save_session(session_id)

    # ── Game Actions ─────────────────────────────────────────────────────

    async def process_action(self, session_id: str, player_input: str) -> dict:
        """Process a player action and return the full game response.

        This is the core game loop adapted from the terminal version.
        Instead of print()/input(), it takes a string and returns a dict.

        Args:
            session_id: Session identifier
            player_input: Player's text input or choice_id

        Returns:
            Dict with: narrative, emotion_value, infection_level,
                       memory_fragments, scene_trigger, viewer_count,
                       system_event, inventory_changes, attribute_changes
        """
        state = self._get_state(session_id)
        if state is None:
            return self._error_response("Session not found. Create a new session.")

        try:
            # Generate narrative using StoryEngine
            narrative = await self._generate_narrative(state, player_input)

            # Update game state (advance round, apply effects)
            state.advance_round()
            state.add_log(f"> {player_input}")

            # Extract emotion/infection from Player
            emotion = getattr(state.player, 'emotion', 50.0) if state.player else 50.0
            infection = getattr(state.player, 'infection', 0.0) if state.player else 0.0

            # Count memory fragments from MemoryManager
            try:
                from engine.memory_manager import shared_memory_manager
                mm = shared_memory_manager()
                fragments = len(mm.query_relevant("memory", k=10))
            except Exception:
                fragments = 0

            # Compute scene and viewer count (backend-computed per PRD)
            scene = select_scene(emotion, infection)
            old_scene = self._scene_cache.get(session_id, scene)
            transition = get_scene_transition(old_scene, scene)
            self._scene_cache[session_id] = scene

            glitch_count = self._glitch_counters.get(session_id, 0)
            viewers = calculate_viewer_count(emotion, infection, fragments, glitch_count)

            # Check for system events
            system_event = self._check_system_event(state, emotion, infection)

            # Persist updated state
            self._save_state(session_id, state)

            return {
                "narrative": narrative,
                "emotion_value": emotion,
                "infection_level": infection,
                "memory_fragments": fragments,
                "scene_trigger": scene,
                "scene_transition": transition,
                "viewer_count": viewers,
                "viewer_count_delta": 0,
                "system_event": system_event,
                "inventory_changes": [],
                "attribute_changes": {},
            }

        except Exception as e:
            return self._error_response(f"Game engine error: {str(e)}")

    async def _generate_narrative(self, state, player_input: str) -> str:
        """Generate narrative text for player input.

        Uses the LLM client for AI-generated narrative.
        Falls back to StoryEngine if LLM is unavailable.
        """
        # Build prompt from game context
        scene_id = getattr(state, 'current_scene_id', 'unknown')
        player_info = ""
        if state.player:
            p = state.player
            player_info = (
                f"Player: {getattr(p, 'name', 'unknown')}, "
                f"HP: {getattr(p, 'hp', 0)}/{getattr(p, 'max_hp', 100)}, "
                f"Level: {getattr(p, 'level', 1)}"
            )

        prompt = (
            f"[Game State]\n"
            f"Scene: {scene_id}\n"
            f"Round: {getattr(state, 'round_count', 0)}\n"
            f"{player_info}\n\n"
            f"[Player Action]\n{player_input}\n\n"
            f"Generate the next narrative segment for this Y2K liminal space "
            f"text adventure. Keep the tone dark, atmospheric, cybercore aesthetic. "
            f"Respond in Traditional Chinese (zh-TW)."
        )

        system_prompt = (
            "You are the narrator of '千禧年蟲事件' (Millennium Bug Incident), "
            "a Y2K liminal space text adventure. The world is empty, lonely, "
            "and bathed in cold CRT monitor light. Keep responses under 300 words."
        )

        if self._llm_client.api_key:
            return await self._llm_client.generate_text(
                prompt, system=system_prompt, max_tokens=512
            )

        # Fallback: use original StoryEngine
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None,
            lambda: self.story_engine.generate_scene_description(state),
        )

    async def stream_narrative(
        self, session_id: str, player_input: str
    ):
        """Stream narrative tokens for typewriter effect via WebSocket.

        Yields individual text chunks that the frontend renders as typewriter text.
        """
        state = self._get_state(session_id)
        if state is None:
            yield "[錯誤] 找不到遊戲會話。"
            return

        prompt = (
            f"Scene: {getattr(state, 'current_scene_id', 'unknown')}\n"
            f"Action: {player_input}\n"
            f"Generate narrative in Traditional Chinese, under 300 words."
        )

        system_prompt = (
            "You are the narrator of '千禧年蟲事件'. Dark, atmospheric, "
            "Y2K cybercore aesthetic. Traditional Chinese (zh-TW)."
        )

        async for token in self._llm_client.generate_text_stream(
            prompt, system=system_prompt, max_tokens=4096
        ):
            yield token

    # ── State Query ──────────────────────────────────────────────────────

    def get_game_state(self, session_id: str) -> Optional[dict]:
        """Return serializable game state for GET /api/game/state."""
        state = self._get_state(session_id)
        if state is None:
            return None

        emotion = getattr(state.player, 'emotion', 50.0) if state.player else 50.0
        infection = getattr(state.player, 'infection', 0.0) if state.player else 0.0
        scene = self._scene_cache.get(session_id, "fog_highway")
        glitch_count = self._glitch_counters.get(session_id, 0)

        try:
            from engine.memory_manager import shared_memory_manager
            mm = shared_memory_manager()
            fragments = len(mm.query_relevant("memory", k=10))
        except Exception:
            fragments = 0

        return {
            "session_id": session_id,
            "scene_id": getattr(state, 'current_scene_id', 'unknown'),
            "round_count": getattr(state, 'round_count', 0),
            "emotion_value": emotion,
            "infection_level": infection,
            "memory_fragments": fragments,
            "viewer_count": calculate_viewer_count(emotion, infection, fragments, glitch_count),
            "scene_trigger": scene,
            "game_log": getattr(state, 'game_log', [])[-20:],
            "player_name": getattr(state.player, 'name', 'unknown') if state.player else 'unknown',
        }

    # ── Helpers ───────────────────────────────────────────────────────────

    def _check_system_event(self, state, emotion: float, infection: float) -> Optional[str]:
        """Check for triggered system events (glitch popups, infection warnings)."""
        session_id = state.current_scene_id if state else "unknown"

        # Infection warning thresholds
        if infection > 80:
            return "critical_infection"
        if infection > 60 and infection <= 65:
            return "infection_warning"

        # Glitch event: "are you real?" popup
        import random
        if emotion < 25 and random.random() < 0.15:
            # Track glitch events for viewer counter
            for sid in self._glitch_counters:
                if sid in self._scene_cache:
                    self._glitch_counters[sid] = self._glitch_counters.get(sid, 0) + 1
            return "are_you_real"

        return None

    def _error_response(self, message: str) -> dict:
        """Return a standardized error response."""
        return {
            "narrative": f"[系統訊息] {message}",
            "emotion_value": 50.0,
            "infection_level": 0.0,
            "memory_fragments": 0,
            "scene_trigger": "fog_highway",
            "scene_transition": {"transition_type": "none", "duration_ms": 0, "crt_noise": False},
            "viewer_count": 1,
            "viewer_count_delta": 0,
            "system_event": None,
            "inventory_changes": [],
            "attribute_changes": {},
        }
