import type {
  CreateSystemSettingsUserInput,
  SystemSettingsUserViewModel,
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
