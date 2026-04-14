# System Redesign Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one coherent internal-trial redesign across the login entrance, shared shell, manuscript workbenches, knowledge library, knowledge review, rule center, AI access, and management surfaces without breaking the governed core flows.

**Architecture:** Treat the redesign as a staged rollout over the existing workbench shell and route model instead of a rewrite. Reuse the current workbench ids, route discriminators, controllers, and governed persistence, then progressively swap in the approved operator-facing layouts: premium entrance, compact shell, table-first governance, consistent manuscript desk, simplified review surfaces, and centralized AI access. Detailed child plans remain valid where they already exist; this master plan controls phase order, dependencies, and acceptance gates.

**Tech Stack:** React 18, TypeScript, Vite, `node:test`, existing `apps/web` workbench modules, existing `apps/api` governed persistence and HTTP runtime, workspace contracts in `packages/contracts`, Playwright/browser smoke where needed.

---

## Program Rules

The following rules are fixed for the whole rollout:

- keep the global left navigation
- keep the authenticated workbench shell
- keep `screening / editing / proofreading` business-complete during rollout
- keep batch processing in the three manuscript workbenches
- keep Harness outside the main internal operator IA; only handoff and entry links stay inside
- move AI provider choice and temperature to centralized system settings; do not duplicate them inside workbench pages
- treat `规则中心` and `知识库` as sibling ledger-first operator surfaces
- treat `学习回流 / 质量优化` as a child flow, not an orphan major destination
- translate all safe user-facing English copy to Chinese
- do not rename internal ids, route keys, or backend payload fields just to localize labels

## Dependency Map

Implementation order should follow this dependency chain:

1. shared entrance and shell
2. centralized AI access and settings cleanup
3. rule center rollout
4. knowledge library upgrade
5. knowledge review and recycled-candidate consolidation
6. manuscript workbench redesign
7. management overview thinning, translation sweep, and full acceptance

Reasoning:

- shell and route behavior are cross-cutting and should settle first
- AI access must settle before removing duplicate model options elsewhere
- rule center defines the governed routing language used downstream
- knowledge review and recycled-candidate flows depend on rule center and knowledge-library posture
- manuscript desks should land after the shell and governance labels are stable

## Existing Child Plans And Specs To Honor

### Detailed implementation plans already available

- [2026-04-14-rule-center-final-structure-implementation.md](/C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-14-rule-center-final-structure-implementation.md)
- [2026-04-07-system-settings-account-management.md](/C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-07-system-settings-account-management.md)

### Approved design inputs to keep aligned

- [2026-04-13-workbench-shell-and-governance-redesign-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-13-workbench-shell-and-governance-redesign-design.md)
- [2026-04-14-rule-center-final-structure-and-stepwise-entry-wizard-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-14-rule-center-final-structure-and-stepwise-entry-wizard-design.md)
- [2026-04-13-knowledge-library-ledger-entry-and-semantic-editing-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-13-knowledge-library-ledger-entry-and-semantic-editing-design.md)
- [2026-04-13-knowledge-library-multidimensional-ledger-redesign-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-13-knowledge-library-multidimensional-ledger-redesign-design.md)
- [2026-04-10-ai-provider-control-plane-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-10-ai-provider-control-plane-design.md)
- [2026-04-12-manuscript-quality-v2-governance-and-branching-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-12-manuscript-quality-v2-governance-and-branching-design.md)

## File Structure

### Shared shell and entrance

- `apps/web/src/app/App.tsx`
- `apps/web/src/app/app.css`
- `apps/web/src/app/persistent-auth-shell.tsx`
- `apps/web/src/app/workbench-host.tsx`
- `apps/web/src/app/workbench-navigation.ts`
- `apps/web/src/app/workbench-routing.ts`
- `apps/web/src/app/workbench-shell-header.tsx`
- `apps/web/test/persistent-auth-shell.spec.tsx`
- `apps/web/test/workbench-host.spec.tsx`

