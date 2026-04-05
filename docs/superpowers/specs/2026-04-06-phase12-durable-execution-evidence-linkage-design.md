# Phase 12 Durable Execution Evidence Linkage Design

**Date:** 2026-04-06  
**Status:** Proposed for immediate implementation after Phase 11 closeout  
**Primary capability lane:** Execution And Orchestration Platform  
**Scope:** Close the durable evidence gap between `execution_snapshots` and `agent_execution_logs` so snapshot reads can show linked orchestration settlement and recovery posture without changing orchestration behavior, adding new routes, or widening control-plane authority.

## 1. Goal

`10J-10W` established the durable execution/orchestration baseline and `11F-11G`
made per-log settlement and recovery posture directly readable from the
`agent-execution` API surface.

One mainline gap still remains:

- business module paths already know the `agentExecutionLogId` that owns the
  governed follow-up lifecycle
- `execution_snapshots` do not persist that linkage today
- snapshot readers therefore cannot move from frozen business evidence to the
  linked orchestration state without stitching together separate evidence paths

In one sentence:

`Phase 12` should make `execution_snapshots` durably remember their linked
`agent_execution_log_id` and expose an additive fail-open linked execution
observation on the existing snapshot read path.

## 2. Why This Phase Exists

The execution snapshot is the main frozen evidence artifact for completed module
business output:

- template selection
- prompt version
- skill package versions
- model selection
- knowledge hits
- created assets

But the snapshot currently stops short of the orchestration chain that continues
after business completion:

- seeded evaluation follow-up may still be pending
- replay may later become retryable or stale-running
- settlement may become completed or terminally failed after the snapshot is
  written

That means the repository already has the evidence, but the evidence is not
durably linked across the boundary that matters most:

- business completion evidence lives on the snapshot
- orchestration completion evidence lives on the log

This phase closes that gap without turning snapshots into a new control plane.

## 3. Recommended Option

### Option A: Keep the current split and force readers to stitch snapshot and log manually

Pros:

- no schema work

Cons:

- durable evidence linkage remains missing
- snapshot readers still need a second lookup path and extra interpretation logic
- restart-safe traceability stays weaker than the current orchestration baseline

Not recommended.

### Option B: Persist the optional log id on snapshots and enrich snapshot reads with a fail-open linked execution observation

Pros:

- closes the durable evidence chain
- keeps route surface unchanged
- keeps orchestration behavior unchanged
- supports both frozen business evidence and current orchestration posture from one read path

Cons:

- requires one additive migration and small read-model wiring

Recommended.

### Option C: Materialize orchestration state into the snapshot itself

Pros:

- single frozen document

Cons:

- duplicates mutable orchestration state
- invites stale data and re-sync work
- widens persistence scope more than needed

Out of scope.

## 4. Hard Boundaries

### 4.1 Keep the manuscript mainline stable

This phase may:

- add one nullable snapshot column
- pass the log id from existing module services
- enrich existing snapshot create/get responses

It must not:

- change screening, editing, or proofreading business success semantics
- make harness or external tooling a synchronous dependency
- block business completion if linked execution observation fails

### 4.2 No new control plane

This phase must not add:

- new replay routes
- new queue controls
- new workbench or console surfaces
- any path that lets Evaluation Workbench or a new panel become routing control

### 4.3 Fail-open only

If the linked log cannot be loaded, snapshot reads must still succeed and return:

- the snapshot itself
- the persisted raw `agent_execution_log_id` when present
- an additive observation error marker

### 4.4 Local-first only

This phase must stay repository-local:

- no cloud dependency
- no hosted orchestration service
- no automatic model switching
- no automatic publish or learning writeback

## 5. Proposed Persistence Changes

Add one nullable column to `execution_snapshots`:

- `agent_execution_log_id text null`

Rules:

- the column is optional
- no foreign-key hard gate is required in this phase
- existing rows remain valid and readable
- writes that do not have a linked log id still succeed unchanged

## 6. Proposed Read Model Shape

Extend `ModuleExecutionSnapshotRecord` with:

- `agent_execution_log_id?: string`

Extend `ModuleExecutionSnapshotViewRecord` with:

- `agent_execution`

Recommended observation shape:

- `observation_status: "reported" | "not_linked" | "failed_open"`
- `log_id?: string`
- `log?: { id, status, orchestration_status, completion_summary, recovery_summary }`
- `error?: string`

Important details:

- the raw `agent_execution_log_id` remains part of the snapshot record
- the linked execution observation is additive only
- the linked view should reuse the current `11F/11G` completion and recovery
  summaries instead of inventing a second settlement contract

## 7. Write-Path Rules

### 7.1 Screening and editing

Both module services already create an execution log before recording the
snapshot. They should pass that log id directly into
`executionTrackingService.recordSnapshot(...)`.

### 7.2 Proofreading draft and final confirmation

Proofreading has two important cases:

- draft creation creates a new log and should persist that same log id onto the
  draft snapshot
- final confirmation reuses the draft execution log and should persist that same
  reused log id onto the final snapshot

This keeps the linked evidence chain stable across draft-to-final completion.

### 7.3 Missing linkage

If a caller does not provide `agentExecutionLogId`, snapshot persistence should
still succeed. The linked observation simply becomes `not_linked`.

## 8. Read-Path Rules

Snapshot create/get responses should enrich the existing view in this order:

1. clone and return snapshot arrays as today
2. keep runtime-binding readiness observation as today
3. if `agent_execution_log_id` is absent:
   - return `agent_execution.observation_status = "not_linked"`
4. if `agent_execution_log_id` is present and the service is available:
   - load the linked log
   - derive `completion_summary`
   - derive `recovery_summary`
   - return `observation_status = "reported"`
5. if service wiring or log lookup fails:
   - keep the snapshot response successful
   - return `observation_status = "failed_open"`
   - include the error string

## 9. Implementation Shape

To avoid a risky refactor:

- keep `execution-tracking-service.ts` responsible only for persistence
- keep `execution-tracking-api.ts` responsible for linked read-model enrichment
- reuse the existing `11F/11G` derivation logic through a small shared
  agent-execution read-model helper rather than duplicating settlement logic

This stays additive and avoids changing orchestration core services.

## 10. Testing Expectations

Phase 12 should prove all of the following:

- snapshots persist `agent_execution_log_id` in memory and PostgreSQL
- screening, editing, and proofreading snapshot creation paths actually pass the
  linked log id
- snapshot create/get responses expose linked execution settlement and recovery
  summaries when the log exists
- snapshot reads fail open when the linked log is unavailable
- older or manually written snapshots without a linked log id still read
  successfully as `not_linked`

## 11. Out Of Scope

Phase 12 does not include:

- new replay or recovery commands
- queue scheduling changes
- new control-plane UI
- snapshot list endpoints
- orchestration state-machine changes
- auto-repair between orphaned snapshots and logs
- hosted workflow engines or Temporal-class orchestration substitution

## 12. Related Capability Ownership

This phase advances the still-open broader `Execution And Orchestration Platform`
lane after:

- `2026-04-05-phase10j-durable-execution-orchestration-baseline-design.md`
- `2026-04-05-phase10w-governed-orchestration-post-recovery-residual-observation-design.md`
- `2026-04-06-phase11f-agent-execution-completion-summary-design.md`
- `2026-04-06-phase11g-agent-execution-recovery-summary-design.md`

It intentionally stays out of:

- runtime-platform readiness expansion
- workbench/control-plane expansion
- production-ops lane work
