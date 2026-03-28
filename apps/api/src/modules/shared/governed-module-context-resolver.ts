import type { RoleKey } from "../../users/roles.ts";
import type {
  AiGatewayService,
  ResolvedModelSelection,
} from "../ai-gateway/ai-gateway-service.ts";
import {
  ActiveExecutionProfileNotFoundError,
  type ExecutionGovernanceService,
} from "../execution-governance/execution-governance-service.ts";
import type { KnowledgeRecord } from "../knowledge/knowledge-record.ts";
import type { KnowledgeRepository } from "../knowledge/knowledge-repository.ts";
import type { ManuscriptRecord } from "../manuscripts/manuscript-record.ts";
import type { ManuscriptRepository } from "../manuscripts/manuscript-repository.ts";
import type {
  PromptSkillRegistryRepository,
} from "../prompt-skill-registry/prompt-skill-repository.ts";
import type {
  PromptTemplateRecord,
  SkillPackageRecord,
} from "../prompt-skill-registry/prompt-skill-record.ts";
import {
  ModuleManuscriptNotFoundError,
  ModuleTemplateFamilyNotConfiguredError,
  selectApprovedDynamicKnowledge,
} from "./module-run-support.ts";
import type { ModuleTemplateRepository } from "../templates/template-repository.ts";
import type { ModuleTemplateRecord, TemplateModule } from "../templates/template-record.ts";

export interface GovernedKnowledgeSelection {
  knowledgeItem: KnowledgeRecord;
  matchSource: "binding_rule" | "template_binding" | "dynamic_routing";
  matchSourceId?: string;
  bindingRuleId?: string;
  matchReasons: string[];
}

export interface GovernedModuleContext {
  manuscript: ManuscriptRecord;
  executionProfile: Awaited<
    ReturnType<ExecutionGovernanceService["resolveActiveProfile"]>
  >;
  moduleTemplate: ModuleTemplateRecord;
  promptTemplate: PromptTemplateRecord;
  skillPackages: SkillPackageRecord[];
  knowledgeSelections: GovernedKnowledgeSelection[];
  modelSelection: ResolvedModelSelection;
}

export interface ResolveGovernedModuleContextInput {
  manuscriptId: string;
  module: TemplateModule;
  jobId: string;
  actorId: string;
  actorRole: RoleKey;
  manuscriptRepository: ManuscriptRepository;
  moduleTemplateRepository: ModuleTemplateRepository;
  executionGovernanceService: ExecutionGovernanceService;
  promptSkillRegistryRepository: PromptSkillRegistryRepository;
  knowledgeRepository: KnowledgeRepository;
  aiGatewayService: AiGatewayService;
}

export class GovernedPromptTemplateNotFoundError extends Error {
  constructor(promptTemplateId: string) {
    super(`Published prompt template ${promptTemplateId} was not found.`);
    this.name = "GovernedPromptTemplateNotFoundError";
  }
}

export class GovernedSkillPackageNotFoundError extends Error {
  constructor(skillPackageId: string) {
    super(`Published skill package ${skillPackageId} was not found.`);
    this.name = "GovernedSkillPackageNotFoundError";
  }
}

export class GovernedModuleTemplateNotFoundError extends Error {
  constructor(moduleTemplateId: string) {
    super(`Published module template ${moduleTemplateId} was not found.`);
    this.name = "GovernedModuleTemplateNotFoundError";
  }
}

export class GovernedKnowledgeItemNotFoundError extends Error {
  constructor(knowledgeItemId: string) {
    super(`Approved knowledge item ${knowledgeItemId} was not found.`);
    this.name = "GovernedKnowledgeItemNotFoundError";
  }
}

