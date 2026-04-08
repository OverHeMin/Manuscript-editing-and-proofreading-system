# Medical Rule Library V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved Medical Rule Library V2 so the team can author full-scope medical editorial rules, review AI-discovered rule candidates, project those rules into the knowledge base, and let `screening`, `editing`, and `proofreading` consume one explainable rule truth.

**Architecture:** Build V2 on top of the current phase-1 rule-authoring foundation instead of replacing it. Keep `TemplateFamily + JournalTemplateProfile + EditorialRuleSet` as the execution spine, add shared V2 rule contracts plus richer explainability and learning-linkage payloads, then turn the current governance surfaces into one `规则中心` with two internal workbenches: `规则录入工作台` and `规则学习工作台`. Runtime continues to execute only from the rule store; knowledge remains a downstream projection for retrieval and AI understanding.

**Tech Stack:** TypeScript, React, node:test via `tsx`, Playwright, PostgreSQL/Prisma, Python DOCX pipeline, `packages/contracts`

---

## Current Baseline

- `origin/main` already contains V1/phase-1 rule authoring foundations:
  - `TemplateFamily` + `JournalTemplateProfile`
  - enriched `EditorialRuleSet` + `EditorialRule`
  - rule-object presets for `abstract`, `heading_hierarchy`, `numeric_unit`, `statistical_expression`, `table`, `reference`, `declaration`
  - journal-aware rule resolution
  - manuscript-side journal template selection
- The current admin experience is still split across:
  - `template-governance` for templates and rule authoring
  - `learning-review` for governed candidate approval and knowledge writeback
- Knowledge projection exists, but it is still narrower than the approved V2 target:
  - rule explanation payloads are not yet first-class
  - candidate-to-rule writeback is not yet first-class
  - runtime preview / explainability / coverage visualization are not yet product-complete
- This plan intentionally extends the current code instead of discarding it.

## Scope Notes

- This plan implements the approved V2 platform boundary, not a reduced MVP.
- V2 must include:
  - full rule-center product model
  - mixed authoring (`向导式 + 表格台账`)
  - all high-value medical rule objects, plus the shared framework for the rest
  - candidate rule intake from reviewed manuscripts
  - human-confirmed writeback into rule drafts
  - richer knowledge projection
  - runtime explainability and preview
- Do not make knowledge retrieval the execution truth source.
- Do not promise full automatic DOCX table layout rewriting in this pass.
  - V2 must support table rule authoring, matching, inspection, explanation, and honest inspect-only execution where full auto-layout is unsafe.
- Use the exact normalized example in tests and fixtures whenever abstract heading normalization is involved:
  - `摘要 目的 -> （摘要　目的）`

## File Structure

### Shared Contracts

- Create: `packages/contracts/src/editorial-rules.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/templates.ts`
- Modify: `packages/contracts/src/knowledge.ts`
- Modify: `packages/contracts/src/learning.ts`
- Modify: `packages/contracts/src/learning-governance.ts`
- Create: `packages/contracts/type-tests/editorial-rules-v2.test.ts`

### API Persistence And Rule-Center Domain

- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/database/migrations/0028_medical_rule_library_v2_foundations.sql`
- Modify: `apps/api/src/database/migration-ledger.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-record.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-repository.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-api.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-resolution-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-projection-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/in-memory-editorial-rule-repository.ts`
- Modify: `apps/api/src/modules/editorial-rules/postgres-editorial-rule-repository.ts`
- Create: `apps/api/src/modules/editorial-rules/editorial-rule-preview-service.ts`
- Create: `apps/api/src/modules/editorial-rules/editorial-rule-object-catalog.ts`
- Modify: `apps/api/src/modules/editorial-rules/index.ts`
- Modify: `apps/api/src/modules/templates/template-record.ts`
- Modify: `apps/api/src/modules/templates/template-repository.ts`
- Modify: `apps/api/src/modules/templates/template-governance-service.ts`
- Modify: `apps/api/src/modules/templates/template-api.ts`
- Modify: `apps/api/src/modules/templates/in-memory-template-family-repository.ts`
- Modify: `apps/api/src/modules/templates/postgres-template-repository.ts`
- Modify: `apps/api/src/modules/templates/index.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-record.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-repository.ts`
- Modify: `apps/api/src/modules/manuscripts/postgres-manuscript-repository.ts`
- Modify: `apps/api/src/modules/manuscripts/in-memory-manuscript-repository.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-api.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-lifecycle-service.ts`
- Modify: `apps/api/src/modules/shared/governed-module-context-resolver.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`

### API Learning And Governed Writeback

- Modify: `apps/api/src/modules/learning/learning-record.ts`
- Modify: `apps/api/src/modules/learning/learning-repository.ts`
- Modify: `apps/api/src/modules/learning/learning-service.ts`
- Modify: `apps/api/src/modules/learning/learning-api.ts`
- Modify: `apps/api/src/modules/learning/in-memory-learning-repository.ts`
- Modify: `apps/api/src/modules/learning/postgres-learning-repository.ts`
- Modify: `apps/api/src/modules/learning/index.ts`
- Modify: `apps/api/src/modules/learning-governance/learning-governance-record.ts`
- Modify: `apps/api/src/modules/learning-governance/learning-governance-service.ts`
- Modify: `apps/api/src/modules/learning-governance/learning-governance-api.ts`
- Modify: `apps/api/src/modules/learning-governance/in-memory-learning-governance-repository.ts`
- Modify: `apps/api/src/modules/learning-governance/postgres-learning-governance-repository.ts`
- Modify: `apps/api/src/modules/learning-governance/index.ts`
- Modify: `apps/api/src/modules/shared/learning-candidate-guard.ts`
- Create: `apps/api/src/modules/editorial-rules/editorial-rule-candidate-extraction-service.ts`

### Knowledge Projection And Retrieval

- Modify: `apps/api/src/modules/knowledge/knowledge-record.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-service.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-api.ts`
- Modify: `apps/api/src/modules/knowledge/in-memory-knowledge-repository.ts`
- Modify: `apps/api/src/modules/knowledge/postgres-knowledge-repository.ts`
- Modify: `apps/api/src/modules/knowledge/index.ts`
- Modify: `apps/api/src/modules/knowledge-retrieval/knowledge-retrieval-service.ts`
- Modify: `apps/api/src/modules/knowledge-retrieval/knowledge-retrieval-record.ts`
- Modify: `apps/api/src/modules/knowledge-retrieval/knowledge-retrieval-api.ts`

### Web Rule Center

- Modify: `apps/web/src/features/auth/workbench.ts`
- Modify: `apps/web/src/app/workbench-host.tsx`
- Modify: `apps/web/src/app/workbench-navigation.ts`
- Modify: `apps/web/src/app/workbench-routing.ts`
- Modify: `apps/web/src/features/templates/types.ts`
- Modify: `apps/web/src/features/templates/template-api.ts`
- Modify: `apps/web/src/features/editorial-rules/types.ts`
- Modify: `apps/web/src/features/editorial-rules/editorial-rules-api.ts`
- Modify: `apps/web/src/features/learning-review/types.ts`
- Modify: `apps/web/src/features/learning-review/learning-review-api.ts`
- Modify: `apps/web/src/features/learning-governance/types.ts`
- Modify: `apps/web/src/features/learning-governance/learning-governance-api.ts`
- Modify: `apps/web/src/features/knowledge/types.ts`
- Modify: `apps/web/src/features/knowledge/knowledge-api.ts`
- Modify: `apps/web/src/features/knowledge-retrieval/types.ts`
- Modify: `apps/web/src/features/knowledge-retrieval/knowledge-retrieval-api.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-controller.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench.css`
- Modify: `apps/web/src/features/template-governance/rule-authoring-types.ts`
- Modify: `apps/web/src/features/template-governance/rule-authoring-presets.ts`
- Modify: `apps/web/src/features/template-governance/rule-authoring-serialization.ts`
- Modify: `apps/web/src/features/template-governance/rule-authoring-navigation.tsx`
- Modify: `apps/web/src/features/template-governance/rule-authoring-form.tsx`
- Modify: `apps/web/src/features/template-governance/rule-authoring-preview.tsx`
- Create: `apps/web/src/features/template-governance/rule-authoring-grid.tsx`
- Create: `apps/web/src/features/template-governance/rule-authoring-explainability.tsx`
- Create: `apps/web/src/features/template-governance/rule-object-catalog.ts`
- Create: `apps/web/src/features/template-governance/rule-learning-pane.tsx`
- Create: `apps/web/src/features/template-governance/rule-learning-diff-card.tsx`
- Create: `apps/web/src/features/template-governance/rule-learning-actions.tsx`
- Modify: `apps/web/src/features/learning-review/learning-review-workbench-page.tsx`
- Modify: `apps/web/src/features/learning-review/learning-review-prefill.ts`
- Modify: `apps/web/src/features/learning-review/learning-review-workbench-state.ts`

### Manuscript Workbench And Runtime Surfaces

- Modify: `apps/web/src/features/manuscripts/types.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/src/features/editing/types.ts`
- Modify: `apps/web/src/features/editing/editing-api.ts`
- Modify: `apps/web/src/features/proofreading/types.ts`
- Modify: `apps/web/src/features/proofreading/proofreading-api.ts`

### Python Worker And Document Pipeline

- Modify: `apps/worker-py/src/document_pipeline/parse_docx.py`
- Modify: `apps/worker-py/src/document_pipeline/apply_editorial_rules.py`
- Modify: `apps/worker-py/tests/test_apply_editorial_rules.py`

### Verification

- Modify: `apps/api/test/database/schema.spec.ts`
- Modify: `apps/api/test/database/migration-doctor.spec.ts`
- Modify: `apps/api/test/editorial-rules/postgres-editorial-rule-persistence.spec.ts`
- Modify: `apps/api/test/editorial-rules/editorial-rule-governance.spec.ts`
- Modify: `apps/api/test/editorial-rules/editorial-rule-resolution.spec.ts`
- Modify: `apps/api/test/editorial-rules/editorial-rule-projection.spec.ts`
- Create: `apps/api/test/editorial-rules/editorial-rule-preview.spec.ts`
- Modify: `apps/api/test/learning/learning-governance.spec.ts`
- Modify: `apps/api/test/learning-governance/learning-governance.spec.ts`
- Modify: `apps/api/test/knowledge/knowledge-governance.spec.ts`
- Modify: `apps/api/test/knowledge-retrieval/knowledge-retrieval-service.spec.ts`
- Modify: `apps/api/test/manuscripts/manuscript-template-selection.spec.ts`
- Modify: `apps/api/test/modules/governed-module-context-resolver.spec.ts`
- Modify: `apps/api/test/editing/deterministic-format-rule-executor.spec.ts`
- Modify: `apps/api/test/editing/editing-rule-execution.spec.ts`
- Modify: `apps/api/test/proofreading/proofreading-rule-checker.spec.ts`
- Modify: `apps/api/test/proofreading/proofreading-rule-report.spec.ts`
- Modify: `apps/web/test/template-governance-rule-authoring.spec.ts`
- Create: `apps/web/test/rule-center-learning-review.spec.ts`
- Modify: `apps/web/playwright/admin-governance.spec.ts`
- Modify: `apps/web/playwright/manuscript-handoff.spec.ts`

## V2 Data Model Decisions

- Keep `TemplateFamily` as the manuscript-type big template and `JournalTemplateProfile` as the journal small template.
- Keep `EditorialRuleSet` as the published execution container, but enrich V2 with explicit explainability and learning linkage rather than hiding everything inside `scope`, `selector`, and `authoring_payload`.
- Add a shared rule-object catalog in `packages/contracts` so API, web, and worker use the same object keys and explainability vocabulary.
- Extend rule and learning models with explicit V2 fields:
  - `coverage_key`
  - `explanation_payload`
  - `review_payload`
  - `source_learning_candidate_id`
  - `source_snapshot_asset_id`
  - `projection_payload`
  - `candidate_payload`
  - `suggested_rule_object`
  - `suggested_template_family_id`
  - `suggested_journal_template_id`
- Extend governed learning writeback targets with a first-class rule draft target:
  - `editorial_rule_draft`
- Keep knowledge as a projection only.
  - Knowledge items may store richer rule summaries and examples, but they must not become executable rules.

Recommended contract direction:

```ts
export type RuleObjectKey =
  | "title"
  | "author_line"
  | "abstract"
  | "keyword"
  | "heading_hierarchy"
  | "terminology"
  | "numeric_unit"
  | "statistical_expression"
  | "table"
  | "figure"
  | "reference"
  | "statement"
  | "manuscript_structure"
  | "journal_column";

