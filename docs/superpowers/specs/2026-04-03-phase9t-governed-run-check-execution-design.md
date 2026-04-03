# Phase 9T Governed Run Check Execution Design

**Date:** 2026-04-03  
**Status:** Approved for implementation under the current autonomous Phase 9 direction  
**Scope:** Take the governed evaluation runs seeded in Phase 9S and execute their configured verification checks immediately after successful governed module output, then write machine evidence back onto the run without auto-finalizing the recommendation.

## 1. Goal

Phase 9T closes the next gap after Phase 9S:

- let a governed module execution do more than seed a queued evaluation run
- immediately execute the verification checks implied by the seeded governed run
- persist machine-generated verification evidence onto that run
- advance the run out of `queued` so the operator can review a real machine-backed governance result in `Evaluation Workbench`

This slice is about automatic check execution and machine evidence writeback.

It is **not** about:

- auto-generating a final recommendation
- auto-creating synthetic sample-backed run items
- auto-scoring governed runs
- adding a background worker or retry queue

## 2. Current Gap

After Phase 9S, the repository already supports:

- runtime bindings carrying `verification_check_profile_ids`, `evaluation_suite_ids`, and an optional `release_check_profile_id`
- governed module execution persisting immutable verification expectations into `AgentExecutionLog`
- `verification-ops` seeding one `queued` governed run per active evaluation suite
- `Evaluation Workbench` reopening those governed runs through manuscript context and showing governed-source details

What is still missing is actual run execution:

- seeded governed runs remain stuck at `queued`
- no service expands the run into executable verification checks
- no machine evidence is recorded automatically
- the workbench still treats completion and finalization as one operator action, even though Phase 9S runs are now intended to exist before final recommendation

This leaves the governed path half-finished: the system can say which checks should happen, but it still depends on the operator to manually simulate the machine-verification step.

## 3. Options Considered

### Option A: Keep seeded runs manual and let operators record evidence themselves

Pros:

- smallest implementation surface
- no new orchestration path

Cons:

- defeats the purpose of seeding governed runs from real governed execution
- leaves `queued` runs as passive reminders rather than actual machine governance state
- keeps evidence quality inconsistent because every operator would recreate the machine step manually

Not recommended.

### Option B: Execute seeded governed run checks inline and synchronously

When a governed module execution successfully seeds one or more runs, immediately execute their configured verification checks in-process, record machine evidence, and complete each run as `passed` or `failed`.

Pros:

- directly closes the 9S loop with minimal new infrastructure
- keeps orchestration bounded to the real execution request that produced the governed output
- preserves deterministic operator mental model: successful module output produces seeded run, executed checks, and inspectable machine evidence in one flow
- avoids introducing jobs, leases, retries, and operational backlog management before the system needs them

Cons:

- increases latency of the successful module path
- failures are surfaced inline rather than retried asynchronously

Recommended.

### Option C: Add an async worker that executes seeded runs later

Pros:

- cleaner separation between business execution and verification runtime
- better long-term fit for heavy or flaky checks

Cons:

- requires job queue semantics, retry rules, stuck-run recovery, and visibility tooling that the repository does not currently have
- expands one bounded governance slice into an operations subsystem
- makes it harder to reason about when a freshly produced governed output is actually ready for operator review

Out of scope for Phase 9T.

## 4. Recommended Architecture

### 4.1 Internal orchestration service

Introduce a new internal orchestration entry point, for example:

```ts
executeSeededGovernedRunChecks(actorRole, {
  runId,
  manuscriptId,
  sourceModule,
  agentExecutionLogId,
  executionSnapshotId,
  outputAssetId,
})
```

This service is internal to the API layer. It is not a new public admin endpoint.

Responsibilities:

1. load the seeded run and verify it is still `queued`
2. resolve the run's suite and optional release check profile
3. expand the verification check plan for that run
4. mark the run `running`
5. execute each resolved check serially
6. record machine evidence through `recordVerificationEvidence(...)`
7. complete the run through `completeEvaluationRun(...)` as `passed` or `failed`

This keeps `verification-ops` as the canonical registry and persistence layer while placing orchestration in a separate boundary that can later evolve into a worker-backed implementation without rewriting the registry contracts.

### 4.2 Verification check plan resolution

For a seeded governed run, the execution plan should come from:

- `EvaluationSuite.verification_check_profile_ids`
- plus any additional `ReleaseCheckProfile.verification_check_profile_ids` when `release_check_profile_id` is present on the run

Execution planning rules:

- dedupe while preserving order
- validate that every referenced verification check profile still exists and is `published`
- execute shared check profile IDs only once even when referenced by both the suite and the release check profile
- keep `release_check_profile_id` on the run as configuration context rather than inventing a new evidence schema for release-only provenance

This means Phase 9T reuses the existing verification asset model rather than adding a second execution-specific graph.

### 4.3 Minimal check executor boundary

Because the repository does not already have a verification-check executor, Phase 9T should add a minimal internal boundary beneath the orchestration service:

```ts
executeGovernedVerificationCheck({
  run,
  checkProfile,
  governedSource,
})
```

The executor is responsible for one verification check profile at a time and returns the data needed for `recordVerificationEvidence(...)`, such as:

- `kind`
- `label`
- optional `uri`
- optional `artifactAssetId`
- optional failure summary

Initial supported check types remain the existing registry values:

- `browser_qa`
- `benchmark`
- `deploy_verification`

Phase 9T does not require a full plugin or workflow engine. A small internal dispatcher keyed by `check_type` is enough.

### 4.4 Run lifecycle

Seeded governed runs should now move through this lifecycle:

`queued -> running -> passed | failed`

Rules:

- `queued` means seeded but not yet executed
- `running` means the system has begun executing machine checks for that run
- `passed` means all resolved checks executed successfully and no machine check reported failure
- `failed` means at least one machine check explicitly failed or the orchestration path could not successfully finish the run

Phase 9T intentionally stops there.

`finalizeEvaluationRun()` remains a separate, manual operator action that produces the evidence pack and recommendation.

### 4.5 Machine evidence writeback

Every executed check should write evidence through the existing `verification_evidence` path.

Rules:

- evidence should carry `check_profile_id`
- the label should make it clear that the evidence was machine-generated from governed run execution
- the evidence handle may be either:
  - `artifactAssetId` for internal generated reports
  - `uri` for externally addressable result pages
- no new run-item records are created for governed machine execution
- no new evidence schema is added in Phase 9T

The run should accumulate evidence incrementally:

- successful checks append their evidence IDs immediately
- if a later check fails, earlier machine evidence stays attached to the run
- when possible, a failed check should still record a machine evidence record describing the failure outcome before the run is completed as `failed`
- if orchestration fails before a concrete check can emit evidence, the run may still complete as `failed` with only partial evidence or no new evidence, because status correctness is more important than pretending the machine path succeeded

This preserves auditability without requiring the whole execution to be transactionally atomic across external tools.

### 4.6 Why Phase 9T does not synthesize run items

The current scoring and recommendation pipeline is still run-item based:

- `summarizeEvaluationRun(...)` derives recommendation status from `EvaluationRunItemRecord[]`
- governed seeded runs intentionally do not have sample-backed run items

Phase 9T should keep that separation.

Reasons:

- synthetic run items would blur the line between benchmark evaluation and governed machine verification
- auto-generated scoring would quietly expand this slice into auto-recommendation
- the current user intent is for the machine to execute checks and collect evidence, not to replace operator judgment

So Phase 9T records machine evidence and completes the run, but leaves evidence-pack generation and final recommendation finalization to the operator.

## 5. Module-Service Integration

The new execution step should happen only after successful governed output creation for:

- screening
- editing
- proofreading final confirmation

It should **not** run for:

- proofreading draft creation
- human-final publication artifacts
- manually created evaluation runs

Recommended integration shape:

1. existing module service resolves governed context
2. module service persists output asset and execution snapshot
3. module service (or shared helper) seeds governed runs via `seedGovernedExecutionRuns(...)`
4. for each seeded run, call `executeSeededGovernedRunChecks(...)` inline and serially
5. append the resulting machine evidence IDs back onto the originating `AgentExecutionLog`
6. return the original module response normally once all seeded run executions have finished

The shared helper introduced in Phase 9S is the right place to centralize this so screening, editing, and proofreading-final do not each fork their own orchestration logic.

Important product rule:

- once the governed output asset and execution snapshot have already been persisted, a machine-check failure should produce a failed governed run, not retroactively turn the underlying screening/editing/proofreading job into a business-level failure

In other words, governed verification failure is governance state, not proof that the generated module output never existed.

## 6. API And Data Surface

