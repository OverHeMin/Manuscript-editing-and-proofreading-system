import type { RoleKey } from "../../users/roles.ts";
import type { AiGatewayService } from "../ai-gateway/ai-gateway-service.ts";
import type { ResolvedModelSelection } from "../ai-gateway/ai-gateway-service.ts";
import type { KnowledgeRecord } from "../knowledge/knowledge-record.ts";
import type { KnowledgeRepository } from "../knowledge/knowledge-repository.ts";
import type { ManuscriptRecord } from "../manuscripts/manuscript-record.ts";
import type { ManuscriptRepository } from "../manuscripts/manuscript-repository.ts";
import type {
  ModuleTemplateRecord,
  TemplateModule,
} from "../templates/template-record.ts";
import type { ModuleTemplateRepository } from "../templates/template-repository.ts";

export interface PrepareModuleExecutionInput {
  manuscriptId: string;
  module: TemplateModule;
  jobId: string;
  actorId: string;
  actorRole: RoleKey;
  manuscriptRepository: ManuscriptRepository;
  moduleTemplateRepository: ModuleTemplateRepository;
  knowledgeRepository: KnowledgeRepository;
  aiGatewayService: AiGatewayService;
}

export interface PreparedModuleExecution {
  manuscript: ManuscriptRecord;
  template: ModuleTemplateRecord;
  knowledgeItems: KnowledgeRecord[];
  modelSelection: ResolvedModelSelection;
}

export interface DynamicKnowledgeSelection {
  knowledgeItem: KnowledgeRecord;
  matchSource: "template_binding" | "dynamic_routing";
  matchSourceId?: string;
  matchReasons: string[];
}

export interface ModuleExecutionResult<TJob, TAsset> {
  job: TJob;
  asset: TAsset;
  template_id: string;
  knowledge_item_ids: string[];
  model_id: string;
}

export class ModuleTemplateFamilyNotConfiguredError extends Error {
  constructor(manuscriptId: string) {
    super(`Manuscript ${manuscriptId} does not have a current template family.`);
    this.name = "ModuleTemplateFamilyNotConfiguredError";
  }
}

export class PublishedModuleTemplateNotFoundError extends Error {
  constructor(templateFamilyId: string, module: string) {
    super(
      `Template family ${templateFamilyId} does not have a published ${module} template.`,
    );
    this.name = "PublishedModuleTemplateNotFoundError";
  }
}

export class ModuleManuscriptNotFoundError extends Error {
  constructor(manuscriptId: string) {
    super(`Manuscript ${manuscriptId} was not found.`);
    this.name = "ModuleManuscriptNotFoundError";
  }
}

export function selectApprovedDynamicKnowledge(
  input: {
    manuscript: ManuscriptRecord;
    module: TemplateModule;
    template: ModuleTemplateRecord;
    knowledgeItems: KnowledgeRecord[];
  },
): DynamicKnowledgeSelection[] {
  return input.knowledgeItems
    .filter((record) => record.status === "approved")
    .filter(
      (record) =>
        record.routing.module_scope === "any" ||
        record.routing.module_scope === input.module,
    )
    .filter(
      (record) =>
        record.routing.manuscript_types === "any" ||
        record.routing.manuscript_types.includes(input.manuscript.manuscript_type),
    )
    .filter(
      (record) =>
        !record.template_bindings ||
        record.template_bindings.length === 0 ||
        record.template_bindings.includes(input.template.id),
    )
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((knowledgeItem) => {
      const usesTemplateBinding =
        !!knowledgeItem.template_bindings &&
        knowledgeItem.template_bindings.length > 0 &&
        knowledgeItem.template_bindings.includes(input.template.id);

      return {
        knowledgeItem,
        matchSource: usesTemplateBinding ? "template_binding" : "dynamic_routing",
        matchSourceId: usesTemplateBinding ? `template:${input.template.id}` : undefined,
        matchReasons: [
          ...(knowledgeItem.routing.module_scope === input.module ? ["module"] : []),
          ...(
            knowledgeItem.routing.manuscript_types !== "any" &&
            knowledgeItem.routing.manuscript_types.includes(
              input.manuscript.manuscript_type,
            )
              ? ["manuscript_type"]
              : []
          ),
          ...(usesTemplateBinding ? ["template_binding"] : ["dynamic_routing"]),
        ],
      };
    });
}

export async function prepareModuleExecution(
  input: PrepareModuleExecutionInput,
): Promise<PreparedModuleExecution> {
  const manuscript = await input.manuscriptRepository.findById(input.manuscriptId);

  if (!manuscript) {
    throw new ModuleManuscriptNotFoundError(input.manuscriptId);
  }

  if (!manuscript.current_template_family_id) {
    throw new ModuleTemplateFamilyNotConfiguredError(input.manuscriptId);
  }

  const templates =
    await input.moduleTemplateRepository.listByTemplateFamilyIdAndModule(
      manuscript.current_template_family_id,
      input.module,
    );
  const template = [...templates]
    .reverse()
    .find((record) => record.status === "published");

  if (!template) {
    throw new PublishedModuleTemplateNotFoundError(
      manuscript.current_template_family_id,
      input.module,
    );
  }

  const knowledgeItems = selectApprovedDynamicKnowledge({
    manuscript,
    module: input.module,
    template,
    knowledgeItems: await input.knowledgeRepository.list(),
  }).map((selection) => selection.knowledgeItem);

  const modelSelection = await input.aiGatewayService.resolveModelSelection({
    module: input.module,
    moduleTemplateId: template.id,
    taskId: input.jobId,
    actorId: input.actorId,
    actorRole: input.actorRole,
  });

  return {
    manuscript,
    template,
    knowledgeItems,
    modelSelection,
  };
}
