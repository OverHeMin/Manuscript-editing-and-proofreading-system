# Table DOCX Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan in order. Steps use checkbox (`- [ ]`) syntax for tracking. If subagents remain unavailable, execute locally in the same order and do not skip review checkpoints.

**Goal:** Deliver durable table-rule execution for the editing mainline so safe table rules can create real `edited_docx` effects, while keeping proofreading on an inspect-first, residual-only path and preserving truthful observability for rule promotion.

**Architecture:** Keep one shared DOCX transform backbone, but add a hard runtime guard so only editing-side `edited_docx` runs may auto-apply table patches. Represent table auto-apply readiness explicitly in rule authoring and compiled rule payloads. Use semantic snapshots plus a deterministic patch planner to emit local table patch instructions, then extend the Python DOCX worker to apply only safe local edits. Start with `header / footnote / unit` patch families, and only promote `caption / title / note-zone / style` after semantic anchors exist in the snapshot layer.

**Tech Stack:** TypeScript, React/Vite, node:test via `tsx`, Python `pytest`, `python-docx`, OOXML XML patching in the existing worker, existing rule-center and manuscript-workbench flows.

---

## Scope Notes

- Do not change screening in this package.
- Do not implement full table rebuild or visual re-layout.
- Do not allow proofreading to auto-apply table patches into `proofreading_draft_report`, `final_proof_annotated_docx`, or `human_final_docx`.
- Do not treat existing table rules as auto-apply capable by default. Migration starts from inspect-only.
- Do not start caption/title/note-zone/style auto-apply until the semantic snapshot can anchor those targets explicitly.
- The mandatory execution order is:
  1. runtime guard
  2. rule authoring and compile contract
  3. semantic snapshot extension
  4. patch planning ledger
  5. safe editing-side patch execution
  6. advanced patch families
  7. observability and residual promotion loop

## File Map

- Runtime guard and shared transform contract:
  - Modify: `apps/api/src/modules/editorial-execution/types.ts`
  - Modify: `apps/api/src/modules/document-pipeline/editorial-docx-transform-service.ts`
  - Modify: `apps/api/src/modules/editing/editing-service.ts`
  - Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
  - Modify: `apps/worker-py/src/document_pipeline/apply_editorial_rules.py`
  - Test: `apps/api/test/document-pipeline/editorial-docx-transform-service.spec.ts`
  - Test: `apps/api/test/editing/editing-rule-execution.spec.ts`
  - Test: `apps/api/test/proofreading/proofreading-rule-checker.spec.ts`
  - Test: `apps/worker-py/tests/document_pipeline/test_apply_editorial_rules.py`
- Rule authoring and compile contract:
  - Modify: `apps/web/src/features/template-governance/rule-authoring-types.ts`
  - Modify: `apps/web/src/features/template-governance/rule-authoring-serialization.ts`
  - Modify: `apps/web/src/features/template-governance/rule-authoring-table-semantic-fields.tsx`
  - Modify: `apps/api/src/modules/editorial-rules/rule-package-compile-service.ts`
  - Test: `apps/web/test/template-governance-rule-authoring.spec.ts`
  - Test: `apps/web/test/template-governance-rule-package-compile-flow.spec.tsx`
  - Test: `apps/api/test/editorial-rules/rule-package-compile-service.spec.ts`
  - Test: `apps/api/test/editorial-rules/editorial-rule-package-authoring.spec.ts`
- Semantic snapshot extension:
  - Modify: `apps/api/src/modules/document-pipeline/document-structure-service.ts`
  - Modify: `apps/api/src/modules/document-pipeline/python-docx-structure-worker-adapter.ts`
  - Modify: `apps/worker-py/src/document_pipeline/parse_docx.py`
  - Modify: `apps/worker-py/src/document_pipeline/table_semantics.py`
  - Test: `apps/api/test/document-pipeline/document-structure.spec.ts`
  - Test: `apps/api/test/document-pipeline/document-table-semantics.spec.ts`
  - Test: `apps/worker-py/tests/document_pipeline/test_parse_docx.py`
  - Test: `apps/worker-py/tests/document_pipeline/test_table_semantics.py`
