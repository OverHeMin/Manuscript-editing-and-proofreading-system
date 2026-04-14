# Management Overview Thinning And Final Chinese Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce `管理总览` to a light gateway page, remove remaining duplicated domain content from the management surface, and complete the final safe Chinese-copy sweep across the redesigned operator experience before full browser acceptance.

**Architecture:** Keep the existing `admin-governance` workbench id and the current shared shell, but stop treating management overview like a second governance console. Reuse the current page and controller where possible, render only compact management cards plus small cross-cutting snapshots, and leave rule-center, knowledge, manuscript, and Harness authoring work in their own owned pages. After the management page is thin enough, do one final localization pass across the shell and major workbench surfaces, translating only safe user-facing English copy while preserving internal ids, route keys, query params, API payloads, and stored data enums.

**Tech Stack:** React 18, TypeScript, Vite feature CSS, existing `apps/web` workbench pages, existing admin-governance page/controller, Node test runner with `tsx`, browser acceptance on the final internal-trial flow.

---

## Scope And Status

This plan implements the final phase of:

- [2026-04-14-system-redesign-master-implementation.md](/C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-14-system-redesign-master-implementation.md)

This plan follows the approved direction in:

- [2026-04-13-workbench-shell-and-governance-redesign-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-13-workbench-shell-and-governance-redesign-design.md)
- [2026-03-30-phase8d-admin-governance-console-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-03-30-phase8d-admin-governance-console-design.md)

The final rules for this phase are fixed:

- `管理总览` is a light gateway page, not a full working console
- Harness-specific operations stay in Harness
- rule-center authoring stays in `规则中心`, not inside management overview
- downstream pages should no longer expose duplicated AI provider/model/temperature control walls
- all safe user-facing English copy should be translated to Chinese
- internal ids, route keys, query params, backend fields, stored enum values, and protocol-facing names must not be renamed just for localization

This plan does **not** do the following:

- redesign Harness itself
- redesign rule-center internals
- rewrite backend HTTP contracts purely for localization
- translate unsafe technical identifiers embedded in payloads, hashes, or programmatic contracts

## File Structure

### Management overview surface

- `apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx`
- `apps/web/src/features/admin-governance/admin-governance-workbench.css`
- `apps/web/src/features/admin-governance/admin-governance-controller.ts`

### Shared shell and major operator pages that may need final copy cleanup

- `apps/web/src/app/App.tsx`
- `apps/web/src/app/persistent-auth-shell.tsx`
- `apps/web/src/app/workbench-shell-header.tsx`
- `apps/web/src/features/system-settings/system-settings-workbench-page.tsx`
- `apps/web/src/features/template-governance/template-governance-overview-page.tsx`
- `apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx`
- `apps/web/src/features/template-governance/template-governance-rule-wizard.tsx`
- `apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx`
- `apps/web/src/features/knowledge-library/knowledge-library-entry-form.tsx`
- `apps/web/src/features/knowledge-review/knowledge-review-workbench-page.tsx`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- `apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx`

### Tests

- `apps/web/test/admin-governance-workbench-page.spec.tsx`
- `apps/web/test/admin-governance-controller.spec.ts`
- `apps/web/test/persistent-auth-shell.spec.tsx`
- `apps/web/test/workbench-host.spec.tsx`
- `apps/web/test/system-settings-workbench-page.spec.tsx`
- `apps/web/test/template-governance-overview-page.spec.tsx`
- `apps/web/test/template-governance-rule-ledger-page.spec.tsx`
- `apps/web/test/template-governance-rule-wizard.spec.tsx`
- `apps/web/test/knowledge-library-ledger-page.spec.tsx`
- `apps/web/test/knowledge-review-workbench-page.spec.tsx`
- `apps/web/test/manuscript-workbench-page.spec.tsx`
- `apps/web/test/manuscript-workbench-controls.spec.tsx`
- `apps/web/test/manuscript-workbench-summary.spec.tsx`

## Task 1: Thin management overview into a true gateway page

**Files:**
- Modify: `apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx`
- Modify: `apps/web/src/features/admin-governance/admin-governance-workbench.css`
- Modify: `apps/web/test/admin-governance-workbench-page.spec.tsx`

