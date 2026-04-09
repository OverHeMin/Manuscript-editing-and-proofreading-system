# Knowledge Library V2 Duplicate Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver V2.1 duplicate detection inside `knowledge-library` so authors see explainable duplicate warnings during drafting and before review submission, can still continue anyway, and leave an acknowledgement audit trail when they do.

**Architecture:** Keep duplicate detection inside the existing revision-governed knowledge flow instead of creating a new queue. Add a rule-based backend detector that compares one representative revision per asset, expose it through a dedicated HTTP endpoint plus optional submit acknowledgement payload, persist lightweight acknowledgement records in the knowledge repository layer, and let the web workbench render status, grouped signals, and a continue-anyway confirmation without changing runtime retrieval behavior.

**Tech Stack:** TypeScript, React 18, Node test runner via `tsx`, existing in-memory/Postgres knowledge repositories, Vite workbench, PostgreSQL migrations.

---

## Scope Notes

- This plan implements V2.1 only: authoring-time duplicate warnings plus acknowledgement auditability.
- Submission must remain allowed even when strong duplicate signals exist.
- Matching must stay explainable and rule-based. Do not add embeddings, vector search, or opaque similarity-only decisions.
- Duplicate results must be grouped by `knowledge_asset`, not by every revision.
- Do not change governed runtime retrieval, dynamic knowledge binding, or merge/cleanup workflows in this plan.

## File Map

**Backend duplicate detection core**
- Create: `apps/api/src/modules/knowledge/knowledge-duplicate-detection.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-record.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-repository.ts`
- Modify: `apps/api/src/modules/knowledge/in-memory-knowledge-repository.ts`
- Modify: `apps/api/src/modules/knowledge/postgres-knowledge-repository.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-service.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-api.ts`
- Modify: `apps/api/src/modules/knowledge/index.ts`
- Modify: `apps/api/src/http/api-http-server.ts`

**Persistence and verification**
- Create: `apps/api/src/database/migrations/0031_knowledge_duplicate_detection_acknowledgements.sql`
- Modify: `apps/api/src/database/migration-ledger.ts`
- Modify: `apps/api/test/database/schema.spec.ts`
- Modify: `apps/api/test/knowledge/knowledge-governance.spec.ts`
- Modify: `apps/api/test/knowledge/postgres-knowledge-persistence.spec.ts`
- Modify: `apps/api/test/http/workbench-http.spec.ts`
- Modify: `apps/api/test/http/persistent-governance-http.spec.ts`

**Web duplicate warning workflow**
- Modify: `apps/web/src/features/knowledge-library/types.ts`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-api.ts`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-controller.ts`
- Create: `apps/web/src/features/knowledge-library/knowledge-library-duplicate-panel.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-workbench-page.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-workbench.css`
- Modify: `apps/web/test/knowledge-library-controller.spec.ts`
- Create: `apps/web/test/knowledge-library-duplicate-panel.spec.tsx`
- Modify: `apps/web/test/knowledge-library-workbench-page.spec.tsx`

## Data And API Decisions To Preserve

- Add `POST /api/v1/knowledge/duplicate-check`.
- Request fields must use current authoring content, not list-summary data:
  - `currentAssetId?`
  - `currentRevisionId?`
  - `title`
  - `canonicalText`
  - `summary?`
  - `knowledgeKind`
  - `moduleScope`
  - `manuscriptTypes`
  - `sections?`
  - `riskTags?`
  - `disciplineTags?`
  - `aliases?`
  - `bindings?`
- Response must return grouped-by-asset matches with:
  - `severity: "exact" | "high" | "possible"`
  - `score`
  - `matched_asset_id`
  - `matched_revision_id`
  - `matched_title`
  - `matched_status`
  - `matched_summary?`
  - `reasons`
- Reasons must stay explainable:
  - `canonical_text_exact_match`
  - `canonical_text_high_overlap`
  - `title_exact_match`
  - `title_high_similarity`
  - `alias_overlap`
  - `same_knowledge_kind`
  - `same_module_scope`
  - `manuscript_type_overlap`
  - `binding_overlap`
- Representative comparison unit:
  - approved revision if the asset has one
  - otherwise current working revision
- Submit acknowledgement payload stays optional and non-blocking:

```ts
interface DuplicateWarningAcknowledgementInput {
  acknowledged: boolean;
  matchedAssetIds: string[];
}
```

## Task 1: Establish the duplicate detection domain and in-memory behavior

