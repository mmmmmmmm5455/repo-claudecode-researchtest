# 千禧年蟲事件 (Millennium Bug Incident)

**Y2K Liminal Space Web Game** — a dark, atmospheric text adventure set in the last hours of 1999.

> A lonely terminal. A CRT monitor flickering in the dark. One viewer watching.

## Architecture

```
Browser (index.html)
  │
  ├─ Three.js 3D Scenes (4 liminal space backgrounds)
  ├─ CSS Y2K Cybercore UI (CRT scanlines, 7-segment counters)
  ├─ GameAPI (fetch + WebSocket)
  │
  ▼
FastAPI Server (backend/server.py)
  │
  ├─ POST /api/game/action  ── GameEngine.process_action()
  ├─ GET  /api/game/state    ── GameEngine.get_game_state()
  ├─ POST /api/game/new      ── GameEngine.new_session()
  ├─ WS   /ws/game           ── GameEngine.stream_narrative()
  │
  ▼
GameEngine (backend/game_engine.py)
  ├─ SessionManager  ── JSON file persistence
  ├─ AsyncLLMClient  ── Anthropic API streaming
  ├─ SceneSelector   ── emotion + infection → scene
  └─ ViewerCounter   ── viewer count formula
```

## Quick Start

```bash
cd output
pip install -r backend/requirements.txt
export ANTHROPIC_API_KEY="your-api-key"
uvicorn backend.server:app --host 0.0.0.0 --port 8000
```

Open browser → http://localhost:8000

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | / | Serve frontend (index.html) |
| GET | /api/health | Health check with active session count |
| POST | /api/game/new | Create new game session |
| POST | /api/game/action | Submit player action |
| GET | /api/game/state?session_id=X | Fetch current game state |
| WS | /ws/game | Streaming tokens (typewriter effect) |

### POST /api/game/action

```json
// Request
{ "session_id": "abc123", "player_input": "look around" }

// Response
{
  "narrative": "...",
  "emotion_value": 45.0,
  "infection_level": 23.0,
  "memory_fragments": 2,
  "scene_trigger": "rain_underpass",
  "viewer_count": 3,
  "system_event": null
}
```

### WebSocket /ws/game

```
Client → { "session_id": "abc", "player_input": "look" }
Server → { "type": "token", "content": "..." }
Server → { "type": "state_update", "emotion_value": 45, ... }
```

## Game Systems

- **Emotion System** (0–100): Player emotional state
- **Infection System** (0–100): Digital corruption spread
- **Memory Fragments** (0–10): Recovered narrative fragments
- **Viewer Counter** (1–99): Simulated streaming viewers
- **Scene Selector**: 4 PS1-style 3D backgrounds

## 4 Liminal Space Scenes

| Scene | Trigger | Palette | Key Visual |
|-------|---------|---------|------------|
| Rainy Underpass | Emotion 40-70 | Cold gray + dark blue | Distant warm window |
| Snow Night Bridge | Emotion <30, Infection >50% | Warm yellow highlight | 1:20 streetlight ratio |
| Foggy Highway | Emotion >70 | Gray-white + gray-black | 50m fog visibility |
| Blizzard Street | Infection >70% or Emotion <40 | Dark red ambient | 500 snow particles |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.10+, FastAPI, Uvicorn |
| LLM | Anthropic SDK (async streaming) |
| Frontend | Vanilla HTML/CSS/JS, Three.js r128 |
| 3D | WebGL, PS1-style vertex/fragment shaders |
| Fonts | VT323, Orbitron, Share Tech Mono, Silkscreen |
| Persistence | JSON file-based game sessions |
| Testing | Pytest, FastAPI TestClient |

## File Structure

```
output/
├── backend/
│   ├── server.py              # FastAPI app (REST + WebSocket)
│   ├── game_engine.py         # Core game loop adapter
│   ├── state_manager.py       # JSON session persistence
│   ├── llm_client.py          # Async Anthropic LLM client
│   ├── scene_selector.py      # Scene selection logic
│   ├── viewer_counter.py      # Viewer count formula
│   ├── test_server.py         # Pytest test suite (29 tests)
│   ├── requirements.txt       # Python dependencies
│   └── game_sessions/         # Session state storage
├── frontend/
│   ├── index.html             # Main page
│   ├── css/
│   │   ├── main.css           # 12-color palette + global styles
│   │   ├── panels.css         # Mac OS 9 window panels
│   │   ├── counters.css       # 7-segment viewer counter
│   │   └── crt.css            # CRT scanline overlay
│   ├── js/
│   │   ├── app.js             # Application orchestrator
│   │   ├── api.js             # HTTP + WebSocket client
│   │   ├── renderer.js        # Typewriter effect + UI updates
│   │   ├── background.js      # 3D scene manager
│   │   ├── scenes/            # 4 Three.js liminal scenes
│   │   └── shaders/           # PS1 vertex/fragment GLSL
│   └── assets/                # Fonts + textures
├── qa_report.json
└── test_validation_report.json
```

## Design Rules (Y2K Cybercore)

- No border-radius — all elements sharp rectangles
- No emoji — pixelated icons only
- No warm colors — palette: cold cyan / sick green / void black
- CRT scanline overlay at 40% opacity
- PS1-style: vertex wobble, 16-bit color quantization, no AA
- 12-color palette locked to PRD spec

---

*Built by the multi-agent game development pipeline.*