### Manuscript workbenches

- `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-queue-pane.tsx`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-batch-drawer.tsx`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench.css`
- `apps/web/test/manuscript-workbench-page.spec.tsx`
- `apps/web/test/manuscript-workbench-controls.spec.tsx`
- `apps/web/test/manuscript-workbench-routing.spec.ts`

### Knowledge library

- `apps/web/src/features/knowledge-library/knowledge-library-workbench-page.tsx`
- `apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx`
- `apps/web/src/features/knowledge-library/knowledge-library-ledger-toolbar.tsx`
- `apps/web/src/features/knowledge-library/knowledge-library-entry-form.tsx`
- `apps/web/src/features/knowledge-library/knowledge-library-rich-content-editor.tsx`
- `apps/web/src/features/knowledge-library/knowledge-library-semantic-panel.tsx`
- `apps/web/src/features/knowledge-library/knowledge-library-ledger-page.css`
- `apps/web/test/knowledge-library-workbench-page.spec.tsx`
- `apps/web/test/knowledge-library-ledger-page.spec.tsx`
- `apps/web/test/knowledge-library-semantic-panel.spec.tsx`

### Knowledge review and recycled candidates

- `apps/web/src/features/knowledge-review/knowledge-review-workbench-page.tsx`
- `apps/web/src/features/knowledge-review/knowledge-review-queue-pane.tsx`
- `apps/web/src/features/knowledge-review/knowledge-review-detail-pane.tsx`
- `apps/web/src/features/knowledge-review/knowledge-review-action-panel.tsx`
- `apps/web/src/features/knowledge-review/workbench-controller.ts`
- `apps/web/src/features/knowledge-review/knowledge-review-workbench.css`
- `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- `apps/web/test/knowledge-review-workbench-page.spec.tsx`
- `apps/web/test/rule-center-learning-review.spec.ts`

### Rule center

- Use the full file map already captured in [2026-04-14-rule-center-final-structure-implementation.md](/C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-14-rule-center-final-structure-implementation.md)

### System settings and AI access

- `apps/web/src/features/system-settings/system-settings-workbench-page.tsx`
- `apps/web/src/features/system-settings/system-settings-controller.ts`
- `apps/web/src/features/system-settings/system-settings-api.ts`
- `apps/web/src/features/system-settings/types.ts`
- `apps/web/test/system-settings-workbench-page.spec.tsx`
- `apps/web/test/system-settings-controller.spec.ts`
- `apps/api/src/modules/ai-provider-connections/` if present through current runtime usage
- `apps/api/src/http/api-http-server.ts`
- `apps/api/test/http/system-settings-http.spec.ts`

### Management overview

- `apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx`
- `apps/web/src/features/admin-governance/admin-governance-controller.ts`
- `apps/web/src/features/admin-governance/admin-governance-workbench.css`
- `apps/web/test/admin-governance-workbench-page.spec.tsx`

## Task 1: Settle the entrance page and shared shell as the redesign baseline

**Files:**
- Modify: `apps/web/src/app/App.tsx`
- Modify: `apps/web/src/app/app.css`
- Modify: `apps/web/src/app/persistent-auth-shell.tsx`
- Modify: `apps/web/src/app/workbench-host.tsx`
- Modify: `apps/web/src/app/workbench-navigation.ts`
- Modify: `apps/web/src/app/workbench-routing.ts`
- Modify: `apps/web/src/app/workbench-shell-header.tsx`
- Test: `apps/web/test/persistent-auth-shell.spec.tsx`
- Test: `apps/web/test/workbench-host.spec.tsx`

- [ ] **Step 1: Write the failing shell tests for the final navigation and entrance posture**

Add assertions for:

- premium login shell remains intact
- workbench host keeps the left nav and compact header
- governance group labels follow the approved Chinese IA
- no page-level hero duplication leaks into routed workbench pages

- [ ] **Step 2: Run the focused shell tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/persistent-auth-shell.spec.tsx ./test/workbench-host.spec.tsx
```

