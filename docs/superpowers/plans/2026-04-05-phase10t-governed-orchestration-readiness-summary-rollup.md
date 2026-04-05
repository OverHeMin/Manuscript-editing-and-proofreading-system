# Phase 10T Governed Orchestration Readiness Summary Rollup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a summary-level readiness rollup to governed orchestration dry-run inspection so operators can see immediate replay posture and the next blocked readiness time at a glance.

**Architecture:** Extend the existing inspection report with one additive readiness rollup block derived from current item-level readiness metadata, surface it through the CLI dry-run summary formatter, and keep replay semantics unchanged. This remains a read-only orchestration observability slice.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, governed orchestration service, repo-owned ops CLI, repository docs.

---

## Scope Notes

- Do not add new replay controls.
- Do not change item-level readiness semantics.
- Do not persist new state.
- Keep the new rollup additive and fail-open.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-05-phase10t-governed-orchestration-readiness-summary-rollup-design.md`
  - Create: `docs/superpowers/plans/2026-04-05-phase10t-governed-orchestration-readiness-summary-rollup.md`
- Orchestration service:
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-orchestration-service.ts`
- Ops CLI:
  - Modify: `apps/api/src/ops/recover-governed-execution-orchestration.ts`
- Tests:
  - Modify: `apps/api/test/agent-execution/agent-execution-orchestration.spec.ts`
  - Modify: `apps/api/test/ops/recover-governed-execution-orchestration.spec.ts`
- Docs:
  - Modify: `README.md`
  - Modify: `docs/OPERATIONS.md`
  - Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
  - Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

## Planned Tasks

### Task 1: Add Inspection Readiness Rollup

**Files:**
- Modify: `apps/api/src/modules/agent-execution/agent-execution-orchestration-service.ts`
- Modify: `apps/api/test/agent-execution/agent-execution-orchestration.spec.ts`

- [x] **Step 1: Write the failing inspection tests**

Add coverage that proves:

- inspection reports expose summary-level readiness counts
- the report exposes the earliest `next_ready_at` across waiting actionable items
- the rollup remains available even when item display is narrowed by `limit`

- [x] **Step 2: Run the targeted orchestration tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-orchestration
```

Expected: FAIL because inspection reports do not yet include a readiness rollup.

- [x] **Step 3: Implement the minimal readiness rollup**

Implementation rules:

- derive only from current item-level readiness metadata
- keep categories, focus, and replay preview unchanged
- add only one small read-only summary block

- [x] **Step 4: Re-run the targeted orchestration tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-orchestration
```

Expected: PASS.

### Task 2: Surface The Rollup Through The CLI And Docs

**Files:**
- Modify: `apps/api/src/ops/recover-governed-execution-orchestration.ts`
- Modify: `apps/api/test/ops/recover-governed-execution-orchestration.spec.ts`
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

- [x] **Step 1: Write the failing CLI tests**

Add coverage that proves:

- the dry-run summary appends the readiness rollup
- JSON dry-run output includes the additive readiness summary block

- [x] **Step 2: Run the targeted ops tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- recover-governed-execution-orchestration
```

Expected: FAIL because the CLI summary does not yet print the readiness rollup.

- [x] **Step 3: Implement the minimal CLI and docs updates**

Document:

- the new readiness summary fields
- that they are derived from the same item-level readiness model
- that no new orchestration control authority is added

- [x] **Step 4: Re-run the targeted ops tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- recover-governed-execution-orchestration
```

Expected: PASS.

### Task 3: Run Final Serial Verification

**Files:**
- Modify: `apps/api/src/modules/agent-execution/agent-execution-orchestration-service.ts`
- Modify: `apps/api/src/ops/recover-governed-execution-orchestration.ts`
- Modify: `apps/api/test/agent-execution/agent-execution-orchestration.spec.ts`
- Modify: `apps/api/test/ops/recover-governed-execution-orchestration.spec.ts`
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

- [x] **Step 1: Run the final serial verification set**

Run:

```bash
pnpm --filter @medical/api test -- recover-governed-execution-orchestration
pnpm --filter @medical/api test -- agent-execution-orchestration
pnpm --filter @medical/api test -- agent-execution
pnpm --filter @medical/api test -- verification-ops
pnpm --filter @medical/api test -- module-orchestration
pnpm --filter @medical/api typecheck
```

Expected: PASS.
