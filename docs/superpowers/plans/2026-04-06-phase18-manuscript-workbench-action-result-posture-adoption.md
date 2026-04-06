# Phase 18 Manuscript Workbench Action Result Posture Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make job-bearing manuscript workbench actions populate the existing `Latest Action Result` card with durable job posture details, so operators can read settlement, recovery, and runtime-readiness immediately after the action completes.

**Architecture:** Keep the change entirely in the current web workbench layer. Add one shared helper that combines action-specific base rows with the existing hydrated job posture details, reuse it across current job-bearing actions, and leave export/non-job paths unchanged.

**Tech Stack:** React, TypeScript, existing manuscript workbench page/summary helpers, frontend unit tests.

---

## Scope Notes

- Do not add backend routes or persistence.
- Do not add new workbench pages, panels, or dashboards.
- Do not add replay, retry, queue, or routing authority.
- Keep all new behavior fail-open and read-only.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-06-phase18-manuscript-workbench-action-result-posture-adoption-design.md`
  - Create: `docs/superpowers/plans/2026-04-06-phase18-manuscript-workbench-action-result-posture-adoption.md`
- Frontend implementation:
  - Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
  - Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Tests:
  - Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`
  - Modify: `apps/web/test/manuscript-workbench-summary.spec.tsx` if helper exposure or rendering coverage belongs there
- Phase tracking:
  - Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
  - Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

## Planned Tasks

### Task 1: Lock Action-Result Posture Adoption With Failing Tests

**Files:**
- Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Modify: `apps/web/test/manuscript-workbench-summary.spec.tsx` if needed

- [ ] **Step 1: Write failing tests**

Add coverage that proves:

- job-bearing action result details append settlement/recovery/readiness posture
- refresh latest job action results append posture details instead of status only
- missing execution tracking fails open to base rows only
- export result details stay unchanged

- [ ] **Step 2: Run targeted specs and confirm they fail**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-page.spec.tsx
node --import tsx --test ./test/manuscript-workbench-summary.spec.tsx
```

Expected: FAIL because current action-result builders still return base rows only.

### Task 2: Implement Shared Action-Result Detail Building

**Files:**
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`

- [ ] **Step 1: Add a small helper for job-bearing action result details**

Use the existing posture formatters instead of introducing new read-model logic.

- [ ] **Step 2: Rewire current job-bearing actions to use it**

Apply the helper to upload, module run, finalize, publish, and refresh latest
job result construction.

- [ ] **Step 3: Re-run the targeted specs and confirm they pass**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-page.spec.tsx
node --import tsx --test ./test/manuscript-workbench-summary.spec.tsx
```

Expected: PASS.

### Task 3: Record Phase 18 Ownership And Run Final Serial Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

- [ ] **Step 1: Record Phase 18 in boundary docs**

Document this as the next bounded continuation of the execution/orchestration
lane after `Phase 17`, focused on adopting hydrated job posture into the
existing action-result card only.

- [ ] **Step 2: Run final serial verification**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-page.spec.tsx
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

Expected: only the intended `Phase 18` docs, workbench page/summary helpers, and boundary-tracking files are changed.
