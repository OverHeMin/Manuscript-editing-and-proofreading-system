import {
  DEFAULT_EDITORIAL_RULE_PRIORITY,
} from "./editorial-rule-record.ts";
import type { EditorialRuleConflictKind } from "./editorial-rule-conflict-service.ts";
import type {
  EditorialRuleRecord,
  EditorialRuleSetRecord,
} from "./editorial-rule-record.ts";
import type { EditorialRuleRepository } from "./editorial-rule-repository.ts";
import {
  deriveEditorialRuleExecutionPosture,
  type EditorialRuleExecutionPosture,
} from "./editorial-rule-object-catalog.ts";

export interface ResolveEditorialRulesInput {
  templateFamilyId: string;
  module: EditorialRuleSetRecord["module"];
  journalTemplateId?: string;
  manuscriptType?: string;
  section?: string;
  objectGranularity?: string;
}

export interface EditorialRuleResolutionResult {
  baseRuleSet?: EditorialRuleSetRecord;
  journalRuleSet?: EditorialRuleSetRecord;
  rules: EditorialRuleRecord[];
  resolved_rules: ResolvedEditorialRule[];
  overrides: EditorialRuleOverrideRecord[];
}

export interface ResolvedEditorialRule {
  rule: EditorialRuleRecord;
  coverage_key: string;
  source_layer: "base" | "journal";
  overridden_rule_ids: string[];
  resolution_reason: string;
  execution_posture: EditorialRuleExecutionPosture;
  conflict_kind?: Exclude<EditorialRuleConflictKind, "exclusive_conflict">;
}

export interface EditorialRuleOverrideRecord {
  active_rule_id: string;
  overridden_rule_id: string;
  reason: string;
}

export interface EditorialRuleResolutionServiceOptions {
  repository: Pick<
    EditorialRuleRepository,
    "listRuleSetsByTemplateFamilyAndModule" | "listRulesByRuleSetId"
  >;
}

export class EditorialRuleResolutionService {
  private readonly repository: Pick<
    EditorialRuleRepository,
    "listRuleSetsByTemplateFamilyAndModule" | "listRulesByRuleSetId"
  >;

  constructor(options: EditorialRuleResolutionServiceOptions) {
    this.repository = options.repository;
  }

  async resolve(
    input: ResolveEditorialRulesInput,
  ): Promise<EditorialRuleResolutionResult> {
    const ruleSets = await this.repository.listRuleSetsByTemplateFamilyAndModule(
      input.templateFamilyId,
      input.module,
    );

    const baseRuleSet = selectPublishedRuleSet(ruleSets, undefined);
    const journalRuleSet = input.journalTemplateId
      ? selectPublishedRuleSet(ruleSets, input.journalTemplateId)
      : undefined;

    const baseRules = baseRuleSet
      ? (await this.repository.listRulesByRuleSetId(baseRuleSet.id)).filter(
          (rule) => rule.enabled,
        )
      : [];
    const journalRules = journalRuleSet
      ? (await this.repository.listRulesByRuleSetId(journalRuleSet.id)).filter(
          (rule) => rule.enabled,
        )
      : [];
    const normalizedBase = normalizeLayerRules(
      filterRulesByRuntimeScope(baseRules, input),
      "base",
    );
    const normalizedJournal = normalizeLayerRules(
      filterRulesByRuntimeScope(journalRules, input),
      "journal",
    );
    const overlaid = overlayRules(
      normalizedBase.resolved_rules,
      normalizedJournal.resolved_rules,
    );
    const annotatedResolvedRules = annotateResolvedRuleConflictKinds(
      overlaid.resolved_rules,
    );

    return {
      baseRuleSet,
      journalRuleSet,
      rules: annotatedResolvedRules.map((entry) => entry.rule),
      resolved_rules: annotatedResolvedRules,
      overrides: [
        ...normalizedBase.overrides,
        ...normalizedJournal.overrides,
        ...overlaid.overrides,
      ],
    };
  }
}

function selectPublishedRuleSet(
  ruleSets: EditorialRuleSetRecord[],
  journalTemplateId: string | undefined,
): EditorialRuleSetRecord | undefined {
  return ruleSets
    .filter(
      (ruleSet) =>
        (ruleSet.status === "active" || ruleSet.status === "published") &&
        (ruleSet.journal_template_id ?? undefined) === journalTemplateId,
    )
    .sort(compareRuleSetsDescending)[0];
}

function compareRuleSetsDescending(
  left: EditorialRuleSetRecord,
  right: EditorialRuleSetRecord,
): number {
  const leftPriority = getResolvableRuleSetStatusPriority(left.status);
  const rightPriority = getResolvableRuleSetStatusPriority(right.status);
  if (leftPriority !== rightPriority) {
    return rightPriority - leftPriority;
  }

  if (left.version_no !== right.version_no) {
    return right.version_no - left.version_no;
  }

  return right.id.localeCompare(left.id);
}

