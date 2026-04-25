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
import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";

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

export type ResolvedEditorialRuleActivationSourceKind =
  | "template_family_rule_set"
  | "journal_template_rule_set";

export interface ResolvedEditorialRuleActivationSource {
  kind: ResolvedEditorialRuleActivationSourceKind;
  id: string;
}

export interface ResolvedEditorialRuleEffectiveScope {
  manuscript_types?: ManuscriptType[];
  sections?: string[];
  object_granularity?: string[];
}

export interface ResolvedEditorialRule {
  rule: EditorialRuleRecord;
  coverage_key: string;
  source_layer: "base" | "journal";
  overridden_rule_ids: string[];
  resolution_reason: string;
  execution_posture: EditorialRuleExecutionPosture;
  activation_source?: ResolvedEditorialRuleActivationSource;
  effective_scope?: ResolvedEditorialRuleEffectiveScope;
  overridden_sources?: ResolvedEditorialRuleActivationSource[];
  conflict_kind?: Exclude<EditorialRuleConflictKind, "exclusive_conflict">;
  governance_explanation?: string;
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

const LEGACY_FRONT_MATTER_AUTHOR_LINE_SHADOW_TARGET_BLOCK_KEYS = [
  "affiliation_line",
  "corresponding_author_bio",
] as const;
const LEGACY_FRONT_MATTER_AUTHOR_LINE_LEGACY_ONLY_SEMANTIC_ROLES = [
  "author_bio",
  "funding_statement",
  "classification_line",
  "front_matter",
] as const;

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
    journalRules.map((entry) => [resolveRuleResolutionKey(entry.rule, entry.coverage_key), entry]),
  );
  const resolvedRules: ResolvedEditorialRule[] = [];
  const overrides: EditorialRuleOverrideRecord[] = [];
  const consumedJournalKeys = new Set<string>();

  for (const entry of baseRules) {
    const resolutionKey = resolveRuleResolutionKey(entry.rule, entry.coverage_key);
    const journalOverride = journalByCoverageKey.get(resolutionKey);
    if (journalOverride) {
      const reason = `Journal template override matched ${describeResolutionMatchLabel(entry.coverage_key, resolutionKey)}.`;
      resolvedRules.push({
        ...journalOverride,
        overridden_rule_ids: [
          ...journalOverride.overridden_rule_ids,
          entry.rule.id,
        ],
        overridden_sources: dedupeActivationSources([
          ...(journalOverride.overridden_sources ?? []),
          resolveActivationSource(entry),
        ]),
        resolution_reason: reason,
      });
      overrides.push({
        active_rule_id: journalOverride.rule.id,
        overridden_rule_id: entry.rule.id,
        reason,
      });
      consumedJournalKeys.add(resolutionKey);
      continue;
    }

    resolvedRules.push(entry);
  }

  for (const entry of journalRules) {
    const resolutionKey = resolveRuleResolutionKey(entry.rule, entry.coverage_key);
    if (consumedJournalKeys.has(resolutionKey)) {
      continue;
    }

    resolvedRules.push({
      ...entry,
      resolution_reason: `Journal template added ${describeResolutionMatchLabel(
        entry.coverage_key,
        resolutionKey,
      )}.`,
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
  const activeByResolutionKey = new Map<string, ResolvedEditorialRule>();
  const resolvedRules: ResolvedEditorialRule[] = [];
  const overrides: EditorialRuleOverrideRecord[] = [];

  for (const rule of rules) {
    const coverageKey = createEditorialRuleCoverageKey(rule);
    const resolutionKey = resolveRuleResolutionKey(rule, coverageKey);
    const existing = activeByResolutionKey.get(resolutionKey);

    if (existing) {
      const comparison = compareRuleResolutionCandidates(rule, existing.rule);
      const winningRule = comparison.winner === "current" ? rule : existing.rule;
      const losingRule = comparison.winner === "current" ? existing.rule : rule;
      const reason = `Same-layer conflict retained the ${comparison.reason} for ${describeResolutionMatchLabel(
        coverageKey,
        resolutionKey,
      )}.`;

      if (comparison.winner === "current") {
        const replacement: ResolvedEditorialRule = {
          ...createResolvedRule(rule, coverageKey, sourceLayer),
          overridden_rule_ids: [...existing.overridden_rule_ids, existing.rule.id],
          overridden_sources: dedupeActivationSources([
            ...(existing.overridden_sources ?? []),
            resolveActivationSource(existing),
          ]),
          resolution_reason: reason,
        };
        activeByResolutionKey.set(resolutionKey, replacement);
        const existingIndex = resolvedRules.findIndex(
          (entry) =>
            resolveRuleResolutionKey(entry.rule, entry.coverage_key) ===
            resolutionKey,
        );
        if (existingIndex >= 0) {
          resolvedRules[existingIndex] = replacement;
        }
      } else {
        existing.overridden_rule_ids = [...existing.overridden_rule_ids, rule.id];
        existing.overridden_sources = dedupeActivationSources([
          ...(existing.overridden_sources ?? []),
          createResolvedRuleActivationSource(sourceLayer, rule.rule_set_id),
        ]);
      }

      overrides.push({
        active_rule_id: winningRule.id,
        overridden_rule_id: losingRule.id,
        reason,
      });
      continue;
    }

    const resolvedRule = createResolvedRule(rule, coverageKey, sourceLayer);

    activeByResolutionKey.set(resolutionKey, resolvedRule);
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
    resolution_reason: buildSelectedRuleResolutionReason({
      rule,
      coverageKey,
      sourceLayer,
    }),
    execution_posture: deriveEditorialRuleExecutionPosture({
      rule_object: rule.rule_object,
      execution_mode: rule.execution_mode,
      confidence_policy: rule.confidence_policy,
    }),
    governance_explanation: buildRuleGovernanceExplanation(rule),
    activation_source: createResolvedRuleActivationSource(
      sourceLayer,
      rule.rule_set_id,
    ),
    effective_scope: readResolvedRuleEffectiveScope(rule),
    overridden_sources: [],
  };
}

function createResolvedRuleActivationSource(
  sourceLayer: "base" | "journal",
  ruleSetId: string,
): ResolvedEditorialRuleActivationSource {
  return {
    kind:
      sourceLayer === "journal"
        ? "journal_template_rule_set"
        : "template_family_rule_set",
    id: ruleSetId,
  };
}

function resolveActivationSource(
  rule: Pick<ResolvedEditorialRule, "activation_source" | "source_layer" | "rule">,
): ResolvedEditorialRuleActivationSource {
  return (
    rule.activation_source ??
    createResolvedRuleActivationSource(rule.source_layer, rule.rule.rule_set_id)
  );
}

function readResolvedRuleEffectiveScope(
  rule: EditorialRuleRecord,
): ResolvedEditorialRuleEffectiveScope | undefined {
  const manuscriptTypes = normalizeStringArray(rule.scope.manuscript_types);
  const sections = normalizeStringArray(rule.scope.sections);
  const objectGranularity = normalizeStringArray(readRuleObjectGranularity(rule));

  if (
    manuscriptTypes.length === 0 &&
    sections.length === 0 &&
    objectGranularity.length === 0
  ) {
    return undefined;
  }

  return {
    ...(manuscriptTypes.length > 0
      ? { manuscript_types: manuscriptTypes as ManuscriptType[] }
      : {}),
    ...(sections.length > 0 ? { sections } : {}),
    ...(objectGranularity.length > 0
      ? { object_granularity: objectGranularity }
      : {}),
  };
}

function dedupeActivationSources(
  values: readonly ResolvedEditorialRuleActivationSource[],
): ResolvedEditorialRuleActivationSource[] {
  const seen = new Set<string>();
  const result: ResolvedEditorialRuleActivationSource[] = [];

  for (const value of values) {
    const key = `${value.kind}:${value.id}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
  }

  return result;
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

export function createEditorialRuleComparisonKey(
  rule: Pick<
    EditorialRuleRecord,
    "rule_object" | "selector" | "trigger" | "authoring_payload"
  >,
): string | undefined {
  const legacyFrontMatterBridge = readLegacyFrontMatterBridgeDescriptor(rule);
  if (legacyFrontMatterBridge) {
    return legacyFrontMatterBridge.comparison_key;
  }

  const targetBlockKey = readStructuredTargetBlockKey(rule);
  return targetBlockKey
    ? createTargetBlockComparisonKey(targetBlockKey)
    : undefined;
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

function resolveRuleResolutionKey(
  rule: Pick<
    EditorialRuleRecord,
    "rule_object" | "selector" | "trigger" | "authoring_payload"
  >,
  coverageKey: string,
): string {
  return createEditorialRuleComparisonKey(rule) ?? coverageKey;
}

function describeResolutionMatchLabel(
  coverageKey: string,
  resolutionKey: string,
): string {
  if (coverageKey === resolutionKey) {
    return `coverage key "${coverageKey}"`;
  }

  return `comparison key "${resolutionKey}" (coverage key "${coverageKey}")`;
}

function buildSelectedRuleResolutionReason(input: {
  rule: EditorialRuleRecord;
  coverageKey: string;
  sourceLayer: "base" | "journal";
}): string {
  const prefix =
    input.sourceLayer === "base"
      ? "Selected base published rule"
      : "Selected journal published rule";
  const legacyFrontMatterBridge = readLegacyFrontMatterBridgeDescriptor(input.rule);
  if (!legacyFrontMatterBridge) {
    return `${prefix} for coverage key "${input.coverageKey}".`;
  }

  const details = [
    `${prefix} via legacy front-matter bridge for target block "${legacyFrontMatterBridge.target_block_key}".`,
  ];
  if (legacyFrontMatterBridge.shadow_target_block_keys.length > 0) {
    details.push(
      `Shared legacy coverage still touches ${legacyFrontMatterBridge.shadow_target_block_keys.join(", ")}.`,
    );
  }
  if (legacyFrontMatterBridge.legacy_only_semantic_roles.length > 0) {
    details.push(
      `Remaining legacy-only roles: ${legacyFrontMatterBridge.legacy_only_semantic_roles.join(", ")}.`,
    );
  }
  details.push(`Coverage key "${input.coverageKey}".`);
  return details.join(" ");
}

function buildRuleGovernanceExplanation(rule: EditorialRuleRecord): string {
  const domain = rule.rule_domain ?? "front_matter";
  const layer = rule.scope_layer ?? "general";
  const grade = rule.automation_grade ?? "C";
  const action = rule.structured_action?.kind ?? "inspect_only";
  const gateStatus = rule.gold_sample_gate?.status ?? "not_required";
  return `Rule domain ${domain}, scope layer ${layer}, automation grade ${grade}, action ${action}, gold sample gate ${gateStatus}.`;
}

function readLegacyFrontMatterBridgeDescriptor(
  rule: Pick<
    EditorialRuleRecord,
    "rule_object" | "selector" | "trigger" | "authoring_payload"
  >,
): {
  comparison_key: string;
  target_block_key: string;
  slot_key?: string;
  shadow_target_block_keys: string[];
  legacy_only_semantic_roles: string[];
} | undefined {
  const authoringPayload = asRecord(rule.authoring_payload) ?? {};
  const compileTrace = asRecord(authoringPayload["compile_trace"]);
  const bridgeKind =
    readOptionalString(authoringPayload["compatibility_bridge_kind"]) ??
    readOptionalString(authoringPayload["bridge_kind"]);
  const packageKind = readOptionalString(compileTrace?.["package_kind"]);
  const isLegacyFrontMatter =
    bridgeKind === "legacy_front_matter" || packageKind === "front_matter";
  if (!isLegacyFrontMatter) {
    return undefined;
  }

  const explicitTargetBlockKey = readOptionalString(
    authoringPayload["target_block_key"],
  );
  const explicitSlotKey = readOptionalString(authoringPayload["slot_key"]);
  const shadowTargetBlockKeys =
    readStringArray(authoringPayload["bridge_shadow_target_block_keys"]) ??
    (rule.rule_object === "author_line"
      ? [...LEGACY_FRONT_MATTER_AUTHOR_LINE_SHADOW_TARGET_BLOCK_KEYS]
      : []);
  const legacyOnlySemanticRoles =
    readStringArray(authoringPayload["legacy_only_semantic_roles"]) ??
    (rule.rule_object === "author_line"
      ? [...LEGACY_FRONT_MATTER_AUTHOR_LINE_LEGACY_ONLY_SEMANTIC_ROLES]
      : []);

  if (explicitTargetBlockKey || explicitSlotKey) {
    const targetBlockKey =
      explicitTargetBlockKey ?? explicitSlotKey ?? rule.rule_object;
    const slotKey = explicitSlotKey ?? undefined;
    return {
      comparison_key: createTargetBlockComparisonKey(slotKey ?? targetBlockKey),
      target_block_key: targetBlockKey,
      ...(slotKey ? { slot_key: slotKey } : {}),
      shadow_target_block_keys: shadowTargetBlockKeys,
      legacy_only_semantic_roles: legacyOnlySemanticRoles,
    };
  }

  if (rule.rule_object === "title") {
    return {
      comparison_key: createTargetBlockComparisonKey("title"),
      target_block_key: "title",
      shadow_target_block_keys: [],
      legacy_only_semantic_roles: [],
    };
  }

  if (rule.rule_object === "author_line") {
    return {
      comparison_key: createTargetBlockComparisonKey("author_line"),
      target_block_key: "author_line",
      slot_key: "author_line",
      shadow_target_block_keys: shadowTargetBlockKeys,
      legacy_only_semantic_roles: legacyOnlySemanticRoles,
    };
  }

  return undefined;
}

function readStructuredTargetBlockKey(
  rule: Pick<
    EditorialRuleRecord,
    "selector" | "authoring_payload"
  >,
): string | undefined {
  const authoringPayload = asRecord(rule.authoring_payload) ?? {};
  return (
    readOptionalString(authoringPayload["slot_key"]) ??
    readOptionalString(authoringPayload["target_block_key"]) ??
    readOptionalString(rule.selector["slot_key"]) ??
    readOptionalString(rule.selector["target_block_key"])
  );
}

function createTargetBlockComparisonKey(targetBlockKey: string): string {
  return `target_block::${targetBlockKey}`;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value != null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}
