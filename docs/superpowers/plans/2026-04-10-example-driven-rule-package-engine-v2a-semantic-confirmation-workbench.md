# Example-Driven Rule Package Engine V2A Semantic Confirmation Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first operator-facing example-driven rule-package workbench inside rule center, using reviewed-case handoff as the source and exposing `candidate list + five semantic cards + preview`, without compiling or publishing formal `editorial_rule` records yet.

**Architecture:** Reuse the V1.1 rule-package engine and existing preview endpoint rather than building a second authoring stack. Add one narrow backend source resolver that converts a `reviewedCaseSnapshotId` into `ExamplePairUploadInput`, then add a package-first authoring surface inside the existing `template-governance` workbench. Operators edit only the AI-readable semantic draft in-session; the legacy long rule form remains available as an advanced drawer and no runtime publish path is added in this phase.

**Tech Stack:** TypeScript, React 18, Vite, Node `node:test`, `tsx`, existing browser HTTP client, API HTTP server, current document pipeline + reviewed-case snapshot repositories.

---

## Scope Guard

This V2A plan intentionally includes:

- reviewed-case snapshot handoff as the source of example pairs
- candidate list in the left rail
- five semantic cards in the center
- preview / hit explanation panel on the right
- local semantic-draft editing and re-preview
- advanced legacy rule form kept behind an explicit toggle

This V2A plan intentionally defers:

- raw `原稿.docx + 编后稿.docx` upload UI
- compile-to-`editorial_rule`
- publish / approval workflow for rule packages
- knowledge projection and knowledge writeback
- permanent draft persistence for semantic-card edits

---

## File Structure

### New files

- `apps/api/src/modules/editorial-rules/reviewed-case-rule-package-source-service.ts`
  - Resolve a `reviewedCaseSnapshotId` into the original/edited example-pair snapshots required by the V1.1 engine.
- `apps/api/test/editorial-rules/reviewed-case-rule-package-source-service.spec.ts`
  - Regression coverage for reviewed-case snapshot source resolution and error boundaries.
- `apps/web/src/features/template-governance/rule-package-authoring-state.ts`
  - Local reducer/helpers for selected candidate, editable semantic draft, preview loading state, and advanced-editor visibility.
- `apps/web/src/features/template-governance/rule-package-authoring-shell.tsx`
  - Package-first authoring shell that composes the three-column workbench.
- `apps/web/src/features/template-governance/rule-package-candidate-list.tsx`
  - Left-rail candidate list with posture/layer badges and selection behavior.
- `apps/web/src/features/template-governance/rule-package-semantic-cards.tsx`
  - Center-column editable five-card semantic authoring surface.
- `apps/web/src/features/template-governance/rule-package-preview-panel.tsx`
  - Right-column preview pane showing hit/miss reasons, auto posture, and review hints.
- `apps/web/test/template-governance-rule-package-controller.spec.ts`
  - Focused controller/API wiring coverage for candidate generation and preview refresh.
- `apps/web/test/template-governance-rule-package-workbench-page.spec.tsx`
  - Rendering and interaction coverage for the new workbench surface.

### Modified files

- `packages/contracts/src/editorial-rule-packages.ts`
  - Add V2A request/response contracts for reviewed-case sourced package generation if needed by the HTTP layer.
- `packages/contracts/src/index.ts`
  - Re-export the new V2A contracts.
- `apps/api/src/modules/editorial-rules/editorial-rule-package-types.ts`
  - Add reviewed-case generation input types.
- `apps/api/src/modules/editorial-rules/editorial-rule-package-service.ts`
  - Add a source-aware entry point that can generate candidates from a reviewed-case snapshot.
- `apps/api/src/modules/editorial-rules/editorial-rule-api.ts`
  - Expose the new reviewed-case generation method to the HTTP layer.
- `apps/api/src/modules/editorial-rules/index.ts`
  - Export the new source service.
- `apps/api/src/http/api-http-server.ts`
  - Route `/api/v1/editorial-rules/rule-packages/candidates/from-reviewed-case`.
- `apps/web/src/features/editorial-rules/types.ts`
  - Add frontend view-model/request types for rule-package generation and preview.
- `apps/web/src/features/editorial-rules/editorial-rules-api.ts`
  - Add browser client helpers for reviewed-case candidate generation and preview refresh.
