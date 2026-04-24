import type {
  DocumentStructureTableFootnoteItem,
  DocumentStructureTableHeaderCell,
  DocumentStructureTableSnapshot,
  DocumentStructureTableUnitMarker,
} from "./document-structure-service.ts";
import {
  TABLE_DOCX_PATCH_APPLY_PRIORITY,
  type TableDocxPatchAnchor,
  type TableDocxPatchApplyScope,
  type TableDocxExecutionPath,
  type TableDocxPatchGrade,
  type TableDocxPatchPlan,
  type TableDocxPatchResult,
  type TableDocxPatchType,
  type TableDocxSnapshotCapability,
} from "./table-docx-patch-plan.ts";
import {
  EditorialRuleTableHitService,
  type EditorialRuleTableHit,
} from "../editorial-rules/editorial-rule-table-hit-service.ts";
import type { ResolvedEditorialRule } from "../editorial-rules/editorial-rule-resolution-service.ts";

type TableAutoApplyMode = "disabled" | "inspect_only" | "editing_safe_apply";

export interface PlanTableDocxPatchesInput {
  tableAutoApplyMode: TableAutoApplyMode;
  resolvedRules: ResolvedEditorialRule[];
  tableSnapshots: DocumentStructureTableSnapshot[];
}

export interface PlanTableDocxPatchesResult {
  plans: TableDocxPatchPlan[];
  results: TableDocxPatchResult[];
}

export interface TableDocxPatchPlannerOptions {
  tableHitService?: Pick<EditorialRuleTableHitService, "findMatches">;
}

interface EligibleCandidate {
  rule_entry: ResolvedEditorialRule;
  table_snapshot: DocumentStructureTableSnapshot;
  hit: EditorialRuleTableHit;
  patch_type: TableDocxPatchType;
  grade: TableDocxPatchGrade;
  apply_scope: TableDocxPatchApplyScope;
  execution_path: Exclude<TableDocxExecutionPath, "manual_downgrade">;
  required_snapshot_capabilities: TableDocxSnapshotCapability[];
  proposed_before: string;
  proposed_after: string;
  anchor_key: string;
}

export class TableDocxPatchPlanner {
  private readonly tableHitService: Pick<EditorialRuleTableHitService, "findMatches">;

  constructor(options: TableDocxPatchPlannerOptions = {}) {
    this.tableHitService = options.tableHitService ?? new EditorialRuleTableHitService();
  }

