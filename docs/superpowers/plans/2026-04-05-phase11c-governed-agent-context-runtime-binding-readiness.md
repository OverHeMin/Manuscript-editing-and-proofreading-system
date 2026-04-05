# Phase 11C Governed Agent Context Runtime Binding Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attach runtime-binding readiness observation to the governed agent-context resolver and wire it through the current governed module execution callers without changing execution success semantics.

**Architecture:** Extend `resolveGovernedAgentContext` with one additive fail-open readiness observation wrapper keyed off the resolved active binding id, then thread the optional readiness service through current mainline callers so screening, editing, proofreading, and governed retrieval context resolution all receive the richer context.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, existing governed context resolvers, runtime-binding readiness service, current mainline module services.

---

## Scope Notes

- Do not change governed agent-context hard failure behavior.
- Do not add a new route or panel.
- Do not change job, snapshot, or orchestration schemas in this phase.
- Keep the new observation fail-open.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-05-phase11c-governed-agent-context-runtime-binding-readiness-design.md`
  - Create: `docs/superpowers/plans/2026-04-05-phase11c-governed-agent-context-runtime-binding-readiness.md`
- Governed context:
  - Modify: `apps/api/src/modules/shared/governed-agent-context-resolver.ts`
- Mainline caller wiring:
  - Modify: `apps/api/src/modules/screening/screening-service.ts`
  - Modify: `apps/api/src/modules/editing/editing-service.ts`
  - Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
  - Modify: `apps/api/src/modules/knowledge/knowledge-service.ts`
  - Modify: `apps/api/src/http/api-http-server.ts`
  - Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Tests:
  - Modify: `apps/api/test/modules/governed-agent-context-resolver.spec.ts`
  - Modify: `apps/api/test/modules/governed-module-context-resolver.spec.ts`

## Planned Tasks

### Task 1: Add Governed Agent-Context Readiness Observation

**Files:**
- Modify: `apps/api/src/modules/shared/governed-agent-context-resolver.ts`
- Modify: `apps/api/test/modules/governed-agent-context-resolver.spec.ts`
- Modify: `apps/api/test/modules/governed-module-context-resolver.spec.ts`

- [ ] **Step 1: Write the failing resolver tests**

Add coverage that proves:

- governed agent-context resolution reports `runtimeBindingReadiness.observation_status = reported` and a nested readiness report when the readiness service succeeds
- governed agent-context resolution reports `runtimeBindingReadiness.observation_status = failed_open` when readiness observation throws unexpectedly
- existing active-binding-not-found behavior remains unchanged

- [ ] **Step 2: Run the governed resolver tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- governed-agent-context-resolver
pnpm --filter @medical/api test -- governed-module-context-resolver
```

Expected: FAIL because governed agent context does not yet expose readiness observation.

- [ ] **Step 3: Implement the minimal fail-open observation**

Implementation rules:

- keep the readiness dependency optional
- observe readiness by resolved binding id
- catch readiness observation failures locally inside the resolver
- leave all current hard consistency errors unchanged

- [ ] **Step 4: Re-run the governed resolver tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- governed-agent-context-resolver
pnpm --filter @medical/api test -- governed-module-context-resolver
```

Expected: PASS.

### Task 2: Wire The Observation Through Current Mainline Callers

**Files:**
- Modify: `apps/api/src/modules/screening/screening-service.ts`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-service.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`

- [ ] **Step 1: Thread the optional readiness service through existing caller options**

Add optional `runtimeBindingReadinessService` dependencies where needed so the
current mainline runtimes can pass the service into `resolveGovernedAgentContext`
without changing non-wired callers.

- [ ] **Step 2: Run a mainline smoke verification**

Run:

```bash
pnpm --filter @medical/api test -- http-server
```

Expected: PASS, confirming the current demo mainline still executes through the updated resolver wiring.

### Task 3: Run Final Serial Verification

**Files:**
- No additional file changes

- [ ] **Step 1: Run the final serial verification set**

Run:

```bash
pnpm --filter @medical/api test -- governed-agent-context-resolver
pnpm --filter @medical/api test -- governed-module-context-resolver
pnpm --filter @medical/api test -- http-server
pnpm --filter @medical/api test -- persistent-governance-http
pnpm --filter @medical/api typecheck
```

Expected: PASS.
