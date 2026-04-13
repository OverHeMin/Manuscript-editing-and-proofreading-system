# Rule Center Ledger Governance Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `template-governance` into a ledger-first rule center with an overview homepage, extraction candidate hub, separate general and medical module ledgers, and a template ledger that assembles modules and initiates manuscript application.

**Architecture:** Keep `template-governance` as the top-level workbench id, but add a route-level subpage discriminator and split the current monolithic page into focused ledger surfaces. Reuse the current rule-package extraction pipeline for candidate generation, add persisted extraction-task state plus governed content-module records on the backend, and model the front end after the knowledge-library ledger pattern: toolbar, search-results state, table body, and in-page forms instead of long-lived drawers.

**Tech Stack:** React 18, TypeScript, existing workbench routing and controller patterns, Node test runner with `tsx`, API modules in `apps/api/src/modules/editorial-rules` and `apps/api/src/modules/templates`, HTTP server wiring in `apps/api/src/http/api-http-server.ts`, schema and persistence tests in `apps/api/test`.

---

## File Map

### Route And Shell

- Modify: `apps/web/src/app/workbench-routing.ts`
  Add `templateGovernanceView` parsing/formatting alongside the existing `knowledgeView` handling.
- Modify: `apps/web/src/app/workbench-host.tsx`
  Pass the new route discriminator into the rule-center workbench and keep classic-mode fallback intact.

### Web Rule-Center Surface

- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
  Shrink this file into a top-level mode switch and move ledger-specific UI into focused components.
- Create: `apps/web/src/features/template-governance/template-governance-ledger-types.ts`
  Shared route, density, search-state, and row-model types for the new ledgers.
- Create: `apps/web/src/features/template-governance/template-governance-ledger-toolbar.tsx`
  Shared toolbar shell for search, add, delete, and page-specific actions.
- Create: `apps/web/src/features/template-governance/template-governance-ledger-search-page.tsx`
  Shared search-results state container for table-first result pages.
- Create: `apps/web/src/features/template-governance/template-governance-overview-page.tsx`
  Summary metrics and subpage entry surface.
- Create: `apps/web/src/features/template-governance/template-governance-extraction-ledger-page.tsx`
  Extraction-task table plus candidate table surface.
- Create: `apps/web/src/features/template-governance/template-governance-extraction-task-form.tsx`
  Same-page add-task form with drag/drop DOCX intake.
- Create: `apps/web/src/features/template-governance/template-governance-candidate-confirmation-form.tsx`
  AI semantic review and intake destination form.
- Create: `apps/web/src/features/template-governance/template-governance-content-module-ledger-page.tsx`
  Reusable ledger page for both general and medical module lists.
- Create: `apps/web/src/features/template-governance/template-governance-content-module-form.tsx`
  Shared module form with medical-only extension fields.
- Create: `apps/web/src/features/template-governance/template-governance-template-ledger-page.tsx`
  Template table, composition state, and apply-to-manuscript entry.
- Create: `apps/web/src/features/template-governance/template-governance-template-form.tsx`
  Template metadata and module selection form.
- Modify: `apps/web/src/features/template-governance/template-governance-controller.ts`
  Add new overview/extraction/module/template ledger loading and mutation methods.
- Modify: `apps/web/src/features/template-governance/template-governance-display.ts`
  Add labels for content-module class, extraction status, intake status, and new view names.
- Modify: `apps/web/src/features/template-governance/index.ts`
  Export new page components and view types.
- Modify: `apps/web/src/features/template-governance/template-governance-workbench.css`
  Add overview cards, ledger table, search state, and form-layer styles.

### Web API Contracts

- Modify: `apps/web/src/features/templates/types.ts`
  Add content-module and template-composition view models or move them into a shared template-governance type module if that keeps boundaries cleaner.
- Modify: `apps/web/src/features/templates/template-api.ts`
  Add list/create/update routes for content modules and template compositions.
- Modify: `apps/web/src/features/editorial-rules/types.ts`
  Add extraction-task records, candidate confirmation state, and intake destination metadata.
- Modify: `apps/web/src/features/editorial-rules/editorial-rules-api.ts`
  Add extraction-task list/create/get/update endpoints.

