# Rule Knowledge Learning Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make manuscript processing `转规则 / 转知识` flow into the existing rule center and knowledge library as real editable, auditable, publishable assets.

**Architecture:** Learning candidates remain evidence and prefill records. Rule candidates open the existing rule center wizard and publish through existing rule governance. Knowledge candidates open the existing knowledge library ledger editor, save as revision-governed drafts through learning writeback, then use the existing submit-review-approve knowledge flow. Effect columns are read-only summaries from rule activation metrics and knowledge hit logs.

**Tech Stack:** TypeScript, React, Vite, Node.js test runner, existing HTTP API server, learning governance, knowledge governance, execution tracking, in-memory and Postgres repositories.

---

## Scope

Work on branch `codex/rule-knowledge-learning-design`.

Before any write or commit:

```bash
git branch --show-current
git status --short --branch
```

In scope:

- Learning candidate filtering by type/status/module/manuscript.
- Direct workbench routing: rule candidates to rule center, knowledge candidates to knowledge library.
- Knowledge candidate prefill using the same fields as knowledge library creation.
- Knowledge writeback that creates a full revision-governed draft, not an approved knowledge item.
- Source traceability through `sourceLearningCandidateId` after save and reload.
- Manual submission to knowledge review through the existing knowledge library/review APIs.
- Derived effect columns in knowledge library and rule center ledgers.

Out of scope:

- New global learning center, global queue, or separate回流中心.
- AI auto-publishing rules or knowledge.
- Frontend implicit `approveLearningCandidate`.
- Storing mutable hit counts on core rule or knowledge definition rows.
- Inventing metrics that do not have a real log source.
- Rebuilding classic/legacy views beyond what is needed for the main ledger paths.

## Constraints From Feasibility Review

- Do not call `approveLearningCandidate` automatically from the knowledge editor. Candidate approval remains explicit learning-review governance.
- Saving a knowledge candidate creates a draft. Submitting that draft to knowledge review is a separate existing action.
- Preserve `sourceLearningCandidateId` through backend response mapping and frontend composer reload; otherwise traceability is lost after the first save.
- Add a Postgres index for `knowledge_hit_logs(knowledge_item_id, created_at, id)` before adding per-item usage queries.
- Prefer batch usage aggregation where possible to avoid adding another heavy N+1 path to knowledge list rendering.
- Rule center ledger must also expose derived effect fields; knowledge metrics alone do not satisfy the requirement.

## Task 1: Filter Learning Candidates And Preserve Target Routing Inputs

**Files:**

- Create: `apps/api/test/learning/learning-candidate-filtering.spec.ts`
- Modify: `apps/api/src/modules/learning/learning-api.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/web/src/features/learning-review/learning-review-api.ts`
- Test: `apps/web/test/learning-review-api.spec.ts`

Steps:

- [ ] Write a failing API test proving `listLearningCandidates({ type, status, module, manuscriptId })` returns only matching candidates.
- [ ] Run the focused API test and confirm the failure is due to missing API input support.
- [ ] Pass `ListLearningCandidatesInput` through `createLearningApi`.
- [ ] Parse `/api/v1/learning/candidates` query params in the HTTP server and ignore invalid filter values.
- [ ] Add web client serialization for `type/status/module/manuscriptId`.
- [ ] Run focused API and web API tests.
- [ ] Commit only these files.

Acceptance:

- Rule and knowledge workbenches can request only the candidate type they own.
- Existing unfiltered learning review calls still work.

## Task 2: Split Manuscript Candidate Links By Real Workbench

**Files:**

