# Example-Driven Rule Package V2C Compile And Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let confirmed rule packages compile into existing `editorial_rule_set + editorial_rule` drafts, expose compile preview and readiness in the package-first workbench, and reuse the current rule-set publish path without creating a second runtime truth source.

**Architecture:** Add a backend compile bridge that converts package drafts into deterministic `editorial_rule` seeds, runs readiness checks, explains coverage-key overrides, and writes only to draft rule sets. Then add a lightweight compile panel to the existing package-first workbench so operators can preview compile results, create or update draft rule sets, and hand off to the existing advanced editor / publish flow.

**Tech Stack:** TypeScript, React 18, Node `node:test`, `tsx`, existing editorial-rules services, existing rule-set publish/resolution/preview pipeline, current rule-package workbench state, existing browser HTTP client.

---

## File Structure

### New files

- `apps/api/src/modules/editorial-rules/rule-package-compile-service.ts`
  - Readiness checks, compile preview, deterministic package-to-rule seed mapping, and draft rule-set write orchestration.
- `apps/api/test/editorial-rules/rule-package-compile-service.spec.ts`
  - TDD coverage for readiness, compile preview, draft creation, replacement behavior, and override explanation.
- `apps/web/src/features/template-governance/rule-package-compile-panel.tsx`
  - Compact package-first compile summary, readiness state, preview result, and draft-compile actions.
- `apps/web/test/template-governance-rule-package-compile-panel.spec.tsx`
  - Render-level coverage for readiness badges, warnings, compile preview, and disabled actions.
- `apps/web/test/template-governance-rule-package-compile-flow.spec.tsx`
  - Page/controller integration coverage for compile preview and compile-to-draft handoff.

### Modified files

- `packages/contracts/src/editorial-rule-packages.ts`
  - Add compile readiness, compile preview, compiled rule seed, and compile-to-draft contracts.
- `packages/contracts/src/index.ts`
  - Re-export the V2C contracts.
- `apps/api/src/modules/editorial-rules/editorial-rule-api.ts`
  - Expose compile preview and compile-to-draft endpoints.
- `apps/api/src/modules/editorial-rules/editorial-rule-package-types.ts`
  - Add local API input/output aliases for compile preview and compile-to-draft.
- `apps/api/src/modules/editorial-rules/index.ts`
  - Export the compile service.
- `apps/api/src/http/api-http-server.ts`
  - Add HTTP routes for compile preview and compile-to-draft.
- `apps/web/src/features/editorial-rules/types.ts`
  - Add compile preview/result/readiness view models.
- `apps/web/src/features/editorial-rules/editorial-rules-api.ts`
  - Add compile preview and compile-to-draft client helpers.
- `apps/web/src/features/template-governance/template-governance-controller.ts`
  - Wire compile preview and compile-to-draft orchestration through the workbench controller.
- `apps/web/src/features/template-governance/rule-package-authoring-state.ts`
  - Track compile preview state and generated draft-rule metadata without changing runtime truth ownership.
- `apps/web/src/features/template-governance/rule-package-authoring-shell.tsx`
  - Render the compile panel under the package-first workbench.
- `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
  - Connect compile preview/compile-to-draft actions, success notices, and advanced-editor handoff.
- `apps/web/src/features/template-governance/template-governance-workbench.css`
  - Style compile readiness and compile result summaries.
- `docs/superpowers/specs/2026-04-11-example-driven-rule-package-v2c-compile-and-publish-design.md`
  - Add implementation status notes after V2C lands.

### Test commands

- API focused:
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/rule-package-compile-service.spec.ts`
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-package-authoring.spec.ts`
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/example-source-session-service.spec.ts ./test/editorial-rules/reviewed-case-rule-package-source-service.spec.ts ./test/editorial-rules/editorial-rule-package-gold-cases.spec.ts`
- Web focused:
  - `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-compile-panel.spec.tsx`
  - `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-controller.spec.ts`
  - `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-compile-flow.spec.tsx`
  - `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-workbench-page.spec.tsx ./test/template-governance-workbench-page.spec.tsx`
- Checkpoints:
  - `pnpm --filter @medical/api test -- editorial-rules`
  - `pnpm --filter @medsys/web test`

## Task 1: Add backend compile contracts and readiness/preview service

**Files:**
- Create: `apps/api/src/modules/editorial-rules/rule-package-compile-service.ts`
- Create: `apps/api/test/editorial-rules/rule-package-compile-service.spec.ts`
- Modify: `packages/contracts/src/editorial-rule-packages.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-package-types.ts`
- Modify: `apps/api/src/modules/editorial-rules/index.ts`

- [ ] **Step 1: Write a failing API-level unit test for compile readiness and compile preview**

