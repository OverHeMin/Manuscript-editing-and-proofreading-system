# Lossless Table Evidence Center Design

Date: 2026-04-30
Branch: codex/lossless-table-evidence-design
Status: design only; implementation must wait for explicit approval

## 1. Goal

Build an independent TableEvidenceCenter that can preserve and expose native DOCX table evidence for AI-assisted manuscript workflows.

The first consumer is proofreading. Editing and screening must be able to reuse the same center later without redesigning the extraction layer.

The target is not approximate semantic extraction. The target is option C:

1. Preserve original OOXML authority for every native DOCX table.
2. Generate complete character-level and style-level evidence for audit and deterministic checks.
3. Generate an AI-readable table payload derived from the evidence, never replacing the OOXML authority layer.
4. Use minimal, hash-guarded patching only after human confirmation.

## 2. Non-goals

- Do not support scanned tables, image tables, WPS pseudo-tables, or OCR tables in phase 1.
- Do not let AI directly rewrite table XML.
- Do not auto-change medical data, statistics, P values, or table content.
- Do not replace the existing document structure pipeline wholesale.
- Do not change editing or screening behavior in the first implementation wave.

Unsupported or partial evidence must be surfaced as manual review, not silently normalized.

## 3. Current Evidence

Current code already has partial table extraction and a full-fidelity snapshot concept:

- `apps/worker-py/src/document_pipeline/parse_docx.py` extracts `raw_xml_text`, paragraphs, style runs, border hints, row span, column span, vertical alignment, and object evidence.
- `apps/api/src/modules/document-pipeline/document-structure-service.ts` defines table snapshots with `grid_cells`, `raw_xml_text`, `style_runs`, and `table_full_fidelity_snapshot`.
- `apps/api/src/modules/knowledge/table-full-fidelity-snapshot.ts` builds a table fidelity record from document structure.

The key gap is that proofreading currently flattens table slices into text:

- `apps/api/src/modules/proofreading/proofreading-slice-builder.ts` builds table slice `text` from caption, notes, and cell display text.
- `apps/api/src/modules/proofreading/deep-proofreading-pass-runner.ts` passes only `sliceContext.text`, `tableIds`, and block indexes to AI.

Therefore, AI is not receiving a complete structured table payload during proofreading.

## 4. Architecture

Add an independent TableEvidenceCenter under the document-pipeline domain. It owns native DOCX table evidence extraction, caching, validation, and consumer payload generation.

### Components

1. `TableEvidenceCenter`
   - Public service used by proofreading, later editing and screening.
   - Main method: `getOrCreateSnapshot({ manuscriptId, assetId })`.
   - Cache key: `assetId + docxHash + parserVersion`.
   - Returns `TableEvidenceSnapshot` with status and warnings.

2. `LosslessDocxTableExtractor`
   - Python worker or worker extension that reads native DOCX package bytes.
   - Extracts OOXML authority, character evidence, style evidence, topology, and AI payload.
   - It must not normalize text in authority or character evidence tracks.

3. `TableEvidenceRepository`
   - Stores snapshots or allows file-backed cache depending on existing persistence patterns.
   - Must preserve large OOXML payloads safely.
   - Should support lookup by asset hash and parser version.

4. `TableEvidencePayloadBuilder`
   - Converts authority evidence into model-safe AI payloads.
   - Applies token budgeting and redaction only on the AI payload, never on authority data.

5. `TableEvidenceValidator`
   - Computes fidelity status and warnings.
   - Blocks false `complete` status when required evidence is missing.

6. `TablePatchGuard`
   - Later phase component for hash-guarded, minimal table patching.
   - Default mode remains comment-only.

## 5. Data Model

### TableEvidenceSnapshot

Fields:

- `snapshotId`
- `manuscriptId`
- `assetId`
- `sourceStorageKey`
- `docxHash`
- `parserVersion`
- `createdAt`
- `status`: `complete | partial | unsupported | failed`
- `tables: TableEvidenceTable[]`
- `warnings: TableEvidenceWarning[]`

### TableEvidenceTable

Fields:

- `tableId`
- `ordinal`
- `bodyPath`
- `ooxmlHash`
- `rawTblXml`
- `rows: TableEvidenceRow[]`
- `cells: TableEvidenceCell[]`
- `captionEvidence`
- `noteEvidence`
- `aiPayload`
- `fidelityReport`

### TableEvidenceCell

Fields:

- `cellId`
- `rowIndex`
- `columnIndex`
- `rowSpan`
- `columnSpan`
- `tcPath`
- `rawTcXml`
- `tcHash`
- `paragraphs`
- `runs`
- `characters`
- `styleSpans`
- `borderXml`
- `shadingXml`
- `widthXml`
- `verticalAlignXml`
- `mergeXml`

### TableEvidenceCharacter

Fields:

- `index`
- `char`
- `codePoint`
- `unicodeName`
- `charClass`: `normal | half_space | full_space | nbsp | tab | line_break | en_dash | em_dash | hyphen | minus | symbol | control`
- `sourceRunId`
- `preserved: true`
- `visible: boolean`

### AiReadableTablePayload

Fields:

- `tableId`
- `caption`
- `notes`
- `matrix`
- `cells`
- `headers`
- `units`
- `styleSpans`
- `specialCharacterWarnings`
- `lowConfidenceReasons`

The AI payload is derived evidence only. It must contain stable anchors back to `tableId`, `cellId`, `runId`, and character ranges.

## 6. Proofreading Integration

Proofreading should be the first consumer.

### Extraction

- Before a proofreading run builds artifacts, call `TableEvidenceCenter.getOrCreateSnapshot({ manuscriptId, assetId })`.
- Reuse an existing snapshot when `docxHash + parserVersion` matches.
- If snapshot status is `failed` or `unsupported`, do not block whole-manuscript proofreading. Table-specific passes become manual-review only.

### Deep Table Slices

Replace table slice flattening with structured table context.

`sliceContext` should include:

- `tableEvidenceSnapshotId`
- `tableId`
- `aiReadableTablePayload`
- `losslessCharacterEvidenceSummary`
- `fidelityReport`

The slice `text` may remain as a short fallback summary, but must not be the only table input.

### Deterministic Checks

The deterministic table layer should consume table evidence and check:

- Body-table numeric conflicts.
- P value and statistical expression conflicts.
- Unit and percentage conflicts.
- `hyphen`, `en dash`, `em dash`, and `minus sign` mixing.
- Half-width spaces, full-width spaces, NBSP, tab, and line break anomalies.
- Italic variables and superscript/subscript evidence.
- Low-confidence or unsupported native table features.

All output remains candidate issues or manual review items.

### AI Contract

AI must:

- Read `aiReadableTablePayload`, not raw OOXML.
- Anchor issues to `tableId`, `cellId`, and character ranges when possible.
- Avoid automatic medical data correction.
- Use `verify_fact` or `explain_only` for uncertain or medical-statistical findings.

## 7. UI and OnlyOffice

The proofreading draft experience must show table evidence, not just a plain report.

Required UI behavior:

- Add a table evidence panel for proofreading issues.
- Show original cell text, visible special-character markers, style spans, and AI explanation.
- Show whether the table snapshot is `complete`, `partial`, `unsupported`, or `failed`.
- OnlyOffice should open the original DOCX or annotated DOCX for table review, not a text-only report when the user needs to inspect tables.
- Table findings should become comments or review cards by default.

## 8. Patch and Safety Strategy

Default mode is `comment_only`.

A table patch is allowed only after human confirmation and only for low-risk formatting changes unless a future policy explicitly expands this.

Every patch must include:

- `snapshotId`
- `tableId`
- `cellId`
- `tcPath`
- `runPath`
- `charRange`
- `beforeText`
- `afterText`
- `sourceHash`

Patch application must:

1. Reload the current DOCX.
2. Verify table, cell, and run hashes.
3. Reject the patch if hashes or ranges drifted.
4. Apply a minimal edit to the target run or character range.
5. Re-extract table evidence.
6. Verify non-target table XML, non-target cell XML, topology, and style spans remain unchanged.
7. Block output and route to manual review if drift is detected.

Medical statistics and data changes remain comment-only by default.

## 9. Testing and Acceptance