  plan(input: PlanTableDocxPatchesInput): PlanTableDocxPatchesResult {
    const tablesById = new Map(input.tableSnapshots.map((table) => [table.table_id, table]));
    const sortedRuleEntries = [...input.resolvedRules]
      .filter((entry) => entry.rule.enabled && entry.rule.rule_object === "table")
      .sort(compareRuleEntries);
    const candidates: EligibleCandidate[] = [];
    const results: TableDocxPatchResult[] = [];

    for (const entry of sortedRuleEntries) {
      const patchType = readPatchType(entry.rule.authoring_payload.patch_type);
      const grade = readGrade(entry.rule.authoring_payload.grade);
      const applyScope = readApplyScope(entry.rule.authoring_payload.apply_scope);
      const requiredSnapshotCapabilities = readSnapshotCapabilities(
        entry.rule.authoring_payload.required_snapshot_capabilities,
      );

      if (!patchType) {
        results.push(
          buildPatchResult({
            ruleEntry: entry,
            patchType: String(entry.rule.authoring_payload.patch_type ?? "unknown"),
            status: "skipped_unsafe",
            reason: "Table patch type is not supported for deterministic DOCX planning.",
            requiredSnapshotCapabilities,
          }),
        );
        continue;
      }

      const hits = this.tableHitService
        .findMatches({
          rule: entry.rule,
          tableSnapshots: input.tableSnapshots,
        })
        .sort(compareHits);

      if (grade !== "A" || applyScope !== "editing_only") {
        results.push(
          buildPatchResult({
            ruleEntry: entry,
            patchType,
            status: "skipped_unsafe",
            reason: "Only A-class editing-only table rules can emit executable DOCX patch plans.",
            requiredSnapshotCapabilities,
            ...(hits[0] ? { hit: hits[0] } : {}),
          }),
        );
        continue;
      }

      if (input.tableAutoApplyMode !== "editing_safe_apply") {
        results.push(
          buildPatchResult({
            ruleEntry: entry,
            patchType,
            status: "skipped_unsafe",
            reason: `Table auto-apply mode "${input.tableAutoApplyMode}" does not allow executable table patch plans.`,
            requiredSnapshotCapabilities,
            ...(hits[0] ? { hit: hits[0] } : {}),
          }),
        );
        continue;
      }

      if (hits.length === 0) {
        results.push(
          buildPatchResult({
            ruleEntry: entry,
            patchType,
            status: "skipped_no_anchor",
            reason: "No semantic table anchor matched this rule in the current document snapshot.",
            requiredSnapshotCapabilities,
          }),
        );
        continue;
      }

      for (const hit of hits) {
        const tableSnapshot = tablesById.get(hit.table_id);
        if (!tableSnapshot) {
          results.push(
            buildPatchResult({
              ruleEntry: entry,
              patchType,
              status: "skipped_no_anchor",
              reason: `Matched table "${hit.table_id}" is missing from the current table snapshot set.`,
              requiredSnapshotCapabilities,
              hit,
            }),
          );
          continue;
        }

        const availableCapabilities = collectSnapshotCapabilities(tableSnapshot);
        const missingCapabilities = requiredSnapshotCapabilities.filter(
          (capability) => !availableCapabilities.has(capability),
        );
        if (missingCapabilities.length > 0) {
          results.push(
            buildPatchResult({
              ruleEntry: entry,
              patchType,
              status: "skipped_no_anchor",
              reason: `Missing required snapshot capabilities: ${missingCapabilities.join(", ")}.`,
              requiredSnapshotCapabilities,
              hit,
            }),
          );
          continue;
        }

        if (!matchesPatchTypeToHit(patchType, hit)) {
          results.push(
            buildPatchResult({
              ruleEntry: entry,
              patchType,
              status: "skipped_unsafe",
              reason: `Patch type "${patchType}" is incompatible with semantic target "${hit.semantic_target}".`,
              requiredSnapshotCapabilities,
              hit,
            }),
          );
          continue;
        }

        const executionPath = resolveExecutionPath({
          patchType,
          tableSnapshot,
        });
        if (!executionPath) {
          results.push(
            buildPatchResult({
              ruleEntry: entry,
              patchType,
              status: "skipped_unsafe",
              reason:
                "Controlled table rebuild requires authoritative grid cell evidence and style anchors; downgrade to manual review.",
              requiredSnapshotCapabilities,
              hit,
              executionPath: "manual_downgrade",
            }),
          );
          continue;
        }

        const proposedBefore = resolveCurrentAnchorText(tableSnapshot, hit);
        if (!proposedBefore) {
          results.push(
            buildPatchResult({
              ruleEntry: entry,
              patchType,
              status: "skipped_no_anchor",
              reason: "The matched semantic anchor did not resolve to concrete table text.",
              requiredSnapshotCapabilities,
              hit,
            }),
          );
          continue;
        }

        const proposedAfter = readOptionalString(entry.rule.example_after);
        if (!proposedAfter) {
          results.push(
            buildPatchResult({
              ruleEntry: entry,
              patchType,
              status: "skipped_unsafe",
              reason: "Patch-capable table rules must provide example_after as the deterministic replacement text.",
              requiredSnapshotCapabilities,
              hit,
            }),
          );
          continue;
        }

        candidates.push({
          rule_entry: entry,
          table_snapshot: tableSnapshot,
          hit,
          patch_type: patchType,
          grade,
          apply_scope: applyScope,
          execution_path: executionPath,
          required_snapshot_capabilities: requiredSnapshotCapabilities,
          proposed_before: proposedBefore,
          proposed_after: proposedAfter,
          anchor_key: buildAnchorKey(hit),
        });
      }
    }

    const plans: TableDocxPatchPlan[] = [];
    const usedAnchorKeys = new Set<string>();
    for (const candidate of candidates.sort(compareCandidates)) {
      if (usedAnchorKeys.has(candidate.anchor_key)) {
        results.push(
          buildPatchResult({
            ruleEntry: candidate.rule_entry,
            patchType: candidate.patch_type,
            status: "skipped_conflict",
            reason: `Another patch already owns semantic anchor "${candidate.anchor_key}".`,
            requiredSnapshotCapabilities: candidate.required_snapshot_capabilities,
            hit: candidate.hit,
          }),
        );
        continue;
      }

      usedAnchorKeys.add(candidate.anchor_key);
      plans.push({
        patch_id: buildPatchId(candidate.rule_entry.rule.id, candidate.patch_type, candidate.anchor_key),
        rule_id: candidate.rule_entry.rule.id,
        table_id: candidate.hit.table_id,
        patch_type: candidate.patch_type,
        grade: candidate.grade,
        apply_scope: candidate.apply_scope,
        semantic_target: candidate.hit.semantic_target,
        anchor: toPatchAnchor(candidate.hit),
        required_snapshot_capabilities: [...candidate.required_snapshot_capabilities],
        proposed_before: candidate.proposed_before,
        proposed_after: candidate.proposed_after,
        rationale: candidate.hit.reason,
        evidence_pack: {
          match_reason: candidate.hit.reason,
          source_layer: candidate.rule_entry.source_layer,
          ...(candidate.rule_entry.rule.example_before
            ? { example_before: candidate.rule_entry.rule.example_before }
            : {}),
          ...(candidate.rule_entry.rule.example_after
            ? { example_after: candidate.rule_entry.rule.example_after }
            : {}),
        },
        execution_path: candidate.execution_path,
        ...(candidate.execution_path === "controlled_rebuild"
          ? {
              rebuild_payload: buildControlledRebuildPayload(
                candidate.table_snapshot,
              ),
            }
          : {}),
      });
    }

    return {
      plans,
      results,
    };
  }
}

