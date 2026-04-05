# Phase 10K Execution Orchestration Attempt Claim Guardrails Design

**Date:** 2026-04-05  
**Status:** Implemented and locally verified under the current Phase 10 roadmap  
**Scope:** Add a narrow claim-ownership guardrail on top of the Phase 10J durable orchestration baseline so concurrent best-effort dispatch, manual recovery, and boot recovery cannot all win the same orchestration attempt.

## 1. Goal

`Phase 10J` already established:

- durable orchestration lifecycle on `AgentExecutionLog`
- bounded retry and retry eligibility
- stale-running recovery
- fail-open separation between business completion and orchestration completion
- read-only orchestration observability

The next mainline gap is narrower:

- orchestration attempts are still claimed optimistically
- concurrent runners can observe the same log as recoverable and both start work
- idempotent governed-run reuse reduces duplicate verification assets, but it does not fully protect the orchestration lifecycle story
- an older stale runner can still race a newer reclaim path on final writeback

This slice closes that concurrency gap without introducing a queue platform, worker farm, or control plane.

## 2. Why This Slice Exists

After `10J`, the repository already supports:

- business-success-first module execution
- best-effort follow-up dispatch after commit
- repo-owned recovery from persistence
- optional fail-open boot replay

That makes orchestration restart-safe enough for a baseline, but not yet ownership-safe under overlap.

Typical overlap paths are:

- business completion triggers best-effort dispatch while an operator starts manual recovery
- boot recovery begins shortly after startup while another runner is still finishing a stale attempt
- two recovery invocations scan the same eligible log close together

The system needs one more mainline guardrail:

- only one runner should own a specific orchestration attempt at a time

## 3. Hard Boundaries

### 3.1 No new orchestration platform

This phase must not add:

- a new queue
- a hosted scheduler
- a worker control plane
- a console for orchestration mutation

The change stays inside the existing `agent-execution` durable record plus repo-owned recovery path.

### 3.2 Business lifecycle remains authoritative

The new claim guard:

- does not change manuscript business `status`
- does not roll back completed jobs, assets, or snapshots
- only narrows how orchestration attempts are claimed and finalized

### 3.3 Fail-open remains mandatory

If claim ownership is lost or stale:

- the loser must not corrupt orchestration state
- the loser must not fail the already-completed business path
- recovery and startup still degrade to no-op or log-only outcomes

### 3.4 Verification-ops contract stays unchanged

This phase may reuse the existing idempotent governed-run seeding from `10J`, but it must not redefine:

- verification suites
- governed source contracts
- run or evidence ownership

## 4. Recommended Option

### Option A: Keep optimistic claim and rely on governed-run idempotency

Pros:

- smallest diff

Cons:

- concurrent runners can still both believe they processed the attempt
- stale owner finalization can still overwrite a newer reclaim lifecycle
- recovery summaries remain less trustworthy under overlap

Not recommended.

### Option B: Add a durable orchestration attempt claim token plus compare-and-swap claim/finalize rules

Pros:

- stays local-first and additive
- keeps ownership on the existing execution log
- prevents double-winning on the same attempt
- lets stale owners fail open without clobbering a newer claim

Cons:

- requires one more additive persistence field and narrow repository/service changes

Recommended.

## 5. Core Design

### 5.1 Add one durable attempt-claim token

Add one nullable orchestration field to `AgentExecutionLog`, for example:

- `orchestration_attempt_claim_token`

Meaning:

- unset when no attempt is actively owned
- set only while one runner currently owns the active orchestration attempt

This field is internal execution state, not a new operator control surface.

### 5.2 Claim must become compare-and-swap, not blind write

When a runner decides a log is recoverable, it should not blindly write `running`.

Instead it should attempt a durable claim that only succeeds if the persisted log still matches the expected recoverable snapshot, such as:

- current orchestration status
- current attempt count
- current retry eligibility marker
- current started-at marker for stale-running reclaim

If that compare-and-swap fails:

- the runner loses ownership
- the runner performs no governed follow-up work
- the runner returns the latest persisted log and degrades to no-op

### 5.3 Finalization must be owner-aware

When a runner later marks orchestration `completed`, `retryable`, or `failed`, that write should only apply if:

- the stored `orchestration_attempt_claim_token` still matches the caller's token

If ownership was rotated by a newer reclaim:

- the older runner's finalization becomes a no-op
- the newer owner remains authoritative

### 5.4 Stale-running reclaim rotates ownership

For stale `running` logs:

- recovery may claim them again
- the new claim replaces the old token
- the attempt count increments as part of the new running claim

This keeps stale-running recovery restart-safe without allowing the stale owner to write back over the new owner.

### 5.5 Recovery summary counts only locally claimed work

`recoverPending()` should continue to report:

- `processed_count`
- `completed_count`
- `retryable_count`
- `failed_count`
- `deferred_count`

But `processed_count` must only include logs this recovery run actually claimed and executed.

Logs that lost the claim race should:

- remain visible through their durable log state
- not be counted as locally processed

## 6. Expected Outcomes

After this slice:

- one active orchestration attempt has one durable owner token
- concurrent dispatch or recovery paths no longer double-win the same attempt
- stale owner writeback cannot clobber a newer reclaim owner
- business completion remains fail-open and unchanged
- no new control plane, queue, or cloud dependency is introduced

## 7. Out Of Scope

This phase does not add:

- queue depth dashboards
- operator retry/resume buttons
- automatic scheduling beyond the existing explicit boot/manual recovery paths
- hosted workflow engines or `Temporal`-class orchestration depth
- evaluation or routing control-plane mutations

## 8. Related Documents

- `docs/superpowers/specs/2026-04-05-phase10j-durable-execution-orchestration-baseline-design.md`
- `docs/superpowers/plans/2026-04-05-phase10j-durable-execution-orchestration-baseline.md`
- `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`
