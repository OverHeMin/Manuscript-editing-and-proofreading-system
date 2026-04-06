# Phase 26 Manuscript Mainline Internal Trial Readiness Summary Design

**Date:** 2026-04-06  
**Status:** Proposed for immediate implementation after Phase 25  
**Primary capability lane:** Execution And Orchestration Platform  
**Scope:** Add one additive, read-only `mainline_readiness_summary` on the existing manuscript mainline read path and adopt it inside the current manuscript workbench summary so operators can judge restart-safe execution posture, next-step readiness, and degraded-state explainability without opening a new control surface.

## 1. Goal

`Phase 16-25` made the manuscript workbench increasingly honest about settlement,
recovery, readiness, action-time hydration, reload-time hydration, fallback
posture, notice wording, and compact pills.

That left one broader operator gap:

- the evidence exists
- the workbench can show many of the details
- but the operator still has to mentally reconstruct one top-level answer:
  - is the manuscript mainline ready to proceed
  - waiting on unsettled follow-up
  - blocked for operator attention
  - or already fully settled

In one sentence:

`Phase 26` should collapse existing mainline settlement, recovery, and runtime
readiness signals into one additive read-only readiness summary on the current
manuscript path, then let the current workbench adopt that summary instead of
repeating scattered local heuristics.

## 2. Why This Phase Exists

The current workbench is already rich, but still fragmented:

- `Manuscript Overview` shows per-module posture
- `Latest Job` shows detailed posture
- `Latest Action Result` shows detailed posture
- `Recommended Next Step` tries to infer readiness from several local branches

This works, but it is still not a clean operator summary for controlled internal
trial readiness. The same mainline decision is currently spread across:

- module settlement status
- linked recovery posture
- recovery timing
- runtime-binding readiness posture
- latest hydrated job fallback
- mode-specific recommendation branches

That makes the current path readable, but not yet consolidated.

This phase closes that gap with one additive read model:

- derived from existing manuscript/job/snapshot evidence only
- fail-open by design
- readable after reload/restart
- usable from the current manuscript workbench summary path
- not a replay, routing, or release control plane

## 3. Options Considered

### Option A: Keep all readiness interpretation frontend-local

Pros:

- no backend contract changes

Cons:

- keeps readiness semantics duplicated in the web layer
- makes the mainline contract less stable for future workbench adoption
- continues the current pattern of scattered heuristics

Not recommended for this phase.

### Option B: Add one additive manuscript mainline readiness summary and adopt it in the current workbench

Pros:

- keeps the change on existing manuscript/job/workbench paths
- creates one stable read model for controlled internal-trial posture
- reduces frontend-only inference drift
- remains strictly read-only and fail-open

Cons:

- requires one additive manuscript view-model extension and local web adoption

Recommended.

### Option C: Add a new readiness dashboard or trial-entry console

Pros:

- more room for future operational detail

Cons:

- widens surface area
- risks becoming a new control plane
- breaks the current boundary preference

Out of scope.

## 4. Hard Boundaries

### 4.1 Existing read paths only

This phase may extend only the existing:

- `GET /api/v1/manuscripts/:manuscriptId`
- current manuscript workbench workspace load path
- current manuscript workbench summary rendering path

It must not add:

- new manuscript routes
- new job routes
- new orchestration inspection endpoints

### 4.2 Read-only only

This phase may:

- derive a summary from already-available evidence
- explain readiness posture
- expose the next mainline step or current blocker
- surface bounded recovery timing and degraded-state wording

It must not:

- replay recovery
- mutate routing
- publish policy
- activate release actions
- turn Evaluation Workbench into any form of control plane

### 4.3 Fail-open only

If summary derivation fails:

- manuscript reads still succeed
- existing `module_execution_overview` still remains available
- the web layer falls back to the current local heuristics
- missing summary data becomes omission or explicit failed-open wording

### 4.4 Local-first only

This phase must stay inside repo-owned services and the current local HTTP/web
stack.

No cloud dependency, hosted control plane, or harness dependency may become part
of the synchronous manuscript path.

## 5. Proposed Read Model

### 5.1 New additive manuscript field

Add one additive manuscript view-model field:

- `mainline_readiness_summary`

Recommended shape:

- `observation_status`
  - `reported`
  - `failed_open`
