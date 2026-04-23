# 2026-04-23 Table DOCX Editing Design

**Date**

2026-04-23

**Status**

Written after design approval in conversation. Awaiting written review before implementation.

**Goal**

Turn table-rule execution in the editing pipeline into a durable product capability that produces real, usable `edited_docx` artifacts, while keeping proofreading residual learning truthful and scoped to proofreading only.

This package is not a demo package. It exists so that:

- rule-center table rules can create real effects in editing output
- DOCX landing remains stable even when some table patches cannot safely apply
- proofreading keeps a governed residual loop without silently auto-rewriting final table content

## 1. Product Principle

### 1.1 No demo-only table automation

This design must not add fake customer-facing table automation that will later be removed.

Every added capability must answer yes to this question:

`Will editing operators still need this behavior after the customer presentation is over?`

If the answer is no, the capability should not be built.

### 1.2 Real effect matters more than broad but weak claims

For table rules, the product should prefer:

- a narrower set of safe changes that really land in DOCX
- deterministic evidence about what was changed or skipped
- clear residual flow for what still needs human confirmation

over:

- broad claims that all table issues are solved
- unstable whole-table rewriting
- fake universal accuracy numbers

### 1.3 Editing and proofreading keep different responsibilities

This design locks in the following product boundary:

- `editing` may auto-apply safe table format changes into `edited_docx`
- `proofreading` may detect, explain, and learn from table issues, but does not auto-rewrite table structure in this package
- residual analysis remains `proofreading`-only

## 2. Why This Design Exists

The current codebase already has several important foundations:

- `document-structure-service.ts` can emit table semantic snapshots
- `editorial-rule-table-hit-service.ts` can match table rules against semantic targets
- `editorial-docx-transform-service.ts` can already materialize and write `edited_docx`
- `proofreading-residual-adapter.ts` and the residual-learning pipeline already support governed proofreading residual flow

What is still missing is the durable middle layer between rule hit and usable DOCX result:

- table rules can hit semantically, but they do not yet safely auto-apply into table content
- the current Python worker treats table rules as inspect-only or manual-review-only
- the system does not yet have a deterministic table patch contract with explicit skip reasons
- operators therefore cannot yet trust that a safe table rule will create a stable `edited_docx` effect

This design fills that gap without overreaching into unsafe table reconstruction.

## 3. Locked Product Decisions

### 3.1 Screening is out of scope

This package does not change screening behavior.

The current work is only about:

- editing table auto-application
- DOCX writeback stability
- proofreading residual loop alignment

### 3.2 Table auto-apply is editing-only

Safe table rewrite is allowed only for editing artifacts, especially:

- `edited_docx`

This package does not auto-apply table rewrite into:

- `proofreading_draft_report`
- `final_proof_annotated_docx`
- `human_final_docx`

Proofreading can still surface the same rule hit evidence and residuals, but it remains inspect-first.

### 3.3 DOCX is the real artifact boundary

The artifact that matters for this package is a real `.docx` file that can be downloaded and used.

The design therefore optimizes for:

- stable `.docx` writeback
- local patch safety
- readable operator-facing change evidence

It does not optimize for perfect visual reconstruction through whole-document regeneration.

### 3.4 Semantic anchors plus local patches is the chosen approach

The approved primary approach is:

- resolve rules against semantic table anchors
- generate local table patch instructions
- apply those patches in a deterministic order

The following approaches are explicitly rejected as the main path:

- full table rebuild
- whole-document layout regeneration
- LibreOffice or UNO as the main table rewrite engine

### 3.5 LibreOffice remains compatibility-only

LibreOffice continues to mean:

- `.doc` to `.docx` normalization support when needed

It does not become:

- the main table patch engine
- the rule execution engine
- the core selling point of table automation

### 3.6 Safe scope is format-level, not meaning-level

This package may auto-apply only safe format-level table changes.

It must never auto-change:

- data values
- statistical conclusions
- medical meaning
- interpretation of study results

### 3.7 Shared transform must enforce module-scoped table auto-apply

`editing` and `proofreading` currently share the same DOCX transform service, so this package must add an explicit runtime guard instead of relying on convention.

The shared transform contract must carry enough information to answer:

- which module invoked the transform
- which asset type is being produced
- whether table auto-apply is disabled, inspect-only, or editing-safe-apply

The recommended runtime field is:

- `tableAutoApplyMode: "disabled" | "inspect_only" | "editing_safe_apply"`

The locked behavior is:

- `editing -> edited_docx` may use `editing_safe_apply`
- `proofreading -> proofreading_draft_report` uses `disabled`
- `proofreading -> final_proof_annotated_docx` uses `inspect_only` or `disabled`
- `proofreading -> human_final_docx` uses `disabled`

If table patch instructions are present while `tableAutoApplyMode !== "editing_safe_apply"`, the transform must fail closed by skipping table writeback and recording that those patches were not eligible on this path.

### 3.8 Rule authoring must represent auto-apply intent explicitly

The rule-center contract cannot infer future table auto-apply purely from free-text requirements or from `execution_mode`.

Compiled table rules must eventually carry explicit auto-apply metadata, including at least:

- `grade`
- `patch_type`
- `apply_scope`
- `required_snapshot_capabilities`

The recommended values are:

- `grade: "A" | "B" | "C"`
- `apply_scope: "editing_only" | "inspect_only"`

Migration rule:

- all existing table rules remain inspect-only by default until they are explicitly reviewed and promoted into the new contract

This avoids accidentally treating today's proofreading-oriented table rules as editing-safe writeback rules.

## 4. Scope And Non-Goals

### 4.1 In Scope

- classify table rules into auto-apply readiness grades
- extend rule-center authoring and compilation so table rules can explicitly declare auto-apply readiness
- build a deterministic table patch plan from semantic table hits
- extend the table semantic snapshot where needed so caption, title, note-zone, and style patches have real anchors
- apply safe table patches into editing-side DOCX artifacts
- return explicit patch execution results and skip reasons
- keep proofreading on the same semantic hit model without table auto-rewrite
- route proofreading residual observations back into learning and rule promotion decisions
- produce observability that is truthful for table rule effectiveness

### 4.2 Out Of Scope

- screening module changes
- full table rebuild or table reflow engine
- image-based table recognition
- chart or figure interpretation
- auto-correction of numerical data or study conclusions
- fake per-run universal "accuracy"
- editing-side residual analysis

## 5. Recommended Architecture

The runtime chain for this package is:

`document structure snapshot -> table semantic hit -> table patch plan -> DOCX patch execution -> edited_docx artifact -> proofreading residual feedback`

### 5.1 Document Structure Layer

Keep `document-structure-service.ts` as the canonical source of semantic table snapshots.

This layer remains responsible for:

- identifying table ids
- exposing semantic coordinates such as `header_path`, `row_key`, `column_key`, and `footnote_anchor`
- describing whether a table is a three-line table and whether unit markers or footnotes exist
- surfacing first-class caption anchors before caption patches are promoted to `A`
- surfacing enough note-zone or footnote-zone structure before whole-note text patches are promoted to `A`
- surfacing enough style profile data before border or three-line-table patches are promoted to `A`

This layer does not decide whether a rule is safe to auto-apply.

The current repo already supports stable semantic entities for:

- `header_cell`
- `stub_column`
- `data_cell`
- `footnote_item`
- `unit_marker`

Before caption or style patch families can become truly `A` class, the snapshot contract must be extended so the currently theoretical targets become real first-class snapshot data, especially:

- `table_label`
- `table_title`
- table-level caption text or equivalent composed caption fields
- note-zone text when the note lives outside `footnote_item`
- style-profile anchors needed for border-only formatting patches

If the semantic snapshot cannot represent a target explicitly, that patch family must not be promoted to `A`.

### 5.2 Rule Hit Layer

Keep `editorial-rule-table-hit-service.ts` as the semantic hit resolver for table rules.

This layer remains responsible for:

- matching rules against semantic table targets
- returning explainable hit evidence
- staying shared between editing and proofreading

This layer does not write DOCX.

### 5.3 Patch Planning Layer

Add a dedicated planning step between table hit and DOCX writeback.

Its job is to transform:

- resolved rule
- semantic hit
- current table snapshot

into a deterministic patch instruction that answers:

- what patch type is requested
- what exact anchor should be targeted
- whether the patch is A, B, or C class
- whether the patch is safe to auto-apply in editing

The planner must also enforce:

- required snapshot capabilities for the patch type
- apply-scope compatibility with the current module and target asset
- downgrade of unsupported `A` candidates into explicit skip results rather than silent best-effort writeback

### 5.4 DOCX Patch Execution Layer

Extend the editing DOCX transform path so that `editorial-docx-transform-service.ts` can send table patch instructions to the Python worker.

The worker should:

- apply only local table patches
- preserve the surrounding table structure whenever possible
- never rebuild the whole table when a local patch is enough
- skip unsafe or unresolvable patches while still producing a valid DOCX

