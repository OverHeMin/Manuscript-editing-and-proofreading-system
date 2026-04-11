import type { ExecutionGovernanceService } from "../execution-governance/execution-governance-service.ts";
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
import type { ModuleTemplateRepository } from "../templates/template-repository.ts";
import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { TemplateModule } from "../templates/template-record.ts";
import type {
  ExecutionResolutionModelSource,
  ProviderReadinessIssueRecord,
  ProviderReadinessRecord,
  ResolvedExecutionBundleRecord,
  RuntimeBindingReadinessObservationRecord,
} from "./execution-resolution-record.ts";

export interface ResolveExecutionBundleInput {
  module: TemplateModule;
  manuscriptType: ManuscriptType;
  templateFamilyId: string;
  executionProfileId?: string;
  runtimeBindingId?: string;
  modelRoutingPolicyVersionId?: string;
  retrievalPresetId?: string;
  manualReviewPolicyId?: string;
}

export interface ExecutionResolutionServiceOptions {
  executionGovernanceService: ExecutionGovernanceService;
  moduleTemplateRepository: ModuleTemplateRepository;
  promptSkillRegistryRepository: PromptSkillRegistryRepository;
  knowledgeRepository: KnowledgeRepository;
  modelRegistryRepository: ModelRegistryRepository;
  modelRoutingPolicyRepository: ModelRoutingPolicyRepository;
  aiProviderConnectionRepository?: AiProviderConnectionRepository;
  modelRoutingGovernanceService?: ModelRoutingGovernanceService;
  runtimeBindingService?: Pick<
    RuntimeBindingService,
    "getActiveBindingForScope" | "getBinding"
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

export class ExecutionResolutionService {
  private readonly executionGovernanceService: ExecutionGovernanceService;
  private readonly moduleTemplateRepository: ModuleTemplateRepository;
  private readonly promptSkillRegistryRepository: PromptSkillRegistryRepository;
  private readonly knowledgeRepository: KnowledgeRepository;
  private readonly modelRegistryRepository: ModelRegistryRepository;
  private readonly modelRoutingPolicyRepository: ModelRoutingPolicyRepository;
  private readonly aiProviderConnectionRepository?: AiProviderConnectionRepository;
  private readonly modelRoutingGovernanceService?: ModelRoutingGovernanceService;
  private readonly runtimeBindingService?: Pick<
    RuntimeBindingService,
    "getActiveBindingForScope" | "getBinding"
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
      ? await this.executionGovernanceService.getProfile(input.executionProfileId)
      : await this.executionGovernanceService.resolveActiveProfile({
          module: input.module,
          manuscriptType: input.manuscriptType,
          templateFamilyId: input.templateFamilyId,
        });

    const runtimeBinding = await this.resolveRuntimeBinding(input);
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

    const { ruleSet, rules } =
      await this.executionGovernanceService.resolvePublishedRuleSource(profile);

    const { model, source, fallbackChain } = await this.resolveModel(
      profile,
      modelRoutingPolicyVersion,
    );
    const {
      resolvedConnection,
      warnings,
      providerReadiness,
    } = await this.resolveProviderState(model);
    const knowledgeBindingRules =
      await this.executionGovernanceService.listApplicableActiveKnowledgeBindingRules({
        module: profile.module,
        manuscriptType: profile.manuscript_type,
        templateFamilyId: profile.template_family_id,
        moduleTemplateId: profile.module_template_id,
      });

    const knowledgeItems: KnowledgeRecord[] = [];
    for (const rule of knowledgeBindingRules) {
      const knowledgeItem = await this.knowledgeRepository.findApprovedById(
        rule.knowledge_item_id,
      );
      if (!knowledgeItem || knowledgeItem.status !== "approved") {
        throw new ExecutionResolutionKnowledgeItemNotFoundError(
          rule.knowledge_item_id,
        );
      }

      knowledgeItems.push(knowledgeItem);
    }

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
      runtime_binding_readiness: runtimeBindingReadiness,
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
      return this.runtimeBindingService.getBinding(input.runtimeBindingId);
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

      return version;
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
      return this.retrievalPresetService.getPreset(input.retrievalPresetId);
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
      return this.manualReviewPolicyService.getPolicy(input.manualReviewPolicyId);
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
