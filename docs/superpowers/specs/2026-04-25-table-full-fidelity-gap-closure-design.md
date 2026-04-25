# 2026-04-25 Table Full-Fidelity Gap Closure Design

## 1. Purpose

This design closes the gap between the already-landed table pipeline and the required product outcome for the editing and proofreading modules.

The current system already has:

- runtime DOCX table parsing
- semantic table snapshots
- deterministic safe patch paths
- controlled three-line-table rebuild
- exact-capture governance gates for authored table evidence

The current system does not yet satisfy the approved product requirement of:

- full-fidelity rich-style table capture
- full-table reconstruction-style automatic formatting
- journal-targeted editing that can safely restyle complete tables instead of only patching local cells

This document does not replace the approved April 24 designs. It defines the delta required to actually reach their table goals.

## 2. Problem Statement

The current delivery is a strong first-stage skeleton, but it is not yet the final table product.

What is already true:

- runtime `.docx` parsing captures caption, note zone, merged topology, grid cells, paragraph snapshots, inline fragments, symbol fragments, and a useful subset of style evidence
- the worker can safely patch header text, unit text, caption text, and footnote or note text
- the worker can rebuild a three-line table from grid evidence when the controlled rebuild path is allowed

What is not yet true:

- authoring-side table intake is still signal-level, not full cell-by-cell rich-style capture
- many layout facts are still missing from the table snapshot contract
- rebuild is still specialized around controlled three-line normalization rather than a journal target model
- writeback does not yet restore the full table layout and style system required for journal editing

Because of this, the current state should be described as:

- `runtime table intelligence and controlled rebuild exist`
- but not
- `full-fidelity table capture and general full-table reconstruction are complete`

## 3. Root Cause Classification

The gap is mainly an implementation-completeness problem, not a direction problem.

### 3.1 What Is Not Wrong

The high-level approach remains correct:

- trust DOCX runtime truth for manuscript execution
- require governed exact-capture for authored rule and knowledge evidence
- keep patch as a narrow deterministic subpath
- use rebuild for structure and style-system changes
- fail closed when evidence is incomplete

This architecture should be retained.

### 3.2 What Is Incomplete

The missing work falls into four buckets:

1. the table fact contract is still too narrow
2. authoring-side exact-capture is still too lossy
3. the rebuild engine is still too specialized
4. the acceptance baseline for table fidelity is still too weak

### 3.3 What Is Tool-Limited

The current browser clipboard path can help with governed intake, but by itself it is not a sufficient source for full-fidelity journal-grade table evidence.

The limiting factor is not just missing coding work. It is also that the current intake path only produces:

- coarse border profile
- coarse alignment profile
- merged cell map
- run-style signals

That is useful for governance and early validation, but not enough for full table restyling.

## 4. Decision Summary

The approved path is:

- keep runtime execution anchored on OOXML / DOCX truth
- keep exact-capture governance for rule center and knowledge center
- extend authoring intake beyond signal-level capture
- upgrade rebuild from controlled three-line normalization to target-model-driven table reconstruction
- keep LibreOffice as a preview and manual-review assistant only

The system should not pivot to LibreOffice as the authoritative table engine.

## 5. Why LibreOffice Is Not The Core Fix

LibreOffice is useful, but only in a supporting role.

### 5.1 What LibreOffice Can Help With

- left-side full-document preview in the manual review workspace
- operator-side browsing and navigation
- visual cross-check of generated output
- fallback rendering when a manuscript needs to be inspected without opening Word directly

### 5.2 What LibreOffice Should Not Own

- authoritative table capture truth
- authoritative journal-format writeback semantics
- exact preservation of Word or WPS table formatting intent
- the core table reconstruction engine

### 5.3 Why

The product target is Word- and WPS-facing journal formatting fidelity. LibreOffice is not the safest place to define canonical truth for:

- OOXML table border semantics
- merged-cell layout preservation
- Word-specific table layout details
- rich run-level formatting inside table cells

If LibreOffice becomes the core engine, the system risks replacing one fidelity gap with another.

## 6. Required Product Outcome

The product must support the following target state.

### 6.1 Editing Module Outcome

For a supported input path and a supported journal target model, the editing module must be able to:

- parse the full table and its style-relevant facts
- map the table into a normalized table object
- apply journal-specific table formatting policy
- reconstruct the full table in DOCX
- preserve content and merged topology
- preserve safe rich text inside cells
- restore caption and note placement correctly
- surface any unsupported residue for manual review

### 6.2 Rule and Knowledge Outcome

Table evidence authored in the rule center and knowledge center must be:

- exact enough to support executable table rules when the supported path is satisfied
- explicitly marked non-authoritative when exact capture fails
- connected to the same runtime table model used by editing and proofreading

### 6.3 Proofreading Outcome

Proofreading still should not become a freeform table re-layout tool, but it must consume the same table truth model so that:

- it can detect format violations correctly
- it can produce table findings against the same semantic anchors as editing
- it does not depend on AI guessing missing table facts

