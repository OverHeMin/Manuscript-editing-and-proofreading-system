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
      paragraphs: [
        buildParagraphSnapshot("caption-paragraph-1", "Table 1 Baseline characteristics", {
          alignment: "center",
          fragments: [
            buildFragment("caption-fragment-1", "Table 1 ", {
              fontFamily: "Times New Roman",
              fontSizePt: 12,
              bold: true,
            }),
            buildFragment("caption-fragment-2", "Baseline characteristics", {
              fontFamily: "Times New Roman",
              fontSizePt: 12,
              italic: true,
            }),
          ],
        }),
      ],
    },
    note_zone: {
      text: "Note: P<0.05 vs control",
      line_texts: ["Note: P<0.05 vs control"],
      footnote_ids: ["table-1-footnote-1"],
      paragraphs: [
        buildParagraphSnapshot("note-paragraph-1", "Note: P<0.05 vs control"),
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
    grid_cells: [
      buildGridCell({
        id: "table-1-grid-1",
        text: "Item",
        rowIndex: 0,
        columnIndex: 0,
        inferredRole: "header",
        paragraphs: [buildParagraphSnapshot("grid-paragraph-1", "Item", { alignment: "center" })],
      }),
      buildGridCell({
        id: "table-1-grid-2",
        text: "Value",
        rowIndex: 0,
        columnIndex: 1,
        inferredRole: "header",
        paragraphs: [buildParagraphSnapshot("grid-paragraph-2", "Value", { alignment: "center" })],
      }),
      buildGridCell({
        id: "table-1-grid-3",
        text: "Age",
        rowIndex: 1,
        columnIndex: 0,
        inferredRole: "data",
        paragraphs: [buildParagraphSnapshot("grid-paragraph-3", "Age")],
      }),
      buildGridCell({
        id: "table-1-grid-4",
        text: "54.2",
        rowIndex: 1,
        columnIndex: 1,
        inferredRole: "data",
        paragraphs: [buildParagraphSnapshot("grid-paragraph-4", "54.2", { alignment: "right" })],
      }),
    ],
  };
}

function buildStyleInsufficientTableSnapshot(): DocumentStructureTableSnapshot {
  const advanced = buildAdvancedTableSnapshot();
  const { grid_cells, ...rest } = advanced;
  return rest;
}

function styleFact<T>(value: T) {
  return {
    availability: "authoritative" as const,
    value,
  };
}

function buildParagraphSnapshot(
  id: string,
  text: string,
  input: {
    alignment?: string;
    fragments?: Array<ReturnType<typeof buildFragment>>;
  } = {},
) {
  return {
    id,
    text,
    style: {
      alignment: styleFact(input.alignment ?? "left"),
      spacing_before_pt: styleFact(0),
      spacing_after_pt: styleFact(0),
      line_spacing: styleFact(1),
      line_spacing_mode: styleFact("multiple"),
      left_indent_pt: styleFact(0),
      right_indent_pt: styleFact(0),
      first_line_indent_pt: styleFact(0),
      hanging_indent_pt: styleFact(0),
    },
    fragments: input.fragments ?? [buildFragment(`${id}-fragment-1`, text)],
  };
}

function buildFragment(
  id: string,
  text: string,
  input: {
    fontFamily?: string;
    fontSizePt?: number;
    bold?: boolean;
    italic?: boolean;
    scriptPosition?: string;
  } = {},
) {
  return {
    id,
    kind: "text" as const,
    text,
    codepoints: [],
    invisible_chars: [],
    style: {
      font_family: styleFact(input.fontFamily ?? "Times New Roman"),
      font_size_pt: styleFact(input.fontSizePt ?? 10.5),
      bold: styleFact(input.bold ?? false),
      italic: styleFact(input.italic ?? false),
      script_position: styleFact(input.scriptPosition ?? "baseline"),
    },
  };
}

