# Phase 13 Manuscript Mainline Settlement View Design

**Date:** 2026-04-06  
**Status:** Proposed for immediate implementation after Phase 12  
**Primary capability lane:** Execution And Orchestration Platform  
**Scope:** Extend the existing manuscript and job read paths with additive, read-only settlement visibility so operators can inspect per-module business completion versus orchestration completion from the mainline surface without adding a new control plane.

## 1. Goal

`10J-10W` established durable orchestration, `11F-11G` made per-log settlement
and recovery readable, and `12` closed the durable snapshot-to-log evidence gap.

One mainline visibility gap still remains:

- `GET /manuscripts/:id` still returns only the manuscript core record
- `GET /jobs/:id` still returns only the raw job record
- readers can inspect settlement only by manually stitching together
  `jobs -> snapshot ids -> linked execution log -> completion/recovery`

In one sentence:

`Phase 13` should make the existing manuscript and job read paths expose a
stable, additive mainline settlement view for `screening`, `editing`, and
`proofreading`.

## 2. Why This Phase Exists

The repository now has the required durable evidence pieces:

- jobs record the latest attempt state
- snapshots freeze business execution evidence
- linked execution logs carry follow-up orchestration settlement and recovery

But those pieces are still awkward to consume from the mainline:

- the latest job may be running or failed while an older successful snapshot
  still exists
- the latest snapshot may show business completion while orchestration is still
  pending or retryable
- manuscript readers cannot see that distinction directly on the mainline read
  path

This phase closes that gap by adding a read model, not a new workflow engine.

## 3. Options Considered

### Option A: Enrich `GET /jobs/:id` only

Pros:

- smallest implementation
- no manuscript aggregation work

Cons:

- does not solve mainline manuscript visibility
- callers still need extra lookups to understand per-module posture

Not recommended.

### Option B: Enrich existing manuscript and job read paths with additive settlement views

Pros:

- no new route surface
- surfaces per-module settlement directly where operators already look
- preserves existing business and orchestration contracts
- closes the practical "broader per-stage settlement visibility" gap

Cons:

- requires a small repository/service aggregation layer

Recommended.

### Option C: Add a new manuscript execution ledger route

Pros:

- strongest timeline expressiveness

Cons:

- adds a new surface area
- is easier to grow into a new control plane
- exceeds the current "mainline settlement visibility" need

Out of scope.

## 4. Hard Boundaries

### 4.1 No orchestration behavior changes

This phase may:

- add read-only repository query helpers
- derive per-module settlement summaries
- enrich existing route responses

It must not:

- change retry, recovery, or ownership semantics
- change business completion rules
- add queue mutation, replay controls, or dispatch authority

### 4.2 Existing route surface only

This phase should work through:

- `GET /api/v1/manuscripts/:manuscriptId`
- `GET /api/v1/jobs/:jobId`

It must not add:

- new orchestration routes
- new control-plane routes
- new workbench-only authority paths

### 4.3 Fail-open only

If manuscript/job settlement aggregation cannot fully load:

- the manuscript or job read still succeeds
- existing base fields still return
- the additive settlement observation degrades to `failed_open`

### 4.4 Local-first only

This phase remains:

- repository-local
- PostgreSQL/demo compatible
- free of cloud schedulers or hosted workflow dependencies

## 5. Proposed Read-Model Additions

### 5.1 Manuscript view

Extend the current manuscript response with:

- `module_execution_overview`

Recommended shape:

- `screening`
- `editing`
- `proofreading`

Each module overview should include:

- `module`
- `observation_status: "reported" | "not_started" | "failed_open"`
- `latest_job?: JobRecord`
- `latest_snapshot?: ModuleExecutionSnapshotViewRecord`
- `settlement?: ModuleMainlineSettlementRecord`
- `error?: string`

Important semantics:

- `latest_job` means the most recently updated job for that manuscript/module
- `latest_snapshot` means the most recently created snapshot for that
  manuscript/module
