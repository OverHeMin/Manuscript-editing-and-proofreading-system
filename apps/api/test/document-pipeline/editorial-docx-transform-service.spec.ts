import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { InMemoryDocumentAssetRepository } from "../../src/modules/assets/in-memory-document-asset-repository.ts";
import { EditorialDocxTransformService } from "../../src/modules/document-pipeline/editorial-docx-transform-service.ts";

test("editorial docx transform service appends operator-facing expectations to table inspection findings", async () => {
  const rootDir = await mkdtemp(
    path.join(os.tmpdir(), "editorial-docx-transform-service-"),
  );

  try {
    const assetRepository = new InMemoryDocumentAssetRepository();
    await assetRepository.save({
      id: "asset-original-1",
      manuscript_id: "manuscript-1",
      asset_type: "original",
      status: "active",
      storage_key: "uploads/manuscript-1/original.docx",
      mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      source_module: "upload",
      created_by: "user-1",
      version_no: 1,
      is_current: true,
      file_name: "original.docx",
      created_at: "2026-04-18T10:00:00.000Z",
      updated_at: "2026-04-18T10:00:00.000Z",
    });

    const sourcePath = path.join(rootDir, "uploads", "manuscript-1", "original.docx");
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, "fixture-docx");

    const service = new EditorialDocxTransformService({
      assetRepository,
      rootDir,
      tableHitService: {
        findMatches() {
          return [
            {
              table_id: "table-1",
              semantic_target: "header_cell",
              semantic_coordinate: {
                table_id: "table-1",
                target: "header_cell",
                header_path: ["Treatment group", "n (%)"],
                column_key: "Treatment group > n (%)",
              },
              reason:
                'Matched semantic target "header_cell" in table "table-1" for header path "Treatment group > n (%)".',
            },
          ];
        },
      },
    });

    const result = await service.applyDeterministicRules({
      manuscriptId: "manuscript-1",
      sourceAssetId: "asset-original-1",
      outputStorageKey: "outputs/manuscript-1/edited.docx",
      rules: [
        {
          id: "rule-table-treatment-group",
          rule_set_id: "rule-set-1",
          order_no: 30,
          rule_object: "table",
          rule_type: "format",
          execution_mode: "inspect",
          scope: {
            sections: ["results"],
          },
          selector: {
            semantic_target: "header_cell",
            header_path_includes: ["Treatment group", "n (%)"],
          },
          trigger: {
            kind: "table_shape",
            layout: "three_line_table",
          },
          action: {
            kind: "emit_finding",
            message: "Check treatment group header formatting.",
          },
          authoring_payload: {},
          confidence_policy: "manual_only",
          severity: "warning",
          enabled: true,
        },
      ],
      tableSnapshots: [
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
    });

    assert.deepEqual(result.tableInspectionFindings, [
      {
        ruleId: "rule-table-treatment-group",
        reason:
          'Matched semantic target "header_cell" in table "table-1" for header path "Treatment group > n (%)". Check treatment group header formatting.',
        semantic_hit: {
          table_id: "table-1",
          semantic_target: "header_cell",
          header_path: ["Treatment group", "n (%)"],
          column_key: "Treatment group > n (%)",
          override_source: "base",
        },
      },
    ]);

    assert.equal(
      await readFile(
        path.join(rootDir, "outputs", "manuscript-1", "edited.docx"),
        "utf8",
      ),
      "fixture-docx",
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
