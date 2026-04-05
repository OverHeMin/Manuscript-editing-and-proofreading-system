# Phase 11B Execution Resolution Runtime Binding Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attach runtime-binding readiness observation to the existing execution-resolution bundle so callers can inspect execution-profile resolution and current active binding posture in one read path.

**Architecture:** Extend `ExecutionResolutionService` with an optional dependency on the existing runtime-binding readiness service, return one additive observation wrapper on the resolved bundle, and keep the entire observation fail-open so resolve success semantics do not change.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, existing `execution-resolution` and `runtime-bindings` modules, existing API HTTP server.

---

## Scope Notes

- Do not change `resolveActiveProfile` behavior.
- Do not make missing or degraded binding readiness fail the resolve call.
- Do not add new routes; reuse the existing resolve API surface.
- Do not add UI work.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-05-phase11b-execution-resolution-runtime-binding-readiness-design.md`
  - Create: `docs/superpowers/plans/2026-04-05-phase11b-execution-resolution-runtime-binding-readiness.md`
- Execution-resolution:
  - Modify: `apps/api/src/modules/execution-resolution/execution-resolution-record.ts`
  - Modify: `apps/api/src/modules/execution-resolution/execution-resolution-service.ts`
  - Modify: `apps/api/src/modules/execution-resolution/execution-resolution-api.ts`
- Runtime wiring:
  - Modify: `apps/api/src/http/api-http-server.ts`
  - Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Tests:
  - Modify: `apps/api/test/execution-resolution/execution-resolution.spec.ts`
  - Modify: `apps/api/test/http/http-server.spec.ts`
  - Modify: `apps/api/test/http/persistent-governance-http.spec.ts`

## Planned Tasks

### Task 1: Add Execution-Resolution Readiness Observation

**Files:**
- Modify: `apps/api/src/modules/execution-resolution/execution-resolution-record.ts`
- Modify: `apps/api/src/modules/execution-resolution/execution-resolution-service.ts`
- Modify: `apps/api/test/execution-resolution/execution-resolution.spec.ts`

- [ ] **Step 1: Write the failing execution-resolution tests**

Add coverage that proves:

- a resolved bundle reports `runtime_binding_readiness.observation_status = reported` and a nested `ready` report when readiness succeeds
- a resolved bundle reports a nested `missing` report when no active binding exists for the scope
- a thrown readiness observer error degrades to `observation_status = failed_open` while resolve still succeeds

- [ ] **Step 2: Run the targeted execution-resolution tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- execution-resolution
```

Expected: FAIL because the resolved bundle does not yet include readiness observation.

- [ ] **Step 3: Implement the minimal fail-open readiness observation**

Implementation rules:

- readiness dependency remains optional
- unexpected readiness failures are caught locally
- existing bundle resolution logic remains unchanged

- [ ] **Step 4: Re-run the targeted execution-resolution tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- execution-resolution
```

Expected: PASS.

### Task 2: Surface Readiness Observation Through Existing HTTP Resolve Routes

**Files:**
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Modify: `apps/api/test/http/http-server.spec.ts`
- Modify: `apps/api/test/http/persistent-governance-http.spec.ts`

- [ ] **Step 1: Write the failing HTTP resolve tests**

Add coverage that proves:

- demo/in-memory resolve responses include `runtime_binding_readiness`
- persistent resolve responses include `runtime_binding_readiness`
- existing resolve success semantics remain unchanged while readiness is additive

- [ ] **Step 2: Run the targeted HTTP tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- http-server
pnpm --filter @medical/api test -- persistent-governance-http
```

Expected: FAIL because the resolve payload does not yet expose readiness observation.

- [ ] **Step 3: Implement the minimal wiring**

Implementation rules:

- reuse the already-wired readiness service from `11A`
- do not add new endpoints
- do not add UI formatting logic

- [ ] **Step 4: Re-run the targeted HTTP tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- http-server
pnpm --filter @medical/api test -- persistent-governance-http
```

Expected: PASS.

### Task 3: Run Final Serial Verification

**Files:**
- No additional file changes

- [ ] **Step 1: Run the final serial verification set**

Run:

```bash
pnpm --filter @medical/api test -- execution-resolution
pnpm --filter @medical/api test -- runtime-binding-registry
pnpm --filter @medical/api test -- http-server
pnpm --filter @medical/api test -- persistent-governance-http
pnpm --filter @medical/api typecheck
```

Expected: PASS.
