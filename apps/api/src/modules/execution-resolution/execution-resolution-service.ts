import type {
  GovernedExecutionContextSummary,
  GovernedKnowledgeBindingMatchSummary,
  GovernedKnowledgeSelectionSummary,
  GovernedExecutionModuleSummary,
  GovernedResolvedRuleSummary,
  JournalTemplateSelectionState,
} from "@medical/contracts";
import type { ExecutionGovernanceService } from "../execution-governance/execution-governance-service.ts";
import {
  ActiveExecutionProfileNotFoundError,
} from "../execution-governance/execution-governance-service.ts";
import type {
  ModelSelectionWarning,
  ResolvedAiProviderConnectionSummary,
} from "../ai-gateway/ai-gateway-service.ts";
import type { AiProviderConnectionRecord } from "../ai-provider-connections/ai-provider-connection-record.ts";
import type { AiProviderConnectionRepository } from "../ai-provider-connections/ai-provider-connection-repository.ts";
import type { KnowledgeRepository } from "../knowledge/knowledge-repository.ts";
import type { KnowledgeRecord } from "../knowledge/knowledge-record.ts";
import {
  ActiveManualReviewPolicyNotFoundError,
} from "../manual-review-policies/manual-review-policy-service.ts";
import type { ManualReviewPolicyService } from "../manual-review-policies/manual-review-policy-service.ts";
import type { ModelRoutingGovernanceService } from "../model-routing-governance/model-routing-governance-service.ts";
import type {
  ModelRegistryRepository,
  ModelRoutingPolicyRepository,
} from "../model-registry/model-registry-repository.ts";
import type { ModelRegistryRecord } from "../model-registry/model-record.ts";
import type { PromptSkillRegistryRepository } from "../prompt-skill-registry/prompt-skill-repository.ts";
import type { SkillPackageRecord } from "../prompt-skill-registry/prompt-skill-record.ts";
import {
  ActiveRetrievalPresetNotFoundError,
} from "../retrieval-presets/retrieval-preset-service.ts";
import type { RetrievalPresetService } from "../retrieval-presets/retrieval-preset-service.ts";
import type { RuntimeBindingService } from "../runtime-bindings/runtime-binding-service.ts";
import type { RuntimeBindingReadinessService } from "../runtime-bindings/runtime-binding-readiness-service.ts";
import type {
  ModuleTemplateRepository,
  TemplateFamilyRepository,
} from "../templates/template-repository.ts";
import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { TemplateModule } from "../templates/template-record.ts";
import {
  GOVERNED_MANUSCRIPT_MAINLINE_MODULES,
  type ActiveQualityPackageBindingContext,
  type KnowledgeBindingMatchDetail,
  selectApprovedDynamicKnowledge,
} from "../shared/module-run-support.ts";
import type {
  ExecutionResolutionModelSource,
  ProviderReadinessIssueRecord,
  ProviderReadinessRecord,
  ResolvedExecutionBundleRecord,
  ResolvedExecutionKnowledgeSelectionRecord,
  RuntimeBindingReadinessObservationRecord,
} from "./execution-resolution-record.ts";

export interface ResolveExecutionBundleInput {
  module: TemplateModule;
  manuscriptType: ManuscriptType;
  templateFamilyId: string;
  journalTemplateId?: string;
  executionProfileId?: string;
  runtimeBindingId?: string;
  modelRoutingPolicyVersionId?: string;
  retrievalPresetId?: string;
  manualReviewPolicyId?: string;
}

export interface ResolveOperatorSummaryInput {
  manuscriptType: ManuscriptType;
  baseTemplateFamilyId?: string;
  journalTemplateId?: string;
}

export interface ExecutionResolutionServiceOptions {
  executionGovernanceService: ExecutionGovernanceService;
  templateFamilyRepository: Pick<TemplateFamilyRepository, "findJournalTemplateProfileById">;
  moduleTemplateRepository: ModuleTemplateRepository;
  promptSkillRegistryRepository: PromptSkillRegistryRepository;
  knowledgeRepository: KnowledgeRepository;
  modelRegistryRepository: ModelRegistryRepository;
  modelRoutingPolicyRepository: ModelRoutingPolicyRepository;
  aiProviderConnectionRepository?: AiProviderConnectionRepository;
  modelRoutingGovernanceService?: ModelRoutingGovernanceService;
  runtimeBindingService?: Pick<
    RuntimeBindingService,
    "getActiveBindingForScope" | "getBinding" | "resolveActiveQualityPackageContext"
  >;
  retrievalPresetService?: Pick<
    RetrievalPresetService,
    "getActivePresetForScope" | "getPreset"
  >;
  manualReviewPolicyService?: Pick<
    ManualReviewPolicyService,
    "getActivePolicyForScope" | "getPolicy"
  >;
  runtimeBindingReadinessService?: Pick<
    RuntimeBindingReadinessService,
    "getActiveBindingReadinessForScope"
  >;
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

export class ExecutionResolutionScopeMismatchError extends Error {
  constructor(assetKind: string, assetId: string, input: ResolveExecutionBundleInput) {
    super(
      `Resolved execution asset ${assetKind} ${assetId} does not belong to scope ${formatResolutionScope(input)}.`,
    );
    this.name = "ExecutionResolutionScopeMismatchError";
  }
}

export class ExecutionResolutionService {
  private readonly executionGovernanceService: ExecutionGovernanceService;
  private readonly templateFamilyRepository: Pick<
    TemplateFamilyRepository,
    "findJournalTemplateProfileById"
  >;
  private readonly moduleTemplateRepository: ModuleTemplateRepository;
  private readonly promptSkillRegistryRepository: PromptSkillRegistryRepository;
  private readonly knowledgeRepository: KnowledgeRepository;
  private readonly modelRegistryRepository: ModelRegistryRepository;
  private readonly modelRoutingPolicyRepository: ModelRoutingPolicyRepository;
  private readonly aiProviderConnectionRepository?: AiProviderConnectionRepository;
  private readonly modelRoutingGovernanceService?: ModelRoutingGovernanceService;
  private readonly runtimeBindingService?: Pick<
    RuntimeBindingService,
    "getActiveBindingForScope" | "getBinding" | "resolveActiveQualityPackageContext"
  >;
  private readonly retrievalPresetService?: Pick<
    RetrievalPresetService,
    "getActivePresetForScope" | "getPreset"
  >;
  private readonly manualReviewPolicyService?: Pick<
    ManualReviewPolicyService,
    "getActivePolicyForScope" | "getPolicy"
  >;
  private readonly runtimeBindingReadinessService?: Pick<
    RuntimeBindingReadinessService,
    "getActiveBindingReadinessForScope"
  >;

