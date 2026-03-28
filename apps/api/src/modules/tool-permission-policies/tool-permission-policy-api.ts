import type { RoleKey } from "../../users/roles.ts";
import type { ToolPermissionPolicyRecord } from "./tool-permission-policy-record.ts";
import type {
  CreateToolPermissionPolicyInput,
  ToolPermissionPolicyService,
} from "./tool-permission-policy-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateToolPermissionPolicyApiOptions {
  toolPermissionPolicyService: ToolPermissionPolicyService;
}

export function createToolPermissionPolicyApi(
  options: CreateToolPermissionPolicyApiOptions,
) {
  const { toolPermissionPolicyService } = options;

  return {
    async createPolicy({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreateToolPermissionPolicyInput;
    }): Promise<RouteResponse<ToolPermissionPolicyRecord>> {
      return {
        status: 201,
        body: await toolPermissionPolicyService.createPolicy(actorRole, input),
      };
    },

    async listPolicies(): Promise<RouteResponse<ToolPermissionPolicyRecord[]>> {
      return {
        status: 200,
        body: await toolPermissionPolicyService.listPolicies(),
      };
    },

    async getPolicy({
      policyId,
    }: {
      policyId: string;
    }): Promise<RouteResponse<ToolPermissionPolicyRecord>> {
      return {
        status: 200,
        body: await toolPermissionPolicyService.getPolicy(policyId),
      };
    },

    async activatePolicy({
      actorRole,
      policyId,
    }: {
      actorRole: RoleKey;
      policyId: string;
    }): Promise<RouteResponse<ToolPermissionPolicyRecord>> {
      return {
        status: 200,
        body: await toolPermissionPolicyService.activatePolicy(
          policyId,
          actorRole,
        ),
      };
    },

    async archivePolicy({
      actorRole,
      policyId,
    }: {
      actorRole: RoleKey;
      policyId: string;
    }): Promise<RouteResponse<ToolPermissionPolicyRecord>> {
      return {
        status: 200,
        body: await toolPermissionPolicyService.archivePolicy(
          policyId,
          actorRole,
        ),
      };
    },
  };
}
