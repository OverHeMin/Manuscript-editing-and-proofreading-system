# Phase 11F Agent Execution Completion Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one additive derived `completion_summary` to the existing `agent-execution` create/get/list/complete read path so callers can read business-vs-orchestration settlement without re-implementing state-pair logic.

**Architecture:** Keep `AgentExecutionLogRecord` persistence unchanged, derive the new summary entirely inside the `agent-execution` API view layer from existing `status`, `orchestration_status`, and execution expectation fields, and expose the same summary through current demo and persistent HTTP routes.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, existing `agent-execution` module, current demo/persistent HTTP runtimes.

---

## Scope Notes

- Do not change `agent_execution_logs` schema.
- Do not add migrations.
- Do not change orchestration core behavior.
- Do not add new routes.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-06-phase11f-agent-execution-completion-summary-design.md`
  - Create: `docs/superpowers/plans/2026-04-06-phase11f-agent-execution-completion-summary.md`
- Agent execution:
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-record.ts`
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-api.ts`
- Tests:
  - Modify: `apps/api/test/agent-execution/agent-execution-log.spec.ts`
  - Modify: `apps/api/test/http/http-server.spec.ts`
  - Modify: `apps/api/test/http/persistent-governance-http.spec.ts`

## Planned Tasks

### Task 1: Add Completion Summary To Agent Execution View

**Files:**
- Modify: `apps/api/src/modules/agent-execution/agent-execution-record.ts`
- Modify: `apps/api/src/modules/agent-execution/agent-execution-api.ts`
- Modify: `apps/api/test/agent-execution/agent-execution-log.spec.ts`

- [ ] **Step 1: Write the failing agent-execution API tests**

Add coverage that proves:

- business-in-progress logs expose `completion_summary.derived_status = business_in_progress`
- business-completed logs with required follow-up expose pending / retryable derived statuses without pretending they are fully settled
- business-completed logs with `orchestration_status = not_required` or `completed` expose `business_completed_settled`
- terminally failed follow-up surfaces `attention_required = true`

- [ ] **Step 2: Run the targeted agent-execution tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-log
```

Expected: FAIL because `completion_summary` is not yet exposed.

- [ ] **Step 3: Implement the minimal derived view**

Implementation rules:

- do not modify `AgentExecutionLogRecord`
- derive the summary inside the API view assembly only
- keep the derivation deterministic and dependency-free

- [ ] **Step 4: Re-run the targeted agent-execution tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-log
```

Expected: PASS.

### Task 2: Expose The Same Summary Through Existing HTTP Routes

**Files:**
- Modify: `apps/api/test/http/http-server.spec.ts`
- Modify: `apps/api/test/http/persistent-governance-http.spec.ts`

- [ ] **Step 1: Write the failing HTTP assertions**

Add coverage that proves:

- demo `agent-execution` create/complete/list responses include `completion_summary`
- persistent `agent-execution` create/get responses include the same summary after restart

- [ ] **Step 2: Run the targeted HTTP tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- http-server
pnpm --filter @medical/api test -- persistent-governance-http
```

Expected: FAIL because the HTTP responses do not yet expose `completion_summary`.

- [ ] **Step 3: Keep runtime wiring unchanged and rely on the updated API view**

Implementation rules:

- no new runtime dependencies
- no route changes
- no persistence changes

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
pnpm --filter @medical/api test -- agent-execution-log
pnpm --filter @medical/api test -- http-server
pnpm --filter @medical/api test -- persistent-governance-http
pnpm --filter @medical/api typecheck
```

Expected: PASS.
