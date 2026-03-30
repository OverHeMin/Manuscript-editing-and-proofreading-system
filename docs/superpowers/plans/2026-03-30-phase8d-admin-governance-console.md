# Phase 8D Admin Governance Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the Prompt/Skill Registry, expose governance HTTP routes, and replace the admin-console placeholder with a real governance workbench.

**Architecture:** Keep service-layer contracts intact, add a PostgreSQL registry adapter plus additive HTTP routes, then build a small admin governance page that composes the existing browser clients through a focused controller.

**Tech Stack:** TypeScript, node:test, PostgreSQL via `pg`, React/Vite, existing browser HTTP client, current workbench host routing.

---

### Task 1: Persist Prompt And Skill Registry Assets

**Files:**
- Create: `apps/api/src/database/migrations/0006_prompt_skill_registry_persistence.sql`
- Create: `apps/api/src/modules/prompt-skill-registry/postgres-prompt-skill-repository.ts`
- Modify: `apps/api/src/modules/prompt-skill-registry/index.ts`
- Modify: `apps/api/test/database/schema.spec.ts`
- Create: `apps/api/test/prompt-skill-registry/postgres-prompt-skill-persistence.spec.ts`

- [ ] Add failing schema and repository tests.
- [ ] Implement the migration and repository.
- [ ] Re-run targeted database and prompt-skill tests.

### Task 2: Expose Governance HTTP Routes

**Files:**
- Modify: `apps/api/src/modules/templates/template-governance-service.ts`
- Modify: `apps/api/src/modules/templates/template-api.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Modify: `apps/api/test/http/http-server.spec.ts`
- Modify: `apps/api/test/http/persistent-governance-http.spec.ts`

- [ ] Add failing HTTP coverage for admin governance routes.
- [ ] Extend runtime shape and route matching.
- [ ] Wire persistent runtime to PostgreSQL-backed Prompt/Skill Registry.
- [ ] Re-run targeted HTTP tests.

### Task 3: Build The Admin Governance Workbench

**Files:**
- Create: `apps/web/src/features/admin-governance/admin-governance-controller.ts`
- Create: `apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx`
- Create: `apps/web/src/features/admin-governance/admin-governance-workbench.css`
- Create: `apps/web/src/features/admin-governance/index.ts`
- Modify: `apps/web/src/features/templates/template-api.ts`
- Modify: `apps/web/src/app/workbench-routing.ts`
- Modify: `apps/web/src/app/workbench-host.tsx`
- Create: `apps/web/test/admin-governance-controller.spec.ts`
- Modify: `apps/web/test/workbench-host-routing.spec.ts`

- [ ] Add failing controller and route tests.
- [ ] Implement the admin governance controller.
- [ ] Implement the admin governance page and connect it to the workbench host.
- [ ] Re-run targeted web tests.

### Task 4: Sync Docs And Verify

**Files:**
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`
- Create: `docs/superpowers/specs/2026-03-30-phase8d-admin-governance-console-design.md`
- Create: `docs/superpowers/plans/2026-03-30-phase8d-admin-governance-console.md`

- [ ] Update runtime capability docs.
- [ ] Run targeted API/web tests.
- [ ] Run repo-level verification before commit.
