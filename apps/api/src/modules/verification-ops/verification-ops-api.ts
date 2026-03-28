import type { RoleKey } from "../../users/roles.ts";
import type {
  EvaluationRunRecord,
  EvaluationRunItemRecord,
  EvaluationSampleSetItemRecord,
  EvaluationSampleSetRecord,
  EvaluationSuiteRecord,
  ReleaseCheckProfileRecord,
  VerificationCheckProfileRecord,
  VerificationEvidenceRecord,
} from "./verification-ops-record.ts";
import type {
  CompleteEvaluationRunInput,
  CreateEvaluationRunInput,
  CreateEvaluationSampleSetInput,
  CreateEvaluationSuiteInput,
  CreateReleaseCheckProfileInput,
  CreateVerificationCheckProfileInput,
  FinalizeEvaluationRunResult,
  RecordEvaluationRunItemResultInput,
  RecordVerificationEvidenceInput,
  VerificationOpsService,
} from "./verification-ops-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateVerificationOpsApiOptions {
  verificationOpsService: VerificationOpsService;
}

export function createVerificationOpsApi(
  options: CreateVerificationOpsApiOptions,
) {
  const { verificationOpsService } = options;

  return {
    async createEvaluationSampleSet({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreateEvaluationSampleSetInput;
    }): Promise<RouteResponse<EvaluationSampleSetRecord>> {
      return {
        status: 201,
        body: await verificationOpsService.createEvaluationSampleSet(actorRole, input),
      };
    },

    async publishEvaluationSampleSet({
      actorRole,
      sampleSetId,
    }: {
      actorRole: RoleKey;
      sampleSetId: string;
    }): Promise<RouteResponse<EvaluationSampleSetRecord>> {
      return {
        status: 200,
        body: await verificationOpsService.publishEvaluationSampleSet(
          sampleSetId,
          actorRole,
        ),
      };
    },

    async listEvaluationSampleSets(): Promise<
      RouteResponse<EvaluationSampleSetRecord[]>
    > {
      return {
        status: 200,
        body: await verificationOpsService.listEvaluationSampleSets(),
      };
    },

    async listEvaluationSampleSetItems({
      sampleSetId,
    }: {
      sampleSetId: string;
    }): Promise<RouteResponse<EvaluationSampleSetItemRecord[]>> {
      return {
        status: 200,
        body: await verificationOpsService.listEvaluationSampleSetItemsBySampleSetId(
          sampleSetId,
        ),
      };
    },

    async createVerificationCheckProfile({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreateVerificationCheckProfileInput;
    }): Promise<RouteResponse<VerificationCheckProfileRecord>> {
      return {
        status: 201,
        body: await verificationOpsService.createVerificationCheckProfile(
          actorRole,
          input,
        ),
      };
    },

    async publishVerificationCheckProfile({
      actorRole,
      profileId,
    }: {
      actorRole: RoleKey;
      profileId: string;
    }): Promise<RouteResponse<VerificationCheckProfileRecord>> {
      return {
        status: 200,
        body: await verificationOpsService.publishVerificationCheckProfile(
          profileId,
          actorRole,
        ),
      };
    },

    async listVerificationCheckProfiles(): Promise<
      RouteResponse<VerificationCheckProfileRecord[]>
    > {
      return {
        status: 200,
        body: await verificationOpsService.listVerificationCheckProfiles(),
      };
    },

    async createReleaseCheckProfile({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreateReleaseCheckProfileInput;
    }): Promise<RouteResponse<ReleaseCheckProfileRecord>> {
      return {
        status: 201,
        body: await verificationOpsService.createReleaseCheckProfile(actorRole, input),
      };
    },

    async publishReleaseCheckProfile({
      actorRole,
      profileId,
    }: {
      actorRole: RoleKey;
      profileId: string;
    }): Promise<RouteResponse<ReleaseCheckProfileRecord>> {
      return {
        status: 200,
        body: await verificationOpsService.publishReleaseCheckProfile(
          profileId,
          actorRole,
        ),
      };
    },

    async listReleaseCheckProfiles(): Promise<RouteResponse<ReleaseCheckProfileRecord[]>> {
      return {
        status: 200,
        body: await verificationOpsService.listReleaseCheckProfiles(),
      };
    },

    async createEvaluationSuite({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreateEvaluationSuiteInput;
    }): Promise<RouteResponse<EvaluationSuiteRecord>> {
      return {
        status: 201,
        body: await verificationOpsService.createEvaluationSuite(actorRole, input),
      };
    },

    async activateEvaluationSuite({
      actorRole,
      suiteId,
    }: {
      actorRole: RoleKey;
      suiteId: string;
    }): Promise<RouteResponse<EvaluationSuiteRecord>> {
      return {
        status: 200,
        body: await verificationOpsService.activateEvaluationSuite(suiteId, actorRole),
      };
    },

    async listEvaluationSuites(): Promise<RouteResponse<EvaluationSuiteRecord[]>> {
      return {
        status: 200,
        body: await verificationOpsService.listEvaluationSuites(),
      };
    },

    async recordVerificationEvidence({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: RecordVerificationEvidenceInput;
    }): Promise<RouteResponse<VerificationEvidenceRecord>> {
      return {
        status: 201,
        body: await verificationOpsService.recordVerificationEvidence(
          actorRole,
          input,
        ),
      };
    },

    async createEvaluationRun({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreateEvaluationRunInput;
    }): Promise<RouteResponse<EvaluationRunRecord>> {
      return {
        status: 201,
        body: await verificationOpsService.createEvaluationRun(actorRole, input),
      };
    },

    async completeEvaluationRun({
      actorRole,
      runId,
      status,
      evidenceIds,
    }: {
      actorRole: RoleKey;
      runId: string;
      status: CompleteEvaluationRunInput["status"];
      evidenceIds: string[];
    }): Promise<RouteResponse<EvaluationRunRecord>> {
      return {
        status: 200,
        body: await verificationOpsService.completeEvaluationRun(actorRole, {
          runId,
          status,
          evidenceIds,
        }),
      };
    },

    async recordEvaluationRunItemResult({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: RecordEvaluationRunItemResultInput;
    }): Promise<RouteResponse<EvaluationRunItemRecord>> {
      return {
        status: 200,
        body: await verificationOpsService.recordEvaluationRunItemResult(
          actorRole,
          input,
        ),
      };
    },

    async finalizeEvaluationRun({
      actorRole,
      runId,
    }: {
      actorRole: RoleKey;
      runId: string;
    }): Promise<RouteResponse<FinalizeEvaluationRunResult>> {
      return {
        status: 200,
        body: await verificationOpsService.finalizeEvaluationRun(actorRole, runId),
      };
    },

    async listEvaluationRunsBySuiteId({
      suiteId,
    }: {
      suiteId: string;
    }): Promise<RouteResponse<EvaluationRunRecord[]>> {
      return {
        status: 200,
        body: await verificationOpsService.listEvaluationRunsBySuiteId(suiteId),
      };
    },

    async listEvaluationRunItemsByRunId({
      runId,
    }: {
      runId: string;
    }): Promise<RouteResponse<EvaluationRunItemRecord[]>> {
      return {
        status: 200,
        body: await verificationOpsService.listEvaluationRunItemsByRunId(runId),
      };
    },
  };
}
