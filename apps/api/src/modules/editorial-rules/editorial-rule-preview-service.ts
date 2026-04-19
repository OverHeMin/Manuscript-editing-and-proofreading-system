import type { EditorialRuleRepository } from "./editorial-rule-repository.ts";
import type {
  EditorialRuleRecord,
} from "./editorial-rule-record.ts";
import {
  EditorialRuleConflictService,
  type EditorialRuleConflictCandidate,
  type EditorialRuleConflictKind,
  type EditorialRuleConflictRecord,
} from "./editorial-rule-conflict-service.ts";
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
  describeEditorialRuleManualReviewReason,
  describeEditorialRuleMissReason,
} from "../editorial-execution/editorial-rule-expectation.ts";
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
  conflict_kind?: EditorialRuleConflictKind;
  reason: string;
  hit_reason: string;
  override_reason?: string;
  manual_review_reason: string;
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
  conflicts: EditorialRuleConflictRecord[];
  manual_review_required: boolean;
  manual_review_reason?: string;
  miss_reason?: string;
  matched_rules: EditorialRulePreviewMatchedRule[];
}

export interface EditorialRulePreviewServiceOptions {
  repository: Pick<EditorialRuleRepository, "findRuleById">;
  resolutionService: Pick<EditorialRuleResolutionService, "resolve">;
  tableHitService?: Pick<EditorialRuleTableHitService, "findMatches">;
  conflictService?: EditorialRuleConflictService;
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
  private readonly conflictService: EditorialRuleConflictService;

  constructor(options: EditorialRulePreviewServiceOptions) {
    this.repository = options.repository;
    this.resolutionService = options.resolutionService;
    this.tableHitService = options.tableHitService ?? new EditorialRuleTableHitService();
    this.conflictService = options.conflictService ?? new EditorialRuleConflictService();
  }

  async previewRule(
    input: PreviewEditorialRuleInput,
  ): Promise<EditorialRulePreviewResult> {
    const rule = await this.repository.findRuleById(input.ruleId);
    if (!rule) {
      throw new EditorialRulePreviewRuleNotFoundError(input.ruleId);
    }

    const matchedPreview = evaluateRulePreview({
      rule,
      sampleText: input.sampleText,
      tableSnapshots: input.tableSnapshots,
      reason: "Preview matched the requested rule.",
      overriddenRuleIds: [],
      tableHitService: this.tableHitService,
    });

    if (!matchedPreview) {
      return buildMissedPreviewResult(rule);
    }

    return finalizePreviewResult(
      [matchedPreview],
      input.sampleText,
      this.conflictService,
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

    return finalizePreviewResult(
      previews,
      input.sampleText,
      this.conflictService,
      candidateRules.length > 0
        ? "No resolved rule matched the sample text or structure."
        : "No published rule was available for the requested scope.",
    );
  }
}

interface MatchedRulePreview {
  rule: EditorialRuleRecord;
  matched_rule: EditorialRulePreviewMatchedRule;
  reasons: string[];
  output?: string;
  target_key?: string;
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
    conflictKind: input.entry.conflict_kind,
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
  conflictKind?: Exclude<EditorialRuleConflictKind, "exclusive_conflict">;
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
  const hitReasons = buildPreviewReasons(input.rule, input.reason, matchedTableHit);
  const coverageKey = input.coverageKey ?? createEditorialRuleCoverageKey(input.rule);
  const targetKey = deriveConflictTargetKey(input.rule, matchedTableHit);