function compareRuleEntries(left: ResolvedEditorialRule, right: ResolvedEditorialRule): number {
  return left.rule.order_no - right.rule.order_no || left.rule.id.localeCompare(right.rule.id);
}

function compareHits(left: EditorialRuleTableHit, right: EditorialRuleTableHit): number {
  return (
    left.table_id.localeCompare(right.table_id) ||
    buildAnchorKey(left).localeCompare(buildAnchorKey(right))
  );
}

function compareCandidates(left: EligibleCandidate, right: EligibleCandidate): number {
  return (
    TABLE_DOCX_PATCH_APPLY_PRIORITY[left.patch_type] -
      TABLE_DOCX_PATCH_APPLY_PRIORITY[right.patch_type] ||
    left.hit.table_id.localeCompare(right.hit.table_id) ||
    left.anchor_key.localeCompare(right.anchor_key) ||
    compareRuleEntries(left.rule_entry, right.rule_entry)
  );
}

function readPatchType(value: unknown): TableDocxPatchType | undefined {
  return value === "replace_header_cell_text" ||
    value === "replace_footnote_text" ||
    value === "normalize_unit_text" ||
    value === "replace_table_caption_text" ||
    value === "replace_table_note_text" ||
    value === "apply_three_line_table_style"
    ? value
    : undefined;
}

function readGrade(value: unknown): TableDocxPatchGrade | undefined {
  return value === "A" || value === "B" || value === "C" ? value : undefined;
}

function readApplyScope(value: unknown): TableDocxPatchApplyScope | undefined {
  return value === "inspect_only" || value === "editing_only" ? value : undefined;
}

function readSnapshotCapabilities(value: unknown): TableDocxSnapshotCapability[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isSnapshotCapability);
}

