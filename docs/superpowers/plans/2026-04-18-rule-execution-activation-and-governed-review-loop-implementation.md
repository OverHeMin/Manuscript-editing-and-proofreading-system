# Rule Execution Activation And Governed Review Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface real editing/proofreading governed hits into the manuscript workbench high-risk review flow so the next governance stage starts from execution evidence, not only from downstream queues.

**Architecture:** Reuse the current manuscript workbench review-card path and extend its source extraction logic. Keep persistence and routing unchanged in this slice; only make already-recorded execution evidence visible and reviewable.

**Tech Stack:** React, TypeScript, Node test runner with `tsx`, existing manuscript workbench state and review-item submission flow

---

### Task 1: Lock Missing Execution-Hit Sources In Web Tests

**Files:**
- Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Modify: `apps/web/test/manuscript-workbench-summary.spec.tsx`

- [ ] **Step 1: Write a failing test for editing table inspection high-risk cards**

Add a focused assertion that a latest editing job with `tableInspectionFindings` produces a rendered high-risk review card showing:

- related rule id
- semantic table location
- review actions

- [ ] **Step 2: Run the focused web test to verify it fails**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-page.spec.tsx`

Expected: FAIL because editing `tableInspectionFindings` are not yet part of the high-risk extraction path.

- [ ] **Step 3: Write a failing test for proofreading nested quality findings**

Add a focused assertion that nested `proofreadingFindings.qualityFindings` become high-risk review evidence.

- [ ] **Step 4: Run the focused summary test to verify it fails**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-summary.spec.tsx`

Expected: FAIL because nested proofreading quality findings are not yet surfaced through the current extraction path.


### Task 2: Extend Manuscript Workbench High-Risk Extraction

**Files:**
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`

- [ ] **Step 1: Add extraction support for editing `tableInspectionFindings`**

Map each structured table finding into `ManuscriptWorkbenchHighRiskReviewItemViewModel` with:

- stable id
- title
- risk level
- semantic location
- related rule ids
- origin payload metadata

- [ ] **Step 2: Add extraction support for nested proofreading `qualityFindings`**

Allow the workbench to read `proofreadingFindings.qualityFindings` in addition to top-level payload `qualityFindings`.

- [ ] **Step 3: Keep evidence summary aligned**

Update the summary helpers so operator-facing “规则命中 / 人工复核 / 原因摘要” no longer ignore these two sources.

- [ ] **Step 4: Run the focused tests**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-page.spec.tsx ./test/manuscript-workbench-summary.spec.tsx`

Expected: PASS


### Task 3: Run Verification

**Files:**
- Test: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Test: `apps/web/test/manuscript-workbench-summary.spec.tsx`
- Test: `apps/web/test/manuscript-workbench-controller.spec.ts`
- Test: `apps/web/test/manuscript-workbench-routing.spec.ts`

- [ ] **Step 1: Run the manuscript workbench regression subset**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-page.spec.tsx ./test/manuscript-workbench-summary.spec.tsx ./test/manuscript-workbench-controller.spec.ts ./test/manuscript-workbench-routing.spec.ts`

Expected: PASS with 0 failures.

- [ ] **Step 2: Run web typecheck**

Run: `pnpm --filter @medsys/web typecheck`

Expected: exit 0

- [ ] **Step 3: Review the diff for boundary drift**

Confirm this slice:

- does not auto-create review-item persistence yet
- does not alter downstream rule-center routing rules
- does make real execution evidence operator-visible

- [ ] **Step 4: Commit if the worktree is safely isolatable**

If unrelated dirty changes make a safe isolated commit risky, skip the commit and report that explicitly.
