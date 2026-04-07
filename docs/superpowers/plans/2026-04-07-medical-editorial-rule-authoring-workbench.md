# Medical Editorial Rule Authoring Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the phase-1 medical editorial rule authoring workbench so medical editors can enter structured rules for all manuscript families, attach journal-specific overrides, and let `screening`, `editing`, and `proofreading` resolve the right rule set deterministically.

**Architecture:** Keep the existing `TemplateFamily` as the manuscript-type base template and introduce a journal-specific child template entity instead of overloading the base family. Extend editorial rules with authoring metadata plus machine selectors, then resolve execution bundles as `base family rules + journal overrides`. Update the governance workbench to use object-specific rule forms, and add a manuscript-side journal selector so runtime invocation can bind the correct override set.

**Tech Stack:** TypeScript, React, node:test via `tsx`, Playwright, PostgreSQL/Prisma-backed persistence, Python DOCX worker.

---

## Scope Notes

- This plan covers phase 1 only: manual structured rule authoring, deterministic resolution, knowledge projection, and module-side consumption.
- Do not implement the phase-2 AI candidate extraction flow in this pass.
- Do not promise full automatic Word table rewriting in phase 1; table rules must be authorable and inspectable first.
- Preserve the existing `TemplateFamily`-based mainline behavior for current manuscripts while adding optional journal override selection.
- Avoid touching unrelated `model-registry` worktree changes already present in the repo.

## File Structure

### Persistence and API

- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/database/migrations/0027_medical_editorial_rule_authoring_workbench.sql`
- Modify: `apps/api/src/database/migration-ledger.ts`
- Modify: `apps/api/src/modules/templates/template-record.ts`
- Modify: `apps/api/src/modules/templates/template-repository.ts`
- Modify: `apps/api/src/modules/templates/template-governance-service.ts`
- Modify: `apps/api/src/modules/templates/template-api.ts`
- Modify: `apps/api/src/modules/templates/in-memory-template-family-repository.ts`
- Modify: `apps/api/src/modules/templates/postgres-template-repository.ts`
- Modify: `apps/api/src/modules/templates/index.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-record.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-repository.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-api.ts`
- Modify: `apps/api/src/modules/editorial-rules/in-memory-editorial-rule-repository.ts`
- Modify: `apps/api/src/modules/editorial-rules/postgres-editorial-rule-repository.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-projection-service.ts`
- Create: `apps/api/src/modules/editorial-rules/editorial-rule-resolution-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/index.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-record.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-repository.ts`
- Modify: `apps/api/src/modules/manuscripts/in-memory-manuscript-repository.ts`
- Modify: `apps/api/src/modules/manuscripts/postgres-manuscript-repository.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-lifecycle-service.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-api.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`

### Web Governance Workbench

- Modify: `apps/web/src/features/templates/types.ts`
- Modify: `apps/web/src/features/templates/template-api.ts`
- Modify: `apps/web/src/features/templates/index.ts`
- Modify: `apps/web/src/features/editorial-rules/types.ts`
- Modify: `apps/web/src/features/editorial-rules/editorial-rules-api.ts`
- Modify: `apps/web/src/features/editorial-rules/index.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-controller.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench.css`
- Create: `apps/web/src/features/template-governance/rule-authoring-types.ts`
- Create: `apps/web/src/features/template-governance/rule-authoring-presets.ts`
- Create: `apps/web/src/features/template-governance/rule-authoring-serialization.ts`
- Create: `apps/web/src/features/template-governance/rule-authoring-navigation.tsx`
- Create: `apps/web/src/features/template-governance/rule-authoring-form.tsx`
- Create: `apps/web/src/features/template-governance/rule-authoring-preview.tsx`
- Modify: `apps/web/src/features/manuscripts/types.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`

### Worker and Verification

- Modify: `apps/worker-py/src/document_pipeline/parse_docx.py`
- Modify: `apps/worker-py/src/document_pipeline/apply_editorial_rules.py`
- Create: `apps/worker-py/tests/test_apply_editorial_rules.py`
- Modify: `apps/api/test/templates/template-governance.spec.ts`
- Modify: `apps/api/test/editorial-rules/editorial-rule-governance.spec.ts`
- Modify: `apps/api/test/editorial-rules/editorial-rule-projection.spec.ts`
- Modify: `apps/api/test/editorial-rules/postgres-editorial-rule-persistence.spec.ts`
- Create: `apps/api/test/editorial-rules/editorial-rule-resolution.spec.ts`
- Create: `apps/api/test/manuscripts/manuscript-template-selection.spec.ts`
- Modify: `apps/web/playwright/admin-governance.spec.ts`
- Create: `apps/web/test/template-governance-rule-authoring.spec.ts`

## Data Model Decisions

- Keep `TemplateFamily` as the big template for manuscript type.
- Add `JournalTemplateProfile` as the small template bound to exactly one `TemplateFamily`.
- Add `current_journal_template_id` to manuscript records.
- Extend `EditorialRuleSet` with optional `journal_template_id` so a rule set can be either:
  - base-family scope
  - journal override scope
- Extend `EditorialRuleRecord` with:
  - `rule_object`
  - `selector`
  - `authoring_payload`
  - `evidence_level`

Recommended shape:

```ts
interface JournalTemplateProfileRecord {
  id: string;
  template_family_id: string;
  journal_key: string;
  journal_name: string;
  status: "draft" | "active" | "archived";
}

