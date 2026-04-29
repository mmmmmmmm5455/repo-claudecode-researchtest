# Deployment Guide — Millennium Bug Incident

## Prerequisites

- Python 3.10 or later
- pip (Python package manager)
- Git (for source control)
- An Anthropic API key (for LLM narrative generation)

## Installation

```bash
git clone <repo-url>
cd multi-agent-plan/output
pip install -r backend/requirements.txt
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| ANTHROPIC_API_KEY | Yes | — | Anthropic API key for LLM |
| ANTHROPIC_MODEL | No | deepseek-v4-pro | Model to use for generation |
| ANTHROPIC_BASE_URL | No | https://api.anthropic.com | API endpoint URL |
| GAME_SOURCE_DIR | No | ~/.claude/projects/ai-text-adventure | Original terminal game path |
| GAME_STATE_DIR | No | ./game_sessions | Session persistence directory |

Set in your shell profile or before launch:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export ANTHROPIC_MODEL="claude-sonnet-4-6"
```

## Launch

### Development

```bash
cd output
uvicorn backend.server:app --host 0.0.0.0 --port 8000 --reload
```

The --reload flag auto-restarts on code changes.

### Production

```bash
cd output
uvicorn backend.server:app --host 0.0.0.0 --port 8000 --workers 4
```

Or with a process manager:

```bash
gunicorn -w 4 -k uvicorn.workers.UvicornWorker backend.server:app --chdir output
```

## Verification

After launch, verify all endpoints:

```bash
curl http://localhost:8000/api/health
curl -X POST http://localhost:8000/api/game/new
curl "http://localhost:8000/api/game/state?session_id=YOUR_SESSION_ID"
curl -X POST http://localhost:8000/api/game/action   -H "Content-Type: application/json"   -d '{"session_id":"YOUR_SESSION_ID","player_input":"look around"}'
```

Frontend: open http://localhost:8000 in a browser.

## Running Tests

```bash
cd output
python -m pytest backend/test_server.py -v --tb=short
```

Expect 29 tests passing covering health check, game actions, state queries, WebSocket, scene selector logic, viewer counter, and static file serving.

## Static File Serving

The FastAPI server serves all frontend files from output/frontend/:
- CSS: /css/main.css, /css/panels.css, /css/counters.css, /css/crt.css
- JS: /js/api.js, /js/renderer.js, /js/app.js, /js/background.js
- Assets: /assets/fonts/, /assets/textures/
- Root: / → index.html

No separate web server or CDN is needed for development. For production, consider serving static files through Nginx or a CDN and proxying API requests to the Uvicorn backend.

## Production Notes

1. **API Key Security**: Never commit ANTHROPIC_API_KEY to git. Use environment variables or a .env file (add .env to .gitignore).
2. **Session Storage**: Game sessions are stored as JSON files in game_sessions/. Back up this directory for persistence across deployments.
3. **CORS**: The server uses same-origin by default. If serving frontend from a different domain, configure CORS middleware in server.py.
4. **Rate Limiting**: No built-in rate limiting. For production, add a reverse proxy (Nginx/Caddy) with rate limiting.
5. **LLM Costs**: Each player action triggers an LLM API call (streaming). Monitor usage and set budget alerts.
6. **WebSocket**: The /ws/game endpoint uses a single message exchange pattern (send input, receive token stream + state update). It does not support persistent bidirectional chat.
7. **HTTPS**: Uvicorn serves HTTP. For HTTPS, terminate TLS at a reverse proxy (Nginx, Caddy, Cloudflare Tunnel).

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| 404 on frontend | Wrong working directory | Run from output/ directory |
| LLM fallback message | Missing API key | Set ANTHROPIC_API_KEY |
| Session not found | Session expired or deleted | Create new session via /api/game/new |
| ImportError: StoryEngine | Missing original game | Set GAME_SOURCE_DIR or check path |
| WebSocket fails | Proxy doesn't support WS | Configure proxy to pass WebSocket upgrades |

## Directory Layout for Deployment

```
deploy/
├── output/
│   ├── backend/
│   ├── frontend/
│   └── game_sessions/    # Created at runtime
├── .env                  # Environment variables (not in git)
└── docker-compose.yml    # Optional container setup
```
