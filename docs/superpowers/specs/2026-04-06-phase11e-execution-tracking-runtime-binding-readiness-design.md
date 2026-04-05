# Phase 11E Execution Tracking Runtime Binding Readiness Design

**Date:** 2026-04-06  
**Status:** Proposed for immediate implementation after Phase 11D  
**Scope:** Extend the existing execution-tracking snapshot read path with one additive fail-open runtime-binding readiness observation so execution evidence readers can inspect current active binding posture together with the frozen execution snapshot.

## 1. Goal

`11A-11D` now expose runtime-binding readiness on:

- standalone runtime-binding inspection
- execution-resolution bundle reads
- governed agent-context reads
- execution-log reads

The next narrow mainline-serving gap is the execution snapshot read path:

- execution snapshots already freeze the profile, template, prompt, skill, model,
  and knowledge-hit evidence used for a run
- snapshot readers still cannot see whether the current governed scope now has a
  ready, degraded, or missing active runtime binding without making a separate read

In one sentence:

`Phase 11E` should attach runtime-binding readiness observation to the existing
execution-tracking snapshot API so callers can inspect frozen execution evidence
and current active binding posture together without changing snapshot persistence.

## 2. Why This Slice Exists

Execution snapshots already answer:

- which execution profile was used
- which module template, prompt template, and skill packages were used
- which model and knowledge items were used
- which assets were created

What they do not answer is:

- whether the same scope currently has an active runtime binding
- whether that active binding is ready or degraded now
- whether readiness observation itself failed-open when assembling the view

That means snapshot readers still need a second runtime-binding call to
understand current runtime posture while inspecting evidence.

## 3. Recommended Option

### Option A: Persist runtime-binding readiness directly into the snapshot table

Pros:

- captures launch-time or record-time evidence durably

Cons:

- requires schema and migration changes
- is larger than the next minimal slice

Not recommended in this phase.

### Option B: Add a read-only readiness observation to the snapshot API view

Pros:

- no schema change
- reuses existing readiness service
- keeps the slice additive and fail-open

Cons:

- reflects current scope posture rather than a persisted launch-time snapshot

Recommended.

### Option C: Add a separate snapshot-readiness route

Pros:

- narrow route boundary

Cons:

- creates another read surface instead of enriching the existing one

Out of scope.

## 4. Hard Boundaries

### 4.1 No snapshot storage contract changes

This phase must not change:

- execution snapshot storage schema
- knowledge-hit log schema
- postgres migrations
- snapshot recording semantics

### 4.2 Observation must stay additive and fail-open

If readiness observation succeeds:

- attach it to snapshot create/get API responses

If readiness observation fails unexpectedly:

- do not fail snapshot create/get
- return the existing snapshot payload
- mark readiness observation as `failed_open`

### 4.3 No new control-plane surface

This phase may extend:

- execution-tracking API response shapes
- current demo and persistent runtime wiring
- snapshot-focused tests

It must not add:

- a new route
- a new workbench
- a runtime control plane

## 5. Proposed Response Shape

Add one new additive field to the execution snapshot API view:

- `runtime_binding_readiness`

Use the same wrapper pattern already used in `11B-11D`:

- `observation_status = reported | failed_open`
- `report` when readiness observation succeeds
- `error` when readiness observation fails unexpectedly

When `observation_status = reported`, the nested `report.status` remains the
existing readiness status:

- `ready`
- `degraded`
- `missing`

## 6. Recommended Architecture

### 6.1 Enrich the API view, not the stored snapshot record

Keep `ModuleExecutionSnapshotRecord` as the persisted repository contract.

Add a view record for API responses that:

- includes the stored snapshot fields unchanged
- appends `runtime_binding_readiness`

### 6.2 Derive readiness scope from the stored execution profile id

The snapshot already stores `execution_profile_id`.

Use `ExecutionGovernanceRepository.findProfileById` to recover:

- `module`
- `manuscript_type`
- `template_family_id`

Then call `RuntimeBindingReadinessService.getActiveBindingReadinessForScope`.

This keeps the slice schema-free and grounded in existing authoritative state.

### 6.3 Missing profile context should fail open

If the stored `execution_profile_id` no longer resolves:

- do not fail the snapshot read
- return `runtime_binding_readiness.observation_status = failed_open`
- include an explanatory `error`

This preserves the distinction between:

- genuine readiness report outcomes (`ready`, `degraded`, `missing`)
- inability to assemble readiness observation from snapshot context

## 7. Error Handling Rules

### 7.1 Snapshot behavior remains unchanged

This phase must not change:

- snapshot recording success behavior
- knowledge-hit log recording behavior
- missing snapshot behavior

### 7.2 Readiness observation failures must not fail the snapshot response

Examples:

- readiness service wiring bug
- execution profile lookup failure
- unexpected readiness-service exception

In these cases:

- snapshot create/get still succeeds
- readiness observation reports `failed_open`

## 8. Out Of Scope

`Phase 11E` does not include:

- persisted launch-time readiness snapshots
- snapshot table changes
- execution-log behavior changes
- new routes
- workbench or console additions

## 9. Related Capability Lane

This slice advances:

- `Agent Runtime Platform`

It builds directly on:

- `2026-04-05-phase11a-runtime-binding-readiness-preflight-design.md`
- `2026-04-05-phase11d-agent-execution-runtime-binding-readiness-design.md`
- the current execution-tracking evidence path

It explicitly does not reopen:

- `Phase 10` orchestration behavior
- storage-schema work
- control-plane expansion