### 5.5 Proofreading Residual Layer

Proofreading continues to use the same semantic hit model, but instead of auto-applying table rewrite it should:

- record inspectable hits
- expose them to human review
- record residual outcomes after operator confirmation
- feed reusable value into rule promotion and gold-case growth

## 6. Rule Readiness Grading

Every table rule that participates in editing or proofreading should be graded into one of three classes.

### 6.1 Class A

`A` means safe for editing-side auto-apply now.

A rule can be `A` only if all of the following are true:

- the target can be anchored semantically and locally
- the patch changes format or labeling, not medical meaning
- the patch can be written without full table rebuild
- the failure mode is safe skip, not corrupt output
- gold cases show stable writeback behavior

### 6.2 Class B

`B` means the system may detect and explain the hit, but must not auto-apply yet.

Typical `B` reasons:

- anchor is usually available but not yet reliable enough
- patch type exists conceptually but lacks enough writer coverage
- visual layout risk is still too high
- gold-case coverage is still too small

### 6.3 Class C

`C` means always manual review.

Typical `C` reasons:

- meaning-level change risk
- ambiguous anchor
- cross-cell dependency that could alter interpretation
- change requires editorial judgment, not deterministic formatting

### 6.4 Initial Rule Families By Grade

The initial recommended `A` families are:

- safe header naming normalization
- footnote wording normalization
- unit formatting normalization

The next recommended `A` families, after snapshot/schema extension, are:

- caption or title prefix normalization
- table note-zone wording normalization

The next recommended style-only `A` family, after writer hardening, is:

- safe three-line table border styling

The initial recommended `B` families are:

- multi-row or multi-column header reshaping
- cell merge or split changes
- complex alignment changes that may affect readability

The initial recommended `C` families are:

- data correction
- statistical marker reinterpretation
- any change that could alter scientific meaning

### 6.5 Rule authoring and migration posture

The first implementation must not assume that current table rules are already promotion-ready.

The migration order is:

1. keep existing table rules as inspect-only
2. add explicit `grade`, `patch_type`, and `apply_scope` fields to compiled table rules
3. promote a reviewed subset into `A`

No table rule should become auto-apply merely because:

- `confidence_policy` is permissive
- free-text `caption_requirement` or `layout_requirement` sounds deterministic
- the rule currently hits in proofreading

## 7. Table Patch Contract

The system should introduce an explicit patch contract for editing-side table rewrite.

Each patch instruction should minimally include:

- `patchId`
- `ruleId`
- `tableId`
- `patchType`
- `grade`
- `applyScope`
- `anchor`
- `requiredSnapshotCapabilities`
- `proposedBefore`
- `proposedAfter`
- `rationale`
- `evidencePack`

Patch instructions are runtime artifacts, not authoring records. They are emitted only when a compiled table rule explicitly declares a patch-capable posture.

### 7.1 Initial Patch Types

The first patch types should be intentionally narrow:

- `replace_header_cell_text`
- `replace_footnote_text`
- `normalize_unit_text`

The next patch types require semantic snapshot extension before they can be `A` class:

- `replace_table_caption_text`
- `replace_table_note_text`

The first style-only patch type requires writer hardening before it can be `A` class:

- `apply_three_line_table_style`

### 7.2 Anchor Model

Patch anchors should be semantic, not raw row-column coordinates alone.

Allowed anchors in the first version should include:

- `table_id + header_path`
- `table_id + row_key + column_key`
- `table_id + footnote_anchor`
- `table_id + note_kind`

The following anchors become valid only after snapshot extension:

- `table_id + table_label`
- `table_id + table_title`
- `table_id + caption_text`

Raw XML position can still be used internally by the writer after anchor resolution, but it must not be the product-level contract.

This means:

- `replace_header_cell_text`, `replace_footnote_text`, and `normalize_unit_text` can start from the current semantic base
- `replace_table_caption_text` and `replace_table_note_text` are gated on snapshot capabilities, not just on writer effort

### 7.3 Fixed Apply Order

Table patches should always run in the same order:

1. caption
2. headers
3. units and footnotes
4. borders and style

This keeps later visual patches from invalidating earlier text anchors.

## 8. Patch Result And Skip Model

Each attempted table patch must return an explicit result state.

The initial result states are:

- `applied`
- `skipped_no_anchor`
- `skipped_conflict`
- `skipped_unsafe`

### 8.1 Result Semantics

