import type {
  ActivateSandboxProfileInput,
  ArchiveSandboxProfileInput,
  CreateSandboxProfileInput,
  SandboxProfileViewModel,
} from "./types.ts";

export interface SandboxProfileHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function createSandboxProfile(
  client: SandboxProfileHttpClient,
  input: CreateSandboxProfileInput,
) {
  return client.request<SandboxProfileViewModel>({
    method: "POST",
    url: "/api/v1/sandbox-profiles",
    body: {
      actorRole: input.actorRole,
      input: {
        name: input.name,
        sandboxMode: input.sandboxMode,
        networkAccess: input.networkAccess,
        approvalRequired: input.approvalRequired,
        allowedToolIds: input.allowedToolIds,
      },
    },
  });
}

export function listSandboxProfiles(client: SandboxProfileHttpClient) {
  return client.request<SandboxProfileViewModel[]>({
    method: "GET",
    url: "/api/v1/sandbox-profiles",
  });
}

export function getSandboxProfile(
  client: SandboxProfileHttpClient,
  profileId: string,
) {
  return client.request<SandboxProfileViewModel>({
    method: "GET",
    url: `/api/v1/sandbox-profiles/${profileId}`,
  });
}

export function activateSandboxProfile(
  client: SandboxProfileHttpClient,
  profileId: string,
  input: ActivateSandboxProfileInput,
) {
  return client.request<SandboxProfileViewModel>({
    method: "POST",
    url: `/api/v1/sandbox-profiles/${profileId}/activate`,
    body: input,
  });
}

export function archiveSandboxProfile(
  client: SandboxProfileHttpClient,
  profileId: string,
  input: ArchiveSandboxProfileInput,
) {
  return client.request<SandboxProfileViewModel>({
    method: "POST",
    url: `/api/v1/sandbox-profiles/${profileId}/archive`,
    body: input,
  });
}
