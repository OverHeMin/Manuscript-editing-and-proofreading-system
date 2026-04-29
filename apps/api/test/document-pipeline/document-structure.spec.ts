import test from "node:test";
import assert from "node:assert/strict";
import {
  DocumentStructureService,
  type DocumentStructureWorkerAdapter,
} from "../../src/modules/document-pipeline/document-structure-service.ts";

function createStructureService(
  adapter: DocumentStructureWorkerAdapter,
): DocumentStructureService {
  return new DocumentStructureService({ adapter });
}

function fact<T>(value?: T, availability?: "authoritative" | "mixed" | "unavailable") {
  if (availability) {
    return value === undefined ? { availability } : { availability, value };
  }

  return value === undefined
    ? { availability: "unavailable" as const }
    : { availability: "authoritative" as const, value };
}

function inlineStyle(overrides: Record<string, unknown> = {}) {
  return {
    font_family: fact("宋体"),
    font_size_pt: fact(10.5),
    bold: fact(false),
    italic: fact(false),
    script_position: fact("baseline"),
    ...overrides,
  };
}

function paragraphStyle(overrides: Record<string, unknown> = {}) {
  return {
    alignment: fact("center"),
    spacing_before_pt: fact(0),
    spacing_after_pt: fact(0),
    line_spacing: fact(1),
    line_spacing_mode: fact("multiple"),
    left_indent_pt: fact(0),
    right_indent_pt: fact(0),
    first_line_indent_pt: fact(0),
    hanging_indent_pt: fact(0),
    ...overrides,
  };
}

function cellStyle(overrides: Record<string, unknown> = {}) {
  return {
    font_family: fact("宋体"),
    font_size_pt: fact(10.5),
    bold: fact(false),
    italic: fact(false),
    script_position: fact("baseline"),
    alignment: fact("center"),
    spacing_before_pt: fact(0),
    spacing_after_pt: fact(0),
    line_spacing: fact(1),
    line_spacing_mode: fact("multiple"),
    left_indent_pt: fact(0),
    right_indent_pt: fact(0),
    first_line_indent_pt: fact(0),
    hanging_indent_pt: fact(0),
    vertical_alignment: fact("center"),
    ...overrides,
  };
}

