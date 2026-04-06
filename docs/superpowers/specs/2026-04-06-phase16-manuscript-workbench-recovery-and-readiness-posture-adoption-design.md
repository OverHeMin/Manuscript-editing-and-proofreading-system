# Phase 16 Manuscript Workbench Recovery And Readiness Posture Adoption Design

**Date:** 2026-04-06  
**Status:** Proposed for immediate implementation after Phase 15  
**Primary capability lane:** Execution And Orchestration Platform  
**Scope:** Adopt the existing execution recovery and runtime-readiness read models into the current manuscript workbench so restored latest-job context is readable, explainable, and strictly read-only on the main operator path.

## 1. Goal

`Phase 14` made the manuscript workbench read settlement.
`Phase 15` made the workbench restore the newest tracked mainline job after reload.

One operator-facing interpretation gap still remains:

- the workbench can restore a latest tracked job, but still mostly explains it as
  raw `job.status` plus coarse settlement text
- retryable, stale-running, waiting-retry, and waiting-running-timeout posture
  remain trapped inside linked `recovery_summary`
- runtime binding readiness posture remains trapped inside linked
  `runtime_binding_readiness`

In one sentence:

`Phase 16` should make the existing manuscript workbench explain restored
execution posture through the current read-only cards, without adding a new
panel, route, or control surface.

## 2. Why This Phase Exists

The execution/orchestration mainline already has the needed evidence:

- `11G` added linked per-log recovery posture
- `11A-11E` added runtime-binding readiness posture
- `12-15` lifted that evidence onto snapshots, manuscript/job reads, settlement
  adoption, and restart-safe latest-job hydration

But on the main workbench path, operators still cannot directly answer:

- is this follow-up retryable and ready now, or still waiting until a retry
  window opens?
- is this running follow-up still fresh, or already reclaimable if recovery is
  needed?
- is the restored job healthy from a runtime-binding perspective, or is the
  current active binding degraded/missing?

This phase closes that interpretation gap using the existing read model only.

## 3. Options Considered

### Option A: Keep recovery/readiness posture in debug JSON only

Pros:

- no UI code changes

Cons:

- leaves the main operator path under-explained
- reduces the practical value of restart-safe hydration

Not recommended.

### Option B: Adopt recovery/readiness posture into the current workbench summary cards

Pros:

- preserves the current workbench surface
- makes restored execution context understandable immediately after reload
- stays fully read-only

Cons:

- requires a small frontend typing and formatter update

Recommended.

### Option C: Add a dedicated recovery or readiness panel

Pros:

- could show more future detail

Cons:

- expands UI surface area
- risks drifting toward a new operations/control plane
- is heavier than the current adoption need

Out of scope.

## 4. Hard Boundaries

### 4.1 Existing workbench surface only

This phase may update only the current:

- `Latest Action Result`
- `Recommended Next Step`
- `Manuscript Overview`
- `Latest Job`

It must not add:

- a new page
- a new recovery panel
- a new readiness dashboard

### 4.2 Read-only only

This phase may:

- rephrase guidance
- show recovery posture
- show readiness posture
- expose next-ready timestamps

It must not:

- add replay, retry, queue, or dispatch actions
- change routing governance behavior
- promote the workbench into a recovery control plane

### 4.3 Existing read paths only

This phase should consume only data already available through the current:

- `GET /api/v1/manuscripts/:manuscriptId`
- `GET /api/v1/jobs/:jobId`

No backend route expansion is required.

### 4.4 Fail-open only

If recovery or readiness posture is missing, partial, or failed open:

- the workbench still loads
- current settlement and heuristic guidance still render
- the new posture details degrade to omission or explicit fail-open wording

## 5. Proposed Frontend Changes

### 5.1 Tighten workbench-facing types

Replace generic `Record<string, unknown>` placeholders in the web manuscript
types with explicit additive view models for:

- linked agent execution recovery summary
- runtime binding readiness report
- readiness issues and execution-profile alignment

This keeps the UI adaptation local and avoids repeated unsafe field access.

### 5.2 Explain restored latest-job posture in load results

When `loadPrefilledWorkbenchWorkspace(...)` restores a latest tracked job:

- keep the current `Latest Job` detail
- add settlement, recovery, and readiness details when they are available

This ensures reload/restoration immediately tells the operator not only which
job was restored, but also what posture it is currently in.

### 5.3 Deepen manuscript overview with posture-aware summaries

Keep the current per-module settlement row layout, but enrich the rendered
summary string when snapshot evidence is present:

- settlement label
- recovery posture label when linked execution recovery exists
- `ready_at` timing when recovery is blocked but has a concrete next-ready time
- readiness posture label when runtime binding readiness is `degraded` or
  `missing`
- latest job status and snapshot id as today

The rendering should stay compact and operator-readable.

### 5.4 Deepen recommended next-step details without adding authority

For module recommendations derived from settlement:

- keep the current handoff/no-handoff behavior
- add recovery posture and readiness details when available
- prefer explanatory wording such as `ready now`, `waiting until ...`,
  `attention required`, or `binding degraded`

Important:

- recommendation detail may mention recovery posture
- recommendation action must remain the existing workbench shortcut or no action
- no recovery trigger button is added

### 5.5 Deepen latest-job card with posture details

When `latestJob.execution_tracking` is present, the `Latest Job` card should add:

- execution settlement
- recovery posture
- recovery ready-at timestamp when present
- runtime binding readiness
- readiness issues count or concise degraded/missing wording when relevant

This keeps raw job status clearly separate from durable follow-up posture.

## 6. Display Semantics

Recommended concise operator-facing labels:

- recovery:
  - `Ready now`
  - `Waiting for retry window`
  - `Waiting for running-timeout window`
  - `Attention required`
  - `Not recoverable`
- readiness:
  - `Ready`
  - `Degraded`
  - `Missing`

Recommended timing rule:

- only show `ready_at` when the recovery summary provides a concrete timestamp

Recommended readiness rule:

- `ready` may be shown briefly or omitted in compact module-overview text
- `degraded` and `missing` should always remain visible when reported

## 7. Testing Expectations

Phase 16 should prove all of the following:

- load-result details include restored latest-job recovery/readiness posture
  when tracked execution context is available
- latest-job summary renders recovery posture, ready-at timing, and readiness
  posture alongside raw job status
- module-overview settlement text incorporates recovery/readiness posture when
  snapshot-linked execution evidence exists
- recommendation details stay read-only while becoming more explanatory
- fail-open or missing posture data does not break the page and falls back
  safely

## 8. Out Of Scope

Phase 16 does not include:

- new backend routes
- replay or retry controls
- queue-state mutation
- runtime binding mutation
- new panels or dashboards
- new orchestration persistence

## 9. Related Capability Ownership

This phase continues the same `Execution And Orchestration Platform` lane after
`Phase 15` by turning restart-safe restored execution context into operator-
readable recovery/readiness posture on the existing manuscript workbench path,
without widening authority or introducing a new control surface.
