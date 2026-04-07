import type { EditorialRuleRecord } from "../editorial-rules/editorial-rule-record.ts";
import type {
  AssembleInstructionTemplateInput,
  ContentRuleCandidate,
  InstructionTemplatePayload,
} from "./types.ts";

export function assembleInstructionTemplate(
  input: AssembleInstructionTemplateInput,
): InstructionTemplatePayload {
  const contentRuleCandidates = buildContentRuleCandidates(input.rules);
  const manualReviewItems = contentRuleCandidates.map((candidate) => ({
    ruleId: candidate.ruleId,
    reason: candidate.reason,
  }));

  return {
    templateId: input.promptTemplate.id,
    templateKind:
      input.promptTemplate.template_kind ??
      inferTemplateKindFromModule(input.promptTemplate.module),
    systemInstructions: input.promptTemplate.system_instructions ?? "",
    taskFrame: input.promptTemplate.task_frame ?? "",
    hardRuleSummary: buildHardRuleSummary(input),
    allowedContentOperations: [
      ...(input.promptTemplate.allowed_content_operations ?? []),
    ],
    forbiddenOperations: [...(input.promptTemplate.forbidden_operations ?? [])],
    manualReviewPolicy: input.promptTemplate.manual_review_policy ?? "",
    outputContract: input.promptTemplate.output_contract ?? "",
    reportStyle: input.promptTemplate.report_style,
    promptSnippets: collectPromptSnippets(input),
    manualReviewItems,
    contentRuleCandidates,
  };
}

function inferTemplateKindFromModule(
  module: AssembleInstructionTemplateInput["promptTemplate"]["module"],
): InstructionTemplatePayload["templateKind"] {
  return module === "proofreading"
    ? "proofreading_instruction"
    : "editing_instruction";
}

function buildHardRuleSummary(
  input: AssembleInstructionTemplateInput,
): string {
  const prefix = input.promptTemplate.hard_rule_summary?.trim();
  const lines = input.rules
    .filter((rule) => rule.enabled)
    .sort((left, right) => left.order_no - right.order_no)
    .map((rule) => summarizeRule(rule));
  const summary = [
    prefix && prefix.length > 0 ? prefix : undefined,
    `Rule set v${input.ruleSet.version_no}:`,
    ...lines,
  ].filter((line): line is string => typeof line === "string" && line.length > 0);

  return summary.join("\n");
}

function summarizeRule(rule: EditorialRuleRecord): string {
  const before = resolveBeforeText(rule);
  const after = resolveAfterText(rule);
  const sectionText = readScopeSection(rule) ?? "document";

  if (rule.rule_type === "format") {
    return `- ${sectionText}: ${before} -> ${after}`;
  }

  return `- ${sectionText}: ${rule.action.kind} requires ${deriveManualReviewReason(rule)}`;
}

function collectPromptSnippets(
  input: AssembleInstructionTemplateInput,
): string[] {
  return input.knowledgeSelections
    .map((selection) => selection.knowledgeItem)
    .filter((item) => item.knowledge_kind === "prompt_snippet")
    .filter((item) => {
      const source = item.projection_source;
      return (
        !source ||
        source.source_kind !== "editorial_rule_projection" ||
        source.rule_set_id === input.ruleSet.id
      );
    })
    .map((item) => item.canonical_text.trim())
    .filter((text) => text.length > 0);
}

function buildContentRuleCandidates(
  rules: readonly EditorialRuleRecord[],
): ContentRuleCandidate[] {
  return rules
    .filter((rule) => shouldStageManualReview(rule))
    .sort((left, right) => left.order_no - right.order_no)
    .map((rule) => ({
      ruleId: rule.id,
      reason: deriveManualReviewReason(rule),
      severity: rule.severity,
      actionKind: rule.action.kind,
    }));
}

function shouldStageManualReview(rule: EditorialRuleRecord): boolean {
  return (
    rule.enabled &&
    rule.rule_type === "content" &&
    rule.execution_mode !== "inspect" &&
    rule.confidence_policy !== "always_auto"
  );
}

function deriveManualReviewReason(rule: EditorialRuleRecord): string {
  if (
    typeof rule.manual_review_reason_template === "string" &&
    rule.manual_review_reason_template.trim().length > 0
  ) {
    return rule.manual_review_reason_template.trim();
  }

  if (rule.action.kind === "rewrite_content") {
    return "medical_meaning_risk";
  }

  if (rule.confidence_policy === "manual_only") {
    return "manual_only_rule";
  }

  return "requires_editor_review";
}

function resolveBeforeText(rule: EditorialRuleRecord): string {
  if (typeof rule.example_before === "string" && rule.example_before.length > 0) {
    return rule.example_before;
  }

  return typeof rule.trigger.text === "string" ? rule.trigger.text : rule.trigger.kind;
}

function resolveAfterText(rule: EditorialRuleRecord): string {
  if (typeof rule.example_after === "string" && rule.example_after.length > 0) {
    return rule.example_after;
  }

  return typeof rule.action.to === "string" ? rule.action.to : rule.action.kind;
}

function readScopeSection(rule: EditorialRuleRecord): string | undefined {
  const sections = Array.isArray(rule.scope.sections)
    ? rule.scope.sections.filter((section): section is string => typeof section === "string")
    : [];

  return sections[0];
}

export { deriveManualReviewReason };
