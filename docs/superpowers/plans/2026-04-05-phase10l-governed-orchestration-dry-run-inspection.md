# Phase 10L Governed Orchestration Dry-Run Inspection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let operators inspect governed orchestration backlog state without mutating it before choosing whether to run recovery.

**Architecture:** Reuse the existing `AgentExecutionOrchestrationService` durable-state rules to add one read-only backlog inspection method plus itemized categories, then extend the existing recovery CLI with an explicit `--dry-run` mode. Keep the slice repo-owned, local-first, and fail-open with no new panel or write surface.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, existing `agent-execution` orchestration service, existing repo-owned recovery CLI.

---

## Scope Notes

- Do not add a new admin panel or API mutation route.
- Do not claim orchestration attempts during dry-run.
- Do not change boot recovery semantics.
- Keep inspection aligned with current recovery rules and categories.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-05-phase10l-governed-orchestration-dry-run-inspection-design.md`
  - Create: `docs/superpowers/plans/2026-04-05-phase10l-governed-orchestration-dry-run-inspection.md`
- Inspection read model:
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-orchestration-service.ts`
  - Modify: `apps/api/src/ops/recover-governed-execution-orchestration.ts`
- Tests:
  - Modify: `apps/api/test/agent-execution/agent-execution-orchestration.spec.ts`
  - Modify: `apps/api/test/ops/recover-governed-execution-orchestration.spec.ts`
- Docs:
  - Modify: `README.md`
  - Modify: `docs/OPERATIONS.md`

## Planned Tasks

### Task 1: Add A Read-Only Orchestration Backlog Inspection Model

**Files:**
- Modify: `apps/api/src/modules/agent-execution/agent-execution-orchestration-service.ts`
- Modify: `apps/api/test/agent-execution/agent-execution-orchestration.spec.ts`

- [x] **Step 1: Write the failing inspection tests**

Add coverage that proves:

```ts
assert.equal(report.summary.recoverable_now_count, 1);
assert.equal(report.summary.deferred_retry_count, 1);
assert.equal(report.items[0]?.category, "recoverable_now");
```

Also cover:

- stale-running logs classify as `stale_running`
- terminal failed orchestration classifies as `attention_required`
- completed/not-required/fresh-running logs classify as `not_recoverable`
- inspection does not mutate attempt count, claim token, or orchestration status

- [x] **Step 2: Run the targeted orchestration tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-orchestration
```

Expected: FAIL because no inspection read model exists yet.

- [x] **Step 3: Implement the minimal inspection read model**

Implementation rules:

- reuse the same retry/stale rules as recovery
- keep categories mutually exclusive
- include compact item context and human-readable reason
- do not write to persistence

- [x] **Step 4: Re-run the targeted orchestration tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-orchestration
```

Expected: PASS.

### Task 2: Add CLI `--dry-run` Inspection Output

**Files:**
- Modify: `apps/api/src/ops/recover-governed-execution-orchestration.ts`
- Modify: `apps/api/test/ops/recover-governed-execution-orchestration.spec.ts`

- [x] **Step 1: Write the failing CLI tests**

Add coverage that proves:

```ts
assert.match(messages[0] ?? "", /dry-run/i);
assert.match(messages[0] ?? "", /recoverable_now=1/i);
```

Also cover:

- `--dry-run --json` prints the inspection payload instead of recovery summary
- default mode still runs replay, not inspection
- existing human summary format for replay remains unchanged

- [x] **Step 2: Run the targeted CLI tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- recover-governed-execution-orchestration
```

Expected: FAIL because `--dry-run` is not supported yet.

- [x] **Step 3: Implement the minimal CLI inspection mode**

Implementation rules:

- keep `--dry-run` explicit
- keep `--json` orthogonal to replay vs inspection mode
- do not change boot recovery behavior

- [x] **Step 4: Re-run the targeted CLI tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- recover-governed-execution-orchestration
```

Expected: PASS.

### Task 3: Document The Inspection Contract And Run Final Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`

- [x] **Step 1: Update docs**

Document:

- the new `--dry-run` inspection mode
- that dry-run is read-only and local-first
- that dry-run helps inspect backlog before replay and does not become a new control plane

- [x] **Step 2: Run the final serial verification set**

Run:

```bash
pnpm --filter @medical/contracts typecheck
pnpm --filter @medical/api test -- agent-execution-orchestration
pnpm --filter @medical/api test -- recover-governed-execution-orchestration
pnpm --filter @medical/api test -- agent-execution
pnpm --filter @medical/api test -- verification-ops
pnpm --filter @medical/api test -- module-orchestration
pnpm --filter @medical/api typecheck
```

Expected: PASS.
