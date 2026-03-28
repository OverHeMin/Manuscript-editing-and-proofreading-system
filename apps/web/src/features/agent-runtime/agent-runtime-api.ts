import type { TemplateModule } from "../templates/types.ts";
import type {
  AgentRuntimeViewModel,
  ArchiveAgentRuntimeInput,
  CreateAgentRuntimeInput,
  PublishAgentRuntimeInput,
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
    body: {
      actorRole: input.actorRole,
      input: {
        name: input.name,
        adapter: input.adapter,
        sandboxProfileId: input.sandboxProfileId,
        allowedModules: input.allowedModules,
        runtimeSlot: input.runtimeSlot,
      },
    },
  });
}

export function listAgentRuntimes(client: AgentRuntimeHttpClient) {
  return client.request<AgentRuntimeViewModel[]>({
    method: "GET",
    url: "/api/v1/agent-runtime",
  });
}

export function listAgentRuntimesByModule(
  client: AgentRuntimeHttpClient,
  module: TemplateModule,
  activeOnly = false,
) {
  const search = activeOnly ? "?activeOnly=true" : "";
  return client.request<AgentRuntimeViewModel[]>({
    method: "GET",
    url: `/api/v1/agent-runtime/by-module/${module}${search}`,
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

export function publishAgentRuntime(
  client: AgentRuntimeHttpClient,
  runtimeId: string,
  input: PublishAgentRuntimeInput,
) {
  return client.request<AgentRuntimeViewModel>({
    method: "POST",
    url: `/api/v1/agent-runtime/${runtimeId}/publish`,
    body: input,
  });
}