```ts
test("ready rule packages compile into deterministic editorial-rule seeds with override explanations", async () => {
  const harness = createRulePackageCompileHarness();

  const preview = await harness.service.previewCompile({
    source: {
      sourceKind: "uploaded_example_pair",
      exampleSourceSessionId: "session-demo-1",
    },
    packageDrafts: [buildFrontMatterPackageDraft()],
    templateFamilyId: "family-1",
    journalTemplateId: "journal-alpha",
    module: "editing",
  });

  assert.equal(preview.packages[0].readiness.status, "ready");
  assert.equal(preview.packages[0].draft_rule_seeds[0].rule_object, "author_line");
  assert.ok(preview.packages[0].warnings.some((warning) => warning.length > 0));
});
```

- [ ] **Step 2: Run the focused API compile test to verify it fails**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/rule-package-compile-service.spec.ts`
Expected: FAIL because V2C compile contracts and service do not exist yet.

- [ ] **Step 3: Add compile contracts and the minimal readiness/preview service**

```ts
export interface RulePackageCompileReadiness {
  status: "ready" | "ready_with_downgrade" | "needs_confirmation" | "unsupported";
  reasons: string[];
}

export interface CompiledEditorialRuleSeed {
  package_id: string;
  coverage_key: string;
  rule_object: string;
  execution_mode: "apply" | "inspect" | "apply_and_inspect";
  confidence_policy: "always_auto" | "high_confidence_only" | "manual_only";
  severity: "info" | "warning" | "error";
  scope: Record<string, unknown>;
  selector: Record<string, unknown>;
  trigger: Record<string, unknown>;
  action: Record<string, unknown>;
  authoring_payload: Record<string, unknown>;
}
```

- [ ] **Step 4: Re-run the focused compile service test**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/rule-package-compile-service.spec.ts`
Expected: PASS.

## Task 2: Add compile-to-draft orchestration on top of the existing editorial-rule truth source

**Files:**
- Modify: `apps/api/src/modules/editorial-rules/rule-package-compile-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-api.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/test/editorial-rules/rule-package-compile-service.spec.ts`

- [ ] **Step 1: Write a failing test for compile-to-draft creating or updating a draft rule set only**

```ts
test("compile-to-draft writes compiled rules into a draft rule set without mutating published rule sets", async () => {
  const harness = createRulePackageCompileHarness();

  const result = await harness.service.compileToDraft({
    actorRole: "admin",
    source: {
      sourceKind: "reviewed_case",
      reviewedCaseSnapshotId: "reviewed-case-snapshot-demo-1",
    },
    packageDrafts: [buildFrontMatterPackageDraft()],
    templateFamilyId: "family-1",
    journalTemplateId: "journal-alpha",
    module: "editing",
  });

  assert.equal(result.created_rule_ids.length, 1);
  assert.equal(result.skipped_packages.length, 0);
  assert.equal(await harness.repository.countPublishedRuleSets(), 0);
});
```

- [ ] **Step 2: Run the focused API compile test to verify the draft-write flow fails**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/rule-package-compile-service.spec.ts`
Expected: FAIL because compile-to-draft orchestration and routes do not exist yet.

- [ ] **Step 3: Implement compile-to-draft by reusing `EditorialRuleService`**

```ts
const targetRuleSet =
  input.targetRuleSetId
    ? await loadEditableDraftRuleSet(input.targetRuleSetId)
    : await editorialRuleService.createRuleSet(input.actorRole, {
        templateFamilyId: input.templateFamilyId,
        journalTemplateId: input.journalTemplateId,
        module: input.module,
      });
```

- [ ] **Step 4: Add API endpoints for compile preview and compile-to-draft**

```ts
async previewRulePackageCompile({ input }) {
  return { status: 200, body: await rulePackageCompileService.previewCompile(input) };
}

async compileRulePackagesToDraft({ input }) {
  return { status: 200, body: await rulePackageCompileService.compileToDraft(input) };
}
```

- [ ] **Step 5: Re-run API-focused compile and authoring tests**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/rule-package-compile-service.spec.ts
pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-package-authoring.spec.ts
```

Expected: PASS.

## Task 3: Add compile preview and compile-to-draft client/controller support

**Files:**
- Modify: `apps/web/src/features/editorial-rules/types.ts`
- Modify: `apps/web/src/features/editorial-rules/editorial-rules-api.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-controller.ts`
- Modify: `apps/web/test/template-governance-rule-package-controller.spec.ts`

- [ ] **Step 1: Write a failing controller test for compile preview and compile-to-draft**

```ts
test("template governance controller previews package compile results and compiles into a draft rule set", async () => {
  const controller = createTemplateGovernanceWorkbenchController(mockClient(requests));

  const preview = await controller.previewRulePackageCompile(buildCompilePreviewInput());
  assert.equal(preview.packages[0].readiness.status, "ready");

  const result = await controller.compileRulePackagesToDraft(buildCompileInput());
  assert.equal(result.created_rule_ids.length, 1);
});
```

- [ ] **Step 2: Run the focused controller test to verify it fails**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-controller.spec.ts`
Expected: FAIL because V2C client/controller helpers do not exist yet.

- [ ] **Step 3: Add client helpers and controller methods**

```ts
export function previewRulePackageCompile(client, input) {
  return client.request<RulePackageCompilePreviewViewModel>({
    method: "POST",
    url: "/api/v1/editorial-rules/rule-packages/compile-preview",
    body: { input },
  });
}
```

- [ ] **Step 4: Re-run the focused controller test**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-controller.spec.ts`
Expected: PASS.

