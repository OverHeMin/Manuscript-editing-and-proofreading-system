# Knowledge Library Final Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the knowledge-library experience into a shell-integrated, table-first knowledge ledger with a temporary right-side tabbed entry board, text-first AI-assisted intake, and draft-first governance.

**Architecture:** Keep the knowledge library inside the shared workbench shell and promote the new ledger posture to the primary operator experience. Reuse the existing controller and governed draft/review runtime where possible, but replace the remaining legacy drawer-heavy workbench behavior with a simpler top bar, ledger table, temporary right-side board, inline search, filter drawer, block-based content entry, and explicit AI semantic confirmation.

**Tech Stack:** React 18, TypeScript, Vite feature CSS, existing `apps/web` knowledge-library modules, existing controller/API contracts in `apps/web/src/features/knowledge-library`, Node test runner with `tsx`.

---

## Scope And Status

This plan implements the approved knowledge-library spec:

- [2026-04-14-knowledge-library-final-structure-and-entry-flow-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-14-knowledge-library-final-structure-and-entry-flow-design.md)

This plan supersedes the older redesign plan where it conflicts:

- [2026-04-13-knowledge-library-multidimensional-ledger-redesign.md](/C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-13-knowledge-library-multidimensional-ledger-redesign.md)

Most importantly, the final implementation must **not** follow the old conflicting directions:

- do not detach knowledge library from the shared shell
- do not use a separate search-results page as the main search model
- do not make the page a permanent drawer-and-workspace console
- do not copy the rule-center five-step wizard into knowledge entry

## File Structure

### Shared routing and shell integration

- `apps/web/src/app/workbench-host.tsx`
- `apps/web/src/app/workbench-routing.ts`
- `apps/web/test/workbench-host.spec.tsx`

### Knowledge-library primary surfaces

- `apps/web/src/features/knowledge-library/index.ts`
- `apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx`
- `apps/web/src/features/knowledge-library/knowledge-library-ledger-page.css`
- `apps/web/src/features/knowledge-library/knowledge-library-ledger-toolbar.tsx`
- `apps/web/src/features/knowledge-library/knowledge-library-ledger-grid.tsx`
- `apps/web/src/features/knowledge-library/knowledge-library-entry-form.tsx`
- `apps/web/src/features/knowledge-library/knowledge-library-rich-content-editor.tsx`
- `apps/web/src/features/knowledge-library/knowledge-library-semantic-section.tsx`
- `apps/web/src/features/knowledge-library/knowledge-library-attachment-field.tsx`
- `apps/web/src/features/knowledge-library/knowledge-library-ledger-composer.ts`
- `apps/web/src/features/knowledge-library/knowledge-library-controller.ts`

### Existing legacy knowledge-library surfaces to retire or narrow

- `apps/web/src/features/knowledge-library/knowledge-library-workbench-page.tsx`
- `apps/web/src/features/knowledge-library/knowledge-library-grid-table.tsx`
- `apps/web/src/features/knowledge-library/knowledge-library-grid-toolbar.tsx`
- `apps/web/src/features/knowledge-library/knowledge-library-record-drawer.tsx`
- `apps/web/src/features/knowledge-library/knowledge-library-semantic-panel.tsx`
- `apps/web/src/features/knowledge-library/knowledge-library-ledger-search-page.tsx`

### Tests

- `apps/web/test/knowledge-library-ledger-page.spec.tsx`
- `apps/web/test/knowledge-library-workbench-page.spec.tsx`
- `apps/web/test/knowledge-library-controller.spec.ts`
- `apps/web/test/knowledge-library-semantic-panel.spec.tsx`
- `apps/web/test/workbench-host.spec.tsx`

## Task 1: Lock the final shell-integrated knowledge-library route and retire the old posture

**Files:**
- Modify: `apps/web/src/app/workbench-host.tsx`
- Modify: `apps/web/src/app/workbench-routing.ts`
- Modify: `apps/web/src/features/knowledge-library/index.ts`
- Modify: `apps/web/test/workbench-host.spec.tsx`
- Modify: `apps/web/test/knowledge-library-workbench-page.spec.tsx`

