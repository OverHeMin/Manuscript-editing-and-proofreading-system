# Rule Center Final Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `规则中心` into a lightweight home page plus a unified rule ledger and a five-step rule wizard, while preserving existing governance capabilities and reusing the knowledge draft/semantic substrate where possible.

**Architecture:** Keep the current `template-governance` workbench and route family, but add one new daily-driver surface: `rule-ledger`. Implement the new `新增 / 编辑规则` flow as a shared five-step wizard backed by knowledge-draft APIs for content, semantic generation, and review status, then layer package/template bindings on top. Preserve existing deep ledgers (`大模板 / 期刊模板 / 通用包 / 医学专用包 / 提取`) as secondary views instead of deleting them.

**Tech Stack:** React 18, TypeScript, Vite, `node:test`, existing `template-governance` controller/pages, existing `knowledge-library` draft/content/semantic APIs, existing API persistence in `apps/api`, workspace contracts in `packages/contracts`.

---

## File Structure

### Modify

- `apps/web/src/app/workbench-routing.ts`
- `apps/web/src/features/template-governance/index.ts`
- `apps/web/src/features/template-governance/template-governance-navigation.ts`
- `apps/web/src/features/template-governance/template-governance-overview-page.tsx`
- `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- `apps/web/src/features/template-governance/template-governance-controller.ts`
- `apps/web/src/features/template-governance/template-governance-ledger-types.ts`
- `apps/web/src/features/knowledge-library/types.ts`
- `packages/contracts/src/knowledge.ts`
- `apps/api/src/modules/knowledge/knowledge-record.ts`
- `apps/api/src/modules/knowledge/knowledge-service.ts`
- `apps/api/src/modules/knowledge/postgres-knowledge-repository.ts`
- `apps/api/src/http/api-http-server.ts`
- `apps/web/test/template-governance-ledger-routing.spec.tsx`
- `apps/web/test/template-governance-overview-page.spec.tsx`
- `apps/web/test/template-governance-workbench-page.spec.tsx`
- `apps/web/test/rule-center-learning-review.spec.ts`
- `apps/api/test/knowledge/knowledge-governance.spec.ts`
- `apps/api/test/http/persistent-governance-http.spec.ts`

### Create

- `apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx`
- `apps/web/src/features/template-governance/template-governance-rule-ledger-state.ts`
- `apps/web/src/features/template-governance/template-governance-rule-wizard.tsx`
- `apps/web/src/features/template-governance/template-governance-rule-wizard-api.ts`
- `apps/web/src/features/template-governance/template-governance-rule-wizard-step-entry.tsx`
- `apps/web/src/features/template-governance/template-governance-rule-wizard-step-semantic.tsx`
- `apps/web/src/features/template-governance/template-governance-rule-wizard-step-confirm.tsx`
- `apps/web/src/features/template-governance/template-governance-rule-wizard-step-binding.tsx`
- `apps/web/src/features/template-governance/template-governance-rule-wizard-step-publish.tsx`
- `apps/web/test/template-governance-rule-ledger-page.spec.tsx`
- `apps/web/test/template-governance-rule-wizard.spec.tsx`
- `apps/web/test/template-governance-rule-wizard-state.spec.ts`
- `apps/api/src/database/migrations/0040_rule_center_package_binding_kinds.sql`

### Keep But De-Emphasize

- `apps/web/src/features/template-governance/rule-package-authoring-shell.tsx`
- `apps/web/src/features/template-governance/rule-learning-pane.tsx`
- `apps/web/src/features/template-governance/template-governance-template-ledger-page.tsx`
- `apps/web/src/features/template-governance/template-governance-journal-template-ledger-page.tsx`
- `apps/web/src/features/template-governance/template-governance-content-module-ledger-page.tsx`
- `apps/web/src/features/template-governance/template-governance-extraction-ledger-page.tsx`

These older/deeper surfaces stay reachable, but the new operator default becomes `overview -> rule-ledger -> wizard`.

## Scope Guard

Do not mix the knowledge-library redesign into this implementation plan. This plan may extract or reuse knowledge primitives, but it must ship a working `规则中心` on its own.

## Task 1: Add the new route, navigation, and home-page posture

**Files:**
- Modify: `apps/web/src/app/workbench-routing.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-navigation.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-overview-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Modify: `apps/web/src/features/template-governance/index.ts`
- Test: `apps/web/test/template-governance-ledger-routing.spec.tsx`
- Test: `apps/web/test/template-governance-overview-page.spec.tsx`
- Test: `apps/web/test/template-governance-workbench-page.spec.tsx`

