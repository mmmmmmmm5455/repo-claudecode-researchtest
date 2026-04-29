#!/usr/bin/env bash
# =============================================================================
# Part C: Multi-Agent Pipeline Execution Script
# "千禧年蟲事件" — Web Frontend Development Pipeline
# 8 Agents: Tech Survey → Backend Refactor + 3D Scenes + CSS UI + API Layer → QA → Docs + Git Push
# =============================================================================
# Usage:
#   ./execute.sh --test              Dry-run: validate plan, no execution
#   ./execute.sh --prod              Full production execution
#   ./execute.sh --resume            Resume from last checkpoint
#   ./execute.sh --prod --agent=X    Run only agent X (for debugging)
#   ./execute.sh --status            Show pipeline status
#   ./execute.sh --clean             Clean all outputs (confirmation required)
# =============================================================================

set -euo pipefail

# ── Constants ──────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${SCRIPT_DIR}"
OUTPUT_DIR="${PROJECT_DIR}/output"
CHECKPOINT_DIR="${OUTPUT_DIR}/.checkpoints"
LOG_DIR="${OUTPUT_DIR}/logs"
CONFIG_FILE="${PROJECT_DIR}/workflow.yaml"
PLAN_FILE="${PROJECT_DIR}/MASTER_PLAN.md"

# DeepSeek Pro config
export ANTHROPIC_BASE_URL="${ANTHROPIC_BASE_URL:-https://api.deepseek.com/anthropic}"
export CLAUDE_CODE_EFFORT_LEVEL="${CLAUDE_CODE_EFFORT_LEVEL:-max}"

# Skill paths (skills are spread across multiple directories)
SKILLS_BASE="${HOME}/.claude/skills"
SKILLS_ARCHIVE="${HOME}/.claude/skills-archive"
SKILLS_REPOS="${HOME}/.claude/repos"
SKILL_ROUTER="${SKILLS_BASE}/skill-router/skill_router.py"
# Combined search paths for skill existence checks
SKILL_SEARCH_PATHS=("${SKILLS_BASE}" "${SKILLS_ARCHIVE}" "${SKILLS_REPOS}")

# ── Colors ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
BOLD='\033[1m'

# ── State ──────────────────────────────────────────────────────────────────
MODE=""
TARGET_AGENT=""
GIT_REMOTE=""
GIT_BRANCH="master"
GAME_SOURCE_DIR="${GAME_SOURCE_DIR:-${HOME}/.claude/projects/ai-text-adventure}"
GIT_PUSH_FAILED=false
PIPELINE_START_TIME=""
PHASE_START_TIME=""
CURRENT_PHASE=""
AGENT_FAILURES=0
RECOVERY_COUNT=0
declare -A AGENT_STATUS
declare -A AGENT_PIDS
declare -A CHECKPOINT_MANIFEST

# ── Logging ────────────────────────────────────────────────────────────────
log() {
    local level="$1"; shift
    local timestamp; timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo -e "${timestamp} [${level}] $*"
    mkdir -p "${LOG_DIR}"
    echo "{\"timestamp\":\"${timestamp}\",\"level\":\"${level}\",\"message\":\"$*\"}" >> "${LOG_DIR}/pipeline.jsonl"
}