Expected: FAIL if navigation labels, header behavior, or home/management grouping still reflect stale IA.

- [ ] **Step 3: Implement the shared shell baseline**

Apply these rules:

- login entrance stays premium and Chinese-first
- `协作与回收区` contains:
  - `知识审核`
  - `规则中心`
  - `质量优化` only until recycled-candidate folding is complete
- `管理区` contains:
  - `AI 接入`
  - `账号与权限`
  - `Harness 控制`
  - `管理总览`
- remove large repeated internal hero blocks from routed workbench pages

- [ ] **Step 4: Run shell tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/persistent-auth-shell.spec.tsx ./test/workbench-host.spec.tsx
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/App.tsx apps/web/src/app/app.css apps/web/src/app/persistent-auth-shell.tsx apps/web/src/app/workbench-host.tsx apps/web/src/app/workbench-navigation.ts apps/web/src/app/workbench-routing.ts apps/web/src/app/workbench-shell-header.tsx apps/web/test/persistent-auth-shell.spec.tsx apps/web/test/workbench-host.spec.tsx
git commit -m "feat: settle redesigned entrance and shared shell baseline"
```

## Task 2: Finish centralized AI access and settings cleanup before touching downstream model choices

**Files:**
- Modify: `apps/web/src/features/system-settings/system-settings-workbench-page.tsx`
- Modify: `apps/web/src/features/system-settings/system-settings-controller.ts`
- Modify: `apps/web/src/features/system-settings/system-settings-api.ts`
- Modify: `apps/web/src/features/system-settings/types.ts`
- Modify: `apps/web/src/features/auth/workbench.ts`
- Test: `apps/web/test/system-settings-workbench-page.spec.tsx`
- Test: `apps/web/test/system-settings-controller.spec.ts`
- Test: `apps/api/test/http/system-settings-http.spec.ts`

- [ ] **Step 1: Verify the existing account-management child plan has landed or is next in queue**

Reference:

- [2026-04-07-system-settings-account-management.md](/C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-07-system-settings-account-management.md)

Do not duplicate that work. Extend it only where needed for the final IA.

- [ ] **Step 2: Add failing tests for the final AI-access posture**

Cover:

- provider connections and models remain in `AI 接入`
- account operations remain in `账号与权限`
- AI-access copy clearly describes:
  - API key entry
  - model binding by module
  - temperature control
- downstream pages do not need duplicate model selectors

- [ ] **Step 3: Implement the final settings IA**

Apply these rules:

- `AI 接入` owns provider connections, model bindings, module defaults, and temperature controls
- `账号与权限` owns users and roles only
- downstream workbench pages should consume resolved settings instead of exposing their own provider/temperature controls

- [ ] **Step 4: Run settings tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/system-settings-workbench-page.spec.tsx ./test/system-settings-controller.spec.ts
pnpm --filter @medical/api exec tsx ./test/run-tests.ts system-settings-http
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/system-settings/system-settings-workbench-page.tsx apps/web/src/features/system-settings/system-settings-controller.ts apps/web/src/features/system-settings/system-settings-api.ts apps/web/src/features/system-settings/types.ts apps/web/src/features/auth/workbench.ts apps/web/test/system-settings-workbench-page.spec.tsx apps/web/test/system-settings-controller.spec.ts apps/api/test/http/system-settings-http.spec.ts
git commit -m "feat: settle ai access and settings split"
```

## Task 3: Roll out the full rule-center redesign using the dedicated child plan

**Files:**
- Follow the exact file list in [2026-04-14-rule-center-final-structure-implementation.md](/C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-14-rule-center-final-structure-implementation.md)

- [ ] **Step 1: Execute child plan tasks 1 through 9 in order**

