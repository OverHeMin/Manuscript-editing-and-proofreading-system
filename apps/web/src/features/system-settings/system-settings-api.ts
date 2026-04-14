import type {
  CreateAiProviderConnectionInput,
  CreateSystemSettingsRegisteredModelInput,
  CreateSystemSettingsUserInput,
  SaveSystemSettingsModuleDefaultInput,
  SystemSettingsAiProviderConnectionViewModel,
  SystemSettingsModuleDefaultViewModel,
  SystemSettingsModuleKey,
  SystemSettingsRegisteredModelViewModel,
  SystemSettingsUserViewModel,
  UpdateAiProviderConnectionInput,
  UpdateSystemSettingsUserProfileInput,
} from "./types.ts";

export interface SystemSettingsHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

interface SystemSettingsModelApiRecord {
  id: string;
  model_name: string;
  allowed_modules: SystemSettingsModuleKey[];
  is_prod_allowed: boolean;
  fallback_model_id?: string | null;
  fallback_model_name?: string | null;
  connection_id: string;
  connection_name?: string | null;
}

interface SystemSettingsModuleDefaultApiRecord {
  module_key: SystemSettingsModuleKey;
  primary_model_id?: string | null;
  primary_model_name?: string | null;
  fallback_model_id?: string | null;
  fallback_model_name?: string | null;
  temperature?: number | null;
}

export function listSystemSettingsUsers(client: SystemSettingsHttpClient) {
  return client.request<SystemSettingsUserViewModel[]>({
    method: "GET",
    url: "/api/v1/system-settings/users",
  });
}

export function createSystemSettingsUser(
  client: SystemSettingsHttpClient,
  input: CreateSystemSettingsUserInput,
) {
  return client.request<SystemSettingsUserViewModel>({
    method: "POST",
    url: "/api/v1/system-settings/users",
    body: input,
  });
}

export function updateSystemSettingsUserProfile(
  client: SystemSettingsHttpClient,
  userId: string,
  input: UpdateSystemSettingsUserProfileInput,
) {
  return client.request<SystemSettingsUserViewModel>({
    method: "POST",
    url: `/api/v1/system-settings/users/${userId}/profile`,
    body: input,
  });
}

export function resetSystemSettingsUserPassword(
  client: SystemSettingsHttpClient,
  userId: string,
  nextPassword: string,
) {
  return client.request<SystemSettingsUserViewModel>({
    method: "POST",
    url: `/api/v1/system-settings/users/${userId}/reset-password`,
    body: {
      nextPassword,
    },
  });
}

export function disableSystemSettingsUser(
  client: SystemSettingsHttpClient,
  userId: string,
) {
  return client.request<SystemSettingsUserViewModel>({
    method: "POST",
    url: `/api/v1/system-settings/users/${userId}/disable`,
  });
}

export function enableSystemSettingsUser(
  client: SystemSettingsHttpClient,
  userId: string,
) {
  return client.request<SystemSettingsUserViewModel>({
    method: "POST",
    url: `/api/v1/system-settings/users/${userId}/enable`,
  });
}

export function listSystemSettingsAiProviders(client: SystemSettingsHttpClient) {
  return client.request<SystemSettingsAiProviderConnectionViewModel[]>({
    method: "GET",
    url: "/api/v1/system-settings/ai-providers",
  });
}

export function createSystemSettingsAiProvider(
  client: SystemSettingsHttpClient,
  input: CreateAiProviderConnectionInput,
) {
  return client.request<SystemSettingsAiProviderConnectionViewModel>({
    method: "POST",
    url: "/api/v1/system-settings/ai-providers",
    body: {
      name: input.name,
      provider_kind: input.providerKind,
      ...(normalizeOptionalText(input.baseUrl)
        ? { base_url: normalizeOptionalText(input.baseUrl) }
        : {}),
      enabled: input.enabled,
      connection_metadata: {
        test_model_name: input.testModelName.trim(),
      },
      credentials: {
        apiKey: input.apiKey,
      },
    },
  });
}

export function updateSystemSettingsAiProvider(
  client: SystemSettingsHttpClient,
  connectionId: string,
  input: UpdateAiProviderConnectionInput,
) {
  return client.request<SystemSettingsAiProviderConnectionViewModel>({
    method: "POST",
    url: `/api/v1/system-settings/ai-providers/${connectionId}`,
    body: {
      name: input.name,
      ...(normalizeOptionalText(input.baseUrl)
        ? { base_url: normalizeOptionalText(input.baseUrl) }
        : {}),
      enabled: input.enabled,
      connection_metadata: {
        test_model_name: input.testModelName.trim(),
      },
    },
  });
}

