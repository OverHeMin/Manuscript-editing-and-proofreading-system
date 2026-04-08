# Medical Rule Library V3 Table Semantic Hit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a DOCX-only three-line-table semantic layer so medical table rules can hit stable semantic coordinates in both `editing` and `proofreading`, with generic-template matching, journal-template overrides, and operator-readable hit explanations.

**Architecture:** Keep the current V2 rule store and dual-template resolution chain, but insert a new semantic layer between raw Word tables and rule execution. The Python DOCX parser will emit normalized table semantics, the API will carry those semantics into the governed runtime context, and the rule engine will resolve `table` rules against semantic coordinates rather than brittle raw row/column positions. The web rule center will author and preview table-semantic selectors against the same vocabulary used by runtime.

**Tech Stack:** TypeScript, React, node:test via `tsx`, Playwright, Python 3.12 + `pytest`, existing DOCX worker pipeline, `packages/contracts`

---

## Current Baseline

- `origin/main` already contains rule library V2:
  - `table` is a supported `RuleObjectKey`
  - rule authoring, preview, learning, and knowledge projection are in place
  - `editing` and `proofreading` already share one governed rule source
- The Python DOCX parser currently emits:
  - heading sections
  - basic block ordering
  - raw table dimensions
  - raw table cells
- The current parser does **not** emit stable table semantics such as:
  - multi-level header structure
  - stub-column identity
  - unit markers
  - footnote items
  - merged semantic relations
- The current rule engine can preview and resolve table rules, but not against a dedicated table-semantic coordinate system.
- This plan intentionally avoids PDF and full automatic table re-layout. The objective is stable hit precision, not maximum automation.

## Scope Notes

- Only `DOCX / Word` inputs are in scope.
- Only `medical three-line tables` are in scope.
- The runtime truth remains:
  - rules are the only executable truth source
  - knowledge is projection only
- The first V3 slice must improve `hit precision`, not `layout beauty`.
- `editing` and `proofreading` must consume the same table-semantic snapshot.
- Prefer adding a focused semantic layer over mutating unrelated runtime architecture.

## File Structure

### Shared Contracts

- Create: `packages/contracts/src/table-semantics.ts`
- Modify: `packages/contracts/src/document-pipeline.ts`
- Modify: `packages/contracts/src/editorial-rules.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/contracts/type-tests/table-semantics-v3.test.ts`

### Worker Table Semantic Extraction

- Create: `apps/worker-py/src/document_pipeline/table_semantics.py`
- Modify: `apps/worker-py/src/document_pipeline/parse_docx.py`
- Modify: `apps/worker-py/tests/document_pipeline/test_parse_docx.py`
- Create: `apps/worker-py/tests/document_pipeline/test_table_semantics.py`

### API Document Structure And Runtime Context

