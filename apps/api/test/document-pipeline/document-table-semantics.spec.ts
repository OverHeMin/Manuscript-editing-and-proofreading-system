import test from "node:test";
import assert from "node:assert/strict";
import { createDocumentPipelineApi } from "../../src/modules/document-pipeline/document-pipeline-api.ts";
import { DocumentStructureService } from "../../src/modules/document-pipeline/document-structure-service.ts";

function fact<T>(value?: T, availability?: "authoritative" | "mixed" | "unavailable") {
  if (availability) {
    return value === undefined ? { availability } : { availability, value };
  }

  return value === undefined
    ? { availability: "unavailable" as const }
    : { availability: "authoritative" as const, value };
}

test("document pipeline api returns semantic table snapshots from the structure service", async () => {
  const structureService = new DocumentStructureService({
    adapter: {
      async extract() {
        return {
          status: "partial",
          parser: "python_docx",
          sections: [],
          tables: [
            {
              table_id: "table-1",
              row_count: 2,
              column_count: 2,
              profile: {
                is_three_line_table: true,
                header_depth: 2,
                has_stub_column: true,
                has_statistical_footnotes: true,
                has_unit_markers: true,
              },
              table_label: {
                id: "table-1-label",
                text: "表1",
                coordinate: {
                  table_id: "table-1",
                  target: "table_label",
                },
              },
              table_title: {
                id: "table-1-title",
                text: "基线特征比较",
                coordinate: {
                  table_id: "table-1",
                  target: "table_title",
                },
              },
              caption_fields: {
                text: "表1 基线特征比较",
                label_text: "表1",
                title_text: "基线特征比较",
                paragraphs: [
                  {
                    id: "table-1-caption-paragraph-0",
                    text: "表1 基线特征比较",
                    style: {
                      alignment: fact("center"),
                      spacing_before_pt: fact(0),
                      spacing_after_pt: fact(0),
                      line_spacing: fact(1),
                      line_spacing_mode: fact("multiple"),
                      left_indent_pt: fact(0),
                      right_indent_pt: fact(0),
                      first_line_indent_pt: fact(0),
                      hanging_indent_pt: fact(0),
                    },
                    fragments: [
                      {
                        id: "table-1-caption-paragraph-0-fragment-0",
                        kind: "text",
                        text: "表1 基线特征比较",
                        codepoints: [],
                        invisible_chars: [],
                        style: {
                          font_family: fact("宋体"),
                          font_size_pt: fact(12),
                          bold: fact(true),
                          italic: fact(false),
                          script_position: fact("baseline"),
                        },
                      },
                    ],
                  },
                ],
              },
              note_zone: {
                text: "*P<0.05 vs control",
                line_texts: ["*P<0.05 vs control"],
                footnote_ids: ["footnote-1"],
                paragraphs: [
                  {
                    id: "table-1-note-zone-paragraph-0",
                    text: "*P<0.05 vs control",
                    style: {
                      alignment: fact("left"),
                      spacing_before_pt: fact(0),
                      spacing_after_pt: fact(0),
                      line_spacing: fact(1),
                      line_spacing_mode: fact("multiple"),
                      left_indent_pt: fact(0),
                      right_indent_pt: fact(0),
                      first_line_indent_pt: fact(0),
                      hanging_indent_pt: fact(0),
                    },
                    fragments: [
                      {
                        id: "table-1-note-zone-paragraph-0-fragment-0",
                        kind: "text",
                        text: "*P<0.05 vs control",
                        codepoints: [],
                        invisible_chars: [],
                        style: {
                          font_family: fact("宋体"),
                          font_size_pt: fact(10.5),
                          bold: fact(false),
                          italic: fact(true),
                          script_position: fact("baseline"),
                        },
                      },
                    ],
                  },
                ],
                coordinate: {
                  table_id: "table-1",
                  target: "note_zone",
                },
              },
              style_profile: {
                has_top_rule: true,
                has_header_rule: true,
                has_bottom_rule: true,
                has_vertical_rules: false,
                coordinate: {
                  table_id: "table-1",
                  target: "style_profile",
                },
              },
              header_cells: [
                {
                  id: "header-1",
                  text: "n (%)",
                  row_index: 1,
                  column_index: 1,
                  header_path: ["治疗组", "n (%)"],
                  source_cell_id: "table-1-cell-1-1",
                  coordinate: {
                    table_id: "table-1",
                    target: "header_cell",
                    header_path: ["治疗组", "n (%)"],
                    column_key: "治疗组 > n (%)",
                  },
                },
              ],
              data_cells: [
                {
                  id: "data-1",
                  text: "α=0.05",
                  row_index: 1,
                  column_index: 1,
                  row_key: "治疗组",
                  column_key: "n (%)",
                  source_cell_id: "table-1-cell-1-1",
                  coordinate: {
                    table_id: "table-1",
                    target: "data_cell",
                    row_key: "治疗组",
                    column_key: "n (%)",
                  },
                },
              ],
              footnote_items: [
                {
                  id: "footnote-1",
                  text: "*P<0.05 vs control",
                  note_kind: "statistical_significance",
                  paragraphs: [
                    {
                      id: "footnote-1-paragraph-0",
                      text: "*P<0.05 vs control",
                      style: {
                        alignment: fact("left"),
                        spacing_before_pt: fact(0),
                        spacing_after_pt: fact(0),
                        line_spacing: fact(1),
                        line_spacing_mode: fact("multiple"),
                        left_indent_pt: fact(0),
                        right_indent_pt: fact(0),
                        first_line_indent_pt: fact(0),
                        hanging_indent_pt: fact(0),
                      },
                      fragments: [
                        {
                          id: "footnote-1-paragraph-0-fragment-0",
                          kind: "text",
                          text: "*P<0.05 vs control",
                          codepoints: [],
                          invisible_chars: [],
                          style: {
                            font_family: fact("宋体"),
                            font_size_pt: fact(10.5),
                            bold: fact(false),
                            italic: fact(true),
                            script_position: fact("baseline"),
                          },
                        },
                      ],
                    },
                  ],
                  coordinate: {
                    table_id: "table-1",
                    target: "footnote_item",
                    footnote_anchor: "*",
                  },
                },
              ],
              grid_cells: [
                {
                  id: "table-1-cell-1-1",
                  text: "α=0.05",
                  row_index: 1,
                  column_index: 1,
                  row_span: 1,
                  column_span: 1,
                  inferred_role: "data",
                  style_evidence: {
                    font_family: fact("Times New Roman"),
                    font_size_pt: fact(10.5),
                    bold: fact(false),
                    italic: fact(true),
                    script_position: fact("baseline"),
                    alignment: fact("right"),
                    spacing_before_pt: fact(0),
                    spacing_after_pt: fact(0),
                    line_spacing: fact(1),
                    line_spacing_mode: fact("multiple"),
                    left_indent_pt: fact(0),
                    right_indent_pt: fact(0),
                    first_line_indent_pt: fact(0),
                    hanging_indent_pt: fact(0),
                    vertical_alignment: fact("center"),
                  },
                  paragraphs: [
                    {
                      id: "table-1-cell-1-1-paragraph-0",
                      text: "α=0.05",
                      style: {
                        alignment: fact("right"),
                        spacing_before_pt: fact(0),
                        spacing_after_pt: fact(0),
                        line_spacing: fact(1),
                        line_spacing_mode: fact("multiple"),
                        left_indent_pt: fact(0),
                        right_indent_pt: fact(0),
                        first_line_indent_pt: fact(0),
                        hanging_indent_pt: fact(0),
                      },
                      fragments: [
                        {
                          id: "table-1-cell-1-1-paragraph-0-fragment-0",
                          kind: "symbol",
                          text: "α",
                          codepoints: [],
                          invisible_chars: [],
                          symbol_font: "Symbol",
                          symbol_char: "03B1",
                          style: {
                            font_family: fact("Symbol"),
                            font_size_pt: fact(10.5),
                            bold: fact(false),
                            italic: fact(false),
                            script_position: fact("baseline"),
                          },
                        },
                        {
                          id: "table-1-cell-1-1-paragraph-0-fragment-1",
                          kind: "text",
                          text: "=0.05",
                          codepoints: [],
                          invisible_chars: [],
                          style: {
                            font_family: fact("Times New Roman"),
                            font_size_pt: fact(10.5),
                            bold: fact(false),
                            italic: fact(true),
                            script_position: fact("baseline"),
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
          warnings: ["table semantics are partial"],
        };
      },
    },
  });
  const documentPipelineApi = createDocumentPipelineApi({
    workflowService: {
      async normalize() {
        throw new Error("not used in this test");
      },
    } as never,
    structureService,
  });

  const response = await documentPipelineApi.extractStructure({
    manuscriptId: "manuscript-1",
    assetId: "asset-normalized-1",
    fileName: "normalized.docx",
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "partial");
  assert.equal(response.body.tables?.[0]?.table_id, "table-1");
  assert.equal(response.body.tables?.[0]?.row_count, 2);
  assert.equal(response.body.tables?.[0]?.column_count, 2);
  assert.equal(response.body.tables?.[0]?.table_label?.coordinate.target, "table_label");
  assert.equal(response.body.tables?.[0]?.table_title?.text, "基线特征比较");
  assert.equal(response.body.tables?.[0]?.caption_fields?.title_text, "基线特征比较");
  assert.equal(
    response.body.tables?.[0]?.caption_fields?.paragraphs?.[0]?.fragments[0]?.style.bold.value,
    true,
  );
  assert.deepEqual(response.body.tables?.[0]?.note_zone?.footnote_ids, ["footnote-1"]);
  assert.equal(response.body.tables?.[0]?.note_zone?.coordinate.target, "note_zone");
  assert.equal(
    response.body.tables?.[0]?.note_zone?.paragraphs?.[0]?.style.alignment.value,
    "left",
  );
  assert.equal(response.body.tables?.[0]?.style_profile?.has_header_rule, true);
  assert.equal(response.body.tables?.[0]?.style_profile?.coordinate.target, "style_profile");
  assert.equal(response.body.tables?.[0]?.header_cells[0]?.coordinate.column_key, "治疗组 > n (%)");
  assert.equal(response.body.tables?.[0]?.data_cells[0]?.source_cell_id, "table-1-cell-1-1");
  assert.equal(
    response.body.tables?.[0]?.footnote_items[0]?.paragraphs?.[0]?.fragments[0]?.style.italic.value,
    true,
  );
  assert.equal(
    response.body.tables?.[0]?.grid_cells?.[0]?.style_evidence.font_family.value,
    "Times New Roman",
  );
  assert.equal(
    response.body.tables?.[0]?.grid_cells?.[0]?.paragraphs[0]?.fragments[0]?.kind,
    "symbol",
  );
  assert.deepEqual(response.body.warnings, ["table semantics are partial"]);
});
