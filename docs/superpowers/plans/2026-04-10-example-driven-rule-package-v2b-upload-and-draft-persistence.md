# Example-Driven Rule Package V2B Upload And Draft Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a direct `原稿 + 编后稿` upload path into rule center and lightweight draft persistence, while preserving the current V2A reviewed-case flow and keeping runtime `editorial_rule` publishing out of scope.

**Architecture:** Extend the existing rule-package engine with a source-union workspace API. Reviewed-case snapshots and uploaded example-pair sessions will both resolve into the same `ExamplePairUploadInput`, so the recognition and preview layers remain unchanged. On the web side, add a compact upload intake above the existing semantic-confirmation workbench and persist editable semantic drafts locally by source identity.

**Tech Stack:** TypeScript, React 18, Node `node:test`, `tsx`, existing browser HTTP client, current editorial-rules module, localStorage-backed draft persistence.

---

## File Structure

### New files

- `apps/api/src/modules/editorial-rules/example-source-session-service.ts`
  - Create, store, and resolve temporary uploaded example-pair sessions.
- `apps/api/test/editorial-rules/example-source-session-service.spec.ts`
  - Source-session creation and resolution coverage.
- `apps/web/src/features/template-governance/rule-package-upload-intake.tsx`
  - Compact upload UI for original/edited DOCX pair intake.
- `apps/web/src/features/template-governance/rule-package-draft-storage.ts`
  - Local draft storage helpers keyed by source identity.
- `apps/web/test/template-governance-rule-package-upload-intake.spec.tsx`
  - Upload intake rendering and interaction coverage.
- `apps/web/test/template-governance-rule-package-draft-storage.spec.ts`
  - Local storage persistence and restore coverage.

### Modified files

- `packages/contracts/src/editorial-rule-packages.ts`
  - Add uploaded-session source types and workspace request/response contracts.
- `packages/contracts/src/index.ts`
  - Re-export the new V2B contracts.
- `apps/api/src/modules/editorial-rules/editorial-rule-package-types.ts`
  - Add workspace source union and uploaded-session input types.
- `apps/api/src/modules/editorial-rules/editorial-rule-package-service.ts`
  - Add workspace generation from source union.
- `apps/api/src/modules/editorial-rules/editorial-rule-api.ts`
  - Expose create-session and workspace endpoints.
- `apps/api/src/modules/editorial-rules/index.ts`
  - Export the example-source session service.
- `apps/api/src/http/api-http-server.ts`
  - Add `example-source-sessions` and unified `workspace` routes.
- `apps/web/src/features/editorial-rules/types.ts`
  - Add uploaded-session/source-union view models.
- `apps/web/src/features/editorial-rules/editorial-rules-api.ts`
  - Add create-session and unified workspace client helpers.
- `apps/web/src/features/template-governance/template-governance-controller.ts`
  - Add upload-session creation, workspace loading by source, and source-aware restore helpers.
- `apps/web/src/features/template-governance/rule-package-authoring-state.ts`
  - Track source union and expose serializable draft snapshots.
- `apps/web/src/features/template-governance/rule-package-authoring-shell.tsx`
  - Render restore metadata and use source-aware workbench state.
- `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
  - Wire the upload intake, unified workspace load path, and local draft persistence.
- `apps/web/test/template-governance-rule-package-controller.spec.ts`
  - Update expectations from reviewed-case-only load path to source-union workspace path.
- `apps/web/test/template-governance-rule-package-workbench-page.spec.tsx`
  - Cover uploaded-session entry and restore affordances.
- `docs/superpowers/specs/2026-04-10-example-driven-rule-package-v2b-upload-and-draft-persistence-design.md`
  - Add implementation status notes if needed.

### Test commands

- API focused:
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/example-source-session-service.spec.ts`
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/reviewed-case-rule-package-source-service.spec.ts`
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-package-gold-cases.spec.ts`
- Web focused:
  - `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-controller.spec.ts`
  - `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-upload-intake.spec.tsx`
  - `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-draft-storage.spec.ts`
  - `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-workbench-page.spec.tsx`
- Checkpoints:
  - `pnpm --filter @medsys/web test`
  - `pnpm --filter @medical/api test -- editorial-rules`

## Task 1: Add uploaded example-pair source sessions and unified workspace source contracts

**Files:**
- Create: `apps/api/src/modules/editorial-rules/example-source-session-service.ts`
- Create: `apps/api/test/editorial-rules/example-source-session-service.spec.ts`
- Modify: `packages/contracts/src/editorial-rule-packages.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-package-types.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-package-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-api.ts`
- Modify: `apps/api/src/modules/editorial-rules/index.ts`
- Modify: `apps/api/src/http/api-http-server.ts`

