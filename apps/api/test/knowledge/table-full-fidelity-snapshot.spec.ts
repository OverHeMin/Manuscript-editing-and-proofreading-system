import test from "node:test";
import assert from "node:assert/strict";
import type { DocumentStructureTableSnapshot } from "../../src/modules/document-pipeline/document-structure-service.ts";
import { buildTableFullFidelitySnapshotFromDocumentTable } from "../../src/modules/knowledge/table-full-fidelity-snapshot.ts";

const authoritativeString = { availability: "authoritative" as const, value: "宋体" };
const authoritativeNumber = { availability: "authoritative" as const, value: 10.5 };
const authoritativeBoolean = { availability: "authoritative" as const, value: true };

function buildSupportedMedicalTable(): DocumentStructureTableSnapshot {
  return {
    table_id: "table-1",
    row_count: 2,
    column_count: 2,
    profile: {
      is_three_line_table: true,
      header_depth: 1,
      has_stub_column: true,
      has_statistical_footnotes: true,
      has_unit_markers: true,
      has_merged_headers: false,
    },
    table_label: {
      id: "label-1",
      text: "表 1",
      coordinate: { table_id: "table-1", target: "table_label" },
    },
    table_title: {
      id: "title-1",
      text: "基线特征",
      coordinate: { table_id: "table-1", target: "table_title" },
    },
    caption_fields: {
      text: "表 1 基线特征",
      label_text: "表 1",
      title_text: "基线特征",
    },
    note_zone: {
      text: "注：年龄单位为岁。",
      line_texts: ["注：年龄单位为岁。"],
      footnote_ids: ["note-1"],
      coordinate: { table_id: "table-1", target: "note_zone" },
    },
    style_profile: {
      has_top_rule: true,
      has_header_rule: true,
      has_bottom_rule: true,
      has_vertical_rules: false,
      coordinate: { table_id: "table-1", target: "style_profile" },
    },
    header_cells: [
      {
        id: "header-1",
        text: "指标",
        row_index: 0,
        column_index: 0,
        header_path: ["指标"],
        coordinate: { table_id: "table-1", target: "header_cell" },
      },
    ],
    data_cells: [
      {
        id: "data-1",
        text: "45.0",
        row_index: 1,
        column_index: 1,
        row_key: "年龄",
        column_key: "均值",
        coordinate: { table_id: "table-1", target: "data_cell" },
      },
    ],
    footnote_items: [
      {
        id: "note-1",
        text: "年龄单位为岁。",
        note_kind: "general",
        coordinate: { table_id: "table-1", target: "footnote_item" },
      },
    ],
    stub_columns: [
      {
        id: "stub-1",
        text: "年龄",
        row_key: "年龄",
        coordinate: { table_id: "table-1", target: "stub_column" },
      },
    ],
    unit_markers: [
      {
        id: "unit-1",
        text: "岁",
        source_target: "stub_column",
        coordinate: { table_id: "table-1", target: "unit_marker" },
      },
    ],
    merged_relations: [],
    grid_cells: [
      {
        id: "cell-1",
        text: "年龄",
        row_index: 1,
        column_index: 0,
        row_span: 1,
        column_span: 1,
        inferred_role: "stub",
        style_evidence: {
          font_family: authoritativeString,
          font_size_pt: authoritativeNumber,
          bold: authoritativeBoolean,
          italic: { availability: "authoritative", value: false },
          script_position: { availability: "authoritative", value: "baseline" },
          alignment: { availability: "authoritative", value: "left" },
          spacing_before_pt: { availability: "authoritative", value: 0 },
          spacing_after_pt: { availability: "authoritative", value: 0 },
          line_spacing: { availability: "authoritative", value: 1 },
          line_spacing_mode: { availability: "authoritative", value: "single" },
          left_indent_pt: { availability: "authoritative", value: 0 },
          right_indent_pt: { availability: "authoritative", value: 0 },
          first_line_indent_pt: { availability: "authoritative", value: 0 },
          hanging_indent_pt: { availability: "authoritative", value: 0 },
          vertical_alignment: { availability: "authoritative", value: "center" },
        },
        paragraphs: [
          {
            id: "p-1",
            text: "年龄",
            style: {
              alignment: { availability: "authoritative", value: "left" },
              spacing_before_pt: { availability: "authoritative", value: 0 },
              spacing_after_pt: { availability: "authoritative", value: 0 },
              line_spacing: { availability: "authoritative", value: 1 },
              line_spacing_mode: { availability: "authoritative", value: "single" },
              left_indent_pt: { availability: "authoritative", value: 0 },
              right_indent_pt: { availability: "authoritative", value: 0 },
              first_line_indent_pt: { availability: "authoritative", value: 0 },
              hanging_indent_pt: { availability: "authoritative", value: 0 },
            },
            fragments: [
              {
                id: "frag-1",
                kind: "text",
                text: "年龄",
                style: {
                  font_family: authoritativeString,
                  font_size_pt: authoritativeNumber,
                  bold: authoritativeBoolean,
                  italic: { availability: "authoritative", value: false },
                  script_position: { availability: "authoritative", value: "baseline" },
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

test("document table snapshots normalize into V1 full-fidelity mandatory fact groups", () => {
  const snapshot = buildTableFullFidelitySnapshotFromDocumentTable(
    buildSupportedMedicalTable(),
  );

  assert.equal(snapshot.snapshot_id, "table-1-full-fidelity");
  assert.deepEqual(snapshot.mandatory_fact_authority, {
    identity: "authoritative",
    structure: "authoritative",
    border_system: "authoritative",
    layout: "authoritative",
    paragraph_style: "authoritative",
    typography: "authoritative",
    rich_content: "authoritative",
    object_content: "authoritative",
    authority_markers: "authoritative",
  });
  assert.deepEqual(
    (snapshot.facts.identity as { caption_text?: string }).caption_text,
    "表 1 基线特征",
  );
});

test("document table snapshots expose unavailable mandatory facts instead of guessing", () => {
  const table = buildSupportedMedicalTable();
  delete table.style_profile;
  table.grid_cells = [];

  const snapshot = buildTableFullFidelitySnapshotFromDocumentTable(table);

  assert.equal(snapshot.mandatory_fact_authority.border_system, "unavailable");
  assert.equal(snapshot.mandatory_fact_authority.layout, "unavailable");
  assert.equal(snapshot.mandatory_fact_authority.paragraph_style, "unavailable");
  assert.equal(snapshot.mandatory_fact_authority.typography, "unavailable");
});
