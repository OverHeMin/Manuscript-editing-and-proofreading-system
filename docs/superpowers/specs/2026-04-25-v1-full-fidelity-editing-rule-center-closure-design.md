# 2026-04-25 V1 Full-Fidelity Editing Rule Center Closure Design

## 1. Purpose

This document closes the remaining design gaps before implementation of the editing module, rule center, knowledge library, journal template governance, and full-fidelity table automation.

The approved V1 direction is a strong commitment:

- supported medical manuscript table paths must support full rich-style lossless intake
- supported medical manuscript table paths must support full-table reconstruction-based automatic formatting
- rule center must become a real executable formatting governance center, not only a rule ledger
- knowledge library and journal target models must provide structured evidence and targets for automatic editing
- buttons, pages, API calls, runtime bindings, ledgers, and completion gates must form one closed loop

This document does not relax the safety principle: if the system cannot prove evidence completeness, target completeness, writeback correctness, and content preservation, it must block automatic completion or route the item to manual review.

## 2. V1 Commitment Boundary

### 2.1 Supported Inputs

V1 supports the following authoritative paths:

- runtime `.docx` manuscript parsing through the document pipeline
- authoring-side Word table intake in explicitly supported browser and clipboard environments
- authoring-side WPS table intake in explicitly supported browser and clipboard environments
- uploaded `.docx` sample tables for rule center and knowledge library evidence packages

For these supported paths, table intake must not be summary-only. It must produce a full rich-style evidence package sufficient to drive rule authoring, target model comparison, editing runtime execution, and reconstruction validation.

### 2.2 Supported Table Shapes

V1 must support mainstream medical manuscript tables, including:

- three-line tables
- multi-level headers
- stub columns
- merged cells
- table label, table title, and table notes
- units and statistical markers
- superscript and subscript
- bold and italic text
- special symbols
- per-cell local rich text
- table-internal image-symbol or object-symbol candidates

### 2.3 Explicit Non-Automatic Scope

V1 does not promise automatic completion for:

- nested tables
- tables inside text boxes
- rotated text
- complex equation objects
- arbitrary floating objects
- image-table OCR
- unsupported clipboard payloads
- unsupported Word or WPS constructs outside the declared V1 matrix

These cases are still evidence-bearing. They must be detected, classified, and routed to manual review or blocked from automatic completion. They must not be silently ignored.

### 2.4 V1 Success Definition

For a supported input path, supported table shape, and complete journal target model, V1 succeeds only when the system can:

1. capture the full table rich-style fact set
2. normalize it into a stable table object
3. compare it with the selected journal target table model
4. create a full-table reconstruction plan
5. write the reconstructed table into the DOCX artifact
6. parse the written DOCX again
7. prove content preservation and target-format satisfaction
8. record all decisions in the editing ledger
9. pass the editing completion gate

If any step fails, the result is not considered automatic editing completion.

## 3. Authoring-Side Full Rich-Style Table Intake

### 3.1 Hard Requirement

Rule center and knowledge library table entry must support full rich-style lossless table intake for supported Word and WPS paths.

This is a hard gate. A pasted or uploaded table must not be accepted as authoritative evidence if the system only captured text, row counts, column counts, or a visual summary.

### 3.2 Intake Entry Points

The following UI entry points must be real, state-changing controls:

- rule center: `Create table formatting rule`
- rule center: `Capture Word/WPS table evidence`
- rule center: `Bind captured table evidence to rule`
- knowledge library: `Upload or paste official sample table`
- knowledge library: `Generate evidence package`
- journal template detail: `Bind table evidence to target table model`

Each entry point must call a real API, persist a real evidence package, expose the capture status after save, and block publication when mandatory facts are missing.

### 3.3 Table Evidence Package

Authoring-side intake must persist a `table_evidence_package` with at least:

- `evidence_package_id`
- `source_kind`: `word_clipboard`, `wps_clipboard`, `docx_upload`, `manual_review_import`
- `source_environment`: app, version if available, browser, OS, capture adapter
- `authoritative_status`: `authoritative`, `non_authoritative`, `blocked`, `manual_review_required`
- `capture_failure_codes`
- `raw_payload_refs`
- `normalized_table_object_id`
- `table_full_fidelity_snapshot_id`
- `linked_knowledge_item_ids`
- `linked_rule_ids`
- `linked_target_model_block_ids`
- `created_by`, `created_at`, `reviewed_by`, `reviewed_at`

Raw payload references may include clipboard HTML, OOXML fragments where available, uploaded DOCX parts, screenshots for review, and source metadata. Raw payloads are not the runtime truth by themselves; they are retained so capture can be audited and improved.

### 3.4 Full-Fidelity Snapshot Fields