export interface EditorialRuleExplanationPayload {
  rationale: string;
  applies_when?: string[];
  not_applies_when?: string[];
  correct_example?: string;
  incorrect_example?: string;
  review_prompt?: string;
}

export interface EditorialRuleLinkagePayload {
  source_learning_candidate_id?: string;
  source_snapshot_asset_id?: string;
  projected_knowledge_item_ids?: string[];
  overrides_rule_ids?: string[];
}
```

## Task 1: Establish Shared V2 Rule Contracts And Persistence Foundations

**Files:**
- Create: `packages/contracts/src/editorial-rules.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/templates.ts`
- Modify: `packages/contracts/src/knowledge.ts`
- Modify: `packages/contracts/src/learning.ts`
- Modify: `packages/contracts/src/learning-governance.ts`
- Create: `packages/contracts/type-tests/editorial-rules-v2.test.ts`
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/database/migrations/0028_medical_rule_library_v2_foundations.sql`
- Modify: `apps/api/src/database/migration-ledger.ts`
- Modify: `apps/api/test/database/schema.spec.ts`
- Modify: `apps/api/test/database/migration-doctor.spec.ts`
- Modify: `apps/api/test/editorial-rules/postgres-editorial-rule-persistence.spec.ts`

- [ ] **Step 1: Write the failing contract and schema tests**

Cover:
- shared `RuleObjectKey` / explanation / linkage contracts compile through `packages/contracts`
- Prisma schema exposes V2 linkage and explainability columns
- Postgres persistence round-trips:
  - enriched editorial rule explanation/linkage payloads
  - candidate payloads
  - `editorial_rule_draft` writeback target

