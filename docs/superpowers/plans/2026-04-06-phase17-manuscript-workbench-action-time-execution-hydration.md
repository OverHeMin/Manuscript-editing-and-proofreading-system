# Phase 17 Manuscript Workbench Action-Time Execution Hydration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing manuscript workbench hydrate returned jobs through the current `GET /jobs/:id` path immediately after successful actions, so execution settlement, recovery, and readiness posture are visible without waiting for a manual refresh or reload.

**Architecture:** Keep the change inside the current workbench adapter layer. Add one controller-local best-effort job hydration helper, reuse it across the existing action flows, and leave the page/summary surface on the same result contract while gaining richer `latestJob` data when the current read path succeeds.

**Tech Stack:** React, TypeScript, existing manuscript workbench controller/page, frontend unit tests.

---

## Scope Notes

- Do not add backend routes or persistence.
- Do not add a new workbench page, panel, or dashboard.
- Do not add replay, retry, routing, or runtime mutation authority.
- Keep all new behavior local-first, read-only, and fail-open.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-06-phase17-manuscript-workbench-action-time-execution-hydration-design.md`
  - Create: `docs/superpowers/plans/2026-04-06-phase17-manuscript-workbench-action-time-execution-hydration.md`
- Frontend implementation:
  - Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts`
  - Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Tests:
  - Modify: `apps/web/test/manuscript-workbench-controller.spec.ts`
  - Modify: `apps/web/test/manuscript-workbench-page.spec.tsx` if page-level contract coverage needs one additive assertion
- Phase tracking:
  - Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
  - Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

## Planned Tasks

### Task 1: Lock Action-Time Hydration With Failing Tests

**Files:**
- Modify: `apps/web/test/manuscript-workbench-controller.spec.ts`
- Modify: `apps/web/test/manuscript-workbench-page.spec.tsx` if needed

- [ ] **Step 1: Write failing controller tests**

Add coverage that proves:

- upload best-effort hydrates the returned `job`
- module runs best-effort hydrate the returned `job`
- proofreading finalize best-effort hydrates the returned `job`
- human-final publish best-effort hydrates the returned `job`
- hydration read failures fall open to the original raw job

- [ ] **Step 2: Run targeted specs and confirm they fail**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-controller.spec.ts
```

Expected: FAIL because the current controller still returns raw action jobs.

### Task 2: Implement Minimal Controller-Owned Hydration

**Files:**
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx` if any page-level typing or result handling needs a minimal alignment update

- [ ] **Step 1: Add a best-effort hydration helper**

Implement one helper that:

- accepts a returned job
- reuses existing `getJob`
- returns hydrated job data when the read succeeds
- returns the original job when the read fails

- [ ] **Step 2: Apply the helper to current action flows**

Update only the existing workbench controller flows:

- `uploadManuscriptAndLoad`
- `runModuleAndLoad`
- `finalizeProofreadingAndLoad`
- `publishHumanFinalAndLoad`

- [ ] **Step 3: Re-run the targeted spec and confirm it passes**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-controller.spec.ts
```

Expected: PASS.

### Task 3: Record Phase 17 Ownership And Run Final Serial Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

- [ ] **Step 1: Record Phase 17 in boundary docs**

Document this as the next bounded continuation of the execution/orchestration
lane after `Phase 16`, focused on action-time adoption of the existing job read
model inside the current manuscript workbench.

- [ ] **Step 2: Run final serial verification**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-controller.spec.ts
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

Expected: only the intended `Phase 17` docs, workbench controller/page tests, and boundary-tracking files are changed.
