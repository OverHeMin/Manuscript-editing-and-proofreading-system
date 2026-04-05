# Phase 11F Agent Execution Completion Summary Design

**Date:** 2026-04-06  
**Status:** Proposed for immediate implementation after Phase 11E  
**Scope:** Add one additive, read-only derived completion summary to the existing `agent-execution` read path so callers can tell whether a run is still in business execution, business-complete but follow-up-incomplete, terminally attention-required, or fully settled without re-implementing status-pair logic.

## 1. Goal

`10J-10W` established the durable execution/orchestration baseline:

- business execution completion is tracked separately from governed follow-up orchestration
- retries are bounded
- recovery is restart-safe
- read-only backlog inspection exists

`11D` then added runtime-binding readiness observation to the same execution-log
read path.

What is still awkward on the mainline evidence path is simpler:

- `agent-execution` readers still need to interpret `status` plus `orchestration_status` themselves
- the distinction between "business is still running", "business succeeded but governed follow-up is still pending", and "the whole run is fully settled" is not exposed as one stable derived contract
- downstream readers must duplicate the same conditional logic already implied by the orchestration lane

In one sentence:

`Phase 11F` should attach one additive `completion_summary` to the existing
`agent-execution` API view so business completion and orchestration completion
are directly readable without changing persistence, recovery behavior, or HTTP
route shape.

## 2. Why This Slice Exists

The current log already exposes the raw state pair:

- `status`
- `orchestration_status`

That is enough for the orchestration core, but not ideal for stable consumers:

- admin evidence readers
- automated local reporting
- future read-only operational adapters

Those consumers should not have to re-encode the mainline separation rules.

This phase therefore targets a narrow missing read model, not a new execution
behavior.

## 3. Recommended Option

### Option A: Persist a settlement field into `agent_execution_logs`

Pros:

- durable materialized state

Cons:

- unnecessary schema change
- duplicates information that is already derivable from existing fields

Not recommended in this phase.

### Option B: Add a derived `completion_summary` to the existing API view

Pros:

- no schema change
- no orchestration behavior change
- directly serves existing `create/get/list/complete` readers

Cons:

- derived at read time instead of persisted

Recommended.

### Option C: Add a new execution-settlement route

Pros:

- isolates the new view

Cons:

- creates a new read surface for information already local to the log
- drifts toward unnecessary control-surface growth

Out of scope.

## 4. Hard Boundaries

### 4.1 No persistence changes

This phase must not change:

- `agent_execution_logs` schema
- migrations
- orchestration repository contracts
- execution snapshot contracts

### 4.2 No orchestration behavior changes

This phase must not change:

- ownership / claim semantics
- retry eligibility
- recovery order
- stale-running reclaim behavior
- business success or failure handling

### 4.3 No new control plane

This phase may extend:

- `agent-execution` API view types
- existing demo and persistent HTTP responses
- agent-execution read-path tests

It must not add:

- new routes
- new replay commands
- new workbench panels

## 5. Proposed Response Shape

Add one additive field to `AgentExecutionLogViewRecord`:

- `completion_summary`

Suggested shape:

- `derived_status`
- `business_completed`
- `follow_up_required`
- `fully_settled`
- `attention_required`

Recommended derived statuses:

- `business_in_progress`
- `business_failed`
- `business_completed_follow_up_pending`
- `business_completed_follow_up_running`
- `business_completed_follow_up_retryable`
- `business_completed_follow_up_failed`
- `business_completed_settled`

## 6. Derivation Rules

### 6.1 Business not yet completed

If `status !== completed` and `status !== failed`:

- `derived_status = business_in_progress`
- `business_completed = false`
- `fully_settled = false`

### 6.2 Business failed

If `status === failed`:

- `derived_status = business_failed`
- `business_completed = false`
- `attention_required = true`
- `fully_settled = false`

### 6.3 Business completed, follow-up not required or already completed

If `status === completed` and `orchestration_status` is:

- `not_required`, or
- `completed`

then:

- `derived_status = business_completed_settled`
- `business_completed = true`
- `fully_settled = true`

`follow_up_required` should stay `false` for `not_required` and `true` for
`completed`.

### 6.4 Business completed, follow-up still open

If `status === completed` and `orchestration_status` is:

- `pending`
- `running`
- `retryable`

then:

- `business_completed = true`
- `follow_up_required = true`
- `fully_settled = false`

with matching derived states:

- `business_completed_follow_up_pending`
- `business_completed_follow_up_running`
- `business_completed_follow_up_retryable`

### 6.5 Business completed, follow-up terminally failed

If `status === completed` and `orchestration_status === failed`:

- `derived_status = business_completed_follow_up_failed`
- `business_completed = true`
- `follow_up_required = true`
- `attention_required = true`
- `fully_settled = false`

## 7. Relationship To Existing Inspection APIs

This phase does **not** replace `inspectBacklog()` categories such as:

- `recoverable_now`
- `stale_running`
- `deferred_retry`
- `attention_required`

Those remain recovery-planning views.

`completion_summary` is intentionally smaller:

- it is per-log
- it is always available on the existing execution evidence read path
- it explains settlement, not replay prioritization

## 8. Error Handling

This phase is pure derivation from already-loaded log state.

There should be:

- no fail-open wrapper
- no external dependency lookup
- no new error path

If the log can be read today, `completion_summary` should always be returned.

## 9. Out Of Scope

`Phase 11F` does not include:

- new orchestration states
- route additions
- recovery algorithm changes
- snapshot schema changes
- runtime-binding readiness changes
- workbench or control-plane expansion

## 10. Related Capability Lane

This slice advances:

- `Execution And Orchestration Platform`

It builds directly on:

- `2026-04-05-phase10j-durable-execution-orchestration-baseline-design.md`
- `2026-04-05-phase10k-execution-orchestration-attempt-claim-guardrails-design.md`
- `2026-04-05-phase10l-governed-orchestration-dry-run-inspection-design.md`
- `2026-04-05-phase11d-agent-execution-runtime-binding-readiness-design.md`

It explicitly does not reopen:

- the closed `Phase 10` replay/recovery core
- storage-schema work
- any new operator control surface
