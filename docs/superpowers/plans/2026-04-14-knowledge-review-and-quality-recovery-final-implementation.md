# Knowledge Review And Quality Recovery Final Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finalize the collaboration-and-recovery area so `知识审核` becomes a short, efficient review desk while `质量优化` stops being a heavy orphan page and is folded into `规则中心 -> 回流候选 / learning mode`.

**Architecture:** Reuse the existing knowledge-review queue workflow and the existing rule-center learning pane instead of inventing another governance surface. Keep `knowledge-review` as the dedicated short review desk, then shift recovery and reuse work into rule-center learning mode by removing the standalone heavy learning-review operator page from the normal navigation and preserving only a thin compatibility handoff for legacy deep links.

**Tech Stack:** React 18, TypeScript, Vite feature CSS, existing `apps/web/src/features/knowledge-review`, existing `apps/web/src/features/learning-review`, existing `apps/web/src/features/template-governance`, Node test runner with `tsx`.

---

## Scope And Status

This plan implements the final direction already established in conversation:

- `知识审核` remains a high-frequency review page
- the page should be short, easy to use, and not visually overlong
- `学习复核 / 质量优化` should not remain a lonely major destination
- the reusable recovery flow should live under rule center as a child flow
- AI-linked candidate reuse should improve work quality instead of producing an infrequently used side page

This plan relies on existing earlier groundwork but supersedes older standalone-page assumptions where they conflict:

- [2026-03-28-phase7b-knowledge-review-web-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-03-28-phase7b-knowledge-review-web-design.md)
- [2026-04-12-manuscript-quality-v2-governance-and-branching-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-12-manuscript-quality-v2-governance-and-branching-design.md)
- [2026-04-13-workbench-shell-and-governance-redesign-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-13-workbench-shell-and-governance-redesign-design.md)
- [2026-04-14-rule-center-final-structure-and-stepwise-entry-wizard-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-14-rule-center-final-structure-and-stepwise-entry-wizard-design.md)
- [2026-04-14-system-redesign-master-implementation.md](/C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-14-system-redesign-master-implementation.md)

This plan supersedes one temporary shell assumption:

- `质量优化` should no longer remain a first-class major navigation destination after this child plan lands

## File Structure

### Knowledge-review workbench

- `apps/web/src/features/knowledge-review/index.ts`
- `apps/web/src/features/knowledge-review/knowledge-review-workbench-page.tsx`
- `apps/web/src/features/knowledge-review/knowledge-review-queue-pane.tsx`
- `apps/web/src/features/knowledge-review/knowledge-review-detail-pane.tsx`
- `apps/web/src/features/knowledge-review/knowledge-review-action-panel.tsx`
- `apps/web/src/features/knowledge-review/knowledge-review-workbench.css`
- `apps/web/src/features/knowledge-review/workbench-controller.ts`
- `apps/web/src/features/knowledge-review/workbench-state.ts`

### Legacy learning-review surface and compatibility handoff

- `apps/web/src/features/learning-review/index.ts`
- `apps/web/src/features/learning-review/learning-review-workbench-page.tsx`
- `apps/web/src/features/learning-review/learning-review-workbench.css`
- `apps/web/src/features/learning-review/learning-review-prefill.ts`

### Rule-center recovery surface

- `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- `apps/web/src/features/template-governance/rule-learning-pane.tsx`
- `apps/web/src/features/template-governance/rule-learning-actions.tsx`
- `apps/web/src/features/template-governance/rule-learning-diff-card.tsx`
- `apps/web/src/features/template-governance/template-governance-workbench.css`

### Shared shell and route compatibility

- `apps/web/src/features/auth/workbench.ts`
- `apps/web/src/app/workbench-navigation.ts`
- `apps/web/src/app/workbench-routing.ts`
- `apps/web/src/app/workbench-host.tsx`

### Tests

- `apps/web/test/knowledge-review-workbench-page.spec.tsx`
- `apps/web/test/knowledge-review-controller.spec.ts`
- `apps/web/test/learning-review-workbench-page.spec.tsx`
- `apps/web/test/rule-center-learning-review.spec.ts`
- `apps/web/test/workbench-host.spec.tsx`

## Task 1: Remove `质量优化` from the main navigation while keeping route compatibility

**Files:**
- Modify: `apps/web/src/features/auth/workbench.ts`
- Modify: `apps/web/src/app/workbench-navigation.ts`
- Modify: `apps/web/src/app/workbench-host.tsx`
- Modify: `apps/web/src/app/workbench-routing.ts`
- Modify: `apps/web/test/workbench-host.spec.tsx`

- [ ] **Step 1: Write failing shell tests for the final collaboration/recovery IA**

Cover:

- `协作与回收区` keeps:
  - `知识审核`
  - `规则中心`
- `质量优化` no longer appears as a normal major nav item
- legacy `#learning-review` hashes still resolve to a compatibility path instead of hard-breaking
- rule-center learning mode remains reachable through routed context

