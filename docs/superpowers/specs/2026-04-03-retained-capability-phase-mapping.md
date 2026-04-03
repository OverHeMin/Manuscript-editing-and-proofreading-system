# Retained Capability To Phase Mapping

**Date:** 2026-04-03  
**Status:** Approved mapping baseline for future phase planning  
**Purpose:** Turn the retained-capability decision into explicit phase ownership so long-term platform abilities do not float unassigned, get silently dropped, or get accidentally reabsorbed into `Phase 10A`.

## 1. Why This Document Exists

`2026-04-03-tooling-capability-review-decision.md` resolved which platform capabilities must remain on the long-term roadmap.

That decision answered:

- which capabilities must survive
- which implementation routes are currently preferred
- which routes may change later

What it did **not** yet answer was:

- which already-landed phases partially cover those capabilities
- which capabilities are still only partially realized
- which future phases should own the remaining work

Without this mapping, the repository would still face two planning risks:

- a retained capability could remain conceptually approved but operationally ownerless
- `Phase 10A` could slowly expand into a catch-all bucket for unrelated platform depth

This document closes that gap.

## 2. Mapping Rules

The following rules apply to future planning:

1. Existing `plans` and `specs` files remain the canonical definition of already-planned or already-landed scope.
2. `Phase 10A` remains the production-operations baseline only. It must not absorb retrieval completion, durable orchestration, knowledge-ops depth, or evaluation-platform deepening.
3. A long-term capability may span multiple phases, but it must always have an explicitly named owning phase lane.
4. Future phase labels may split or merge, but only if the capability mapping remains explicit.
5. If a future phase touches more than one capability lane, its primary lane must still be named clearly in the plan and spec.

## 3. Current Coverage Baseline

The table below translates the retained capabilities into current repository reality.

| Capability / Route | Already Anchored In Current Repository | Current State | Still Missing |
|------|-----------------------------------------|---------------|---------------|
| Knowledge Retrieval Stack | `04-knowledge-learning-and-retrieval.md`, Phase 5, Phase 7A, Phase 7B, Phase 8AB, Phase 8AC, Phase 8Z | Knowledge governance, review, writeback, provenance, and review handoff are real | `pgvector`-backed vector retrieval, hybrid retrieval, reranking, retrieval-quality evaluation, template knowledge-pack recall depth |
| Medical Knowledge Ops | Phase 5, Phase 7A, Phase 7B, Phase 8AA, 8AB, 8AC, 8AD, 8Z, current template-governance and knowledge-review workbenches | Governed draft creation, review queue, review history, writeback, and persistent review handoff are already present | Bulk ingest, deduplication, expiry and supersession governance, periodic review, richer operator workbench views, Yuxi-style backstage depth |
| Model Governance / Routing Linkage | `05-ai-model-routing-and-evaluation.md`, Phase 9R, Phase 9S, Phase 9T | Model registry, runtime-binding expectations, governed seeded evaluation runs, and inline governed check execution are already partially linked | Stronger routing-policy feedback loops, fallback and gray-release policy, module/template-level promotion rules, deeper evaluation-to-routing governance |
| Agent Runtime Platform | Phase 4, Phase 8G, Phase 8H, Phase 9R, `11-agent-runtime-and-portable-skills.md` | Registry, runtime binding, tool permission policy, admin governance visibility, and execution evidence are already partially live | Deeper adapter-based runtime integration, portable skill-package operations, richer sandbox governance, stronger MCP / tool gateway platform boundary |
| Evaluation And Verification Platform | Phase 6A, Phase 8W, Phase 9A, Phase 9Q, Phase 9R, Phase 9S, Phase 9T | Evaluation Workbench, run persistence, governed-source runs, machine evidence, and release-gate verification are already real | Sample-set detail depth, historical evidence-pack retrieval, multi-run comparison, operator analytics, stronger release-facing analysis surfaces |
| Execution And Orchestration Platform | Phase 4 execution governance foundations, Phase 8F, Phase 8I, Phase 9R, current execution-governance records | The repo has execution governance, resolution, snapshots, and observability precursors | Durable async orchestration, retries, recovery flows, restart-safe job handling, queue-state observability, `Temporal`-class orchestration depth |
| Production Operations And Security Platform | `09-platform-ops-migration-and-maintenance.md`, `08-security-auth-and-compliance.md`, `2026-04-03-phase10a-production-operations-baseline-design.md`, current `README.md` and `docs/OPERATIONS.md` | Production preflight, release contract, readiness split, backup/rollback guidance, and remote-maintenance discipline now have a real baseline direction | Standardized deploy automation, monitoring, rollback automation, remote-maintenance standardization depth, secret/key hardening, upgrade choreography, migration automation |
| Privacy And Compliance Gate | `08-security-auth-and-compliance.md`, retained-capability decision | Security and compliance direction exists at spec level | `Presidio`-style privacy gate integration, de-identification checks in governed flows, privacy evidence hooks |
| Academic Structure And OCR Enhancement | `06-pdf-consistency-and-ocr.md`, V1 foundation tech direction | PDF and document pipelines exist, and OCR/parsing routes are reserved | First-class `OCRmyPDF`, `PaddleOCR`, and `GROBID` integration with auditable outputs and downstream structured consumption |
| Specialized Human Review / Annotation Route | Current knowledge review, learning review, evaluation workbench, retained-capability decision | Core human review remains inside the main system and already has durable governance surfaces | External annotation integration boundary, including optional `Label Studio` scenarios where specialized annotation is justified |

