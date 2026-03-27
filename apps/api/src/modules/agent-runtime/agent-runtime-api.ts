import type { RoleKey } from "../../users/roles.ts";
import { AgentRuntimeService } from "./agent-runtime-service.ts";
import type { CreateAgentRuntimeInput } from "./agent-runtime-service.ts";
import type { AgentRuntimeRecord } from "./agent-runtime-record.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateAgentRuntimeApiOptions {
  agentRuntimeService: AgentRuntimeService;
}

export function createAgentRuntimeApi(options: CreateAgentRuntimeApiOptions) {
  const { agentRuntimeService } = options;

  return {
    async createRuntime({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreateAgentRuntimeInput;
    }): Promise<RouteResponse<AgentRuntimeRecord>> {
      return {
        status: 201,
        body: await agentRuntimeService.createRuntime(actorRole, input),
      };
    },

    async listRuntimes(): Promise<RouteResponse<AgentRuntimeRecord[]>> {
      return {
        status: 200,
        body: await agentRuntimeService.listRuntimes(),
      };
    },

    async getRuntime({
      runtimeId,
    }: {
      runtimeId: string;
    }): Promise<RouteResponse<AgentRuntimeRecord>> {
      return {
        status: 200,
        body: await agentRuntimeService.getRuntime(runtimeId),
      };
    },

    async archiveRuntime({
      actorRole,
      runtimeId,
    }: {
      actorRole: RoleKey;
      runtimeId: string;
    }): Promise<RouteResponse<AgentRuntimeRecord>> {
      return {
        status: 200,
        body: await agentRuntimeService.archiveRuntime(runtimeId, actorRole),
      };
    },
  };
}
