# Example-Driven Rule Package V2D Handoff And Publish Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen the post-compile handoff so package-first authoring can reuse the selected draft rule set, explain publish readiness, and hand operators directly into the existing rule-set, advanced-editor, and publish surfaces.

**Architecture:** Extend the existing V2C compile bridge instead of adding a new governance system. The backend will enrich compile-to-draft with target-draft reuse metadata and publish-readiness summaries, while the web workbench will expose a compact target-draft selector, clearer compile result explanations, and explicit handoff actions that still route into the existing `editorial_rule` truth source and publish area.

**Tech Stack:** TypeScript, React 18, Node `node:test`, `tsx`, existing editorial-rules services, existing template-governance workbench state, existing browser HTTP client.

---

## File Structure

### New files

- None required beyond the V2C compile panel already added; V2D should extend the existing files instead of introducing a parallel handoff surface.

### Modified files

- `packages/contracts/src/editorial-rule-packages.ts`
  - Extend compile-to-draft contracts with `target_mode` and `publish_readiness`.
- `packages/contracts/src/index.ts`
  - Keep the expanded contracts exported.
- `apps/api/src/modules/editorial-rules/editorial-rule-package-types.ts`
  - Mirror the V2D compile result fields for the API layer.
- `apps/api/src/modules/editorial-rules/rule-package-compile-service.ts`
  - Reuse the selected editable draft when requested, derive `target_mode`, and compute publish-readiness explanations.
- `apps/api/test/editorial-rules/rule-package-compile-service.spec.ts`
  - Add failing tests for target-draft reuse and publish-readiness classification.
- `apps/web/src/features/editorial-rules/types.ts`
  - Add view models for target-draft mode and publish-readiness summary.
- `apps/web/src/features/editorial-rules/editorial-rules-api.ts`
  - Keep the web compile response aligned with the backend contract.
- `apps/web/src/features/template-governance/template-governance-controller.ts`
  - Keep compile orchestration aligned with the expanded V2D result.
- `apps/web/src/features/template-governance/rule-package-authoring-state.ts`
  - Track selected target draft mode and compile-result handoff metadata without changing local-draft persistence shape.
- `apps/web/src/features/template-governance/rule-package-compile-panel.tsx`
  - Render target-draft intent, publish readiness, and handoff actions.
- `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
  - Default compile to the selected editable draft when it matches context, reload overview around the target draft, and wire handoff buttons to existing workbench surfaces.
- `apps/web/test/template-governance-rule-package-controller.spec.ts`
  - Keep controller expectations aligned with the expanded compile result.
- `apps/web/test/template-governance-rule-package-compile-panel.spec.tsx`
  - Add failing coverage for target-mode and publish-readiness rendering.
- `apps/web/test/template-governance-rule-package-compile-flow.spec.tsx`
  - Add failing coverage for reuse/new-draft handoff and publish readiness.
- `apps/web/test/template-governance-rule-package-workbench-page.spec.tsx`
  - Verify the package-first workbench renders V2D handoff affordances.
- `docs/superpowers/specs/2026-04-11-example-driven-rule-package-v2d-handoff-and-publish-readiness-design.md`
  - Append implementation status after V2D lands.

## Test Commands

- API focused:
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/rule-package-compile-service.spec.ts`
- Web focused:
  - `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-controller.spec.ts`
  - `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-compile-panel.spec.tsx`
  - `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-compile-flow.spec.tsx`
  - `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-workbench-page.spec.tsx ./test/template-governance-workbench-page.spec.tsx`
- Checkpoints:
  - `pnpm --filter @medical/api test -- editorial-rules`
  - `pnpm --filter @medsys/web test`

## Task 1: Extend backend compile-to-draft with target-mode and publish readiness

**Files:**
- Modify: `packages/contracts/src/editorial-rule-packages.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-package-types.ts`
- Modify: `apps/api/src/modules/editorial-rules/rule-package-compile-service.ts`
- Test: `apps/api/test/editorial-rules/rule-package-compile-service.spec.ts`

- [ ] **Step 1: Write a failing test for selected-draft reuse and target mode**

