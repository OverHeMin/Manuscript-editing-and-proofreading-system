import type { RoleKey } from "../../users/roles.ts";
import { KnowledgeService } from "./knowledge-service.ts";
import type {
  CreateKnowledgeDraftInput,
  UpdateKnowledgeDraftInput,
} from "./knowledge-service.ts";
import type {
  KnowledgeRecord,
  KnowledgeReviewActionRecord,
} from "./knowledge-record.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateKnowledgeApiOptions {
  knowledgeService: KnowledgeService;
}

export function createKnowledgeApi(options: CreateKnowledgeApiOptions) {
  const { knowledgeService } = options;

  return {
    async createDraft(
      input: CreateKnowledgeDraftInput,
    ): Promise<RouteResponse<KnowledgeRecord>> {
      return {
        status: 201,
        body: await knowledgeService.createDraft(input),
      };
    },

    async submitForReview({
      knowledgeItemId,
    }: {
      knowledgeItemId: string;
    }): Promise<RouteResponse<KnowledgeRecord>> {
      return {
        status: 200,
        body: await knowledgeService.submitForReview(knowledgeItemId),
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

    async listKnowledgeItems(): Promise<RouteResponse<KnowledgeRecord[]>> {
      return {
        status: 200,
        body: await knowledgeService.listKnowledgeItems(),
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
  };
}
