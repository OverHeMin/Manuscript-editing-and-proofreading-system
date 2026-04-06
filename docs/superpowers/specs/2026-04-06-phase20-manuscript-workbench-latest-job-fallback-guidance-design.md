# Phase 20 Manuscript Workbench Latest-Job Fallback Guidance Design

**Date:** 2026-04-06  
**Status:** Proposed for immediate implementation after Phase 19  
**Primary capability lane:** Execution And Orchestration Platform  
**Scope:** Make the existing `Recommended Next Step` logic fall back to hydrated `latestJob.execution_tracking` when manuscript `module_execution_overview` is missing or failed-open, so recommendation guidance stays posture-aware on the current workbench path.

## 1. Goal

`Phase 17` hydrated action-time jobs.
`Phase 18` adopted hydrated job posture into `Latest Action Result`.
`Phase 19` resynchronized workspace after refresh when possible.

One recommendation gap still remains:

- `Recommended Next Step` prefers `module_execution_overview`
- but when that overview is missing or failed-open, screening and editing still
  fall back to the old heuristic `latestJob.status === "completed"`
- that heuristic can overstate readiness even when hydrated latest-job tracking
  already says `follow_up_pending`, `follow_up_retryable`, or `follow_up_failed`

In one sentence:

`Phase 20` should make the current workbench use hydrated latest-job execution
tracking as the read-only recommendation fallback before it falls all the way
back to raw job-status heuristics.

## 2. Why This Phase Exists

The current workbench already has richer data than its fallback guidance uses:

- `Latest Job` can show settlement, recovery, and runtime readiness
- `Latest Action Result` can show the same posture
- but `Recommended Next Step` can still ignore that posture if
  `module_execution_overview` is unavailable

That means the workbench can still tell the operator:

- `Latest Job`: business complete, follow-up retryable
- `Recommended Next Step`: advance directly to the next stage

This is the next clean mainline gap to close because it affects operator
guidance directly while staying entirely within read-only adoption.

## 3. Options Considered

### Option A: Keep heuristic fallback based on raw latest job status

Pros:

- no implementation change

Cons:

- recommendation can remain overly optimistic
- workbench ignores already-available execution posture

Not recommended.

### Option B: Use hydrated latest-job execution tracking as fallback guidance

Pros:

- reuses existing hydrated job read model only
- keeps all logic inside the current workbench summary layer
- preserves fail-open fallback when job tracking is missing

Cons:

- adds one more recommendation helper path to maintain

Recommended.

### Option C: Force workspace overview to be present before rendering guidance

Pros:

- one source of truth

Cons:

- creates a de facto hard dependency on workspace overview completeness
- violates fail-open expectations for the current phase lane

Out of scope.

## 4. Hard Boundaries

### 4.1 Summary-layer only

This phase should update only the current recommendation logic in the existing
workbench summary layer.

It must not add:

- new routes
- new page or panel surfaces
- new request choreography

### 4.2 Fallback only

The priority order should become:

1. `module_execution_overview`
2. hydrated `latestJob.execution_tracking`
3. existing raw latest-job heuristic
4. existing current-asset / suggested-parent fallback

This phase must not replace or weaken the existing overview-first model.

### 4.3 Fail-open only

If `latestJob.execution_tracking` is missing, not tracked, or failed-open:

- the current heuristic fallback should remain
- the workbench should not block or degrade into error

### 4.4 Read-only only

This phase may improve:

- recommendation accuracy
- recommendation detail wording
- guidance consistency with latest-job posture

It must not:

- add replay, retry, or routing controls
- mutate orchestration or governance state

## 5. Proposed Changes

### 5.1 Add one latest-job tracking recommendation helper

Introduce one helper that:

- checks whether the latest job belongs to the current module
- checks whether `execution_tracking.observation_status === "reported"`
- derives recommendation focus/guidance/details from the linked settlement,
  recovery, and runtime readiness posture

This helper should be used only when overview-based recommendation is
unavailable.

### 5.2 Reuse the current settlement language

The latest-job fallback should reuse the same posture vocabulary already used by
overview-driven recommendation:

- settled => advance
- follow-up pending/running => wait
- follow-up retryable => inspect follow-up before handoff
- follow-up failed => inspect failure before handoff
- unlinked => inspect linkage before handoff
- job failed => inspect failed run
- in progress => wait for completion

### 5.3 Keep raw heuristic fallback as the last resort

If latest-job tracking is not available, keep the current behavior:

- completed screening/editing jobs can still suggest the next stage
- current asset and suggested parent still provide the final fallback context

## 6. Testing Expectations

Phase 20 should prove all of the following:

- when overview is failed-open or missing but latest-job tracking is available,
  recommendation uses latest-job posture rather than raw `completed`
- retryable latest-job posture does not produce an advance-to-next-stage
  shortcut
- settled latest-job posture can still produce the correct shortcut and richer
  details
- missing latest-job tracking continues to fail open to the current heuristic

## 7. Out Of Scope

Phase 20 does not include:

- backend route or persistence changes
- controller or page request-flow changes
- new recommendation panels or debug surfaces
- replay, retry, routing, or runtime mutation authority

## 8. Related Capability Ownership

This phase continues the same `Execution And Orchestration Platform` lane after
`Phase 19` by making current workbench guidance consume hydrated latest-job
posture before falling back to raw heuristics, without widening authority or
opening a new surface.
