# Phase 11B Execution Resolution Runtime Binding Readiness Design

**Date:** 2026-04-05  
**Status:** Proposed for immediate implementation after Phase 11A  
**Scope:** Extend the existing execution-resolution bundle with one additive runtime-binding readiness observation so callers can see whether the current governed scope also has a ready active binding, without changing execution-resolution success semantics.

## 1. Goal

`Phase 11A` added a read-only readiness report for runtime bindings:

- by binding id
- by active governed scope

That closed the pure runtime-binding inspection gap, but callers still need to
make two separate reads:

1. resolve the governed execution bundle
2. inspect runtime-binding readiness separately

The next narrow mainline-serving step is to expose both in one place.

In one sentence:

`Phase 11B` should attach runtime-binding readiness observation to the existing `execution-governance/resolve` bundle so execution callers can see both the resolved bundle and current runtime-binding posture in one additive read path.

## 2. Why This Slice Exists

The current resolve path already answers:

- which execution profile is active
- which module template, prompt template, and skill packages apply
- which approved model resolves for the scope
- which active knowledge rules and approved knowledge items apply

What it still does not answer is:

- whether the governed scope also has an active runtime binding
- whether that binding is still executable or has drifted

That means a caller can resolve a clean execution bundle and still discover a
runtime-binding problem only later when governed agent context resolution or
real module execution occurs.

This slice keeps the focus on the manuscript mainline entry path instead of
opening another operator surface.

## 3. Recommended Option

### Option A: Keep readiness separate from execution resolution

Pros:

- no change to resolve contract

Cons:

- callers need two reads for one mainline preflight question
- resolve consumers still lack immediate visibility into runtime-binding drift

Not recommended.

### Option B: Add a read-only readiness observation to the resolved bundle

Pros:

- stays on the existing mainline read path
- keeps runtime readiness close to execution-profile resolution
- still preserves fail-open behavior

Cons:

- extends the resolve response shape

Recommended.

### Option C: Make runtime-binding readiness a hard prerequisite of resolve

Pros:

- stricter bundle correctness

Cons:

- would change current resolve contract
- would turn a read-model improvement into a new gate

Out of scope.

## 4. Hard Boundaries

### 4.1 Resolve must stay additive and fail-open

If readiness observation succeeds:

- return it alongside the resolved bundle

If readiness observation fails unexpectedly:

- do not fail the resolve call
- return the existing resolved bundle
- mark readiness observation as failed-open

### 4.2 Do not change resolve authority

`execution-resolution` still owns:

- expanding the active execution profile
- model resolution
- knowledge rule and knowledge item expansion

It does not become:

- a runtime-binding control plane
- an activation workflow
- a runtime repair surface

### 4.3 Do not change execution behavior

This slice must not change:

- `resolveActiveProfile`
- active runtime-binding selection rules
- governed execution behavior
- runtime activation behavior
- manuscript execution success/failure rules

### 4.4 No new UI or operator plane

The phase may extend:

- execution-resolution service
- existing resolve API payloads
- existing HTTP tests

It must not add:

- a new panel
- a new workbench page
- a new CLI control surface

## 5. Proposed Response Shape

Add one new additive field to the resolved bundle, conceptually:

- `runtime_binding_readiness`

That field should be an observation wrapper rather than a raw report alone, so
the service can stay fail-open:

- `observation_status = reported | failed_open`
- `report` when readiness reporting succeeded
- `error` when readiness reporting failed-open unexpectedly

When `observation_status = reported`, the nested `report.status` can still be:

- `ready`
- `degraded`
- `missing`

This preserves the distinction between:

- no active binding for the scope
- degraded binding for the scope
- readiness reporting infrastructure failing unexpectedly

## 6. Recommended Architecture

### 6.1 Inject readiness observation into execution resolution

Extend `ExecutionResolutionService` to optionally depend on
`RuntimeBindingReadinessService`.

The flow becomes:

1. resolve active execution profile
2. load module template / prompt / skill / model / knowledge as today
3. ask readiness service for active-scope readiness
4. attach the observation result to the returned bundle

### 6.2 Keep readiness dependency optional

Use an optional service dependency so the existing resolution path can still
operate if the new readiness layer is not wired in some runtime.

That keeps the new behavior fail-open by design.

### 6.3 Catch readiness observation failures locally

Unexpected readiness observation failures should be caught inside the execution
resolution service and returned as:

- `observation_status = failed_open`
- `error = <message>`

The rest of the resolved bundle should still return normally.

## 7. Error Handling Rules

### 7.1 Missing active binding is not a resolve error in this phase

If the active scope has no active runtime binding:

- resolve still succeeds
- readiness observation reports `missing`

This is important because resolve remains an additive read model, not a new gate.

### 7.2 Unexpected readiness errors must not break mainline reads

Examples:

- readiness service wiring bug
- repository read failure
- unexpected read-model exception

In these cases:

- resolve still succeeds
- readiness observation reports `failed_open`

## 8. Out Of Scope

`Phase 11B` does not include:

- new readiness enforcement
- binding activation preview
- automatic binding repair
- workbench UI changes
- execution path behavior changes
- runtime control-plane expansion

## 9. Related Capability Lane

This slice advances:

- `Agent Runtime Platform`

It builds directly on:

- `2026-04-05-phase11a-runtime-binding-readiness-preflight-design.md`
- the current `execution-resolution` bundle contract

It explicitly does not reopen:

- closed `Phase 10` orchestration work
- model-routing control behavior
- harness or workbench expansion
