# Phase 27 Manuscript Mainline Timeline And Attempt Ledger Design

**Date:** 2026-04-06  
**Status:** Proposed for immediate implementation after Phase 26  
**Primary capability lane:** Execution And Orchestration Platform  
**Scope:** Add one additive, bounded, read-only `mainline_attempt_ledger` on the existing manuscript read path and adopt it inside the current manuscript workbench overview and load-result path so operators can explain how the current mainline readiness posture was reached without opening a new control surface.

## 1. Goal

`Phase 13-26` made the current manuscript path increasingly honest about:

- per-module settlement
- linked execution evidence
- restart-safe latest-job hydration
- recovery posture
- runtime-binding posture
- summary-level readiness

That means operators can now answer:

- what the current mainline posture is
- whether follow-up is settled
- whether the mainline is ready to proceed

But they still cannot answer one adjacent internal-trial question cleanly from the
same path:

- how did the manuscript get to this posture
- which recent mainline attempts already happened
- whether the current state comes from a fresh in-progress attempt, a retryable
  follow-up, or repeated failed attempts

In one sentence:

`Phase 27` should add one bounded mainline attempt ledger derived from the
existing manuscript job, snapshot, and linked execution evidence, then let the
current workbench surface that ledger as read-only explanatory context.

## 2. Why This Phase Exists

`Phase 26` solved top-level readiness summarization, but it intentionally
collapsed many details into one current-state answer.

That is good for glanceability, but still leaves a controlled internal-trial gap:

- the current workbench shows the latest job
- the current workbench shows the current readiness posture
- the current workbench shows per-module settlement
- but it still does not show the recent mainline attempt trail that produced the
  current state

Today, an operator who wants that explanation has to mentally stitch together:

- the latest job card
- per-module overview rows
- snapshot-linked recovery posture
- linked orchestration attempt counts

That is still technically possible, but it is not yet readable enough for
internal-trial re-entry and support workflows.

This phase closes that gap by adding one bounded read-only ledger that is:

- derived from evidence already available on the manuscript read path
- restart-safe and reload-safe
- strictly local-first
- fail-open
- adopted inside the existing workbench summary path

## 3. Options Considered

### Option A: Keep attempt-history interpretation frontend-local

Pros:

- no backend contract change

Cons:

- requires the web layer to reconstruct historical posture rules from scattered
  job and latest-overview data
- cannot reliably explain older attempts without duplicating backend derivation
- increases drift risk between current-state summary and historical explanation

Not recommended.

### Option B: Add one additive manuscript attempt ledger and adopt it inside the current workbench

Pros:

- stays on the existing manuscript read path
- keeps attempt-history semantics in one backend read model
- lets the workbench explain current posture without creating a new page or
  control plane
- remains fail-open and bounded

Cons:

- requires one additive view-model extension and small workbench adoption

Recommended.

### Option C: Add a dedicated timeline panel, timeline route, or orchestration console

Pros:

- more room for future operational detail

Cons:

- expands surface area
- risks becoming a new control plane
- violates the current boundary preference

Out of scope.

## 4. Hard Boundaries

### 4.1 Existing read paths only

This phase may extend only the existing:

- `GET /api/v1/manuscripts/:manuscriptId`
- current manuscript workbench workspace load path
- current manuscript workbench summary rendering path

It must not add:

- new manuscript routes
- new job-history routes
- new orchestration-inspection routes
- new timeline-specific APIs

### 4.2 Read-only only

This phase may:

- derive a bounded attempt ledger from existing jobs, snapshots, and linked
  execution observations
- explain which recent mainline attempts led to the current readiness posture
- show historical attempt counts and current known follow-up posture

It must not:

- replay recovery
- mutate job state
- mutate routing
- create retry controls
- turn any workbench into a control plane

### 4.3 Fail-open only

If ledger derivation fails:

- manuscript reads still succeed
- current `module_execution_overview` and `mainline_readiness_summary` remain
  available
- the workbench continues rendering its existing summary path
- missing ledger data becomes omission or explicit `failed_open` wording

### 4.4 Local-first only

This phase must stay inside repo-owned services and the current local HTTP/web
stack.

No cloud dependency, hosted timeline service, or harness dependency may become
part of the synchronous manuscript path.

## 5. Proposed Read Model

### 5.1 New additive manuscript field

Add one additive manuscript view-model field:

- `mainline_attempt_ledger`

Recommended shape:

- `observation_status`
  - `reported`
  - `failed_open`
- `total_attempts`
  - total mainline attempts found for this manuscript
- `visible_attempts`
  - bounded number of attempts returned in this payload
- `truncated`
  - whether older attempts were omitted from the bounded list
- `latest_event_at`
  - latest attempt update time across visible mainline attempts
- `items`
  - bounded list sorted newest-first
- `error`
  - fail-open explanation when the ledger could not be assembled

