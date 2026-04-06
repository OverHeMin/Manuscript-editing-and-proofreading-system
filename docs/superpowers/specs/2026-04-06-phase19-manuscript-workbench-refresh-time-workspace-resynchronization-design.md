# Phase 19 Manuscript Workbench Refresh-Time Workspace Resynchronization Design

**Date:** 2026-04-06  
**Status:** Proposed for immediate implementation after Phase 18  
**Primary capability lane:** Execution And Orchestration Platform  
**Scope:** Extend the existing `Refresh Latest Job` path so it best-effort resynchronizes the current manuscript workspace after refreshing the latest job, keeping workbench overview and recommendation surfaces aligned with refreshed execution posture.

## 1. Goal

`Phase 17` hydrated action-time jobs.
`Phase 18` adopted hydrated posture into `Latest Action Result`.

One read-only mainline gap still remains:

- `Refresh Latest Job` currently updates `latestJob`
- the existing `Manuscript Overview`, `Recommended Next Step`, and current
  asset context may still reflect older workspace data until the operator runs a
  separate `Load Workspace`

In one sentence:

`Phase 19` should make `Refresh Latest Job` best-effort reload the current
workspace so refreshed execution posture and refreshed manuscript overview stay
aligned on the main workbench path.

## 2. Why This Phase Exists

The workbench now has strong execution posture visibility, but the refresh path
still splits state:

- `latestJob` can become newer
- `module_execution_overview` can remain older
- recommendation text can continue reflecting stale settlement

That creates a small but important inconsistency on the execution/orchestration
mainline:

- the operator refreshes the latest job
- the job card changes
- the workbench summary and next-step guidance may lag behind

This phase closes that read-model alignment gap without widening authority.

## 3. Options Considered

### Option A: Keep refresh job-only and rely on manual workspace reload

Pros:

- no additional implementation

Cons:

- summary and recommendation surfaces can remain stale after refresh
- refresh-time observation stays only partially aligned

Not recommended.

### Option B: Best-effort reload workspace immediately after refreshing the job

Pros:

- reuses existing `loadWorkspace` and `loadJob` read paths only
- keeps the change local to the current workbench
- preserves fail-open behavior if workspace resync is unavailable

Cons:

- adds one bounded extra read to the refresh action

Recommended.

### Option C: Add a dedicated refresh-all control or new resync panel

Pros:

- explicit operator affordance

Cons:

- expands UI surface
- risks drifting toward an operations/control plane

Out of scope.

## 4. Hard Boundaries

### 4.1 Existing refresh action only

This phase may update only the current `Refresh Latest Job` behavior.

It must not add:

- a new refresh button
- a new page or panel
- a new orchestration control

### 4.2 Existing read paths only

This phase should reuse only:

- existing `loadJob(jobId)`
- existing `loadWorkspace(manuscriptId)`

It must not add:

- new backend routes
- new workspace sync endpoints
- new settlement-specific APIs

### 4.3 Fail-open workspace resync

If `loadJob` fails:

- the refresh action should fail as it does today

If `loadJob` succeeds but `loadWorkspace` fails:

- the refresh action still counts as successful
- `latestJob` updates
- the current workspace remains in place
- no new blocking error interrupts the main path

### 4.4 Read-only only

This phase may improve:

- state alignment across current summary cards
- refresh-time recommendation accuracy
- refresh-time operator visibility

It must not:

- add replay, retry, or routing authority
- mutate runtime governance or orchestration state

## 5. Proposed Changes

### 5.1 Add one page-level refresh helper

Introduce one helper parallel to the existing prefilled-load helper that:

- refreshes the latest job through `loadJob`
- best-effort reloads workspace through `loadWorkspace`
- returns:
  - refreshed latest job
  - optional refreshed workspace
  - success status
  - action-result details

Keeping this in the page layer avoids widening the controller contract for a
single UI-specific refresh composition.

### 5.2 Update `Refresh Latest Job` to adopt the helper

The current refresh action should:

1. refresh the latest job
2. try to reload workspace
3. update `latestJob` always when the job refresh succeeds
4. update `workspace` only when workspace reload succeeds

This ensures the current overview cards resynchronize when possible while
remaining fail-open.

### 5.3 Keep action-result posture and summary consistent

When workspace resync succeeds:

- the existing `Latest Action Result` should keep job posture details
- the existing `Manuscript Overview` and `Recommended Next Step` should update
  through the new workspace state

When workspace resync fails:

- the action result should still explain the refreshed job
- no extra error banner should appear

## 6. Testing Expectations

Phase 19 should prove all of the following:

- refresh helper returns refreshed job plus refreshed workspace when both reads
  succeed
- refresh helper fails open when workspace reload fails after a successful job
  refresh
- refresh action result keeps job posture details
- refresh-time workspace resync updates summary-driving data without changing
  export or non-refresh paths

## 7. Out Of Scope

Phase 19 does not include:

- backend route or persistence changes
- controller contract expansion for unrelated actions
- new refresh controls or dashboards
- replay, retry, or queue-state mutation
- any new control-plane behavior

## 8. Related Capability Ownership

This phase continues the same `Execution And Orchestration Platform` lane after
`Phase 18` by aligning refresh-time job observation with the current manuscript
workspace read model, so the existing workbench stays readable and explainable
after refresh without widening authority or opening a new surface.
