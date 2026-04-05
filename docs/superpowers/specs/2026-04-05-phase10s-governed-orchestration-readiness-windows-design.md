# Phase 10S Governed Orchestration Readiness Windows Design

**Date:** 2026-04-05  
**Status:** Implemented and locally verified under the current Phase 10 durable execution-orchestration mainline  
**Scope:** Extend the existing read-only governed orchestration inspection lane with explicit readiness metadata so operators can see when a deferred retry becomes replayable and when a fresh running attempt becomes reclaimable, without mutating durable orchestration state.

## 1. Goal

`Phase 10J` through `10R` established:

- durable post-business follow-up orchestration
- single-owner attempt claim guardrails
- read-only backlog inspection
- actionable focus ordering
- scoped replay and inspection
- bounded replay budgeting
- budgeted replay ordering alignment
- optional bounded boot recovery
- read-only preview of the next budgeted replay slice

The next narrow gap is readiness visibility.

Today operators can already see:

- orchestration category
- retry timestamps when they already exist on the underlying log
- reason text for why an item is or is not recoverable

But they still do not get one explicit, normalized readiness view that answers:

- is this item replayable now
- if not, what exact wait state is blocking it
- when will it become replayable or reclaimable next

This phase closes that gap in the same read-only lane.

## 2. Why This Slice Exists

The current inspection path is safe, but still makes operators infer timing semantics from mixed raw timestamps and prose.

Two important cases are still harder to reason about than they need to be:

- `retryable` work that is waiting for `orchestration_next_retry_at`
- `running` work that is still fresh and has not yet crossed the stale-reclaim timeout

The right next step is not a scheduler, retry button, or dashboard.
It is one more repo-owned read-only explanation layer on top of the same orchestration rules.

## 3. Hard Boundaries

### 3.1 Keep the feature read-only

This phase must not:

- mutate orchestration status
- change retry eligibility timing
- reclaim fresh running work earlier than today
- alter business completion, routing, release, or learning state

### 3.2 Do not add a new control plane

This phase stays inside the existing inspection / CLI lane.
It must not add:

- new HTTP mutation APIs
- new admin-console write controls
- operator override flags for retry or reclaim timing

### 3.3 Reuse existing timing rules exactly

The new readiness metadata must be derived from the same current rules:

- `orchestration_next_retry_at`
- running-attempt stale timeout
- business completion requirement
- terminal orchestration failure handling

This phase explains those rules; it does not change them.

### 3.4 Preserve existing no-readiness consumers

Existing inspection categories, summaries, and replay semantics must remain valid.
The new fields must be additive so current consumers degrade gracefully.

## 4. Recommended Option

### Option A: Keep readiness implicit in raw timestamps and reason text

Pros:

- no new code

Cons:

- operators still have to infer wait states manually
- read-only observability remains less explicit than the replay safety model itself

Not recommended.

### Option B: Add normalized readiness metadata to dry-run inspection items

Pros:

- minimal additive change
- strengthens recovery-state visibility without widening authority
- reuses existing durable timing semantics

Cons:

- adds a few more read-only fields to inspection output

Recommended.

## 5. Core Design

### 5.1 Add normalized readiness fields to inspection items

Each inspection item should gain additive fields such as:

- `recovery_readiness`
- `recovery_ready_at` when a concrete next-ready timestamp exists

Recommended readiness states:

- `ready_now`
- `waiting_retry_eligibility`
- `waiting_running_timeout`
- `not_recoverable`

### 5.2 Derive readiness from current orchestration rules

Examples:

- `pending` or retryable-and-due items map to `ready_now`
- deferred retry maps to `waiting_retry_eligibility` with `recovery_ready_at = orchestration_next_retry_at`
- fresh running maps to `waiting_running_timeout` with `recovery_ready_at = orchestration_last_attempt_started_at + staleAfterMs`
- terminal failure, completed orchestration, or business-incomplete work map to `not_recoverable`

### 5.3 Surface readiness in CLI dry-run output

The human-readable dry-run item output should append readiness details when present, for example:

- `readiness=waiting_retry_eligibility ready_at=...`
- `readiness=waiting_running_timeout ready_at=...`

JSON output naturally includes the same additive fields through the inspection item shape.

## 6. Expected Outcomes

After this slice:

- operators can see exactly why work is blocked from replay now
- deferred retry and fresh-running timeout windows become explicit read-only state
- recovery-state observability improves without changing replay or startup behavior

## 7. Out Of Scope

This phase does not add:

- new retry policy controls
- mutation of retry timestamps from the CLI
- new dashboards or workbenches
- multi-node workflow-engine depth
- replay scheduling or automation

## 8. Related Documents

- `docs/superpowers/specs/2026-04-05-phase10l-governed-orchestration-dry-run-inspection-design.md`
- `docs/superpowers/specs/2026-04-05-phase10m-governed-orchestration-focus-ordering-design.md`
- `docs/superpowers/specs/2026-04-05-phase10q-boot-recovery-budget-guardrail-design.md`
- `docs/superpowers/specs/2026-04-05-phase10r-governed-orchestration-budgeted-dry-run-preview-design.md`