- [ ] **Step 1: Write failing page tests for the final lightweight management posture**

Cover:

- `管理总览` renders as a compact gateway page
- the page does not use a large hero block or long introductory prose
- the main entry cards are limited to true management destinations:
  - `AI 接入`
  - `账号与权限`
  - `Harness 控制`
- the page no longer promotes `规则中心` as a management card
- snapshot sections stay small and read-only
- no embedded editor-first or parameter-wall experience remains on the page

- [ ] **Step 2: Run the admin-governance page tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/admin-governance-workbench-page.spec.tsx
```

Expected: FAIL because the current page still carries a large hero posture and still repeats at least one domain-owned destination that should no longer be promoted from management overview.

- [ ] **Step 3: Implement the final gateway layout**

Apply these rules:

- keep only compact management routing cards
- keep only small cross-cutting health snapshots
- remove oversized explanatory header treatment
- remove duplicate domain entry surfaces that belong elsewhere
- keep the page useful at a glance, but not deep enough to replace the real owner pages

- [ ] **Step 4: Re-run the admin-governance page tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/admin-governance-workbench-page.spec.tsx
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx apps/web/src/features/admin-governance/admin-governance-workbench.css apps/web/test/admin-governance-workbench-page.spec.tsx
git commit -m "feat: thin management overview into a gateway page"
```

## Task 2: Keep management data bounded to cross-cutting signals instead of domain-owned detail

**Files:**
- Modify: `apps/web/src/features/admin-governance/admin-governance-controller.ts`
- Modify: `apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx`
- Modify: `apps/web/test/admin-governance-controller.spec.ts`
- Modify: `apps/web/test/admin-governance-workbench-page.spec.tsx`

- [ ] **Step 1: Write failing controller tests for the final summary-first management contract**

Cover:

- the page can render from compact counts and short lists without depending on embedded authoring flows
- the first-view contract is sufficient for:
  - AI access health
  - Harness health
  - account or runtime warnings
- rule-center authoring data is not required for the management landing page

- [ ] **Step 2: Run the admin-governance controller tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/admin-governance-controller.spec.ts ./test/admin-governance-workbench-page.spec.tsx
```

Expected: FAIL because the current controller and page still assume a broader governance-console payload than the final summary-first gateway should need.

- [ ] **Step 3: Narrow the management landing model without breaking deeper governance runtimes**

Apply these rules:

- the landing page should consume only what it needs to show compact status
- domain-owned detail may still exist in the controller or runtime, but it must not be required for the first-view management page
- do not introduce a second rule-authoring surface here
- do not move Harness authoring back into this page

- [ ] **Step 4: Re-run the admin-governance controller tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/admin-governance-controller.spec.ts ./test/admin-governance-workbench-page.spec.tsx
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/admin-governance/admin-governance-controller.ts apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx apps/web/test/admin-governance-controller.spec.ts apps/web/test/admin-governance-workbench-page.spec.tsx
git commit -m "refactor: bound management overview to summary-first signals"
```

## Task 3: Complete the final safe Chinese-copy sweep across the shared shell and workbench surfaces