```ts
test("compile-to-draft reuses the selected editable draft rule set and reports target_mode", async () => {
  const harness = createRulePackageCompileHarness();
  const selectedDraft = await harness.editorialRuleService.createRuleSet("admin", {
    templateFamilyId: "family-1",
    journalTemplateId: "journal-alpha",
    module: "editing",
  });

  const result = await harness.service.compileToDraft({
    actorRole: "admin",
    targetRuleSetId: selectedDraft.id,
    source: {
      sourceKind: "uploaded_example_pair",
      exampleSourceSessionId: "session-demo-1",
    },
    packageDrafts: [buildFrontMatterPackageDraft()],
    templateFamilyId: "family-1",
    journalTemplateId: "journal-alpha",
    module: "editing",
  });

  assert.equal(result.rule_set_id, selectedDraft.id);
  assert.equal(result.target_mode, "reused_selected_draft");
});
```

- [ ] **Step 2: Write a failing test for publish-readiness explanations**

```ts
test("compile-to-draft reports blocked publish readiness when packages are skipped", async () => {
  const harness = createRulePackageCompileHarness();

  const result = await harness.service.compileToDraft({
    actorRole: "admin",
    source: {
      sourceKind: "uploaded_example_pair",
      exampleSourceSessionId: "session-demo-1",
    },
    packageDrafts: [buildUnconfirmedFrontMatterPackageDraft()],
    templateFamilyId: "family-1",
    module: "editing",
  });

  assert.equal(result.publish_readiness.status, "blocked");
  assert.equal(result.publish_readiness.blocked_package_count, 1);
});
```

- [ ] **Step 3: Run the focused API test to verify it fails**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/rule-package-compile-service.spec.ts`
Expected: FAIL because the V2D fields do not exist yet.

- [ ] **Step 4: Add the minimal compile result contract and service logic**

```ts
target_mode:
  input.targetRuleSetId ? "reused_selected_draft" : "created_new_draft"
```

```ts
publish_readiness: classifyPublishReadiness({
  preview,
  createdRules,
  replacedRules,
})
```

- [ ] **Step 5: Re-run the focused API test**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/rule-package-compile-service.spec.ts`
Expected: PASS.

## Task 2: Extend web compile models and controller for the enriched handoff result

**Files:**
- Modify: `apps/web/src/features/editorial-rules/types.ts`
- Modify: `apps/web/src/features/editorial-rules/editorial-rules-api.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-controller.ts`
- Test: `apps/web/test/template-governance-rule-package-controller.spec.ts`

- [ ] **Step 1: Write a failing controller test for target_mode and publish_readiness**

```ts
test("template governance controller returns target_mode and publish_readiness from compile-to-draft", async () => {
  const controller = createTemplateGovernanceWorkbenchController(mockClient());

  const result = await controller.compileRulePackagesToDraft(buildCompileInput());

  assert.equal(result.target_mode, "reused_selected_draft");
  assert.equal(result.publish_readiness.status, "review_before_publish");
});
```

- [ ] **Step 2: Run the focused controller test to verify it fails**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-controller.spec.ts`
Expected: FAIL because the new fields are missing in the web contracts.

- [ ] **Step 3: Add the minimal web model and controller updates**

```ts
export interface RulePackageCompilePublishReadinessViewModel {
  status: "ready_to_review" | "review_before_publish" | "blocked";
  reasons: string[];
  blocked_package_count: number;
  override_count: number;
  guarded_rule_count: number;
  inspect_rule_count: number;
}
```

- [ ] **Step 4: Re-run the focused controller test**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-controller.spec.ts`
Expected: PASS.

## Task 3: Add V2D handoff and publish-readiness UI to the compile panel

