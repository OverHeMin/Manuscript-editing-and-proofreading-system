import test from "node:test";
import assert from "node:assert/strict";
import { analyzeProofreadingDocumentSemantics } from "../../src/modules/proofreading/document-semantic-pre-analyzer.ts";
import { buildGlobalFactLedger } from "../../src/modules/proofreading/global-fact-ledger.ts";
import type { DocumentStructureTableSnapshot } from "../../src/modules/document-pipeline/document-structure-service.ts";

test("global fact ledger links text and table facts and marks high-confidence numeric conflicts", () => {
  const blocks = [
    { section: "results", block_kind: "paragraph", text: "结果见表1，治疗组ALT为13.3 U/L。" },
  ];
  const tables: DocumentStructureTableSnapshot[] = [
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
      header_cells: [],
      data_cells: [
        {
          id: "table-1-data-0-1",
          text: "12.3",
          row_index: 1,
          column_index: 1,
          row_key: "ALT",
          column_key: "治疗组",
          source_cell_id: "table-1-cell-1-1",
          coordinate: {
            table_id: "table-1",
            target: "data_cell",
            row_key: "ALT",
            column_key: "治疗组",
          },
        },
      ],
      footnote_items: [],
      grid_cells: [
        {
          id: "table-1-cell-1-1",
          text: "12.3",
          display_text: "12.3",
          normalized_text: "12.3",
          row_index: 1,
          column_index: 1,
          row_span: 1,
          column_span: 1,
          inferred_role: "data",
          style_evidence: emptyStyleEvidence(),
          paragraphs: [],
        },
      ],
    },
  ];
  const semanticAnalysis = analyzeProofreadingDocumentSemantics({ blocks, tables });

  const ledger = buildGlobalFactLedger({ blocks, tables, semanticAnalysis });

  assert.equal(ledger.schema, "deep_proofreading_fact_ledger.v1");
  assert.ok(ledger.facts.some((fact) => fact.id === "fact-block-0-number-13.3"));
  assert.ok(ledger.facts.some((fact) => fact.id === "fact-table-1-table-1-cell-1-1"));
  assert.equal(ledger.conflicts.length, 1);
  assert.deepEqual(ledger.conflicts[0]?.factIds, [
    "fact-block-0-number-13.3",
    "fact-table-1-table-1-cell-1-1",
  ]);
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
