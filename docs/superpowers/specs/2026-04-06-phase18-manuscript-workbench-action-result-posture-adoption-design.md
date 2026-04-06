# Phase 18 Manuscript Workbench Action Result Posture Adoption Design

**Date:** 2026-04-06  
**Status:** Proposed for immediate implementation after Phase 17  
**Primary capability lane:** Execution And Orchestration Platform  
**Scope:** Adopt the existing hydrated job posture into the current `Latest Action Result` card for job-bearing manuscript workbench actions, so action-time operator feedback is readable and explainable without needing a separate reload or manual comparison with the `Latest Job` card.

## 1. Goal

`Phase 17` made workbench actions best-effort hydrate their returned `job`
through the existing `GET /jobs/:id` read path.

That closed the data gap for `latestJob`, but one operator-facing explanation
gap still remains:

- the `Latest Job` card can now show durable settlement, recovery, and runtime
  readiness posture
- the `Latest Action Result` card for the same action still mostly shows only
  ids such as `Asset` and `Job`

In one sentence:

`Phase 18` should make the current `Latest Action Result` card reuse the
existing hydrated job posture so action-time feedback is immediately
interpretable on the main workbench surface.

## 2. Why This Phase Exists

The current workbench still has a split explanation model:

- one card tells the operator what action just happened
- another card tells the operator what posture the latest job is in

After `Phase 17`, those two cards are reading the same action-time job, but
only one of them explains durable execution posture.

This leaves a small but real mainline inconsistency:

- operators can see that an asset was created
- they still need to mentally cross-reference the `Latest Job` card to know
  whether the follow-up is settled, retryable, waiting, or degraded

This phase closes that interpretation gap while staying entirely within the
existing workbench surface.

## 3. Options Considered

### Option A: Keep action results minimal and rely on the `Latest Job` card

Pros:

- no new code

Cons:

- immediate operator feedback remains under-explained
- action-time and reload-time posture storytelling remain partially split

Not recommended.

### Option B: Reuse existing job posture formatters in `Latest Action Result`

Pros:

- no backend changes
- reuses the exact posture model already adopted in the workbench
- keeps the change read-only and local to the current surface

Cons:

- adds one small formatting/helper layer for job-bearing actions

Recommended.

### Option C: Add a new action-history or execution-result panel

Pros:

- more room for future detail

Cons:

- expands UI surface area
- risks drifting toward a new operations panel
- is heavier than the current mainline adoption gap

Out of scope.

## 4. Hard Boundaries

### 4.1 Existing workbench surface only

This phase may update only:

- the current `Latest Action Result` card
- the existing page-side action-result construction helpers

It must not add:

- a new page
- a new panel
- a new action-history surface

### 4.2 Job-bearing actions only

This phase should improve only actions that already return or refresh a job:

- upload
- screening/editing/proofreading draft runs
- proofreading finalize
- human-final publish
- refresh latest job

Export may stay on its existing asset/download-only details.

### 4.3 Existing read model only

This phase should reuse only:

- the hydrated action job already returned by `Phase 17`
- existing posture formatter helpers already used by the workbench

It must not add:

- new backend routes
- new read models
- new persistence

### 4.4 Fail-open only

If a hydrated job lacks `execution_tracking`, or the observation failed open:

- the action result still renders
- base details such as manuscript, asset, job, or status remain visible
- posture-specific details degrade to omission or existing fail-open wording

## 5. Proposed Changes

### 5.1 Add one shared action-result detail builder

Introduce one small helper for job-bearing action results that:

- accepts base detail rows such as manuscript/asset/job/status
- appends the existing `buildLatestJobPostureDetails(...)` output when the job
  has posture available

This avoids repeating ad hoc detail construction across actions.

### 5.2 Adopt the helper in existing job-bearing actions

Use the helper for:

- `Upload Manuscript`
- `Run Screening`
- `Run Editing`
- `Create Draft`
- `Finalize Proofreading`
- `Publish Human Final`
- `Refresh Latest Job`

Recommended display pattern:

1. keep the action-specific base details first
2. append settlement
3. append recovery posture and `ready_at` when present
4. append runtime readiness when present

### 5.3 Keep `Load Workspace` behavior unchanged except for shared consistency

`Load Workspace` already shows posture-aware details through the existing
prefilled-load path.

This phase may align helper usage if convenient, but it should not reopen the
workspace-load contract or add new scope there.

## 6. Testing Expectations

Phase 18 should prove all of the following:

- job-bearing action results now include posture details when the returned job
  is hydrated with `execution_tracking`
- refresh latest job action results include the same posture explanation instead
  of raw status only
- actions fail open when posture is unavailable and still keep their base detail
  rows
- export and other non-job result paths stay unchanged

## 7. Out Of Scope

Phase 18 does not include:

- backend route or persistence changes
- new workbench panels or dashboards
- replay, retry, or routing controls
- action-history persistence
- any expansion of Evaluation Workbench or other control surfaces

## 8. Related Capability Ownership

This phase continues the same `Execution And Orchestration Platform` lane after
`Phase 17` by making immediate action-result feedback reuse the same durable
job posture already adopted elsewhere in the current manuscript workbench,
without widening authority or opening a new surface.
