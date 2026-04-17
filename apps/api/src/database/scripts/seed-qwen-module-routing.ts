import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { PostgresAuditService } from "../../audit/index.ts";
import { loadAppEnvDefaults } from "../../ops/env-defaults.ts";
import {
  AiProviderConnectionService,
  AiProviderCredentialCrypto,
  PostgresAiProviderConnectionRepository,
  type AiProviderConnectionRecord,
} from "../../modules/ai-provider-connections/index.ts";
import {
  ModelRegistryService,
  PostgresModelRegistryRepository,
  PostgresModelRoutingPolicyRepository,
  type ModelRegistryRecord,
} from "../../modules/model-registry/index.ts";
import {
  ModelRoutingGovernanceService,
  PostgresModelRoutingGovernanceRepository,
} from "../../modules/model-routing-governance/index.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { SystemSettingsModuleKey } from "../../modules/model-routing-governance/model-routing-governance-record.ts";

const DEFAULT_QWEN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const MANAGED_PROVIDER_KIND = "qwen";
const appRoot = path.resolve(import.meta.dirname, "../../..");

export interface EnsureQwenModuleRoutingConfigurationInput {
  actorRole: RoleKey;
  actorId?: string;
  aiProviderConnectionService: Pick<
    AiProviderConnectionService,
    "listConnections" | "createConnection" | "updateConnection" | "rotateCredential"
  >;
  modelRegistryService: Pick<
    ModelRegistryService,
    "listModelEntries" | "createModelEntry" | "updateModelEntry"
  >;
  modelRoutingGovernanceService: Pick<
    ModelRoutingGovernanceService,
    "listSystemSettingsModuleDefaults" | "listPolicies" | "saveSystemSettingsModuleDefault"
  >;
  connection: {
    name: string;
    baseUrl?: string;
    apiKey: string;
    enabled?: boolean;
  };
  modules: Record<
    SystemSettingsModuleKey,
    {
      primaryModelName: string;
      primaryModelVersion?: string;
      fallbackModelName?: string;
      fallbackModelVersion?: string;
      temperature?: number | null;
    }
  >;
}

export interface EnsureQwenModuleRoutingConfigurationResult {
  connection: {
    id: string;
    status: "created" | "updated" | "unchanged";
  };
  models: Array<{
    modelName: string;
    moduleKeys: SystemSettingsModuleKey[];
    status: "created" | "updated" | "unchanged";
    modelId: string;
  }>;
  modules: Array<{
    moduleKey: SystemSettingsModuleKey;
    status: "updated" | "unchanged";
    primaryModelId: string;
    fallbackModelId?: string;
  }>;
}

interface DesiredModelPlan {
  key: string;
  modelName: string;
  modelVersion: string;
  moduleKeys: Set<SystemSettingsModuleKey>;
}

export async function ensureQwenModuleRoutingConfiguration(
  input: EnsureQwenModuleRoutingConfigurationInput,
): Promise<EnsureQwenModuleRoutingConfigurationResult> {
  const connection = await ensureQwenConnection(input);
  const desiredModelPlans = collectDesiredModelPlans(input.modules);
  const ensuredModels = await ensureModels({
    actorRole: input.actorRole,
    modelRegistryService: input.modelRegistryService,
    connectionId: connection.record.id,
    desiredModelPlans,
  });
  const moduleUpdates = await ensureModuleDefaults({
    actorRole: input.actorRole,
    modelRoutingGovernanceService: input.modelRoutingGovernanceService,
    modules: input.modules,
    ensuredModels,
  });

  return {
    connection: {
      id: connection.record.id,
      status: connection.status,
    },
    models: ensuredModels.map((entry) => ({
      modelName: entry.model.model_name,
      moduleKeys: [...entry.moduleKeys],
      status: entry.status,
      modelId: entry.model.id,
    })),
    modules: moduleUpdates,
  };
}

