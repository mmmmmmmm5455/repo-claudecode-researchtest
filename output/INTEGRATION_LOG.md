# Skill Repo Integration Log
# 技能嵌入紀錄 — execute.sh Agent Prompt 強化
# Date: 2026-04-29
# =============================================================================

## 來源 Repos

| # | Repo | Local Path | License | Key File |
|---|------|-----------|---------|----------|
| 1 | forrestchang/andrej-karpathy-skills | C:\Users\qwqwh\.claude\repos\andrej-karpathy-skills | Unknown | CLAUDE.md (4 principles) |
| 2 | tanweai/pua | C:\Users\qwqwh\.claude\repos\pua | MIT | skills/pua/SKILL.md (P8 high-agency protocol) |
| 3 | gsd-build/get-shit-done | C:\Users\qwqwh\.claude\repos\get-shit-done | Unknown | agents/gsd-executor.md (spec-driven execution) |

---

## Embedding Matrix

| Agent | Karpathy 4 Principles | P8 6 Principles | GSD 4 Rules | Total Lines Added |
|-------|:---:|:---:|:---:|:---:|
| A1 (tech-survey) | — | YES | — | 9 |
| A2 (backend-refactor) | YES | YES | YES | 24 |
| A3 (frontend-scaffold) | YES | YES | — | 13 |
| A4 (threejs-scene) | YES | YES | YES | 24 |
| A5 (css-ui) | YES | YES | — | 13 |
| A6 (api-layer) | YES | YES | — | 13 |
| A7 (qa-integration) | — | YES (QA-flavored) | — | 9 |
| A8 (docs-publish) | — | YES (Docs-flavored) | — | 9 |

---

## Per-Agent Detail

### A1: tech-survey-agent (PUA only, 9 lines)
Added at: execute.sh line ~994
Content: P8 6 principles (Owner意识, 闭环交付, 事实驱动, 冰山下面还有冰山, 穷尽一切, P8格局)
Rationale: A1 is research-only — no code output. Karpathy/GSD are coding-focused, would be noise.

### A2: backend-refactor-agent (Karpathy + P8 + GSD, 24 lines)
Added at: execute.sh line ~1063
Content:
  - Karpathy 4 (domain-specific: "read all 11 files before coding", "PRESERVE is iron rule", "pytest 29/29 = done")
  - P8 5-8 (domain-specific: "find implicit conventions", "check import chains", "LLM fallback plan")
  - GSD 9-12 (domain-specific: "understand @st.cache_data before writing", "auto-fix imports, mark architecture changes", "analysis paralysis guard", "8 files + 29/29 + server startup")
Rationale: A2 is the most complex agent — needs all three reinforcement layers.

### A3: frontend-scaffold-agent (Karpathy + P8, 13 lines)
Added at: execute.sh line ~1009
Content:
  - Karpathy 1-4 (generic coding principles)
  - P8 5-8 (generic high-agency principles)
Rationale: A3 is structural/scaffolding — Karpathy keeps it simple, P8 ensures correctness.

### A4: threejs-scene-agent (Karpathy + P8 + GSD, 24 lines)
Added at: execute.sh line ~1103
Content:
  - Karpathy 4 (domain-specific: "understand every numeric parameter before GLSL", "PS1 wobble = 5 lines max", "don't touch A3/A6 files", "createScene + switchScene + 3s crossfade")
  - P8 5-8 (domain-specific: "verify WebGL compat", "check all 4 scenes for G4 gates")
  - GSD 9-12 (domain-specific: "understand sin+floor quantization before coding", "auto-fix WebGL errors", "7 files + G4.1/G4.2/G4.3")
Rationale: A4 is the second most complex — GLSL correctness requires all three.

### A5: css-ui-agent (Karpathy + P8, 13 lines)
Added at: execute.sh line ~1123
Rationale: CSS is verbose but straightforward — Karpathy keeps it from over-engineering, P8 ensures palette compliance.

### A6: api-layer-agent (Karpathy + P8, 13 lines)
Added at: execute.sh line ~1144
Rationale: JS API layer needs clean code (Karpathy) and thoroughness (P8).

### A7: qa-integration-agent (PUA only, QA-flavored, 9 lines)
Added at: execute.sh line ~1224
Content: P8 6 principles rewritten for QA context ("each check must paste stdout evidence", "12 checks all executed, skip none", "find violations others missed")
Rationale: QA is verification, not coding — P8's evidence-driven ethos is the perfect fit.

### A8: docs-publish-agent (PUA only, Docs-flavored, 9 lines)
Added at: execute.sh line ~1322
Content: P8 6 principles rewritten for docs context ("README should let a new dev understand in 30s", "every path in docs must be verified to exist", "28 pre_push_checks all pass")
Rationale: Docs need thoroughness and user empathy — P8's Owner意识 maps directly.

---

## Principles Summary

### Andrej Karpathy (CLAUDE.md)
1. Think Before Coding — state assumptions, present tradeoffs, ask when unclear
2. Simplicity First — minimum code, no abstractions for single-use, no speculative features
3. Surgical Changes — touch only what you must, match existing style, don't refactor unbroken things
4. Goal-Driven Execution — transform tasks into verifiable goals, loop until verified

### P8 High-Agency (pua/skills/pua/SKILL.md)
1. Owner意识 — active problem discovery, not passive execution
2. 闭环交付 — never claim "done" without verification evidence
3. 事实驱动 — verify before attributing cause, never guess
4. 冰山下面还有冰山 — fix one → find pattern → fix all similar
5. 穷尽一切 — exhaust 5-step methodology before giving up
6. P8格局 — "What haven't I thought of?" "What similar things also need fixing?"

### GSD Spec-Driven (gsd-executor.md)
1. Confirm spec understanding before coding
2. Auto-fix deviations (Rules 1-3: bugs, missing critical functionality, blocking issues)
3. Analysis paralysis guard — 5+ reads without writes = STOP
4. Task completion = verified against plan requirements, not "I wrote code"

---

## Verification

- `bash execute.sh --test`: 5/5 PASS (YAML Syntax, Schema Validation, Skill Existence, Dependency Check, Git Config)
- `pytest backend/test_server.py`: 29/29 PASSED
- No bash syntax errors introduced
- All 8 agent prompts remain single-quoted (no variable expansion issues)