Required outputs:

- lightweight `规则中心首页`
- unified `规则台账`
- shared five-step wizard
- package bindings for `通用校对包 / 医学专业校对包`
- `回流候选` folded into rule-center flow

- [ ] **Step 2: Keep the child-plan regression gates intact**

Required test families:

- `template-governance-*`
- `rule-center-learning-review.spec.ts`
- focused `knowledge` API tests for binding support

- [ ] **Step 3: Verify the operator-facing outcome**

The result must satisfy:

- rule center feels like a ledger, not a backend console
- add/edit flows use the approved five-step wizard
- advanced options stay hidden by default

- [ ] **Step 4: Re-run the child-plan verification commands**

Run the exact commands already specified in the child plan after its last task.

Expected: PASS.

- [ ] **Step 5: Commit only the child-plan files**

Follow the commit boundaries already defined in the child plan.

## Task 4: Upgrade the knowledge library into the same interaction family as the rule center

**Files:**
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-workbench-page.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-toolbar.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-entry-form.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-rich-content-editor.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-semantic-panel.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-page.css`
- Test: `apps/web/test/knowledge-library-workbench-page.spec.tsx`
- Test: `apps/web/test/knowledge-library-ledger-page.spec.tsx`
- Test: `apps/web/test/knowledge-library-semantic-panel.spec.tsx`

- [ ] **Step 1: Write failing tests for the upgraded knowledge-entry experience**

Cover:

- knowledge library keeps `main page + ledger subpage`
- ledger remains table-first
- add/edit becomes closer to the new rule-entry style:
  - base content + evidence
  - AI semantic generation
  - human confirmation
  - draft/review closeout
- rich content blocks support text, image, and table evidence cleanly

- [ ] **Step 2: Run knowledge-library tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-library-workbench-page.spec.tsx ./test/knowledge-library-ledger-page.spec.tsx ./test/knowledge-library-semantic-panel.spec.tsx
```

Expected: FAIL because the current ledger still uses the older entry posture.

- [ ] **Step 3: Implement the upgraded knowledge-library posture**

Apply these rules:

- keep the two-level flow: main page plus ledger
- keep the table-first ledger
- reuse the rule-center lessons:
  - lighter key-field entry
  - richer evidence blocks
  - explicit AI semantic review
  - short final closeout
- do not copy the rule-center binding step verbatim

Knowledge-library difference:

- it belongs to review submission and retrieval governance
- it does not need a standalone `放入模板 / 规则包` step in the main path

- [ ] **Step 4: Run knowledge-library tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-library-workbench-page.spec.tsx ./test/knowledge-library-ledger-page.spec.tsx ./test/knowledge-library-semantic-panel.spec.tsx
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/knowledge-library/knowledge-library-workbench-page.tsx apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx apps/web/src/features/knowledge-library/knowledge-library-ledger-toolbar.tsx apps/web/src/features/knowledge-library/knowledge-library-entry-form.tsx apps/web/src/features/knowledge-library/knowledge-library-rich-content-editor.tsx apps/web/src/features/knowledge-library/knowledge-library-semantic-panel.tsx apps/web/src/features/knowledge-library/knowledge-library-ledger-page.css apps/web/test/knowledge-library-workbench-page.spec.tsx apps/web/test/knowledge-library-ledger-page.spec.tsx apps/web/test/knowledge-library-semantic-panel.spec.tsx
git commit -m "feat: upgrade knowledge library to the new ledger family"
```

## Task 5: Simplify knowledge review and fold quality feedback into reusable recovery flows

**Files:**
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-workbench-page.tsx`
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-queue-pane.tsx`
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-detail-pane.tsx`
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-action-panel.tsx`
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-workbench.css`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Test: `apps/web/test/knowledge-review-workbench-page.spec.tsx`
- Test: `apps/web/test/rule-center-learning-review.spec.ts`

