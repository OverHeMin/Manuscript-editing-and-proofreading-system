# Editing Module Redefinition And Slot Governance Implementation Plan

> **For future implementation work:** this plan executes the approved editing-module redesign on top of the current mainline. Do not turn `editing` back into a free-writing AI flow, and do not build a second isolated viewer stack.

**Goal:** Land the approved `editing` redefinition as a journal-format editing product, with `journal_format_target_model`, slot-governed front-matter handling, shared full-document review workspace, layered `general -> medical -> journal` rule resolution, completion-gate truth, full-fidelity table capture, table reconstruction, and object-type content governance.

**Architecture:** Extend the existing `template-governance`, `knowledge`, `editorial-rules`, `manuscript-workbench`, `editing`, `proofreading`, and `document-pipeline` surfaces into one real runtime contract:

`journal template -> target model -> structured knowledge -> layered rules -> evidence snapshot -> editing/proofreading decisions -> ledger -> completion gate -> manuscript readiness/settlement`

**Tech Stack:** TypeScript, React, existing API HTTP routes, existing manuscript workbench/detail child-page structure, existing template governance service, existing knowledge/runtime projection layer, existing editorial rule compilation/resolution flow, current document pipeline, Python DOCX worker, LibreOffice normalization path, existing workbench/API tests, real browser acceptance on the current workbench shell.

---

## Scope Guard

- Do not redefine `editing` as content rewriting, language polishing, or free-generation AI.
- Do not create an editing-only partial preview that bypasses the shared document-first viewer direction.
- Do not keep the rule layer as a narrow `通用包 / 医学专用包` binary. Runtime must resolve `general -> medical -> journal`.
- Do not remove current `front_matter` heuristics before the slot bridge is landed and verified.
- Do not ship “best effort” table handling as if it were accurate. Missing evidence must downgrade into manual review or object governance.
- Do not re-introduce the previously removed `旧版高级工作台迁移` track into this plan.

## Current Baseline To Respect

The following are already real repository behavior and must be extended rather than ignored:

- manuscript selection already carries `template_family` and `journal_template`
- journal-template governance surfaces already exist, but they are still too thin to carry a real target model
- editing already has a governed rule/manual-review/table-inspection execution backbone
- manuscript detail child pages already have preview-session and left/right detail foundations
- current normalization already uses LibreOffice in the document pipeline
- current readiness and settlement are job-lifecycle oriented, not true editing-completion truth
- knowledge bindings currently mix structured projection and legacy `template_bindings`

This plan should harden that baseline instead of inventing a parallel product.

## File Focus

### Core Web Surfaces

