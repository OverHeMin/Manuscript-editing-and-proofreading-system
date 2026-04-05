# Phase 10M Governed Orchestration Focus Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make dry-run orchestration inspection show the most urgent actionable backlog items first while keeping the full summary counts intact.

**Architecture:** Extend the Phase 10L inspection report with a separate focus block and deterministic category-priority ordering, then wire explicit `--actionable-only` and `--limit <n>` flags through the existing repo-owned CLI. Keep the slice read-only and fail-open.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, existing `agent-execution` orchestration inspection service, existing recovery CLI.

---

## Scope Notes

- Do not add new write controls.
- Do not add targeted replay.
- Do not change boot recovery behavior.
- Keep summary counts global even when items are filtered or limited.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-05-phase10m-governed-orchestration-focus-ordering-design.md`
  - Create: `docs/superpowers/plans/2026-04-05-phase10m-governed-orchestration-focus-ordering.md`
- Inspection focus ordering:
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-orchestration-service.ts`
  - Modify: `apps/api/src/ops/recover-governed-execution-orchestration.ts`
- Tests:
  - Modify: `apps/api/test/agent-execution/agent-execution-orchestration.spec.ts`
  - Modify: `apps/api/test/ops/recover-governed-execution-orchestration.spec.ts`
- Docs:
  - Modify: `README.md`
  - Modify: `docs/OPERATIONS.md`

## Planned Tasks

### Task 1: Add Focus Metadata, Ordering, And Limits To Inspection

**Files:**
- Modify: `apps/api/src/modules/agent-execution/agent-execution-orchestration-service.ts`
- Modify: `apps/api/test/agent-execution/agent-execution-orchestration.spec.ts`

- [x] **Step 1: Write the failing inspection focus tests**

Add coverage that proves:

```ts
assert.deepEqual(report.focus, {
  actionable_count: 4,
  displayed_count: 2,
  omitted_count: 2,
  actionable_only: true,
  limit: 2,
});
```

Also cover:

- category-priority ordering puts `attention_required` before `stale_running`
- `actionableOnly` removes `not_recoverable` rows from the item list
- `limit` only affects displayed items, not global summary counts

- [x] **Step 2: Run the targeted orchestration tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-orchestration
```

Expected: FAIL because focus metadata and bounded ordering do not exist yet.

- [x] **Step 3: Implement the minimal focus ordering**

Implementation rules:

- keep ordering deterministic
- keep full counts in `summary`
- keep focus-specific counts in a separate `focus` block
- do not mutate persistence

- [x] **Step 4: Re-run the targeted orchestration tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-orchestration
```

Expected: PASS.

### Task 2: Add CLI Focus Flags

**Files:**
- Modify: `apps/api/src/ops/recover-governed-execution-orchestration.ts`
- Modify: `apps/api/test/ops/recover-governed-execution-orchestration.spec.ts`

- [x] **Step 1: Write the failing CLI focus tests**

Add coverage that proves:

```ts
assert.deepEqual(receivedOptions, {
  actionableOnly: true,
  limit: 2,
});
```

Also cover:

- human-readable dry-run summary reports `displayed` and `omitted`
- JSON dry-run output includes the new focus metadata
- default recovery mode remains unchanged

- [x] **Step 2: Run the targeted CLI tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- recover-governed-execution-orchestration
```

Expected: FAIL because the CLI does not yet forward focus flags.

- [x] **Step 3: Implement the minimal CLI focus path**

Implementation rules:

- parse `--actionable-only` and `--limit <n>` only for dry-run
- keep the flags explicit and bounded
- do not change replay semantics

- [x] **Step 4: Re-run the targeted CLI tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- recover-governed-execution-orchestration
```

Expected: PASS.

### Task 3: Document The Focus Contract And Run Final Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`

- [x] **Step 1: Update docs**

Document:

- `--actionable-only`
- `--limit <n>`
- that the item list is focused while summary counts stay global

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
