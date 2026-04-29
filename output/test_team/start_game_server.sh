#!/usr/bin/env bash
# =============================================================================
# start_game_server.sh — 啟動千禧年蟲事件 (Millennium Bug Incident) 遊戲伺服器
# =============================================================================
# 用途：A0/A1 呼叫此腳本啟動遊戲後端 + 驗證前端可用性
# 環境：Windows Git Bash (MINGW64) 或 Linux/macOS bash
# 使用：./start_game_server.sh [port] [--stop] [--status]
# =============================================================================

set -euo pipefail

# ── 設定 ──────────────────────────────────────────────────────────────────
GAME_PORT="${1:-8765}"
GAME_SOURCE_DIR="${GAME_SOURCE_DIR:-C:/Users/qwqwh/.claude/projects/multi-agent-plan/output}"
STORY_ENGINE_DIR="${STORY_ENGINE_DIR:-C:/Users/qwqwh/.claude/projects/ai-text-adventure}"
LOG_FILE="/tmp/game_test_server_${GAME_PORT}.log"
PID_FILE="/tmp/game_test_server_${GAME_PORT}.pid"
MAX_STARTUP_WAIT=30

# LLM 環境變數（若未設定則使用預設）
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
export ANTHROPIC_BASE_URL="${ANTHROPIC_BASE_URL:-https://api.deepseek.com/anthropic}"
export ANTHROPIC_MODEL="${ANTHROPIC_MODEL:-deepseek-v4-pro}"

# ── 函數：檢查 Python 環境 ────────────────────────────────────────────────
check_python() {
  if ! command -v python &>/dev/null; then
    echo "[ERROR] python not found in PATH"
    return 1
  fi
  echo "[OK] python: $(python --version 2>&1)"
}

# ── 函數：檢查必要檔案 ────────────────────────────────────────────────────
check_frontend_files() {
  local missing=0
  local files=(
    "frontend/index.html"
    "frontend/css/main.css"
    "frontend/css/panels.css"
    "frontend/css/counters.css"
    "frontend/css/crt.css"
    "frontend/js/api.js"
    "frontend/js/renderer.js"
    "frontend/js/app.js"
    "frontend/js/background.js"
  )

  echo "[CHECK] Frontend files..."
  for f in "${files[@]}"; do
    if [[ -f "$GAME_SOURCE_DIR/$f" ]]; then
      echo "  [OK] $f"
    else
      echo "  [MISSING] $f"
      missing=$((missing + 1))
    fi
  done

  # 檢查場景檔案（可選，缺失不阻擋啟動）
  local scene_files=(
    "frontend/js/scenes/rain_underpass.js"
    "frontend/js/scenes/snow_bridge.js"
    "frontend/js/scenes/fog_highway.js"
    "frontend/js/scenes/blizzard_street.js"
  )
  for f in "${scene_files[@]}"; do
    if [[ -f "$GAME_SOURCE_DIR/$f" ]]; then
      echo "  [OK] $f"
    else
      echo "  [WARN] $f (scene may not render)"
    fi
  done

  return $missing
}

# ── 函數：啟動 uvicorn ────────────────────────────────────────────────────
start_uvicorn() {
  # 檢查 port 是否已被佔用
  if netstat -ano 2>/dev/null | grep -q ":${GAME_PORT} "; then
    echo "[WARN] Port ${GAME_PORT} is already in use"
    local existing_pid
    existing_pid=$(netstat -ano 2>/dev/null | grep ":${GAME_PORT} " | awk '{print $5}' | head -1)
    if [[ -n "$existing_pid" ]]; then
      echo "[WARN] Existing PID: $existing_pid"
    fi
  fi

  echo "[START] Starting uvicorn on port ${GAME_PORT}..."
  cd "$GAME_SOURCE_DIR"

  # 確保安裝依賴
  pip install -q fastapi uvicorn websockets python-dotenv 2>/dev/null || true

  # 背景啟動
  nohup python -m uvicorn backend.server:app \
    --host 0.0.0.0 \
    --port "$GAME_PORT" \
    --log-level info \
    > "$LOG_FILE" 2>&1 &

  local uvicorn_pid=$!
  echo "$uvicorn_pid" > "$PID_FILE"
  echo "[START] uvicorn PID: $uvicorn_pid"
  echo "[START] Log: $LOG_FILE"
}