The `table_full_fidelity_snapshot` must include the following mandatory fact groups for V1:

| Fact group | Mandatory facts |
| --- | --- |
| Identity | table label, table title, caption text, caption position, note text, note position |
| Structure | row count, column count, row and column topology, merged-cell topology, header depth, stub-column structure, data-area structure |
| Border system | top border, header separator, bottom border, vertical border presence, border style, border width, border color where present |
| Layout | table width strategy, explicit column widths where present, explicit row heights where present, cell padding or margins where present, horizontal alignment, vertical alignment |
| Paragraph style | paragraph alignment, indentation, spacing before and after, line spacing, keep flags where available |
| Typography | font family, font size, bold, italic, superscript, subscript |
| Rich content | per-cell paragraph snapshots, per-cell fragment snapshots, local rich-text segmentation, units, special text symbols |
| Object content | image or object evidence for symbol replacements, formula fragments, and unsupported embedded content |
| Authority markers | per-field `authoritative`, `mixed`, `unavailable`, or `unsupported` status |

No authoritative intake may treat open-ended prose or visual screenshots alone as satisfying this matrix.

### 3.5 Capture Acceptance Rules

A table intake is accepted as authoritative only if:

- every V1 mandatory fact group is populated or explicitly marked with a non-authoritative state
- no mandatory fact required for the chosen target model is `unavailable`
- unsupported objects are surfaced as object evidence
- capture source metadata is stored
- the operator can inspect the extracted structure and rich-style facts before publication
- publication is blocked when exact capture fails

The UI must show exact capture failure codes, not generic failure text.

## 4. Runtime Table Truth Model

### 4.1 Runtime Authority

Runtime editing remains anchored on OOXML / DOCX truth. Authoring-side Word/WPS intake is used for evidence authoring and rule governance; runtime manuscript execution must parse the actual manuscript DOCX and produce its own `table_full_fidelity_snapshot`.

### 4.2 Shared Vocabulary

Authoring-side table evidence and runtime DOCX table snapshots must use the same vocabulary for:

- table identity
- semantic zones
- structure
- border system
- layout
- typography
- rich fragments
- object evidence
- authority markers

This ensures that a table rule authored from a Word/WPS sample can execute against a runtime DOCX manuscript without translation by AI guesswork.

## 5. Journal Target Table Model

### 5.1 Purpose

The `journal_target_table_model` describes the expected table output for a journal. It is not stored as free text in a template note.

It is a governed child object under `journal_format_target_model`.

### 5.2 Required Policies

Each target table model must define at least:

- table label format
- title placement and typography
- note placement and typography
- three-line table border policy
- vertical border policy
- header depth policy
- stub-column policy
- merged-cell allowance policy
- font family and size policy
- bold and italic policy
- superscript and subscript preservation policy
- unit marker policy
- special symbol policy
- table width and column width policy
- auto-rebuild eligibility policy
- manual-review downgrade policy

### 5.3 Versioning

Target table models are versioned. Every editing run must record the exact `target_model_version_id` and `journal_target_table_model_version_id` used during reconstruction.

## 6. Full-Table Reconstruction-Based Automatic Formatting

### 6.1 Required Pipeline

The editing runtime must use this pipeline for supported table automation:

`runtime_docx_table_snapshot -> normalized_table_object -> journal_target_table_model -> reconstruction_plan -> docx_writeback -> validation_snapshot -> ledger -> completion_gate`

### 6.2 Patch Versus Rebuild

Patch is allowed only for low-risk local changes such as a safe text marker or punctuation normalization.

Full-table rebuild is required when a change affects:

- table border system
- three-line-table posture
- caption or note placement
- multi-level header structure
- stub-column treatment
- merged-cell topology
- table-level width or layout
- per-cell rich-style normalization
- object-symbol handling inside a table

### 6.3 Reconstruction Plan

A `table_reconstruction_plan` must include:

- source table id and anchors
- target table model id and version
- structure mapping from source cells to target cells
- content-preservation map
- caption and note placement plan
- border plan
- layout plan
- typography plan
- rich-fragment preservation plan
- object handling plan
- planned writeback operations
- validation expectations
- downgrade reasons if any operation is unsafe

### 6.4 Content Preservation

The reconstruction engine must prove that it does not alter:

- numerical values
- statistical results
- medical terms
- conclusions
- units in a way that changes meaning
- original cell-to-cell semantic mapping

If content preservation cannot be proven, reconstruction must be blocked or routed to manual review.

### 6.5 Writeback Validation

After DOCX writeback, the system must re-parse the generated document and produce a `validation_snapshot`.

Validation must compare:

- original content versus written content
- original table topology versus written topology where topology must be preserved
- written output versus journal target table model
- written rich text versus intended rich-fragment plan
- object handling results versus object policy

