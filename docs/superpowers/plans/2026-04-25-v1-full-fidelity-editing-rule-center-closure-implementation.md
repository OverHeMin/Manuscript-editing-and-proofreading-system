# V1 Full-Fidelity Editing Rule Center Closure Implementation Plan

## Scope Guard

This plan implements the V1 strong-commitment design from `docs/superpowers/specs/2026-04-25-v1-full-fidelity-editing-rule-center-closure-design.md`.

Do not implement a partial or fake version of the product promise:

- do not accept summary-only table intake as authoritative evidence
- do not claim full-fidelity table support without mandatory fact coverage
- do not ship table rebuild without writeback validation
- do not let rule prose imply runtime behavior without structured action fields
- do not publish grade-A automatic rules without evidence and gold sample gates
- do not mark editing complete when required slots, table rebuilds, object risks, or validation failures remain unresolved
- do not use LibreOffice as the canonical table truth or writeback semantics engine
- do not remove existing safe `front_matter`, proofreading, or editing behavior before compatibility bridges are verified

The V1 commitment is strong but bounded. It applies only to supported `.docx`, Word clipboard, WPS clipboard, and DOCX sample paths for mainstream medical manuscript tables. Unsupported constructs must be detected and routed to manual review or blocked from automatic completion.

## Current Baseline To Respect

The existing repository already has useful foundations that must be extended rather than bypassed:

- journal template governance surfaces exist but need versioned target model depth
- rule center ledger and wizard flows exist but need executable action, automation grade, evidence, and gold sample gates
- knowledge records and runtime projections exist but need structured evidence packages
- manuscript selection already carries template and journal context
- editing already has governed rule execution, manual review, and table inspection foundations
- document pipeline already parses DOCX structure and table semantics, but not the V1 mandatory rich-style matrix
- Python worker already participates in DOCX materialization and editorial rule writeback
- manuscript workbench already has preview and left/right detail foundations
- readiness and settlement are lifecycle-oriented and need editing completion truth

## File Focus

### Core Web Surfaces

