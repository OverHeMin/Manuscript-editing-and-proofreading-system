import type { RoleKey } from "../../users/roles.ts";
import type {
  EditorialRuleRecord,
  EditorialRuleSetRecord,
} from "../editorial-rules/editorial-rule-record.ts";
import type { ResolvedEditorialRule } from "../editorial-rules/editorial-rule-resolution-service.ts";
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
import type {
  ManuscriptRecord,
  ManuscriptType,
} from "../manuscripts/manuscript-record.ts";
import type { ManuscriptRepository } from "../manuscripts/manuscript-repository.ts";
import {
  ActiveManualReviewPolicyNotFoundError,
} from "../manual-review-policies/manual-review-policy-service.ts";
import type { ManualReviewPolicyRecord } from "../manual-review-policies/manual-review-policy-record.ts";
import type { ManualReviewPolicyService } from "../manual-review-policies/manual-review-policy-service.ts";
import type {
  PromptSkillRegistryRepository,
} from "../prompt-skill-registry/prompt-skill-repository.ts";
import type {
  PromptTemplateRecord,
  SkillPackageRecord,
} from "../prompt-skill-registry/prompt-skill-record.ts";
import {
  ActiveRetrievalPresetNotFoundError,
} from "../retrieval-presets/retrieval-preset-service.ts";
import type { RetrievalPresetRecord } from "../retrieval-presets/retrieval-preset-record.ts";
import type { RetrievalPresetService } from "../retrieval-presets/retrieval-preset-service.ts";
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
  retrievalScore?: number;
}

export interface GovernedModuleContext {
  manuscript: ManuscriptRecord;
  executionProfile: Awaited<
    ReturnType<ExecutionGovernanceService["resolveActiveProfile"]>
  >;
  moduleTemplate: ModuleTemplateRecord;
  ruleSet: EditorialRuleSetRecord;
  rules: EditorialRuleRecord[];
  resolvedRules: ResolvedEditorialRule[];
  promptTemplate: PromptTemplateRecord;
  skillPackages: SkillPackageRecord[];
  knowledgeSelections: GovernedKnowledgeSelection[];
  modelSelection: ResolvedModelSelection;
  retrievalPreset?: RetrievalPresetRecord;
  manualReviewPolicy?: ManualReviewPolicyRecord;
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
  retrievalPresetService?: Pick<RetrievalPresetService, "getActivePresetForScope">;
  manualReviewPolicyService?: Pick<
    ManualReviewPolicyService,
    "getActivePolicyForScope"
  >;
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

  const { ruleSet, rules, resolvedRules } =
    await input.executionGovernanceService.resolvePublishedRuleSource(
      executionProfile,
      {
        journalTemplateId: manuscript.current_journal_template_id,
      },
    );

  const retrievalPreset = await resolveActiveRetrievalPreset(input, {
    module: input.module,
    manuscriptType: manuscript.manuscript_type,
    templateFamilyId: manuscript.current_template_family_id,
  });
  const manualReviewPolicy = await resolveActiveManualReviewPolicy(input, {
    module: input.module,
    manuscriptType: manuscript.manuscript_type,
    templateFamilyId: manuscript.current_template_family_id,
  });

  const knowledgeSelectionsById = new Map<string, GovernedKnowledgeSelection>();
  const bindingRules =
    await input.executionGovernanceService.listApplicableActiveKnowledgeBindingRules({
      module: input.module,
      manuscriptType: manuscript.manuscript_type,
      templateFamilyId: manuscript.current_template_family_id,
      moduleTemplateId: moduleTemplate.id,
    });

  for (const rule of bindingRules) {
    const knowledgeItem =
      await input.knowledgeRepository.findApprovedById(rule.knowledge_item_id);
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
      knowledgeItems: await input.knowledgeRepository.listApproved(),
      retrievalPreset,
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
    templateFamilyId: manuscript.current_template_family_id,
    moduleTemplateId: moduleTemplate.id,
    taskId: input.jobId,
    actorId: input.actorId,
    actorRole: input.actorRole,
  });

  return {
    manuscript,
    executionProfile,
    moduleTemplate,
    ruleSet,
    rules,
    resolvedRules,
    promptTemplate,
    skillPackages,
    knowledgeSelections: [...knowledgeSelectionsById.values()],
    modelSelection,
    ...(retrievalPreset ? { retrievalPreset } : {}),
    ...(manualReviewPolicy ? { manualReviewPolicy } : {}),
  };
}

export { ActiveExecutionProfileNotFoundError };

async function resolveActiveRetrievalPreset(
  input: ResolveGovernedModuleContextInput,
  scope: {
    module: TemplateModule;
    manuscriptType: ManuscriptType;
    templateFamilyId: string;
  },
): Promise<RetrievalPresetRecord | undefined> {
  if (!input.retrievalPresetService) {
    return undefined;
  }

  try {
    return await input.retrievalPresetService.getActivePresetForScope(scope);
  } catch (error) {
    if (error instanceof ActiveRetrievalPresetNotFoundError) {
      return undefined;
    }

    throw error;
  }
}

async function resolveActiveManualReviewPolicy(
  input: ResolveGovernedModuleContextInput,
  scope: {
    module: TemplateModule;
    manuscriptType: ManuscriptType;
    templateFamilyId: string;
  },
): Promise<ManualReviewPolicyRecord | undefined> {
  if (!input.manualReviewPolicyService) {
    return undefined;
  }

  try {
    return await input.manualReviewPolicyService.getActivePolicyForScope(scope);
  } catch (error) {
    if (error instanceof ActiveManualReviewPolicyNotFoundError) {
      return undefined;
    }

    throw error;
  }
}
