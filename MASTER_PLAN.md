# Multi-Agent System for Autonomous Game Development Pipeline Research

> **STATUS: Future Research Phase — NOT the current implementation.**
> This document describes a planned 15-agent Godot 4.x + GDExtension research project.
> The actual implemented project is an 8-agent FastAPI + Three.js Y2K web frontend, defined
> in `workflow.yaml` and built in `output/`. See `workflow.yaml` and `README.md` for
> the current architecture.

## Part A: Master Plan

**Project**: Can LLM-based Agents Autonomously Complete the Full Game Development Pipeline — from Requirements to Playable Prototype?

**Career Objective**: Build AI companions in games with long-term memory, emotional interaction, and autonomous behavior.

**Date**: 2026-04-28
**Environment**: DeepSeek Pro (128K+ context), Windows 11, Claude Code CLI
**Skill Ecosystem**: 694 skills, 83 agents, 147 OpenSpace MCP tools

---

## 1. Project Understanding (Restated)

This research investigates whether a coordinated swarm of LLM-based agents can autonomously execute the entire game development pipeline — from parsing a natural-language game design document through to a playable prototype — without human intervention at intermediate steps.

The secondary objective is to apply the findings to build AI companions for games that possess:
- **Long-term memory**: Persistent recall across game sessions, relationship tracking, event memory
- **Emotional interaction**: Dynamic emotional states responding to player actions, multi-modal expression
- **Autonomous behavior**: Self-directed goal-setting, environmental adaptation, emergent social dynamics

The research question is not "can one agent do everything" but rather "can a properly architected multi-agent system, each agent specialized and constrained, collectively achieve what currently requires a human game studio?"

### Scope Boundaries

- **In scope**: Godot Engine 4.x (open-source, GDExtension-friendly, full source access), 2D/3D prototype, requirements-to-prototype pipeline, AI companion memory/emotion/behavior subsystems
- **Out of scope**: AAA production quality, multiplayer/netcode, monetization systems, console certification, proprietary engines (Unity/Unreal — analyzed but not implemented against)

---

## 2. Skill & Capability Audit

### 2.1 Core Capability Mapping

| Module | Available Skills | Count | Gaps |
|--------|-----------------|-------|------|
| **Memory** | mempalace, sci-semantic-scholar, os-memory-* | 12+ | None |
| **Vision/Rendering** | sci-visualization, sci-generate-image, sci-scientific-visualization, sci-data-visualization-expert | 6 | No dedicated CV model inference skill — supplement with local Python + OpenCV/Transformers |
| **Game Engine** | 72 ccgs-* (full studio pipeline), 4 godogen-* (Godot/Bevy) | 76 | None — CCGS covers design→code→test→release |
| **Orchestration** | workflow-orchestrator, dispatching-parallel-agents, subagent-driven-development | 3 | None |
| **Academic Research** | sci-academic-deep-research, sci-literature-review, sci-systematic-review, sci-paper-writing, sci-arxiv-search, 280+ more | 285 | None |
| **Project Management** | pm-prd-development, pm-roadmap-planning, pm-epic-breakdown-advisor, pm-story-point-estimator, 43+ more | 47 | None |
| **Anti-Stall / Guard** | auto-recovery, openspace-monitor, gstack-guard, gstack-health, openspace | 5 | None |
| **Context Management** | openviking (L0/L1/L2), prompt-cache, context-trimmer, skill-router | 8 | None |
| **QA / Testing** | verification-before-completion, gstack-qa, gstack-review, ccgs-code-review, ccgs-bug-triage, ccgs-test-flakiness, game-tester, 20+ more | 25+ | None |
| **Emotion/Behavior** | None — novel subsystem | 0 | **GAP**: No existing skills for emotional modeling or autonomous behavior. Must be built from scratch using local LLM inference + Python. |
| **Godot GDExtension** | godogen-godot-godogen, godogen-godot-godot-api, ccgs-godot-specialist (agent) | 3 | C++ bridge tested, sufficient for prototype |

### 2.2 GitHub Supplements Required

