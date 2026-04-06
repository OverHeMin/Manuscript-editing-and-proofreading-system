# Phase 20 Manuscript Workbench Latest-Job Fallback Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current manuscript workbench recommendation logic use hydrated latest-job execution tracking as its fallback before raw status heuristics, so guidance stays posture-aware even when workspace settlement overview is unavailable.

**Architecture:** Keep the change inside `manuscript-workbench-summary.tsx`. Add one helper for latest-job tracking fallback recommendations, place it behind the existing overview-first path, and preserve the current raw heuristic as the final fail-open fallback.

**Tech Stack:** React, TypeScript, existing manuscript workbench summary helpers, frontend unit tests.

---

## Scope Notes

- Do not add backend routes or persistence.
- Do not add controller or page request changes.
- Do not add new workbench surfaces or controls.
- Keep overview-first semantics and fail-open fallback order intact.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-06-phase20-manuscript-workbench-latest-job-fallback-guidance-design.md`
  - Create: `docs/superpowers/plans/2026-04-06-phase20-manuscript-workbench-latest-job-fallback-guidance.md`
- Frontend implementation:
  - Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Tests:
  - Modify: `apps/web/test/manuscript-workbench-summary.spec.tsx`
- Phase tracking:
  - Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
  - Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

## Planned Tasks

### Task 1: Lock Latest-Job Fallback Guidance With Failing Tests

**Files:**
- Modify: `apps/web/test/manuscript-workbench-summary.spec.tsx`

- [ ] **Step 1: Write failing tests**

Add coverage that proves:

- overview failed-open plus retryable latest-job tracking does not advance to
  the next stage
- overview missing plus settled latest-job tracking can still advance with
  posture-aware detail rows
- missing latest-job tracking still fails open to the current heuristic

- [ ] **Step 2: Run targeted spec and confirm it fails**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-summary.spec.tsx
```

Expected: FAIL because the current summary still falls back directly to raw
latest-job status.

### Task 2: Implement Minimal Recommendation Fallback Helper

**Files:**
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`

- [ ] **Step 1: Add a latest-job tracking recommendation helper**

Reuse the existing settlement, recovery, and runtime-readiness formatters where
possible.

- [ ] **Step 2: Insert it between overview-first and raw-status fallback**

Apply it only to screening/editing recommendation flows.

- [ ] **Step 3: Re-run the targeted spec and confirm it passes**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-summary.spec.tsx
```

Expected: PASS.

### Task 3: Record Phase 20 Ownership And Run Final Serial Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

- [ ] **Step 1: Record Phase 20 in boundary docs**

Document this as the next bounded continuation of the execution/orchestration
lane after `Phase 19`, focused on recommendation fallback adoption from
hydrated latest-job posture.

- [ ] **Step 2: Run final serial verification**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-summary.spec.tsx
pnpm --filter @medsys/web test
pnpm --filter @medsys/web typecheck
pnpm --filter @medical/api typecheck
```

Expected: PASS.

- [ ] **Step 3: Review working tree and summarize**

Run:

```bash
git status --short
git diff --stat
```

Expected: only the intended `Phase 20` docs, summary helper/tests, and
boundary-tracking files are changed.
