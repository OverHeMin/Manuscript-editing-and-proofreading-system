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
| Agent Runtime Platform | Phase 4, Phase 8G, Phase 8H, Phase 9R, Phase 11A, Phase 11B, Phase 11C, Phase 11D, Phase 11E, `11-agent-runtime-and-portable-skills.md` | Registry, runtime binding, tool permission policy, readiness observation, execution-resolution visibility, governed-agent-context visibility, execution-log visibility, execution-snapshot visibility, admin governance visibility, and execution evidence are already partially live | Deeper adapter-based runtime integration, portable skill-package operations, richer sandbox governance, stronger MCP / tool gateway platform boundary |
| Evaluation And Verification Platform | Phase 6A, Phase 8W, Phase 9A, Phase 9Q, Phase 9R, Phase 9S, Phase 9T | Evaluation Workbench, run persistence, governed-source runs, machine evidence, and release-gate verification are already real | Sample-set detail depth, historical evidence-pack retrieval, multi-run comparison, operator analytics, stronger release-facing analysis surfaces |
| Execution And Orchestration Platform | Phase 4 execution governance foundations, Phase 8F, Phase 8I, Phase 9R, Phase 10J-10W, Phase 11F, Phase 11G, Phase 12, Phase 13, current execution-governance records | The repo now has governed execution resolution, durable follow-up orchestration, bounded retries, restart-safe recovery, read-only backlog inspection, residual observation, per-log completion settlement visibility, per-log recovery posture visibility, durable snapshot-to-log evidence linkage, and additive manuscript/job mainline settlement visibility | Deeper workflow-engine substitution, richer queue ownership and scheduling depth, `Temporal`-class orchestration depth |
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

### 4.8 Phase 10J Through Phase 10W: Durable Execution Orchestration Mainline

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
- `10U`: additive JSON contract metadata for stable machine-readable replay and inspection consumption
- `10V`: additive boot-time residual observation aligned with the same read-only readiness model after enabled recovery passes
- `10W`: additive post-replay residual observation for human recovery output in the same scoped lane, without widening the stabilized json contract

Together these phases now own:

- durable post-business follow-up orchestration
- retries and recovery semantics
- restart-safe replay handling
- stronger separation between business completion and orchestration completion
- repo-owned queue-state observability through read-only inspection
- exact read-only preview of the next bounded replay slice before mutation
- clearer read-only recovery-state timing for when blocked work becomes replayable next
- summary-level glanceability for immediate replay posture and next blocked readiness time
- stronger local-first machine-consumption stability for replay and inspection json output
- better restart-time residual posture evidence immediately after boot recovery, without introducing new mutation authority
- better manual replay-time residual posture evidence in the same scoped lane, without changing replay semantics or widening json

These phases still do **not** claim full `Temporal`-class workflow depth.
Deeper multi-node orchestration, hosted schedulers, and broader workflow-engine
substitution remain future work inside the same capability lane.

### 4.9 Phase 11A: Runtime Binding Readiness Preflight

**Primary capability lane:** Agent Runtime Platform
**Actual landed scope:** additive, read-only readiness reporting for runtime bindings and active governed scope resolution

This phase now owns:

- binding-level readiness inspection by id
- active-scope readiness inspection for `module + manuscript type + template family`
- dependency-state reporting for runtime, sandbox, agent profile, tool policy, prompt, skill, verification, and release-check references
- execution-profile alignment and drift reporting for the governed mainline

This phase does **not** absorb:

- activation hard gates
- runtime auto-repair
- new workbench or control-plane behavior
- deeper portable-skill package lifecycle work

### 4.10 Phase 11B: Execution Resolution Runtime Binding Readiness

**Primary capability lane:** Agent Runtime Platform  
**Actual landed scope:** additive fail-open runtime-binding readiness observation on the existing `execution-governance/resolve` bundle

This phase now owns:

- readiness observation attached directly to the governed execution-resolution read path
- explicit distinction between `reported` readiness observations and `failed_open` observation failures
- one-bundle visibility into resolved execution profile, resolved assets, model selection, knowledge scope, and active binding posture

