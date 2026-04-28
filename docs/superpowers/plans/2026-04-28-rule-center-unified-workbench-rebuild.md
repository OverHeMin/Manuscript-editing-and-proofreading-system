# Rule Center Unified Workbench Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the rule center as one compact unified workbench while preserving existing AI intake, rule wizard, template/package ledgers, learning candidate intake, knowledge binding, review, and runtime boundaries.

**Architecture:** First delivery is frontend-first and compatibility-preserving. Keep the current backend APIs, runtime resolution, knowledge projection, `knowledge_kind = "rule"` compatibility path, and published-rule execution chain unchanged; reorganize the existing `template-governance` UI into a dense work surface with no explanatory copy blocks. Treat this as Phase 1-3 only: unified shell, unified ledger/new-entry posture, AI/manual/candidate intake preservation.

**Tech Stack:** React 18, TypeScript, Vite, Playwright, existing `@medical/contracts`, existing API services under `apps/api/src/modules/editorial-rules`, `apps/api/src/modules/templates`, and `apps/api/src/modules/shared`.

---

## Scope Boundary

This plan intentionally does not change:

- database schema
- editorial rule runtime resolution
- knowledge runtime selection
- model routing
- runtime binding
- permissions
- `knowledge_kind = "rule"` compatibility storage
- AI provider runtime behavior
- existing `templateGovernanceView=classic` compatibility unless every legacy action has an explicit replacement route and regression test

This plan does change:

- rule center page composition
- rule center navigation density
- explanatory copy removal
- Playwright coverage for preserved entry points
- UI tests that currently rely on old explanatory text
- targeted web unit-test expectations that currently assert removed teaching copy

## Preflight: Branch And Working Tree Safety

Before implementation, run:

```bash
git branch --show-current
git status --short --untracked-files=all
```

Required branch: `codex/rule-center-rebuild-plan` or a new `codex/...` branch created from it.

Treat all existing modified or untracked files as user/collaborator work. Do not delete, move, overwrite, or stage unrelated files. The current workspace may contain unrelated screenshots, logs, and OnlyOffice/human-review contract edits.

Before every commit, run:

```bash
git status --short --untracked-files=all -- apps/web/src/features/template-governance apps/web/playwright apps/web/test apps/api/test packages/contracts/type-tests docs/superpowers/plans
git diff --name-only --cached
```

Stage only explicit files changed by this plan. Do not use directory-level `git add apps/web/src/features/template-governance` unless `git status --short` proves there are no unrelated files under that directory.

## Must Preserve

- `/#template-governance?templateGovernanceView=overview`
- `/#template-governance?templateGovernanceView=rule-ledger`
- `/#template-governance?templateGovernanceView=rule-ledger&ruleCenterMode=learning`
- `/#template-governance?templateGovernanceView=rule-ledger&ruleCenterMode=learning&learningCandidateId=:id`
- `/#template-governance?templateGovernanceView=authoring&ruleCenterMode=authoring`
- `/#template-governance?templateGovernanceView=authoring&ruleCenterMode=authoring&learningCandidateId=:id&manuscriptId=:id&reviewedCaseSnapshotId=:id`
- `/#template-governance?templateGovernanceView=classic`
- `/#template-governance?templateGovernanceView=large-template-ledger`
- `/#template-governance?templateGovernanceView=journal-template-ledger`
- `/#template-governance?templateGovernanceView=general-package-ledger`
- `/#template-governance?templateGovernanceView=medical-package-ledger`
- `/#template-governance?templateGovernanceView=extraction-ledger`
- `新建规则`
- `新建 AI 规则草稿`
- `应用到五步流`
- `重新识别 / 解析`
- `转成规则草稿`
- `提交审核`
- `直接发布` remains blocked for `candidateOnly`
- template family binding
- journal template binding
- general package binding
- medical package binding
- linked knowledge item binding
- high-precision evidence gate
- learning candidate conversion remains inside `RuleLearningPane`: only rule-governance items are shown; non-rule residual issues and non-rule learning candidates are excluded; `转成规则草稿` requires an approved source candidate and admin role; conversion creates/applies an `editorial_rule_draft` writeback and preserves candidate provenance, evidence, manuscript, reviewed snapshot, suggested template family, and suggested journal template
- editing an approved rule creates a new draft revision before saving; it must not overwrite the current approved runtime revision
- runtime resolution continues to use only active/published rule sets and currently effective approved knowledge revisions; draft, pending-review, archived, future-effective, and expired revisions are not runtime inputs
- classic/advanced actions remain available or explicitly mapped: advanced rule editor, template family draft creation/selection, journal template activation/archive, module/instruction template management, knowledge binding visibility, and rule package authoring workspace