- `apps/web/src/features/editorial-rules/index.ts`
  - Re-export the new client helpers/types.
- `apps/web/src/features/template-governance/template-governance-controller.ts`
  - Add rule-package workspace loading/generate/preview methods and handoff plumbing.
- `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
  - Integrate the V2A package-first surface and advanced editor toggle into authoring mode.
- `apps/web/src/features/template-governance/template-governance-workbench.css`
  - Add layout and visual treatment for the three-column rule-package authoring surface.
- `apps/web/src/features/template-governance/index.ts`
  - Re-export new workbench helpers/components if needed.
- `apps/web/test/template-governance-rule-authoring.spec.ts`
  - Update expectations where authoring mode becomes package-first but advanced form still exists.
- `docs/superpowers/specs/2026-04-10-example-driven-rule-package-engine-design.md`
  - Add a V2A section that formalizes the semantic-confirmation workbench and defers compile/publish.

### Test commands

- API focused:
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/reviewed-case-rule-package-source-service.spec.ts`
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-package-gold-cases.spec.ts`
- Web focused:
  - `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-controller.spec.ts`
  - `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-workbench-page.spec.tsx`
  - `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-authoring.spec.ts`
- Checkpoint:
  - `pnpm --filter @medsys/web test`
  - `pnpm --filter @medical/api test -- editorial-rules`

---

### Task 1: Add reviewed-case snapshot source resolution for rule-package generation

**Files:**
- Create: `apps/api/src/modules/editorial-rules/reviewed-case-rule-package-source-service.ts`
- Create: `apps/api/test/editorial-rules/reviewed-case-rule-package-source-service.spec.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-package-types.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-package-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-api.ts`
- Modify: `apps/api/src/modules/editorial-rules/index.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `packages/contracts/src/editorial-rule-packages.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `apps/api/test/editorial-rules/reviewed-case-rule-package-source-service.spec.ts`

- [ ] **Step 1: Write a failing API-side test for reviewed-case sourced candidate generation**

```ts
test("reviewed-case snapshot source resolves an example pair and returns six package candidates", async () => {
  const api = createEditorialRuleApiHarnessWithReviewedSnapshot();

  const response = await api.generateRulePackageCandidatesFromReviewedCase({
    input: {
      reviewedCaseSnapshotId: "reviewed-case-snapshot-demo-1",
      journalKey: "journal-alpha",
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.map((candidate) => candidate.package_kind),
    [
      "front_matter",
      "abstract_keywords",
      "heading_hierarchy",
      "numeric_statistics",
      "three_line_table",
      "reference",
    ],
  );
});
```

- [ ] **Step 2: Run the focused API test to verify it fails because reviewed-case source resolution does not exist yet**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/reviewed-case-rule-package-source-service.spec.ts`
Expected: FAIL with missing method / unresolved source service.

- [ ] **Step 3: Add the narrow reviewed-case source resolver and HTTP contract**

```ts
export interface GenerateRulePackageCandidatesFromReviewedCaseInput {
  reviewedCaseSnapshotId: string;
  journalKey?: string;
}

export class ReviewedCaseRulePackageSourceService {
  async buildExamplePair(input: GenerateRulePackageCandidatesFromReviewedCaseInput) {
    const snapshot = await this.snapshotRepository.get(input.reviewedCaseSnapshotId);
    const original = await this.documentPipeline.extractExampleSnapshot(snapshot.snapshot_asset_id);
    const edited = await this.documentPipeline.extractExampleSnapshot(snapshot.human_final_asset_id);

    return {
      context: {
        manuscript_type: snapshot.manuscript_type,
        module: snapshot.module,
        journal_key: input.journalKey,
      },
      original,
      edited,
    };
  }
}
```

- [ ] **Step 4: Route the new endpoint through the existing rule-package service**

```ts
async generateCandidatesFromReviewedCase(
  input: GenerateRulePackageCandidatesFromReviewedCaseInput,
): Promise<RulePackageCandidate[]> {
  const examplePair = await this.reviewedCaseSourceService.buildExamplePair(input);
  return this.generateCandidates(examplePair);
}
```

- [ ] **Step 5: Re-run the focused API test**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/reviewed-case-rule-package-source-service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit the backend source bridge**

```bash
git add packages/contracts/src/editorial-rule-packages.ts packages/contracts/src/index.ts apps/api/src/modules/editorial-rules/reviewed-case-rule-package-source-service.ts apps/api/src/modules/editorial-rules/editorial-rule-package-types.ts apps/api/src/modules/editorial-rules/editorial-rule-package-service.ts apps/api/src/modules/editorial-rules/editorial-rule-api.ts apps/api/src/modules/editorial-rules/index.ts apps/api/src/http/api-http-server.ts apps/api/test/editorial-rules/reviewed-case-rule-package-source-service.spec.ts
git commit -m "feat: add reviewed-case source for rule package generation"
```

### Task 2: Add web client and controller support for reviewed-case package generation and preview refresh

**Files:**
- Modify: `apps/web/src/features/editorial-rules/types.ts`
- Modify: `apps/web/src/features/editorial-rules/editorial-rules-api.ts`
- Modify: `apps/web/src/features/editorial-rules/index.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-controller.ts`
- Create: `apps/web/test/template-governance-rule-package-controller.spec.ts`
- Test: `apps/web/test/template-governance-rule-package-controller.spec.ts`

- [ ] **Step 1: Write a failing web controller test that requests reviewed-case package candidates and preview**

```ts
test("template governance controller loads reviewed-case rule-package candidates and refreshes preview", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createTemplateGovernanceWorkbenchController(mockClient(requests));

  const result = await controller.loadRulePackageWorkspace({
    reviewedCaseSnapshotId: "reviewed-case-snapshot-demo-1",
  });

  assert.equal(result.candidates.length, 6);

  await controller.previewRulePackageDraft({
    packageDraft: result.candidates[0],
    sampleText: "［摘　要］　目的：……",
  });

  assert.equal(
    requests.some((request) =>
      request.url === "/api/v1/editorial-rules/rule-packages/candidates/from-reviewed-case",
    ),
    true,
  );
  assert.equal(
    requests.some((request) => request.url === "/api/v1/editorial-rules/rule-packages/preview"),
    true,
  );
});
```

- [ ] **Step 2: Run the focused web controller test to verify it fails**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-controller.spec.ts`
Expected: FAIL because the controller does not expose rule-package workspace methods yet.

- [ ] **Step 3: Add client helpers and controller methods**

```ts
export function generateRulePackageCandidatesFromReviewedCase(
  client: EditorialRulesHttpClient,
  input: GenerateRulePackageCandidatesFromReviewedCaseFromReviewedCaseInput,
) {
  return client.request<RulePackageCandidateViewModel[]>({
    method: "POST",
    url: "/api/v1/editorial-rules/rule-packages/candidates/from-reviewed-case",
    body: { input },
  });
}

async loadRulePackageWorkspace(input: { reviewedCaseSnapshotId: string }) {
  const response = await generateRulePackageCandidatesFromReviewedCase(client, input);
  return {
    source: input,
    candidates: response.body,
    selectedPackageId: response.body[0]?.package_id ?? null,
  };
}
```

- [ ] **Step 4: Re-run the focused web controller test**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-controller.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit the controller/API wiring**

```bash
git add apps/web/src/features/editorial-rules/types.ts apps/web/src/features/editorial-rules/editorial-rules-api.ts apps/web/src/features/editorial-rules/index.ts apps/web/src/features/template-governance/template-governance-controller.ts apps/web/test/template-governance-rule-package-controller.spec.ts
git commit -m "feat: wire rule package workspace into template governance controller"
```

### Task 3: Build the package-first semantic confirmation workbench shell

**Files:**
- Create: `apps/web/src/features/template-governance/rule-package-authoring-state.ts`
- Create: `apps/web/src/features/template-governance/rule-package-authoring-shell.tsx`
- Create: `apps/web/src/features/template-governance/rule-package-candidate-list.tsx`
- Create: `apps/web/src/features/template-governance/rule-package-semantic-cards.tsx`
- Create: `apps/web/src/features/template-governance/rule-package-preview-panel.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench.css`
- Create: `apps/web/test/template-governance-rule-package-workbench-page.spec.tsx`
- Test: `apps/web/test/template-governance-rule-package-workbench-page.spec.tsx`

- [ ] **Step 1: Write a failing page test for the three-column workbench and five-card layout**

```tsx
test("template governance authoring mode renders package list, five semantic cards, and preview panel", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceWorkbenchPage
      initialMode="authoring"
      prefilledReviewedCaseSnapshotId="reviewed-case-snapshot-demo-1"
      initialRulePackageWorkspace={buildRulePackageWorkspaceFixture()}
    />,
  );

  assert.match(markup, /Rule Packages/);
  assert.match(markup, /规则是什么/);
  assert.match(markup, /AI怎么理解它/);
  assert.match(markup, /适用于哪里/);
  assert.match(markup, /前后示例/);
  assert.match(markup, /什么时候不要用/);
  assert.match(markup, /Preview/);
});
```

- [ ] **Step 2: Run the focused page test to verify it fails**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-workbench-page.spec.tsx`
Expected: FAIL because no package-first shell exists yet.

