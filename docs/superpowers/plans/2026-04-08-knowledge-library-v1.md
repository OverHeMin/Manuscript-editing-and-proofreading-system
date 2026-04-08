# Knowledge Library V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver V1 of the standalone `knowledge-library` workbench with revision-based authoring, structured bindings, revision-centric review, and compatibility for existing runtime knowledge retrieval.

**Architecture:** Keep the new source of truth in `knowledge_asset + knowledge_revision + knowledge_revision_binding + knowledge_review_action`, but preserve the existing flat `KnowledgeRecord` as a compatibility projection for runtime selection, execution governance, and older persistence seeds. The web app gets a new `knowledge-library` workbench for authoring, `knowledge-review` becomes revision-centric, and `template-governance` stops owning knowledge entry.

**Tech Stack:** TypeScript, React 18, Node test runner, existing in-memory/Postgres repositories, Vite web workbench, PostgreSQL migrations.

---

## File Map

**Backend core**
- Modify: `packages/contracts/src/knowledge.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-record.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-repository.ts`
- Modify: `apps/api/src/modules/knowledge/in-memory-knowledge-repository.ts`
- Modify: `apps/api/src/modules/knowledge/postgres-knowledge-repository.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-service.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-api.ts`
- Modify: `apps/api/src/modules/knowledge/index.ts`
- Modify: `apps/api/src/modules/shared/module-run-support.ts`
- Modify: `apps/api/src/modules/shared/governed-module-context-resolver.ts`
- Modify: `apps/api/src/modules/execution-governance/execution-governance-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-projection-service.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`

**Backend schema / tests**
- Create: `apps/api/src/database/migrations/0030_knowledge_library_v1_revision_governance.sql`
- Modify: `apps/api/test/database/schema.spec.ts`
- Modify: `apps/api/test/knowledge/knowledge-governance.spec.ts`
- Modify: `apps/api/test/knowledge/postgres-knowledge-persistence.spec.ts`
- Modify: `apps/api/test/http/persistent-governance-http.spec.ts`
- Modify: `apps/api/test/http/workbench-http.spec.ts`

**Web workbench**
- Modify: `apps/web/src/features/auth/workbench.ts`
- Modify: `apps/web/src/app/workbench-routing.ts`
- Modify: `apps/web/src/app/workbench-navigation.ts`
- Modify: `apps/web/src/app/workbench-host.tsx`
- Create: `apps/web/src/features/knowledge-library/index.ts`
- Create: `apps/web/src/features/knowledge-library/types.ts`
- Create: `apps/web/src/features/knowledge-library/knowledge-library-api.ts`
- Create: `apps/web/src/features/knowledge-library/knowledge-library-controller.ts`
- Create: `apps/web/src/features/knowledge-library/knowledge-library-workbench-page.tsx`
- Create: `apps/web/src/features/knowledge-library/knowledge-library-workbench.css`
- Modify: `apps/web/src/features/knowledge/types.ts`
- Modify: `apps/web/src/features/knowledge/knowledge-api.ts`
- Modify: `apps/web/src/features/knowledge/index.ts`
- Modify: `apps/web/src/features/knowledge-review/workbench-state.ts`
- Modify: `apps/web/src/features/knowledge-review/workbench-controller.ts`
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-workbench-page.tsx`
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-queue-pane.tsx`
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-detail-pane.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-controller.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`

**Web tests**
- Create: `apps/web/test/knowledge-library-controller.spec.ts`
- Create: `apps/web/test/knowledge-library-workbench-page.spec.tsx`
- Modify: `apps/web/test/knowledge-review-workbench-page.spec.tsx`
- Modify: `apps/web/test/template-governance-controller.spec.ts`
- Modify: `apps/web/test/template-governance-workbench-page.spec.tsx`
- Modify: `apps/web/test/workbench-host.spec.tsx`

### Task 1: Establish the revision-based backend model

**Files:**
- Modify: `packages/contracts/src/knowledge.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-record.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-repository.ts`
- Modify: `apps/api/src/modules/knowledge/in-memory-knowledge-repository.ts`
- Modify: `apps/api/test/knowledge/knowledge-governance.spec.ts`

- [ ] **Step 1: Write failing in-memory governance tests for asset/revision/binding lifecycle**

Add expectations for:
- creating `asset + revision-1 + bindings`
- reject moving a pending revision back to `draft`
- approved asset edits creating `revision-2 draft`
- review actions attaching to `revision_id`

- [ ] **Step 2: Run the focused API knowledge test to verify it fails**

Run: `pnpm --filter @medical/api test -- knowledge-governance`
Expected: FAIL with missing revision fields or lifecycle methods.

- [ ] **Step 3: Introduce the new records and in-memory repository behavior**

Implement:
- `KnowledgeAssetRecord`
- `KnowledgeRevisionRecord`
- `KnowledgeRevisionBindingRecord`
- revision-centric `KnowledgeReviewActionRecord`
- compatibility projection helpers for authoring list vs approved runtime list

- [ ] **Step 4: Update `KnowledgeService` to use revision lifecycle rules**

Implement:
- create draft asset
- update draft revision
- submit / approve / reject
- derive draft from approved asset
- authoring list/detail projection
- approved runtime projection queries

- [ ] **Step 5: Re-run the focused API knowledge test**

Run: `pnpm --filter @medical/api test -- knowledge-governance`
Expected: PASS.

### Task 2: Add PostgreSQL persistence and migration for the new source of truth

**Files:**
- Create: `apps/api/src/database/migrations/0030_knowledge_library_v1_revision_governance.sql`
- Modify: `apps/api/src/modules/knowledge/postgres-knowledge-repository.ts`
- Modify: `apps/api/test/knowledge/postgres-knowledge-persistence.spec.ts`
- Modify: `apps/api/test/database/schema.spec.ts`

- [ ] **Step 1: Write failing Postgres persistence tests for revision tables and legacy fallback**

Cover:
- new asset/revision/binding persistence
- review actions keyed by `revision_id`
- old `knowledge_items` seed rows still readable through compatibility queries

- [ ] **Step 2: Run the Postgres knowledge persistence test to verify it fails**

Run: `pnpm --filter @medical/api test -- postgres-knowledge-persistence`
Expected: FAIL on missing tables or missing revision-aware reads.

- [ ] **Step 3: Add migration `0030_knowledge_library_v1_revision_governance.sql`**

Create:
- `knowledge_assets`
- `knowledge_revisions`
- `knowledge_revision_bindings`
- `revision_id` support on `knowledge_review_actions`
- indexes for asset, revision status, approved revision, and bindings

- [ ] **Step 4: Implement Postgres repository reads/writes**

Implement:
- new-table reads for authoring projections
- approved-runtime reads for module execution
- legacy `knowledge_items` fallback for old fixtures and direct SQL seeds

- [ ] **Step 5: Update schema expectations**

Adjust:
- migration ledger expectations
- table/index assertions only where the new migration must be visible

- [ ] **Step 6: Re-run persistence and schema checks**

Run:
- `pnpm --filter @medical/api test -- postgres-knowledge-persistence`
- `pnpm --filter @medical/api test -- schema`
Expected: PASS.

### Task 3: Expose revision-aware HTTP routes while keeping compatibility

**Files:**
- Modify: `apps/api/src/modules/knowledge/knowledge-api.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Modify: `apps/api/test/http/workbench-http.spec.ts`
- Modify: `apps/api/test/http/persistent-governance-http.spec.ts`