### API Extraction Task Persistence

- Create: `apps/api/src/modules/editorial-rules/extraction-task-record.ts`
  Persisted extraction-task record and candidate confirmation state model.
- Create: `apps/api/src/modules/editorial-rules/extraction-task-repository.ts`
  Repository interface for extraction tasks and candidate state persistence.
- Create: `apps/api/src/modules/editorial-rules/in-memory-extraction-task-repository.ts`
  In-memory implementation for tests/demo runtime.
- Create: `apps/api/src/modules/editorial-rules/postgres-extraction-task-repository.ts`
  Persistent implementation.
- Create: `apps/api/src/modules/editorial-rules/extraction-task-service.ts`
  Create/list/load/retry/update extraction tasks by wrapping the existing example-pair services.
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-package-service.ts`
  Reuse candidate generation in a task-oriented way rather than only workspace-only loading.
- Modify: `apps/api/src/modules/editorial-rules/index.ts`
  Export the new extraction-task domain pieces.

### API Content Modules And Template Composition

- Modify: `apps/api/src/modules/templates/template-record.ts`
  Keep existing execution-module and template-family records, but add new persisted content-module and template-composition records.
- Modify: `apps/api/src/modules/templates/template-repository.ts`
  Add repository interfaces for content modules and template compositions.
- Modify: `apps/api/src/modules/templates/in-memory-template-family-repository.ts`
  Store and query content modules and template compositions in memory.
- Modify: `apps/api/src/modules/templates/postgres-template-repository.ts`
  Persist content modules and template compositions.
- Modify: `apps/api/src/modules/templates/template-governance-service.ts`
  Create/list/update content modules and template compositions; intake confirmed candidates into draft assets.
- Modify: `apps/api/src/modules/templates/template-api.ts`
  Expose the new routes.
- Modify: `apps/api/src/modules/templates/index.ts`
  Export new records and service contracts.

### Database And HTTP Wiring

- Modify: `apps/api/src/database/migration-ledger.ts`
  Add a migration entry for extraction tasks, content modules, and template compositions.
- Modify: `apps/api/src/http/api-http-server.ts`
  Wire repositories, services, and HTTP routes for the new ledgers.
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
  Pass the new repositories/services into the persistent runtime assembly if needed.

### Tests

- Modify: `apps/web/test/workbench-host.spec.tsx`
- Create: `apps/web/test/template-governance-ledger-routing.spec.tsx`
- Create: `apps/web/test/template-governance-overview-page.spec.tsx`
- Create: `apps/web/test/template-governance-extraction-ledger-page.spec.tsx`
- Create: `apps/web/test/template-governance-content-module-ledger-page.spec.tsx`
- Create: `apps/web/test/template-governance-template-ledger-page.spec.tsx`
- Create: `apps/api/test/editorial-rules/extraction-task-service.spec.ts`
- Create: `apps/api/test/templates/content-module-governance.spec.ts`
- Modify: `apps/api/test/database/schema.spec.ts`
- Modify: `apps/api/test/http/persistent-workbench-http.spec.ts`

### Spec References

- Reference: `docs/superpowers/specs/2026-04-13-rule-center-ledger-governance-redesign-design.md`
- Reference: `docs/superpowers/specs/2026-04-13-knowledge-library-ledger-entry-and-semantic-editing-design.md`

### Scope Guard

This plan intentionally keeps `execution modules` and `content modules` separate:

- `execution module`: existing runtime stage such as `screening`, `editing`, `proofreading`
- `content module`: new reusable governed asset shown in the two module ledgers

Do not collapse those concepts during implementation.

### Task 1: Lock Routing And Subpage Rendering With Failing Tests

**Files:**
- Modify: `apps/web/src/app/workbench-routing.ts`
- Modify: `apps/web/src/app/workbench-host.tsx`
- Modify: `apps/web/test/workbench-host.spec.tsx`
- Create: `apps/web/test/template-governance-ledger-routing.spec.tsx`
- Reference: `docs/superpowers/specs/2026-04-13-rule-center-ledger-governance-redesign-design.md`

- [ ] **Step 1: Add failing route tests for the new subpage discriminator**

```tsx
test("workbench routing parses templateGovernanceView ledgers", () => {
  const route = resolveWorkbenchLocation(
    "#template-governance?templateGovernanceView=extraction-ledger",
  );

  assert.equal(route.workbenchId, "template-governance");
  assert.equal(route.templateGovernanceView, "extraction-ledger");
});