  constructor(options: ExecutionResolutionServiceOptions) {
    this.executionGovernanceService = options.executionGovernanceService;
    this.templateFamilyRepository = options.templateFamilyRepository;
    this.moduleTemplateRepository = options.moduleTemplateRepository;
    this.promptSkillRegistryRepository = options.promptSkillRegistryRepository;
    this.knowledgeRepository = options.knowledgeRepository;
    this.modelRegistryRepository = options.modelRegistryRepository;
    this.modelRoutingPolicyRepository = options.modelRoutingPolicyRepository;
    this.aiProviderConnectionRepository = options.aiProviderConnectionRepository;
    this.modelRoutingGovernanceService = options.modelRoutingGovernanceService;
    this.runtimeBindingService = options.runtimeBindingService;
    this.retrievalPresetService = options.retrievalPresetService;
    this.manualReviewPolicyService = options.manualReviewPolicyService;
    this.runtimeBindingReadinessService = options.runtimeBindingReadinessService;
  }

  async resolveExecutionBundle(
    input: ResolveExecutionBundleInput,
  ): Promise<ResolvedExecutionBundleRecord> {
    const profile = input.executionProfileId
      ? this.assertExecutionProfileScope(
          await this.executionGovernanceService.getProfile(input.executionProfileId),
          input,
        )
      : await this.executionGovernanceService.resolveActiveProfile({
          module: input.module,
          manuscriptType: input.manuscriptType,
          templateFamilyId: input.templateFamilyId,
        });

    const runtimeBinding = await this.resolveRuntimeBinding(input);
    const activeQualityPackages = await this.resolveActiveQualityPackages(
      runtimeBinding?.quality_package_version_ids,
    );
    const modelRoutingPolicyVersion = await this.resolveModelRoutingPolicyVersion(input);
    const retrievalPreset = await this.resolveRetrievalPreset(input);
    const manualReviewPolicy = await this.resolveManualReviewPolicy(input);

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

    const { ruleSet, rules, resolvedRules } =
      await this.executionGovernanceService.resolvePublishedRuleSource(profile, {
        journalTemplateId: input.journalTemplateId,
      });

    const { model, source, fallbackChain } = await this.resolveModel(
      profile,
      modelRoutingPolicyVersion,
    );
    const {
      resolvedConnection,
      warnings,
      providerReadiness,
    } = await this.resolveProviderState(model);
    const {
      knowledgeBindingRules,
      knowledgeSelections,
      knowledgeItems,
    } = await this.resolveKnowledgeSelections({
      profile,
      moduleTemplate,
      retrievalPreset,
      journalTemplateId: input.journalTemplateId,
      qualityPackageVersionIds: runtimeBinding?.quality_package_version_ids,
      activeQualityPackages,
    });

    const runtimeBindingReadiness = await this.observeRuntimeBindingReadiness({
      module: profile.module,
      manuscriptType: profile.manuscript_type,
      templateFamilyId: profile.template_family_id,
    });

    return {
      profile,
      ...(runtimeBinding ? { runtime_binding: runtimeBinding } : {}),
      ...(modelRoutingPolicyVersion
        ? { model_routing_policy_version: modelRoutingPolicyVersion }
        : {}),
      ...(retrievalPreset ? { retrieval_preset: retrievalPreset } : {}),
      ...(manualReviewPolicy ? { manual_review_policy: manualReviewPolicy } : {}),
      module_template: moduleTemplate,
      rule_set: ruleSet,
      rules,
      resolved_rules: resolvedRules,
      prompt_template: promptTemplate,
      skill_packages: skillPackages,
      resolved_model: model,
      model_source: source,
      ...(resolvedConnection ? { resolved_connection: resolvedConnection } : {}),
      provider_readiness: providerReadiness,
      fallback_chain: fallbackChain,
      warnings,
      knowledge_binding_rules: knowledgeBindingRules,
      knowledge_items: dedupeKnowledgeItems(knowledgeItems),
      knowledge_selections: knowledgeSelections,
      runtime_binding_readiness: runtimeBindingReadiness,
    };
  }

