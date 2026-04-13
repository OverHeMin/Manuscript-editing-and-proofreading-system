# Workbench Shell And Governance Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the approved redesign across the shell, knowledge library, rule center, Harness, and the three manuscript workbenches so the product becomes compact, table-first, AI-assisted, and operationally usable.

**Architecture:** Treat this as one routed shell refresh plus four governed slices: knowledge entry, rule-center authoring, Harness activation, and manuscript execution. Keep the global left navigation, remove page-internal hero blocks, reuse the existing persistent backend domains (`templates`, `editorial-rules`, `manuscript-quality-packages`, `manuscripts`, `harness-control-plane`), and let upload-time manuscript classification feed the existing runtime-resolution chain instead of inventing a parallel orchestration path.

**Tech Stack:** React 18, TypeScript, Vite, Node test runner with `tsx`, Playwright/browser smoke, API modules in `apps/api/src/modules`, shared contracts in `packages/contracts`.

---

## File Map

### Shared Shell And Routing

- Modify: `apps/web/src/app/workbench-routing.ts`
  Rename rule-center subviews to the approved information architecture and keep the knowledge round-trip route explicit.
- Modify: `apps/web/src/app/workbench-host.tsx`
  Remove the knowledge immersive shortcut so the global left navigation stays visible on the ledger subpage; default rule center to the compact home page.
- Modify: `apps/web/src/app/workbench-navigation.ts`
  Keep only real entry points in the global shell and avoid duplicated in-page navigation for domains already represented in the left rail.
- Modify: `apps/web/test/workbench-host.spec.tsx`
  Lock the route contract and no-immersive-shell behavior.

### Knowledge Library Alignment

- Modify: `apps/web/src/features/knowledge-library/knowledge-library-workbench-page.tsx`
  Keep the main page as the entry surface with only compact summary blocks and the explicit ledger-entry action.
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx`
  Preserve spreadsheet density, keep the back-to-main action, and remove any shell-breaking layout.
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-toolbar.tsx`
  Keep the toolbar minimal: `Add`, `Delete`, `Search`.
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-search-page.tsx`
  Ensure search opens a dedicated results surface instead of collapsing table density.
- Modify: `apps/web/test/knowledge-library-workbench-page.spec.tsx`
- Modify: `apps/web/test/knowledge-library-ledger-page.spec.tsx`

### Rule Center 2.0 Web Surfaces

- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
  Reduce it to route dispatch and remove the legacy all-in-one authoring shell from the default path.
- Modify: `apps/web/src/features/template-governance/template-governance-controller.ts`
  Add home, large-template, journal-template, general-package, medical-package, and extraction ledger loaders and mutations.
- Modify: `apps/web/src/features/template-governance/template-governance-navigation.ts`
  Reflect the approved six-page family.
- Modify: `apps/web/src/features/template-governance/template-governance-overview-page.tsx`
  Keep only compact overview metrics and subpage entry points.
- Modify: `apps/web/src/features/template-governance/template-governance-template-ledger-page.tsx`
  Repurpose it as the `large template ledger` for manuscript-family governance.
- Create: `apps/web/src/features/template-governance/template-governance-journal-template-ledger-page.tsx`
  Dedicated ledger for journal and scenario template specialization.
- Modify: `apps/web/src/features/template-governance/template-governance-content-module-ledger-page.tsx`
  Repurpose it into the shared package-ledger surface backed by manuscript quality packages rather than generic content-module rows.
- Modify: `apps/web/src/features/template-governance/template-governance-template-form.tsx`
  Use it for large-template add/edit, including semantic review before save.
- Create: `apps/web/src/features/template-governance/template-governance-journal-template-form.tsx`
  Same-page add/edit form for journal templates.
- Modify: `apps/web/src/features/template-governance/template-governance-content-module-form.tsx`
  Replace developer-style fields with operator-friendly package metadata, applicability, and AI semantic sections.
- Create: `apps/web/src/features/template-governance/template-governance-package-manifest-editor.tsx`
  Human-friendly editors for aliases, units, thresholds, toggles, examples, and false-positive guards.
- Create: `apps/web/src/features/template-governance/template-governance-semantic-review-form.tsx`
  Shared semantic-generation and confirmation block used by template, package, and extraction forms.
- Modify: `apps/web/src/features/template-governance/template-governance-extraction-ledger-page.tsx`
  Keep original/edited extraction as the candidate intake boundary into templates and packages.
- Modify: `apps/web/src/features/template-governance/template-governance-ledger-toolbar.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-ledger-search-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-display.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench.css`
- Modify: `apps/web/src/features/template-governance/index.ts`
- Modify: `apps/web/test/template-governance-overview-page.spec.tsx`
- Modify: `apps/web/test/template-governance-template-ledger-page.spec.tsx`
- Create: `apps/web/test/template-governance-journal-template-ledger-page.spec.tsx`
- Modify: `apps/web/test/template-governance-content-module-ledger-page.spec.tsx`
- Modify: `apps/web/test/template-governance-extraction-ledger-page.spec.tsx`
- Modify: `apps/web/test/template-governance-workbench-page.spec.tsx`

### Rule Center Backend And Package Governance

- Modify: `apps/web/src/features/templates/template-api.ts`
- Modify: `apps/web/src/features/templates/types.ts`
  Expose the data needed for large-template and journal-template ledgers.
- Modify: `apps/web/src/features/editorial-rules/editorial-rules-api.ts`
- Modify: `apps/web/src/features/editorial-rules/types.ts`
  Keep extraction-task confirmation and intake actions compatible with the new ledgers.
- Modify: `apps/web/src/features/manuscript-quality-packages/manuscript-quality-packages-api.ts`
- Modify: `apps/web/src/features/manuscript-quality-packages/types.ts`
  Add draft update, provenance summary, downstream usage, and Harness evidence fields for package ledgers.
- Modify: `apps/api/src/modules/templates/template-api.ts`
- Modify: `apps/api/src/modules/templates/template-governance-service.ts`
- Modify: `apps/api/src/modules/templates/template-repository.ts`
- Modify: `apps/api/src/modules/templates/template-record.ts`
  Add the metadata needed by the large/journal template ledgers without breaking existing runtime resolution.
- Modify: `apps/api/src/modules/manuscript-quality-packages/manuscript-quality-package-api.ts`
- Modify: `apps/api/src/modules/manuscript-quality-packages/manuscript-quality-package-service.ts`
- Modify: `apps/api/src/modules/manuscript-quality-packages/manuscript-quality-package-record.ts`
  Add update-draft support plus provenance and downstream-usage read-model fields.
- Modify: `apps/api/src/modules/manuscript-quality-packages/general-style-package-schema.ts`
- Modify: `apps/api/src/modules/manuscript-quality-packages/medical-analyzer-package-schema.ts`
  Keep validation code repo-owned while exposing manifest fields cleanly to the browser editor.
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-api.ts`
- Modify: `apps/api/src/modules/editorial-rules/extraction-task-service.ts`
  Allow extraction confirmation to target large-template drafts, journal-template drafts, and package drafts.