A validation failure must prevent editing completion and create a manual review item.

### 6.6 Rollback And Idempotence

Every rebuild must have a rollback point. Re-running the same manuscript against the same rule versions and target model versions should converge to the same output.

## 7. Rule Center Improvements For Automatic Editing

### 7.1 Product Repositioning

The rule center must become an executable formatting governance center. It should not remain only a rule list or prose authoring screen.

It must support creating, reviewing, testing, publishing, explaining, and retiring rules that can drive automatic editing and formatting.

### 7.2 Rule Domains

V1 rule center must support structured domains for:

- page structure
- title and heading hierarchy
- abstract and keywords
- front-matter metadata
- body paragraph format
- references
- declarations and statements
- tables
- image-symbol and object-symbol content
- journal-specific overrides

### 7.3 Rule Action Model

Rules must declare a structured action type:

- `inspect_only`
- `suggest_change`
- `auto_apply`
- `full_table_rebuild`
- `manual_review_required`
- `block_completion`

Rules must not rely on prose alone to imply runtime behavior.

### 7.4 Automation Grade

Each rule must have an `automation_grade`:

- `A`: may automatically execute after evidence and regression gates pass
- `B`: may prepare a plan but requires manual confirmation
- `C`: inspect-only; never writes to the artifact
- `D`: prohibited from automation because it risks meaning, data, or clinical conclusion changes

Existing rules default to `C` until explicitly reviewed and promoted.

### 7.5 Table Rule Schema

Table rules must define structured policies for:

- table target zone
- label and title
- note placement
- header depth
- stub column
- merged-cell policy
- border system
- layout and width
- typography
- rich text preservation
- special symbols
- image-symbol objects
- full rebuild eligibility
- downgrade reasons

### 7.6 Evidence Binding

A publishable rule must bind to:

- one or more knowledge evidence packages
- one target model block or table model policy
- one or more supported module postures
- one scope layer: `general`, `medical`, or `journal`
- regression specimens when the rule is automation grade `A`

### 7.7 Rule Conflict Resolution

The rule center must preserve the precedence:

`journal > medical > general`

When conflicts occur, the UI and runtime explanation must show:

- which rule won
- which rule was overridden
- why the precedence applied
- whether manual review is required

### 7.8 Gold Sample Release Gate

Automation grade `A` rules cannot be published unless they pass a gold sample gate.

A gold sample includes:

- input DOCX or table evidence package
- selected journal target model
- expected output or expected validation snapshot
- negative cases where automation must downgrade
- validation diff results
- reviewer approval

For table rebuild rules, the gate must include at least one supported table with rich local formatting and one downgrade specimen.

## 8. Knowledge Library Improvements

### 8.1 Evidence Package Model

Knowledge items must be able to produce structured `evidence_package` records, not only free-text notes.

Supported evidence includes:

- official guideline text
- official sample screenshots
- Word/WPS sample tables
- uploaded DOCX sample tables
- correct examples
- incorrect examples
- object-symbol examples
- journal article examples
- operator annotations

### 8.2 Authority Levels

Knowledge evidence must declare authority level:

- official journal guideline
- official journal sample
- journal-published recent article
- institutional editorial standard
- operator-curated experience

Authority level affects whether a rule may become automation grade `A`.

### 8.3 Table Sample Library

The knowledge library must support table samples with:

- original table evidence package
- expected target table model mapping
- corrected output snapshot
- reusable rule hints
- known unsupported constructs
- review history

### 8.4 Object Symbol Library

The knowledge library must support image-symbol and object-symbol samples, including:

- original object snapshot
- nearby text
- expected symbol if known
- confidence and ambiguity labels
- allowed auto-replacement policy
- manual-review policy

## 9. Journal Template And Target Model Improvements

### 9.1 Responsibility Split

`journal_template` selects the active journal scope.

`journal_format_target_model` defines the governed format target.

Rules and knowledge bind to target model blocks, not to vague template notes.

### 9.2 Target Blocks

The target model must cover:

- front matter
- title area
- abstract and keywords
- body paragraphs
- headings
- references
- declarations
- tables
- figures and captions
- object-symbol policy

### 9.3 UI Entry Points

Journal template detail must expose:

- `Open format target model`
- `Edit target blocks`
- `Edit table target model`
- `View bound rules`
- `View bound knowledge evidence`
- `Publish target model version`

Each entry must persist real state and be inspectable after save.

## 10. Editing Runtime Closure

### 10.1 Runtime Chain

The editing runtime chain is:

`journal_template selection -> published journal_format_target_model -> knowledge evidence packages -> layered rule resolution -> document full-fidelity snapshots -> editing decision engine -> table reconstruction engine -> DOCX writeback -> validation snapshot -> editing ledger -> completion gate`

