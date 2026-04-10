import type {
  CreateAiProviderConnectionInput,
  CreateSystemSettingsUserInput,
  SystemSettingsAiProviderConnectionViewModel,
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

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}
