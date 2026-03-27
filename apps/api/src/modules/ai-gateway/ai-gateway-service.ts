import type { AuditService } from "../../audit/audit-service.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { TemplateModule } from "../templates/template-record.ts";
import type { ModelRegistryRecord } from "../model-registry/model-record.ts";
import type {
  ModelRegistryRepository,
  ModelRoutingPolicyRepository,
} from "../model-registry/model-registry-repository.ts";

export interface ResolveModelSelectionInput {
  module: TemplateModule;
  moduleTemplateId?: string;
  taskId?: string;
  taskOverrideModelId?: string;
  taskOverrideAllowList?: string[];
  actorId?: string;
  actorRole?: RoleKey;
}

export interface ResolvedModelSelection {
  layer: "system_default" | "module_default" | "template_override" | "task_override";
  model: ModelRegistryRecord;
  fallback?: ModelRegistryRecord;
}

export interface AiGatewayServiceOptions {
  repository: ModelRegistryRepository;
  routingPolicyRepository: ModelRoutingPolicyRepository;
  auditService: AuditService;
  now?: () => Date;
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
  private readonly auditService: AuditService;
  private readonly now: () => Date;

  constructor(options: AiGatewayServiceOptions) {
    this.repository = options.repository;
    this.routingPolicyRepository = options.routingPolicyRepository;
    this.auditService = options.auditService;
    this.now = options.now ?? (() => new Date());
  }

  async resolveModelSelection(
    input: ResolveModelSelectionInput,
  ): Promise<ResolvedModelSelection> {
    const occurredAt = this.now().toISOString();
    let decision:
      | {
          layer: ResolvedModelSelection["layer"];
          modelId: string;
        }
      | undefined;
    let model: ModelRegistryRecord | undefined;
    let fallback: ModelRegistryRecord | undefined;

    try {
      decision = await this.selectLayer(input);
      model = await this.requireAllowedModel(decision.modelId, input.module);
      fallback = model.fallback_model_id
        ? await this.requireAllowedModel(model.fallback_model_id, input.module)
        : undefined;

      await this.recordAudit({
        input,
        occurredAt,
        decision,
        model,
        fallback,
      });

      return {
        layer: decision.layer,
        model,
        fallback,
      };
    } catch (error) {
      const rejectedModel =
        fallback ??
        model ??
        (decision ? await this.repository.findById(decision.modelId) : undefined);

      await this.recordAudit({
        input,
        occurredAt,
        decision,
        model: rejectedModel,
        fallback,
        outcome: "rejected",
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  private async selectLayer(input: ResolveModelSelectionInput): Promise<{
    layer: ResolvedModelSelection["layer"];
    modelId: string;
  }> {
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
      };
    }

    if (input.moduleTemplateId) {
      const templateOverride = policy.template_overrides[input.moduleTemplateId];
      if (templateOverride) {
        return {
          layer: "template_override",
          modelId: templateOverride,
        };
      }
    }

    const moduleDefault = policy.module_defaults[input.module];
    if (moduleDefault) {
      return {
        layer: "module_default",
        modelId: moduleDefault,
      };
    }

    if (policy.system_default_model_id) {
      return {
        layer: "system_default",
        modelId: policy.system_default_model_id,
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
    decision?: {
      layer: ResolvedModelSelection["layer"];
      modelId: string;
    };
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
        ...(input.outcome ? { outcome: input.outcome } : {}),
        ...(input.error ? { error: input.error } : {}),
      },
    });
  }
}
