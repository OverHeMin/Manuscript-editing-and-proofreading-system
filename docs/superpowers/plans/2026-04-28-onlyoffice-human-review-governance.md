# OnlyOffice Human Review Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the校对/编辑 human-review loop where OnlyOffice is the body-editing authority, the right rail is the governance authority, and final manuscripts plus rule/knowledge candidates are generated only from confirmed differences.

**Architecture:** Add a first-class human-review diff ledger instead of overloading existing review items. OnlyOffice save-back creates an internal working-state DOCX, a V1 diff extractor creates text-level diff items, the publish service gates on confirmed diff decisions, and candidate backflow runs after final asset creation so candidate failure never rolls back the final manuscript.

**Tech Stack:** TypeScript contracts, Node API services, PostgreSQL migrations/in-memory repositories, existing DOCX transform service, React/Vite workbench UI, node:test, Playwright/workbench gate.

---

## Feasibility Scope From Subagent Review

V1 supports automatic application/reversion for paragraph text replacement/add/delete and simple table-cell text replacement. Complex table structure, images, captions, reference fields, footnotes/endnotes, formulas, embedded objects, and style inheritance are detected as summary/unsafe differences and block publish when they cannot be safely reconciled.

Do not implement prompt candidates or evidence-only actions in this workflow. Do not expose OnlyOffice working-state assets as final/exportable manuscript assets.

## File Structure

Create:

- `packages/contracts/src/human-review.ts` - shared diff item, decision, capability, summary, request/response contracts.
- `apps/api/src/modules/human-review/human-review-record.ts` - API-side records.
- `apps/api/src/modules/human-review/human-review-repository.ts` - repository interface.
- `apps/api/src/modules/human-review/in-memory-human-review-repository.ts` - tests and non-persistent runtime.
- `apps/api/src/modules/human-review/postgres-human-review-repository.ts` - persistent repository.
- `apps/api/src/modules/human-review/human-review-diff-service.ts` - V1 text diff extraction.
- `apps/api/src/modules/human-review/human-review-service.ts` - orchestration for extraction, decisions, publish gate, backflow retry.
- `apps/api/src/modules/human-review/human-review-api.ts` - route adapter.
- `apps/api/src/modules/human-review/index.ts` - exports.
- `apps/api/src/database/migrations/0058_human_review_diff_ledger.sql` - tables for diff items and candidate backflow attempts.
- `apps/api/test/human-review/human-review-contract.spec.ts` - contract/unit tests.
- `apps/api/test/human-review/human-review-diff-service.spec.ts` - V1 diff tests.
- `apps/api/test/human-review/human-review-publish.spec.ts` - publish gate/backflow tests.
- `apps/web/src/features/human-review/types.ts` - front-end view models.
- `apps/web/src/features/human-review/human-review-api.ts` - front-end API client.
- `apps/web/src/features/human-review/human-review-queue.tsx` - shared right rail queue.
- `apps/web/src/features/human-review/human-review-state.ts` - filters, summaries, batch helpers.
- `apps/web/test/human-review-state.spec.ts` - front-end state tests.

Modify:

- `packages/contracts/src/assets.ts` - add internal working asset type.
- `packages/contracts/src/document-pipeline.ts` - expose working-state save-back intent.
- `packages/contracts/src/index.ts` - export human-review contracts.
- `apps/api/src/modules/assets/document-asset-record.ts` - add working asset type and keep it out of export matrix.
- `apps/api/src/modules/assets/document-asset-service.ts` - ensure working assets do not advance current pointers.
- `apps/api/src/modules/document-pipeline/onlyoffice-session-service.ts` - sign save-back scope for working-state mode.
- `apps/api/src/modules/document-pipeline/document-preview-service.ts` - allow editable review sessions to create working-state save-back scopes.
- `apps/api/src/modules/document-pipeline/onlyoffice-save-back-service.ts` - save working-state DOCX instead of final/editing assets for this workflow.
- `apps/api/src/http/persistent-governance-runtime.ts` - wire repository/service/API.
- `apps/api/src/http/api-http-server.ts` - expose routes.
- `apps/api/src/modules/proofreading/proofreading-service.ts` - delegate publish to human-review gate for new workflow.
- `apps/api/src/modules/editing/editing-service.ts` - add later-phase editing entry point using same diff model.
- `apps/web/src/features/document-preview/types.ts` - align save-back contract.
- `apps/web/src/features/document-preview/preview-api.ts` - pass working-state save-back intent.
- `apps/web/src/features/document-preview/onlyoffice-preview-surface.tsx` - change user-facing save text from final merge to working save.
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts` - add human-review calls.
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-detail.tsx` - use shared diff queue in校对 and later编辑 detail.
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx` - publish gate summary and refresh.
- Existing tests under `apps/api/test/document-pipeline`, `apps/api/test/proofreading`, `apps/api/test/editing`, and `apps/web/test/manuscript-workbench*`.

---

### Task 1: Contracts And Asset Truth

**Files:**
- Create: `packages/contracts/src/human-review.ts`
- Modify: `packages/contracts/src/assets.ts`
- Modify: `packages/contracts/src/document-pipeline.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/src/modules/assets/document-asset-record.ts`
- Modify: `apps/api/src/modules/assets/document-asset-service.ts`
- Test: `packages/contracts/type-tests/core.test.ts`
- Test: `packages/contracts/type-tests/package-entry.test.ts`
- Test: `apps/api/test/document-pipeline/document-export.spec.ts`

- [ ] **Step 1: Add failing contract type tests**

Add type-test coverage that imports `HumanReviewDiffItem`, `HumanReviewContentDecision`, `HumanReviewGovernanceIntent`, and verifies `human_review_working_docx` is a `DocumentAssetType` but not selected by the current export matrix.

Expected sample assertions:

```ts
const diffItem: HumanReviewDiffItem = {
  id: "diff-1",
  module: "proofreading",
  manuscript_id: "manuscript-1",
  baseline_asset_id: "asset-ai-draft-1",
  working_asset_id: "asset-work-1",
  source: "human_added",
  content_decision: "unconfirmed",
  governance_intents: {
    rule_candidate: false,
    knowledge_candidate: true,
  },
  apply_capability: "auto_apply_revert",
  status: "pending",
  before_text: "ALT remained stable.",
  after_text: "Serum ALT remained stable.",
  created_at: "2026-04-28T00:00:00.000Z",
  updated_at: "2026-04-28T00:00:00.000Z",
};
void diffItem;
```

Run: `pnpm --dir packages/contracts exec tsc -p tsconfig.json --noEmit`

Expected: FAIL until contracts exist.

- [ ] **Step 2: Create human-review contract**

Define these exact unions and interfaces in `packages/contracts/src/human-review.ts`:

```ts
export type HumanReviewModule = "proofreading" | "editing" | "screening_reserved";
export type HumanReviewDiffSource =
  | "ai_suggestion"
  | "human_added"
  | "human_overrode_ai"
  | "human_reverted_ai";
export type HumanReviewContentDecision = "unconfirmed" | "keep" | "reject" | "defer";
export type HumanReviewApplyCapability =
  | "auto_apply_revert"
  | "keep_only_no_safe_revert"
  | "unsafe_needs_manual_review";
export type HumanReviewDiffStatus =
  | "pending"
  | "confirmed"
  | "blocks_publish"
  | "published_writeback_done"
  | "writeback_failed"
  | "stale_after_reextract";
export type HumanReviewComplexityFlag =
  | "format_complex"
  | "table_structure"
  | "image_caption"
  | "reference"
  | "locator_fallback";

export interface HumanReviewGovernanceIntent {
  rule_candidate: boolean;
  knowledge_candidate: boolean;
}

export interface HumanReviewDiffLocation {
  anchor_kind?: "paragraph" | "heading" | "table" | "table_cell" | "image" | "caption" | "reference_entry";
  block_index?: number;
  quote?: string;
  section_label?: string;
  table_id?: string;
  row_key?: string;
  column_key?: string;
}

