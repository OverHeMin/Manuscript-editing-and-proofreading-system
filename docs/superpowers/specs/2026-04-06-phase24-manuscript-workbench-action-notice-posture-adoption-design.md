# Phase 24 Manuscript Workbench Action Notice Posture Adoption Design

**Date:** 2026-04-06  
**Status:** Proposed for immediate implementation after Phase 23  
**Primary capability lane:** Execution And Orchestration Platform  
**Scope:** Make the existing top manuscript workbench notice truthfully reflect durable action/job posture for job-bearing actions by reusing the current `Latest Action Result` posture details, while preserving fail-open fallback to the current generic success/error messaging.

## 1. Goal

`Phase 23` made the `Latest Action Result` card posture-aware even when
workbench actions or workspace load fail open to a raw overview-backed job.

One adjacent operator-facing gap still remains:

- the `Latest Action Result` card can now explain whether the action is settled,
  pending, retryable, failed, or unlinked
- but the top banner notice still renders only:
  - `Action Error` + raw error text
  - `Action Complete` + raw `status`
- that means the most prominent page-level success signal can still overstate
  completion when durable follow-up is pending or degraded

In one sentence:

`Phase 24` should make the existing top notice posture-aware for job-bearing
action results, while keeping the current generic fail-open behavior when no
durable posture details are available.

## 2. Why This Phase Exists

The workbench summary path is now mostly aligned:

- `Recommended Next Step` reads settlement and fallback posture
- `Manuscript Overview` reads settlement and fallback posture
- `Latest Job` reads settlement and fallback posture
- `Latest Action Result` reads settlement and fallback posture

But the banner at the top still says only:

- `Action Complete`

even when the same action result details now say:

- `Business complete, follow-up pending`
- `Business complete, follow-up retryable`
- `Business complete, follow-up failed`

That leaves one final top-level wording gap in the same read-only operator path.

This is the next clean mainline slice because it:

- stays on the current workbench page
- reuses posture evidence already computed for the current action result
- remains fully fail-open and read-only

## 3. Options Considered

### Option A: Keep the notice generic and rely on the action-result card for nuance

Pros:

- no implementation change

Cons:

- the highest-visibility page signal can still overstate completion
- operators must scan downward to learn whether follow-up is settled or not

Not recommended.

### Option B: Make the existing notice posture-aware from current action-result details

Pros:

- reuses the current action-result posture details already available on the page
- keeps the change local to the current notice rendering path
- preserves fail-open behavior when no posture is available

Cons:

- adds one small interpretation helper

Recommended.

### Option C: Add a separate execution status banner or new notice card

Pros:

- more room for richer explanation

Cons:

- widens UI surface area
- drifts away from the current single-notice pattern

Out of scope.

## 4. Hard Boundaries

### 4.1 Existing notice surface only

This phase should update only:

- the existing top `ManuscriptWorkbenchNotice` render path
- page-local notice resolution helpers

It must not add:

- a new panel
- a second notice surface
- new summary cards
- new request choreography

### 4.2 Existing action-result contract first

This phase should prefer reusing:

- `latestActionResult`
- its already-rendered posture detail rows

The notice should not require any new backend fields or any additional reads.

### 4.3 Fail-open only

If no posture-aware detail rows are available:

- the current generic notice behavior remains
- success actions still show the current success notice
- error actions still show the current error notice

### 4.4 Read-only only

This phase may improve:

- notice wording honesty
- notice explainability
- consistency between the top banner and the action-result card

It must not:

- add replay, retry, routing, or runtime controls
- mutate orchestration or governance state
- change backend routes or persistence

## 5. Proposed Changes

### 5.1 Add one page-local notice resolver

Introduce one small resolver that accepts the current page inputs:

- `error`
- `status`
- `latestActionResult`

and returns the notice model to render:

- `tone`
- `title`
- `message`

### 5.2 Reuse current posture detail vocabulary

For job-bearing action results, the resolver should inspect the current action
result detail rows already produced by earlier phases, especially:

- `Settlement`
- `Recovery`
- `Recovery Ready At`

Recommended notice wording behavior:

- settled posture keeps the current `Action Complete`
- unsettled but successful posture downgrades wording to something like
  `Action Recorded`
- message text should explain the durable posture honestly, for example:
  - follow-up pending/running => follow-up is not settled yet
  - retryable => follow-up is retryable and still needs attention
  - failed => follow-up failed and needs inspection
  - unlinked => settlement linkage is incomplete
  - job failed => latest governed attempt failed

This phase does not need to introduce a brand-new vocabulary; it should stay
close to existing settlement language.

### 5.3 Preserve existing non-job behavior

This phase should keep current notice behavior unchanged for:

- file-attach actions
- export-only actions
- plain load/upload/run/finalize/publish actions when posture detail rows are
  unavailable
- existing error paths

## 6. Testing Expectations

Phase 24 should prove all of the following:

- generic success notice stays unchanged when no posture details are present
- settled job-bearing action results keep the `Action Complete` notice
- unsettled job-bearing action results produce a more honest notice title and
  message
- error notice behavior remains unchanged

## 7. Out Of Scope

Phase 24 does not include:

- backend route or persistence changes
- new workbench pages, panels, or dashboards
- new action-result detail fields beyond what the current frontend already uses
- replay, retry, routing, or runtime mutation authority

## 8. Related Capability Ownership

This phase continues the same `Execution And Orchestration Platform` lane after
`Phase 23` by making the current top workbench notice align with existing
durable action-result posture, without widening authority or opening any new
surface.
