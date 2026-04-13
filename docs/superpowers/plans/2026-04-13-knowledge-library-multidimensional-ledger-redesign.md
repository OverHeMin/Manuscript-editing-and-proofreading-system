# Knowledge Library Multidimensional Ledger Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `#knowledge-library?knowledgeView=ledger` subpage into a spreadsheet-first multidimensional knowledge ledger with a reusable add/edit form and a dedicated search results surface.

**Architecture:** Keep the immersive ledger route in [`apps/web/src/app/workbench-host.tsx`](C:/医学稿件处理系统V1/apps/web/src/app/workbench-host.tsx), but replace the current table-plus-drawer workbench metaphor with a table-dominant page. Split the ledger page into focused UI slices: toolbar, grid, reusable entry form, attachment field, semantic section, and dedicated search surface while preserving the existing knowledge-library controller APIs for load, draft save, duplicate check, semantic assist, semantic confirm, and upload flows.

**Tech Stack:** React 18, TypeScript, existing knowledge-library controller/api modules, Node test runner with `tsx`, Vite CSS modules via feature CSS files.

---

### Task 1: Lock the redesign with failing render tests

**Files:**
- Modify: `apps/web/test/knowledge-library-ledger-page.spec.tsx`
- Modify: `apps/web/test/workbench-host.spec.tsx`
- Reference: `docs/superpowers/specs/2026-04-13-knowledge-library-multidimensional-ledger-redesign-design.md`

- [ ] **Step 1: Write the failing ledger render tests**

```tsx
test("ledger page renders spreadsheet-first toolbar and grid without record drawer", () => {
  const markup = renderToStaticMarkup(<KnowledgeLibraryLedgerPage initialViewModel={...} />);

  assert.match(markup, /knowledge-library-ledger-toolbar/);
  assert.match(markup, /knowledge-library-ledger-grid/);
  assert.match(markup, /名称\/关键词/);
  assert.match(markup, /答案/);
  assert.match(markup, /AI状态/);
  assert.doesNotMatch(markup, /knowledge-library-record-drawer/);
  assert.doesNotMatch(markup, /Editable Workspace|Browse Workspace/);
});

test("add action opens reusable entry form with AI semantic confirmation controls", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryLedgerPage initialViewModel={...} initialFormMode="create" />,
  );

  assert.match(markup, /knowledge-library-entry-form/);
  assert.match(markup, /生成AI语义/);
  assert.match(markup, /确认录入/);
  assert.match(markup, /disabled/);
});

test("search action opens dedicated search results surface", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryLedgerPage initialViewModel={...} initialSearchOpen />,
  );

  assert.match(markup, /knowledge-library-ledger-search/);
  assert.match(markup, /搜索结果/);
});
```

- [ ] **Step 2: Run the ledger test file to verify it fails**

Run: `pnpm --dir apps/web exec node --import tsx --test test/knowledge-library-ledger-page.spec.tsx test/workbench-host.spec.tsx`
Expected: FAIL because the current implementation still renders the record drawer and workspace tabs.

- [ ] **Step 3: Tighten the immersive shell assertion**

```tsx
test("knowledge ledger immersive route omits shell chrome and renders table-first ledger surface", async () => {
  const markup = await renderWorkbenchHostAtHash("#knowledge-library?knowledgeView=ledger");

  assert.match(markup, /knowledge-library-ledger-page/);
  assert.match(markup, /knowledge-library-ledger-grid/);
  assert.doesNotMatch(markup, /workbench-header/);
  assert.doesNotMatch(markup, /workbench-nav/);
});
```

- [ ] **Step 4: Re-run the targeted tests to keep the failure focused**

Run: `pnpm --dir apps/web exec node --import tsx --test test/knowledge-library-ledger-page.spec.tsx test/workbench-host.spec.tsx`
Expected: FAIL only on the newly asserted redesign behaviors.

- [ ] **Step 5: Commit the red tests**

```bash
git add apps/web/test/knowledge-library-ledger-page.spec.tsx apps/web/test/workbench-host.spec.tsx
git commit -m "test: define multidimensional ledger redesign behavior"
```

### Task 2: Rebuild the ledger page state model around table, form, and search surfaces

