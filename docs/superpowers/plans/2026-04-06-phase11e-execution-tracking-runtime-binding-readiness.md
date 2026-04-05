# Phase 11E Execution Tracking Runtime Binding Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attach runtime-binding readiness observation to the execution-tracking snapshot API read path without changing snapshot persistence or knowledge-hit storage.

**Architecture:** Keep stored snapshot records unchanged, derive readiness scope from the stored `execution_profile_id`, and enrich snapshot create/get API responses with one additive fail-open readiness observation wrapper using the existing readiness service.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, existing execution-tracking module, execution-governance repository, runtime-binding readiness service, current demo and persistent HTTP runtimes.

---

## Scope Notes

- Do not change snapshot storage schema.
- Do not add migrations.
- Do not change knowledge-hit log storage.
- Keep the new observation fail-open.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-06-phase11e-execution-tracking-runtime-binding-readiness-design.md`
  - Create: `docs/superpowers/plans/2026-04-06-phase11e-execution-tracking-runtime-binding-readiness.md`
- Execution tracking:
  - Modify: `apps/api/src/modules/execution-tracking/execution-tracking-record.ts`
  - Modify: `apps/api/src/modules/execution-tracking/execution-tracking-api.ts`
- Runtime wiring:
  - Modify: `apps/api/src/http/api-http-server.ts`
  - Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Tests:
  - Modify: `apps/api/test/execution-tracking/execution-tracking.spec.ts`
  - Modify: `apps/api/test/http/http-server.spec.ts`
  - Modify: `apps/api/test/http/persistent-governance-http.spec.ts`

## Planned Tasks

### Task 1: Add Snapshot Readiness Observation View

**Files:**
- Modify: `apps/api/src/modules/execution-tracking/execution-tracking-record.ts`
- Modify: `apps/api/src/modules/execution-tracking/execution-tracking-api.ts`
- Modify: `apps/api/test/execution-tracking/execution-tracking.spec.ts`

- [ ] **Step 1: Write the failing execution-tracking tests**

Add coverage that proves:

- snapshot create/get responses include `runtime_binding_readiness.observation_status = reported` when readiness succeeds
- readiness scope is derived from the snapshot `execution_profile_id`
- missing execution-profile context or readiness observation exceptions degrade to `failed_open` without failing the snapshot API response

- [ ] **Step 2: Run the targeted execution-tracking tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- execution-tracking
```

Expected: FAIL because snapshot responses do not yet expose readiness observation.

- [ ] **Step 3: Implement the minimal additive API view**

Implementation rules:

- persisted snapshot record shape remains backward compatible
- execution-governance lookup dependency remains optional
- readiness dependency remains optional
- all observation failures are caught inside the API view assembly

- [ ] **Step 4: Re-run the targeted execution-tracking tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- execution-tracking
```

Expected: PASS.

### Task 2: Wire Demo And Persistent HTTP Snapshot Reads

**Files:**
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Modify: `apps/api/test/http/http-server.spec.ts`
- Modify: `apps/api/test/http/persistent-governance-http.spec.ts`

- [ ] **Step 1: Write the failing HTTP snapshot assertions**

Add coverage that proves:

- demo snapshot create/get responses include `runtime_binding_readiness`
- persistent snapshot create/get responses include `runtime_binding_readiness`
- existing snapshot and hit-log behavior remain unchanged

- [ ] **Step 2: Run the targeted HTTP tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- http-server
pnpm --filter @medical/api test -- persistent-governance-http
```

Expected: FAIL because snapshot HTTP responses do not yet expose readiness observation.

- [ ] **Step 3: Implement the minimal runtime wiring**

Implementation rules:

- reuse existing execution-governance repository and readiness service
- do not add new routes
- do not mutate stored snapshots

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
pnpm --filter @medical/api test -- execution-tracking
pnpm --filter @medical/api test -- http-server
pnpm --filter @medical/api test -- persistent-governance-http
pnpm --filter @medical/api typecheck
```

Expected: PASS.
