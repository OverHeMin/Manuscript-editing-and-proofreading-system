import type { EditorialRuleRepository } from "./editorial-rule-repository.ts";
import type {
  EditorialRuleRecord,
} from "./editorial-rule-record.ts";
import {
  deriveEditorialRuleExecutionPosture,
  getEditorialRuleObjectCatalogEntry,
  type EditorialRuleExecutionPosture,
} from "./editorial-rule-object-catalog.ts";
import {
  EditorialRuleResolutionService,
  createEditorialRuleCoverageKey,
  type EditorialRuleResolutionResult,
  type ResolvedEditorialRule,
  type ResolveEditorialRulesInput,
} from "./editorial-rule-resolution-service.ts";
import type {
  DocumentStructureTableSemanticCoordinate,
  DocumentStructureTableSnapshot,
} from "../document-pipeline/document-structure-service.ts";
import {
  EditorialRuleTableHitService,
  type EditorialRuleTableHit,
} from "./editorial-rule-table-hit-service.ts";

export interface PreviewEditorialRuleInput {
  ruleId: string;
  sampleText: string;
  tableSnapshots?: DocumentStructureTableSnapshot[];
}

export interface PreviewResolvedEditorialRulesInput
  extends ResolveEditorialRulesInput {
  sampleText: string;
  ruleObject?: string;
  tableSnapshots?: DocumentStructureTableSnapshot[];
}

export interface EditorialRulePreviewMatchedRule {
  rule_id: string;
  rule_object: string;
  coverage_key: string;
  execution_posture: EditorialRuleExecutionPosture;
  overridden_rule_ids: string[];
  reason: string;
  semantic_target?: DocumentStructureTableSemanticCoordinate["target"];
  semantic_coordinate?: DocumentStructureTableSemanticCoordinate;
}

export interface EditorialRulePreviewResult {
  matched_rule_ids: string[];
  overridden_rule_ids: string[];
  reasons: string[];
  output?: string;
  execution_posture: EditorialRuleExecutionPosture;
  inspect_only: boolean;
  matched_rules: EditorialRulePreviewMatchedRule[];
}

export interface EditorialRulePreviewServiceOptions {
  repository: Pick<EditorialRuleRepository, "findRuleById">;
  resolutionService: Pick<EditorialRuleResolutionService, "resolve">;
  tableHitService?: Pick<EditorialRuleTableHitService, "findMatches">;
}

export class EditorialRulePreviewRuleNotFoundError extends Error {
  constructor(ruleId: string) {
    super(`Editorial rule ${ruleId} was not found for preview.`);
    this.name = "EditorialRulePreviewRuleNotFoundError";
  }
}

export class EditorialRulePreviewService {
  private readonly repository: Pick<EditorialRuleRepository, "findRuleById">;
  private readonly resolutionService: Pick<
    EditorialRuleResolutionService,
    "resolve"
  >;
  private readonly tableHitService: Pick<
    EditorialRuleTableHitService,
    "findMatches"
  >;

  constructor(options: EditorialRulePreviewServiceOptions) {
    this.repository = options.repository;
    this.resolutionService = options.resolutionService;
    this.tableHitService = options.tableHitService ?? new EditorialRuleTableHitService();
  }

  async previewRule(
    input: PreviewEditorialRuleInput,
  ): Promise<EditorialRulePreviewResult> {
    const rule = await this.repository.findRuleById(input.ruleId);
    if (!rule) {
      throw new EditorialRulePreviewRuleNotFoundError(input.ruleId);
    }

    return finalizePreviewResult(
      [
        evaluateRulePreview({
          rule,
          sampleText: input.sampleText,
          tableSnapshots: input.tableSnapshots,
          reason: "Preview matched the requested rule.",
          overriddenRuleIds: [],
          tableHitService: this.tableHitService,
        }),
      ].filter(isDefined),
      input.sampleText,
    );
  }

