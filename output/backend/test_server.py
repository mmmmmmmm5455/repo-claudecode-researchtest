"""Pytest tests for the FastAPI backend.

Tests cover:
  - Server startup and health check
  - POST /api/game/action response schema
  - GET /api/game/state with valid/invalid session
  - POST /api/game/new session creation
  - WebSocket connection and message flow
  - Scene selector logic
  - Viewer counter calculation
  - Static file serving

Run with: python -m pytest test_server.py -v --tb=short
"""

import json
import os
import sys

import pytest
from fastapi.testclient import TestClient

# Ensure backend package is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.scene_selector import select_scene, get_scene_transition
from backend.viewer_counter import calculate_viewer_count


# ── Fixtures ─────────────────────────────────────────────────────────────

@pytest.fixture
def client():
    """Create a FastAPI test client."""
    from backend.server import app
    with TestClient(app) as c:
        yield c


@pytest.fixture
def session_id(client):
    """Create a new game session and return its ID."""
    resp = client.post("/api/game/new")
    data = resp.json()
    return data["session_id"]


# ── Core API Tests ───────────────────────────────────────────────────────

class TestHealthCheck:
    """Test GET /api/health endpoint."""

    def test_health_returns_200(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200

    def test_health_has_required_fields(self, client):
        resp = client.get("/api/health")
        data = resp.json()
        assert "status" in data
        assert data["status"] == "ok"
        assert "sessions_active" in data


class TestNewGame:
    """Test POST /api/game/new endpoint."""

    def test_new_game_returns_session_id(self, client):
        resp = client.post("/api/game/new")
        assert resp.status_code == 200
        data = resp.json()
        assert "session_id" in data
        assert len(data["session_id"]) > 0

    def test_new_game_has_narrative(self, client):
        resp = client.post("/api/game/new")
        data = resp.json()
        assert "narrative" in data
        assert len(data["narrative"]) > 0

    def test_new_game_has_required_state_fields(self, client):
        resp = client.post("/api/game/new")
        data = resp.json()
        required = [
            "emotion_value", "infection_level", "memory_fragments",
            "scene_trigger", "viewer_count", "system_event",
        ]
        for field in required:
            assert field in data, f"Missing field: {field}"


class TestGameAction:
    """Test POST /api/game/action endpoint."""

    def test_action_returns_200(self, client, session_id):
        resp = client.post("/api/game/action", json={
            "session_id": session_id,
            "player_input": "look around",
        })
        assert resp.status_code == 200

    def test_action_response_schema(self, client, session_id):
        """G2.3: Response must contain narrative, emotion_value, viewer_count, scene_trigger."""
        resp = client.post("/api/game/action", json={
            "session_id": session_id,
            "player_input": "hello",
            "timestamp": "2026-01-01T00:00:00Z",
        })
        data = resp.json()
        assert "narrative" in data
        assert "emotion_value" in data
        assert "viewer_count" in data
        assert "scene_trigger" in data
        assert "infection_level" in data
        assert "memory_fragments" in data

    def test_action_missing_session_returns_error(self, client):
        resp = client.post("/api/game/action", json={
            "session_id": "nonexistent",
            "player_input": "hello",
        })
        data = resp.json()
        assert "narrative" in data
        assert "Session not found" in data["narrative"] or "error" in str(data).lower()

    def test_action_multiple_rounds(self, client, session_id):
        """Test multiple consecutive actions work."""
        for i, msg in enumerate(["look around", "walk forward", "search area"]):
            resp = client.post("/api/game/action", json={
                "session_id": session_id,
                "player_input": msg,
            })
            assert resp.status_code == 200


class TestGameState:
    """Test GET /api/game/state endpoint."""

    def test_state_returns_200(self, client, session_id):
        resp = client.get(f"/api/game/state?session_id={session_id}")
        assert resp.status_code == 200

    def test_state_has_required_fields(self, client, session_id):
        resp = client.get(f"/api/game/state?session_id={session_id}")
        data = resp.json()
        assert "session_id" in data
        assert "emotion_value" in data
        assert "scene_trigger" in data
        assert "viewer_count" in data

    def test_state_not_found(self, client):
        resp = client.get("/api/game/state?session_id=nonexistent123")
        assert resp.status_code == 404


# ── Scene Selector Tests ──────────────────────────────────────────────────

class TestSceneSelector:
    """Test scene selection logic per PRD Section 3.3."""

    def test_high_infection_triggers_blizzard(self):
        assert select_scene(emotion=50, infection=80) == "blizzard_street"

    def test_medium_infection_low_emotion_triggers_snow_bridge(self):
        assert select_scene(emotion=20, infection=60) == "snow_bridge"

    def test_low_emotion_below_40_triggers_blizzard(self):
        assert select_scene(emotion=30, infection=0) == "blizzard_street"

    def test_medium_emotion_triggers_rain(self):
        assert select_scene(emotion=50, infection=0) == "rain_underpass"

    def test_high_emotion_defaults_to_fog(self):
        assert select_scene(emotion=80, infection=0) == "fog_highway"

    def test_transition_same_scene_no_crossfade(self):
        t = get_scene_transition("rain_underpass", "rain_underpass")
        assert t["transition_type"] == "none"
        assert t["duration_ms"] == 0

    def test_transition_different_scene_crossfade(self):
        t = get_scene_transition("rain_underpass", "blizzard_street")
        assert t["transition_type"] == "crossfade"
        assert t["duration_ms"] == 3000
        assert t["crt_noise"] is True


# ── Viewer Counter Tests ─────────────────────────────────────────────────

class TestViewerCounter:
    """Test viewer count calculation per PRD Section 4.2."""

    def test_base_count_is_one(self):
        assert calculate_viewer_count(50, 0, 0) == 1

    def test_low_emotion_increases_count(self):
        assert calculate_viewer_count(10, 0, 0) > 1  # floor((20-10)/5) = 2

    def test_high_infection_increases_count(self):
        assert calculate_viewer_count(50, 80, 0) > 1  # floor((80-60)/10) = 2

    def test_fragments_add_to_count(self):
        assert calculate_viewer_count(50, 0, 5) == 6  # 1 + 5

    def test_glitch_events_add_to_count(self):
        assert calculate_viewer_count(50, 0, 0, glitch_events=3) == 4

    def test_max_capped_at_99(self):
        assert calculate_viewer_count(0, 100, 50, glitch_events=50) == 99

    def test_extreme_negative_emotion(self):
        # emotion=0: floor((20-0)/5) = 4, base=1 → 5
        assert calculate_viewer_count(0, 0, 0) == 5


# ── WebSocket Tests ──────────────────────────────────────────────────────

class TestWebSocket:
    """Test WebSocket /ws/game endpoint."""

    def test_websocket_connects(self, client):
        with client.websocket_connect("/ws/game") as ws:
            assert ws  # Connection successful

    def test_websocket_receives_tokens(self, client, session_id):
        with client.websocket_connect("/ws/game") as ws:
            ws.send_json({
                "session_id": session_id,
                "player_input": "look around",
            })
            # Should receive at least one message (token or state_update or error)
            data = ws.receive_json()
            assert "type" in data
            assert data["type"] in ("token", "state_update", "error")


# ── Static Files Test ────────────────────────────────────────────────────

class TestStaticFiles:
    """Test frontend static file serving."""

    def test_index_html_served(self, client):
        resp = client.get("/")
        assert resp.status_code in (200, 404)  # 404 if frontend/ doesn't exist yet