**Files:**
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx`
- Modify: `apps/web/src/features/knowledge-library/index.ts`
- Reference: `apps/web/src/features/knowledge-library/knowledge-library-controller.ts`
- Reference: `apps/web/src/features/knowledge-library/knowledge-library-ledger-composer.ts`

- [ ] **Step 1: Introduce explicit local UI state for the redesigned surfaces**

```ts
type LedgerSurface = "table" | "search";
type EntryFormMode = "closed" | "create" | "edit";
type LedgerDensity = "compact" | "standard" | "relaxed";

const [surface, setSurface] = useState<LedgerSurface>("table");
const [entryFormMode, setEntryFormMode] = useState<EntryFormMode>("closed");
const [density, setDensity] = useState<LedgerDensity>("compact");
const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
const [columnWidths, setColumnWidths] = useState<Record<string, number>>(DEFAULT_COLUMN_WIDTHS);
```

- [ ] **Step 2: Remove drawer/workspace-tab rendering and replace it with top-level surface switching**

```tsx
return (
  <main className="knowledge-library-ledger-page">
    <KnowledgeLibraryLedgerToolbar ... />
    {surface === "search" ? <KnowledgeLibraryLedgerSearchPage ... /> : <KnowledgeLibraryLedgerGrid ... />}
    {entryFormMode !== "closed" ? <KnowledgeLibraryEntryForm ... /> : null}
  </main>
);
```

- [ ] **Step 3: Preserve governed actions and controller wiring**

```ts
async function handleConfirmEntry() {
  if (!composer || !isSemanticLayerConfirmed(composer)) {
    return;
  }

  if (composer.persistedRevisionId) {
    await handleSaveDraft();
    return;
  }

  await runMutation(
    () => controller.createDraftAndLoad({ ...buildCreateDraftInput(composer), filters: viewModel?.filters }),
    "知识已录入台账。",
  );
}
```

- [ ] **Step 4: Keep duplicate checks attached to the composer lifecycle**

Run: no command; implement by reusing existing duplicate-check effect and submit gating from the current page, but anchor the warnings inside the form instead of the removed drawer.

- [ ] **Step 5: Commit the state-model refactor**

```bash
git add apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx apps/web/src/features/knowledge-library/index.ts
git commit -m "feat: restructure ledger page around table and form surfaces"
```

### Task 3: Implement the spreadsheet-style toolbar and grid

**Files:**
- Create: `apps/web/src/features/knowledge-library/knowledge-library-ledger-toolbar.tsx`
- Create: `apps/web/src/features/knowledge-library/knowledge-library-ledger-grid.tsx`
- Modify: `apps/web/src/features/knowledge-library/index.ts`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx`

- [ ] **Step 1: Write the minimal toolbar component for add/delete/search and density controls**

```tsx
export function KnowledgeLibraryLedgerToolbar(props: Props) {
  return (
    <header className="knowledge-library-ledger-toolbar">
      <div className="knowledge-library-ledger-toolbar__actions">
        <button type="button" onClick={props.onAdd}>添加</button>
        <button type="button" onClick={props.onDelete} disabled={!props.hasSelection}>删除</button>
        <button type="button" onClick={props.onSearch}>查找</button>
      </div>
      <div className="knowledge-library-ledger-toolbar__view">
        <button type="button" aria-pressed={props.density === "compact"}>紧凑</button>
        <button type="button" aria-pressed={props.density === "standard"}>标准</button>
        <button type="button" aria-pressed={props.density === "relaxed"}>宽松</button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Write the grid component with prioritized left columns and overflow semantic columns**

```tsx
const PRIMARY_COLUMNS = ["title", "answer", "category", "detail", "attachments", "semanticStatus", "contributor", "date"];
const SEMANTIC_COLUMNS = ["semanticSummary", "retrievalTerms", "aliases", "scenarios", "riskTags"];

<div className="knowledge-library-ledger-grid" role="region" aria-label="多维知识台账">
  <div className="knowledge-library-ledger-grid__scroll">
    <table>
      <thead>...</thead>
      <tbody>...</tbody>
    </table>
  </div>
</div>
```

- [ ] **Step 3: Add client-side column resize handles and row density classes**

```tsx
<button
  type="button"
  className="knowledge-library-ledger-grid__resize-handle"
  aria-label={`调整${column.label}列宽`}
  onPointerDown={(event) => props.onColumnResizeStart(column.key, event.clientX)}