# ── 函數：等待伺服器就緒 ──────────────────────────────────────────────────
wait_for_server() {
  echo "[WAIT] Waiting for server (max ${MAX_STARTUP_WAIT}s)..."

  local waited=0
  while [[ $waited -lt $MAX_STARTUP_WAIT ]]; do
    if curl -s "http://localhost:${GAME_PORT}/api/health" > /dev/null 2>&1; then
      echo "[READY] Server responded after ${waited}s"
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done

  echo "[ERROR] Server did not start within ${MAX_STARTUP_WAIT}s"
  echo "[ERROR] Last 10 lines of server log:"
  tail -10 "$LOG_FILE" 2>/dev/null || echo "  (no log available)"
  return 1
}

# ── 函數：載入前端驗證 ────────────────────────────────────────────────────
verify_frontend() {
  echo "[VERIFY] Loading frontend..."
  local html
  html=$(curl -s "http://localhost:${GAME_PORT}/" 2>/dev/null || echo "")

  if echo "$html" | grep -q "千禧年蟲事件"; then
    echo "[OK] Frontend loaded successfully"
    return 0
  else
    echo "[FAIL] Frontend did not return expected content"
    return 1
  fi
}

# ── 函數：健康檢查 ────────────────────────────────────────────────────────
health_check() {
  local response
  response=$(curl -s "http://localhost:${GAME_PORT}/api/health" 2>/dev/null || echo '{"status":"down"}')
  echo "[HEALTH] $(echo "$response" | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','unknown'))" 2>/dev/null || echo "$response")"
}

# ── 函數：停止伺服器 ──────────────────────────────────────────────────────
stop_server() {
  echo "[STOP] Stopping game server..."

  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid=$(cat "$PID_FILE")
    # Windows Git Bash: 使用 taskkill (注意: Git Bash 需 //PID 防止 path expansion)
    if command -v taskkill &>/dev/null; then
      MSYS_NO_PATHCONV=1 taskkill /PID "$pid" /F 2>/dev/null && echo "[STOP] Killed PID $pid via taskkill" || true
    elif kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null && echo "[STOP] Killed PID $pid via kill" || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi

  # 清理殘留的 uvicorn 進程
  pkill -f "uvicorn backend.server:app.*${GAME_PORT}" 2>/dev/null || true

  echo "[STOP] Server stopped"
}

# ── 函數：顯示狀態 ────────────────────────────────────────────────────────
show_status() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      echo "[STATUS] Server is RUNNING (PID: $pid, Port: $GAME_PORT)"
      health_check
    else
      echo "[STATUS] Server is STOPPED (stale PID file)"
    fi
  else
    echo "[STATUS] Server is STOPPED (no PID file)"
  fi
}

# ── 主程式 ─────────────────────────────────────────────────────────────────
main() {
  local mode="${1:-start}"
  GAME_PORT="${2:-8765}"

  echo "============================================"
  echo " 千禧年蟲事件 Game Server Manager"
  echo " Port: $GAME_PORT | Dir: $GAME_SOURCE_DIR"
  echo "============================================"

  case "$mode" in
    start)
      check_python
      check_frontend_files
      start_uvicorn
      if wait_for_server; then
        verify_frontend
        health_check
        echo ""
        echo "[DONE] Game server is ready at http://localhost:${GAME_PORT}"
        echo "[PID]  $(cat "$PID_FILE" 2>/dev/null || echo 'N/A')"
        echo "[LOG]  $LOG_FILE"
      else
        echo "[FATAL] Server failed to start"
        return 1
      fi
      ;;
    stop)
      stop_server
      ;;
    status)
      show_status
      ;;
    restart)
      stop_server
      sleep 2
      main start "$GAME_PORT"
      ;;
    *)
      echo "Usage: $0 {start|stop|status|restart} [port]"
      echo ""
      echo "Modes:"
      echo "  start    Start game server + verify frontend + health check"
      echo "  stop     Stop game server gracefully"
      echo "  status   Show server status"
      echo "  restart  Stop then start"
      echo ""
      echo "Environment variables:"
      echo "  GAME_SOURCE_DIR    Game source directory"
      echo "  STORY_ENGINE_DIR   Story engine source directory"
      echo "  ANTHROPIC_API_KEY  LLM API key"
      echo "  ANTHROPIC_MODEL    LLM model name (default: deepseek-v4-pro)"
      exit 1
      ;;
  esac
}

main "$@"
