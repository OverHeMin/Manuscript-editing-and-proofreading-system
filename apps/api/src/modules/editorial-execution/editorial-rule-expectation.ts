import type { EditorialRuleRecord } from "../editorial-rules/editorial-rule-record.ts";
import type { EditorialRuleConflictKind } from "../editorial-rules/editorial-rule-conflict-service.ts";
import type { EditorialRuleExecutionPosture } from "../editorial-rules/editorial-rule-object-catalog.ts";
import type { EditorialTextBlock } from "./types.ts";

const STATISTICAL_EXPRESSION_PATTERN =
  /\b(p\s*[<=>]\s*0?\.\d+|95%\s*ci|or\s*=|hr\s*=|rr\s*=|χ²|x²|t\s*=|f\s*=)\b/i;

export function describeEditorialRuleExpectation(
  rule: Pick<
    EditorialRuleRecord,
    "action" | "example_after" | "explanation_payload"
  >,
): string | undefined {
  if (typeof rule.example_after === "string" && rule.example_after.length > 0) {
    return rule.example_after;
  }

  if (
    (rule.action.kind === "replace_heading" || rule.action.kind === "replace_text") &&
    typeof rule.action.to === "string"
  ) {
    return rule.action.to;
  }

  if (
    rule.action.kind === "normalize_statistical_expression" &&
    typeof rule.action.requirement === "string" &&
    rule.action.requirement.trim().length > 0
  ) {
    return `Normalize statistical expression using ${rule.action.requirement.trim()} requirements.`;
  }

  if (
    rule.action.kind === "normalize_reference_entry" &&
    typeof rule.action.citation_style === "string" &&
    rule.action.citation_style.trim().length > 0
  ) {
    return `Normalize reference entry using ${rule.action.citation_style.trim()} style rules.`;
  }

  if (
    rule.action.kind === "emit_finding" &&
    typeof rule.action.message === "string" &&
    rule.action.message.trim().length > 0
  ) {
    return rule.action.message.trim();
  }

  if (rule.action.kind === "inspect_table_rule") {
    const requirements = [
      typeof rule.action.caption_requirement === "string" &&
      rule.action.caption_requirement.trim().length > 0
        ? `Caption requirement: ${rule.action.caption_requirement.trim()}`
        : undefined,
      typeof rule.action.layout_requirement === "string" &&
      rule.action.layout_requirement.trim().length > 0
        ? `Layout requirement: ${rule.action.layout_requirement.trim()}`
        : undefined,
    ].filter((value): value is string => Boolean(value));

    if (requirements.length > 0) {
      return requirements.join("; ");
    }
  }

  if (
    typeof rule.explanation_payload?.rationale === "string" &&
    rule.explanation_payload.rationale.trim().length > 0
  ) {
    return rule.explanation_payload.rationale.trim();
  }

  return undefined;
}

export function describeTableInspectionReason(input: {
  matchReason: string;
  rule: Pick<
    EditorialRuleRecord,
    "action" | "example_after" | "explanation_payload"
  >;
}): string {
  const matchReason = input.matchReason.trim();
  const expectation = describeEditorialRuleExpectation(input.rule)?.trim();

  if (!expectation) {
    return matchReason;
  }

  if (!matchReason) {
    return expectation;
  }

  return matchReason.includes(expectation)
    ? matchReason
    : `${matchReason} ${expectation}`;
}

export function describeEditorialRuleManualReviewReason(input: {
  rule: Pick<
    EditorialRuleRecord,
    "manual_review_reason_template" | "rule_object"
  >;
  executionPosture: EditorialRuleExecutionPosture;
  conflictKind?: EditorialRuleConflictKind;
}): string {
  if (input.conflictKind === "exclusive_conflict") {
    return "Human confirmation is required because multiple rules proposed incompatible actions on the same target.";
  }

  if (input.executionPosture === "inspect_only") {
    return `Human confirmation is required because ${input.rule.rule_object} rules in inspect-only posture never auto-apply changes.`;
  }

  if (input.executionPosture === "guarded") {
    if (
      typeof input.rule.manual_review_reason_template === "string" &&
      input.rule.manual_review_reason_template.trim().length > 0
    ) {
      return `Human confirmation is required by manual review policy "${input.rule.manual_review_reason_template.trim()}".`;
    }

    return `Human confirmation is required because guarded ${input.rule.rule_object} changes cannot auto-apply without review.`;
  }

  if (
    typeof input.rule.manual_review_reason_template === "string" &&
    input.rule.manual_review_reason_template.trim().length > 0
  ) {
    return `Human confirmation is required by manual review policy "${input.rule.manual_review_reason_template.trim()}".`;
  }

  return "Human confirmation is required before this governed rule can be applied.";
}

export function describeEditorialRuleMissReason(
  rule: Pick<EditorialRuleRecord, "rule_object" | "trigger" | "scope">,
): string {
  const scopeSections = Array.isArray(rule.scope.sections) && rule.scope.sections.length > 0
    ? ` within sections ${rule.scope.sections.join(", ")}`
    : "";

  switch (rule.trigger.kind) {
    case "exact_text":
      return typeof rule.trigger.text === "string"
        ? `Rule did not hit because the sample did not contain exact_text "${rule.trigger.text}"${scopeSections}.`
        : "Rule did not hit because the exact_text trigger could not be evaluated.";
    case "structural_presence":
      return typeof rule.trigger.field === "string"
        ? `Rule did not hit because the sample did not expose structural field "${rule.trigger.field}"${scopeSections}.`
        : "Rule did not hit because the structural presence trigger could not be evaluated.";
    case "table_shape":
      return typeof rule.trigger.layout === "string"
        ? `Rule did not hit because no table matched layout "${rule.trigger.layout}"${scopeSections}.`
        : "Rule did not hit because the table-shape trigger could not be evaluated.";
    default:
      return `Rule did not hit because the sample did not satisfy the ${rule.rule_object} trigger requirements${scopeSections}.`;
  }
}

export function matchesStructuralPresenceBlock(input: {
  block: EditorialTextBlock;
  rule: Pick<EditorialRuleRecord, "trigger" | "selector">;
}): boolean {
  if (input.rule.trigger.kind !== "structural_presence") {
    return false;
  }

  const field =
    typeof input.rule.trigger.field === "string"
      ? input.rule.trigger.field.trim().toLowerCase()
      : "";
  const text = input.block.text.trim();
  if (!text) {
    return false;
  }

  const patternSelector = asRecord(input.rule.selector.pattern_selector);
  const contentClass =
    typeof patternSelector?.content_class === "string"
      ? patternSelector.content_class.trim().toLowerCase()
      : "";
  if (field === "statistical_expression" || contentClass === "statistical_expression") {
    return STATISTICAL_EXPRESSION_PATTERN.test(text);
  }

  const blockSelector =
    typeof input.rule.selector.block_selector === "string"
      ? input.rule.selector.block_selector.trim().toLowerCase()
      : "";
  if (field === "reference" || blockSelector === "reference_entry") {
    return true;
  }

  return field.length > 0 ? text.toLowerCase().includes(field) : false;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
