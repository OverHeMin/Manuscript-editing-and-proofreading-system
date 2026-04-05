# Phase 11G Agent Execution Recovery Summary Design

**Date:** 2026-04-06  
**Status:** Proposed for immediate implementation after Phase 11F  
**Scope:** Add one additive, read-only derived `recovery_summary` to the existing `agent-execution` read path so callers can see per-log replay readiness and recovery posture without calling a separate backlog inspection route.

## 1. Goal

`10J-10W` established the durable execution/orchestration baseline:

- business execution completion is separated from governed follow-up orchestration
- retries are bounded
- restart recovery is durable
- backlog inspection already exposes recovery posture

`11F` then added `completion_summary` so the same execution log can explain
business-vs-orchestration settlement.

One mainline gap still remains:

- a caller reading a single execution log still cannot tell whether the governed
  follow-up is replayable now, deferred, stale-running, terminally blocked, or
  simply irrelevant without separately re-encoding orchestration semantics
- the backlog inspection route already knows this, but that posture is not
  visible on the execution evidence read path itself

In one sentence:

`Phase 11G` should attach one additive `recovery_summary` to the existing
`agent-execution` API view so recovery posture can be read directly from the
log without changing persistence, orchestration behavior, or route shape.

## 2. Why This Slice Exists

The current execution log now exposes:

- `status`
- `orchestration_status`
- `completion_summary`

That is enough to understand settlement, but not enough to understand recovery
posture.

Today a caller still has to answer questions such as:

- is this completed log immediately replayable?
- is a retry cooling down?
- is a running attempt stale enough to reclaim?
- does this log require human attention instead of replay?

Those questions already have an answer inside the orchestration inspection lane.
This phase brings that answer onto the existing per-log read path as a stable,
read-only derived contract.

## 3. Recommended Option

### Option A: Persist recovery posture into `agent_execution_logs`

Pros:

- materialized state

Cons:

- unnecessary schema change
- duplicates information already derivable from existing fields and current time

Not recommended in this phase.

### Option B: Add a derived `recovery_summary` to the existing API view

Pros:

- no schema change
- no new route
- directly serves single-log and list-log readers
- stays consistent with current backlog inspection semantics

Cons:

- derived at read time

Recommended.

### Option C: Force callers to use `inspectBacklog()` separately

Pros:

- no execution-log view change

Cons:

- pushes orchestration posture lookup into a second read surface
- makes simple readers stitch together two contracts for one log

Out of scope.

## 4. Hard Boundaries

### 4.1 No persistence changes

This phase must not change:

- `agent_execution_logs` schema
- migrations
- repository contracts
- snapshot contracts

### 4.2 No orchestration behavior changes

This phase must not change:

- replay ownership or claim behavior
- retry eligibility rules
- stale-running timeout behavior
- recovery ordering
- failure handling

### 4.3 No new control plane

This phase may extend:

- `AgentExecutionLogViewRecord`
- existing demo and persistent HTTP responses
- existing read-path tests

It must not add:

- new routes
- new replay commands
- new workbench or control-plane surfaces

## 5. Proposed Response Shape

Add one additive field to `AgentExecutionLogViewRecord`:

- `recovery_summary`

Suggested shape:

- `category`
- `recovery_readiness`
- `recovery_ready_at`
- `reason`

Recommended categories:

- `recoverable_now`
- `stale_running`
- `deferred_retry`
- `attention_required`
- `not_recoverable`

Recommended readiness values:

- `ready_now`
- `waiting_retry_eligibility`
- `waiting_running_timeout`
- `not_recoverable`

## 6. Derivation Rules

The summary should mirror current backlog inspection semantics for a single log.

### 6.1 Business not completed

If `status !== completed`:

- `category = not_recoverable`
- `recovery_readiness = not_recoverable`
- `reason = Business execution is <status>, so governed follow-up is not recoverable yet.`

### 6.2 Completed log with pending follow-up

If `status === completed` and `orchestration_status === pending`:

- `category = recoverable_now`
- `recovery_readiness = ready_now`
- `reason = Pending orchestration is ready to replay now.`

### 6.3 Completed log with retryable follow-up

If `status === completed` and `orchestration_status === retryable`:

- when retry is eligible now:
  - `category = recoverable_now`
  - `recovery_readiness = ready_now`
- when retry is still cooling down:
  - `category = deferred_retry`
  - `recovery_readiness = waiting_retry_eligibility`
  - `recovery_ready_at = orchestration_next_retry_at`

### 6.4 Completed log with running follow-up

If `status === completed` and `orchestration_status === running`:

- when the running attempt is stale:
  - `category = stale_running`
  - `recovery_readiness = ready_now`
- when the running attempt is still fresh:
  - `category = not_recoverable`
  - `recovery_readiness = waiting_running_timeout`
  - `recovery_ready_at = orchestration_last_attempt_started_at + staleAfterMs`

### 6.5 Completed log with terminal follow-up failure

If `status === completed` and `orchestration_status === failed`:

- `category = attention_required`
- `recovery_readiness = not_recoverable`
- `reason` should include `orchestration_last_error` when present

### 6.6 Completed log already settled or not required

If `status === completed` and `orchestration_status` is:

- `completed`, or
- `not_required`

then:

- `category = not_recoverable`
- `recovery_readiness = not_recoverable`

with reasons matching the current inspection semantics.

## 7. Relationship To Existing Inspection APIs

This phase does **not** replace:

- `inspectBacklog()`
- `readiness_summary`
- `focus`
- `replay_preview`

Those remain the fleet-level operational view.

`recovery_summary` is intentionally smaller:

- it is per-log
- it is always available on the existing execution evidence read path
- it exposes current recovery posture, not backlog-wide prioritization

## 8. Error Handling

This phase should stay pure view derivation:

- no external lookup
- no new failure path
- no fail-open wrapper needed

If the log can already be read, `recovery_summary` should always be returned.

## 9. Implementation Notes

To keep this slice narrowly additive:

- derive the summary inside `agent-execution-api.ts`
- allow optional API-level injection of:
  - `now?: () => Date`
  - `runningAttemptStaleAfterMs?: number`
- default to the same stale-running timeout already used by orchestration

This keeps tests deterministic without wiring the orchestration service itself
into the read path.

## 10. Out Of Scope

`Phase 11G` does not include:

- replay execution changes
- claim or ownership changes
- new scheduling or queue controls
- new routes
- persistence changes
- runtime-binding readiness changes
- workbench or control-plane expansion

## 11. Related Capability Lane

This slice advances:

- `Execution And Orchestration Platform`

It builds directly on:

- `2026-04-05-phase10l-governed-orchestration-dry-run-inspection-design.md`
- `2026-04-05-phase10s-governed-orchestration-readiness-windows-design.md`
- `2026-04-05-phase10t-governed-orchestration-readiness-summary-rollup-design.md`
- `2026-04-06-phase11f-agent-execution-completion-summary-design.md`

It explicitly does not reopen:

- the closed `Phase 10` recovery core
- schema work
- any new operator control surface