## 4. Future Phase Ownership

The next step is not to reopen the retained-capability decision.
The next step is to assign each still-open capability line to a future phase lane.

The recommended future mapping is:

### 4.1 Phase 10B: Model Governance, Routing, And Evaluation Linkage

**Primary capability lane:** Model Governance / Routing Linkage  
**Preferred route:** Continue deepening the current internal model registry and verification-ops linkage

This phase should own:

- model-routing policy tied to evaluation evidence
- fallback and gray-release policy
- module-level and template-level model promotion rules
- stronger evaluation-to-routing feedback loops
- release-gate decisions that depend on model-governance outcomes

This phase should **not** absorb:

- durable async orchestration
- knowledge-ops ingest or OCR enhancement

### 4.2 Phase 10C: Evaluation Workbench Operations Depth

**Primary capability lane:** Evaluation And Verification Platform  
**Preferred route:** continue extending the current verification-ops stack

This phase should own:

- sample-set item detail depth
- evidence-pack history retrieval
- multi-run comparison views
- operator analytics over historical runs
- stronger benchmark, canary, and release-facing verification surfaces

This phase should **not** absorb:

- core knowledge-ingest operations
- general worker orchestration

### 4.3 Phase 10D: Medical Knowledge Ops Deepening

**Primary capability lane:** Medical Knowledge Ops  
**Preferred route:** Yuxi-style knowledge-ops and backstage-workbench reference, implemented inside the repository's own governance surface

This phase should own:

- richer knowledge draft and review operations
- bulk ingest and bulk review support
- deduplication
- expiry and supersession governance
- periodic review workflow
- operator-facing knowledge workbench depth
- optional specialized annotation adapter boundaries when needed

This phase should **not** absorb:

- the retrieval engine internals of Phase 10E
- full production-security hardening of later phases

### 4.4 Phase 10E: Retrieval Stack Completion

**Primary capability lane:** Knowledge Retrieval Stack  
**Preferred route:** `PostgreSQL + pgvector`

This phase should own:

- vector embedding storage and retrieval
- hybrid retrieval over structured, full-text, and vector signals
- reranking
- template knowledge-pack recall
- retrieval-quality evaluation assets and operator checks

This phase should **not** absorb:

- bulk knowledge ingest operations
- durable worker orchestration
- production deploy automation

### 4.5 Phase 10F: Agent Runtime And Portable Skill Platform Deepening

**Primary capability lane:** Agent Runtime Platform  
**Preferred route:** internal registry + adapter-based runtime integration inspired by `deepagents`, with packaging ideas borrowed from `agency-agents`

This phase should own:

- clearer runtime adapter boundaries
- portable prompt and skill package governance
- stronger MCP / tool gateway hardening
- sandbox policy maturity
- richer runtime and tool-permission governance
- deeper execution evidence capture tied to runtime boundaries

This phase should **not** absorb:

- long-running workflow orchestration
- production release automation

