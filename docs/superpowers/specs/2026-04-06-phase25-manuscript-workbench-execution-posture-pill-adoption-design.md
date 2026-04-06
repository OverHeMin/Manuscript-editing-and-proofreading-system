# Phase 25 Manuscript Workbench Execution Posture Pill Adoption Design

**Date:** 2026-04-06  
**Status:** Proposed for immediate implementation after Phase 24  
**Primary capability lane:** Execution And Orchestration Platform  
**Scope:** Keep the existing `Latest Action Result` and `Latest Job` cards honest about durable execution posture by replacing residual generic `success/completed` pill emphasis with posture-aware badges derived from already available settlement evidence, while preserving fail-open fallback to the current generic pills when posture evidence is unavailable.

## 1. Goal

`Phase 24` made the top page notice more honest about unsettled governed
follow-up.

One adjacent operator-facing gap still remains inside the existing summary
cards:

- `Latest Action Result` still shows an `Outcome` pill that says only
  `success` whenever the action transport succeeded
- `Latest Job` still highlights raw job `completed` as a green success pill even
  when durable follow-up is pending, retryable, failed, or unlinked

That means the workbench still has residual attempt-level success emphasis even
after the surrounding cards and page notice became posture-aware.

In one sentence:

`Phase 25` should make the existing workbench pills reflect durable execution
posture first, while keeping raw attempt status readable and preserving
fail-open fallback when posture evidence is unavailable.

## 2. Why This Phase Exists

The current workbench is already mostly posture-aware:

- `Recommended Next Step` is posture-aware
- `Manuscript Overview` is posture-aware
- `Latest Job` details are posture-aware
- `Latest Action Result` details are posture-aware
- the top page notice is posture-aware

But two compact summary cues still overstate completion:

- `Latest Action Result -> Outcome: success`
- `Latest Job -> Status: completed`

when the same cards may already contain details such as:

- `Business complete, follow-up pending`
- `Business complete, follow-up retryable`
- `Business complete, follow-up failed`

This is the next clean mainline slice because it:

- stays inside the current manuscript workbench summary cards
- reuses posture evidence already computed on the page
- remains fully read-only and fail-open

## 3. Options Considered

### Option A: Keep current pills generic and rely on detail rows for nuance

Pros:

- no implementation change

Cons:

- compact card-level emphasis can still overstate durable completion
- operators must mentally reconcile a green `success/completed` pill with
  unsettled detail rows

Not recommended.

### Option B: Reuse current settlement evidence to make the existing pills posture-aware

Pros:

- reuses the existing action-result details and latest-job execution tracking
- keeps the change local to the current summary cards
- preserves fail-open behavior when posture evidence is missing

Cons:

- adds one small interpretation layer for pill tone and label

Recommended.

### Option C: Add a new warning panel or separate posture badge section

Pros:

- more room for richer explanation

Cons:

- widens UI surface area
- drifts away from the current card structure

Out of scope.

## 4. Hard Boundaries

### 4.1 Existing card surfaces only

This phase should update only:

- the existing `Latest Action Result` card
- the existing `Latest Job` card
- summary-local helper logic needed to resolve compact posture pill models

It must not add:

- a new panel
- a new page
- a new banner
- a new request path

### 4.2 Existing read models only

This phase should prefer reusing:

- `latestActionResult`
- `latestActionResult.details`
- `latestJob`
- `latestJob.execution_tracking`
- the current overview-backed latest-job fallback path

No backend field or route additions are required.

### 4.3 Fail-open only

If posture evidence is missing:

- `Latest Action Result` keeps the current generic outcome pill
- `Latest Job` keeps the current raw status pill behavior
- the workbench continues to render without blocking

### 4.4 Read-only only

This phase may improve:

- compact pill wording honesty
- compact pill tone honesty
- consistency between summary cues and the already-rendered posture details

It must not:

- add replay, retry, routing, or runtime controls
- mutate orchestration or governance state
- change backend routes or persistence

## 5. Proposed Changes

### 5.1 Add one summary-local posture pill resolver

Introduce one small summary-local helper that resolves a compact pill model:

- `tone`
- `label`

from currently available posture evidence.

Recommended evidence sources:

- `Settlement`
- `Recovery`
- `Recovery Ready At`

### 5.2 Make `Latest Action Result` compact outcome posture-aware

For job-bearing action results:

- settled posture should keep a positive success-style pill
- pending/running/in-progress posture should downgrade to a neutral
  not-yet-settled pill
- retryable/failed/unlinked posture should downgrade to an attention/error
  pill

Recommended label behavior:

- `Settled`
- `Follow-up pending`
- `Follow-up running`
- `Follow-up retryable`
- `Follow-up failed`
- `Settlement unlinked`
- `Job in progress`
- `Job failed`

If no posture detail rows exist:

- keep the current generic `success` / `attention needed` outcome pill

### 5.3 Make `Latest Job` compact posture emphasis honest

The `Latest Job` card should keep the raw attempt `Status` readable, but it
should stop using raw `completed` alone as the primary success signal when
durable posture is unsettled.

Recommended approach:

- keep the raw `Status` metric visible
- add one compact posture-aware pill metric such as `Execution Posture`
- derive it from hydrated execution tracking first
- fail open to the current overview-backed latest-job fallback when hydrated
  tracking is unavailable

This keeps attempt evidence and durable posture distinct without widening the
surface beyond the current card.

## 6. Testing Expectations

Phase 25 should prove all of the following:

- non-job action results keep the current generic outcome pill
- settled job-bearing action results show a settled/success posture pill
- retryable or failed action results show an attention-oriented posture pill
- latest-job posture pill prefers hydrated execution tracking when available
- latest-job posture pill fails open to overview-backed posture when hydration is
  unavailable
- latest-job raw status remains visible as attempt evidence

## 7. Out Of Scope

Phase 25 does not include:

- backend route or persistence changes
- new workbench pages, panels, or dashboards
- new action history storage
- replay, retry, routing, or runtime mutation authority
- new color systems or a brand-new status component API

## 8. Related Capability Ownership

This phase continues the same `Execution And Orchestration Platform` lane after
`Phase 24` by aligning the remaining compact workbench card pills with the
existing durable posture read model, without widening authority or opening any
new surface.