  async previewResolvedRules(
    input: PreviewResolvedEditorialRulesInput,
  ): Promise<EditorialRulePreviewResult> {
    const resolution = await this.resolutionService.resolve(input);
    const candidateRules = input.ruleObject
      ? resolution.resolved_rules.filter(
          (entry) => entry.rule.rule_object === input.ruleObject,
        )
      : resolution.resolved_rules;

    const previews = candidateRules
      .map((entry) =>
        evaluateResolvedRulePreview({
          entry,
          sampleText: input.sampleText,
          tableSnapshots: input.tableSnapshots,
          resolution,
          tableHitService: this.tableHitService,
        }),
      )
      .filter(isDefined);

    return finalizePreviewResult(previews, input.sampleText);
  }
}

interface MatchedRulePreview {
  matched_rule: EditorialRulePreviewMatchedRule;
  reasons: string[];
  output?: string;
}

function evaluateResolvedRulePreview(input: {
  entry: ResolvedEditorialRule;
  sampleText: string;
  tableSnapshots?: DocumentStructureTableSnapshot[];
  resolution: EditorialRuleResolutionResult;
  tableHitService: Pick<EditorialRuleTableHitService, "findMatches">;
}): MatchedRulePreview | undefined {
  return evaluateRulePreview({
    rule: input.entry.rule,
    sampleText: input.sampleText,
    tableSnapshots: input.tableSnapshots,
    reason: input.entry.resolution_reason,
    overriddenRuleIds: input.entry.overridden_rule_ids,
    coverageKey: input.entry.coverage_key,
    executionPosture: input.entry.execution_posture,
    tableHitService: input.tableHitService,
  });
}

function evaluateRulePreview(input: {
  rule: EditorialRuleRecord;
  sampleText: string;
  tableSnapshots?: DocumentStructureTableSnapshot[];
  reason: string;
  overriddenRuleIds: string[];
  coverageKey?: string;
  executionPosture?: EditorialRuleExecutionPosture;
  tableHitService: Pick<EditorialRuleTableHitService, "findMatches">;
}): MatchedRulePreview | undefined {
  const matchedTableHit = findMatchedTableHit(input);
  if (input.rule.rule_object === "table") {
    if (!matchedTableHit) {
      return undefined;
    }
  } else if (!matchesRule(input.rule, input.sampleText)) {
    return undefined;
  }

  const executionPosture =
    input.executionPosture ??
    deriveEditorialRuleExecutionPosture({
      rule_object: input.rule.rule_object,
      execution_mode: input.rule.execution_mode,
      confidence_policy: input.rule.confidence_policy,
    });
  const transformedOutput = applyRuleTransformation(
    input.rule,
    input.sampleText,
    executionPosture,
  );

  return {
    matched_rule: {
      rule_id: input.rule.id,
      rule_object: input.rule.rule_object,
      coverage_key:
        input.coverageKey ?? createEditorialRuleCoverageKey(input.rule),
      execution_posture: executionPosture,
      overridden_rule_ids: [...input.overriddenRuleIds],
      reason: input.reason,
      ...(matchedTableHit
        ? {
            semantic_target: matchedTableHit.semantic_target,
            semantic_coordinate: cloneCoordinate(
              matchedTableHit.semantic_coordinate,
            ),
          }
        : {}),
    },
    reasons: buildPreviewReasons(input.rule, input.reason, matchedTableHit),
    ...(transformedOutput !== undefined ? { output: transformedOutput } : {}),
  };
}