- `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- `apps/web/src/features/template-governance/template-governance-controller.ts`
- `apps/web/src/features/template-governance/template-governance-journal-template-form.tsx`
- `apps/web/src/features/template-governance/template-governance-template-form.tsx`
- `apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx`
- `apps/web/src/features/template-governance/template-governance-rule-wizard.tsx`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-detail.tsx`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench.css`
- `apps/web/src/features/document-preview/*`

### Core API Surfaces

- `apps/api/src/modules/templates/template-record.ts`
- `apps/api/src/modules/templates/template-repository.ts`
- `apps/api/src/modules/templates/postgres-template-repository.ts`
- `apps/api/src/modules/templates/template-governance-service.ts`
- `apps/api/src/modules/templates/template-api.ts`
- `apps/api/src/modules/knowledge/knowledge-record.ts`
- `apps/api/src/modules/knowledge/knowledge-service.ts`
- `apps/api/src/modules/knowledge/knowledge-runtime-projection.ts`
- `apps/api/src/modules/editorial-rules/editorial-rule-record.ts`
- `apps/api/src/modules/editorial-rules/editorial-rule-resolution-service.ts`
- `apps/api/src/modules/editorial-rules/rule-package-compile-service.ts`
- `apps/api/src/modules/editorial-rules/reviewed-case-rule-package-source-service.ts`
- `apps/api/src/modules/shared/module-run-support.ts`
- `apps/api/src/modules/editing/editing-service.ts`
- `apps/api/src/modules/editing/editing-api.ts`
- `apps/api/src/modules/proofreading/proofreading-service.ts`
- `apps/api/src/modules/manuscripts/manuscript-record.ts`
- `apps/api/src/modules/manuscripts/postgres-manuscript-repository.ts`
- `apps/api/src/modules/manuscripts/manuscript-api.ts`
- `apps/api/src/modules/manuscripts/manuscript-mainline-settlement.ts`
- `apps/api/src/modules/document-pipeline/*`
- `apps/api/src/http/api-http-server.ts`
- `apps/api/src/database/migrations/*`

### Python / Document Worker Surfaces

- `apps/worker-py/src/document_pipeline/normalize.py`
- `apps/worker-py/src/document_pipeline/parse_docx.py`
- `apps/worker-py/src/document_pipeline/extract_docx_structure.py`
- `apps/worker-py/src/document_pipeline/table_patches.py`
- `apps/worker-py/src/document_pipeline/materialize_docx.py`
- `apps/worker-py/src/document_pipeline/apply_editorial_rules.py`

### Focused Verification Targets

- `apps/web/test/manuscript-workbench-detail.spec.tsx`
- `apps/web/test/manuscript-workbench-page.spec.tsx`
- `apps/web/test/manuscript-workbench-summary.spec.tsx`
- `apps/web/test/manuscript-workbench-controller.spec.ts`
- `apps/web/test/template-governance-controller.spec.ts`
- `apps/web/test/template-governance-journal-template-ledger-page.spec.tsx`
- `apps/web/test/template-governance-rule-ledger-page.spec.tsx`
- `apps/web/test/template-governance-rule-wizard.spec.tsx`
- `apps/web/test/rule-center-learning-review.spec.ts`
- `apps/web/test/knowledge-library-workbench-bindings.spec.tsx`
- `apps/api/test/templates/template-governance.spec.ts`
- `apps/api/test/manuscripts/manuscript-template-selection.spec.ts`
- `apps/api/test/document-pipeline/document-normalization.spec.ts`
- `apps/api/test/document-pipeline/document-preview.spec.ts`
- `apps/api/test/document-pipeline/document-structure.spec.ts`
- `apps/api/test/document-pipeline/document-table-semantics.spec.ts`
- `apps/api/test/document-pipeline/editorial-docx-transform-service.spec.ts`
- `apps/api/test/editing/editing-rule-execution.spec.ts`
- `apps/api/test/editing/editing-bare-run.spec.ts`
- `apps/api/test/proofreading/proofreading-bare-run.spec.ts`
- `apps/api/test/editorial-rules/editorial-rule-resolution.spec.ts`
- `apps/api/test/editorial-rules/rule-package-compile-service.spec.ts`
- `apps/api/test/knowledge/knowledge-governance.spec.ts`
- `apps/api/test/http/persistent-governance-http.spec.ts`
- `apps/api/test/http/workbench-http.spec.ts`
- `apps/api/test/http/persistent-workbench-http.spec.ts`

---

## Phase 1: Foundation, Target Model, And Shared Viewer Contract

### Task 1: Land `journal_format_target_model` inside journal-template governance

**Files:**

- Modify: `apps/api/src/modules/templates/template-record.ts`
- Modify: `apps/api/src/modules/templates/template-repository.ts`
- Modify: `apps/api/src/modules/templates/postgres-template-repository.ts`
- Modify: `apps/api/src/modules/templates/template-governance-service.ts`
- Modify: `apps/api/src/modules/templates/template-api.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-controller.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-journal-template-form.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Modify: `apps/api/src/database/migrations/*`
- Test: `apps/api/test/templates/template-governance.spec.ts`
- Test: `apps/web/test/template-governance-controller.spec.ts`
- Test: `apps/web/test/template-governance-journal-template-ledger-page.spec.tsx`

- [ ] Add a persisted `journal_format_target_model` child object and version layer under `journal_template`.
- [ ] Seed a default fixed skeleton:
  - `front_matter`
  - `title`
  - `abstract`
  - `keywords`
  - `body`
  - `figures_tables`
  - `references`
- [ ] Support extensible target blocks with editable fields:
  - `block_key`
  - `label`
  - `zone`
  - `anchor`
  - `order`
  - `required`
  - `repeatable`
  - `format_policy`
  - `content_source_policy`
  - `completion_gate`
- [ ] Pre-seed front-matter blocks for:
  - 作者简介
  - 通信作者简介
  - 基金项目
  - 中图分类号
  - 文献标志码
- [ ] Allow operators to add, edit, disable, reorder, and extend target blocks without breaking published-version identity.
- [ ] Expose a real template-detail entry so operators can inspect target-model content instead of only seeing journal-template shell fields.

### Task 2: Build the shared document-first viewer contract

**Files:**

- Modify: `apps/web/src/features/document-preview/types.ts`
- Modify: `apps/web/src/features/document-preview/preview-api.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-detail.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench.css`
- Modify: `apps/api/src/modules/document-pipeline/document-preview-service.ts`
- Modify: `apps/api/src/modules/document-pipeline/onlyoffice-session-service.ts`
- Modify: `apps/api/src/modules/document-pipeline/document-pipeline-api.ts`
- Test: `apps/web/test/manuscript-workbench-detail.spec.tsx`
- Test: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Test: `apps/api/test/document-pipeline/document-preview.spec.ts`

- [ ] Define one shared location/anchor contract that can be used by `screening`, `proofreading`, and `editing`.
- [ ] Keep the approved interaction shape:
  - left full document
  - right problem/action rail
  - right-to-left jump
  - left-to-right reverse focus
- [ ] Make the left side full-document capable, not fragment-only.
- [ ] Reuse the existing preview session direction and keep `OnlyOffice / LibreOffice` compatibility explicit.
- [ ] Prevent editing from inventing a second preview or coordinate system separate from proofreading.

### Task 3: Wire the real template -> knowledge -> rules contract into UI and runtime explainability

**Files:**

- Modify: `apps/api/src/modules/knowledge/knowledge-record.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-service.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-runtime-projection.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-record.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-resolution-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/rule-package-compile-service.ts`
- Modify: `apps/api/src/modules/shared/module-run-support.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Test: `apps/api/test/editorial-rules/editorial-rule-resolution.spec.ts`
- Test: `apps/api/test/editorial-rules/rule-package-compile-service.spec.ts`
- Test: `apps/api/test/knowledge/knowledge-governance.spec.ts`
- Test: `apps/web/test/template-governance-rule-ledger-page.spec.tsx`
- Test: `apps/web/test/template-governance-rule-wizard.spec.tsx`
- Test: `apps/web/test/knowledge-library-workbench-bindings.spec.tsx`

- [ ] Keep structured binding targets as the runtime truth and retain legacy `template_bindings` only as compatibility input/output.
- [ ] Make runtime rule resolution itself authoritative, not only UI explainability:
  - fixed layer order = `general -> medical -> journal`
  - fixed conflict precedence = `journal > medical > general`
  - each resolved rule must carry activation source, overridden source, and effective scope
- [ ] Make rules bindable to:
  - rule layer
  - journal template
  - target block
  - structured knowledge evidence
- [ ] Surface which rule came from which layer and which knowledge item justified it.
- [ ] Show in the workbench summary which `journal_template`, `target_model_version`, and resolved rule stack were actually used.
- [ ] Make knowledge and rule surfaces visibly usable, not decorative buttons or hidden-only chains.

**Acceptance for Phase 1**

- journal templates can carry a real target model and version it
- the workbench uses one shared full-document viewer contract
- operators can inspect template, knowledge, and rule participation as one chain
- runtime rule precedence is materially enforced as `journal > medical > general`, not only displayed

---

## Phase 2: Slot Governance, Migration Bridge, And Completion Gate

### Task 4: Implement slot governance and metadata hunting

**Files:**

- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/editing/editing-api.ts`
- Modify: `apps/api/src/modules/document-pipeline/document-structure-service.ts`
- Modify: `apps/api/src/modules/document-pipeline/python-docx-source-block-resolver.ts`
- Modify: `apps/api/src/modules/document-pipeline/python-docx-structure-worker-adapter.ts`
- Modify: `apps/worker-py/src/document_pipeline/parse_docx.py`
- Modify: `apps/worker-py/src/document_pipeline/extract_docx_structure.py`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-detail.tsx`
- Test: `apps/api/test/editing/editing-bare-run.spec.ts`
- Test: `apps/api/test/document-pipeline/document-structure.spec.ts`
- Test: `apps/api/test/document-pipeline/python-docx-source-block-resolver.spec.ts`
- Test: `apps/web/test/manuscript-workbench-detail.spec.tsx`

- [ ] Add slot entities and slot-state handling for target-model-driven front-matter governance.
- [ ] Support slot states at least for:
  - `resolved_auto`
  - `resolved_manual`
  - `recognized_misplaced`
  - `conflicted_candidates`
  - `low_confidence_pending_review`
  - `missing`
- [ ] Hunt metadata candidates from:
  - 正文前置区
  - title area
  - 摘要前后
  - abstract and keyword neighborhood
  - header
  - footer
  - 正文末尾声明区
  - document tail declarations
  - structurally suspicious nearby paragraphs
- [ ] Add candidate merge/split and de-duplication rules so the same author/funding block is not repeatedly surfaced as separate unresolved items.
- [ ] Record why a slot was not auto-resolved instead of silently guessing.
- [ ] Persist manual slot resolutions so reruns can converge instead of re-opening the same gaps.

### Task 5: Bridge legacy `front_matter` behavior into the slot runtime without breaking current rules

**Files:**

- Modify: `apps/api/src/modules/editorial-rules/reviewed-case-rule-package-source-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/rule-package-compile-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-resolution-service.ts`
- Modify: `apps/api/src/modules/shared/module-run-support.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-runtime-projection.ts`
- Test: `apps/api/test/editorial-rules/reviewed-case-rule-package-source-service.spec.ts`
- Test: `apps/api/test/editorial-rules/rule-package-compile-service.spec.ts`
- Test: `apps/api/test/editorial-rules/editorial-rule-resolution.spec.ts`

- [ ] Keep existing `front_matter` recognition alive as a migration bridge, not as the future authority.
- [ ] Map legacy front-matter rules onto target blocks and slots where possible.
- [ ] Mark unresolved legacy-only behavior explicitly so operators can see what still needs migration.
- [ ] Avoid duplicate rule firing when the same intent exists both in legacy front-matter logic and structured target-model rules.

### Task 6: Add `editing_completion_gate_summary` into manuscript readiness and settlement truth

**Files:**

- Modify: `apps/api/src/modules/manuscripts/manuscript-record.ts`
- Modify: `apps/api/src/modules/manuscripts/postgres-manuscript-repository.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-api.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-mainline-settlement.ts`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-detail.tsx`
- Modify: `apps/api/src/database/migrations/*`
- Test: `apps/api/test/editing/editing-rule-execution.spec.ts`
- Test: `apps/api/test/http/workbench-http.spec.ts`
- Test: `apps/api/test/http/persistent-workbench-http.spec.ts`
- Test: `apps/web/test/manuscript-workbench-summary.spec.tsx`

- [ ] Add a real editing-completion object separate from raw job status.
- [ ] Persist `editing_completion_gate_summary`, manual object decisions, and completion-gate override reasons as rerun-stable state rather than page-only state.
- [ ] Gate `editing` completion on:
  - required slots resolved
  - high-risk object items resolved
  - table high-risk items resolved
  - blocking format failures absent
- [ ] Keep the existing readiness/settlement backbone, but extend it with editing gate verdicts:
  - `passed`
  - `needs_manual_resolution`
  - `blocked_by_missing_required_slots`
  - `blocked_by_high_risk_objects`
- [ ] Ensure the workbench shows why editing is blocked even when an edited asset already exists.
- [ ] Keep blocker detail explicit in readiness/settlement:
  - unresolved required slots must not be folded into generic copy
  - table failures must surface as table-specific blocker detail even if the top-level verdict remains a high-risk category
  - object failures must stay distinguishable from table failures
- [ ] Keep rerun idempotence and rollback explicit:
  - same manuscript + same target-model version + same resolved rules should converge to the same result
  - manual decisions must replay on rerun
  - operators must be able to distinguish rerunnable automation from manual-locked outcomes

**Acceptance for Phase 2**

- front-matter handling becomes slot-driven rather than guess-driven
- legacy front-matter logic is bridged instead of breaking current rules
- editing completion becomes truthful in manuscript readiness and settlement

---

## Phase 3: Full-Fidelity Table Capture And Reconstruction

### Task 7: Upgrade table capture to full-fidelity evidence

**Files:**

- Modify: `apps/api/src/modules/document-pipeline/document-structure-service.ts`
- Modify: `apps/api/src/modules/document-pipeline/python-docx-structure-worker-adapter.ts`
- Modify: `apps/api/src/modules/document-pipeline/python-docx-source-block-resolver.ts`
- Modify: `apps/worker-py/src/document_pipeline/parse_docx.py`
- Modify: `apps/worker-py/src/document_pipeline/extract_docx_structure.py`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Test: `apps/api/test/document-pipeline/document-table-semantics.spec.ts`
- Test: `apps/api/test/document-pipeline/document-structure.spec.ts`
- Test: `apps/api/test/editing/deterministic-format-rule-executor.spec.ts`
- Test: `apps/api/test/proofreading/proofreading-bare-run.spec.ts`

- [ ] Expand table evidence beyond current semantic snapshots so runtime can retain:
  - caption label and title
  - note zone and footnote markers
  - merged-cell relations
  - row/column structure
  - borders and three-line-table posture
  - font family, font size, bold, italic, alignment, spacing, indentation where available
  - inline symbols and special-format fragments inside cells
- [ ] Make the extracted evidence precise enough to drive editing, not just proofreading inspection.
- [ ] Keep the output evidence explicit about which style facts are authoritative and which are unavailable.
- [ ] Reuse the same evidence contract for journal formatting, proofreading inspection, and later knowledge/rule authoring references.

### Task 8: Move from patch-only tables to full-table reconstruction capability

**Files:**

- Modify: `apps/api/src/modules/document-pipeline/table-docx-patch-plan.ts`
- Modify: `apps/api/src/modules/document-pipeline/table-docx-patch-planner.ts`
- Modify: `apps/api/src/modules/document-pipeline/editorial-docx-transform-service.ts`
- Modify: `apps/worker-py/src/document_pipeline/table_patches.py`
- Modify: `apps/worker-py/src/document_pipeline/materialize_docx.py`
- Modify: `apps/worker-py/src/document_pipeline/apply_editorial_rules.py`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Test: `apps/api/test/document-pipeline/table-docx-patch-planner.spec.ts`
- Test: `apps/api/test/document-pipeline/editorial-docx-transform-service.spec.ts`
- Test: `apps/api/test/editing/editing-rule-execution.spec.ts`

- [ ] Introduce a rebuild-capable path when a table needs structural or style re-layout rather than cell patching.
- [ ] Keep a clear split between:
  - safe patch
  - controlled rebuild
  - manual downgrade
- [ ] Make three-line-table generation, caption/note placement, and intra-cell style normalization part of the reconstruction path.
- [ ] Persist reconstruction decisions into the editing ledger so wrong automation can be audited and corrected on rerun.
- [ ] Never silently “approximate” a table when the evidence is insufficient for the requested journal format.

**Acceptance for Phase 3**

- table evidence is rich enough to support journal-format editing
- reconstruction can handle full-table layout changes rather than only patching text
- uncertainty degrades into manual review instead of false precision

---

## Phase 4: Object Governance, Shared Human Workspace, And Acceptance

### Task 9: Govern image-substituted symbols, complex embedded objects, and non-text fragments

**Files:**

- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/src/modules/document-pipeline/document-structure-service.ts`
- Modify: `apps/api/src/modules/document-pipeline/python-docx-structure-worker-adapter.ts`
- Modify: `apps/worker-py/src/document_pipeline/parse_docx.py`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-detail.tsx`
- Test: `apps/api/test/editing/editing-bare-run.spec.ts`
- Test: `apps/api/test/proofreading/proofreading-bare-run.spec.ts`
- Test: `apps/web/test/manuscript-workbench-detail.spec.tsx`

- [ ] Add an object-evidence channel for image-substituted symbols, equation fragments, and other embedded content that should not be blindly rewritten.
- [ ] Mark such objects as high-risk by default unless evidence and replacement policy are both explicit.
- [ ] Allow operators to see:
  - original object
  - extracted evidence
  - intended target
  - downgrade reason
- [ ] Feed unresolved object items into the same completion-gate path as unresolved required slots.

### Task 10: Finalize the shared human-review workspace for `screening / proofreading / editing`

**Files:**

- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-detail.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench.css`
- Modify: `apps/api/src/modules/manuscripts/manuscript-api.ts`
- Modify: `apps/api/src/modules/editing/editing-api.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-api.ts`
- Test: `apps/web/test/manuscript-workbench-detail.spec.tsx`
- Test: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Test: `apps/web/test/manuscript-workbench-summary.spec.tsx`
- Test: `apps/web/test/manuscript-workbench-controller.spec.ts`

- [ ] Keep the approved review posture: human sees the whole document, but navigates by problem anchors.
- [ ] Distinguish right-rail payload by module:
  - `screening`: risks, recommendation, evidence summary
  - `proofreading`: issues, suggested edits, evidence and rule hits
  - `editing`: pending changes, slot gaps, object risks, completion gate, ledger
- [ ] Reuse the same anchor/highlight mechanism for proofreading and editing so定位、反向定位、命中标记是同一套。
- [ ] Ensure the shared workspace can navigate across front matter, body, tables, declarations, and references without switching to a different page model.
- [ ] For tables and object-type items, show on the right rail:
  - original evidence
  - structure understanding
  - planned action
  - downgrade reason

### Task 11: Run focused verification and real-browser acceptance against the approved scope

**Files:**

- Modify: `apps/api/test/*`
- Modify: `apps/web/test/*`
- Modify: `apps/api/test/http/*`
- Modify: `playwright/*`
- Modify: `scripts/run-manuscript-workbench-gate.mjs`

- [ ] Add coverage for:
  - target-model persistence and versioning
  - structured knowledge/rule binding visibility
  - slot lifecycle and manual persistence
  - completion gate verdict mapping
  - full-document right-to-left navigation
  - table full-fidelity capture
  - table reconstruction downgrade rules
  - object high-risk governance
- [ ] Run existing focused API/web suites before browser acceptance.
- [ ] Add or extend real-browser smoke so the accepted workbench posture is verified on the actual page shell, not only by component tests.
- [ ] Verify that LibreOffice-backed normalization and shared preview still work in the same operator flow.

**Acceptance for Phase 4**

- high-risk non-text content is governed instead of guessed
- all three core modules share one full-document review posture
- the shipped behavior is verified in both code-level tests and real browser acceptance

---

## Delivery Order

Implementation should proceed in this order and not skip ahead:

1. `journal_format_target_model` persistence and template-detail entry
2. shared viewer contract and anchor model
3. structured template/knowledge/rule explainability chain
4. slot governance and metadata hunter
5. legacy `front_matter` bridge
6. editing completion gate integration
7. table full-fidelity capture
8. table reconstruction
9. object-type content governance
10. shared human-review workspace hardening
11. focused verification and browser acceptance

## Follow-On, Not In This Plan

- old advanced workbench migration
- broad rule-center visual redesign unrelated to target-model/rule explainability
- free-form authoring assistant behavior that generates missing front-matter content
- “lossless for every possible Word feature” claims without repository-backed evidence
