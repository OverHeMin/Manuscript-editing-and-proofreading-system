# Phase 15 Manuscript Workbench Restart-Safe Execution Hydration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing manuscript workbench restore the newest read-only tracked mainline job after workspace reload, so restart-safe operator observation no longer depends on in-session state.

**Architecture:** Reuse the manuscript settlement overview already returned by `GET /manuscripts/:id` to derive the newest mainline job candidate, then best-effort hydrate that job through the existing `GET /jobs/:id` read path during workbench load. Keep the behavior additive, fail-open, and page-local. No backend route changes are required.

**Tech Stack:** React, TypeScript, existing manuscript workbench page/controller, frontend unit tests.

---

## Scope Notes

- Do not add backend routes or persistence.
- Do not add a new workbench page or panel.
- Do not make latest-job hydration a blocking dependency for workspace load.
- Keep all new behavior read-only and fail-open.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-06-phase15-manuscript-workbench-restart-safe-execution-hydration-design.md`
  - Create: `docs/superpowers/plans/2026-04-06-phase15-manuscript-workbench-restart-safe-execution-hydration.md`
- Workbench load path:
  - Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Tests:
  - Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Phase tracking:
  - Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
  - Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

## Planned Tasks

### Task 1: Lock Restart-Safe Load Behavior With Failing Tests

**Files:**
- Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`

- [ ] **Step 1: Write failing load-path tests**

Add coverage that proves:

- workspace load restores the newest tracked mainline job from settlement overview
- hydrated load results include the restored job id in operator-facing details
- hydration failures fail open without breaking workspace load
- no candidate latest job keeps the current load behavior

- [ ] **Step 2: Run the targeted page spec and confirm it fails**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-page.spec.tsx
```

Expected: FAIL because current load behavior does not restore latest tracked job state.

### Task 2: Implement Best-Effort Latest-Job Hydration

**Files:**
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`

- [ ] **Step 1: Implement the minimum additive load helper**

Implementation rules:

- derive the newest mainline job candidate from `module_execution_overview`
- reuse the existing `controller.loadJob`
- do not block workspace success on hydration failure
- keep manual load and prefilled auto-load aligned on the same helper

- [ ] **Step 2: Re-run the targeted page spec and confirm it passes**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-page.spec.tsx
```

Expected: PASS.

### Task 3: Record Phase 15 Ownership And Run Final Serial Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

- [ ] **Step 1: Record Phase 15 in the boundary docs**

Document this as the restart-safe workbench hydration continuation of the same execution/orchestration lane after `Phase 14`, focused on durable reload observation rather than new authority.

- [ ] **Step 2: Run final serial verification**

Run:

```bash
pnpm --filter @medsys/web test
cd apps/web
node --import tsx --test ./test/manuscript-workbench-page.spec.tsx
node --import tsx --test ./test/manuscript-workbench-summary.spec.tsx
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

Expected: only the intended `Phase 15` page/load-path and boundary files are changed.
