#!/usr/bin/env bash
# =============================================================================
# orchestrator.sh — Game Test Team 主入口
# =============================================================================
# 呼叫順序：A0(讀取 config) → A1(pytest+Playwright) → A2(分析) → A3(修復) →
#           A6(回歸) → A4/A5/A7(平行評估) → A0(報告)
#
# 使用：./orchestrator.sh [mode] [--auto-commit] [--max-cycles N]
#   mode: full_cycle | quick_check | fix_only | review_only
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Convert Git Bash /c/Users to C:/Users for Python open() compatibility
SCRIPT_DIR="$(cygpath -m "$SCRIPT_DIR" 2>/dev/null || echo "$SCRIPT_DIR")"
CONFIG_FILE="${SCRIPT_DIR}/config.json"
CACHE_DIR="${SCRIPT_DIR}/.test_team_cache"
REPORTS_DIR="${SCRIPT_DIR}/reports"
SCHEMAS_DIR="${SCRIPT_DIR}/schemas"
PROMPTS_DIR="${SCRIPT_DIR}/prompts"

# 讀取 config（使用 python 解析 JSON）
read_config() {
  local key="$1"
  python -c "
import json, sys
with open('$CONFIG_FILE', 'r') as f:
    cfg = json.load(f)
keys = '$key'.split('.')
val = cfg
for k in keys:
    val = val.get(k, {})
if isinstance(val, (dict, list)):
    print(json.dumps(val))
else:
    print(val)
"
}

# ── 生成 orchestration ID ──────────────────────────────────────────────────
generate_orch_id() {
  echo "ORCH-$(date +%Y%m%d)-$(date +%H%M%S)-${RANDOM}"
}

# ── Agent 調用函數 ─────────────────────────────────────────────────────────
run_agent() {
  local agent="$1"
  local input_file="$2"
  local output_file="$3"

  echo "[$(date +%H:%M:%S)] Running $agent..."
  echo "  Input:  $input_file"
  echo "  Output: $output_file"

  # Agent 透過讀取 input JSON + prompt 檔案執行
  # 實際執行由 Claude Code agent 系統處理
  # 此處寫入觸發標記供 A0 讀取
  local agent_prompt="${PROMPTS_DIR}/${agent}.md"

  if [[ ! -f "$agent_prompt" ]]; then
    echo "[ERROR] Agent prompt not found: $agent_prompt"
    return 1
  fi

  # 寫入執行狀態標記
  mkdir -p "$CACHE_DIR"
  echo "{\"agent\":\"$agent\",\"status\":\"triggered\",\"input\":\"$input_file\",\"output\":\"$output_file\",\"timestamp\":\"$(date -Iseconds)\"}" \
    > "${CACHE_DIR}/${agent}_status.json"

  return 0
}

# ── Gate 檢查函數 ──────────────────────────────────────────────────────────
check_gate() {
  local gate="$1"
  local output_file="$2"

  case "$gate" in
    G1)
      # pytest 29/29 + all suites pass
      python -c "
import json
with open('$output_file') as f:
    d = json.load(f)
assert d['overall_pass'] == True, 'G1 FAIL: overall_pass is false'
p = d['suites']['pytest']
assert p['total'] == 29, f'G1 FAIL: pytest total={p[\"total\"]}, expected 29'
assert p['failed'] == 0, f'G1 FAIL: pytest failed={p[\"failed\"]}'
print('G1 PASS')
"
      ;;
    G2)
      python -c "
import json
with open('$output_file') as f:
    d = json.load(f)
api = d['suites']['api']
assert api['pass'] == True, 'G2 FAIL: api pass is false'
assert api['endpoints_passed'] == api['endpoints_tested'], 'G2 FAIL: not all endpoints passed'
print('G2 PASS')
"
      ;;
    G4)
      python -c "
import json
with open('$output_file') as f:
    d = json.load(f)
assert d['gate_pass'] == True, 'G4 FAIL: regression gate_pass is false'
assert d['regression_detected'] == False, 'G4 FAIL: regression detected'
print('G4 PASS')
"
      ;;
    G5)
      python -c "
import json
with open('$output_file') as f:
    d = json.load(f)
assert d['overall_health'] != 'critical', 'G5 FAIL: performance critical'
print('G5 PASS')
"
      ;;
    G6)
      # 檢查 bugs_remaining 是否較上一輪減少
      local prev_count="$3"
      python -c "
import json
with open('$output_file') as f:
    d = json.load(f)
remaining = d['summary']['bugs_remaining']
prev = $prev_count
if remaining < prev:
    print(f'G6 PASS: bugs {prev} -> {remaining}')
elif remaining == 0 and prev == 0:
    print('G6 PASS: zero bugs')
else:
    print(f'G6 FAIL: bugs {prev} -> {remaining} (no progress)')
    exit(1)
"
      ;;
    *)
      echo "[WARN] Unknown gate: $gate"
      return 0
      ;;
  esac
}