### 6.1 Database

Phase 9T should not require schema changes.

Existing fields already cover the needed state:

- `evaluation_runs.status`
- `evaluation_runs.evidence_ids`
- `evaluation_runs.governed_source`
- `verification_evidence.check_profile_id`

### 6.2 Public API

Phase 9T should avoid new public endpoints.

The existing workbench reads are enough to observe the new behavior:

- run status changes from `queued` to `running` to `passed` or `failed`
- selected run evidence loads through the existing evidence endpoint
- finalization still uses the existing finalize endpoint

### 6.3 Agent execution trace

No new `AgentExecutionLog` fields are required.

The log already stores:

- expected verification check profile IDs
- expected suite IDs
- optional release check profile ID
- recorded verification evidence IDs

Implementation should update the execution trace so recorded machine evidence remains discoverable from the original governed execution.

Because module services already call `completeLog(...)` before governed runs are seeded, Phase 9T should add an additive agent-execution update path, such as:

- `appendVerificationEvidence(logId, evidenceIds)` or
- a small overwrite helper that preserves the completed log while refreshing `verification_evidence_ids`

The goal is to keep the governed verification trail linked to the original execution log without reopening or re-modeling the existing module execution lifecycle.

## 7. Evaluation Workbench Changes

`Evaluation Workbench` needs to reflect a new operator state:

- the run's automatic machine checks may already be complete
- the recommendation may still be unfinalized

Required behavior changes:

1. A governed run in `passed` or `failed` should no longer be treated like an untouched empty run.
2. If the run has machine evidence but no finalized recommendation, the detail view should present that as a review-ready intermediate state.
3. The governed-source detail pane should continue to show the seeded output context and also foreground the recorded machine evidence list.
4. CTA language should shift from `Complete And Finalize Run` toward a recommendation-finalization action, because completion may already have happened automatically.
5. The panel should show guidance such as:
   `Automatic governed checks completed. Review machine evidence before finalizing.`
6. History and compare helpers should avoid implying that a `passed` or `failed` governed run is still waiting for machine execution.

Phase 9T does not need a new dedicated machine-check dashboard. It only needs the workbench to correctly represent the new lifecycle.

## 8. Failure Semantics

Failure handling should optimize for truthful governance state:

- if any verification check reports failure, the run becomes `failed`
- if the orchestration layer throws while executing the plan, the run becomes `failed`
- if all checks succeed, the run becomes `passed`
- the operator can still manually finalize either a `passed` or `failed` run later
- once module output persistence has already succeeded, the API should prefer returning the completed module result together with a failed governed run state rather than surfacing the machine-check failure as though the module itself never completed

Phase 9T should not add:

- automatic retries
- dead-letter handling
- abandoned `running` run repair flows

Those belong to a future async execution phase, not this bounded inline slice.

## 9. Testing

Phase 9T should add focused coverage in three places:

### 9.1 Backend orchestration tests

- seeded run goes `queued -> running -> passed` when all checks succeed
- seeded run goes `queued -> running -> failed` when a check explicitly fails
- release-check verification profiles are expanded and deduped with suite verification profiles
- successful early evidence remains attached when a later check fails
- execution rejects queued runs whose referenced check profiles are no longer published

### 9.2 Module integration tests

- screening success seeds and executes governed runs
- editing success seeds and executes governed runs
- proofreading final confirmation seeds and executes governed runs
- proofreading draft creation still does not execute governed runs

### 9.3 Workbench tests

- passed or failed governed runs without finalization render as machine-completed, not as pending manual completion
- selected governed runs surface recorded machine evidence
- finalize CTA and operator guidance match the new lifecycle

## 10. Out Of Scope

Phase 9T explicitly does not include:

- background workers
- retry queues
- scheduler or lease semantics
- synthetic `EvaluationRunItemRecord` creation for governed runs
- automatic weighted scoring
- automatic recommendation generation
- automatic learning-candidate creation
- new evidence schema or dedicated machine-check schema

## 11. Result

After Phase 9T:

- governed module execution will produce not just a queued run, but an actually executed governed verification result
- the resulting run will already hold machine evidence when the operator opens it
- the workbench will treat that run as a reviewable pre-finalization state
- final recommendation ownership will remain with the operator

That is the intended bridge between Phase 9S seeding and any future phase that may introduce async execution, richer check artifacts, or automatic scoring.