- Modify: `apps/api/src/modules/runtime-bindings/runtime-binding-service.ts`
  Surface downstream package usage metadata needed by the rule-center detail views.
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Modify: `apps/api/test/templates/template-governance.spec.ts`
- Modify: `apps/api/test/manuscript-quality-packages/manuscript-quality-package-service.spec.ts`
- Modify: `apps/api/test/manuscript-quality-packages/postgres-manuscript-quality-package-persistence.spec.ts`
- Modify: `apps/api/test/database/schema.spec.ts`

### Harness And Admin Consolidation

- Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`
  Replace oversized overview chrome with compact controls and real environment editing.
- Create: `apps/web/src/features/evaluation-workbench/evaluation-workbench-environment-panel.tsx`
  In-page control surface for execution profile, runtime binding, routing version, retrieval preset, and manual review policy.
- Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench-controller.ts`
  Load active environment, candidate previews, rollback state, and downstream package usage.
- Modify: `apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx`
  Remove duplicated Harness and package-editing content from the admin overview.
- Modify: `apps/web/src/features/admin-governance/harness-environment-editor.tsx`
  Reuse its logic inside Harness or retire it once the new Harness panel lands.
- Modify: `apps/web/src/features/admin-governance/general-style-package-editor.tsx`
- Modify: `apps/web/src/features/admin-governance/medical-analyzer-package-editor.tsx`
  Extract shared manifest-editing widgets into rule-center-owned components.
- Modify: `apps/web/test/evaluation-workbench-page.spec.tsx`
- Modify: `apps/api/src/modules/harness-control-plane/harness-control-plane-api.ts`
- Modify: `apps/api/src/modules/harness-control-plane/harness-control-plane-service.ts`
- Modify: `apps/api/test/harness-control-plane/harness-control-plane-service.spec.ts`

### Manuscript Workbench Family And Upload

- Modify: `packages/contracts/src/manuscript.ts`
  Add shared upload-limit and type-detection contract fields so frontend and backend enforce the same rules.
- Modify: `packages/contracts/src/index.ts`
  Re-export the new constants and detection types.
- Modify: `apps/web/src/features/manuscripts/types.ts`
- Modify: `apps/web/src/features/manuscripts/manuscript-api.ts`
  Make manual manuscript type optional for normal upload and carry AI-detection feedback back to the UI.
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
  Remove page-internal hero blocks and switch the three operator desks to one shared posture.
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx`
  Keep upload/add/search/batch actions in the compact action row.
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-queue-pane.tsx`
  Keep the left rail narrow and independently scrollable.
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-batch-drawer.tsx`
  Replace the permanent drawer posture with inline or modal low-frequency controls.
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench.css`
  Add internal scroll regions and shared layout styles across screening, editing, and proofreading.
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts`
  Reflect optional type input, AI detection summaries, and batch-limit validation messages.
- Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Modify: `apps/web/test/manuscript-workbench-controls.spec.tsx`
- Modify: `apps/api/src/modules/manuscripts/manuscript-lifecycle-service.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-api.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-record.ts`
  Persist detection summary and optional operator override metadata.
- Create: `apps/api/src/modules/manuscripts/manuscript-type-recognition-service.ts`
  Extract signals from upload content and resolve the manuscript family before runtime selection.
- Modify: `apps/api/src/modules/execution-resolution/execution-resolution-service.ts`
  Add an operator-facing resolution summary helper so the workbench can show the auto-bound governance bundle.
- Modify: `apps/api/test/manuscripts/manuscript-lifecycle.spec.ts`
- Modify: `apps/api/test/http/manuscript-upload-storage.spec.ts`

### Knowledge Review And Quality Linkage

- Create: `apps/api/src/modules/knowledge/knowledge-governance-handoff-service.ts`
  Build lightweight prefill suggestions from approved knowledge into package/template drafts and from quality findings back into knowledge candidates.
- Modify: `apps/api/src/modules/knowledge/knowledge-api.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-record.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-service.ts`
  Add provenance fields for package links, recent quality hits, and generated draft suggestions.
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-workbench-page.tsx`
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-detail-pane.tsx`
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-action-panel.tsx`
  Add direct package-draft and template-draft handoff actions.
