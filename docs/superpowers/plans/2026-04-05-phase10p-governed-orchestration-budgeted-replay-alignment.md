# Phase 10P Governed Orchestration Budgeted Replay Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make budgeted governed orchestration replay consume recoverable items in the same priority order already visible in dry-run categories.

**Architecture:** Reuse the current dry-run recoverable priority rules inside the service only when `budget` is supplied, keep no-budget recovery unchanged, and update operator docs so stale-running replay priority is clearly documented without changing dry-run semantics.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, existing `agent-execution` orchestration service, repository docs.

---

## Scope Notes

- Do not add new CLI flags.
- Do not change no-budget recovery behavior.
- Do not change retryability, stale-running eligibility, or terminal failure semantics.
- Keep dry-run read-only.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-05-phase10p-governed-orchestration-budgeted-replay-alignment-design.md`
  - Create: `docs/superpowers/plans/2026-04-05-phase10p-governed-orchestration-budgeted-replay-alignment.md`
- Service:
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-orchestration-service.ts`
- Tests:
  - Modify: `apps/api/test/agent-execution/agent-execution-orchestration.spec.ts`
- Docs:
  - Modify: `README.md`
  - Modify: `docs/OPERATIONS.md`
  - Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
  - Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

## Planned Tasks

### Task 1: Align Budgeted Replay With Dry-Run Actionable Ordering

**Files:**
- Modify: `apps/api/src/modules/agent-execution/agent-execution-orchestration-service.ts`
- Modify: `apps/api/test/agent-execution/agent-execution-orchestration.spec.ts`

- [x] **Step 1: Write the failing service tests**

Add coverage that proves:

- dry-run ordering places a stale-running log ahead of a plain pending recoverable log
- `recoverPending({ budget: 1 })` processes that same stale-running log first
- a plain pending log remains untouched when it falls outside the current budget window

- [x] **Step 2: Run the targeted orchestration tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-orchestration
```

Expected: FAIL because budgeted replay still uses repository list order.

- [x] **Step 3: Implement the minimal budgeted replay ordering helper**

Implementation rules:

- reuse the current dry-run classification/priority logic
- apply the helper only when `budget` is present
- leave no-budget replay unchanged

- [x] **Step 4: Re-run the targeted orchestration tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-orchestration
```

Expected: PASS.

### Task 2: Update Docs And Run Final Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

- [x] **Step 1: Update docs**

Document:

- `Phase 10P` as the next orchestration mainline slice
- that budgeted replay now honors the same recoverable priority model visible in dry-run categories
- that no-budget replay remains unchanged

- [x] **Step 2: Run the final serial verification set**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-orchestration
pnpm --filter @medical/api test -- recover-governed-execution-orchestration
pnpm --filter @medical/api test -- agent-execution
pnpm --filter @medical/api test -- verification-ops
pnpm --filter @medical/api test -- module-orchestration
pnpm --filter @medical/api typecheck
```

Expected: PASS.