- Modify: `apps/api/src/modules/document-pipeline/document-structure-service.ts`
- Modify: `apps/api/src/modules/document-pipeline/document-pipeline-api.ts`
- Modify: `apps/api/src/modules/document-pipeline/index.ts`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/src/modules/document-pipeline/editorial-docx-transform-service.ts`

### Editorial Rule Resolution And Preview

- Create: `apps/api/src/modules/editorial-rules/editorial-rule-table-hit-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-object-catalog.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-preview-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-resolution-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-api.ts`
- Modify: `apps/api/src/modules/editorial-rules/index.ts`

### Web Rule Center

- Modify: `apps/web/src/features/editorial-rules/types.ts`
- Modify: `apps/web/src/features/editorial-rules/editorial-rules-api.ts`
- Modify: `apps/web/src/features/template-governance/rule-authoring-types.ts`
- Modify: `apps/web/src/features/template-governance/rule-authoring-presets.ts`
- Modify: `apps/web/src/features/template-governance/rule-authoring-serialization.ts`
- Modify: `apps/web/src/features/template-governance/rule-authoring-form.tsx`
- Create: `apps/web/src/features/template-governance/rule-authoring-table-semantic-fields.tsx`
- Modify: `apps/web/src/features/template-governance/rule-authoring-preview.tsx`
- Modify: `apps/web/src/features/template-governance/rule-authoring-explainability.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`

### Verification

- Create: `apps/api/test/document-pipeline/document-table-semantics.spec.ts`
- Modify: `apps/api/test/document-pipeline/document-structure.spec.ts`
- Modify: `apps/api/test/editorial-rules/editorial-rule-resolution.spec.ts`
- Modify: `apps/api/test/editorial-rules/editorial-rule-preview.spec.ts`
- Modify: `apps/api/test/editing/deterministic-format-rule-executor.spec.ts`
- Modify: `apps/api/test/editing/editing-rule-execution.spec.ts`
- Modify: `apps/api/test/proofreading/proofreading-rule-checker.spec.ts`
- Modify: `apps/api/test/proofreading/proofreading-rule-report.spec.ts`
- Modify: `apps/web/test/template-governance-rule-authoring.spec.ts`
- Modify: `apps/web/test/template-governance-workbench-page.spec.tsx`
- Modify: `apps/web/playwright/admin-governance.spec.ts`

## Task 1: Define Shared Table Semantic Contracts

**Files:**
- Create: `packages/contracts/src/table-semantics.ts`
- Modify: `packages/contracts/src/document-pipeline.ts`
- Modify: `packages/contracts/src/editorial-rules.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/type-tests/table-semantics-v3.test.ts`

- [ ] **Step 1: Write the failing contract test first**

Add a type test that expects a shared semantic shape similar to:

```ts
export interface TableSemanticSnapshot {
  table_id: string;
  profile: TableSemanticProfile;
  header_cells: TableSemanticHeaderCell[];
  data_cells: TableSemanticDataCell[];
  footnote_items: TableSemanticFootnoteItem[];
}
```

Also require selector support such as:

```ts
selector: {
  semantic_target: "header_cell";
  header_path_includes?: ["治疗组"];
  unit_context?: "header";
}
```

- [ ] **Step 2: Run the contracts check to verify it fails**

Run: `pnpm --filter @medical/contracts run typecheck`

Expected: FAIL because `table-semantics.ts` and the new selector vocabulary do not exist yet.

- [ ] **Step 3: Add the shared semantic contract file**

Create `packages/contracts/src/table-semantics.ts` with focused exported types for:
- `table_block`
- `table_label`
- `table_title`
- `header_cell`
- `stub_column`
- `data_cell`
- `unit_marker`
- `footnote_item`
- `merged_relation`
- `table_semantic_profile`

Keep the file table-only; do not bury this inside a large unrelated contract file.

- [ ] **Step 4: Thread the contract through document-pipeline and editorial-rules types**

Update:
- `packages/contracts/src/document-pipeline.ts`
- `packages/contracts/src/editorial-rules.ts`
- `packages/contracts/src/index.ts`

Make the editorial rule contract support table-semantic selectors without changing the overall rule truth model.

- [ ] **Step 5: Re-run the contracts check**

Run: `pnpm --filter @medical/contracts run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src/table-semantics.ts packages/contracts/src/document-pipeline.ts packages/contracts/src/editorial-rules.ts packages/contracts/src/index.ts packages/contracts/type-tests/table-semantics-v3.test.ts
git commit -m "feat: add table semantic contracts for rule library v3"
```

## Task 2: Extract Three-Line Table Semantics From DOCX

**Files:**
- Create: `apps/worker-py/src/document_pipeline/table_semantics.py`
- Modify: `apps/worker-py/src/document_pipeline/parse_docx.py`
- Modify: `apps/worker-py/tests/document_pipeline/test_parse_docx.py`
- Test: `apps/worker-py/tests/document_pipeline/test_table_semantics.py`

- [ ] **Step 1: Write failing parser tests for representative medical tables**

Add fixtures that cover:
- one-row table title + simple header
- multi-row header with merged cells
- left-side stub column
- units located in header cells
- statistical footnotes such as `*P<0.05`
- merged header groups

At minimum, assert that the parser can return:

```python
{
  "tables": [
    {
      "semantic": {
        "header_cells": [...],
        "stub_columns": [...],
        "unit_markers": [...],
        "footnote_items": [...],
      }
    }
  ]
}
```

- [ ] **Step 2: Run the worker parser tests to verify they fail**

Run from `apps/worker-py`:

`python -m pytest tests/document_pipeline/test_parse_docx.py tests/document_pipeline/test_table_semantics.py -q`

Expected: FAIL because semantic extraction is not implemented.

- [ ] **Step 3: Implement focused table-semantic helpers**

Create `table_semantics.py` and keep the logic decomposed:
- detect caption / label / title
- split header rows from body rows
- identify stub-column candidates
- extract unit markers
- parse footnotes
- normalize merged relations

Do not bury all table logic inside `parse_docx.py`.

- [ ] **Step 4: Extend `parse_docx.py` to emit semantic tables**

Make `extract_structure_from_document_xml` return raw table evidence plus semantic output, and keep fail-open behavior:
- readable table -> `ready`
- partially understandable table -> `partial`
- opaque table -> `needs_manual_review`

- [ ] **Step 5: Re-run the worker parser tests**

Run from `apps/worker-py`:

`python -m pytest tests/document_pipeline/test_parse_docx.py tests/document_pipeline/test_table_semantics.py -q`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/worker-py/src/document_pipeline/table_semantics.py apps/worker-py/src/document_pipeline/parse_docx.py apps/worker-py/tests/document_pipeline/test_parse_docx.py apps/worker-py/tests/document_pipeline/test_table_semantics.py
git commit -m "feat: extract three-line table semantics from docx"
```

