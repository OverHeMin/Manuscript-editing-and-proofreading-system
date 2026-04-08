import test from "node:test";
import assert from "node:assert/strict";
import { createDocumentPipelineApi } from "../../src/modules/document-pipeline/document-pipeline-api.ts";
import { DocumentStructureService } from "../../src/modules/document-pipeline/document-structure-service.ts";

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
              profile: {
                is_three_line_table: true,
                header_depth: 2,
                has_stub_column: true,
                has_statistical_footnotes: true,
                has_unit_markers: true,
              },
              header_cells: [
                {
                  id: "header-1",
                  text: "n (%)",
                  row_index: 1,
                  column_index: 1,
                  header_path: ["治疗组", "n (%)"],
                  coordinate: {
                    table_id: "table-1",
                    target: "header_cell",
                    header_path: ["治疗组", "n (%)"],
                    column_key: "治疗组 > n (%)",
                  },
                },
              ],
              data_cells: [],
              footnote_items: [],
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
  assert.equal(response.body.tables?.[0]?.header_cells[0]?.coordinate.column_key, "治疗组 > n (%)");
  assert.deepEqual(response.body.warnings, ["table semantics are partial"]);
});