- [ ] **Step 1: Write failing HTTP tests for `knowledge-library` and revision-centric review**

Cover:
- create draft asset
- derive draft from approved asset
- review queue returning `revisionId + assetId`
- review history bound to revision

- [ ] **Step 2: Run the targeted HTTP tests to verify they fail**

Run:
- `pnpm --filter @medical/api test -- workbench-http`
- `pnpm --filter @medical/api test -- persistent-governance-http`
Expected: FAIL on unknown routes or old payload shape.

- [ ] **Step 3: Implement new routes**

Add routes for:
- `GET /api/v1/knowledge/library`
- `GET /api/v1/knowledge/assets/:assetId`
- `POST /api/v1/knowledge/assets/drafts`
- `POST /api/v1/knowledge/assets/:assetId/revisions`
- `POST /api/v1/knowledge/revisions/:revisionId/draft`
- `POST /api/v1/knowledge/revisions/:revisionId/submit`
- `POST /api/v1/knowledge/revisions/:revisionId/approve`
- `POST /api/v1/knowledge/revisions/:revisionId/reject`
- `GET /api/v1/knowledge/revisions/:revisionId/review-actions`

- [ ] **Step 4: Keep compatibility endpoints alive**

Preserve:
- `/api/v1/knowledge`
- `/api/v1/knowledge/review-queue`
- legacy payloads where still needed by non-library callers

- [ ] **Step 5: Re-run the targeted HTTP tests**

Run:
- `pnpm --filter @medical/api test -- workbench-http`
- `pnpm --filter @medical/api test -- persistent-governance-http`
Expected: PASS.

### Task 4: Protect runtime retrieval and execution-governance compatibility

**Files:**
- Modify: `apps/api/src/modules/shared/module-run-support.ts`
- Modify: `apps/api/src/modules/shared/governed-module-context-resolver.ts`
- Modify: `apps/api/src/modules/execution-governance/execution-governance-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-projection-service.ts`

- [ ] **Step 1: Write a failing regression around approved-runtime knowledge selection**

Cover:
- approved asset with a new draft still stays eligible for runtime
- expired or not-yet-effective approved revisions are filtered out
- execution binding rules still resolve by stable asset id

- [ ] **Step 2: Run focused execution knowledge tests to verify failure**

Run: `pnpm --filter @medical/api test -- execution-governance execution-resolution knowledge-retrieval`
Expected: FAIL where callers still consume the wrong projection.

- [ ] **Step 3: Switch runtime callers to approved/effective projections**

Update:
- dynamic knowledge selection
- governed module resolution
- binding-rule approval checks
- editorial rule projection refresh writes

- [ ] **Step 4: Re-run focused execution knowledge tests**