/>;
```

- [ ] **Step 4: Wire row selection and edit-open behavior**

```tsx
<tr
  data-selected={isSelected}
  onDoubleClick={() => props.onEdit(item.id)}
>
```

- [ ] **Step 5: Run the targeted tests for the new grid**

Run: `pnpm --dir apps/web exec node --import tsx --test test/knowledge-library-ledger-page.spec.tsx test/workbench-host.spec.tsx`
Expected: PASS for toolbar/grid/search/form structure assertions.

- [ ] **Step 6: Commit the new toolbar and grid**

```bash
git add apps/web/src/features/knowledge-library/knowledge-library-ledger-toolbar.tsx apps/web/src/features/knowledge-library/knowledge-library-ledger-grid.tsx apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx apps/web/src/features/knowledge-library/index.ts
git commit -m "feat: add spreadsheet-style knowledge ledger grid"
```

### Task 4: Implement the reusable add/edit form with mandatory AI semantic confirmation

**Files:**
- Create: `apps/web/src/features/knowledge-library/knowledge-library-entry-form.tsx`
- Create: `apps/web/src/features/knowledge-library/knowledge-library-semantic-section.tsx`
- Create: `apps/web/src/features/knowledge-library/knowledge-library-attachment-field.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx`
- Modify: `apps/web/src/features/knowledge-library/index.ts`

- [ ] **Step 1: Render a temporary same-page form surface instead of a persistent drawer**

```tsx
<section className="knowledge-library-entry-form" aria-label="知识录入表单">
  <header>...</header>
  <form onSubmit={preventDefault}>...</form>
</section>
```

- [ ] **Step 2: Map base text fields from the composer into simple data-entry controls**

```tsx
<textarea
  aria-label="答案"
  value={composer.draft.canonicalText}
  onChange={(event) => updateComposer("canonicalText", event.target.value)}
/>;
```

- [ ] **Step 3: Add attachment upload with symmetric add/remove controls**

```tsx
{attachments.map((attachment, index) => (
  <li key={attachment.upload_id ?? index}>
    <span>{attachment.file_name}</span>
    <button type="button" onClick={() => onRemoveAttachment(index)}>删除</button>
  </li>
))}
```

- [ ] **Step 4: Gate final save behind AI semantic generation and explicit confirmation**

```tsx
const canConfirmEntry =
  composer.draft.title.trim().length > 0 &&
  composer.draft.canonicalText.trim().length > 0 &&
  composer.semanticLayerDraft?.status === "confirmed";

<button type="button" disabled={!canConfirmEntry} onClick={props.onConfirmEntry}>
  确认录入
</button>
```

- [ ] **Step 5: Reuse the same form for edit mode**

Run: no command; ensure `entryFormMode === "edit"` hydrates from the selected revision/composer and preserves cancel behavior.

- [ ] **Step 6: Run the ledger tests to verify add/edit and semantic gating**

Run: `pnpm --dir apps/web exec node --import tsx --test test/knowledge-library-ledger-page.spec.tsx`
Expected: PASS for reusable form, AI semantic controls, add/remove attachment affordances, and save gating.

- [ ] **Step 7: Commit the entry form**

```bash
git add apps/web/src/features/knowledge-library/knowledge-library-entry-form.tsx apps/web/src/features/knowledge-library/knowledge-library-semantic-section.tsx apps/web/src/features/knowledge-library/knowledge-library-attachment-field.tsx apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx apps/web/src/features/knowledge-library/index.ts
git commit -m "feat: add reusable knowledge entry form with semantic confirmation"
```

### Task 5: Add the dedicated search results surface

**Files:**
- Create: `apps/web/src/features/knowledge-library/knowledge-library-ledger-search-page.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx`
- Modify: `apps/web/src/features/knowledge-library/index.ts`

- [ ] **Step 1: Render a dedicated search page component under the ledger route**

```tsx
export function KnowledgeLibraryLedgerSearchPage({ query, items, onBack }: Props) {
  return (
    <section className="knowledge-library-ledger-search" aria-label="知识查找结果">
      <header>...</header>
      <KnowledgeLibraryLedgerGrid items={items} ... />
    </section>
  );
}
```

- [ ] **Step 2: Search across base text and semantic text**

```ts
const searchResults = viewModel.visibleLibrary.filter((item) =>
  [item.title, item.summary, semanticLookup[item.id]?.pageSummary, semanticLookup[item.id]?.retrievalTerms?.join(" ")]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(searchQuery.toLowerCase()),
);
```

- [ ] **Step 3: Show explicit empty state when no hits are found**

```tsx
{items.length === 0 ? <p className="knowledge-library-empty">未找到匹配内容。</p> : ...}
```

- [ ] **Step 4: Run the targeted tests including search mode**

Run: `pnpm --dir apps/web exec node --import tsx --test test/knowledge-library-ledger-page.spec.tsx test/workbench-host.spec.tsx`
Expected: PASS for dedicated search surface assertions.

- [ ] **Step 5: Commit the search surface**

```bash
git add apps/web/src/features/knowledge-library/knowledge-library-ledger-search-page.tsx apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx apps/web/src/features/knowledge-library/index.ts
git commit -m "feat: add dedicated knowledge ledger search surface"
```

### Task 6: Replace the old workspace-heavy styling with spreadsheet-focused styling

**Files:**
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-page.css`
- Modify: `apps/web/src/app/app.css`