function getResolvableRuleSetStatusPriority(
  status: EditorialRuleSetRecord["status"],
): number {
  switch (status) {
    case "active":
      return 2;
    case "published":
      return 1;
    default:
      return 0;
  }
}

function overlayRules(
  baseRules: ResolvedEditorialRule[],
  journalRules: ResolvedEditorialRule[],
): {
  resolved_rules: ResolvedEditorialRule[];
  overrides: EditorialRuleOverrideRecord[];
} {
  if (journalRules.length === 0) {
    return {
      resolved_rules: [...baseRules],
      overrides: [],
    };
  }

  const journalByCoverageKey = new Map(
    journalRules.map((entry) => [entry.coverage_key, entry]),
  );
  const resolvedRules: ResolvedEditorialRule[] = [];
  const overrides: EditorialRuleOverrideRecord[] = [];
  const consumedJournalKeys = new Set<string>();

  for (const entry of baseRules) {
    const journalOverride = journalByCoverageKey.get(entry.coverage_key);
    if (journalOverride) {
      const reason = `Journal template override matched coverage key "${entry.coverage_key}".`;
      resolvedRules.push({
        ...journalOverride,
        overridden_rule_ids: [
          ...journalOverride.overridden_rule_ids,
          entry.rule.id,
        ],
        resolution_reason: reason,
      });
      overrides.push({
        active_rule_id: journalOverride.rule.id,
        overridden_rule_id: entry.rule.id,
        reason,
      });
      consumedJournalKeys.add(entry.coverage_key);
      continue;
    }

    resolvedRules.push(entry);
  }

  for (const entry of journalRules) {
    if (consumedJournalKeys.has(entry.coverage_key)) {
      continue;
    }

    resolvedRules.push({
      ...entry,
      resolution_reason: `Journal template added coverage key "${entry.coverage_key}".`,
    });
  }

  return {
    resolved_rules: resolvedRules,
    overrides,
  };
}

function normalizeLayerRules(
  rules: EditorialRuleRecord[],
  sourceLayer: "base" | "journal",
): {
  resolved_rules: ResolvedEditorialRule[];
  overrides: EditorialRuleOverrideRecord[];
} {
  const activeByCoverageKey = new Map<string, ResolvedEditorialRule>();
  const resolvedRules: ResolvedEditorialRule[] = [];
  const overrides: EditorialRuleOverrideRecord[] = [];

  for (const rule of rules) {
    const coverageKey = createEditorialRuleCoverageKey(rule);
    const existing = activeByCoverageKey.get(coverageKey);

    if (existing) {
      const comparison = compareRuleResolutionCandidates(rule, existing.rule);
      const winningRule = comparison.winner === "current" ? rule : existing.rule;
      const losingRule = comparison.winner === "current" ? existing.rule : rule;
      const reason = `Same-layer conflict retained the ${comparison.reason} for coverage key "${coverageKey}".`;

      if (comparison.winner === "current") {
        const replacement: ResolvedEditorialRule = {
          ...createResolvedRule(rule, coverageKey, sourceLayer),
          overridden_rule_ids: [...existing.overridden_rule_ids, existing.rule.id],
          resolution_reason: reason,
        };
        activeByCoverageKey.set(coverageKey, replacement);
        const existingIndex = resolvedRules.findIndex(
          (entry) => entry.coverage_key === coverageKey,
        );
        if (existingIndex >= 0) {
          resolvedRules[existingIndex] = replacement;
        }
      } else {
        existing.overridden_rule_ids = [...existing.overridden_rule_ids, rule.id];
      }

      overrides.push({
        active_rule_id: winningRule.id,
        overridden_rule_id: losingRule.id,
        reason,
      });
      continue;
    }

    const resolvedRule = createResolvedRule(rule, coverageKey, sourceLayer);

    activeByCoverageKey.set(coverageKey, resolvedRule);
    resolvedRules.push(resolvedRule);
  }

  return {
    resolved_rules: resolvedRules,
    overrides,
  };
}

function filterRulesByRuntimeScope(
  rules: EditorialRuleRecord[],
  input: ResolveEditorialRulesInput,
): EditorialRuleRecord[] {
  return rules.filter((rule) => {
    if (!matchesScopeDimension(rule.scope.manuscript_types, input.manuscriptType)) {
      return false;
    }

    if (!matchesScopeDimension(rule.scope.sections, input.section)) {
      return false;
    }

    if (
      !matchesScopeDimension(
        readRuleObjectGranularity(rule),
        input.objectGranularity,
      )
    ) {
      return false;
    }

    return true;
  });
}

function matchesScopeDimension(
  candidates: string[] | undefined,
  requestedValue: string | undefined,
): boolean {
  if (!requestedValue) {
    return true;
  }

  if (!candidates || candidates.length === 0) {
    return true;
  }

  return candidates.includes(requestedValue);
}

