import type { EditorialRuleRecord } from "../editorial-rules/editorial-rule-record.ts";
import type { ResolvedEditorialRule } from "../editorial-rules/editorial-rule-resolution-service.ts";
import {
  EditorialRuleTableHitService,
  type EditorialRuleTableHit,
} from "../editorial-rules/editorial-rule-table-hit-service.ts";
import type { DocumentStructureTableSnapshot } from "../document-pipeline/document-structure-service.ts";
import type { ManualReviewPolicyRecord } from "../manual-review-policies/manual-review-policy-record.ts";
import {
  deriveManualReviewReason,
  shouldStageManualReviewRule,
} from "./instruction-template-assembler.ts";
import type {
  EditorialTextBlock,
  ProofreadingCheckResult,
  ProofreadingInspectionResult,
  ProofreadingRiskItem,
} from "./types.ts";

export function inspectProofreadingRules(input: {
  blocks: readonly EditorialTextBlock[];
  rules: readonly EditorialRuleRecord[];
  resolvedRules?: readonly ResolvedEditorialRule[];
  tableSnapshots?: readonly DocumentStructureTableSnapshot[];
  manualReviewPolicy?: ManualReviewPolicyRecord;
}): ProofreadingInspectionResult {
  const passedChecks: ProofreadingCheckResult[] = [];
  const failedChecks: ProofreadingCheckResult[] = [];
  const riskItems: ProofreadingRiskItem[] = [];
  const manualReviewItems: ProofreadingInspectionResult["manualReviewItems"] = [];
  const tableHitService = new EditorialRuleTableHitService();
  const resolvedRules =
    input.resolvedRules && input.resolvedRules.length > 0
      ? input.resolvedRules
      : input.rules
          .filter((record) => record.enabled)
          .map((rule) => ({
            rule,
            source_layer: "base" as const,
          }));

  if (input.blocks.length === 0 && !(input.tableSnapshots?.length)) {
    riskItems.push({
      reason: "source_document_not_available",
    });
  }

  for (const entry of resolvedRules) {
    const rule = entry.rule;
    if (rule.rule_type === "content") {
      if (shouldStageManualReviewRule(rule, input.manualReviewPolicy)) {
        const reason = deriveManualReviewReason(rule);
        manualReviewItems.push({
          ruleId: rule.id,
          reason,
        });
        riskItems.push({
          ruleId: rule.id,
          reason,
          severity: rule.severity,
        });
      }
      continue;
    }

    if (rule.rule_object === "table") {
      if (!input.tableSnapshots?.length) {
        continue;
      }

      const tableHits = tableHitService.findMatches({
        rule,
        tableSnapshots: [...input.tableSnapshots],
      });
      for (const hit of tableHits) {
        failedChecks.push({
          ruleId: rule.id,
          expected: readTableExpectation(rule),
          actual: describeTableHit(hit),
          severity: rule.severity,
          semantic_hit: toSemanticHitEvidence(hit, entry.source_layer),
        });
      }
      continue;
    }

    if (
      rule.execution_mode !== "inspect" &&
      rule.execution_mode !== "apply_and_inspect"
    ) {
      continue;
    }

    const expected = readExpectedText(rule);
    if (!expected) {
      continue;
    }

    input.blocks.forEach((block, blockIndex) => {
      if (!matchesRuleScope(block, rule)) {
        return;
      }

      if (block.text === expected) {
        passedChecks.push({
          ruleId: rule.id,
          expected,
          actual: block.text,
          severity: rule.severity,
          blockIndex,
        });
        return;
      }

      const triggerText =
        typeof rule.trigger.text === "string" ? rule.trigger.text : undefined;
      if (triggerText && block.text === triggerText) {
        failedChecks.push({
          ruleId: rule.id,
          expected,
          actual: block.text,
          severity: rule.severity,
          blockIndex,
        });
      }
    });
  }

  return {
    passedChecks,
    failedChecks,
    riskItems,
    manualReviewItems: uniqueManualReviewItems(manualReviewItems),
    appliedChanges: [],
  };
}

function matchesRuleScope(
  block: EditorialTextBlock,
  rule: EditorialRuleRecord,
): boolean {
  const scopedSections = readStringArray(rule.scope.sections);
  if (scopedSections && scopedSections.length > 0) {
    if (!block.section || !scopedSections.includes(block.section)) {
      return false;
    }
  }

  const blockKind =
    typeof rule.scope.block_kind === "string" ? rule.scope.block_kind : undefined;
  if (blockKind && block.block_kind !== blockKind) {
    return false;
  }

  return true;
}

function readExpectedText(rule: EditorialRuleRecord): string | undefined {
  if (typeof rule.example_after === "string" && rule.example_after.length > 0) {
    return rule.example_after;
  }

  return typeof rule.action.to === "string" ? rule.action.to : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const strings = value.filter((item): item is string => typeof item === "string");
  return strings.length > 0 ? strings : undefined;
}

function uniqueManualReviewItems(
  items: ProofreadingInspectionResult["manualReviewItems"],
): ProofreadingInspectionResult["manualReviewItems"] {
  const deduped = new Map<string, ProofreadingInspectionResult["manualReviewItems"][number]>();
  for (const item of items) {
    deduped.set(`${item.ruleId}:${item.reason}`, item);
  }

  return [...deduped.values()];
}

function readTableExpectation(rule: EditorialRuleRecord): string {
  if (typeof rule.action.message === "string" && rule.action.message.length > 0) {
    return rule.action.message;
  }

  return typeof rule.explanation_payload?.rationale === "string"
    ? rule.explanation_payload.rationale
    : "Matched table semantic rule.";
}

function describeTableHit(hit: EditorialRuleTableHit): string {
  const segments = [hit.table_id, ...(hit.semantic_coordinate.header_path ?? [])];

  if (segments.length > 1) {
    return segments.join(" > ");
  }

  if (hit.semantic_coordinate.column_key) {
    return `${hit.table_id} > ${hit.semantic_coordinate.column_key}`;
  }

  if (hit.semantic_coordinate.footnote_anchor) {
    return `${hit.table_id} > ${hit.semantic_coordinate.footnote_anchor}`;
  }

  return hit.table_id;
}

function toSemanticHitEvidence(
  hit: EditorialRuleTableHit,
  sourceLayer: "base" | "journal",
): NonNullable<ProofreadingCheckResult["semantic_hit"]> {
  return {
    table_id: hit.table_id,
    semantic_target: hit.semantic_target,
    ...(hit.semantic_coordinate.header_path
      ? {
          header_path: [...hit.semantic_coordinate.header_path],
        }
      : {}),
    ...(hit.semantic_coordinate.row_key
      ? {
          row_key: hit.semantic_coordinate.row_key,
        }
      : {}),
    ...(hit.semantic_coordinate.column_key
      ? {
          column_key: hit.semantic_coordinate.column_key,
        }
      : {}),
    ...(hit.semantic_coordinate.footnote_anchor
      ? {
          footnote_anchor: hit.semantic_coordinate.footnote_anchor,
        }
      : {}),
    override_source: sourceLayer,
  };
}
