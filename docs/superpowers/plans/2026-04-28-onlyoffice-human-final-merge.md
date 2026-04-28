# OnlyOffice Human Final Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make editing and proofreading OnlyOffice workbenches editable/saveable while presenting AI output plus human review as one merged final manuscript flow, not as disconnected user-facing assets.

**Architecture:** Keep the current immutable `document_assets` version model internally, but expose a single manuscript workflow in UI. Only editing/proofreading preview sessions can request save-back; screening remains read-only. OnlyOffice callback saves the returned DOCX as the next internal version for the same manuscript stage, writes an audit job payload describing AI baseline + human save-back, and exposes the saved result as the current edit/final manuscript output. Callback write authority is signed and scoped to the session, manuscript, baseline asset, and module; repeated callbacks are idempotent.

**Tech Stack:** React, TypeScript, Node HTTP API, existing OnlyOffice surface, existing manuscript/document asset/job repositories, existing learning/review payload conventions, Node test runner, Vite/TypeScript.

---

## Product Decision

- User-facing flow is one稿件链路: `原稿 -> AI编辑/AI校对 -> 人工复核编辑 -> 终稿`.
- Manual review after AI proofreading is part of the人工编辑/复核流程, not a separate product asset.
- Internal version snapshots are allowed for safety, audit, diff, rollback, and learning provenance.
- Screening is read-only and does not get save-back.
- Editing and proofreading are editable in OnlyOffice and can save into the same manuscript flow.
- Learning回流 in this pass records structured save-back provenance: baseline AI asset, human-saved asset, source module, callback status, and a review ledger entry. Full semantic DOCX diff extraction can be added later without changing the save-back contract.

## Feasibility Review Corrections

Subagent review found the plan is feasible only after these corrections:

- `saveBack` must be added to `manuscript-workbench-controller.ts`; otherwise the UI constructs the intent but drops it before the API call.
- Callback authorization cannot rely on anonymous query data. The save-back token must bind `sessionId`, `manuscriptId`, `baselineAssetId`, `assetId/documentKey`, and `saveBackModule`.
- Contract and web types must be broadened before implementation because `mode`, `permissions.edit`, and `save_back_enabled` are currently literal read-only types.
- `source_asset_type` must include `edited_docx`, `final_proof_annotated_docx`, and `human_final_docx`; otherwise saved/reviewed documents are mislabeled as original.
- OnlyOffice callbacks can repeat; save-back must be idempotent by session/document key + module + baseline asset.
- Learning回流 for this pass is limited to job payload provenance. Direct `LearningService` candidate creation is out of scope until semantic diff/deidentification exists.

## Final Execution Plan After Feasibility Review

The reviewed plan is executable with these locked sequencing decisions:

1. Keep screening read-only. Only editing/proofreading may request `saveBack`.
2. Normalize one signed document key across API session metadata, OnlyOffice config, callback query, and callback body.
3. Forward `saveBack` end-to-end from workbench page -> controller -> web API -> API preview service.
4. Build editable OnlyOffice config only when the signed session says `save_back_enabled === true`.
5. Process OnlyOffice callback through a dedicated save-back service, not an anonymous acknowledgement branch.
6. Persist returned DOCX through `DocumentAssetService.createAsset()` so `is_current` and manuscript current pointers advance through existing rules.
7. Record provenance in a completed job payload for复盘/知识回流, but defer semantic DOCX diff and automatic learning candidate creation.
8. Verify with focused API/Web/contract tests plus `git diff --check`.

## Files and Responsibilities

- `packages/contracts/src/document-pipeline.ts`
  - Broaden preview session contracts from view-only to `view | edit` sessions.
  - Allow `save_back_enabled: true` for governed editing/proofreading sessions.
- `apps/api/src/modules/document-pipeline/onlyoffice-session-service.ts`
  - Add save-back mode metadata to preview sessions.
  - Keep default sessions read-only.
  - Generate callback URL with `sessionId`, `assetId`, `manuscriptId`, `saveBackModule`, and surface token when available.