- [ ] **Step 1: Write failing routing tests for the final knowledge-library landing posture**

Add assertions for:

- `#knowledge-library` renders the new table-first knowledge page inside the shared shell
- the left navigation and shell header remain visible
- the legacy drawer-heavy page is no longer the default knowledge-library landing
- route compatibility for existing `knowledgeView=ledger` hashes remains intact

- [ ] **Step 2: Run the route-focused tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/workbench-host.spec.tsx ./test/knowledge-library-workbench-page.spec.tsx
```

Expected: FAIL because the current default route still points to the older knowledge-library workbench posture.

- [ ] **Step 3: Update the host render path so the final ledger page becomes the primary knowledge-library experience**

Apply these rules:

- `knowledge-library` remains inside the shared shell
- `#knowledge-library` should land on the final table-first page by default
- `knowledgeView=ledger` remains a backward-compatible alias
- the older workbench page should no longer be the normal operator entry

- [ ] **Step 4: Keep route parsing stable while simplifying the render decision**

If `knowledgeView=classic` remains in the route model for compatibility, it should no longer block the final knowledge-library page from being the default operator experience.

- [ ] **Step 5: Re-run the route-focused tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/workbench-host.spec.tsx ./test/knowledge-library-workbench-page.spec.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/workbench-host.tsx apps/web/src/app/workbench-routing.ts apps/web/src/features/knowledge-library/index.ts apps/web/test/workbench-host.spec.tsx apps/web/test/knowledge-library-workbench-page.spec.tsx
git commit -m "feat: make the final knowledge ledger the default library route"
```

## Task 2: Rebuild the main page around the approved toolbar, inline search, filter drawer, and table posture

**Files:**
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-toolbar.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-grid.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-page.css`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-controller.ts`
- Modify: `apps/web/test/knowledge-library-ledger-page.spec.tsx`

- [ ] **Step 1: Write failing render tests for the final top bar and table behavior**

Cover:

- visible toolbar actions are only `搜索 / 新增知识 / AI辅助录入 / 筛选`
- search works inline on the current page
- advanced conditions live in a filter drawer instead of a separate search surface
- the default visible columns are:
  - 标题
  - 分类
  - AI语义状态
  - 贡献人
  - 更新时间
- single-click selects a row
- double-click or explicit edit opens the right-side board

- [ ] **Step 2: Run the ledger-page tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-library-ledger-page.spec.tsx
```

Expected: FAIL because the current page still exposes old toolbar items, older column choices, and a separate search surface.

- [ ] **Step 3: Replace the top-level page state with the final simple operator model**

Implement these page states:

- inline search text
- filter drawer open or closed
- selected row id
- right-side board mode:
  - closed
  - create
  - edit
  - ai-intake

Remove the old dedicated search-surface state from the main operator path.

- [ ] **Step 4: Implement the final toolbar posture**

Apply these rules:

- `搜索` updates the table in place
- `筛选` opens a drawer
- `新增知识` opens the right-side board in manual create mode
- `AI辅助录入` opens the right-side board in pre-entry mode
- no delete-first toolbar posture
- no separate search page entry

- [ ] **Step 5: Implement the final table posture**

Apply these rules:

- default columns match the approved set
- table remains visually dense and stable
- row selection is separate from row editing
- contribution info stays visible in the table

