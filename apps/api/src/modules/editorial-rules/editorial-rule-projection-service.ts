import { randomUUID } from "node:crypto";
import type {
  KnowledgeProjectionKind,
  KnowledgeRecord,
} from "../knowledge/knowledge-record.ts";
import type { KnowledgeRepository } from "../knowledge/knowledge-repository.ts";
import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { TemplateFamilyRepository } from "../templates/template-repository.ts";
import type { EditorialRuleRepository } from "./editorial-rule-repository.ts";
import type {
  EditorialRuleAction,
  EditorialRuleRecord,
  EditorialRuleSetRecord,
  EditorialRuleTrigger,
} from "./editorial-rule-record.ts";
import { getEditorialRuleObjectCatalogEntry } from "./editorial-rule-object-catalog.ts";

export interface EditorialRuleProjectionServiceOptions {
  editorialRuleRepository: EditorialRuleRepository;
  knowledgeRepository: KnowledgeRepository;
  templateFamilyRepository: Pick<
    TemplateFamilyRepository,
    "findById" | "findJournalTemplateProfileById"
  >;
  createId?: () => string;
}

export class EditorialRuleProjectionRuleSetNotFoundError extends Error {
  constructor(ruleSetId: string) {
    super(`Editorial rule set ${ruleSetId} was not found for projection.`);
    this.name = "EditorialRuleProjectionRuleSetNotFoundError";
  }
}

export class EditorialRuleProjectionRuleSetNotPublishedError extends Error {
  constructor(ruleSetId: string) {
    super(`Editorial rule set ${ruleSetId} must be published before projection.`);
    this.name = "EditorialRuleProjectionRuleSetNotPublishedError";
  }
}

export class EditorialRuleProjectionTemplateFamilyNotFoundError extends Error {
  constructor(templateFamilyId: string) {
    super(
      `Template family ${templateFamilyId} was not found for editorial rule projection.`,
    );
    this.name = "EditorialRuleProjectionTemplateFamilyNotFoundError";
  }
}

export class EditorialRuleProjectionJournalTemplateNotFoundError extends Error {
  constructor(journalTemplateId: string) {
    super(`Journal template ${journalTemplateId} was not found for editorial rule projection.`);
    this.name = "EditorialRuleProjectionJournalTemplateNotFoundError";
  }
}

export class EditorialRuleProjectionService {
  private readonly editorialRuleRepository: EditorialRuleRepository;
  private readonly knowledgeRepository: KnowledgeRepository;
  private readonly templateFamilyRepository: Pick<
    TemplateFamilyRepository,
    "findById" | "findJournalTemplateProfileById"
  >;
  private readonly createId: () => string;

  constructor(options: EditorialRuleProjectionServiceOptions) {
    this.editorialRuleRepository = options.editorialRuleRepository;
    this.knowledgeRepository = options.knowledgeRepository;
    this.templateFamilyRepository = options.templateFamilyRepository;
    this.createId = options.createId ?? (() => randomUUID());
  }

  async refreshPublishedRuleSet(ruleSetId: string): Promise<KnowledgeRecord[]> {
    const ruleSet = await this.editorialRuleRepository.findRuleSetById(ruleSetId);
    if (!ruleSet) {
      throw new EditorialRuleProjectionRuleSetNotFoundError(ruleSetId);
    }

    if (ruleSet.status !== "published") {
      throw new EditorialRuleProjectionRuleSetNotPublishedError(ruleSetId);
    }

    const templateFamily = await this.templateFamilyRepository.findById(
      ruleSet.template_family_id,
    );
    if (!templateFamily) {
      throw new EditorialRuleProjectionTemplateFamilyNotFoundError(
        ruleSet.template_family_id,
      );
    }

    const rules = (await this.editorialRuleRepository.listRulesByRuleSetId(ruleSetId)).filter(
      (rule) => rule.enabled,
    );
    const journalTemplate = ruleSet.journal_template_id
      ? await this.templateFamilyRepository.findJournalTemplateProfileById(
          ruleSet.journal_template_id,
        )
      : undefined;
    if (ruleSet.journal_template_id && !journalTemplate) {
      throw new EditorialRuleProjectionJournalTemplateNotFoundError(
        ruleSet.journal_template_id,
      );
    }
    const existingKnowledge = await this.listProjectedKnowledgeByRuleSet(ruleSetId);
    const existingByProjectionKey = new Map(
      existingKnowledge.map((record) => [createProjectionKey(record), record]),
    );
    const projectedRecords: KnowledgeRecord[] = [];

    for (const rule of rules) {
      for (const projectionKind of getEditorialRuleObjectCatalogEntry(
        rule.rule_object,
      ).projection_kinds as readonly KnowledgeProjectionKind[]) {
        const projectionKey = createProjectionKeyFromParts({
          ruleSetId: ruleSet.id,
          ruleId: rule.id,
          projectionKind,
        });
        const existing = existingByProjectionKey.get(projectionKey);
        const record = buildProjectedKnowledgeRecord({
          id: existing?.id ?? this.createId(),
          ruleSet,
          rule,
          projectionKind,
          manuscriptType: templateFamily.manuscript_type,
          templateFamilyName: templateFamily.name,
          journalTemplate,
        });

        await this.knowledgeRepository.save(record);
        projectedRecords.push(record);
        existingByProjectionKey.delete(projectionKey);
      }
    }

    for (const staleProjection of existingByProjectionKey.values()) {
      if (staleProjection.status === "archived") {
        continue;
      }

      await this.knowledgeRepository.save({
        ...staleProjection,
        status: "archived",
      });
    }

    return projectedRecords;
  }