  return {
    rule: input.rule,
    matched_rule: {
      rule_id: input.rule.id,
      rule_object: input.rule.rule_object,
      coverage_key: coverageKey,
      execution_posture: executionPosture,
      overridden_rule_ids: [...input.overriddenRuleIds],
      ...(input.conflictKind
        ? {
            conflict_kind: input.conflictKind,
          }
        : {}),
      reason: input.reason,
      hit_reason: hitReasons.join(" "),
      ...(input.overriddenRuleIds.length > 0
        ? {
            override_reason: input.reason,
          }
        : {}),
      manual_review_reason: describeEditorialRuleManualReviewReason({
        rule: input.rule,
        executionPosture,
        conflictKind: input.conflictKind,
      }),
      ...(matchedTableHit
        ? {
            semantic_target: matchedTableHit.semantic_target,
            semantic_coordinate: cloneCoordinate(
              matchedTableHit.semantic_coordinate,
            ),
          }
        : {}),
    },
    reasons: hitReasons,
    ...(transformedOutput !== undefined ? { output: transformedOutput } : {}),
    ...(targetKey
      ? {
          target_key: targetKey,
        }
      : {}),
  };
}

function finalizePreviewResult(
  matchedPreviews: MatchedRulePreview[],
  originalText: string,
  conflictService: EditorialRuleConflictService,
  missReason?: string,
): EditorialRulePreviewResult {
  const conflicts = conflictService.classifyPreviewConflicts(
    matchedPreviews.map((preview): EditorialRuleConflictCandidate => ({
      rule_id: preview.matched_rule.rule_id,
      coverage_key: preview.matched_rule.coverage_key,
      target_key: preview.target_key,
      output: preview.output,
      execution_posture: preview.matched_rule.execution_posture,
      overridden_rule_ids: preview.matched_rule.overridden_rule_ids,
      reason: preview.matched_rule.reason,
    })),
  );
  const exclusiveConflictRuleIds = new Set(
    conflicts
      .filter((conflict) => conflict.kind === "exclusive_conflict")
      .flatMap((conflict) => conflict.rule_ids),
  );
  const mergeRuleIds = new Set(
    conflicts
      .filter((conflict) => conflict.kind === "merge")
      .flatMap((conflict) => conflict.rule_ids),
  );
  const overrideWinnerIds = new Set(
    conflicts
      .filter((conflict) => conflict.kind === "override")
      .map((conflict) => conflict.winning_rule_id)
      .filter((value): value is string => Boolean(value)),
  );
  const matchedRules = matchedPreviews.map((preview) => {
    const nextConflictKind = exclusiveConflictRuleIds.has(preview.matched_rule.rule_id)
      ? "exclusive_conflict"
      : overrideWinnerIds.has(preview.matched_rule.rule_id) ||
          preview.matched_rule.overridden_rule_ids.length > 0
        ? "override"
        : mergeRuleIds.has(preview.matched_rule.rule_id)
          ? "merge"
          : preview.matched_rule.conflict_kind;

    return {
      ...preview.matched_rule,
      ...(nextConflictKind
        ? {
            conflict_kind: nextConflictKind,
          }
        : {}),
      manual_review_reason: describeEditorialRuleManualReviewReason({
        rule: preview.rule,
        executionPosture: preview.matched_rule.execution_posture,
        conflictKind: nextConflictKind,
      }),
    };
  });
  const matchedRuleIds = matchedRules.map((rule) => rule.rule_id);
  const overriddenRuleIds = [
    ...new Set(matchedRules.flatMap((rule) => rule.overridden_rule_ids)),
  ];
  const reasons = matchedPreviews.flatMap((preview) => preview.reasons);
  const hasExclusiveConflict = conflicts.some(
    (conflict) => conflict.kind === "exclusive_conflict",
  );

  let currentOutput = originalText;
  let transformed = false;

  if (!hasExclusiveConflict) {
    for (const preview of matchedPreviews) {
      if (preview.output === undefined) {
        continue;
      }

      currentOutput = preview.output;
      transformed = true;
    }
  }

  const executionPosture = hasExclusiveConflict
    ? "guarded"
    : derivePreviewExecutionPosture(matchedRules);
  const manualReviewRequired = hasExclusiveConflict || executionPosture !== "auto";
  const manualReviewReason = hasExclusiveConflict
    ? "Human confirmation is required because multiple rules proposed incompatible actions on the same target."
    : matchedRules.find((rule) => rule.execution_posture !== "auto")
      ?.manual_review_reason;

  return {
    matched_rule_ids: matchedRuleIds,
    overridden_rule_ids: overriddenRuleIds,
    reasons,
    ...(transformed ? { output: currentOutput } : {}),
    execution_posture: executionPosture,
    inspect_only: executionPosture === "inspect_only",
    conflicts,
    manual_review_required: manualReviewRequired,
    ...(manualReviewReason
      ? {
          manual_review_reason: manualReviewReason,
        }
      : {}),
    ...(matchedRules.length === 0 && missReason
      ? {
          miss_reason: missReason,
        }
      : {}),
    matched_rules: matchedRules,
  };
}

function buildMissedPreviewResult(
  rule: EditorialRuleRecord,
): EditorialRulePreviewResult {
  const executionPosture = deriveEditorialRuleExecutionPosture({
    rule_object: rule.rule_object,
    execution_mode: rule.execution_mode,
    confidence_policy: rule.confidence_policy,
  });

  return {
    matched_rule_ids: [],
    overridden_rule_ids: [],
    reasons: [],
    execution_posture: executionPosture,
    inspect_only: executionPosture === "inspect_only",
    conflicts: [],
    manual_review_required: false,
    miss_reason: describeEditorialRuleMissReason(rule),
    matched_rules: [],
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

function deriveConflictTargetKey(
  rule: EditorialRuleRecord,
  matchedTableHit?: EditorialRuleTableHit,
): string | undefined {
  if (matchedTableHit) {
    return `table::${JSON.stringify(matchedTableHit.semantic_coordinate)}`;
  }

  if (typeof rule.trigger.text === "string" && rule.trigger.text.trim().length > 0) {
    return `text::${rule.rule_object}::${rule.trigger.text}`;
  }

  if (
    rule.trigger.kind === "structural_presence" &&
    typeof rule.trigger.field === "string" &&
    rule.trigger.field.trim().length > 0
  ) {
    return `structural::${rule.rule_object}::${rule.trigger.field}`;
  }

  if (
    rule.trigger.kind === "table_shape" &&
    typeof rule.trigger.layout === "string" &&
    rule.trigger.layout.trim().length > 0
  ) {
    return `table_layout::${rule.trigger.layout}`;
  }

  return undefined;
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