- `apps/api/src/modules/document-pipeline/document-preview-service.ts`
  - Validate requested save-back mode.
  - Permit save-back only for `editing` and `proofreading`.
  - Refuse save-back for screening/report assets.
- `apps/api/src/modules/document-pipeline/onlyoffice-save-back-service.ts`
  - New service to process OnlyOffice callback statuses.
  - Ignore non-save statuses with `{ error: 0 }`.
  - On save status, fetch OnlyOffice `url`, persist DOCX under upload root, create a same-flow internal asset version, and create a completed audit job.
  - Enforce signed callback scope and idempotency.
- `apps/api/src/http/api-http-server.ts`
  - Wire callback handling into `POST /api/v1/document-pipeline/preview-callback`.
  - Preserve old read-only callback acknowledgement.
  - Map validation errors to 400/403/404 as appropriate.
- `apps/api/src/http/persistent-governance-runtime.ts`
  - Wire save-back service into persistent runtime.
- `apps/api/test/http/support/workbench-runtime.ts`
  - Wire save-back service into HTTP test runtime.
- `apps/web/src/features/document-preview/types.ts`
  - Mirror edit/save-back fields.
- `apps/web/src/features/document-preview/preview-api.ts`
  - Add optional `saveBack` request field.
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts`
  - Include and forward `saveBack` from detail session input to `/document-pipeline/preview-session`.
- `apps/web/src/features/document-preview/onlyoffice-preview-surface.tsx`
  - Build editable OnlyOffice config when the session is editable.
  - Change toolbar copy so editing/proofreading pages say they are editing the current稿件版本.
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
  - Request editable preview sessions for editing `edited_docx` and proofreading final/workbench DOCX assets.
  - Keep screening preview requests read-only.
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-detail.tsx`
  - Show explicit save-back status/semantics in editing and proofreading detail pages without adding user-facing “new asset” language.
- Tests:
  - `packages/contracts/type-tests/document-pipeline-and-agent-tooling.test.ts`
  - `apps/api/test/document-pipeline/document-preview.spec.ts`
  - `apps/api/test/http/workbench-http.spec.ts`
  - `apps/web/test/document-preview-api.spec.ts`
  - `apps/web/test/onlyoffice-preview-surface.spec.ts`
  - `apps/web/test/manuscript-workbench-controller.spec.ts`
  - `apps/web/test/manuscript-workbench-page.spec.tsx`
  - `apps/web/test/manuscript-workbench-detail.spec.tsx`

---

## Task 1: Lock Save-Back Session Contract

**Files:**
- Modify: `packages/contracts/src/document-pipeline.ts`
- Modify: `apps/api/src/modules/document-pipeline/onlyoffice-session-service.ts`
- Modify: `apps/api/src/modules/document-pipeline/document-preview-service.ts`
- Test: `apps/api/test/document-pipeline/document-preview.spec.ts`

- [ ] **Step 1: Add failing API session tests**

Add tests proving:

```ts
assert.equal(editingSession.body.mode, "edit");
assert.equal(editingSession.body.document.permissions.edit, true);
assert.equal(editingSession.body.save_back_enabled, true);
assert.equal(editingSession.body.save_back?.module, "editing");
assert.equal(screeningSession.body.mode, "view");
assert.equal(screeningSession.body.save_back_enabled, false);
```

Expected before implementation: editable assertions fail because all sessions are currently view-only.

- [ ] **Step 2: Implement session types and service branching**

Add an optional request shape:

```ts
saveBack?: {
  enabled: boolean;
  module: "editing" | "proofreading";
  baselineAssetId?: string;
}
```

Session output keeps existing fields and adds:

```ts
save_back_enabled: boolean;
save_back?: {
  module: "editing" | "proofreading";
  baseline_asset_id: string;
  output_asset_type: "edited_docx" | "human_final_docx";
  callback_token: string;
}
```

Output asset rules:

```ts
editing -> edited_docx
proofreading -> human_final_docx
```

- [ ] **Step 3: Extend source asset typing**

Allow source asset types used by the workbenches:

```ts
"original" | "normalized_docx" | "edited_docx" | "final_proof_annotated_docx" | "human_final_docx"
```

The value must be the actual asset type, not coerced to `original`.

- [ ] **Step 4: Validate non-goals**

Reject save-back if:

```ts
module === "screening";
asset.asset_type === "screening_report";
previewStatus === "pending_normalization";
```

Read-only preview behavior must remain unchanged for all existing callers.

---

## Task 2: Implement OnlyOffice Callback Save-Back

**Files:**
- Create: `apps/api/src/modules/document-pipeline/onlyoffice-save-back-service.ts`
- Modify: `apps/api/src/modules/document-pipeline/index.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Modify: `apps/api/test/http/support/workbench-runtime.ts`
- Test: `apps/api/test/http/workbench-http.spec.ts`

- [ ] **Step 1: Add failing HTTP callback tests**

Add one test for editing and one for proofreading:

```ts
assert.equal(callbackResponse.status, 200);
assert.deepEqual(callbackBody, { error: 0 });
assert.equal(savedAsset.asset_type, "edited_docx"); // editing
assert.equal(savedAsset.parent_asset_id, aiEditedAsset.id);
assert.equal(savedAsset.source_module, "editing");
```

```ts
assert.equal(savedAsset.asset_type, "human_final_docx"); // proofreading
assert.equal(savedAsset.parent_asset_id, aiProofreadingAsset.id);
assert.equal(savedAsset.source_module, "manual");
```

Expected before implementation: callback only acknowledges and creates no asset.

- [ ] **Step 2: Process OnlyOffice callback statuses safely**

Handle:

```ts
status === 1 -> acknowledge only
status === 2 || status === 6 -> save returned file
status === 3 || status === 7 -> acknowledge with error: 0 but do not create asset
```

Save only when body has:

```ts
url: string;
key: string;
status: number;
```

This follows ONLYOFFICE Docs callback handling: the edited document link is present for `2/3/6/7`, while `2` and `6` are the statuses this system treats as saveable.

- [ ] **Step 3: Verify signed callback scope**

Callback must include and verify:

```ts
sessionId: string;
surfaceAccessToken: string;
saveBackModule: "editing" | "proofreading";
baselineAssetId: string;
```

Reject if the token claims do not match query/body values or the baseline asset does not belong to the manuscript.

- [ ] **Step 4: Add idempotent save-back**

Before creating an asset, check existing manuscript jobs for a completed payload with:

```ts
source === "onlyoffice_save_back";
sessionId;
documentKey;
saveBackModule;
baselineAssetId;
```

If found, return `{ error: 0 }` without creating another asset.

- [ ] **Step 5: Persist same-flow version**

For editing:

```ts
assetType: "edited_docx";
sourceModule: "editing";
parentAssetId: baselineAssetId;
jobType: "onlyoffice_editing_save_back";
```

For proofreading:

```ts
assetType: "human_final_docx";
sourceModule: "manual";
parentAssetId: baselineAssetId;
jobType: "onlyoffice_proofreading_human_final_save_back";
```

The product UI must not call this a new asset; the version exists only for audit/current-pointer safety.

- [ ] **Step 6: Record review/learning provenance in job payload**

Persist at minimum:

```ts
{
  source: "onlyoffice_save_back",
  sessionId,
  documentKey,
  saveBackModule,
  baselineAssetId,
  outputAssetId,
  callbackStatus,
  documentKey,
  humanReviewStage: "ai_output_human_review",
  learningSignal: {
    kind: "human_final_merge",
    status: "pending_semantic_diff",
    reason: "OnlyOffice saved final DOCX; semantic diff extraction is deferred."
  }
}
```

This gives downstream learning a stable source to consume once semantic DOCX diff extraction is added.

---

## Task 3: Wire Editable Sessions From Workbenches

**Files:**
- Modify: `apps/web/src/features/document-preview/types.ts`
- Modify: `apps/web/src/features/document-preview/preview-api.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Test: `apps/web/test/document-preview-api.spec.ts`
- Test: `apps/web/test/manuscript-workbench-controller.spec.ts`
- Test: `apps/web/test/manuscript-workbench-page.spec.tsx`

