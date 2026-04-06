# Phase 14 Manuscript Workbench Settlement Adoption Design

**Date:** 2026-04-06  
**Status:** Proposed for immediate implementation after Phase 13  
**Primary capability lane:** Execution And Orchestration Platform  
**Scope:** Adopt the additive `Phase 13` manuscript/job settlement read model inside the existing manuscript workbench so operator guidance and stage-state summaries reflect durable business-versus-orchestration posture instead of heuristic `latestJob/currentAsset` guesses.

## 1. Goal

`Phase 13` put per-module settlement visibility onto:

- `GET /manuscripts/:id`
- `GET /jobs/:id`

But the manuscript workbench still mostly decides next-step guidance from:

- `latestJob`
- `current_*_asset_id`
- `latestProofreadingDraftAsset`

That means the UI can still miss important mainline distinctions such as:

- business output exists but orchestration is still pending
- the latest job failed but an older settled snapshot still exists
- proofreading draft is complete but the final confirmation path is still the real blocker

In one sentence:

`Phase 14` should make the existing manuscript workbench summary and guidance consume `module_execution_overview` and `execution_tracking` directly.

## 2. Why This Phase Exists

The repository now has a clean mainline settlement story on the API side, but
the primary business-facing UI has not adopted it yet.

Without this phase:

- operators still see heuristic guidance instead of the new durable settlement view
- the workbench can over-trust the latest job status
- the practical value of `Phase 13` stays trapped behind raw JSON

This phase closes that adoption gap without creating a new panel or changing
any control-plane authority.

## 3. Options Considered

### Option A: Keep the workbench on heuristics and reserve settlement for debug views only

Pros:

- no frontend changes

Cons:

- wastes the mainline API improvement
- operators still cannot trust UI guidance for orchestration posture

Not recommended.

### Option B: Adopt settlement in the existing manuscript workbench summary and recommendation logic

Pros:

- preserves current workbench surface
- directly improves the main operator path
- keeps all behavior read-only

Cons:

- requires updating workbench types and summary logic

Recommended.

### Option C: Build a separate settlement panel or ledger page

Pros:

- more room for future detail

Cons:

- adds UI surface area
- risks drifting toward a new control plane
- is heavier than the current adoption need

Out of scope.

## 4. Hard Boundaries

### 4.1 Existing workbench only

This phase should update:

- the current manuscript workbench summary
- existing guidance text and latest-job presentation

It must not add:

- a new operations page
- a new settlement panel
- any control-plane action

### 4.2 Read-only only

This phase may:

- re-rank or rewrite guidance text
- show richer state labels
- render settlement details

It must not:

- change module run requests
- change manuscript/job APIs
- add queue mutation or replay authority

### 4.3 Fail-open only

If settlement data is missing or failed open:

- the workbench still loads
- existing manuscript and asset context still render
- UI falls back to the safest existing heuristic guidance

## 5. Proposed Frontend Changes

### 5.1 Workbench types

Extend the web `ManuscriptViewModel` and `JobViewModel` with the `Phase 13`
fields already emitted by the API:

- `module_execution_overview`
- `execution_tracking`

The frontend should mirror the additive API contract rather than collapsing it
into one lossy status string.

### 5.2 Summary card adoption

Update the summary experience so:

- `Latest Job` remains visible as attempt-level evidence
- `Recommended Next Step` uses module settlement first, not just raw latest job
- `Manuscript Overview` or a nearby card shows per-module settlement posture in
  a compact operator-readable form

Recommended display order:

- `screening`
- `editing`
- `proofreading`

Each module should show:

- whether the module has not started, is in progress, failed, business-complete
  but follow-up-open, or fully settled
- the latest job id/status when available
- the latest snapshot id when available

### 5.3 Guidance rules

Recommended next-step logic should prefer settlement over heuristics where the
workbench has a reported settlement observation:

- `screening settled` => suggest `editing`
- `editing settled` => suggest `proofreading`
- `proofreading` keeps the current draft/final/human-final handoff heuristic for
  now, but the durable settlement posture should still be visible in the
  overview and tracked-job context so operators can distinguish business output
  from orchestration completion
- `follow_up_pending/running/retryable` should not be described as fully done
- `failed_open` or `job_failed` should shift guidance toward inspection or retry,
  not forward handoff

### 5.4 Latest job card

Keep the card, but when `execution_tracking` is available, add:

- settlement derived status
- snapshot id when tracked
- a clear distinction between raw job status and mainline settlement

## 6. Testing Expectations

Phase 14 should prove all of the following:

- workbench type parsing accepts the new settlement fields
- screening/editing summary and recommendation logic prefer settlement over raw
  latest-job heuristics
- fail-open settlement observations do not break the page and fall back safely
- tracked jobs show execution settlement context in the existing summary

## 7. Out Of Scope

Phase 14 does not include:

- new backend routes
- new backend persistence
- new workbench pages
- ledger/history windows
- orchestration replay controls
- admin governance UI refactors

## 8. Related Capability Ownership

This phase continues the same `Execution And Orchestration Platform` lane after
`Phase 13` by making the durable mainline settlement model actually visible on
the primary manuscript workbench path, without widening authority or opening a
new control surface.
