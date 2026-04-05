# Phase 11D Agent Execution Runtime Binding Readiness Design

**Date:** 2026-04-05  
**Status:** Proposed for immediate implementation after Phase 11C  
**Scope:** Extend the existing `agent-execution` read path with one additive fail-open runtime-binding readiness observation so execution-log readers can inspect current binding posture without changing log persistence or execution behavior.

## 1. Goal

`11A-11C` now expose runtime-binding readiness on:

- standalone runtime-binding inspection
- execution-resolution bundle reads
- governed agent-context reads

The next narrow mainline-serving gap is on the execution evidence surface:

- `agent execution logs` already separate business completion from orchestration completion
- they already carry the pinned `runtime_binding_id`
- but readers still need a second runtime-binding read to understand current
  runtime dependency posture while inspecting a log

In one sentence:

`Phase 11D` should attach runtime-binding readiness observation to the existing
`agent-execution` create/get/list/complete responses so callers can inspect
execution evidence and current binding posture together in one read path.

## 2. Why This Slice Exists

The execution log is already the repo-owned durable object for:

- runtime identity
- sandbox identity
- agent profile identity
- tool policy identity
- knowledge ids
- verification expectation ids
- orchestration status and retries

What it does not currently include is:

- whether the log's referenced runtime binding is currently ready or degraded
- whether readiness observation itself failed open while reading the log

That means the operator or caller reading execution evidence still has to make
another explicit runtime-binding readiness read to interpret current posture.

## 3. Recommended Option

### Option A: Persist readiness snapshots directly on the execution log table

Pros:

- durable launch-time evidence

Cons:

- requires schema and migration changes
- is a larger slice than needed for the next step

Not recommended for this phase.

### Option B: Add a read-only readiness observation to the execution-log API view

Pros:

- no persistence or migration changes
- reuses the existing readiness service
- stays fail-open and additive

Cons:

- reflects current readiness posture rather than a persisted launch-time snapshot

Recommended.

### Option C: Add a new execution-log readiness route

Pros:

- narrow route shape

Cons:

- creates another read surface instead of enriching the existing one

Out of scope.

## 4. Hard Boundaries

### 4.1 No storage contract changes

This phase must not change:

- `agent_execution_logs` storage schema
- postgres migrations
- execution snapshot schema
- orchestration state transitions

### 4.2 Observation must stay additive and fail-open

If readiness observation succeeds:

- attach it to execution-log API responses

If readiness observation fails unexpectedly:

- do not fail create/get/list/complete
- return the existing execution-log payload
- mark readiness observation as `failed_open`

### 4.3 No new control-plane surface

This phase may extend:

- `agent-execution` API response shapes
- API wiring and tests

It must not add:

- a new route
- a new workbench
- a new runtime control surface

## 5. Proposed Response Shape

Add one new additive field to the execution-log API view:

- `runtime_binding_readiness`

Use the same wrapper pattern as `11B-11C`:

- `observation_status = reported | failed_open`
- `report` when readiness observation succeeds
- `error` when readiness observation fails unexpectedly

The nested `report.status` remains the existing readiness status:

- `ready`
- `degraded`
- `missing`

`missing` is not expected in normal get/create flows where the binding id still
resolves, but preserving the existing readiness dialect keeps the API simple.

## 6. Recommended Architecture

### 6.1 Enrich the API view, not the stored record

Keep `AgentExecutionLogRecord` as the persisted repository contract.

Introduce an additive API view record that:

- includes the stored log fields
- appends `runtime_binding_readiness`

This avoids schema drift while keeping the read path richer.

### 6.2 Inject readiness service into the agent-execution API

Extend `createAgentExecutionApi` with an optional dependency on
`RuntimeBindingReadinessService`.

For each response:

1. load or mutate the log as today
2. observe readiness from `runtime_binding_id`
3. attach the observation to the returned payload

### 6.3 Keep observation optional

If the readiness service is not wired in a runtime:

- still return the execution log
- return `runtime_binding_readiness.observation_status = failed_open`
- return `error = Runtime binding readiness service is unavailable.`

## 7. Error Handling Rules

### 7.1 Existing log behavior remains unchanged

This phase must not change:

- create-log success behavior
- complete-log success behavior
- orchestration retry state transitions
- not-found errors for logs

### 7.2 Readiness observation failures do not fail the log response

Examples:

- readiness service wiring bug
- current binding read failure
- unexpected readiness-service exception

In these cases:

- the log response still succeeds
- readiness observation becomes `failed_open`

## 8. Out Of Scope

`Phase 11D` does not include:

- persisted launch-time readiness snapshots
- execution-log table changes
- orchestration behavior changes
- new HTTP routes
- workbench or console additions

## 9. Related Capability Lane

This slice advances:

- `Agent Runtime Platform`

It builds directly on:

- `2026-04-05-phase11a-runtime-binding-readiness-preflight-design.md`
- `2026-04-05-phase11b-execution-resolution-runtime-binding-readiness-design.md`
- `2026-04-05-phase11c-governed-agent-context-runtime-binding-readiness-design.md`
- the current `agent-execution` evidence path

It explicitly does not reopen:

- `Phase 10` orchestration behavior
- storage-schema work
- control-plane expansion