- [ ] **Step 1: Write a failing API test for uploaded example-pair session creation and workspace generation**

```ts
test("uploaded example-pair session can be created and resolved into rule-package workspace candidates", async () => {
  const api = createEditorialRuleApiHarnessWithUploadSource();

  const session = await api.createRulePackageExampleSourceSession({
    input: buildUploadedPairInput(),
  });

  assert.equal(session.status, 201);

  const workspace = await api.loadRulePackageWorkspace({
    input: {
      sourceKind: "uploaded_example_pair",
      exampleSourceSessionId: session.body.session_id,
    },
  });

  assert.deepEqual(
    workspace.body.candidates.map((candidate) => candidate.package_kind),
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

- [ ] **Step 2: Run the focused API test to verify it fails**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/example-source-session-service.spec.ts`
Expected: FAIL because uploaded sessions and unified workspace source contracts do not exist yet.

- [ ] **Step 3: Add source-union contracts and temporary uploaded session service**

```ts
export type RulePackageWorkspaceSourceInput =
  | {
      sourceKind: "reviewed_case";
      reviewedCaseSnapshotId: string;
      journalKey?: string;
    }
  | {
      sourceKind: "uploaded_example_pair";
      exampleSourceSessionId: string;
      journalKey?: string;
    };

export interface CreateExampleSourceSessionInput {
  originalFile: InlineUploadFilePayload;
  editedFile: InlineUploadFilePayload;
  journalKey?: string;
}
```

- [ ] **Step 4: Route unified workspace generation through the existing recognition engine**

```ts
async loadWorkspace(input: RulePackageWorkspaceSourceInput) {
  const pairInput = await this.sourceResolver.resolve(input);
  const candidates = this.generateCandidates(pairInput);
  return {
    source: input,
    candidates,
    selectedPackageId: candidates[0]?.package_id ?? null,
  };
}
```

- [ ] **Step 5: Re-run the focused API tests**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/example-source-session-service.spec.ts
pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/reviewed-case-rule-package-source-service.spec.ts
```

Expected: PASS.

## Task 2: Wire uploaded-session and source-union workspace loading into web controller and compact intake UI

**Files:**
- Create: `apps/web/src/features/template-governance/rule-package-upload-intake.tsx`
- Create: `apps/web/test/template-governance-rule-package-upload-intake.spec.tsx`
- Modify: `apps/web/src/features/editorial-rules/types.ts`
- Modify: `apps/web/src/features/editorial-rules/editorial-rules-api.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-controller.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench.css`
- Modify: `apps/web/test/template-governance-rule-package-controller.spec.ts`
- Modify: `apps/web/test/template-governance-rule-package-workbench-page.spec.tsx`

- [ ] **Step 1: Write a failing upload-intake test for selecting original/edited files and starting recognition**

```tsx
test("rule-package upload intake renders original and edited file pickers plus start action", () => {
  const html = renderToStaticMarkup(
    <RulePackageUploadIntake
      originalFileName="原稿.docx"
      editedFileName="编后稿.docx"
      canStart
      isBusy={false}
      onOriginalFileSelect={() => undefined}
      onEditedFileSelect={() => undefined}
      onStart={() => undefined}
    />,
  );

  assert.match(html, /上传原稿/);
  assert.match(html, /上传编后稿/);
  assert.match(html, /开始识别/);
});
```

- [ ] **Step 2: Write a failing controller test for uploaded-session creation and unified workspace load**

```ts
test("template governance controller creates uploaded example source sessions and loads workspace by source union", async () => {
  const controller = createTemplateGovernanceWorkbenchController(mockClient(requests));
  const session = await controller.createRulePackageExampleSourceSession(buildUploadedPairInput());
  const workspace = await controller.loadRulePackageWorkspace({
    sourceKind: "uploaded_example_pair",
    exampleSourceSessionId: session.session_id,
  });

  assert.equal(workspace.candidates.length, 6);
});
```

- [ ] **Step 3: Run the focused web tests to verify they fail**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-upload-intake.spec.tsx
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-controller.spec.ts
```

Expected: FAIL because uploaded-session helpers and UI do not exist yet.

- [ ] **Step 4: Implement intake UI, client helpers, and source-aware controller methods**

```ts
async createRulePackageExampleSourceSession(input: CreateExampleSourceSessionInput) {
  return (await requestCreateExampleSourceSession(client, input)).body;
}

async loadRulePackageWorkspace(input: RulePackageWorkspaceSourceInput) {
  return (await requestRulePackageWorkspace(client, input)).body;
}
```

