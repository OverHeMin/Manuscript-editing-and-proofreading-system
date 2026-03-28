import type { RoleKey } from "../../users/roles.ts";
import type { AgentProfileRecord } from "./agent-profile-record.ts";
import type {
  AgentProfileService,
  CreateAgentProfileInput,
} from "./agent-profile-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateAgentProfileApiOptions {
  agentProfileService: AgentProfileService;
}

export function createAgentProfileApi(options: CreateAgentProfileApiOptions) {
  const { agentProfileService } = options;

  return {
    async createProfile({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreateAgentProfileInput;
    }): Promise<RouteResponse<AgentProfileRecord>> {
      return {
        status: 201,
        body: await agentProfileService.createProfile(actorRole, input),
      };
    },

    async listProfiles(): Promise<RouteResponse<AgentProfileRecord[]>> {
      return {
        status: 200,
        body: await agentProfileService.listProfiles(),
      };
    },

    async getProfile({
      profileId,
    }: {
      profileId: string;
    }): Promise<RouteResponse<AgentProfileRecord>> {
      return {
        status: 200,
        body: await agentProfileService.getProfile(profileId),
      };
    },

    async publishProfile({
      actorRole,
      profileId,
    }: {
      actorRole: RoleKey;
      profileId: string;
    }): Promise<RouteResponse<AgentProfileRecord>> {
      return {
        status: 200,
        body: await agentProfileService.publishProfile(profileId, actorRole),
      };
    },

    async archiveProfile({
      actorRole,
      profileId,
    }: {
      actorRole: RoleKey;
      profileId: string;
    }): Promise<RouteResponse<AgentProfileRecord>> {
      return {
        status: 200,
        body: await agentProfileService.archiveProfile(profileId, actorRole),
      };
    },
  };
}