- Modify: `apps/web/src/features/template-governance/template-governance-content-module-ledger-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-template-ledger-page.tsx`
  Show linked knowledge, recent quality hits, and provenance summaries on selected rows.
- Modify: `apps/web/test/knowledge-review-workbench-page.spec.tsx`
- Create: `apps/api/test/knowledge/knowledge-governance-handoff.spec.ts`

### Specs And References

- Reference: `docs/superpowers/specs/2026-04-13-workbench-shell-and-governance-redesign-design.md`
- Reference: `docs/superpowers/plans/2026-04-13-knowledge-library-multidimensional-ledger-redesign.md`
- Reference: `docs/superpowers/plans/2026-04-13-rule-center-ledger-governance-redesign.md`

### Scope Guard

- Keep the global left navigation in place for every page, including the knowledge ledger.
- Only the knowledge-library family gets an explicit main-page and subpage round-trip action.
- Do not expose raw parser code in the browser; expose manifest-backed parameters, thresholds, aliases, units, examples, and semantic summaries instead.
- Use the existing governed resolution chain; do not create a second runtime-binding path for uploads.
- Batch upload must share one source of truth for the limit (`10`) across web, API, and tests.

## Task 1: Lock The Routed Shell Contract And Remove Immersive Exceptions

**Files:**
- Modify: `apps/web/src/app/workbench-routing.ts`
- Modify: `apps/web/src/app/workbench-host.tsx`
- Modify: `apps/web/src/app/workbench-navigation.ts`
- Modify: `apps/web/test/workbench-host.spec.tsx`
- Reference: `docs/superpowers/specs/2026-04-13-workbench-shell-and-governance-redesign-design.md`

- [ ] **Step 1: Write failing route and host tests for the approved subpage contract**

```tsx
test("knowledge ledger keeps the shared shell instead of immersive mode", async () => {
  const markup = await renderWorkbenchHostAtHash(
    "#knowledge-library?knowledgeView=ledger",
  );

  assert.match(markup, /workbench-nav/);
  assert.doesNotMatch(markup, /app-shell--immersive/);
});

test("rule center route parses the approved subpages", () => {
  const route = resolveWorkbenchLocation(
    "#template-governance?templateGovernanceView=journal-template-ledger",
  );

  assert.equal(route.templateGovernanceView, "journal-template-ledger");
});
```

- [ ] **Step 2: Run the targeted host tests to verify the current shell fails**

Run: `pnpm --dir apps/web exec node --import tsx --test test/workbench-host.spec.tsx`
Expected: FAIL because the knowledge ledger still renders through the immersive shortcut and the new rule-center view name is not recognized.

- [ ] **Step 3: Update the route enums and hash formatting to the final view names**

```ts
export type TemplateGovernanceView =
  | "overview"
  | "large-template-ledger"
  | "journal-template-ledger"
  | "general-package-ledger"
  | "medical-package-ledger"
  | "extraction-ledger";
```

- [ ] **Step 4: Remove the knowledge immersive-shell branch and keep host rendering consistent**

```tsx
const isImmersiveSurface = false;

return (
  <main className="app-shell">
    <section className="workbench-host">{/* ... */}</section>
  </main>
);
```

- [ ] **Step 5: Re-run the targeted host tests to verify the routed shell contract passes**

Run: `pnpm --dir apps/web exec node --import tsx --test test/workbench-host.spec.tsx`
Expected: PASS with shared-shell rendering and the new rule-center subpage parsing.

- [ ] **Step 6: Commit the routed-shell baseline**

```bash
git add apps/web/src/app/workbench-routing.ts apps/web/src/app/workbench-host.tsx apps/web/src/app/workbench-navigation.ts apps/web/test/workbench-host.spec.tsx
git commit -m "feat: align workbench shell routing with approved subpages"
```

## Task 2: Reconfirm Knowledge Library Entry And Ledger Behavior

**Files:**
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-workbench-page.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-toolbar.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-search-page.tsx`
- Modify: `apps/web/test/knowledge-library-workbench-page.spec.tsx`
- Modify: `apps/web/test/knowledge-library-ledger-page.spec.tsx`

- [ ] **Step 1: Add failing render tests for the compact main page and explicit round-trip actions**

```tsx
test("knowledge library main page exposes a single ledger-entry action", () => {
  const markup = renderToStaticMarkup(<KnowledgeLibraryWorkbenchPage actorRole="admin" />);

  assert.match(markup, /进入多维台账/);
  assert.doesNotMatch(markup, /大型介绍|hero/i);
});

test("knowledge ledger keeps only add delete search and a return-to-main action", () => {
  const markup = renderToStaticMarkup(<KnowledgeLibraryLedgerPage actorRole="admin" />);

  assert.match(markup, /新增/);
  assert.match(markup, /删除/);
  assert.match(markup, /查找/);
  assert.match(markup, /返回知识库主页/);
});
```

- [ ] **Step 2: Run the targeted knowledge-library tests and confirm any regression**

Run: `pnpm --dir apps/web exec node --import tsx --test test/knowledge-library-workbench-page.spec.tsx test/knowledge-library-ledger-page.spec.tsx`
Expected: FAIL if the current entry page or toolbar no longer matches the approved compact contract.

- [ ] **Step 3: Keep the main page lightweight and route all dense entry/edit work to the ledger**

```tsx
<button type="button" onClick={() => navigate("ledger")}>
  进入多维台账
