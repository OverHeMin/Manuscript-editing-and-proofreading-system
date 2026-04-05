# Phase 10J Durable Execution Orchestration Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate governed manuscript business completion from post-execution verification orchestration by adding durable orchestration state, bounded retry/recovery behavior, idempotent governed-run reuse, and read-only admin observability.

**Architecture:** Keep `AgentExecutionLog` as the durable anchor. Business services still complete jobs, assets, and execution snapshots synchronously, then mark orchestration state additively and trigger best-effort follow-up after commit. A narrow orchestration service replays pending/retryable follow-up using idempotent `verification-ops` governed-run reuse, bounded retry eligibility, and existing Admin Governance evidence gains read-only orchestration state.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, PostgreSQL migrations and repositories, existing `verification-ops`, existing `agent-execution` APIs, and existing Admin Governance React views.

---

## Scope Notes

- Do not introduce a new control plane or queue platform.
- Do not make the manuscript mainline wait for orchestration success.
- Keep all new behavior fail-open relative to business completion.
- Preserve existing routing and verification-ops contracts.
- Prefer additive fields and adapter services over deeper skeleton changes.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-05-phase10j-durable-execution-orchestration-baseline-design.md`
  - Create: `docs/superpowers/plans/2026-04-05-phase10j-durable-execution-orchestration-baseline.md`
- Agent execution orchestration baseline:
  - Modify: `packages/contracts/src/agent-tooling.ts`
  - Modify: `packages/contracts/type-tests/agent-tooling-phase4.test.ts`
  - Modify: `apps/api/src/database/migrations/0009_agent_tooling_persistence.sql` (reference only; no edit expected)
  - Create: `apps/api/src/database/migrations/0021_agent_execution_orchestration_baseline.sql`
  - Create: `apps/api/src/database/migrations/0022_agent_execution_orchestration_retry_eligibility.sql`
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-record.ts`
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-repository.ts`
  - Modify: `apps/api/src/modules/agent-execution/in-memory-agent-execution-repository.ts`
  - Modify: `apps/api/src/modules/agent-execution/postgres-agent-execution-repository.ts`
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-service.ts`
  - Create: `apps/api/src/modules/agent-execution/agent-execution-orchestration-service.ts`
  - Modify: `apps/api/src/modules/agent-execution/index.ts`
  - Modify: `apps/api/src/modules/execution-tracking/execution-tracking-repository.ts`
  - Modify: `apps/api/src/modules/verification-ops/verification-ops-repository.ts`
  - Modify: `apps/api/src/modules/verification-ops/in-memory-verification-ops-repository.ts`
  - Modify: `apps/api/src/modules/verification-ops/postgres-verification-ops-repository.ts`
  - Modify: `apps/api/src/modules/verification-ops/verification-ops-service.ts`
  - Modify: `apps/api/src/modules/shared/module-run-support.ts`
  - Modify: `apps/api/src/modules/screening/screening-service.ts`
  - Modify: `apps/api/src/modules/editing/editing-service.ts`
  - Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
  - Create: `apps/api/src/ops/recover-governed-execution-orchestration.ts`
  - Modify: `apps/api/src/http/persistent-governance-runtime.ts`
  - Modify: `apps/api/src/http/persistent-server-bootstrap.ts`
  - Modify: `apps/api/package.json`
- API tests:
  - Modify: `apps/api/test/agent-execution/agent-execution-log.spec.ts`
  - Modify: `apps/api/test/agent-execution/postgres-agent-execution-persistence.spec.ts`
  - Create: `apps/api/test/agent-execution/agent-execution-orchestration.spec.ts`
  - Modify: `apps/api/test/modules/module-orchestration.spec.ts`
  - Modify: `apps/api/test/http/persistent-server-bootstrap.spec.ts`
- Web read-only observability:
  - Modify: `apps/web/src/features/agent-execution/types.ts`
  - Modify: `apps/web/src/features/admin-governance/admin-governance-controller.ts`
  - Modify: `apps/web/src/features/admin-governance/agent-execution-evidence-view.tsx`
  - Modify: `apps/web/test/admin-governance-controller.spec.ts`
  - Modify: `apps/web/test/agent-execution-evidence-view.spec.tsx`
- Docs:
  - Modify: `README.md`
  - Modify: `docs/OPERATIONS.md`

## Planned Tasks

### Task 1: Add Durable Orchestration State To Agent Execution Logs