This phase does **not** absorb:

- new resolve gating or activation requirements
- runtime binding mutation authority
- execution behavior changes
- new workbench, console, or control-plane surfaces

### 4.11 Phase 11C: Governed Agent Context Runtime Binding Readiness

**Primary capability lane:** Agent Runtime Platform  
**Actual landed scope:** additive fail-open runtime-binding readiness observation on the governed agent-context resolver and current mainline caller wiring

This phase now owns:

- readiness observation attached directly to the governed agent-context read path
- fail-open readiness visibility for execution-facing runtime, sandbox, agent, tool, verification, and evaluation references
- optional readiness-service wiring through current screening, editing, proofreading, and governed retrieval context callers

This phase does **not** absorb:

- new execution gates
- new agent-context routes
- execution log or snapshot schema changes
- new workbench or control-plane surfaces

### 4.12 Phase 11D: Agent Execution Runtime Binding Readiness

**Primary capability lane:** Agent Runtime Platform  
**Actual landed scope:** additive fail-open runtime-binding readiness observation on the existing `agent-execution` create/get/list/complete read path

This phase now owns:

- readiness observation attached directly to the execution-log API view
- fail-open visibility into current binding posture while reading execution evidence
- runtime wiring for the same observation in both demo and persistent HTTP runtimes without storage changes

This phase does **not** absorb:

- execution-log schema or migration changes
- orchestration behavior changes
- launch-time persisted readiness snapshots
- new workbench or control-plane surfaces

### 4.13 Phase 11E: Execution Tracking Runtime Binding Readiness

**Primary capability lane:** Agent Runtime Platform
**Actual landed scope:** additive fail-open runtime-binding readiness observation on the existing `execution-tracking` snapshot create/get read path

This phase now owns:

- readiness observation attached directly to the snapshot API view
- fail-open visibility into current active binding posture while reading frozen execution snapshot evidence
- scope derivation from the persisted `execution_profile_id` without changing snapshot persistence or knowledge-hit storage

This phase does **not** absorb:

- snapshot schema or migration changes
- launch-time persisted readiness snapshots
- knowledge-hit log storage changes
- new workbench or control-plane surfaces

### 4.14 Phase 11F: Agent Execution Completion Summary

**Primary capability lane:** Execution And Orchestration Platform
**Actual landed scope:** additive derived `completion_summary` on the existing `agent-execution` create/get/list/complete read path

This phase now owns:

- direct read-model visibility into whether business execution is still in progress, failed, business-complete but follow-up-open, or fully settled
- one stable settlement contract on the existing execution-log API view so consumers do not need to re-implement `status + orchestration_status` interpretation
- demo and persistent HTTP exposure of the same derived summary without route or persistence changes

This phase does **not** absorb:

- orchestration state-machine changes
- replay or recovery algorithm changes
- execution-log schema or migration changes
- new workbench or control-plane surfaces

### 4.15 Phase 11G: Agent Execution Recovery Summary

**Primary capability lane:** Execution And Orchestration Platform
**Actual landed scope:** additive derived `recovery_summary` on the existing `agent-execution` create/get/list/complete read path

This phase now owns:

- direct read-model visibility into whether a log is recoverable now, stale-running, retry-deferred, terminally attention-required, or not recoverable
- one stable per-log recovery posture contract on the existing execution-log API view so callers do not need a separate backlog inspection call for single-log readiness
- demo and persistent HTTP exposure of the same derived summary without route or persistence changes

This phase does **not** absorb:

- orchestration replay, ownership, or scheduling changes
- recovery algorithm or focus-order changes
- execution-log schema or migration changes
- new workbench or control-plane surfaces

### 4.16 Phase 12: Durable Execution Evidence Linkage

**Primary capability lane:** Execution And Orchestration Platform
**Actual landed scope:** additive snapshot-to-log durable linkage on the existing `execution-tracking` create/get read path

This phase now owns:

- durable persistence of the optional `agent_execution_log_id` on `execution_snapshots`
- snapshot read-model visibility into the linked execution log's current `status`, `orchestration_status`, `completion_summary`, and `recovery_summary`
- a stable frozen-business-evidence to live-orchestration-evidence bridge without adding new routes or replay authority
- demo and persistent HTTP exposure of the same additive linked observation without changing business completion semantics

This phase does **not** absorb:

- orchestration replay, ownership, or scheduling changes
- execution-log settlement algorithm changes
- new workbench, console, or control-plane surfaces
- snapshot-side materialization of mutable orchestration state

### 4.17 Phase 13: Manuscript Mainline Settlement View

**Primary capability lane:** Execution And Orchestration Platform
**Actual landed scope:** additive per-module settlement visibility on the existing manuscript and job read paths

This phase now owns:

- manuscript-level `screening / editing / proofreading` execution overview on the existing `GET /manuscripts/:id` route
- job-level additive execution-tracking settlement visibility on the existing `GET /jobs/:id` route
- direct mainline visibility into the difference between latest attempt state and latest frozen business snapshot evidence
- fail-open reuse of the current snapshot and linked agent-execution read models without adding a new route surface

This phase does **not** absorb:

- new ledger or timeline routes
- orchestration replay, ownership, or scheduling changes
- manuscript/job schema changes
- new control-plane or workbench authority

### 4.18 Phase 14: Manuscript Workbench Settlement Adoption

**Primary capability lane:** Execution And Orchestration Platform
**Actual landed scope:** read-only adoption of the existing settlement read model inside the current manuscript workbench summary

This phase now owns:

- workbench-side consumption of manuscript `module_execution_overview`
- workbench-side consumption of job `execution_tracking`
- settlement-first operator guidance on the existing manuscript summary path, with fail-open fallback to the prior heuristic asset/job view
- compact visibility into per-module business-versus-orchestration posture without introducing a new workbench surface

This phase does **not** absorb:

- new manuscript or job routes
- orchestration replay, ownership, or scheduling changes
- new workbench pages, panels, or routing authority
- mutation/control-plane expansion beyond the existing workbench actions

### 4.19 Phase 15: Manuscript Workbench Restart-Safe Execution Hydration

**Primary capability lane:** Execution And Orchestration Platform
**Actual landed scope:** best-effort latest-job restoration on the existing manuscript workbench load path using current manuscript/job routes only

This phase now owns:

- restart-safe restoration of the newest mainline tracked job during workbench reload
- best-effort hydration of `execution_tracking` through the existing `GET /jobs/:id` read path
- fail-open fallback to manuscript-side latest-job overview when tracked hydration is unavailable
- operator-visible continuation of durable business-versus-orchestration context after refresh or handoff re-entry

This phase does **not** absorb:

- new backend routes or job-list APIs
- replay, ownership, scheduling, or queue-state changes
- new workbench pages, panels, or routing authority
- new mutation/control-plane behavior

### 4.20 Phase 16: Manuscript Workbench Recovery And Readiness Posture Adoption

**Primary capability lane:** Execution And Orchestration Platform
**Actual landed scope:** read-only adoption of linked recovery posture and
runtime-binding readiness into the existing manuscript workbench summary and
load-result path

This phase now owns:

- workbench-side explanation of linked execution recovery posture after restart-
  safe latest-job restoration
- workbench-side explanation of runtime-binding readiness posture on existing
  manuscript and latest-job cards
- posture-aware read-only guidance details for unsettled follow-up without
  adding replay or routing authority
- tighter frontend adoption of the existing execution-tracking read model
  without backend route changes

This phase does **not** absorb:

- replay, retry, or queue-state mutation
- runtime binding mutation or activation authority
- new workbench pages, panels, or dashboards
- new control-plane behavior beyond the existing summary path

### 4.21 Phase 17: Manuscript Workbench Action-Time Execution Hydration

**Primary capability lane:** Execution And Orchestration Platform
**Actual landed scope:** best-effort hydration of returned workbench action jobs
through the existing `GET /jobs/:id` read path

This phase now owns:

