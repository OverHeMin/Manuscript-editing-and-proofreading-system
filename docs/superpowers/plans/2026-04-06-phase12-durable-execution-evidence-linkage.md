# Phase 12 Durable Execution Evidence Linkage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the optional snapshot-to-execution-log linkage and expose additive fail-open linked agent-execution settlement/recovery observation on the existing execution-tracking create/get read path.

**Architecture:** Add one nullable `agent_execution_log_id` column to `execution_snapshots`, thread the log id through the current screening/editing/proofreading snapshot write paths, and enrich the existing snapshot API view with linked execution-log observation derived from current `11F/11G` read-model helpers. Keep all behavior additive, local-first, and fail-open.

**Tech Stack:** pnpm monorepo, TypeScript, PostgreSQL migrations, node:test via `tsx`, existing execution-tracking and agent-execution modules, demo/persistent HTTP runtimes.

---

## Scope Notes

- Do not add new routes.
- Do not change replay/recovery behavior.
- Do not make linked-log loading a hard dependency for snapshot reads.
- Do not change routing control-plane or verification-ops contracts.
- Keep snapshot persistence additive and backward-compatible.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-06-phase12-durable-execution-evidence-linkage-design.md`
  - Create: `docs/superpowers/plans/2026-04-06-phase12-durable-execution-evidence-linkage.md`
- Migration and schema assertions:
  - Create: `apps/api/src/database/migrations/0024_execution_snapshot_agent_execution_linkage.sql`
  - Modify: `apps/api/test/database/schema.spec.ts`
- Execution tracking:
  - Modify: `apps/api/src/modules/execution-tracking/execution-tracking-record.ts`
  - Modify: `apps/api/src/modules/execution-tracking/execution-tracking-service.ts`
  - Modify: `apps/api/src/modules/execution-tracking/execution-tracking-repository.ts`
  - Modify: `apps/api/src/modules/execution-tracking/in-memory-execution-tracking-repository.ts`
  - Modify: `apps/api/src/modules/execution-tracking/postgres-execution-tracking-repository.ts`
  - Modify: `apps/api/src/modules/execution-tracking/execution-tracking-api.ts`
- Agent execution read-model helpers:
  - Create: `apps/api/src/modules/agent-execution/agent-execution-view.ts`
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-api.ts`
- Module services:
  - Modify: `apps/api/src/modules/screening/screening-service.ts`
  - Modify: `apps/api/src/modules/editing/editing-service.ts`
  - Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Runtime wiring:
  - Modify: `apps/api/src/http/api-http-server.ts`
  - Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Tests:
  - Modify: `apps/api/test/execution-tracking/execution-tracking.spec.ts`
  - Modify: `apps/api/test/execution-tracking/postgres-execution-tracking-persistence.spec.ts`
  - Modify: `apps/api/test/modules/module-orchestration.spec.ts`
  - Modify: `apps/api/test/http/http-server.spec.ts`
  - Modify: `apps/api/test/http/persistent-governance-http.spec.ts`
- Phase tracking:
  - Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
  - Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

## Planned Tasks

### Task 1: Lock The Schema And Snapshot Repository Contract

**Files:**
- Create: `apps/api/src/database/migrations/0024_execution_snapshot_agent_execution_linkage.sql`
- Modify: `apps/api/test/database/schema.spec.ts`
- Modify: `apps/api/test/execution-tracking/postgres-execution-tracking-persistence.spec.ts`
- Modify: `apps/api/src/modules/execution-tracking/execution-tracking-record.ts`
- Modify: `apps/api/src/modules/execution-tracking/execution-tracking-repository.ts`
- Modify: `apps/api/src/modules/execution-tracking/in-memory-execution-tracking-repository.ts`
- Modify: `apps/api/src/modules/execution-tracking/postgres-execution-tracking-repository.ts`

- [ ] **Step 1: Write the failing schema and persistence assertions**

Add coverage that proves:

- `execution_snapshots` now includes `agent_execution_log_id`
- PostgreSQL snapshot persistence round-trips the new optional field

- [ ] **Step 2: Run the targeted schema and persistence tests to confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- schema.spec.ts
pnpm --filter @medical/api test -- postgres-execution-tracking-persistence
```

Expected: FAIL because the new column and repository contract do not exist yet.

- [ ] **Step 3: Implement the additive migration and repository support**

Implementation rules:

- add one nullable text column only
- keep old rows readable
- keep repository cloning/round-trip behavior backward compatible

- [ ] **Step 4: Re-run the targeted schema and persistence tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- schema.spec.ts
pnpm --filter @medical/api test -- postgres-execution-tracking-persistence
```