## Task 3: Carry Table Semantics Through Document Structure And Runtime Context

**Files:**
- Modify: `apps/api/src/modules/document-pipeline/document-structure-service.ts`
- Modify: `apps/api/src/modules/document-pipeline/document-pipeline-api.ts`
- Modify: `apps/api/src/modules/document-pipeline/index.ts`
- Test: `apps/api/test/document-pipeline/document-structure.spec.ts`
- Test: `apps/api/test/document-pipeline/document-table-semantics.spec.ts`

- [ ] **Step 1: Write failing API tests for semantic-table snapshots**

Add coverage that expects the document-structure layer to expose:
- table semantic snapshots from the worker
- parser status propagation
- partial/manual-review fail-open signaling

Include a test where the structure snapshot now carries:

```ts
tables: [
  {
    table_id: "table-1",
    semantic_profile: { is_three_line_table: true },
  },
]
```

- [ ] **Step 2: Run the focused document-structure tests to verify they fail**

Run:

`pnpm --filter @medical/api run test -- document-pipeline/document-structure.spec.ts document-pipeline/document-table-semantics.spec.ts`

Expected: FAIL because the service only carries sections and warnings today.

- [ ] **Step 3: Extend the document-structure service contract**

Update `document-structure-service.ts` so API-side snapshots include semantic tables in a stable runtime-ready shape.

Keep responsibilities clear:
- worker result parsing remains in document-pipeline
- rule hitting still belongs to editorial-rules

- [ ] **Step 4: Expose semantic tables through the document-pipeline API**

Update the API transport so downstream modules can hydrate one semantic snapshot without re-parsing the DOCX.

- [ ] **Step 5: Re-run the focused document-structure tests**

Run:

`pnpm --filter @medical/api run test -- document-pipeline/document-structure.spec.ts document-pipeline/document-table-semantics.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/document-pipeline/document-structure-service.ts apps/api/src/modules/document-pipeline/document-pipeline-api.ts apps/api/src/modules/document-pipeline/index.ts apps/api/test/document-pipeline/document-structure.spec.ts apps/api/test/document-pipeline/document-table-semantics.spec.ts
git commit -m "feat: expose table semantic snapshots in document structure"
```

## Task 4: Add Table-Semantic Rule Selectors And Resolution Support

