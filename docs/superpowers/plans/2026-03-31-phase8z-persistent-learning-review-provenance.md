# Phase 8Z Persistent Learning Review Provenance

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make reviewed-case snapshots and governed learning provenance survive persistent-runtime restarts so Learning Review can become a durable workflow instead of a session-only demo.

**Architecture:** Add Postgres-backed persistence for reviewed case snapshots and learning candidate source links, wire the persistent governance runtime to those repositories, and prove restart durability with HTTP tests. Keep the in-memory runtime unchanged so local/demo flows stay lightweight.

**Tech Stack:** TypeScript, node:test via `tsx`, Postgres repositories, SQL migrations, persistent HTTP runtime.

---

## Planned Tasks

### Task 1: Durable Learning Review Storage

**Files:**
- Modify: `apps/api/src/modules/learning/learning-repository.ts`
- Modify: `apps/api/src/modules/learning/postgres-learning-repository.ts`
- Modify: `apps/api/src/modules/learning/index.ts`
- Modify: `apps/api/src/modules/feedback-governance/index.ts`
- Create: `apps/api/src/modules/feedback-governance/postgres-feedback-governance-repository.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Create: `apps/api/src/database/migrations/0010_learning_review_persistence.sql`

- [ ] Add failing persistence coverage for reviewed snapshots and governed source links.
- [ ] Verify the failures come from in-memory learning-review provenance storage in the persistent runtime.
- [ ] Add Postgres repositories and migration for reviewed snapshots and learning provenance links.
- [ ] Wire the persistent runtime to the durable repositories.
- [ ] Re-run the targeted persistent tests.

### Task 2: Restart-Proven Learning Review Flow

**Files:**
- Modify: `apps/api/test/http/persistent-workbench-http.spec.ts`
- Modify: `apps/api/test/http/persistent-http-server.spec.ts`

- [ ] Add a restart test that creates a reviewed-case snapshot, restarts the server, and then creates/approves a governed candidate from persisted provenance.
- [ ] Verify the failure.
- [ ] Keep the test minimal and scoped to the durable learning-review path.
- [ ] Re-run the targeted HTTP tests.

## Final Verification Gate

- [ ] Run: `pnpm --filter @medical/api exec node --import tsx --test test/http/persistent-http-server.spec.ts test/http/persistent-workbench-http.spec.ts`
- [ ] Run: `pnpm --filter @medical/api run typecheck`
- [ ] Run: `pnpm verify:manuscript-workbench`