**Files:**
- Modify: `packages/contracts/src/agent-tooling.ts`
- Modify: `packages/contracts/type-tests/agent-tooling-phase4.test.ts`
- Create: `apps/api/src/database/migrations/0021_agent_execution_orchestration_baseline.sql`
- Modify: `apps/api/src/modules/agent-execution/agent-execution-record.ts`
- Modify: `apps/api/src/modules/agent-execution/agent-execution-repository.ts`
- Modify: `apps/api/src/modules/agent-execution/in-memory-agent-execution-repository.ts`
- Modify: `apps/api/src/modules/agent-execution/postgres-agent-execution-repository.ts`
- Modify: `apps/api/src/modules/agent-execution/agent-execution-service.ts`
- Modify: `apps/api/test/agent-execution/agent-execution-log.spec.ts`
- Modify: `apps/api/test/agent-execution/postgres-agent-execution-persistence.spec.ts`

- [x] **Step 1: Write the failing contract and repository tests**

Add coverage that proves:

```ts
assert.equal(created.body.status, "running");
assert.equal(created.body.orchestration_status, "pending");
assert.equal(created.body.orchestration_attempt_count, 0);
assert.equal(created.body.orchestration_max_attempts, 3);
```

Also cover:

- logs with no governed suites become `orchestration_status = "not_required"` after business completion
- PostgreSQL round-trips the new orchestration fields
- orchestration error and attempt metadata persist without changing business `status`

- [x] **Step 2: Run the targeted tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/contracts typecheck
pnpm --filter @medical/api test -- agent-execution
```

Expected: FAIL because orchestration fields and persistence do not exist yet.

- [x] **Step 3: Implement the minimal durable state layer**

Implementation rules:

- keep existing business `status` semantics unchanged
- add separate orchestration status and attempt metadata
- default retry bound to a small explicit limit
- keep persistence additive and backward compatible

- [x] **Step 4: Re-run the targeted tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/contracts typecheck
pnpm --filter @medical/api test -- agent-execution
```

Expected: PASS.

### Task 2: Add Idempotent Governed Follow-up Orchestration And Recovery

**Files:**
- Create: `apps/api/src/modules/agent-execution/agent-execution-orchestration-service.ts`
- Modify: `apps/api/src/modules/agent-execution/index.ts`
- Modify: `apps/api/src/modules/execution-tracking/execution-tracking-repository.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-repository.ts`
- Modify: `apps/api/src/modules/verification-ops/in-memory-verification-ops-repository.ts`
- Modify: `apps/api/src/modules/verification-ops/postgres-verification-ops-repository.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-service.ts`
- Modify: `apps/api/src/modules/shared/module-run-support.ts`
- Create: `apps/api/src/ops/recover-governed-execution-orchestration.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Modify: `apps/api/package.json`
- Create: `apps/api/test/agent-execution/agent-execution-orchestration.spec.ts`

- [x] **Step 1: Write the failing orchestration and recovery tests**

Add coverage that proves:

```ts
assert.equal(result.orchestration_status, "completed");
assert.deepEqual(result.verification_evidence_ids, ["evidence-1"]);
assert.equal(summary.processed_count, 1);
```

Also cover:

- the orchestration service reuses an existing governed run for the same source/suite instead of duplicating it
- retryable failures increment attempt count and preserve business completion
- retryable failures can persist a next eligible retry time and are skipped until eligible
- recovery can replay pending, retryable, or stale-running logs from persistence
- max-attempt exhaustion becomes terminal orchestration failure without changing business assets or jobs
- persistent runtime can optionally trigger the same recovery path after startup without blocking listen success
- boot-triggered recovery failures degrade to log-only fail-open status instead of aborting server bootstrap

- [x] **Step 2: Run the targeted tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-orchestration
pnpm --filter @medical/api test -- verification-ops
```

Expected: FAIL because the orchestration service, governed-source reuse, and recovery command do not exist yet.

- [x] **Step 3: Implement the orchestration baseline**

Implementation rules:

- use existing `AgentExecutionLog` and `ModuleExecutionSnapshot` as replay anchors
- make governed-run seeding idempotent for the same source and suite
- keep recovery command repo-owned and local-first
- keep boot-triggered replay behind an explicit env toggle and make it fail-open
- use a small explicit retry cooldown instead of immediate endless replay
- do not add a new workbench or hosted scheduler

- [x] **Step 4: Re-run the targeted tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-orchestration
pnpm --filter @medical/api test -- verification-ops
```

Expected: PASS.

### Task 3: Decouple Business Completion From Orchestration Completion In Module Services

**Files:**
- Modify: `apps/api/src/modules/shared/module-run-support.ts`
- Modify: `apps/api/src/modules/screening/screening-service.ts`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/test/modules/module-orchestration.spec.ts`

- [x] **Step 1: Extend module-orchestration tests with fail-open expectations**

Add coverage that proves:

```ts
assert.equal(response.status, 201);
assert.equal(job.status, "completed");
assert.equal(log.status, "completed");
assert.equal(log.orchestration_status, "retryable");
```