## Copy Policy

Remove page copy whose only job is explanation or teaching.

Keep only:

- page titles
- tab labels
- table headers
- form labels
- button labels
- compact status text
- validation errors
- blocking reasons
- empty states
- review and publish states
- candidate provenance, evidence, source manuscript, reviewed snapshot, selected bindings, and runtime blocking details

Remove:

- page subtitles that explain what the page is for
- hint cards
- operation instruction panels
- long helper paragraphs
- “why this matters” blocks
- repeated workflow education text
- large introduction sections

---

### Task 1: Add Preservation And No-Explanation Playwright Coverage

**Files:**
- Create: `apps/web/playwright/template-governance-unified-workbench.spec.ts`
- Modify only if existing expectations conflict: `apps/web/playwright/template-governance-rule-wizard.spec.ts`
- Modify only if existing expectations conflict: `apps/web/playwright/template-governance-ledgers.spec.ts`

- [ ] **Step 1: Write the failing route-preservation test**

Create `apps/web/playwright/template-governance-unified-workbench.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

const templateGovernanceViews = [
  {
    hash: "/#template-governance?templateGovernanceView=overview",
    expected: "规则中心",
  },
  {
    hash: "/#template-governance?templateGovernanceView=rule-ledger",
    expected: "规则台账",
  },
  {
    hash: "/#template-governance?templateGovernanceView=rule-ledger&ruleCenterMode=learning",
    expected: "统一复核中心",
  },
  {
    hash: "/#template-governance?templateGovernanceView=authoring&ruleCenterMode=authoring",
    expected: "规则草稿向导",
  },
  {
    hash: "/#template-governance?templateGovernanceView=classic",
    expected: "高级规则编辑器",
  },
  {
    hash: "/#template-governance?templateGovernanceView=large-template-ledger",
    expected: "大模板台账",
  },
  {
    hash: "/#template-governance?templateGovernanceView=journal-template-ledger",
    expected: "期刊模板台账",
  },
  {
    hash: "/#template-governance?templateGovernanceView=general-package-ledger",
    expected: "通用包台账",
  },
  {
    hash: "/#template-governance?templateGovernanceView=medical-package-ledger",
    expected: "医学专用包台账",
  },
  {
    hash: "/#template-governance?templateGovernanceView=extraction-ledger",
    expected: "原稿/编辑稿提取",
  },
] as const;

test.describe("rule center unified workbench", () => {
  for (const view of templateGovernanceViews) {
    test(`keeps route reachable: ${view.hash}`, async ({ page }) => {
      await page.goto(view.hash, { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).toContainText(view.expected);
    });
  }
});
```

- [ ] **Step 2: Run the route-preservation test**

Run:

```bash
pnpm --filter @medsys/web exec playwright test -c playwright.config.ts playwright/template-governance-unified-workbench.spec.ts
```

Expected: PASS before UI changes. If it fails because seeded demo data is unavailable, inspect the failing route and preserve the same assertion intent using the route's existing stable heading or button.

- [ ] **Step 3: Add no-explanation assertions**

Append this test to `apps/web/playwright/template-governance-unified-workbench.spec.ts`:

```ts
test("rule ledger removes explanatory instruction copy", async ({ page }) => {
  await page.goto("/#template-governance?templateGovernanceView=rule-ledger", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("button", { name: "新建规则" })).toBeVisible();
  await expect(page.getByRole("button", { name: "新建 AI 规则草稿" })).toBeVisible();

  const removedCopy = [
    "规则中心操作说明",
    "先分清规则本体",
    "三者配合完成治理",
  ];

  for (const text of removedCopy) {
    await expect(page.locator("body")).not.toContainText(text);
  }

  await page.getByRole("button", { name: "新建 AI 规则草稿" }).click();
  const aiPanel = page.locator(".template-governance-ledger-section", {
    hasText: "规则 AI 草稿生成",
  });
  await expect(aiPanel).toBeVisible();
  await expect(aiPanel).not.toContainText(
    "输入自然语言规则描述，AI 只生成待审核草稿",
  );
});
```