- [ ] **Step 5: Replace reviewed-case-only page bootstrapping with source-union bootstrapping**

```ts
const initialSource =
  initialUploadedSessionId
    ? { sourceKind: "uploaded_example_pair", exampleSourceSessionId: initialUploadedSessionId }
    : normalizedPrefilledReviewedCaseSnapshotId.length > 0
      ? { sourceKind: "reviewed_case", reviewedCaseSnapshotId: normalizedPrefilledReviewedCaseSnapshotId }
      : null;
```

- [ ] **Step 6: Re-run the focused web tests**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-upload-intake.spec.tsx
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-controller.spec.ts
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-workbench-page.spec.tsx
```

Expected: PASS.

## Task 3: Add lightweight local draft persistence and safe restore

**Files:**
- Create: `apps/web/src/features/template-governance/rule-package-draft-storage.ts`
- Create: `apps/web/test/template-governance-rule-package-draft-storage.spec.ts`
- Modify: `apps/web/src/features/template-governance/rule-package-authoring-state.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Modify: `apps/web/test/template-governance-rule-package-workbench-page.spec.tsx`

- [ ] **Step 1: Write a failing storage test for save/restore by source identity**

```ts
test("rule-package draft storage saves and restores drafts by source identity", () => {
  const storage = createMemoryStorage();
  saveRulePackageDraft(storage, buildStoredDraft());

  const restored = loadRulePackageDraft(storage, {
    sourceKind: "uploaded_example_pair",
    exampleSourceSessionId: "session-1",
  });

  assert.equal(restored?.selectedPackageId, "package-front-matter");
});
```

- [ ] **Step 2: Extend the page test to require restore affordance without publish actions**

```tsx
assert.match(markup, /恢复上次草稿/);
assert.doesNotMatch(markup, /Publish Rule Package/);
assert.doesNotMatch(markup, /Compile to editorial_rule/);
```

- [ ] **Step 3: Run the focused storage/page tests to verify they fail**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-draft-storage.spec.ts
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-workbench-page.spec.tsx
```

Expected: FAIL because storage helpers and restore UI do not exist yet.

- [ ] **Step 4: Implement local save/restore helpers and page wiring**

```ts
const storageKey = buildRulePackageDraftStorageKey(source);

export function saveRulePackageDraft(storage: StorageLike, draft: StoredRulePackageDraft) {
  storage.setItem(storageKey, JSON.stringify(draft));
}
```

- [ ] **Step 5: Persist editable drafts after local semantic edits and preview refresh**

```ts
useEffect(() => {
  if (!workspaceState?.source.reviewedCaseSnapshotId && !currentSource) {
    return;
  }
  saveRulePackageDraft(window.localStorage, toStoredDraft(workspaceState));
}, [workspaceState]);
```

- [ ] **Step 6: Re-run the focused storage/page tests**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-draft-storage.spec.ts
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-workbench-page.spec.tsx
```

Expected: PASS.

## Task 4: Update docs and run end-to-end verification

**Files:**
- Modify: `docs/superpowers/specs/2026-04-10-example-driven-rule-package-v2b-upload-and-draft-persistence-design.md`

- [ ] **Step 1: Add implementation status notes to the V2B design doc**

```md
Implemented in V2B:
- uploaded example-pair intake
- temporary source sessions
- source-union workspace loading
- local semantic draft persistence
Still deferred:
- editorial_rule compile/publish
- knowledge projection
- manuscript-ingestion-backed source
```

- [ ] **Step 2: Run focused API and web verification**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/example-source-session-service.spec.ts
pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/reviewed-case-rule-package-source-service.spec.ts
pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-package-gold-cases.spec.ts
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-controller.spec.ts
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-upload-intake.spec.tsx
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-draft-storage.spec.ts
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-workbench-page.spec.tsx
```

Expected: PASS.

- [ ] **Step 3: Run package-level checkpoints**

Run:

```bash
pnpm --filter @medsys/web test
pnpm --filter @medical/api test -- editorial-rules
```

Expected: PASS.

## Definition of Done

- Rule center can start from a direct uploaded original/edited DOCX pair without requiring a reviewed-case snapshot.
- Uploaded pairs resolve through the same rule-package engine used by reviewed-case source generation.
- Reviewed-case entry still works and does not regress.
- Operators can save and restore local semantic drafts by source identity.
- The primary UI remains the concise rule-package workbench and does not expose publish/compile actions.
- Web and API focused tests pass, plus `@medsys/web test` and `@medical/api test -- editorial-rules`.
