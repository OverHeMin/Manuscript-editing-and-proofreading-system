# Phase 21 Manuscript Workbench Overview Latest-Job Fallback Visibility Design

**Date:** 2026-04-06  
**Status:** Proposed for immediate implementation after Phase 20  
**Primary capability lane:** Execution And Orchestration Platform  
**Scope:** Keep the existing `Manuscript Overview` module-settlement metrics readable and explainable when manuscript overview observation is missing or degraded by falling back to hydrated `latestJob.execution_tracking` for the matching module.

## 1. Goal

`Phase 20` made `Recommended Next Step` posture-aware even when
`module_execution_overview` is missing or `failed_open`.

One mainline readability gap still remains:

- the `Latest Job` card can show settlement, recovery, and runtime readiness
- the recommendation can now use that posture as a fallback
- but the `Manuscript Overview` card can still show either nothing or a degraded
  `failed open` / `not started` module line for that same module

In one sentence:

`Phase 21` should let the current workbench keep showing module-level posture on
the overview card by falling back to the hydrated latest-job tracking for the
matching module before it gives up to fail-open text.

## 2. Why This Phase Exists

The workbench now has a split operator story when overview observation is
incomplete:

- `Latest Job` says what durable execution posture exists
- `Recommended Next Step` can follow that posture
- `Manuscript Overview` still loses that posture or renders only degraded
  observation text

That means the highest-level overview card can remain the least informative
surface in exactly the restart-safe / fail-open cases the current lane is meant
to improve.

This is the next clean mainline gap because it stays on the same summary card,
stays read-only, and improves explainability without adding a new panel or new
backend contract.

## 3. Options Considered

### Option A: Leave overview metrics tied only to `module_execution_overview`

Pros:

- no implementation change

Cons:

- overview card remains less readable than the latest-job card
- restart-safe observation still feels inconsistent across summary surfaces

Not recommended.

### Option B: Add latest-job tracking fallback inside the existing overview metrics

Pros:

- reuses already-hydrated job posture only
- keeps the change local to the summary layer
- preserves fail-open behavior when tracking is absent

Cons:

- adds one compact fallback formatter path

Recommended.

### Option C: Add a separate execution-status panel

Pros:

- more room for detail

Cons:

- widens UI surface area
- drifts toward a new workbench surface for information that should still fit in
  the existing summary

Out of scope.

## 4. Hard Boundaries

### 4.1 Existing summary card only

This phase should update only:

- the existing `Manuscript Overview` module metrics

It must not add:

- new pages
- new panels
- new routes
- new request choreography

### 4.2 Overview-first priority remains

The rendering order should become:

1. `module_execution_overview[module]` when `observation_status === "reported"`
2. matching hydrated `latestJob.execution_tracking` when it is `reported`
3. existing fail-open / missing overview text

This phase must not replace or weaken the existing overview-first model.

### 4.3 Fail-open only

If `latestJob.execution_tracking` is missing, not tracked, or failed-open:

- the current overview text should remain
- the workbench should not block or degrade into error

### 4.4 Read-only only

This phase may improve:

- overview readability
- posture explainability
- consistency between overview and latest-job cards

It must not:

- add replay, retry, or routing controls
- mutate orchestration or governance state

## 5. Proposed Changes

### 5.1 Keep module metrics visible even without manuscript overview payload

The overview card should continue rendering module settlement lines for:

- `screening`
- `editing`
- `proofreading`

When manuscript overview is absent, those lines should degrade gracefully
instead of disappearing entirely.

### 5.2 Add one compact latest-job fallback formatter

Introduce one helper that:

- checks whether the latest hydrated job belongs to the rendered module
- checks whether `execution_tracking.observation_status === "reported"`
- builds one compact overview string from settlement, recovery, runtime
  readiness, and snapshot state
- marks that string as coming from the latest tracked job so the source remains
  explainable

### 5.3 Preserve current wording where possible

The fallback formatter should reuse the current compact posture vocabulary:

- settlement labels from the existing settlement formatter
- recovery posture from the existing recovery formatter
- runtime readiness from the compact runtime formatter where possible

The new string may append a short source hint such as `latest tracked job` so
operators can tell this is a fallback read model, not the overview payload.

## 6. Testing Expectations

Phase 21 should prove all of the following:

- when a module overview is `failed_open` but matching latest-job tracking is
  available, the overview metric renders posture-aware fallback text
- when the manuscript overview payload is missing, the overview card still
  renders module settlement lines and uses latest-job tracking for the matching
  module
- when latest-job tracking is not available, current fail-open overview text
  remains unchanged

## 7. Out Of Scope

Phase 21 does not include:

- backend route or persistence changes
- controller or page request-flow changes
- recommendation logic changes beyond the already-landed Phase 20 behavior
- new summary panels or debug surfaces
- replay, retry, routing, or runtime mutation authority

## 8. Related Capability Ownership

This phase continues the same `Execution And Orchestration Platform` lane after
`Phase 20` by keeping the current workbench overview card readable from existing
durable latest-job posture when overview observation is incomplete, without
widening authority or opening a new surface.