# ── 主流程 ─────────────────────────────────────────────────────────────────
main() {
  local MODE="${1:-full_cycle}"
  local AUTO_COMMIT="False"
  local MAX_CYCLES="5"

  # 解析參數
  shift 1 2>/dev/null || true
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --auto-commit) AUTO_COMMIT="true"; shift ;;
      --max-cycles) MAX_CYCLES="$2"; shift 2 ;;
      --port) GAME_PORT="$2"; shift 2 ;;
      *) echo "Unknown option: $1"; exit 1 ;;
    esac
  done

  local ORCH_ID
  ORCH_ID=$(generate_orch_id)
  local START_TIME
  START_TIME=$(date -Iseconds)

  echo "============================================"
  echo " Game Test Team Orchestrator"
  echo " Orchestration ID: $ORCH_ID"
  echo " Mode: $MODE | Max Cycles: $MAX_CYCLES"
  echo " Auto Commit: $AUTO_COMMIT"
  echo "============================================"
  echo ""

  # ── Step 1: 啟動遊戲伺服器 ────────────────────────────────────────────────
  echo "── Step 1: Starting game server ──"
  bash "${SCRIPT_DIR}/start_game_server.sh" start 8765 || {
    echo "[FATAL] Cannot start game server"
    exit 1
  }
  echo ""

  # ── Step 2: 準備快取目錄 ──────────────────────────────────────────────────
  mkdir -p "$CACHE_DIR/backups"
  mkdir -p "$REPORTS_DIR/latest"
  mkdir -p "$REPORTS_DIR/history"

  # 寫入 A0 輸入
  local a0_input="${CACHE_DIR}/a0_input.json"
  python -c "
import json, sys
d = {
    'orchestration_id': '$ORCH_ID',
    'mode': '$MODE',
    'max_cycles': $MAX_CYCLES,
    'target_url': 'http://localhost:8765',
    'auto_commit': ${AUTO_COMMIT},
    'game_source_dir': r'C:\\Users\\qwqwh\\.claude\\projects\\multi-agent-plan\\output'
}
with open('$a0_input', 'w') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
print(f'A0 input written to $a0_input')
"

  local cycle=0
  local prev_bug_count=999
  local overall_status="all_clear"

  while [[ $cycle -lt $MAX_CYCLES ]]; do
    cycle=$((cycle + 1))
    echo ""
    echo "════════════════════════════════════════════"
    echo " Cycle $cycle / $MAX_CYCLES"
    echo "════════════════════════════════════════════"

    # ── A1: Test Runner ──────────────────────────────────────────────────
    echo "── A1: Test Runner ──"
    local a1_input="${CACHE_DIR}/a1_input.json"
    local a1_output="${CACHE_DIR}/a1_output.json"

    python -c "
import json
d = {
    'test_id': '${ORCH_ID}-C${cycle}',
    'target': 'all',
    'server_port': 8765,
    'server_host': '127.0.0.1',
    'timeout_seconds': 120,
    'start_server': False,
    'stop_server_after': False,
    'game_source_dir': r'C:\\Users\\qwqwh\\.claude\\projects\\multi-agent-plan\\output'
}
with open('$a1_input', 'w') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
"

    run_agent "a1_test_runner" "$a1_input" "$a1_output"
    echo "[NOTE] A1 execution delegated to Claude Code agent system"
    echo ""

    # ── 檢查 G1 ─────────────────────────────────────────────────────────
    # (在實際執行中，G1-G6 由 A0 agent 讀取輸出後判斷，此處僅記錄流程)
    echo "[GATE] G1 check pending (A1 output required)"

    # 在 quick_check 模式下，A1 完成即結束
    if [[ "$MODE" == "quick_check" ]]; then
      echo "[MODE] quick_check — stopping after A1"
      break
    fi

    # ── A2: Bug Hunter ──────────────────────────────────────────────────
    echo "── A2: Bug Hunter ──"
    local a2_input="${CACHE_DIR}/a2_input.json"
    local a2_output="${CACHE_DIR}/a2_output.json"

    python -c "
import json
d = {
    'hunt_id': '${ORCH_ID}-C${cycle}',
    'test_output_path': '${CACHE_DIR}/a1_output.json',
    'hunt_depth': 'standard',
    'max_bugs_to_report': 50,
    'target_url': 'http://localhost:8765',
    'game_source_dir': r'C:\\Users\\qwqwh\\.claude\\projects\\multi-agent-plan\\output'
}
with open('$a2_input', 'w') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
"

    run_agent "a2_bug_hunter" "$a2_input" "$a2_output"
    echo ""

    # ── A3: Bug Fixer + A6: Regression Guard ────────────────────────────
    echo "── A3: Bug Fixer ──"
    local a3_input="${CACHE_DIR}/a3_input.json"
    local a3_output="${CACHE_DIR}/a3_output.json"

    python -c "