**Files:**
- Create: `apps/api/src/modules/editorial-rules/editorial-rule-table-hit-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-object-catalog.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-resolution-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-preview-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-api.ts`
- Modify: `apps/api/src/modules/editorial-rules/index.ts`
- Test: `apps/api/test/editorial-rules/editorial-rule-resolution.spec.ts`
- Test: `apps/api/test/editorial-rules/editorial-rule-preview.spec.ts`

- [ ] **Step 1: Write failing resolution tests for semantic table selectors**

Add coverage for selectors such as:

```ts
selector: {
  semantic_target: "header_cell",
  header_path_includes: ["治疗组"],
}
```

```ts
selector: {
  semantic_target: "footnote_item",
  note_kind: "statistical_significance",
}
```

Also assert preview output includes:
- matched semantic target
- coverage reason
- journal override explanation

- [ ] **Step 2: Run the focused rule-resolution tests to verify they fail**

Run:

`pnpm --filter @medical/api run test -- editorial-rules/editorial-rule-resolution.spec.ts editorial-rules/editorial-rule-preview.spec.ts`

Expected: FAIL because runtime cannot traverse semantic table coordinates yet.

- [ ] **Step 3: Implement a focused table-hit service**

Create `editorial-rule-table-hit-service.ts` to:
- walk semantic tables
- find matching semantic objects
- return deterministic hit evidence
- stay independent from UI formatting

This file should own table traversal logic so `editorial-rule-resolution-service.ts` does not become a giant mixed parser.

- [ ] **Step 4: Wire preview and resolution to the table-hit service**

Update the rule engine so:
- generic template rules hit first
- journal-template rules override on the same semantic target set
- final preview result explains which rule won and why

- [ ] **Step 5: Re-run the focused rule-resolution tests**

Run:

`pnpm --filter @medical/api run test -- editorial-rules/editorial-rule-resolution.spec.ts editorial-rules/editorial-rule-preview.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/editorial-rules/editorial-rule-table-hit-service.ts apps/api/src/modules/editorial-rules/editorial-rule-object-catalog.ts apps/api/src/modules/editorial-rules/editorial-rule-resolution-service.ts apps/api/src/modules/editorial-rules/editorial-rule-preview-service.ts apps/api/src/modules/editorial-rules/editorial-rule-service.ts apps/api/src/modules/editorial-rules/editorial-rule-api.ts apps/api/src/modules/editorial-rules/index.ts apps/api/test/editorial-rules/editorial-rule-resolution.spec.ts apps/api/test/editorial-rules/editorial-rule-preview.spec.ts
git commit -m "feat: resolve table rules against semantic coordinates"
```

## Task 5: Use The Shared Semantic Layer In Editing And Proofreading