interface EditorialRuleRecord {
  id: string;
  rule_set_id: string;
  order_no: number;
  rule_object: string;
  scope: Record<string, unknown>;
  selector: Record<string, unknown>;
  trigger: Record<string, unknown>;
  action: Record<string, unknown>;
  authoring_payload: Record<string, unknown>;
  evidence_level?: string;
  ...
}
```

## Task 1: Add Journal Template And Enriched Rule Persistence

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/database/migrations/0027_medical_editorial_rule_authoring_workbench.sql`
- Modify: `apps/api/src/database/migration-ledger.ts`
- Test: `apps/api/test/editorial-rules/postgres-editorial-rule-persistence.spec.ts`

- [ ] **Step 1: Extend the Prisma schema with journal templates and enriched rule fields**

Add:
- `JournalTemplateProfile` model
- `currentJournalTemplateId` on `Manuscript`
- `journalTemplateId` on `EditorialRuleSet`
- `ruleObject`, `selector`, `authoringPayload`, `evidenceLevel` on `EditorialRule`

- [ ] **Step 2: Write the SQL migration**

Run: `pnpm --filter @medical/api run db:migration-doctor`

Expected: the new migration appears after `0026_model_provider_domestic.sql` and the doctor command reports the ledger is coherent.

- [ ] **Step 3: Update the migration ledger**

Add the new migration identifier and description to `apps/api/src/database/migration-ledger.ts`.

- [ ] **Step 4: Extend the Postgres persistence test first**

Add assertions that:
- journal template rows persist and reload
- rule sets can persist with and without journal template ids
- rules round-trip `selector` and `authoring_payload`

Run: `pnpm --filter @medical/api run test -- editorial-rules/postgres-editorial-rule-persistence.spec.ts`

Expected: FAIL until repositories are updated.

- [ ] **Step 5: Implement the persistence changes**

Update the Postgres repositories so the failing persistence test passes.

- [ ] **Step 6: Re-run the focused persistence test**

Run: `pnpm --filter @medical/api run test -- editorial-rules/postgres-editorial-rule-persistence.spec.ts`

Expected: PASS.

## Task 2: Extend Template Governance For Journal Small Templates

**Files:**
- Modify: `apps/api/src/modules/templates/template-record.ts`
- Modify: `apps/api/src/modules/templates/template-repository.ts`
- Modify: `apps/api/src/modules/templates/in-memory-template-family-repository.ts`
- Modify: `apps/api/src/modules/templates/postgres-template-repository.ts`
- Modify: `apps/api/src/modules/templates/template-governance-service.ts`
- Modify: `apps/api/src/modules/templates/template-api.ts`
- Modify: `apps/api/src/modules/templates/index.ts`
- Modify: `apps/api/test/templates/template-governance.spec.ts`

- [ ] **Step 1: Write the failing template governance tests**

Add coverage for:
- creating a journal template profile under a base family
- preventing a journal template from pointing at the wrong manuscript family
- listing journal templates per family

Run: `pnpm --filter @medical/api run test -- templates/template-governance.spec.ts`

Expected: FAIL because the API does not expose journal templates yet.

- [ ] **Step 2: Add template-domain records and repository methods**

Introduce record and repository methods for:
- create/list/find journal templates
- archive and activate them

- [ ] **Step 3: Add service-layer validation**

Enforce:
- one parent family per journal template
- unique journal key per parent family
- admin-only publish/activate transitions