### 4.6 Phase 10G: Durable Execution Orchestration

**Primary capability lane:** Execution And Orchestration Platform  
**Preferred route:** `Temporal` remains the current preferred orchestration route

This phase should own:

- durable async task orchestration
- retries and recovery semantics
- restart-safe long-running flow handling
- queue-state and incident-friendly execution observability
- stronger separation between business completion and orchestration completion

This phase should **not** absorb:

- secret-management hardening
- OCR or privacy-gate work

### 4.7 Phase 10H: Production Hardening, Secrets, Upgrade, And Migration Automation

**Primary capability lane:** Production Operations And Security Platform  
**Preferred route:** build on `Phase 10A`'s repo-owned release contract

This phase should own:

- deploy automation and standardization
- monitoring and post-deploy operating discipline
- rollback automation and recovery drills
- remote-maintenance standardization depth
- secret and key management hardening
- upgrade choreography
- platform and environment migration automation

This phase should **not** absorb:

- retrieval-stack completion
- model-routing governance deepening

### 4.8 Phase 10I: Privacy, Academic Structure, And OCR Enhancement

**Primary capability lane:** Privacy / Compliance Gate plus Academic Structure And OCR Enhancement  
**Preferred route:** `Presidio` for privacy gating, `OCRmyPDF + PaddleOCR + GROBID` for academic structure enhancement

This phase should own:

- privacy and de-identification gates in governed flows
- auditable privacy-check evidence
- scanned PDF enhancement
- academic-structure parsing
- parser-confidence and fallback handling
- downstream structured outputs that later retrieval and review flows can consume

This phase should **not** absorb:

- deployment automation
- durable workflow orchestration

## 5. Recommended Sequence

The repository does not need to execute every future phase immediately.
It does need a sequence that matches current maturity.

Recommended sequencing after `Phase 10A`:

1. `Phase 10B` to deepen model-governance and routing decisions around the already-live evaluation and runtime-binding surfaces
2. `Phase 10C` to deepen Evaluation Workbench operations while the current governed-run path is still fresh and bounded
3. `Phase 10D` to deepen medical knowledge operations and make the knowledge layer more production-usable
4. `Phase 10E` to complete the retrieval substrate that the knowledge layer ultimately depends on
5. `Phase 10F` to deepen runtime portability and skill packaging once the near-term governance path is clearer
6. `Phase 10G` to introduce durable orchestration after the current inline governed-run model has been fully pressure-tested
7. `Phase 10H` to harden production automation on top of the `Phase 10A` baseline
8. `Phase 10I` to formalize privacy and academic-structure enhancement without diluting the earlier platform-core phases

This sequence is recommended, not irreversible.
What is fixed is the capability ownership, not the exact calendar.

## 6. What This Mapping Prevents

After this document lands:

- `Phase 10A` should no longer be expanded into a generic "finish production" bucket
- `pgvector`, Yuxi-style knowledge ops, `deepagents`-inspired runtime adaptation, `Temporal`, `Presidio`, `OCRmyPDF`, `PaddleOCR`, and `GROBID` all have a documented future landing zone
- already-landed Phase 5 / 7 / 8 / 9 work is recognized as partial platform delivery rather than ignored
- future contributors have a concrete answer to "which phase owns the rest of this capability?"

## 7. Governance Rule For Future Phase Authoring

Any future phase proposal touching the above capability lines should state all of the following:

1. which retained capability lane it advances
2. which already-landed phases it builds on
3. which preferred implementation route it is following or replacing
4. what remains explicitly out of scope for the next adjacent lane

This is the guardrail that keeps future phase boundaries clean.

## 8. Related Documents

- `2026-04-03-tooling-capability-review-decision.md`
- `2026-04-03-phase10a-production-operations-baseline-design.md`
- `2026-04-03-phase-boundary-index.md`
- `2026-04-03-phase4-7b-8-boundary-reconciliation.md`
- `04-knowledge-learning-and-retrieval.md`
- `05-ai-model-routing-and-evaluation.md`
- `06-pdf-consistency-and-ocr.md`
- `08-security-auth-and-compliance.md`
- `09-platform-ops-migration-and-maintenance.md`
- `11-agent-runtime-and-portable-skills.md`
