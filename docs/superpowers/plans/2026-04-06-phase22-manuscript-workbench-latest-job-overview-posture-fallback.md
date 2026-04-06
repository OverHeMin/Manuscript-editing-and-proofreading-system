# Phase 22 Manuscript Workbench Latest-Job Overview Posture Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the Latest Job card posture-aware when the workbench is showing a fail-open raw latest-job candidate from manuscript overview rather than a hydrated job with execution tracking.

**Architecture:** Keep the change inside `manuscript-workbench-summary.tsx`. Extend the Latest Job card metric renderer with one overview-posture fallback helper that runs only when `latestJob` lacks `execution_tracking`, and preserve hydrated-job-first plus raw-card-last behavior.

**Tech Stack:** React, TypeScript, existing manuscript workbench summary helpers, frontend unit tests.

---

## Scope Notes

- Do not add backend routes or persistence.
- Do not change page/controller hydration behavior.
- Do not add new workbench surfaces or controls.
- Keep hydrated-job-first semantics and fail-open behavior intact.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-06-phase22-manuscript-workbench-latest-job-overview-posture-fallback-design.md`
  - Create: `docs/superpowers/plans/2026-04-06-phase22-manuscript-workbench-latest-job-overview-posture-fallback.md`
- Frontend implementation:
  - Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Tests:
  - Modify: `apps/web/test/manuscript-workbench-summary.spec.tsx`
- Phase tracking:
  - Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
  - Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

## Planned Tasks

### Task 1: Lock Latest Job Overview Fallback Posture With Failing Tests

**Files:**
- Modify: `apps/web/test/manuscript-workbench-summary.spec.tsx`

- [ ] **Step 1: Write failing tests**

Add coverage that proves:

- a raw latest-job fallback candidate still renders posture metrics from a
  matching reported module overview
- hydrated execution tracking remains the preferred source when present
- non-matching or unavailable overview posture keeps the current raw latest-job
  card unchanged

- [ ] **Step 2: Run targeted spec and confirm it fails**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-summary.spec.tsx
```

Expected: FAIL because the current Latest Job card only renders posture from
`execution_tracking`.

### Task 2: Implement Minimal Latest Job Card Fallback Helper

**Files:**
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`

- [ ] **Step 1: Add a Latest Job overview-posture fallback helper**

Reuse existing module overview settlement, recovery, runtime-readiness, and
snapshot formatters where possible.

- [ ] **Step 2: Insert it behind hydrated execution tracking and ahead of raw-card fallback**

Apply it only to the existing Latest Job card metric path.

- [ ] **Step 3: Re-run the targeted spec and confirm it passes**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-summary.spec.tsx
```

Expected: PASS.

### Task 3: Record Phase 22 Ownership And Run Final Serial Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

- [ ] **Step 1: Record Phase 22 in boundary docs**

Document this as the next bounded continuation of the execution/orchestration
lane after `Phase 21`, focused on Latest Job card posture visibility during the
existing fail-open overview-job fallback path.

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

Expected: only the intended `Phase 22` docs, Latest Job fallback helper/tests,
and boundary-tracking files are changed.