test("formatWorkbenchHash preserves the requested rule-center subpage", () => {
  const hash = formatWorkbenchHash("template-governance", {
    templateGovernanceView: "medical-module-ledger",
  });

  assert.match(hash, /templateGovernanceView=medical-module-ledger/);
});
```

- [ ] **Step 2: Add failing host-render tests for overview and extraction views**

```tsx
test("workbench host renders rule-center overview page", async () => {
  const markup = await renderWorkbenchHostAtHash(
    "#template-governance?templateGovernanceView=overview",
  );

  assert.match(markup, /template-governance-overview-page/);
  assert.match(markup, /待确认提取候选/);
});

test("workbench host renders extraction ledger instead of classic workbench", async () => {
  const markup = await renderWorkbenchHostAtHash(
    "#template-governance?templateGovernanceView=extraction-ledger",
  );

  assert.match(markup, /template-governance-extraction-ledger-page/);
  assert.doesNotMatch(markup, /rule-package-workbench-columns/);
});
```

- [ ] **Step 3: Run the targeted web routing tests to verify they fail**

Run: `pnpm --dir apps/web exec node --import tsx --test test/workbench-host.spec.tsx test/template-governance-ledger-routing.spec.tsx`
Expected: FAIL because `templateGovernanceView` is not yet parsed or rendered.

- [ ] **Step 4: Implement the minimal routing fields to make only parsing compile**

```ts
export type TemplateGovernanceView =
  | "classic"
  | "overview"
  | "template-ledger"
  | "extraction-ledger"
  | "general-module-ledger"
  | "medical-module-ledger";
