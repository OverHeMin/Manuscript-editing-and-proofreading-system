# Phase 8F Execution Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist execution governance and execution tracking, expose execution resolution APIs, and add a minimal admin workbench execution surface that previews governed runtime bundles.

**Architecture:** Keep the existing service-layer contracts intact, add PostgreSQL repositories plus additive HTTP routes, then extend the admin governance controller/page to create and publish execution profiles and preview the resolved runtime bundle composed from governance assets.

**Tech Stack:** TypeScript, node:test, PostgreSQL via `pg`, React/Vite, existing browser HTTP client, current workbench host routing.

---

### Task 1: Persist Execution Governance And Tracking

**Files:**
- Create: `apps/api/src/database/migrations/0008_execution_runtime_persistence.sql`
- Create: `apps/api/src/modules/execution-governance/postgres-execution-governance-repository.ts`
- Create: `apps/api/src/modules/execution-tracking/postgres-execution-tracking-repository.ts`
- Modify: `apps/api/src/modules/execution-governance/index.ts`
- Modify: `apps/api/src/modules/execution-tracking/index.ts`
- Modify: `apps/api/test/database/schema.spec.ts`
- Create: `apps/api/test/execution-governance/postgres-execution-governance-persistence.spec.ts`
- Create: `apps/api/test/execution-tracking/postgres-execution-tracking-persistence.spec.ts`

- [ ] Write failing schema and repository tests for execution profiles, binding rules, snapshots, and hit logs.
- [ ] Implement the migration and PostgreSQL repositories.
- [ ] Re-run the targeted schema and repository tests.

### Task 2: Add Execution Resolution Runtime APIs

**Files:**
- Modify: `apps/api/src/modules/execution-governance/execution-governance-service.ts`
- Modify: `apps/api/src/modules/execution-governance/execution-governance-api.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Modify: `apps/api/test/http/http-server.spec.ts`
- Modify: `apps/api/test/http/persistent-governance-http.spec.ts`

- [ ] Add failing HTTP tests for execution governance routes, tracking routes, and execution resolution preview.
- [ ] Add a resolved execution bundle service/API contract.
- [ ] Wire demo and persistent runtimes to the new execution APIs.
- [ ] Re-run the targeted HTTP tests.

### Task 3: Extend The Admin Governance Workbench

**Files:**
- Modify: `apps/web/src/features/execution-governance/types.ts`
- Modify: `apps/web/src/features/execution-governance/execution-governance-api.ts`
- Modify: `apps/web/src/features/admin-governance/admin-governance-controller.ts`
- Modify: `apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx`
- Modify: `apps/web/src/features/admin-governance/admin-governance-workbench.css`
- Modify: `apps/web/test/admin-governance-controller.spec.ts`

- [ ] Add failing controller tests for loading execution profiles and resolution preview.
- [ ] Extend browser clients and the admin governance controller.
- [ ] Add a minimal execution section to the governance workbench.
- [ ] Re-run the targeted web tests.

### Task 4: Sync Docs And Verify

**Files:**
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`
- Create: `docs/superpowers/specs/2026-03-30-phase8f-execution-resolution-design.md`
- Create: `docs/superpowers/plans/2026-03-30-phase8f-execution-resolution.md`

- [ ] Update runtime capability docs to include execution governance/tracking persistence and resolution preview.
- [ ] Run targeted API and web tests.
- [ ] Run repo-level verification before commit.
