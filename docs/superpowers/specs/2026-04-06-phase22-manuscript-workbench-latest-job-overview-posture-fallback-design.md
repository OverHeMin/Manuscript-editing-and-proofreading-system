# Phase 22 Manuscript Workbench Latest-Job Overview Posture Fallback Design

**Date:** 2026-04-06  
**Status:** Proposed for immediate implementation after Phase 21  
**Primary capability lane:** Execution And Orchestration Platform  
**Scope:** Keep the existing `Latest Job` card posture-aware when the workbench is fail-opened onto a raw `module_execution_overview.latest_job` candidate by reusing the matching reported overview posture for that same job.

## 1. Goal

`Phase 15` and later work already made the page try to hydrate the latest
mainline job.

When that hydration fails, the page now fails open to the manuscript overview's
`latest_job` candidate instead of dropping job visibility entirely.

One posture gap still remains:

- the `Latest Job` card can show raw job id/module/status from that candidate
- but it loses settlement, recovery, runtime readiness, and snapshot posture
  because the fallback candidate does not carry `execution_tracking`
- the matching manuscript overview already has that posture on the same module

In one sentence:

`Phase 22` should let the current `Latest Job` card reuse matching reported
module overview posture when the card is showing a fail-open raw latest-job
candidate without hydrated execution tracking.

## 2. Why This Phase Exists

The current workbench already preserves useful latest-job identity after a
hydration failure, but not the rest of the durable execution story:

- `Latest Job` still looks partially blind
- `Manuscript Overview` can now show posture fallback after `Phase 21`
- `Recommended Next Step` can already follow posture after `Phase 20`

That leaves one inconsistency:

- the top-level summary cards may say the module is retryable or settled
- while `Latest Job` itself still looks like a plain raw job record

This is the next clean mainline gap because it stays entirely inside the
existing summary card and reuses read models already present in the current
workspace payload.

## 3. Options Considered

### Option A: Keep the Latest Job card raw when execution tracking is absent

Pros:

- no implementation change

Cons:

- fail-open job fallback stays much less informative than adjacent cards
- operators lose posture exactly when hydration is degraded

Not recommended.

### Option B: Reuse matching module overview posture in the existing Latest Job card

Pros:

- reuses existing overview settlement, recovery, runtime readiness, and snapshot
- keeps the change local to the summary layer
- preserves hydrated-job-first behavior

Cons:

- adds one small fallback metric path

Recommended.

### Option C: Re-run job hydration from the summary card

Pros:

- could restore the fully hydrated job view

Cons:

- adds request choreography to a read-only render path
- weakens the current fail-open boundary

Out of scope.

## 4. Hard Boundaries

### 4.1 Existing Latest Job card only

This phase should update only:

- the existing `Latest Job` card metric rendering

It must not add:

- new routes
- new pages or panels
- new request choreography

### 4.2 Hydrated job stays first

The priority order should become:

1. hydrated `latestJob.execution_tracking`
2. matching reported `module_execution_overview[module]` for that same job
3. existing raw job-only card

This phase must not replace or weaken the current hydrated-job path.

### 4.3 Fail-open only

If there is no matching reported overview posture:

- the current raw latest-job card should remain
- the workbench should not block or degrade into error

### 4.4 Read-only only

This phase may improve:

- latest-job explainability
- posture visibility during hydration degradation
- consistency across summary cards

It must not:

- add replay, retry, or routing controls
- mutate orchestration or governance state

## 5. Proposed Changes

### 5.1 Add one Latest Job posture fallback helper

Introduce one helper that:

- checks whether the current `latestJob` lacks `execution_tracking`
- finds the matching module overview for `latestJob.module`
- confirms the overview is `reported`
- confirms the overview's `latest_job.id` matches the current `latestJob.id`

### 5.2 Reuse current metric vocabulary

When the fallback helper matches, the `Latest Job` card should render the same
metric labels it already uses for hydrated execution tracking where possible:

- `Execution Settlement`
- `Recovery Posture`
- `Recovery Ready At`
- `Runtime Binding Readiness`
- `Execution Snapshot`

These values should come from the overview posture helpers already used
elsewhere in the summary layer.

### 5.3 Keep raw card output as the last fallback

If neither hydrated tracking nor matching overview posture is available:

- keep the current raw job-only card
- do not add a new error state

## 6. Testing Expectations

Phase 22 should prove all of the following:

- a raw latest-job fallback candidate can still render posture metrics from a
  matching reported module overview
- hydrated execution tracking still wins over overview fallback
- a missing or non-matching overview leaves the current raw latest-job card
  unchanged

## 7. Out Of Scope

Phase 22 does not include:

- backend route or persistence changes
- page/controller hydration changes
- overview-card rendering changes beyond the already-landed Phase 21 behavior
- recommendation logic changes beyond the already-landed Phase 20 behavior
- replay, retry, routing, or runtime mutation authority

## 8. Related Capability Ownership

This phase continues the same `Execution And Orchestration Platform` lane after
`Phase 21` by keeping the existing latest-job card posture-aware under the
current fail-open overview-job fallback path, without widening authority or
opening a new surface.