**Files:**
- Modify: `apps/web/src/app/App.tsx`
- Modify: `apps/web/src/app/persistent-auth-shell.tsx`
- Modify: `apps/web/src/app/workbench-shell-header.tsx`
- Modify: `apps/web/src/features/system-settings/system-settings-workbench-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-overview-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-entry-form.tsx`
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx`
- Modify: `apps/web/test/persistent-auth-shell.spec.tsx`
- Modify: `apps/web/test/workbench-host.spec.tsx`
- Modify: `apps/web/test/system-settings-workbench-page.spec.tsx`
- Modify: `apps/web/test/template-governance-overview-page.spec.tsx`
- Modify: `apps/web/test/template-governance-rule-ledger-page.spec.tsx`
- Modify: `apps/web/test/template-governance-rule-wizard.spec.tsx`
- Modify: `apps/web/test/knowledge-library-ledger-page.spec.tsx`
- Modify: `apps/web/test/knowledge-review-workbench-page.spec.tsx`
- Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Modify: `apps/web/test/manuscript-workbench-controls.spec.tsx`
- Modify: `apps/web/test/manuscript-workbench-summary.spec.tsx`
- Modify: `apps/web/test/admin-governance-workbench-page.spec.tsx`

- [ ] **Step 1: Write failing tests for lingering safe English copy**

Audit and add assertions for:

- shell and login labels are Chinese-first
- management overview cards are Chinese-first
- system-settings AI-access copy is Chinese-first
- rule center, knowledge library, knowledge review, and manuscript workbench main labels no longer rely on safe English phrases

Do **not** add assertions that require:

- translated route ids
- translated query params
- translated backend enum values
- translated programmatic data keys

- [ ] **Step 2: Run the focused copy-alignment tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/persistent-auth-shell.spec.tsx ./test/workbench-host.spec.tsx ./test/system-settings-workbench-page.spec.tsx ./test/template-governance-overview-page.spec.tsx ./test/template-governance-rule-ledger-page.spec.tsx ./test/template-governance-rule-wizard.spec.tsx ./test/knowledge-library-ledger-page.spec.tsx ./test/knowledge-review-workbench-page.spec.tsx ./test/manuscript-workbench-page.spec.tsx ./test/manuscript-workbench-controls.spec.tsx ./test/manuscript-workbench-summary.spec.tsx ./test/admin-governance-workbench-page.spec.tsx
```

Expected: FAIL if any safe user-facing English labels, button text, empty states, or helper copy remain in the touched workbench surfaces.

- [ ] **Step 3: Translate safe user-facing English copy only**

Apply these rules:

- translate labels, helper text, section headings, empty states, and button copy that the operator sees directly
- preserve stable identifiers in code and protocols
- do not localize stored or routed technical values unless a separate display label already exists
- keep copy short, plain, and operator-oriented

- [ ] **Step 4: Re-run the focused copy-alignment tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/persistent-auth-shell.spec.tsx ./test/workbench-host.spec.tsx ./test/system-settings-workbench-page.spec.tsx ./test/template-governance-overview-page.spec.tsx ./test/template-governance-rule-ledger-page.spec.tsx ./test/template-governance-rule-wizard.spec.tsx ./test/knowledge-library-ledger-page.spec.tsx ./test/knowledge-review-workbench-page.spec.tsx ./test/manuscript-workbench-page.spec.tsx ./test/manuscript-workbench-controls.spec.tsx ./test/manuscript-workbench-summary.spec.tsx ./test/admin-governance-workbench-page.spec.tsx
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/App.tsx apps/web/src/app/persistent-auth-shell.tsx apps/web/src/app/workbench-shell-header.tsx apps/web/src/features/system-settings/system-settings-workbench-page.tsx apps/web/src/features/template-governance/template-governance-overview-page.tsx apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx apps/web/src/features/template-governance/template-governance-rule-wizard.tsx apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx apps/web/src/features/knowledge-library/knowledge-library-entry-form.tsx apps/web/src/features/knowledge-review/knowledge-review-workbench-page.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx apps/web/test/persistent-auth-shell.spec.tsx apps/web/test/workbench-host.spec.tsx apps/web/test/system-settings-workbench-page.spec.tsx apps/web/test/template-governance-overview-page.spec.tsx apps/web/test/template-governance-rule-ledger-page.spec.tsx apps/web/test/template-governance-rule-wizard.spec.tsx apps/web/test/knowledge-library-ledger-page.spec.tsx apps/web/test/knowledge-review-workbench-page.spec.tsx apps/web/test/manuscript-workbench-page.spec.tsx apps/web/test/manuscript-workbench-controls.spec.tsx apps/web/test/manuscript-workbench-summary.spec.tsx apps/web/test/admin-governance-workbench-page.spec.tsx
git commit -m "feat: complete final chinese copy alignment"
```

## Task 4: Run the final full-system browser acceptance and regression gate

**Files:**
- Verify touched files only

- [ ] **Step 1: Run the focused final web regression suite**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/persistent-auth-shell.spec.tsx ./test/workbench-host.spec.tsx ./test/template-governance-ledger-routing.spec.tsx ./test/template-governance-overview-page.spec.tsx ./test/template-governance-rule-ledger-page.spec.tsx ./test/template-governance-rule-wizard.spec.tsx ./test/template-governance-workbench-page.spec.tsx ./test/knowledge-library-workbench-page.spec.tsx ./test/knowledge-library-ledger-page.spec.tsx ./test/knowledge-review-workbench-page.spec.tsx ./test/rule-center-learning-review.spec.ts ./test/manuscript-workbench-page.spec.tsx ./test/manuscript-workbench-controls.spec.tsx ./test/manuscript-workbench-summary.spec.tsx ./test/manuscript-workbench-routing.spec.ts ./test/system-settings-workbench-page.spec.tsx ./test/admin-governance-workbench-page.spec.tsx
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 2: Run the focused final API regression suite**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/http/system-settings-http.spec.ts ./test/http/persistent-governance-http.spec.ts ./test/manuscripts/manuscript-lifecycle.spec.ts ./test/manuscripts/manuscript-template-selection.spec.ts ./test/execution-resolution/execution-resolution.spec.ts ./test/modules/governed-module-context-resolver.spec.ts ./test/shared/governed-module-context.spec.ts
pnpm --filter @medical/api typecheck
```

