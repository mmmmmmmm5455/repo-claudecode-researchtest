"""FastAPI server for Millennium Bug Incident (千禧年蟲事件).

Serves the Y2K liminal space web game: static frontend + REST API + WebSocket.
Entry: uvicorn backend.server:app --host 0.0.0.0 --port 8000
"""

import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.game_engine import GameEngine

engine: GameEngine

@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine
    engine = GameEngine()
    yield

app = FastAPI(title="千禧年蟲事件", version="1.0.0", lifespan=lifespan)

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/css", StaticFiles(directory=FRONTEND_DIR / "css"), name="css")
    app.mount("/js", StaticFiles(directory=FRONTEND_DIR / "js"), name="js")
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")

class GameActionRequest(BaseModel):
    session_id: str
    player_input: str
    timestamp: Optional[str] = None

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "sessions_active": len(engine._session_manager.list_sessions())}

@app.post("/api/game/new")
async def new_game():
    session_id = engine.new_session()
    state = engine.get_game_state(session_id)
    return {
        "session_id": session_id,
        "narrative": state.get("game_log", ["[系統] 新的遊戲會話已建立。"])[-1] if state else "",
        "emotion_value": state.get("emotion_value", 50.0) if state else 50.0,
        "infection_level": state.get("infection_level", 0.0) if state else 0.0,
        "memory_fragments": state.get("memory_fragments", 0) if state else 0,
        "scene_trigger": state.get("scene_trigger", "fog_highway") if state else "fog_highway",
        "viewer_count": state.get("viewer_count", 1) if state else 1,
        "system_event": None,
    }

@app.post("/api/game/action")
async def game_action(request: GameActionRequest):
    return await engine.process_action(request.session_id, request.player_input)

@app.get("/api/game/state")
async def game_state(session_id: str):
    state = engine.get_game_state(session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return state

@app.get("/")
async def root():
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"message": "千禧年蟲事件 — API is running. Frontend not found."}

@app.websocket("/ws/game")
async def game_websocket(websocket: WebSocket):
    await websocket.accept()
    try:
        data = await websocket.receive_json()
        session_id = data.get("session_id", "")
        player_input = data.get("player_input", "")

        if not session_id:
            await websocket.send_json({"type": "error", "error": "Missing session_id"})
            return

        async for token in engine.stream_narrative(session_id, player_input):
            await websocket.send_json({"type": "token", "content": token})

        state = engine.get_game_state(session_id)
        if state:
            await websocket.send_json({"type": "state_update", **state})
        else:
            await websocket.send_json({"type": "error", "error": "Session not found after processing"})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "error": str(e)})
        except Exception:
            pass