```

- [ ] **Step 5: Re-run the targeted tests to keep failures focused on page rendering**

Run: `pnpm --dir apps/web exec node --import tsx --test test/workbench-host.spec.tsx test/template-governance-ledger-routing.spec.tsx`
Expected: FAIL only on rendering assertions.

- [ ] **Step 6: Commit the red/route baseline**

```bash
git add apps/web/src/app/workbench-routing.ts apps/web/src/app/workbench-host.tsx apps/web/test/workbench-host.spec.tsx apps/web/test/template-governance-ledger-routing.spec.tsx
git commit -m "test: define rule center ledger routing behavior"
```

### Task 2: Add Persisted Extraction Tasks On The API

**Files:**
- Create: `apps/api/src/modules/editorial-rules/extraction-task-record.ts`
- Create: `apps/api/src/modules/editorial-rules/extraction-task-repository.ts`
- Create: `apps/api/src/modules/editorial-rules/in-memory-extraction-task-repository.ts`
- Create: `apps/api/src/modules/editorial-rules/postgres-extraction-task-repository.ts`
- Create: `apps/api/src/modules/editorial-rules/extraction-task-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-package-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/index.ts`
- Modify: `apps/api/test/database/schema.spec.ts`
- Create: `apps/api/test/editorial-rules/extraction-task-service.spec.ts`

- [ ] **Step 1: Write the failing service test for task creation and candidate persistence**

```ts
test("extraction task service creates a task and persists generated candidates", async () => {
  const service = createExtractionTaskServiceFixture();

  const task = await service.createTask({
    taskName: "Clinical heading extraction",
    manuscriptType: "clinical_study",
    originalFile: buildDocxPayload("original.docx"),
    editedFile: buildDocxPayload("edited.docx"),
  });

  assert.equal(task.status, "awaiting_confirmation");
  assert.ok(task.candidate_count > 0);
  assert.equal(task.candidates[0]?.confirmation_status, "ai_semantic_ready");
});
```

- [ ] **Step 2: Run the API tests for the editorial-rules scope and confirm failure**

Run: `pnpm --filter @medical/api run test editorial-rules`
Expected: FAIL because the extraction-task service and repository do not exist.

- [ ] **Step 3: Define the persisted task and candidate state records**

```ts
export interface ExtractionTaskRecord {
  id: string;
  task_name: string;
  manuscript_type: ManuscriptType;
  original_file_name: string;
  edited_file_name: string;
  status: ExtractionTaskStatus;
  candidate_count: number;
  pending_confirmation_count: number;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 4: Implement in-memory persistence and task-service orchestration**

```ts
const workspace = await rulePackageService.createWorkspaceFromExamplePair(...);
const candidates = workspace.candidates.map((candidate) => ({
  ...candidate,
  confirmation_status: "ai_semantic_ready",
}));
```

- [ ] **Step 5: Add schema expectations for the new tables**

Run: update `apps/api/test/database/schema.spec.ts` to assert the new tables and columns for extraction tasks and candidate state.

- [ ] **Step 6: Re-run the API scope tests to verify task-service and schema pass**

Run: `pnpm --filter @medical/api run test editorial-rules database`
Expected: PASS for the new extraction-task and schema expectations.

- [ ] **Step 7: Commit the extraction-task backend**

```bash
git add apps/api/src/modules/editorial-rules apps/api/test/editorial-rules/extraction-task-service.spec.ts apps/api/test/database/schema.spec.ts
git commit -m "feat: persist rule center extraction tasks"
```

### Task 3: Expose Extraction Tasks To The Web Controller

**Files:**
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/web/src/features/editorial-rules/types.ts`
- Modify: `apps/web/src/features/editorial-rules/editorial-rules-api.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-controller.ts`
- Create: `apps/web/test/template-governance-extraction-ledger-page.spec.tsx`
- Modify: `apps/web/test/template-governance-rule-package-controller.spec.ts`

- [ ] **Step 1: Add failing HTTP/controller tests for task list and candidate confirmation load**

```tsx
test("template governance controller loads extraction tasks and selected task candidates", async () => {
  const controller = createTemplateGovernanceWorkbenchController(fakeClient);

  const overview = await controller.loadExtractionLedger();

  assert.equal(overview.tasks.length, 1);
  assert.equal(overview.selectedTask?.candidates[0]?.confirmationStatus, "ai_semantic_ready");
});
```

- [ ] **Step 2: Run the targeted web tests and confirm failure**

Run: `pnpm --dir apps/web exec node --import tsx --test test/template-governance-rule-package-controller.spec.ts test/template-governance-extraction-ledger-page.spec.tsx`
Expected: FAIL because the web contracts do not include extraction-task views.

- [ ] **Step 3: Add extraction-task web view models and API methods**

```ts
export interface ExtractionTaskViewModel {
  id: string;
  task_name: string;
  status: "pending" | "extracting" | "awaiting_confirmation" | "failed";
  candidate_count: number;
  pending_confirmation_count: number;
}
```

- [ ] **Step 4: Add controller methods for list/create/select/update candidate confirmation**

```ts
loadExtractionLedger(input?: { selectedTaskId?: string }): Promise<TemplateGovernanceExtractionLedgerViewModel>;
createExtractionTaskAndReload(...): Promise<...>;
confirmCandidateAndReload(...): Promise<...>;
```

- [ ] **Step 5: Re-run the targeted tests to verify controller coverage passes**

Run: `pnpm --dir apps/web exec node --import tsx --test test/template-governance-rule-package-controller.spec.ts test/template-governance-extraction-ledger-page.spec.tsx`
Expected: PASS for extraction-task contract loading.

- [ ] **Step 6: Commit the extraction-task web contracts**

```bash
git add apps/api/src/http/api-http-server.ts apps/web/src/features/editorial-rules/types.ts apps/web/src/features/editorial-rules/editorial-rules-api.ts apps/web/src/features/template-governance/template-governance-controller.ts apps/web/test/template-governance-rule-package-controller.spec.ts apps/web/test/template-governance-extraction-ledger-page.spec.tsx
git commit -m "feat: expose extraction ledger contracts to web workbench"
```

### Task 4: Split The Rule Center Into Overview And Ledger Shells

**Files:**
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Create: `apps/web/src/features/template-governance/template-governance-ledger-types.ts`
- Create: `apps/web/src/features/template-governance/template-governance-ledger-toolbar.tsx`
- Create: `apps/web/src/features/template-governance/template-governance-ledger-search-page.tsx`
- Create: `apps/web/src/features/template-governance/template-governance-overview-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench.css`
- Modify: `apps/web/src/features/template-governance/index.ts`
- Create: `apps/web/test/template-governance-overview-page.spec.tsx`

- [ ] **Step 1: Write failing render tests for the overview page and shared toolbar shell**

```tsx
test("rule center overview renders summary cards and four subpage entry points", () => {
  const markup = renderToStaticMarkup(<TemplateGovernanceOverviewPage overview={fixture} />);

  assert.match(markup, /template-governance-overview-page/);
  assert.match(markup, /模板台账/);
  assert.match(markup, /原稿\/编辑稿提取台账/);
  assert.match(markup, /通用模块台账/);
  assert.match(markup, /医学专用模块台账/);
});
```

- [ ] **Step 2: Run the targeted overview tests and verify failure**

Run: `pnpm --dir apps/web exec node --import tsx --test test/template-governance-overview-page.spec.tsx`
Expected: FAIL because the overview page does not exist.

- [ ] **Step 3: Create the shared toolbar and search-state wrappers modeled after knowledge-library ledger**

```tsx
export function TemplateGovernanceLedgerToolbar({ title, actions, search, density }: Props) {
  return <header className="template-governance-ledger-toolbar">...</header>;
}
```

- [ ] **Step 4: Reduce the top-level workbench page to a route-mode switch**

```tsx
switch (view) {
  case "overview":
    return <TemplateGovernanceOverviewPage ... />;
  case "extraction-ledger":
    return <TemplateGovernanceExtractionLedgerPage ... />;
  default:
    return <ClassicTemplateGovernanceWorkbenchPage ... />;
}
```

- [ ] **Step 5: Re-run overview and host tests**

Run: `pnpm --dir apps/web exec node --import tsx --test test/template-governance-overview-page.spec.tsx test/workbench-host.spec.tsx test/template-governance-ledger-routing.spec.tsx`
Expected: PASS for routing into overview and rendering summary entry points.

- [ ] **Step 6: Commit the split shell**

```bash
git add apps/web/src/features/template-governance/template-governance-workbench-page.tsx apps/web/src/features/template-governance/template-governance-ledger-types.ts apps/web/src/features/template-governance/template-governance-ledger-toolbar.tsx apps/web/src/features/template-governance/template-governance-ledger-search-page.tsx apps/web/src/features/template-governance/template-governance-overview-page.tsx apps/web/src/features/template-governance/template-governance-workbench.css apps/web/src/features/template-governance/index.ts apps/web/test/template-governance-overview-page.spec.tsx
git commit -m "feat: split rule center into overview and ledger shells"
```

### Task 5: Build The Extraction Ledger Candidate Hub

**Files:**
- Create: `apps/web/src/features/template-governance/template-governance-extraction-ledger-page.tsx`
- Create: `apps/web/src/features/template-governance/template-governance-extraction-task-form.tsx`
- Create: `apps/web/src/features/template-governance/template-governance-candidate-confirmation-form.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-display.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench.css`
- Modify: `apps/web/test/template-governance-extraction-ledger-page.spec.tsx`
- Modify: `apps/web/test/template-governance-rule-package-workbench-page.spec.tsx`

- [ ] **Step 1: Add failing render tests for task-list state and candidate-confirmation state**

```tsx
test("extraction ledger renders task table with new-task action", () => {
  const markup = renderToStaticMarkup(<TemplateGovernanceExtractionLedgerPage viewModel={fixture} />);

  assert.match(markup, /template-governance-extraction-ledger-page/);
  assert.match(markup, /新建提取任务/);
  assert.match(markup, /待确认数/);
});

test("candidate confirmation opens AI semantic form before intake", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceExtractionLedgerPage viewModel={fixture} initialCandidateFormOpen />,
  );