## 7. Gap-Closure Scope

This design adds four major capabilities.

### 7.1 Capability A: Expanded Table Fact Contract

The runtime table snapshot contract must be extended beyond the current subset.

The next required fact set includes:

- table width strategy
- explicit column widths
- explicit row heights when present
- border style, width, and color
- cell shading or fill
- cell padding or margin facts when available
- more run-level typography facts where available
- paragraph keep and spacing details when they affect layout
- per-cell authoritative versus mixed versus unavailable availability markers for new fields

These facts must be represented at the OOXML-truth layer, not only as UI-side derived summaries.

### 7.2 Capability B: Authoring-Side Full Capture Package

The current table intake in authoring is too coarse. It must move from a summary payload to a structured capture package.

The new authoring capture package must include:

- raw table matrix
- merged topology
- caption block snapshots
- note block snapshots
- per-cell paragraph snapshots
- per-cell fragment snapshots
- explicit style facts for each supported field
- explicit unsupported or missing fields ledger
- capture source metadata
- authoritative versus non-authoritative posture

The UI may still show a compact summary, but the saved artifact must be the full structured package.

### 7.3 Capability C: Journal Target Table Model

The rebuild engine should no longer jump directly from `table snapshot` to `three-line normalization`.

It must move through:

`table rich snapshot -> normalized table object -> journal target table model -> reconstruction plan -> DOCX writeback`

The `journal target table model` is not a parallel target source.

It must be defined as a versioned typed submodel inside the published `journal_format_target_model` object so that:

- one journal version publishes one target source
- table target policy versions move with the same journal target model version
- runtime binding, replay, and acceptance all continue to treat `journal_format_target_model` as the single target authority

The journal target table model must express:

- caption position
- note position
- line and border system
- header depth policy
- unit placement policy
- numeric alignment policy
- stub-column policy
- table width and spacing policy
- fallback rules for unsupported constructs

### 7.4 Capability D: Full Acceptance Matrix

The system must stop using weak acceptance language like `works for table rebuild`.

Acceptance must be specimen-driven and compare:

- extracted fact completeness
- rebuild correctness
- downgrade correctness
- review workbench visibility for unresolved residues

## 8. Detailed Design

### 8.1 Runtime Table Truth Model

The current `DocumentStructureTableSnapshot` remains the backbone, but it must be extended rather than replaced.

The extension rule is:

- preserve current fields
- add richer optional fields
- keep availability markers on style facts
- avoid flattening journal-specific output policy into the raw snapshot

Raw truth and target policy must stay separate.

Raw truth answers:

- what is in the manuscript now

Target policy answers:

- what should the manuscript become for the selected journal

### 8.2 Authoring Capture Model

The authoring path must split into two layers.

Layer 1: intake evidence package

- capture all supported structural and rich-style facts
- record capture environment and source application
- record exact-capture failure codes
- store unsupported facts and incompleteness explicitly

Layer 2: publication eligibility

- only allow executable or runtime-eligible publication when the supported exact-capture conditions are satisfied
- otherwise keep the record as reference evidence only

This preserves the current governance philosophy while making the stored evidence materially stronger.

### 8.3 Word or WPS Assisted Capture

To reach the approved product target, the authoring path should add a stronger capture mode for supported desktop environments.

The V1 authoritative authoring path is locked to one primary technical path:

- supported environment: Windows desktop
- supported browser shell: Chrome or Edge
- supported source application: Microsoft Word or WPS
- supported intake face: a structured table capture package imported into the governed rule-intake or knowledge-intake workspace

The V1 authoritative package must contain:

- raw table matrix
- merged topology
- caption and note block snapshots with positions
- per-cell paragraph snapshots
- per-cell fragment snapshots
- per-cell supported style facts
- object evidence records for non-text table content
- capture source metadata
- exact-capture posture and failure codes

For V1, raw HTML clipboard by itself is not an authoritative publication source.

Preferred order:

1. direct structured capture package from supported Word or WPS environments
2. current HTML clipboard capture as a governed non-authoritative fallback or bridge input
3. plain-text fallback only for non-authoritative reference intake

The product must no longer pretend that HTML clipboard alone is enough for the final target.

The V1 failure-code contract must include at least:

- `unsupported_capture_environment`
- `unsupported_capture_surface`
- `structured_capture_package_missing`
- `structured_capture_package_incomplete`
- `table_structure_incomplete`
- `merged_cell_map_incomplete`
- `caption_or_note_position_unknown`
- `border_profile_incomplete`
- `alignment_profile_incomplete`
- `run_style_incomplete`
- `object_evidence_incomplete`
- `exact_capture_not_authoritative`

### 8.4 Table Reconstruction Engine

Rebuild must be generalized from a specialized style patch to a planner-driven document transformation stage.

The planner should classify requests into:

- local deterministic patch
- structural rebuild
- manual downgrade

Patch remains appropriate for:

- header text replacement
- unit token normalization
- footnote text replacement
- caption wording replacement

