# Table Inspection Expectation Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make editing-side table inspection findings carry operator-facing rule requirements instead of only raw semantic hit coordinates.

**Architecture:** Reuse the shared editorial expectation builder and compose its output into the existing `tableInspectionFindings.reason` field so downstream review-item persistence and workbench rendering improve without adding new payload fields. Lock the behavior in one API test and the existing manuscript workbench tests that already surface table findings.

**Tech Stack:** TypeScript, Node test runner with `tsx`, existing editing execution pipeline and manuscript workbench helpers

---

### Task 1: Lock The New Table Inspection Explanation Contract In Tests

**Files:**
- Modify: `apps/api/test/editing/editing-rule-execution.spec.ts`
- Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Modify: `apps/web/test/manuscript-workbench-summary.spec.tsx`

- [ ] **Step 1: Write a failing editing execution assertion**

Extend the existing table inspection assertion so the returned `reason` includes both:

- the matched semantic location
- the operator-facing rule expectation from the rule action

- [ ] **Step 2: Write a failing workbench high-risk assertion**

Update the high-risk review card fixture to expect the richer table reason text.

- [ ] **Step 3: Write a failing evidence-summary assertion**

Update the evidence-summary test to expect the richer table reason text.

- [ ] **Step 4: Run the focused tests and verify they fail**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editing/editing-rule-execution.spec.ts`

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-page.spec.tsx ./test/manuscript-workbench-summary.spec.tsx`

Expected: FAIL because table inspection findings still only expose the raw semantic match reason.


### Task 2: Compose Shared Expectations Into Editing Table Findings

**Files:**
- Modify: `apps/api/src/modules/document-pipeline/editorial-docx-transform-service.ts`
- Modify: `apps/api/src/modules/editorial-execution/editorial-rule-expectation.ts`

- [ ] **Step 1: Add a small helper for combining table-hit evidence with operator-facing expectations**

Keep the helper bounded:

- preserve the semantic-hit sentence
- append the shared action/message expectation when present
- avoid duplicate text when the expectation is already present

- [ ] **Step 2: Use the helper when building `tableInspectionFindings`**

Do not change payload shape; only improve the `reason` text.

- [ ] **Step 3: Run the focused tests**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editing/editing-rule-execution.spec.ts`

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-page.spec.tsx ./test/manuscript-workbench-summary.spec.tsx`

Expected: PASS


### Task 3: Verify The Slice

**Files:**
- Test: `apps/api/test/editing/editing-rule-execution.spec.ts`
- Test: `apps/api/test/proofreading/proofreading-rule-checker.spec.ts`
- Test: `apps/api/test/proofreading/proofreading-rule-report.spec.ts`
- Test: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Test: `apps/web/test/manuscript-workbench-summary.spec.tsx`

- [ ] **Step 1: Run the bounded API regression subset**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editing/editing-rule-execution.spec.ts ./test/proofreading/proofreading-rule-checker.spec.ts ./test/proofreading/proofreading-rule-report.spec.ts`

Expected: PASS

- [ ] **Step 2: Run the bounded web regression subset**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-page.spec.tsx ./test/manuscript-workbench-summary.spec.tsx`

Expected: PASS

- [ ] **Step 3: Run typechecks**

Run: `pnpm --filter @medical/api typecheck`

Run: `pnpm --filter @medsys/web typecheck`

Expected: exit 0

- [ ] **Step 4: Sanity-check scope**

Confirm this slice:

- improves table-rule explainability in execution evidence
- reuses existing review-item persistence and workbench display paths
- does not add new routing states, schema fields, or rule-center panels
