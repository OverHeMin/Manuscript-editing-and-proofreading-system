import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { TemplateModule } from "../templates/template-record.ts";
import type { AiProviderConnectionRepository } from "../ai-provider-connections/ai-provider-connection-repository.ts";
import type {
  ModelRegistryRecord,
  ModelRoutingPolicyRecord,
} from "./model-record.ts";
import type {
  ModelRegistryRepository,
  ModelRoutingPolicyRepository,
} from "./model-registry-repository.ts";

export interface CreateModelRegistryEntryInput {
  provider: ModelRegistryRecord["provider"];
  modelName: string;
  modelVersion?: string;
  allowedModules: TemplateModule[];
  isProdAllowed: boolean;
  costProfile?: ModelRegistryRecord["cost_profile"];
  rateLimit?: ModelRegistryRecord["rate_limit"];
  fallbackModelId?: string;
  connectionId?: string;
}

export interface UpdateModelRegistryEntryInput {
  allowedModules?: TemplateModule[];
  isProdAllowed?: boolean;
  costProfile?: ModelRegistryRecord["cost_profile"];
  rateLimit?: ModelRegistryRecord["rate_limit"];
  fallbackModelId?: string | null;
  connectionId?: string | null;
}

export interface UpdateModelRoutingPolicyInput {
  systemDefaultModelId?: string | null;
  moduleDefaults?: Partial<Record<TemplateModule, string | null>>;
  templateOverrides?: Record<string, string | null>;
}

export interface ModelRegistryServiceOptions {
  repository: ModelRegistryRepository;
  routingPolicyRepository: ModelRoutingPolicyRepository;
  aiProviderConnectionRepository?: AiProviderConnectionRepository;
  permissionGuard?: PermissionGuard;
  createId?: () => string;
}

export class ModelRegistryEntryNotFoundError extends Error {
  constructor(modelId: string) {
    super(`Model registry entry ${modelId} was not found.`);
    this.name = "ModelRegistryEntryNotFoundError";
  }
}

export class DuplicateModelRegistryEntryError extends Error {
  constructor(provider: string, modelName: string, modelVersion: string) {
    super(
      `Model registry already contains ${provider}/${modelName}/${modelVersion}.`,
    );
    this.name = "DuplicateModelRegistryEntryError";
  }
}

export class ModelRoutingReferenceNotFoundError extends Error {
  constructor(referenceField: string, modelId: string) {
    super(`${referenceField} references missing model ${modelId}.`);
    this.name = "ModelRoutingReferenceNotFoundError";
  }
}

export class ModelRoutingPolicyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelRoutingPolicyValidationError";
  }
}

export class ModelRegistryConnectionReferenceNotFoundError extends Error {
  constructor(connectionId: string) {
    super(`connectionId references missing ai provider connection ${connectionId}.`);
    this.name = "ModelRegistryConnectionReferenceNotFoundError";
  }
}

export class ModelRegistryService {
  private readonly repository: ModelRegistryRepository;
  private readonly routingPolicyRepository: ModelRoutingPolicyRepository;
  private readonly aiProviderConnectionRepository?: AiProviderConnectionRepository;
  private readonly permissionGuard: PermissionGuard;
  private readonly createId: () => string;

  constructor(options: ModelRegistryServiceOptions) {
    this.repository = options.repository;
    this.routingPolicyRepository = options.routingPolicyRepository;
    this.aiProviderConnectionRepository = options.aiProviderConnectionRepository;
    this.permissionGuard = options.permissionGuard ?? new PermissionGuard();
    this.createId = options.createId ?? (() => randomUUID());
  }

  async createModelEntry(
    actorRole: RoleKey,
    input: CreateModelRegistryEntryInput,
  ): Promise<ModelRegistryRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const modelVersion = normalizeModelVersion(input.modelVersion);
    const duplicate = await this.repository.findByProviderModelVersion(
      input.provider,
      input.modelName,
      modelVersion,
    );

    if (duplicate) {
      throw new DuplicateModelRegistryEntryError(
        input.provider,
        input.modelName,
        modelVersion,
      );
    }

    if (input.fallbackModelId) {
      await this.requireModel(input.fallbackModelId, "fallbackModelId");
    }

    const connectionId = input.connectionId
      ? await this.requireConnection(input.connectionId)
      : undefined;

    const record: ModelRegistryRecord = {
      id: this.createId(),
      provider: input.provider,
      model_name: input.modelName,
      model_version: modelVersion,
      allowed_modules: [...input.allowedModules],
      is_prod_allowed: input.isProdAllowed,
      cost_profile: input.costProfile ? { ...input.costProfile } : undefined,
      rate_limit: input.rateLimit ? { ...input.rateLimit } : undefined,
      fallback_model_id: input.fallbackModelId,
      ...(connectionId ? { connection_id: connectionId } : {}),
    };

