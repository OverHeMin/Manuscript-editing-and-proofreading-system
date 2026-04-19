# Structural Format Rule Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make compiled `structural_presence` format rules produce real proofreading execution hits with operator-facing expectations instead of being effectively inert during live governed runs.

**Architecture:** Extend the proofreading inspection path so format rules that rely on structural presence can match scoped source blocks and emit failed checks using a shared expectation builder. Keep this slice bounded to proofreading execution and shared explanation text so existing review-item persistence and workbench high-risk cards continue to work without a new queue or UI mode.

**Tech Stack:** TypeScript, Node test runner with `tsx`, existing proofreading inspection and workbench review-item pipeline

---

### Task 1: Lock Structural Presence Proofreading Behavior In Tests

**Files:**
- Modify: `apps/api/test/proofreading/proofreading-rule-checker.spec.ts`
- Modify: `apps/api/test/proofreading/proofreading-rule-report.spec.ts`

- [ ] **Step 1: Write a failing checker test for `structural_presence` statistical expression rules**

Add a focused test showing that a proofreading rule with:

- `trigger.kind = "structural_presence"`
- `action.kind = "normalize_statistical_expression"`
- `scope.sections = ["results"]`

emits a failed check when a matching results paragraph is present.

- [ ] **Step 2: Run the focused checker test and verify it fails**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/proofreading/proofreading-rule-checker.spec.ts`

Expected: FAIL because the current checker ignores `structural_presence`.

- [ ] **Step 3: Write a failing proofreading service test for surfaced execution evidence**

Add a service-level assertion that the resulting proofreading job payload contains the new failed check and that the existing governed review-item bridge can still annotate it with `reviewItemId`.

- [ ] **Step 4: Run the focused proofreading report test and verify it fails**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/proofreading/proofreading-rule-report.spec.ts`

Expected: FAIL because the job payload currently does not contain the structural format hit.


### Task 2: Implement Structural Presence Activation In Proofreading

**Files:**
- Modify: `apps/api/src/modules/editorial-execution/proofreading-rule-checker.ts`
- Modify: `apps/api/src/modules/editorial-execution/types.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`

- [ ] **Step 1: Add a shared operator-facing expectation builder for supported format action kinds**

Support at least:

- `normalize_statistical_expression`
- `normalize_reference_entry`
- existing table inspection and exact-text fallbacks

- [ ] **Step 2: Teach the proofreading checker to match `structural_presence` rules against scoped blocks**

For matching blocks, emit failed checks with:

- rule id
- expected operator-facing requirement text
- actual block text
- block index

- [ ] **Step 3: Keep proofreading payloads and review-item auto-recording aligned**

Ensure the new failed checks flow through existing proofreading job payload shaping and keep `reviewItemId` annotation compatible.

- [ ] **Step 4: Run the focused API tests**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/proofreading/proofreading-rule-checker.spec.ts ./test/proofreading/proofreading-rule-report.spec.ts`

Expected: PASS


### Task 3: Verify The Slice

**Files:**
- Test: `apps/api/test/proofreading/proofreading-rule-checker.spec.ts`
- Test: `apps/api/test/proofreading/proofreading-rule-report.spec.ts`
- Test: `apps/api/test/review-items/review-items-service.spec.ts`

- [ ] **Step 1: Run the bounded proofreading + review-items regression subset**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/proofreading/proofreading-rule-checker.spec.ts ./test/proofreading/proofreading-rule-report.spec.ts ./test/review-items/review-items-service.spec.ts`

Expected: PASS

- [ ] **Step 2: Run API typecheck**

Run: `pnpm --filter @medical/api typecheck`

Expected: exit 0

- [ ] **Step 3: Sanity-check boundary discipline**

Confirm this slice:

- activates real structural format hits during proofreading execution
- reuses the existing review-item persistence and workbench flow
- does not yet add new rule-center dashboards or Harness activation metrics