  async archiveRuleSetProjections(ruleSetId: string): Promise<KnowledgeRecord[]> {
    const existingKnowledge = await this.listProjectedKnowledgeByRuleSet(ruleSetId);
    const archivedRecords: KnowledgeRecord[] = [];

    for (const record of existingKnowledge) {
      if (record.status === "archived") {
        archivedRecords.push(record);
        continue;
      }

      const archivedRecord: KnowledgeRecord = {
        ...record,
        status: "archived",
      };
      await this.knowledgeRepository.save(archivedRecord);
      archivedRecords.push(archivedRecord);
    }

    return archivedRecords;
  }

  private async listProjectedKnowledgeByRuleSet(
    ruleSetId: string,
  ): Promise<KnowledgeRecord[]> {
    return (await this.knowledgeRepository.list()).filter(
      (record) =>
        record.projection_source?.source_kind === "editorial_rule_projection" &&
        record.projection_source.rule_set_id === ruleSetId,
    );
  }
}

function buildProjectedKnowledgeRecord(input: {
  id: string;
  ruleSet: EditorialRuleSetRecord;
  rule: EditorialRuleRecord;
  projectionKind: KnowledgeProjectionKind;
  manuscriptType: ManuscriptType;
  templateFamilyName: string;
  journalTemplate?: {
    journal_key: string;
    journal_name: string;
  };
}): KnowledgeRecord {
  return {
    id: input.id,
    title: buildProjectionTitle(input.rule, input.projectionKind),
    canonical_text: buildProjectionCanonicalText(
      input.ruleSet,
      input.rule,
      input.projectionKind,
      input.journalTemplate,
    ),
    summary: buildProjectionSummary(
      input.ruleSet,
      input.rule,
      input.projectionKind,
      input.manuscriptType,
      input.templateFamilyName,
      input.journalTemplate,
    ),
    knowledge_kind: input.projectionKind,
    status: "approved",
    routing: {
      module_scope: "any",
      manuscript_types: [input.manuscriptType],
      sections: readStringArray(input.rule.scope.sections),
    },
    ...(input.rule.evidence_level
      ? { evidence_level: input.rule.evidence_level }
      : {}),
    aliases: readAliases(input.rule),
    template_bindings: buildTemplateBindings(
      input.ruleSet,
      input.journalTemplate,
    ),
    projection_source: {
      source_kind: "editorial_rule_projection",
      rule_set_id: input.ruleSet.id,
      rule_id: input.rule.id,
      projection_kind: input.projectionKind,
    },
  };
}

function buildProjectionTitle(
  rule: EditorialRuleRecord,
  projectionKind: KnowledgeProjectionKind,
): string {
  const before = resolveBeforeText(rule);
  const objectLabel = getEditorialRuleObjectCatalogEntry(rule.rule_object).label;

  switch (projectionKind) {
    case "rule":
      return `Rule summary: ${objectLabel} ${before}`;
    case "checklist":
      return `Checklist: ${objectLabel} ${before}`;
    case "prompt_snippet":
      return `Prompt snippet: ${objectLabel} ${before}`;
  }
}

function buildProjectionSummary(
  ruleSet: EditorialRuleSetRecord,
  rule: EditorialRuleRecord,
  projectionKind: KnowledgeProjectionKind,
  manuscriptType: ManuscriptType,
  templateFamilyName: string,
  journalTemplate?: {
    journal_key: string;
    journal_name: string;
  },
): string {
  if (
    typeof rule.projection_payload?.summary === "string" &&
    rule.projection_payload.summary.trim().length > 0
  ) {
    return `${rule.projection_payload.summary} Generated ${projectionKind} projection from ${ruleSet.module} rule set v${ruleSet.version_no}.`;
  }

  const segments = [
    `Generated ${projectionKind} projection from ${ruleSet.module} rule set v${ruleSet.version_no}`,
    `for ${templateFamilyName} (${manuscriptType})`,
    `object ${rule.rule_object}`,
  ];

  if (journalTemplate) {
    segments.push(
      `journal ${journalTemplate.journal_name} (${journalTemplate.journal_key})`,
    );
  }

  return `${segments.join(", ")}.`;
}