test("docx structure extraction returns ordered headings and section spans", async () => {
  const structureService = createStructureService({
    async extract() {
      return {
        status: "ready",
        parser: "python_docx",
        sections: [
          {
            order: 1,
            heading: "Title",
            level: 0,
            paragraph_index: 0,
          },
          {
            order: 2,
            heading: "Abstract",
            level: 1,
            paragraph_index: 1,
          },
          {
            order: 3,
            heading: "Methods",
            level: 1,
            paragraph_index: 4,
          },
        ],
        metadata_candidates: [
          {
            candidate_id: "funding_statement:body:p:2:基金项目：123",
            slot_key: "funding_statement",
            raw_text: "国家自然科学基金（123）",
            normalized_text: "国家自然科学基金（123）",
            source_zone: "front_matter",
            source_locator: "body:p:2",
            semantic_role: "funding_statement",
            confidence: 0.97,
            recommended_action: "auto_place_candidate",
            evidences: [
              {
                source_zone: "front_matter",
                source_locator: "body:p:2",
              },
            ],
          },
        ],
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
              text: "不同治疗组基线特征比较",
              coordinate: {
                table_id: "table-1",
                target: "table_title",
              },
            },
            caption_fields: {
              text: "表1 不同治疗组基线特征比较",
              label_text: "表1",
              title_text: "不同治疗组基线特征比较",
              paragraphs: [
                {
                  id: "table-1-caption-paragraph-0",
                  text: "表1 不同治疗组基线特征比较",
                  style: paragraphStyle(),
                  fragments: [
                    {
                      id: "table-1-caption-paragraph-0-fragment-0",
                      kind: "text",
                      text: "表1",
                      codepoints: [],
                      invisible_chars: [],
                      style: inlineStyle({ bold: fact(true) }),
                    },
                    {
                      id: "table-1-caption-paragraph-0-fragment-1",
                      kind: "text",
                      text: " 不同治疗组基线特征比较",
                      codepoints: [],
                      invisible_chars: [],
                      style: inlineStyle({ italic: fact(true) }),
                    },
                  ],
                },
              ],
            },
            note_zone: {
              text: "*P<0.05 vs control",
              line_texts: ["*P<0.05 vs control"],
              footnote_ids: ["table-1-footnote-0"],
              paragraphs: [
                {
                  id: "table-1-note-zone-paragraph-0",
                  text: "*P<0.05 vs control",
                  style: paragraphStyle({ alignment: fact("left") }),
                  fragments: [
                    {
                      id: "table-1-note-zone-paragraph-0-fragment-0",
                      kind: "text",
                      text: "*P<0.05 vs control",
                      codepoints: [],
                      invisible_chars: [],
                      style: inlineStyle({ italic: fact(true) }),
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
                id: "table-1-header-0",
                text: "年龄",
                row_index: 0,
                column_index: 0,
                header_path: ["年龄"],
                source_cell_id: "table-1-cell-0-0",
                coordinate: {
                  table_id: "table-1",
                  target: "header_cell",
                  header_path: ["年龄"],
                  column_key: "年龄",
                },
              },
            ],
            data_cells: [
              {
                id: "table-1-data-0-1",
                text: "α=0.05",
                row_index: 1,
                column_index: 1,
                row_key: "治疗组",
                column_key: "年龄",
                source_cell_id: "table-1-cell-1-1",
                coordinate: {
                  table_id: "table-1",
                  target: "data_cell",
                  row_key: "治疗组",
                  column_key: "年龄",
                },
              },
            ],
            footnote_items: [
              {
                id: "table-1-footnote-0",
                text: "*P<0.05 vs control",
                note_kind: "statistical_significance",
                paragraphs: [
                  {
                    id: "table-1-footnote-0-paragraph-0",
                    text: "*P<0.05 vs control",
                    style: paragraphStyle({ alignment: fact("left") }),
                    fragments: [
                      {
                        id: "table-1-footnote-0-paragraph-0-fragment-0",
                        kind: "text",
                        text: "*P<0.05 vs control",
                        codepoints: [],
                        invisible_chars: [],
                        style: inlineStyle({ italic: fact(true) }),
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
                id: "table-1-cell-0-0",
                text: "年龄",
                row_index: 0,
                column_index: 0,
                row_span: 1,
                column_span: 1,
                inferred_role: "header",
                style_evidence: cellStyle({ bold: fact(true) }),
                paragraphs: [
                  {
                    id: "table-1-cell-0-0-paragraph-0",
                    text: "年龄",
                    style: paragraphStyle(),
                    fragments: [
                      {
                        id: "table-1-cell-0-0-paragraph-0-fragment-0",
                        kind: "text",
                        text: "年龄",
                        codepoints: [],
                        invisible_chars: [],
                        style: inlineStyle({ bold: fact(true) }),
                      },
                    ],
                  },
                ],
                border_hints: {
                  bottom: true,
                },
              },
              {
                id: "table-1-cell-1-1",
                text: "α=0.05",
                row_index: 1,
                column_index: 1,
                row_span: 1,
                column_span: 1,
                inferred_role: "data",
                style_evidence: cellStyle({ italic: fact(true) }),
                paragraphs: [
                  {
                    id: "table-1-cell-1-1-paragraph-0",
                    text: "α=0.05",
                    style: paragraphStyle({ alignment: fact("right") }),
                    fragments: [
                      {
                        id: "table-1-cell-1-1-paragraph-0-fragment-0",
                        kind: "symbol",
                        text: "α",
                        codepoints: [],
                        invisible_chars: [],
                        symbol_font: "Symbol",
                        symbol_char: "03B1",
                        style: inlineStyle(),
                      },
                      {
                        id: "table-1-cell-1-1-paragraph-0-fragment-1",
                        kind: "text",
                        text: "=0.05",
                        codepoints: [],
                        invisible_chars: [],
                        style: inlineStyle({ italic: fact(true) }),
                      },
                      {
                        id: "table-1-cell-1-1-paragraph-0-fragment-2",
                        kind: "object",
                        text: "",
                        codepoints: [],
                        invisible_chars: [],
                        style: inlineStyle(),
                        object_id: "object-table-equation-1",
                        object_kind: "equation",
                        original_tag: "oMath",
                        evidence_text: "inline table equation object",
                      },
                    ],
                  },
                ],
                object_evidence: [
                  {
                    object_id: "object-table-equation-1",
                    object_kind: "equation",
                    container_kind: "table_cell",
                    source_zone: "body",
                    source_locator: "table-1:r1:c1:p0",
                    original_tag: "oMath",
                    evidence_text: "inline table equation object",
                    intended_target: "preserve_as_object",
                  },
                ],
              },
            ],
          },
        ],
        objects: [
          {
            object_id: "object-1",
            object_kind: "image",
            container_kind: "paragraph",
            source_zone: "body",
            source_locator: "body:p:6",
            original_tag: "drawing",
            relationship_id: "rId5",
            evidence_text: "卡方检验符号图片",
            intended_target: "χ²",
          },
        ],
        warnings: [],
      };
    },
  });

  const structure = await structureService.extract({
    manuscriptId: "manuscript-1",
    assetId: "asset-normalized-1",
    fileName: "normalized.docx",
  });

  assert.equal(structure.status, "ready");
  assert.equal(structure.parser, "python_docx");
  assert.deepEqual(
    structure.sections.map((section) => section.heading),
    ["Title", "Abstract", "Methods"],
  );
  assert.equal(structure.tables?.[0]?.table_id, "table-1");
  assert.equal(structure.tables?.[0]?.row_count, 2);
  assert.equal(structure.tables?.[0]?.column_count, 2);
  assert.equal(structure.tables?.[0]?.profile.header_depth, 2);
  assert.equal(structure.tables?.[0]?.table_label?.text, "表1");
  assert.equal(structure.tables?.[0]?.table_title?.coordinate.target, "table_title");
  assert.equal(structure.tables?.[0]?.caption_fields?.label_text, "表1");
  assert.equal(
    structure.tables?.[0]?.caption_fields?.paragraphs?.[0]?.fragments[0]?.style.bold.value,
    true,
  );
  assert.deepEqual(structure.tables?.[0]?.note_zone?.line_texts, ["*P<0.05 vs control"]);
  assert.equal(structure.tables?.[0]?.note_zone?.coordinate.target, "note_zone");
  assert.equal(
    structure.tables?.[0]?.note_zone?.paragraphs?.[0]?.style.alignment.value,
    "left",
  );
  assert.equal(structure.tables?.[0]?.style_profile?.has_vertical_rules, false);
  assert.equal(structure.tables?.[0]?.style_profile?.coordinate.target, "style_profile");
  assert.equal(structure.tables?.[0]?.data_cells[0]?.source_cell_id, "table-1-cell-1-1");
  assert.equal(
    structure.tables?.[0]?.footnote_items[0]?.paragraphs?.[0]?.fragments[0]?.style.italic.value,
    true,
  );
  assert.equal(structure.tables?.[0]?.grid_cells?.[1]?.style_evidence.italic.value, true);
  assert.equal(
    structure.tables?.[0]?.grid_cells?.[1]?.paragraphs[0]?.fragments[2]?.kind,
    "object",
  );
  assert.equal(
    structure.tables?.[0]?.grid_cells?.[1]?.object_evidence?.[0]?.object_kind,
    "equation",
  );
  assert.equal(
    structure.tables?.[0]?.grid_cells?.[1]?.paragraphs[0]?.fragments[0]?.kind,
    "symbol",
  );
  assert.equal(
    structure.tables?.[0]?.grid_cells?.[1]?.paragraphs[0]?.fragments[0]?.text,
    "α",
  );
  assert.equal(
    structure.tables?.[0]?.table_full_fidelity_snapshot?.mandatory_fact_authority
      .structure,
    "authoritative",
  );
  assert.equal(
    structure.tables?.[0]?.table_full_fidelity_snapshot?.mandatory_fact_authority
      .rich_content,
    "authoritative",
  );
  assert.equal(
    typeof structure.tables?.[0]?.table_full_fidelity_snapshot?.facts.object_content,
    "object",
  );
  assert.deepEqual(
    (
      structure.tables?.[0]?.table_full_fidelity_snapshot?.facts.object_content as {
        table_internal_objects?: Array<{ object_id: string; cell_id: string }>;
      }
    ).table_internal_objects,
    [
      {
        object_id: "object-table-equation-1",
        object_kind: "equation",
        container_kind: "table_cell",
        source_zone: "body",
        source_locator: "table-1:r1:c1:p0",
        original_tag: "oMath",
        evidence_text: "inline table equation object",
        intended_target: "preserve_as_object",
        cell_id: "table-1-cell-1-1",
      },
    ],
  );
  assert.deepEqual(structure.tables?.[0]?.unsupported_fact_groups, []);
  assert.deepEqual(structure.objects, [
    {
      object_id: "object-1",
      object_kind: "image",
      container_kind: "paragraph",
      source_zone: "body",
      source_locator: "body:p:6",
      original_tag: "drawing",
      relationship_id: "rId5",
      evidence_text: "卡方检验符号图片",
      intended_target: "χ²",
    },
  ]);
  assert.equal(structure.metadata_candidates[0]?.slot_key, "funding_statement");
  assert.equal(structure.metadata_candidates[0]?.source_zone, "front_matter");
});

test("docx structure extraction marks malformed files for manual review", async () => {
  const structureService = createStructureService({
    async extract() {
      return {
        status: "needs_manual_review",
        parser: "python_docx",
        sections: [],
        metadata_candidates: [],
        tables: [],
        warnings: ["No title or heading styles were detected in the document."],
      };
    },
  });

  const structure = await structureService.extract({
    manuscriptId: "manuscript-2",
    assetId: "asset-normalized-2",
    fileName: "normalized.docx",
  });

  assert.equal(structure.status, "needs_manual_review");
  assert.deepEqual(structure.sections, []);
  assert.deepEqual(structure.metadata_candidates, []);
  assert.deepEqual(structure.tables, []);
  assert.deepEqual(structure.warnings, [
    "No title or heading styles were detected in the document.",
  ]);
});

test("docx structure extraction marks incomplete runtime table facts instead of guessing", async () => {
  const structureService = createStructureService({
    async extract() {
      return {
        status: "ready",
        parser: "python_docx",
        sections: [],
        metadata_candidates: [],
        tables: [
          {
            table_id: "table-incomplete",
            profile: {
              is_three_line_table: false,
              header_depth: 0,
              has_stub_column: false,
              has_statistical_footnotes: false,
              has_unit_markers: false,
            },
            header_cells: [],
            data_cells: [],
            footnote_items: [],
          },
        ],
        warnings: [],
      };
    },
  });

  const structure = await structureService.extract({
    manuscriptId: "manuscript-incomplete",
    assetId: "asset-incomplete",
    fileName: "incomplete.docx",
  });

  assert.equal(
    structure.tables[0]?.table_full_fidelity_snapshot?.mandatory_fact_authority
      .structure,
    "unavailable",
  );
  assert.equal(
    structure.tables[0]?.table_full_fidelity_snapshot?.mandatory_fact_authority
      .border_system,
    "unavailable",
  );
  assert.deepEqual(structure.tables[0]?.unsupported_fact_groups, [
    "identity",
    "structure",
    "border_system",
    "layout",
    "paragraph_style",
    "typography",
    "rich_content",
    "object_content",
  ]);
});

test("docx structure extraction preserves fallback-recovered numbered sections", async () => {
  const structureService = createStructureService({
    async extract() {
      return {
        status: "ready",
        parser: "python_docx",
        sections: [
          {
            order: 1,
            heading: "1 资料与方法",
            level: 1,
            paragraph_index: 8,
          },
          {
            order: 2,
            heading: "1.1 一般资料",
            level: 2,
            paragraph_index: 9,
          },
          {
            order: 3,
            heading: "2 结果",
            level: 1,
            paragraph_index: 15,
          },
        ],
        metadata_candidates: [],
        tables: [],
        warnings: ["No title or heading styles were detected in the document."],
      };
    },
  });

  const structure = await structureService.extract({
    manuscriptId: "manuscript-3",
    assetId: "asset-normalized-3",
    fileName: "numbered-sections.docx",
  });

  assert.deepEqual(
    structure.sections.map((section) => section.heading),
    ["1 资料与方法", "1.1 一般资料", "2 结果"],
  );
  assert.deepEqual(
    structure.sections.map((section) => section.level),
    [1, 2, 1],
  );
});