function finalizePreviewResult(
  matchedPreviews: MatchedRulePreview[],
  originalText: string,
): EditorialRulePreviewResult {
  const matchedRuleIds = matchedPreviews.map(
    (preview) => preview.matched_rule.rule_id,
  );
  const overriddenRuleIds = [
    ...new Set(
      matchedPreviews.flatMap((preview) => preview.matched_rule.overridden_rule_ids),
    ),
  ];
  const reasons = matchedPreviews.flatMap((preview) => preview.reasons);
  const matchedRules = matchedPreviews.map((preview) => preview.matched_rule);

  let currentOutput = originalText;
  let transformed = false;

  for (const preview of matchedPreviews) {
    if (preview.output === undefined) {
      continue;
    }

    currentOutput = preview.output;
    transformed = true;
  }

  const executionPosture = derivePreviewExecutionPosture(matchedRules);

  return {
    matched_rule_ids: matchedRuleIds,
    overridden_rule_ids: overriddenRuleIds,
    reasons,
    ...(transformed ? { output: currentOutput } : {}),
    execution_posture: executionPosture,
    inspect_only: executionPosture === "inspect_only",
    matched_rules: matchedRules,
  };
}

function derivePreviewExecutionPosture(
  matchedRules: EditorialRulePreviewMatchedRule[],
): EditorialRuleExecutionPosture {
  if (matchedRules.some((rule) => rule.execution_posture === "guarded")) {
    return "guarded";
  }

  if (matchedRules.some((rule) => rule.execution_posture === "auto")) {
    return "auto";
  }

  return "inspect_only";
}

function matchesRule(rule: EditorialRuleRecord, sampleText: string): boolean {
  switch (rule.trigger.kind) {
    case "exact_text":
      return (
        typeof rule.trigger.text === "string" &&
        sampleText.includes(rule.trigger.text)
      );
    case "structural_presence":
      return (
        typeof rule.trigger.field === "string" &&
        sampleText.toLowerCase().includes(String(rule.trigger.field).toLowerCase())
      );
    case "table_shape":
      return (
        typeof rule.trigger.layout === "string" &&
        sampleText.toLowerCase().includes(String(rule.trigger.layout).toLowerCase())
      );
    default:
      return false;
  }
}

function applyRuleTransformation(
  rule: EditorialRuleRecord,
  sampleText: string,
  executionPosture: EditorialRuleExecutionPosture,
): string | undefined {
  if (executionPosture === "inspect_only") {
    return undefined;
  }

  const objectEntry = getEditorialRuleObjectCatalogEntry(rule.rule_object);
  if (objectEntry.preview_strategy !== "text_transform") {
    return undefined;
  }

  if (
    typeof rule.trigger.text === "string" &&
    typeof rule.action.to === "string" &&
    (rule.action.kind === "replace_heading" || rule.action.kind === "replace_text")
  ) {
    return sampleText.replace(rule.trigger.text, rule.action.to);
  }

  return undefined;
}

function buildPreviewReasons(
  rule: EditorialRuleRecord,
  primaryReason: string,
  matchedTableHit?: EditorialRuleTableHit,
): string[] {
  const reasons = [primaryReason];

  if (rule.explanation_payload?.rationale) {
    reasons.push(rule.explanation_payload.rationale);
  }

  if (rule.trigger.kind === "exact_text" && typeof rule.trigger.text === "string") {
    reasons.push(`Matched exact_text trigger "${rule.trigger.text}".`);
  }

  if (matchedTableHit) {
    reasons.push(matchedTableHit.reason);
  }

  return reasons;
}

function findMatchedTableHit(input: {
  rule: EditorialRuleRecord;
  tableSnapshots?: DocumentStructureTableSnapshot[];
  tableHitService: Pick<EditorialRuleTableHitService, "findMatches">;
}): EditorialRuleTableHit | undefined {
  if (input.rule.rule_object !== "table" || !input.tableSnapshots?.length) {
    return undefined;
  }

  return input.tableHitService.findMatches({
    rule: input.rule,
    tableSnapshots: input.tableSnapshots,
  })[0];
}

function cloneCoordinate(
  coordinate: DocumentStructureTableSemanticCoordinate,
): DocumentStructureTableSemanticCoordinate {
  return {
    ...coordinate,
    header_path: coordinate.header_path ? [...coordinate.header_path] : undefined,
  };
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
