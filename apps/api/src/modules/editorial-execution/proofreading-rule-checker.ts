import type { EditorialRuleRecord } from "../editorial-rules/editorial-rule-record.ts";
import { deriveManualReviewReason } from "./instruction-template-assembler.ts";
import type {
  EditorialTextBlock,
  ProofreadingCheckResult,
  ProofreadingInspectionResult,
  ProofreadingRiskItem,
} from "./types.ts";

export function inspectProofreadingRules(input: {
  blocks: readonly EditorialTextBlock[];
  rules: readonly EditorialRuleRecord[];
}): ProofreadingInspectionResult {
  const passedChecks: ProofreadingCheckResult[] = [];
  const failedChecks: ProofreadingCheckResult[] = [];
  const riskItems: ProofreadingRiskItem[] = [];
  const manualReviewItems: ProofreadingInspectionResult["manualReviewItems"] = [];

  if (input.blocks.length === 0) {
    riskItems.push({
      reason: "source_document_not_available",
    });
  }

  for (const rule of input.rules.filter((record) => record.enabled)) {
    if (rule.rule_type === "content") {
      if (rule.confidence_policy !== "always_auto") {
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