- [ ] **Step 6: Re-run the ledger-page tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-library-ledger-page.spec.tsx
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx apps/web/src/features/knowledge-library/knowledge-library-ledger-toolbar.tsx apps/web/src/features/knowledge-library/knowledge-library-ledger-grid.tsx apps/web/src/features/knowledge-library/knowledge-library-ledger-page.css apps/web/src/features/knowledge-library/knowledge-library-controller.ts apps/web/test/knowledge-library-ledger-page.spec.tsx
git commit -m "feat: rebuild knowledge library around the final table-first posture"
```

## Task 3: Implement the temporary right-side tabbed entry board for create and edit

**Files:**
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-entry-form.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-rich-content-editor.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-attachment-field.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-composer.ts`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-page.css`
- Modify: `apps/web/test/knowledge-library-ledger-page.spec.tsx`

- [ ] **Step 1: Write failing tests for the approved three-tab board**

Cover:

- the right-side board is temporary, not permanently dominant
- the three tabs are exactly:
  - `基础信息`
  - `内容材料`
  - `AI语义层`
- `基础信息` shows a short visible form plus `更多信息` collapse
- `内容材料` uses block-list editing
- `提交审核` is in the board footer, not the top toolbar

- [ ] **Step 2: Run the focused board tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-library-ledger-page.spec.tsx
```

Expected: FAIL because the current entry model still reflects the older generic form posture.

- [ ] **Step 3: Implement the `基础信息` tab as a short operator form**

Visible fields:

- 标题
- 分类
- 简要说明或标准答案
- 必要标签

Hide lower-frequency fields inside a bounded `更多信息` section.

- [ ] **Step 4: Implement the `内容材料` tab as a block-list editor**

Support these block types:

- 文字块
- 图片块
- 表格块
- 附件块

Each repeatable item must support:

- add
- remove
- reorder

- [ ] **Step 5: Implement footer state switching for temporary entry versus persisted draft**

Footer rules:

- before a formal row exists:
  - `取消`
  - `确认录入`
- after the row exists as a draft:
  - `保存草稿`
  - `提交审核`

- [ ] **Step 6: Re-run the focused board tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-library-ledger-page.spec.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx apps/web/src/features/knowledge-library/knowledge-library-entry-form.tsx apps/web/src/features/knowledge-library/knowledge-library-rich-content-editor.tsx apps/web/src/features/knowledge-library/knowledge-library-attachment-field.tsx apps/web/src/features/knowledge-library/knowledge-library-ledger-composer.ts apps/web/src/features/knowledge-library/knowledge-library-ledger-page.css apps/web/test/knowledge-library-ledger-page.spec.tsx
git commit -m "feat: add the final tabbed knowledge entry board"
```

## Task 4: Implement AI pre-entry and editable semantic confirmation without auto-publishing

**Files:**
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-entry-form.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-semantic-section.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-composer.ts`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-controller.ts`
- Modify: `apps/web/test/knowledge-library-ledger-page.spec.tsx`
- Modify: `apps/web/test/knowledge-library-controller.spec.ts`
- Modify: `apps/web/test/knowledge-library-semantic-panel.spec.tsx`

- [ ] **Step 1: Write failing tests for the final AI-assisted intake rules**

Cover:

- `AI辅助录入` opens the same right-side board in pre-entry mode
- text is the primary AI input
- images and attachments are secondary evidence
- AI fills candidate values into:
  - `基础信息`
  - `内容材料`
  - `AI语义层`
- the semantic layer fields are editable:
  - 语义摘要
  - 检索词
  - 别名
  - 适用场景
  - 风险标签
- AI output never auto-submits or auto-publishes

- [ ] **Step 2: Run AI-focused knowledge-library tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-library-ledger-page.spec.tsx ./test/knowledge-library-controller.spec.ts ./test/knowledge-library-semantic-panel.spec.tsx
```

Expected: FAIL because the current AI flow still reflects earlier semantics and older board behavior.

- [ ] **Step 3: Implement the right-side AI pre-entry mode**

Apply these rules:

- pasted source text is the primary ingestion input
- uploads are supporting evidence, not the main path
- AI suggestions hydrate the same composer used by manual entry

- [ ] **Step 4: Implement explicit semantic confirmation gating**

Apply these rules:

- semantic fields are editable before confirmation
- `确认录入` stays disabled until required core fields exist and semantic confirmation is complete
- confirmed records enter the ledger as `草稿`
- no auto-review submission
- no auto-approval

- [ ] **Step 5: Preserve duplicate checking and draft governance on the new board**

