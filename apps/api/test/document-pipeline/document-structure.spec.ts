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
