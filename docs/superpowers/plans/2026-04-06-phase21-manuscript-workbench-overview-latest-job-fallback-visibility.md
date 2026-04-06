# Phase 21 Manuscript Workbench Overview Latest-Job Fallback Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the manuscript workbench overview card readable when manuscript overview observation is missing or degraded by falling back to hydrated latest-job execution tracking for the matching module.

**Architecture:** Keep the change inside `manuscript-workbench-summary.tsx`. Extend the existing overview metric renderer with one compact latest-job fallback formatter, preserve overview-first semantics, and keep the prior fail-open text as the last fallback.

**Tech Stack:** React, TypeScript, existing manuscript workbench summary helpers, frontend unit tests.

---

## Scope Notes

- Do not add backend routes or persistence.
- Do not add controller or page request changes.
- Do not add new workbench surfaces or controls.
- Keep overview-first semantics and fail-open behavior intact.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-06-phase21-manuscript-workbench-overview-latest-job-fallback-visibility-design.md`
  - Create: `docs/superpowers/plans/2026-04-06-phase21-manuscript-workbench-overview-latest-job-fallback-visibility.md`
- Frontend implementation:
  - Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Tests:
  - Modify: `apps/web/test/manuscript-workbench-summary.spec.tsx`
- Phase tracking:
  - Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
  - Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

## Planned Tasks

### Task 1: Lock Overview Fallback Visibility With Failing Tests

**Files:**
- Modify: `apps/web/test/manuscript-workbench-summary.spec.tsx`

- [ ] **Step 1: Write failing tests**

Add coverage that proves:

- a `failed_open` module overview can still render posture-aware overview text
  from hydrated latest-job tracking
- a missing manuscript overview still renders module settlement lines and uses
  latest-job tracking for the matching module
- missing latest-job tracking still keeps the current fail-open overview text

- [ ] **Step 2: Run targeted spec and confirm it fails**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-summary.spec.tsx
```

Expected: FAIL because the current overview card still depends only on
`module_execution_overview`.

### Task 2: Implement Minimal Overview Fallback Helper

**Files:**
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`

- [ ] **Step 1: Add a compact latest-job fallback formatter**

Reuse existing settlement, recovery, runtime-readiness, and snapshot formatters
where possible.

- [ ] **Step 2: Insert it behind reported overview and ahead of current fail-open text**

Apply it only to the existing overview metric rendering path.

- [ ] **Step 3: Re-run the targeted spec and confirm it passes**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-summary.spec.tsx
```

Expected: PASS.

### Task 3: Record Phase 21 Ownership And Run Final Serial Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

- [ ] **Step 1: Record Phase 21 in boundary docs**

Document this as the next bounded continuation of the execution/orchestration
lane after `Phase 20`, focused on overview-card fallback visibility from
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

Expected: only the intended `Phase 21` docs, overview helper/tests, and
boundary-tracking files are changed.
