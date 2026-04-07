import type { EditorialRuleRecord } from "../editorial-rules/editorial-rule-record.ts";
import type {
  AppliedDeterministicRuleChange,
  DeterministicFormatExecutionResult,
  EditorialTextBlock,
} from "./types.ts";

export function selectDeterministicFormatRules(
  rules: readonly EditorialRuleRecord[],
): EditorialRuleRecord[] {
  return rules.filter(
    (rule) =>
      rule.enabled &&
      rule.rule_type === "format" &&
      (rule.execution_mode === "apply" ||
        rule.execution_mode === "apply_and_inspect") &&
      rule.confidence_policy === "always_auto",
  );
}

export function executeDeterministicFormatRules(input: {
  blocks: readonly EditorialTextBlock[];
  rules: readonly EditorialRuleRecord[];
}): DeterministicFormatExecutionResult {
  const blocks = input.blocks.map((block) => ({ ...block }));
  const appliedRuleIds: string[] = [];
  const appliedChanges: AppliedDeterministicRuleChange[] = [];

  for (const rule of selectDeterministicFormatRules(input.rules)) {
    for (const [blockIndex, block] of blocks.entries()) {
      if (!matchesRuleScope(block, rule)) {
        continue;
      }

      const nextText = applyDeterministicRule(block.text, rule);
      if (nextText === block.text) {
        continue;
      }

      appliedRuleIds.push(rule.id);
      appliedChanges.push({
        ruleId: rule.id,
        blockIndex,
        before: block.text,
        after: nextText,
      });
      block.text = nextText;
    }
  }

  return {
    blocks,
    appliedRuleIds: [...new Set(appliedRuleIds)],
    appliedChanges,
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

function applyDeterministicRule(
  text: string,
  rule: EditorialRuleRecord,
): string {
  if (rule.trigger.kind !== "exact_text") {
    return text;
  }

  if (typeof rule.trigger.text !== "string" || rule.trigger.text !== text) {
    return text;
  }

  if (
    (rule.action.kind === "replace_heading" || rule.action.kind === "replace_text") &&
    typeof rule.action.to === "string"
  ) {
    return rule.action.to;
  }

  return text;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const strings = value.filter((item): item is string => typeof item === "string");
  return strings.length > 0 ? strings : undefined;
}