- [ ] **Step 1: Add failing web tests for preview request mode**

Assert editing `edited_docx` detail requests:

```ts
assert.deepEqual(input.saveBack, {
  enabled: true,
  module: "editing",
  baselineAssetId: "asset-edited-docx-1",
});
```

Assert proofreading detail requests:

```ts
assert.deepEqual(input.saveBack?.module, "proofreading");
```

Assert screening remains:

```ts
assert.equal(input.saveBack, undefined);
```

- [ ] **Step 2: Implement request construction**

In `buildDetailPreviewSessionInput`, add save-back only when:

```ts
mode === "editing" && selectedAsset.asset_type === "edited_docx"
mode === "proofreading" && selectedAsset.asset_type !== "proofreading_draft_report"
```

For proofreading draft workbench, prefer editing only if the preview source is a DOCX asset; reports remain read-only.

- [ ] **Step 3: Forward saveBack through controller and API client**

Ensure both controller interfaces and concrete API calls preserve:

```ts
saveBack: {
  enabled: true;
  module: "editing" | "proofreading";
  baselineAssetId: string;
}
```

Add a controller test proving this field reaches `createPreviewSession()`.

---

## Task 4: Make OnlyOffice Surface Respect Edit Mode

**Files:**
- Modify: `apps/web/src/features/document-preview/types.ts`
- Modify: `apps/web/src/features/document-preview/onlyoffice-preview-surface.tsx`
- Test: `apps/web/test/onlyoffice-preview-surface.spec.ts`

- [ ] **Step 1: Add failing config tests**

Assert editable session config:

```ts
assert.equal(config.editorConfig.mode, "edit");
assert.equal(config.document.permissions.edit, true);
assert.match(config.editorConfig.callbackUrl, /saveBackModule=editing/u);
```

- [ ] **Step 2: Implement edit-mode config**

Use the session values directly:

```ts
document.permissions = previewSession.document.permissions;
editorConfig.mode = previewSession.embed.editor_config.mode;
```

Keep plugin registration for proofreading locate/annotation.

- [ ] **Step 3: Update user-facing copy**

Editable surface copy should say:

```text
当前可在文档中完成人工复核编辑，保存后合并为当前稿件版本。
```

Read-only copy remains explicit for screening/read-only previews.

---

## Task 5: Verification

**Files:** no production files unless verification exposes defects.

- [ ] **Step 1: Run focused API tests**

```powershell
pnpm.cmd --dir apps/api exec tsx --test test/document-pipeline/document-preview.spec.ts test/http/workbench-http.spec.ts
```

Expected: all touched API tests pass.

- [ ] **Step 2: Run focused web tests**

```powershell
pnpm.cmd --dir apps/web exec tsx --test test/onlyoffice-preview-surface.spec.ts test/manuscript-workbench-page.spec.tsx test/manuscript-workbench-detail.spec.tsx
```

Expected: all touched web tests pass.

- [ ] **Step 3: Run contract type tests**

```powershell
pnpm.cmd --dir packages/contracts exec tsc -p tsconfig.json --noEmit --pretty false
```

Expected: no contract type errors.

- [ ] **Step 4: Typecheck web**

```powershell
pnpm.cmd --dir apps/web exec tsc -p tsconfig.json --noEmit --pretty false
```

Expected: no TypeScript errors.

- [ ] **Step 5: Whitespace check**

```powershell
git diff --check
```

Expected: no whitespace errors; CRLF warnings may appear in this repository.

## Residual Risks

- OnlyOffice save callbacks depend on the document server returning a reachable `url`; local tests will use a stub HTTP URL.
- This plan records learning provenance immediately but defers full semantic DOCX diff extraction, because reliable paragraph/table diffing is a separate worker concern.
- Existing historical assets remain internally visible through asset APIs for audit; UI should keep presenting them as current稿件/终稿 workflow rather than separate user-facing documents.