  assert.match(markup, /template-governance-candidate-confirmation-form/);
  assert.match(markup, /AI一句话理解/);
  assert.match(markup, /确认入库/);
  assert.match(markup, /通用模块|医学专用模块|模板骨架/);
});
```

- [ ] **Step 2: Run the targeted extraction-ledger tests and confirm failure**

Run: `pnpm --dir apps/web exec node --import tsx --test test/template-governance-extraction-ledger-page.spec.tsx`
Expected: FAIL because the new ledger page and forms do not exist.

- [ ] **Step 3: Implement task-table state and same-page add-task form**

```tsx
{surface === "tasks" ? <ExtractionTaskTable ... /> : <ExtractionCandidateTable ... />}
{formState === "create-task" ? <TemplateGovernanceExtractionTaskForm ... /> : null}
```

- [ ] **Step 4: Implement the candidate confirmation form with bounded AI rewrite controls**

```tsx
<textarea value={draft.semanticSummary} onChange={...} />
<button type="button" onClick={() => props.onAiRewrite("semanticSummary")}>
  用 AI 重写这一段
</button>
```

- [ ] **Step 5: Wire `Confirm Intake`, `Hold`, and `Reject` into controller mutations**

Run: no command; use controller methods added in Task 3 and keep all side effects inside the extraction ledger.

- [ ] **Step 6: Re-run extraction-ledger and legacy rule-package render tests**

Run: `pnpm --dir apps/web exec node --import tsx --test test/template-governance-extraction-ledger-page.spec.tsx test/template-governance-rule-package-workbench-page.spec.tsx`
Expected: PASS with ledger-state rendering and no regression to legacy package fixtures.

- [ ] **Step 7: Commit the extraction candidate hub**

```bash
git add apps/web/src/features/template-governance/template-governance-extraction-ledger-page.tsx apps/web/src/features/template-governance/template-governance-extraction-task-form.tsx apps/web/src/features/template-governance/template-governance-candidate-confirmation-form.tsx apps/web/src/features/template-governance/template-governance-display.ts apps/web/src/features/template-governance/template-governance-workbench.css apps/web/test/template-governance-extraction-ledger-page.spec.tsx apps/web/test/template-governance-rule-package-workbench-page.spec.tsx
git commit -m "feat: add rule center extraction candidate hub"
```

### Task 6: Add Governed Content Modules And Template Skeleton Intake On The API

**Files:**
- Modify: `apps/api/src/modules/templates/template-record.ts`
- Modify: `apps/api/src/modules/templates/template-repository.ts`
- Modify: `apps/api/src/modules/templates/in-memory-template-family-repository.ts`
- Modify: `apps/api/src/modules/templates/postgres-template-repository.ts`
- Modify: `apps/api/src/modules/templates/template-governance-service.ts`
- Modify: `apps/api/src/modules/templates/template-api.ts`
- Modify: `apps/api/src/modules/templates/index.ts`
- Modify: `apps/api/src/database/migration-ledger.ts`
- Modify: `apps/api/test/database/schema.spec.ts`
- Create: `apps/api/test/templates/content-module-governance.spec.ts`

- [ ] **Step 1: Write the failing service test for intake to general module, medical module, and template skeleton**

```ts
test("template governance service intakes confirmed candidates into governed drafts", async () => {
  const service = createTemplateGovernanceServiceFixture();

  const generalModule = await service.createContentModuleDraftFromCandidate({
    candidateId: "candidate-1",
    moduleClass: "general",
  });

  assert.equal(generalModule.module_class, "general");
  assert.equal(generalModule.status, "draft");
});
```

- [ ] **Step 2: Run the template scope tests and confirm failure**

Run: `pnpm --filter @medical/api run test templates database`
Expected: FAIL because content modules and template compositions are not yet modeled.

- [ ] **Step 3: Extend the template record model without breaking existing template-family behavior**

```ts
export interface GovernedContentModuleRecord {
  id: string;
  module_class: "general" | "medical_specialized";
  name: string;
  manuscript_type_scope: ManuscriptType[];
  execution_module_scope: TemplateModule[];
  status: "draft" | "pending_review" | "published" | "archived";
}
```

- [ ] **Step 4: Add template-composition records and repository methods**

```ts
export interface TemplateCompositionRecord {
  id: string;
  name: string;
  manuscript_type: ManuscriptType;
  general_module_ids: string[];
  medical_module_ids: string[];
  execution_module_scope: TemplateModule[];
  status: "draft" | "published" | "archived";
}
```

- [ ] **Step 5: Add service methods for candidate intake and template skeleton generation**

Run: no command; implement `createContentModuleDraft`, `updateContentModuleDraft`, `createTemplateSkeletonFromCandidates`, `listContentModules`, and `listTemplateCompositions`.

- [ ] **Step 6: Re-run the API template and schema tests**

Run: `pnpm --filter @medical/api run test templates database`
Expected: PASS for new record, service, and schema coverage.

- [ ] **Step 7: Commit the content-module backend**

```bash
git add apps/api/src/modules/templates apps/api/src/database/migration-ledger.ts apps/api/test/templates/content-module-governance.spec.ts apps/api/test/database/schema.spec.ts
git commit -m "feat: add governed content modules and template skeleton drafts"
```

### Task 7: Build The General/Medical Module Ledgers And Template Ledger

**Files:**
- Create: `apps/web/src/features/template-governance/template-governance-content-module-ledger-page.tsx`
- Create: `apps/web/src/features/template-governance/template-governance-content-module-form.tsx`
- Create: `apps/web/src/features/template-governance/template-governance-template-ledger-page.tsx`
- Create: `apps/web/src/features/template-governance/template-governance-template-form.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-controller.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-display.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench.css`
- Create: `apps/web/test/template-governance-content-module-ledger-page.spec.tsx`
- Create: `apps/web/test/template-governance-template-ledger-page.spec.tsx`

- [ ] **Step 1: Write the failing module-ledger render tests**

```tsx
test("general module ledger renders reusable module table", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceContentModuleLedgerPage ledgerKind="general" viewModel={fixture} />,
  );

  assert.match(markup, /通用模块台账/);
  assert.match(markup, /加入模板/);
});