import json
d = {
    'fix_id': '${ORCH_ID}-C${cycle}',
    'bugs': [],  # Will be populated from A2 output
    'game_source_dir': r'C:\\Users\\qwqwh\\.claude\\projects\\multi-agent-plan\\output',
    'max_files_to_touch_per_bug': 3,
    'dry_run': False
}
with open('$a3_input', 'w') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
"

    run_agent "a3_bug_fixer" "$a3_input" "$a3_output"
    echo ""

    # ── A6: Regression Guard ────────────────────────────────────────────
    echo "── A6: Regression Guard ──"
    local a6_input="${CACHE_DIR}/a6_input.json"
    local a6_output="${CACHE_DIR}/a6_output.json"

    python -c "
import json
d = {
    'guard_id': '${ORCH_ID}-C${cycle}',
    'fix_output_path': '${CACHE_DIR}/a3_output.json',
    'pre_fix_test_output_path': '${CACHE_DIR}/a1_output.json',
    'target_url': 'http://localhost:8765',
    'screenshot_diff_tolerance_pct': 2.0,
    'game_source_dir': r'C:\\Users\\qwqwh\\.claude\\projects\\multi-agent-plan\\output'
}
with open('$a6_input', 'w') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
"

    run_agent "a6_regression_guard" "$a6_input" "$a6_output"
    echo ""

    # ── 循環終止判斷 ────────────────────────────────────────────────────
    # 檢查是否有進展 (簡化判斷：A0 agent 在實際執行中做精確判斷)
    if [[ "$MODE" == "fix_only" ]]; then
      echo "[MODE] fix_only — running another cycle if needed"
    fi

    # 防止無限循環的精簡檢查：最多 max_cycles 輪
  done

  # ── Step 3: 平行評估層 ──────────────────────────────────────────────────
  if [[ "$MODE" == "full_cycle" || "$MODE" == "review_only" ]]; then
    echo ""
    echo "── Layer 3: Parallel Evaluation ──"

    # A4: Performance Profiler
    local a4_input="${CACHE_DIR}/a4_input.json"
    local a4_output="${CACHE_DIR}/a4_output.json"
    python -c "
import json
d = {
    'profile_id': '${ORCH_ID}-eval',
    'target_url': 'http://localhost:8765',
    'duration_seconds': 60,
    'concurrent_users': 1,
    'sample_rate': 10,
    'game_source_dir': r'C:\\Users\\qwqwh\\.claude\\projects\\multi-agent-plan\\output'
}
with open('$a4_input', 'w') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
"
    run_agent "a4_performance" "$a4_input" "$a4_output" &

    # A5: UX Evaluator
    local a5_input="${CACHE_DIR}/a5_input.json"
    local a5_output="${CACHE_DIR}/a5_output.json"
    python -c "
import json
d = {
    'eval_id': '${ORCH_ID}-eval',
    'target_url': 'http://localhost:8765',
    'browser': 'chromium',
    'headless': True,
    'screenshot_on_failure': True,
    'viewport_width': 1280,
    'viewport_height': 720,
    'game_source_dir': r'C:\\Users\\qwqwh\\.claude\\projects\\multi-agent-plan\\output'
}
with open('$a5_input', 'w') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
"
    run_agent "a5_ux_evaluator" "$a5_input" "$a5_output" &

    # A7: Content Reviewer
    local a7_input="${CACHE_DIR}/a7_input.json"
    local a7_output="${CACHE_DIR}/a7_output.json"
    python -c "
import json
d = {
    'review_id': '${ORCH_ID}-eval',
    'target_url': 'http://localhost:8765',
    'sample_size': 10,
    'review_aspects': ['narrative', 'localization', 'length', 'balance', 'scenes'],
    'game_source_dir': r'C:\\Users\\qwqwh\\.claude\\projects\\multi-agent-plan\\output'
}
with open('$a7_input', 'w') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
"
    run_agent "a7_content_reviewer" "$a7_input" "$a7_output" &

    # 等待平行評估完成
    wait
    echo "[DONE] Parallel evaluation complete"
  fi

  # ── Step 4: 停止伺服器 ──────────────────────────────────────────────────
  echo ""
  echo "── Step 4: Stopping game server ──"
  bash "${SCRIPT_DIR}/start_game_server.sh" stop 8765

  # ── Step 5: 最終報告 ────────────────────────────────────────────────────
  local END_TIME
  END_TIME=$(date -Iseconds)
  local REPORT_PATH="${REPORTS_DIR}/latest/report_${ORCH_ID}.json"

  echo ""
  echo "============================================"
  echo " Orchestration Complete"
  echo " ID: $ORCH_ID | Cycles: $cycle"
  echo " Started:  $START_TIME"
  echo " Ended:    $END_TIME"
  echo " Report:   $REPORT_PATH"
  echo "============================================"

  # 複製報告到 history
  mkdir -p "${REPORTS_DIR}/history"
  cp "$REPORT_PATH" "${REPORTS_DIR}/history/" 2>/dev/null || true

  echo ""
  echo "Agent output files in ${CACHE_DIR}/:"
  ls -la "$CACHE_DIR"/*.json 2>/dev/null || echo "  (no JSON output files yet)"
}

main "$@"
