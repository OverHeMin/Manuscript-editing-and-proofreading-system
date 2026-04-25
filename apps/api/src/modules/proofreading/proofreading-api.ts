import { ProofreadingService } from "./proofreading-service.ts";
import type {
  ConfirmProofreadingFinalInput,
  CreateProofreadingDraftInput,
  ProofreadingConfirmationDraftSaveResult,
  ProofreadingGovernanceHandoff,
  ProofreadingHumanFinalPublishResult,
  ProofreadingRunResult,
  PublishProofreadingHumanFinalInput,
  SaveProofreadingConfirmationDraftInput,
} from "./proofreading-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateProofreadingApiOptions {
  proofreadingService: ProofreadingService;
}

export function createProofreadingApi(options: CreateProofreadingApiOptions) {
  const { proofreadingService } = options;

  return {
    async createDraft(
      input: CreateProofreadingDraftInput,
    ): Promise<RouteResponse<ProofreadingRunResult>> {
      return {
        status: 201,
        body: await proofreadingService.createDraft(input),
      };
    },

    async confirmFinal(
      input: ConfirmProofreadingFinalInput,
    ): Promise<RouteResponse<ProofreadingRunResult>> {
      return {
        status: 201,
        body: await proofreadingService.confirmFinal(input),
      };
    },

    async publishHumanFinal(
      input: PublishProofreadingHumanFinalInput,
    ): Promise<RouteResponse<ProofreadingHumanFinalPublishResult>> {
      return {
        status: 201,
        body: await proofreadingService.publishHumanFinal(input),
      };
    },

    async saveConfirmationDraft(
      input: SaveProofreadingConfirmationDraftInput,
    ): Promise<RouteResponse<ProofreadingConfirmationDraftSaveResult>> {
      return {
        status: 200,
        body: await proofreadingService.saveConfirmationDraft(input),
      };
    },

    async getGovernanceHandoff(input: {
      manuscriptId: string;
      snapshotId?: string;
      actorRole: CreateProofreadingDraftInput["actorRole"];
    }): Promise<RouteResponse<ProofreadingGovernanceHandoff>> {
      return {
        status: 200,
        body: await proofreadingService.getGovernanceHandoff(input),
      };
    },
  };
}