| Gap | Solution | Source |
|-----|----------|--------|
| Emotion modeling | Custom Python module using local LLM (Ollama/LM Studio) for sentiment→emotional state mapping | Built in-project |
| Autonomous behavior | GOAP (Goal-Oriented Action Planning) + utility AI hybrid, Python implementation | Built in-project |
| CV model inference | Local Stable Diffusion + YOLO/CLIP via HuggingFace Transformers | pip install |
| Game asset pipeline | CCGS skills already cover this; supplement with godogen for GDExtension bridging | Installed |

### 2.3 Skill-to-Agent Mapping Rationale

Each agent loads only the skills it needs, using `skill-router` for semantic filtering. Average per-agent skill load: 4-7 skills (~200-350 tokens via AAAK compression), vs. 694 skills (~5,200 tokens) without routing. **92% token reduction confirmed.**

---

## 3. Agent Architecture

### 3.1 System Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                    SESSION GUARDIAN AGENT                        │
│  Context mgmt │ Token budget │ Anti-stall │ Crash recovery       │
│  Skills: openviking, prompt-cache, context-trimmer, auto-recovery│
└────────────┬────────────────────────────────────────┬───────────┘
             │                                        │
     ┌───────▼────────┐                      ┌───────▼────────┐
     │  STANDBY        │                      │  ORCHESTRATOR   │
     │  MONITOR &      │                      │  AGENT          │
     │  DEBUG          │                      │                 │
     │  Skills:        │                      │  Skills:        │
     │  openspace-     │◄─────────────────────│  workflow-      │
     │  monitor,       │   Health pings        │  orchestrator,  │
     │  gstack-health, │                      │  dispatching-   │
     │  gstack-guard   │                      │  parallel-agents│
     └─────────────────┘                      └───┬───┬───┬─────┘
                                                  │   │   │
          ┌───────────────────────────────────────┘   │   └──────────────┐
          │                                           │                  │
    ┌─────▼──────┐                              ┌─────▼──────┐    ┌─────▼──────┐
    │ PHASE 1    │                              │ PHASE 2    │    │ PHASE 3    │
    │ RESEARCH   │                              │ DESIGN     │    │ IMPLEMENT  │
    └────────────┘                              └────────────┘    └────────────┘