Expected: PASS.

- [ ] **Step 3: Perform browser acceptance for the final operator journey**

Manual checklist:

- login entrance looks premium and Chinese-first
- shared shell groups are stable and compact
- rule center feels like the owned place for `规则与模板`
- knowledge library and rule center feel like the same product family
- knowledge review is short and easy to use
- manuscript workbenches feel consistent and simple to learn
- AI settings live in `AI接入`, not duplicated downstream
- management overview feels like a small gateway instead of a second console
- no obvious safe English copy remains on the touched operator surfaces

- [ ] **Step 4: Commit only if the acceptance pass required source adjustments**

```bash
git add apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx apps/web/src/features/admin-governance/admin-governance-workbench.css apps/web/src/features/admin-governance/admin-governance-controller.ts apps/web/src/app/App.tsx apps/web/src/app/persistent-auth-shell.tsx apps/web/src/app/workbench-shell-header.tsx apps/web/src/features/system-settings/system-settings-workbench-page.tsx apps/web/src/features/template-governance/template-governance-overview-page.tsx apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx apps/web/src/features/template-governance/template-governance-rule-wizard.tsx apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx apps/web/src/features/knowledge-library/knowledge-library-entry-form.tsx apps/web/src/features/knowledge-review/knowledge-review-workbench-page.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx apps/web/test/admin-governance-workbench-page.spec.tsx apps/web/test/admin-governance-controller.spec.ts apps/web/test/persistent-auth-shell.spec.tsx apps/web/test/workbench-host.spec.tsx apps/web/test/system-settings-workbench-page.spec.tsx apps/web/test/template-governance-overview-page.spec.tsx apps/web/test/template-governance-rule-ledger-page.spec.tsx apps/web/test/template-governance-rule-wizard.spec.tsx apps/web/test/knowledge-library-ledger-page.spec.tsx apps/web/test/knowledge-review-workbench-page.spec.tsx apps/web/test/manuscript-workbench-page.spec.tsx apps/web/test/manuscript-workbench-controls.spec.tsx apps/web/test/manuscript-workbench-summary.spec.tsx
git commit -m "test: verify final management and chinese acceptance baseline"
```

Skip the commit if verification is green and no extra edits were needed.

## Master-Plan Alignment

This child plan fills the final phase in:

- [2026-04-14-system-redesign-master-implementation.md](/C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-14-system-redesign-master-implementation.md)

It should execute after:

- shared shell stabilization
- AI-access/system-settings cleanup
- rule-center rollout
- knowledge-library rollout
- knowledge-review and recovery consolidation
- manuscript-workbench redesign

Because the final management page and copy sweep need to validate the finished product, not intermediate states.

## Execution Gate

Do not start implementation from this document yet.

Current user instruction is:

- finish the remaining plans first
- do not begin implementation until the planning set is complete

When execution is eventually approved, follow the tasks in order:

1. Task 1
2. Task 2
3. Task 3
4. Task 4
