"""Session state manager for multi-session game support.

Each session holds a GameState + DialogueSession pair.
State is persisted as JSON files for durability across server restarts.
"""

import json
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

DEFAULT_STATE_DIR = Path(os.environ.get("GAME_STATE_DIR", "./game_sessions"))
DEFAULT_SESSION_TTL_HOURS = int(os.environ.get("SESSION_TTL_HOURS", "24"))


class SessionState:
    """Holds in-memory session data."""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.game_state: Optional[dict] = None
        self.active_npc_id: Optional[str] = None
        self.dialogue_session: Optional[dict] = None
        self.glitch_event_count: int = 0
        self.created_at: str = ""
        self.last_activity: str = ""


class SessionManager:
    """Manages concurrent game sessions with JSON file persistence.

    Each session is stored as game_sessions/{session_id}.json.
    In-memory cache is used for active sessions to avoid repeated disk I/O.
    """

    def __init__(self, state_dir: Optional[Path] = None):
        self._state_dir = state_dir or DEFAULT_STATE_DIR
        self._state_dir.mkdir(parents=True, exist_ok=True)
        self._sessions: dict[str, SessionState] = {}

    def create_session(self) -> str:
        """Create a new game session and return its ID."""
        session_id = uuid.uuid4().hex[:12]
        session = SessionState(session_id)
        self._sessions[session_id] = session
        return session_id

    def get_session(self, session_id: str) -> Optional[SessionState]:
        """Get an existing session by ID. Returns None if not found."""
        if session_id not in self._sessions:
            if not self._load_from_disk(session_id):
                return None
        self._sessions[session_id].last_activity = ""
        return self._sessions[session_id]

    def save_session(self, session_id: str) -> bool:
        """Persist session state to disk as JSON."""
        session = self._sessions.get(session_id)
        if not session:
            return False
        data = {
            "session_id": session.session_id,
            "game_state": session.game_state,
            "active_npc_id": session.active_npc_id,
            "dialogue_session": session.dialogue_session,
            "glitch_event_count": session.glitch_event_count,
            "created_at": session.created_at,
            "last_activity": session.last_activity,
        }
        filepath = self._state_dir / f"{session_id}.json"
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
        return True

    def _load_from_disk(self, session_id: str) -> bool:
        """Load session state from disk JSON file."""
        filepath = self._state_dir / f"{session_id}.json"
        if not filepath.exists():
            return False
        with open(filepath, encoding="utf-8") as f:
            data = json.load(f)
        session = SessionState(session_id)
        session.game_state = data.get("game_state")
        session.active_npc_id = data.get("active_npc_id")
        session.dialogue_session = data.get("dialogue_session")
        session.glitch_event_count = data.get("glitch_event_count", 0)
        session.created_at = data.get("created_at", "")
        session.last_activity = data.get("last_activity", "")
        self._sessions[session_id] = session
        return True

    def list_sessions(self) -> list[str]:
        """List all active session IDs (in-memory + on-disk)."""
        disk_ids = [
            p.stem for p in self._state_dir.glob("*.json")
        ]
        all_ids = set(self._sessions.keys()) | set(disk_ids)
        return sorted(all_ids)

    def delete_session(self, session_id: str) -> bool:
        """Remove a session from memory and disk."""
        if session_id in self._sessions:
            del self._sessions[session_id]
        filepath = self._state_dir / f"{session_id}.json"
        if filepath.exists():
            filepath.unlink()
            return True
        return False

    def cleanup_stale_sessions(self, max_age_hours: int = DEFAULT_SESSION_TTL_HOURS) -> int:
        """Delete session files older than max_age_hours.

        Reads created_at from each session JSON. If timestamp is missing or
        unparseable, falls back to file modification time.

        Returns the number of sessions deleted.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
        deleted = 0
        for filepath in self._state_dir.glob("*.json"):
            try:
                age = self._session_age(filepath)
                if age is not None and age < cutoff:
                    session_id = filepath.stem
                    if session_id in self._sessions:
                        del self._sessions[session_id]
                    filepath.unlink()
                    deleted += 1
            except OSError:
                logger.warning("Failed to delete stale session: %s", filepath)
        if deleted:
            logger.info("Cleaned up %d stale sessions (TTL=%dh)", deleted, max_age_hours)
        return deleted

    def _session_age(self, filepath: Path):
        """Extract the most recent activity timestamp from a session file.

        Returns a timezone-aware datetime, or None if unreadable.
        """
        try:
            with open(filepath, encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError):
            return None

        for field in ("last_activity", "created_at"):
            ts = data.get(field)
            if ts:
                try:
                    dt = datetime.fromisoformat(str(ts))
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    return dt
                except ValueError:
                    continue
        return None

    @property
    def session_count(self) -> int:
        """Return the number of session files on disk."""
        return len(list(self._state_dir.glob("*.json")))