</button>
```

- [ ] **Step 4: Keep the ledger toolbar intentionally minimal and preserve the search-results surface**

```tsx
const actions = ["add", "delete", "search"] as const;
```

- [ ] **Step 5: Re-run the targeted knowledge-library tests**

Run: `pnpm --dir apps/web exec node --import tsx --test test/knowledge-library-workbench-page.spec.tsx test/knowledge-library-ledger-page.spec.tsx`
Expected: PASS with the main/subpage contract intact.

- [ ] **Step 6: Commit the knowledge-library alignment**

```bash
git add apps/web/src/features/knowledge-library/knowledge-library-workbench-page.tsx apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx apps/web/src/features/knowledge-library/knowledge-library-ledger-toolbar.tsx apps/web/src/features/knowledge-library/knowledge-library-ledger-search-page.tsx apps/web/test/knowledge-library-workbench-page.spec.tsx apps/web/test/knowledge-library-ledger-page.spec.tsx
git commit -m "feat: preserve compact knowledge library main and ledger flow"
```

## Task 3: Land Rule Center 2.0 Home Plus Large And Journal Template Ledgers

**Files:**
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-controller.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-navigation.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-overview-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-template-ledger-page.tsx`
- Create: `apps/web/src/features/template-governance/template-governance-journal-template-ledger-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-template-form.tsx`
- Create: `apps/web/src/features/template-governance/template-governance-journal-template-form.tsx`
- Modify: `apps/web/src/features/templates/template-api.ts`
- Modify: `apps/web/src/features/templates/types.ts`
- Modify: `apps/api/src/modules/templates/template-api.ts`
- Modify: `apps/api/src/modules/templates/template-governance-service.ts`
- Modify: `apps/api/test/templates/template-governance.spec.ts`
- Modify: `apps/web/test/template-governance-overview-page.spec.tsx`
- Modify: `apps/web/test/template-governance-template-ledger-page.spec.tsx`
- Create: `apps/web/test/template-governance-journal-template-ledger-page.spec.tsx`

- [ ] **Step 1: Write failing UI tests for the compact home page and the two template ledgers**

```tsx
test("rule center overview renders compact entries only", () => {
  const markup = renderToStaticMarkup(<TemplateGovernanceOverviewPage overview={fixture} />);

  assert.match(markup, /大模板台账/);
  assert.match(markup, /期刊模板台账/);
  assert.match(markup, /原稿\/编辑稿提取/);
  assert.doesNotMatch(markup, /大型介绍|hero/i);
});

test("large template ledger renders manuscript-family rows", () => {
  const markup = renderToStaticMarkup(<TemplateGovernanceTemplateLedgerPage viewModel={fixture} />);

  assert.match(markup, /稿件族/);
  assert.match(markup, /适用模块/);
  assert.match(markup, /通用包/);
  assert.match(markup, /医学专用包/);
});
```

- [ ] **Step 2: Run the targeted rule-center template tests**

Run: `pnpm --dir apps/web exec node --import tsx --test test/template-governance-overview-page.spec.tsx test/template-governance-template-ledger-page.spec.tsx test/template-governance-journal-template-ledger-page.spec.tsx`
Expected: FAIL because the current rule center still defaults to the legacy authoring shell and the journal ledger does not exist.

- [ ] **Step 3: Add dedicated controller loaders for template families and journal-template profiles**

```ts
loadLargeTemplateLedger(): Promise<TemplateGovernanceLargeTemplateLedgerViewModel>;
loadJournalTemplateLedger(input?: { selectedJournalTemplateId?: string | null }): Promise<TemplateGovernanceJournalTemplateLedgerViewModel>;
```

- [ ] **Step 4: Reduce the top-level rule-center page to route dispatch and wire the new home plus ledgers**

```tsx
switch (initialView) {
  case "large-template-ledger":
    return <TemplateGovernanceTemplateLedgerPage controller={controller} />;
  case "journal-template-ledger":
    return <TemplateGovernanceJournalTemplateLedgerPage controller={controller} />;
  default:
    return <TemplateGovernanceOverviewPage overview={overview} />;
}
```

- [ ] **Step 5: Re-run the rule-center template tests and the host routing test**

Run: `pnpm --dir apps/web exec node --import tsx --test test/template-governance-overview-page.spec.tsx test/template-governance-template-ledger-page.spec.tsx test/template-governance-journal-template-ledger-page.spec.tsx test/workbench-host.spec.tsx`
Expected: PASS with the compact rule-center home and both template ledgers rendered through the shared shell.

- [ ] **Step 6: Commit the rule-center home and template ledgers**

```bash
git add apps/web/src/features/template-governance/template-governance-workbench-page.tsx apps/web/src/features/template-governance/template-governance-controller.ts apps/web/src/features/template-governance/template-governance-navigation.ts apps/web/src/features/template-governance/template-governance-overview-page.tsx apps/web/src/features/template-governance/template-governance-template-ledger-page.tsx apps/web/src/features/template-governance/template-governance-template-form.tsx apps/web/src/features/template-governance/template-governance-journal-template-ledger-page.tsx apps/web/src/features/template-governance/template-governance-journal-template-form.tsx apps/web/src/features/templates/template-api.ts apps/web/src/features/templates/types.ts apps/api/src/modules/templates/template-api.ts apps/api/src/modules/templates/template-governance-service.ts apps/api/test/templates/template-governance.spec.ts apps/web/test/template-governance-overview-page.spec.tsx apps/web/test/template-governance-template-ledger-page.spec.tsx apps/web/test/template-governance-journal-template-ledger-page.spec.tsx
git commit -m "feat: add rule center home and template ledgers"
```

## Task 4: Turn General And Medical Package Ledgers Into Real Package Governance