function buildGridCell(input: {
  id: string;
  text: string;
  rowIndex: number;
  columnIndex: number;
  inferredRole: "header" | "stub" | "data" | "unknown";
  paragraphs: Array<ReturnType<typeof buildParagraphSnapshot>>;
}) {
  return {
    id: input.id,
    text: input.text,
    row_index: input.rowIndex,
    column_index: input.columnIndex,
    row_span: 1,
    column_span: 1,
    inferred_role: input.inferredRole,
    style_evidence: {
      font_family: styleFact("Times New Roman"),
      font_size_pt: styleFact(10.5),
      bold: styleFact(false),
      italic: styleFact(false),
      script_position: styleFact("baseline"),
      alignment: styleFact("center"),
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
    paragraphs: input.paragraphs,
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

test("table patch planner enables caption and note families and routes style rebuilds only when evidence is sufficient", () => {
  const planner = new TableDocxPatchPlanner({
    tableHitService: new EditorialRuleTableHitService(),
  });

  const controlledResult = planner.plan({
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
        id: "rule-style-rebuild",
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
    controlledResult.plans.map((plan) => plan.patch_type),
    [
      "replace_table_caption_text",
      "replace_table_note_text",
      "apply_three_line_table_style",
    ],
  );
  assert.equal(controlledResult.plans[0]?.semantic_target, "table_title");
  assert.equal(controlledResult.plans[0]?.proposed_before, "Table 1 Baseline characteristics");
  assert.equal(controlledResult.plans[1]?.semantic_target, "note_zone");
  assert.equal(controlledResult.plans[1]?.proposed_before, "Note: P<0.05 vs control");

  const stylePlan = controlledResult.plans.find((plan) => plan.rule_id === "rule-style-rebuild");
  assert.equal(stylePlan?.execution_path, "controlled_rebuild");
  assert.equal(stylePlan?.proposed_before, "three_line_table");
  assert.deepEqual(
    (stylePlan?.rebuild_payload as { objectives?: string[] } | undefined)?.objectives,
    [
      "preserve_table_content_and_merged_structure",
      "normalize_caption_above_table",
      "normalize_note_zone_below_table",
      "normalize_intra_cell_rich_text_runs",
      "enforce_three_line_table_borders",
    ],
  );
  assert.equal(stylePlan?.table_reconstruction_plan?.outcome, "full_rebuild");
  assert.deepEqual(
    stylePlan?.table_reconstruction_plan?.operations.map((operation) => operation.kind),
    [
      "preserve_content_mapping",
      "place_caption",
      "place_note_zone",
      "normalize_border_system",
      "normalize_layout",
      "normalize_paragraph_style",
      "normalize_typography",
      "preserve_rich_fragments",
      "handle_object_content",
    ],
  );
  assert.deepEqual(stylePlan?.table_reconstruction_plan?.downgrade_reasons, []);
  assert.equal(
    stylePlan?.table_reconstruction_plan?.content_preservation_map.every(
      (entry) => entry.preserved && entry.source_text === entry.target_text,
    ),
    true,
  );
  assert.equal(
    (
      stylePlan?.rebuild_payload as
        | { normalized_table_object?: { cells?: unknown[] } }
        | undefined
    )?.normalized_table_object?.cells?.length,
    4,
  );

  const downgradedResult = planner.plan({
    tableAutoApplyMode: "editing_safe_apply",
    resolvedRules: [
      buildResolvedRule({
        id: "rule-style-downgrade",
        orderNo: 10,
        semanticTarget: "style_profile",
        patchType: "apply_three_line_table_style",
        grade: "A",
        applyScope: "editing_only",
        requiredSnapshotCapabilities: ["style_profile"],
        exampleAfter: "three_line_table",
      }),
    ],
    tableSnapshots: [buildStyleInsufficientTableSnapshot()],
  });

  assert.deepEqual(downgradedResult.plans, []);
  const styleResult = downgradedResult.results.find((entry) => entry.rule_id === "rule-style-downgrade");
  assert.equal(styleResult?.status, "skipped_unsafe");
  assert.equal(styleResult?.execution_path, "manual_downgrade");
});

test("table patch planner blocks full rebuild when V1 mandatory evidence has runtime gaps", () => {
  const planner = new TableDocxPatchPlanner({
    tableHitService: new EditorialRuleTableHitService(),
  });
  const tableSnapshot: DocumentStructureTableSnapshot = {
    ...buildAdvancedTableSnapshot(),
    unsupported_fact_groups: ["rich_content"],
  };

  const result = planner.plan({
    tableAutoApplyMode: "editing_safe_apply",
    resolvedRules: [
      buildResolvedRule({
        id: "rule-style-evidence-gap",
        orderNo: 10,
        semanticTarget: "style_profile",
        patchType: "apply_three_line_table_style",
        grade: "A",
        applyScope: "editing_only",
        requiredSnapshotCapabilities: ["style_profile", "grid_cells"],
        exampleAfter: "three_line_table",
      }),
    ],
    tableSnapshots: [tableSnapshot],
  });

  assert.deepEqual(result.plans, []);
  assert.equal(result.results[0]?.status, "skipped_unsafe");
  assert.equal(result.results[0]?.execution_path, "manual_downgrade");
  assert.match(result.results[0]?.reason ?? "", /requires authoritative grid cell evidence/i);
});
