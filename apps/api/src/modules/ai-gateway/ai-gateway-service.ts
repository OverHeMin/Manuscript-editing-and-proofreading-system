import type { AuditService } from "../../audit/audit-service.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { ModelRoutingPolicyScopeKind } from "../model-routing-governance/model-routing-governance-record.ts";
import type { ModelRoutingGovernanceService } from "../model-routing-governance/model-routing-governance-service.ts";
import type { TemplateModule } from "../templates/template-record.ts";
import type { ModelRegistryRecord } from "../model-registry/model-record.ts";
import type {
  ModelRegistryRepository,
  ModelRoutingPolicyRepository,
} from "../model-registry/model-registry-repository.ts";

export interface ResolveModelSelectionInput {
  module: TemplateModule;
  templateFamilyId?: string;
  moduleTemplateId?: string;
  taskId?: string;
  taskOverrideModelId?: string;
  taskOverrideAllowList?: string[];
  actorId?: string;
  actorRole?: RoleKey;
}

export type ResolvedModelSelectionLayer =
  | "template_family_policy"
  | "module_policy"
  | "legacy_template_override"
  | "legacy_module_default"
  | "legacy_system_default"
  | "task_override";

export interface ResolvedModelSelection {
  layer: ResolvedModelSelectionLayer;
  model: ModelRegistryRecord;
  fallback_chain: ModelRegistryRecord[];
  policy_version_id?: string;
  policy_scope_kind?: ModelRoutingPolicyScopeKind;
  policy_scope_value?: string;
}

export interface AiGatewayServiceOptions {
  repository: ModelRegistryRepository;
  routingPolicyRepository: ModelRoutingPolicyRepository;
  modelRoutingGovernanceService?: ModelRoutingGovernanceService;
  auditService: AuditService;
  now?: () => Date;
}

interface ModelSelectionDecision {
  layer: ResolvedModelSelectionLayer;
  modelId: string;
  fallbackModelIds: string[];
  policyVersionId?: string;
  policyScopeKind?: ModelRoutingPolicyScopeKind;
  policyScopeValue?: string;
}

export class NoModelRouteConfiguredError extends Error {
  constructor(module: string) {
    super(`No AI model route is configured for module ${module}.`);
    this.name = "NoModelRouteConfiguredError";
  }
}

export class ModelSelectionNotAllowedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ModelSelectionNotAllowedError";
  }
}

export class AiGatewayService {
  private readonly repository: ModelRegistryRepository;
  private readonly routingPolicyRepository: ModelRoutingPolicyRepository;
  private readonly modelRoutingGovernanceService?: ModelRoutingGovernanceService;
  private readonly auditService: AuditService;
  private readonly now: () => Date;

  constructor(options: AiGatewayServiceOptions) {
    this.repository = options.repository;
    this.routingPolicyRepository = options.routingPolicyRepository;
    this.modelRoutingGovernanceService = options.modelRoutingGovernanceService;
    this.auditService = options.auditService;
    this.now = options.now ?? (() => new Date());
  }