- `applied`: patch landed in the DOCX successfully
- `skipped_no_anchor`: semantic anchor could not be resolved in the concrete document
- `skipped_conflict`: another patch or document condition made this patch unsafe to apply
- `skipped_unsafe`: the rule or local shape was judged unsafe for auto-write

### 8.2 Failure Policy

If one patch cannot safely apply:

- skip that patch
- record the result
- continue producing the output DOCX when the document is still safe to write

The system should only fail the entire transform when the writer cannot guarantee a valid output file.

## 9. DOCX Writeback Strategy

### 9.1 Keep The Current Transform Service As The Editing Orchestrator

`editorial-docx-transform-service.ts` should remain the editing-side orchestration boundary.

It should evolve to:

- accept explicit runtime guard information for table auto-apply scope
- collect deterministic non-table rules
- collect editing AI replacements
- collect table patch instructions for `A` rules
- send a unified payload to the Python worker
- return both text-level and table-level execution results

The transform input contract should be extended so it can distinguish:

- editing-side safe writeback
- proofreading inspect-only rendering
- proofreading human-final publication

Without this contract change, a future table patch engine would be too easy to invoke accidentally from proofreading paths.

### 9.2 Extend The Python Worker Instead Of Replacing It

`apply_editorial_rules.py` is the right starting place for the first implementation because it already owns deterministic DOCX writeback.

The worker should be extended to:

- accept table patch instructions
- resolve local table anchors in `word/document.xml`
- write only the targeted caption, note, header, footnote, unit, or style segment
- return patch result ledgers

The worker must also enforce the runtime guard from the caller. It must not infer table auto-apply eligibility by itself from raw rule fields.

### 9.3 Stable Output Is More Important Than Max Coverage

If a table patch family is not stable enough yet, it should stay `B` or `C`.

The product should prefer:

- smaller but real write coverage

over:

- broad but brittle automation that creates broken DOCX output

## 10. Editing And Proofreading Runtime Boundaries

### 10.1 Editing Runtime

Editing should:

- resolve table semantic hits
- build patch plans only for `A` rules
- apply those patches into `edited_docx`
- record which table changes really landed
- surface skipped patches as explainable evidence when relevant

### 10.2 Proofreading Runtime

Proofreading should:

- resolve the same table semantic hits
- inspect and report `A`, `B`, and `C` class issues as appropriate
- not auto-rewrite table structure in this package
- use human confirmation to decide what becomes residual evidence or governed learning input

Any proofreading path that still reuses the shared DOCX transform must pass a mode that disables table auto-apply. This includes both:

- proofreading-generated manuscript variants
- `human_final_docx` publication

### 10.3 Human Final Artifact Boundary

`human_final_docx` remains the final artifact after proofreading confirmation.

This package does not silently mutate table layout at that stage.

If a table issue still needs human editorial settlement, it should stay visible and governable instead of being auto-written late in the pipeline.

## 11. Residual Learning And Promotion Loop

Residual analysis stays in proofreading only, but it should become more useful for future table automation.

### 11.1 Residual Categories

The first residual categories for table automation should be:

- `missing_anchor`
- `ambiguous_anchor`
- `unsupported_patch_type`
- `layout_risk`
- `semantic_risk`
- `writer_failure`

### 11.2 What Should Flow Back

When proofreading operators confirm a final outcome, the system should preserve enough context to improve future rule automation, including:

- related rule id
- table id
- semantic anchor context
- operator final decision
- whether the AI or rule suggestion was accepted, edited, or rejected

The semantic anchor context should be normalized, not stored only as free-form location text. At minimum it should preserve the same fields used by runtime semantic hits, such as:

- `table_id`
- `semantic_target`
- `header_path`
- `row_key`
- `column_key`
- `footnote_anchor`

### 11.3 Promotion From B To A

A `B` rule family should only become `A` after:

- anchor parse success is consistently high on gold cases
- writer application is stable on gold cases
- rollback or rejection rates are acceptably low
- the team agrees the change is format-level and safe

## 12. Observability And Truthful Metrics

This package should not claim a fake single accuracy number for every run.

Instead, it should expose truthful operational metrics such as:

- rule hit rate
- anchor parse success rate
- patch apply rate
- patch skip rate by reason
- human rollback or rejection rate
- residual-to-gold-case conversion count
- B-to-A promotion count

The current activation metrics baseline already covers:

- `writeback_created_count`
- `writeback_applied_count`

This package should extend that baseline rather than replacing it. New table-specific metrics should be added explicitly, not inferred from generic governed-hit counters.