**Files:**
- Modify: `apps/web/src/features/template-governance/rule-package-authoring-state.ts`
- Modify: `apps/web/src/features/template-governance/rule-package-compile-panel.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Test: `apps/web/test/template-governance-rule-package-compile-panel.spec.tsx`
- Test: `apps/web/test/template-governance-rule-package-compile-flow.spec.tsx`

- [ ] **Step 1: Write a failing render test for target-draft and publish-readiness sections**

```tsx
test("rule-package compile panel renders target-draft mode and publish-readiness summary", () => {
  const markup = renderToStaticMarkup(
    <RulePackageCompilePanel
      targetModule="editing"
      compilePreview={buildCompilePreview()}
      compileResult={{
        rule_set_id: "rule-set-draft-1",
        target_mode: "reused_selected_draft",
        created_rule_ids: ["rule-1"],
        replaced_rule_ids: ["rule-2"],
        skipped_packages: [],
        publish_readiness: {
          status: "review_before_publish",
          reasons: ["Overrides existing published coverage."],
          blocked_package_count: 0,
          override_count: 1,
          guarded_rule_count: 1,
          inspect_rule_count: 0,
        },
      }}
      ...
    />,
  );

  assert.match(markup, /Reused selected draft/);
  assert.match(markup, /review_before_publish/);
  assert.match(markup, /Go To Publish Area/);
});
```

- [ ] **Step 2: Write a failing shell-flow test for compile handoff actions**

```tsx
test("package-first authoring shell renders handoff actions after compile succeeds", () => {
  const markup = renderToStaticMarkup(
    <RulePackageAuthoringShell
      ...
      compileResult={buildCompileResult()}
    />,
  );

  assert.match(markup, /Open Draft Rule Set/);
  assert.match(markup, /Open Advanced Rule Editor/);
  assert.match(markup, /Go To Publish Area/);
});
```

- [ ] **Step 3: Run the focused compile panel tests to verify they fail**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-compile-panel.spec.tsx
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-compile-flow.spec.tsx
```

Expected: FAIL because the V2D UI affordances are not rendered yet.

- [ ] **Step 4: Implement the minimal panel and page wiring**

```ts
const targetRuleSetId =
  selectedRuleSet?.status === "draft" && contextsMatch(selectedRuleSet, compileContext)
    ? selectedRuleSet.id
    : undefined;
```

```tsx
<button type="button">Open Draft Rule Set</button>
<button type="button">Open Advanced Rule Editor</button>
<button type="button">Go To Publish Area</button>
```

- [ ] **Step 5: Re-run the focused panel tests**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-compile-panel.spec.tsx
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-compile-flow.spec.tsx
```

Expected: PASS.

## Task 4: Keep the workbench aligned with the target draft after compile

**Files:**
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Test: `apps/web/test/template-governance-rule-package-workbench-page.spec.tsx`
- Test: `apps/web/test/template-governance-workbench-page.spec.tsx`

- [ ] **Step 1: Write a failing workbench-page test for selected-draft handoff**

```tsx
test("template governance workbench keeps the compile target draft selected after compile", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceWorkbenchPage
      initialOverview={buildOverviewWithDraftRuleSet()}
      initialRulePackageWorkspace={buildRulePackageWorkspaceFixture()}
    />,
  );

  assert.match(markup, /Go To Publish Area/);
  assert.match(markup, /Open Draft Rule Set/);
});
```

- [ ] **Step 2: Run the focused page tests to verify they fail**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-workbench-page.spec.tsx ./test/template-governance-workbench-page.spec.tsx
```

Expected: FAIL until the new handoff affordances are fully wired.

- [ ] **Step 3: Implement the minimal overview-selection and handoff wiring**

```ts
await loadOverview({
  selectedTemplateFamilyId: compileContext.templateFamilyId,
  selectedJournalTemplateId: compileContext.journalTemplateId ?? null,
  selectedRuleSetId: compileResult.rule_set_id,
});
```

- [ ] **Step 4: Re-run the focused page tests**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-workbench-page.spec.tsx ./test/template-governance-workbench-page.spec.tsx
```

Expected: PASS.

## Task 5: Sync docs and run V2D verification

**Files:**
- Modify: `docs/superpowers/specs/2026-04-11-example-driven-rule-package-v2d-handoff-and-publish-readiness-design.md`

- [ ] **Step 1: Add implementation status notes to the V2D design doc**

```md
Implemented in V2D:
- selected-draft reuse
- publish-readiness summary
- compile handoff actions into existing rule-set surfaces

Still deferred:
- knowledge projection
- approval workflow
- manuscript ingestion source
```

- [ ] **Step 2: Run focused API and web verification**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/rule-package-compile-service.spec.ts
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

## Definition Of Done

- Compile can explicitly reuse the selected editable draft rule set when contexts match.
- Compile-to-draft returns `target_mode` and `publish_readiness`.
- The package-first compile panel explains whether the target draft was reused or newly created.
- The package-first compile panel exposes clear handoff actions into the existing rule-set, advanced-editor, and publish surfaces.
- The existing `Publish Rule Set` flow remains the only publish path.
- API and web focused tests pass, plus `@medical/api test -- editorial-rules` and `@medsys/web test`.