- [ ] **Step 4: Add API routes**

Expose endpoints in `template-api.ts` and wire them through `api-http-server.ts`.

- [ ] **Step 5: Re-run the focused template governance test**

Run: `pnpm --filter @medical/api run test -- templates/template-governance.spec.ts`

Expected: PASS.

## Task 3: Enrich Editorial Rules With Rule Objects, Selectors, And Authoring Payload

**Files:**
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-record.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-repository.ts`
- Modify: `apps/api/src/modules/editorial-rules/in-memory-editorial-rule-repository.ts`
- Modify: `apps/api/src/modules/editorial-rules/postgres-editorial-rule-repository.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-api.ts`
- Modify: `apps/api/src/modules/editorial-rules/index.ts`
- Modify: `apps/api/test/editorial-rules/editorial-rule-governance.spec.ts`

- [ ] **Step 1: Extend the failing rule governance test**

Add a rule creation case that submits:
- `ruleObject: "abstract"`
- `selector: { section_selector: "abstract", label_selector: { text: "摘要 目的" } }`
- `authoringPayload` with the exact normalized example `（摘要　目的）`
- optional `journalTemplateId` on the parent rule set

Run: `pnpm --filter @medical/api run test -- editorial-rules/editorial-rule-governance.spec.ts`

Expected: FAIL because the API types and service signatures are still old.

- [ ] **Step 2: Expand the editorial rule record types**

Keep `scope/trigger/action` for machine execution, but add dedicated fields for:
- `rule_object`
- `selector`
- `authoring_payload`
- `evidence_level`

- [ ] **Step 3: Update the service and repository APIs**

Make sure rule creation and listing preserve the new fields end-to-end.

- [ ] **Step 4: Support journal-scoped rule sets**

Allow `CreateEditorialRuleSetInput` to accept `journalTemplateId?: string`.

- [ ] **Step 5: Re-run the focused rule governance test**

Run: `pnpm --filter @medical/api run test -- editorial-rules/editorial-rule-governance.spec.ts`

Expected: PASS.

## Task 4: Add Rule Resolution And Knowledge Projection For Base Plus Journal Overrides

**Files:**
- Create: `apps/api/src/modules/editorial-rules/editorial-rule-resolution-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-projection-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/index.ts`
- Create: `apps/api/test/editorial-rules/editorial-rule-resolution.spec.ts`
- Modify: `apps/api/test/editorial-rules/editorial-rule-projection.spec.ts`

- [ ] **Step 1: Write the failing resolution tests**

Cover:
- resolving only base rules when no journal template is selected
- overlaying journal rules on top of base rules
- preferring the journal rule when the same object + selector + trigger key conflicts

Run: `pnpm --filter @medical/api run test -- editorial-rules/editorial-rule-resolution.spec.ts`

Expected: FAIL because the resolution service does not exist.

- [ ] **Step 2: Implement the resolution service**

Resolve rules in this order:
1. base family published rule set for module
2. journal template published rule set for module
3. overlay conflicts by deterministic precedence

- [ ] **Step 3: Expand knowledge projections**

Project:
- manuscript type
- journal name/journal key when present
- rule object
- standard example
- common error text

This lets knowledge retrieval stay explanatory while the rule store remains the execution source.

- [ ] **Step 4: Update projection tests**

Add expectations that a projected rule records journal metadata and object metadata.

- [ ] **Step 5: Run the focused API tests**

Run: `pnpm --filter @medical/api run test -- editorial-rules/editorial-rule-resolution.spec.ts editorial-rules/editorial-rule-projection.spec.ts`

Expected: PASS.

## Task 5: Add Manuscript-Side Journal Template Selection And Runtime Binding Input

**Files:**
- Modify: `apps/api/src/modules/manuscripts/manuscript-record.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-repository.ts`
- Modify: `apps/api/src/modules/manuscripts/in-memory-manuscript-repository.ts`
- Modify: `apps/api/src/modules/manuscripts/postgres-manuscript-repository.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-lifecycle-service.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-api.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Create: `apps/api/test/manuscripts/manuscript-template-selection.spec.ts`

- [ ] **Step 1: Write the failing manuscript selection test**

Cover:
- upload still auto-binds the base family when exactly one active base family matches
- an operator can set or clear `current_journal_template_id`
- selecting a journal template from a different base family is rejected

Run: `pnpm --filter @medical/api run test -- manuscripts/manuscript-template-selection.spec.ts`