Run:
- `pnpm --filter @medical/contracts test`
- `pnpm --filter @medical/api run test -- database/schema.spec.ts database/migration-doctor.spec.ts editorial-rules/postgres-editorial-rule-persistence.spec.ts`

Expected: FAIL because the shared contracts and schema do not yet include V2 fields.

- [ ] **Step 2: Add the shared contracts**

Create `packages/contracts/src/editorial-rules.ts` and export:
- rule object keys
- explanation payloads
- preview / explainability result shapes
- rule linkage payloads
- rule candidate payloads

Extend learning, learning-governance, knowledge, and templates contracts so the new shapes are available to both API and web.

- [ ] **Step 3: Add the Prisma migration**

Introduce a new migration that adds the minimum V2 persistence fields without breaking current data:
- editorial rule explanation / linkage / projection JSON columns
- learning candidate payload / suggestion columns
- governed writeback target enum or text expansion
- any required indexes for rule candidate lookup

- [ ] **Step 4: Update repositories to pass the persistence tests**

Keep backward compatibility for existing records while reading and writing the new V2 fields.

- [ ] **Step 5: Re-run the focused foundation tests**

Run:
- `pnpm --filter @medical/contracts test`
- `pnpm --filter @medical/api run test -- database/schema.spec.ts database/migration-doctor.spec.ts editorial-rules/postgres-editorial-rule-persistence.spec.ts`

Expected: PASS.

## Task 2: Expand The Editorial Rule API For Explainability, Coverage, And Preview

