# Phase 11A Runtime Binding Readiness Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one additive, read-only readiness report for runtime bindings so operators can inspect whether a binding or active governed scope is still executable without changing existing activation or execution contracts.

**Architecture:** Introduce a dedicated readiness read-model service under the runtime-binding lane, expose two read-only API methods plus matching HTTP routes, and keep all existing create/activate/routing/mainline execution behavior unchanged. The slice stays local-first, fail-open, and intentionally avoids UI or control-plane expansion.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, existing runtime-binding / execution-governance / governed-context services, existing API HTTP server.

---

## Scope Notes

- Do not change `createBinding` success rules.
- Do not change `activateBinding` success rules.
- Do not add automatic repair or activation helpers.
- Do not add a new workbench panel.
- Do not make readiness inspection a startup or execution hard dependency.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-05-phase11a-runtime-binding-readiness-preflight-design.md`
  - Create: `docs/superpowers/plans/2026-04-05-phase11a-runtime-binding-readiness-preflight.md`
- Runtime-binding read model:
  - Create: `apps/api/src/modules/runtime-bindings/runtime-binding-readiness.ts`
  - Create: `apps/api/src/modules/runtime-bindings/runtime-binding-readiness-service.ts`
  - Modify: `apps/api/src/modules/runtime-bindings/runtime-binding-api.ts`
  - Modify: `apps/api/src/modules/runtime-bindings/index.ts`
- Runtime wiring:
  - Modify: `apps/api/src/http/persistent-governance-runtime.ts`
  - Modify: `apps/api/src/http/api-http-server.ts`
- Tests:
  - Modify: `apps/api/test/runtime-bindings/runtime-binding-registry.spec.ts`
  - Modify: `apps/api/test/http/http-server.spec.ts`
  - Modify: `apps/api/test/http/persistent-governance-http.spec.ts`
- Contract docs:
  - Modify: `README.md`
  - Modify: `docs/OPERATIONS.md`
  - Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
  - Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

## Planned Tasks

### Task 1: Add Readiness Report Service

**Files:**
- Create: `apps/api/src/modules/runtime-bindings/runtime-binding-readiness.ts`
- Create: `apps/api/src/modules/runtime-bindings/runtime-binding-readiness-service.ts`
- Modify: `apps/api/src/modules/runtime-bindings/index.ts`
- Modify: `apps/api/test/runtime-bindings/runtime-binding-registry.spec.ts`

- [ ] **Step 1: Write the failing readiness-service tests**

Add coverage that proves:

- a fully active, aligned binding reports `ready`
- a scope with no active binding reports `missing`
- an active binding with archived or unpublished dependencies reports `degraded` with bounded issue codes
- a binding pinned to an archived or mismatched execution profile reports execution-profile drift issues
- a binding whose prompt or skill package set no longer matches the active execution profile reports drift instead of mutating any stored record

- [ ] **Step 2: Run the targeted runtime-binding tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- runtime-binding-registry
```

Expected: FAIL because readiness report types and service methods do not exist yet.

- [ ] **Step 3: Implement the minimal readiness read model**

Implementation rules:

- aggregate multiple issues when possible
- keep the report fully read-only
- reuse authoritative services/repositories instead of duplicating lifecycle state
- keep all existing binding create/activate behavior unchanged

- [ ] **Step 4: Re-run the targeted runtime-binding tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- runtime-binding-registry
```

Expected: PASS.

### Task 2: Expose Read-Only API And HTTP Routes

**Files:**
- Modify: `apps/api/src/modules/runtime-bindings/runtime-binding-api.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/test/http/http-server.spec.ts`
- Modify: `apps/api/test/http/persistent-governance-http.spec.ts`

- [ ] **Step 1: Write the failing HTTP tests**

Add coverage that proves:

- `GET /api/v1/runtime-bindings/:bindingId/readiness` returns a readiness report for admins
- `GET /api/v1/runtime-bindings/by-scope/:module/:manuscriptType/:templateFamilyId/active-readiness` returns the active-scope readiness report
- the route stays admin-only
- degraded readiness returns a normal read-model payload rather than mutating binding state

- [ ] **Step 2: Run the targeted HTTP tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- http-server
pnpm --filter @medical/api test -- persistent-governance-http
```

Expected: FAIL because the readiness API methods and routes do not exist yet.

- [ ] **Step 3: Implement the minimal API and routing**

Implementation rules:

- add only read-only methods
- do not widen session/permission rules beyond existing `permissions.manage`
- keep the route contract compact and machine-readable
- avoid introducing UI-only formatting into the API payload

- [ ] **Step 4: Re-run the targeted HTTP tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- http-server
pnpm --filter @medical/api test -- persistent-governance-http
```

Expected: PASS.

### Task 3: Update Docs And Boundary Records

**Files:**
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

- [ ] **Step 1: Update operator-facing docs**

Document:

- the new read-only runtime-binding readiness endpoints
- that readiness reporting is additive and fail-open
- that it does not activate, archive, route, or repair anything

- [ ] **Step 2: Update phase-boundary docs**

Document:

- `11A` as the next fresh post-`10W` slice
- that it advances the `Agent Runtime Platform` lane
- that it stays mainline-serving and does not reopen `Phase 10`

### Task 4: Run Final Serial Verification

**Files:**
- No additional file changes

- [ ] **Step 1: Run the final serial verification set**

Run:

```bash
pnpm --filter @medical/api test -- runtime-binding-registry
pnpm --filter @medical/api test -- http-server
pnpm --filter @medical/api test -- persistent-governance-http
pnpm --filter @medical/api test -- governed-agent-context-resolver
pnpm --filter @medical/api test -- governed-module-context-resolver
pnpm --filter @medical/api typecheck
```

Expected: PASS.

- [ ] **Step 2: Re-check git diff for scope discipline**

Confirm:

- no activation semantics changed
- no new UI surface was introduced
- no routing / orchestration contract was widened
