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
        tables: [
          {
            table_id: "table-1",
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
            },
            note_zone: {
              text: "*P<0.05 vs control",
              line_texts: ["*P<0.05 vs control"],
              footnote_ids: ["table-1-footnote-0"],
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
  assert.equal(structure.tables?.[0]?.profile.header_depth, 2);
  assert.equal(structure.tables?.[0]?.table_label?.text, "表1");
  assert.equal(structure.tables?.[0]?.table_title?.coordinate.target, "table_title");
  assert.equal(structure.tables?.[0]?.caption_fields?.label_text, "表1");
  assert.deepEqual(structure.tables?.[0]?.note_zone?.line_texts, ["*P<0.05 vs control"]);
  assert.equal(structure.tables?.[0]?.note_zone?.coordinate.target, "note_zone");
  assert.equal(structure.tables?.[0]?.style_profile?.has_vertical_rules, false);
  assert.equal(structure.tables?.[0]?.style_profile?.coordinate.target, "style_profile");
});

test("docx structure extraction marks malformed files for manual review", async () => {
  const structureService = createStructureService({
    async extract() {
      return {
        status: "needs_manual_review",
        parser: "python_docx",
        sections: [],
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
  assert.deepEqual(structure.tables, []);
  assert.deepEqual(structure.warnings, [
    "No title or heading styles were detected in the document.",
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