test("medical module ledger renders medical-only governance fields", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceContentModuleForm ledgerKind="medical_specialized" initialOpen />,
  );

  assert.match(markup, /证据级别/);
  assert.match(markup, /风险级别/);
});
```

- [ ] **Step 2: Write the failing template-ledger render test**

```tsx
test("template ledger renders composition counts and apply-to-manuscript action", () => {
  const markup = renderToStaticMarkup(<TemplateGovernanceTemplateLedgerPage viewModel={fixture} />);

  assert.match(markup, /模板台账/);
  assert.match(markup, /包含通用模块数/);
  assert.match(markup, /套用到稿件/);
});
```

- [ ] **Step 3: Run the targeted module/template web tests and verify failure**

Run: `pnpm --dir apps/web exec node --import tsx --test test/template-governance-content-module-ledger-page.spec.tsx test/template-governance-template-ledger-page.spec.tsx`
Expected: FAIL because the module/template ledgers do not exist.

- [ ] **Step 4: Build the shared module-ledger page and form**

```tsx
<TemplateGovernanceContentModuleLedgerPage
  ledgerKind="general"
  rows={viewModel.generalModules}
  onAdd={() => setFormState("create")}
  onAddToTemplate={...}
/>
```

- [ ] **Step 5: Build the template-ledger page and module-selection form**

```tsx
<TemplateGovernanceTemplateForm
  availableGeneralModules={viewModel.generalModules}
  availableMedicalModules={viewModel.medicalModules}
  onToggleGeneralModule={...}
  onToggleMedicalModule={...}
