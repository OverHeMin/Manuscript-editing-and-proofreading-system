import test from "node:test";
import assert from "node:assert/strict";
import { analyzeProofreadingDocumentSemantics } from "../../src/modules/proofreading/document-semantic-pre-analyzer.ts";
import { buildGlobalFactLedger } from "../../src/modules/proofreading/global-fact-ledger.ts";
import { buildProofreadingSlices } from "../../src/modules/proofreading/proofreading-slice-builder.ts";

test("proofreading slice builder groups content by proofreading intent", () => {
  const blocks = [
    { section: "abstract", block_kind: "paragraph", text: "摘要：ALT为13.3 U/L。" },
    { section: "results", block_kind: "paragraph", text: "结果见表1，ALT为13.3 U/L。" },
    { section: "discussion", block_kind: "paragraph", text: "需进一步讨论。" },
  ];
  const tables = [
    {
      table_id: "table-1",
      row_count: 2,
      column_count: 2,
      profile: {
        is_three_line_table: true,
        header_depth: 1,
        has_stub_column: true,
        has_statistical_footnotes: false,
        has_unit_markers: true,
      },
      caption_fields: { text: "表1 ALT比较", label_text: "表1", title_text: "ALT比较" },
      note_zone: {
        text: "注：单位为U/L。",
        line_texts: ["注：单位为U/L。"],
        footnote_ids: [],
        coordinate: { table_id: "table-1", target: "note_zone" as const },
      },
      header_cells: [],
      data_cells: [],
      footnote_items: [],
      grid_cells: [],
    },
  ];
  const semanticAnalysis = analyzeProofreadingDocumentSemantics({ blocks, tables });
  const factLedger = buildGlobalFactLedger({ blocks, tables, semanticAnalysis });

  const slices = buildProofreadingSlices({ blocks, tables, semanticAnalysis, factLedger });

  const tableSlice = slices.find((slice) => slice.sliceKind === "table");
  const dataSlice = slices.find((slice) => slice.sliceKind === "data");
  const consistencySlice = slices.find((slice) => slice.sliceKind === "consistency");
  const residualSlice = slices.find((slice) => slice.sliceKind === "residual");

  assert.deepEqual(tableSlice?.tableIds, ["table-1"]);
  assert.match(tableSlice?.text ?? "", /表1 ALT比较/u);
  assert.deepEqual(dataSlice?.sourceBlockIndexes, [0, 1]);
  assert.deepEqual(consistencySlice?.sourceBlockIndexes, [0, 1]);
  assert.deepEqual(residualSlice?.sourceBlockIndexes, [2]);
});

test("proofreading table slices carry runtime table evidence payload when available", () => {
  const blocks = [
    { section: "results", block_kind: "paragraph", text: "结果见表1。" },
  ];
  const tables = [
    {
      table_id: "table-1",
      row_count: 1,
      column_count: 1,
      profile: {
        is_three_line_table: true,
        header_depth: 1,
        has_stub_column: false,
        has_statistical_footnotes: false,
        has_unit_markers: false,
      },
      caption_fields: { text: "表1 统计结果", label_text: "表1", title_text: "统计结果" },
      header_cells: [],
      data_cells: [],
      footnote_items: [],
      grid_cells: [],
    },
  ];
  const semanticAnalysis = analyzeProofreadingDocumentSemantics({ blocks, tables });
  const factLedger = buildGlobalFactLedger({ blocks, tables, semanticAnalysis });

  const slices = buildProofreadingSlices({
    blocks,
    tables,
    semanticAnalysis,
    factLedger,
    tableEvidenceSnapshot: {
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
          cells: [],
          aiPayload: {
            tableId: "table-1",
            rowCount: 1,
            columnCount: 1,
            cells: [
              {
                cellId: "table-1-cell-0-0",
                rowIndex: 0,
                columnIndex: 0,
                rowSpan: 1,
                columnSpan: 1,
                text: "P−value",
                characterClasses: [
                  { index: 1, char: "−", codePoint: "U+2212", charClass: "minus" },
                ],
                styleSpans: [],
              },
            ],
            specialCharacterWarnings: ["table-1-cell-0-0:U+2212:minus"],
            lowConfidenceReasons: [],
          },
          fidelityReport: { status: "complete", warnings: [] },
        },
      ],
    },
  });

  const tableSlice = slices.find((slice) => slice.sliceKind === "table");

  assert.equal(tableSlice?.tableEvidence?.snapshotId, "snapshot-1");
  assert.equal(tableSlice?.tableEvidence?.tableId, "table-1");
  assert.equal(
    tableSlice?.tableEvidence?.aiReadableTablePayload.cells[0].cellId,
    "table-1-cell-0-0",
  );
});