- Patch planning and result ledger:
  - Create: `apps/api/src/modules/document-pipeline/table-docx-patch-plan.ts`
  - Create: `apps/api/src/modules/document-pipeline/table-docx-patch-planner.ts`
  - Modify: `apps/api/src/modules/editorial-execution/types.ts`
  - Modify: `apps/api/src/modules/editorial-rules/editorial-rule-table-hit-service.ts`
  - Test: `apps/api/test/document-pipeline/table-docx-patch-planner.spec.ts`
  - Test: `apps/api/test/document-pipeline/editorial-docx-transform-service.spec.ts`
- Safe editing-side patch execution:
  - Create: `apps/worker-py/src/document_pipeline/table_patches.py`
  - Modify: `apps/worker-py/src/document_pipeline/apply_editorial_rules.py`
  - Modify: `apps/api/src/modules/document-pipeline/editorial-docx-transform-service.ts`
  - Modify: `apps/api/src/modules/editing/editing-service.ts`
  - Test: `apps/worker-py/tests/document_pipeline/test_table_patches.py`
  - Test: `apps/worker-py/tests/document_pipeline/test_apply_editorial_rules.py`
  - Test: `apps/api/test/document-pipeline/editorial-docx-transform-service.spec.ts`
  - Test: `apps/api/test/editing/editing-rule-execution.spec.ts`
- Advanced patch families and gating:
  - Modify: `apps/api/src/modules/document-pipeline/document-structure-service.ts`
  - Modify: `apps/api/src/modules/document-pipeline/python-docx-structure-worker-adapter.ts`
  - Modify: `apps/worker-py/src/document_pipeline/table_semantics.py`
  - Modify: `apps/worker-py/src/document_pipeline/table_patches.py`
  - Test: `apps/api/test/document-pipeline/document-table-semantics.spec.ts`
  - Test: `apps/worker-py/tests/document_pipeline/test_table_semantics.py`
  - Test: `apps/worker-py/tests/document_pipeline/test_table_patches.py`
- Observability and residual promotion:
  - Modify: `apps/api/src/modules/editorial-rules/editorial-rule-record.ts`
  - Modify: `apps/api/src/modules/editorial-rules/editorial-rule-activation-metrics-service.ts`
  - Modify: `apps/api/src/modules/review-items/review-items-service.ts`
  - Modify: `apps/api/src/modules/residual-learning/proofreading-residual-adapter.ts`
  - Modify: `apps/api/src/modules/residual-learning/residual-learning-record.ts`
  - Modify: `apps/api/src/modules/residual-learning/residual-learning-service.ts`
  - Test: `apps/api/test/proofreading/proofreading-residual-learning.spec.ts`
  - Test: `apps/api/test/editorial-rules/editorial-rule-governance.spec.ts`
  - Test: `apps/web/test/rule-center-learning-review.spec.ts`

## Planned Tasks

### Task 1: Add The Shared Transform Runtime Guard

**Files:**
- Modify: `apps/api/src/modules/editorial-execution/types.ts`
- Modify: `apps/api/src/modules/document-pipeline/editorial-docx-transform-service.ts`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/worker-py/src/document_pipeline/apply_editorial_rules.py`
- Test: `apps/api/test/document-pipeline/editorial-docx-transform-service.spec.ts`
- Test: `apps/api/test/editing/editing-rule-execution.spec.ts`
- Test: `apps/api/test/proofreading/proofreading-rule-checker.spec.ts`
- Test: `apps/worker-py/tests/document_pipeline/test_apply_editorial_rules.py`

- [ ] **Step 1: Add failing contract tests for `tableAutoApplyMode`**

Add coverage that proves:

- editing `edited_docx` can request `editing_safe_apply`
- proofreading draft/manuscript paths always pass `disabled` or `inspect_only`
- any table patch payload received under non-editing-safe mode is skipped or rejected deterministically

- [ ] **Step 2: Run the targeted tests and confirm failure**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/document-pipeline/editorial-docx-transform-service.spec.ts test/editing/editing-rule-execution.spec.ts test/proofreading/proofreading-rule-checker.spec.ts
pytest apps/worker-py/tests/document_pipeline/test_apply_editorial_rules.py
```

