# Phase 23 Manuscript Workbench Action-Result Overview Posture Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep `Latest Action Result` posture-aware when workbench action results or workspace load fail open to a raw job that can still be explained by matching reported manuscript overview posture.

**Architecture:** Reuse the existing shared action-result posture helper path instead of adding a new card or request. Extend the shared job-posture detail builder with one narrow overview fallback that only activates when a job lacks `execution_tracking` and the current manuscript overview reports posture for the same job id.

**Tech Stack:** React, TypeScript, existing manuscript workbench page/summary helpers, frontend unit tests.

---

## Scope Notes

- Do not add backend routes or persistence.
- Do not change controller request choreography.
- Do not add new workbench surfaces or controls.
- Keep hydrated-job-first and raw-details-last behavior intact.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-06-phase23-manuscript-workbench-action-result-overview-posture-fallback-design.md`
  - Create: `docs/superpowers/plans/2026-04-06-phase23-manuscript-workbench-action-result-overview-posture-fallback.md`
- Frontend implementation:
  - Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
  - Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Tests:
  - Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Phase tracking:
  - Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
  - Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

## Planned Tasks

### Task 1: Lock Action-Result Overview Fallback With Failing Tests

**Files:**
- Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`

- [ ] **Step 1: Write failing tests**

Add coverage that proves:

- `loadPrefilledWorkbenchWorkspace(...)` reuses matching overview posture in
  `latestActionResult.details` when latest-job hydration fails open to a raw
  overview candidate
- `buildWorkbenchJobActionResultDetails(...)` reuses matching reported overview
  posture when a job-bearing action result receives a raw job without
  `execution_tracking`
- hydrated jobs still prefer `execution_tracking` over overview fallback

- [ ] **Step 2: Run targeted page spec and confirm it fails**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-page.spec.tsx
```

Expected: FAIL because current action-result detail builders append posture only
from hydrated `execution_tracking`.

### Task 2: Implement Minimal Overview-Backed Action-Result Fallback

**Files:**
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`

- [ ] **Step 1: Extend shared job-posture detail helpers**

Add one optional overview fallback path behind the current hydrated-job detail
logic, reusing existing overview recovery/readiness helpers where possible.

- [ ] **Step 2: Adopt the helper in job-bearing action-result builders**

Pass manuscript `module_execution_overview` only where the current page already
has it, so load-time and action-time result builders can reuse the same narrow
fallback without new requests.

- [ ] **Step 3: Re-run the targeted page spec and confirm it passes**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-page.spec.tsx
```

Expected: PASS.

### Task 3: Record Phase 23 Ownership And Run Final Serial Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

- [ ] **Step 1: Record Phase 23 in boundary docs**

Document this as the next bounded continuation of the execution/orchestration
lane after `Phase 22`, focused on `Latest Action Result` posture visibility
under the existing raw-job fail-open path.

- [ ] **Step 2: Run final serial verification**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-page.spec.tsx
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

Expected: only the intended `Phase 23` docs, shared action-result fallback
helper updates, page tests, and boundary-tracking files are changed.