The duplicate check should remain tied to the board lifecycle and should surface warnings before final entry or review submission.

- [ ] **Step 6: Re-run AI-focused knowledge-library tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-library-ledger-page.spec.tsx ./test/knowledge-library-controller.spec.ts ./test/knowledge-library-semantic-panel.spec.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx apps/web/src/features/knowledge-library/knowledge-library-entry-form.tsx apps/web/src/features/knowledge-library/knowledge-library-semantic-section.tsx apps/web/src/features/knowledge-library/knowledge-library-ledger-composer.ts apps/web/src/features/knowledge-library/knowledge-library-controller.ts apps/web/test/knowledge-library-ledger-page.spec.tsx apps/web/test/knowledge-library-controller.spec.ts apps/web/test/knowledge-library-semantic-panel.spec.tsx
git commit -m "feat: add final ai-assisted knowledge intake and semantic confirmation"
```

## Task 5: Remove legacy surface leaks, finish Chinese copy alignment, and verify the final operator journey

**Files:**
- Modify: `apps/web/src/features/knowledge-library/index.ts`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-workbench-page.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-grid-table.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-grid-toolbar.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-record-drawer.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-semantic-panel.tsx`
- Modify or delete: `apps/web/src/features/knowledge-library/knowledge-library-ledger-search-page.tsx`
- Verify tests and copy only across touched files

- [ ] **Step 1: Audit for legacy entry-surface leaks**

Check for:

- old record-drawer language
- detached search-surface language
- oversized workspace wording
- stale English UI copy that is safe to localize

- [ ] **Step 2: Narrow or retire legacy modules that no longer belong to the final operator path**

Actions may include:

- stop exporting old surface components from `index.ts`
- reduce old files to compatibility wrappers if still referenced
- delete dead modules only after all references are removed

- [ ] **Step 3: Run the full knowledge-library regression suite**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/workbench-host.spec.tsx ./test/knowledge-library-workbench-page.spec.tsx ./test/knowledge-library-ledger-page.spec.tsx ./test/knowledge-library-controller.spec.ts ./test/knowledge-library-semantic-panel.spec.tsx
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 4: Perform browser acceptance for the final knowledge-library journey**

Manual checklist:

- knowledge library opens inside the shared shell
- the page feels table-first and easy to learn
- search refreshes the current table directly
- filter controls stay tucked in a drawer
- the right-side board opens only when needed
- create and edit use the same three tabs
- AI-assisted intake stays inside the same board
- new entries enter as draft only after confirmation
- review submission happens from the board footer
- contribution info is visible in the table

- [ ] **Step 5: Commit only if this cleanup and acceptance pass required source changes**

```bash
git add apps/web/src/features/knowledge-library/index.ts apps/web/src/features/knowledge-library/knowledge-library-workbench-page.tsx apps/web/src/features/knowledge-library/knowledge-library-grid-table.tsx apps/web/src/features/knowledge-library/knowledge-library-grid-toolbar.tsx apps/web/src/features/knowledge-library/knowledge-library-record-drawer.tsx apps/web/src/features/knowledge-library/knowledge-library-semantic-panel.tsx apps/web/src/features/knowledge-library/knowledge-library-ledger-search-page.tsx
git commit -m "refactor: clean up legacy knowledge library surfaces"
```

Skip the commit if verification is green and no cleanup edits were needed.

## Master-Plan Alignment

This child plan satisfies the knowledge-library phase in:

- [2026-04-14-system-redesign-master-implementation.md](/C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-14-system-redesign-master-implementation.md)

It should execute after:

- shared shell stabilization
- centralized AI access cleanup
- rule-center rollout decisions that affect shared wording

It should complete before:

- knowledge-review simplification
- full manuscript-workbench redesign

## Execution Gate

Do not start implementation from this document yet.

Current user instruction is:

- finish planning first
- do not start coding from this plan until the larger system plan is ready

When execution is eventually approved, follow the tasks in order:

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