- [ ] **Step 1: Write the failing routing and overview tests**

```ts
test("formatWorkbenchHash preserves rule-ledger view", () => {
  const hash = formatWorkbenchHash("template-governance", {
    templateGovernanceView: "rule-ledger",
  });
  assert.match(hash, /templateGovernanceView=rule-ledger/u);
});

test("rule center overview shows quick entry and pending items but no hero", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceOverviewPage
      metrics={{ templateCount: 4, moduleCount: 9, pendingKnowledgeCount: 3, extractionAwaitingConfirmationCount: 6 }}
    />,
  );
  assert.match(markup, /规则台账/u);
  assert.match(markup, /新建规则/u);
  assert.doesNotMatch(markup, /template-governance-hero/u);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-ledger-routing.spec.tsx ./test/template-governance-overview-page.spec.tsx ./test/template-governance-workbench-page.spec.tsx
```

Expected: FAIL because `rule-ledger` is not yet a valid `TemplateGovernanceView`, the navigation does not expose it, and the overview does not yet render the new quick-entry posture.

- [ ] **Step 3: Implement the new route and lightweight home page**

```ts
export type TemplateGovernanceView =
  | "rule-ledger"
  | "overview"
  | "large-template-ledger"
  | "journal-template-ledger"
  | "general-package-ledger"
  | "medical-package-ledger"
  | "extraction-ledger"
  | "classic";

const navigationOrder = [
  "overview",
  "rule-ledger",
  "large-template-ledger",
  "journal-template-ledger",
  "general-package-ledger",
  "medical-package-ledger",
  "extraction-ledger",
] as const;
```

Implementation notes:

- make `rule-ledger` the primary operator entry from overview
- keep old deep ledgers in nav, but visually secondary
- remove any large intro copy from the overview
- add compact quick-action entrances:
  - `新建规则`
  - `进入规则台账`
  - `查看待审核`

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-ledger-routing.spec.tsx ./test/template-governance-overview-page.spec.tsx ./test/template-governance-workbench-page.spec.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/workbench-routing.ts apps/web/src/features/template-governance/template-governance-navigation.ts apps/web/src/features/template-governance/template-governance-overview-page.tsx apps/web/src/features/template-governance/template-governance-workbench-page.tsx apps/web/src/features/template-governance/index.ts apps/web/test/template-governance-ledger-routing.spec.tsx apps/web/test/template-governance-overview-page.spec.tsx apps/web/test/template-governance-workbench-page.spec.tsx
git commit -m "feat: add rule ledger route and compact rule center home"
```

## Task 2: Expand knowledge bindings so rules can bind to packages cleanly

**Files:**
- Modify: `packages/contracts/src/knowledge.ts`
- Modify: `apps/web/src/features/knowledge-library/types.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-record.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-service.ts`
- Modify: `apps/api/src/modules/knowledge/postgres-knowledge-repository.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Create: `apps/api/src/database/migrations/0040_rule_center_package_binding_kinds.sql`
- Test: `apps/api/test/knowledge/knowledge-governance.spec.ts`
- Test: `apps/api/test/http/persistent-governance-http.spec.ts`

- [ ] **Step 1: Write failing contract and persistence tests**

```ts
assert.deepEqual(savedRevision.bindings.map((binding) => binding.binding_kind), [
  "general_package",
  "medical_package",
  "template_family",
]);
```

```ts
await request("/api/v1/knowledge/assets/drafts", {
  method: "POST",
  body: {
    title: "术语统一规则",
    canonicalText: "医学术语应全文统一。",
    knowledgeKind: "rule",
    moduleScope: "editing",
    manuscriptTypes: ["clinical_study"],
    bindings: [
      { bindingKind: "medical_package", bindingTargetId: "pkg-medical", bindingTargetLabel: "医学专业校对包" },
    ],
  },
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @medical/api exec tsx ./test/run-tests.ts knowledge persistent-governance-http
```

Expected: FAIL because `general_package` and `medical_package` are not valid binding kinds in contracts, repository code, or HTTP validation.

- [ ] **Step 3: Add the new binding kinds end to end**

```ts
export type KnowledgeRevisionBindingKind =
  | "template_family"
  | "module_template"
  | "section"
  | "journal_template"
  | "general_package"
  | "medical_package";
```