- [ ] **Step 1: Write failing tests for the short review-first posture**

Cover:

- page stays short
- queue, detail, and action remain the only permanent regions
- full history and evidence expand only when needed
- quality feedback routes into `规则中心 -> 回流候选`, not into a separate heavy page

- [ ] **Step 2: Run review-flow tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-review-workbench-page.spec.tsx ./test/rule-center-learning-review.spec.ts
```

Expected: FAIL if the page remains too tall or the recycled-candidate flow is not aligned.

- [ ] **Step 3: Implement the simplified review and recovery flow**

Apply these rules:

- `知识审核` remains a short review desk
- `质量优化` stops being a freestanding low-frequency concept
- recycled findings route into the rule-center candidate flow

- [ ] **Step 4: Run review-flow tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-review-workbench-page.spec.tsx ./test/rule-center-learning-review.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/knowledge-review/knowledge-review-workbench-page.tsx apps/web/src/features/knowledge-review/knowledge-review-queue-pane.tsx apps/web/src/features/knowledge-review/knowledge-review-detail-pane.tsx apps/web/src/features/knowledge-review/knowledge-review-action-panel.tsx apps/web/src/features/knowledge-review/knowledge-review-workbench.css apps/web/src/features/template-governance/template-governance-workbench-page.tsx apps/web/test/knowledge-review-workbench-page.spec.tsx apps/web/test/rule-center-learning-review.spec.ts
git commit -m "feat: simplify knowledge review and recovery routing"
```

## Task 6: Rebuild the three manuscript workbenches onto the approved shared desk layout

**Files:**
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-queue-pane.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-batch-drawer.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench.css`
- Test: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Test: `apps/web/test/manuscript-workbench-controls.spec.tsx`
- Test: `apps/web/test/manuscript-workbench-routing.spec.ts`

- [ ] **Step 1: Write failing tests for the final workbench layout emphasis**

Cover:

- `初筛 / 编辑 / 校对` share the same shell
- screening emphasizes queue + overview + one-click decision
- editing and proofreading emphasize document focus area
- batch processing remains visible but controlled
- manuscript type is AI-detected after upload
- manuscript type correction remains an override, not an up-front forced field

- [ ] **Step 2: Run manuscript-workbench tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-page.spec.tsx ./test/manuscript-workbench-controls.spec.tsx ./test/manuscript-workbench-routing.spec.ts
```

Expected: FAIL because the current shared layout and emphasis still reflect the older posture.

- [ ] **Step 3: Implement the shared desk layout**

Apply these rules:

- left: queue and search rail
- center top: bounded batch/table zone
- center bottom: main processing canvas
- no always-open oversized right column
- no page-level hero

Business rules:

- keep batch upload limit `10`
- AI auto-detects manuscript type
- system auto-binds the large template family
- journal template remains optional manual override

- [ ] **Step 4: Run manuscript-workbench tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-page.spec.tsx ./test/manuscript-workbench-controls.spec.tsx ./test/manuscript-workbench-routing.spec.ts
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-queue-pane.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-batch-drawer.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench.css apps/web/test/manuscript-workbench-page.spec.tsx apps/web/test/manuscript-workbench-controls.spec.tsx apps/web/test/manuscript-workbench-routing.spec.ts
git commit -m "feat: rebuild manuscript workbenches on the shared desk layout"
```

## Task 7: Thin the management overview and remove duplicate governance content

**Files:**
- Modify: `apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx`
- Modify: `apps/web/src/features/admin-governance/admin-governance-controller.ts`
- Modify: `apps/web/src/features/admin-governance/admin-governance-workbench.css`
- Modify: `apps/web/test/admin-governance-workbench-page.spec.tsx`

- [ ] **Step 1: Write failing tests for the final lightweight management posture**

Cover:

- `管理总览` is only a light gateway page
- `规则中心` stays in collaboration/recovery, not as a heavy duplicated management surface
- `Harness 控制` remains an entry, not an embedded control plane clone
- management overview avoids big heroes and parameter walls

- [ ] **Step 2: Run admin-governance tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/admin-governance-workbench-page.spec.tsx
```