async function ensureQwenConnection(
  input: EnsureQwenModuleRoutingConfigurationInput,
): Promise<{
  record: AiProviderConnectionRecord;
  status: "created" | "updated" | "unchanged";
}> {
  const desiredBaseUrl = normalizeRequiredString(
    input.connection.baseUrl ?? DEFAULT_QWEN_BASE_URL,
    "connection.baseUrl",
  );
  const desiredEnabled = input.connection.enabled ?? true;
  const existing = (await input.aiProviderConnectionService.listConnections()).find(
    (connection) =>
      connection.provider_kind === MANAGED_PROVIDER_KIND &&
      connection.name === input.connection.name,
  );

  let record: AiProviderConnectionRecord;
  let status: "created" | "updated" | "unchanged";

  if (!existing) {
    record = await input.aiProviderConnectionService.createConnection({
      actorId: input.actorId,
      actorRole: input.actorRole,
      connection: {
        name: input.connection.name,
        provider_kind: MANAGED_PROVIDER_KIND,
        base_url: desiredBaseUrl,
        enabled: desiredEnabled,
      },
    });
    status = "created";
  } else if (
    existing.base_url !== desiredBaseUrl ||
    existing.enabled !== desiredEnabled
  ) {
    record = await input.aiProviderConnectionService.updateConnection({
      actorId: input.actorId,
      actorRole: input.actorRole,
      update: {
        connectionId: existing.id,
        changes: {
          name: input.connection.name,
          base_url: desiredBaseUrl,
          enabled: desiredEnabled,
        },
      },
    });
    status = "updated";
  } else {
    record = existing;
    status = "unchanged";
  }

  record = await input.aiProviderConnectionService.rotateCredential({
    actorId: input.actorId,
    actorRole: input.actorRole,
    rotation: {
      connectionId: record.id,
      apiKey: normalizeRequiredString(input.connection.apiKey, "connection.apiKey"),
    },
  });

  return { record, status };
}

async function ensureModels(input: {
  actorRole: RoleKey;
  modelRegistryService: Pick<
    ModelRegistryService,
    "listModelEntries" | "createModelEntry" | "updateModelEntry"
  >;
  connectionId: string;
  desiredModelPlans: DesiredModelPlan[];
}): Promise<
  Array<{
    key: string;
    moduleKeys: SystemSettingsModuleKey[];
    model: ModelRegistryRecord;
    status: "created" | "updated" | "unchanged";
  }>
> {
  const existingModels = await input.modelRegistryService.listModelEntries();
  const results: Array<{
    key: string;
    moduleKeys: SystemSettingsModuleKey[];
    model: ModelRegistryRecord;
    status: "created" | "updated" | "unchanged";
  }> = [];

  for (const plan of input.desiredModelPlans) {
    const desiredModules = [...plan.moduleKeys];
    const existing = existingModels.find(
      (record) =>
        record.provider === MANAGED_PROVIDER_KIND &&
        record.model_name === plan.modelName &&
        record.model_version === plan.modelVersion,
    );

    if (!existing) {
      const created = await input.modelRegistryService.createModelEntry(
        input.actorRole,
        {
          provider: MANAGED_PROVIDER_KIND,
          modelName: plan.modelName,
          modelVersion: plan.modelVersion,
          allowedModules: desiredModules,
          isProdAllowed: true,
          connectionId: input.connectionId,
        },
      );
      existingModels.push(created);
      results.push({
        key: plan.key,
        moduleKeys: desiredModules,
        model: created,
        status: "created",
      });
      continue;
    }

    const needsUpdate =
      !sameOrderedValues(existing.allowed_modules, desiredModules) ||
      !existing.is_prod_allowed ||
      existing.connection_id !== input.connectionId;
    const persisted = needsUpdate
      ? await input.modelRegistryService.updateModelEntry(
          existing.id,
          input.actorRole,
          {
            allowedModules: desiredModules,
            isProdAllowed: true,
            connectionId: input.connectionId,
          },
        )
      : existing;
    if (needsUpdate) {
      const index = existingModels.findIndex((record) => record.id === existing.id);
      if (index >= 0) {
        existingModels[index] = persisted;
      }
    }
    results.push({
      key: plan.key,
      moduleKeys: desiredModules,
      model: persisted,
      status: needsUpdate ? "updated" : "unchanged",
    });
  }

  return results;
}