export function rotateSystemSettingsAiProviderCredential(
  client: SystemSettingsHttpClient,
  connectionId: string,
  apiKey: string,
) {
  return client.request<SystemSettingsAiProviderConnectionViewModel>({
    method: "POST",
    url: `/api/v1/system-settings/ai-providers/${connectionId}/rotate-credential`,
    body: {
      credentials: {
        apiKey,
      },
    },
  });
}

export function testSystemSettingsAiProvider(
  client: SystemSettingsHttpClient,
  connectionId: string,
  testModelName: string,
) {
  return client.request<SystemSettingsAiProviderConnectionViewModel>({
    method: "POST",
    url: `/api/v1/system-settings/ai-providers/${connectionId}/test`,
    body: {
      connection_metadata: {
        test_model_name: testModelName.trim(),
      },
    },
  });
}

export async function listSystemSettingsModels(client: SystemSettingsHttpClient) {
  const response = await client.request<SystemSettingsModelApiRecord[]>({
    method: "GET",
    url: "/api/v1/system-settings/models",
  });

  return {
    ...response,
    body: response.body.map(mapSystemSettingsModelRecord),
  };
}

export async function createSystemSettingsRegisteredModel(
  client: SystemSettingsHttpClient,
  input: CreateSystemSettingsRegisteredModelInput,
) {
  const response = await client.request<SystemSettingsModelApiRecord>({
    method: "POST",
    url: "/api/v1/system-settings/models",
    body: {
      provider: input.providerKind,
      modelName: input.modelName.trim(),
      allowedModules: input.allowedModules,
      isProdAllowed: input.productionAllowed,
      ...(normalizeOptionalText(input.fallbackModelId ?? "")
        ? { fallbackModelId: normalizeOptionalText(input.fallbackModelId ?? "") }
        : {}),
      connectionId: input.connectionId,
    },
  });

  return {
    ...response,
    body: mapSystemSettingsModelRecord(response.body),
  };
}

export async function listSystemSettingsModuleDefaults(client: SystemSettingsHttpClient) {
  const response = await client.request<SystemSettingsModuleDefaultApiRecord[]>({
    method: "GET",
    url: "/api/v1/system-settings/module-defaults",
  });

  return {
    ...response,
    body: response.body.map(mapSystemSettingsModuleDefaultRecord),
  };
}

export async function saveSystemSettingsModuleDefault(
  client: SystemSettingsHttpClient,
  input: SaveSystemSettingsModuleDefaultInput,
) {
  const response = await client.request<SystemSettingsModuleDefaultApiRecord>({
    method: "POST",
    url: "/api/v1/system-settings/module-defaults",
    body: {
      module_key: input.moduleKey,
      primary_model_id: input.primaryModelId,
      ...(normalizeOptionalText(input.fallbackModelId ?? "")
        ? { fallback_model_id: normalizeOptionalText(input.fallbackModelId ?? "") }
        : {}),
      ...(typeof input.temperature === "number" ? { temperature: input.temperature } : {}),
    },
  });

  return {
    ...response,
    body: mapSystemSettingsModuleDefaultRecord(response.body),
  };
}

function mapSystemSettingsModelRecord(
  record: SystemSettingsModelApiRecord,
): SystemSettingsRegisteredModelViewModel {
  return {
    id: record.id,
    modelName: record.model_name,
    displayName: record.model_name,
    connectionId: record.connection_id,
    connectionName: record.connection_name ?? record.connection_id,
    allowedModules: record.allowed_modules,
    productionAllowed: record.is_prod_allowed,
    fallbackModelId: record.fallback_model_id ?? null,
    fallbackModelName: record.fallback_model_name ?? null,
  };
}

function mapSystemSettingsModuleDefaultRecord(
  record: SystemSettingsModuleDefaultApiRecord,
): SystemSettingsModuleDefaultViewModel {
  return {
    moduleKey: record.module_key,
    moduleLabel: formatModuleLabel(record.module_key),
    primaryModelId: record.primary_model_id ?? null,
    primaryModelName: record.primary_model_name ?? null,
    fallbackModelId: record.fallback_model_id ?? null,
    fallbackModelName: record.fallback_model_name ?? null,
    temperature: record.temperature ?? null,
  };
}

function formatModuleLabel(moduleKey: SystemSettingsModuleKey): string {
  switch (moduleKey) {
    case "screening":
      return "初筛";
    case "editing":
      return "编辑";
    case "proofreading":
      return "校对";
    default:
      return moduleKey;
  }
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}