  async resolveModelSelection(
    input: ResolveModelSelectionInput,
  ): Promise<ResolvedModelSelection> {
    const occurredAt = this.now().toISOString();
    let decision: ModelSelectionDecision | undefined;
    let model: ModelRegistryRecord | undefined;
    let fallbackChain: ModelRegistryRecord[] = [];

    try {
      decision = await this.selectLayer(input);
      model = await this.requireAllowedModel(decision.modelId, input.module);
      fallbackChain =
        decision.layer === "task_override" && model.fallback_model_id
          ? [await this.requireAllowedModel(model.fallback_model_id, input.module)]
          : await Promise.all(
              decision.fallbackModelIds.map((modelId) =>
                this.requireAllowedModel(modelId, input.module),
              ),
            );

      await this.recordAudit({
        input,
        occurredAt,
        decision,
        model,
        fallback: fallbackChain[0],
      });

      return {
        layer: decision.layer,
        model,
        fallback_chain: fallbackChain,
        ...(decision.policyVersionId
          ? { policy_version_id: decision.policyVersionId }
          : {}),
        ...(decision.policyScopeKind
          ? { policy_scope_kind: decision.policyScopeKind }
          : {}),
        ...(decision.policyScopeValue
          ? { policy_scope_value: decision.policyScopeValue }
          : {}),
      };
    } catch (error) {
      const rejectedModel =
        model ?? (decision ? await this.repository.findById(decision.modelId) : undefined);

      await this.recordAudit({
        input,
        occurredAt,
        decision,
        model: rejectedModel,
        fallback: fallbackChain[0],
        outcome: "rejected",
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  private async selectLayer(
    input: ResolveModelSelectionInput,
  ): Promise<ModelSelectionDecision> {
    const policy = await this.routingPolicyRepository.get();

    if (input.taskOverrideModelId) {
      if (!input.taskOverrideAllowList?.includes(input.taskOverrideModelId)) {
        throw new ModelSelectionNotAllowedError(
          `Task override model ${input.taskOverrideModelId} is not in the approved allow list.`,
        );
      }

      return {
        layer: "task_override",
        modelId: input.taskOverrideModelId,
        fallbackModelIds: [],
      };
    }

    if (input.templateFamilyId && this.modelRoutingGovernanceService) {
      const policyRecord =
        await this.modelRoutingGovernanceService.findActivePolicy(
          "template_family",
          input.templateFamilyId,
        );
      const activeVersion = policyRecord?.active_version;
      if (activeVersion) {
        return {
          layer: "template_family_policy",
          modelId: activeVersion.primary_model_id,
          fallbackModelIds: [...activeVersion.fallback_model_ids],
          policyVersionId: activeVersion.id,
          policyScopeKind: "template_family",
          policyScopeValue: activeVersion.scope_value,
        };
      }
    }

    if (this.modelRoutingGovernanceService) {
      const policyRecord = await this.modelRoutingGovernanceService.findActivePolicy(
        "module",
        input.module,
      );
      const activeVersion = policyRecord?.active_version;
      if (activeVersion) {
        return {
          layer: "module_policy",
          modelId: activeVersion.primary_model_id,
          fallbackModelIds: [...activeVersion.fallback_model_ids],
          policyVersionId: activeVersion.id,
          policyScopeKind: "module",
          policyScopeValue: activeVersion.scope_value,
        };
      }
    }

    if (input.moduleTemplateId) {
      const templateOverride = policy.template_overrides[input.moduleTemplateId];
      if (templateOverride) {
        return {
          layer: "legacy_template_override",
          modelId: templateOverride,
          fallbackModelIds: [],
        };
      }
    }

    const moduleDefault = policy.module_defaults[input.module];
    if (moduleDefault) {
      return {
        layer: "legacy_module_default",
        modelId: moduleDefault,
        fallbackModelIds: [],
      };
    }

    if (policy.system_default_model_id) {
      return {
        layer: "legacy_system_default",
        modelId: policy.system_default_model_id,
        fallbackModelIds: [],
      };
    }

    throw new NoModelRouteConfiguredError(input.module);
  }

  private async requireAllowedModel(
    modelId: string,
    module: TemplateModule,
  ): Promise<ModelRegistryRecord> {
    const model = await this.repository.findById(modelId);

    if (!model) {
      throw new ModelSelectionNotAllowedError(
        `Selected model ${modelId} is missing from the registry.`,
      );
    }

    if (!model.allowed_modules.includes(module)) {
      throw new ModelSelectionNotAllowedError(
        `Selected model ${model.id} is not approved for module ${module}.`,
      );
    }

    if (!model.is_prod_allowed) {
      throw new ModelSelectionNotAllowedError(
        `Selected model ${model.id} is blocked for production work.`,
      );
    }

    return model;
  }

  private async recordAudit(input: {
    input: ResolveModelSelectionInput;
    occurredAt: string;
    decision?: ModelSelectionDecision;
    model?: ModelRegistryRecord;
    fallback?: ModelRegistryRecord;
    outcome?: "rejected";
    error?: string;
  }): Promise<void> {
    await this.auditService.record({
      actorId: input.input.actorId,
      roleKey: input.input.actorRole,
      action: "ai.model.resolve",
      targetTable: "model_registry",
      targetId: input.model?.id ?? input.decision?.modelId,
      occurredAt: input.occurredAt,
      metadata: {
        layer: input.decision?.layer,
        module: input.input.module,
        moduleTemplateId: input.input.moduleTemplateId,
        taskId: input.input.taskId,
        provider: input.model?.provider,
        modelName: input.model?.model_name,
        modelVersion: input.model?.model_version,
        fallbackModelId: input.fallback?.id,
        ...(input.decision?.policyVersionId
          ? { policyVersionId: input.decision.policyVersionId }
          : {}),
        ...(input.decision?.policyScopeKind
          ? { policyScopeKind: input.decision.policyScopeKind }
          : {}),
        ...(input.decision?.policyScopeValue
          ? { policyScopeValue: input.decision.policyScopeValue }
          : {}),
        ...(input.outcome ? { outcome: input.outcome } : {}),
        ...(input.error ? { error: input.error } : {}),
      },
    });
  }
}