function isSnapshotCapability(value: unknown): value is TableDocxSnapshotCapability {
  return value === "header_cell" ||
    value === "footnote_item" ||
    value === "unit_marker" ||
    value === "table_label" ||
    value === "table_title" ||
    value === "caption_fields" ||
    value === "note_zone" ||
    value === "style_profile" ||
    value === "grid_cells";
}

function collectSnapshotCapabilities(
  table: DocumentStructureTableSnapshot,
): Set<TableDocxSnapshotCapability> {
  const capabilities = new Set<TableDocxSnapshotCapability>();
  if (table.header_cells.length > 0) {
    capabilities.add("header_cell");
  }
  if (table.footnote_items.length > 0) {
    capabilities.add("footnote_item");
  }
  if ((table.unit_markers?.length ?? 0) > 0) {
    capabilities.add("unit_marker");
  }
  if (table.table_label) {
    capabilities.add("table_label");
  }
  if (table.table_title) {
    capabilities.add("table_title");
  }
  if (table.caption_fields) {
    capabilities.add("caption_fields");
  }
  if (table.note_zone) {
    capabilities.add("note_zone");
  }
  if (table.style_profile) {
    capabilities.add("style_profile");
  }
  if ((table.grid_cells?.length ?? 0) > 0) {
    capabilities.add("grid_cells");
  }
  return capabilities;
}

function resolveCurrentAnchorText(
  table: DocumentStructureTableSnapshot,
  hit: EditorialRuleTableHit,
): string | undefined {
  switch (hit.semantic_target) {
    case "table_label":
    case "table_title":
      return table.caption_fields?.text;
    case "note_zone":
      return table.note_zone?.text;
    case "style_profile":
      return table.profile.is_three_line_table
        ? "three_line_table"
        : "non_three_line_table";
    case "header_cell":
      return findHeaderCell(table, hit)?.text;
    case "footnote_item":
      return findFootnoteItem(table, hit)?.text;
    case "unit_marker":
      return findUnitMarker(table, hit)?.text;
    default:
      return undefined;
  }
}

function findHeaderCell(
  table: DocumentStructureTableSnapshot,
  hit: EditorialRuleTableHit,
): DocumentStructureTableHeaderCell | undefined {
  return table.header_cells.find((cell) =>
    compareOptionalString(cell.coordinate.column_key, hit.semantic_coordinate.column_key) &&
    compareOptionalStringArray(cell.coordinate.header_path, hit.semantic_coordinate.header_path),
  );
}

function findFootnoteItem(
  table: DocumentStructureTableSnapshot,
  hit: EditorialRuleTableHit,
): DocumentStructureTableFootnoteItem | undefined {
  return table.footnote_items.find((item) =>
    compareOptionalString(
      item.coordinate.footnote_anchor ?? item.marker,
      hit.semantic_coordinate.footnote_anchor,
    ),
  );
}

function findUnitMarker(
  table: DocumentStructureTableSnapshot,
  hit: EditorialRuleTableHit,
): DocumentStructureTableUnitMarker | undefined {
  return (table.unit_markers ?? []).find((marker) =>
    compareOptionalString(marker.coordinate.column_key, hit.semantic_coordinate.column_key) &&
    compareOptionalStringArray(marker.coordinate.header_path, hit.semantic_coordinate.header_path),
  );
}

function matchesPatchTypeToHit(
  patchType: TableDocxPatchType,
  hit: EditorialRuleTableHit,
): boolean {
  switch (patchType) {
    case "replace_table_caption_text":
      return hit.semantic_target === "table_label" || hit.semantic_target === "table_title";
    case "replace_header_cell_text":
      return hit.semantic_target === "header_cell";
    case "replace_footnote_text":
      return hit.semantic_target === "footnote_item";
    case "normalize_unit_text":
      return hit.semantic_target === "unit_marker";
    case "replace_table_note_text":
      return hit.semantic_target === "note_zone";
    case "apply_three_line_table_style":
      return hit.semantic_target === "style_profile";
    default:
      return false;
  }
}