**Files:**
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/src/modules/document-pipeline/editorial-docx-transform-service.ts`
- Test: `apps/api/test/editing/deterministic-format-rule-executor.spec.ts`
- Test: `apps/api/test/editing/editing-rule-execution.spec.ts`
- Test: `apps/api/test/proofreading/proofreading-rule-checker.spec.ts`
- Test: `apps/api/test/proofreading/proofreading-rule-report.spec.ts`

- [ ] **Step 1: Write failing runtime tests that prove both modules share one semantic snapshot**

Cover:
- `editing` applies a table rule to a semantic target
- `proofreading` reports the same target using the same semantic coordinates
- journal override explanations are visible in both paths

- [ ] **Step 2: Run the focused editing and proofreading tests to verify they fail**

Run:

`pnpm --filter @medical/api run test -- editing/deterministic-format-rule-executor.spec.ts editing/editing-rule-execution.spec.ts proofreading/proofreading-rule-checker.spec.ts proofreading/proofreading-rule-report.spec.ts`

Expected: FAIL because neither module currently hydrates table semantics into the rule-execution path.

- [ ] **Step 3: Hydrate semantic tables once and reuse them in both modules**

Update `editing-service.ts` and `proofreading-service.ts` so they:
- read the same semantic table snapshot
- pass semantic hit evidence into rule execution
- keep fail-open behavior when a table is only partially understood

- [ ] **Step 4: Extend deterministic formatting and reporting outputs**

Make the execution/report payloads carry semantic hit metadata such as:
- `table_id`
- `semantic_target`
- `header_path`
- `footnote_anchor`
- `override_source`

- [ ] **Step 5: Re-run the focused editing and proofreading tests**

Run:

`pnpm --filter @medical/api run test -- editing/deterministic-format-rule-executor.spec.ts editing/editing-rule-execution.spec.ts proofreading/proofreading-rule-checker.spec.ts proofreading/proofreading-rule-report.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/editing/editing-service.ts apps/api/src/modules/proofreading/proofreading-service.ts apps/api/src/modules/document-pipeline/editorial-docx-transform-service.ts apps/api/test/editing/deterministic-format-rule-executor.spec.ts apps/api/test/editing/editing-rule-execution.spec.ts apps/api/test/proofreading/proofreading-rule-checker.spec.ts apps/api/test/proofreading/proofreading-rule-report.spec.ts
git commit -m "feat: share table semantic hits across editing and proofreading"
```

## Task 6: Upgrade Rule Center Authoring, Preview, And Explainability

**Files:**
- Modify: `apps/web/src/features/editorial-rules/types.ts`
- Modify: `apps/web/src/features/editorial-rules/editorial-rules-api.ts`
- Modify: `apps/web/src/features/template-governance/rule-authoring-types.ts`
- Modify: `apps/web/src/features/template-governance/rule-authoring-presets.ts`
- Modify: `apps/web/src/features/template-governance/rule-authoring-serialization.ts`
- Modify: `apps/web/src/features/template-governance/rule-authoring-form.tsx`
- Create: `apps/web/src/features/template-governance/rule-authoring-table-semantic-fields.tsx`
- Modify: `apps/web/src/features/template-governance/rule-authoring-preview.tsx`
- Modify: `apps/web/src/features/template-governance/rule-authoring-explainability.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Test: `apps/web/test/template-governance-rule-authoring.spec.ts`
- Test: `apps/web/test/template-governance-workbench-page.spec.tsx`
- Test: `apps/web/playwright/admin-governance.spec.ts`

- [ ] **Step 1: Write failing web tests for semantic table authoring**

Cover:
- selecting `table` as the rule object
- choosing a semantic target such as `header_cell` or `footnote_item`
- entering selector details such as `header_path_includes`
- previewing generic hit vs journal override explanation

- [ ] **Step 2: Run the focused web tests to verify they fail**

Run:

`pnpm --filter @medsys/web run test -- template-governance-rule-authoring.spec.ts template-governance-workbench-page.spec.tsx`

Expected: FAIL because the current UI cannot author semantic table selectors.

- [ ] **Step 3: Add a dedicated table-semantic authoring subcomponent**

Create `rule-authoring-table-semantic-fields.tsx` and keep table-specific authoring logic out of the generic form as much as possible.

The form should support at least:
- semantic target
- header path matching
- stub/data region targeting
- unit context
- footnote kind

- [ ] **Step 4: Extend preview and explainability surfaces**

Make the web preview show:
- matched table ID
- matched semantic target
- generic-template reason
- journal-template override reason

- [ ] **Step 5: Re-run unit tests and the governance browser smoke**

Run:

`pnpm --filter @medsys/web run test -- template-governance-rule-authoring.spec.ts template-governance-workbench-page.spec.tsx`

`pnpm --filter @medsys/web run test:browser -- admin-governance.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/editorial-rules/types.ts apps/web/src/features/editorial-rules/editorial-rules-api.ts apps/web/src/features/template-governance/rule-authoring-types.ts apps/web/src/features/template-governance/rule-authoring-presets.ts apps/web/src/features/template-governance/rule-authoring-serialization.ts apps/web/src/features/template-governance/rule-authoring-form.tsx apps/web/src/features/template-governance/rule-authoring-table-semantic-fields.tsx apps/web/src/features/template-governance/rule-authoring-preview.tsx apps/web/src/features/template-governance/rule-authoring-explainability.tsx apps/web/src/features/template-governance/template-governance-workbench-page.tsx apps/web/test/template-governance-rule-authoring.spec.ts apps/web/test/template-governance-workbench-page.spec.tsx apps/web/playwright/admin-governance.spec.ts
git commit -m "feat: author and preview table semantic rule hits"
```