- action-time adoption of hydrated `execution_tracking` on upload, module-run,
  proofreading-finalize, and human-final-publish flows
- alignment between reload-time restored latest-job posture and immediate
  post-action latest-job posture
- one controller-local fail-open adapter so action success still stands when
  hydration reads fail

This phase does **not** absorb:

- backend route or persistence changes
- new job list APIs
- new workbench pages, panels, or dashboards
- replay, retry, routing, or runtime mutation authority

### 4.22 Phase 18: Manuscript Workbench Action Result Posture Adoption

**Primary capability lane:** Execution And Orchestration Platform
**Actual landed scope:** read-only adoption of hydrated job posture into the
existing `Latest Action Result` card for job-bearing workbench actions

This phase now owns:

- action-result visibility for hydrated settlement, recovery, and runtime
  readiness posture on upload, module-run, proofreading-finalize,
  human-final-publish, and refresh-latest-job flows
- reuse of the current workbench posture formatters so action-time and
  reload-time operator guidance stay aligned
- fail-open preservation of base action details when posture observations are
  missing or unavailable

This phase does **not** absorb:

- backend route or persistence changes
- action-history persistence or new result panels
- replay, retry, routing, or runtime mutation authority

### 4.23 Phase 19: Manuscript Workbench Refresh-Time Workspace Resynchronization

**Primary capability lane:** Execution And Orchestration Platform
**Actual landed scope:** best-effort workspace reload after the existing
`Refresh Latest Job` path succeeds

This phase now owns:

- refresh-time resynchronization of manuscript overview and recommendation
  surfaces with refreshed job posture
- reuse of the existing `loadJob` and `loadWorkspace` read paths only
- fail-open preservation of refreshed latest-job observation when workspace
  reload is temporarily unavailable

This phase does **not** absorb:

- backend route or persistence changes
- new refresh controls, panels, or dashboards
- replay, retry, routing, or runtime mutation authority

### 4.24 Phase 20: Manuscript Workbench Latest-Job Fallback Guidance

**Primary capability lane:** Execution And Orchestration Platform
**Actual landed scope:** recommendation fallback adoption from hydrated
latest-job execution tracking inside the existing manuscript workbench summary

This phase now owns:

- overview-missing or overview-failed-open fallback guidance from hydrated
  latest-job `execution_tracking`
- posture-aware screening/editing recommendation details for settled,
  follow-up-pending, retryable, failed, unlinked, and in-progress job states
- preservation of the current raw status heuristic as the final fail-open
  fallback when execution tracking is unavailable

This phase does **not** absorb:

- backend route or persistence changes
- controller or request choreography changes
- new workbench panels, pages, or dashboards
- replay, retry, routing, or runtime mutation authority

### 4.25 Still-Open Retained Capability Lanes After Phase 20

After reconciling actual landed numbering through `Phase 20`, three retained capability lanes remain
explicitly open and should receive fresh future labels instead of being
silently mapped back onto already-used phase numbers:

- broader `Medical Knowledge Ops` deepening beyond the harness/gold-set bridge
- broader `Agent Runtime Platform` and portable skill-package deepening beyond `11A-11E` readiness observation slices
- broader `Execution And Orchestration Platform` deepening beyond `10J-10W`, `11F-11G`, `Phase 12`, `Phase 13`, `Phase 14`, `Phase 15`, `Phase 16`, `Phase 17`, `Phase 18`, `Phase 19`, and `Phase 20` workbench adoption slices

This means the capability lanes remain open, but `Phase 11` itself does not.
`Phase 12` is now the first such fresh post-`11` label for the execution/orchestration lane.
Any future work on those lanes should continue with fresh adjacent labels rather
than continuing with `11H+` or trying to reopen the closed `Phase 10` stream.

## 5. Recommended Sequence

The repository has now landed the following actual sequence after `10A`:

