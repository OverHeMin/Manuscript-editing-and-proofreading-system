# Phase 28 Manuscript Workbench Attention And Handoff Pack Design

**Date:** 2026-04-06  
**Status:** Proposed for immediate implementation after Phase 27  
**Primary capability lane:** Execution And Orchestration Platform  
**Scope:** Add one additive, read-only `mainline_attention_handoff_pack` on the existing manuscript read path and adopt it inside the current manuscript workbench summary and load/refresh detail paths so operators can tell what currently needs attention and whether the next governed handoff is actually ready, blocked, or fully settled without opening a new control surface.

## 1. Goal

`Phase 26` and `Phase 27` made the current manuscript path much more honest about:

- the current mainline readiness posture
- the recent bounded attempt trail that produced that posture
- per-module settlement, recovery posture, and runtime-binding posture

That means operators can now answer:

- what state the manuscript is in
- how it got there

But one adjacent internal-trial question is still too distributed across the
current path:

- what exactly needs operator attention right now
- whether the next mainline handoff is actually ready
- why that handoff is still blocked when it is not ready

In one sentence:

`Phase 28` should collapse the current blocking posture and next-handoff posture
into one additive read-only pack derived from existing manuscript evidence, then
adopt that pack inside the current manuscript workbench without creating a new
page, panel, or control plane.

## 2. Why This Phase Exists

The current workbench is already restart-safe and readable, but the operator
still has to mentally join several surfaces to decide what action is actually
appropriate:

- `Mainline Readiness` explains the high-level posture
- `Recent Mainline Activity` explains the recent trail
- per-module settlement rows explain module-level state
- `Latest Job` and `Latest Action Result` expose detailed posture when a job is present

This is already much better than before, but there is still no one bounded
answer to:

- which module owns the current attention
- whether that attention is just monitoring or true action-required posture
- whether the next governed handoff is ready now, blocked by in-progress work,
  blocked by unsettled follow-up, or blocked by a harder error posture

Today, the operator can derive that answer, but only by interpreting:

- readiness summary
- attempt ledger
- per-module settlement
- runtime readiness
- recovery timing

That is still too interpretive for internal-trial re-entry and support triage.

This phase closes that gap with one additive read model that stays:

- local-first
- fail-open
- read-only
- bounded to the existing manuscript/workbench path

## 3. Options Considered

### Option A: Keep attention and handoff interpretation frontend-local

Pros:

- no backend contract change

Cons:

- duplicates increasingly complex mainline interpretation in the web layer
- drifts from the backend readiness and ledger semantics
- makes future workbench adoption harder to keep consistent

Not recommended.

### Option B: Add one additive attention/handoff pack on the manuscript read path and adopt it in the current workbench

Pros:

- keeps interpretation in one backend read model
- reuses current settlement, readiness, and ledger evidence
- stays on the current manuscript/workbench path
- remains bounded, local-first, and fail-open

Cons:

- requires one additive manuscript contract and one workbench adoption slice

Recommended.

### Option C: Add a dedicated handoff dashboard or attention console

Pros:

- more room for future operational depth

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
- new handoff routes
- new job-history routes
- new orchestration-inspection routes

### 4.2 Read-only only

This phase may:

- derive current attention posture from already-available evidence
- derive next-handoff posture from already-available evidence
- explain why the next handoff is ready, blocked, or completed
- expose a bounded list of current attention items

It must not:

- replay recovery
- mutate routing
- trigger retries
- activate handoffs
- turn any workbench into a control plane

### 4.3 Fail-open only

If pack derivation fails:

- manuscript reads still succeed
- current `module_execution_overview`, `mainline_readiness_summary`, and
  `mainline_attempt_ledger` remain available
- the current workbench still renders
- missing pack data becomes omission or explicit `failed_open` wording

### 4.4 Local-first only

This phase must stay inside repo-owned services and the current local HTTP/web
stack.

No cloud dependency, hosted orchestration console, or harness tool may become
part of the synchronous manuscript path.

## 5. Proposed Read Model

### 5.1 New additive manuscript field

Add one additive manuscript view-model field:

- `mainline_attention_handoff_pack`

Recommended shape:

- `observation_status`
  - `reported`
  - `failed_open`
- `attention_status`
  - `clear`
  - `monitoring`
  - `action_required`
- `handoff_status`
  - `ready_now`
  - `blocked_by_in_progress`
  - `blocked_by_follow_up`
  - `blocked_by_attention`
  - `completed`
- `focus_module`
  - the module that currently owns the active attention posture when applicable
- `from_module`
  - the module whose settled or unsettled output is the source of the next handoff when applicable
- `to_module`
  - the next governed mainline module when applicable
- `latest_job_id`
  - the newest job tied to the current focus or handoff source when available
- `latest_snapshot_id`
  - the linked snapshot when available
- `recovery_ready_at`
  - concrete next-ready timing when the blocking posture has one
- `runtime_binding_status`
  - compact runtime posture for the blocking module when available
- `runtime_binding_issue_count`
  - compact issue count when degraded or missing
- `reason`
  - operator-readable top-level explanation
- `attention_items`
  - bounded current attention items
- `error`
  - fail-open explanation when observation could not be derived

Recommended `attention_items` shape:

- `module`
- `kind`
  - `job_in_progress`
  - `follow_up_pending`
  - `follow_up_running`
  - `follow_up_retryable`
  - `follow_up_failed`
  - `settlement_unlinked`
  - `job_failed`
  - `runtime_binding_degraded`
  - `runtime_binding_missing`
- `severity`
  - `monitoring`
  - `action_required`