Expected: FAIL if the current page still carries oversized hero behavior or duplicate internal controls.

- [ ] **Step 3: Implement the thin management overview**

Apply these rules:

- keep only compact routing cards and small snapshots
- remove duplicated rule or Harness authoring controls
- use management page as a gateway, not a workspace replacement

- [ ] **Step 4: Run admin-governance tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/admin-governance-workbench-page.spec.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx apps/web/src/features/admin-governance/admin-governance-controller.ts apps/web/src/features/admin-governance/admin-governance-workbench.css apps/web/test/admin-governance-workbench-page.spec.tsx
git commit -m "feat: thin management overview and remove duplicate controls"
```

## Task 8: Run a full Chinese-copy sweep and end-to-end acceptance

**Files:**
- Modify as needed across touched files only
- Verify tests and browser behavior

- [ ] **Step 1: Audit touched workbench pages for lingering unsafe English UI copy**

Check:

- shell header
- login entrance
- rule center
- knowledge library
- knowledge review
- manuscript workbenches
- system settings
- management overview

- [ ] **Step 2: Run the focused web regression suite**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/persistent-auth-shell.spec.tsx ./test/workbench-host.spec.tsx ./test/template-governance-ledger-routing.spec.tsx ./test/template-governance-overview-page.spec.tsx ./test/template-governance-rule-ledger-page.spec.tsx ./test/template-governance-rule-wizard.spec.tsx ./test/template-governance-workbench-page.spec.tsx ./test/knowledge-library-workbench-page.spec.tsx ./test/knowledge-library-ledger-page.spec.tsx ./test/knowledge-library-semantic-panel.spec.tsx ./test/knowledge-review-workbench-page.spec.tsx ./test/rule-center-learning-review.spec.ts ./test/manuscript-workbench-page.spec.tsx ./test/manuscript-workbench-controls.spec.tsx ./test/manuscript-workbench-routing.spec.ts ./test/system-settings-workbench-page.spec.tsx ./test/system-settings-controller.spec.ts ./test/admin-governance-workbench-page.spec.tsx
```

Expected: PASS.

- [ ] **Step 3: Run the focused API regression suite**

Run:

```bash
pnpm --filter @medical/api exec tsx ./test/run-tests.ts knowledge persistent-governance-http system-settings-http
```

Expected: PASS.

- [ ] **Step 4: Perform browser acceptance across the final operator journey**

Manual browser checklist:

- login shell looks premium and Chinese-first
- left navigation groups match the approved IA
- rule center supports the five-step wizard
- knowledge library feels like the same product family as rule center
- knowledge review is short and easy to operate
- manuscript workbenches feel consistent but with different emphasis
- AI access owns provider/model/temperature configuration
- management overview is lightweight

- [ ] **Step 5: Commit only if the acceptance pass required source adjustments**

```bash
git add -A
git commit -m "test: complete system redesign acceptance pass"
```

Skip the commit if verification is green with no file changes.

## Knowledge Library Answer

Yes: the knowledge library should be upgraded into the same interaction family as the new rule center.

The correct relationship is:

- same product family
- same table-first governance posture
- same lighter entry + AI semantic + human confirmation rhythm
- different final closeout because knowledge records do not need the rule-center package-binding step

In short:

`知识库可以升级成这样，但不是完全照抄规则中心的 5 步。`

## Execution Gate

Do not start implementation out of order.

Recommended execution order:

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
7. Task 7
8. Task 8

If time or scope must be reduced, do not cut:

- centralized AI access
- rule center child plan
- manuscript workbench consistency
- end-to-end acceptance

Cut last:

- extra visual polish beyond the approved shell
- optional low-frequency management snapshots
