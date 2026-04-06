# Phase 17 Manuscript Workbench Action-Time Execution Hydration Design

**Date:** 2026-04-06  
**Status:** Proposed for immediate implementation after Phase 16  
**Primary capability lane:** Execution And Orchestration Platform  
**Scope:** Best-effort hydrate the latest returned job on existing manuscript workbench actions so operators can read durable execution settlement, recovery, and readiness posture immediately after action completion without needing a reload.

## 1. Goal

`Phase 14` made the manuscript workbench read settlement.
`Phase 15` made reload and restart paths restore the newest tracked mainline job.
`Phase 16` made restored latest-job posture readable.

One operator-facing gap still remains on the mainline workbench path:

- action-time success flows still mostly keep `latestJob` from the raw action response
- those raw responses do not consistently carry hydrated `execution_tracking`
- the operator may need `Refresh Latest Job` or a full reload to see settlement,
  recovery, and runtime-binding readiness posture that already exists on the
  existing `GET /jobs/:id` read path

In one sentence:

`Phase 17` should make existing workbench actions best-effort hydrate their
returned job through the current job read route before updating the main
read-only summary path.

## 2. Why This Phase Exists

The repository already has the needed read model:

- `Phase 13` exposed `execution_tracking` on `GET /jobs/:id`
- `Phase 15` reused that path for reload-time restoration
- `Phase 16` made the restored posture operator-readable

But the primary interactive path is still inconsistent:

- upload sets `latestJob` from `result.upload.job`
- module runs set `latestJob` from `result.runResult.job`
- proofreading finalize sets `latestJob` from `result.runResult.job`
- human-final publish sets `latestJob` from `result.runResult.job`

That means one operator can run a step successfully, stay on the same page, and
still not immediately see the durable execution posture already available from
the existing read model.

This phase closes that last mainline adoption gap without expanding surface
area or authority.

## 3. Options Considered

### Option A: Keep action results on raw returned jobs and rely on manual refresh

Pros:

- no implementation work

Cons:

- inconsistent operator experience between reload-time and action-time paths
- durable execution posture remains partially hidden on the primary workbench
  flow

Not recommended.

### Option B: Best-effort hydrate the returned job through existing `GET /jobs/:id`

Pros:

- reuses current read routes only
- aligns action-time posture with reload-time posture
- keeps all behavior local-first, fail-open, and read-only

Cons:

- adds one bounded best-effort read after successful action completion

Recommended.

### Option C: Expand action endpoints to always return fully hydrated job tracking

Pros:

- fewer client-side follow-up reads in the future

Cons:

- changes backend response contracts
- widens mainline implementation scope more than necessary for this gap

Out of scope.

## 4. Hard Boundaries

### 4.1 Existing workbench surface only

This phase may update only the current manuscript workbench controller and page
flow.

It must not add:

- a new page
- a new panel
- a new debug surface
- a new control-plane action

### 4.2 Existing routes only

This phase may use only existing frontend routes and backend APIs:

- current action routes already used by the workbench
- existing `GET /api/v1/jobs/:jobId`

It must not add:

- new backend routes
- new job list endpoints
- new settlement/readiness-specific endpoints

### 4.3 Fail-open only

If hydration fails after the action succeeds:

- the action still counts as successful
- the reloaded workspace still renders
- the workbench falls back to the raw returned job
- no new blocking error interrupts the existing mainline path

### 4.4 Read-only only

This phase may improve:

- `latestJob` fidelity
- load/action result details
- immediate posture visibility

It must not:

- add replay or retry controls
- add routing or runtime mutation
- make Evaluation Workbench or any new surface part of the control plane

## 5. Proposed Changes

### 5.1 Controller-owned hydration helper

Add one controller-local helper that:

- accepts the raw returned `job`
- best-effort calls `loadJob(job.id)` through the existing client path
- returns the hydrated job when successful
- returns the original job when the read fails

This keeps the adaptation minimal and avoids duplicating hydration logic across
page actions.

### 5.2 Apply the same helper to current workbench action flows

Use the helper in the existing controller flows only:

- `uploadManuscriptAndLoad`
- `runModuleAndLoad`
- `finalizeProofreadingAndLoad`
- `publishHumanFinalAndLoad`

Recommended sequence:

1. execute the current action request
2. best-effort hydrate the returned job
3. reload workspace as today
4. return the same result shape, but with hydrated `job` when available

This keeps page-level action handlers simple and preserves current action
result semantics.

### 5.3 Keep page consumption aligned with controller output

The page should continue setting:

- `workspace`
- `latestJob`
- `status`
- `latestActionResult`

But now `latestJob` should usually already include `execution_tracking`
immediately after action success when the existing read path can provide it.

### 5.4 Preserve fail-open action semantics

Hydration failure must never:

- turn a successful action into an error banner
- suppress the returned asset or workspace reload
- block later manual `Refresh Latest Job`

The action-time path should degrade to the prior raw-job behavior.

## 6. Testing Expectations

Phase 17 should prove all of the following:

- upload, module run, proofreading finalize, and human-final publish all
  best-effort hydrate their returned job through the existing job read route
- controller result objects keep the same shape while returning hydrated `job`
  data when available
- hydration failures fail open and preserve the original raw returned job
- no existing workspace reload behavior regresses

## 7. Out Of Scope

Phase 17 does not include:

- backend route or persistence changes
- job list APIs
- new workbench pages or panels
- replay, retry, or scheduling controls
- orchestration-core mutation
- routing control-plane changes

## 8. Related Capability Ownership

This phase continues the same `Execution And Orchestration Platform` lane after
`Phase 16` by aligning action-time workbench state with the existing durable
job read model, so the current manuscript mainline path stays readable and
explainable immediately after action completion without widening authority or
opening a new surface.
