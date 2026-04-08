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
    const normalizedBase = normalizeLayerRules(baseRules, "base");
    const normalizedJournal = normalizeLayerRules(journalRules, "journal");
    const overlaid = overlayRules(
      normalizedBase.resolved_rules,
      normalizedJournal.resolved_rules,
    );

    return {
      baseRuleSet,
      journalRuleSet,
      rules: overlaid.resolved_rules.map((entry) => entry.rule),
      resolved_rules: overlaid.resolved_rules,
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
        ruleSet.status === "published" &&
        (ruleSet.journal_template_id ?? undefined) === journalTemplateId,
    )
    .sort(compareRuleSetsDescending)[0];
}

function compareRuleSetsDescending(
  left: EditorialRuleSetRecord,
  right: EditorialRuleSetRecord,
): number {
  if (left.version_no !== right.version_no) {
    return right.version_no - left.version_no;
  }

  return right.id.localeCompare(left.id);
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
      const reason = `Same-layer conflict retained the earliest rule for coverage key "${coverageKey}".`;
      existing.overridden_rule_ids = [
        ...existing.overridden_rule_ids,
        rule.id,
      ];
      overrides.push({
        active_rule_id: existing.rule.id,
        overridden_rule_id: rule.id,
        reason,
      });
      continue;
    }

    const resolvedRule: ResolvedEditorialRule = {
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

    activeByCoverageKey.set(coverageKey, resolvedRule);
    resolvedRules.push(resolvedRule);
  }

  return {
    resolved_rules: resolvedRules,
    overrides,
  };
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