**Files:**
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-record.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-repository.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-api.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-resolution-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-projection-service.ts`
- Create: `apps/api/src/modules/editorial-rules/editorial-rule-preview-service.ts`
- Create: `apps/api/src/modules/editorial-rules/editorial-rule-object-catalog.ts`
- Modify: `apps/api/src/modules/editorial-rules/in-memory-editorial-rule-repository.ts`
- Modify: `apps/api/src/modules/editorial-rules/postgres-editorial-rule-repository.ts`
- Modify: `apps/api/src/modules/editorial-rules/index.ts`
- Modify: `apps/api/test/editorial-rules/editorial-rule-governance.spec.ts`
- Modify: `apps/api/test/editorial-rules/editorial-rule-resolution.spec.ts`
- Modify: `apps/api/test/editorial-rules/editorial-rule-projection.spec.ts`
- Create: `apps/api/test/editorial-rules/editorial-rule-preview.spec.ts`

- [ ] **Step 1: Write the failing rule governance and preview tests**

Cover:
- creating a rule with explanation and linkage payloads
- preserving the exact abstract normalization example
- previewing a single rule against sample text
- previewing a bundle for a selected family + journal + module + object
- returning explainability output that says:
  - why a rule matched
  - what it overrode
  - whether execution is auto, guarded, or inspect-only

Run:
- `pnpm --filter @medical/api run test -- editorial-rules/editorial-rule-governance.spec.ts editorial-rules/editorial-rule-resolution.spec.ts editorial-rules/editorial-rule-projection.spec.ts editorial-rules/editorial-rule-preview.spec.ts`

Expected: FAIL because preview and explainability are not yet first-class.

- [ ] **Step 2: Add a shared rule-object catalog**

Use one backend catalog for:
- supported object keys
- object labels
- default execution posture
- preview affordances
- knowledge projection defaults

The web workbench should later consume the same object vocabulary.

- [ ] **Step 3: Expand rule governance and resolution**

Implement:
- richer create/update/list rule APIs
- deterministic conflict resolution with explicit override metadata
- coverage keys and same-layer conflict explanations

- [ ] **Step 4: Add preview endpoints**

Add an API surface that can:
- preview a single rule
- preview a full object bundle
- preview a historical manuscript replay

Return structured results rather than plain text.

- [ ] **Step 5: Re-run the focused editorial rule tests**

Run:
- `pnpm --filter @medical/api run test -- editorial-rules/editorial-rule-governance.spec.ts editorial-rules/editorial-rule-resolution.spec.ts editorial-rules/editorial-rule-projection.spec.ts editorial-rules/editorial-rule-preview.spec.ts`

Expected: PASS.

## Task 3: Add Candidate Rule Payloads And Governed Rule-Draft Writeback

**Files:**
- Modify: `apps/api/src/modules/learning/learning-record.ts`
- Modify: `apps/api/src/modules/learning/learning-repository.ts`
- Modify: `apps/api/src/modules/learning/learning-service.ts`
- Modify: `apps/api/src/modules/learning/learning-api.ts`
- Modify: `apps/api/src/modules/learning/in-memory-learning-repository.ts`
- Modify: `apps/api/src/modules/learning/postgres-learning-repository.ts`
- Modify: `apps/api/src/modules/learning/index.ts`
- Modify: `apps/api/src/modules/learning-governance/learning-governance-record.ts`
- Modify: `apps/api/src/modules/learning-governance/learning-governance-service.ts`
- Modify: `apps/api/src/modules/learning-governance/learning-governance-api.ts`
- Modify: `apps/api/src/modules/learning-governance/in-memory-learning-governance-repository.ts`
- Modify: `apps/api/src/modules/learning-governance/postgres-learning-governance-repository.ts`
- Modify: `apps/api/src/modules/learning-governance/index.ts`
- Modify: `apps/api/src/modules/shared/learning-candidate-guard.ts`
- Modify: `apps/api/test/learning/learning-governance.spec.ts`
- Modify: `apps/api/test/learning-governance/learning-governance.spec.ts`

- [ ] **Step 1: Write the failing governed learning tests**

Cover:
- `rule_candidate` records storing structured candidate payloads
- approved rule candidates creating an `editorial_rule_draft` writeback
- writeback creating a draft rule set or draft rule under the correct family/journal/module context
- preserving candidate provenance on the created draft

Run:
- `pnpm --filter @medical/api run test -- learning/learning-governance.spec.ts learning-governance/learning-governance.spec.ts`

Expected: FAIL because governed writeback cannot target editorial rule drafts yet.

- [ ] **Step 2: Extend the learning candidate model**

Add candidate fields for:
- proposed rule object
- proposed family / journal / module
- candidate payload
- extraction rationale
- before / after fragments

- [ ] **Step 3: Add `editorial_rule_draft` to governed writeback**

Implement a writeback branch that creates a draft rule or draft rule set through the editorial rule service rather than routing through knowledge or templates.

- [ ] **Step 4: Keep backward compatibility**

Existing knowledge writeback behavior must keep passing unchanged.

- [ ] **Step 5: Re-run the focused learning tests**

Run:
- `pnpm --filter @medical/api run test -- learning/learning-governance.spec.ts learning-governance/learning-governance.spec.ts`

Expected: PASS.

## Task 4: Extract Candidate Rules From Reviewed Manuscripts And Feedback

**Files:**
- Create: `apps/api/src/modules/editorial-rules/editorial-rule-candidate-extraction-service.ts`
- Modify: `apps/api/src/modules/learning/learning-service.ts`
- Modify: `apps/api/src/modules/learning/learning-api.ts`
- Modify: `apps/api/src/modules/document-pipeline/document-structure-service.ts`
- Modify: `apps/api/src/modules/feedback-governance/feedback-governance-service.ts`
- Modify: `apps/api/src/modules/feedback-governance/feedback-governance-api.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/test/learning/learning-governance.spec.ts`
- Modify: `apps/api/test/http/persistent-governance-http.spec.ts`

- [ ] **Step 1: Write the failing extraction tests**

Cover:
- generating a `rule_candidate` from a reviewed abstract normalization diff
- generating an inspect-first table candidate from reviewed table corrections
- refusing extraction when de-identification or evidence prerequisites are missing

Run:
- `pnpm --filter @medical/api run test -- learning/learning-governance.spec.ts http/persistent-governance-http.spec.ts`

Expected: FAIL because reviewed snapshots do not yet produce structured rule candidates.

- [ ] **Step 2: Implement candidate extraction service**

Keep the first version deterministic and bounded:
- compare reviewed before/after fragments
- produce structured candidate payloads for obvious object classes first
- mark uncertain objects as inspect-first or manual-review-required

- [ ] **Step 3: Expose governed extraction entry points**

Allow reviewed manuscript flows and feedback-governance flows to create rule candidates through one API path.

- [ ] **Step 4: Re-run the focused extraction tests**

Run:
- `pnpm --filter @medical/api run test -- learning/learning-governance.spec.ts http/persistent-governance-http.spec.ts`

Expected: PASS.

## Task 5: Upgrade Knowledge Projection And Retrieval To Use Richer Rule Projections

**Files:**
- Modify: `apps/api/src/modules/knowledge/knowledge-record.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-service.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-api.ts`
- Modify: `apps/api/src/modules/knowledge/in-memory-knowledge-repository.ts`
- Modify: `apps/api/src/modules/knowledge/postgres-knowledge-repository.ts`
- Modify: `apps/api/src/modules/knowledge/index.ts`
- Modify: `apps/api/src/modules/knowledge-retrieval/knowledge-retrieval-record.ts`
- Modify: `apps/api/src/modules/knowledge-retrieval/knowledge-retrieval-service.ts`
- Modify: `apps/api/src/modules/knowledge-retrieval/knowledge-retrieval-api.ts`
- Modify: `apps/api/test/knowledge/knowledge-governance.spec.ts`
- Modify: `apps/api/test/knowledge-retrieval/knowledge-retrieval-service.spec.ts`
- Modify: `apps/api/test/editorial-rules/editorial-rule-projection.spec.ts`

- [ ] **Step 1: Write the failing projection and retrieval tests**

Cover:
- projected knowledge items storing:
  - rule object
  - family / journal bindings
  - standard example
  - incorrect example
  - non-applicable boundary
  - evidence summary
- retrieval ranking rule-projection items more precisely when the query context includes module + manuscript type + journal

Run:
- `pnpm --filter @medical/api run test -- knowledge/knowledge-governance.spec.ts knowledge-retrieval/knowledge-retrieval-service.spec.ts editorial-rules/editorial-rule-projection.spec.ts`

Expected: FAIL because current projection payloads are thinner.

- [ ] **Step 2: Enrich projected knowledge payloads**

Keep knowledge as explanation-only, but give the AI and retrieval layers enough structured context to understand the rule.

- [ ] **Step 3: Update retrieval logic**

Prefer projected rule items when the query context includes:
- module
- manuscript type
- template family
- journal template
- rule object

- [ ] **Step 4: Re-run the focused knowledge tests**

Run:
- `pnpm --filter @medical/api run test -- knowledge/knowledge-governance.spec.ts knowledge-retrieval/knowledge-retrieval-service.spec.ts editorial-rules/editorial-rule-projection.spec.ts`

Expected: PASS.

## Task 6: Turn Template Governance Into One Rule Center With Two Internal Workbenches

**Files:**
- Modify: `apps/web/src/features/auth/workbench.ts`
- Modify: `apps/web/src/app/workbench-host.tsx`
- Modify: `apps/web/src/app/workbench-navigation.ts`
- Modify: `apps/web/src/app/workbench-routing.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-controller.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench.css`
- Modify: `apps/web/src/features/learning-review/learning-review-workbench-page.tsx`
- Modify: `apps/web/test/template-governance-rule-authoring.spec.ts`
- Create: `apps/web/test/rule-center-learning-review.spec.ts`

- [ ] **Step 1: Write the failing rule-center shell tests**

Cover:
- the admin navigation shows `规则中心` instead of a separate phase-1 template authoring label
- the rule center has two internal tabs or modes:
  - `规则录入工作台`
  - `规则学习工作台`
- opening a learning candidate inside the rule center can hand off into authoring without losing context

Run:
- `pnpm --filter @medsys/web run test -- template-governance-rule-authoring.spec.ts rule-center-learning-review.spec.ts`

Expected: FAIL because the shell still reflects the split transitional structure.

- [ ] **Step 2: Update workbench metadata and routing**

Keep compatibility with existing links where possible, but make the primary admin-facing product entry the unified rule center.

- [ ] **Step 3: Reshape the rule center shell**

Expose:
- authoring workbench
- learning workbench
- shared context bar for family / journal / module / object

- [ ] **Step 4: Re-run the focused shell tests**

Run:
- `pnpm --filter @medsys/web run test -- template-governance-rule-authoring.spec.ts rule-center-learning-review.spec.ts`

Expected: PASS.

## Task 7: Expand The Authoring Workbench To Full Medical Rule Objects And Mixed Entry Modes

**Files:**
- Modify: `apps/web/src/features/templates/types.ts`
- Modify: `apps/web/src/features/templates/template-api.ts`
- Modify: `apps/web/src/features/editorial-rules/types.ts`
- Modify: `apps/web/src/features/editorial-rules/editorial-rules-api.ts`
- Modify: `apps/web/src/features/template-governance/rule-authoring-types.ts`
- Modify: `apps/web/src/features/template-governance/rule-authoring-presets.ts`
- Modify: `apps/web/src/features/template-governance/rule-authoring-serialization.ts`
- Modify: `apps/web/src/features/template-governance/rule-authoring-navigation.tsx`
- Modify: `apps/web/src/features/template-governance/rule-authoring-form.tsx`
- Modify: `apps/web/src/features/template-governance/rule-authoring-preview.tsx`
- Create: `apps/web/src/features/template-governance/rule-authoring-grid.tsx`
- Create: `apps/web/src/features/template-governance/rule-authoring-explainability.tsx`
- Create: `apps/web/src/features/template-governance/rule-object-catalog.ts`
- Modify: `apps/web/test/template-governance-rule-authoring.spec.ts`
- Modify: `apps/web/playwright/admin-governance.spec.ts`

- [ ] **Step 1: Write the failing authoring tests**

Cover:
- mixed authoring entry:
  - guided create
  - batch grid maintenance
- high-value objects:
  - abstract
  - table
  - statistical_expression
  - reference
  - statement
- next-wave objects:
  - title
  - author_line
  - keyword
  - terminology
  - figure
  - manuscript_structure
  - journal_column
- exact preview rendering of `摘要 目的 -> （摘要　目的）`
- table rule creation with three-line-table constraints and inspect-only posture

Run:
- `pnpm --filter @medsys/web run test -- template-governance-rule-authoring.spec.ts`
- `pnpm --filter @medsys/web run test:browser -- admin-governance.spec.ts`

Expected: FAIL because the current workbench still covers only the first object subset and lacks the batch ledger view.

- [ ] **Step 2: Expand the rule-object catalog and serialization**

Use one front-end catalog to define:
- labels
- payload shapes
- field hints
- automation posture
- preview wiring

- [ ] **Step 3: Implement guided authoring and grid maintenance**

Support:
- object navigation
- business-first forms
- expandable advanced fields
- batch rule list / ledger maintenance

- [ ] **Step 4: Add explainability and preview panels**

Show:
- normalized output
- match selector summary
- override / coverage summary
- inspect-only vs guarded-auto posture

- [ ] **Step 5: Re-run the focused authoring tests**

Run:
- `pnpm --filter @medsys/web run test -- template-governance-rule-authoring.spec.ts`
- `pnpm --filter @medsys/web run test:browser -- admin-governance.spec.ts`

Expected: PASS.

## Task 8: Build The Learning Workbench For Rule Candidate Review And Authoring Prefill

**Files:**
- Modify: `apps/web/src/features/learning-review/types.ts`
- Modify: `apps/web/src/features/learning-review/learning-review-api.ts`
- Modify: `apps/web/src/features/learning-review/learning-review-workbench-page.tsx`
- Modify: `apps/web/src/features/learning-review/learning-review-prefill.ts`
- Modify: `apps/web/src/features/learning-review/learning-review-workbench-state.ts`
- Create: `apps/web/src/features/template-governance/rule-learning-pane.tsx`
- Create: `apps/web/src/features/template-governance/rule-learning-diff-card.tsx`
- Create: `apps/web/src/features/template-governance/rule-learning-actions.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Modify: `apps/web/test/rule-center-learning-review.spec.ts`
- Modify: `apps/web/playwright/admin-governance.spec.ts`