export interface HumanReviewDiffItem {
  id: string;
  module: HumanReviewModule;
  manuscript_id: string;
  baseline_asset_id: string;
  working_asset_id: string;
  final_asset_id?: string;
  source: HumanReviewDiffSource;
  content_decision: HumanReviewContentDecision;
  governance_intents: HumanReviewGovernanceIntent;
  apply_capability: HumanReviewApplyCapability;
  complexity_flags?: HumanReviewComplexityFlag[];
  status: HumanReviewDiffStatus;
  before_text?: string;
  after_text?: string;
  summary?: string;
  location?: HumanReviewDiffLocation;
  note?: string;
  extraction_revision?: number;
  backflow_error?: string;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 3: Add working asset type without pointer advancement**

Add `human_review_working_docx` to contract and API asset type unions. Do not add it to export priorities or pointer advancement. In `pointerFieldForAssetType`, no branch should return a pointer field for `human_review_working_docx`.

- [ ] **Step 4: Export contracts**

Export `./human-review.js` from `packages/contracts/src/index.ts`.

- [ ] **Step 5: Run focused contract and asset tests**

Run:

```powershell
pnpm --dir packages/contracts exec tsc -p tsconfig.json --noEmit
pnpm --dir apps/api exec node --import tsx --test test/document-pipeline/document-export.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add packages/contracts/src/human-review.ts packages/contracts/src/assets.ts packages/contracts/src/document-pipeline.ts packages/contracts/src/index.ts packages/contracts/type-tests/core.test.ts packages/contracts/type-tests/package-entry.test.ts apps/api/src/modules/assets/document-asset-record.ts apps/api/src/modules/assets/document-asset-service.ts apps/api/test/document-pipeline/document-export.spec.ts
git commit -m "feat: add human review diff contracts"
```

---

### Task 2: Human Review Ledger Persistence

**Files:**
- Create: `apps/api/src/database/migrations/0058_human_review_diff_ledger.sql`
- Create: `apps/api/src/modules/human-review/human-review-record.ts`
- Create: `apps/api/src/modules/human-review/human-review-repository.ts`
- Create: `apps/api/src/modules/human-review/in-memory-human-review-repository.ts`
- Create: `apps/api/src/modules/human-review/postgres-human-review-repository.ts`
- Create: `apps/api/src/modules/human-review/index.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Test: `apps/api/test/human-review/human-review-contract.spec.ts`

- [ ] **Step 1: Write repository tests**

Test save/list/update behavior for diff items:

```ts
test("human review repository stores and updates diff decisions", async () => {
  const repository = new InMemoryHumanReviewRepository();
  await repository.saveDiffItem({
    id: "diff-1",
    module: "proofreading",
    manuscript_id: "manuscript-1",
    baseline_asset_id: "asset-base",
    working_asset_id: "asset-work",
    source: "human_added",
    content_decision: "unconfirmed",
    governance_intents: { rule_candidate: false, knowledge_candidate: false },
    apply_capability: "auto_apply_revert",
    status: "pending",
    before_text: "A",
    after_text: "B",
    created_at: "2026-04-28T00:00:00.000Z",
    updated_at: "2026-04-28T00:00:00.000Z",
  });
  const listed = await repository.listDiffItems({ manuscriptId: "manuscript-1", module: "proofreading" });
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.content_decision, "unconfirmed");
});
```

Run: `pnpm --dir apps/api exec node --import tsx --test test/human-review/human-review-contract.spec.ts`

Expected: FAIL until repository exists.

- [ ] **Step 2: Add SQL migration**

Create `human_review_diff_items` with columns matching the contract plus JSONB `location`, `governance_intents`, `complexity_flags`; create indexes on `manuscript_id`, `(manuscript_id, module)`, `working_asset_id`, `final_asset_id`, and `status`.

Create `human_review_backflow_attempts` with `id`, `diff_item_id`, `target`, `status`, `learning_candidate_id`, `error_message`, timestamps.

- [ ] **Step 3: Implement records and repositories**

Map records 1:1 with contract fields. In-memory repository should clone arrays/objects on read/write. Postgres repository should JSON encode/decode `location`, `governance_intents`, and `complexity_flags`.

- [ ] **Step 4: Wire persistent runtime**

Instantiate Postgres repository in `persistent-governance-runtime.ts` and export in the runtime object for later API/service use.

- [ ] **Step 5: Run tests**

Run:

```powershell
pnpm --dir apps/api exec node --import tsx --test test/human-review/human-review-contract.spec.ts
pnpm --dir apps/api run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add apps/api/src/database/migrations/0058_human_review_diff_ledger.sql apps/api/src/modules/human-review apps/api/src/http/persistent-governance-runtime.ts apps/api/test/human-review/human-review-contract.spec.ts
git commit -m "feat: persist human review diff ledger"
```

---

### Task 3: OnlyOffice Working-State Save-Back

**Files:**
- Modify: `packages/contracts/src/document-pipeline.ts`
- Modify: `apps/api/src/modules/document-pipeline/onlyoffice-session-service.ts`
- Modify: `apps/api/src/modules/document-pipeline/document-preview-service.ts`
- Modify: `apps/api/src/modules/document-pipeline/onlyoffice-save-back-service.ts`
- Modify: `apps/api/test/document-pipeline/onlyoffice-save-back-service.spec.ts`
- Modify: `apps/api/test/document-pipeline/document-preview.spec.ts`

- [ ] **Step 1: Rewrite save-back tests to protect new semantics**

Replace the current expectation that proofreading save-back creates `human_final_docx`. New assertion:

```ts
assert.equal(workingAssets[0]?.asset_type, "human_review_working_docx");
assert.equal(workingAssets[0]?.source_module, "manual");
assert.equal(workingAssets[0]?.is_current, false);
assert.notEqual(manuscript?.current_proofreading_asset_id, workingAssets[0]?.id);
assert.equal(job?.job_type, "onlyoffice_human_review_working_save_back");
```

Run: `pnpm --dir apps/api exec node --import tsx --test test/document-pipeline/onlyoffice-save-back-service.spec.ts`

Expected: FAIL until implementation changes.

- [ ] **Step 2: Extend save-back scope**

Add a save-back purpose such as `human_review_working_state` to session claims and preview contract. For this workflow, `resolveSaveBackOutputAssetType` must return `human_review_working_docx`.

- [ ] **Step 3: Change save-back output**

In `OnlyOfficeSaveBackService`, create `human_review_working_docx` for human-review save-back. Do not set current manuscript pointers. Use job type `onlyoffice_human_review_working_save_back`. Keep idempotency by session/document key/module/baseline.

- [ ] **Step 4: Keep legacy paths explicit**

If existing non-human-review save-back behavior is still needed elsewhere, gate it behind an explicit legacy purpose. Do not let校对/编辑 human-review sessions use the legacy final/editing output behavior.

- [ ] **Step 5: Run tests**

Run:

```powershell
pnpm --dir apps/api exec node --import tsx --test test/document-pipeline/onlyoffice-save-back-service.spec.ts test/document-pipeline/document-preview.spec.ts
pnpm --dir apps/api run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add packages/contracts/src/document-pipeline.ts apps/api/src/modules/document-pipeline/onlyoffice-session-service.ts apps/api/src/modules/document-pipeline/document-preview-service.ts apps/api/src/modules/document-pipeline/onlyoffice-save-back-service.ts apps/api/test/document-pipeline/onlyoffice-save-back-service.spec.ts apps/api/test/document-pipeline/document-preview.spec.ts
git commit -m "feat: save onlyoffice human review work states"
```

---

### Task 4: V1 Text Diff Extraction

**Files:**
- Create: `apps/api/src/modules/human-review/human-review-diff-service.ts`
- Modify: `apps/api/src/modules/human-review/index.ts`
- Test: `apps/api/test/human-review/human-review-diff-service.spec.ts`

- [ ] **Step 1: Write diff extractor tests**

Cover:

- paragraph replacement creates `ai_suggestion` or `human_overrode_ai`
- paragraph insertion creates `human_added`
- paragraph deletion creates `human_reverted_ai`
- simple table-cell text replacement creates `auto_apply_revert`
- unsupported structural change creates `unsafe_needs_manual_review`

Expected assertion:

```ts
assert.deepEqual(result.items.map((item) => ({
  source: item.source,
  before: item.before_text,
  after: item.after_text,
  capability: item.apply_capability,
})), [
  {
    source: "human_added",
    before: "",
    after: "新增人工修改。",
    capability: "auto_apply_revert",
  },
]);
```

Run: `pnpm --dir apps/api exec node --import tsx --test test/human-review/human-review-diff-service.spec.ts`

Expected: FAIL until service exists.

- [ ] **Step 2: Implement extractor interface**

Expose:

```ts
export interface ExtractHumanReviewDiffInput {
  manuscriptId: string;
  module: "proofreading" | "editing";
  baselineAssetId: string;
  workingAssetId: string;
  baselineBlocks: readonly HumanReviewComparableBlock[];
  workingBlocks: readonly HumanReviewComparableBlock[];
  extractionRevision?: number;
}
```

Use block-level text comparison for V1. Do not attempt full DOCX semantic diff in this task.

- [ ] **Step 3: Mark unsupported differences honestly**

When block kind or locator indicates image, reference, caption, or table structure change, create a summary diff with `apply_capability: "unsafe_needs_manual_review"` and a matching `complexity_flags` entry.

- [ ] **Step 4: Run tests**

Run:

```powershell
pnpm --dir apps/api exec node --import tsx --test test/human-review/human-review-diff-service.spec.ts
pnpm --dir apps/api run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/modules/human-review/human-review-diff-service.ts apps/api/src/modules/human-review/index.ts apps/api/test/human-review/human-review-diff-service.spec.ts
git commit -m "feat: extract v1 human review text diffs"
```

---

### Task 5: Diff Decisions, Batch Updates, And Publish Gate

**Files:**
- Create: `apps/api/src/modules/human-review/human-review-service.ts`
- Create: `apps/api/src/modules/human-review/human-review-api.ts`
- Modify: `apps/api/src/modules/human-review/index.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Test: `apps/api/test/human-review/human-review-publish.spec.ts`