Also cover:

- successful follow-up still records evidence and reaches orchestration completion
- failures in best-effort dispatch do not roll back business asset creation
- proofreading continues to reuse draft-stage business linkage while orchestration stays separate

- [x] **Step 2: Run the targeted module tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- module-orchestration
```

Expected: FAIL because module services still execute governed follow-up inline.

- [x] **Step 3: Implement the minimal decoupling**

Implementation rules:

- complete the business transaction first
- mark orchestration state during the business write path
- run best-effort follow-up only after commit
- swallow orchestration exceptions into recoverable state instead of failing the business response

- [x] **Step 4: Re-run the targeted module tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- module-orchestration
```

Expected: PASS.

### Task 4: Add Read-only Admin Observability For Orchestration State

**Files:**
- Modify: `apps/web/src/features/agent-execution/types.ts`
- Modify: `apps/web/src/features/admin-governance/admin-governance-controller.ts`
- Modify: `apps/web/src/features/admin-governance/agent-execution-evidence-view.tsx`
- Modify: `apps/web/test/admin-governance-controller.spec.ts`
- Modify: `apps/web/test/agent-execution-evidence-view.spec.tsx`

- [x] **Step 1: Write the failing web tests**

Add coverage that proves:

```tsx
assert.match(screen.getByText(/Orchestration Status/i).textContent ?? "", /retryable/i);
assert.match(screen.getByText(/Attempts/i).textContent ?? "", /1 \/ 3/i);
```

Also cover:

- execution evidence loads the new orchestration fields from the log
- the evidence panel surfaces last orchestration error read-only
- no new write controls are introduced

- [x] **Step 2: Run the targeted web tests and confirm they fail**

Run:

```bash
pnpm --filter @medsys/web test -- admin-governance-controller
pnpm --filter @medsys/web test -- agent-execution-evidence-view
```

Expected: FAIL because the new read-only orchestration fields are not exposed yet.

- [x] **Step 3: Implement the read-only observability slice**

Implementation rules:

- extend existing log view models additively
- keep the evidence view read-only
- do not add any orchestration write action or new panel

- [x] **Step 4: Re-run the targeted web tests and confirm they pass**

Run:

```bash
pnpm --filter @medsys/web test -- admin-governance-controller
pnpm --filter @medsys/web test -- agent-execution-evidence-view
```

Expected: PASS.

### Task 5: Document The Recovery Contract And Run Final Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`

- [x] **Step 1: Update docs**

Document:

- that business completion and orchestration completion are now separate
- the new recovery command for governed execution follow-up
- that the new orchestration baseline is local-first, bounded, and fail-open

- [x] **Step 2: Run the final serial verification set**

Run:

```bash
pnpm --filter @medical/contracts typecheck
pnpm --filter @medical/api test -- agent-execution
pnpm --filter @medical/api test -- agent-execution-orchestration
pnpm --filter @medical/api test -- verification-ops
pnpm --filter @medical/api test -- module-orchestration
pnpm --filter @medical/api typecheck
pnpm --filter @medsys/web test -- admin-governance-controller
pnpm --filter @medsys/web test -- agent-execution-evidence-view
pnpm --filter @medsys/web typecheck
```

Expected: PASS, with no need to run tests and compile/typecheck in parallel.

- [ ] **Step 3: Commit the phase slice**

Run:

```bash
git add docs/superpowers/specs/2026-04-05-phase10j-durable-execution-orchestration-baseline-design.md docs/superpowers/plans/2026-04-05-phase10j-durable-execution-orchestration-baseline.md packages/contracts/src/agent-tooling.ts packages/contracts/type-tests/agent-tooling-phase4.test.ts apps/api/src/database/migrations/0021_agent_execution_orchestration_baseline.sql apps/api/src/modules/agent-execution apps/api/src/modules/verification-ops apps/api/src/modules/shared/module-run-support.ts apps/api/src/modules/screening/screening-service.ts apps/api/src/modules/editing/editing-service.ts apps/api/src/modules/proofreading/proofreading-service.ts apps/api/src/ops/recover-governed-execution-orchestration.ts apps/api/src/http/persistent-governance-runtime.ts apps/api/package.json apps/api/test/agent-execution apps/api/test/modules/module-orchestration.spec.ts apps/web/src/features/agent-execution/types.ts apps/web/src/features/admin-governance/admin-governance-controller.ts apps/web/src/features/admin-governance/agent-execution-evidence-view.tsx apps/web/test/admin-governance-controller.spec.ts apps/web/test/agent-execution-evidence-view.spec.tsx README.md docs/OPERATIONS.md
git commit -m "feat: add durable execution orchestration baseline"
```