- Modify: `apps/web/src/app/workbench-routing.ts`
- Modify: `apps/web/src/app/workbench-host.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Test: relevant manuscript summary/routing tests under `apps/web/test/**`

Steps:

- [ ] Add failing tests for `knowledge_candidate` links opening `knowledge-library` with `learningCandidateId`.
- [ ] Add failing tests proving `rule_candidate` links still open template governance/rule center with `learningCandidateId`.
- [ ] Keep `learningCandidateId` serialized and parsed for knowledge library routes.
- [ ] Change manuscript summary link selection so knowledge candidates no longer route to template governance.
- [ ] Pass the route candidate id into the knowledge library ledger page.
- [ ] Run focused web tests.
- [ ] Commit only these files.

Acceptance:

- A user who clicks a knowledge candidate lands in the knowledge library editor path.
- A user who clicks a rule candidate lands in the rule center path.
- No global queue or route chooser is introduced.

## Task 3: Build Knowledge Candidate Prefill And Source Traceability

**Files:**

- Create: `apps/web/src/features/knowledge-library/knowledge-candidate-prefill.ts`
- Create: `apps/web/src/features/knowledge-library/knowledge-candidate-source-strip.tsx`
- Create/modify tests: `apps/web/test/knowledge-candidate-prefill.spec.ts` and focused knowledge library tests.
- Modify: `apps/web/src/features/knowledge-library/types.ts`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-composer.ts`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-api.ts`
- Modify backend knowledge response mapping if the frontend type needs `source_learning_candidate_id`.

Steps:

- [ ] Write a failing mapper test proving `knowledge_candidate.candidate_payload.knowledge_prefill` becomes full composer draft fields: title, canonical text, summary, kind, module, manuscript type, sections, risk tags, discipline tags, aliases, evidence level, source type, content block, and semantic layer.
- [ ] Write a failing reload test proving saved knowledge revisions expose and rehydrate `sourceLearningCandidateId`.
- [ ] Implement the pure prefill mapper.
- [ ] Carry `sourceLearningCandidateId` and read-only source summary in composer state.
- [ ] Render a compact source/evidence strip when a composer comes from a candidate.
- [ ] Map `source_learning_candidate_id` in API responses and frontend types.
- [ ] Run focused knowledge library tests and web typecheck if feasible.
- [ ] Commit only these files.

Acceptance:

- Knowledge candidate editing uses the real knowledge library creation shape, not a simplified form.
- Source candidate traceability survives save, reload, and later edits.

## Task 4: Create Full Knowledge Drafts Through Learning Writeback

**Files:**

- Modify: `apps/api/src/modules/knowledge/knowledge-service.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-api.ts` if response mapping is needed.
- Modify: `apps/api/src/modules/learning-governance/learning-governance-service.ts`
- Modify: `apps/api/src/modules/learning-governance/learning-governance-api.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/web/src/features/learning-governance/types.ts`
- Test: `apps/api/test/learning-governance/learning-governance.spec.ts`
- Test: `apps/web/src/features/learning-governance.type-test.ts`

Steps:

- [ ] Write a failing backend test where `knowledge_reviewer` applies a `knowledge_item` writeback and receives a revision-governed draft asset id.
- [ ] Write or extend HTTP-level coverage for the same permission path if an existing HTTP harness is available.
- [ ] Split learning-governance writeback permissions by target:
  - `editorial_rule_draft`: existing rule/admin permission.
  - `knowledge_item`: `learning.review` plus knowledge reviewer/manage capability already used by knowledge review.
  - unknown targets: current admin/manage fallback.
- [ ] Update HTTP route permission gates so they do not block valid knowledge reviewers before service-level permission checks run.
- [ ] Add `createLibraryDraftFromLearningCandidate` only if the existing `createLibraryDraft` path cannot already accept all required source fields.
- [ ] Ensure writeback creates a draft/revision and does not approve or publish it.
- [ ] Preserve full knowledge fields, content blocks, semantic layer, bindings, and `sourceLearningCandidateId`.
- [ ] Run focused learning-governance tests and type tests.
- [ ] Commit only these files.

Acceptance:

- Knowledge candidate writeback creates a real knowledge library draft.
- The created draft still requires existing submit-review-approve flow before becoming usable approved knowledge.
- A knowledge reviewer is not blocked by unrelated `permissions.manage` requirements.

## Task 5: Wire Knowledge Candidate Save Into The Existing Knowledge Review Flow

**Files:**

- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-controller.ts`
- Modify: `apps/web/src/features/learning-governance/learning-governance-api.ts`
- Modify tests under `apps/web/test/knowledge-library-*.spec.*`

Steps:

- [ ] Write a failing frontend test for opening a knowledge candidate, saving it once through learning writeback, then loading the created draft in the normal composer.
- [ ] Write a failing test or extend an existing one proving submit-to-review still uses the existing knowledge library action and does not happen during save.
- [ ] Load candidate detail by `learningCandidateId` when the knowledge library route contains it.
- [ ] Create/apply one `knowledge_item` writeback on first save.
- [ ] After writeback, load the created draft asset through the normal knowledge library path.
- [ ] For subsequent saves, use existing draft/update behavior, not another writeback.
- [ ] Show clear UI status: `已从学习候选创建知识草稿，需提交知识审核后才能生效`.
- [ ] Run focused frontend tests.
- [ ] Commit only these files.

Acceptance:

- The回流工作区 is not a display-only page: the user can edit, save a real draft, submit it for review, and later approve through existing knowledge review.
- No hidden candidate approval or hidden knowledge publication occurs.

## Task 6: Add Derived Knowledge Usage Metrics

**Files:**

- Create: `apps/api/src/modules/knowledge/knowledge-usage-metrics.ts`
- Create: `apps/api/test/knowledge/knowledge-usage-metrics.spec.ts`
- Modify: `apps/api/src/modules/execution-tracking/execution-tracking-repository.ts`
- Modify: `apps/api/src/modules/execution-tracking/in-memory-execution-tracking-repository.ts`
- Modify: `apps/api/src/modules/execution-tracking/postgres-execution-tracking-repository.ts`
- Modify: `apps/api/src/modules/execution-tracking/execution-tracking-service.ts`
- Create migration adding `knowledge_hit_logs(knowledge_item_id, created_at, id)` index.
- Modify: `apps/api/src/modules/knowledge/knowledge-api.ts`
- Modify: `apps/web/src/features/knowledge-library/types.ts`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-api.ts`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-ledger-grid.tsx`

Steps:

- [ ] Write a failing unit test for summarizing knowledge usage from hit logs.
- [ ] Write a failing repository test for listing hit logs by knowledge item id or ids.
- [ ] Add the Postgres index migration and schema test expectation.
- [ ] Implement only metrics with real sources:
  - all-time retrieval/reference count.
  - last-30-day retrieval/reference count.
  - last-used timestamp.
  - revision count if already available from knowledge asset detail.
- [ ] Prefer a batch service method for all visible knowledge ids; if local structure forces per-id calls, keep the code isolated behind the service interface and document the remaining risk.
- [ ] Add metrics to knowledge library list response.
- [ ] Render compact columns in the main ledger grid.
- [ ] Run focused API and web tests.
- [ ] Commit only these files.

Acceptance:

- Knowledge usage columns are derived from logs/read models.
- No mutable count fields are added to core knowledge definitions.

## Task 7: Add Rule Center Ledger Effect Columns

**Files:**

- Modify: rule ledger/grid files under `apps/web/src/features/template-governance/**`
- Modify tests under `apps/web/test/template-governance-*.spec.*`
- Backend changes only if existing `metrics_summary` is not already present in the ledger response.

Steps:

- [ ] Write a failing UI/data test proving the rule center ledger shows effect columns from `metrics_summary`.
- [ ] Reuse existing `editorial_rule_activation_metrics` fields; do not add new rule definition columns.
- [ ] Add compact columns such as hits, auto applications, review-required count, and last hit where the existing metric summary supports them.
- [ ] Keep missing metrics displayed as `0` or `暂无`, not as blank broken cells.
- [ ] Run focused template-governance tests.
- [ ] Commit only these files.

Acceptance:

- Rule center total table can show learning/effect feedback beside each rule/rule set.
- Metrics remain sourced from the rule activation metrics read model.

## Task 8: End-To-End Regression And Final Verification

Steps:

- [ ] Run focused backend tests:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/learning/learning-candidate-filtering.spec.ts ./test/learning-governance/learning-governance.spec.ts ./test/knowledge/knowledge-usage-metrics.spec.ts
```

- [ ] Run focused frontend tests:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/learning-review-api.spec.ts ./test/knowledge-candidate-prefill.spec.ts
```

- [ ] Run additional touched-area tests discovered during implementation.
- [ ] Run typecheck if focused tests do not compile all touched surfaces.
- [ ] Verify with a checklist:
  - `转规则` creates/opens rule candidate in rule center.
  - `转知识` creates/opens knowledge candidate in knowledge library.
  - Knowledge candidate first save creates a real draft, not an approved item.
  - Existing submit-review-approve path still controls knowledge publication.
  - `sourceLearningCandidateId` is preserved after reload.
  - Rule and knowledge effect columns are read-only derived data.
  - No global回流中心 or new queue was added.

## Implementation Notes

- If an existing helper already implements a requirement, reuse it instead of adding another abstraction.
- Keep candidate payload parsing tolerant. Missing AI semantic suggestions should not block manual draft creation.
- Keep source/evidence display read-only in this phase.
- If a task reveals that a broader rewrite is required, stop and report the narrowed deliverable instead of silently expanding scope.