    await this.repository.save(record);
    return record;
  }

  async updateModelEntry(
    modelId: string,
    actorRole: RoleKey,
    input: UpdateModelRegistryEntryInput,
  ): Promise<ModelRegistryRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const existing = await this.requireModel(modelId);
    const fallbackModelId =
      input.fallbackModelId === undefined
        ? existing.fallback_model_id
        : input.fallbackModelId === null
          ? undefined
          : (await this.requireModel(input.fallbackModelId, "fallbackModelId")).id;
    const connectionId =
      input.connectionId === undefined
        ? existing.connection_id
        : input.connectionId === null
          ? undefined
          : await this.requireConnection(input.connectionId);

    const updatedRecord: ModelRegistryRecord = {
      ...existing,
      allowed_modules: input.allowedModules
        ? [...input.allowedModules]
        : existing.allowed_modules,
      is_prod_allowed: input.isProdAllowed ?? existing.is_prod_allowed,
      cost_profile:
        input.costProfile === undefined
          ? existing.cost_profile
          : input.costProfile
            ? { ...input.costProfile }
            : undefined,
      rate_limit:
        input.rateLimit === undefined
          ? existing.rate_limit
          : input.rateLimit
            ? { ...input.rateLimit }
            : undefined,
      fallback_model_id: fallbackModelId,
      ...(connectionId ? { connection_id: connectionId } : {}),
    };

    await this.repository.save(updatedRecord);
    return updatedRecord;
  }

  listModelEntries(): Promise<ModelRegistryRecord[]> {
    return this.repository.list();
  }

  getRoutingPolicy(): Promise<ModelRoutingPolicyRecord> {
    return this.routingPolicyRepository.get();
  }

  async updateRoutingPolicy(
    actorRole: RoleKey,
    input: UpdateModelRoutingPolicyInput,
  ): Promise<ModelRoutingPolicyRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const currentPolicy = await this.routingPolicyRepository.get();
    const nextPolicy: ModelRoutingPolicyRecord = {
      system_default_model_id: currentPolicy.system_default_model_id,
      module_defaults: { ...currentPolicy.module_defaults },
      template_overrides: { ...currentPolicy.template_overrides },
    };

    if (input.systemDefaultModelId !== undefined) {
      nextPolicy.system_default_model_id = input.systemDefaultModelId
        ? (
            await this.requireModelForPolicy({
              modelId: input.systemDefaultModelId,
              referenceField: "systemDefaultModelId",
              scope: "system",
            })
          ).id
        : undefined;
    }

    if (input.moduleDefaults) {
      for (const [moduleName, modelId] of Object.entries(input.moduleDefaults) as [
        TemplateModule,
        string | null,
      ][]) {
        if (!modelId) {
          delete nextPolicy.module_defaults[moduleName];
          continue;
        }

        await this.requireModelForPolicy({
          modelId,
          referenceField: `moduleDefaults.${moduleName}`,
          scope: "module",
          module: moduleName,
        });
        nextPolicy.module_defaults[moduleName] = modelId;
      }
    }

    if (input.templateOverrides) {
      for (const [templateId, modelId] of Object.entries(input.templateOverrides)) {
        if (!modelId) {
          delete nextPolicy.template_overrides[templateId];
          continue;
        }

        await this.requireModelForPolicy({
          modelId,
          referenceField: `templateOverrides.${templateId}`,
          scope: "template",
        });
        nextPolicy.template_overrides[templateId] = modelId;
      }
    }

    await this.routingPolicyRepository.save(nextPolicy);
    return nextPolicy;
  }

  private async requireModel(
    modelId: string,
    referenceField = "modelId",
  ): Promise<ModelRegistryRecord> {
    const record = await this.repository.findById(modelId);

    if (!record) {
      throw new ModelRoutingReferenceNotFoundError(referenceField, modelId);
    }

    return record;
  }

  private async requireConnection(connectionId: string): Promise<string> {
    if (!this.aiProviderConnectionRepository) {
      return connectionId;
    }

    const connection = await this.aiProviderConnectionRepository.findById(connectionId);
    if (!connection) {
      throw new ModelRegistryConnectionReferenceNotFoundError(connectionId);
    }

    return connection.id;
  }

  private async requireModelForPolicy(input: {
    modelId: string;
    referenceField: string;
    scope: "system" | "module" | "template";
    module?: TemplateModule;
  }): Promise<ModelRegistryRecord> {
    const model = await this.requireModel(input.modelId, input.referenceField);

    if (!model.is_prod_allowed) {
      throw new ModelRoutingPolicyValidationError(
        `${input.referenceField} must reference a production-approved model.`,
      );
    }

    if (input.scope === "system") {
      for (const moduleName of ROUTABLE_MODULES) {
        if (!model.allowed_modules.includes(moduleName)) {
          throw new ModelRoutingPolicyValidationError(
            `${input.referenceField} must support module ${moduleName}.`,
          );
        }
      }
    }

    if (input.scope === "module" && input.module) {
      if (!model.allowed_modules.includes(input.module)) {
        throw new ModelRoutingPolicyValidationError(
          `${input.referenceField} must support module ${input.module}.`,
        );
      }
    }

    if (model.fallback_model_id) {
      const fallbackModel = await this.requireModel(
        model.fallback_model_id,
        `${input.referenceField}.fallbackModelId`,
      );

      if (!fallbackModel.is_prod_allowed) {
        throw new ModelRoutingPolicyValidationError(
          `${input.referenceField}.fallbackModelId must reference a production-approved model.`,
        );
      }

      if (input.scope === "system") {
        for (const moduleName of ROUTABLE_MODULES) {
          if (!fallbackModel.allowed_modules.includes(moduleName)) {
            throw new ModelRoutingPolicyValidationError(
              `${input.referenceField}.fallbackModelId must support module ${moduleName}.`,
            );
          }
        }
      }

      if (input.scope === "module" && input.module) {
        if (!fallbackModel.allowed_modules.includes(input.module)) {
          throw new ModelRoutingPolicyValidationError(
            `${input.referenceField}.fallbackModelId must support module ${input.module}.`,
          );
        }
      }
    }

    return model;
  }
}

function normalizeModelVersion(modelVersion: string | undefined): string {
  return modelVersion ?? "";
}

const ROUTABLE_MODULES: TemplateModule[] = [
  "screening",
  "editing",
  "proofreading",
];
