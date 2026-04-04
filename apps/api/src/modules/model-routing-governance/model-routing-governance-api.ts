import type { RoleKey } from "../../users/roles.ts";
import type {
  ModelRoutingPolicyRecord,
  ModelRoutingPolicyVersionEnvelope,
} from "./model-routing-governance-record.ts";
import type {
  CreateModelRoutingPolicyInput,
  ModelRoutingGovernanceService,
  ModelRoutingPolicyDecisionInput,
  UpdateDraftModelRoutingPolicyVersionInput,
} from "./model-routing-governance-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateModelRoutingGovernanceApiOptions {
  modelRoutingGovernanceService: ModelRoutingGovernanceService;
}

export function createModelRoutingGovernanceApi(
  options: CreateModelRoutingGovernanceApiOptions,
) {
  const { modelRoutingGovernanceService } = options;

  return {
    async createPolicy({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreateModelRoutingPolicyInput;
    }): Promise<RouteResponse<ModelRoutingPolicyVersionEnvelope>> {
      return {
        status: 201,
        body: await modelRoutingGovernanceService.createPolicy(actorRole, input),
      };
    },

    async listPolicies(): Promise<RouteResponse<ModelRoutingPolicyRecord[]>> {
      return {
        status: 200,
        body: await modelRoutingGovernanceService.listPolicies(),
      };
    },

    async updateDraftVersion({
      actorRole,
      versionId,
      input,
    }: {
      actorRole: RoleKey;
      versionId: string;
      input: UpdateDraftModelRoutingPolicyVersionInput;
    }): Promise<RouteResponse<ModelRoutingPolicyVersionEnvelope>> {
      return {
        status: 200,
        body: await modelRoutingGovernanceService.updateDraftVersion(
          versionId,
          actorRole,
          input,
        ),
      };
    },

    async createDraftVersion({
      actorRole,
      policyId,
      input,
    }: {
      actorRole: RoleKey;
      policyId: string;
      input: Omit<CreateModelRoutingPolicyInput, "scopeKind" | "scopeValue">;
    }): Promise<RouteResponse<ModelRoutingPolicyVersionEnvelope>> {
      return {
        status: 201,
        body: await modelRoutingGovernanceService.createDraftVersion(
          policyId,
          actorRole,
          input,
        ),
      };
    },

    async submitVersion({
      actorRole,
      versionId,
      input,
    }: {
      actorRole: RoleKey;
      versionId: string;
      input?: ModelRoutingPolicyDecisionInput;
    }): Promise<RouteResponse<ModelRoutingPolicyVersionEnvelope>> {
      return {
        status: 200,
        body: await modelRoutingGovernanceService.submitVersion(
          versionId,
          actorRole,
          input,
        ),
      };
    },

    async approveVersion({
      actorRole,
      versionId,
      input,
    }: {
      actorRole: RoleKey;
      versionId: string;
      input?: ModelRoutingPolicyDecisionInput;
    }): Promise<RouteResponse<ModelRoutingPolicyVersionEnvelope>> {
      return {
        status: 200,
        body: await modelRoutingGovernanceService.approveVersion(
          versionId,
          actorRole,
          input,
        ),
      };
    },

    async activateVersion({
      actorRole,
      versionId,
      input,
    }: {
      actorRole: RoleKey;
      versionId: string;
      input?: ModelRoutingPolicyDecisionInput;
    }): Promise<RouteResponse<ModelRoutingPolicyVersionEnvelope>> {
      return {
        status: 200,
        body: await modelRoutingGovernanceService.activateVersion(
          versionId,
          actorRole,
          input,
        ),
      };
    },

    async rejectVersion({
      actorRole,
      versionId,
      input,
    }: {
      actorRole: RoleKey;
      versionId: string;
      input?: ModelRoutingPolicyDecisionInput;
    }): Promise<RouteResponse<ModelRoutingPolicyVersionEnvelope>> {
      return {
        status: 200,
        body: await modelRoutingGovernanceService.rejectVersion(
          versionId,
          actorRole,
          input,
        ),
      };
    },

    async rollbackPolicy({
      actorRole,
      policyId,
      input,
    }: {
      actorRole: RoleKey;
      policyId: string;
      input?: ModelRoutingPolicyDecisionInput;
    }): Promise<RouteResponse<ModelRoutingPolicyVersionEnvelope>> {
      return {
        status: 200,
        body: await modelRoutingGovernanceService.rollbackPolicy(
          policyId,
          actorRole,
          input,
        ),
      };
    },
  };
}