Expected: FAIL because the shared transform contract does not yet distinguish editing-safe table auto-apply from proofreading paths.

- [ ] **Step 3: Implement the runtime guard**

Implementation rules:

- extend `ApplyDeterministicDocxRulesInput`
- thread `tableAutoApplyMode` through editing and proofreading callers
- treat proofreading human-final publication as `disabled`
- enforce the same rule in the Python worker so the guard exists on both sides of the boundary

- [ ] **Step 4: Re-run the targeted tests and confirm they pass**

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/editorial-execution/types.ts apps/api/src/modules/document-pipeline/editorial-docx-transform-service.ts apps/api/src/modules/editing/editing-service.ts apps/api/src/modules/proofreading/proofreading-service.ts apps/worker-py/src/document_pipeline/apply_editorial_rules.py apps/api/test/document-pipeline/editorial-docx-transform-service.spec.ts apps/api/test/editing/editing-rule-execution.spec.ts apps/api/test/proofreading/proofreading-rule-checker.spec.ts apps/worker-py/tests/document_pipeline/test_apply_editorial_rules.py
git commit -m "feat: add table auto-apply runtime guard"
```

### Task 2: Add Explicit Table Rule Authoring And Compile Metadata

**Files:**
- Modify: `apps/web/src/features/template-governance/rule-authoring-types.ts`
- Modify: `apps/web/src/features/template-governance/rule-authoring-serialization.ts`
- Modify: `apps/web/src/features/template-governance/rule-authoring-table-semantic-fields.tsx`
- Modify: `apps/api/src/modules/editorial-rules/rule-package-compile-service.ts`
- Test: `apps/web/test/template-governance-rule-authoring.spec.ts`
- Test: `apps/web/test/template-governance-rule-package-compile-flow.spec.tsx`
- Test: `apps/api/test/editorial-rules/rule-package-compile-service.spec.ts`
- Test: `apps/api/test/editorial-rules/editorial-rule-package-authoring.spec.ts`

- [ ] **Step 1: Add failing authoring and compile tests**

Add coverage that proves:

- table rules can persist `grade`, `patch_type`, `apply_scope`, and `required_snapshot_capabilities`
- existing table rules default to `inspect_only`
- compile output never upgrades a legacy table rule into auto-apply without explicit metadata

- [ ] **Step 2: Run the targeted tests and confirm failure**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/template-governance-rule-authoring.spec.ts test/template-governance-rule-package-compile-flow.spec.tsx
pnpm --filter @medical/api exec node --import tsx --test test/editorial-rules/rule-package-compile-service.spec.ts test/editorial-rules/editorial-rule-package-authoring.spec.ts
```

Expected: FAIL because current table rule serialization is inspect-only and cannot represent the new fields.

- [ ] **Step 3: Implement the authoring and compile contract**

Implementation rules:

- keep current table rules compatible with migration defaults
- expose new fields only where they are meaningful
- keep `A` rules constrained to `editing_only`
- do not expose caption/style auto-apply as ready choices until snapshot capabilities exist