- [ ] **Step 1: Write the failing learning-workbench tests**

Cover:
- pending rule candidates show original fragment, revised fragment, extraction rationale, and proposed context
- reviewer can:
  - approve
  - reject
  - convert to rule draft
  - convert to knowledge-only explanation
- approving a candidate and choosing `转规则草稿` opens authoring with the draft prefilled

Run:
- `pnpm --filter @medsys/web run test -- rule-center-learning-review.spec.ts`
- `pnpm --filter @medsys/web run test:browser -- admin-governance.spec.ts`

Expected: FAIL because the current learning-review surface is still optimized for knowledge writeback, not rule-center candidate review.

- [ ] **Step 2: Add rule-specific candidate detail rendering**

Show:
- before / after fragments
- object guess
- proposed family / journal / module / selector
- conflict with similar existing rules

- [ ] **Step 3: Add rule-draft handoff**

When the reviewer chooses rule writeback, prefill the authoring workbench with:
- object
- payload
- family / journal / module
- candidate provenance

- [ ] **Step 4: Re-run the focused learning-workbench tests**

Run:
- `pnpm --filter @medsys/web run test -- rule-center-learning-review.spec.ts`
- `pnpm --filter @medsys/web run test:browser -- admin-governance.spec.ts`

Expected: PASS.