function buildProjectionCanonicalText(
  ruleSet: EditorialRuleSetRecord,
  rule: EditorialRuleRecord,
  projectionKind: KnowledgeProjectionKind,
  journalTemplate?: {
    journal_key: string;
    journal_name: string;
  },
): string {
  const before = resolveBeforeText(rule);
  const after = resolveAfterText(rule);
  const sectionText = describeSectionScope(rule);
  const journalContext = journalTemplate
    ? ` Journal override: ${journalTemplate.journal_name} (${journalTemplate.journal_key}).`
    : "";
  const objectContext = ` Rule object: ${rule.rule_object}.`;
  const authoringText = buildAuthoringPayloadText(rule);
  const explainabilityText = buildExplainabilityText(rule);
  const projectionText = buildProjectionPayloadText(rule);

  switch (projectionKind) {
    case "rule":
      return `Published ${ruleSet.module} rule for ${sectionText}: common error text "${before}". Standard example "${after}".${objectContext}${journalContext}${explainabilityText}${authoringText}${projectionText}`;
    case "checklist":
      return `Checklist item: inspect ${sectionText} and confirm common error text "${before}" has been normalized to standard example "${after}".${objectContext}${journalContext}${explainabilityText}${authoringText}${projectionText}`;
    case "prompt_snippet":
      return `Instruction snippet: if you encounter common error text "${before}" in ${sectionText}, change it to standard example "${after}" and preserve the manuscript's medical meaning.${objectContext}${journalContext}${explainabilityText}${authoringText}${projectionText}`;
  }
}

function resolveBeforeText(rule: EditorialRuleRecord): string {
  if (rule.example_before) {
    return rule.example_before;
  }

  return resolveTriggerText(rule.trigger);
}

function resolveAfterText(rule: EditorialRuleRecord): string {
  if (rule.example_after) {
    return rule.example_after;
  }

  return resolveActionText(rule.action);
}

function resolveTriggerText(trigger: EditorialRuleTrigger): string {
  if (typeof trigger.text === "string" && trigger.text.trim().length > 0) {
    return trigger.text;
  }

  if (typeof trigger.field === "string" && trigger.field.trim().length > 0) {
    return trigger.field;
  }

  return trigger.kind;
}

function resolveActionText(action: EditorialRuleAction): string {
  if (typeof action.to === "string" && action.to.trim().length > 0) {
    return action.to;
  }

  if (typeof action.message === "string" && action.message.trim().length > 0) {
    return action.message;
  }

  return action.kind;
}

function describeSectionScope(rule: EditorialRuleRecord): string {
  const sections = readStringArray(rule.scope.sections);
  if (!sections || sections.length === 0) {
    return "the governed document";
  }

  return `${sections.join(", ")} section`;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const strings = value.filter((item): item is string => typeof item === "string");
  return strings.length > 0 ? strings : undefined;
}

function readAliases(rule: EditorialRuleRecord): string[] | undefined {
  const aliases = [rule.example_before, rule.example_after].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  return aliases.length > 0 ? aliases : undefined;
}

function buildTemplateBindings(
  ruleSet: EditorialRuleSetRecord,
  journalTemplate?: {
    journal_key: string;
  },
): string[] {
  const bindings = [ruleSet.template_family_id];
  if (journalTemplate) {
    bindings.push(`journal:${journalTemplate.journal_key}`);
  }
  return bindings;
}

function buildAuthoringPayloadText(rule: EditorialRuleRecord): string {
  const commonErrorText = readAuthoringText(rule, "common_error_text");
  const standardExample =
    readAuthoringText(rule, "standard_example") ??
    readAuthoringText(rule, "normalized_example");
  const details: string[] = [];

  if (commonErrorText && commonErrorText !== resolveBeforeText(rule)) {
    details.push(` Common error text detail: "${commonErrorText}".`);
  }

  if (standardExample && standardExample !== resolveAfterText(rule)) {
    details.push(` Standard example detail: "${standardExample}".`);
  }

  return details.join("");
}

function buildExplainabilityText(rule: EditorialRuleRecord): string {
  const rationale = rule.explanation_payload?.rationale;
  if (!rationale || rationale.trim().length === 0) {
    return "";
  }

  return ` Rationale: ${rationale}.`;
}

function buildProjectionPayloadText(rule: EditorialRuleRecord): string {
  const details: string[] = [];

  if (rule.projection_payload?.standard_example) {
    details.push(
      ` Standard example detail: "${rule.projection_payload.standard_example}".`,
    );
  }

  if (rule.projection_payload?.incorrect_example) {
    details.push(
      ` Incorrect example detail: "${rule.projection_payload.incorrect_example}".`,
    );
  }

  return details.join("");
}

function readAuthoringText(
  rule: EditorialRuleRecord,
  key: string,
): string | undefined {
  const value = rule.authoring_payload[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function createProjectionKey(record: KnowledgeRecord): string {
  if (!record.projection_source) {
    return record.id;
  }

  return createProjectionKeyFromParts({
    ruleSetId: record.projection_source.rule_set_id,
    ruleId: record.projection_source.rule_id,
    projectionKind: record.projection_source.projection_kind,
  });
}

function createProjectionKeyFromParts(input: {
  ruleSetId: string;
  ruleId: string;
  projectionKind: KnowledgeProjectionKind;
}): string {
  return `${input.ruleSetId}:${input.ruleId}:${input.projectionKind}`;
}
