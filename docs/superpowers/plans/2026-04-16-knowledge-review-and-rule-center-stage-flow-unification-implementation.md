# Knowledge Review And Rule Center Stage Flow Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the knowledge review page, rule center recovery workspace, manuscript summary handoff, and rule wizard wording to one shared `候选 -> 审核 -> 转规则 -> 发布` stage flow.

**Architecture:** Keep the current routing and data model intact, and localize the change to operator-facing copy, stage labels, and status presentation. Lock the new language with focused web tests first, then apply the smallest possible string and presentational updates across the three stations plus the rule wizard subflow.

**Tech Stack:** React, TypeScript, Node test runner with `tsx`, existing workbench/page view models, shared workbench routing helpers

---

### Task 1: Lock the new stage-flow language in focused web tests

**Files:**
- Modify: `apps/web/test/knowledge-review-workbench-page.spec.tsx`
- Modify: `apps/web/test/rule-center-learning-review.spec.ts`
- Modify: `apps/web/test/manuscript-workbench-summary.spec.tsx`
- Create: `apps/web/test/template-governance-rule-wizard.spec.tsx`

- [ ] **Step 1: Write the failing tests for knowledge review stage language**

Add expectations that the rendered knowledge review page uses:

- `回流候选审核`
- `审核通过`
- `驳回候选`
- stage guidance that explains approved candidates move into rule center

- [ ] **Step 2: Run the focused knowledge review test to verify it fails**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-review-workbench-page.spec.tsx`

Expected: FAIL because the current page still uses older approval-desk wording.

- [ ] **Step 3: Write the failing tests for rule center recovery wording**

Add expectations that the recovery workspace uses:

- title posture centered on `回流候选转规则`
- action labels `转成规则草稿`, `继续编辑草稿`, `返回审核记录`
- no legacy top-level phrasing that collapses review and drafting into one action group

- [ ] **Step 4: Run the focused rule center recovery test to verify it fails**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/rule-center-learning-review.spec.ts`

Expected: FAIL because the current recovery panel still says `批准候选` and `转成规则`.

- [ ] **Step 5: Write the failing tests for manuscript summary handoff copy**

Add expectations that the manuscript summary uses the approved stage handoff sentence:

- `当前阶段：候选。下一步：前往知识审核页完成回流候选审核。`

or, for the human-final branch already routing to rule center:

- `当前阶段：审核。下一步：前往规则中心将候选转成规则草稿。`

- [ ] **Step 6: Run the focused manuscript summary test to verify it fails**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-summary.spec.tsx`

Expected: FAIL because the current summary still uses older `前往回流工作区` language.

- [ ] **Step 7: Write the failing test for rule wizard step labels**

Create a focused static-render test that locks:

- eyebrow/title posture around `规则草稿向导`
- five steps:
  - `带入候选`
  - `整理草稿`
  - `确认规则意图`
  - `绑定适用范围`
  - `提交发布`

- [ ] **Step 8: Run the focused rule wizard test to verify it fails**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-wizard.spec.tsx`

Expected: FAIL because the current wizard still uses the earlier five-step naming.


### Task 2: Align manuscript summary and knowledge review to the shared four-stage story

**Files:**
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-workbench-page.tsx`
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-action-panel.tsx`
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-detail-pane.tsx`
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-queue-pane.tsx`

- [ ] **Step 1: Update manuscript summary handoff text**

Change the proofreading human-final recommendation copy so it explicitly states:

- current stage
- next station
- next action

Keep the existing route target unchanged unless a test proves otherwise.

- [ ] **Step 2: Run the manuscript summary test**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-summary.spec.tsx`

Expected: PASS

- [ ] **Step 3: Update knowledge review page title and guidance**

Update the page-level copy so the station clearly reads as:

- title: `回流候选审核`
- guidance: this station decides whether the candidate can enter rule center

Do not turn this page into a drafting station.

- [ ] **Step 4: Update knowledge review queue/detail/action wording**

Change queue, detail, and action-panel strings to reinforce:

- the object is `回流候选`
- the station outcome is `审核通过` or `驳回候选`
- approved items move downstream to rule center

Keep the existing component structure and action wiring intact.

- [ ] **Step 5: Run the knowledge review page test**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-review-workbench-page.spec.tsx`