Migration requirement:

- update the revision-bindings enum/check constraint
- preserve old rows
- do not rewrite existing binding data

Service requirement:

- normalize and persist both new kinds
- include them in returned revision detail payloads

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @medical/api exec tsx ./test/run-tests.ts knowledge persistent-governance-http
pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-library-controller.spec.ts
```

Expected: PASS for both API and web type consumers.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/knowledge.ts apps/web/src/features/knowledge-library/types.ts apps/api/src/modules/knowledge/knowledge-record.ts apps/api/src/modules/knowledge/knowledge-service.ts apps/api/src/modules/knowledge/postgres-knowledge-repository.ts apps/api/src/http/api-http-server.ts apps/api/src/database/migrations/0040_rule_center_package_binding_kinds.sql apps/api/test/knowledge/knowledge-governance.spec.ts apps/api/test/http/persistent-governance-http.spec.ts
git commit -m "feat: support package bindings for governed rules"
```

## Task 3: Build the unified rule ledger page and controller state

**Files:**
- Create: `apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx`
- Create: `apps/web/src/features/template-governance/template-governance-rule-ledger-state.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-controller.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-ledger-types.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Modify: `apps/web/src/features/template-governance/index.ts`
- Test: `apps/web/test/template-governance-rule-ledger-page.spec.tsx`
- Test: `apps/web/test/template-governance-workbench-page.spec.tsx`

- [ ] **Step 1: Write the failing ledger page tests**

```tsx
const markup = renderToStaticMarkup(
  <TemplateGovernanceRuleLedgerPage
    initialViewModel={{
      category: "all",
      rows: [
        {
          id: "rule-1",
          asset_kind: "rule",
          title: "术语统一规则",
          module_label: "编辑",
          manuscript_type_label: "论著",
          semantic_status: "pending_confirmation",
          publish_status: "draft",
          contributor_label: "editor.zh",
          updated_at: "2026-04-14T09:00:00.000Z",
        },
      ],
    }}
  />,
);
assert.match(markup, /规则台账/u);
assert.match(markup, /全部资产/u);
assert.match(markup, /回流候选/u);
assert.match(markup, /术语统一规则/u);
assert.match(markup, /新建规则/u);
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-ledger-page.spec.tsx ./test/template-governance-workbench-page.spec.tsx
```

Expected: FAIL because the new page and view-model type do not exist.

- [ ] **Step 3: Implement the unified ledger and controller loader**

```ts
export interface TemplateGovernanceRuleLedgerRow {
  id: string;
  asset_kind: "rule" | "large_template" | "journal_template" | "general_package" | "medical_package" | "recycled_candidate";
  title: string;
  module_label: string;
  manuscript_type_label: string;
  semantic_status: string;
  publish_status: string;
  contributor_label: string;
  updated_at?: string;
}
```

Implementation notes:

- synthesize ledger rows from:
  - knowledge items where `knowledge_kind === "rule"`
  - template ledger summaries
  - journal template summaries
  - content-module ledgers mapped to `general_package` / `medical_package`
  - learning candidate summaries mapped to `recycled_candidate`
- keep the selected-row detail bounded and compact
- add top-bar actions:
  - `新建规则`
  - `搜索`
  - `筛选`
  - `批量操作`
  - `导入`

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-ledger-page.spec.tsx ./test/template-governance-workbench-page.spec.tsx
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx apps/web/src/features/template-governance/template-governance-rule-ledger-state.ts apps/web/src/features/template-governance/template-governance-controller.ts apps/web/src/features/template-governance/template-governance-ledger-types.ts apps/web/src/features/template-governance/template-governance-workbench-page.tsx apps/web/src/features/template-governance/index.ts apps/web/test/template-governance-rule-ledger-page.spec.tsx apps/web/test/template-governance-workbench-page.spec.tsx
git commit -m "feat: add unified rule ledger surface"
```

## Task 4: Add the shared five-step wizard shell and navigation state