```

### 3.2 Agent Definitions

#### Phase 1: Research Foundation (3 agents)

---

**Agent 1: Literature Survey Agent**
| Property | Value |
|----------|-------|
| **ID** | `lit-survey-agent` |
| **Role** | Systematic literature review on LLM agents in game development pipelines |
| **Skills** | sci-academic-deep-research, sci-systematic-review, sci-literature-review, sci-arxiv-search, sci-semantic-scholar |
| **Input** | Research questions, date range (2020-2026), venue filter (ICLR, NeurIPS, ICML, AAAI, SIGGRAPH, GDC, FDG, AIIDE) |
| **Output** | `literature_matrix.json` — structured corpus with papers, findings, methodology tags, citation graph |
| **Quality Gate** | ≥50 papers screened, ≥20 included, PRISMA flow diagram generated |
| **Depends On** | None (Phase 1 entry) |
| **Timeout** | 30 minutes |
| **Retry Strategy** | 3 attempts with exponential backoff (60s, 300s, 900s) |

---

**Agent 2: Game Pipeline Analysis Agent**
| Property | Value |
|----------|-------|
| **ID** | `pipeline-analysis-agent` |
| **Role** | Map complete game dev pipeline, identify all automation-eligible checkpoints |
| **Skills** | ccgs-project-stage-detect, ccgs-create-epics, ccgs-create-stories, ccgs-estimate, ccgs-scope-check, ccgs-architecture-review |
| **Input** | Game Design Document (GDD) template, target genre (RPG/simulation for AI companions), Godot 4.x capability matrix |
| **Output** | `pipeline_map.json` — stage→tasks→skills mapping with automation feasibility scores (0.0-1.0) |
| **Quality Gate** | ≥15 pipeline stages identified, each with ≥3 automation checkpoints, feasibility scored with evidence |
| **Depends On** | None (Phase 1 entry) |
| **Timeout** | 20 minutes |
| **Retry Strategy** | 2 attempts |

---

**Agent 3: Vision Systems Agent**
| Property | Value |
|----------|-------|
| **ID** | `vision-systems-agent` |
| **Role** | Design CV pipeline for game asset analysis, generation, and validation |
| **Skills** | sci-visualization, sci-generate-image, sci-scientific-visualization, sci-data-visualization-expert |
| **Input** | Asset specification from pipeline analysis, target resolution/formats, Godot import pipeline docs |
| **Output** | `vision_pipeline_spec.json` — model selection, inference pipeline, asset validation rules, rendering benchmarks |
| **Quality Gate** | 3 CV tasks defined (generation, validation, style-transfer), benchmarked on ≥2 models each |
| **Depends On** | None (Phase 1 entry) |
| **Timeout** | 25 minutes |
| **Retry Strategy** | 2 attempts |

---

#### Phase 2: Architecture Design (3 agents)

---

**Agent 4: Agent Architecture Designer**
| Property | Value |
|----------|-------|
| **ID** | `architecture-designer-agent` |
| **Role** | Design the multi-agent system topology, communication protocol, and state management |
| **Skills** | subagent-driven-development, workflow-orchestrator, dispatching-parallel-agents, pm-prd-development |
| **Input** | Pipeline map (from Agent 2), literature findings (from Agent 1), 694-skill inventory |
| **Output** | `agent_architecture.json` — agent DAG, message schemas, state machine, handoff protocols, skill assignments |
| **Quality Gate** | All 15 agents defined with clear I/O contracts, no circular dependencies, ≤3-hop max dependency chain |
| **Depends On** | Agent 1, Agent 2 |
| **Timeout** | 35 minutes |
| **Retry Strategy** | 3 attempts |

---

**Agent 5: Memory Architecture Agent**
| Property | Value |
|----------|-------|
| **ID** | `memory-architecture-agent` |
| **Role** | Design long-term memory system for AI companions — episodic, semantic, relational |
| **Skills** | mempalace, sci-semantic-scholar, os-memory-* |
| **Input** | Memory system requirements: persistence, retrieval latency <100ms, multi-session state, relationship graphs |
| **Output** | `memory_architecture.json` — schema, chunking strategy, embedding model selection, retrieval pipeline, AAAK index design |
| **Quality Gate** | 3 memory types (episodic, semantic, relational), retrieval benchmarked at <100ms P95, 95%+ recall@10 |
| **Depends On** | Agent 4 (architecture constraints) |
| **Timeout** | 30 minutes |
| **Retry Strategy** | 3 attempts |

---

**Agent 6: Emotion & Behavior Designer**
| Property | Value |
|----------|-------|
| **ID** | `emotion-behavior-agent` |
| **Role** | Design emotional state machine and autonomous behavior system |
| **Skills** | Custom Python modules (no existing skills — novel domain), informed by sci-academic-deep-research on affective computing |
| **Input** | Emotion model requirements (OCC model, PAD space, or custom), behavior requirements (GOAP, utility AI, BTs) |
| **Output** | `emotion_behavior_spec.json` — emotional state model (valence/arousal/dominance), transition rules, behavior tree templates, GOAP action set |
| **Quality Gate** | ≥8 emotional states with defined transitions, ≥20 GOAP actions, behavior tree for ≥3 scenarios |
| **Depends On** | Agent 4 (architecture constraints) |
| **Timeout** | 30 minutes |
| **Retry Strategy** | 3 attempts |

---

#### Phase 3: Implementation (4 agents)

---

**Agent 7: Engine Integration Agent**
| Property | Value |
|----------|-------|
| **ID** | `engine-integration-agent` |
| **Role** | Godot 4.x integration via GDExtension, scene management, input/output bridging |
| **Skills** | godogen-godot-godogen, godogen-godot-godot-api, ccgs-setup-engine, ccgs-create-control-manifest |
| **Input** | Architecture spec, prototype requirements, Godot 4.x API surface |
| **Output** | `engine_bridge/` — GDExtension C++ bridge, Python→Godot IPC, scene templates, input mapping |
| **Quality Gate** | GDExtension compiles, Python↔Godot roundtrip <16ms, 3 scene templates functional |
| **Depends On** | Agent 4, Agent 5, Agent 6 |
| **Timeout** | 45 minutes |
| **Retry Strategy** | 3 attempts |

---

**Agent 8: Prototype Builder Agent**
| Property | Value |
|----------|-------|
| **ID** | `prototype-builder-agent` |
| **Role** | Build the playable prototype in Godot — mechanics, UI, AI companion integration |
| **Skills** | ccgs-prototype, ccgs-quick-design, ccgs-create-stories, ccgs-dev-story, ccgs-art-bible, ccgs-ux-design, ccgs-team-ui |
| **Input** | All Phase 2 outputs, engine bridge from Agent 7, GDD |
| **Output** | `prototype/` — Godot project with playable scene, AI companion NPC, basic mechanics |
| **Quality Gate** | Playable scene at 30+ FPS, AI companion present with ≥3 interaction types, no crash on 5-minute playtest |
| **Depends On** | Agent 7 |
| **Timeout** | 60 minutes |
| **Retry Strategy** | 3 attempts |

---

**Agent 9: AI Companion Core Agent**
| Property | Value |
|----------|-------|
| **ID** | `companion-core-agent` |
| **Role** | Implement memory retrieval, emotional state updates, and behavior selection for AI companion |
| **Skills** | mempalace (retrieval), custom emotion/behavior modules, local LLM inference (Ollama) |
| **Input** | Memory architecture (Agent 5), emotion spec (Agent 6), prototype scene API (Agent 8) |
| **Output** | `companion_core/` — MemoryStore, EmotionEngine, BehaviorPlanner, LLMInterface Python modules |
| **Quality Gate** | Memory retrieval <100ms P95, emotion update <16ms (60fps), behavior selection <50ms, all unit tests pass (90%+ coverage) |
| **Depends On** | Agent 5, Agent 6, Agent 8 |
| **Timeout** | 50 minutes |
| **Retry Strategy** | 3 attempts |

---

**Agent 10: Data Pipeline Agent**
| Property | Value |
|----------|-------|
| **ID** | `data-pipeline-agent` |
| **Role** | Prepare training/evaluation datasets, benchmark suite, evaluation harness |
| **Skills** | sci-data-visualization-expert, sci-arxiv-database, custom data processing |
| **Input** | Literature matrix (Agent 1), evaluation criteria from architecture (Agent 4) |
| **Output** | `data/` — benchmark datasets, evaluation scripts, metric definitions, baseline results |
| **Quality Gate** | ≥3 benchmark tasks, ≥100 test cases per task, automated evaluation harness, baseline scores documented |
| **Depends On** | Agent 1, Agent 4 |
| **Timeout** | 40 minutes |
| **Retry Strategy** | 2 attempts |

---

#### Phase 4: Quality & Operations (3 agents)

---

**Agent 11: QA & Testing Agent**
| Property | Value |
|----------|-------|
| **ID** | `qa-testing-agent` |
| **Role** | Comprehensive testing — unit, integration, performance, regression |
| **Skills** | ccgs-qa-plan, ccgs-regression-suite, ccgs-smoke-check, ccgs-soak-test, ccgs-test-flakiness, ccgs-perf-profile, game-tester, verification-before-completion |
| **Input** | All Phase 3 outputs, test plan from architecture |
| **Output** | `test_results/` — coverage report, perf benchmarks, bug reports, flakiness log |
| **Quality Gate** | 90%+ code coverage, 98%+ test pass rate, 0 critical bugs, P95 frame time <33ms |
| **Depends On** | Agent 7, Agent 8, Agent 9, Agent 10 |
| **Timeout** | 45 minutes |
| **Retry Strategy** | 3 attempts |

---

**Agent 12: Documentation & Paper Agent**
| Property | Value |
|----------|-------|
| **ID** | `documentation-agent` |
| **Role** | Produce academic paper, technical documentation, API docs, architecture diagrams |
| **Skills** | sci-paper-writing, sci-article-writing, ccgs-reverse-document, ccgs-changelog |
| **Input** | All prior outputs, literature matrix, experiment results |
| **Output** | `paper/` — LaTeX manuscript (ICLR/NeurIPS format), `docs/` — API documentation, architecture guide |
| **Quality Gate** | Paper: ≥8 pages, ≥30 citations, all claims sourced; Docs: 100% public API coverage, ≥3 tutorials |
| **Depends On** | Agent 1, Agent 4, Agent 11 |
| **Timeout** | 50 minutes |
| **Retry Strategy** | 2 attempts |

---

**Agent 13: Integration Agent**
| Property | Value |
|----------|-------|
| **ID** | `integration-agent` |
| **Role** | End-to-end integration testing across all subsystems, deploy prototype, run full demo |
| **Skills** | ccgs-launch-checklist, ccgs-day-one-patch, ccgs-release-checklist, ccgs-smoke-check |
| **Input** | All Phase 3 & 4 outputs |
| **Output** | `integration_report.json` — E2E test results, deployment manifest, demo recording, known issues |
| **Quality Gate** | Full pipeline runs end-to-end without human intervention, prototype launches and is playable, demo script executes |
| **Depends On** | Agent 11, Agent 12 |
| **Timeout** | 35 minutes |
| **Retry Strategy** | 2 attempts |

---

#### Phase 5: System Guardians (2 agents — always running)

---

**Agent 14: Standby Monitor & Debug Agent**
| Property | Value |
|----------|-------|
| **ID** | `standby-monitor-agent` |
| **Role** | Continuous health monitoring, anomaly detection, auto-recovery, crash debugging |
| **Skills** | openspace-monitor, gstack-health, gstack-guard, auto-recovery, openspace |
| **Input** | Health pings from all agents (every 30s), system metrics, error logs |
| **Output** | `monitor_log.jsonl` — health check stream, `debug_report.json` — post-mortem on any failure |
| **Quality Gate** | Failure detected within 30s, recovery initiated within 60s, ≥95% recovery success rate |
| **Depends On** | None (always-on daemon) |
| **Timeout** | N/A (persistent) |
| **Recovery Protocol** | 1. Detect stall/crash → 2. Log state dump → 3. Kill stalled agent → 4. Restore from last checkpoint → 5. Re-dispatch task → 6. Verify output |
| **Escalation** | If 3 consecutive recovery attempts fail, halt pipeline and notify with full debug report |

---

**Agent 15: Session Guardian Agent**
| Property | Value |
|----------|-------|
| **ID** | `session-guardian-agent` |
| **Role** | Context window management, token budget enforcement, anti-stall, compression triggering |
| **Skills** | openviking (L0/L1/L2), prompt-cache, context-trimmer, skill-router, auto-recovery |
| **Input** | Session state, token usage metrics, context window utilization |
| **Output** | Session health reports, compression triggers, token savings metrics |
| **Quality Gate** | Token usage ≤85% of context limit, context fragmentation ≤10%, compression preserves ≥95% task accuracy |
| **Depends On** | None (always-on) |
| **Timeout** | N/A (persistent) |
| **Guard Rules** | 1. Trigger L1 compression at 70% context utilization; 2. Trigger L2 at 85%; 3. Block agent dispatch if token budget exhausted; 4. Pre-compact hook saves all state before compression |

---

### 3.3 Agent Dependency Graph

```
Phase 1 (Parallel)          Phase 2 (Parallel)         Phase 3 (Sequential)        Phase 4 (Parallel)       Phase 5 (Always-On)
─────────────────────      ────────────────────       ──────────────────────      ───────────────────      ────────────────────
                                                                                                          