Expected: PASS


### Task 3: Align rule center recovery workspace to the drafting station role

**Files:**
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Modify: `apps/web/src/features/template-governance/rule-learning-pane.tsx`
- Modify: `apps/web/src/features/template-governance/rule-learning-actions.tsx`
- Modify: `apps/web/src/features/template-governance/rule-learning-diff-card.tsx`

- [ ] **Step 1: Update recovery route header copy**

Change the learning-mode route header so the station reads as the downstream drafting station:

- title posture centered on `回流候选转规则`
- subtitle explaining approved candidates are being organized into `规则草稿`

- [ ] **Step 2: Update recovery queue, detail, and status language**

Change empty states and status messages so they explain:

- this page only receives approved candidates
- the next task is turning them into `规则草稿`

- [ ] **Step 3: Update recovery action labels**

Change the action area to the approved operator dictionary:

- `审核通过` should not remain the main rule-center CTA
- use `转成规则草稿`
- use `继续编辑草稿` for already-approved downstream continuation
- use `返回审核记录` when the operator needs to go back upstream

Preserve existing enable/disable logic and API calls.

- [ ] **Step 4: Run the focused rule center recovery test**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/rule-center-learning-review.spec.ts`

Expected: PASS


### Task 4: Align the rule wizard to the shared stage-flow narrative

**Files:**
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard-state.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard-step-entry.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard-step-semantic.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard-step-confirm.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard-step-binding.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard-step-publish.tsx`

- [ ] **Step 1: Update the five wizard step labels**

Set the canonical labels to:

- `带入候选`
- `整理草稿`
- `确认规则意图`
- `绑定适用范围`
- `提交发布`

- [ ] **Step 2: Update wizard title/guidance copy**

Ensure the page reads as `规则草稿向导`, not a disconnected authoring tool, and that the publish step reads as the final `发布` stage.

- [ ] **Step 3: Add or refine top-level stage guidance inside the wizard**

Use lightweight copy only. Do not redesign the full shell. The goal is to make it clear that:

- steps 1 to 4 are `转规则`
- step 5 is `发布`

- [ ] **Step 4: Run the focused wizard test**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-wizard.spec.tsx`

Expected: PASS


### Task 5: Run the combined verification suite

**Files:**
- Test: `apps/web/test/knowledge-review-workbench-page.spec.tsx`
- Test: `apps/web/test/rule-center-learning-review.spec.ts`
- Test: `apps/web/test/manuscript-workbench-summary.spec.tsx`
- Test: `apps/web/test/template-governance-rule-wizard.spec.tsx`
- Test: `apps/web/test/workbench-host.spec.tsx`

- [ ] **Step 1: Run the combined focused web suite**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-review-workbench-page.spec.tsx ./test/rule-center-learning-review.spec.ts ./test/manuscript-workbench-summary.spec.tsx ./test/template-governance-rule-wizard.spec.tsx ./test/workbench-host.spec.tsx`

Expected: PASS with 0 failures.

- [ ] **Step 2: Run web typecheck**

Run: `pnpm --filter @medsys/web typecheck`

Expected: exit 0

- [ ] **Step 3: Review diff for vocabulary drift**

Confirm that:

- the main object remains `回流候选` until it becomes `规则草稿`
- knowledge review does not present itself as a drafting station
- rule center recovery does not present itself as a first-pass approval desk
- the rule wizard reads like the downstream continuation of the same chain

- [ ] **Step 4: Commit**

If the worktree is clean enough for an isolated commit:

```bash
git add apps/web/src/features/knowledge-review apps/web/src/features/template-governance apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx apps/web/test/knowledge-review-workbench-page.spec.tsx apps/web/test/rule-center-learning-review.spec.ts apps/web/test/manuscript-workbench-summary.spec.tsx apps/web/test/template-governance-rule-wizard.spec.tsx docs/superpowers/plans/2026-04-16-knowledge-review-and-rule-center-stage-flow-unification-implementation.md
git commit -m "feat: unify review and rule-center stage flow language"
```

If the worktree is too dirty for a safe isolated commit, skip the commit and report that explicitly in the handoff.
