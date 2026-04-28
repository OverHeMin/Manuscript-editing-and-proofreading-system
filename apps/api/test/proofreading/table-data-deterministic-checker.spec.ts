import test from "node:test";
import assert from "node:assert/strict";
import { runTableDataDeterministicChecks } from "../../src/modules/proofreading/table-data-deterministic-checker.ts";
import type { DeepProofreadingFactLedger } from "../../src/modules/proofreading/deep-proofreading-contracts.ts";
import type { DocumentStructureTableSnapshot } from "../../src/modules/document-pipeline/document-structure-service.ts";

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
