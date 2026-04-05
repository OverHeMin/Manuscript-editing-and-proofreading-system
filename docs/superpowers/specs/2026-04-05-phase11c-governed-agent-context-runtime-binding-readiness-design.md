# Phase 11C Governed Agent Context Runtime Binding Readiness Design

**Date:** 2026-04-05  
**Status:** Proposed for immediate implementation after Phase 11B  
**Scope:** Extend the existing governed agent-context resolver with one additive fail-open runtime-binding readiness observation so module execution callers can see current binding posture together with the resolved runtime/sandbox/agent/tool context.

## 1. Goal

`Phase 11A` added standalone runtime-binding readiness inspection.
`Phase 11B` attached the same readiness posture to the `execution-governance/resolve`
bundle.

The next narrow mainline-serving gap is one level deeper:

- `resolveGovernedAgentContext` is the actual runtime-facing resolver used by
  governed module execution
- it already returns the active binding, runtime, sandbox, agent profile, tool
  policy, and verification expectation ids
- but it still does not surface whether those verification or evaluation
  references are currently degraded without a separate readiness read

In one sentence:

`Phase 11C` should attach runtime-binding readiness observation to the existing
governed agent-context read path so execution callers can inspect runtime
dependency posture without changing governed-agent resolution success semantics.

## 2. Why This Slice Exists

The current governed agent-context resolver already enforces hard consistency for:

- active runtime binding presence
- active runtime presence
- active sandbox presence
- published agent profile presence
- active tool policy presence
- prompt / skill alignment with the governed module context

What it does not answer is:

- whether verification check profiles attached to the binding are still published
- whether evaluation suites attached to the binding are still active
- whether release check profiles attached to the binding are still published
- whether the full runtime-binding readiness report can still be assembled cleanly

That means the actual execution call path still lacks one in-band observation
that the binding has drifted in a non-gating but operationally meaningful way.

## 3. Recommended Option

### Option A: Keep readiness observation only on standalone inspection and execution-resolution

Pros:

- no change to governed agent-context contract

Cons:

- actual execution callers still need a second read to inspect binding posture
- the deepest mainline read path still lacks readiness visibility

Not recommended.

### Option B: Add a read-only readiness observation to governed agent context

Pros:

- stays on the real execution-facing read path
- reuses the existing readiness service
- preserves fail-open semantics

Cons:

- extends the governed agent-context shape

Recommended.

### Option C: Turn degraded readiness into a new governed-agent resolution gate

Pros:

- stricter runtime posture

Cons:

- would change existing module execution behavior
- violates the requirement that new capabilities stay fail-open

Out of scope.

## 4. Hard Boundaries

### 4.1 Governing resolution behavior must stay unchanged

This phase must not change:

- `ActiveRuntimeBindingNotFoundError`
- governed runtime/sandbox/agent/tool consistency checks
- governed module execution success/failure semantics
- job creation, execution snapshot, or orchestration dispatch logic

### 4.2 Readiness observation is additive and fail-open

If readiness observation succeeds:

- return it on the governed agent context

If readiness observation fails unexpectedly:

- do not fail governed agent-context resolution
- return the existing governed agent context
- mark readiness observation as `failed_open`

### 4.3 No new operator surface

This phase may extend:

- governed agent-context resolver records
- resolver dependencies
- existing mainline service wiring

It must not add:

- a new route
- a new dashboard
- a new workbench surface
- a new control plane

## 5. Proposed Response Shape

Add one new additive field to `GovernedAgentContext`, conceptually:

- `runtimeBindingReadiness`

Use the same observation-wrapper pattern established in `11B`:

- `observation_status = reported | failed_open`
- `report` when readiness reporting succeeds
- `error` when readiness observation fails unexpectedly

When `observation_status = reported`, the nested `report.status` can still be:

- `ready`
- `degraded`
- `missing`

In this phase, `missing` is not expected in normal governed-agent resolution
because the resolver already requires an active binding, but keeping the same
report shape avoids introducing a second readiness dialect.

## 6. Recommended Architecture

### 6.1 Inject readiness observation into the governed agent-context resolver

Extend `ResolveGovernedAgentContextInput` with an optional dependency on the
existing `RuntimeBindingReadinessService`.

The resolver flow becomes:

1. resolve governed module context
2. resolve active binding and required runtime assets as today
3. assemble the existing governed agent context
4. attach readiness observation for the resolved active binding

### 6.2 Keep the dependency optional

If a caller does not wire the readiness service yet, the resolver should still
return the governed agent context with:

- `observation_status = failed_open`
- `error = Runtime binding readiness service is unavailable.`

That keeps all existing call sites compatible while allowing mainline runtimes
to opt into the richer observation immediately.

### 6.3 Wire only current governed mainline callers

The phase should thread the readiness service through the existing callers that
already invoke `resolveGovernedAgentContext`:

- `screening`
- `editing`
- `proofreading`
- governed retrieval context resolution inside `knowledge`

This keeps the slice on actual mainline service paths without broadening to new
surfaces.

## 7. Error Handling Rules

### 7.1 Existing hard failures remain hard failures

Examples:

- missing active runtime binding
- inactive runtime
- inactive sandbox
- unpublished agent profile
- inactive tool policy
- prompt / skill drift against governed module context

These must keep throwing exactly as they do today.

### 7.2 Readiness assembly failures must not become new gates

Examples:

- readiness service wiring bug
- repository read failure inside readiness reporting
- unexpected readiness-service exception

In these cases:

- governed agent-context resolution still succeeds
- the returned readiness observation reports `failed_open`

## 8. Out Of Scope

`Phase 11C` does not include:

- new readiness enforcement
- runtime binding mutation
- execution log schema changes
- execution snapshot schema changes
- new API endpoints
- workbench or control-plane expansion

## 9. Related Capability Lane

This slice advances:

- `Agent Runtime Platform`

It builds directly on:

- `2026-04-05-phase11a-runtime-binding-readiness-preflight-design.md`
- `2026-04-05-phase11b-execution-resolution-runtime-binding-readiness-design.md`
- the current governed agent-context resolver and governed module execution services

It explicitly does not reopen:

- closed `Phase 10` orchestration work
- execution gating changes
- peripheral operator-plane work