LitSurvey ◄──────────────── Architecture ◄─────────── Engine ◄──────┐            QA ◄───────────────────► StandbyMonitor
   │                           │                        │            │              │                          │
   │                           │                        ▼            │              │                          │
   ├───────────────────────────┤              ┌─── Prototype ◄──────┤              │                          │
   │                           │              │        │            │              │                          │
Pipeline ◄─────────────────────┤              │        ▼            ├──────┬───────┤                          │
   │                           │              │    Companion ◄──────┘      │       │                          │
   │                           ├── MemArch ◄──┤                              │       │                          │
   │                           │              │                              │       │                          │
   │                           │              │                              │       │                          │
Vision ◄───────────────────────┘              │                              │       │                          │
   │                           ├── EmoBeh ◄───┤                              │       │                          │
   │                           │              │                              │       │                          │
   └───────────────────────────┤              │                              │       │                          │
                               │              └── DataPipeline ◄─────────────┤       │                          │
                               │                                              │       │                          │
                               └──────────────────────────────────────────────┤       │                          │
                                                                              │       │                          │
                                                                     Integration ◄─── Doc ◄──────────────────────┤
                                                                              │                                  │
                                                                              └──────────────────────────────────┤
                                                                                                                 │
                                                                                                        SessionGuardian
```

---

## 4. Quality Standards (Above Industry Average)

| Metric | Industry Average | Our Target | Measurement Method |
|--------|-----------------|------------|-------------------|
| Code coverage | 70-80% | **90%+** | pytest-cov, branch coverage |
| Agent task completion rate | 70-85% | **95%+** | Orchestrator success/failure log |
| Crash recovery time | 2-5 min (manual) | **<30s** (automated) | Monitor agent timestamp delta |
| Test pass rate | 85-95% | **98%+** | CI test report |
| P95 memory retrieval latency | 200-500ms (RAG) | **<100ms** | Benchmark harness |
| P95 frame time (game) | 33ms (30fps) | **<16ms (60fps)** | Godot profiler |
| Token waste (context) | 30-50% | **≤15%** | openviking metrics |
| Documentation coverage | 40-60% of APIs | **100%** of public APIs | Automated doc check |
| Agent stall detection | Often manual | **<60s** automated | Monitor agent heartbeat |
| Recovery success rate | 60-80% | **≥95%** | Monitor agent recovery log |
| Paper citation completeness | Varies | **100%** sourced | Reference checker |
| Pipeline autonomy | 0% (fully manual) | **≥95%** (automated) | Human intervention counter |

---

## 5. Execution Modes

### 5.1 `--test` / `--dry-run` Mode

- All agents execute with `--dry-run` flag
- No filesystem writes (outputs go to `/tmp/dry-run/`)
- API calls mocked with recorded responses
- Full dependency resolution and scheduling validated
- Mock LLM responses for deterministic testing
- Report: which agents would run, in what order, with what inputs, expected outputs
- Exit code 0 if the plan is valid, non-zero with error details if invalid

### 5.2 `--prod` Mode

- Full execution with real LLM inference
- Filesystem writes to project directory
- Standby Monitor + Session Guardian activated
- Checkpoints saved after each phase completion
- All quality gates enforced
- Final integration test must pass before declaring completion

### 5.3 `--resume` Mode

- Resume from last checkpoint after a crash
- Reads checkpoint manifest to determine completed phases
- Skips completed agents, re-dispatches failed/incomplete agents
- Preserves all prior outputs

---

## 6. Self-Critique: Identified Vulnerabilities

### Vulnerability 1: LLM Non-Determinism Compounds Across Agent Chain

**Severity**: HIGH

**Description**: Each agent in the pipeline depends on the output of upstream agents. Since every agent uses LLM inference (which is non-deterministic by nature), errors and hallucinations compound multiplicatively. If Agent 1 (LitSurvey) hallucinates a paper that doesn't exist, Agent 4 (Architecture) builds on that hallucination, and by Agent 8 (Prototype), the entire prototype may be based on fabricated evidence.

**Mitigation**:
1. Every agent output passes through `verification-before-completion` skill — factual claims cross-referenced against source data
2. Literature agent uses `sci-semantic-scholar` with DOI verification (hard validation, not LLM generation)
3. Pipeline includes "fact-check gates" between phases — Agent N's output is spot-checked by Agent N+1 before acceptance
4. All generated code is compiled and tested (compilation failure == immediate detection of hallucination)
5. Citation graph is validated against arxiv API — any DOI that returns 404 triggers agent re-run

**Residual Risk**: MEDIUM (mitigations reduce but don't eliminate — LLM hallucination is a fundamental limitation)

---

### Vulnerability 2: Godot GDExtension Bridge is a Single Point of Failure

**Severity**: HIGH

**Description**: The entire prototype depends on Agent 7's GDExtension bridge between Python (where LLM inference happens) and Godot (where the game runs). If the bridge has bugs — memory leaks, serialization errors, latency spikes — the prototype will be unstable or unplayable. GDExtension is C++ and notoriously difficult to debug from Python. A segfault in the bridge kills both the game and the agent orchestrator.

**Mitigation**:
1. Agent 7 must produce a Python-native fallback (headless mode using Godot's `--headless` flag with command-line IPC) alongside the GDExtension bridge
2. Bridge code is generated with exhaustive error handling — every C++ call wrapped in try/catch, every pointer null-checked
3. `ccgs-perf-profile` runs on the bridge before any downstream agent uses it
4. If GDExtension bridge fails QA gate, system falls back to headless IPC mode (degraded but functional)
5. Bridge has a canary test: 1000 roundtrips must complete with 0 errors and P95 <16ms before gate passes

**Residual Risk**: MEDIUM (fallback path exists but is degraded)

---

### Vulnerability 3: Token Budget Exhaustion on DeepSeek Pro

**Severity**: MEDIUM

**Description**: Even with openviking compression (91-96% savings), a 15-agent pipeline with complex game development tasks could exhaust the 128K context window, especially during later phases where agents need context from multiple upstream outputs. If the Session Guardian fails to compress in time, mid-agent truncation corrupts output.

**Mitigation**:
1. Session Guardian enforces hard cap at 85% utilization (108,800 tokens) — blocks dispatch before limit
2. openviking L2 compression (AAAK symbolic representation) applied preemptively at 70%
3. Each agent receives only the compressed summary of upstream outputs, not full outputs
4. Full outputs stored on disk, retrievable via mempalace on-demand
5. Agent outputs capped at 8K tokens each (enforced by orchestrator)

**Residual Risk**: LOW (multiple defensive layers)

---

### Vulnerability 4: Emotion Model Lacks Ground Truth Validation

**Severity**: MEDIUM

**Description**: The Emotion & Behavior Designer (Agent 6) produces an emotional model with no objective ground truth. "Does this emotional state machine feel natural?" is a subjective question. The system could produce an emotional model that passes all technical gates but feels robotic or inappropriate in gameplay.

**Mitigation**:
1. Emotion model validated against established psychological frameworks (OCC, PAD) by the Literature agent
2. Unit tests for emotional transitions (e.g., "does gratitude increase after receiving help?")
3. Behavior tree scenarios tested against expected outcomes ("NPC should help player after positive interaction history")
4. Ultimately, subjective validation requires human playtesting — the system flags this as a known limitation

**Residual Risk**: MEDIUM (subjective quality cannot be fully automated)

---

### Vulnerability 5: Skill Drift — 694 Skills May Contain Conflicts

**Severity**: LOW-MEDIUM

**Description**: With 694 skills from 16+ repositories, there is risk of conflicting instructions, overlapping responsibilities, or stale skills that reference deprecated APIs. The QA agent may detect this too late.

**Mitigation**:
1. `skill-router` pre-filters to only relevant skills per agent (4-7 out of 694)
2. `ccgs-skill-test` validates loaded skills before agent dispatch
3. `ccgs-consistency-check` runs on skill assignments during architecture phase
4. All skill invocations logged for post-mortem analysis

**Residual Risk**: LOW

---

## 7. Success Criteria

The project is **successful** when:

1. **Pipeline autonomy ≥95%**: 95%+ of pipeline steps execute without human intervention
2. **Prototype playable**: A human can launch the Godot project and interact with an AI companion NPC
3. **Memory works**: The AI companion remembers interactions across ≥3 game sessions
4. **Emotion valid**: The companion expresses ≥8 distinct emotional states that change based on player actions
5. **Paper submitted**: A complete manuscript meeting ICLR/NeurIPS formatting requirements
6. **Reproducible**: Another researcher can run `./execute.sh --prod` and reproduce the full pipeline

---

## 8. Timeline

| Phase | Duration | Agents | Output |
|-------|----------|--------|--------|
| Phase 1: Research | 1-2 hours | 3 agents (parallel) | Literature matrix, pipeline map, vision spec |
| Phase 2: Design | 1-2 hours | 3 agents (parallel) | Architecture, memory design, emotion spec |
| Phase 3: Implementation | 3-4 hours | 4 agents (sequential) | Engine bridge, prototype, companion core, data pipeline |
| Phase 4: Quality | 2-3 hours | 3 agents (parallel) | Test results, paper, integration report |
| Phase 5: Guardians | Continuous | 2 agents (always-on) | Health monitoring, context management |
| **Total** | **7-11 hours** | **15 agents** | **Complete research package** |

---

*End of Part A — Master Plan*