**Files:**
- Modify: `apps/web/src/features/template-governance/template-governance-content-module-ledger-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-content-module-form.tsx`
- Create: `apps/web/src/features/template-governance/template-governance-package-manifest-editor.tsx`
- Create: `apps/web/src/features/template-governance/template-governance-semantic-review-form.tsx`
- Modify: `apps/web/src/features/manuscript-quality-packages/manuscript-quality-packages-api.ts`
- Modify: `apps/web/src/features/manuscript-quality-packages/types.ts`
- Modify: `apps/api/src/modules/manuscript-quality-packages/manuscript-quality-package-api.ts`
- Modify: `apps/api/src/modules/manuscript-quality-packages/manuscript-quality-package-service.ts`
- Modify: `apps/api/src/modules/manuscript-quality-packages/manuscript-quality-package-record.ts`
- Modify: `apps/api/src/modules/manuscript-quality-packages/general-style-package-schema.ts`
- Modify: `apps/api/src/modules/manuscript-quality-packages/medical-analyzer-package-schema.ts`
- Modify: `apps/api/src/modules/runtime-bindings/runtime-binding-service.ts`
- Modify: `apps/web/test/template-governance-content-module-ledger-page.spec.tsx`
- Modify: `apps/api/test/manuscript-quality-packages/manuscript-quality-package-service.spec.ts`

- [ ] **Step 1: Write failing tests for human-friendly package editing and semantic confirmation**

```tsx
test("general package ledger renders manifest fields instead of raw JSON", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceContentModuleLedgerPage ledgerKind="general-package-ledger" viewModel={fixture} />,
  );

  assert.match(markup, /语气提示/);
  assert.match(markup, /章节要求/);
  assert.doesNotMatch(markup, /textarea[^>]*manifest/i);
});

test("medical package form shows aliases units thresholds and false-positive guards", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceContentModuleForm ledgerKind="medical-package-ledger" isOpen />,
  );

  assert.match(markup, /别名/);
  assert.match(markup, /单位范围/);
  assert.match(markup, /阈值/);
  assert.match(markup, /误报保护/);
});
```

- [ ] **Step 2: Add failing API tests for draft update and provenance-rich package reads**

```ts
test("quality package service updates a draft manifest and preserves validation", async () => {
  const service = createManuscriptQualityPackageServiceFixture();
  const draft = await service.createDraftVersion("admin", input);

  const updated = await service.updateDraftVersion(draft.id, "admin", {
    manifest: { ...draft.manifest, analyzer_toggles: { p_value: true } },
  });

  assert.equal(updated.status, "draft");
  assert.equal(updated.manifest.analyzer_toggles.p_value, true);
});
```

- [ ] **Step 3: Run the targeted web and API package tests**

Run: `pnpm --dir apps/web exec node --import tsx --test test/template-governance-content-module-ledger-page.spec.tsx`
Expected: FAIL because the current page is still content-module-centric.

Run: `pnpm --filter @medical/api run test manuscript-quality-packages`
Expected: FAIL because draft update and provenance summary support are not implemented yet.

- [ ] **Step 4: Add update-draft APIs and repurpose the shared ledger around manuscript quality packages**

```ts
updateDraftVersion(
  packageVersionId: string,
  actorRole: RoleKey,
  input: { packageName?: string; manifest?: Record<string, unknown> },
): Promise<ManuscriptQualityPackageRecord>;
```

- [ ] **Step 5: Build manifest editors for operator-configurable layers and keep validation in code**

```tsx
<TemplateGovernancePackageManifestEditor
  kind="medical_analyzer_package"
  indicatorDictionary={draft.indicator_dictionary}
  unitRanges={draft.unit_ranges}
  thresholds={draft.count_constraints}
  onChange={setDraft}
/>
```

- [ ] **Step 6: Re-run the package governance tests**

Run: `pnpm --dir apps/web exec node --import tsx --test test/template-governance-content-module-ledger-page.spec.tsx`
Expected: PASS with operator-friendly fields and semantic confirmation.

Run: `pnpm --filter @medical/api run test manuscript-quality-packages`
Expected: PASS with validated draft updates and package-read models.

- [ ] **Step 7: Commit the package-ledger upgrade**

```bash
git add apps/web/src/features/template-governance/template-governance-content-module-ledger-page.tsx apps/web/src/features/template-governance/template-governance-content-module-form.tsx apps/web/src/features/template-governance/template-governance-package-manifest-editor.tsx apps/web/src/features/template-governance/template-governance-semantic-review-form.tsx apps/web/src/features/manuscript-quality-packages/manuscript-quality-packages-api.ts apps/web/src/features/manuscript-quality-packages/types.ts apps/api/src/modules/manuscript-quality-packages/manuscript-quality-package-api.ts apps/api/src/modules/manuscript-quality-packages/manuscript-quality-package-service.ts apps/api/src/modules/manuscript-quality-packages/manuscript-quality-package-record.ts apps/api/src/modules/manuscript-quality-packages/general-style-package-schema.ts apps/api/src/modules/manuscript-quality-packages/medical-analyzer-package-schema.ts apps/api/src/modules/runtime-bindings/runtime-binding-service.ts apps/web/test/template-governance-content-module-ledger-page.spec.tsx apps/api/test/manuscript-quality-packages/manuscript-quality-package-service.spec.ts
git commit -m "feat: govern general and medical packages from rule center"
```

## Task 5: Keep Extraction As The AI Confirmation Boundary Into Templates And Packages

**Files:**
- Modify: `apps/web/src/features/template-governance/template-governance-extraction-ledger-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-ledger-search-page.tsx`
- Modify: `apps/web/src/features/editorial-rules/editorial-rules-api.ts`
- Modify: `apps/web/src/features/editorial-rules/types.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-api.ts`
- Modify: `apps/api/src/modules/editorial-rules/extraction-task-service.ts`
- Modify: `apps/web/test/template-governance-extraction-ledger-page.spec.tsx`

