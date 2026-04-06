# Phase 15 Manuscript Workbench Restart-Safe Execution Hydration Design

**Date:** 2026-04-06  
**Status:** Proposed for immediate implementation after Phase 14  
**Primary capability lane:** Execution And Orchestration Platform  
**Scope:** Make the existing manuscript workbench restore the latest read-only execution context after workspace reload by best-effort hydrating the newest tracked mainline job from the current manuscript settlement overview.

## 1. Goal

`Phase 14` made the workbench understand settlement when the page already has:

- `module_execution_overview`
- `execution_tracking`

But the workbench still loses the tracked `Latest Job` context after:

- browser refresh
- restart and re-entry
- prefilled handoff auto-load
- manual `Load Workspace`

That is because `latestJob` is still mostly a session-local state set by the most
recent operator action.

In one sentence:

`Phase 15` should make workspace loading restore the newest mainline job context
best-effort, using the current manuscript settlement overview and the existing
job read route.

## 2. Why This Phase Exists

Without this phase:

- restart-safe reload still drops the tracked job context
- `Refresh Latest Job` may stay unavailable after reload even though durable
  execution evidence exists
- operators can see per-module settlement, but not the latest tracked job
  details that explain the current orchestration posture

This means the durable execution story is still incomplete on the main
workbench path.

## 3. Option Review

### Option A: Keep latest job as session-only state

Pros:

- no code changes

Cons:

- restart safety remains incomplete
- durable orchestration visibility is still partially lost on reload

Not recommended.

### Option B: Best-effort hydrate the latest tracked mainline job during workspace load

Pros:

- reuses existing manuscript and job routes
- preserves the current workbench surface
- improves restart-safe read-only observation directly on the mainline path

Cons:

- adds one bounded best-effort read after workspace load

Recommended.

### Option C: Add a new route or new panel for latest execution context

Pros:

- could expose richer future detail

Cons:

- widens surface area
- is heavier than the current gap
- risks drifting toward a new control plane

Out of scope.

## 4. Hard Boundaries

### 4.1 No new control surface

This phase must not add:

- a new page
- a new panel
- a new route
- any replay or queue mutation action

### 4.2 Existing routes only

This phase may use only the current:

- `GET /manuscripts/:id`
- `GET /jobs/:id`

No backend contract expansion is required.

### 4.3 Fail-open hydration

If latest-job hydration fails:

- workspace load still succeeds
- manuscript settlement overview still renders
- latest-job card may fall back to the best manuscript-side overview or remain
  absent
- no new blocking error should interrupt the main workbench path

## 5. Proposed Changes

### 5.1 Derive the newest mainline job candidate from manuscript settlement

Use the existing manuscript `module_execution_overview` to find the most recent
mainline job candidate across:

- `screening`
- `editing`
- `proofreading`

Recommended tie-break order:

1. latest `updated_at`
2. latest `created_at`
3. stable module order

### 5.2 Best-effort tracked job hydration on workspace load

When workspace load succeeds:

- derive the newest mainline job id from settlement overview
- if a candidate exists, best-effort call `loadJob(candidate.id)`
- if the call succeeds, store the hydrated job with `execution_tracking`
- if the call fails, fail open and continue with the manuscript overview only

This behavior should apply to:

- prefilled auto-load
- manual workspace load

### 5.3 Operator-visible restoration

After a successful best-effort hydration:

- `Latest Job` should reappear after reload without needing a fresh run action
- `Refresh Latest Job` should remain available because a durable latest job id is
  now restored
- the load result details should include the restored latest job when available

## 6. Testing Expectations

Phase 15 should prove:

- workbench load restores the newest tracked mainline job when one exists
- the restored job uses the existing `GET /jobs/:id` path and carries
  `execution_tracking`
- hydration failures stay fail-open and do not break workspace loading
- no candidate job means the existing workspace-load behavior remains unchanged

## 7. Out Of Scope

This phase does not include:

- new backend routes
- job list APIs
- new workbench panels
- replay controls
- queue mutation
- scheduling changes

## 8. Related Capability Ownership

This phase continues the same `Execution And Orchestration Platform` lane after
`Phase 14` by making workbench reload and restart paths recover the latest
tracked execution context from existing durable read models, without widening
authority or adding a new surface.