Run: `pnpm --filter @medical/api test -- execution-governance execution-resolution knowledge-retrieval`
Expected: PASS.

### Task 5: Create the standalone `knowledge-library` web workbench

**Files:**
- Modify: `apps/web/src/features/auth/workbench.ts`
- Modify: `apps/web/src/app/workbench-routing.ts`
- Modify: `apps/web/src/app/workbench-navigation.ts`
- Modify: `apps/web/src/app/workbench-host.tsx`
- Create: `apps/web/src/features/knowledge-library/*`
- Create: `apps/web/test/knowledge-library-controller.spec.ts`
- Create: `apps/web/test/knowledge-library-workbench-page.spec.tsx`
- Modify: `apps/web/test/workbench-host.spec.tsx`

- [ ] **Step 1: Write failing web tests for the new workbench shell and controller**

Cover:
- `knowledge-library` route parsing with `assetId` and `revisionId`
- admin / knowledge reviewer navigation visibility
- authoring shell rendering list, editor, binding, history

- [ ] **Step 2: Run the focused web tests to verify they fail**

Run: `pnpm --filter @medsys/web test -- knowledge-library workbench-host`
Expected: FAIL because the workbench and route do not exist yet.

- [ ] **Step 3: Implement the new workbench types, API client, controller, and page**

Build:
- list/search/filter
- asset/revision detail loading
- create draft
- update draft
- create update draft from approved asset
- structured binding editor
- submit to review
- revision history rail

- [ ] **Step 4: Register the workbench in auth, routing, navigation, and host**

Assumption to ship unless changed:
- `admin` and `knowledge_reviewer` can open `knowledge-library`
- `knowledge_reviewer` defaults to `knowledge-library`
- admin core navigation becomes `screening / editing / proofreading / knowledge-library`

- [ ] **Step 5: Re-run the focused web tests**

Run: `pnpm --filter @medsys/web test -- knowledge-library workbench-host`
Expected: PASS.

### Task 6: Migrate `knowledge-review` to revision-centric review

**Files:**
- Modify: `apps/web/src/features/knowledge/types.ts`
- Modify: `apps/web/src/features/knowledge/knowledge-api.ts`
- Modify: `apps/web/src/features/knowledge-review/workbench-state.ts`
- Modify: `apps/web/src/features/knowledge-review/workbench-controller.ts`
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-workbench-page.tsx`
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-queue-pane.tsx`
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-detail-pane.tsx`
- Modify: `apps/web/test/knowledge-review-workbench-page.spec.tsx`

- [ ] **Step 1: Write failing review-workbench tests for revision ids**

Cover:
- queue item identity uses `revisionId`
- detail pane shows asset + revision context
- approve / reject calls revision endpoints
- reject returns to draft and queue advances cleanly

- [ ] **Step 2: Run the focused review tests to verify they fail**

Run: `pnpm --filter @medsys/web test -- knowledge-review-workbench`
Expected: FAIL on old item identity or old HTTP client URLs.

- [ ] **Step 3: Update the review state and UI**

Implement:
- revision-centric queue item model
- history loads from revision routes
- handoff route reads `revisionId`
- action success flow keeps queue continuity

- [ ] **Step 4: Re-run the focused review tests**

Run: `pnpm --filter @medsys/web test -- knowledge-review-workbench`
Expected: PASS.

### Task 7: Remove knowledge authoring from `template-governance`

**Files:**
- Modify: `apps/web/src/features/template-governance/template-governance-controller.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Modify: `apps/web/test/template-governance-controller.spec.ts`
- Modify: `apps/web/test/template-governance-workbench-page.spec.tsx`

- [ ] **Step 1: Write failing template-governance tests for the new handoff card**

Cover:
- knowledge authoring forms no longer render inside rule center
- knowledge section becomes summary + deep-link to `#knowledge-library`

- [ ] **Step 2: Run template-governance tests to verify they fail**

Run: `pnpm --filter @medsys/web test -- template-governance`
Expected: FAIL because the old embedded knowledge UI still renders.

- [ ] **Step 3: Replace embedded knowledge authoring with a redirect / summary panel**

Keep:
- template family, rule, instruction authoring

Remove:
- direct knowledge draft create/update/submit flows

- [ ] **Step 4: Re-run template-governance tests**

Run: `pnpm --filter @medsys/web test -- template-governance`
Expected: PASS.

### Task 8: Final verification sweep

**Files:**
- Verify only

- [ ] **Step 1: Run API knowledge and HTTP verification**

Run:
- `pnpm --filter @medical/api test -- knowledge`
- `pnpm --filter @medical/api test -- http`
- `pnpm --filter @medical/api typecheck`

- [ ] **Step 2: Run web verification**

Run:
- `pnpm --filter @medsys/web test -- knowledge-library knowledge-review template-governance workbench-host`
- `pnpm --filter @medsys/web typecheck`

- [ ] **Step 3: Run a final git diff review**

Run: `git status --short`
Expected: only the planned V1 implementation files are changed.

- [ ] **Step 4: Summarize outcomes and remaining V2 work**

Call out:
- batch import
- duplicate detection
- analytics / operations metrics
- stronger retrieval ranking evolution