function readRuleObjectGranularity(rule: EditorialRuleRecord): string[] | undefined {
  if (Array.isArray(rule.scope.object_granularity)) {
    return normalizeStringArray(rule.scope.object_granularity);
  }

  const blockKind = typeof rule.scope.block_kind === "string"
    ? rule.scope.block_kind.trim()
    : "";
  return blockKind.length > 0 ? [blockKind] : undefined;
}

function createResolvedRule(
  rule: EditorialRuleRecord,
  coverageKey: string,
  sourceLayer: "base" | "journal",
): ResolvedEditorialRule {
  return {
    rule,
    coverage_key: coverageKey,
    source_layer: sourceLayer,
    overridden_rule_ids: [],
    resolution_reason:
      sourceLayer === "base"
        ? `Selected base published rule for coverage key "${coverageKey}".`
        : `Selected journal published rule for coverage key "${coverageKey}".`,
    execution_posture: deriveEditorialRuleExecutionPosture({
      rule_object: rule.rule_object,
      execution_mode: rule.execution_mode,
      confidence_policy: rule.confidence_policy,
    }),
  };
}

function annotateResolvedRuleConflictKinds(
  resolvedRules: ResolvedEditorialRule[],
): ResolvedEditorialRule[] {
  const shouldAnnotateMerge = resolvedRules.length > 1;

  return resolvedRules.map((entry) => ({
    ...entry,
    ...(entry.overridden_rule_ids.length > 0
      ? {
          conflict_kind: "override" as const,
        }
      : shouldAnnotateMerge
        ? {
            conflict_kind: "merge" as const,
          }
        : {}),
  }));
}

function compareRuleResolutionCandidates(
  current: EditorialRuleRecord,
  existing: EditorialRuleRecord,
): {
  winner: "current" | "existing";
  reason: "higher-priority rule" | "narrower-scope rule" | "earliest rule";
} {
  const currentPriority = normalizeRulePriority(current.priority);
  const existingPriority = normalizeRulePriority(existing.priority);
  if (currentPriority !== existingPriority) {
    return currentPriority > existingPriority
      ? { winner: "current", reason: "higher-priority rule" }
      : { winner: "existing", reason: "higher-priority rule" };
  }

  const currentSpecificity = getRuleScopeSpecificityScore(current);
  const existingSpecificity = getRuleScopeSpecificityScore(existing);
  if (currentSpecificity !== existingSpecificity) {
    return currentSpecificity > existingSpecificity
      ? { winner: "current", reason: "narrower-scope rule" }
      : { winner: "existing", reason: "narrower-scope rule" };
  }

  if (current.order_no !== existing.order_no) {
    return current.order_no < existing.order_no
      ? { winner: "current", reason: "earliest rule" }
      : { winner: "existing", reason: "earliest rule" };
  }

  return current.id.localeCompare(existing.id) < 0
    ? { winner: "current", reason: "earliest rule" }
    : { winner: "existing", reason: "earliest rule" };
}

function getRuleScopeSpecificityScore(rule: EditorialRuleRecord): number {
  const manuscriptTypes = normalizeStringArray(rule.scope.manuscript_types);
  const sections = normalizeStringArray(rule.scope.sections);
  const objectGranularity = normalizeStringArray(readRuleObjectGranularity(rule));
  const dimensionCount =
    countSpecifiedDimension(manuscriptTypes) +
    countSpecifiedDimension(sections) +
    countSpecifiedDimension(objectGranularity);
  const valueCount =
    manuscriptTypes.length + sections.length + objectGranularity.length;
  const granularityWeight = objectGranularity.reduce(
    (current, entry) => current + getObjectGranularitySpecificity(entry),
    0,
  );

  return dimensionCount * 1000 - valueCount * 10 + granularityWeight;
}

function countSpecifiedDimension(value: string[]): number {
  return value.length > 0 ? 1 : 0;
}

function getObjectGranularitySpecificity(value: string): number {
  switch (value) {
    case "table_header":
    case "table_cell":
    case "footnote_item":
      return 3;
    case "heading":
    case "reference_entry":
    case "declaration_block":
      return 2;
    default:
      return 1;
  }
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function normalizeRulePriority(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_EDITORIAL_RULE_PRIORITY;
  }

  return Math.max(0, Math.trunc(value));
}

export function createEditorialRuleCoverageKey(
  rule: Pick<EditorialRuleRecord, "rule_object" | "selector" | "trigger">,
): string {
  return [
    rule.rule_object,
    stableSerialize(rule.selector),
    stableSerialize(rule.trigger),
  ].join("::");
}

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([leftKey], [rightKey]) => leftKey.localeCompare(rightKey),
  );
  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`)
    .join(",")}}`;
}