  async resolveOperatorSummary(
    input: ResolveOperatorSummaryInput,
  ): Promise<GovernedExecutionContextSummary> {
    const journalTemplateSelectionState: JournalTemplateSelectionState =
      input.journalTemplateId ? "selected" : "base_family_only";
    const journalTemplate = input.journalTemplateId
      ? await this.templateFamilyRepository.findJournalTemplateProfileById(
          input.journalTemplateId,
        )
      : undefined;
    if (!input.baseTemplateFamilyId) {
      return {
        observation_status: "reported",
        manuscript_type: input.manuscriptType,
        journal_template_selection_state: journalTemplateSelectionState,
        ...(input.journalTemplateId
          ? { journal_template_id: input.journalTemplateId }
          : {}),
        ...(journalTemplate?.target_model_version_id
          ? {
              journal_template_target_model_version_id:
                journalTemplate.target_model_version_id,
            }
          : {}),
        ...(journalTemplate?.target_model_version_no != null
          ? {
              journal_template_target_model_version_no:
                journalTemplate.target_model_version_no,
            }
          : {}),
        modules: GOVERNED_MANUSCRIPT_MAINLINE_MODULES.map((module) => ({
          module,
          status: "not_configured",
        })),
      };
    }

    const modules = await Promise.all(
      GOVERNED_MANUSCRIPT_MAINLINE_MODULES.map((module) =>
        this.resolveOperatorModuleSummary({
          module,
          manuscriptType: input.manuscriptType,
          templateFamilyId: input.baseTemplateFamilyId as string,
          journalTemplateId: input.journalTemplateId,
        }),
      ),
    );
    const failedOpenErrors = modules
      .filter((module): module is GovernedExecutionModuleSummary & { error: string } =>
        module.status === "failed_open" && typeof module.error === "string",
      )
      .map((module) => `${module.module}: ${module.error}`);

    return {
      observation_status: failedOpenErrors.length > 0 ? "failed_open" : "reported",
      manuscript_type: input.manuscriptType,
      base_template_family_id: input.baseTemplateFamilyId,
      journal_template_selection_state: journalTemplateSelectionState,
      ...(input.journalTemplateId
        ? { journal_template_id: input.journalTemplateId }
        : {}),
      ...(journalTemplate?.target_model_version_id
        ? {
            journal_template_target_model_version_id:
              journalTemplate.target_model_version_id,
          }
        : {}),
      ...(journalTemplate?.target_model_version_no != null
        ? {
            journal_template_target_model_version_no:
              journalTemplate.target_model_version_no,
          }
        : {}),
      modules,
      ...(failedOpenErrors.length > 0
        ? { error: failedOpenErrors.join("; ") }
        : {}),
    };
  }

  private async observeRuntimeBindingReadiness(
    scope: ResolveExecutionBundleInput,
  ): Promise<RuntimeBindingReadinessObservationRecord> {
    if (!this.runtimeBindingReadinessService) {
      return {
        observation_status: "failed_open",
        error: "Runtime binding readiness service is unavailable.",
      };
    }

    try {
      const report =
        await this.runtimeBindingReadinessService.getActiveBindingReadinessForScope(
          scope,
        );
      return {
        observation_status: "reported",
        report,
      };
    } catch (error) {
      return {
        observation_status: "failed_open",
        error:
          error instanceof Error
            ? error.message
            : "Unknown runtime binding readiness observation error.",
      };
    }
  }

  private async resolveActiveQualityPackages(
    qualityPackageVersionIds?: readonly string[],
  ): Promise<readonly ActiveQualityPackageBindingContext[]> {
    if (
      !this.runtimeBindingService ||
      !qualityPackageVersionIds ||
      qualityPackageVersionIds.length === 0
    ) {
      return [];
    }

    return this.runtimeBindingService.resolveActiveQualityPackageContext([
      ...qualityPackageVersionIds,
    ]);
  }

  private async resolveKnowledgeSelections(input: {
    profile: Awaited<ReturnType<ExecutionGovernanceService["resolveActiveProfile"]>>;
    moduleTemplate: ResolvedExecutionBundleRecord["module_template"];
    retrievalPreset?: ResolvedExecutionBundleRecord["retrieval_preset"];
    journalTemplateId?: string;
    qualityPackageVersionIds?: readonly string[];
    activeQualityPackages: readonly ActiveQualityPackageBindingContext[];
  }): Promise<{
    knowledgeBindingRules: ResolvedExecutionBundleRecord["knowledge_binding_rules"];
    knowledgeSelections: ResolvedExecutionBundleRecord["knowledge_selections"];
    knowledgeItems: KnowledgeRecord[];
  }> {
    const knowledgeSelectionsById = new Map<
      string,
      ResolvedExecutionKnowledgeSelectionRecord
    >();
    const knowledgeBindingRules =
      await this.executionGovernanceService.listApplicableActiveKnowledgeBindingRules({
        module: input.profile.module,
        manuscriptType: input.profile.manuscript_type,
        templateFamilyId: input.profile.template_family_id,
        moduleTemplateId: input.profile.module_template_id,
      });

    for (const rule of knowledgeBindingRules) {
      const knowledgeItem = await this.knowledgeRepository.findApprovedById(
        rule.knowledge_item_id,
      );
      if (!knowledgeItem || knowledgeItem.status !== "approved") {
        throw new ExecutionResolutionKnowledgeItemNotFoundError(
          rule.knowledge_item_id,
        );
      }

      knowledgeSelectionsById.set(
        knowledgeItem.id,
        createBindingRuleKnowledgeSelection(rule, knowledgeItem),
      );
    }

    if (input.profile.knowledge_binding_mode === "profile_plus_dynamic") {
      const previewManuscript = {
        current_template_family_id: input.profile.template_family_id,
        current_journal_template_id: input.journalTemplateId,
        manuscript_type: input.profile.manuscript_type,
      } as Parameters<typeof selectApprovedDynamicKnowledge>[0]["manuscript"];
      const dynamicSelections = selectApprovedDynamicKnowledge({
        manuscript: previewManuscript,
        module: input.profile.module,
        template: input.moduleTemplate,
        knowledgeItems: await this.knowledgeRepository.listApproved(),
        retrievalPreset: input.retrievalPreset ?? undefined,
        qualityPackageVersionIds: input.qualityPackageVersionIds
          ? [...input.qualityPackageVersionIds]
          : undefined,
        activeQualityPackages: input.activeQualityPackages,
      });

      for (const selection of dynamicSelections) {
        if (knowledgeSelectionsById.has(selection.knowledgeItem.id)) {
          continue;
        }

        knowledgeSelectionsById.set(
          selection.knowledgeItem.id,
          toResolvedExecutionKnowledgeSelection(selection),
        );
      }
    }

    await expandResolvedExecutionKnowledgeSelections({
      knowledgeSelectionsById,
      knowledgeRepository: this.knowledgeRepository,
    });

    const knowledgeSelections = [...knowledgeSelectionsById.values()];
    return {
      knowledgeBindingRules,
      knowledgeSelections,
      knowledgeItems: knowledgeSelections.map((selection) => selection.knowledge_item),
    };
  }