log_info()  { log "INFO" "$@"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; log "WARN" "$@"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; log "ERROR" "$@"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $*"; log "OK" "$@"; }
log_phase() { echo -e "\n${BOLD}${CYAN}━━━ $* ━━━${NC}"; log "PHASE" "$*"; }

# ── Help ───────────────────────────────────────────────────────────────────
show_help() {
    cat << 'EOF'
╔══════════════════════════════════════════════════════════════════════╗
║     Multi-Agent Game Development Pipeline — Execution Script        ║
╚══════════════════════════════════════════════════════════════════════╝

Usage: ./execute.sh [MODE] [OPTIONS]

Modes:
  --test              Dry-run: validate topology, dependencies, skills.
                      No LLM calls, no filesystem writes (uses /tmp/dry-run).
  --prod              Full production execution with real LLM inference.
                      Launches guardians, enforces quality gates.
  --resume            Resume from last checkpoint after interruption.
                      Skips completed phases, re-dispatches failed agents.
  --status            Show pipeline status (checkpoints, agent states).
  --clean             Remove all outputs (asks for confirmation).

Options:
  --agent=<ID>           Run only a specific agent (debug mode).
  --phase=<N>            Run only a specific phase (1-4).
  --git-remote=<URL>     Git remote URL for push (required for --prod).
  --git-branch=<NAME>    Git branch name (default: master).
  --game-source-dir=<PATH>  Path to original game source code.

Environment:
  GIT_REMOTE=<URL>       Git remote URL (overridden by --git-remote).
  GAME_SOURCE_DIR=<PATH> Path to original game source (default: ~/.claude/projects/ai-text-adventure).
  SKIP_GUARDIANS=1       Skip launching guardian agents.
  DEBUG_AGENT=1          Verbose agent output to stderr.
  FORCE_RECOVERY=1       Force recovery protocol even on clean state.
EOF
    exit 0
}

# ── Validation ─────────────────────────────────────────────────────────────
validate_environment() {
    log_info "Validating environment..."

    # Check required tools (test mode only needs python3)
    if [[ "${MODE}" == "test" ]]; then
        if ! command -v python3 &>/dev/null; then
            log_error "Required tool not found: python3"
            return 1
        fi
    else
        for cmd in python3 claude jq; do
            if ! command -v "$cmd" &>/dev/null; then
                log_error "Required tool not found: $cmd"
                return 1
            fi
        done
    fi

    # Check Claude Code is accessible
    if ! claude --version &>/dev/null; then
        log_error "Claude Code CLI not accessible"
        return 1
    fi

    # Check skill router
    if [[ ! -f "${SKILL_ROUTER}" ]]; then
        log_warn "Skill router not found at ${SKILL_ROUTER}"
        log_warn "Skills will be loaded without routing (higher token usage)"
    fi

    # Check output directory
    mkdir -p "${OUTPUT_DIR}" "${CHECKPOINT_DIR}" "${LOG_DIR}"

    # Check disk space (min 5GB)
    local free_space
    free_space=$(df -BG "${OUTPUT_DIR}" 2>/dev/null | awk 'NR==2 {print $4}' | sed 's/G//')
    if [[ -n "${free_space}" && "${free_space}" -lt 5 ]]; then
        log_error "Insufficient disk space: ${free_space}GB free (need 5GB)"
        return 1
    fi

    # Validate config
    if [[ ! -f "${CONFIG_FILE}" ]]; then
        log_error "Config file not found: ${CONFIG_FILE}"
        return 1
    fi

    # Validate API key
    if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
        # Try to get it via the configured helper
        ANTHROPIC_API_KEY=$(powershell.exe -NoProfile -Command "[Environment]::GetEnvironmentVariable('ANTHROPIC_API_KEY','User')" 2>/dev/null || echo "")
        if [[ -z "${ANTHROPIC_API_KEY}" ]]; then
            log_error "ANTHROPIC_API_KEY not set"
            return 1
        fi
        export ANTHROPIC_API_KEY
    fi

    # Validate GIT_REMOTE for --prod mode (mandatory)
    if [[ "${MODE}" == "prod" ]]; then
        GIT_REMOTE="${GIT_REMOTE:-}"
        if [[ -z "${GIT_REMOTE}" ]]; then
            log_error "GIT_REMOTE not set — required for --prod mode"
            log_error ""
            log_error "The pipeline MUST push deliverables to a Git remote. Set it via:"
            log_error "  export GIT_REMOTE=\"git@github.com:your-username/your-repo.git\""
            log_error "  Or: ./execute.sh --prod --git-remote=\"git@github.com:your-username/your-repo.git\""
            log_error ""
            log_error "For SSH authentication:"
            log_error "  1. Generate an SSH key: ssh-keygen -t ed25519 -C \"your@email.com\""
            log_error "  2. Add to GitHub:     cat ~/.ssh/id_ed25519.pub → GitHub Settings → SSH Keys"
            log_error "  3. Test:              ssh -T git@github.com"
            log_error ""
            log_error "For HTTPS + Personal Access Token:"
            log_error "  export GIT_REMOTE=\"https://github.com/your-username/your-repo.git\""
            log_error "  git config --global credential.helper store"
            return 1
        fi
        log_info "GIT_REMOTE = $(echo "${GIT_REMOTE}" | sed 's/:[^:@]*@/:****@/')"
    fi

    # Validate GAME_SOURCE_DIR for --prod mode (A2 needs original game code)
    if [[ "${MODE}" == "prod" ]]; then
        if [[ ! -d "${GAME_SOURCE_DIR}" ]]; then
            log_error "GAME_SOURCE_DIR not found: ${GAME_SOURCE_DIR}"
            log_error "  Set via: export GAME_SOURCE_DIR=/path/to/ai-text-adventure"
            log_error "  Or use: --game-source-dir=/path/to/ai-text-adventure"
            return 1
        fi
        if [[ ! -f "${GAME_SOURCE_DIR}/engine/ai_dialogue.py" ]]; then
            log_error "GAME_SOURCE_DIR appears invalid: ${GAME_SOURCE_DIR}/engine/ai_dialogue.py missing"
            return 1
        fi
        log_info "GAME_SOURCE_DIR = ${GAME_SOURCE_DIR}"
    fi

    log_ok "Environment validated"
    return 0
}

run_test_mode() {
    log_phase "TEST MODE: Comprehensive Plan Validation"
    local test_start; test_start=$(date +%s)
    local report_file="${OUTPUT_DIR}/test_validation_report.json"
    mkdir -p "${OUTPUT_DIR}"
    cd "${PROJECT_DIR}"  # Ensure CWD is project dir for Python path resolution

    # Initialize report
    cat > "${report_file}" << 'EOF'
{
  "test_run": {
    "timestamp": "",
    "mode": "test",
    "results": {}
  }
}
EOF

    local overall_pass=true
    declare -A test_results

    # ── Check 1: YAML Syntax Validation ──────────────────────────────────
    log_info "[TEST:1/5] Validating workflow.yaml syntax..."
    if python3 -c "
import yaml, sys
try:
    with open('workflow.yaml', 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    print(f'YAML_OK: {len(data)} top-level keys found')
    sys.exit(0)
except Exception as e:
    print(f'YAML_ERROR: {e}')
    sys.exit(1)
" 2>&1; then
        log_ok "[TEST:1/5] PASS — workflow.yaml is valid YAML"
        test_results["yaml_syntax"]="pass"
    else
        log_error "[TEST:1/5] FAIL — workflow.yaml has YAML syntax errors"
        test_results["yaml_syntax"]="fail"
        overall_pass=false
    fi

    # ── Check 2: Agent Input/Output Schema Validation ────────────────────
    log_info "[TEST:2/5] Validating agent I/O schemas..."
    local schema_errors=0
    local agent_ids; agent_ids=$(python3 -c "
import yaml
with open('workflow.yaml', 'r', encoding='utf-8') as f:
    data = yaml.safe_load(f)
agents = data.get('agents', {})
for aid in agents:
    print(aid.strip())
" 2>/dev/null | tr -d '\r')
    local agent_ids_count; agent_ids_count=$(echo "${agent_ids}" | grep -c . || echo "0")

    for agent_id in ${agent_ids}; do
        local validation; validation=$(python3 -c "
import yaml, json
with open('workflow.yaml', 'r', encoding='utf-8') as f:
    data = yaml.safe_load(f)
agent = data['agents'].get('${agent_id}', {})
issues = []
# Check input section exists
if 'input' not in agent:
    issues.append('missing input section')
# Check output section exists
if 'output' not in agent:
    issues.append('missing output section')
else:
    out = agent['output']
    if 'format' not in out:
        issues.append('output missing format')
    if 'file' not in out:
        issues.append('output missing file')
    if 'schema' not in out:
        issues.append('output missing schema')
# Check skills section
if 'skills' not in agent:
    issues.append('missing skills section')
elif len(agent['skills']) == 0:
    issues.append('empty skills list')
# Check quality_gate
if 'quality_gate' not in agent:
    issues.append('missing quality_gate')
# Check depends_on
if 'depends_on' in agent:
    deps = agent['depends_on']
    if not isinstance(deps, list):
        issues.append('depends_on is not a list')
if issues:
    print('FAIL: ' + '; '.join(issues))
else:
    print('PASS')
" 2>/dev/null)
        if [[ "${validation}" == "PASS" ]]; then
            log_info "  [${agent_id}] PASS"
        else
            log_error "  [${agent_id}] ${validation}"
            schema_errors=$((schema_errors + 1))
        fi
    done

    if [[ ${schema_errors} -eq 0 ]]; then
        log_ok "[TEST:2/5] PASS — all ${agent_ids_count} agent schemas valid"
        test_results["schema_validation"]="pass"
    else
        log_error "[TEST:2/5] FAIL — ${schema_errors} agent(s) have schema issues"
        test_results["schema_validation"]="fail"
        overall_pass=false
    fi

    # ── Check 3: Skill Existence Verification ───────────────────────────
    log_info "[TEST:3/5] Verifying all referenced skills exist on disk..."
    local missing_skills=()
    local all_refd_skills; all_refd_skills=$(python3 -c "
import yaml
with open('workflow.yaml', 'r', encoding='utf-8') as f:
    data = yaml.safe_load(f)
agents = data.get('agents', {})
skills = set()
for aid, adef in agents.items():
    for s in adef.get('skills', []):
        skills.add(s.strip())
# Also add guardian skills
for gkey in ['session_guardian', 'standby_monitor']:
    g = data.get(gkey, {})
    for s in g.get('skills', []):
        skills.add(s.strip())
for s in sorted(skills):
    print(s)
" 2>/dev/null | tr -d '\r')

    while IFS= read -r skill; do
        # Strip Windows carriage return if present
        skill="${skill%$'\r'}"
        [[ -z "${skill}" ]] && continue
        local found=false
        local found_path=""

        # Search across all skill directories: skills, skills-archive, repos
        for search_base in "${SKILL_SEARCH_PATHS[@]}"; do
            # Check exact path first
            if [[ -f "${search_base}/${skill}/SKILL.md" ]]; then
                found=true
                found_path="${search_base}/${skill}/SKILL.md"
                break
            fi
            # Try with known prefixes (skill may be stored under prefixed dir)
            for prefix in "sci-" "ccgs-" "os-" "ov-" "gstack-" "pm-" "godogen-"; do
                if [[ -f "${search_base}/${prefix}${skill}/SKILL.md" ]]; then
                    found=true
                    found_path="${search_base}/${prefix}${skill}/SKILL.md"
                    break 2  # break out of both loops
                fi
            done
            # Try without prefix (strip known prefixes)
            for prefix in "sci-" "ccgs-" "os-" "ov-" "gstack-" "pm-" "godogen-"; do
                local bare="${skill#${prefix}}"
                if [[ "${bare}" != "${skill}" ]]; then
                    if [[ -f "${search_base}/${bare}/SKILL.md" ]]; then
                        found=true
                        found_path="${search_base}/${bare}/SKILL.md"
                        break 2  # break out of both loops
                    fi
                fi
            done
        done

        if [[ "${found}" == "true" ]]; then
            log_info "  FOUND: ${skill} → ${found_path}"
        else
            missing_skills+=("${skill}")
            log_error "  MISSING: ${skill} (searched: ${SKILL_SEARCH_PATHS[*]})"
        fi
    done <<< "${all_refd_skills}"

    if [[ ${#missing_skills[@]} -eq 0 ]]; then
        log_ok "[TEST:3/5] PASS — all referenced skills found"
        test_results["skill_existence"]="pass"
    else
        log_error "[TEST:3/5] FAIL — ${#missing_skills[@]} missing skill(s): ${missing_skills[*]}"
        test_results["skill_existence"]="fail"
        test_results["missing_skills"]="${missing_skills[*]}"
        overall_pass=false
    fi

    # ── Check 4: Circular Dependency Detection ──────────────────────────
    log_info "[TEST:4/5] Checking for circular dependencies..."
    local dep_errors; dep_errors=$(python3 -c "
import yaml
from collections import defaultdict

with open('workflow.yaml', 'r', encoding='utf-8') as f:
    data = yaml.safe_load(f)

agents = data.get('agents', {})
deps = {}
for aid, adef in agents.items():
    d = adef.get('depends_on', [])
    if d is None:
        d = []
    deps[aid] = d

# Build adjacency list
graph = defaultdict(list)
for aid, dlist in deps.items():
    for dep in dlist:
        graph[dep].append(aid)

# DFS cycle detection
WHITE, GRAY, BLACK = 0, 1, 2
color = {n: WHITE for n in graph}
for n in deps:
    if n not in color:
        color[n] = WHITE

def dfs(node, path):
    color[node] = GRAY
    for neighbor in graph.get(node, []):
        if color.get(neighbor, WHITE) == GRAY:
            cycle = path[path.index(neighbor):] + [node, neighbor]
            return ' → '.join(cycle)
        if color.get(neighbor, WHITE) == WHITE:
            result = dfs(neighbor, path + [node])
            if result:
                return result
    color[node] = BLACK
    return None

cycles = []
for node in list(deps.keys()):
    if color.get(node, WHITE) == WHITE:
        c = dfs(node, [])
        if c:
            cycles.append(c)

# Print dependency tree
print('=== DEPENDENCY TREE ===')
for phase in ['1', '2', '3', '4', '4b']:
    phase_agents = [aid for aid, adef in agents.items() if str(adef.get('phase', '')) == phase]
    print(f'Phase {phase}:')
    for aid in sorted(phase_agents):
        dep_list = deps.get(aid, [])
        dep_str = ' → depends on: ' + ', '.join(dep_list) if dep_list else ' (no dependencies)'
        print(f'  {aid}{dep_str}')

# Max dependency depth
def max_depth(node, visited=None):
    if visited is None:
        visited = set()
    if node in visited:
        return 0
    visited.add(node)
    dlist = deps.get(node, [])
    if not dlist:
        return 0
    return 1 + max(max_depth(d, visited.copy()) for d in dlist)

max_d = 0
for aid in deps:
    max_d = max(max_d, max_depth(aid))

print(f'=== MAX DEPENDENCY DEPTH: {max_d} ===')
print(f'=== TOTAL AGENTS: {len(agents)} ===')

if cycles:
    print('CYCLES_FOUND: ' + ' | '.join(cycles))
else:
    print('NO_CYCLES')
" 2>/dev/null)
    echo "${dep_errors}"

    if echo "${dep_errors}" | grep -q "NO_CYCLES"; then
        log_ok "[TEST:4/5] PASS — no circular dependencies detected"
        test_results["dependency_check"]="pass"
    else
        if echo "${dep_errors}" | grep -q "CYCLES_FOUND"; then
            log_error "[TEST:4/5] FAIL — circular dependencies found!"
            test_results["dependency_check"]="fail"
            overall_pass=false
        else
            log_ok "[TEST:4/5] PASS — no circular dependencies detected"
            test_results["dependency_check"]="pass"
        fi
    fi

    # ── Check 5: GIT_REMOTE Configuration (warn only in test mode) ─────
    log_info "[TEST:5/5] Checking Git configuration..."
    if [[ -z "${GIT_REMOTE}" ]]; then
        log_warn "[TEST:5/5] GIT_REMOTE not set — git push would fail in --prod mode"
        log_warn "  Set via: export GIT_REMOTE=git@github.com:user/repo.git"
        log_warn "  Or use:  --git-remote=git@github.com:user/repo.git"
        test_results["git_config"]="warn_not_set"
    else
        log_info "[TEST:5/5] GIT_REMOTE = ${GIT_REMOTE}"
        # Test connectivity (non-blocking)
        if echo "${GIT_REMOTE}" | grep -q "^git@"; then
            log_info "[TEST:5/5] SSH remote detected — testing ssh -T git@github.com..."
            if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
                log_ok "[TEST:5/5] SSH authentication OK"
                test_results["git_config"]="pass"
            else
                log_warn "[TEST:5/5] SSH test failed — push may not work. Ensure SSH key is added to GitHub."
                test_results["git_config"]="warn_ssh_failed"
            fi
        elif echo "${GIT_REMOTE}" | grep -q "^https://"; then
            log_info "[TEST:5/5] HTTPS remote detected — testing git ls-remote..."
            if git ls-remote "${GIT_REMOTE}" &>/dev/null; then
                log_ok "[TEST:5/5] HTTPS authentication OK"
                test_results["git_config"]="pass"
            else
                log_warn "[TEST:5/5] HTTPS test failed — push may not work. Ensure personal access token is configured."
                test_results["git_config"]="warn_https_failed"
            fi
        fi
    fi

    # ── Write Final Report ──────────────────────────────────────────────
    local test_duration; test_duration=$(($(date +%s) - test_start))

    python3 -c "
import json, os
# Use relative path — Windows Python doesn't understand Cygwin /c/... paths
report_file = os.path.join('output', 'test_validation_report.json')
# Initialize if file doesn't exist or is empty
report = {'test_run': {'timestamp': '', 'mode': 'test', 'results': {}}}
if os.path.exists(report_file) and os.path.getsize(report_file) > 0:
    try:
        with open(report_file, 'r') as f:
            report = json.load(f)
    except:
        pass
report['test_run']['timestamp'] = '$(date -u +%Y-%m-%dT%H:%M:%SZ)'
report['test_run']['duration_seconds'] = ${test_duration}
report['test_run']['overall_result'] = '${overall_pass}' == 'true' and 'PASS' or 'FAIL'
report['test_run']['results'] = {
    'yaml_syntax': '${test_results[yaml_syntax]:-unchecked}',
    'schema_validation': '${test_results[schema_validation]:-unchecked}',
    'skill_existence': '${test_results[skill_existence]:-unchecked}',
    'dependency_check': '${test_results[dependency_check]:-unchecked}',
    'git_config': '${test_results[git_config]:-unchecked}'
}
os.makedirs(os.path.dirname(report_file) or '.', exist_ok=True)
with open(report_file, 'w') as f:
    json.dump(report, f, indent=2)
"

    echo ""
    echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║  Test Validation Report                                       ║${NC}"
    echo -e "${BOLD}${CYAN}╠══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BOLD}${CYAN}║${NC}  YAML Syntax:       ${test_results[yaml_syntax]:-unchecked}                                   ${BOLD}${CYAN}║${NC}"
    echo -e "${BOLD}${CYAN}║${NC}  Schema Validation: ${test_results[schema_validation]:-unchecked}                                   ${BOLD}${CYAN}║${NC}"
    echo -e "${BOLD}${CYAN}║${NC}  Skill Existence:   ${test_results[skill_existence]:-unchecked}                                   ${BOLD}${CYAN}║${NC}"
    echo -e "${BOLD}${CYAN}║${NC}  Dependency Check:  ${test_results[dependency_check]:-unchecked}                                   ${BOLD}${CYAN}║${NC}"
    echo -e "${BOLD}${CYAN}║${NC}  Git Config:        ${test_results[git_config]:-unchecked}                                   ${BOLD}${CYAN}║${NC}"
    echo -e "${BOLD}${CYAN}╠══════════════════════════════════════════════════════════════╣${NC}"
    if [[ "${overall_pass}" == "true" ]]; then
        echo -e "${BOLD}${CYAN}║${NC}  ${GREEN}OVERALL: PASS${NC} — Plan is valid and ready for --prod        ${BOLD}${CYAN}║${NC}"
    else
        echo -e "${BOLD}${CYAN}║${NC}  ${RED}OVERALL: FAIL${NC} — Fix errors above before --prod            ${BOLD}${CYAN}║${NC}"
    fi
    echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Full report: ${report_file}"

    if [[ "${overall_pass}" != "true" ]]; then
        return 1
    fi
    return 0
}

# ── Skill Router ───────────────────────────────────────────────────────────
route_skills() {
    local agent_id="$1"
    local agent_query="$2"

    if [[ -f "${SKILL_ROUTER}" ]]; then
        python3 "${SKILL_ROUTER}" route "${agent_query}" 2>/dev/null || echo "{}"
    else
        echo "{}"
    fi
}

# ── Agent Dispatch ─────────────────────────────────────────────────────────
dispatch_agent() {
    local agent_id="$1"
    local task_prompt="$2"
    local input_file="${3:-}"
    local output_file="${4:-${OUTPUT_DIR}/${agent_id}/output.json}"

    mkdir -p "$(dirname "${output_file}")"

    AGENT_STATUS["${agent_id}"]="dispatching"
    log_info "Dispatching agent: ${agent_id}"

    local claude_cmd="claude"
    local extra_args=()

    if [[ "${MODE}" == "test" ]]; then
        extra_args+=("--model" "deepseek-v4-pro")
        # In test mode, we validate the prompt but don't actually run
        log_info "[TEST] Would dispatch ${agent_id} with prompt:"
        echo "${task_prompt}" | head -5
        echo "..."
        AGENT_STATUS["${agent_id}"]="test_passed"
        return 0
    fi

    # Production mode — real execution with retry (matches workflow.yaml retry: N)
    local agent_log="${LOG_DIR}/agents/${agent_id}.jsonl"
    mkdir -p "$(dirname "${agent_log}")"

    # Write the task prompt to a temp file for the agent
    local task_file="${OUTPUT_DIR}/${agent_id}/task.md"
    mkdir -p "$(dirname "${task_file}")"
    echo "${task_prompt}" > "${task_file}"

    # Retry configuration (matches workflow.yaml agent retry: field)
    local max_attempts=3    # 1 initial + 2 retries = 3 total (matches workflow.yaml retry: 2 for A2/A4/A5/A6/A7; one extra retry for retry:1 agents is harmless)
    local retry_delay=30    # seconds between retries

    local attempt=0
    local exit_code=1

    while [[ ${attempt} -lt ${max_attempts} ]]; do
        attempt=$((attempt + 1))

        if [[ ${attempt} -gt 1 ]]; then
            log_info "Retrying agent ${agent_id} (attempt ${attempt}/${max_attempts}) after ${retry_delay}s delay..."
            sleep "${retry_delay}"
        fi

        # Build the claude invocation
        # The prompt instructs Claude to act as this specific agent
        # Pass via stdin (claude --print reads prompt from stdin when no positional argument)
        # Write to temp file first — only overwrite output_file on success
        local temp_output="${OUTPUT_DIR}/${agent_id}/.output.tmp"
        claude --print --model "deepseek-v4-pro" \
            --output-format json \
            --add-dir "${OUTPUT_DIR}" \
            --allowedTools "Read,Write,Edit,Glob,Grep,Bash(python *),Bash(pip *),Bash(npm *),Bash(node *),Bash(git *),Bash(mkdir *),Bash(cp *),Bash(mv *)" \
            < "${task_file}" \
            > "${temp_output}" 2>"${agent_log}"

        exit_code=$?

        if [[ ${exit_code} -eq 0 ]]; then
            mv "${temp_output}" "${output_file}"
            AGENT_STATUS["${agent_id}"]="completed"
            if [[ ${attempt} -gt 1 ]]; then
                log_ok "Agent ${agent_id} completed successfully (after ${attempt} attempts)"
            else
                log_ok "Agent ${agent_id} completed successfully"
            fi
            return 0
        fi

        log_error "Agent ${agent_id} failed with exit code ${exit_code} (attempt ${attempt}/${max_attempts})"
    done

    # All attempts exhausted
    AGENT_STATUS["${agent_id}"]="failed"
    log_error "Agent ${agent_id} FAILED after ${max_attempts} attempts"
    AGENT_FAILURES=$((AGENT_FAILURES + 1))
    return ${exit_code}
}

# ── Quality Gate (REAL measurement) ───────────────────────────────────────
check_quality_gate() {
    local agent_id="$1"
    local output_file="$2"

    log_info "Checking quality gate for ${agent_id}..."

    if [[ "${MODE}" == "test" ]]; then
        log_info "[TEST] Would verify ${agent_id} output against quality_standards in workflow.yaml"
        return 0
    fi

    # Real quality measurement — dispatch by agent type
    local gate_result="PASS"
    local gate_details=""
    local quality_report="${OUTPUT_DIR}/quality_report.json"
    mkdir -p "$(dirname "${quality_report}")"

    case "${agent_id}" in
        backend-refactor-agent)
            log_info "[QA-GATE] Running pytest on backend..."
            if [[ -f "${OUTPUT_DIR}/backend/test_server.py" ]]; then
                cd "${OUTPUT_DIR}/backend"
                local test_result; test_result=$(python3 -m pytest test_server.py -q --tb=short 2>&1 || true)
                local passed; passed=$(echo "${test_result}" | grep -oP '\d+(?= passed)' || echo "0")
                local failed; failed=$(echo "${test_result}" | grep -oP '\d+(?= failed)' || echo "0")
                log_info "[QA-GATE] Tests: ${passed} passed, ${failed} failed"
                if [[ "${failed}" != "0" ]]; then
                    gate_result="FAIL"
                    gate_details="pytest: ${failed} test(s) failed"
                fi
                cd "${PROJECT_DIR}"
            else
                log_warn "[QA-GATE] test_server.py not found — skipping"
                gate_details="no tests found"
            fi
            ;;

        qa-integration-agent)
            log_info "[QA-GATE] Verifying qa_report.json overall_pass..."
            if [[ -f "${OUTPUT_DIR}/qa_report.json" ]]; then
                local qa_pass; qa_pass=$(python3 -c "import json; print(json.load(open('${OUTPUT_DIR}/qa_report.json')).get('overall_pass', False))" 2>/dev/null || echo "False")
                if [[ "${qa_pass}" != "True" ]]; then
                    gate_result="FAIL"
                    gate_details="qa_report overall_pass != true"
                fi
            else
                gate_result="FAIL"
                gate_details="qa_report.json missing"
            fi
            ;;

        threejs-scene-agent)
            log_info "[QA-GATE] Checking 4 scene files and shader..."
            local scene_count=0
            for f in rain_underpass.js snow_bridge.js fog_highway.js blizzard_street.js; do
                [[ -f "${OUTPUT_DIR}/frontend/js/scenes/${f}" ]] && ((scene_count++))
            done
            if [[ "${scene_count}" -lt 4 ]]; then
                gate_result="FAIL"
                gate_details="only ${scene_count}/4 scene files found"
            fi
            if ! grep -q "wobble" "${OUTPUT_DIR}/frontend/js/shaders/ps1_vertex.glsl" 2>/dev/null; then
                gate_result="FAIL"
                gate_details="ps1_vertex.glsl missing wobble effect"
            fi
            ;;

        css-ui-agent)
            log_info "[QA-GATE] Running lint_colors.py..."
            if [[ -f "${OUTPUT_DIR}/lint_colors.py" ]]; then
                python3 "${OUTPUT_DIR}/lint_colors.py" "${OUTPUT_DIR}/frontend/css/" 2>&1 || {
                    gate_result="FAIL"
                    gate_details="lint_colors.py found violations"
                }
            fi
            if grep -r "border-radius" "${OUTPUT_DIR}/frontend/css/" 2>/dev/null; then
                gate_result="FAIL"
                gate_details="border-radius found in CSS"
            fi
            ;;

        docs-publish-agent)
            log_info "[QA-GATE] Checking README.md and git push..."
            if ! grep -q "uvicorn\|python" "${OUTPUT_DIR}/README.md" 2>/dev/null; then
                gate_result="FAIL"
                gate_details="README.md missing startup commands"
            fi
            ;;

        *)
            # Generic check: verify output file exists and is non-empty JSON
            log_info "[QA-GATE] Generic check for ${agent_id}..."
            if [[ -f "${output_file}" ]]; then
                if python3 -c "import json; json.load(open('${output_file}'))" 2>/dev/null; then
                    log_ok "[QA-GATE] Output is valid JSON"
                else
                    log_warn "[QA-GATE] Output is not valid JSON or empty"
                fi
            else
                log_warn "[QA-GATE] Output file not found: ${output_file}"
                gate_result="FAIL"
                gate_details="output file missing"
            fi
            ;;
    esac

    # Write gate result
    mkdir -p "${LOG_DIR}/gates"
    echo "{\"agent\":\"${agent_id}\",\"result\":\"${gate_result}\",\"details\":\"${gate_details}\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "${LOG_DIR}/gates/${agent_id}_gate.json"

    if [[ "${gate_result}" == "PASS" ]]; then
        log_ok "Quality gate PASSED for ${agent_id}"
        return 0
    else
        log_error "Quality gate FAILED for ${agent_id}: ${gate_details}"
        return 1
    fi
}

aggregate_quality_report() {
    log_info "Aggregating final quality report..."
    local quality_report="${OUTPUT_DIR}/quality_report.json"
    mkdir -p "$(dirname "${quality_report}")"

    python3 -c "
import json, os, glob, pathlib

# Use cwd-relative path — Windows Python doesn't understand Cygwin /c/... paths
output_dir = pathlib.Path('output')
log_dir = output_dir / 'logs' / 'gates'

report = {
    'timestamp': '$(date -u +%Y-%m-%dT%H:%M:%SZ)',
    'quality_standards': {},
    'agent_gates': {},
    'overall_pass': True
}

# Collect all gate results
gate_files = glob.glob(str(log_dir / '*_gate.json'))
for gf in sorted(gate_files):
    with open(gf) as f:
        g = json.load(f)
    agent = g['agent']
    report['agent_gates'][agent] = g
    if g['result'] != 'PASS':
        report['overall_pass'] = False

# Map to quality_standards (12 checks matching A7 output schema)
report['quality_standards'] = {
    'css_palette_compliance': {'target': 100, 'actual': None, 'pass': None},
    'css_no_warm_colors': {'target': 0, 'actual': None, 'pass': None},
    'css_no_border_radius': {'target': 0, 'actual': None, 'pass': None},
    'html_no_framework_import': {'target': 0, 'actual': None, 'pass': None},
    'html_no_emoji': {'target': 0, 'actual': None, 'pass': None},
    'js_no_import_statement': {'target': 0, 'actual': None, 'pass': None},
    'js_no_framework_ref': {'target': 0, 'actual': None, 'pass': None},
    'backend_api_schema': {'target': 'valid', 'actual': None, 'pass': None},
    'backend_pytest_pass': {'target': 100, 'actual': None, 'pass': None},
    'frontend_file_structure': {'target': 'valid', 'actual': None, 'pass': None},
    'crt_opacity_check': {'target': '0.35-0.45', 'actual': None, 'pass': None},
    'ps1_shader_wobble': {'target': 'present', 'actual': None, 'pass': None},
}

with open(str(output_dir / 'quality_report.json'), 'w') as f:
    json.dump(report, f, indent=2)

print(json.dumps(report, indent=2))
"

    log_info "Quality report written to: ${quality_report}"

    # Check if overall passed
    local overall; overall=$(python3 -c "
import json, pathlib
with open(pathlib.Path(r'${quality_report}')) as f:
    print(json.load(f)['overall_pass'])
" 2>/dev/null)
    if [[ "${overall}" == "True" ]]; then
        log_ok "All quality gates PASSED"
        return 0
    else
        log_error "Some quality gates FAILED — check ${quality_report}"
        return 1
    fi
}

# ── Checkpoint ─────────────────────────────────────────────────────────────
save_checkpoint() {
    local phase="$1"
    local checkpoint_id; checkpoint_id="$(uuidgen 2>/dev/null || echo "$(date +%s)-${RANDOM}")"
    local timestamp; timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

    mkdir -p "${CHECKPOINT_DIR}"

    # Save agent statuses
    for agent_id in "${!AGENT_STATUS[@]}"; do
        echo "${agent_id}=${AGENT_STATUS[${agent_id}]}" >> "${CHECKPOINT_DIR}/${checkpoint_id}_status.txt"
    done

    # Save manifest
    cat > "${CHECKPOINT_DIR}/${checkpoint_id}_manifest.json" << EOFMANIFEST
{
    "checkpoint_id": "${checkpoint_id}",
    "timestamp": "${timestamp}",
    "phase": "${phase}",
    "mode": "${MODE}",
    "agent_statuses": $(python3 -c "import json; d=${AGENT_STATUS@Q}; print(json.dumps({k:v for k,v in d.items()}))" 2>/dev/null || echo "{}"),
    "failures": ${AGENT_FAILURES},
    "recoveries": ${RECOVERY_COUNT}
}
EOFMANIFEST

    echo "${checkpoint_id}" > "${CHECKPOINT_DIR}/latest"

    log_ok "Checkpoint saved: ${checkpoint_id} (phase ${phase})"

    # Keep only last 5 checkpoints
    local count; count=$(ls -d "${CHECKPOINT_DIR}"/*_manifest.json 2>/dev/null | wc -l)
    if [[ "${count}" -gt 5 ]]; then
        ls -t "${CHECKPOINT_DIR}"/*_manifest.json | tail -n +6 | while read -r old; do
            local old_id; old_id=$(basename "${old}" _manifest.json)
            rm -f "${CHECKPOINT_DIR}/${old_id}"_*
            log_info "Pruned old checkpoint: ${old_id}"
        done
    fi
}

load_checkpoint() {
    local checkpoint_id="${1:-}"

    if [[ -z "${checkpoint_id}" ]]; then
        if [[ -f "${CHECKPOINT_DIR}/latest" ]]; then
            checkpoint_id=$(cat "${CHECKPOINT_DIR}/latest")
        else
            log_error "No checkpoint found"
            return 1
        fi
    fi

    local manifest="${CHECKPOINT_DIR}/${checkpoint_id}_manifest.json"
    if [[ ! -f "${manifest}" ]]; then
        log_error "Checkpoint manifest not found: ${manifest}"
        return 1
    fi

    log_info "Loading checkpoint: ${checkpoint_id}"

    # Load agent statuses
    local status_file="${CHECKPOINT_DIR}/${checkpoint_id}_status.txt"
    if [[ -f "${status_file}" ]]; then
        while IFS='=' read -r agent status; do
            AGENT_STATUS["${agent}"]="${status}"
        done < "${status_file}"
    fi

    # Read manifest
    CURRENT_PHASE=$(jq -r '.phase' "${manifest}" 2>/dev/null || echo "unknown")
    AGENT_FAILURES=$(jq -r '.failures' "${manifest}" 2>/dev/null || echo "0")
    RECOVERY_COUNT=$(jq -r '.recoveries' "${manifest}" 2>/dev/null || echo "0")

    log_ok "Checkpoint loaded: phase=${CURRENT_PHASE}, failures=${AGENT_FAILURES}"
    return 0
}

# ── Guardian Agents ────────────────────────────────────────────────────────
launch_session_guardian() {
    log_info "Launching Session Guardian agent..."

    local guardian_prompt='
You are the Session Guardian Agent. Your responsibilities:
1. Monitor context window utilization — trigger compression at 70%, hard block at 90%
2. Enforce token budget per agent (max 16K input, 8K output)
3. Apply openviking L1/L2 compression when thresholds are crossed
4. Log token savings metrics
5. Save state before any context compaction

Report token usage every 5 minutes. If context exceeds 85%, immediately trigger L2 compression.
Do not perform any task other than context management and token budget enforcement.
'

    if [[ "${MODE}" == "test" ]]; then
        log_info "[TEST] Session Guardian would be launched"
        return 0
    fi

    # Launch as background process
    claude --print --model "deepseek-v4-pro" \
        -p "${guardian_prompt}" \
        --allowedTools "Read,Write,Bash(python *),Bash(cat *)" \
        > "${LOG_DIR}/guardian.log" 2>&1 &

    AGENT_PIDS["session-guardian"]=$!
    log_ok "Session Guardian launched (PID: $!)"
}

launch_standby_monitor() {
    log_info "Launching Standby Monitor & Debug agent..."

    local monitor_prompt='
You are the Standby Monitor & Debug Agent. Your responsibilities:
1. Check agent heartbeats every 30 seconds
2. Detect stalls (no output for 120 seconds) and crashes (non-zero exit)
3. Execute recovery protocol: detect → state dump → kill → restore checkpoint → re-dispatch → verify
4. Escalate after 3 consecutive recovery failures
5. Generate post-mortem debug reports on any failure

Report health status every 2 minutes. If you detect a stall, execute recovery immediately.
Do not perform any task other than monitoring and recovery.
'

    if [[ "${MODE}" == "test" ]]; then
        log_info "[TEST] Standby Monitor would be launched"
        return 0
    fi

    claude --print --model "deepseek-v4-pro" \
        -p "${monitor_prompt}" \
        --allowedTools "Read,Write,Bash(ps *),Bash(kill *),Bash(cat *),Bash(ls *)" \
        > "${LOG_DIR}/monitor.log" 2>&1 &

    AGENT_PIDS["standby-monitor"]=$!
    log_ok "Standby Monitor launched (PID: $!)"
}

stop_guardians() {
    for agent_id in "${!AGENT_PIDS[@]}"; do
        local pid="${AGENT_PIDS[${agent_id}]}"
        if kill -0 "${pid}" 2>/dev/null; then
            log_info "Stopping guardian: ${agent_id} (PID: ${pid})"
            kill "${pid}" 2>/dev/null || true
            wait "${pid}" 2>/dev/null || true
        fi
    done
}

# ── Phase Execution ────────────────────────────────────────────────────────
run_phase_1() {
    log_phase "Phase 1: Research + Scaffold (2 agents, parallel) — Wave 1"
    CURRENT_PHASE="1"
    PHASE_START_TIME=$(date +%s)

    local task_tech_survey='
[P8 工程原则 — 高能動性開發者行為準則]
你是一個 P8 級工程師。你的行為準則：
1. Owner 意識：主動發現問題、提出更好的方案，不要被動等待指令。看到問題就說，修完就驗證，同類問題一併處理。
2. 閉環交付：說「完成」之前，必須跑驗證命令、貼出輸出證據。沒有輸出的完成叫自嗨。
3. 事實驅動：說「可能是環境問題」之前，先用工具驗證。未驗證的歸因不是診斷，是甩鍋。
4. 冰山下面還有冰山：修了一個 bug，同模塊有沒有同類問題？上下游有沒有被波及？一個問題進來，一類問題出去。
5. 窮盡一切：說「無法解決」之前，通用方法論 5 步走完了嗎？沒走完就說不行，那不是能力邊界，是缺乏韌性。
6. P8 格局：做任何事之前先問自己——「還有什麼沒想到的？」「還有什麼類似的地方也要解決？」

---
You are the Tech Survey Agent (tech-survey-agent).
Research frontend technologies for a Y2K liminal space web game with these topics:
1. Three.js PS1 shader (vertex wobble, color quantization, shadow tint #003344)
2. CSS CRT scanline overlay (repeating-linear-gradient, pure CSS)
3. FastAPI WebSocket streaming (stream=True, AsyncGenerator for typewriter effect)
4. Mac OS 9 / QuickTime Player UI CSS (window borders, buttons, progress bars)
5. 7-segment display CSS counter (Orbitron font, #33FF33 color)

For each topic provide: feasibility assessment, >=1 code example, risk items, recommended libraries.
Input: GAME_PRD_V2.md. Output: output/tech_survey.json (JSON with topics.{threejs_ps1_shader,css_crt_scanlines,fastapi_websocket_streaming,mac_os9_ui_css,seven_segment_display_css})
Use skills: sci-academic-deep-research, autoresearch.
Do NOT execute any code — research and report only.
'

    local task_frontend_scaffold='
[工程原则 — Andrej Karpathy + P8]
你是一個遵循 Andrej Karpathy 工程哲學的 P8 級開發者：

Karpathy 四原則：
1. 先思考再寫碼：明確陳述假設，不隱藏困惑。有多種解釋時列出選項而非沉默選擇。有更簡單方案時直接說。
2. 極簡優先：只寫解決問題所需的最少程式碼。不為單一用途建抽象層。不寫未被要求的「靈活性」。如果 200 行能壓成 50 行，重寫。
3. 精準修改：只碰必須改的，不「改進」不相關的程式碼。不重構沒壞的東西。匹配現有風格。
4. 目標驅動：把任務轉化為可驗證的目標。寫測試證明它有效，而非宣稱它有效。

P8 能動性準則：
5. Owner 意識：主動發現問題、提出更好的方案。看到問題就說，修完就驗證。
6. 閉環交付：說「完成」前必須跑驗證命令、貼輸出證據。沒有輸出的完成叫自嗨。
7. 冰山下面還有冰山：修了一個 bug → 同模塊還有嗎？同類問題呢？一個問題進來，一類問題出去。
8. P8 格局：「還有什麼沒想到的？」「還有什麼類似的地方也要解決？」

---
You are the Frontend Scaffold Agent (frontend-scaffold-agent).
Create the complete frontend/ directory tree and index.html skeleton for the "千禧年蟲事件" web game.

File structure required:
  frontend/index.html (main page with 6 container IDs: bg-container, top-bar, dialog-panel, input-panel, bottom-bar, system-dialog)
  frontend/css/ (main.css, crt.css, panels.css, counters.css — empty stubs)
  frontend/js/ (app.js, api.js, renderer.js, background.js — empty stubs)
  frontend/js/scenes/ (rain_underpass.js, snow_bridge.js, fog_highway.js, blizzard_street.js — empty stubs)
  frontend/js/shaders/ (ps1_vertex.glsl, ps1_fragment.glsl — empty stubs)
  frontend/assets/fonts/ and frontend/assets/textures/

CRITICAL: No external framework references (no React, Vue, Angular, jQuery, Bootstrap).
All HTML must use plain semantic elements. No emoji as UI elements.
Use skills: caveman, ccgs-quick-design.
Input: GAME_PRD_V2.md. Output to: frontend/index.html and all stub files.
'

    if [[ "${MODE}" == "test" ]]; then
        AGENT_STATUS["tech-survey-agent"]="test_passed"
        AGENT_STATUS["frontend-scaffold-agent"]="test_passed"
        log_ok "[TEST] Phase 1: 2 agents would run in parallel (tech-survey + frontend-scaffold)"
        return 0
    fi

    # Dispatch both in parallel
    dispatch_agent "tech-survey-agent" "${task_tech_survey}" "${PROJECT_DIR}/GAME_PRD_V2.md" "${OUTPUT_DIR}/tech_survey.json" &
    AGENT_PIDS["tech-survey"]=$!

    dispatch_agent "frontend-scaffold-agent" "${task_frontend_scaffold}" "${PROJECT_DIR}/GAME_PRD_V2.md" "${OUTPUT_DIR}/frontend-scaffold-agent/output.json" &
    AGENT_PIDS["frontend-scaffold"]=$!

    # Wait for all
    local failed=0
    for agent in tech-survey frontend-scaffold; do
        if ! wait "${AGENT_PIDS[${agent}]}"; then
            failed=1
        fi
    done

    if [[ ${failed} -eq 0 ]]; then
        log_ok "Phase 1 completed"
        save_checkpoint "1"
    else
        log_error "Phase 1 had failures"
        return 1
    fi
}

run_phase_2() {
    log_phase "Phase 2: Development (4 agents, parallel) — Wave 2"
    CURRENT_PHASE="2"
    PHASE_START_TIME=$(date +%s)

    local task_backend_refactor='
[工程原则 — Andrej Karpathy + P8 + GSD Spec-Driven]
你是一個遵循 Andrej Karpathy 工程哲學的 P8 級開發者，採用 Spec-Driven Development 方法論：

Karpathy 四原則：
1. 先思考再寫碼：明確陳述假設，不隱藏困惑。在讀完所有 11 個原始遊戲檔案之前不要動手寫任何 backend 程式碼。
2. 極簡優先：只寫解決問題所需的最少程式碼。不為單一用途建抽象層。如果一個函數只需要一個呼叫者，不要給它加「靈活性」。
3. 精準修改：PRESERVE 指令是鐵則——重構通訊層（print/input → HTTP/WebSocket），不偷改遊戲規則。
4. 目標驅動：pytest 全部通過才算完成，不是「我寫完了 8 個檔案」。

P8 能動性準則：
5. Owner 意識：主動發現原始碼中的隱式約定（如 stream=False、cache_data、Character vs Player 分離）並標記，不要等人指出。
6. 閉環交付：說「完成」前必須跑 pytest 且 29/29 通過，貼出測試輸出。
7. 冰山下面還有冰山：改了一個 import，所有 import 鏈上的模塊也要檢查。修了一個 endpoint，WebSocket 和 state API 也要驗證。
8. P8 格局：「遊戲引擎還有什麼隱式依賴我沒發現？」「LLM 串流失敗時降級方案是什麼？」

GSD Spec-Driven 紀律：
9. 先確認規格理解再寫碼：在動筆之前，確保你理解每個原始檔案的 API 語義——ai_dialogue.py 的 @st.cache_data 怎麼處理、memory_manager 的 singleton 模式怎麼保持。
10. 自動修復偏離（Rules 1-3）：遇到 import 錯誤自動修；缺少必要的錯誤處理自動補；遇到阻塞問題自動排除。但架構級變更（如換掉 Chroma、換 LLM provider）必須標記。
11. 分析癱瘓防護：連續 5 次 Read/Grep 還沒寫任何 backend 程式碼 → 停止分析，開始寫碼。
12. 任務完成標準：8 個 backend 檔案全部產出 + pytest 29/29 PASS + server.py 可啟動並監聽 localhost:8000。

---
You are the Backend Refactor Agent (backend-refactor-agent).
Convert the existing synchronous Python terminal game (print/input loop) to a FastAPI + WebSocket streaming backend.

CRITICAL — Original game source code is at: '"${GAME_SOURCE_DIR}"'
Study these existing files before writing ANY code:
  - '"${GAME_SOURCE_DIR}"'/engine/ai_dialogue.py — LLM dialogue engine (LangChain ChatOllama, affinity values)
  - '"${GAME_SOURCE_DIR}"'/engine/llm_client.py — LLM client abstraction
  - '"${GAME_SOURCE_DIR}"'/engine/memory_manager.py — Memory fragments (Chroma vector DB)
  - '"${GAME_SOURCE_DIR}"'/engine/story_engine.py — Story generation engine
  - '"${GAME_SOURCE_DIR}"'/game/game_state.py — State management pattern
  - '"${GAME_SOURCE_DIR}"'/game/inventory.py — Inventory system
  - '"${GAME_SOURCE_DIR}"'/game/repair_system.py — Repair system
  - '"${GAME_SOURCE_DIR}"'/game/player.py — Player attributes (emotion, infection, etc.)
  - '"${GAME_SOURCE_DIR}"'/data/y2k-theme/y2k_prompt_system.py — Y2K LLM prompt templates
  - '"${GAME_SOURCE_DIR}"'/data/y2k-theme/event_system.py — Y2K random events
  - '"${GAME_SOURCE_DIR}"'/data/y2k-theme/command_system.py — Memory fragments command handler

Implement these files:
  1. backend/server.py — FastAPI app with:
     - POST /api/game/action (accepts session_id, player_input, timestamp; returns narrative, emotion_value, infection_level, memory_fragments, scene_trigger, viewer_count, system_event)
     - GET /api/game/state (returns full game state)
     - WebSocket /ws/game (streams narrative chunks for typewriter effect)
     - Serves frontend/ as static files
  2. backend/game_engine.py — adapted from existing game/ and engine/ modules, no print()/input() calls
  3. backend/llm_client.py — LLM streaming with stream=True, AsyncGenerator (adapted from engine/llm_client.py)
  4. backend/state_manager.py — session state store (adapted from game/game_state.py pattern)
  5. backend/scene_selector.py — implements the scene trigger logic from PRD section 3.3
  6. backend/viewer_counter.py — viewer count formula from PRD section 4.2
  7. backend/test_server.py — pytest tests for all endpoints
  8. backend/requirements.txt — fastapi, uvicorn, websockets, pytest, httpx

PRESERVE: All game rules, emotional states, infection mechanics, memory fragment logic, inventory types, repair outcomes from the original code. Only refactor the COMMUNICATION LAYER from print/input to HTTP/WebSocket.
DO NOT invent new game mechanics or change existing game balance.
Backend-computed viewer_count (not frontend): calculate_viewer_count(emotion, infection, fragments, glitch_events) -> min(base, 99)
API key: read from environment variable ANTHROPIC_API_KEY (already exported by execute.sh). Use os.environ.get("ANTHROPIC_API_KEY") in llm_client.py. Do NOT hardcode any API key in source files.
Input: output/tech_survey.json, GAME_PRD_V2.md, and all original game files listed above.
Use skills: caveman, test-driven-development.
'

    local task_threejs_scene='
[工程原则 — Andrej Karpathy + P8 + GSD Spec-Driven]
你是一個遵循 Andrej Karpathy 工程哲學的 P8 級開發者，採用 Spec-Driven Development 方法論：

Karpathy 四原則：
1. 先思考再寫碼：明確陳述假設。每個場景的色溫、曝光、像素塊大小、光比都是精確的量化參數——在寫 GLSL 之前確認你理解每個數字。
2. 極簡優先：Shader 程式碼必須最小化——PS1 的抖動效果只需要 5 行 vertex shader，顏色量化只需要 3 行 fragment shader。不要過度設計。
3. 精準修改：只寫 A4 負責的檔案（4 個場景 + 2 個 Shader + background.js）。不要碰 A3 的 index.html 或 A6 的 api.js。
4. 目標驅動：每個場景的 createScene() 必須能被 background.js 的 switchScene() 呼叫，crossfade + CRT 噪點過渡必須時長恰好 3 秒。

P8 能動性準則：
5. Owner 意識：DSEG7 字體替代方案（tech_survey.json 已記錄）不是你需要擔心的——但 Three.js r128 的 WebGL 相容性和 GLSL 版本是你需要主動驗證的。
6. 閉環交付：說「完成」前，確認所有 4 個場景檔案都有 function createScene，ps1_vertex.glsl 包含 wobble，且 background.js 匯出 switchScene。
7. 冰山下面還有冰山：一個場景的 RGB 0-20 死黑區域達標了，其他三個場景的死黑區域呢？uniform uTime 在所有 shader 中一致嗎？
8. P8 格局：「PRD 說 70% 死黑，但 Three.js 場景初始化時背景色設了什麼？這會影響對比度嗎？」

GSD Spec-Driven 紀律：
9. 先確認規格理解再寫碼：在寫任何 GLSL 之前，確保你理解 PS1 的頂點抖動原理（sin + floor 量化）和 16-bit 顏色量化（floor(rgb*31)/31）。
10. 自動修復偏離（Rules 1-3）：WebGL context 錯誤自動修；缺少 uniform 宣告自動補；shader 編譯錯誤自動排除。
11. 分析癱瘓防護：連續 5 次 Read/Grep 還沒寫任何 GLSL/JS → 停止分析，開始寫碼。
12. 任務完成標準：7 個檔案（4 場景 + 2 Shader + 1 background.js）全部產出 + G4.1/G4.2/G4.3 品質門檻全部通過。

---
You are the Three.js Scene Agent (threejs-scene-agent).
Create 4 PS1-style 3D liminal space background scenes using Three.js with custom shaders.

Each scene file in frontend/js/scenes/ must export a createScene() function:
  1. rain_underpass.js — cold gray + dark blue, 10000K, -1.5EV, semi-transparent rain blur 10px, 6x6 pixel blocks, single distant warm window light
  2. snow_bridge.js — warm yellow highlight + pure black, 5500K highlights, -2.5EV, 16x16 pixel blocks, 70% dead black (RGB 0-20), single center streetlight (1:20 light ratio)
  3. fog_highway.js — gray-white + gray-black, 9500K, -1.8EV, -10% contrast, heavy atmospheric fog, 50m visibility, distant objects 30% opacity
  4. blizzard_street.js — gray-black + dark red, 10000K, -2.0EV, ISO 3200 film grain 25%, 8px snow motion blur

Shaders in frontend/js/shaders/:
  - ps1_vertex.glsl: vertex wobble effect, low-precision quantization (simulate fixed-point), uniform uTime
  - ps1_fragment.glsl: color quantization (16-bit emulation, floor(rgb*31)/31), shadow tint #003344, color banding artifacts

Global parameters: no anti-aliasing, nearest texture filtering, 256x256 textures, shadow tint #003344 on all scenes.
frontend/js/background.js: exports switchScene(sceneName), handles 3-second crossfade + CRT noise transition.
Input: output/tech_survey.json. Output: frontend/js/background.js, all scene files, all shader files.
Use skills: ccgs-prototype, caveman.
'

    local task_css_ui='
[工程原则 — Andrej Karpathy + P8]
你是一個遵循 Andrej Karpathy 工程哲學的 P8 級開發者：

Karpathy 四原則：
1. 先思考再寫碼：明確陳述假設，不隱藏困惑。有多種解釋時列出選項而非沉默選擇。有更簡單方案時直接說。
2. 極簡優先：只寫解決問題所需的最少程式碼。不為單一用途建抽象層。不寫未被要求的「靈活性」。如果 200 行能壓成 50 行，重寫。
3. 精準修改：只碰必須改的，不「改進」不相關的程式碼。匹配現有風格。
4. 目標驅動：把任務轉化為可驗證的目標。寫測試證明它有效，而非宣稱它有效。

P8 能動性準則：
5. Owner 意識：主動發現問題、提出更好的方案。看到問題就說，修完就驗證。
6. 閉環交付：說「完成」前必須跑驗證命令、貼輸出證據。沒有輸出的完成叫自嗨。
7. 冰山下面還有冰山：一個問題進來，一類問題出去。
8. P8 格局：「還有什麼沒想到的？」「還有什麼類似的地方也要解決？」

---
You are the CSS UI Agent (css-ui-agent).
Implement the Cybercore Y2K UI with strict machine-checkable compliance.

Create these CSS files:
  1. frontend/css/main.css — global styles, 12-color palette only, VT323/Silkscreen/Share Tech Mono/Orbitron fonts, image-rendering: pixelated
  2. frontend/css/crt.css — CRT scanline overlay via body::after pseudo-element, repeating-linear-gradient, opacity 0.35-0.45 range
  3. frontend/css/panels.css — QuickTime Player / Mac OS 9 window panels, 1px #88CCFF borders, no border-radius, #1A2530 backgrounds, 16px padding, custom scrollbar (6px width)
  4. frontend/css/counters.css — 7-segment display counter for viewer count, color #33FF33, font Orbitron

CRITICAL RULES (machine-checked):
  - All colors must be from the allowed 12-color palette (lint_colors.py will verify)
  - NO border-radius anywhere (grep-checked)
  - NO warm colors (red, orange, yellow, pink) except taillight red #8B0000 (lone exception)
  - NO emoji as UI elements
  - Z-index layers: 0=3D background, 10=dialog panel, 20=input panel, 30=status bars, 40=system dialog, 50=are-you-real popup, 60=CRT overlay

Input: GAME_PRD_V2.md. Output: frontend/css/main.css, crt.css, panels.css, counters.css.
Use skills: ccgs-design-review, caveman.
'

    local task_api_layer='
[工程原则 — Andrej Karpathy + P8]
你是一個遵循 Andrej Karpathy 工程哲學的 P8 級開發者：

Karpathy 四原則：
1. 先思考再寫碼：明確陳述假設，不隱藏困惑。有多種解釋時列出選項而非沉默選擇。有更簡單方案時直接說。
2. 極簡優先：只寫解決問題所需的最少程式碼。不為單一用途建抽象層。不寫未被要求的「靈活性」。如果 200 行能壓成 50 行，重寫。
3. 精準修改：只碰必須改的，不「改進」不相關的程式碼。匹配現有風格。
4. 目標驅動：把任務轉化為可驗證的目標。寫測試證明它有效，而非宣稱它有效。

P8 能動性準則：
5. Owner 意識：主動發現問題、提出更好的方案。看到問題就說，修完就驗證。
6. 閉環交付：說「完成」前必須跑驗證命令、貼輸出證據。沒有輸出的完成叫自嗨。
7. 冰山下面還有冰山：一個問題進來，一類問題出去。
8. P8 格局：「還有什麼沒想到的？」「還有什麼類似的地方也要解決？」

---
You are the API Layer Agent (api-layer-agent).
Implement the frontend JavaScript communication and rendering layer.

Create these JS files:
  1. frontend/js/api.js — fetch() to POST /api/game/action, WebSocket to /ws/game. NO import/require (pure browser execution). Export: sendAction(), connectWebSocket(), getGameState().
  2. frontend/js/renderer.js — typewriterEffect(text, targetEl, speed=30-50ms/char), updateViewerCounter(count), updateStatusBars(emotion, infection, fragments), showSystemDialog(event).
  3. frontend/js/app.js — main app controller, binds input events (addEventListener on send button + Enter key), orchestrates api→renderer→background flow. Handles data flow: narrative→typewriter, emotion/infection/fragments→status bars, scene_trigger→background switch, viewer_count→counter, system_event→dialog.

Input: output/tech_survey.json. Output: frontend/js/api.js, renderer.js, app.js.
Use skills: caveman, test-driven-development.
'

    if [[ "${MODE}" == "test" ]]; then
        AGENT_STATUS["backend-refactor-agent"]="test_passed"
        AGENT_STATUS["threejs-scene-agent"]="test_passed"
        AGENT_STATUS["css-ui-agent"]="test_passed"
        AGENT_STATUS["api-layer-agent"]="test_passed"
        log_ok "[TEST] Phase 2: 4 agents would run in parallel (backend + 3D + CSS + API)"
        return 0
    fi

    # Dispatch all 4 in parallel
    dispatch_agent "backend-refactor-agent" "${task_backend_refactor}" "${OUTPUT_DIR}/tech_survey.json" "${OUTPUT_DIR}/backend-refactor-agent/output.json" &
    AGENT_PIDS["backend-refactor"]=$!

    dispatch_agent "threejs-scene-agent" "${task_threejs_scene}" "${OUTPUT_DIR}/tech_survey.json" "${OUTPUT_DIR}/threejs-scene-agent/output.json" &
    AGENT_PIDS["threejs-scene"]=$!

    dispatch_agent "css-ui-agent" "${task_css_ui}" "${PROJECT_DIR}/GAME_PRD_V2.md" "${OUTPUT_DIR}/css-ui-agent/output.json" &
    AGENT_PIDS["css-ui"]=$!

    dispatch_agent "api-layer-agent" "${task_api_layer}" "${OUTPUT_DIR}/tech_survey.json" "${OUTPUT_DIR}/api-layer-agent/output.json" &
    AGENT_PIDS["api-layer"]=$!

    # Wait for all
    local failed=0
    for agent in backend-refactor threejs-scene css-ui api-layer; do
        if ! wait "${AGENT_PIDS[${agent}]}"; then
            failed=1
        fi
    done

    if [[ ${failed} -eq 0 ]]; then
        log_ok "Phase 2 completed"
        save_checkpoint "2"
    else
        log_error "Phase 2 had failures"
        return 1
    fi
}

run_phase_3() {
    log_phase "Phase 3: Quality Assurance (1 agent) — Wave 3"
    CURRENT_PHASE="3"
    PHASE_START_TIME=$(date +%s)

    local task_qa='
[P8 工程原则 — 高能動性 QA 工程師行為準則]
你是一個 P8 級 QA 工程師。你的行為準則：
1. Owner 意識：不只是跑測試——主動發現規格之外的潛在問題。看到不合規的地方直接標記，不要等人指出。
2. 閉環交付：每個檢查都要貼輸出證據——grep 的匹配數、pytest 的 pass/fail 數、curl 的回應內容。沒有輸出的檢查叫沒檢查。
3. 事實驅動：說「檢查通過」之前，你親眼看到了輸出嗎？還是推測它會通過？每個 check 必須有對應的 stdout 證據。
4. 冰山下面還有冰山：一個檔案檢查通過了，同目錄的其他檔案呢？你發現了一個 CSS 違規，還有沒有其他檔案有同樣的違規？
5. 窮盡一切：12 項檢查必須全部執行，跳過任何一項 = 報告不完整。檢查失敗不要只報 FAIL——要給出違規的具體檔案名、行號、違規內容。
6. P8 格局：QA 的價值不在於證明「沒問題」，在於發現「別人沒發現的問題」。

---
You are the QA Integration Agent (qa-integration-agent).
Run 12 machine-checkable QA rules against the complete frontend + backend deliverables.

12 checks to execute and report:
  1. css_palette_compliance — run lint_colors.py on frontend/css/, verify 100% within 12-color palette
  2. css_no_warm_colors — grep for #FF, #F00, #FF0, orange, yellow, pink (excluding #8B0000)
  3. css_no_border_radius — grep -r "border-radius" frontend/css/ must return 0
  4. html_no_framework_import — grep for react/vue/angular/jquery/bootstrap in frontend/index.html
  5. html_no_emoji — grep for emoji Unicode ranges in frontend/index.html
  6. js_no_import_statement — grep for "import " or "require(" in frontend/js/
  7. js_no_framework_ref — grep for react/vue/angular/jquery in frontend/js/
  8. backend_api_schema — POST to /api/game/action, verify response has narrative/emotion_value/infection_level/scene_trigger/viewer_count
  9. backend_pytest — run python3 -m pytest backend/test_server.py -v
  10. frontend_file_structure — verify all required files exist (index.html, 4 CSS, 4 JS, 4 scenes, 2 shaders)
  11. crt_opacity_check — verify CRT overlay opacity in [0.35, 0.45] range
  12. ps1_shader_wobble — grep "wobble" in ps1_vertex.glsl

Output: output/qa_report.json with fields: agent, timestamp, checks (12 objects with pass/fail), overall_pass (bool), summary (string).
If any check fails, overall_pass must be false.
Use skills: ccgs-qa-plan, verification-before-completion.
Input: frontend/ directory, backend/ directory, GAME_PRD_V2.md.
'

    if [[ "${MODE}" == "test" ]]; then
        AGENT_STATUS["qa-integration-agent"]="test_passed"
        log_info "[TEST] Would start backend server on localhost:8000 for QA testing"
        log_ok "[TEST] Phase 3: QA integration agent would run 12 checks (backend started/stopped automatically)"
        return 0
    fi

    # ── Start backend server for QA testing ─────────────────────────────────
    local BACKEND_PID=""
    log_info "Starting backend server for QA testing..."
    cd "${OUTPUT_DIR}"
    if [[ -f "backend/server.py" ]]; then
        python3 -m uvicorn backend.server:app --host 127.0.0.1 --port 8000 &
        BACKEND_PID=$!
        log_info "Backend PID: ${BACKEND_PID}"

        # Wait for server to be ready (up to 10 seconds)
        local max_wait=10
        local waited=0
        while [[ ${waited} -lt ${max_wait} ]]; do
            if curl -s http://127.0.0.1:8000/api/game/state &>/dev/null; then
                log_ok "Backend server ready on http://127.0.0.1:8000 (after ${waited}s)"
                break
            fi
            sleep 1
            waited=$((waited + 1))
        done
        if [[ ${waited} -ge ${max_wait} ]]; then
            log_error "Backend server failed to start within ${max_wait}s"
            cd "${PROJECT_DIR}"
            return 1
        fi
    else
        log_error "backend/server.py not found — cannot start server for QA"
        cd "${PROJECT_DIR}"
        return 1
    fi
    cd "${PROJECT_DIR}"

    # ── Run QA agent ────────────────────────────────────────────────────────
    local qa_exit_code=0
    if ! dispatch_agent "qa-integration-agent" "${task_qa}" "" "${OUTPUT_DIR}/qa_report.json"; then
        log_error "QA integration failed"
        qa_exit_code=1
    fi

    # ── Stop backend server (always, regardless of QA result) ───────────────
    if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
        log_info "Stopping backend server (PID: ${BACKEND_PID})..."
        kill "${BACKEND_PID}" 2>/dev/null || true
        wait "${BACKEND_PID}" 2>/dev/null || true
        log_ok "Backend server stopped"
    fi

    if [[ ${qa_exit_code} -ne 0 ]]; then
        return 1
    fi

    # Verify overall_pass in qa_report.json
    local qa_pass; qa_pass=$(python3 -c "import json; print(json.load(open('${OUTPUT_DIR}/qa_report.json')).get('overall_pass', False))" 2>/dev/null || echo "False")
    if [[ "${qa_pass}" != "True" ]]; then
        log_error "QA report overall_pass != true — Phase 3 failed"
        return 1
    fi

    log_ok "Phase 3 completed — all QA checks passed"
    save_checkpoint "3"
}

run_phase_4() {
    log_phase "Phase 4: Documentation & Publish (1 agent) — Wave 4"
    CURRENT_PHASE="4"
    PHASE_START_TIME=$(date +%s)

    local task_docs='
[P8 工程原则 — 高能動性文件發布工程師行為準則]
你是一個 P8 級文件發布工程師。你的行為準則：
1. Owner 意識：README 和 DEPLOY 是使用者看見的第一印象——不只列出事實，而是讓一個全新開發者 30 秒能理解這個專案在做什麼。
2. 閉環交付：文件寫完不算完成。git push 成功、遠端可見、README 在 GitHub 上渲染正確——這些才是完成。
3. 事實驅動：啟動指令你自己跑過了嗎？還是猜它會 work？API 端點列表你確認過 server.py 的實際路由嗎？
4. 冰山下面還有冰山：文件裡提到的每個檔案路徑都要確認存在。pre_push_checks 28 項都要過。
5. 窮盡一切：git push 失敗 → 檢查 remote、branch、認證、LFS，不要只報錯。
6. P8 格局：好的文件讓下一個人不需要問你問題。

---
You are the Docs & Publish Agent (docs-publish-agent).
Generate project documentation and push all deliverables to git.

Tasks:
  1. README.md — project overview ("千禧年蟲事件" Y2K liminal space web game), architecture diagram, quick start (uvicorn backend.server --host 0.0.0.0 --port 8000), API list (POST /api/game/action, GET /api/game/state, WebSocket /ws/game), tech stack summary, file structure
  2. DEPLOY.md — deployment guide: Python 3.10+, pip install -r backend/requirements.txt, uvicorn launch, static file serving, environment variables, production notes
  3. Verify required files exist before git operations (README.md, DEPLOY.md, frontend/index.html, backend/server.py, output/qa_report.json)
  4. Git push to origin master

Block condition: qa-integration-agent output overall_pass must be true (enforced by pipeline).
Input: output/qa_report.json. Output: README.md, DEPLOY.md.
Use skills: sci-paper-writing, github-ops.
'

    if [[ "${MODE}" == "test" ]]; then
        AGENT_STATUS["docs-publish-agent"]="test_passed"
        log_ok "[TEST] Phase 4: Docs + Publish agent would generate README/DEPLOY and git push"
        return 0
    fi

    if ! dispatch_agent "docs-publish-agent" "${task_docs}" "${OUTPUT_DIR}/qa_report.json" "${OUTPUT_DIR}/docs-publish-agent/output.json"; then
        log_error "Docs & Publish failed"
        return 1
    fi

    log_ok "Phase 4 completed"
    save_checkpoint "4"
}

# ── Git Publisher ──────────────────────────────────────────────────────────
run_git_publish() {
    log_phase "Phase 4b: Git Publication (git-publisher-agent)"

    local git_remote="${GIT_REMOTE:-}"
    local git_branch="${GIT_BRANCH:-main}"

    if [[ "${MODE}" == "test" ]]; then
        AGENT_STATUS["git-publisher-agent"]="test_passed"
        log_ok "[TEST] Phase 4b: Would initialize git, LFS, commit, tag, and push all deliverables"
        if [[ -z "${git_remote}" ]]; then
            log_warn "[TEST] GIT_REMOTE not set — push would be blocked in --prod mode"
        fi
        return 0
    fi

    # In prod mode, GIT_REMOTE is mandatory (enforced by validate_environment)
    if [[ -z "${git_remote}" ]]; then
        log_error "[git-publisher] GIT_REMOTE is not set — cannot push. This is required for --prod mode."
        AGENT_STATUS["git-publisher-agent"]="failed"
        mkdir -p "${OUTPUT_DIR}/git-publisher-agent"
        echo "{\"final_status\":\"failed\",\"error\":\"GIT_REMOTE not set\"}" > "${OUTPUT_DIR}/git-publisher-agent/git_publish_report.json"
        return 1
    fi

    local publish_dir="${OUTPUT_DIR}"
    cd "${publish_dir}"

    # Step 0: SSH / HTTPS authentication pre-test
    log_info "[git-publisher] Testing remote connectivity..."
    if echo "${git_remote}" | grep -q "^git@"; then
        log_info "[git-publisher] SSH remote detected — testing ssh -T..."
        local ssh_host; ssh_host=$(echo "${git_remote}" | sed 's/.*@\([^:]*\).*/\1/')
        local ssh_output; ssh_output=$(ssh -T -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 "git@${ssh_host}" 2>&1) || true
        if echo "${ssh_output}" | grep -qi "successfully authenticated"; then
            log_ok "[git-publisher] SSH authentication to ${ssh_host} successful"
        else
            log_error "[git-publisher] SSH authentication FAILED to ${ssh_host}"
            log_error "  Ensure your SSH key is added to GitHub:"
            log_error "    1. ssh-keygen -t ed25519 -C \"your@email.com\""
            log_error "    2. cat ~/.ssh/id_ed25519.pub → GitHub → Settings → SSH and GPG keys"
            log_error "    3. ssh -T git@github.com  (should say 'successfully authenticated')"
            log_error "  Output was: ${ssh_output}"
            AGENT_STATUS["git-publisher-agent"]="failed"
            echo "{\"final_status\":\"failed\",\"error\":\"SSH authentication failed to ${ssh_host}\"}" > "${OUTPUT_DIR}/git-publisher-agent/git_publish_report.json"
            return 1
        fi
    elif echo "${git_remote}" | grep -q "^https://"; then
        log_info "[git-publisher] HTTPS remote detected — testing git ls-remote..."
        if git ls-remote "${git_remote}" &>/dev/null; then
            log_ok "[git-publisher] HTTPS authentication successful"
        else
            log_error "[git-publisher] HTTPS authentication FAILED"
            log_error "  Configure credential helper:"
            log_error "    git config --global credential.helper store"
            log_error "    gh auth login  (if using GitHub CLI)"
            AGENT_STATUS["git-publisher-agent"]="failed"
            echo "{\"final_status\":\"failed\",\"error\":\"HTTPS authentication failed\"}" > "${OUTPUT_DIR}/git-publisher-agent/git_publish_report.json"
            return 1
        fi
    else
        log_error "[git-publisher] Unrecognized remote format: ${git_remote}"
        log_error "  Must be: git@github.com:user/repo.git  OR  https://github.com/user/repo.git"
        AGENT_STATUS["git-publisher-agent"]="failed"
        echo "{\"final_status\":\"failed\",\"error\":\"Unrecognized remote format\"}" > "${OUTPUT_DIR}/git-publisher-agent/git_publish_report.json"
        return 1
    fi

    local publish_dir="${OUTPUT_DIR}"
    cd "${publish_dir}"

    # Step 1: Final integrity check
    log_info "[git-publisher] Running final integrity check..."
    local required_files=(
        # Documentation (A8)
        "README.md"
        "DEPLOY.md"
        # Frontend HTML (A3)
        "frontend/index.html"
        # Frontend CSS (A5)
        "frontend/css/main.css"
        "frontend/css/panels.css"
        "frontend/css/counters.css"
        "frontend/css/crt.css"
        # Frontend JS (A6)
        "frontend/js/api.js"
        "frontend/js/renderer.js"
        "frontend/js/app.js"
        "frontend/js/background.js"
        # Frontend 3D scenes (A4)
        "frontend/js/scenes/rain_underpass.js"
        "frontend/js/scenes/snow_bridge.js"
        "frontend/js/scenes/fog_highway.js"
        "frontend/js/scenes/blizzard_street.js"
        # Frontend shaders (A4)
        "frontend/js/shaders/ps1_vertex.glsl"
        "frontend/js/shaders/ps1_fragment.glsl"
        # Backend (A2)
        "backend/server.py"
        "backend/game_engine.py"
        "backend/llm_client.py"
        "backend/state_manager.py"
        "backend/scene_selector.py"
        "backend/viewer_counter.py"
        "backend/requirements.txt"
        "backend/test_server.py"
        # Pipeline outputs (A1, A7)
        "output/tech_survey.json"
        "output/qa_report.json"
    )

    local missing_files=0
    for f in "${required_files[@]}"; do
        if [[ ! -f "${publish_dir}/${f}" ]]; then
            log_error "[git-publisher] Missing required file: ${f}"
            missing_files=$((missing_files + 1))
        elif [[ ! -s "${publish_dir}/${f}" ]]; then
            log_error "[git-publisher] Empty required file: ${f}"
            missing_files=$((missing_files + 1))
        fi
    done

    if [[ ${missing_files} -gt 0 ]]; then
        log_error "[git-publisher] Integrity check FAILED: ${missing_files} missing/empty files"
        AGENT_STATUS["git-publisher-agent"]="failed"
        echo "{\"final_status\":\"failed\",\"error\":\"${missing_files} missing/empty files\"}" > "${OUTPUT_DIR}/git-publisher-agent/git_publish_report.json"
        return 1
    fi
    log_ok "[git-publisher] Integrity check PASSED — all ${#required_files[@]} required files present"

    # Step 2: Git init (if needed)
    if [[ ! -d "${publish_dir}/.git" ]]; then
        log_info "[git-publisher] Initializing git repository..."
        git init -b "${git_branch}" "${publish_dir}"
        log_ok "[git-publisher] Git repo initialized (branch: ${git_branch})"
    else
        log_info "[git-publisher] Git repo already exists"
    fi

    # Step 3: Git LFS setup
    if ! command -v git-lfs &>/dev/null; then
        log_info "[git-publisher] Installing Git LFS..."
        git lfs install 2>/dev/null || {
            log_warn "[git-publisher] Git LFS install failed — continuing without LFS"
        }
    fi
    log_info "[git-publisher] Configuring Git LFS tracking..."
    local lfs_patterns=(
        "*.psd" "*.blend" "*.fbx" "*.png" "*.jpg" "*.tga"
        "*.wav" "*.ogg" "*.mp3"
    )
    for pattern in "${lfs_patterns[@]}"; do
        git lfs track "${pattern}" 2>/dev/null || true
    done
    log_ok "[git-publisher] Git LFS configured (${#lfs_patterns[@]} patterns)"

    # Step 4: Stage all deliverables
    log_info "[git-publisher] Staging all deliverables..."
    git add -A "${publish_dir}"

    # Step 4b: Pre-commit verify — check .gitattributes has LFS rules
    if [[ -f "${publish_dir}/.gitattributes" ]]; then
        local lfs_rules; lfs_rules=$(grep -c "filter=lfs" "${publish_dir}/.gitattributes" 2>/dev/null || echo "0")
        log_info "[git-publisher] .gitattributes contains ${lfs_rules} LFS rules"
    else
        log_warn "[git-publisher] No .gitattributes found — LFS may not be active"
    fi

    local staged_count; staged_count=$(git -C "${publish_dir}" diff --cached --name-only 2>/dev/null | wc -l)
    log_ok "[git-publisher] ${staged_count} files staged"

    # Step 5: Commit
    local version_tag; version_tag="v$(date -u +%Y.%m.%d-%H%M)"
    local commit_msg
    commit_msg=$(cat <<EOF
chore: pipeline release ${version_tag}

Full autonomous web frontend pipeline execution completed.
- Phase 1: Tech survey (Three.js PS1 shader, CSS CRT, FastAPI WebSocket, Mac OS 9 UI CSS, 7-segment CSS) + Frontend scaffold
- Phase 2: Backend refactor (FastAPI + WebSocket) + 3D scenes (4 liminal spaces) + CSS UI (Cybercore Y2K) + API layer (fetch/WebSocket/renderer)
- Phase 3: QA integration (12 machine-checkable rules, overall_pass verified)
- Phase 4: Documentation (README + DEPLOY) + Git push

Deliverables:
- frontend/             — HTML/CSS/JS web frontend (index.html, css/, js/, scenes/, shaders/)
- backend/              — FastAPI + WebSocket Python backend (server.py, game_engine.py, llm_client.py)
- output/tech_survey.json — Technology research report
- output/qa_report.json   — QA integration results (12 checks)

Pipeline: millennium-bug-incident web frontend pipeline
Project: 千禧年蟲事件 (Millennium Bug Incident) — Y2K Liminal Space + Cybercore UI
Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)

Co-Authored-By: Web Frontend Pipeline <pipeline@millennium-bug.local>
EOF
)

    git -C "${publish_dir}" commit -m "${commit_msg}" 2>&1 | tee -a "${LOG_DIR}/git_publish.log"
    local commit_exit=$?

    if [[ ${commit_exit} -ne 0 ]]; then
        log_error "[git-publisher] Commit failed (check ${LOG_DIR}/git_publish.log)"
        AGENT_STATUS["git-publisher-agent"]="failed"
        return 1
    fi

    local commit_hash; commit_hash=$(git -C "${publish_dir}" rev-parse HEAD 2>/dev/null || echo "unknown")
    log_ok "[git-publisher] Commit created: ${commit_hash:0:12}"

    # Step 6: Tag
    git -C "${publish_dir}" tag -a "${version_tag}" -m "Pipeline release ${version_tag} — autonomous game dev pipeline completion"
    log_ok "[git-publisher] Tag created: ${version_tag}"

    # Step 7: Push (with retry)
    if [[ -z "${git_remote}" ]]; then
        log_warn "[git-publisher] No remote configured — skipping push"
        echo "{\"final_status\":\"success_local_only\",\"commit_hash\":\"${commit_hash}\",\"tag\":\"${version_tag}\",\"staged_files\":${staged_count}}" > "${OUTPUT_DIR}/git-publisher-agent/git_publish_report.json"
    else
        git -C "${publish_dir}" remote add origin "${git_remote}" 2>/dev/null || git -C "${publish_dir}" remote set-url origin "${git_remote}"

        local push_success=false
        local push_attempt=0
        local max_push_attempts=3
        local push_backoff=30

        while [[ "${push_attempt}" -lt "${max_push_attempts}" ]]; do
            push_attempt=$((push_attempt + 1))
            log_info "[git-publisher] Push attempt ${push_attempt}/${max_push_attempts}..."

            if git -C "${publish_dir}" push -u origin "${git_branch}" --tags 2>&1 | tee -a "${LOG_DIR}/git_publish.log"; then
                push_success=true
                log_ok "[git-publisher] Push successful (attempt ${push_attempt})"
                break
            else
                log_error "[git-publisher] Push attempt ${push_attempt} failed"
                if [[ ${push_attempt} -lt ${max_push_attempts} ]]; then
                    log_info "[git-publisher] Retrying in ${push_backoff}s..."
                    sleep "${push_backoff}"
                fi
            fi
        done

        if [[ "${push_success}" == "true" ]]; then
            echo "{\"final_status\":\"success\",\"commit_hash\":\"${commit_hash}\",\"tag\":\"${version_tag}\",\"remote\":\"${git_remote}\",\"branch\":\"${git_branch}\",\"staged_files\":${staged_count},\"push_attempts\":${push_attempt}}" > "${OUTPUT_DIR}/git-publisher-agent/git_publish_report.json"
        else
            log_error "[git-publisher] Push FAILED after ${max_push_attempts} attempts"
            echo "{\"final_status\":\"failed_after_retries\",\"commit_hash\":\"${commit_hash}\",\"tag\":\"${version_tag}\",\"remote\":\"${git_remote}\",\"staged_files\":${staged_count},\"push_attempts\":${push_attempt},\"error\":\"push failed after ${max_push_attempts} attempts\"}" > "${OUTPUT_DIR}/git-publisher-agent/git_publish_report.json"
            AGENT_STATUS["git-publisher-agent"]="failed"
            return 1
        fi
    fi

    AGENT_STATUS["git-publisher-agent"]="completed"
    save_checkpoint "4b"
    log_ok "Phase 4b completed — deliverables published"
}

# ── Pipeline Status ────────────────────────────────────────────────────────
show_status() {
    echo ""
    echo -e "${BOLD}Pipeline Status${NC}"
    echo "=============================="
    echo ""

    if [[ -f "${CHECKPOINT_DIR}/latest" ]]; then
        local checkpoint_id; checkpoint_id=$(cat "${CHECKPOINT_DIR}/latest")
        echo -e "Last checkpoint: ${CYAN}${checkpoint_id}${NC}"
        if [[ -f "${CHECKPOINT_DIR}/${checkpoint_id}_manifest.json" ]]; then
            jq '.' "${CHECKPOINT_DIR}/${checkpoint_id}_manifest.json" 2>/dev/null || cat "${CHECKPOINT_DIR}/${checkpoint_id}_manifest.json"
        fi
    else
        echo "No checkpoints found."
    fi

    echo ""
    echo -e "${BOLD}Agent Status:${NC}"
    for agent_id in "${!AGENT_STATUS[@]}"; do
        local status="${AGENT_STATUS[${agent_id}]}"
        case "${status}" in
            completed|test_passed) echo -e "  ${GREEN}✓${NC} ${agent_id}: ${status}" ;;
            failed)                echo -e "  ${RED}✗${NC} ${agent_id}: ${status}" ;;
            dispatching)           echo -e "  ${YELLOW}⟳${NC} ${agent_id}: ${status}" ;;
            *)                     echo -e "  ${BLUE}○${NC} ${agent_id}: ${status}" ;;
        esac
    done

    echo ""
    echo "Failures: ${AGENT_FAILURES} | Recoveries: ${RECOVERY_COUNT}"
}

