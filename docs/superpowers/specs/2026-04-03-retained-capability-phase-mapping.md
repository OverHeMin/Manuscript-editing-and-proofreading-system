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

## 4. Reconciled Phase Ownership

The next step is not to reopen the retained-capability decision.
The next step is to keep the capability ownership mapping aligned with the
actual numbered phases that have now landed.

The original recommendation below `10A` was written before the later `10D-10N`
delivery sequence was finalized.
That means some capability lanes were later split differently in the real
repository than this document first predicted.

The reconciled ownership below reflects the actual landed `Phase 10` sequence.
When a retained capability is still open after `10N`, this document should say
so explicitly rather than pretending an already-used label still owns it.

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

### 4.3 Phase 10D: Gold Set And Harness Ops

**Primary capability lane:** Harness dataset governance on top of existing human-reviewed assets  
**Actual landed scope:** gold-set families, gold-set versions, rubric definitions, and local harness dataset publication

This phase now owns:

- gold-set curation from governed reviewed assets
- rubric definition and publication
- reusable local harness dataset publication history
- an additive operator lane for harness-ready editorial reference assets

This phase does **not** fully satisfy the broader retained `Medical Knowledge Ops`
deepening lane.
That larger capability remains open after `10N` and needs a fresh future phase
label rather than reuse of `10D`.

### 4.4 Phase 10E: Retrieval Stack Completion

**Primary capability lane:** Knowledge Retrieval Stack  
**Actual landed scope:** `PostgreSQL + pgvector`, retrieval snapshots, template knowledge-pack recall, and local retrieval-quality evaluation

This phase owns:

- vector embedding storage and retrieval
- hybrid retrieval over structured, full-text, and vector signals
- reranking
- template knowledge-pack recall
- retrieval-quality evaluation assets and operator checks

This phase does **not** absorb:

- bulk knowledge ingest operations
- durable execution orchestration
- production deploy automation

### 4.5 Phase 10F: Local-First Harness Adapter Platform

**Primary capability lane:** local-first optional harness adapter boundaries  
**Actual landed scope:** self-hosted tracing, local prompt-eval adapters, local judge-reliability calibration, and fail-open harness isolation

This phase owns:

- optional harness adapter boundaries
- self-hosted trace sink integration
- local prompt-eval and judge adapter execution
- fail-open tool isolation so harness tooling stays outside the manuscript sync path

This phase does **not** fulfill the broader retained `Agent Runtime Platform`
deepening lane by itself.
That runtime/portable-skill capability remains open after `10N` and needs a new
future label rather than backfilling `10F`.

### 4.6 Phase 10G And Phase 10H: Production Hardening Continuation

**Primary capability lane:** Production Operations And Security Platform  
**Actual landed scope:** `10G` hardens release and migration reliability, and `10H` continues the same lane with secret placeholder protection and upgrade-rehearsal guardrails

Together, `10A`, `10G`, and `10H` now own:

- release-contract hardening
- migration-doctor and manifest reliability gates
- secret placeholder protection
- upgrade-rehearsal proof
- bounded local-first production guardrails

These phases do **not** absorb:

- retrieval-stack completion
- model-routing governance deepening
- durable execution orchestration

### 4.7 Phase 10I: Privacy, Academic Structure, And OCR Enhancement

**Primary capability lane:** Privacy / Compliance Gate plus Academic Structure And OCR Enhancement  
**Actual landed scope:** worker-only advisory evidence for privacy prechecks and OCR / academic-structure readiness

This phase owns:

- local-first privacy precheck evidence
- local-first OCR / academic-structure readiness evidence
- additive worker-side advisory artifact history
- fail-open adapter boundaries for privacy and OCR tooling

This phase does **not** absorb:

- deployment automation
- durable execution orchestration

### 4.8 Phase 10J Through Phase 10T: Durable Execution Orchestration Mainline

**Primary capability lane:** Execution And Orchestration Platform  
**Actual landed scope:** the execution/orchestration lane was split into adjacent bounded slices instead of landing under the earlier predicted `10G` label

The current ownership is:

- `10J`: durable orchestration baseline
- `10K`: single-owner attempt claim guardrails
- `10L`: read-only dry-run backlog inspection
- `10M`: actionable focus ordering and bounded display limits
- `10N`: bounded scoped replay and inspection filters
- `10O`: bounded replay budgeting and scoped remaining-work summaries
- `10P`: budgeted replay alignment with existing recoverable priority ordering
- `10Q`: optional boot-recovery replay budgeting under the same fail-open semantics
- `10R`: read-only budgeted dry-run preview of the next exact replay window
- `10S`: normalized dry-run readiness windows for deferred retry and fresh-running reclaim timing
- `10T`: summary-level readiness rollup for immediate replay posture and earliest next-ready timing

Together these phases now own:

- durable post-business follow-up orchestration
- retries and recovery semantics
- restart-safe replay handling
- stronger separation between business completion and orchestration completion
- repo-owned queue-state observability through read-only inspection
- exact read-only preview of the next bounded replay slice before mutation
- clearer read-only recovery-state timing for when blocked work becomes replayable next
- summary-level glanceability for immediate replay posture and next blocked readiness time

These phases still do **not** claim full `Temporal`-class workflow depth.
Deeper multi-node orchestration, hosted schedulers, and broader workflow-engine
substitution remain future work inside the same capability lane.

### 4.9 Still-Open Retained Capability Lanes After 10T

After reconciling actual landed numbering, two retained capability lanes remain
explicitly open and should receive fresh future labels instead of being
silently mapped back onto already-used phase numbers:

- broader `Medical Knowledge Ops` deepening beyond the harness/gold-set bridge
- broader `Agent Runtime Platform` and portable skill-package deepening beyond the harness adapter boundary work

## 5. Recommended Sequence

The repository has now landed the following actual sequence after `10A`:

1. `10B` model-governance and routing linkage
2. `10C` evaluation workbench operations depth
3. `10D-10F` harness/governed-dataset/retrieval-support work
4. `10G-10H` production-hardening continuation
5. `10I` privacy / OCR advisory baseline
6. `10J-10Q` durable execution-orchestration mainline

The practical planning implication after `10T` is:

- keep using actual landed phase numbers as the source of truth
- do not pretend `10D`, `10F`, or `10G` still own the broader lanes originally predicted here
- assign any remaining retained capability line a fresh adjacent label when it becomes active again

## 6. What This Mapping Prevents

After this document lands:

- `Phase 10A` should no longer be expanded into a generic "finish production" bucket
- `pgvector`, harness adapters, durable execution recovery, `Presidio`, `OCRmyPDF`, `PaddleOCR`, and `GROBID` all have a reconciled landed ownership record
- already-landed Phase 5 / 7 / 8 / 9 work is recognized as partial platform delivery rather than ignored
- future contributors have a concrete answer to "which phase owns the rest of this capability?" without being misled by stale predicted numbering

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