/>
```

- [ ] **Step 6: Wire controller methods for module/template create, update, search, and destination open**

Run: no command; keep search as a dedicated results state instead of only a passive row filter.

- [ ] **Step 7: Re-run the targeted module/template tests**

Run: `pnpm --dir apps/web exec node --import tsx --test test/template-governance-content-module-ledger-page.spec.tsx test/template-governance-template-ledger-page.spec.tsx`
Expected: PASS for the two module ledgers and template composition surface.

- [ ] **Step 8: Commit the module and template ledgers**

```bash
git add apps/web/src/features/template-governance/template-governance-content-module-ledger-page.tsx apps/web/src/features/template-governance/template-governance-content-module-form.tsx apps/web/src/features/template-governance/template-governance-template-ledger-page.tsx apps/web/src/features/template-governance/template-governance-template-form.tsx apps/web/src/features/template-governance/template-governance-controller.ts apps/web/src/features/template-governance/template-governance-display.ts apps/web/src/features/template-governance/template-governance-workbench.css apps/web/test/template-governance-content-module-ledger-page.spec.tsx apps/web/test/template-governance-template-ledger-page.spec.tsx
git commit -m "feat: add module and template ledgers to rule center"
```

### Task 8: Add Template Application Binding And End-To-End Verification

**Files:**
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/test/http/persistent-workbench-http.spec.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-template-ledger-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-template-form.tsx`
- Modify: `apps/web/test/template-governance-template-ledger-page.spec.tsx`
- Modify: `apps/web/test/workbench-host.spec.tsx`

