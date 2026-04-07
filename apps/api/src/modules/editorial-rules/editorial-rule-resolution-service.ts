import type {
  EditorialRuleRecord,
  EditorialRuleSetRecord,
} from "./editorial-rule-record.ts";
import type { EditorialRuleRepository } from "./editorial-rule-repository.ts";

export interface ResolveEditorialRulesInput {
  templateFamilyId: string;
  module: EditorialRuleSetRecord["module"];
  journalTemplateId?: string;
}

export interface EditorialRuleResolutionResult {
  baseRuleSet?: EditorialRuleSetRecord;
  journalRuleSet?: EditorialRuleSetRecord;
  rules: EditorialRuleRecord[];
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

    return {
      baseRuleSet,
      journalRuleSet,
      rules: overlayRules(baseRules, journalRules),
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
  baseRules: EditorialRuleRecord[],
  journalRules: EditorialRuleRecord[],
): EditorialRuleRecord[] {
  if (journalRules.length === 0) {
    return [...baseRules];
  }

  const journalByConflictKey = new Map(
    journalRules.map((rule) => [createConflictKey(rule), rule]),
  );
  const resolvedRules: EditorialRuleRecord[] = [];
  const consumedJournalKeys = new Set<string>();

  for (const rule of baseRules) {
    const conflictKey = createConflictKey(rule);
    const journalOverride = journalByConflictKey.get(conflictKey);
    if (journalOverride) {
      resolvedRules.push(journalOverride);
      consumedJournalKeys.add(conflictKey);
      continue;
    }

    resolvedRules.push(rule);
  }

  for (const rule of journalRules) {
    const conflictKey = createConflictKey(rule);
    if (consumedJournalKeys.has(conflictKey)) {
      continue;
    }

    resolvedRules.push(rule);
  }

  return resolvedRules;
}

function createConflictKey(rule: EditorialRuleRecord): string {
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