- [ ] **Step 4: Re-run the targeted tests and confirm they pass**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/template-governance/rule-authoring-types.ts apps/web/src/features/template-governance/rule-authoring-serialization.ts apps/web/src/features/template-governance/rule-authoring-table-semantic-fields.tsx apps/api/src/modules/editorial-rules/rule-package-compile-service.ts apps/web/test/template-governance-rule-authoring.spec.ts apps/web/test/template-governance-rule-package-compile-flow.spec.tsx apps/api/test/editorial-rules/rule-package-compile-service.spec.ts apps/api/test/editorial-rules/editorial-rule-package-authoring.spec.ts
git commit -m "feat: add explicit table rule auto-apply metadata"
```

### Task 3: Extend The Semantic Snapshot For Patch Planning

**Files:**
- Modify: `apps/api/src/modules/document-pipeline/document-structure-service.ts`
- Modify: `apps/api/src/modules/document-pipeline/python-docx-structure-worker-adapter.ts`
- Modify: `apps/worker-py/src/document_pipeline/parse_docx.py`
- Modify: `apps/worker-py/src/document_pipeline/table_semantics.py`
- Test: `apps/api/test/document-pipeline/document-structure.spec.ts`
- Test: `apps/api/test/document-pipeline/document-table-semantics.spec.ts`
- Test: `apps/worker-py/tests/document_pipeline/test_parse_docx.py`
- Test: `apps/worker-py/tests/document_pipeline/test_table_semantics.py`

- [ ] **Step 1: Add failing snapshot tests**

Split the tests into:

- current-ready anchors: `header_cell`, `footnote_item`, `unit_marker`
- next anchors: `table_label`, `table_title`, caption fields, note-zone fields, style profile

Require the tests to prove that unsupported targets are absent today and become explicit after this task.

- [ ] **Step 2: Run the targeted tests and confirm failure**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/document-pipeline/document-structure.spec.ts test/document-pipeline/document-table-semantics.spec.ts
pytest apps/worker-py/tests/document_pipeline/test_parse_docx.py apps/worker-py/tests/document_pipeline/test_table_semantics.py
```

Expected: FAIL for the new caption/title/note-zone/style capability assertions.

- [ ] **Step 3: Implement snapshot extensions**

Implementation rules:

- preserve backward compatibility for existing consumers
- do not overload free-form warnings with semantic data
- keep caption/title/note-zone/style data first-class in the snapshot contract
- only add style anchors needed for safe three-line-table patches

- [ ] **Step 4: Re-run the targeted tests and confirm they pass**

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/document-pipeline/document-structure-service.ts apps/api/src/modules/document-pipeline/python-docx-structure-worker-adapter.ts apps/worker-py/src/document_pipeline/parse_docx.py apps/worker-py/src/document_pipeline/table_semantics.py apps/api/test/document-pipeline/document-structure.spec.ts apps/api/test/document-pipeline/document-table-semantics.spec.ts apps/worker-py/tests/document_pipeline/test_parse_docx.py apps/worker-py/tests/document_pipeline/test_table_semantics.py
git commit -m "feat: extend table semantic snapshot anchors"
```

### Task 4: Introduce The Patch Planner And Result Ledger

**Files:**
- Create: `apps/api/src/modules/document-pipeline/table-docx-patch-plan.ts`
- Create: `apps/api/src/modules/document-pipeline/table-docx-patch-planner.ts`
- Modify: `apps/api/src/modules/editorial-execution/types.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-table-hit-service.ts`
- Modify: `apps/api/src/modules/document-pipeline/editorial-docx-transform-service.ts`
- Test: `apps/api/test/document-pipeline/table-docx-patch-planner.spec.ts`
- Test: `apps/api/test/document-pipeline/editorial-docx-transform-service.spec.ts`

- [ ] **Step 1: Add failing patch-planning tests**

Add coverage that proves:

- only `A + editing_only + supported_snapshot_capabilities` produce executable patch plans
- unsupported `A` rules become explicit skip results
- patch order is deterministic
- patch result states include `applied`, `skipped_no_anchor`, `skipped_conflict`, and `skipped_unsafe`

- [ ] **Step 2: Run the targeted tests and confirm failure**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/document-pipeline/table-docx-patch-planner.spec.ts test/document-pipeline/editorial-docx-transform-service.spec.ts
```

Expected: FAIL because the planner and patch ledger do not exist yet.

- [ ] **Step 3: Implement the planner**

Implementation rules:

- keep planner decisions pure and deterministic
- do not let the worker re-infer grading logic
- carry `requiredSnapshotCapabilities` into each plan
- allow current-ready plan families first: `replace_header_cell_text`, `replace_footnote_text`, `normalize_unit_text`