Recommended item shape:

- `module`
- `job_id`
- `job_status`
- `job_attempt_count`
- `created_at`
- `updated_at`
- `started_at`
- `finished_at`
- `snapshot_id`
- `evidence_status`
  - `snapshot_linked`
  - `job_only`
  - `failed_open`
- `settlement_status`
- `orchestration_status`
- `orchestration_attempt_count`
- `recovery_category`
- `recovery_ready_at`
- `runtime_binding_status`
- `runtime_binding_issue_count`
- `is_latest_for_module`
- `reason`

### 5.2 Derivation rules

The ledger should be derived from the same manuscript read-path evidence already
loaded inside `enrichManuscriptView(...)`:

- all manuscript jobs
- all manuscript execution snapshots when tracking service is available
- linked agent-execution observations already used by current settlement and
  readiness derivation

Recommended rules:

1. Filter manuscript jobs to the existing mainline modules:
   `screening -> editing -> proofreading`.
2. Sort candidate jobs by `updated_at desc`, then `id desc`.
3. Return only the newest bounded slice, recommended cap `9`.
4. For each job:
   - attach the linked snapshot when `payload.snapshotId` resolves
   - derive settlement from the same existing helper logic when snapshot-linked
     evidence is available
   - expose linked orchestration posture, attempt count, recovery posture, and
     runtime-binding posture when available
   - otherwise degrade to `job_only` evidence with a human-readable reason
5. Mark `is_latest_for_module = true` for the newest attempt visible for each
   mainline module.
6. If the ledger assembly fails unexpectedly, report
   `observation_status=failed_open` without blocking the manuscript read.

### 5.3 Why a bounded ledger instead of a full historical timeline

This phase should not become a new history product surface.

A bounded ledger is enough because the main operator question is not:

- every event the manuscript has ever seen

It is:

- which recent mainline attempts explain the current posture right now

That keeps the phase:

- useful for internal trial
- restart-safe
- cheap to read
- small enough to stay inside the existing workbench summary card

## 6. Proposed Workbench Adoption

### 6.1 Manuscript Overview card

Keep adoption inside the existing `Manuscript Overview` card by adding:

- `Mainline Attempts`
- `Activity Window`
- `Recent Mainline Activity`

`Recent Mainline Activity` should render the visible ledger items as a compact
read-only list rather than opening a new panel or route.

Each visible entry should show:

- module
- attempt number
- current known posture
- latest timestamp
- concise explanation of why the attempt matters to the current posture

### 6.2 Load and refresh explainability

When the workbench:

- restores a manuscript workspace
- refreshes latest-job context

append bounded ledger details to the action/read result when the ledger is
reported.

Recommended details:

- `Mainline Attempts`
- `Latest Mainline Activity`

This keeps restart-safe re-entry and manual refresh readable at the top of the
existing page path.

### 6.3 No recommendation rewrite in this phase

`Phase 26` already consolidated current-state readiness.

This phase should explain the path into that state, not reopen the recommendation
engine again.

That keeps `Phase 27` large enough to matter, but still on one clean mainline.

## 7. Display Semantics

Recommended compact wording:

- `snapshot_linked` => use the derived settlement/recovery/runtime phrasing
- `job_only` => `Job-only evidence`
- `failed_open` => `Observation unavailable`

Recommended list-row phrasing pattern:

- `Editing attempt 2`
- `Latest known posture: waiting for follow-up`
- `Updated: 2026-04-06 15:30`
- `Reason: business execution is complete and governed follow-up is retryable`

Recommended bounded summary wording:

- `Mainline Attempts: 4 total (showing 4)`
- `Mainline Attempts: 12 total (showing latest 9)`

## 8. Testing Expectations

`Phase 27` should prove all of the following:

- manuscript reads expose a reported bounded attempt ledger when mainline jobs
  exist
- ledger items can reuse snapshot-linked settlement, recovery, runtime, and
  orchestration attempt evidence
- job-only attempts still appear without blocking reads when snapshot evidence is
  absent
- ledger derivation fails open rather than blocking manuscript reads
- workbench overview renders `Recent Mainline Activity` inside the current
  manuscript overview card
- load/refresh action results append bounded ledger explanation when available
- missing or failed-open ledger data falls back safely to the current behavior

## 9. Out Of Scope

`Phase 27` does not include:

- new routes, pages, panels, or dashboards
- new timeline persistence
- event sourcing
- replay / retry controls
- new queue ownership or scheduling semantics
- routing or release control-plane expansion
- automatic model switching, automatic publishing, or automatic learning
  writeback

## 10. Related Capability Ownership

This phase continues the same `Execution And Orchestration Platform` lane after
`Phase 26` by making the current mainline posture historically explainable from
the same manuscript path, while preserving local-first fail-open read-only
semantics and avoiding any new control surface.