async function ensureModuleDefaults(input: {
  actorRole: RoleKey;
  modelRoutingGovernanceService: Pick<
    ModelRoutingGovernanceService,
    "listSystemSettingsModuleDefaults" | "saveSystemSettingsModuleDefault"
  >;
  modules: EnsureQwenModuleRoutingConfigurationInput["modules"];
  ensuredModels: Array<{
    key: string;
    model: ModelRegistryRecord;
    status: "created" | "updated" | "unchanged";
  }>;
}): Promise<
  Array<{
    moduleKey: SystemSettingsModuleKey;
    status: "updated" | "unchanged";
    primaryModelId: string;
    fallbackModelId?: string;
  }>
> {
  const currentDefaults =
    await input.modelRoutingGovernanceService.listSystemSettingsModuleDefaults();
  const currentByModule = new Map(
    currentDefaults.map((record) => [record.module_key, record]),
  );
  const ensuredModelByKey = new Map(
    input.ensuredModels.map((entry) => [entry.key, entry.model]),
  );
  const moduleKeys = Object.keys(input.modules) as SystemSettingsModuleKey[];
  const results: Array<{
    moduleKey: SystemSettingsModuleKey;
    status: "updated" | "unchanged";
    primaryModelId: string;
    fallbackModelId?: string;
  }> = [];

  for (const moduleKey of moduleKeys) {
    const moduleConfig = input.modules[moduleKey];
    const primaryModel = ensuredModelByKey.get(
      createModelKey(moduleConfig.primaryModelName, moduleConfig.primaryModelVersion),
    );
    if (!primaryModel) {
      throw new Error(`Primary model for module ${moduleKey} was not ensured.`);
    }

    const fallbackModel = moduleConfig.fallbackModelName
      ? ensuredModelByKey.get(
          createModelKey(
            moduleConfig.fallbackModelName,
            moduleConfig.fallbackModelVersion,
          ),
        )
      : undefined;
    const current = currentByModule.get(moduleKey);
    const desiredTemperature = moduleConfig.temperature ?? null;
    const isUnchanged =
      current?.primary_model_id === primaryModel.id &&
      (current?.fallback_model_id ?? undefined) === fallbackModel?.id &&
      (current?.temperature ?? null) === desiredTemperature;

    if (!isUnchanged) {
      await input.modelRoutingGovernanceService.saveSystemSettingsModuleDefault(
        input.actorRole,
        {
          moduleKey,
          primaryModelId: primaryModel.id,
          fallbackModelId: fallbackModel?.id ?? null,
          temperature: desiredTemperature,
        },
      );
    }

    results.push({
      moduleKey,
      status: isUnchanged ? "unchanged" : "updated",
      primaryModelId: primaryModel.id,
      ...(fallbackModel ? { fallbackModelId: fallbackModel.id } : {}),
    });
  }

  return results;
}