  private async resolveModel(profile: {
    module: TemplateModule;
    module_template_id: string;
    template_family_id: string;
  }, overridePolicyVersion?: {
    id: string;
    primary_model_id: string;
    fallback_model_ids: string[];
  }): Promise<{
    model: ModelRegistryRecord;
    source: ExecutionResolutionModelSource;
    fallbackChain: ModelRegistryRecord[];
  }> {
    if (overridePolicyVersion) {
      const { model, fallbackChain } = await this.requireGovernedPolicyModel(
        overridePolicyVersion.primary_model_id,
        profile.module,
        profile.template_family_id,
        overridePolicyVersion.fallback_model_ids,
      );

      return {
        model,
        source: "template_family_policy",
        fallbackChain,
      };
    }

    if (this.modelRoutingGovernanceService) {
      const templateFamilyPolicy =
        await this.modelRoutingGovernanceService.findActivePolicy(
          "template_family",
          profile.template_family_id,
        );
      const activeTemplateFamilyVersion = templateFamilyPolicy?.active_version;
      if (activeTemplateFamilyVersion) {
        const { model, fallbackChain } = await this.requireGovernedPolicyModel(
          activeTemplateFamilyVersion.primary_model_id,
          profile.module,
          profile.template_family_id,
          activeTemplateFamilyVersion.fallback_model_ids,
        );

        return {
          model,
          source: "template_family_policy",
          fallbackChain,
        };
      }

      const modulePolicy = await this.modelRoutingGovernanceService.findActivePolicy(
        "module",
        profile.module,
      );
      const activeModuleVersion = modulePolicy?.active_version;
      if (activeModuleVersion) {
        const { model, fallbackChain } = await this.requireGovernedPolicyModel(
          activeModuleVersion.primary_model_id,
          profile.module,
          profile.template_family_id,
          activeModuleVersion.fallback_model_ids,
        );

        return {
          model,
          source: "module_policy",
          fallbackChain,
        };
      }
    }

    const policy = await this.modelRoutingPolicyRepository.get();
    const candidates: Array<{
      modelId?: string;
      source: ExecutionResolutionModelSource;
    }> = [
      {
        modelId: policy.template_overrides[profile.module_template_id],
        source: "legacy_template_override",
      },
      {
        modelId: policy.module_defaults[profile.module],
        source: "legacy_module_default",
      },
      {
        modelId: policy.system_default_model_id,
        source: "legacy_system_default",
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
        fallbackChain: await this.resolveModelFallbackChain(
          model,
          profile.module,
          profile.template_family_id,
        ),
      };
    }

    throw new ExecutionResolutionModelNotFoundError(
      profile.module,
      profile.template_family_id,
    );
  }

  private async requireGovernedPolicyModel(
    primaryModelId: string,
    module: TemplateModule,
    templateFamilyId: string,
    fallbackModelIds: string[],
  ): Promise<{
    model: ModelRegistryRecord;
    fallbackChain: ModelRegistryRecord[];
  }> {
    const model = await this.modelRegistryRepository.findById(primaryModelId);
    if (!model) {
      throw new ExecutionResolutionModelNotFoundError(module, templateFamilyId);
    }

    if (!model.is_prod_allowed || !model.allowed_modules.includes(module)) {
      throw new ExecutionResolutionModelIncompatibleError(model.id, module);
    }

    const fallbackChain =
      fallbackModelIds.length > 0
        ? await this.requireFallbackModels(fallbackModelIds, module, templateFamilyId)
        : await this.resolveModelFallbackChain(model, module, templateFamilyId);

    return { model, fallbackChain };
  }

  private async requireFallbackModels(
    fallbackModelIds: string[],
    module: TemplateModule,
    templateFamilyId: string,
  ): Promise<ModelRegistryRecord[]> {
    const result: ModelRegistryRecord[] = [];

    for (const fallbackModelId of fallbackModelIds) {
      const fallbackModel = await this.modelRegistryRepository.findById(fallbackModelId);
      if (!fallbackModel) {
        throw new ExecutionResolutionModelNotFoundError(module, templateFamilyId);
      }

      if (
        !fallbackModel.is_prod_allowed ||
        !fallbackModel.allowed_modules.includes(module)
      ) {
        throw new ExecutionResolutionModelIncompatibleError(
          fallbackModel.id,
          module,
        );
      }

      result.push(fallbackModel);
    }

    return result;
  }

  private async resolveModelFallbackChain(
    model: ModelRegistryRecord,
    module: TemplateModule,
    templateFamilyId: string,
  ): Promise<ModelRegistryRecord[]> {
    const result: ModelRegistryRecord[] = [];
    const seen = new Set<string>([model.id]);
    let nextModelId = model.fallback_model_id;

    while (nextModelId && !seen.has(nextModelId)) {
      const fallbackModel = await this.modelRegistryRepository.findById(nextModelId);
      if (!fallbackModel) {
        throw new ExecutionResolutionModelNotFoundError(module, templateFamilyId);
      }

      if (
        !fallbackModel.is_prod_allowed ||
        !fallbackModel.allowed_modules.includes(module)
      ) {
        throw new ExecutionResolutionModelIncompatibleError(
          fallbackModel.id,
          module,
        );
      }

      result.push(fallbackModel);
      seen.add(nextModelId);
      nextModelId = fallbackModel.fallback_model_id;
    }

    return result;
  }