- [ ] **Step 4: Run the no-explanation test and verify it fails**

Run:

```bash
pnpm --filter @medsys/web exec playwright test -c playwright.config.ts playwright/template-governance-unified-workbench.spec.ts -g "rule ledger removes explanatory instruction copy"
```

Expected: FAIL because the current rule ledger still renders explanatory instruction copy.

- [ ] **Step 5: Commit the test baseline after it is failing for the right reason**

Do not commit if implementation is not being done in this session. If implementing, commit with:

```bash
git add apps/web/playwright/template-governance-unified-workbench.spec.ts
git commit -m "test: cover rule center unified workbench preservation"
```

---

### Compatibility Gate Before UI Edits

Before Task 2, verify that the implementation keeps or explicitly maps the legacy/classic workbench capabilities. Do not remove `templateGovernanceView=classic` or classic/advanced workbench actions unless each action has an explicit replacement route and regression test.

Preserve or map:

- advanced rule editor
- template family draft creation, selection, and update
- journal template create, activate, archive, and selection
- module template management
- instruction template management
- knowledge binding visibility
- rule package authoring workspace
- rule package compile/upload intake surfaces

If any of these are intentionally moved into the unified ledger, add a route-level or component-level test proving the old entry still reaches the new action.

---

### Task 2: Compact The Rule Ledger And AI Intake Panel

**Files:**
- Modify: `apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx`
- Test: `apps/web/playwright/template-governance-unified-workbench.spec.ts`

- [ ] **Step 1: Remove the rule ledger instruction card**

In `TemplateGovernanceRuleLedgerPage`, delete the whole article whose header title is:

```tsx
<h2>规则中心操作说明</h2>
```

Delete the three hint cards under it:

```tsx
<strong>建立规则</strong>
<strong>修改规则</strong>
<strong>管理规则</strong>
```

Keep all toolbar actions, search, filter, bulk, ledger table, selected-row detail, and AI intake state unchanged.

- [ ] **Step 2: Compact the AI intake panel copy**

In `RuleAiIntakePanel`, replace:

```tsx
<header className="template-governance-ledger-section-header">
  <h2>规则 AI 草稿生成</h2>
  <p>
    输入自然语言规则描述，AI 只生成待审核草稿；应用后仍进入五步流和审核流程。
  </p>
</header>
```

with:

```tsx
<header className="template-governance-ledger-section-header">
  <h2>规则 AI 草稿生成</h2>
</header>
```

- [ ] **Step 3: Keep status and blocking text intact**

Verify these strings remain in `template-governance-rule-ledger-page.tsx`:

```tsx
"生成中..."
"生成 AI 草稿"
"暂未发现相似规则。"
"应用到五步流"
```

These are not explanatory copy; they are operational state or actions.

- [ ] **Step 4: Run the no-explanation test**

Run:

```bash
pnpm --filter @medsys/web exec playwright test -c playwright.config.ts playwright/template-governance-unified-workbench.spec.ts -g "rule ledger removes explanatory instruction copy"
```

Expected: PASS.

- [ ] **Step 5: Run the existing rule wizard smoke**

Run:

```bash
pnpm --filter @medsys/web exec playwright test -c playwright.config.ts playwright/template-governance-rule-wizard.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx apps/web/playwright/template-governance-unified-workbench.spec.ts
git commit -m "refactor: compact rule center ledger copy"
```

---

### Task 3: Compact The Five-Step Rule Wizard Without Removing Functionality