- `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- `apps/web/src/features/template-governance/template-governance-controller.ts`
- `apps/web/src/features/template-governance/template-governance-journal-template-form.tsx`
- `apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx`
- `apps/web/src/features/template-governance/template-governance-rule-wizard.tsx`
- `apps/web/src/features/template-governance/*`
- `apps/web/src/features/knowledge/*`
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
- `apps/api/src/modules/document-pipeline/*`
- `apps/api/src/modules/editing/editing-service.ts`
- `apps/api/src/modules/editing/editing-api.ts`
- `apps/api/src/modules/proofreading/proofreading-service.ts`
- `apps/api/src/modules/proofreading/proofreading-api.ts`
- `apps/api/src/modules/manuscripts/manuscript-record.ts`
- `apps/api/src/modules/manuscripts/postgres-manuscript-repository.ts`
- `apps/api/src/modules/manuscripts/manuscript-api.ts`
- `apps/api/src/modules/manuscripts/manuscript-mainline-settlement.ts`
- `apps/api/src/modules/shared/module-run-support.ts`
- `apps/api/src/http/api-http-server.ts`
- `apps/api/src/database/migrations/*`

### Python / Document Worker Surfaces

- `apps/worker-py/src/document_pipeline/parse_docx.py`
- `apps/worker-py/src/document_pipeline/extract_docx_structure.py`
- `apps/worker-py/src/document_pipeline/table_semantics.py`
- `apps/worker-py/src/document_pipeline/table_patches.py`
- `apps/worker-py/src/document_pipeline/materialize_docx.py`
- `apps/worker-py/src/document_pipeline/apply_editorial_rules.py`

### Focused Verification Targets

- `apps/api/test/templates/*`
- `apps/api/test/knowledge/*`
- `apps/api/test/editorial-rules/*`
- `apps/api/test/document-pipeline/document-structure.spec.ts`
- `apps/api/test/document-pipeline/document-table-semantics.spec.ts`
- `apps/api/test/document-pipeline/table-docx-patch-planner.spec.ts`
- `apps/api/test/document-pipeline/editorial-docx-transform-service.spec.ts`
- `apps/api/test/editing/*`
- `apps/api/test/proofreading/*`
- `apps/api/test/manuscripts/*`
- `apps/web/test/template-governance*.spec.tsx`
- `apps/web/test/manuscript-workbench*.spec.tsx`
- `playwright/*`

## Phase 1: Target Model And Evidence Package Foundation

### Task 1: Add versioned journal format and table target models

**Files:**

- Modify: `apps/api/src/modules/templates/template-record.ts`
- Modify: `apps/api/src/modules/templates/template-repository.ts`
- Modify: `apps/api/src/modules/templates/postgres-template-repository.ts`
- Modify: `apps/api/src/modules/templates/template-governance-service.ts`
- Modify: `apps/api/src/modules/templates/template-api.ts`
- Modify: `apps/api/src/database/migrations/*`
- Modify: `apps/web/src/features/template-governance/*`
- Test: `apps/api/test/templates/*`
- Test: `apps/web/test/template-governance*.spec.tsx`

- [ ] Introduce `journal_format_target_model` as a versioned child object under `journal_template`.
- [ ] Add target blocks for front matter, title, abstract, keywords, body, references, declarations, tables, figures, and object-symbol policy.
- [ ] Add `journal_target_table_model` under the target model with policies for caption, notes, border system, three-line table posture, header depth, stub columns, width, typography, rich text, units, and special symbols.
- [ ] Preserve the current thin `journal_template` role as selection scope; do not turn it into a giant free-text specification.
- [ ] Record `target_model_version_id` and `journal_target_table_model_version_id` for runtime consumption.
- [ ] Add template-detail controls: open target model, edit table target model, bind evidence, bind rules, publish version.

**Acceptance for Task 1**

- a journal template can own multiple target model versions
- a published target model exposes target blocks and table policies through API
- UI shows saved model state after refresh
- editing runtime can resolve the active published model by journal selection

### Task 2: Add structured evidence packages for knowledge and rules

**Files:**

- Modify: `apps/api/src/modules/knowledge/knowledge-record.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-service.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-runtime-projection.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-record.ts`
- Modify: `apps/api/src/modules/editorial-rules/rule-package-compile-service.ts`
- Modify: `apps/api/src/database/migrations/*`
- Modify: `apps/web/src/features/knowledge/*`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard.tsx`
- Test: `apps/api/test/knowledge/*`
- Test: `apps/api/test/editorial-rules/*`

- [ ] Add `evidence_package` records with authority level, source kind, linked knowledge, linked rules, linked target blocks, review status, and audit metadata.
- [ ] Support evidence kinds: official guideline text, sample screenshots, Word/WPS sample tables, DOCX sample tables, correct examples, incorrect examples, object-symbol samples, and operator annotations.
- [ ] Add evidence states: `raw`, `captured`, `non_authoritative`, `authoritative`, `linked_to_rule`, `retired`.
- [ ] Preserve legacy knowledge text and `template_bindings` as compatibility inputs, but prefer structured evidence packages in runtime projection.
- [ ] Add UI controls for creating evidence packages, uploading DOCX samples, pasting Word/WPS tables, reviewing extracted facts, binding target blocks, and generating rule drafts.

**Acceptance for Task 2**

- knowledge can persist structured evidence packages
- evidence authority is visible and affects rule promotion eligibility
- evidence package bindings remain inspectable after save
- runtime projection preserves binding kind and target block identity

## Phase 2: Authoring-Side Full-Fidelity Table Intake

### Task 3: Implement authoring table evidence package model and capture API

**Files:**

- Modify: `apps/api/src/modules/knowledge/knowledge-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-record.ts`
- Modify: `apps/api/src/modules/templates/template-governance-service.ts`
- Modify: `apps/api/src/modules/document-pipeline/*`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/database/migrations/*`
- Test: `apps/api/test/knowledge/*`
- Test: `apps/api/test/editorial-rules/*`
- Test: `apps/api/test/document-pipeline/document-table-semantics.spec.ts`

- [ ] Add `table_evidence_package` with `source_kind`, `source_environment`, `authoritative_status`, `capture_failure_codes`, raw payload refs, normalized table object id, full-fidelity snapshot id, linked knowledge ids, linked rule ids, and linked target model block ids.
- [ ] Add API endpoints for Word clipboard capture, WPS clipboard capture, DOCX sample upload, evidence review, evidence binding, and authoritative publication.
- [ ] Store raw payload references for audit without treating raw clipboard content as runtime truth.
- [ ] Emit exact capture failure codes when mandatory facts are missing.
- [ ] Block authoritative publication when capture is summary-only or mandatory facts are unavailable.

**Acceptance for Task 3**

- a pasted or uploaded table creates a persisted `table_evidence_package`
- evidence cannot become authoritative without the V1 mandatory fact groups
- UI/API surfaces exact failure codes
- rule and knowledge records can link to the same table evidence package

### Task 4: Build Word/WPS/DOCX authoring full-fidelity extraction

**Files:**

- Modify: `apps/api/src/modules/document-pipeline/document-structure-service.ts`
- Modify: `apps/api/src/modules/document-pipeline/python-docx-structure-worker-adapter.ts`
- Modify: `apps/api/src/modules/document-pipeline/python-docx-source-block-resolver.ts`
- Modify: `apps/worker-py/src/document_pipeline/parse_docx.py`
- Modify: `apps/worker-py/src/document_pipeline/extract_docx_structure.py`
- Modify: `apps/worker-py/src/document_pipeline/table_semantics.py`
- Modify: `apps/web/src/features/knowledge/*`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard.tsx`
- Test: `apps/api/test/document-pipeline/document-structure.spec.ts`
- Test: `apps/api/test/document-pipeline/document-table-semantics.spec.ts`
- Test: `apps/web/test/template-governance*.spec.tsx`

- [ ] Produce `table_full_fidelity_snapshot` for authoring evidence intake.
- [ ] Add a `supported_environment_matrix` that records V1 support for Word version, WPS version, browser, OS, clipboard MIME types, clipboard HTML availability, OOXML-fragment availability, and fallback posture.
- [ ] Capture identity, structure, border system, layout, paragraph style, typography, rich content, object content, and per-field authority markers.
- [ ] Support mainstream medical table shapes: three-line tables, multi-level headers, stub columns, merged cells, captions, notes, units, superscripts, subscripts, bold, italic, special symbols, and per-cell local rich text.
- [ ] Detect unsupported constructs: nested tables, tables in text boxes, rotated text, complex equation objects, arbitrary floating objects, image-table OCR candidates, and unsupported clipboard payloads.
- [ ] Mark unsupported facts explicitly and route them to manual review rather than accepting them as authoritative.

**Acceptance for Task 4**

- supported Word/WPS pasted tables produce full evidence packages
- supported environment status is visible and persisted with the evidence package
- uploaded DOCX sample tables produce the same mandatory fact vocabulary
- mandatory fact groups are inspectable in UI before publication
- object-symbol evidence inside tables is surfaced
- summary-only captures cannot be promoted

## Phase 3: Rule Center Automation Governance

### Task 5: Add structured rule domains, actions, and automation grades

**Files:**

- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-record.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-resolution-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/rule-package-compile-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/reviewed-case-rule-package-source-service.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard.tsx`
- Test: `apps/api/test/editorial-rules/*`
- Test: `apps/web/test/template-governance*.spec.tsx`

- [ ] Add rule domains for page structure, headings, abstract, keywords, front matter, body paragraphs, references, declarations, tables, image-symbols, object-symbols, and journal overrides.
- [ ] Add action types: `inspect_only`, `suggest_change`, `auto_apply`, `full_table_rebuild`, `manual_review_required`, and `block_completion`.
- [ ] Add automation grades: `A`, `B`, `C`, and `D`.
- [ ] Default existing rules to inspect-only grade `C` until reviewed and promoted.
- [ ] Require structured action and grade fields before a rule can publish into runtime execution.
- [ ] Preserve precedence `journal > medical > general` and expose override explanations.

**Acceptance for Task 5**

- rule behavior no longer depends on prose-only intent
- existing rules cannot accidentally auto-apply
- conflict explanations show winning and overridden rules
- runtime resolution returns domain, action, grade, scope layer, and explanation

### Task 6: Add table reconstruction rule schema and gold sample gate

**Files:**

- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-record.ts`
- Modify: `apps/api/src/modules/editorial-rules/rule-package-compile-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/reviewed-case-rule-package-source-service.ts`
- Modify: `apps/api/src/modules/document-pipeline/*`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx`
- Test: `apps/api/test/editorial-rules/*`
- Test: `apps/api/test/document-pipeline/*`
- Test: `apps/web/test/template-governance*.spec.tsx`

- [ ] Add table rule schema fields for target zone, label, title, notes, header depth, stub column, merged-cell policy, border system, layout, typography, rich text, symbols, object handling, full-rebuild eligibility, and downgrade reasons.
- [ ] Require grade-A automatic rules to bind evidence packages, target model blocks, module postures, scope layer, and regression specimens.
- [ ] Add gold sample gate with input DOCX or table evidence package, selected target model, expected output or validation snapshot, negative downgrade cases, validation diff, and reviewer approval.
- [ ] Block grade-A publication if gold samples fail.
- [ ] Allow grade-B rules to prepare plans but require manual confirmation.

**Acceptance for Task 6**

- a table rebuild rule cannot publish as grade A without evidence and gold sample success
- the rule center shows why a rule is auto-applicable or downgraded
- negative specimens prove unsupported cases downgrade instead of corrupting output

## Phase 4: Runtime Full-Fidelity Table Truth And Reconstruction

### Task 7: Upgrade runtime DOCX table snapshots to V1 parity

**Files:**

- Modify: `apps/api/src/modules/document-pipeline/document-structure-service.ts`
- Modify: `apps/api/src/modules/document-pipeline/python-docx-structure-worker-adapter.ts`
- Modify: `apps/api/src/modules/document-pipeline/python-docx-source-block-resolver.ts`
- Modify: `apps/worker-py/src/document_pipeline/parse_docx.py`
- Modify: `apps/worker-py/src/document_pipeline/extract_docx_structure.py`
- Modify: `apps/worker-py/src/document_pipeline/table_semantics.py`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Test: `apps/api/test/document-pipeline/document-structure.spec.ts`
- Test: `apps/api/test/document-pipeline/document-table-semantics.spec.ts`
- Test: `apps/api/test/editing/*`
- Test: `apps/api/test/proofreading/*`

- [ ] Make runtime DOCX table parsing produce the same full-fidelity vocabulary as authoring evidence.
- [ ] Preserve field-level authority markers.
- [ ] Surface unsupported objects and constructs as explicit evidence.
- [ ] Feed the same table truth model to proofreading inspection and editing execution.
- [ ] Prevent AI or prose rules from filling missing table facts.

**Acceptance for Task 7**

- runtime DOCX snapshots and authoring evidence packages share the same mandatory vocabulary
- proofreading and editing consume the same table anchors
- missing facts are explicit and can trigger downgrade

### Task 8: Build full-table reconstruction planner

**Files:**

- Modify: `apps/api/src/modules/document-pipeline/table-docx-patch-plan.ts`
- Modify: `apps/api/src/modules/document-pipeline/table-docx-patch-planner.ts`
- Modify: `apps/api/src/modules/document-pipeline/editorial-docx-transform-service.ts`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Test: `apps/api/test/document-pipeline/table-docx-patch-planner.spec.ts`
- Test: `apps/api/test/document-pipeline/editorial-docx-transform-service.spec.ts`
- Test: `apps/api/test/editing/*`

- [ ] Add `normalized_table_object`.
- [ ] Add `table_reconstruction_plan`.
- [ ] Map source cells to target cells without changing content meaning.
- [ ] Plan caption, note, border, layout, typography, rich-fragment, and object-handling operations.
- [ ] Split outcomes into safe patch, full rebuild, manual review, and blocked.
- [ ] Require full rebuild for border systems, three-line posture, caption/note placement, multi-level headers, stub columns, merged topology, table width/layout, rich-style normalization, and object-symbol handling.

**Acceptance for Task 8**

- planner can create a deterministic reconstruction plan for supported medical tables
- planner records downgrade reasons for incomplete evidence or unsupported constructs
- planner proves content-preservation mapping before writeback is attempted

### Task 9: Implement DOCX writeback, validation snapshot, rollback, and idempotence

**Files:**

- Modify: `apps/api/src/modules/document-pipeline/editorial-docx-transform-service.ts`
- Modify: `apps/worker-py/src/document_pipeline/table_patches.py`
- Modify: `apps/worker-py/src/document_pipeline/materialize_docx.py`
- Modify: `apps/worker-py/src/document_pipeline/apply_editorial_rules.py`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Test: `apps/api/test/document-pipeline/editorial-docx-transform-service.spec.ts`
- Test: `apps/api/test/document-pipeline/table-docx-patch-planner.spec.ts`
- Test: `apps/api/test/editing/*`

- [ ] Write reconstructed tables into DOCX artifacts.
- [ ] Re-parse the generated DOCX and produce `validation_snapshot`.
- [ ] Compare original content versus written content.
- [ ] Compare written output versus target table model.
- [ ] Compare written rich text versus intended rich-fragment plan.
- [ ] Compare object handling results versus object policy.
- [ ] Block editing completion on validation failure.
- [ ] Persist rollback points and verify rerun idempotence for the same versions.

**Acceptance for Task 9**

- supported specimen tables can be rebuilt into selected journal target models
- validation catches content drift, topology drift, style failure, and object handling failure
- failed validation blocks completion and creates manual review items
- rerun is stable for the same manuscript, target model, rules, and manual resolutions

## Phase 5: Editing Runtime Closure And Completion Gate

### Task 10: Wire target model, evidence, rules, and reconstruction into editing runtime

**Files:**

- Modify: `apps/api/src/modules/shared/module-run-support.ts`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/editing/editing-api.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-resolution-service.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-runtime-projection.ts`
- Test: `apps/api/test/editing/*`
- Test: `apps/api/test/proofreading/*`
- Test: `apps/api/test/http/*`

- [ ] Implement runtime chain: journal selection, published target model, evidence packages, layered rule resolution, document snapshots, decision engine, reconstruction engine, writeback, validation, ledger, completion gate.
- [ ] Add editing decision classes: `auto_apply`, `full_rebuild`, `inspect_only`, `manual_review_required`, and `blocked`.
- [ ] Explain which template, target model, evidence packages, and rules were used.
- [ ] Ensure proofreading consumes table truth and rule hits without auto-rewriting final artifacts.

**Acceptance for Task 10**

- editing result explains runtime binding and rule activation
- proofreading and editing share evidence vocabulary but enforce different execution posture
- no module can accidentally invoke table writeback outside approved editing context

### Task 11: Extend editing ledger and completion gate

**Files:**

- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/editing/editing-api.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-record.ts`
- Modify: `apps/api/src/modules/manuscripts/postgres-manuscript-repository.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-mainline-settlement.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-api.ts`
- Modify: `apps/api/src/database/migrations/*`
- Test: `apps/api/test/editing/*`
- Test: `apps/api/test/manuscripts/*`

- [ ] Persist every automatic action, original evidence, target rule, target model version, writeback result, validation result, rollback point, and downgrade reason.
- [ ] Add table rebuild failures, high-risk objects, unresolved slots, and validation failures to `editing_completion_gate_summary`.
- [ ] Block readiness and settlement from treating editing as complete when gate is not passed.
- [ ] Persist manual resolutions and replay them on rerun when still applicable.

**Acceptance for Task 11**

- job lifecycle completed is not treated as editing completed unless the gate passes
- ledger can explain every table rebuild and downgrade
- unresolved slots, failed rebuilds, high-risk objects, and validation failures block completion

## Phase 6: Human Review Workspace And UI Closure

### Task 12: Implement real button/page/state closure

**Files:**

- Modify: `apps/web/src/features/template-governance/*`
- Modify: `apps/web/src/features/knowledge/*`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-detail.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench.css`
- Modify: `apps/web/src/features/document-preview/*`
- Modify: `apps/api/src/http/api-http-server.ts`
- Test: `apps/web/test/template-governance*.spec.tsx`
- Test: `apps/web/test/manuscript-workbench*.spec.tsx`

- [ ] Rule center controls must create formatting rules, table reconstruction rules, capture evidence, bind knowledge, bind target blocks, run gold sample gates, and publish rules.
- [ ] Knowledge controls must create evidence packages, upload DOCX samples, paste Word/WPS tables, review extracted facts, bind target models, and generate rule drafts.
- [ ] Template controls must open target model, edit table target model, bind evidence, bind rules, and publish versions.
- [ ] Manuscript editing controls must run automatic journal formatting, view resolved rules, view reconstruction plans, view validation diffs, open manual review, accept manual resolution, and rerun editing.
- [ ] Every visible control must call real API and persist inspectable state.

**Acceptance for Task 12**

- no fake button remains in the approved V1 path
- page refresh preserves the saved state for target models, evidence packages, rules, runs, and manual resolutions
- blocked states explain what must be fixed before publishing or completion

### Task 13: Finalize shared human review workspace

**Files:**

- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-detail.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench.css`
- Modify: `apps/api/src/modules/editing/editing-api.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-api.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-api.ts`
- Test: `apps/web/test/manuscript-workbench-detail.spec.tsx`
- Test: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Test: `apps/web/test/manuscript-workbench-summary.spec.tsx`

- [ ] Keep full document preview on the left.
- [ ] Show module-specific cards on the right.
- [ ] For table items, show original evidence, target model comparison, reconstruction plan, validation diff, and downgrade reason.
- [ ] For object-symbol items, show original object, nearby text, candidate symbol, confidence, and allowed action.
- [ ] Support right-to-left and left-to-right positioning.
- [ ] Persist accept, reject, override, and defer manual decisions.

**Acceptance for Task 13**

- operators can resolve table and object risks without leaving the full-document context
- manual decisions replay on rerun when still valid
- screening, proofreading, and editing share the same document-first review posture with module-specific right rail behavior

## Phase 7: Verification And Acceptance

### Task 14: Add specimen fixtures and focused automated coverage

**Files:**

- Modify: `apps/api/test/*`
- Modify: `apps/web/test/*`
- Modify: `playwright/*`
- Modify: `scripts/run-manuscript-workbench-gate.mjs`
- Add: representative DOCX fixtures as appropriate under the existing test fixture convention

- [ ] Add supported table fixtures: three-line table, multi-level header table, stub-column table, merged-cell table, caption/note table, rich-text cell table, and object-symbol table.
- [ ] Add downgrade fixtures: nested table, text-box table, rotated text, complex equation object, arbitrary floating object, unsupported clipboard payload, image-table OCR candidate.
- [ ] Add clipboard failure fixtures: summary-only payload, flattened text-only payload, image-only payload, HTML structure incomplete payload, and OOXML unavailable payload.
- [ ] Assert full-fidelity authoring intake.
- [ ] Assert runtime DOCX snapshot parity.
- [ ] Assert table reconstruction and validation.
- [ ] Assert rule center gold sample gates.
- [ ] Assert completion gate blocking.
- [ ] Assert browser-visible button/page/state closure.

**Acceptance for Task 14**

- all mandatory fact groups have test coverage
- supported tables pass reconstruction validation
- unsupported constructs downgrade or block
- UI tests prove the visible workflow is real

### Task 15: Run focused suites and real-browser acceptance

**Files:**

- Modify: `scripts/run-manuscript-workbench-gate.mjs`
- Modify: `playwright/*`

- [ ] Run focused API tests for templates, knowledge, editorial rules, document pipeline, editing, proofreading, and manuscripts.
- [ ] Run focused web tests for template governance, knowledge evidence, and manuscript workbench.
- [ ] Run real-browser acceptance for the full workflow:
  1. create or open journal template
  2. publish target model and table target model
  3. create knowledge evidence package from Word/WPS or DOCX table
  4. verify failed or incomplete table intake cannot publish as authoritative evidence
  5. create table reconstruction rule
  6. pass gold sample gate
  7. run automatic editing on manuscript
  8. view reconstruction plan and validation diff
  9. verify completion gate pass or manual-review block

**Acceptance for Task 15**

- V1 workflow is verified at API, component, and browser levels
- acceptance evidence distinguishes implemented behavior from follow-on scope
- failed checks are fixed or explicitly documented as blockers before claiming completion

## Delivery Order

Implementation must proceed in this order:

1. versioned target model and table target model
2. structured evidence package foundation
3. authoring-side table evidence package API
4. Word/WPS/DOCX full-fidelity authoring intake
5. rule domains, actions, grades, and conflict explanations
6. table reconstruction rule schema and gold sample gates
7. runtime DOCX full-fidelity table snapshot parity
8. full-table reconstruction planner
9. DOCX writeback, validation, rollback, and idempotence
10. editing runtime chain and module execution posture
11. ledger and completion gate integration
12. real button/page/state closure
13. shared manual review workspace
14. specimen fixtures and focused automated tests
15. real-browser acceptance

Do not start with writeback alone. Without target models, evidence packages, rule grades, and validation gates, writeback would create false completion.

## Follow-On, Not In This Plan

- full automatic support for nested tables
- full automatic support for tables inside text boxes
- full automatic support for rotated text
- full automatic support for complex equation objects
- image-table OCR reconstruction
- guaranteed support for every possible Word/WPS/office table construct
- broad visual redesign unrelated to target model, evidence, rule execution, or manual review closure
- free-form AI generation of missing manuscript content

## Final Acceptance Statement

This plan is complete only if the shipped system can prove the V1 promise:

- supported authoring table intake captures full rich-style evidence, not summaries
- supported runtime DOCX tables produce the same mandatory fact vocabulary
- grade-A rules are evidence-bound and gold-sample-gated
- supported tables can be reconstructed into the selected journal target model
- generated DOCX artifacts are validated by re-parsing
- failed validation blocks editing completion
- operators can inspect and resolve downgrade cases in a shared full-document workspace

If any of these are missing, the implementation must not be described as full-fidelity V1 editing automation.
