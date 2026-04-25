import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { InMemoryDocumentAssetRepository } from "../../src/modules/assets/in-memory-document-asset-repository.ts";
import { EditorialDocxTransformService } from "../../src/modules/document-pipeline/editorial-docx-transform-service.ts";
import type {
  TableDocxPatchPlan,
  TableReconstructionOperation,
} from "../../src/modules/document-pipeline/table-docx-patch-plan.ts";

const BEFORE_HEADING = "摘要 目的";
const AFTER_HEADING = "摘要：目的";

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
      tableAutoApplyMode: "inspect_only",
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

test("editorial docx transform service returns applied rule ids and changes from the worker payload", async () => {
  const rootDir = await mkdtemp(
    path.join(os.tmpdir(), "editorial-docx-transform-worker-"),
  );

  try {
    const assetRepository = new InMemoryDocumentAssetRepository();
    await assetRepository.save({
      id: "asset-original-2",
      manuscript_id: "manuscript-2",
      asset_type: "original",
      status: "active",
      storage_key: "uploads/manuscript-2/original.docx",
      mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      source_module: "upload",
      created_by: "user-1",
      version_no: 1,
      is_current: true,
      file_name: BEFORE_HEADING,
      created_at: "2026-04-18T10:00:00.000Z",
      updated_at: "2026-04-18T10:00:00.000Z",
    });

    const service = new EditorialDocxTransformService({
      assetRepository,
      rootDir,
    });

    const input = {
      manuscriptId: "manuscript-2",
      sourceAssetId: "asset-original-2",
      outputStorageKey: "outputs/manuscript-2/edited.docx",
      tableAutoApplyMode: "editing_safe_apply" as const,
      rules: [
        {
          id: "rule-heading-1",
          rule_set_id: "rule-set-1",
          order_no: 10,
          rule_object: "generic",
          rule_type: "format",
          execution_mode: "apply_and_inspect",
          scope: {
            sections: ["abstract"],
            block_kind: "heading",
          },
          selector: {},
          trigger: {
            kind: "exact_text",
            text: BEFORE_HEADING,
          },
          action: {
            kind: "replace_heading",
            to: AFTER_HEADING,
          },
          authoring_payload: {},
          confidence_policy: "always_auto",
          severity: "warning",
          enabled: true,
        },
      ],
    } satisfies Parameters<EditorialDocxTransformService["applyDeterministicRules"]>[0];

    const result = await service.applyDeterministicRules(input);

    assert.deepEqual(result.appliedRuleIds, ["rule-heading-1"]);
    assert.equal(result.appliedChanges.length, 1);
    assert.equal(result.appliedChanges[0]?.ruleId, "rule-heading-1");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("editorial docx transform service copies the source when table planning emits only preflight skip ledgers", async () => {
  const rootDir = await mkdtemp(
    path.join(os.tmpdir(), "editorial-docx-transform-table-planner-"),
  );

  try {
    const assetRepository = new InMemoryDocumentAssetRepository();
    await assetRepository.save({
      id: "asset-original-3",
      manuscript_id: "manuscript-3",
      asset_type: "original",
      status: "active",
      storage_key: "uploads/manuscript-3/original.docx",
      mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      source_module: "upload",
      created_by: "user-1",
      version_no: 1,
      is_current: true,
      file_name: "original.docx",
      created_at: "2026-04-23T10:00:00.000Z",
      updated_at: "2026-04-23T10:00:00.000Z",
    });

    const sourcePath = path.join(rootDir, "uploads", "manuscript-3", "original.docx");
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, "fixture-docx");

    const service = new EditorialDocxTransformService({
      assetRepository,
      rootDir,
    });

    const result = await service.applyDeterministicRules({
      manuscriptId: "manuscript-3",
      sourceAssetId: "asset-original-3",
      outputStorageKey: "outputs/manuscript-3/edited.docx",
      tableAutoApplyMode: "editing_safe_apply",
      rules: [
        {
          id: "rule-header-a",
          rule_set_id: "rule-set-1",
          order_no: 10,
          rule_object: "table",
          rule_type: "format",
          execution_mode: "inspect",
          scope: {
            block_kind: "table",
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
            kind: "inspect_table_rule",
            message: "normalize header text",
          },
          authoring_payload: {
            grade: "A",
            patch_type: "replace_header_cell_text",
            apply_scope: "editing_only",
            required_snapshot_capabilities: ["caption_fields"],
          },
          confidence_policy: "manual_only",
          severity: "warning",
          enabled: true,
          example_after: "n（%）",
        },
        {
          id: "rule-header-missing-capability",
          rule_set_id: "rule-set-1",
          order_no: 20,
          rule_object: "table",
          rule_type: "format",
          execution_mode: "inspect",
          scope: {
            block_kind: "table",
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
            kind: "inspect_table_rule",
            message: "requires caption capability",
          },
          authoring_payload: {
            grade: "A",
            patch_type: "replace_header_cell_text",
            apply_scope: "editing_only",
            required_snapshot_capabilities: ["caption_fields"],
          },
          confidence_policy: "manual_only",
          severity: "warning",
          enabled: true,
          example_after: "n（%）",
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
          header_cells: [
            {
              id: "table-1-header-1",
              text: "n (%)",
              row_index: 1,
              column_index: 1,
              header_path: ["Treatment group", "n (%)"],
              coordinate: {
                table_id: "table-1",
                target: "header_cell",
                header_path: ["Treatment group", "n (%)"],
                column_key: "Treatment group > n (%)",
              },
            },
          ],
          data_cells: [],
          footnote_items: [],
        },
      ],
    });

    assert.equal(result.tablePatchPlans.length, 0);
    assert.deepEqual(
      result.tablePatchResults.map((entry) => entry.status),
      ["skipped_no_anchor", "skipped_no_anchor"],
    );
    assert.equal(
      await readFile(
        path.join(rootDir, "outputs", "manuscript-3", "edited.docx"),
        "utf8",
      ),
      "fixture-docx",
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("editorial docx transform service applies executable table patches through the worker", async () => {
  const rootDir = await mkdtemp(
    path.join(os.tmpdir(), "editorial-docx-transform-table-worker-"),
  );

  try {
    const assetRepository = new InMemoryDocumentAssetRepository();
    await assetRepository.save({
      id: "asset-original-4",
      manuscript_id: "manuscript-4",
      asset_type: "original",
      status: "active",
      storage_key: "uploads/manuscript-4/original.docx",
      mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      source_module: "upload",
      created_by: "user-1",
      version_no: 1,
      is_current: true,
      file_name: "original.docx",
      created_at: "2026-04-23T10:30:00.000Z",
      updated_at: "2026-04-23T10:30:00.000Z",
    });

    const sourcePath = path.join(rootDir, "uploads", "manuscript-4", "original.docx");
    await mkdir(path.dirname(sourcePath), { recursive: true });
    writeTableDocxFixture(sourcePath);

    const service = new EditorialDocxTransformService({
      assetRepository,
      rootDir,
    });

    const result = await service.applyDeterministicRules({
      manuscriptId: "manuscript-4",
      sourceAssetId: "asset-original-4",
      outputStorageKey: "outputs/manuscript-4/edited.docx",
      tableAutoApplyMode: "editing_safe_apply",
      rules: [
        {
          id: "rule-header-a",
          rule_set_id: "rule-set-1",
          order_no: 10,
          rule_object: "table",
          rule_type: "format",
          execution_mode: "inspect",
          scope: {
            block_kind: "table",
          },
          selector: {
            semantic_target: "header_cell",
            header_path_includes: ["Treatment group", "n"],
          },
          trigger: {
            kind: "table_shape",
            layout: "three_line_table",
          },
          action: {
            kind: "inspect_table_rule",
            message: "normalize header text",
          },
          authoring_payload: {
            grade: "A",
            patch_type: "replace_header_cell_text",
            apply_scope: "editing_only",
            required_snapshot_capabilities: ["header_cell"],
          },
          confidence_policy: "manual_only",
          severity: "warning",
          enabled: true,
          example_after: "例数",
        },
        {
          id: "rule-unit-a",
          rule_set_id: "rule-set-1",
          order_no: 20,
          rule_object: "table",
          rule_type: "format",
          execution_mode: "inspect",
          scope: {
            block_kind: "table",
          },
          selector: {
            semantic_target: "unit_marker",
            header_path_includes: ["Treatment group", "Rate (%)"],
          },
          trigger: {
            kind: "table_shape",
            layout: "three_line_table",
          },
          action: {
            kind: "inspect_table_rule",
            message: "normalize unit token",
          },
          authoring_payload: {
            grade: "A",
            patch_type: "normalize_unit_text",
            apply_scope: "editing_only",
            required_snapshot_capabilities: ["unit_marker"],
          },
          confidence_policy: "manual_only",
          severity: "warning",
          enabled: true,
          example_after: "％",
        },
        {
          id: "rule-footnote-a",
          rule_set_id: "rule-set-1",
          order_no: 30,
          rule_object: "table",
          rule_type: "format",
          execution_mode: "inspect",
          scope: {
            block_kind: "table",
          },
          selector: {
            semantic_target: "footnote_item",
            note_kind: "statistical_significance",
          },
          trigger: {
            kind: "table_shape",
            layout: "three_line_table",
          },
          action: {
            kind: "inspect_table_rule",
            message: "normalize note wording",
          },
          authoring_payload: {
            grade: "A",
            patch_type: "replace_footnote_text",
            apply_scope: "editing_only",
            required_snapshot_capabilities: ["footnote_item"],
          },
          confidence_policy: "manual_only",
          severity: "warning",
          enabled: true,
          example_after: "注：P<0.05 vs control",
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
          header_cells: [
            {
              id: "table-1-header-1",
              text: "n",
              row_index: 1,
              column_index: 1,
              header_path: ["Treatment group", "n"],
              coordinate: {
                table_id: "table-1",
                target: "header_cell",
                header_path: ["Treatment group", "n"],
                column_key: "Treatment group > n",
              },
            },
            {
              id: "table-1-header-2",
              text: "Rate (%)",
              row_index: 1,
              column_index: 2,
              header_path: ["Treatment group", "Rate (%)"],
              coordinate: {
                table_id: "table-1",
                target: "header_cell",
                header_path: ["Treatment group", "Rate (%)"],
                column_key: "Treatment group > Rate (%)",
              },
            },
          ],
          data_cells: [],
          footnote_items: [
            {
              id: "table-1-footnote-1",
              text: "*P<0.05 vs control",
              note_kind: "statistical_significance",
              marker: "*",
              coordinate: {
                table_id: "table-1",
                target: "footnote_item",
                footnote_anchor: "*",
              },
            },
          ],
          unit_markers: [
            {
              id: "table-1-unit-1",
              text: "%",
              source_target: "header_cell",
              coordinate: {
                table_id: "table-1",
                target: "unit_marker",
                header_path: ["Treatment group", "Rate (%)"],
                column_key: "Treatment group > Rate (%)",
              },
            },
          ],
        },
      ],
    });

    assert.deepEqual(
      result.tablePatchResults.map((entry) => entry.status),
      ["applied", "applied", "applied"],
    );

    const outputXml = await readDocumentXml(
      path.join(rootDir, "outputs", "manuscript-4", "edited.docx"),
    );
    assert.match(outputXml, /例数/u);
    assert.match(outputXml, /Rate \(％\)/u);
    assert.match(outputXml, /注：P&lt;0\.05 vs control/u);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("editorial docx transform service applies controlled table rebuild patches through the worker", async () => {
  const rootDir = await mkdtemp(
    path.join(os.tmpdir(), "editorial-docx-transform-table-rebuild-"),
  );

  try {
    const assetRepository = new InMemoryDocumentAssetRepository();
    await assetRepository.save({
      id: "asset-original-5",
      manuscript_id: "manuscript-5",
      asset_type: "original",
      status: "active",
      storage_key: "uploads/manuscript-5/original.docx",
      mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      source_module: "upload",
      created_by: "user-1",
      version_no: 1,
      is_current: true,
      file_name: "original.docx",
      created_at: "2026-04-24T10:30:00.000Z",
      updated_at: "2026-04-24T10:30:00.000Z",
    });

    const sourcePath = path.join(rootDir, "uploads", "manuscript-5", "original.docx");
    await mkdir(path.dirname(sourcePath), { recursive: true });
    writeAdvancedTableDocxFixture(sourcePath);

    const service = new EditorialDocxTransformService({
      assetRepository,
      rootDir,
      tablePatchPlanner: {
        plan() {
          return {
            plans: [buildControlledRebuildPlan()],
            results: [],
          };
        },
      },
    });

    const result = await service.applyDeterministicRules({
      manuscriptId: "manuscript-5",
      sourceAssetId: "asset-original-5",
      outputStorageKey: "outputs/manuscript-5/edited.docx",
      tableAutoApplyMode: "editing_safe_apply",
      rules: [],
    });

    assert.equal(result.tablePatchPlans[0]?.execution_path, "controlled_rebuild");
    assert.equal(result.tablePatchResults[0]?.execution_path, "controlled_rebuild");
    assert.equal(result.tablePatchResults[0]?.status, "applied");
    assert.equal(
      result.tablePatchResults[0]?.validation_snapshot?.status,
      "passed",
    );
    assert.equal(
      result.tablePatchResults[0]?.validation_snapshot?.checks.every(
        (check) => check.passed,
      ),
      true,
    );
    const validationReasons =
      result.tablePatchResults[0]?.validation_snapshot?.checks.map(
        (check) => check.reason,
      ) ?? [];
    assert.equal(
      validationReasons.some((reason) => /Re-parsed DOCX table/u.test(reason)),
      true,
    );
    assert.equal(
      validationReasons.some((reason) => /after DOCX re-parse/u.test(reason)),
      true,
    );
    assert.equal(
      result.tablePatchResults[0]?.validation_snapshot?.rollback_point
        .source_table_id,
      "table-1",
    );
    assert.match(
      result.tablePatchResults[0]?.validation_snapshot?.idempotence_key ?? "",
      /patch-style-rebuild/u,
    );

    const outputXml = await readDocumentXml(
      path.join(rootDir, "outputs", "manuscript-5", "edited.docx"),
    );
    assert.match(outputXml, /Table 1 /u);
    assert.match(outputXml, /Demographic characteristics/u);
    assert.match(outputXml, /Item/u);
    assert.match(outputXml, /Value/u);
    assert.match(outputXml, /Age/u);
    assert.match(outputXml, /54\.2/u);
    assert.match(outputXml, /insideV/u);
    assert.match(outputXml, /03C7/u);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("editorial docx transform service blocks controlled rebuilds without validation-ready reconstruction plans", async () => {
  const rootDir = await mkdtemp(
    path.join(os.tmpdir(), "editorial-docx-transform-service-"),
  );

  try {
    const assetRepository = new InMemoryDocumentAssetRepository();
    await assetRepository.save({
      id: "asset-original-6",
      manuscript_id: "manuscript-6",
      asset_type: "original",
      status: "active",
      storage_key: "uploads/manuscript-6/original.docx",
      mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      source_module: "upload",
      created_by: "user-1",
      version_no: 1,
      is_current: true,
      file_name: "original.docx",
      created_at: "2026-04-24T10:30:00.000Z",
      updated_at: "2026-04-24T10:30:00.000Z",
    });

    const sourcePath = path.join(rootDir, "uploads", "manuscript-6", "original.docx");
    await mkdir(path.dirname(sourcePath), { recursive: true });
    writeAdvancedTableDocxFixture(sourcePath);

    const unsafePlan = buildControlledRebuildPlan();
    delete unsafePlan.table_reconstruction_plan;
    const service = new EditorialDocxTransformService({
      assetRepository,
      rootDir,
      tablePatchPlanner: {
        plan() {
          return {
            plans: [unsafePlan],
            results: [],
          };
        },
      },
    });

    const result = await service.applyDeterministicRules({
      manuscriptId: "manuscript-6",
      sourceAssetId: "asset-original-6",
      outputStorageKey: "outputs/manuscript-6/edited.docx",
      tableAutoApplyMode: "editing_safe_apply",
      rules: [],
    });

    assert.equal(result.tablePatchResults[0]?.status, "validation_failed");
    assert.match(
      result.tablePatchResults[0]?.reason ?? "",
      /did not include a table reconstruction plan/i,
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("editorial docx transform service fails controlled rebuilds when DOCX re-parse loses preserved text", async () => {
  const rootDir = await mkdtemp(
    path.join(os.tmpdir(), "editorial-docx-transform-service-"),
  );

  try {
    const assetRepository = new InMemoryDocumentAssetRepository();
    await assetRepository.save({
      id: "asset-original-7",
      manuscript_id: "manuscript-7",
      asset_type: "original",
      status: "active",
      storage_key: "uploads/manuscript-7/original.docx",
      mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      source_module: "upload",
      created_by: "user-1",
      version_no: 1,
      is_current: true,
      file_name: "original.docx",
      created_at: "2026-04-24T10:30:00.000Z",
      updated_at: "2026-04-24T10:30:00.000Z",
    });

    const sourcePath = path.join(rootDir, "uploads", "manuscript-7", "original.docx");
    await mkdir(path.dirname(sourcePath), { recursive: true });
    writeAdvancedTableDocxFixture(sourcePath);

    const driftedPlan = buildControlledRebuildPlan();
    const firstPreservedCell =
      driftedPlan.table_reconstruction_plan?.content_preservation_map[0];
    if (firstPreservedCell) {
      firstPreservedCell.source_text = "Missing after writeback";
      firstPreservedCell.target_text = "Missing after writeback";
    }

    const service = new EditorialDocxTransformService({
      assetRepository,
      rootDir,
      tablePatchPlanner: {
        plan() {
          return {
            plans: [driftedPlan],
            results: [],
          };
        },
      },
    });

    const result = await service.applyDeterministicRules({
      manuscriptId: "manuscript-7",
      sourceAssetId: "asset-original-7",
      outputStorageKey: "outputs/manuscript-7/edited.docx",
      tableAutoApplyMode: "editing_safe_apply",
      rules: [],
    });

    assert.equal(result.tablePatchResults[0]?.status, "validation_failed");
    assert.equal(
      result.tablePatchResults[0]?.validation_snapshot?.checks.some(
        (check) =>
          check.check_kind === "content_preservation" &&
          !check.passed &&
          /missing preserved cell text/i.test(check.reason),
      ),
      true,
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

async function readDocumentXml(docxPath: string): Promise<string> {
  const bytes = await readFile(docxPath);
  const script = [
    "from pathlib import Path",
    "import sys, zipfile",
    `docx_path = Path(r'''${docxPath.replace(/'/g, "''")}''')`,
    "with zipfile.ZipFile(docx_path, 'r') as archive:",
    "    sys.stdout.buffer.write(archive.read('word/document.xml'))",
  ].join("\n");
  return execFileSync(process.platform === "win32" ? "py" : "python3", ["-c", script], {
    input: bytes,
    encoding: "utf8",
  });
}

function buildControlledRebuildPlan(): TableDocxPatchPlan {
  const tableReconstructionPlan = {
    plan_kind: "table_reconstruction_plan" as const,
    outcome: "full_rebuild" as const,
    normalized_table_object: {
      table_id: "table-1",
      row_count: 2,
      column_count: 2,
      caption_text: "Table 1 Demographic characteristics",
      note_text: "Note: 蠂2 compared with control",
      cells: ["Item", "Value", "Age", "54.2"].map((text, index) => ({
        source_cell_id: `grid-cell-${index + 1}`,
        target_cell_id: `target-grid-cell-${index + 1}`,
        row_index: index < 2 ? 0 : 1,
        column_index: index % 2,
        row_span: 1,
        column_span: 1,
        inferred_role: index < 2 ? "header" : "data",
        text,
        paragraphs: [],
        style_evidence: {},
      })),
    },
    operations: [
      "preserve_content_mapping",
      "place_caption",
      "place_note_zone",
      "normalize_border_system",
      "normalize_layout",
      "normalize_paragraph_style",
      "normalize_typography",
      "preserve_rich_fragments",
      "handle_object_content",
    ].map((kind) => ({
      kind: kind as TableReconstructionOperation["kind"],
      status: "planned" as const,
      source_ids: ["table-1"],
      target_ids: ["target-table-1"],
      reason: "test reconstruction operation",
    })),
    downgrade_reasons: [],
    content_preservation_map: ["Item", "Value", "Age", "54.2"].map((text, index) => ({
      source_cell_id: `grid-cell-${index + 1}`,
      target_cell_id: `target-grid-cell-${index + 1}`,
      source_text: text,
      target_text: text,
      preserved: true,
    })),
    required_validation: [
      "content_preservation",
      "topology_preservation",
      "target_border_system",
      "caption_note_placement",
      "rich_fragment_preservation",
      "object_policy",
    ],
  };

  return {
    patch_id: "patch-style-rebuild",
    rule_id: "rule-style-rebuild",
    table_id: "table-1",
    patch_type: "apply_three_line_table_style",
    grade: "A",
    apply_scope: "editing_only",
    semantic_target: "style_profile",
    anchor: {
      table_id: "table-1",
      semantic_target: "style_profile",
    },
    required_snapshot_capabilities: ["style_profile", "grid_cells"],
    proposed_before: "non_three_line_table",
    proposed_after: "three_line_table",
    rationale: "rebuild table into deterministic journal layout",
    evidence_pack: {
      match_reason: "style profile matched controlled rebuild path",
    },
    execution_path: "controlled_rebuild",
    table_reconstruction_plan: tableReconstructionPlan,
    rebuild_payload: {
      strategy: "three_line_table_normalization",
      objectives: [
        "preserve_table_content_and_merged_structure",
        "normalize_caption_above_table",
        "normalize_note_zone_below_table",
        "normalize_intra_cell_rich_text_runs",
        "enforce_three_line_table_borders",
      ],
      table_snapshot: buildControlledRebuildSnapshot(),
      table_reconstruction_plan: tableReconstructionPlan,
    },
  };
}

function buildControlledRebuildSnapshot() {
  return {
    table_id: "table-1",
    row_count: 2,
    column_count: 2,
    profile: {
      is_three_line_table: false,
      header_depth: 1,
      has_stub_column: false,
      has_statistical_footnotes: true,
      has_unit_markers: false,
    },
    caption_fields: {
      text: "Table 1 Demographic characteristics",
      label_text: "Table 1",
      title_text: "Demographic characteristics",
      paragraphs: [
        {
          id: "caption-paragraph-1",
          text: "Table 1 Demographic characteristics",
          style: buildParagraphStyle("center"),
          fragments: [
            buildTextFragment("caption-fragment-1", "Table 1 ", {
              fontFamily: "Times New Roman",
              fontSizePt: 12,
              bold: true,
            }),
            buildTextFragment("caption-fragment-2", "Demographic characteristics", {
              fontFamily: "Times New Roman",
              fontSizePt: 12,
              italic: true,
            }),
          ],
        },
      ],
    },
    note_zone: {
      text: "Note: χ2 compared with control",
      line_texts: ["Note: χ2 compared with control"],
      footnote_ids: ["table-1-footnote-1"],
      coordinate: {
        table_id: "table-1",
        target: "note_zone",
      },
      paragraphs: [
        {
          id: "note-paragraph-1",
          text: "Note: χ2 compared with control",
          style: buildParagraphStyle("left"),
          fragments: [
            buildTextFragment("note-fragment-1", "Note: "),
            {
              id: "note-fragment-2",
              kind: "symbol",
              text: "",
              symbol_font: "Symbol",
              symbol_char: "03C7",
              style: buildInlineStyle({
                fontFamily: "Symbol",
              }),
            },
          ],
        },
      ],
    },
    footnote_items: [
      {
        id: "table-1-footnote-1",
        text: "Note: χ2 compared with control",
        note_kind: "statistical_significance",
        marker: "*",
        coordinate: {
          table_id: "table-1",
          target: "footnote_item",
          footnote_anchor: "*",
        },
      },
    ],
    grid_cells: [
      buildGridCellSnapshot("grid-cell-1", "Item", 0, 0, "header", "center"),
      buildGridCellSnapshot("grid-cell-2", "Value", 0, 1, "header", "center"),
      buildGridCellSnapshot("grid-cell-3", "Age", 1, 0, "data", "left"),
      buildGridCellSnapshot("grid-cell-4", "54.2", 1, 1, "data", "right"),
    ],
  };
}

function buildGridCellSnapshot(
  id: string,
  text: string,
  rowIndex: number,
  columnIndex: number,
  inferredRole: "header" | "data",
  alignment: string,
) {
  return {
    id,
    text,
    row_index: rowIndex,
    column_index: columnIndex,
    row_span: 1,
    column_span: 1,
    inferred_role: inferredRole,
    style_evidence: {
      font_family: styleFact("Times New Roman"),
      font_size_pt: styleFact(10.5),
      bold: styleFact(false),
      italic: styleFact(false),
      script_position: styleFact("baseline"),
      alignment: styleFact(alignment),
      spacing_before_pt: styleFact(0),
      spacing_after_pt: styleFact(0),
      line_spacing: styleFact(1),
      line_spacing_mode: styleFact("multiple"),
      left_indent_pt: styleFact(0),
      right_indent_pt: styleFact(0),
      first_line_indent_pt: styleFact(0),
      hanging_indent_pt: styleFact(0),
      vertical_alignment: styleFact("center"),
    },
    paragraphs: [
      {
        id: `${id}-paragraph`,
        text,
        style: buildParagraphStyle(alignment),
        fragments: [buildTextFragment(`${id}-fragment`, text)],
      },
    ],
  };
}

function buildParagraphStyle(alignment: string) {
  return {
    alignment: styleFact(alignment),
    spacing_before_pt: styleFact(0),
    spacing_after_pt: styleFact(0),
    line_spacing: styleFact(1),
    line_spacing_mode: styleFact("multiple"),
    left_indent_pt: styleFact(0),
    right_indent_pt: styleFact(0),
    first_line_indent_pt: styleFact(0),
    hanging_indent_pt: styleFact(0),
  };
}

function buildTextFragment(
  id: string,
  text: string,
  input: {
    fontFamily?: string;
    fontSizePt?: number;
    bold?: boolean;
    italic?: boolean;
  } = {},
) {
  return {
    id,
    kind: "text",
    text,
    style: buildInlineStyle(input),
  };
}

function buildInlineStyle(input: {
  fontFamily?: string;
  fontSizePt?: number;
  bold?: boolean;
  italic?: boolean;
} = {}) {
  return {
    font_family: styleFact(input.fontFamily ?? "Times New Roman"),
    font_size_pt: styleFact(input.fontSizePt ?? 10.5),
    bold: styleFact(input.bold ?? false),
    italic: styleFact(input.italic ?? false),
    script_position: styleFact("baseline"),
  };
}

function styleFact<T>(value: T) {
  return {
    availability: "authoritative" as const,
    value,
  };
}

function writeTableDocxFixture(outputPath: string): void {
  const script = [
    "import zipfile",
    "from pathlib import Path",
    `output = Path(r'''${outputPath.replace(/'/g, "''")}''')`,
    "output.parent.mkdir(parents=True, exist_ok=True)",
    "document_xml = '''<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body><w:p><w:r><w:t>表1 基线特征比较</w:t></w:r></w:p><w:tbl><w:tblPr><w:tblBorders><w:top w:val=\"single\"/><w:bottom w:val=\"single\"/><w:insideV w:val=\"nil\"/></w:tblBorders></w:tblPr><w:tr><w:tc><w:p><w:r><w:t>项目</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:gridSpan w:val=\"2\"/></w:tcPr><w:p><w:r><w:t>Treatment group</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:tcPr><w:tcBorders><w:bottom w:val=\"single\"/></w:tcBorders></w:tcPr><w:p><w:r><w:t>男性</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcBorders><w:bottom w:val=\"single\"/></w:tcBorders></w:tcPr><w:p><w:r><w:t>n</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcBorders><w:bottom w:val=\"single\"/></w:tcBorders></w:tcPr><w:p><w:r><w:t>Rate (%)</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>基线</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>18</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>60.0</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:t>*P&lt;0.05 vs control</w:t></w:r></w:p></w:body></w:document>'''",
    "entries = {",
    "  '[Content_Types].xml': '''<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/><Override PartName=\"/docProps/core.xml\" ContentType=\"application/vnd.openxmlformats-package.core-properties+xml\"/><Override PartName=\"/docProps/app.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.extended-properties+xml\"/></Types>''',",
    "  '_rels/.rels': '''<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/><Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties\" Target=\"docProps/core.xml\"/><Relationship Id=\"rId3\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties\" Target=\"docProps/app.xml\"/></Relationships>''',",
    "  'docProps/core.xml': '''<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><cp:coreProperties xmlns:cp=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:dcterms=\"http://purl.org/dc/terms/\" xmlns:dcmitype=\"http://purl.org/dc/dcmitype/\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"><dc:title>Medical Manuscript Artifact</dc:title></cp:coreProperties>''',",
    "  'docProps/app.xml': '''<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Properties xmlns=\"http://schemas.openxmlformats.org/officeDocument/2006/extended-properties\" xmlns:vt=\"http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes\"><Application>Codex Medical Manuscript System</Application></Properties>''',",
    "  'word/document.xml': document_xml,",
    "}",
    "with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:",
    "    for name, content in entries.items():",
    "        archive.writestr(name, content)",
  ].join("\n");

  execFileSync(process.platform === "win32" ? "py" : "python3", ["-c", script]);
}

function writeAdvancedTableDocxFixture(outputPath: string): void {
  const script = [
    "import zipfile",
    "from pathlib import Path",
    `output = Path(r'''${outputPath.replace(/'/g, "''")}''')`,
    "output.parent.mkdir(parents=True, exist_ok=True)",
    "document_xml = '''<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body><w:p><w:r><w:t>Table 1 Baseline characteristics</w:t></w:r></w:p><w:tbl><w:tblPr><w:tblBorders><w:top w:val=\"single\"/><w:bottom w:val=\"single\"/><w:insideV w:val=\"single\"/></w:tblBorders></w:tblPr><w:tr><w:tc><w:p><w:r><w:t>Item</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Value</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>Age</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>54.2</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:t>Note: P&lt;0.05 vs control</w:t></w:r></w:p></w:body></w:document>'''",
    "entries = {",
    "  '[Content_Types].xml': '''<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/><Override PartName=\"/docProps/core.xml\" ContentType=\"application/vnd.openxmlformats-package.core-properties+xml\"/><Override PartName=\"/docProps/app.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.extended-properties+xml\"/></Types>''',",
    "  '_rels/.rels': '''<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/><Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties\" Target=\"docProps/core.xml\"/><Relationship Id=\"rId3\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties\" Target=\"docProps/app.xml\"/></Relationships>''',",
    "  'docProps/core.xml': '''<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><cp:coreProperties xmlns:cp=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:dcterms=\"http://purl.org/dc/terms/\" xmlns:dcmitype=\"http://purl.org/dc/dcmitype/\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"><dc:title>Medical Manuscript Artifact</dc:title></cp:coreProperties>''',",
    "  'docProps/app.xml': '''<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Properties xmlns=\"http://schemas.openxmlformats.org/officeDocument/2006/extended-properties\" xmlns:vt=\"http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes\"><Application>Codex Medical Manuscript System</Application></Properties>''',",
    "  'word/document.xml': document_xml,",
    "}",
    "with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:",
    "    for name, content in entries.items():",
    "        archive.writestr(name, content)",
  ].join("\n");

  execFileSync(process.platform === "win32" ? "py" : "python3", ["-c", script]);
}