- [ ] **Step 1: Write service gate tests**

Tests must prove:

- missing decision blocks publish
- `defer` blocks publish
- `unsafe_needs_manual_review` blocks publish when rejected or inconsistent
- rejected text diffs are not sent to DOCX transform
- kept diffs are sent to DOCX transform

Expected publish gate error text:

```ts
await assert.rejects(
  () => service.publishConfirmedFinal({ manuscriptId: "m1", module: "proofreading" }),
  /all human review differences must be confirmed/u,
);
```

- [ ] **Step 2: Implement decision APIs**

Expose service methods:

- `listDiffItems`
- `updateDiffDecision`
- `batchUpdateDiffDecisions`
- `preflightPublish`
- `publishConfirmedFinal`

The service must be authoritative; front-end gating is not sufficient.

- [ ] **Step 3: Implement final generation for text V1**

Build `aiReplacements` only from `content_decision === "keep"` and `apply_capability === "auto_apply_revert"`. Exclude rejected items. Block unsafe unresolved items.

- [ ] **Step 4: Wire HTTP routes**

Add routes under `/api/v1/human-review/...` for list, update, batch update, preflight, publish.

- [ ] **Step 5: Run tests**

Run:

```powershell
pnpm --dir apps/api exec node --import tsx --test test/human-review/human-review-publish.spec.ts
pnpm --dir apps/api run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add apps/api/src/modules/human-review apps/api/src/http/api-http-server.ts apps/api/src/http/persistent-governance-runtime.ts apps/api/test/human-review/human-review-publish.spec.ts
git commit -m "feat: gate human review final publishing"
```

