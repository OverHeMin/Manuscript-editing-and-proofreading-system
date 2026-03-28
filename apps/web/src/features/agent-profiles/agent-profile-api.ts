import type {
  AgentProfileViewModel,
  ArchiveAgentProfileInput,
  CreateAgentProfileInput,
  PublishAgentProfileInput,
} from "./types.ts";

export interface AgentProfileHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function createAgentProfile(
  client: AgentProfileHttpClient,
  input: CreateAgentProfileInput,
) {
  return client.request<AgentProfileViewModel>({
    method: "POST",
    url: "/api/v1/agent-profiles",
    body: {
      actorRole: input.actorRole,
      input: {
        name: input.name,
        roleKey: input.roleKey,
        moduleScope: input.moduleScope,
        manuscriptTypes: input.manuscriptTypes,
        description: input.description,
      },
    },
  });
}

export function listAgentProfiles(client: AgentProfileHttpClient) {
  return client.request<AgentProfileViewModel[]>({
    method: "GET",
    url: "/api/v1/agent-profiles",
  });
}

export function getAgentProfile(
  client: AgentProfileHttpClient,
  profileId: string,
) {
  return client.request<AgentProfileViewModel>({
    method: "GET",
    url: `/api/v1/agent-profiles/${profileId}`,
  });
}

export function publishAgentProfile(
  client: AgentProfileHttpClient,
  profileId: string,
  input: PublishAgentProfileInput,
) {
  return client.request<AgentProfileViewModel>({
    method: "POST",
    url: `/api/v1/agent-profiles/${profileId}/publish`,
    body: input,
  });
}

export function archiveAgentProfile(
  client: AgentProfileHttpClient,
  profileId: string,
  input: ArchiveAgentProfileInput,
) {
  return client.request<AgentProfileViewModel>({
    method: "POST",
    url: `/api/v1/agent-profiles/${profileId}/archive`,
    body: input,
  });
}