- `derived_status`
  - `ready_for_next_step`
  - `in_progress`
  - `waiting_for_follow_up`
  - `attention_required`
  - `completed`
- `active_module`
  - the module currently running or blocking progress when applicable
- `next_module`
  - the next mainline module when applicable
- `recovery_ready_at`
  - when the blocking posture has a concrete next-ready time
- `runtime_binding_status`
  - compact readiness posture for the blocking module when a runtime signal is
    already available through current snapshot-linked evidence
- `runtime_binding_issue_count`
  - compact issue count when degraded or missing
- `reason`
  - operator-readable explanation
- `error`
  - fail-open explanation when observation could not be derived

### 5.2 Derivation rules

The summary should be derived from the existing `module_execution_overview`
already built on the manuscript read path.

Recommended precedence:

1. If any needed module overview is `failed_open`, return
   `observation_status=failed_open`.
2. Walk the mainline module order: `screening -> editing -> proofreading`.
3. For the first module that is not yet fully settled:
   - `not_started` => `ready_for_next_step` with `next_module`
   - `job_in_progress` => `in_progress` with `active_module`
   - `business_completed_follow_up_pending` or
     `business_completed_follow_up_running` => `waiting_for_follow_up`
   - `business_completed_follow_up_retryable`,
     `business_completed_follow_up_failed`,
     `business_completed_unlinked`,
     `job_failed` => `attention_required`
4. If all three modules are settled, return `completed`.

The summary should reuse existing recovery timing and runtime-binding posture
when the blocking module already has snapshot-linked evidence.

## 6. Proposed Workbench Adoption

### 6.1 Manuscript Overview card

Add bounded metrics to the existing `Manuscript Overview` card:

- `Mainline Readiness`
- `Active Module` or `Next Module` when available
- `Readiness Reason`
- `Recovery Ready At` when present
- `Runtime Readiness` when summary reports degraded or missing posture

This keeps the adoption inside an existing card rather than creating a new panel.

### 6.2 Recommended Next Step

Let the existing `Recommended Next Step` path prefer
`mainline_readiness_summary` when it cleanly applies to the current mode, while
preserving the current mode-specific fallback logic for:

- submission export/handoff
- proofreading finalize/human-final/export states after mainline completion
- any failed-open summary scenario

This keeps the phase broad enough to be meaningful without forcing a larger
workbench rewrite.

### 6.3 Reload and refresh explainability

When the workbench restores a manuscript workspace or refreshes latest-job
context, append readiness-summary details to the action/read results when that
summary is reported.

That keeps restart-safe re-entry readable at the top of the existing page path.

## 7. Display Semantics

Recommended compact labels:

- `ready_for_next_step` => `Ready for next step`
- `in_progress` => `In progress`
- `waiting_for_follow_up` => `Waiting for follow-up`
- `attention_required` => `Attention required`
- `completed` => `Mainline settled`
- `failed_open` => `Readiness unavailable`

Recommended module wording:

- `Next Module: screening|editing|proofreading`
- `Active Module: screening|editing|proofreading`

Recommended runtime wording:

- `Ready`
- `Degraded (N issues)`
- `Missing (N issues)`
- `Observation unavailable (failed open)` only when the summary itself is
  reported and the compact runtime observation is the degraded detail

## 8. Testing Expectations

Phase 26 should prove all of the following:

- manuscript reads expose a reported mainline readiness summary when module
  overview is sufficient
- summary derivation fails open rather than blocking manuscript reads
- readiness summary chooses the first unsettled mainline stage correctly
- workbench overview renders readiness summary metrics without creating a new
  panel
- workbench recommendation uses the summary for the mainline path when available
- reload/refresh action results append readiness summary details when available
- missing or failed-open summary data falls back safely to the current behavior

## 9. Out Of Scope

Phase 26 does not include:

- new pages, panels, or consoles
- new control-plane actions
- replay or retry triggers
- new queue ownership or scheduling depth
- new routing, release, or evaluation authority
- automatic model switching, automatic publishing, or automatic learning writeback

## 10. Related Capability Ownership

This phase continues the same `Execution And Orchestration Platform` lane after
`Phase 25` by turning the current manuscript mainline posture signals into one
stable readiness summary and adopting that summary inside the existing workbench
path, without widening mutation authority or introducing a new control surface.