**Files:**
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard-step-entry.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard-step-semantic.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard-step-confirm.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard-step-binding.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard-step-publish.tsx`
- Test: `apps/web/playwright/template-governance-rule-wizard.spec.ts`
- Test: `apps/web/playwright/template-governance-unified-workbench.spec.ts`

- [ ] **Step 1: Preserve the wizard control flow**

Do not modify these functions in `template-governance-rule-wizard.tsx` except to remove rendered copy:

```tsx
handleRegenerateSemanticLayer
handleConfirmSemanticLayer
handleSaveBindingDraft
handleSaveDraftClick
handleNextClick
handleCompleteClick
```

These functions preserve AI parsing, semantic confirmation, binding persistence, review submission, and publish blocking.

- [ ] **Step 2: Remove wizard explanatory header paragraphs**

In `template-governance-rule-wizard.tsx`, keep:

```tsx
<p className="template-governance-eyebrow">规则草稿向导</p>
<h1>{resolveWizardTitle(state.mode, title)}</h1>
```

Remove the following paragraph:

```tsx
<p>先带入候选并整理规则草稿，确认规则意图与适用范围后再提交发布。</p>
```

In the `五步流` section, keep the `<h2>五步流</h2>` and step list. Remove:

```tsx
<p>当前步骤聚焦一个治理决定，低频高级项后续放入抽屉，不占壳层顶部。</p>
```

- [ ] **Step 3: Remove hint-card blocks from wizard steps**

Delete full `template-governance-rule-hint-list` sections from:

```tsx
apps/web/src/features/template-governance/template-governance-rule-wizard-step-entry.tsx
apps/web/src/features/template-governance/template-governance-rule-wizard-step-confirm.tsx
apps/web/src/features/template-governance/template-governance-rule-wizard-step-binding.tsx
apps/web/src/features/template-governance/template-governance-rule-wizard-step-publish.tsx
```

Keep field labels, inputs, selected chips, status text, evidence gate rows, and blocking messages.

- [ ] **Step 4: Compact each step header**

For each wizard step, keep the `<h2>` and remove the sibling explanatory `<p>` unless the paragraph is an error, status, empty state, or blocking reason.

Allowed examples:

```tsx
<p className="template-governance-error">{errorMessage}</p>
<p className="template-governance-status">AI 草稿必须先提交审核，由人工确认后才能进入正式发布。</p>
<p>未发现阻断项。</p>
```

Removed examples:

```tsx
<p>先看 AI 如何理解这条规则，再决定是否补证据或进入人工确认。</p>
<p>用业务语言决定这条规则进入哪个规则包和模板族。</p>
<p>确认绑定去向和发布方式，再返回规则中心。</p>
```

- [ ] **Step 5: Add wizard no-explanation regression**

Append this test to `apps/web/playwright/template-governance-unified-workbench.spec.ts`:

```ts
test("rule wizard keeps actions but removes teaching copy", async ({ page }) => {
  await page.goto(
    "/#template-governance?templateGovernanceView=authoring&ruleCenterMode=authoring",
    { waitUntil: "domcontentloaded" },
  );

  await expect(page.getByRole("heading", { name: "规则草稿向导" })).toBeVisible();
  await expect(page.getByRole("button", { name: "保存草稿" })).toBeVisible();
  await expect(page.getByRole("button", { name: /下一步/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "完成并返回规则中心" })).toBeVisible();

  await page.getByLabel("规则名称").fill("无解释文案回归规则");
  await page
    .getByLabel("规则正文")
    .fill("摘要标题、正文字段和术语规范需要按规则中心治理结果保持一致。");
  await page.getByLabel("正例示例").fill("摘要 目的");
  await page.getByLabel("来源依据").fill("编辑部规则中心回归用例。");
  await page.getByRole("button", { name: "下一步：整理草稿" }).click();
  await expect(page.getByRole("heading", { name: "AI 语义层结果" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "下一步：确认规则意图" }).click();
  await expect(page.getByRole("heading", { name: "人工确认 AI 结果" })).toBeVisible();
  await page.getByRole("button", { name: "下一步：绑定适用范围" }).click();
  await expect(page.getByRole("heading", { name: "放入模板 / 规则包" })).toBeVisible();
  await page.getByRole("button", { name: "下一步：提交发布" }).click();
  await expect(page.getByRole("heading", { name: "保存与发布" })).toBeVisible();

  const removedCopy = [
    "先带入候选并整理规则草稿",
    "当前步骤聚焦一个治理决定",
    "至少补充正文、一个示例和来源依据",
    "规则包决定这条规则先落到哪个复用容器",
    "直接发布只适合已经确认无误的场景",
  ];

  for (const text of removedCopy) {
    await expect(page.locator("body")).not.toContainText(text);
  }
});
```

- [ ] **Step 6: Run wizard tests**

Run:

```bash
pnpm --filter @medsys/web exec playwright test -c playwright.config.ts playwright/template-governance-rule-wizard.spec.ts playwright/template-governance-unified-workbench.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/template-governance/template-governance-rule-wizard.tsx apps/web/src/features/template-governance/template-governance-rule-wizard-step-entry.tsx apps/web/src/features/template-governance/template-governance-rule-wizard-step-semantic.tsx apps/web/src/features/template-governance/template-governance-rule-wizard-step-confirm.tsx apps/web/src/features/template-governance/template-governance-rule-wizard-step-binding.tsx apps/web/src/features/template-governance/template-governance-rule-wizard-step-publish.tsx apps/web/playwright/template-governance-unified-workbench.spec.ts
git commit -m "refactor: compact rule center wizard copy"
```

---

### Task 4: Compact Overview And Ledger Subpages

**Files:**
- Modify: `apps/web/src/features/template-governance/template-governance-overview-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-template-ledger-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-journal-template-ledger-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-content-module-ledger-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-extraction-ledger-page.tsx`
- Test: `apps/web/playwright/template-governance-ledgers.spec.ts`
- Test: `apps/web/playwright/template-governance-unified-workbench.spec.ts`

- [ ] **Step 1: Keep navigation and actions, remove page teaching**

For each page, preserve:

```tsx
createTemplateGovernanceNavigationItems(...)
TemplateGovernanceLedgerToolbar
primary table
selected item detail
create/edit actions
status and error messages
```

Remove long subtitles and explanatory cards. Keep only short labels required for orientation.

- [ ] **Step 2: Add subpage no-explanation test**

Append to `apps/web/playwright/template-governance-unified-workbench.spec.ts`:

```ts
test("template and package ledgers keep controls without page teaching copy", async ({ page }) => {
  const routes = [
    "/#template-governance?templateGovernanceView=large-template-ledger",
    "/#template-governance?templateGovernanceView=journal-template-ledger",
    "/#template-governance?templateGovernanceView=general-package-ledger",
    "/#template-governance?templateGovernanceView=medical-package-ledger",
    "/#template-governance?templateGovernanceView=extraction-ledger",
  ];

  for (const route of routes) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".template-governance-ledger-toolbar")).toBeVisible();
    await expect(
      page.locator(".template-governance-ledger-toolbar-copy > p:not(.template-governance-eyebrow)"),
    ).toHaveCount(0);
    await expect(page.locator(".template-governance-ledger-section-header > p")).toHaveCount(0);
    await expect(page.locator(".template-governance-rule-hint-list")).toHaveCount(0);
  }
});
```

Keep this selector-based assertion narrow. Do not use broad word bans such as `这里`, `用于`, `帮助`, or `说明`; those can appear in legitimate status, error, or empty-state text.

- [ ] **Step 3: Run ledger tests**

Run:

```bash
pnpm --filter @medsys/web exec playwright test -c playwright.config.ts playwright/template-governance-ledgers.spec.ts playwright/template-governance-unified-workbench.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/template-governance/template-governance-overview-page.tsx apps/web/src/features/template-governance/template-governance-template-ledger-page.tsx apps/web/src/features/template-governance/template-governance-journal-template-ledger-page.tsx apps/web/src/features/template-governance/template-governance-content-module-ledger-page.tsx apps/web/src/features/template-governance/template-governance-extraction-ledger-page.tsx apps/web/playwright/template-governance-unified-workbench.spec.ts
git commit -m "refactor: compact rule center ledger subpages"
```

---

### Task 5: Preserve Existing Web Unit And Learning Coverage

**Files:**
- Modify if expectations conflict: `apps/web/test/template-governance-rule-ledger-page.spec.tsx`
- Modify if expectations conflict: `apps/web/test/template-governance-rule-wizard.spec.tsx`
- Modify if expectations conflict: `apps/web/test/template-governance-content-module-ledger-page.spec.tsx`
- Modify if expectations conflict: `apps/web/test/template-governance-extraction-ledger-page.spec.tsx`
- Modify if coverage is missing: `apps/web/test/rule-center-learning-review.spec.ts`
- Modify if coverage is missing: `apps/web/test/rule-learning-state.spec.ts`
- Modify if coverage is missing: `apps/web/test/workbench-host.spec.tsx`
- Modify if coverage is missing: `apps/web/test/template-governance-workbench-page.spec.tsx`

- [ ] **Step 1: Update unit tests that asserted removed teaching copy**

Do not delete tests just because explanatory copy was removed. Replace assertions for removed copy with assertions for preserved controls, statuses, blocking messages, labels, and route behavior.

Known affected tests to inspect:

```txt
apps/web/test/template-governance-rule-ledger-page.spec.tsx
apps/web/test/template-governance-rule-wizard.spec.tsx
apps/web/test/template-governance-content-module-ledger-page.spec.tsx
apps/web/test/template-governance-extraction-ledger-page.spec.tsx
```

- [ ] **Step 2: Preserve learning candidate conversion behavior**

Ensure existing or new tests cover:

```txt
ruleCenterMode=learning
learningCandidateId deep link selection
RuleLearningPane excludes non-rule residual issues and non-rule learning candidates
转成规则草稿 requires approved source candidate
non-admin users cannot create learning writeback
writeback target_type remains editorial_rule_draft
candidate provenance/evidence/manuscript/reviewed snapshot/template suggestions survive handoff
```

Use or extend:

```txt
apps/web/test/rule-center-learning-review.spec.ts
apps/web/test/rule-learning-state.spec.ts
apps/web/test/rule-learning-pane.spec.tsx
apps/web/playwright/learning-review-flow.spec.ts
```

- [ ] **Step 3: Preserve approved-rule revision behavior**

Ensure existing or new tests cover:

```txt
editing an approved rule creates a new draft revision
approved runtime revision is not overwritten by draft edits
candidateOnly still blocks direct publish
manual AI parsing payload remains wired through the semantic step
binding options still filter to valid published packages and approved non-rule knowledge items
```

Use or extend:

```txt
apps/web/test/template-governance-rule-wizard.spec.tsx
apps/web/test/template-governance-rule-wizard-state.spec.ts
apps/web/test/template-governance-rule-ledger-page.spec.tsx
```

- [ ] **Step 4: Preserve classic/advanced compatibility**

Add or keep assertions that `templateGovernanceView=classic` remains reachable until the action has a tested replacement in the unified workbench.

Preserve or map:

```txt
advanced rule editor
template family draft creation/selection/update
journal template create/activate/archive
module template management
instruction template management
knowledge binding visibility
rule package authoring workspace
rule package compile/upload intake
```

- [ ] **Step 5: Run targeted web unit tests**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-ledger-page.spec.tsx ./test/template-governance-rule-wizard.spec.tsx ./test/template-governance-content-module-ledger-page.spec.tsx ./test/template-governance-extraction-ledger-page.spec.tsx ./test/rule-center-learning-review.spec.ts ./test/rule-learning-state.spec.ts ./test/rule-learning-pane.spec.tsx ./test/workbench-host.spec.tsx ./test/template-governance-workbench-page.spec.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/test/template-governance-rule-ledger-page.spec.tsx apps/web/test/template-governance-rule-wizard.spec.tsx apps/web/test/template-governance-content-module-ledger-page.spec.tsx apps/web/test/template-governance-extraction-ledger-page.spec.tsx apps/web/test/rule-center-learning-review.spec.ts apps/web/test/rule-learning-state.spec.ts apps/web/test/rule-learning-pane.spec.tsx apps/web/test/workbench-host.spec.tsx apps/web/test/template-governance-workbench-page.spec.tsx
git commit -m "test: preserve rule center learning and compatibility flows"
```

