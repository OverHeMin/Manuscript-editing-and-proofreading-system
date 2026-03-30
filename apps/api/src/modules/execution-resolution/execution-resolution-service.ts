import type { ExecutionGovernanceService } from "../execution-governance/execution-governance-service.ts";
import type { KnowledgeRepository } from "../knowledge/knowledge-repository.ts";
import type { KnowledgeRecord } from "../knowledge/knowledge-record.ts";
import type {
  ModelRegistryRepository,
  ModelRoutingPolicyRepository,
} from "../model-registry/model-registry-repository.ts";
import type { ModelRegistryRecord } from "../model-registry/model-record.ts";
import type { PromptSkillRegistryRepository } from "../prompt-skill-registry/prompt-skill-repository.ts";
import type { SkillPackageRecord } from "../prompt-skill-registry/prompt-skill-record.ts";
import type { ModuleTemplateRepository } from "../templates/template-repository.ts";
import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { TemplateModule } from "../templates/template-record.ts";
import type {
  ExecutionResolutionModelSource,
  ResolvedExecutionBundleRecord,
} from "./execution-resolution-record.ts";

export interface ResolveExecutionBundleInput {
  module: TemplateModule;
  manuscriptType: ManuscriptType;
  templateFamilyId: string;
}

export interface ExecutionResolutionServiceOptions {
  executionGovernanceService: ExecutionGovernanceService;
  moduleTemplateRepository: ModuleTemplateRepository;
  promptSkillRegistryRepository: PromptSkillRegistryRepository;
  knowledgeRepository: KnowledgeRepository;
  modelRegistryRepository: ModelRegistryRepository;
  modelRoutingPolicyRepository: ModelRoutingPolicyRepository;
}

export class ExecutionResolutionProfileAssetNotFoundError extends Error {
  constructor(assetKind: string, assetId: string) {
    super(`Resolved execution asset ${assetKind} ${assetId} was not found.`);
    this.name = "ExecutionResolutionProfileAssetNotFoundError";
  }
}

export class ExecutionResolutionModelNotFoundError extends Error {
  constructor(module: TemplateModule, templateFamilyId: string) {
    super(
      `No compatible routed model exists for module ${module} and template family ${templateFamilyId}.`,
    );
    this.name = "ExecutionResolutionModelNotFoundError";
  }
}

export class ExecutionResolutionModelIncompatibleError extends Error {
  constructor(modelId: string, module: TemplateModule) {
    super(`Resolved model ${modelId} is not production-approved for module ${module}.`);
    this.name = "ExecutionResolutionModelIncompatibleError";
  }
}

export class ExecutionResolutionKnowledgeItemNotFoundError extends Error {
  constructor(knowledgeItemId: string) {
    super(`Resolved knowledge item ${knowledgeItemId} was not found or approved.`);
    this.name = "ExecutionResolutionKnowledgeItemNotFoundError";
  }
}

export class ExecutionResolutionService {
  private readonly executionGovernanceService: ExecutionGovernanceService;
  private readonly moduleTemplateRepository: ModuleTemplateRepository;
  private readonly promptSkillRegistryRepository: PromptSkillRegistryRepository;
  private readonly knowledgeRepository: KnowledgeRepository;
  private readonly modelRegistryRepository: ModelRegistryRepository;
  private readonly modelRoutingPolicyRepository: ModelRoutingPolicyRepository;

  constructor(options: ExecutionResolutionServiceOptions) {
    this.executionGovernanceService = options.executionGovernanceService;
    this.moduleTemplateRepository = options.moduleTemplateRepository;
    this.promptSkillRegistryRepository = options.promptSkillRegistryRepository;
    this.knowledgeRepository = options.knowledgeRepository;
    this.modelRegistryRepository = options.modelRegistryRepository;
    this.modelRoutingPolicyRepository = options.modelRoutingPolicyRepository;
  }