  private async resolveProviderState(
    model: ModelRegistryRecord,
  ): Promise<{
    resolvedConnection?: ResolvedAiProviderConnectionSummary;
    warnings: ModelSelectionWarning[];
    providerReadiness: ProviderReadinessRecord;
  }> {
    if (!model.connection_id) {
      return {
        warnings: [createLegacyUnboundWarning()],
        providerReadiness: {
          status: "warning",
          issues: [createProviderIssue("legacy_unbound")],
        },
      };
    }

    if (!this.aiProviderConnectionRepository) {
      return {
        warnings: [],
        providerReadiness: {
          status: "warning",
          issues: [createProviderIssue("connection_missing", model.connection_id)],
        },
      };
    }

    const connection = await this.aiProviderConnectionRepository.findById(
      model.connection_id,
    );
    if (!connection) {
      return {
        warnings: [createWarning("connection_missing", model.connection_id)],
        providerReadiness: {
          status: "warning",
          issues: [createProviderIssue("connection_missing", model.connection_id)],
        },
      };
    }

    return {
      resolvedConnection: summarizeConnection(connection),
      warnings: buildConnectionWarnings(connection),
      providerReadiness: buildProviderReadiness(connection),
    };
  }

  private async resolveRuntimeBinding(
    input: ResolveExecutionBundleInput,
  ): Promise<ResolvedExecutionBundleRecord["runtime_binding"]> {
    if (!this.runtimeBindingService) {
      if (input.runtimeBindingId) {
        throw new ExecutionResolutionProfileAssetNotFoundError(
          "runtime_binding_service",
          "unavailable",
        );
      }

      return undefined;
    }

    if (input.runtimeBindingId) {
      return this.assertRuntimeBindingScope(
        await this.runtimeBindingService.getBinding(input.runtimeBindingId),
        input,
      );
    }

    return this.runtimeBindingService.getActiveBindingForScope({
          module: input.module,
          manuscriptType: input.manuscriptType,
          templateFamilyId: input.templateFamilyId,
        });
  }

  private async resolveModelRoutingPolicyVersion(
    input: ResolveExecutionBundleInput,
  ): Promise<ResolvedExecutionBundleRecord["model_routing_policy_version"]> {
    if (!this.modelRoutingGovernanceService) {
      if (input.modelRoutingPolicyVersionId) {
        throw new ExecutionResolutionProfileAssetNotFoundError(
          "model_routing_policy_version_service",
          "unavailable",
        );
      }

      return undefined;
    }

    if (input.modelRoutingPolicyVersionId) {
      const policies = await this.modelRoutingGovernanceService.listPolicies();
      const version = policies
        .flatMap((policy) => policy.versions)
        .find((record) => record.id === input.modelRoutingPolicyVersionId);
      if (!version) {
        throw new ExecutionResolutionProfileAssetNotFoundError(
          "model_routing_policy_version",
          input.modelRoutingPolicyVersionId,
        );
      }

      return this.assertModelRoutingPolicyVersionScope(version, input);
    }

    const templateFamilyPolicy =
      await this.modelRoutingGovernanceService.findActivePolicy(
        "template_family",
        input.templateFamilyId,
      );
    if (templateFamilyPolicy?.active_version) {
      return templateFamilyPolicy.active_version;
    }

    const modulePolicy = await this.modelRoutingGovernanceService.findActivePolicy(
      "module",
      input.module,
    );
    if (modulePolicy?.active_version) {
      return modulePolicy.active_version;
    }

    return undefined;
  }

  private async resolveRetrievalPreset(
    input: ResolveExecutionBundleInput,
  ): Promise<ResolvedExecutionBundleRecord["retrieval_preset"]> {
    if (!this.retrievalPresetService) {
      if (input.retrievalPresetId) {
        throw new ExecutionResolutionProfileAssetNotFoundError(
          "retrieval_preset_service",
          "unavailable",
        );
      }

      return undefined;
    }

    if (input.retrievalPresetId) {
      return this.assertRetrievalPresetScope(
        await this.retrievalPresetService.getPreset(input.retrievalPresetId),
        input,
      );
    }

    try {
      return await this.retrievalPresetService.getActivePresetForScope({
          module: input.module,
          manuscriptType: input.manuscriptType,
          templateFamilyId: input.templateFamilyId,
        });
    } catch (error) {
      if (error instanceof ActiveRetrievalPresetNotFoundError) {
        return undefined;
      }

      throw error;
    }
  }

  private async resolveManualReviewPolicy(
    input: ResolveExecutionBundleInput,
  ): Promise<ResolvedExecutionBundleRecord["manual_review_policy"]> {
    if (!this.manualReviewPolicyService) {
      if (input.manualReviewPolicyId) {
        throw new ExecutionResolutionProfileAssetNotFoundError(
          "manual_review_policy_service",
          "unavailable",
        );
      }

      return undefined;
    }

    if (input.manualReviewPolicyId) {
      return this.assertManualReviewPolicyScope(
        await this.manualReviewPolicyService.getPolicy(input.manualReviewPolicyId),
        input,
      );
    }

    try {
      return await this.manualReviewPolicyService.getActivePolicyForScope({
          module: input.module,
          manuscriptType: input.manuscriptType,
          templateFamilyId: input.templateFamilyId,
        });
    } catch (error) {
      if (error instanceof ActiveManualReviewPolicyNotFoundError) {
        return undefined;
      }

      throw error;
    }
  }

  private assertExecutionProfileScope(
    profile: Awaited<ReturnType<ExecutionGovernanceService["getProfile"]>>,
    input: ResolveExecutionBundleInput,
  ): Awaited<ReturnType<ExecutionGovernanceService["getProfile"]>> {
    if (
      profile.module !== input.module ||
      profile.manuscript_type !== input.manuscriptType ||
      profile.template_family_id !== input.templateFamilyId
    ) {
      throw new ExecutionResolutionScopeMismatchError(
        "execution_profile",
        profile.id,
        input,
      );
    }

    return profile;
  }

  private assertRuntimeBindingScope(
    binding: NonNullable<ResolvedExecutionBundleRecord["runtime_binding"]>,
    input: ResolveExecutionBundleInput,
  ): NonNullable<ResolvedExecutionBundleRecord["runtime_binding"]> {
    if (
      binding.module !== input.module ||
      binding.manuscript_type !== input.manuscriptType ||
      binding.template_family_id !== input.templateFamilyId
    ) {
      throw new ExecutionResolutionScopeMismatchError(
        "runtime_binding",
        binding.id,
        input,
      );
    }

    return binding;
  }