---

### Task 6: Publish-After Candidate Backflow

**Files:**
- Modify: `apps/api/src/modules/human-review/human-review-service.ts`
- Modify: `apps/api/src/modules/human-review/human-review-record.ts`
- Modify: `apps/api/src/modules/human-review/in-memory-human-review-repository.ts`
- Modify: `apps/api/src/modules/human-review/postgres-human-review-repository.ts`
- Test: `apps/api/test/human-review/human-review-publish.spec.ts`

- [ ] **Step 1: Write backflow tests**

Test that final asset creation succeeds even if candidate creation throws:

```ts
assert.equal(result.asset.asset_type, "human_final_docx");
assert.equal(result.backflow.summary.failed_count, 1);
const item = await repository.findDiffItemById("diff-rule-1");
assert.equal(item?.status, "writeback_failed");
```

- [ ] **Step 2: Implement post-publish backflow**

After final asset creation, for each diff item with `governance_intents.rule_candidate` or `knowledge_candidate`, create governed hit + learning candidate using existing review/learning services. Catch failures per target and persist backflow attempts.

- [ ] **Step 3: Add retry method**

Expose `retryBackflow(diffItemId)` and route. Retry only failed targets; do not duplicate successful candidates.

- [ ] **Step 4: Run tests**

Run:

```powershell
pnpm --dir apps/api exec node --import tsx --test test/human-review/human-review-publish.spec.ts
pnpm --dir apps/api run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/modules/human-review apps/api/test/human-review/human-review-publish.spec.ts
git commit -m "feat: backfill rule and knowledge candidates after publish"
```

---

### Task 7: Front-End API And Queue State

**Files:**
- Create: `apps/web/src/features/human-review/types.ts`
- Create: `apps/web/src/features/human-review/human-review-api.ts`
- Create: `apps/web/src/features/human-review/human-review-state.ts`
- Create: `apps/web/src/features/human-review/index.ts`
- Test: `apps/web/test/human-review-state.spec.ts`

- [ ] **Step 1: Write front-end state tests**

Cover filters and batch updates:

```ts
const selected = filterHumanReviewDiffItems(items, { status: "unconfirmed" });
assert.deepEqual(selected.map((item) => item.id), ["diff-1"]);
const updated = applyHumanReviewBatchDecision(selected, { content_decision: "keep" });
assert.equal(updated[0]?.content_decision, "keep");
```

- [ ] **Step 2: Add types and API client**

Mirror contract view models. Implement client calls for list, update, batch update, preflight, publish, retry backflow.

- [ ] **Step 3: Add state helpers**

Implement summaries:

- unconfirmed count
- defer count
- unsafe blocking count
- rule intent count
- knowledge intent count
- backflow failed count

- [ ] **Step 4: Run tests**

Run:

```powershell
pnpm --dir apps/web exec node --import tsx --test test/human-review-state.spec.ts
pnpm --dir apps/web run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/features/human-review apps/web/test/human-review-state.spec.ts
git commit -m "feat: add human review front-end state"
```

---

### Task 8: Shared Human Review Queue UI

