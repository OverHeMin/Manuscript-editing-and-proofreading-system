# Phase 10T Governed Orchestration Readiness Summary Rollup Design

**Date:** 2026-04-05  
**Status:** Implemented and locally verified under the current Phase 10 durable execution-orchestration mainline  
**Scope:** Extend the existing read-only governed orchestration inspection lane with a summary-level readiness rollup so operators can see, at a glance, how much actionable backlog is replayable now and when the next blocked backlog item becomes ready, without mutating durable orchestration state.

## 1. Goal

`Phase 10J` through `10S` established:

- durable post-business follow-up orchestration
- single-owner attempt claim guardrails
- read-only backlog inspection
- actionable focus ordering
- scoped replay and inspection
- bounded replay budgeting
- budgeted replay ordering alignment
- optional bounded boot recovery
- read-only preview of the next budgeted replay slice
- normalized readiness windows on inspection items

The next narrow gap is summary-level operator readability.

Today operators can already inspect:

- backlog category counts
- item-level readiness states
- item-level `ready_at` timestamps for blocked replay work

But they still need to scan individual items to answer two simple queue questions:

- how much actionable backlog is replayable right now
- when is the next blocked actionable item expected to become replayable

This phase closes that gap in the same read-only lane.

## 2. Why This Slice Exists

`10S` made readiness explicit per item, which fixed the raw observability gap.
The next small usability gap is aggregation.

Operators now have enough data, but not yet the shortest summary.
Especially when dry-run output is filtered, budgeted, or limited, it is still harder than necessary to quickly judge whether the backlog is:

- ready for immediate replay
- mostly waiting on retry eligibility
- mostly waiting on fresh-running timeout expiry

The right next step is not a dashboard, scheduler, or replay override.
It is one more repo-owned summary rollup built from the same read-only inspection state.

## 3. Hard Boundaries

### 3.1 Keep the feature read-only

This phase must not:

- change orchestration status
- change retry timing
- change stale-running reclaim timing
- alter business completion, routing, release, or learning state

### 3.2 Do not add a new control plane

This phase stays inside the existing inspection report and CLI summary lane.
It must not add:

- new HTTP mutation APIs
- new admin-console controls
- replay buttons, auto-retry, or scheduler behavior

### 3.3 Reuse current readiness semantics exactly

The new rollup must be derived only from the current inspection item readiness model:

- `ready_now`
- `waiting_retry_eligibility`
- `waiting_running_timeout`
- `not_recoverable`

This phase summarizes those states; it does not redefine them.

### 3.4 Keep existing consumers compatible

Existing summary, focus, replay preview, and item shapes must remain valid.
The new rollup must be additive and fail-open for consumers that ignore it.

## 4. Recommended Option

### Option A: Keep readiness summary implicit

Pros:

- no new code

Cons:

- operators still have to scan items for timing posture
- limited / budgeted dry-run output remains less glanceable than it could be

Not recommended.

### Option B: Add a small readiness rollup to the inspection report

Pros:

- minimal additive change
- improves operator readability without widening authority
- reuses existing item-level readiness semantics

Cons:

- adds another small read-only metadata block

Recommended.

## 5. Core Design

### 5.1 Add a readiness rollup block to the inspection report

Add a small additive summary block such as:

- `ready_now_count`
- `waiting_retry_eligibility_count`
- `waiting_running_timeout_count`
- `next_ready_at`

This gives one clear read-only view of the queue’s immediate replay posture.

### 5.2 Derive the rollup after current inspection classification

The rollup should be computed from the same inspection items already produced by `inspectBacklog(...)`.

Recommended derivation:

- `ready_now_count`: items with `recovery_readiness=ready_now`
- `waiting_retry_eligibility_count`: items waiting on retry eligibility
- `waiting_running_timeout_count`: items waiting for fresh-running timeout expiry
- `next_ready_at`: earliest `recovery_ready_at` among waiting actionable items

### 5.3 Surface the rollup in CLI dry-run summary output

The human-readable dry-run summary should append the rollup, for example:

- `ready_now=2`
- `waiting_retry=1`
- `waiting_running_timeout=1`
- `next_ready_at=...`

JSON output naturally includes the same additive block through the inspection report shape.

## 6. Expected Outcomes

After this slice:

- operators can judge immediate replay posture without scanning every item
- the next blocked actionable readiness time becomes visible in one summary line
- dry-run remains read-only and non-authoritative

## 7. Out Of Scope

This phase does not add:

- replay scheduling
- auto-retry controls
- mutation of readiness timestamps
- dashboards or workbench extensions
- workflow-engine substitution depth

## 8. Related Documents

- `docs/superpowers/specs/2026-04-05-phase10l-governed-orchestration-dry-run-inspection-design.md`
- `docs/superpowers/specs/2026-04-05-phase10r-governed-orchestration-budgeted-dry-run-preview-design.md`
- `docs/superpowers/specs/2026-04-05-phase10s-governed-orchestration-readiness-windows-design.md`