## Task 4: Add the package-first compile panel and page wiring

**Files:**
- Create: `apps/web/src/features/template-governance/rule-package-compile-panel.tsx`
- Create: `apps/web/test/template-governance-rule-package-compile-panel.spec.tsx`
- Create: `apps/web/test/template-governance-rule-package-compile-flow.spec.tsx`
- Modify: `apps/web/src/features/template-governance/rule-package-authoring-state.ts`
- Modify: `apps/web/src/features/template-governance/rule-package-authoring-shell.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench.css`
- Modify: `apps/web/test/template-governance-rule-package-workbench-page.spec.tsx`
- Modify: `apps/web/test/template-governance-workbench-page.spec.tsx`

- [ ] **Step 1: Write a failing render test for the compact compile panel**

```tsx
test("rule-package compile panel renders readiness, preview action, and compile action without exposing a second publish system", () => {
  const markup = renderToStaticMarkup(
    <RulePackageCompilePanel
      targetModule="editing"
      readinessSummary={{ ready: 1, blocked: 0 }}
      canPreview
      canCompile
      isBusy={false}
      onPreview={() => undefined}
      onCompile={() => undefined}
    />,
  );

  assert.match(markup, /Compile Preview/);
  assert.match(markup, /Compile To Draft Rule Set/);
  assert.doesNotMatch(markup, /Publish Rule Package/);
});
```

- [ ] **Step 2: Write a failing page-flow test for compile preview and draft compile handoff**

```tsx
test("package-first workbench can preview compile results and compile to an editorial rule-set draft", async () => {
  const page = renderRulePackageWorkbenchWithController();

  await page.clickText("Compile Preview");
  page.assertText("author_line");

  await page.clickText("Compile To Draft Rule Set");
  page.assertText("Draft rule set ready");
  page.assertText("Open Advanced Rule Editor");
});
```

- [ ] **Step 3: Run the focused panel/page tests to verify they fail**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-compile-panel.spec.tsx
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-compile-flow.spec.tsx
```

Expected: FAIL because the compile panel and state wiring do not exist yet.

- [ ] **Step 4: Implement the compact compile panel and workbench state**

```ts
interface RulePackageCompilePanelState {
  preview: RulePackageCompilePreviewViewModel | null;
  compileResult: RulePackageCompileToDraftResultViewModel | null;
  isPreviewBusy: boolean;
  isCompileBusy: boolean;
}
```

- [ ] **Step 5: Keep publish ownership in the existing rule-set area**

```tsx
<RulePackageCompilePanel
  compilePreview={compilePreview}
  compileResult={compileResult}
  onPreview={handlePreviewCompile}
  onCompile={handleCompileToDraft}
/>
```

- [ ] **Step 6: Re-run the focused web tests**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-compile-panel.spec.tsx
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-compile-flow.spec.tsx
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-workbench-page.spec.tsx ./test/template-governance-workbench-page.spec.tsx
```

Expected: PASS.

## Task 5: Sync docs and run package-level verification

**Files:**
- Modify: `docs/superpowers/specs/2026-04-11-example-driven-rule-package-v2c-compile-and-publish-design.md`

- [ ] **Step 1: Add implementation status notes to the V2C design doc**

```md
Implemented in V2C:
- compile readiness
- compile preview
- compile-to-draft into existing editorial_rule_set
- package-first compile panel

Still deferred:
- knowledge projection
- manuscript-ingestion-backed source
- package-native approval workflow
```

- [ ] **Step 2: Run focused API and web verification**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/rule-package-compile-service.spec.ts
pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-package-authoring.spec.ts ./test/editorial-rules/example-source-session-service.spec.ts ./test/editorial-rules/reviewed-case-rule-package-source-service.spec.ts ./test/editorial-rules/editorial-rule-package-gold-cases.spec.ts
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-controller.spec.ts ./test/template-governance-rule-package-compile-panel.spec.tsx ./test/template-governance-rule-package-compile-flow.spec.tsx ./test/template-governance-rule-package-workbench-page.spec.tsx ./test/template-governance-workbench-page.spec.tsx
```

Expected: PASS.

- [ ] **Step 3: Run package-level checkpoints**

Run:

```bash
pnpm --filter @medical/api test -- editorial-rules
pnpm --filter @medsys/web test
```

Expected: PASS.

## Definition of Done

- Confirmed rule packages can be evaluated for compile readiness.
- Package-first workbench can preview compile output without exposing a second publish engine.
- Operators can compile selected packages into an existing or newly created `editorial_rule_set` draft.
- Compiled rules reuse the existing `editorial_rule` truth source, publish path, resolution, and preview services.
- Coverage-key overrides are explained before publish.
- Uploaded-example and reviewed-case flows both remain supported.
- API and web focused suites pass, plus `@medical/api test -- editorial-rules` and `@medsys/web test`.