  async resolveExecutionBundle(
    input: ResolveExecutionBundleInput,
  ): Promise<ResolvedExecutionBundleRecord> {
    const profile = await this.executionGovernanceService.resolveActiveProfile({
      module: input.module,
      manuscriptType: input.manuscriptType,
      templateFamilyId: input.templateFamilyId,
    });

    const moduleTemplate = await this.moduleTemplateRepository.findById(
      profile.module_template_id,
    );
    if (!moduleTemplate || moduleTemplate.status !== "published") {
      throw new ExecutionResolutionProfileAssetNotFoundError(
        "module_template",
        profile.module_template_id,
      );
    }

    const promptTemplate =
      await this.promptSkillRegistryRepository.findPromptTemplateById(
        profile.prompt_template_id,
      );
    if (!promptTemplate || promptTemplate.status !== "published") {
      throw new ExecutionResolutionProfileAssetNotFoundError(
        "prompt_template",
        profile.prompt_template_id,
      );
    }

    const skillPackages: SkillPackageRecord[] = [];
    for (const skillPackageId of profile.skill_package_ids) {
      const skillPackage =
        await this.promptSkillRegistryRepository.findSkillPackageById(skillPackageId);
      if (!skillPackage || skillPackage.status !== "published") {
        throw new ExecutionResolutionProfileAssetNotFoundError(
          "skill_package",
          skillPackageId,
        );
      }

      skillPackages.push(skillPackage);
    }

    const { model, source } = await this.resolveModel(profile);
    const knowledgeBindingRules =
      await this.executionGovernanceService.listApplicableActiveKnowledgeBindingRules({
        module: profile.module,
        manuscriptType: profile.manuscript_type,
        templateFamilyId: profile.template_family_id,
        moduleTemplateId: profile.module_template_id,
      });

    const knowledgeItems: KnowledgeRecord[] = [];
    for (const rule of knowledgeBindingRules) {
      const knowledgeItem = await this.knowledgeRepository.findById(
        rule.knowledge_item_id,
      );
      if (!knowledgeItem || knowledgeItem.status !== "approved") {
        throw new ExecutionResolutionKnowledgeItemNotFoundError(
          rule.knowledge_item_id,
        );
      }

      knowledgeItems.push(knowledgeItem);
    }

    return {
      profile,
      module_template: moduleTemplate,
      prompt_template: promptTemplate,
      skill_packages: skillPackages,
      resolved_model: model,
      model_source: source,
      knowledge_binding_rules: knowledgeBindingRules,
      knowledge_items: dedupeKnowledgeItems(knowledgeItems),
    };
  }

  private async resolveModel(profile: {
    module: TemplateModule;
    module_template_id: string;
    template_family_id: string;
  }): Promise<{
    model: ModelRegistryRecord;
    source: ExecutionResolutionModelSource;
  }> {
    const policy = await this.modelRoutingPolicyRepository.get();
    const candidates: Array<{
      modelId?: string;
      source: ExecutionResolutionModelSource;
    }> = [
      {
        modelId: policy.template_overrides[profile.module_template_id],
        source: "template_override",
      },
      {
        modelId: policy.module_defaults[profile.module],
        source: "module_default",
      },
      {
        modelId: policy.system_default_model_id,
        source: "system_default",
      },
    ];

    for (const candidate of candidates) {
      if (!candidate.modelId) {
        continue;
      }

      const model = await this.modelRegistryRepository.findById(candidate.modelId);
      if (!model) {
        continue;
      }

      if (!model.is_prod_allowed || !model.allowed_modules.includes(profile.module)) {
        throw new ExecutionResolutionModelIncompatibleError(model.id, profile.module);
      }

      return {
        model,
        source: candidate.source,
      };
    }

    throw new ExecutionResolutionModelNotFoundError(
      profile.module,
      profile.template_family_id,
    );
  }
}

function dedupeKnowledgeItems(values: KnowledgeRecord[]): KnowledgeRecord[] {
  const seen = new Set<string>();
  const result: KnowledgeRecord[] = [];

  for (const value of values) {
    if (seen.has(value.id)) {
      continue;
    }

    seen.add(value.id);
    result.push(value);
  }

  return result;
}