- [ ] **Step 1: Write the failing application-binding tests**

```tsx
test("template ledger opens apply-to-manuscript form and submits binding intent", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceTemplateLedgerPage viewModel={fixture} initialApplyFormOpen />,
  );

  assert.match(markup, /选择稿件/);
  assert.match(markup, /执行模块范围/);
  assert.match(markup, /覆盖已有绑定/);
});
```

- [ ] **Step 2: Extend the HTTP/API layer with a governed apply-template mutation**

```ts
POST /api/template-governance/template-compositions/:templateId/apply
```

- [ ] **Step 3: Implement the same-page apply form without mutating manuscript text directly**

Run: no command; persist a binding/application record only.

- [ ] **Step 4: Run the focused web and HTTP tests**

Run: `pnpm --dir apps/web exec node --import tsx --test test/template-governance-template-ledger-page.spec.tsx test/workbench-host.spec.tsx`
Expected: PASS for the apply form surface.

Run: `pnpm --filter @medical/api run test http`
Expected: PASS for the new apply-template HTTP route and no regression in persistent workbench flows.

- [ ] **Step 5: Run the broader verification suite**

Run: `pnpm --filter @medsys/web run test`
Expected: PASS

Run: `pnpm --filter @medical/api run test editorial-rules templates database http`
Expected: PASS

- [ ] **Step 6: Commit the binding flow and verification**

```bash
git add apps/api/src/http/api-http-server.ts apps/api/test/http/persistent-workbench-http.spec.ts apps/web/src/features/template-governance/template-governance-template-ledger-page.tsx apps/web/src/features/template-governance/template-governance-template-form.tsx apps/web/test/template-governance-template-ledger-page.spec.tsx apps/web/test/workbench-host.spec.tsx
git commit -m "feat: add template application binding to rule center"
```

### Task 9: Final QA, Regression Checks, And Operator Fit

**Files:**
- Modify: `apps/web/test/template-governance-workbench-page.spec.tsx`
- Modify: `apps/web/test/template-governance-rule-package-workbench-page.spec.tsx`
- Modify: `docs/superpowers/specs/2026-04-13-rule-center-ledger-governance-redesign-design.md` only if implementation discovered a necessary spec correction

- [ ] **Step 1: Update or retire obsolete classic-workbench assertions**

```tsx
assert.doesNotMatch(markup, /template-governance-overview-page/);
assert.match(markup, /classic/);
```

- [ ] **Step 2: Run a final targeted regression pack**

Run: `pnpm --dir apps/web exec node --import tsx --test test/template-governance-*.spec.tsx test/workbench-host.spec.tsx`
Expected: PASS

Run: `pnpm --filter @medical/api run test editorial-rules templates http`
Expected: PASS

- [ ] **Step 3: Do one manual browser smoke of the four ledgers**

Run: `pnpm --filter @medsys/web run dev`
Expected: local rule center opens with:
- overview page
- extraction ledger
- general module ledger
- medical specialized module ledger
- template ledger

- [ ] **Step 4: Commit any final fixture or copy adjustments**

```bash
git add apps/web/test/template-governance-workbench-page.spec.tsx apps/web/test/template-governance-rule-package-workbench-page.spec.tsx
git commit -m "test: finalize rule center ledger regression coverage"
```