- these two values may point to different attempts, and that distinction should
  stay visible

### 5.2 Job view

Extend the current job response with:

- `execution_tracking`

Recommended shape:

- `observation_status: "reported" | "not_tracked" | "failed_open"`
- `snapshot?: ModuleExecutionSnapshotViewRecord`
- `settlement?: ModuleMainlineSettlementRecord`
- `error?: string`

Important semantics:

- if the job payload contains a `snapshotId`, use that exact snapshot first
- if the job has no snapshot linkage, return `not_tracked`
- the job record remains the source of attempt status; the additive settlement
  view explains business-vs-orchestration posture when a snapshot exists

### 5.3 Settlement summary contract

Add one small read-only summary shared by manuscript-module and job views:

- `derived_status`
- `business_completed`
- `orchestration_completed`
- `attention_required`
- `reason`

Recommended derived statuses:

- `not_started`
- `job_in_progress`
- `job_failed`
- `business_completed_unlinked`
- `business_completed_follow_up_pending`
- `business_completed_follow_up_running`
- `business_completed_follow_up_retryable`
- `business_completed_follow_up_failed`
- `business_completed_settled`

Derivation rules:

- no job and no snapshot => `not_started`
- latest job running/queued and no snapshot => `job_in_progress`
- latest job failed and no snapshot => `job_failed`
- snapshot exists without linked execution => `business_completed_unlinked`
- snapshot linked to execution log uses the existing `completion_summary` and
  `recovery_summary` semantics from `11F-11G`

## 6. Repository And Service Shape

To keep risk low:

- add `listByManuscriptId(...)` to `JobRepository`
- add `listSnapshotsByManuscriptId(...)` to `ExecutionTrackingRepository`
- add one manuscript read-model helper/service inside the manuscript module
- reuse the current snapshot API enrichment and `agent-execution-view`
  derivation logic instead of inventing new orchestration rules

This keeps mutation services untouched.

## 7. Read-Path Rules

### 7.1 Manuscript view

When reading a manuscript:

1. load the base manuscript as today
2. load jobs for that manuscript
3. load snapshots for that manuscript
4. group both by `screening`, `editing`, and `proofreading`
5. choose:
   - latest job by `updated_at desc, id desc`
   - latest snapshot by `created_at desc, id desc`
6. enrich the latest snapshot through the existing execution-tracking snapshot
   view logic
7. derive one settlement summary per module
8. if aggregation fails for a module, mark only that module as `failed_open`

### 7.2 Job view

When reading a job:

1. load the base job as today
2. look for `payload.snapshotId`
3. if absent, return `execution_tracking.observation_status = "not_tracked"`
4. if present, load and enrich that snapshot through the existing snapshot
   read-model
5. derive settlement from the job status plus the enriched snapshot
6. if enrichment fails, keep the job response successful and mark
   `failed_open`

## 8. Testing Expectations

Phase 13 should prove all of the following:

- manuscript reads expose `module_execution_overview` for the three mainline
  modules
- modules with no jobs or snapshots return `not_started`
- modules with a newer failed/running job and an older successful snapshot keep
  both pieces visible without collapsing them into one fake status
- job reads expose snapshot-linked settlement when `payload.snapshotId` exists
- manuscript and job settlement views fail open when snapshot or log enrichment
  throws
- demo and persistent HTTP runtimes expose the same additive read model

## 9. Out Of Scope

Phase 13 does not include:

- new routes
- queue or replay controls
- manuscript/job schema changes
- new workbench panels
- orchestration state-machine changes
- automatic repair of missing job payload snapshot references
- broader workflow-engine substitution

## 10. Related Capability Ownership

This phase advances the broader still-open `Execution And Orchestration Platform`
lane by adding mainline per-stage settlement visibility on top of the durable
evidence chain already established through `10J-10W`, `11F-11G`, and `12`,
without reopening control-plane scope.