- [ ] **Step 3: Add the local state model and shell components**

```ts
export interface RulePackageAuthoringWorkspaceState {
  source: { reviewedCaseSnapshotId: string | null };
  candidates: RulePackageCandidateViewModel[];
  selectedPackageId: string | null;
  editableDraftById: Record<string, RulePackageDraftViewModel>;
  previewById: Record<string, RulePackagePreviewViewModel | undefined>;
  isAdvancedEditorVisible: boolean;
}
```

```tsx
<section className="rule-package-workbench">
  <RulePackageCandidateList ... />
  <RulePackageSemanticCards ... />
  <RulePackagePreviewPanel ... />
</section>
```

- [ ] **Step 4: Keep the legacy long form behind an explicit advanced toggle**

```tsx
{isAdvancedEditorVisible ? (
  <RuleAuthoringForm ... />
) : (
  <button type="button" onClick={toggleAdvancedEditor}>
    Open Advanced Rule Editor
  </button>
)}
```

- [ ] **Step 5: Re-run the focused page test**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-workbench-page.spec.tsx`
Expected: PASS.

- [ ] **Step 6: Commit the package-first shell**

```bash
git add apps/web/src/features/template-governance/rule-package-authoring-state.ts apps/web/src/features/template-governance/rule-package-authoring-shell.tsx apps/web/src/features/template-governance/rule-package-candidate-list.tsx apps/web/src/features/template-governance/rule-package-semantic-cards.tsx apps/web/src/features/template-governance/rule-package-preview-panel.tsx apps/web/src/features/template-governance/template-governance-workbench-page.tsx apps/web/src/features/template-governance/template-governance-workbench.css apps/web/test/template-governance-rule-package-workbench-page.spec.tsx
git commit -m "feat: add semantic confirmation workbench for rule packages"
```

### Task 4: Support editable semantic drafts and re-preview without publish

**Files:**
- Modify: `apps/web/src/features/template-governance/rule-package-authoring-state.ts`
- Modify: `apps/web/src/features/template-governance/rule-package-semantic-cards.tsx`
- Modify: `apps/web/src/features/template-governance/rule-package-preview-panel.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Modify: `apps/web/test/template-governance-rule-package-workbench-page.spec.tsx`
- Modify: `apps/web/test/template-governance-rule-authoring.spec.ts`
- Test: `apps/web/test/template-governance-rule-package-workbench-page.spec.tsx`