- [ ] **Step 2: Run the shell tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/workbench-host.spec.tsx
```

Expected: FAIL because the current shell still treats `learning-review` as a normal major destination.

- [ ] **Step 3: Remove the standalone learning-review target from normal navigation**

Apply these rules:

- normal navigation should not encourage operators into a separate heavy quality page
- keep `learning-review` workbench id only if needed for route compatibility and handoff preservation
- do not break old links from already-generated handoffs

- [ ] **Step 4: Keep compatibility routing explicit**

If `#learning-review` is accessed directly, the shell should still resolve it, but as a compatibility surface that points operators into `规则中心 -> 回流候选 / learning mode`.

- [ ] **Step 5: Re-run the shell tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/workbench-host.spec.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/auth/workbench.ts apps/web/src/app/workbench-navigation.ts apps/web/src/app/workbench-host.tsx apps/web/src/app/workbench-routing.ts apps/web/test/workbench-host.spec.tsx
git commit -m "feat: fold quality optimization out of the main navigation"
```

## Task 2: Simplify `知识审核` into a short review-first desk

**Files:**
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-workbench-page.tsx`
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-queue-pane.tsx`
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-detail-pane.tsx`
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-action-panel.tsx`
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-workbench.css`
- Modify: `apps/web/test/knowledge-review-workbench-page.spec.tsx`
- Modify: `apps/web/test/knowledge-review-controller.spec.ts`

- [ ] **Step 1: Write failing tests for the final short review posture**

Cover:

- the page remains queue + detail + actions
- the page does not render long explanatory sections or oversized utility panels
- queue filters stay compact and near the queue
- detail and action areas remain visible without making the page feel tall and stretched
- approve / reject stays inline and fast

- [ ] **Step 2: Run the knowledge-review tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-review-workbench-page.spec.tsx ./test/knowledge-review-controller.spec.ts
```

Expected: FAIL because the current page still reflects the older heavier desk posture.

- [ ] **Step 3: Compact the knowledge-review page around high-frequency reviewer work**

Apply these rules:

- keep the queue anchored
- keep detail readable
- keep review actions short and close to the decision context
- reduce any visual or structural height that makes the page feel dragged out
- preserve auto-advance and note retention behavior

- [ ] **Step 4: Add bounded scroll ownership where needed**

The final page should prefer independent queue/detail scroll areas over one long stretching page.

- [ ] **Step 5: Re-run the knowledge-review tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-review-workbench-page.spec.tsx ./test/knowledge-review-controller.spec.ts
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/knowledge-review/knowledge-review-workbench-page.tsx apps/web/src/features/knowledge-review/knowledge-review-queue-pane.tsx apps/web/src/features/knowledge-review/knowledge-review-detail-pane.tsx apps/web/src/features/knowledge-review/knowledge-review-action-panel.tsx apps/web/src/features/knowledge-review/knowledge-review-workbench.css apps/web/test/knowledge-review-workbench-page.spec.tsx apps/web/test/knowledge-review-controller.spec.ts
git commit -m "feat: simplify the knowledge review desk"
```

## Task 3: Promote rule-center learning mode into the reusable recovery workspace

**Files:**
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Modify: `apps/web/src/features/template-governance/rule-learning-pane.tsx`
- Modify: `apps/web/src/features/template-governance/rule-learning-actions.tsx`
- Modify: `apps/web/src/features/template-governance/rule-learning-diff-card.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench.css`
- Modify: `apps/web/test/rule-center-learning-review.spec.ts`

- [ ] **Step 1: Write failing tests for the final recovery-in-rule-center posture**

Cover:

- rule center renders a clear recovery child flow or label such as `回流候选`
- approved candidates can still:
  - be approved
  - be rejected
  - convert to rule draft
- the pane shows evidence, diff, proposed family or journal context, and action choices
- the pane reads like a reusable governance recovery surface, not like a temporary side experiment

- [ ] **Step 2: Run the rule-center recovery tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/rule-center-learning-review.spec.ts
```

Expected: FAIL because the current rule-center learning presentation still uses older naming and does not yet fully match the final reusable recovery posture.

- [ ] **Step 3: Rename and restyle the learning pane as a recovery workflow inside rule center**

Apply these rules:

- the operator should understand that this page is where AI-derived or reviewed candidates are reused
- naming should align with `回流候选 / 质量优化` rather than raw technical `learning review`
- candidate evidence and AI-suggested context should be visible
- the pane should remain compact enough to feel like part of rule center, not a second product

- [ ] **Step 4: Keep AI linkage useful but bounded**

The pane should help operators:

- review AI-derived candidate evidence
- see suggested destination context
- turn a candidate into a rule draft efficiently

The pane should not become a general-purpose chat screen or a duplicate knowledge review page.

- [ ] **Step 5: Re-run the rule-center recovery tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/rule-center-learning-review.spec.ts
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/template-governance/template-governance-workbench-page.tsx apps/web/src/features/template-governance/rule-learning-pane.tsx apps/web/src/features/template-governance/rule-learning-actions.tsx apps/web/src/features/template-governance/rule-learning-diff-card.tsx apps/web/src/features/template-governance/template-governance-workbench.css apps/web/test/rule-center-learning-review.spec.ts
git commit -m "feat: turn rule center learning mode into the recovery workspace"
```