## Task 7: Lock The Integration Path And Run The Gate

**Files:**
- Modify: `apps/api/test/http/persistent-governance-http.spec.ts`
- Modify: `apps/api/test/http/persistent-workbench-http.spec.ts`
- Modify: `apps/web/playwright/manuscript-handoff.spec.ts`
- Modify: `apps/web/playwright/knowledge-review-handoff.spec.ts`
- Modify: `apps/web/playwright/learning-review-flow.spec.ts`

- [ ] **Step 1: Add one end-to-end integration test for semantic-table evidence**

Cover the critical path:
- DOCX table parsed into semantics
- editing hits a table semantic target
- proofreading reports the same target
- operator-facing evidence still explains generic rule vs journal override

- [ ] **Step 2: Run the focused HTTP and browser tests to verify any remaining gaps**

Run:

`pnpm --filter @medical/api run test -- http/persistent-governance-http.spec.ts http/persistent-workbench-http.spec.ts`

`pnpm --filter @medsys/web run test:browser -- manuscript-handoff.spec.ts learning-review-flow.spec.ts knowledge-review-handoff.spec.ts`

Expected: Fix any failures until the semantic-table path is covered without regressing existing workbench flows.

- [ ] **Step 3: Run the worker parser tests one more time**

Run from `apps/worker-py`:

`python -m pytest tests/document_pipeline/test_parse_docx.py tests/document_pipeline/test_table_semantics.py -q`

Expected: PASS.

- [ ] **Step 4: Run the full manuscript workbench gate**

Run:

`pnpm verify:manuscript-workbench`

Expected: PASS.

- [ ] **Step 5: Commit the final integration pass**

```bash
git add apps/api/test/http/persistent-governance-http.spec.ts apps/api/test/http/persistent-workbench-http.spec.ts apps/web/playwright/manuscript-handoff.spec.ts apps/web/playwright/learning-review-flow.spec.ts apps/web/playwright/knowledge-review-handoff.spec.ts
git commit -m "test: cover v3 table semantic hit integration"
```

## Final Verification Checklist

- [ ] `pnpm --filter @medical/contracts run typecheck`
- [ ] `python -m pytest tests/document_pipeline/test_parse_docx.py tests/document_pipeline/test_table_semantics.py -q` from `apps/worker-py`
- [ ] `pnpm --filter @medical/api run test -- document-pipeline/document-structure.spec.ts document-pipeline/document-table-semantics.spec.ts`
- [ ] `pnpm --filter @medical/api run test -- editorial-rules/editorial-rule-resolution.spec.ts editorial-rules/editorial-rule-preview.spec.ts`
- [ ] `pnpm --filter @medical/api run test -- editing/deterministic-format-rule-executor.spec.ts editing/editing-rule-execution.spec.ts proofreading/proofreading-rule-checker.spec.ts proofreading/proofreading-rule-report.spec.ts`
- [ ] `pnpm --filter @medsys/web run test -- template-governance-rule-authoring.spec.ts template-governance-workbench-page.spec.tsx`
- [ ] `pnpm --filter @medsys/web run test:browser -- admin-governance.spec.ts`
- [ ] `pnpm verify:manuscript-workbench`

## Notes For The Implementer

- Do not add PDF table support in this plan.
- Do not make knowledge retrieval the execution truth source.
- Keep table parsing and table rule hitting in separate files.
- Prefer semantic coordinates over raw row/column checks.
- Keep fail-open behavior honest:
  - partially understood table -> `inspect_only` or `needs_manual_review`
  - fully opaque table -> no silent auto-application
- Preserve the current generic-template then journal-template override order.