### P0 Lossless Extraction

For each native DOCX table:

- Reproducible table OOXML hash.
- Reproducible cell OOXML hash.
- Run order, run text, and run style preserved.
- Half-width space, full-width space, NBSP, tab, and line break preserved.
- `-`, `–`, `—`, and `−` distinguished.
- `±`, `χ²`, `P<0.05`, italic variables, superscripts, and subscripts anchored.
- Merged cells, borders, width, alignment, and shading captured.
- Missing required facts prevent `complete` status.

### P1 AI Payload

AI payload must let the model determine:

- Table dimensions.
- Original text of each cell.
- Special characters and their locations.
- Space types and invisible characters.
- Italic, superscript, and subscript spans.
- Merged cells and headers.

### P2 Proofreading Flow

Test manuscripts must contain:

- Body-table numeric mismatch.
- Table-internal P value expression conflict.
- Dash/minus/hyphen mixing.
- Full-width spaces and NBSP.
- Missing italic variable styling.
- Superscript/subscript issues.

Expected behavior:

- Deterministic checks produce anchored findings.
- AI explains table problems from structured evidence.
- UI shows table evidence cards.
- OnlyOffice review can inspect the original or annotated DOCX table.
- No table content changes before human confirmation.

### P3 Patch Safety

For a confirmed low-risk formatting patch:

- Target character changes.
- Non-target table XML hash remains unchanged.
- Non-target cell XML hash remains unchanged.
- Topology remains unchanged.
- Style spans remain unchanged outside the target range.
- Any drift blocks output.

### Required fixtures

At minimum:

1. Basic three-line table.
2. Multi-level header table.
3. Merged-cell table.
4. Table with notes.
5. Table with half-width, full-width, and NBSP spaces.
6. Table with hyphen, en dash, em dash, and minus sign.
7. Table with italic and superscript/subscript variables.
8. Table with Greek letters and statistical symbols.
9. Table with embedded object inside a cell.
10. Complex border, width, alignment, and shading table.

## 10. Implementation Phases

### Phase 1: TableEvidenceCenter base

- Add service, contracts, and snapshot API.
- Implement `getOrCreateSnapshot`.
- Add cache/persistence keyed by `docxHash + parserVersion`.
- Native DOCX tables only.

### Phase 2: Lossless extraction

- Extract raw table, row, cell, paragraph, and run XML.
- Build stable paths and hashes.
- Preserve character-level evidence without normalization.
- Generate AI payload.
- Add P0/P1 tests.

### Phase 3: Proofreading table slices

- Inject table evidence into proofreading artifacts.
- Update deep proofreading table slices to include `aiReadableTablePayload`.
- Update AI prompt contract to anchor table findings.

### Phase 4: Deterministic table checks

- Upgrade checks to consume lossless evidence.
- Add special-character, spacing, typography, statistic, and body-table consistency checks.

### Phase 5: UI and OnlyOffice evidence review

- Add proofreading table evidence panel.
- Ensure table review opens original or annotated DOCX, not only text report.
- Add review cards with anchors and evidence.

### Phase 6: Minimal patch guard

- Implement human-confirmed low-risk patch path.
- Add hash and topology drift checks.
- Keep medical data changes comment-only.

## 11. Risks and Controls

1. Payload size risk
   - Control: keep authority evidence stored server-side; send budgeted AI payloads only.

2. False `complete` status risk
   - Control: strict validator and required fact groups.

3. XML path instability risk
   - Control: path + hash + ordinal anchors; reject patch on drift.

4. AI overreach risk
   - Control: prompt contract and backend policy force candidate-only output for table data.

5. Existing pipeline breakage risk
   - Control: add TableEvidenceCenter as a parallel service first; do not remove existing `DocumentStructureTableSnapshot`.

6. UI ambiguity risk
   - Control: table issue cards show concrete cell evidence and confidence state.

## 12. Decisions

Resolved:

- Use方案 3: independent TableEvidenceCenter.
- Scope begins with proofreading but architecture supports all three modules.
- Native DOCX tables only in phase 1.
- Use option C for fidelity: OOXML authority + character evidence + AI payload.
- Default output is candidate/comment-only.
- Runtime evidence uses hybrid storage: metadata/status/hash summaries in repository records, large authority XML and character evidence in immutable evidence assets.
- The proofreading table evidence panel lives in the manuscript workbench proofing review area, not in the knowledge-base table evidence workspace.
- Active table patching does not ship in the first implementation wave; behavior remains comment-only, with patch planning deferred or disabled behind policy.

## 13. Subagent Review Addendum

A read-only subagent feasibility review found the design is implementable, but not as a direct reuse of the existing knowledge-base `table-evidence` module. The final plan must explicitly separate runtime manuscript evidence from curated knowledge evidence.

### Boundary clarification

There are two table-evidence concepts and they must not be merged:

1. Runtime manuscript table evidence
   - Owned by the new `TableEvidenceCenter` in `document-pipeline`.
   - Generated from manuscript assets during module runs.
   - Keyed by `assetId + docxHash + parserVersion`.
   - Status means extraction fidelity: `complete | partial | unsupported | failed`.
   - Consumers: proofreading first, editing and screening later.

2. Curated knowledge/rule table evidence
   - Existing `apps/api/src/modules/table-evidence` and knowledge full-fidelity snapshot flow.
   - Used for knowledge-base/rule-center evidence confirmation and binding.
   - Status means human confirmation workflow, e.g. `pending | confirmed | needs_review`.
   - Must not be replaced or broken by runtime snapshots.

A bridge may be added later to import runtime evidence into knowledge review, but it must be explicit and human-reviewed.

### Required design corrections

- Add new runtime fidelity contracts instead of reusing existing `packages/contracts/src/table-evidence.ts` statuses.
- Add a repository/cache for runtime snapshots; the existing knowledge table evidence DB does not provide `getOrCreateSnapshot({ manuscriptId, assetId })`.
- Extend worker extraction to include table-level XML and path/hash anchors, not just cell-level `raw_xml_text`.
- Add actual `rawTblXml`, `ooxmlHash`, `tcHash`, `bodyPath`, `tcPath`, `runPath`, `charRange`, `unicodeName`, `charClass`, and `sourceRunId` fields.
- Keep `table_full_fidelity_snapshot` compatibility for knowledge-base consumers, but do not make it the runtime authority object.
- Add a proofreading evidence panel; existing `TableEvidenceWorkspace` is for knowledge evidence review and should only be reused selectively.
- OnlyOffice integration must define table issue navigation as best-effort: open original/annotated DOCX and show side-panel evidence anchors, not rely on impossible direct cell selection unless available.

### Revised phase model

Phase 0 is mandatory before implementation:

- Define runtime vs curated evidence boundaries.
- Define contracts and storage strategy.
- Decide whether large authority XML lives in DB JSON, file storage, or hybrid storage.
- Keep patch guard behind a disabled or comment-only policy in the first implementation wave.

## 14. Final Decisions Before Implementation

These decisions close the earlier open items:

1. Persistence strategy
   - Use hybrid storage.
   - Store snapshot metadata, status, hashes, table IDs, and warning summaries in DB or repository records.
   - Store large `rawTblXml` and detailed character evidence as JSON assets under document asset storage or a sibling evidence storage area.
   - Rationale: avoids bloating DB rows and keeps authority payload immutable and exportable.

2. UI placement
   - Add a proofreading-specific table evidence panel inside the manuscript workbench proofing review area.
   - Do not replace the knowledge-base `TableEvidenceWorkspace`.
   - Reuse display components only if they are generic and do not carry knowledge-review assumptions.

3. Patch guard shipping
   - Do not ship active table patching in the first implementation PR.
   - Ship `comment_only` behavior and patch-plan types/tests behind a disabled feature flag if needed.
   - Rationale: proofread table visibility and evidence correctness must pass before mutation is allowed.

4. Scope boundary
   - First implementation wave covers proofreading only.
   - Editing and screening must compile against shared contracts but should not change runtime behavior yet.

5. Fixture strategy
   - Add real DOCX fixtures for native tables.
   - XML-fragment tests are insufficient for P0.
   - Include namespace/attribute ordering, header/footer table, revision mark, nested table, large table, and asset hash drift cases.
