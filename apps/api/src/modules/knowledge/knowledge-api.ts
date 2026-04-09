import type { RoleKey } from "../../users/roles.ts";
import type {
  CreateHarnessDatasetDraftCandidateFromHumanFinalAssetInput,
  HarnessDatasetDraftCandidateRecord,
  HarnessDatasetService,
} from "../harness-datasets/harness-dataset-service.ts";
import { KnowledgeService } from "./knowledge-service.ts";
import type {
  CreateKnowledgeLibraryDraftInput,
  GovernedRetrievalContextRecord,
  SubmitKnowledgeForReviewInput,
  SubmitKnowledgeRevisionForReviewInput,
  KnowledgeAssetDetailRecord,
  ResolveGovernedRetrievalContextInput,
  CreateKnowledgeDraftInput,
  UpdateKnowledgeRevisionDraftInput,
  UpdateKnowledgeDraftInput,
} from "./knowledge-service.ts";
import type { KnowledgeRetrievalSnapshotRecord } from "../knowledge-retrieval/knowledge-retrieval-record.ts";
import type {
  KnowledgeDuplicateAcknowledgementRecord,
  KnowledgeDuplicateCheckInput,
  KnowledgeDuplicateMatchRecord,
  KnowledgeRecord,
  KnowledgeReviewActionRecord,
} from "./knowledge-record.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateKnowledgeApiOptions {
  knowledgeService: KnowledgeService;
  harnessDatasetService?: HarnessDatasetService;
}