- [ ] **Step 1: Write a failing interaction test that semantic-card edits update preview input but do not expose publish**

```tsx
test("semantic draft edits stay local, refresh preview, and do not expose publish actions", async () => {
  const page = renderRulePackageWorkbenchWithController();

  page.changeCardField("AI怎么理解它", "summary", "统一中英文摘要标签");
  await page.clickRefreshPreview();

  assert.equal(page.lastPreviewRequest?.packageDraft.cards.ai_understanding.summary, "统一中英文摘要标签");
  assert.equal(page.queryByText(/Publish Rule Package/i), null);
  assert.equal(page.queryByText(/Compile to editorial_rule/i), null);
});
```

- [ ] **Step 2: Run the focused page test to verify it fails**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-workbench-page.spec.tsx`
Expected: FAIL because local semantic edits are not wired into preview flow yet.

- [ ] **Step 3: Implement local editable drafts and refresh-preview behavior**

```ts
function updateSemanticDraft(
  state: RulePackageAuthoringWorkspaceState,
  packageId: string,
  recipe: (draft: RulePackageDraftViewModel) => RulePackageDraftViewModel,
) {
  return {
    ...state,
    editableDraftById: {
      ...state.editableDraftById,
      [packageId]: recipe(state.editableDraftById[packageId] ?? toDraft(findCandidate(state, packageId))),
    },
  };
}
```

```tsx
<button type="button" onClick={() => void onRefreshPreview(selectedDraft)}>
  Refresh Preview
