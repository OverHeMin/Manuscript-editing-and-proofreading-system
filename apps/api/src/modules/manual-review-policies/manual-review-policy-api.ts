import type { RoleKey } from "../../users/roles.ts";
import type { ManualReviewPolicyRecord } from "./manual-review-policy-record.ts";
import type {
  CreateManualReviewPolicyInput,
  ManualReviewPolicyService,
} from "./manual-review-policy-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateManualReviewPolicyApiOptions {
  manualReviewPolicyService: ManualReviewPolicyService;
}

export function createManualReviewPolicyApi(
  options: CreateManualReviewPolicyApiOptions,
) {
  const { manualReviewPolicyService } = options;

  return {
    async createPolicy({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreateManualReviewPolicyInput;
    }): Promise<RouteResponse<ManualReviewPolicyRecord>> {
      return {
        status: 201,
        body: await manualReviewPolicyService.createPolicy(actorRole, input),
      };
    },

    async listPoliciesForScope({
      module,
      manuscriptType,
      templateFamilyId,
      activeOnly,
    }: {
      module: ManualReviewPolicyRecord["module"];
      manuscriptType: ManualReviewPolicyRecord["manuscript_type"];
      templateFamilyId: ManualReviewPolicyRecord["template_family_id"];
      activeOnly?: boolean;
    }): Promise<RouteResponse<ManualReviewPolicyRecord[]>> {
      return {
        status: 200,
        body: await manualReviewPolicyService.listPoliciesForScope({
          module,
          manuscriptType,
          templateFamilyId,
          activeOnly,
        }),
      };
    },

    async getPolicy({
      policyId,
    }: {
      policyId: string;
    }): Promise<RouteResponse<ManualReviewPolicyRecord>> {
      return {
        status: 200,
        body: await manualReviewPolicyService.getPolicy(policyId),
      };
    },

    async activatePolicy({
      actorRole,
      policyId,
    }: {
      actorRole: RoleKey;
      policyId: string;
    }): Promise<RouteResponse<ManualReviewPolicyRecord>> {
      return {
        status: 200,
        body: await manualReviewPolicyService.activatePolicy(
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
    }): Promise<RouteResponse<ManualReviewPolicyRecord>> {
      return {
        status: 200,
        body: await manualReviewPolicyService.archivePolicy(
          policyId,
          actorRole,
        ),
      };
    },
  };
}