export async function resolveGovernedModuleContext(
  input: ResolveGovernedModuleContextInput,
): Promise<GovernedModuleContext> {
  const manuscript = await input.manuscriptRepository.findById(input.manuscriptId);
  if (!manuscript) {
    throw new ModuleManuscriptNotFoundError(input.manuscriptId);
  }

  if (!manuscript.current_template_family_id) {
    throw new ModuleTemplateFamilyNotConfiguredError(input.manuscriptId);
  }

  const executionProfile = await input.executionGovernanceService.resolveActiveProfile({
    module: input.module,
    manuscriptType: manuscript.manuscript_type,
    templateFamilyId: manuscript.current_template_family_id,
  });

  const moduleTemplate = await input.moduleTemplateRepository.findById(
    executionProfile.module_template_id,
  );
  if (!moduleTemplate || moduleTemplate.status !== "published") {
    throw new GovernedModuleTemplateNotFoundError(
      executionProfile.module_template_id,
    );
  }

  const promptTemplate =
    await input.promptSkillRegistryRepository.findPromptTemplateById(
      executionProfile.prompt_template_id,
    );
  if (!promptTemplate || promptTemplate.status !== "published") {
    throw new GovernedPromptTemplateNotFoundError(
      executionProfile.prompt_template_id,
    );
  }

  const skillPackages: SkillPackageRecord[] = [];
  for (const skillPackageId of executionProfile.skill_package_ids) {
    const skillPackage =
      await input.promptSkillRegistryRepository.findSkillPackageById(skillPackageId);
    if (!skillPackage || skillPackage.status !== "published") {
      throw new GovernedSkillPackageNotFoundError(skillPackageId);
    }

    skillPackages.push(skillPackage);
  }

  const knowledgeSelectionsById = new Map<string, GovernedKnowledgeSelection>();
  const bindingRules =
    await input.executionGovernanceService.listApplicableActiveKnowledgeBindingRules({
      module: input.module,
      manuscriptType: manuscript.manuscript_type,
      templateFamilyId: manuscript.current_template_family_id,
      moduleTemplateId: moduleTemplate.id,
    });

  for (const rule of bindingRules) {
    const knowledgeItem = await input.knowledgeRepository.findById(rule.knowledge_item_id);
    if (!knowledgeItem || knowledgeItem.status !== "approved") {
      throw new GovernedKnowledgeItemNotFoundError(rule.knowledge_item_id);
    }

    knowledgeSelectionsById.set(knowledgeItem.id, {
      knowledgeItem,
      matchSource: "binding_rule",
      matchSourceId: rule.id,
      bindingRuleId: rule.id,
      matchReasons: [
        ...(rule.manuscript_types !== "any" ? ["manuscript_type"] : []),
        ...(rule.template_family_ids && rule.template_family_ids.length > 0
          ? ["template_family"]
          : []),
        ...(rule.module_template_ids && rule.module_template_ids.length > 0
          ? ["module_template"]
          : []),
        ...(rule.sections && rule.sections.length > 0 ? ["section"] : []),
        ...(rule.risk_tags && rule.risk_tags.length > 0 ? ["risk_tag"] : []),
      ],
    });
  }

  if (executionProfile.knowledge_binding_mode === "profile_plus_dynamic") {
    const dynamicSelections = selectApprovedDynamicKnowledge({
      manuscript,
      module: input.module,
      template: moduleTemplate,
      knowledgeItems: await input.knowledgeRepository.list(),
    });

    for (const selection of dynamicSelections) {
      if (knowledgeSelectionsById.has(selection.knowledgeItem.id)) {
        continue;
      }

      knowledgeSelectionsById.set(selection.knowledgeItem.id, selection);
    }
  }

  const modelSelection = await input.aiGatewayService.resolveModelSelection({
    module: input.module,
    moduleTemplateId: moduleTemplate.id,
    taskId: input.jobId,
    actorId: input.actorId,
    actorRole: input.actorRole,
  });

  return {
    manuscript,
    executionProfile,
    moduleTemplate,
    promptTemplate,
    skillPackages,
    knowledgeSelections: [...knowledgeSelectionsById.values()],
    modelSelection,
  };
}

export { ActiveExecutionProfileNotFoundError };