**Files:**
- Create: `apps/api/src/modules/knowledge/knowledge-duplicate-detection.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-record.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-repository.ts`
- Modify: `apps/api/src/modules/knowledge/in-memory-knowledge-repository.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-service.ts`
- Modify: `apps/api/src/modules/knowledge/index.ts`
- Modify: `apps/api/test/knowledge/knowledge-governance.spec.ts`

- [ ] **Step 1: Write the failing knowledge-domain tests for asset-level duplicate matching**

Add focused coverage for:
- exact match on normalized `canonical_text`
- high match on strong title or canonical overlap plus shared scope
- possible match on weaker contextual overlap
- self-match exclusion when `currentAssetId` or `currentRevisionId` is provided
- one result per asset even when the asset has multiple revisions
- approved revision winning over a newer draft as the representative duplicate candidate

- [ ] **Step 2: Run the focused API knowledge test to confirm failure**

Run: `pnpm --filter @medical/api run test -- knowledge/knowledge-governance.spec.ts`
Expected: FAIL because duplicate-check records, repository methods, and service APIs do not exist yet.

- [ ] **Step 3: Add the duplicate domain types and matching helper**

Implement in `knowledge-record.ts` and `knowledge-duplicate-detection.ts`:
- `KnowledgeDuplicateSeverity`
- `KnowledgeDuplicateReason`
- `KnowledgeDuplicateMatchRecord`
- `KnowledgeDuplicateCheckInput`
- `KnowledgeDuplicateAcknowledgementRecord`
- normalization helpers for whitespace, punctuation, and full-width/half-width cleanup
- deterministic overlap scoring helpers for canonical text, title, aliases, manuscript types, and bindings
- representative-revision selection that uses the approved revision when present, otherwise the current working revision

- [ ] **Step 4: Wire the in-memory repository and service to the new detector**

Implement:
- repository reads that surface duplicate-check candidates grouped by asset
- `knowledgeService.checkDuplicates(...)`
- optional submit acknowledgement input on revision-governed submit paths without turning acknowledgement into a hard gate
- sorting that returns `exact` before `high`, then `possible`, with stable score ordering inside each tier

- [ ] **Step 5: Re-run the focused API knowledge test**

Run: `pnpm --filter @medical/api run test -- knowledge/knowledge-governance.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit the backend duplicate core**

```bash
git add apps/api/src/modules/knowledge apps/api/test/knowledge/knowledge-governance.spec.ts
git commit -m "feat: add knowledge duplicate detection core"
```

## Task 2: Persist duplicate acknowledgement records and Postgres candidate reads

**Files:**
- Create: `apps/api/src/database/migrations/0031_knowledge_duplicate_detection_acknowledgements.sql`
- Modify: `apps/api/src/database/migration-ledger.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-repository.ts`
- Modify: `apps/api/src/modules/knowledge/postgres-knowledge-repository.ts`
- Modify: `apps/api/test/database/schema.spec.ts`
- Modify: `apps/api/test/knowledge/postgres-knowledge-persistence.spec.ts`

- [ ] **Step 1: Write the failing Postgres persistence and schema tests**

Cover:
- `knowledge_duplicate_acknowledgements` table exists with:
  - `id`
  - `revision_id`
  - `matched_asset_ids`
  - `highest_severity`
  - `acknowledged_by_role`
  - `created_at`
- repository can persist and read acknowledgement rows for a revision
- Postgres duplicate detection still selects the approved representative revision per asset
- schema ledger includes the new `0031` migration and its lookup index

- [ ] **Step 2: Run the persistence and schema tests to confirm failure**

Run:
- `pnpm --filter @medical/api run test -- knowledge/postgres-knowledge-persistence.spec.ts`
- `pnpm --filter @medical/api run test -- database/schema.spec.ts`
Expected: FAIL on the missing acknowledgement table, missing migration ledger entry, or missing repository methods.

- [ ] **Step 3: Add the migration and Postgres repository support**

Create `0031_knowledge_duplicate_detection_acknowledgements.sql` with:
- the acknowledgement table
- a foreign key from `revision_id` to `knowledge_revisions.id`
- `text[]` storage for `matched_asset_ids`
- an index on `(revision_id, created_at desc)` for audit lookup

Update:
- `migration-ledger.ts`
- `schema.spec.ts` table and index expectations
- `PostgresKnowledgeRepository` methods for acknowledgement save/list and duplicate candidate projection

- [ ] **Step 4: Re-run the persistence and schema tests**

Run:
- `pnpm --filter @medical/api run test -- knowledge/postgres-knowledge-persistence.spec.ts`
- `pnpm --filter @medical/api run test -- database/schema.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit the persistence slice**