- [ ] **Step 1: Remove record drawer/workspace layout rules that no longer apply**

```css
.knowledge-library-record-drawer,
.knowledge-library-ledger-workspace-panel,
.knowledge-library-ledger-tabs {
  display: none;
}
```

- [ ] **Step 2: Add dense spreadsheet-like layout, sticky columns, scroll containers, and resize affordances**

```css
.knowledge-library-ledger-grid__scroll {
  overflow: auto;
}

.knowledge-library-ledger-grid th[data-pinned="true"],
.knowledge-library-ledger-grid td[data-pinned="true"] {
  position: sticky;
  left: var(--sticky-offset);
}
```

- [ ] **Step 3: Style the temporary form panel and search surface as utility-first work surfaces, not side drawers**

```css
.knowledge-library-entry-form {
  position: sticky;
  bottom: 1rem;
  max-height: calc(100vh - 7rem);
}
```

- [ ] **Step 4: Keep the immersive host chrome-free**

Run: no command; verify `app-shell--immersive` and `workbench-immersive-surface` continue to let the ledger fill the viewport without restoring the outer header/nav.

- [ ] **Step 5: Commit the styling pass**

```bash
git add apps/web/src/features/knowledge-library/knowledge-library-ledger-page.css apps/web/src/app/app.css
git commit -m "style: restyle knowledge ledger as multidimensional table"
```

### Task 7: Full verification and regression check

**Files:**
- Verify only: `apps/web/test/knowledge-library-ledger-page.spec.tsx`
- Verify only: `apps/web/test/workbench-host.spec.tsx`
- Verify only: `apps/web/src/features/knowledge-library/**`
- Verify only: `apps/web/src/app/workbench-host.tsx`

- [ ] **Step 1: Run the targeted ledger tests**

Run: `pnpm --dir apps/web exec node --import tsx --test test/knowledge-library-ledger-page.spec.tsx test/workbench-host.spec.tsx`
Expected: PASS

- [ ] **Step 2: Run web typecheck**

Run: `pnpm --dir apps/web run typecheck`
Expected: PASS with exit code 0

- [ ] **Step 3: Run production build**

Run: `pnpm --dir apps/web run build`
Expected: PASS with Vite production build output

- [ ] **Step 4: Manually inspect the immersive ledger route in-browser**

Run: open `http://127.0.0.1:4173/#knowledge-library?knowledgeView=ledger`
Expected: Spreadsheet-style table, no outer shell sidebar/header, add form opens on-page, search opens dedicated results surface.

- [ ] **Step 5: Capture a fresh screenshot for visual review**

Run: capture a screenshot after manual inspection
Expected: image saved under `output/` showing the redesigned ledger

- [ ] **Step 6: Commit the verified redesign**

```bash
git add apps/web/src/app/app.css apps/web/src/app/workbench-host.tsx apps/web/src/features/knowledge-library apps/web/test/knowledge-library-ledger-page.spec.tsx apps/web/test/workbench-host.spec.tsx docs/superpowers/specs/2026-04-13-knowledge-library-multidimensional-ledger-redesign-design.md docs/superpowers/plans/2026-04-13-knowledge-library-multidimensional-ledger-redesign.md
git commit -m "feat: redesign knowledge library ledger as multidimensional table"
```
