import type {
  AgentRuntimeViewModel,
  ArchiveAgentRuntimeInput,
  CreateAgentRuntimeInput,
} from "./types.ts";

export interface AgentRuntimeHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function createAgentRuntime(
  client: AgentRuntimeHttpClient,
  input: CreateAgentRuntimeInput,
) {
  return client.request<AgentRuntimeViewModel>({
    method: "POST",
    url: "/api/v1/agent-runtime",
    body: input,
  });
}

export function listAgentRuntimes(client: AgentRuntimeHttpClient) {
  return client.request<AgentRuntimeViewModel[]>({
    method: "GET",
    url: "/api/v1/agent-runtime",
  });
}

export function getAgentRuntime(
  client: AgentRuntimeHttpClient,
  runtimeId: string,
) {
  return client.request<AgentRuntimeViewModel>({
    method: "GET",
    url: `/api/v1/agent-runtime/${runtimeId}`,
  });
}

export function archiveAgentRuntime(
  client: AgentRuntimeHttpClient,
  runtimeId: string,
  input: ArchiveAgentRuntimeInput,
) {
  return client.request<AgentRuntimeViewModel>({
    method: "POST",
    url: `/api/v1/agent-runtime/${runtimeId}/archive`,
    body: input,
  });
}