**Files:**
- Create: `apps/web/src/features/template-governance/template-governance-rule-wizard.tsx`
- Create: `apps/web/src/features/template-governance/template-governance-rule-wizard-state.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Modify: `apps/web/src/features/template-governance/index.ts`
- Test: `apps/web/test/template-governance-rule-wizard.spec.tsx`
- Test: `apps/web/test/template-governance-rule-wizard-state.spec.ts`

- [ ] **Step 1: Write the failing wizard tests**

```ts
assert.deepEqual(getWizardStepLabels(), [
  "基础录入与证据补充",
  "AI 识别语义层",
  "人工确认 AI 结果",
  "放入模板 / 规则包",
  "保存与发布",
]);
```

```tsx
assert.match(markup, /下一步：AI 识别语义层/u);
assert.match(markup, /保存草稿/u);
assert.match(markup, /完成并返回规则中心/u);
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-wizard.spec.tsx ./test/template-governance-rule-wizard-state.spec.ts
```

Expected: FAIL because the wizard shell/state do not exist.

- [ ] **Step 3: Implement the shell and step-state helpers**

```ts
export type RuleWizardStep =
  | "entry"
  | "semantic"
  | "confirm"
  | "binding"
  | "publish";

export interface RuleWizardState {
  mode: "create" | "edit" | "candidate";
  step: RuleWizardStep;
  dirty: boolean;
  draftAssetId?: string;
  draftRevisionId?: string;
}
```

Implementation notes:

- keep wizard state local to `template-governance`
- allow open from:
  - `新建规则`
  - ledger row `编辑`
  - `回流候选` row `转成规则`
- keep advanced actions inside bounded drawers, not in the shell header

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-wizard.spec.tsx ./test/template-governance-rule-wizard-state.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/template-governance/template-governance-rule-wizard.tsx apps/web/src/features/template-governance/template-governance-rule-wizard-state.ts apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx apps/web/src/features/template-governance/template-governance-workbench-page.tsx apps/web/src/features/template-governance/index.ts apps/web/test/template-governance-rule-wizard.spec.tsx apps/web/test/template-governance-rule-wizard-state.spec.ts
git commit -m "feat: add shared five-step rule wizard shell"
```

## Task 5: Implement Step 1 on top of knowledge drafts and content blocks

**Files:**
- Create: `apps/web/src/features/template-governance/template-governance-rule-wizard-api.ts`
- Create: `apps/web/src/features/template-governance/template-governance-rule-wizard-step-entry.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-controller.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard.tsx`
- Test: `apps/web/test/template-governance-rule-wizard.spec.tsx`
- Test: `apps/web/test/template-governance-rule-ledger-page.spec.tsx`

- [ ] **Step 1: Write the failing entry-step tests**

```tsx
assert.match(markup, /规则正文/u);
assert.match(markup, /正例示例/u);
assert.match(markup, /反例示例/u);
assert.match(markup, /图片 \/ 图表 \/ 截图/u);
assert.match(markup, /来源依据/u);
assert.match(markup, /展开高级标签/u);
```

```ts
assert.deepEqual(createRuleDraftInput(form), {
  title: "术语统一规则",
  canonicalText: "医学术语应全文统一。",
  knowledgeKind: "rule",
  moduleScope: "editing",
  manuscriptTypes: ["clinical_study"],
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-wizard.spec.tsx ./test/template-governance-rule-ledger-page.spec.tsx
```

Expected: FAIL because step 1 content/evidence controls and the API adapter do not exist.

- [ ] **Step 3: Implement Step 1 using the knowledge-draft substrate**

```ts
import {
  createKnowledgeLibraryDraft,
  replaceKnowledgeRevisionContentBlocks,
  updateKnowledgeRevisionDraft,
  type CreateKnowledgeLibraryDraftInput,
} from "../knowledge-library/knowledge-library-api.ts";
```

Implementation notes:

- create a rule draft as `knowledgeKind: "rule"`
- store the basic form in draft fields
- store rich evidence in content blocks
- keep advanced tags in a collapsed drawer
- do not bind packages/templates yet in step 1

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-wizard.spec.tsx ./test/template-governance-rule-ledger-page.spec.tsx
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/template-governance/template-governance-rule-wizard-api.ts apps/web/src/features/template-governance/template-governance-rule-wizard-step-entry.tsx apps/web/src/features/template-governance/template-governance-controller.ts apps/web/src/features/template-governance/template-governance-rule-wizard.tsx apps/web/test/template-governance-rule-wizard.spec.tsx apps/web/test/template-governance-rule-ledger-page.spec.tsx
git commit -m "feat: implement rule wizard entry and evidence step"
```

## Task 6: Implement Steps 2 and 3 with semantic generation and human confirmation

**Files:**
- Create: `apps/web/src/features/template-governance/template-governance-rule-wizard-step-semantic.tsx`
- Create: `apps/web/src/features/template-governance/template-governance-rule-wizard-step-confirm.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard-api.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx`
- Test: `apps/web/test/template-governance-rule-wizard.spec.tsx`

- [ ] **Step 1: Write the failing semantic/confirmation tests**

```tsx
assert.match(markup, /AI 语义层结果/u);
assert.match(markup, /识别可信度/u);
assert.match(markup, /人工确认 AI 结果/u);
assert.match(markup, /一键采纳高置信结果/u);
assert.match(markup, /变更摘要/u);
```

```ts
assert.deepEqual(confirmSemanticLayerInput(draft), {
  pageSummary: "该规则用于检查医学术语、缩略语和中英文名称是否统一。",
  retrievalTerms: ["术语统一", "缩写释义"],
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-wizard.spec.tsx
```

Expected: FAIL because steps 2 and 3 are not yet wired to semantic regenerate/confirm APIs.

- [ ] **Step 3: Implement semantic generation and confirmation**

```ts
import {
  assistKnowledgeRevisionSemanticLayer,
  confirmKnowledgeSemanticLayer,
  regenerateKnowledgeSemanticLayer,
} from "../knowledge-library/knowledge-library-api.ts";
```

Implementation notes:

- step 2 shows AI output plus confidence/evidence preview
- step 3 only edits semantic conclusions, not the original evidence
- keep the editable dimensions limited to:
  - rule type
  - risk level
  - applicable module
  - manuscript types
  - semantic summary

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-wizard.spec.tsx
pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-library-semantic-panel.spec.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/template-governance/template-governance-rule-wizard-step-semantic.tsx apps/web/src/features/template-governance/template-governance-rule-wizard-step-confirm.tsx apps/web/src/features/template-governance/template-governance-rule-wizard-api.ts apps/web/src/features/template-governance/template-governance-rule-wizard.tsx apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx apps/web/test/template-governance-rule-wizard.spec.tsx
git commit -m "feat: implement semantic generation and confirmation steps"
```

## Task 7: Implement Steps 4 and 5 for binding, submit, and publish

**Files:**
- Create: `apps/web/src/features/template-governance/template-governance-rule-wizard-step-binding.tsx`
- Create: `apps/web/src/features/template-governance/template-governance-rule-wizard-step-publish.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard-api.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-controller.ts`
- Test: `apps/web/test/template-governance-rule-wizard.spec.tsx`
- Test: `apps/api/test/knowledge/knowledge-governance.spec.ts`
- Test: `apps/api/test/http/persistent-governance-http.spec.ts`

- [ ] **Step 1: Write the failing binding/publish tests**

```tsx
assert.match(markup, /进入哪个规则包/u);
assert.match(markup, /通用校对包/u);
assert.match(markup, /医学专业校对包/u);
assert.match(markup, /发布方式/u);
assert.match(markup, /提交审核/u);
assert.match(markup, /完成并返回规则中心/u);
```

```ts
assert.deepEqual(bindingInputs, [
  { bindingKind: "medical_package", bindingTargetId: "pkg-medical", bindingTargetLabel: "医学专业校对包" },
  { bindingKind: "template_family", bindingTargetId: "family-clinical", bindingTargetLabel: "论著基础族" },
]);
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-wizard.spec.tsx
pnpm --filter @medical/api exec tsx ./test/run-tests.ts knowledge persistent-governance-http
```

Expected: FAIL because the wizard does not yet map binding selections and release states to draft/update/submit behavior.

- [ ] **Step 3: Implement binding and lifecycle actions**

```ts
const bindings = [
  selectedPackageKind === "general_package"
    ? { bindingKind: "general_package", bindingTargetId: packageId, bindingTargetLabel: packageLabel }
    : { bindingKind: "medical_package", bindingTargetId: packageId, bindingTargetLabel: packageLabel },
  ...selectedTemplateFamilies.map((family) => ({
    bindingKind: "template_family",
    bindingTargetId: family.id,
    bindingTargetLabel: family.name,
  })),
];
```

Implementation notes:

- `保存草稿` => save draft and return to ledger
- `提交审核` => submit draft via knowledge-review submission path
- `直接发布` => only for privileged roles; if the current stack has no one-click publish for this record type, implement it as `submit + approve` behind the same guarded controller action
- after success, return to `rule-ledger` and highlight the affected row

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-wizard.spec.tsx
pnpm --filter @medical/api exec tsx ./test/run-tests.ts knowledge persistent-governance-http
pnpm --filter @medsys/web typecheck
pnpm --filter @medical/api typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/template-governance/template-governance-rule-wizard-step-binding.tsx apps/web/src/features/template-governance/template-governance-rule-wizard-step-publish.tsx apps/web/src/features/template-governance/template-governance-rule-wizard-api.ts apps/web/src/features/template-governance/template-governance-rule-wizard.tsx apps/web/src/features/template-governance/template-governance-controller.ts apps/web/test/template-governance-rule-wizard.spec.tsx apps/api/test/knowledge/knowledge-governance.spec.ts apps/api/test/http/persistent-governance-http.spec.ts
git commit -m "feat: add rule bindings and publish flow"
```

## Task 8: Fold `回流候选` into the new rule ledger and retire old authoring-first posture

**Files:**
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard.tsx`
- Modify: `apps/web/test/rule-center-learning-review.spec.ts`
- Modify: `apps/web/test/template-governance-workbench-page.spec.tsx`

- [ ] **Step 1: Write the failing handoff tests**

```ts
assert.match(markup, /回流候选/u);
assert.match(markup, /转成规则/u);
assert.doesNotMatch(markup, /RulePackageAuthoringShell/u);
```

```ts
const hash = formatWorkbenchHash("template-governance", {
  templateGovernanceView: "rule-ledger",
  ruleCenterMode: "learning",
  reviewedCaseSnapshotId: "snapshot-42",
});
assert.match(hash, /templateGovernanceView=rule-ledger/u);
assert.match(hash, /ruleCenterMode=learning/u);
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/rule-center-learning-review.spec.ts ./test/template-governance-workbench-page.spec.tsx
```

Expected: FAIL because the old learning path still emphasizes the previous authoring/candidate panes.

- [ ] **Step 3: Implement the folded recovery path**

```ts
if (routeState.ruleCenterMode === "learning") {
  initialCategory = "recycled_candidate";
  initialWizardMode = selectedCandidate ? "candidate" : null;
}
```

Implementation notes:

- the `学习回流` path should land in `rule-ledger` with the `回流候选` filter active
- selecting `转成规则` opens the same five-step wizard with prefilled evidence
- do not keep a separate top-level operator page for the old learning-review-to-rule-authoring bridge

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/rule-center-learning-review.spec.ts ./test/template-governance-workbench-page.spec.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/template-governance/template-governance-workbench-page.tsx apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx apps/web/src/features/template-governance/template-governance-rule-wizard.tsx apps/web/test/rule-center-learning-review.spec.ts apps/web/test/template-governance-workbench-page.spec.tsx
git commit -m "feat: fold recycled candidates into rule ledger wizard"
```

## Task 9: Run regression verification and browser acceptance

**Files:**
- No new product files
- Verify touched tests only

- [ ] **Step 1: Run focused web regression**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-ledger-routing.spec.tsx ./test/template-governance-overview-page.spec.tsx ./test/template-governance-rule-ledger-page.spec.tsx ./test/template-governance-rule-wizard.spec.tsx ./test/template-governance-rule-wizard-state.spec.ts ./test/template-governance-workbench-page.spec.tsx ./test/rule-center-learning-review.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run focused API regression**

Run:

```bash
pnpm --filter @medical/api exec tsx ./test/run-tests.ts knowledge persistent-governance-http
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm --filter @medsys/web typecheck
pnpm --filter @medical/api typecheck
```

Expected: PASS.

- [ ] **Step 4: Run browser acceptance manually**

Verify in browser:

- `规则中心首页` is short and has quick actions only
- `规则台账` shows category switches and dense rows
- `新建规则` opens the five-step wizard
- `回流候选` can open the same wizard with prefilled evidence
- `保存草稿 / 提交审核 / 直接发布` return to the ledger with visible status updates

- [ ] **Step 5: Commit verification-only cleanup if needed**

```bash
git add -A
git commit -m "test: verify rule center final structure rollout"
```

Only do this commit if verification required code or fixture adjustments. If verification is green with no file changes, skip the commit.

## Follow-On, Not In This Plan

After the rule center rollout is stable, write a separate plan to bring the knowledge library closer to the same interaction model:

- entry canvas with richer evidence blocks
- clearer AI semantic step
- bounded confirmation step
- cleaner publish/review closeout

Do not bundle that work into this implementation plan.