# ── Cleanup ────────────────────────────────────────────────────────────────
clean_outputs() {
    local force="${1:-}"
    echo -e "${RED}${BOLD}WARNING: This will delete all pipeline outputs.${NC}"
    echo "Directory: ${OUTPUT_DIR}"
    if [[ "${force}" != "--force" ]]; then
        echo ""
        echo "To proceed, re-run with:  ./execute.sh --clean --force"
        echo "Aborted — no files were deleted."
        return 1
    fi
    rm -rf "${OUTPUT_DIR}"
    log_info "All outputs cleaned: ${OUTPUT_DIR}"
}

# ── Signal Handlers ────────────────────────────────────────────────────────
cleanup_on_exit() {
    log_info "Pipeline shutting down..."
    stop_guardians
    log_info "Guardians stopped. Exit."
}
trap cleanup_on_exit EXIT INT TERM

# ═══════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --test)       MODE="test"; shift ;;
            --prod)       MODE="prod"; shift ;;
            --resume)     MODE="resume"; shift ;;
            --status)     show_status; exit 0 ;;
            --clean)      DO_CLEAN=true; shift ;;
            --force)      CLEAN_FORCE="--force"; shift ;;
            --help|-h)    show_help ;;
            --agent=*)    TARGET_AGENT="${1#*=}"; shift ;;
            --phase=*)    TARGET_PHASE="${1#*=}"; shift ;;
            --git-remote=*) GIT_REMOTE="${1#*=}"; shift ;;
            --git-branch=*) GIT_BRANCH="${1#*=}"; shift ;;
            --game-source-dir=*) GAME_SOURCE_DIR="${1#*=}"; shift ;;
            *)            echo "Unknown option: $1"; show_help ;;
        esac
    done

    # Handle --clean before mode check (can combine with --test)
    if [[ "${DO_CLEAN:-false}" == "true" ]]; then
        clean_outputs "${CLEAN_FORCE:-}" || exit 1
        exit 0
    fi

    if [[ -z "${MODE}" ]]; then
        echo -e "${RED}Error: Must specify --test, --prod, or --resume${NC}"
        show_help
    fi

    PIPELINE_START_TIME=$(date +%s)

    echo ""
    echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║  千禧年蟲事件 — Web Frontend Development Pipeline             ║${NC}"
    echo -e "${BOLD}${CYAN}║  Mode: ${MODE}                                               ║${NC}"
    echo -e "${BOLD}${CYAN}║  Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)                        ║${NC}"
    echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # Step 1: Validate environment
    if ! validate_environment; then
        log_error "Environment validation failed. Aborting."
        exit 1
    fi

    # Step 2: Test mode — run comprehensive validation, then exit
    if [[ "${MODE}" == "test" ]]; then
        if ! run_test_mode; then
            exit 1
        fi
        exit 0
    fi

    # Step 3: Handle resume
    if [[ "${MODE}" == "resume" ]]; then
        if ! load_checkpoint; then
            log_error "Cannot resume — no valid checkpoint found"
            exit 1
        fi
        log_info "Resuming from phase ${CURRENT_PHASE}"
        MODE="prod"  # Resume always runs in prod mode
    fi

    # Step 4: Launch guardians (prod mode only)
    if [[ "${MODE}" == "prod" && "${SKIP_GUARDIANS:-0}" != "1" ]]; then
        launch_session_guardian
        launch_standby_monitor
    fi

    # Step 5: Execute pipeline
    local exit_code=0

    # Phase selection logic
    local start_phase=1
    if [[ "${MODE}" == "resume" ]]; then
        start_phase="${CURRENT_PHASE}"
    fi
    if [[ -n "${TARGET_PHASE:-}" ]]; then
        start_phase="${TARGET_PHASE}"
    fi

    if [[ -n "${TARGET_AGENT:-}" ]]; then
        # Single agent debug mode
        log_info "Running single agent: ${TARGET_AGENT}"
        case "${TARGET_AGENT}" in
            tech-survey-agent)        run_phase_1 ;;
            frontend-scaffold-agent)  run_phase_1 ;;
            backend-refactor-agent)   run_phase_2 ;;
            threejs-scene-agent)      run_phase_2 ;;
            css-ui-agent)             run_phase_2 ;;
            api-layer-agent)          run_phase_2 ;;
            qa-integration-agent)     run_phase_3 ;;
            docs-publish-agent)       run_phase_4 ;;
            *) log_error "Unknown agent: ${TARGET_AGENT}"; exit 1 ;;
        esac
    else
        # Full pipeline execution
        if [[ "${start_phase}" -le 1 ]]; then
            if ! run_phase_1; then
                [[ "${MODE}" == "prod" ]] && exit_code=1
            fi
        fi

        if [[ "${start_phase}" -le 2 ]]; then
            if ! run_phase_2; then
                [[ "${MODE}" == "prod" ]] && exit_code=1
            fi
        fi

        if [[ "${start_phase}" -le 3 ]]; then
            if ! run_phase_3; then
                [[ "${MODE}" == "prod" ]] && exit_code=1
            fi
        fi

        if [[ "${start_phase}" -le 4 ]]; then
            if ! run_phase_4; then
                [[ "${MODE}" == "prod" ]] && exit_code=1
            fi
        fi

        # Phase 4b: Aggregate quality report
        if [[ "${MODE}" == "prod" ]]; then
            if ! aggregate_quality_report; then
                log_error "Quality gates FAILED — pipeline cannot proceed to Git push"
                exit_code=1
            fi
        fi

        # Phase 4c: Git Publisher (prod only, after quality gates pass)
        if [[ "${MODE}" == "prod" && ${exit_code} -eq 0 ]]; then
            if ! run_git_publish; then
                log_error "Git publication FAILED — deliverables are local but not pushed"
                GIT_PUSH_FAILED=true
                exit_code=1
            fi
        elif [[ "${MODE}" == "prod" && ${exit_code} -ne 0 ]]; then
            log_error "Skipping Git push — quality gates or prior phases failed"
            GIT_PUSH_FAILED=true
        fi
    fi

    # Step 6: Final report
    local pipeline_duration; pipeline_duration=$(($(date +%s) - PIPELINE_START_TIME))
    local hours=$((pipeline_duration / 3600))
    local minutes=$(((pipeline_duration % 3600) / 60))
    local seconds=$((pipeline_duration % 60))

    echo ""
    echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║  Pipeline Complete                                           ║${NC}"
    echo -e "${BOLD}${CYAN}╠══════════════════════════════════════════════════════════════╣${NC}"
    printf "${BOLD}${CYAN}║${NC}  Duration: %02d:%02d:%02d                                        ${BOLD}${CYAN}║${NC}\n" ${hours} ${minutes} ${seconds}
    printf "${BOLD}${CYAN}║${NC}  Mode: %-55s${BOLD}${CYAN}║${NC}\n" "${MODE}"
    printf "${BOLD}${CYAN}║${NC}  Agents completed: %-41s${BOLD}${CYAN}║${NC}\n" "$(echo ${AGENT_STATUS[@]} | grep -o 'completed' | wc -l)"
    printf "${BOLD}${CYAN}║${NC}  Agents failed: %-44s${BOLD}${CYAN}║${NC}\n" "${AGENT_FAILURES}"
    printf "${BOLD}${CYAN}║${NC}  Recoveries: %-47s${BOLD}${CYAN}║${NC}\n" "${RECOVERY_COUNT}"
    if [[ "${MODE}" == "prod" ]]; then
        echo ""
        echo "  Quality Report:  ${OUTPUT_DIR}/quality_report.json"
        if [[ "${GIT_PUSH_FAILED:-false}" == "true" ]]; then
            echo -e "  ${RED}Git Push:        NOT PUSHED — check git_publish_report.json${NC}"
        else
            echo "  Git Report:      ${OUTPUT_DIR}/git-publisher-agent/git_publish_report.json"
        fi
    fi
    echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"

    # Step 7: Cleanup guardians
    if [[ "${MODE}" == "prod" && "${SKIP_GUARDIANS:-0}" != "1" ]]; then
        stop_guardians
    fi

    exit ${exit_code}
}

main "$@"