  private assertModelRoutingPolicyVersionScope(
    version: NonNullable<ResolvedExecutionBundleRecord["model_routing_policy_version"]>,
    input: ResolveExecutionBundleInput,
  ): NonNullable<ResolvedExecutionBundleRecord["model_routing_policy_version"]> {
    const isCompatible =
      (version.scope_kind === "template_family" &&
        version.scope_value === input.templateFamilyId) ||
      (version.scope_kind === "module" && version.scope_value === input.module);
    if (!isCompatible) {
      throw new ExecutionResolutionScopeMismatchError(
        "model_routing_policy_version",
        version.id,
        input,
      );
    }

    return version;
  }

  private assertRetrievalPresetScope(
    preset: NonNullable<ResolvedExecutionBundleRecord["retrieval_preset"]>,
    input: ResolveExecutionBundleInput,
  ): NonNullable<ResolvedExecutionBundleRecord["retrieval_preset"]> {
    if (
      preset.module !== input.module ||
      preset.manuscript_type !== input.manuscriptType ||
      preset.template_family_id !== input.templateFamilyId
    ) {
      throw new ExecutionResolutionScopeMismatchError(
        "retrieval_preset",
        preset.id,
        input,
      );
    }

    return preset;
  }

  private assertManualReviewPolicyScope(
    policy: NonNullable<ResolvedExecutionBundleRecord["manual_review_policy"]>,
    input: ResolveExecutionBundleInput,
  ): NonNullable<ResolvedExecutionBundleRecord["manual_review_policy"]> {
    if (
      policy.module !== input.module ||
      policy.manuscript_type !== input.manuscriptType ||
      policy.template_family_id !== input.templateFamilyId
    ) {
      throw new ExecutionResolutionScopeMismatchError(
        "manual_review_policy",
        policy.id,
        input,
      );
    }

    return policy;
  }