- [ ] **Step 1: Write failing tests for candidate destination choices and semantic confirmation**

```tsx
test("extraction candidate confirmation can target all approved draft destinations", () => {
  const markup = renderToStaticMarkup(<TemplateGovernanceExtractionLedgerPage viewModel={fixture} />);

  assert.match(markup, /大模板草稿/);
  assert.match(markup, /期刊模板草稿/);
  assert.match(markup, /通用包草稿/);
  assert.match(markup, /医学专用包草稿/);
});
```

- [ ] **Step 2: Run the extraction-ledger tests**

Run: `pnpm --dir apps/web exec node --import tsx --test test/template-governance-extraction-ledger-page.spec.tsx`
Expected: FAIL if the extraction destination model still reflects the older rule-center layout.

- [ ] **Step 3: Extend extraction confirmation payloads to carry the final destination types**

```ts
destination:
  | "large_template_draft"
  | "journal_template_draft"
  | "general_package_draft"
  | "medical_package_draft";
```

- [ ] **Step 4: Keep AI semantic review inside the confirmation form before any row is committed**

```tsx
<TemplateGovernanceSemanticReviewForm
  draft={semanticDraft}
  onGenerate={handleGenerateSemanticLayer}
  onConfirm={handleConfirmSemanticLayer}
/>
```

- [ ] **Step 5: Re-run the extraction-ledger tests and the package/template ledger tests that depend on intake**

Run: `pnpm --dir apps/web exec node --import tsx --test test/template-governance-extraction-ledger-page.spec.tsx test/template-governance-template-ledger-page.spec.tsx test/template-governance-content-module-ledger-page.spec.tsx`
Expected: PASS with end-to-end draft intake options visible.

- [ ] **Step 6: Commit the extraction destination upgrade**

```bash
git add apps/web/src/features/template-governance/template-governance-extraction-ledger-page.tsx apps/web/src/features/template-governance/template-governance-ledger-search-page.tsx apps/web/src/features/editorial-rules/editorial-rules-api.ts apps/web/src/features/editorial-rules/types.ts apps/api/src/modules/editorial-rules/editorial-rule-api.ts apps/api/src/modules/editorial-rules/extraction-task-service.ts apps/web/test/template-governance-extraction-ledger-page.spec.tsx
git commit -m "feat: route extraction candidates into final rule center draft targets"
```

## Task 6: Move Real Harness Controls Into Harness And Shrink Admin Overview

**Files:**
- Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`
- Create: `apps/web/src/features/evaluation-workbench/evaluation-workbench-environment-panel.tsx`
- Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench-controller.ts`
- Modify: `apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx`
- Modify: `apps/web/src/features/admin-governance/harness-environment-editor.tsx`
- Modify: `apps/api/src/modules/harness-control-plane/harness-control-plane-api.ts`
- Modify: `apps/api/src/modules/harness-control-plane/harness-control-plane-service.ts`
- Modify: `apps/web/test/evaluation-workbench-page.spec.tsx`
- Modify: `apps/api/test/harness-control-plane/harness-control-plane-service.spec.ts`

- [ ] **Step 1: Write failing tests for compact Harness layout and real environment controls**

```tsx
test("harness page renders environment controls without oversized hero chrome", () => {
  const markup = renderToStaticMarkup(<EvaluationWorkbenchPage initialOverview={fixture} />);

  assert.match(markup, /执行配置/);
  assert.match(markup, /运行时绑定/);
  assert.match(markup, /路由版本/);
  assert.match(markup, /检索预设/);
  assert.match(markup, /人工复核策略/);
  assert.doesNotMatch(markup, /evaluation-workbench-hero/);
});
```

- [ ] **Step 2: Run the Harness UI and service tests**

Run: `pnpm --dir apps/web exec node --import tsx --test test/evaluation-workbench-page.spec.tsx`
Expected: FAIL because the current Harness page still spends too much space on summary chrome.

Run: `pnpm --filter @medical/api run test harness-control-plane`
Expected: FAIL if preview and activation payloads do not expose the new panel needs.

- [ ] **Step 3: Move environment preview and activation controls into a dedicated Harness panel**

```tsx
<EvaluationWorkbenchEnvironmentPanel
  activeEnvironment={overview.activeEnvironment}
  candidateSelection={selection}
  onPreview={handlePreview}
  onActivate={handleActivate}
/>
```

- [ ] **Step 4: Trim admin overview down to truly cross-cutting signals**

```tsx
{showCrossCuttingOnly ? <AdminGovernanceWorkbenchPage /> : null}
```

- [ ] **Step 5: Re-run the Harness UI and service tests**

Run: `pnpm --dir apps/web exec node --import tsx --test test/evaluation-workbench-page.spec.tsx`
Expected: PASS with real controls in Harness and lighter chrome.

Run: `pnpm --filter @medical/api run test harness-control-plane`
Expected: PASS with preview, activation, and rollback still intact.

- [ ] **Step 6: Commit the Harness consolidation**

```bash
git add apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx apps/web/src/features/evaluation-workbench/evaluation-workbench-environment-panel.tsx apps/web/src/features/evaluation-workbench/evaluation-workbench-controller.ts apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx apps/web/src/features/admin-governance/harness-environment-editor.tsx apps/api/src/modules/harness-control-plane/harness-control-plane-api.ts apps/api/src/modules/harness-control-plane/harness-control-plane-service.ts apps/web/test/evaluation-workbench-page.spec.tsx apps/api/test/harness-control-plane/harness-control-plane-service.spec.ts
git commit -m "feat: move governed environment controls into harness"
```