Expected: PASS.

### Task 2: Thread Linked Log Id Through The Existing Module Mainline

**Files:**
- Modify: `apps/api/test/modules/module-orchestration.spec.ts`
- Modify: `apps/api/src/modules/execution-tracking/execution-tracking-service.ts`
- Modify: `apps/api/src/modules/screening/screening-service.ts`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`

- [ ] **Step 1: Write the failing orchestration-path tests**

Add coverage that proves:

- screening snapshots persist the created execution log id
- editing snapshots persist the created execution log id
- proofreading draft snapshots persist the draft execution log id
- proofreading final confirmation snapshots persist the reused draft execution log id

- [ ] **Step 2: Run the targeted module-orchestration tests to confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- module-orchestration
```

Expected: FAIL because snapshot records do not yet carry the linked log id.

- [ ] **Step 3: Implement the write-path threading**

Implementation rules:

- extend `RecordExecutionSnapshotInput` with optional `agentExecutionLogId`
- persist it without making it required
- pass the existing log id through current service call sites only

- [ ] **Step 4: Re-run the module-orchestration tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- module-orchestration
```

Expected: PASS.

### Task 3: Add Linked Agent-Execution Observation To Snapshot Reads

**Files:**
- Modify: `apps/api/test/execution-tracking/execution-tracking.spec.ts`
- Create: `apps/api/src/modules/agent-execution/agent-execution-view.ts`
- Modify: `apps/api/src/modules/agent-execution/agent-execution-api.ts`
- Modify: `apps/api/src/modules/execution-tracking/execution-tracking-api.ts`

- [ ] **Step 1: Write the failing execution-tracking API tests**

Add coverage that proves:

- linked snapshot responses report `agent_execution.observation_status = reported`
- linked snapshot responses include current `status`, `orchestration_status`, `completion_summary`, and `recovery_summary`
- snapshots without a log id return `not_linked`
- snapshot reads fail open when linked log lookup fails

- [ ] **Step 2: Run the targeted execution-tracking tests to confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- execution-tracking
```

Expected: FAIL because snapshot reads do not yet expose linked execution observation.

- [ ] **Step 3: Implement the shared read-model helper and snapshot enrichment**

Implementation rules:

- do not duplicate `11F/11G` derivation logic
- keep linked execution loading optional and fail-open
- do not add route handlers or mutate existing response status codes

- [ ] **Step 4: Re-run the execution-tracking tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- execution-tracking
```

Expected: PASS.

### Task 4: Wire Demo And Persistent HTTP Runtime Exposure

**Files:**
- Modify: `apps/api/test/http/http-server.spec.ts`
- Modify: `apps/api/test/http/persistent-governance-http.spec.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`

- [ ] **Step 1: Write the failing HTTP assertions**

Add coverage that proves:

- demo snapshot create/get routes expose the linked agent execution observation
- persistent snapshot create/get routes expose the same observation across restart

- [ ] **Step 2: Run the targeted HTTP tests to confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- http-server
pnpm --filter @medical/api test -- persistent-governance-http
```

Expected: FAIL because the runtime wiring does not yet pass linked execution dependencies into the snapshot API.

- [ ] **Step 3: Add minimal runtime wiring**

Implementation rules:

- inject the existing `agentExecutionService` into `createExecutionTrackingApi`
- do not change route registration
- keep missing service wiring fail-open

- [ ] **Step 4: Re-run the targeted HTTP tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- http-server
pnpm --filter @medical/api test -- persistent-governance-http
```

Expected: PASS.

### Task 5: Record Phase Ownership And Run Final Serial Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

- [ ] **Step 1: Record Phase 12 in the boundary docs**

Document this as the fresh post-11 execution/orchestration phase that closes the
snapshot-to-log durable evidence gap without reopening replay or control-plane
scope.

- [ ] **Step 2: Run the final serial verification set**

Run:

```bash
pnpm --filter @medical/api test -- schema.spec.ts
pnpm --filter @medical/api test -- postgres-execution-tracking-persistence
pnpm --filter @medical/api test -- execution-tracking
pnpm --filter @medical/api test -- module-orchestration
pnpm --filter @medical/api test -- http-server
pnpm --filter @medical/api test -- persistent-governance-http
pnpm --filter @medical/api typecheck
```

Expected: PASS.

Per current Windows guidance, keep these verification commands serial and do not
run `pytest` or `python -m compileall src` alongside them.