  private async resolveOperatorModuleSummary(input: {
    module: TemplateModule;
    manuscriptType: ManuscriptType;
    templateFamilyId: string;
    journalTemplateId?: string;
  }): Promise<GovernedExecutionModuleSummary> {
    try {
      const bundle = await this.resolveExecutionBundle({
        module: input.module,
        manuscriptType: input.manuscriptType,
        templateFamilyId: input.templateFamilyId,
        journalTemplateId: input.journalTemplateId,
      });

      return {
        module: input.module,
        status: "resolved",
        execution_profile_id: bundle.profile.id,
        module_template_id: bundle.module_template.id,
        ...(bundle.runtime_binding
          ? { runtime_binding_id: bundle.runtime_binding.id }
          : {}),
        ...(bundle.model_routing_policy_version
          ? {
              model_routing_policy_version_id:
                bundle.model_routing_policy_version.id,
            }
          : {}),
        ...(bundle.retrieval_preset
          ? { retrieval_preset_id: bundle.retrieval_preset.id }
          : {}),
        ...(bundle.manual_review_policy
          ? { manual_review_policy_id: bundle.manual_review_policy.id }
          : {}),
        resolved_model_id: bundle.resolved_model.id,
        model_source: bundle.model_source,
        provider_readiness_status: bundle.provider_readiness.status,
        ...(bundle.runtime_binding?.quality_package_version_ids?.length
          ? {
              quality_package_ids: [
                ...bundle.runtime_binding.quality_package_version_ids,
              ],
            }
          : {}),
        resolved_rule_count: bundle.resolved_rules.length,
        knowledge_selection_count: bundle.knowledge_selections.length,
        resolved_rules: bundle.resolved_rules.map((rule) =>
          summarizeResolvedRule(rule),
        ),
        knowledge_selections: bundle.knowledge_selections.map((selection) =>
          summarizeKnowledgeSelection(selection),
        ),
        ...(bundle.runtime_binding_readiness.observation_status === "reported" &&
        bundle.runtime_binding_readiness.report
          ? {
              runtime_binding_readiness_status:
                bundle.runtime_binding_readiness.report.status,
            }
          : {}),
        ...(bundle.warnings.length > 0
          ? { warning_codes: bundle.warnings.map((warning) => warning.code) }
          : {}),
      };
    } catch (error) {
      if (error instanceof ActiveExecutionProfileNotFoundError) {
        return {
          module: input.module,
          status: "not_configured",
        };
      }

      return {
        module: input.module,
        status: "failed_open",
        error:
          error instanceof Error
            ? error.message
            : "Unknown operator summary resolution error.",
      };
    }
  }
}

function createBindingRuleKnowledgeSelection(
  rule: ResolvedExecutionBundleRecord["knowledge_binding_rules"][number],
  knowledgeItem: KnowledgeRecord,
): ResolvedExecutionKnowledgeSelectionRecord {
  const primaryBinding: KnowledgeBindingMatchDetail = {
    reason: "binding_rule",
    sourceId: rule.id,
    priority: 8,
  };

  return {
    knowledge_item: knowledgeItem,
    match_source: "binding_rule",
    match_source_id: rule.id,
    binding_rule_id: rule.id,
    match_reasons: [
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
    binding_priority: 8,
    primary_binding: primaryBinding,
    binding_matches: [primaryBinding],
  };
}

function toResolvedExecutionKnowledgeSelection(
  selection: ReturnType<typeof selectApprovedDynamicKnowledge>[number],
): ResolvedExecutionKnowledgeSelectionRecord {
  return {
    knowledge_item: selection.knowledgeItem,
    match_source: selection.matchSource,
    ...(selection.matchSourceId ? { match_source_id: selection.matchSourceId } : {}),
    match_reasons: [...selection.matchReasons],
    ...(selection.bindingPriority !== undefined
      ? { binding_priority: selection.bindingPriority }
      : {}),
    ...(selection.retrievalScore !== undefined
      ? { retrieval_score: selection.retrievalScore }
      : {}),
    ...(selection.primaryBinding
      ? { primary_binding: selection.primaryBinding }
      : {}),
    ...(selection.bindingMatches?.length
      ? { binding_matches: selection.bindingMatches }
      : {}),
  };
}

async function expandResolvedExecutionKnowledgeSelections(input: {
  knowledgeSelectionsById: Map<string, ResolvedExecutionKnowledgeSelectionRecord>;
  knowledgeRepository: KnowledgeRepository;
}): Promise<void> {
  const queuedIds = new Set(input.knowledgeSelectionsById.keys());
  const processedIds = new Set<string>();
  const queue = [...input.knowledgeSelectionsById.values()];

  while (queue.length > 0) {
    const parentSelection = queue.shift();
    if (!parentSelection || processedIds.has(parentSelection.knowledge_item.id)) {
      continue;
    }

    processedIds.add(parentSelection.knowledge_item.id);

    for (const linkedKnowledgeItemId of parentSelection.knowledge_item
      .linked_knowledge_item_ids ?? []) {
      const existingSelection = input.knowledgeSelectionsById.get(linkedKnowledgeItemId);
      if (existingSelection) {
        existingSelection.match_reasons = dedupeExecutionMatchReasons([
          ...existingSelection.match_reasons,
          "knowledge_item_binding",
        ]);
        existingSelection.binding_matches = dedupeExecutionBindingMatches([
          ...(existingSelection.binding_matches ?? []),
          createKnowledgeItemBindingDetail(parentSelection),
        ]);
        continue;
      }

      const linkedKnowledgeItem =
        await input.knowledgeRepository.findApprovedById(linkedKnowledgeItemId);
      if (!linkedKnowledgeItem || linkedKnowledgeItem.status !== "approved") {
        continue;
      }

      const linkedSelection: ResolvedExecutionKnowledgeSelectionRecord = {
        knowledge_item: linkedKnowledgeItem,
        match_source: "knowledge_item_binding",
        match_source_id: `knowledge_item:${parentSelection.knowledge_item.id}`,
        match_reasons: ["knowledge_item_binding"],
        binding_priority: parentSelection.binding_priority ?? 1,
        primary_binding: createKnowledgeItemBindingDetail(parentSelection),
        binding_matches: [createKnowledgeItemBindingDetail(parentSelection)],
      };
      input.knowledgeSelectionsById.set(linkedKnowledgeItem.id, linkedSelection);

      if (!queuedIds.has(linkedKnowledgeItem.id)) {
        queuedIds.add(linkedKnowledgeItem.id);
        queue.push(linkedSelection);
      }
    }
  }
}

function createKnowledgeItemBindingDetail(
  selection: ResolvedExecutionKnowledgeSelectionRecord,
): KnowledgeBindingMatchDetail {
  return {
    reason: "knowledge_item_binding",
    sourceId: `knowledge_item:${selection.knowledge_item.id}`,
    priority: selection.binding_priority ?? 1,
  };
}

function dedupeExecutionMatchReasons(reasons: readonly string[]): string[] {
  return [...new Set(reasons)];
}

function dedupeExecutionBindingMatches(
  matches: readonly KnowledgeBindingMatchDetail[],
): KnowledgeBindingMatchDetail[] {
  const seen = new Set<string>();
  const result: KnowledgeBindingMatchDetail[] = [];

  for (const match of matches) {
    const key = `${match.reason}:${match.sourceId}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(match);
  }

  return result;
}

function summarizeResolvedRule(
  rule: ResolvedExecutionBundleRecord["resolved_rules"][number],
): GovernedResolvedRuleSummary {
  const activationSourceKind = resolveGovernedRuleActivationSourceKind(rule);

  return {
    rule_id: rule.rule.id,
    rule_object: rule.rule.rule_object,
    rule_type: rule.rule.rule_type,
    coverage_key: rule.coverage_key,
    source_layer: resolveGovernedRuleSourceLayer(activationSourceKind),
    activation_source_kind: activationSourceKind,
    activation_source_id:
      rule.activation_source?.id ?? rule.rule.rule_set_id,
    overridden_rule_ids: [...rule.overridden_rule_ids],
    resolution_reason: rule.resolution_reason,
    execution_posture: rule.execution_posture,
    effective_scope: readGovernedRuleEffectiveScope(rule),
    ...(readSupportingKnowledgeItemIds(rule).length > 0
      ? { supporting_knowledge_item_ids: readSupportingKnowledgeItemIds(rule) }
      : {}),
    ...(rule.conflict_kind ? { conflict_kind: rule.conflict_kind } : {}),
  };
}

function summarizeKnowledgeSelection(
  selection: ResolvedExecutionKnowledgeSelectionRecord,
): GovernedKnowledgeSelectionSummary {
  return {
    knowledge_item_id: selection.knowledge_item.id,
    title: selection.knowledge_item.title,
    match_source: selection.match_source,
    match_reasons: [...selection.match_reasons],
    ...(selection.match_source_id
      ? { match_source_id: selection.match_source_id }
      : {}),
    ...(selection.binding_rule_id
      ? { binding_rule_id: selection.binding_rule_id }
      : {}),
    ...(selection.binding_priority !== undefined
      ? { binding_priority: selection.binding_priority }
      : {}),
    ...(selection.retrieval_score !== undefined
      ? { retrieval_score: selection.retrieval_score }
      : {}),
    ...(selection.primary_binding
      ? { primary_binding: summarizeKnowledgeBindingMatch(selection.primary_binding) }
      : {}),
    ...(selection.binding_matches?.length
      ? {
          binding_matches: selection.binding_matches.map(
            summarizeKnowledgeBindingMatch,
          ),
        }
      : {}),
  };
}

function summarizeKnowledgeBindingMatch(
  match: KnowledgeBindingMatchDetail,
): GovernedKnowledgeBindingMatchSummary {
  return {
    reason: match.reason,
    source_id: match.sourceId,
    priority: match.priority,
  };
}

function resolveGovernedRuleActivationSourceKind(
  rule: ResolvedExecutionBundleRecord["resolved_rules"][number],
): GovernedResolvedRuleSummary["activation_source_kind"] {
  return (
    rule.activation_source?.kind ??
    (rule.source_layer === "journal"
      ? "journal_template_rule_set"
      : "template_family_rule_set")
  );
}

function resolveGovernedRuleSourceLayer(
  kind: GovernedResolvedRuleSummary["activation_source_kind"],
): GovernedResolvedRuleSummary["source_layer"] {
  switch (kind) {
    case "medical_package":
      return "medical";
    case "journal_template_rule_set":
      return "journal";
    default:
      return "general";
  }
}

function readGovernedRuleEffectiveScope(
  rule: ResolvedExecutionBundleRecord["resolved_rules"][number],
): GovernedResolvedRuleSummary["effective_scope"] {
  if (rule.effective_scope) {
    return {
      ...(rule.effective_scope.manuscript_types
        ? { manuscript_types: [...rule.effective_scope.manuscript_types] }
        : {}),
      ...(rule.effective_scope.sections
        ? { sections: [...rule.effective_scope.sections] }
        : {}),
      ...(rule.effective_scope.object_granularity
        ? { object_granularity: [...rule.effective_scope.object_granularity] }
        : {}),
    };
  }

  return {
    ...(readExecutionScopeList(rule.rule.scope.manuscript_types).length > 0
      ? {
          manuscript_types: readExecutionScopeList(
            rule.rule.scope.manuscript_types,
          ) as ManuscriptType[],
        }
      : {}),
    ...(readExecutionScopeList(rule.rule.scope.sections).length > 0
      ? { sections: readExecutionScopeList(rule.rule.scope.sections) }
      : {}),
    ...(readExecutionScopeList(rule.rule.scope.object_granularity).length > 0
      ? {
          object_granularity: readExecutionScopeList(
            rule.rule.scope.object_granularity,
          ),
        }
      : {}),
  };
}

function readSupportingKnowledgeItemIds(
  rule: ResolvedExecutionBundleRecord["resolved_rules"][number],
): string[] {
  return (rule.rule.linkage_payload?.projected_knowledge_item_ids ?? []).filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
}

function readExecutionScopeList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function summarizeConnection(
  connection: AiProviderConnectionRecord,
): ResolvedAiProviderConnectionSummary {
  return {
    id: connection.id,
    name: connection.name,
    provider_kind: connection.provider_kind,
    compatibility_mode: connection.compatibility_mode,
    enabled: connection.enabled,
    last_test_status: connection.last_test_status ?? "unknown",
    credential_present: Boolean(connection.credential_summary),
  };
}

function buildConnectionWarnings(
  connection: AiProviderConnectionRecord,
): ModelSelectionWarning[] {
  const warnings: ModelSelectionWarning[] = [];

  if (!connection.enabled) {
    warnings.push(createWarning("connection_disabled", connection.name));
  }

  if (!connection.credential_summary) {
    warnings.push(createWarning("credential_missing", connection.name));
  }

  return warnings;
}

function buildProviderReadiness(
  connection: AiProviderConnectionRecord,
): ProviderReadinessRecord {
  const issues: ProviderReadinessIssueRecord[] = [];

  if (!connection.enabled) {
    issues.push(createProviderIssue("connection_disabled", connection.name));
  }

  if (!connection.credential_summary) {
    issues.push(createProviderIssue("credential_missing", connection.name));
  }

  const lastTestStatus = connection.last_test_status ?? "unknown";
  if (lastTestStatus === "failed") {
    issues.push(createProviderIssue("connection_test_failed", connection.name));
  }

  if (lastTestStatus === "unknown") {
    issues.push(createProviderIssue("connection_test_unknown", connection.name));
  }

  return {
    status: issues.length > 0 ? "warning" : "ok",
    issues,
  };
}

function createLegacyUnboundWarning(): ModelSelectionWarning {
  return {
    code: "legacy_unbound",
    message: "Resolved model is still using legacy provider fields without connection_id.",
  };
}

function createWarning(
  code: Exclude<ModelSelectionWarning["code"], "legacy_unbound">,
  label: string,
): ModelSelectionWarning {
  switch (code) {
    case "connection_missing":
      return {
        code,
        message: `Resolved model references missing ai provider connection ${label}.`,
      };
    case "connection_disabled":
      return {
        code,
        message: `AI provider connection "${label}" is disabled.`,
      };
    case "credential_missing":
      return {
        code,
        message: `AI provider connection "${label}" does not have credentials configured.`,
      };
    default:
      return {
        code,
        message: label,
      };
  }
}

function formatResolutionScope(input: ResolveExecutionBundleInput): string {
  return `${input.module}/${input.manuscriptType}/${input.templateFamilyId}${
    input.journalTemplateId ? `/journal:${input.journalTemplateId}` : ""
  }`;
}

function createProviderIssue(
  code: ProviderReadinessIssueRecord["code"],
  label?: string,
): ProviderReadinessIssueRecord {
  switch (code) {
    case "legacy_unbound":
      return {
        code,
        message: "Resolved model is still using legacy provider fields without connection_id.",
      };
    case "connection_missing":
      return {
        code,
        message: `Resolved model references missing ai provider connection ${label}.`,
      };
    case "connection_disabled":
      return {
        code,
        message: `AI provider connection "${label}" is disabled.`,
      };
    case "credential_missing":
      return {
        code,
        message: `AI provider connection "${label}" does not have credentials configured.`,
      };
    case "connection_test_failed":
      return {
        code,
        message: `AI provider connection "${label}" failed its latest connectivity test.`,
      };
    case "connection_test_unknown":
      return {
        code,
        message: `AI provider connection "${label}" has not been connectivity-tested yet.`,
      };
    default:
      return {
        code,
        message: label ?? code,
      };
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