Rebuild becomes mandatory for:

- border system changes
- width system changes
- row or column geometry changes
- header-depth normalization
- merged-topology-sensitive edits
- unit relocation into headers
- global journal table styling

Object-type table content must stay outside ordinary text normalization.

The planner must never route the following through normal cell-text rewrite or ordinary rich-text reconstruction:

- image-substituted statistical symbols
- table-internal object-type symbols
- formula fragments represented as objects or images

These items must instead emit explicit `object evidence`, `residue`, or manual-review work items.

### 8.5 Writeback Strategy

Writeback must stay OOXML-first.

The writeback engine should:

- reconstruct the table node from the normalized object
- write supported cell geometry and merge semantics
- write supported border and fill semantics
- restore supported paragraph and run style facts inside each cell
- reinsert caption and note zones in the correct positions
- emit explicit downgrade or residue entries for any unsupported fact

For object-type table content, writeback must not silently coerce the object into plain text.

If an object-type symbol or formula fragment cannot travel through a dedicated safe pathway, the engine must:

- preserve the object if preservation is safe
- emit residue and downgrade metadata
- route the item to manual review

The system should never silently drop a known-required fact inside the supported path.

### 8.6 Manual Review Workspace

When rebuild cannot safely complete, the system must not stop at a generic warning.

The shared review workspace should surface:

- the full document on the left
- table issue cards on the right
- direct jump-to-table positioning
- residual facts that were not safely reconstructed
- the reason for downgrade

This keeps the current product direction aligned with the approved manual-review design.

If the existing shared document viewer contract already depends on the LibreOffice-based viewing chain, the table workflow must reuse that shared viewer foundation rather than introducing a second isolated preview stack.

## 9. Acceptance Standard

### 9.1 Table Capture Is Accepted Only If

- supported sample tables produce the required structured fact set
- missing facts are explicitly marked, not guessed
- authoritative intake is blocked when the supported capture contract is not met
- object-type symbols inside tables are surfaced as explicit evidence

For V1, the required structured fact set is closed and must include all of the following mandatory fields:

| Fact group | Mandatory fields |
| --- | --- |
| Table identity | table label, table title, caption text, caption position, note text, note position |
| Structure | row and column topology, merged-cell topology, header depth, stub-column structure, data-area structure |
| Border system | top, header, bottom, and vertical border presence, plus supported border style, width, and color facts where present |
| Layout | horizontal alignment, vertical alignment, table width strategy, explicit column widths where present, explicit row heights where present, supported cell padding or margin facts where present |
| Typography | font family, font size, bold, italic, superscript, subscript |
| Rich content | per-cell paragraph snapshots, per-cell fragment snapshots, local rich-text segmentation, unit markers, special text symbols |
| Object content | table-internal image or object evidence for symbol replacements or formula fragments |

No authoritative publication path may treat this matrix as satisfied by open-ended summaries alone.

### 9.2 Table Reconstruction Is Accepted Only If

- supported specimen tables can be rebuilt into the selected journal target model
- merged topology remains correct
- caption and note placement remain correct
- supported rich text inside cells remains correct
- unsupported facts trigger downgrade instead of silent corruption

### 9.3 The Product Is Not Accepted If

- table intake still depends on summary-only signals for executable publication
- rebuild remains limited to cosmetic three-line normalization while claiming full-table editing
- unsupported style facts are silently ignored on the supported path

## 10. Implementation Staging

### Stage 1: Fact Contract Expansion

- extend runtime snapshot fields
- extend parse and normalization layers
- extend tests for richer OOXML facts

### Stage 2: Authoring Capture Package Upgrade

- redesign table payload for rule center and knowledge center
- preserve governance gates
- add stronger supported capture mode metadata

### Stage 3: Journal Target Table Model

- introduce normalized table object
- introduce journal target table policy model
- separate raw truth from target formatting intent

### Stage 4: Generalized Reconstruction Planner

- expand planner from three-line-only rebuild to target-model rebuild classification
- keep deterministic patch routes for small safe cases

### Stage 5: OOXML Writeback Expansion

- write extended geometry, borders, fills, and supported rich-style facts
- emit residue and downgrade records when unsupported details remain

### Stage 6: Review and Acceptance Harness

- add specimen fixtures
- add extract-versus-rebuild assertions
- add downgrade-path assertions
- add browser-visible review verification

## 11. Non-Goals

This design does not attempt to:

- make every arbitrary office format path authoritative from day one
- use LibreOffice as the canonical table engine
- allow AI to hallucinate missing table style facts
- guarantee fully automatic reconstruction for unsupported table constructs without downgrade

## 12. Recommendation

The correct next move is not to replace the current architecture.

The correct next move is to:

- retain the current DOCX-truth and governance backbone
- strengthen authoring capture
- upgrade the table target model
- generalize rebuild
- treat LibreOffice as a review tool, not the fidelity engine

This is the shortest path that can actually reach the approved product target without introducing a second source of formatting truth.