Expected: FAIL because manuscripts do not support journal template selection yet.

- [ ] **Step 2: Extend the manuscript record and repositories**

Add `current_journal_template_id?: string`.

- [ ] **Step 3: Add a manuscript API mutation**

Expose a targeted update route for template selection rather than a broad free-form manuscript patch.

- [ ] **Step 4: Thread journal selection into runtime resolution**

Where module execution currently relies on `current_template_family_id`, also pass `current_journal_template_id` into rule resolution.

- [ ] **Step 5: Re-run the focused manuscript test**

Run: `pnpm --filter @medical/api run test -- manuscripts/manuscript-template-selection.spec.ts`

Expected: PASS.

## Task 6: Build Frontend Rule Authoring Types, Presets, And Serialization

**Files:**
- Create: `apps/web/src/features/template-governance/rule-authoring-types.ts`
- Create: `apps/web/src/features/template-governance/rule-authoring-presets.ts`
- Create: `apps/web/src/features/template-governance/rule-authoring-serialization.ts`
- Modify: `apps/web/src/features/templates/types.ts`
- Modify: `apps/web/src/features/templates/template-api.ts`
- Modify: `apps/web/src/features/editorial-rules/types.ts`
- Modify: `apps/web/src/features/editorial-rules/editorial-rules-api.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-controller.ts`
- Create: `apps/web/test/template-governance-rule-authoring.spec.ts`

- [ ] **Step 1: Write the failing serialization/unit test**

Cover:
- abstract preset serializes `摘要 目的 -> （摘要　目的）`
- table preset serializes a three-line-table selector
- journal template selection is preserved in rule-set creation payloads

Run: `pnpm --filter @medsys/web run test -- template-governance-rule-authoring.spec.ts`

Expected: FAIL because the authoring helpers do not exist yet.

- [ ] **Step 2: Define rule-object preset metadata**

Create presets for at least:
- `abstract`
- `heading_hierarchy`
- `numeric_unit`
- `statistical_expression`
- `table`
- `reference`
- `declaration`

- [ ] **Step 3: Add serialization and hydration helpers**

Translate between:
- object-specific form fields
- API payload (`scope`, `selector`, `trigger`, `action`, `authoringPayload`)

- [ ] **Step 4: Extend frontend template and editorial-rule API types**

Support journal template profiles and enriched rule payloads end-to-end.

- [ ] **Step 5: Re-run the focused web unit test**

Run: `pnpm --filter @medsys/web run test -- template-governance-rule-authoring.spec.ts`

Expected: PASS.

## Task 7: Refactor The Governance Workbench Into An Object-Specific Authoring UI

