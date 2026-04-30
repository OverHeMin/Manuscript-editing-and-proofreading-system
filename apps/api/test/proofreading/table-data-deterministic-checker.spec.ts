import test from "node:test";
import assert from "node:assert/strict";
import { runTableDataDeterministicChecks } from "../../src/modules/proofreading/table-data-deterministic-checker.ts";
import type { DeepProofreadingFactLedger } from "../../src/modules/proofreading/deep-proofreading-contracts.ts";
import type { DocumentStructureTableSnapshot } from "../../src/modules/document-pipeline/document-structure-service.ts";
import type { TableEvidenceSnapshot } from "../../src/modules/document-pipeline/table-evidence-record.ts";

test("deterministic checker turns ledger conflicts into table anchored verify-fact issue cards", () => {
  const ledger: DeepProofreadingFactLedger = {
    schema: "deep_proofreading_fact_ledger.v1",
    facts: [
      {
        id: "fact-block-0-number-13.3",
        kind: "block_numeric_value",
        label: "ALT",
        value: "13.3",
        normalizedValue: "13.3",
        confidence: "high",
        source: { sourceKind: "block", blockIndex: 0, quote: "ALT为13.3 U/L" },
      },
      {
        id: "fact-table-1-table-1-cell-1-1",
        kind: "table_cell_value",
        label: "ALT",
        value: "12.3",
        normalizedValue: "12.3",
        confidence: "high",
        source: {
          sourceKind: "table_cell",
          tableId: "table-1",
          anchorKey: "table-1:table-1-cell-1-1",
          quote: "12.3  ±  1.4",
        },
      },
    ],
    conflicts: [
      {
        id: "conflict-1",
        factIds: ["fact-block-0-number-13.3", "fact-table-1-table-1-cell-1-1"],
        kind: "numeric_value_mismatch",
        description: "文本数值 13.3 与表格数值 12.3 不一致。",
        confidence: "high",
      },
    ],
    diagnostics: { factCount: 2, conflictCount: 1 },
  };
  const tables: DocumentStructureTableSnapshot[] = [
    {
      table_id: "table-1",
      profile: {
        is_three_line_table: true,
        header_depth: 1,
        has_stub_column: true,
        has_statistical_footnotes: false,
        has_unit_markers: true,
      },
      header_cells: [],
      data_cells: [],
      footnote_items: [],
      grid_cells: [
        {
          id: "table-1-cell-1-1",
          text: "12.3",
          display_text: "12.3  ±  1.4",
          normalized_text: "12.3±1.4",
          row_index: 1,
          column_index: 1,
          row_span: 1,
          column_span: 1,
          inferred_role: "data",
          style_evidence: emptyStyleEvidence(),
          style_runs: [
            { text: "P", kind: "text", italic: true, script_position: "baseline" },
            { text: "2", kind: "text", script_position: "superscript" },
          ],
          paragraphs: [],
        },
      ],
    },
  ];

  const issues = runTableDataDeterministicChecks({ factLedger: ledger, tables });

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.source, "deterministic_check");
  assert.equal(issues[0]?.suggestion?.action, "verify_fact");
  assert.equal(issues[0]?.anchor.documentLocator?.anchorKind, "table_cell");
  assert.equal(issues[0]?.anchor.quote, "12.3  ±  1.4");
  assert.deepEqual(issues[0]?.relatedFactIds, [
    "fact-block-0-number-13.3",
    "fact-table-1-table-1-cell-1-1",
  ]);
  assert.ok(
    issues[0]?.supportingEvidence.some(
      (entry) => entry.kind === "table_cell" && entry.label === "italic:P",
    ),
  );
});

