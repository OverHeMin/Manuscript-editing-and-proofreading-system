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

export interface EditorialRuleProjectionServiceOptions {
  editorialRuleRepository: EditorialRuleRepository;
  knowledgeRepository: KnowledgeRepository;
  templateFamilyRepository: Pick<TemplateFamilyRepository, "findById">;
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

export class EditorialRuleProjectionService {
  private readonly editorialRuleRepository: EditorialRuleRepository;
  private readonly knowledgeRepository: KnowledgeRepository;
  private readonly templateFamilyRepository: Pick<
    TemplateFamilyRepository,
    "findById"
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
    const existingKnowledge = await this.listProjectedKnowledgeByRuleSet(ruleSetId);
    const existingByProjectionKey = new Map(
      existingKnowledge.map((record) => [createProjectionKey(record), record]),
    );
    const projectedRecords: KnowledgeRecord[] = [];

    for (const rule of rules) {
      for (const projectionKind of [
        "rule",
        "checklist",
        "prompt_snippet",
      ] as const satisfies readonly KnowledgeProjectionKind[]) {
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
}): KnowledgeRecord {
  return {
    id: input.id,
    title: buildProjectionTitle(input.rule, input.projectionKind),
    canonical_text: buildProjectionCanonicalText(
      input.ruleSet,
      input.rule,
      input.projectionKind,
    ),
    summary: buildProjectionSummary(input.ruleSet, input.projectionKind),
    knowledge_kind: input.projectionKind,
    status: "approved",
    routing: {
      module_scope: "any",
      manuscript_types: [input.manuscriptType],
      sections: readStringArray(input.rule.scope.sections),
    },
    aliases: readAliases(input.rule),
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

  switch (projectionKind) {
    case "rule":
      return `Rule summary: ${before}`;
    case "checklist":
      return `Checklist: ${before}`;
    case "prompt_snippet":
      return `Prompt snippet: ${before}`;
  }
}

function buildProjectionSummary(
  ruleSet: EditorialRuleSetRecord,
  projectionKind: KnowledgeProjectionKind,
): string {
  return `Generated ${projectionKind} projection from ${ruleSet.module} rule set v${ruleSet.version_no}.`;
}

function buildProjectionCanonicalText(
  ruleSet: EditorialRuleSetRecord,
  rule: EditorialRuleRecord,
  projectionKind: KnowledgeProjectionKind,
): string {
  const before = resolveBeforeText(rule);
  const after = resolveAfterText(rule);
  const sectionText = describeSectionScope(rule);

  switch (projectionKind) {
    case "rule":
      return `Published ${ruleSet.module} rule: when ${sectionText} contains "${before}", normalize it to "${after}".`;
    case "checklist":
      return `Checklist item: inspect ${sectionText} and confirm "${before}" has been normalized to "${after}".`;
    case "prompt_snippet":
      return `Instruction snippet: if you encounter "${before}" in ${sectionText}, change it to "${after}" and preserve the manuscript's medical meaning.`;
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