```bash
git add apps/api/src/database apps/api/src/modules/knowledge/postgres-knowledge-repository.ts apps/api/test/database/schema.spec.ts apps/api/test/knowledge/postgres-knowledge-persistence.spec.ts
git commit -m "feat: persist knowledge duplicate acknowledgements"
```

## Task 3: Expose duplicate-check and acknowledgement-aware submit routes

**Files:**
- Modify: `apps/api/src/modules/knowledge/knowledge-api.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/test/http/workbench-http.spec.ts`
- Modify: `apps/api/test/http/persistent-governance-http.spec.ts`

- [ ] **Step 1: Write the failing HTTP tests for duplicate-check and continue-anyway submit**

Cover:
- `POST /api/v1/knowledge/duplicate-check` returns explainable `exact`, `high`, and `possible` matches
- `POST /api/v1/knowledge/revisions/:revisionId/submit` accepts an optional duplicate acknowledgement payload
- `POST /api/v1/knowledge/:knowledgeItemId/submit` stays backward compatible when no acknowledgement is provided
- persistent governance restart tests can still read the recorded acknowledgement after the submit flow

- [ ] **Step 2: Run the focused HTTP tests to confirm failure**

Run:
- `pnpm --filter @medical/api run test -- http/workbench-http.spec.ts`
- `pnpm --filter @medical/api run test -- http/persistent-governance-http.spec.ts`
Expected: FAIL because the new route is unknown and submit handlers do not accept or persist acknowledgement payloads.

- [ ] **Step 3: Implement the HTTP route and payload wiring**

Add:
- route matching for `POST /api/v1/knowledge/duplicate-check`
- request parsing for duplicate-check inputs
- optional submit acknowledgement parsing on both submit endpoints
- session-role forwarding so acknowledgement audit rows record the real authenticated role instead of a hard-coded fallback

- [ ] **Step 4: Re-run the focused HTTP tests**

Run:
- `pnpm --filter @medical/api run test -- http/workbench-http.spec.ts`
- `pnpm --filter @medical/api run test -- http/persistent-governance-http.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit the HTTP slice**

```bash
git add apps/api/src/modules/knowledge/knowledge-api.ts apps/api/src/http/api-http-server.ts apps/api/test/http/workbench-http.spec.ts apps/api/test/http/persistent-governance-http.spec.ts
git commit -m "feat: expose knowledge duplicate check routes"
```

## Task 4: Add web API and controller support for duplicate warnings

**Files:**
- Modify: `apps/web/src/features/knowledge-library/types.ts`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-api.ts`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-controller.ts`
- Modify: `apps/web/test/knowledge-library-controller.spec.ts`

- [ ] **Step 1: Write the failing controller tests**

Cover:
- `checkDuplicates` posts the full draft payload to `/api/v1/knowledge/duplicate-check`
- `submitDraftAndLoad` can include `duplicateAcknowledgement`
- existing load/create/save/derive flows keep their current request order
- duplicate response types preserve `severity`, `score`, `matched_asset_id`, `matched_revision_id`, `matched_summary`, and `reasons`

- [ ] **Step 2: Run the focused web controller test to confirm failure**

Run: `pnpm --filter @medsys/web run test -- knowledge-library-controller.spec.ts`
Expected: FAIL because the duplicate-check client and acknowledgement-aware submit path do not exist yet.

- [ ] **Step 3: Implement the web client and controller extensions**

Add:
- `DuplicateKnowledgeMatchViewModel`
- `DuplicateKnowledgeReason`
- `DuplicateKnowledgeCheckInput`
- `DuplicateWarningAcknowledgementInput`
- `checkKnowledgeDuplicates(client, input)`
- controller methods for on-demand duplicate checks and acknowledgement-aware submit

- [ ] **Step 4: Re-run the focused web controller test**

Run: `pnpm --filter @medsys/web run test -- knowledge-library-controller.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit the controller slice**

```bash
git add apps/web/src/features/knowledge-library/types.ts apps/web/src/features/knowledge-library/knowledge-library-api.ts apps/web/src/features/knowledge-library/knowledge-library-controller.ts apps/web/test/knowledge-library-controller.spec.ts
git commit -m "feat: add knowledge library duplicate warning client flow"
```

## Task 5: Render duplicate signals and continue-anyway submit in the workbench