## Task 7: Rebuild Screening Editing And Proofreading Around One Shared Desk Layout

**Files:**
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-queue-pane.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-batch-drawer.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench.css`
- Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Modify: `apps/web/test/manuscript-workbench-controls.spec.tsx`

- [ ] **Step 1: Write failing tests for the shared desk posture and the removal of page-level hero panels**

```tsx
test("screening editing and proofreading share the same main desk layout", () => {
  for (const mode of ["screening", "editing", "proofreading"] as const) {
    const markup = renderToStaticMarkup(<ManuscriptWorkbenchPage mode={mode} />);

    assert.match(markup, /manuscript-workbench-mainline-layout/);
    assert.match(markup, /queue-pane/);
    assert.match(markup, /focus-panel/);
    assert.doesNotMatch(markup, /manuscript-workbench-hero/);
  }
});
```

- [ ] **Step 2: Run the targeted manuscript-workbench tests**

Run: `pnpm --dir apps/web exec node --import tsx --test test/manuscript-workbench-page.spec.tsx test/manuscript-workbench-controls.spec.tsx`
Expected: FAIL because the current screens still render large hero sections and a heavy right-side posture.

- [ ] **Step 3: Keep only a compact action row, narrow queue rail, central canvas, and low-frequency overlays**

```tsx
<section className="manuscript-workbench-action-row">{/* upload, search, batch */}</section>
<aside className="manuscript-workbench-queue-pane" />
<section className="manuscript-workbench-focus-panel" />
```

- [ ] **Step 4: Add independent scroll regions instead of endlessly tall pages**

```css
.manuscript-workbench-queue-pane,
.manuscript-workbench-focus-panel,
.manuscript-workbench-aux-overlay {
  overflow: auto;
}
```

- [ ] **Step 5: Re-run the targeted manuscript-workbench tests**

Run: `pnpm --dir apps/web exec node --import tsx --test test/manuscript-workbench-page.spec.tsx test/manuscript-workbench-controls.spec.tsx`
Expected: PASS with one shared operator layout family.

- [ ] **Step 6: Commit the shared workbench layout**

```bash
git add apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-queue-pane.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-batch-drawer.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench.css apps/web/test/manuscript-workbench-page.spec.tsx apps/web/test/manuscript-workbench-controls.spec.tsx
git commit -m "feat: unify manuscript workbenches into one desk layout"
```

## Task 8: Add Upload-Time AI Manuscript Recognition Auto-Binding And The 10-Item Batch Guardrail

**Files:**
- Modify: `packages/contracts/src/manuscript.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/web/src/features/manuscripts/types.ts`
- Modify: `apps/web/src/features/manuscripts/manuscript-api.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Create: `apps/api/src/modules/manuscripts/manuscript-type-recognition-service.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-lifecycle-service.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-api.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-record.ts`
- Modify: `apps/api/src/modules/execution-resolution/execution-resolution-service.ts`
- Modify: `apps/api/test/manuscripts/manuscript-lifecycle.spec.ts`
- Modify: `apps/api/test/http/manuscript-upload-storage.spec.ts`

- [ ] **Step 1: Write failing tests for optional manual type input and the batch limit**

```ts
test("upload batch rejects more than 10 manuscripts", async () => {
  const service = createManuscriptLifecycleFixture();

  await assert.rejects(
    () =>
      service.uploadBatch({
        createdBy: "web",
        items: Array.from({ length: 11 }, (_, index) => buildUploadItem(index)),
      }),
    /cannot exceed 10/i,
  );
});

test("upload detects manuscript type when operator does not provide one", async () => {
  const service = createManuscriptLifecycleFixture({ recognizer: fakeRecognizer("meta_analysis") });
  const result = await service.upload(buildUploadInput({ manuscriptType: undefined }));

  assert.equal(result.manuscript.manuscript_type, "meta_analysis");
});
```

- [ ] **Step 2: Run the targeted manuscript API tests**

Run: `pnpm --filter @medical/api run test manuscripts http`
Expected: FAIL because upload still requires `manuscriptType` and batch uploads do not enforce the hard limit.

- [ ] **Step 3: Add one shared batch-limit constant and make the web contract reflect optional manual type input**

```ts
export const MAX_MANUSCRIPT_BATCH_UPLOAD_COUNT = 10;

export interface ManuscriptTypeDetectionSummary {
  detected_type: ManuscriptType;
  confidence: number;
  source: "ai" | "heuristic";
}
```

- [ ] **Step 4: Create upload-time recognition that resolves the manuscript type before template-family binding**

```ts
const detection = await manuscriptTypeRecognitionService.detect({
  title: input.title,
  fileName: input.fileName,
  inlineFile: input.fileContentBase64,
});

const finalManuscriptType = input.manuscriptType ?? detection.detected_type;
```

- [ ] **Step 5: Surface the resolved governance bundle back to the workbench**

```ts
const resolutionSummary = await executionResolutionService.resolveOperatorSummary({
  module: "screening",
  manuscriptType: finalManuscriptType,
  templateFamilyId,
});
```

- [ ] **Step 6: Re-run the targeted manuscript tests**

Run: `pnpm --filter @medical/api run test manuscripts http`
Expected: PASS with upload-time detection, auto-binding support, and the `10`-item guardrail enforced.

- [ ] **Step 7: Re-run the web manuscript-workbench tests**

Run: `pnpm --dir apps/web exec node --import tsx --test test/manuscript-workbench-page.spec.tsx test/manuscript-workbench-controls.spec.tsx`
Expected: PASS with no mandatory manuscript-type selector for normal upload and a visible AI detection summary.