function collectDesiredModelPlans(
  modules: EnsureQwenModuleRoutingConfigurationInput["modules"],
): DesiredModelPlan[] {
  const plans = new Map<string, DesiredModelPlan>();
  const moduleKeys = Object.keys(modules) as SystemSettingsModuleKey[];

  for (const moduleKey of moduleKeys) {
    const config = modules[moduleKey];
    const primaryKey = createModelKey(
      config.primaryModelName,
      config.primaryModelVersion,
    );
    const primaryPlan =
      plans.get(primaryKey) ??
      createDesiredModelPlan(
        primaryKey,
        config.primaryModelName,
        config.primaryModelVersion,
      );
    primaryPlan.moduleKeys.add(moduleKey);
    plans.set(primaryKey, primaryPlan);

    if (!config.fallbackModelName) {
      continue;
    }

    const fallbackKey = createModelKey(
      config.fallbackModelName,
      config.fallbackModelVersion,
    );
    const fallbackPlan =
      plans.get(fallbackKey) ??
      createDesiredModelPlan(
        fallbackKey,
        config.fallbackModelName,
        config.fallbackModelVersion,
      );
    fallbackPlan.moduleKeys.add(moduleKey);
    plans.set(fallbackKey, fallbackPlan);
  }

  return [...plans.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function createDesiredModelPlan(
  key: string,
  modelName: string,
  modelVersion?: string,
): DesiredModelPlan {
  return {
    key,
    modelName,
    modelVersion: modelVersion ?? "",
    moduleKeys: new Set<SystemSettingsModuleKey>(),
  };
}

function createModelKey(modelName: string, modelVersion?: string): string {
  return `${normalizeRequiredString(modelName, "modelName")}::${modelVersion ?? ""}`;
}

function sameOrderedValues(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function normalizeRequiredString(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Missing required value for ${label}.`);
  }

  return normalized;
}

function normalizeOptionalNumber(value: string | undefined): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  if (normalized.length === 0 || normalized.toLowerCase() === "null") {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected a numeric value, received "${value}".`);
  }

  return parsed;
}

function readModuleConfigFromEnv(
  env: NodeJS.ProcessEnv,
  moduleKey: SystemSettingsModuleKey,
): EnsureQwenModuleRoutingConfigurationInput["modules"][SystemSettingsModuleKey] {
  const prefix = `QWEN_${moduleKey.toUpperCase()}`;
  return {
    primaryModelName: normalizeRequiredString(
      env[`${prefix}_PRIMARY_MODEL`],
      `${prefix}_PRIMARY_MODEL`,
    ),
    primaryModelVersion: env[`${prefix}_PRIMARY_VERSION`]?.trim() || undefined,
    fallbackModelName: normalizeRequiredString(
      env[`${prefix}_FALLBACK_MODEL`],
      `${prefix}_FALLBACK_MODEL`,
    ),
    fallbackModelVersion:
      env[`${prefix}_FALLBACK_VERSION`]?.trim() || undefined,
    temperature: normalizeOptionalNumber(env[`${prefix}_TEMPERATURE`]),
  };
}

function readCliConfigFromEnv(
  env: NodeJS.ProcessEnv,
): Omit<
  EnsureQwenModuleRoutingConfigurationInput,
  | "actorRole"
  | "actorId"
  | "aiProviderConnectionService"
  | "modelRegistryService"
  | "modelRoutingGovernanceService"
> {
  return {
    connection: {
      name: env.QWEN_CONNECTION_NAME?.trim() || "Qwen Production",
      baseUrl: env.QWEN_BASE_URL?.trim() || DEFAULT_QWEN_BASE_URL,
      apiKey: normalizeRequiredString(env.QWEN_API_KEY, "QWEN_API_KEY"),
      enabled:
        env.QWEN_CONNECTION_ENABLED === undefined
          ? true
          : ["1", "true", "yes", "on"].includes(
              env.QWEN_CONNECTION_ENABLED.trim().toLowerCase(),
            ),
    },
    modules: {
      screening: readModuleConfigFromEnv(env, "screening"),
      editing: readModuleConfigFromEnv(env, "editing"),
      proofreading: readModuleConfigFromEnv(env, "proofreading"),
    },
  };
}

export async function runSeedQwenModuleRoutingCli(
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  loadAppEnvDefaults(appRoot);

  const client = new Client({
    connectionString:
      env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:5432/medical_api?schema=public",
  });
  await client.connect();

  try {
    const aiProviderConnectionRepository = new PostgresAiProviderConnectionRepository({
      client,
    });
    const modelRegistryRepository = new PostgresModelRegistryRepository({
      client,
    });
    const modelRoutingPolicyRepository = new PostgresModelRoutingPolicyRepository({
      client,
    });
    const modelRoutingGovernanceRepository =
      new PostgresModelRoutingGovernanceRepository({
        client,
      });

    const result = await ensureQwenModuleRoutingConfiguration({
      actorRole: "admin",
      actorId: "system-cli",
      aiProviderConnectionService: new AiProviderConnectionService({
        repository: aiProviderConnectionRepository,
        auditService: new PostgresAuditService({ client }),
        credentialCrypto: new AiProviderCredentialCrypto(env),
      }),
      modelRegistryService: new ModelRegistryService({
        repository: modelRegistryRepository,
        routingPolicyRepository: modelRoutingPolicyRepository,
        aiProviderConnectionRepository,
      }),
      modelRoutingGovernanceService: new ModelRoutingGovernanceService({
        repository: modelRoutingGovernanceRepository,
        modelRegistryRepository,
      }),
      ...readCliConfigFromEnv(env),
    });

    console.log(
      JSON.stringify(
        {
          connection: result.connection,
          models: result.models,
          modules: result.modules,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

if (isDirectExecution()) {
  runSeedQwenModuleRoutingCli().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

function isDirectExecution(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) {
    return false;
  }

  return fileURLToPath(import.meta.url) === path.resolve(entrypoint);
}