- [ ] **Step 4: Re-run the targeted tests and confirm they pass**

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/document-pipeline/table-docx-patch-plan.ts apps/api/src/modules/document-pipeline/table-docx-patch-planner.ts apps/api/src/modules/editorial-execution/types.ts apps/api/src/modules/editorial-rules/editorial-rule-table-hit-service.ts apps/api/src/modules/document-pipeline/editorial-docx-transform-service.ts apps/api/test/document-pipeline/table-docx-patch-planner.spec.ts apps/api/test/document-pipeline/editorial-docx-transform-service.spec.ts
git commit -m "feat: add table docx patch planner"
```

### Task 5: Implement The First Safe Editing-Side Patch Families

**Files:**
- Create: `apps/worker-py/src/document_pipeline/table_patches.py`
- Modify: `apps/worker-py/src/document_pipeline/apply_editorial_rules.py`
- Modify: `apps/api/src/modules/document-pipeline/editorial-docx-transform-service.ts`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Test: `apps/worker-py/tests/document_pipeline/test_table_patches.py`
- Test: `apps/worker-py/tests/document_pipeline/test_apply_editorial_rules.py`
- Test: `apps/api/test/document-pipeline/editorial-docx-transform-service.spec.ts`
- Test: `apps/api/test/editing/editing-rule-execution.spec.ts`

- [ ] **Step 1: Add failing writeback tests for the MVP patch families**

Start only with:

- `replace_header_cell_text`
- `replace_footnote_text`
- `normalize_unit_text`

Require fixture-based assertions that:

- output `.docx` remains valid
- only the targeted local region changes
- skipped patches are recorded without corrupting output

- [ ] **Step 2: Run the targeted tests and confirm failure**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/document-pipeline/editorial-docx-transform-service.spec.ts test/editing/editing-rule-execution.spec.ts
pytest apps/worker-py/tests/document_pipeline/test_table_patches.py apps/worker-py/tests/document_pipeline/test_apply_editorial_rules.py
```

Expected: FAIL because the worker cannot yet apply table patches.

- [ ] **Step 3: Implement the worker patch engine**

Implementation rules:

- keep patch application local
- never rebuild the whole table
- honor the fixed apply order even for the MVP families
- keep proofreading paths blocked by the runtime guard

- [ ] **Step 4: Re-run the targeted tests and confirm they pass**

- [ ] **Step 5: Commit**

```bash
git add apps/worker-py/src/document_pipeline/table_patches.py apps/worker-py/src/document_pipeline/apply_editorial_rules.py apps/api/src/modules/document-pipeline/editorial-docx-transform-service.ts apps/api/src/modules/editing/editing-service.ts apps/worker-py/tests/document_pipeline/test_table_patches.py apps/worker-py/tests/document_pipeline/test_apply_editorial_rules.py apps/api/test/document-pipeline/editorial-docx-transform-service.spec.ts apps/api/test/editing/editing-rule-execution.spec.ts
git commit -m "feat: apply safe table patches in editing docx"
```

### Task 6: Add Advanced Patch Families Only After Their Anchors Exist

**Files:**
- Modify: `apps/api/src/modules/document-pipeline/document-structure-service.ts`
- Modify: `apps/api/src/modules/document-pipeline/python-docx-structure-worker-adapter.ts`
- Modify: `apps/worker-py/src/document_pipeline/table_semantics.py`
- Modify: `apps/worker-py/src/document_pipeline/table_patches.py`
- Test: `apps/api/test/document-pipeline/document-table-semantics.spec.ts`
- Test: `apps/worker-py/tests/document_pipeline/test_table_semantics.py`
- Test: `apps/worker-py/tests/document_pipeline/test_table_patches.py`

- [ ] **Step 1: Add failing advanced-family tests**

Split the advanced families into:

- caption/title prefix normalization
- note-zone wording normalization
- three-line table style patch

Each family must prove its anchor exists before patch execution is allowed.

- [ ] **Step 2: Run the targeted tests and confirm failure**

- [ ] **Step 3: Implement the advanced families**

Implementation rules:

- only promote one advanced family at a time
- if style anchoring remains unstable, keep `apply_three_line_table_style` as `B`
- do not force this task to ship if the MVP families are already useful and stable

