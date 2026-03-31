# Phase 8G Agent Tooling Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the agent-tooling governance skeleton in PostgreSQL, expose the matching HTTP routes, and wire both demo and persistent runtimes so the existing web clients target real server APIs.

**Architecture:** Keep the current service contracts and web typed clients unchanged where possible. Add PostgreSQL repositories and a migration for the agent runtime, tool gateway, sandbox profile, agent profile, runtime binding, tool permission policy, and agent execution modules, then extend the HTTP server and persistent runtime to serve the exact paths already expected by the web layer.

**Tech Stack:** TypeScript, node:test, PostgreSQL via `pg`, existing HTTP server/runtime pattern, current browser client contracts.

---

### Task 1: Persist Agent Tooling Governance State

**Files:**
- Create: `apps/api/src/database/migrations/0009_agent_tooling_persistence.sql`
- Create: `apps/api/src/modules/agent-runtime/postgres-agent-runtime-repository.ts`
- Create: `apps/api/src/modules/tool-gateway/postgres-tool-gateway-repository.ts`
- Create: `apps/api/src/modules/sandbox-profiles/postgres-sandbox-profile-repository.ts`
- Create: `apps/api/src/modules/agent-profiles/postgres-agent-profile-repository.ts`
- Create: `apps/api/src/modules/runtime-bindings/postgres-runtime-binding-repository.ts`
- Create: `apps/api/src/modules/tool-permission-policies/postgres-tool-permission-policy-repository.ts`
- Create: `apps/api/src/modules/agent-execution/postgres-agent-execution-repository.ts`
- Modify: `apps/api/src/modules/agent-runtime/index.ts`
- Modify: `apps/api/src/modules/tool-gateway/index.ts`
- Modify: `apps/api/src/modules/sandbox-profiles/index.ts`
- Modify: `apps/api/src/modules/agent-profiles/index.ts`
- Modify: `apps/api/src/modules/runtime-bindings/index.ts`
- Modify: `apps/api/src/modules/tool-permission-policies/index.ts`
- Modify: `apps/api/src/modules/agent-execution/index.ts`
- Modify: `apps/api/test/database/schema.spec.ts`
- Create: `apps/api/test/agent-runtime/postgres-agent-runtime-persistence.spec.ts`
- Create: `apps/api/test/tool-gateway/postgres-tool-gateway-persistence.spec.ts`
- Create: `apps/api/test/sandbox-profiles/postgres-sandbox-profile-persistence.spec.ts`
- Create: `apps/api/test/agent-profiles/postgres-agent-profile-persistence.spec.ts`
- Create: `apps/api/test/runtime-bindings/postgres-runtime-binding-persistence.spec.ts`
- Create: `apps/api/test/tool-permission-policies/postgres-tool-permission-policy-persistence.spec.ts`
- Create: `apps/api/test/agent-execution/postgres-agent-execution-persistence.spec.ts`

- [ ] Write failing schema and repository persistence tests for all seven agent-tooling modules.
- [ ] Implement the migration and PostgreSQL repositories without changing service-level contracts.
- [ ] Re-run the targeted schema and repository tests.

### Task 2: Expose Agent Tooling HTTP Routes

**Files:**
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/test/http/http-server.spec.ts`

- [ ] Write failing HTTP tests for the in-memory server using the web client path contracts.
- [ ] Add route matching, permission checks, request body parsing, and error mapping for agent runtime, tool gateway, sandbox profile, agent profile, runtime bindings, tool permission policies, and agent execution.
- [ ] Re-run the targeted HTTP route tests.

### Task 3: Wire The Persistent Governance Runtime

**Files:**
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Modify: `apps/api/test/http/persistent-governance-http.spec.ts`

- [ ] Write failing restart-persistence tests that create agent-tooling records through HTTP, restart the server, and verify the data still exists.
- [ ] Replace the missing in-memory agent-tooling services in the persistent runtime with PostgreSQL-backed implementations.
- [ ] Re-run the targeted persistent HTTP tests.

### Task 4: Sync Docs And Run Full Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`
- Create: `docs/superpowers/plans/2026-03-30-phase8g-agent-tooling-persistence.md`

- [ ] Update runtime status docs so they reflect that agent-tooling governance is now backed by persistent HTTP APIs.
- [ ] Run targeted tests while iterating, then run full `pnpm lint`, `pnpm typecheck`, and `pnpm test`.
- [ ] Stage, commit, and summarize the finished phase with verification evidence.