1. `10B` model-governance and routing linkage
2. `10C` evaluation workbench operations depth
3. `10D-10F` harness/governed-dataset/retrieval-support work
4. `10G-10H` production-hardening continuation
5. `10I` privacy / OCR advisory baseline
6. `10J-10W` durable execution-orchestration mainline
7. `11A` runtime-binding readiness preflight under the fresh runtime-platform lane
8. `11B` execution-resolution runtime-binding readiness under the same additive runtime-platform lane
9. `11C` governed-agent-context runtime-binding readiness under the same additive runtime-platform lane
10. `11D` agent-execution runtime-binding readiness under the same additive runtime-platform lane
11. `11E` execution-tracking runtime-binding readiness under the same additive runtime-platform lane
12. `11F` agent-execution completion summary under a fresh adjacent execution/orchestration label
13. `11G` agent-execution recovery summary under the same fresh adjacent execution/orchestration label
14. `Phase 12` durable execution evidence linkage under the next fresh execution/orchestration label
15. `Phase 13` manuscript/job mainline settlement visibility under the same fresh execution/orchestration continuation
16. `Phase 14` manuscript workbench settlement adoption under the same fresh execution/orchestration continuation
17. `Phase 15` manuscript workbench restart-safe execution hydration under the same fresh execution/orchestration continuation
18. `Phase 16` manuscript workbench recovery/readiness posture adoption under the same fresh execution/orchestration continuation
19. `Phase 17` manuscript workbench action-time execution hydration under the same fresh execution/orchestration continuation
20. `Phase 18` manuscript workbench action-result posture adoption under the same fresh execution/orchestration continuation
21. `Phase 19` manuscript workbench refresh-time workspace resynchronization under the same fresh execution/orchestration continuation
22. `Phase 20` manuscript workbench latest-job fallback guidance under the same fresh execution/orchestration continuation

The practical planning implication after `11G` is:

- keep using actual landed phase numbers as the source of truth
- do not pretend `10D`, `10F`, or `10G` still own the broader lanes originally predicted here
- assign any remaining retained capability line a fresh adjacent label when it becomes active again
- treat `Phase 10` itself as closed through `10W`, so any further orchestration
  deepening or new retained-capability work opens under a new phase label
- treat `Phase 11` itself as closed through `11G`, so any further runtime-platform
  or execution/orchestration deepening also opens under a fresh post-`11` label
- treat `11A-11E` as narrow runtime-platform safety/visibility slices, not as
  permission to reopen workbench or control-plane expansion under the same lane
- treat `11F-11G` as narrow execution/orchestration read-model slices, not as
  permission to reopen replay, recovery, or queue-control expansion without a
  new fresh label
- treat `Phase 12` as a durable evidence-linkage slice in that same lane, not as
  permission to reopen replay controls, workflow-engine substitution, or control-plane growth under the same label
- treat `Phase 13` as a mainline settlement-visibility slice in that same lane,
  not as permission to introduce new ledger routes, route-level mutation authority, or broader UI/control-plane expansion under the same label
- treat `Phase 14` as a workbench-adoption slice in that same lane, not as
  permission to create a new settlement panel, expand routing authority, or
  reopen control-plane growth under the same label
- treat `Phase 15` as a restart-safe reload slice in that same lane, not as
  permission to add new job-list APIs, new workbench panels, or any replay /
  queue-control authority under the same label
- treat `Phase 16` as a read-only posture-adoption slice in that same lane, not
  as permission to add recovery controls, readiness gates, or any new
  workbench/dashboard authority under the same label
- treat `Phase 17` as an action-time hydration-adoption slice in that same
  lane, not as permission to add backend route expansion, new job-list
  surfaces, or any replay/control-plane authority under the same label
- treat `Phase 18` as an action-result posture-adoption slice in that same
  lane, not as permission to add new result-history surfaces, backend route
  expansion, or any replay/control-plane authority under the same label
- treat `Phase 19` as a refresh-time workspace-resync slice in that same lane,
  not as permission to add new refresh controls, backend route expansion, or
  any replay/control-plane authority under the same label
- treat `Phase 20` as a recommendation-fallback adoption slice in that same
  lane, not as permission to add backend route expansion, new summary panels,
  or any replay/control-plane authority under the same label

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