## Task 9: Surface Rule Context, Explainability, And Honest Object Handling In Runtime Flows

**Files:**
- Modify: `apps/api/src/modules/shared/governed-module-context-resolver.ts`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/src/modules/editorial-execution/deterministic-format-rule-executor.ts`
- Modify: `apps/api/src/modules/editorial-execution/proofreading-rule-checker.ts`
- Modify: `apps/api/test/modules/governed-module-context-resolver.spec.ts`
- Modify: `apps/api/test/editing/deterministic-format-rule-executor.spec.ts`
- Modify: `apps/api/test/editing/editing-rule-execution.spec.ts`
- Modify: `apps/api/test/proofreading/proofreading-rule-checker.spec.ts`
- Modify: `apps/api/test/proofreading/proofreading-rule-report.spec.ts`
- Modify: `apps/web/src/features/manuscripts/types.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/src/features/editing/types.ts`
- Modify: `apps/web/src/features/editing/editing-api.ts`
- Modify: `apps/web/src/features/proofreading/types.ts`
- Modify: `apps/web/src/features/proofreading/proofreading-api.ts`
- Modify: `apps/worker-py/src/document_pipeline/parse_docx.py`
- Modify: `apps/worker-py/src/document_pipeline/apply_editorial_rules.py`
- Modify: `apps/worker-py/tests/test_apply_editorial_rules.py`
- Modify: `apps/web/playwright/manuscript-handoff.spec.ts`

- [ ] **Step 1: Write the failing runtime and worker tests**

Cover:
- governed module context returns richer rule explainability output
- editing and proofreading reports show why a rule applied or only inspected
- manuscript workbench shows base family + journal template + rule-center context
- worker parses table objects and emits honest inspect-only findings when auto-fix is unsafe

Run:
- `pnpm --filter @medical/api run test -- modules/governed-module-context-resolver.spec.ts editing/deterministic-format-rule-executor.spec.ts editing/editing-rule-execution.spec.ts proofreading/proofreading-rule-checker.spec.ts proofreading/proofreading-rule-report.spec.ts`
- `pytest apps/worker-py/tests/test_apply_editorial_rules.py -q`
- `pnpm --filter @medsys/web run test:browser -- manuscript-handoff.spec.ts`

Expected: FAIL because runtime explainability and table/object handling are not yet complete.

- [ ] **Step 2: Extend module context and reports**

Return:
- matched rule ids
- why matched
- what was overridden
- whether the action was auto, guarded, or inspect-only

- [ ] **Step 3: Extend the manuscript workbench summary**

Show:
- manuscript type
- big template
- journal small template
- active override state
- linked rule center context when available

- [ ] **Step 4: Extend the worker conservatively**

Support:
- paragraph and heading normalization as before
- table object discovery
- inspect-first findings for tables and unsupported objects
- no false claims of successful table auto-rewrite

- [ ] **Step 5: Re-run the focused runtime tests**

Run:
- `pnpm --filter @medical/api run test -- modules/governed-module-context-resolver.spec.ts editing/deterministic-format-rule-executor.spec.ts editing/editing-rule-execution.spec.ts proofreading/proofreading-rule-checker.spec.ts proofreading/proofreading-rule-report.spec.ts`
- `pytest apps/worker-py/tests/test_apply_editorial_rules.py -q`
- `pnpm --filter @medsys/web run test:browser -- manuscript-handoff.spec.ts`

Expected: PASS.

## Task 10: Run Full Verification And Prepare The Branch For Review

**Files:**
- Modify as needed from prior tasks only

- [ ] **Step 1: Run contracts type tests**

Run: `pnpm --filter @medical/contracts test`

Expected: PASS.

- [ ] **Step 2: Run API typecheck**

Run: `pnpm --filter @medical/api run typecheck`

Expected: PASS.

- [ ] **Step 3: Run API tests**

Run: `pnpm --filter @medical/api run test`

Expected: PASS.

- [ ] **Step 4: Run web typecheck**

Run: `pnpm --filter @medsys/web run typecheck`

Expected: PASS.

- [ ] **Step 5: Run web tests**

Run: `pnpm --filter @medsys/web run test`

Expected: PASS.

- [ ] **Step 6: Run browser tests**

Run:
- `pnpm --filter @medsys/web run test:browser -- admin-governance.spec.ts`
- `pnpm --filter @medsys/web run test:browser -- manuscript-handoff.spec.ts`

Expected: PASS.

- [ ] **Step 7: Run worker tests**

Run: `pytest apps/worker-py/tests/test_apply_editorial_rules.py -q`

Expected: PASS.

- [ ] **Step 8: Run the repo gate**

Run: `pnpm verify:manuscript-workbench`

Expected: PASS.

## Risks To Watch During Execution

- Unifying the rule center shell must not silently break the existing admin route structure.
  - Preserve old hashes or add a route bridge if necessary.
- Candidate extraction will be tempting to over-automate.
  - Keep the first extraction pass bounded and explainable.
- Table rules are high value and high risk.
  - Authoring and inspectability are mandatory; unsafe auto-layout changes are not.
- Knowledge projection richness can accidentally drift into execution logic.
  - Keep the rule store as the only executable source.
- The current template-governance page is already large.
  - Split into focused files early rather than growing the monolith.

## Definition Of Done

- Admin users see one `规则中心` product entry with two internal workbenches:
  - `规则录入工作台`
  - `规则学习工作台`
- Medical editors can author structured rules for the approved V2 rule objects, including abstract and table rules.
- The system supports the exact abstract normalization example:
  - `摘要 目的 -> （摘要　目的）`
- Reviewed manuscripts can produce governed rule candidates with human-confirmed writeback into rule drafts.
- Knowledge stores richer rule projections, but execution still resolves only from rule sets.
- Editing and proofreading can explain which rules matched, which rules were overridden, and which actions were inspect-only.
- Table rules are supported as authorable and explainable rules even when full auto-layout rewrite is not safe.
- Contracts tests, API tests, web tests, browser coverage, worker tests, and `pnpm verify:manuscript-workbench` all pass.

## Follow-Up After This Plan

- Add candidate clustering, deduplication, and acceptance-rate analytics once V2 is stable.
- Expand automatic table rewriting only after inspect-first telemetry proves the selectors are stable.
- Add cross-journal inheritance suggestions and performance reporting in V3, not before the V2 rule-center foundations are stable.