## Task 4: Replace the old standalone learning-review page with a thin compatibility handoff

**Files:**
- Modify: `apps/web/src/features/learning-review/learning-review-workbench-page.tsx`
- Modify: `apps/web/src/features/learning-review/learning-review-workbench.css`
- Modify: `apps/web/src/features/learning-review/index.ts`
- Modify: `apps/web/test/learning-review-workbench-page.spec.tsx`

- [ ] **Step 1: Write failing tests for the compatibility handoff page**

Cover:

- the page no longer renders the full old snapshot/candidate/writeback console as the normal experience
- it explains that quality optimization now lives in rule center recovery
- it provides a routed handoff button preserving any manuscript context when available
- it remains short and clear

- [ ] **Step 2: Run the legacy learning-review page tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/learning-review-workbench-page.spec.tsx
```

Expected: FAIL because the current page is still a large standalone workbench.

- [ ] **Step 3: Implement the thin compatibility page**

Apply these rules:

- keep the page available only as a compatibility landing
- point operators to `规则中心 -> 回流候选`
- preserve routed manuscript or snapshot context when present
- remove the heavy standalone operator-console posture

- [ ] **Step 4: Re-run the legacy learning-review page tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/learning-review-workbench-page.spec.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/learning-review/learning-review-workbench-page.tsx apps/web/src/features/learning-review/learning-review-workbench.css apps/web/src/features/learning-review/index.ts apps/web/test/learning-review-workbench-page.spec.tsx
git commit -m "refactor: replace standalone learning review with compatibility handoff"
```

## Task 5: Verify the collaboration-and-recovery baseline before manuscript pages depend on it

**Files:**
- Verify touched files only

- [ ] **Step 1: Run the full collaboration/recovery regression suite**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/workbench-host.spec.tsx ./test/knowledge-review-workbench-page.spec.tsx ./test/knowledge-review-controller.spec.ts ./test/learning-review-workbench-page.spec.tsx ./test/rule-center-learning-review.spec.ts
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 2: Perform browser acceptance for the final collaboration-and-recovery flow**

Manual checklist:

- `知识审核` feels short and easy to use
- `规则中心` clearly contains the reusable recovery flow
- `质量优化` is no longer a heavy standalone destination
- old `learning-review` links still guide users safely into the new place
- the collaboration/recovery area feels smaller and clearer than before

- [ ] **Step 3: Commit only if the verification pass required extra source adjustments**

```bash
git add apps/web/src/features/auth/workbench.ts apps/web/src/app/workbench-navigation.ts apps/web/src/app/workbench-host.tsx apps/web/src/app/workbench-routing.ts apps/web/src/features/knowledge-review/knowledge-review-workbench-page.tsx apps/web/src/features/knowledge-review/knowledge-review-queue-pane.tsx apps/web/src/features/knowledge-review/knowledge-review-detail-pane.tsx apps/web/src/features/knowledge-review/knowledge-review-action-panel.tsx apps/web/src/features/knowledge-review/knowledge-review-workbench.css apps/web/src/features/template-governance/template-governance-workbench-page.tsx apps/web/src/features/template-governance/rule-learning-pane.tsx apps/web/src/features/template-governance/rule-learning-actions.tsx apps/web/src/features/template-governance/rule-learning-diff-card.tsx apps/web/src/features/template-governance/template-governance-workbench.css apps/web/src/features/learning-review/learning-review-workbench-page.tsx apps/web/src/features/learning-review/learning-review-workbench.css apps/web/src/features/learning-review/index.ts apps/web/test/workbench-host.spec.tsx apps/web/test/knowledge-review-workbench-page.spec.tsx apps/web/test/knowledge-review-controller.spec.ts apps/web/test/learning-review-workbench-page.spec.tsx apps/web/test/rule-center-learning-review.spec.ts
git commit -m "test: verify the collaboration and recovery baseline"
```

Skip the commit if verification is green and no extra adjustments were needed.

## Master-Plan Alignment

This child plan fills the `knowledge review and recycled-candidate consolidation` phase in:

- [2026-04-14-system-redesign-master-implementation.md](/C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-14-system-redesign-master-implementation.md)

It should execute after:

- shared shell stabilization
- AI-access/system-settings cleanup
- rule-center structure rollout
- knowledge-library rollout

It should complete before:

- manuscript workbench redesign

Because manuscript pages should eventually hand off reuse candidates into the final recovery location instead of the older standalone learning-review page.

## Execution Gate

Do not start implementation from this document yet.

Current user instruction is:

- continue finishing the total planning set
- do not begin implementation until the remaining plans are finished

When execution is eventually approved, follow the tasks in order:

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