export function createKnowledgeApi(options: CreateKnowledgeApiOptions) {
  const { knowledgeService, harnessDatasetService } = options;

  return {
    async checkDuplicates(
      input: KnowledgeDuplicateCheckInput,
    ): Promise<RouteResponse<KnowledgeDuplicateMatchRecord[]>> {
      return {
        status: 200,
        body: await knowledgeService.checkDuplicates(input),
      };
    },

    async createDraft(
      input: CreateKnowledgeDraftInput,
    ): Promise<RouteResponse<KnowledgeRecord>> {
      return {
        status: 201,
        body: await knowledgeService.createDraft(input),
      };
    },

    async createLibraryDraft(
      input: CreateKnowledgeLibraryDraftInput,
    ): Promise<RouteResponse<KnowledgeAssetDetailRecord>> {
      return {
        status: 201,
        body: await knowledgeService.createLibraryDraft(input),
      };
    },

    async createDraftRevision({
      assetId,
    }: {
      assetId: string;
    }): Promise<RouteResponse<KnowledgeAssetDetailRecord>> {
      return {
        status: 201,
        body: await knowledgeService.createDraftRevisionFromApprovedAsset(assetId),
      };
    },

    async submitForReview({
      knowledgeItemId,
      duplicateAcknowledgements,
      actorRole,
    }: {
      knowledgeItemId: string;
      duplicateAcknowledgements?: readonly KnowledgeDuplicateAcknowledgementRecord[];
      actorRole?: RoleKey;
    }): Promise<RouteResponse<KnowledgeRecord>> {
      const submitInput: SubmitKnowledgeForReviewInput = {
        knowledgeItemId,
        duplicateAcknowledgements,
        acknowledgedByRole: actorRole ?? "user",
      };
      const record = await knowledgeService.submitForReview(submitInput);

      return {
        status: 200,
        body: record,
      };
    },

    async submitRevisionForReview({
      revisionId,
      duplicateAcknowledgements,
      actorRole,
    }: {
      revisionId: string;
      duplicateAcknowledgements?: readonly KnowledgeDuplicateAcknowledgementRecord[];
      actorRole?: RoleKey;
    }): Promise<RouteResponse<KnowledgeAssetDetailRecord>> {
      const submitInput: SubmitKnowledgeRevisionForReviewInput = {
        revisionId,
        duplicateAcknowledgements,
        acknowledgedByRole: actorRole ?? "user",
      };
      const record = await knowledgeService.submitRevisionForReview(submitInput);

      return {
        status: 200,
        body: record,
      };
    },

    async approve({
      knowledgeItemId,
      actorRole,
      reviewNote,
    }: {
      knowledgeItemId: string;
      actorRole: RoleKey;
      reviewNote?: string;
    }): Promise<RouteResponse<KnowledgeRecord>> {
      return {
        status: 200,
        body: await knowledgeService.approve(knowledgeItemId, actorRole, reviewNote),
      };
    },

    async approveRevision({
      revisionId,
      actorRole,
      reviewNote,
    }: {
      revisionId: string;
      actorRole: RoleKey;
      reviewNote?: string;
    }): Promise<RouteResponse<KnowledgeAssetDetailRecord>> {
      return {
        status: 200,
        body: await knowledgeService.approveRevision(
          revisionId,
          actorRole,
          reviewNote,
        ),
      };
    },

    async reject({
      knowledgeItemId,
      actorRole,
      reviewNote,
    }: {
      knowledgeItemId: string;
      actorRole: RoleKey;
      reviewNote?: string;
    }): Promise<RouteResponse<KnowledgeRecord>> {
      return {
        status: 200,
        body: await knowledgeService.reject(knowledgeItemId, actorRole, reviewNote),
      };
    },

    async rejectRevision({
      revisionId,
      actorRole,
      reviewNote,
    }: {
      revisionId: string;
      actorRole: RoleKey;
      reviewNote?: string;
    }): Promise<RouteResponse<KnowledgeAssetDetailRecord>> {
      return {
        status: 200,
        body: await knowledgeService.rejectRevision(
          revisionId,
          actorRole,
          reviewNote,
        ),
      };
    },

    async updateDraft({
      knowledgeItemId,
      input,
    }: {
      knowledgeItemId: string;
      input: UpdateKnowledgeDraftInput;
    }): Promise<RouteResponse<KnowledgeRecord>> {
      return {
        status: 200,
        body: await knowledgeService.updateDraft(knowledgeItemId, input),
      };
    },

    async updateRevisionDraft({
      revisionId,
      input,
    }: {
      revisionId: string;
      input: UpdateKnowledgeRevisionDraftInput;
    }): Promise<RouteResponse<KnowledgeAssetDetailRecord>> {
      return {
        status: 200,
        body: await knowledgeService.updateRevisionDraft(revisionId, input),
      };
    },

    async listKnowledgeItems(): Promise<RouteResponse<KnowledgeRecord[]>> {
      return {
        status: 200,
        body: await knowledgeService.listKnowledgeItems(),
      };
    },

    async getKnowledgeAsset({
      assetId,
      revisionId,
    }: {
      assetId: string;
      revisionId?: string;
    }): Promise<RouteResponse<KnowledgeAssetDetailRecord>> {
      return {
        status: 200,
        body: await knowledgeService.getKnowledgeAsset(assetId, revisionId),
      };
    },

    async listPendingReviewItems(): Promise<RouteResponse<KnowledgeRecord[]>> {
      return {
        status: 200,
        body: await knowledgeService.listPendingReviewItems(),
      };
    },

    async listReviewActions({
      knowledgeItemId,
    }: {
      knowledgeItemId: string;
    }): Promise<RouteResponse<KnowledgeReviewActionRecord[]>> {
      return {
        status: 200,
        body: await knowledgeService.listReviewActions(knowledgeItemId),
      };
    },

    async listReviewActionsByRevision({
      revisionId,
    }: {
      revisionId: string;
    }): Promise<RouteResponse<KnowledgeReviewActionRecord[]>> {
      return {
        status: 200,
        body: await knowledgeService.listReviewActionsByRevision(revisionId),
      };
    },

    async resolveGovernedRetrievalContext({
      input,
    }: {
      input: ResolveGovernedRetrievalContextInput;
    }): Promise<RouteResponse<GovernedRetrievalContextRecord>> {
      return {
        status: 200,
        body: await knowledgeService.resolveGovernedRetrievalContext(input),
      };
    },

    async getRetrievalSnapshot({
      actorRole,
      snapshotId,
    }: {
      actorRole: RoleKey;
      snapshotId: string;
    }): Promise<RouteResponse<KnowledgeRetrievalSnapshotRecord>> {
      return {
        status: 200,
        body: await knowledgeService.getRetrievalSnapshot(actorRole, snapshotId),
      };
    },

    async archive({
      knowledgeItemId,
    }: {
      knowledgeItemId: string;
    }): Promise<RouteResponse<KnowledgeRecord>> {
      return {
        status: 200,
        body: await knowledgeService.archive(knowledgeItemId),
      };
    },

    async createHarnessDatasetCandidateFromHumanFinalAsset({
      actorRole,
      humanFinalAssetId,
      input,
    }: {
      actorRole: RoleKey;
      humanFinalAssetId: string;
      input: CreateHarnessDatasetDraftCandidateFromHumanFinalAssetInput;
    }): Promise<RouteResponse<HarnessDatasetDraftCandidateRecord>> {
      if (!harnessDatasetService) {
        throw new Error(
          "Harness dataset service is not configured for knowledge handoffs.",
        );
      }

      return {
        status: 201,
        body: await harnessDatasetService.createDraftCandidateFromHumanFinalAsset(
          actorRole,
          humanFinalAssetId,
          input,
        ),
      };
    },
  };
}