**Files:**
- Create: `apps/web/src/features/knowledge-library/knowledge-library-duplicate-panel.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-workbench-page.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-workbench.css`
- Create: `apps/web/test/knowledge-library-duplicate-panel.spec.tsx`
- Modify: `apps/web/test/knowledge-library-workbench-page.spec.tsx`

- [ ] **Step 1: Write the failing duplicate UI render tests**

Cover:
- inline status row states:
  - `Not checked`
  - `Checking duplicates...`
  - `No strong duplicate signals`
  - `N strong duplicate matches found`
- grouped panel sections:
  - `Exact Matches`
  - `High Similarity`
  - `Possible Overlap`
- duplicate cards render matched title, asset id, revision id, status, summary, and reasons
- the page renders the duplicate panel beside the editor
- strong matches trigger a submit confirmation shell with:
  - `Open Existing Asset`
  - `Continue Anyway`

- [ ] **Step 2: Run the focused workbench render tests to confirm failure**

Run:
- `pnpm --filter @medsys/web run test -- knowledge-library-duplicate-panel.spec.tsx`
- `pnpm --filter @medsys/web run test -- knowledge-library-workbench-page.spec.tsx`
Expected: FAIL because the duplicate panel, status row, and confirmation UI do not exist yet.

- [ ] **Step 3: Implement duplicate state, panel rendering, and confirmation behavior**

Implement:
- a presentational duplicate panel component that groups matches by severity tier
- debounced server-side duplicate checks when draft fields change enough to matter
- stale-state handling so edits made after the last check are visible to the author
- `Open Existing Asset` actions that load the selected asset detail
- pre-submit confirmation only when `exact` or `high` matches exist
- `Continue Anyway` submitting with acknowledgement while leaving `possible` matches informational only

- [ ] **Step 4: Re-run the focused workbench render tests**

Run:
- `pnpm --filter @medsys/web run test -- knowledge-library-duplicate-panel.spec.tsx`
- `pnpm --filter @medsys/web run test -- knowledge-library-workbench-page.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit the workbench UI slice**

```bash
git add apps/web/src/features/knowledge-library apps/web/test/knowledge-library-duplicate-panel.spec.tsx apps/web/test/knowledge-library-workbench-page.spec.tsx
git commit -m "feat: add knowledge library duplicate warning UI"
```

## Task 6: Run the verification sweep and prepare the branch for review

**Files:**
- Verify only

- [ ] **Step 1: Run the focused API test suite**

Run:
- `pnpm --filter @medical/api run test -- knowledge/knowledge-governance.spec.ts`
- `pnpm --filter @medical/api run test -- knowledge/postgres-knowledge-persistence.spec.ts`
- `pnpm --filter @medical/api run test -- database/schema.spec.ts`
- `pnpm --filter @medical/api run test -- http/workbench-http.spec.ts`
- `pnpm --filter @medical/api run test -- http/persistent-governance-http.spec.ts`
Expected: PASS.

- [ ] **Step 2: Run API and web typechecks**

Run:
- `pnpm --filter @medical/api run typecheck`
- `pnpm --filter @medsys/web run typecheck`
Expected: PASS.

- [ ] **Step 3: Run the focused web test suite**

Run:
- `pnpm --filter @medsys/web run test -- knowledge-library-controller.spec.ts`
- `pnpm --filter @medsys/web run test -- knowledge-library-duplicate-panel.spec.tsx`
- `pnpm --filter @medsys/web run test -- knowledge-library-workbench-page.spec.tsx`
Expected: PASS.

- [ ] **Step 4: Run the repository gate**

Run: `pnpm verify:manuscript-workbench`
Expected: PASS.

- [ ] **Step 5: Review the final diff**

Run: `git status --short`
Expected: clean working tree or only intentional, already-reviewed plan/execution files.

- [ ] **Step 6: Summarize V2.2 work that stays out of this branch**

Call out:
- merge console
- bulk duplicate cleanup
- duplicate queue
- clustering or embeddings
- operator-driven survivor selection

## Definition Of Done

- Authors can request duplicate signals from the current `knowledge-library` draft form before review submission.
- Duplicate results show one entry per asset, not one entry per revision.
- Strong matches render explainable reasons and are grouped into `Exact Matches` and `High Similarity`.
- `Possible Overlap` remains informational only.
- `Submit To Review` can still continue after acknowledgement and does not become a hard server-side block.
- A lightweight acknowledgement audit record is stored when a strong warning is acknowledged during submit.
- Existing knowledge authoring, review queue, and governed runtime paths continue to work without regression.
