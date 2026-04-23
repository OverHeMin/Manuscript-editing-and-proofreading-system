import test from "node:test";
import assert from "node:assert/strict";
import type { EditorialRuleRecord } from "../../src/modules/editorial-rules/editorial-rule-record.ts";
import type { ResolvedEditorialRule } from "../../src/modules/editorial-rules/editorial-rule-resolution-service.ts";
import { EditorialRuleTableHitService } from "../../src/modules/editorial-rules/editorial-rule-table-hit-service.ts";
import { TableDocxPatchPlanner } from "../../src/modules/document-pipeline/table-docx-patch-planner.ts";
import { TABLE_DOCX_PATCH_RESULT_STATUSES } from "../../src/modules/document-pipeline/table-docx-patch-plan.ts";
import type { DocumentStructureTableSnapshot } from "../../src/modules/document-pipeline/document-structure-service.ts";

function buildTableSnapshot(): DocumentStructureTableSnapshot {
  return {
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
          header_path: ["Treatment group", "n (%)"],
          column_key: "Treatment group > n (%)",
        },
      },
    ],
  };
}

function buildAdvancedTableSnapshot(): DocumentStructureTableSnapshot {
  return {
    ...buildTableSnapshot(),
    table_label: {
      id: "table-1-label",
      text: "Table 1",
      coordinate: {
        table_id: "table-1",
        target: "table_label",
      },
    },
    table_title: {
      id: "table-1-title",
      text: "Baseline characteristics",
      coordinate: {
        table_id: "table-1",
        target: "table_title",
      },
    },
    caption_fields: {
      text: "Table 1 Baseline characteristics",
      label_text: "Table 1",
      title_text: "Baseline characteristics",
    },
    note_zone: {
      text: "Note: P<0.05 vs control",
      line_texts: ["Note: P<0.05 vs control"],
      footnote_ids: ["table-1-footnote-1"],
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
  };
}

function buildResolvedRule(input: {
  id: string;
  orderNo: number;
  semanticTarget:
    | "header_cell"
    | "footnote_item"
    | "unit_marker"
    | "table_label"
    | "table_title"
    | "note_zone"
    | "style_profile";
  patchType: string;
  grade: "A" | "B" | "C";
  applyScope: "inspect_only" | "editing_only";
  requiredSnapshotCapabilities: string[];
  exampleAfter?: string;
}): ResolvedEditorialRule {
  const selector =
    input.semanticTarget === "header_cell" || input.semanticTarget === "unit_marker"
      ? {
          semantic_target: input.semanticTarget,
          header_path_includes: ["Treatment group", "n (%)"],
        }
      : input.semanticTarget === "table_label" ||
          input.semanticTarget === "table_title" ||
          input.semanticTarget === "note_zone" ||
          input.semanticTarget === "style_profile"
        ? {
            semantic_target: input.semanticTarget,
          }
      : {
          semantic_target: "footnote_item" as const,
          note_kind: "statistical_significance" as const,
        };

  const rule: EditorialRuleRecord = {
    id: input.id,
    rule_set_id: "rule-set-1",
    order_no: input.orderNo,
    rule_object: "table",
    rule_type: "format",
    execution_mode: "inspect",
    scope: {
      block_kind: "table",
    },
    selector,
    trigger: {
      kind: "table_shape",
      layout: "three_line_table",
    },
    action: {
      kind: "inspect_table_rule",
      message: `${input.id} review`,
    } as EditorialRuleRecord["action"],
    authoring_payload: {
      grade: input.grade,
      patch_type: input.patchType,
      apply_scope: input.applyScope,
      required_snapshot_capabilities: [...input.requiredSnapshotCapabilities],
    },
    confidence_policy: "manual_only",
    severity: "warning",
    enabled: true,
    ...(input.exampleAfter ? { example_after: input.exampleAfter } : {}),
  };

  return {
    rule,
    coverage_key: `coverage-${input.id}`,
    source_layer: "base",
    overridden_rule_ids: [],
    resolution_reason: "test",
    execution_posture: "guarded",
  };
}

test("table patch planner emits executable A-class editing plans in fixed order and records explicit skips", () => {
  const planner = new TableDocxPatchPlanner({
    tableHitService: new EditorialRuleTableHitService(),
  });

  const result = planner.plan({
    tableAutoApplyMode: "editing_safe_apply",
    resolvedRules: [
      buildResolvedRule({
        id: "rule-footnote",
        orderNo: 10,
        semanticTarget: "footnote_item",
        patchType: "replace_footnote_text",
        grade: "A",
        applyScope: "editing_only",
        requiredSnapshotCapabilities: ["footnote_item"],
        exampleAfter: "注：P<0.05 vs control",
      }),
      buildResolvedRule({
        id: "rule-unit",
        orderNo: 20,
        semanticTarget: "unit_marker",
        patchType: "normalize_unit_text",
        grade: "A",
        applyScope: "editing_only",
        requiredSnapshotCapabilities: ["unit_marker"],
        exampleAfter: "％",
      }),
      buildResolvedRule({
        id: "rule-header",
        orderNo: 30,
        semanticTarget: "header_cell",
        patchType: "replace_header_cell_text",
        grade: "A",
        applyScope: "editing_only",
        requiredSnapshotCapabilities: ["header_cell"],
        exampleAfter: "n（%）",
      }),
      buildResolvedRule({
        id: "rule-header-conflict",
        orderNo: 40,
        semanticTarget: "header_cell",
        patchType: "replace_header_cell_text",
        grade: "A",
        applyScope: "editing_only",
        requiredSnapshotCapabilities: ["header_cell"],
        exampleAfter: "例数（%）",
      }),
      buildResolvedRule({
        id: "rule-missing-capability",
        orderNo: 50,
        semanticTarget: "header_cell",
        patchType: "replace_header_cell_text",
        grade: "A",
        applyScope: "editing_only",
        requiredSnapshotCapabilities: ["caption_fields"],
        exampleAfter: "n（%）",
      }),
      buildResolvedRule({
        id: "rule-b-grade",
        orderNo: 60,
        semanticTarget: "header_cell",
        patchType: "replace_header_cell_text",
        grade: "B",
        applyScope: "editing_only",
        requiredSnapshotCapabilities: ["header_cell"],
        exampleAfter: "n（%）",
      }),
    ],
    tableSnapshots: [buildTableSnapshot()],
  });

  assert.deepEqual(
    result.plans.map((plan) => plan.patch_type),
    ["replace_header_cell_text", "normalize_unit_text", "replace_footnote_text"],
  );
  assert.equal(result.plans[0]?.proposed_before, "n (%)");
  assert.equal(result.plans[0]?.proposed_after, "n（%）");
  assert.equal(result.plans[1]?.semantic_target, "unit_marker");
  assert.equal(result.plans[2]?.semantic_target, "footnote_item");

  const statusesByRuleId = new Map(
    result.results.map((entry) => [entry.rule_id, entry.status]),
  );
  assert.equal(statusesByRuleId.get("rule-header-conflict"), "skipped_conflict");
  assert.equal(statusesByRuleId.get("rule-missing-capability"), "skipped_no_anchor");
  assert.equal(statusesByRuleId.get("rule-b-grade"), "skipped_unsafe");
  assert.ok(TABLE_DOCX_PATCH_RESULT_STATUSES.includes("applied"));
  assert.ok(TABLE_DOCX_PATCH_RESULT_STATUSES.includes("skipped_no_anchor"));
  assert.ok(TABLE_DOCX_PATCH_RESULT_STATUSES.includes("skipped_conflict"));
  assert.ok(TABLE_DOCX_PATCH_RESULT_STATUSES.includes("skipped_unsafe"));
});

test("table patch planner marks otherwise-eligible editing patches unsafe on inspect-only paths", () => {
  const planner = new TableDocxPatchPlanner({
    tableHitService: new EditorialRuleTableHitService(),
  });

  const result = planner.plan({
    tableAutoApplyMode: "inspect_only",
    resolvedRules: [
      buildResolvedRule({
        id: "rule-header-inspect-path",
        orderNo: 10,
        semanticTarget: "header_cell",
        patchType: "replace_header_cell_text",
        grade: "A",
        applyScope: "editing_only",
        requiredSnapshotCapabilities: ["header_cell"],
        exampleAfter: "n（%）",
      }),
    ],
    tableSnapshots: [buildTableSnapshot()],
  });

  assert.deepEqual(result.plans, []);
  assert.equal(result.results[0]?.status, "skipped_unsafe");
});

test("table patch planner enables caption and note families only when their anchors exist and keeps style patches guarded", () => {
  const planner = new TableDocxPatchPlanner({
    tableHitService: new EditorialRuleTableHitService(),
  });

  const result = planner.plan({
    tableAutoApplyMode: "editing_safe_apply",
    resolvedRules: [
      buildResolvedRule({
        id: "rule-caption-title",
        orderNo: 10,
        semanticTarget: "table_title",
        patchType: "replace_table_caption_text",
        grade: "A",
        applyScope: "editing_only",
        requiredSnapshotCapabilities: ["caption_fields", "table_title"],
        exampleAfter: "Table 1 Demographic characteristics",
      }),
      buildResolvedRule({
        id: "rule-note-zone",
        orderNo: 20,
        semanticTarget: "note_zone",
        patchType: "replace_table_note_text",
        grade: "A",
        applyScope: "editing_only",
        requiredSnapshotCapabilities: ["note_zone"],
        exampleAfter: "Note: P<0.05 compared with control",
      }),
      buildResolvedRule({
        id: "rule-style-guarded",
        orderNo: 30,
        semanticTarget: "style_profile",
        patchType: "apply_three_line_table_style",
        grade: "A",
        applyScope: "editing_only",
        requiredSnapshotCapabilities: ["style_profile"],
        exampleAfter: "three_line_table",
      }),
    ],
    tableSnapshots: [buildAdvancedTableSnapshot()],
  });

  assert.deepEqual(
    result.plans.map((plan) => plan.patch_type),
    ["replace_table_caption_text", "replace_table_note_text"],
  );
  assert.equal(result.plans[0]?.semantic_target, "table_title");
  assert.equal(result.plans[0]?.proposed_before, "Table 1 Baseline characteristics");
  assert.equal(result.plans[1]?.semantic_target, "note_zone");
  assert.equal(result.plans[1]?.proposed_before, "Note: P<0.05 vs control");

  const styleResult = result.results.find((entry) => entry.rule_id === "rule-style-guarded");
  assert.equal(styleResult?.status, "skipped_unsafe");
});