</button>
```

- [ ] **Step 4: Re-run the focused page tests and existing authoring spec**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-workbench-page.spec.tsx
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-authoring.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the local-edit preview loop**

```bash
git add apps/web/src/features/template-governance/rule-package-authoring-state.ts apps/web/src/features/template-governance/rule-package-semantic-cards.tsx apps/web/src/features/template-governance/rule-package-preview-panel.tsx apps/web/src/features/template-governance/template-governance-workbench-page.tsx apps/web/test/template-governance-rule-package-workbench-page.spec.tsx apps/web/test/template-governance-rule-authoring.spec.ts
git commit -m "feat: support semantic draft preview loop for rule packages"
```

### Task 5: Document V2A boundaries and run focused end-to-end verification

**Files:**
- Modify: `docs/superpowers/specs/2026-04-10-example-driven-rule-package-engine-design.md`
- Test: `apps/api/test/editorial-rules/reviewed-case-rule-package-source-service.spec.ts`
- Test: `apps/api/test/editorial-rules/editorial-rule-package-gold-cases.spec.ts`
- Test: `apps/web/test/template-governance-rule-package-controller.spec.ts`
- Test: `apps/web/test/template-governance-rule-package-workbench-page.spec.tsx`
- Test: `apps/web/test/template-governance-rule-authoring.spec.ts`

- [ ] **Step 1: Update the design doc with a V2A section and explicit deferrals**

```md
V2A adds:
- reviewed-case sourced example-pair loading
- candidate list + five semantic cards + preview workbench
- local semantic edits with explicit re-preview
- advanced direct-rule authoring behind a folded toggle

Still deferred after V2A:
- raw docx upload wizard
- compile confirmed package to editorial_rule
- publish/review workflow
- knowledge projection
```

- [ ] **Step 2: Run focused API and web verification**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/reviewed-case-rule-package-source-service.spec.ts
pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-package-gold-cases.spec.ts
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-controller.spec.ts
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-workbench-page.spec.tsx
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-authoring.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Run the package-level checkpoints**

Run:

```bash
pnpm --filter @medsys/web test
pnpm --filter @medical/api test -- editorial-rules
```

Expected: PASS.

- [ ] **Step 4: Commit the V2A checkpoint**

```bash
git add docs/superpowers/specs/2026-04-10-example-driven-rule-package-engine-design.md apps/api/src/modules/editorial-rules apps/api/src/http/api-http-server.ts apps/api/test/editorial-rules apps/web/src/features/editorial-rules apps/web/src/features/template-governance apps/web/test packages/contracts/src
git commit -m "feat: add v2a semantic confirmation workbench for rule packages"
```

---

## Definition of Done

- Rule center authoring mode can open a reviewed-case sourced rule-package workspace without requiring raw DOCX upload.
- The primary authoring surface is `candidate list + five semantic cards + preview`, not the old long form.
- Operators can edit semantic-summary/evidence/boundary fields locally and re-run preview.
- Preview explicitly shows hits, misses, automation posture, and whether human review is needed.
- The legacy long rule form still exists behind an advanced toggle and remains unchanged in behavior.
- No V2A action can publish or compile runtime `editorial_rule` records.
- Focused API and web suites pass against the integrated V2A flow.

## Assumptions

- The most stable V2A entry source is `reviewedCaseSnapshotId`, which is already carried through workbench routing and learning-review handoff.
- Raw `原稿.docx + 编后稿.docx` upload is intentionally deferred to a later `V2B`, after the semantic confirmation workbench proves stable.
- Semantic-card edits remain client-local in V2A; persistence is a separate concern from semantic confirmation and should not be mixed into this phase.
