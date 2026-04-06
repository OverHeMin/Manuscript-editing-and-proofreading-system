# Phase 19 Manuscript Workbench Refresh-Time Workspace Resynchronization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `Refresh Latest Job` best-effort resynchronize the current manuscript workspace after refreshing the latest job, so overview and next-step guidance stay aligned with refreshed execution posture.

**Architecture:** Keep the change entirely within the existing workbench page layer. Add one exported refresh helper that composes current `loadJob` and `loadWorkspace` calls with fail-open workspace reloading, then reuse it inside the current refresh action without expanding the controller or backend contracts.

**Tech Stack:** React, TypeScript, existing manuscript workbench page/summary helpers, frontend unit tests.

---

## Scope Notes

- Do not add backend routes or persistence.
- Do not add new refresh controls, pages, or panels.
- Do not expand replay, retry, queue, or routing authority.
- Keep workspace resynchronization fail-open after successful job refresh.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-06-phase19-manuscript-workbench-refresh-time-workspace-resynchronization-design.md`
  - Create: `docs/superpowers/plans/2026-04-06-phase19-manuscript-workbench-refresh-time-workspace-resynchronization.md`
- Frontend implementation:
  - Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Tests:
  - Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Phase tracking:
  - Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
  - Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

## Planned Tasks

### Task 1: Lock Refresh-Time Resync With Failing Tests

**Files:**
- Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`

- [ ] **Step 1: Write failing tests**

Add coverage that proves:

- refresh helper returns refreshed job and refreshed workspace when both reads
  succeed
- refresh helper fails open when workspace reload fails after job refresh
- refresh action result keeps job posture details in both cases

- [ ] **Step 2: Run targeted spec and confirm it fails**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-page.spec.tsx
```

Expected: FAIL because current refresh behavior is job-only.

### Task 2: Implement Minimal Refresh Helper And Wiring

**Files:**
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`

- [ ] **Step 1: Add exported refresh helper**

Keep it page-local and reuse the existing posture-aware action-result detail
builder from `Phase 18`.

- [ ] **Step 2: Rewire `Refresh Latest Job` to use the helper**

Update state so:

- `latestJob` always updates on successful job refresh
- `workspace` updates only when workspace reload succeeds

- [ ] **Step 3: Re-run the targeted spec and confirm it passes**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-page.spec.tsx
```

Expected: PASS.

### Task 3: Record Phase 19 Ownership And Run Final Serial Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

- [ ] **Step 1: Record Phase 19 in boundary docs**

Document this as the next bounded continuation of the execution/orchestration
lane after `Phase 18`, focused on refresh-time alignment of current workspace
state with refreshed job posture.

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

Expected: only the intended `Phase 19` docs, workbench page helper/tests, and boundary-tracking files are changed.