For customer or operator communication, these metrics are more honest and more useful than a universal "AI accuracy" percentage.

## 13. Testing Strategy

### 13.1 Unit Tests

Add focused tests for:

- table rule grading decisions
- patch planning from semantic hits
- patch apply order
- patch skip behavior
- proofreading residual categorization for table cases

### 13.2 DOCX Fixture Tests

Build representative DOCX fixtures covering:

- simple three-line table with caption and notes
- multi-level header table
- unit markers in header and notes
- footnote marker normalization
- layout-risk cases that must skip safely

### 13.3 Roundtrip Stability Tests

For each `A` family, verify:

- output file remains a valid `.docx`
- only the intended local region changed
- unrelated table content did not change

### 13.4 Negative Tests

Add negative coverage for:

- missing anchor
- ambiguous anchor
- unsupported patch type
- unsafe meaning-level rule
- writer exception fallback behavior

## 14. Suggested Implementation Slices

### 14.1 Slice 0

Introduce hard runtime and authoring boundaries first:

- shared transform `tableAutoApplyMode` guard
- explicit table rule `grade`, `patch_type`, and `apply_scope`
- migration default that keeps existing table rules inspect-only

### 14.2 Slice 1

Extend the semantic snapshot to support the first target patch families safely:

- confirm current support for header, footnote, and unit anchors
- add caption/title anchors if caption patches are in scope for the first release
- add note-zone anchors if whole-note rewrite is in scope for the first release
- define style-profile anchors before border-style patches are attempted

### 14.3 Slice 2

Introduce the planning contract and result ledger:

- table rule grade metadata
- table patch instruction model
- table patch result model

### 14.4 Slice 3

Implement the first safe editing-side patch families:

- header text
- footnote text
- unit normalization

Add caption or note-zone text only after the required snapshot anchors exist.

### 14.5 Slice 4

Add style-only table formatting support:

- three-line table border styling

only after the text patch path is already stable.

### 14.6 Slice 5

Wire truthful observability and proofreading residual feedback into:

- rule-center review
- learning candidate creation
- gold-case promotion decisions

## 15. Files And Modules Expected To Change

The first implementation plan will likely touch:

- `apps/api/src/modules/document-pipeline/editorial-docx-transform-service.ts`
- `apps/api/src/modules/editorial-execution/types.ts`
- `apps/api/src/modules/editorial-rules/editorial-rule-table-hit-service.ts`
- `apps/api/src/modules/document-pipeline/document-structure-service.ts`
- `apps/api/src/modules/document-pipeline/python-docx-structure-worker-adapter.ts`
- `apps/worker-py/src/document_pipeline/parse_docx.py`
- `apps/worker-py/src/document_pipeline/table_semantics.py`
- `apps/worker-py/src/document_pipeline/apply_editorial_rules.py`
- `apps/api/src/modules/proofreading/proofreading-service.ts`
- `apps/api/src/modules/residual-learning/proofreading-residual-adapter.ts`
- `apps/api/src/modules/editorial-rules/rule-package-compile-service.ts`
- `apps/web/src/features/template-governance/rule-authoring-types.ts`
- `apps/web/src/features/template-governance/rule-authoring-serialization.ts`
- `apps/web/src/features/template-governance/rule-authoring-table-semantic-fields.tsx`

It will likely also need new focused test coverage under:

- `apps/api/test/document-pipeline/`
- `apps/api/test/editing/`
- `apps/api/test/proofreading/`
- `apps/worker-py/tests/`

## 16. Acceptance Criteria

This design is correctly implemented when all of the following are true:

- the shared DOCX transform hard-blocks table auto-apply outside approved editing paths
- rule-center table rules can explicitly represent `A` / `B` / `C`, patch type, and apply scope
- at least the initial `A` table rule families create real effects in `edited_docx`
- the system returns explicit per-patch results rather than silently hiding failures
- a failed or skipped table patch does not prevent valid DOCX delivery unless output safety is impossible
- proofreading still uses the same table semantic hit model but does not silently auto-rewrite final table structure
- proofreading residuals preserve enough semantic anchor context to improve future rule promotion
- operator-visible metrics describe hit, apply, skip, and residual outcomes truthfully

## 17. Final Recommendation

The correct long-term path is to make table automation narrower, safer, and more explainable before making it broader.

That means:

- semantic anchors before writeback
- local patches before full rebuild
- editing auto-apply before proofreading auto-apply
- truthful residual learning before aggressive automation claims

This gives the product a real path to become stronger over time without sacrificing DOCX reliability or scientific safety.