### 10.2 Editing Decision Classes

Each candidate action resolves to:

- `auto_apply`
- `full_rebuild`
- `inspect_only`
- `manual_review_required`
- `blocked`

### 10.3 Completion Gate

Editing is complete only if:

- all required slots are resolved
- all grade-A rule executions passed validation
- all supported table rebuilds passed validation
- all high-risk objects are resolved or explicitly deferred
- no blocked completion item remains
- the edited DOCX artifact and ledger are available

Job lifecycle completion alone is not editing completion.

## 11. Button, Page, API, And State Closure

### 11.1 Rule Center

Required controls:

- `Create formatting rule`
- `Create table reconstruction rule`
- `Capture table evidence`
- `Bind knowledge evidence`
- `Bind target block`
- `Run gold sample gate`
- `Publish rule`

Required states:

- `draft`
- `evidence_incomplete`
- `ready_for_review`
- `gold_gate_failed`
- `approved`
- `published`
- `retired`

### 11.2 Knowledge Library

Required controls:

- `Create evidence package`
- `Upload DOCX sample`
- `Paste Word/WPS table`
- `Review extracted facts`
- `Bind to journal target`
- `Generate rule draft`

Required states:

- `raw`
- `captured`
- `non_authoritative`
- `authoritative`
- `linked_to_rule`
- `retired`

### 11.3 Journal Template Detail

Required controls:

- `Open target model`
- `Edit table target model`
- `Bind evidence`
- `Bind rules`
- `Publish version`

Required states:

- `draft`
- `review_required`
- `published`
- `superseded`

### 11.4 Manuscript Editing Page

Required controls:

- `Run automatic journal formatting`
- `View resolved rules`
- `View table reconstruction plan`
- `View validation diff`
- `Open manual review workspace`
- `Accept manual resolution`
- `Re-run editing`

Required states:

- `not_started`
- `running`
- `needs_manual_review`
- `blocked`
- `validated`
- `completed`

## 12. Manual Review Workspace

Manual review is a first-class workflow, not a generic warning.

The workspace must show:

- full document on the left
- module-specific issue cards on the right
- table evidence and target model comparison
- reconstruction plan
- validation diff
- object-symbol evidence
- downgrade reason
- accept, reject, or override controls

Manual resolutions must persist and be replayed on rerun when still applicable.

## 13. Verification And Acceptance

### 13.1 Table Intake Acceptance

- supported Word/WPS pasted tables produce full evidence packages
- uploaded DOCX sample tables produce full evidence packages
- mandatory fact groups are inspectable in UI
- missing mandatory facts block authoritative publication
- object-symbol evidence inside tables is surfaced

### 13.2 Table Reconstruction Acceptance

- supported specimen tables rebuild into the selected journal target model
- caption and note placement are correct
- merged topology is preserved where required
- rich text inside cells is preserved
- content preservation diff passes
- writeback validation snapshot passes
- failed validation blocks editing completion

### 13.3 Rule Center Acceptance

- grade-A automation rules require gold sample success
- rule bindings to target blocks and knowledge evidence are visible after save
- conflict resolution explains journal over medical over general precedence
- existing rules remain inspect-only until promoted

### 13.4 Runtime Acceptance

- manuscript editing page explains which template, target model, evidence packages, and rules were used
- table rebuild decisions appear in the editing ledger
- completion gate blocks unresolved slots, failed rebuilds, high-risk objects, and validation failures
- rerun is idempotent for the same versions and manual resolutions

## 14. Implementation Plan Implications

The implementation plan must be updated to proceed in this order:

1. target model and table target model persistence
2. authoring-side evidence package model
3. Word/WPS/DOCX full-fidelity table intake for rule center and knowledge library
4. runtime DOCX full-fidelity table snapshot parity
5. rule center automation grade, evidence binding, and gold sample gate
6. editing runtime full-table reconstruction planner
7. DOCX writeback and validation snapshot
8. ledger and completion gate integration
9. manual review workspace closure
10. focused tests and real-browser acceptance

Implementation must not begin with DOCX writeback alone. Without evidence packages, target models, rule grades, and validation gates, writeback would create the same false-completion risk this design is meant to remove.

## 15. Final Decision

The system should proceed with V1 strong commitment, but only under a strict supported-path contract.

For supported medical manuscript table paths, the product must deliver full rich-style lossless intake and full-table reconstruction-based automatic formatting.

For unsupported constructs or incomplete evidence, the product must be honest: classify, explain, block automatic completion, and route to manual review.

The rule center, knowledge library, and journal template governance must be upgraded together because editing automation cannot be trusted unless executable rules, structured evidence, target models, runtime snapshots, writeback validation, and completion gates all close the same loop.