function resolveExecutionPath(input: {
  patchType: TableDocxPatchType;
  tableSnapshot: DocumentStructureTableSnapshot;
}): Exclude<TableDocxExecutionPath, "manual_downgrade"> | undefined {
  if (input.patchType !== "apply_three_line_table_style") {
    return "safe_patch";
  }

  return (input.tableSnapshot.grid_cells?.length ?? 0) > 0 &&
    input.tableSnapshot.style_profile
    ? "controlled_rebuild"
    : undefined;
}

function buildControlledRebuildPayload(
  tableSnapshot: DocumentStructureTableSnapshot,
): Record<string, unknown> {
  return {
    strategy: "three_line_table_normalization",
    objectives: [
      "preserve_table_content_and_merged_structure",
      "normalize_caption_above_table",
      "normalize_note_zone_below_table",
      "normalize_intra_cell_rich_text_runs",
      "enforce_three_line_table_borders",
    ],
    table_snapshot: structuredClone(tableSnapshot),
  };
}

function buildAnchorKey(hit: EditorialRuleTableHit): string {
  return JSON.stringify({
    table_id: hit.table_id,
    semantic_target: hit.semantic_target,
    header_path: hit.semantic_coordinate.header_path ?? null,
    row_key: hit.semantic_coordinate.row_key ?? null,
    column_key: hit.semantic_coordinate.column_key ?? null,
    footnote_anchor: hit.semantic_coordinate.footnote_anchor ?? null,
  });
}

function buildPatchId(ruleId: string, patchType: TableDocxPatchType, anchorKey: string): string {
  return `${ruleId}:${patchType}:${anchorKey}`;
}

function toPatchAnchor(hit: EditorialRuleTableHit): TableDocxPatchAnchor {
  return {
    table_id: hit.table_id,
    semantic_target: hit.semantic_target,
    ...(hit.semantic_coordinate.header_path
      ? { header_path: [...hit.semantic_coordinate.header_path] }
      : {}),
    ...(hit.semantic_coordinate.row_key
      ? { row_key: hit.semantic_coordinate.row_key }
      : {}),
    ...(hit.semantic_coordinate.column_key
      ? { column_key: hit.semantic_coordinate.column_key }
      : {}),
    ...(hit.semantic_coordinate.footnote_anchor
      ? { footnote_anchor: hit.semantic_coordinate.footnote_anchor }
      : {}),
  };
}

function buildPatchResult(input: {
  ruleEntry: ResolvedEditorialRule;
  patchType: string;
  status: TableDocxPatchResult["status"];
  reason: string;
  requiredSnapshotCapabilities: TableDocxSnapshotCapability[];
  hit?: EditorialRuleTableHit;
  executionPath?: TableDocxExecutionPath;
}): TableDocxPatchResult {
  return {
    patch_id: buildPatchId(
      input.ruleEntry.rule.id,
      readPatchType(input.patchType) ?? "replace_header_cell_text",
      input.hit ? buildAnchorKey(input.hit) : "unresolved",
    ),
    rule_id: input.ruleEntry.rule.id,
    ...(input.hit ? { table_id: input.hit.table_id } : {}),
    patch_type: input.patchType,
    status: input.status,
    reason: input.reason,
    ...(input.hit ? { semantic_target: input.hit.semantic_target } : {}),
    ...(input.hit ? { anchor: toPatchAnchor(input.hit) } : {}),
    required_snapshot_capabilities: [...input.requiredSnapshotCapabilities],
    ...(input.executionPath ? { execution_path: input.executionPath } : {}),
  };
}

function compareOptionalString(left: string | undefined, right: string | undefined): boolean {
  return normalizeText(left) === normalizeText(right);
}

function compareOptionalStringArray(
  left: string[] | undefined,
  right: string[] | undefined,
): boolean {
  const leftValue = left?.map(normalizeText) ?? [];
  const rightValue = right?.map(normalizeText) ?? [];
  return JSON.stringify(leftValue) === JSON.stringify(rightValue);
}

function normalizeText(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
