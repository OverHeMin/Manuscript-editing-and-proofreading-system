# Phase 11G Agent Execution Recovery Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one additive derived `recovery_summary` to the existing `agent-execution` create/get/list/complete read path so callers can read per-log replay readiness and recovery posture without calling a separate backlog inspection route.

**Architecture:** Keep `AgentExecutionLogRecord` persistence unchanged, derive the new summary entirely in the `agent-execution` API view layer from existing orchestration fields plus a small injectable clock/stale-timeout adapter, and expose the same summary through current demo and persistent HTTP routes.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, existing `agent-execution` module, current demo/persistent HTTP runtimes.

---

## Scope Notes

- Do not change `agent_execution_logs` schema.
- Do not add migrations.
- Do not change orchestration write behavior.
- Do not add new routes.
- Keep any clock or stale-timeout dependency optional and local to the read layer.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-06-phase11g-agent-execution-recovery-summary-design.md`
  - Create: `docs/superpowers/plans/2026-04-06-phase11g-agent-execution-recovery-summary.md`
- Agent execution:
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-record.ts`
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-api.ts`
- Tests:
  - Modify: `apps/api/test/agent-execution/agent-execution-log.spec.ts`
  - Modify: `apps/api/test/http/http-server.spec.ts`
  - Modify: `apps/api/test/http/persistent-governance-http.spec.ts`
- Phase tracking:
  - Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
  - Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

## Planned Tasks

### Task 1: Add Recovery Summary Coverage At The Agent-Execution API Layer

**Files:**
- Modify: `apps/api/test/agent-execution/agent-execution-log.spec.ts`

- [ ] **Step 1: Write the failing agent-execution API tests**

Add coverage that proves:

- completed `pending` follow-up logs expose `recoverable_now`
- completed `retryable` logs expose either `recoverable_now` or `deferred_retry`
- completed `running` logs expose either `stale_running` or `waiting_running_timeout`
- completed terminal follow-up failures expose `attention_required`
- non-completed or already-settled logs expose `not_recoverable`

- [ ] **Step 2: Run the targeted agent-execution tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution
```

Expected: FAIL because `recovery_summary` is not yet exposed.

### Task 2: Implement The Minimal Derived Recovery View

**Files:**
- Modify: `apps/api/src/modules/agent-execution/agent-execution-record.ts`
- Modify: `apps/api/src/modules/agent-execution/agent-execution-api.ts`

- [ ] **Step 1: Add record types for the new derived view**

Add the additive `recovery_summary` contract to `AgentExecutionLogViewRecord`
without changing persisted log shape.

- [ ] **Step 2: Implement minimal derivation in the API view layer**

Implementation rules:

- derive entirely from existing log fields plus `now`
- keep the clock optional for deterministic tests
- keep stale-timeout configuration optional and local to the API view
- mirror current inspection semantics without importing the orchestration service as a runtime dependency

- [ ] **Step 3: Re-run the targeted agent-execution tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution
```

Expected: PASS.

### Task 3: Extend Existing HTTP Route Assertions

**Files:**
- Modify: `apps/api/test/http/http-server.spec.ts`
- Modify: `apps/api/test/http/persistent-governance-http.spec.ts`

- [ ] **Step 1: Write the failing HTTP assertions**

Add coverage that proves:

- demo `agent-execution` create/complete/list responses expose `recovery_summary`
- persistent `agent-execution` create/get responses expose the same summary across restart

- [ ] **Step 2: Run the targeted HTTP tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- http-server
pnpm --filter @medical/api test -- persistent-governance-http
```

Expected: FAIL because the HTTP responses do not yet expose `recovery_summary`.

- [ ] **Step 3: Keep runtime wiring unchanged and rely on the updated API view**

Implementation rules:

- no route changes
- no persistence changes
- no control-plane additions

- [ ] **Step 4: Re-run the targeted HTTP tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- http-server
pnpm --filter @medical/api test -- persistent-governance-http
```

Expected: PASS.

### Task 4: Update Phase Tracking And Run Final Serial Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

- [ ] **Step 1: Record Phase 11G in the boundary index and capability mapping**

Document `11G` as a fresh execution/orchestration read-model slice that deepens
per-log recovery visibility without reopening replay or control-plane work.

- [ ] **Step 2: Run the final serial verification set**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution
pnpm --filter @medical/api test -- http-server
pnpm --filter @medical/api test -- persistent-governance-http
pnpm --filter @medical/api typecheck
```

Expected: PASS.