**Files:**
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench.css`
- Create: `apps/web/src/features/template-governance/rule-authoring-navigation.tsx`
- Create: `apps/web/src/features/template-governance/rule-authoring-form.tsx`
- Create: `apps/web/src/features/template-governance/rule-authoring-preview.tsx`
- Modify: `apps/web/playwright/admin-governance.spec.ts`

- [ ] **Step 1: Split the current rule authoring area out of the large page**

Keep the page shell in `template-governance-workbench-page.tsx`, but move the new rule-authoring concerns into dedicated files so this screen does not grow further past its current size.

- [ ] **Step 2: Add top-level selectors**

Support:
- base family selection
- journal template selection
- module selection
- rule object navigation

- [ ] **Step 3: Implement the high-value object forms**

Phase-1 forms must work for:
- abstract
- heading hierarchy
- numeric/unit/statistics
- table
- reference
- declaration

- [ ] **Step 4: Add preview and impact panels**

Show:
- normalized example
- resolved selector summary
- automation risk posture
- whether the rule is base-family or journal-level

- [ ] **Step 5: Extend Playwright governance coverage**

Add a browser scenario that:
- creates a base family
- creates a journal template
- creates an abstract rule using the exact `（摘要　目的）` normalization
- creates a table rule for a three-line table

Run: `pnpm --filter @medsys/web run test:browser -- admin-governance.spec.ts`

Expected: PASS.

## Task 8: Add Manuscript Workbench Journal Picker And Resolved Rule Context

**Files:**
- Modify: `apps/web/src/features/manuscripts/types.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/playwright/admin-governance.spec.ts`

- [ ] **Step 1: Extend the manuscript workbench types and controller**

Support reading and updating:
- current base template family
- current journal template
- available journal templates for the selected base family

- [ ] **Step 2: Add a journal picker to the operator UI**

Place it near the existing manuscript summary so the operator chooses the small template before launching `editing` or `proofreading`.

- [ ] **Step 3: Show the resolved template context**

Display a compact summary:
- manuscript type
- base family
- journal template
- whether journal overrides are active

- [ ] **Step 4: Add browser coverage**

Extend a workbench test so the operator can pick a journal template and then run a module with that context bound.

Run: `pnpm --filter @medsys/web run test:browser -- admin-governance.spec.ts`

Expected: PASS with the new journal selection flow.

## Task 9: Upgrade Worker Inspection For Structured Rules Without Overpromising Full Table Rewrite

**Files:**
- Modify: `apps/worker-py/src/document_pipeline/parse_docx.py`
- Modify: `apps/worker-py/src/document_pipeline/apply_editorial_rules.py`
- Create: `apps/worker-py/tests/test_apply_editorial_rules.py`

- [ ] **Step 1: Write the failing worker tests**

Cover:
- exact abstract heading replacement still works
- table rules are recognized as inspectable objects
- unsupported table auto-apply actions are reported as inspect/manual-review, not silently ignored

Run: `pytest apps/worker-py/tests/test_apply_editorial_rules.py -q`

Expected: FAIL because the worker only handles paragraph replacement today.

- [ ] **Step 2: Add table/object parsing primitives**

Teach the parser to surface:
- paragraphs
- headings
- tables
- table captions/notes when discoverable

- [ ] **Step 3: Extend rule application behavior conservatively**

Phase 1 behavior should be:
- continue auto-applying safe exact-text paragraph rules
- emit deterministic inspection findings for table rules and unsupported object rules
- never pretend a table layout rewrite succeeded when it was not implemented

- [ ] **Step 4: Re-run the focused worker test**

Run: `pytest apps/worker-py/tests/test_apply_editorial_rules.py -q`

Expected: PASS.

## Task 10: Run Integrated Verification And Ship The Plan Scope

**Files:**
- Modify as needed from prior tasks only

- [ ] **Step 1: Run API typecheck**

Run: `pnpm --filter @medical/api run typecheck`

Expected: PASS.

- [ ] **Step 2: Run API tests**

Run: `pnpm --filter @medical/api run test`

Expected: PASS.

- [ ] **Step 3: Run web typecheck**

Run: `pnpm --filter @medsys/web run typecheck`

Expected: PASS.

- [ ] **Step 4: Run web tests**

Run: `pnpm --filter @medsys/web run test`

Expected: PASS.

- [ ] **Step 5: Run browser governance coverage**

Run: `pnpm --filter @medsys/web run test:browser -- admin-governance.spec.ts`

Expected: PASS.

- [ ] **Step 6: Run worker tests**

Run: `pytest apps/worker-py/tests/test_apply_editorial_rules.py -q`

Expected: PASS.

- [ ] **Step 7: Run the repo gate**

Run: `pnpm verify:manuscript-workbench`

Expected: PASS.

## Risks To Watch During Execution

- Extending `TemplateFamily` itself for journal behavior would create avoidable blast radius in runtime binding and existing mainline flows. Keep journal overrides as a child entity.
- The governance page is already large; if UI logic is added inline, maintainability will get worse fast. Split the rule-authoring UI into focused files early.
- Table rules will tempt scope expansion into full DOCX layout rewriting. Hold phase 1 to authoring plus inspectability unless a narrow safe auto-fix is clearly deterministic.
- Knowledge projection must stay downstream of published rules. Do not let knowledge search become the source of truth for execution.

## Definition Of Done

- Medical editors can create manuscript-type base templates and journal small templates.
- Medical editors can author structured rules through object-specific forms, including:
  - abstract normalization
  - statistics/numeric rules
  - table rules
  - reference rules
  - declaration rules
- The system resolves rule bundles deterministically as base family plus journal overrides.
- Manuscript operators can choose a journal template before `editing` and `proofreading`.
- Knowledge projections include journal-aware rule summaries.
- Worker behavior is honest about what can auto-apply versus inspect-only.
- API tests, web tests, Playwright coverage, worker tests, and `pnpm verify:manuscript-workbench` all pass.

## Follow-Up After This Plan

- Add phase-2 AI candidate extraction from corrected manuscripts into the same authoring model.
- Expand deterministic table auto-fixes only after inspection data proves the selectors are stable.
- Add import/export for structured rule sets once the object schema settles under real editorial usage.
