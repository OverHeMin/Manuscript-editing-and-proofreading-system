# Phase 10R Governed Orchestration Budgeted Dry-Run Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow governed orchestration dry-run inspection to preview the exact bounded replay window selected by `--budget <n>` without mutating durable orchestration state.

**Architecture:** Extend the existing inspection options with an optional replay-preview budget, reuse the same scoped recoverability and budgeted replay ordering already used by recovery mode, and expose a small additive preview metadata block in CLI and JSON output. Existing no-budget dry-run behavior remains unchanged.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, governed orchestration service, repo-owned ops CLI, repository docs.

---

## Scope Notes

- Do not add new HTTP routes or UI controls.
- Do not change replay-mode mutation semantics.
- Do not change no-budget dry-run behavior.
- Keep the change local-first, additive, and fail-open by default.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-05-phase10r-governed-orchestration-budgeted-dry-run-preview-design.md`
  - Create: `docs/superpowers/plans/2026-04-05-phase10r-governed-orchestration-budgeted-dry-run-preview.md`
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

### Task 1: Add Budgeted Dry-Run Preview To The Orchestration Service

**Files:**
- Modify: `apps/api/src/modules/agent-execution/agent-execution-orchestration-service.ts`
- Modify: `apps/api/test/agent-execution/agent-execution-orchestration.spec.ts`

- [x] **Step 1: Write the failing orchestration service tests**

Add coverage that proves:

- `inspectBacklog({ budget: 1 })` keeps full summary counts but returns only the next bounded replay-preview slice
- the preview metadata reports `budget`, `eligible_count`, `selected_count`, and `remaining_count`
- `limit` trims only the displayed preview slice rather than changing preview counts

- [x] **Step 2: Run the targeted orchestration tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-orchestration
```

Expected: FAIL because inspection does not yet support budget preview metadata or preview-window filtering.

- [x] **Step 3: Implement minimal inspection-side budget preview support**

Implementation rules:

- reuse the same budgeted replay ordering already used by replay mode
- keep summary counts scoped to the full inspected backlog
- expose additive replay-preview metadata
- keep no-budget dry-run behavior unchanged

- [x] **Step 4: Re-run the targeted orchestration tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-orchestration
```

Expected: PASS.

### Task 2: Wire Budget Preview Through The CLI And Docs

**Files:**
- Modify: `apps/api/src/ops/recover-governed-execution-orchestration.ts`
- Modify: `apps/api/test/ops/recover-governed-execution-orchestration.spec.ts`
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

- [x] **Step 1: Write the failing CLI formatting / parsing tests**

Add coverage that proves:

- `--dry-run --budget <n>` forwards the preview budget into inspection mode
- human-readable dry-run summary appends replay-preview details when present
- `--json` includes the additive preview metadata block

- [x] **Step 2: Run the targeted ops tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- recover-governed-execution-orchestration
```

Expected: FAIL because dry-run does not yet accept or report budget preview data.

- [x] **Step 3: Implement the minimal CLI and docs updates**

Document:

- `--dry-run --budget <n>` as a read-only preview of the next bounded replay window
- that replay semantics stay unchanged
- that this does not add a new control plane

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
