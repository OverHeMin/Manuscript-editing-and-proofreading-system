import type { RoleKey } from "../../users/roles.ts";
import type { SandboxProfileRecord } from "./sandbox-profile-record.ts";
import type {
  CreateSandboxProfileInput,
  SandboxProfileService,
} from "./sandbox-profile-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateSandboxProfileApiOptions {
  sandboxProfileService: SandboxProfileService;
}

export function createSandboxProfileApi(
  options: CreateSandboxProfileApiOptions,
) {
  const { sandboxProfileService } = options;

  return {
    async createProfile({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreateSandboxProfileInput;
    }): Promise<RouteResponse<SandboxProfileRecord>> {
      return {
        status: 201,
        body: await sandboxProfileService.createProfile(actorRole, input),
      };
    },

    async listProfiles(): Promise<RouteResponse<SandboxProfileRecord[]>> {
      return {
        status: 200,
        body: await sandboxProfileService.listProfiles(),
      };
    },

    async getProfile({
      profileId,
    }: {
      profileId: string;
    }): Promise<RouteResponse<SandboxProfileRecord>> {
      return {
        status: 200,
        body: await sandboxProfileService.getProfile(profileId),
      };
    },

    async activateProfile({
      actorRole,
      profileId,
    }: {
      actorRole: RoleKey;
      profileId: string;
    }): Promise<RouteResponse<SandboxProfileRecord>> {
      return {
        status: 200,
        body: await sandboxProfileService.activateProfile(profileId, actorRole),
      };
    },

    async archiveProfile({
      actorRole,
      profileId,
    }: {
      actorRole: RoleKey;
      profileId: string;
    }): Promise<RouteResponse<SandboxProfileRecord>> {
      return {
        status: 200,
        body: await sandboxProfileService.archiveProfile(profileId, actorRole),
      };
    },
  };
}