**Files:**
- Create: `apps/web/src/features/human-review/human-review-queue.tsx`
- Modify: `apps/web/src/features/document-preview/onlyoffice-preview-surface.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-detail.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Test: `apps/web/test/manuscript-workbench-detail.spec.tsx`
- Test: `apps/web/test/manuscript-workbench-controller.spec.ts`

- [ ] **Step 1: Write UI tests**

Assert that the queue renders:

- content decision buttons: 保留到最终稿, 驳回, 暂不发布
- governance checkboxes: 转规则候选, 转知识候选
- no prompt candidate action
- no evidence-only action
- publish gate counts

- [ ] **Step 2: Build queue component**

Render right rail only as decision/governance UI. Do not add a complex body editor. Notes are plain optional text.

- [ ] **Step 3: Add batch controls**

Batch controls operate on current filtered items and show counts before applying.

- [ ] **Step 4: Update OnlyOffice wording**

Change save wording to make clear that saving records a work state and extracts differences; it does not create a final manuscript.

- [ ] **Step 5: Wire校对 detail page**

Use the shared queue for校对 human-review workflow. Keep old confirmation UI available only for legacy data if needed.

- [ ] **Step 6: Run tests**

Run:

```powershell
pnpm --dir apps/web exec node --import tsx --test test/manuscript-workbench-detail.spec.tsx test/manuscript-workbench-controller.spec.ts
pnpm --dir apps/web run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add apps/web/src/features/human-review apps/web/src/features/document-preview/onlyoffice-preview-surface.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-detail.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx apps/web/test/manuscript-workbench-detail.spec.tsx apps/web/test/manuscript-workbench-controller.spec.ts
git commit -m "feat: add human review diff queue"
```

---

### Task 9: Editing Module Integration

**Files:**
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/human-review/human-review-service.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-detail.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Test: `apps/api/test/editing/editing-bare-run.spec.ts`
- Test: `apps/api/test/human-review/human-review-publish.spec.ts`
- Test: `apps/web/test/manuscript-workbench-detail.spec.tsx`

- [ ] **Step 1: Add editing contract tests**

Prove editing uses the same diff item model and publishes a final edited DOCX only after all diff decisions are confirmed.

- [ ] **Step 2: Add editing baseline binding**

Treat AI `edited_docx` as baseline, OnlyOffice working asset as working state, and final edited output as the user-visible editing result.

- [ ] **Step 3: Preserve editing-specific governance**

Keep slot governance and completion gate cards as contextual side information. Do not merge them into the human-review diff ledger.

- [ ] **Step 4: Run tests**

Run:

```powershell
pnpm --dir apps/api exec node --import tsx --test test/editing/editing-bare-run.spec.ts test/human-review/human-review-publish.spec.ts
pnpm --dir apps/web exec node --import tsx --test test/manuscript-workbench-detail.spec.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/modules/editing/editing-service.ts apps/api/src/modules/human-review/human-review-service.ts apps/web/src/features/manuscript-workbench/manuscript-workbench-detail.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx apps/api/test/editing/editing-bare-run.spec.ts apps/api/test/human-review/human-review-publish.spec.ts apps/web/test/manuscript-workbench-detail.spec.tsx
git commit -m "feat: reuse human review workflow for editing"
```

---

### Task 10: End-To-End Verification And Gate

**Files:**
- Modify: `scripts/run-manuscript-workbench-gate.mjs` if needed to include the new workflow.
- Add or modify Playwright/workbench tests only if the existing gate does not cover the workflow.

- [ ] **Step 1: Run focused API tests**

```powershell
pnpm --dir apps/api exec node --import tsx --test test/human-review/*.spec.ts test/document-pipeline/onlyoffice-save-back-service.spec.ts test/proofreading/proofreading-bare-run.spec.ts test/editing/editing-bare-run.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run focused web tests**

```powershell
pnpm --dir apps/web exec node --import tsx --test test/human-review-state.spec.ts test/manuscript-workbench-detail.spec.tsx test/manuscript-workbench-controller.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Run typechecks**

```powershell
pnpm --dir packages/contracts exec tsc -p tsconfig.json --noEmit
pnpm --dir apps/api run typecheck
pnpm --dir apps/web run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run workbench gate**

```powershell
pnpm verify:manuscript-workbench
```

Expected: PASS or a clear environment-only failure documented with logs.

- [ ] **Step 5: Commit any test/gate updates**

```powershell
git add scripts/run-manuscript-workbench-gate.mjs apps/api/test apps/web/test
git commit -m "test: verify human review governance workflow"
```

---

## Self-Review Checklist

- Spec coverage: V1 scope, save-back working state, diff ledger, all-diff confirmation, publish gate, candidate backflow, front-end queue, and editing integration are represented.
- Deliberate exclusions: full DOCX semantic diff, prompt candidates, evidence-only action, screening module, and real-time OnlyOffice conflict merging are excluded from V1.
- Dependency order: contracts before repositories, repositories before save-back and diff, diff before publish gate, publish before backflow, front-end after API, editing after校对.
- Verification: every phase has focused tests and typecheck commands.