- `job_id`
- `snapshot_id`
- `recovery_ready_at`
- `summary`

Recommended bounded list cap:

- newest and most relevant current items only, recommended cap `3`

### 5.2 Derivation rules

The pack should be derived from the same manuscript read-path evidence already
available after `Phase 27`:

- `module_execution_overview`
- `mainline_readiness_summary`
- `mainline_attempt_ledger`

Recommended rules:

1. If readiness summary is missing or `failed_open`, the pack fails open.
2. Use `mainline_readiness_summary` as the top-level posture source:
   - `ready_for_next_step` =>
     - `attention_status=clear`
     - `handoff_status=ready_now`
     - `to_module=next_module`
   - `in_progress` =>
     - `attention_status=monitoring`
     - `handoff_status=blocked_by_in_progress`
     - `focus_module=active_module`
   - `waiting_for_follow_up` =>
     - `attention_status=monitoring`
     - `handoff_status=blocked_by_follow_up`
     - `focus_module=active_module`
   - `attention_required` =>
     - `attention_status=action_required`
     - `handoff_status=blocked_by_attention`
     - `focus_module=active_module`
   - `completed` =>
     - `attention_status=clear`
     - `handoff_status=completed`
3. Derive `to_module` as the next mainline module after `focus_module` when the
   active module exists and is not already the final settled stage.
4. Reuse the newest overview-backed or ledger-backed attempt for the focus
   module to populate `latest_job_id`, `latest_snapshot_id`, recovery timing,
   and runtime posture when available.
5. Build bounded `attention_items` from the current focus module:
   - `job_in_progress` => monitoring item
   - `business_completed_follow_up_pending` / `running` => monitoring item
   - `business_completed_follow_up_retryable` / `failed` / `unlinked` /
     `job_failed` => action-required item
   - runtime binding `degraded` or `missing` => additional bounded attention item
6. If the top-level posture is `ready_now` or `completed`, allow
   `attention_items=[]`.
7. If derivation fails unexpectedly, report `observation_status=failed_open`
   without blocking the manuscript read.

### 5.3 Why this is still one read model and not a new control plane

This phase should not become a handoff product surface.

The operator question is:

- what needs attention right now
- is the next handoff ready
- why is it blocked when it is not ready

It is not:

- execute the handoff
- replay recovery
- reroute the workflow

That keeps this phase:

- explanatory
- bounded
- workbench-local
- safe to adopt in the current path

## 6. Proposed Workbench Adoption

### 6.1 Manuscript Overview card

Keep adoption inside the existing `Manuscript Overview` card by adding:

- `Attention Status`
- `Next Mainline Handoff`
- `Primary Attention Reason`
- bounded `Attention Items`

`Attention Items` should render as a compact read-only list inside the existing
card rather than opening a new page or panel.

Each visible item should show:

- module
- severity
- concise summary
- recovery-ready timing when present

### 6.2 Load and refresh explainability

When the workbench:

- restores a manuscript workspace
- refreshes latest-job context

append bounded pack details to the action/read result when the pack is
reported.

Recommended details:

- `Attention Status`
- `Next Mainline Handoff`
- `Primary Attention Reason`

### 6.3 Keep recommendation rewrite out of this phase

`Phase 26` already consolidated mainline readiness and `Phase 27` already
explained recent history.

`Phase 28` should explain current attention and handoff posture, not reopen the
recommendation engine again.

That keeps the phase large enough to matter while still holding one clean
execution/orchestration line.

## 7. Display Semantics

Recommended compact wording:

- `clear` => `Clear`
- `monitoring` => `Monitoring`
- `action_required` => `Action required`

Recommended handoff wording:

- `ready_now` => `Ready now`
- `blocked_by_in_progress` => `Blocked by in-progress work`
- `blocked_by_follow_up` => `Blocked by follow-up`
- `blocked_by_attention` => `Blocked by attention-required posture`
- `completed` => `Mainline completed`

Recommended compact handoff detail patterns:

- `submission -> screening (ready now)`
- `screening -> editing (blocked by in-progress work)`
- `editing -> proofreading (blocked by follow-up)`
- `editing -> proofreading (blocked by attention-required posture)`
- `proofreading complete`

Recommended attention item wording:

- `Editing follow-up is retryable.`
- `Editing runtime binding is degraded (2 issues).`
- `Screening job is still in progress.`

## 8. Testing Expectations

`Phase 28` should prove all of the following:

- manuscript reads expose a reported `mainline_attention_handoff_pack` when
  readiness evidence is available
- pack derivation correctly distinguishes `clear`, `monitoring`, and
  `action_required`
- pack derivation correctly distinguishes handoff-ready, follow-up-blocked,
  in-progress-blocked, attention-blocked, and completed states
- attention items reuse existing settlement, runtime, recovery, and ledger
  evidence without blocking reads
- pack derivation fails open rather than blocking manuscript reads
- workbench overview renders bounded attention and handoff details inside the
  existing card
- load/refresh action results append bounded pack explanation when available
- missing or failed-open pack data falls back safely to the current behavior

## 9. Out Of Scope

`Phase 28` does not include:

- new routes, pages, panels, or dashboards
- new handoff persistence
- replay / retry controls
- routing or release control-plane expansion
- automatic model switching, automatic handoff activation, automatic publishing,
  or automatic learning writeback

## 10. Related Capability Ownership

This phase continues the same `Execution And Orchestration Platform` lane after
`Phase 27` by making current attention posture and next-handoff posture
explicitly readable from the same manuscript path, while preserving local-first
fail-open read-only semantics and avoiding any new control surface.