test("deterministic checker surfaces high-risk lossless table character evidence", () => {
  const ledger: DeepProofreadingFactLedger = {
    schema: "deep_proofreading_fact_ledger.v1",
    facts: [],
    conflicts: [],
    diagnostics: { factCount: 0, conflictCount: 0 },
  };
  const tableEvidenceSnapshot: TableEvidenceSnapshot = {
    snapshotId: "snapshot-1",
    manuscriptId: "manuscript-1",
    assetId: "asset-1",
    sourceStorageKey: "uploads/source.docx",
    docxHash: "hash",
    parserVersion: "lossless-v1",
    createdAt: "2026-04-30T00:00:00.000Z",
    status: "complete",
    warnings: [],
    tables: [
      {
        tableId: "table-1",
        ordinal: 1,
        bodyPath: "word/document.xml/body/tbl[1]",
        ooxmlHash: "table-hash",
        rowCount: 1,
        columnCount: 1,
        cells: [
          {
            cellId: "table-1-cell-0-0",
            rowIndex: 0,
            columnIndex: 0,
            rowSpan: 1,
            columnSpan: 1,
            tcPath: "word/document.xml/body/tbl[1]/tr[1]/tc[1]",
            rawTcXml: "<w:tc/>",
            tcHash: "cell-hash",
            text: "P\u00a0−value",
            paragraphs: [],
            runs: [],
            characters: [
              {
                index: 1,
                char: "\u00a0",
                codePoint: "U+00A0",
                unicodeName: "NO-BREAK SPACE",
                charClass: "nbsp",
                sourceRunId: "run-1",
                preserved: true,
                visible: true,
              },
              {
                index: 2,
                char: "−",
                codePoint: "U+2212",
                unicodeName: "MINUS SIGN",
                charClass: "minus",
                sourceRunId: "run-1",
                preserved: true,
                visible: true,
              },
            ],
            styleSpans: [{ runId: "run-1", startIndex: 0, endIndex: 1, italic: true }],
          },
        ],
        aiPayload: {
          tableId: "table-1",
          rowCount: 1,
          columnCount: 1,
          cells: [],
          specialCharacterWarnings: [],
          lowConfidenceReasons: [],
        },
        fidelityReport: { status: "complete", warnings: [] },
      },
    ],
  };

  const issues = runTableDataDeterministicChecks({
    factLedger: ledger,
    tableEvidenceSnapshot,
  });

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.issueType, "medical_data_consistency.lossless_character_review");
  assert.equal(issues[0]?.anchor.documentLocator?.anchorKind, "table_cell");
  assert.equal(issues[0]?.anchor.documentLocator?.tableId, "table-1");
  assert.match(issues[0]?.description ?? "", /U\+00A0/u);
  assert.match(issues[0]?.description ?? "", /U\+2212/u);
  assert.ok(
    issues[0]?.supportingEvidence.some(
      (entry) => entry.label === "italic:run-1:0-1",
    ),
  );
});

test("deterministic checker does not flag plain table style spans without high-risk evidence", () => {
  const ledger: DeepProofreadingFactLedger = {
    schema: "deep_proofreading_fact_ledger.v1",
    facts: [],
    conflicts: [],
    diagnostics: { factCount: 0, conflictCount: 0 },
  };
  const tableEvidenceSnapshot: TableEvidenceSnapshot = {
    snapshotId: "snapshot-plain",
    manuscriptId: "manuscript-1",
    assetId: "asset-1",
    sourceStorageKey: "uploads/source.docx",
    docxHash: "hash",
    parserVersion: "lossless-v1",
    createdAt: "2026-04-30T00:00:00.000Z",
    status: "complete",
    warnings: [],
    tables: [
      {
        tableId: "table-1",
        ordinal: 1,
        bodyPath: "word/document.xml/body/tbl[1]",
        ooxmlHash: "table-hash",
        rowCount: 1,
        columnCount: 1,
        cells: [
          {
            cellId: "table-1-cell-0-0",
            rowIndex: 0,
            columnIndex: 0,
            rowSpan: 1,
            columnSpan: 1,
            tcPath: "word/document.xml/body/tbl[1]/tr[1]/tc[1]",
            rawTcXml: "<w:tc/>",
            tcHash: "cell-hash",
            text: "18.2",
            paragraphs: [],
            runs: [],
            characters: [
              {
                index: 0,
                char: "1",
                codePoint: "U+0031",
                charClass: "normal",
                sourceRunId: "run-plain",
                preserved: true,
                visible: true,
              },
            ],
            styleSpans: [{ runId: "run-plain", startIndex: 0, endIndex: 4 }],
          },
        ],
        aiPayload: {
          tableId: "table-1",
          rowCount: 1,
          columnCount: 1,
          cells: [],
          specialCharacterWarnings: [],
          lowConfidenceReasons: [],
        },
        fidelityReport: { status: "complete", warnings: [] },
      },
    ],
  };

  const issues = runTableDataDeterministicChecks({
    factLedger: ledger,
    tableEvidenceSnapshot,
  });

  assert.equal(issues.length, 0);
});

function emptyStyleEvidence() {
  const unavailable = { availability: "unavailable" as const };
  return {
    font_family: unavailable,
    font_size_pt: unavailable,
    bold: unavailable,
    italic: unavailable,
    script_position: unavailable,
    alignment: unavailable,
    spacing_before_pt: unavailable,
    spacing_after_pt: unavailable,
    line_spacing: unavailable,
    line_spacing_mode: unavailable,
    left_indent_pt: unavailable,
    right_indent_pt: unavailable,
    first_line_indent_pt: unavailable,
    hanging_indent_pt: unavailable,
    vertical_alignment: unavailable,
  };
}