---

### Task 6: Preserve AI Intake And Manual Parsing Contracts

**Files:**
- No production code change expected
- Test: `apps/api/test/editorial-rules/rule-ai-intake-service.spec.ts`
- Test: `apps/api/test/editorial-rules/rule-ai-parsing-service.spec.ts`
- Test: `apps/api/test/http/rule-ai-intake-http.spec.ts`
- Test: `packages/contracts/type-tests/package-entry.test.ts`

- [ ] **Step 1: Run AI intake service tests**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/rule-ai-intake-service.spec.ts
```

Expected: PASS. This preserves manual-description draft generation, deterministic template fallback, and similarity hints.

- [ ] **Step 2: Run AI parsing service tests**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/rule-ai-parsing-service.spec.ts
```

Expected: PASS. This preserves manual rule parsing and empty-body rejection.

- [ ] **Step 3: Run AI intake HTTP tests**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/http/rule-ai-intake-http.spec.ts
```

Expected: PASS. This preserves:

```txt
POST /api/v1/editorial-rules/ai-intake/drafts
POST /api/v1/editorial-rules/ai-intake/parse-manual-rule
```

- [ ] **Step 4: Run contract type test**

Run:

```bash
pnpm --filter @medical/contracts typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit only if tests required fixture updates**

If no files changed, skip commit. If test fixtures required updates, commit with:

```bash
git add apps/api/test/editorial-rules/rule-ai-intake-service.spec.ts apps/api/test/editorial-rules/rule-ai-parsing-service.spec.ts apps/api/test/http/rule-ai-intake-http.spec.ts packages/contracts/type-tests/package-entry.test.ts
git commit -m "test: preserve rule AI intake contracts"
```

---

### Task 7: Final Verification Gate

**Files:**
- No production file changes expected

- [ ] **Step 1: Run web unit tests**

Run:

```bash
pnpm --filter @medsys/web test
```

Expected: PASS. This catches unit/component tests that previously asserted removed explanatory copy and covers learning, wizard, ledger, and workbench host behavior.

- [ ] **Step 2: Run web typecheck**

Run:

```bash
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 3: Run targeted browser regression**

Run:

```bash
pnpm --filter @medsys/web exec playwright test -c playwright.config.ts playwright/template-governance-unified-workbench.spec.ts playwright/template-governance-rule-wizard.spec.ts playwright/template-governance-ledgers.spec.ts playwright/admin-governance.spec.ts playwright/learning-review-flow.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Run API rule AI and runtime-boundary preservation tests**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/rule-ai-intake-service.spec.ts ./test/editorial-rules/rule-ai-parsing-service.spec.ts ./test/http/rule-ai-intake-http.spec.ts ./test/editorial-rules/editorial-rule-resolution.spec.ts ./test/editorial-rules/editorial-rule-projection.spec.ts ./test/editorial-rules/editorial-rule-governance.spec.ts ./test/knowledge/knowledge-governance.spec.ts ./test/knowledge/knowledge-semantic-layer.spec.ts
```

Expected: PASS. This verifies AI intake/manual parsing plus runtime boundaries for active/published rule sets and approved effective knowledge revisions.

- [ ] **Step 5: Run contract typecheck**

Run:

```bash
pnpm --filter @medical/contracts typecheck
```

Expected: PASS.

- [ ] **Step 6: Inspect git diff and untracked scope**

Run:

```bash
git status --short --untracked-files=all
git diff --stat
git diff -- apps/web/src/features/template-governance apps/web/playwright apps/web/test
```

Expected:

- implementation changes stay in `apps/web/src/features/template-governance/*`
- test changes stay in `apps/web/playwright/*` and `apps/web/test/*`
- no `apps/api/src/modules/shared/*`
- no `apps/api/src/modules/editorial-rules/*`
- no `apps/api/src/modules/knowledge/*`
- no migrations
- no Prisma schema changes
- no runtime binding changes
- no unrelated screenshots, logs, or OnlyOffice/human-review files are staged

- [ ] **Step 7: Commit final verification note if needed**

Do not create a docs-only verification note unless the user asks for it. If a final cleanup commit is needed:

```bash
git add apps/web/src/features/template-governance/<explicit-file>.tsx apps/web/playwright/template-governance-unified-workbench.spec.ts apps/web/test/<explicit-test-file>.spec.tsx
git commit -m "refactor: unify rule center workbench surface"
```

Replace placeholder paths with the exact changed files. Do not stage directories.

---

## Self-Review

Spec coverage:

- Unified workbench: Tasks 1-4.
- Preserve AI natural-language intake: Tasks 1, 2, 6.
- Preserve manual AI parsing layer: Tasks 3, 6.
- Preserve template/package ledgers: Tasks 1, 4.
- Preserve learning candidate to rule draft path: Tasks 1, 3, 5.
- Preserve approved-rule draft revision behavior: Task 5.
- Preserve classic/advanced compatibility: Task 5.
- Preserve runtime boundaries: Tasks 6, 7.
- Remove explanatory copy: Tasks 1-4.

No implementation task touches backend runtime, database, model routing, runtime binding, or permissions.

Residual risk:

- Some existing Playwright tests may assert old explanatory copy. Update those assertions only when the text is purely explanatory.
- Some existing web unit tests may assert old explanatory copy. Replace those with control/status/blocking assertions instead of deleting the coverage.
- The no-explanation tests must use selector-based checks, not broad word bans.
- The UI will become denser; if a future operator needs help, support should come from direct discussion or separate documentation, not page copy.