- [ ] **Step 8: Commit the upload recognition and guardrail**

```bash
git add packages/contracts/src/manuscript.ts packages/contracts/src/index.ts apps/web/src/features/manuscripts/types.ts apps/web/src/features/manuscripts/manuscript-api.ts apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx apps/api/src/modules/manuscripts/manuscript-type-recognition-service.ts apps/api/src/modules/manuscripts/manuscript-lifecycle-service.ts apps/api/src/modules/manuscripts/manuscript-api.ts apps/api/src/modules/manuscripts/manuscript-record.ts apps/api/src/modules/execution-resolution/execution-resolution-service.ts apps/api/test/manuscripts/manuscript-lifecycle.spec.ts apps/api/test/http/manuscript-upload-storage.spec.ts
git commit -m "feat: add upload-time manuscript recognition and batch guardrails"
```

## Task 9: Add Knowledge Review To Package Feedback Loops And Run Final Verification

**Files:**
- Create: `apps/api/src/modules/knowledge/knowledge-governance-handoff-service.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-api.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-record.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-service.ts`
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-workbench-page.tsx`
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-detail-pane.tsx`
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-action-panel.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-content-module-ledger-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-template-ledger-page.tsx`
- Modify: `apps/web/test/knowledge-review-workbench-page.spec.tsx`
- Create: `apps/api/test/knowledge/knowledge-governance-handoff.spec.ts`

- [ ] **Step 1: Write failing tests for package-draft prefills from approved knowledge**

```tsx
test("knowledge review exposes send-to-package actions for approved knowledge", () => {
  const markup = renderToStaticMarkup(<KnowledgeReviewWorkbenchPage actorRole="admin" />);

  assert.match(markup, /生成通用包草稿/);
  assert.match(markup, /生成医学专用包草稿/);
});
```

- [ ] **Step 2: Write failing API tests for provenance-rich handoff suggestions**

```ts
test("knowledge handoff service derives a medical package prefill from approved knowledge", async () => {
  const service = createKnowledgeGovernanceHandoffFixture();
  const suggestion = await service.createPackageDraftPrefill({ knowledgeItemId: "knowledge-1" });

  assert.equal(suggestion.destination, "medical_package_draft");
  assert.ok(suggestion.semantic_summary.length > 0);
});
```

- [ ] **Step 3: Run the targeted knowledge-review and API tests**

Run: `pnpm --dir apps/web exec node --import tsx --test test/knowledge-review-workbench-page.spec.tsx`
Expected: FAIL because the workbench does not yet expose those handoff actions.

Run: `pnpm --filter @medical/api run test knowledge`
Expected: FAIL because the handoff service does not exist yet.

- [ ] **Step 4: Add lightweight suggestion endpoints and provenance fields instead of a new heavy workflow engine**

```ts
export interface KnowledgeGovernanceDraftPrefill {
  destination: "general_package_draft" | "medical_package_draft" | "large_template_draft";
  semantic_summary: string;
  provenance: { knowledge_item_id: string; source_quality_issue_ids?: string[] };
}
```

- [ ] **Step 5: Surface linked knowledge, recent quality hits, and Harness evidence on selected package/template rows**

```tsx
<dl>
  <div><dt>关联知识</dt><dd>{selectedRow.linkedKnowledgeCount}</dd></div>
  <div><dt>最近质检命中</dt><dd>{selectedRow.recentQualityHitCount}</dd></div>
  <div><dt>Harness 证据</dt><dd>{selectedRow.latestHarnessEvidence ?? "未记录"}</dd></div>
</dl>
```

- [ ] **Step 6: Re-run targeted knowledge-review tests and then full verification**

Run: `pnpm --dir apps/web exec node --import tsx --test test/knowledge-review-workbench-page.spec.tsx test/template-governance-overview-page.spec.tsx test/template-governance-template-ledger-page.spec.tsx test/template-governance-journal-template-ledger-page.spec.tsx test/template-governance-content-module-ledger-page.spec.tsx test/template-governance-extraction-ledger-page.spec.tsx test/template-governance-workbench-page.spec.tsx test/workbench-host.spec.tsx`
Expected: PASS

Run: `pnpm --filter @medical/api run test`
Expected: PASS

Run: `pnpm run typecheck`
Expected: PASS across web and API.

- [ ] **Step 7: Do one manual browser smoke before declaring completion**

Run: `pnpm --dir apps/web run dev`
Expected:
- knowledge library main page -> ledger round-trip works with left navigation still visible
- rule center home opens all five working subpages
- Harness page edits real environment components
- screening, editing, proofreading share one desk layout
- batch upload rejects the 11th file and shows a clear operator message

- [ ] **Step 8: Commit the linkage and final regression pass**

```bash
git add apps/api/src/modules/knowledge/knowledge-governance-handoff-service.ts apps/api/src/modules/knowledge/knowledge-api.ts apps/api/src/modules/knowledge/knowledge-record.ts apps/api/src/modules/knowledge/knowledge-service.ts apps/web/src/features/knowledge-review/knowledge-review-workbench-page.tsx apps/web/src/features/knowledge-review/knowledge-review-detail-pane.tsx apps/web/src/features/knowledge-review/knowledge-review-action-panel.tsx apps/web/src/features/template-governance/template-governance-content-module-ledger-page.tsx apps/web/src/features/template-governance/template-governance-template-ledger-page.tsx apps/web/test/knowledge-review-workbench-page.spec.tsx apps/api/test/knowledge/knowledge-governance-handoff.spec.ts
git commit -m "feat: link knowledge review with package governance feedback loops"
```
