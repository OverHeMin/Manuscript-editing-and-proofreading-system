# Phase 23 Manuscript Workbench Action-Result Overview Posture Fallback Design

**Date:** 2026-04-06  
**Status:** Proposed for immediate implementation after Phase 22  
**Primary capability lane:** Execution And Orchestration Platform  
**Scope:** Keep the existing `Latest Action Result` card posture-aware when a workbench action or workspace load fails open to a raw job without `execution_tracking`, by reusing the matching reported manuscript overview posture for that same job.

## 1. Goal

`Phase 18` made `Latest Action Result` adopt hydrated job posture.
`Phase 20`, `Phase 21`, and `Phase 22` then extended the same read-only posture
story across recommendation, overview, and latest-job fallback paths.

One adjacent gap still remains:

- action-time and load-time helpers still append posture details only when the
  returned job is hydrated with `execution_tracking`
- the same helpers fail open to raw base details when the job read falls back
  to `module_execution_overview.latest_job`
- the matching reported overview often already contains settlement, recovery,
  readiness, and snapshot posture for that same job

In one sentence:

`Phase 23` should let the current `Latest Action Result` details reuse matching
reported overview posture when the action result is pinned to a raw fallback job
without hydrated execution tracking.

## 2. Why This Phase Exists

The current workbench still has one remaining inconsistency inside the same
fail-open path:

- `Recommended Next Step` can already stay posture-aware through overview and
  latest-job fallback
- `Manuscript Overview` can already stay posture-aware through latest-job
  fallback
- `Latest Job` can already stay posture-aware through overview fallback
- `Latest Action Result` still collapses to raw `Job` / `Status` rows when the
  same job lost `execution_tracking` during fail-open hydration

That means the card that explains "what just happened" can become the least
informative card in the exact degraded cases where operators need explanation
the most.

This is the next clean mainline slice because it:

- stays inside the current manuscript workbench
- reuses existing read models already present in the workspace payload
- remains fully read-only and fail-open

## 3. Options Considered

### Option A: Keep `Latest Action Result` raw when the job is not hydrated

Pros:

- no implementation change

Cons:

- action-time and load-time operator feedback remains under-explained
- the last major summary card still diverges from the same posture model now
  used elsewhere

Not recommended.

### Option B: Reuse matching manuscript overview posture in action-result detail builders

Pros:

- reuses the same overview settlement, recovery, readiness, and snapshot
  evidence already present on the current workspace
- keeps the change local to existing page-side result builders and shared
  formatter helpers
- preserves hydrated-job-first behavior

Cons:

- adds one small fallback helper path

Recommended.

### Option C: Retry hydration from inside the action-result path

Pros:

- could restore the fully hydrated job in more cases

Cons:

- adds new request choreography to an otherwise read-only result path
- weakens the current fail-open boundary

Out of scope.

## 4. Hard Boundaries

### 4.1 Existing action-result surface only

This phase should update only:

- the existing `Latest Action Result` detail construction path
- shared posture formatter helpers already used by the workbench

It must not add:

- a new page
- a new panel
- a new action-history surface
- new request choreography

### 4.2 Hydrated job still wins

The priority order for job-bearing action results should become:

1. hydrated `job.execution_tracking`
2. matching reported `module_execution_overview[module]` for that same job
3. existing raw base detail rows

This phase must not replace or weaken the current hydrated-job path.

### 4.3 Matching overview only

Overview fallback should apply only when:

- the action result job lacks `execution_tracking`
- a `module_execution_overview[module]` entry exists
- that entry is `reported`
- `overview.latest_job.id === job.id`

This keeps fallback narrow and explainable.

### 4.4 Fail-open only

If there is no matching reported overview posture:

- the current base action-result details remain
- the workbench still renders normally
- no new error or blocking state is introduced

### 4.5 Read-only only

This phase may improve:

- action-result explainability
- consistency across current summary cards
- recovery/readiness visibility during fail-open job fallback

It must not:

- add replay, retry, routing, or runtime controls
- mutate orchestration or governance state
- change backend routes or persistence

## 5. Proposed Changes

### 5.1 Extend shared job-posture detail builders with optional overview fallback

Update the existing shared job-posture detail helper so it can optionally accept
manuscript `module_execution_overview`.

When the job lacks `execution_tracking`, the helper should:

- find the matching reported module overview for `job.module`
- verify the overview `latest_job.id` matches the current job
- append the same action-result detail vocabulary already used for hydrated jobs
  where practical:
  - `Settlement`
  - `Recovery`
  - `Recovery Ready At`
  - `Runtime Readiness`

Snapshot id may remain out of scope for action-result details if it would widen
the existing detail contract more than necessary.

### 5.2 Reuse the fallback in existing job-bearing action results

Adopt the fallback-aware helper for the existing job-bearing action-result paths:

- `Load Workspace`
- `Upload Manuscript`
- `Run Screening`
- `Run Editing`
- `Create Draft`
- `Finalize Proofreading`
- `Publish Human Final`
- `Refresh Latest Job`

The current display order should stay:

1. action-specific base details
2. posture details appended after them

### 5.3 Keep non-job actions unchanged

This phase should not change:

- file-attach action results
- export-only action results
- any non-job result card wording

## 6. Testing Expectations

Phase 23 should prove all of the following:

- load-time action results reuse overview posture when latest-job hydration
  fails open to a raw overview candidate
- job-bearing action-result helpers reuse overview posture when the action
  returns a raw job that matches reported overview posture
- hydrated execution tracking still wins over overview fallback
- missing or non-matching overview posture keeps the current base detail rows
  unchanged

## 7. Out Of Scope

Phase 23 does not include:

- backend route or persistence changes
- new workbench pages, panels, or dashboards
- new action-history persistence
- controller-level retry/replay behavior changes
- replay, retry, routing, or runtime mutation authority

## 8. Related Capability Ownership

This phase continues the same `Execution And Orchestration Platform` lane after
`Phase 22` by keeping the existing `Latest Action Result` card posture-aware
under the current raw-job fail-open path, without widening authority or opening
any new surface.