- [ ] **Step 4: Re-run the targeted tests and confirm they pass**

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/document-pipeline/document-structure-service.ts apps/api/src/modules/document-pipeline/python-docx-structure-worker-adapter.ts apps/worker-py/src/document_pipeline/table_semantics.py apps/worker-py/src/document_pipeline/table_patches.py apps/api/test/document-pipeline/document-table-semantics.spec.ts apps/worker-py/tests/document_pipeline/test_table_semantics.py apps/worker-py/tests/document_pipeline/test_table_patches.py
git commit -m "feat: add advanced table patch families"
```

### Task 7: Wire Observability And Proofreading Residual Promotion

**Files:**
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-record.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-activation-metrics-service.ts`
- Modify: `apps/api/src/modules/review-items/review-items-service.ts`
- Modify: `apps/api/src/modules/residual-learning/proofreading-residual-adapter.ts`
- Modify: `apps/api/src/modules/residual-learning/residual-learning-record.ts`
- Modify: `apps/api/src/modules/residual-learning/residual-learning-service.ts`
- Test: `apps/api/test/proofreading/proofreading-residual-learning.spec.ts`
- Test: `apps/api/test/editorial-rules/editorial-rule-governance.spec.ts`
- Test: `apps/web/test/rule-center-learning-review.spec.ts`

- [ ] **Step 1: Add failing metrics and residual tests**

Add coverage that proves:

- patch apply and skip outcomes can be measured separately from generic governed hits
- proofreading residuals preserve normalized semantic anchor context
- the system can distinguish future `B -> A` promotion evidence from generic residual noise

- [ ] **Step 2: Run the targeted tests and confirm failure**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/proofreading/proofreading-residual-learning.spec.ts test/editorial-rules/editorial-rule-governance.spec.ts
pnpm --filter @medsys/web exec node --import tsx --test test/rule-center-learning-review.spec.ts
```

Expected: FAIL because current metrics and residual records do not carry the required table-specific fields.

- [ ] **Step 3: Implement observability and residual normalization**

Implementation rules:

- extend the existing activation metrics baseline instead of replacing it
- keep residual categories explicit
- preserve semantic hit fields structurally, not only as free-form text
- do not add fake universal accuracy numbers

- [ ] **Step 4: Re-run the targeted tests and confirm they pass**

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/editorial-rules/editorial-rule-record.ts apps/api/src/modules/editorial-rules/editorial-rule-activation-metrics-service.ts apps/api/src/modules/review-items/review-items-service.ts apps/api/src/modules/residual-learning/proofreading-residual-adapter.ts apps/api/src/modules/residual-learning/residual-learning-record.ts apps/api/src/modules/residual-learning/residual-learning-service.ts apps/api/test/proofreading/proofreading-residual-learning.spec.ts apps/api/test/editorial-rules/editorial-rule-governance.spec.ts apps/web/test/rule-center-learning-review.spec.ts
git commit -m "feat: add table patch observability and residual promotion data"
```

## Final Delivery Gate

- [ ] Run the targeted API tests for all touched modules.
- [ ] Run the targeted worker `pytest` suites for document pipeline patches and semantics.
- [ ] Run the targeted web tests for template-governance authoring and rule-center review.
- [ ] Run `pnpm --filter @medical/api typecheck`.
- [ ] Run `pnpm --filter @medsys/web typecheck`.
- [ ] Verify that proofreading paths still do not auto-apply table patches.
- [ ] Verify that at least one realistic `edited_docx` fixture shows true header/footnote/unit writeback.
- [ ] Verify that unsupported patch families still degrade into explicit skip results instead of unsafe best-effort writes.

## Acceptance Summary

This plan is complete when all of the following are true:

- the shared DOCX transform hard-blocks table auto-apply outside approved editing paths
- rule-center can explicitly author and compile table rule grade, patch type, and apply scope
- editing can auto-apply the first safe table patch families into real `edited_docx`
- proofreading remains inspect-first and residual-only for table issues
- caption/title/note-zone/style families are gated on real semantic anchors instead of best-effort XML guessing
- residual and metrics layers expose truthful evidence for future `B -> A` promotion
