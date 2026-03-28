import type { AuthRole } from "../auth/roles.ts";
import type {
  CreateKnowledgeDraftInput,
  KnowledgeItemViewModel,
  KnowledgeReviewActionViewModel,
  KnowledgeReviewQueueItemViewModel,
  UpdateKnowledgeDraftInput,
} from "./types.ts";

export interface KnowledgeHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function createKnowledgeDraft(
  client: KnowledgeHttpClient,
  input: CreateKnowledgeDraftInput,
) {
  return client.request<KnowledgeItemViewModel>({
    method: "POST",
    url: "/api/v1/knowledge/drafts",
    body: input,
  });
}

export function submitKnowledgeForReview(
  client: KnowledgeHttpClient,
  knowledgeItemId: string,
) {
  return client.request<KnowledgeItemViewModel>({
    method: "POST",
    url: `/api/v1/knowledge/${knowledgeItemId}/submit`,
  });
}

export function approveKnowledgeItem(
  client: KnowledgeHttpClient,
  knowledgeItemId: string,
  actorRole: AuthRole,
  reviewNote?: string,
) {
  return client.request<KnowledgeItemViewModel>({
    method: "POST",
    url: `/api/v1/knowledge/${knowledgeItemId}/approve`,
    body: {
      actorRole,
      reviewNote,
    },
  });
}

export function rejectKnowledgeItem(
  client: KnowledgeHttpClient,
  knowledgeItemId: string,
  actorRole: AuthRole,
  reviewNote?: string,
) {
  return client.request<KnowledgeItemViewModel>({
    method: "POST",
    url: `/api/v1/knowledge/${knowledgeItemId}/reject`,
    body: {
      actorRole,
      reviewNote,
    },
  });
}

export function updateKnowledgeDraft(
  client: KnowledgeHttpClient,
  knowledgeItemId: string,
  input: UpdateKnowledgeDraftInput,
) {
  return client.request<KnowledgeItemViewModel>({
    method: "POST",
    url: `/api/v1/knowledge/${knowledgeItemId}/draft`,
    body: input,
  });
}

export function listKnowledgeItems(client: KnowledgeHttpClient) {
  return client.request<KnowledgeItemViewModel[]>({
    method: "GET",
    url: "/api/v1/knowledge",
  });
}

export function listPendingKnowledgeReviewItems(client: KnowledgeHttpClient) {
  return client.request<KnowledgeReviewQueueItemViewModel[]>({
    method: "GET",
    // This queue is shared by Web workbench pages and the first WeChat review flow.
    url: "/api/v1/knowledge/review-queue",
  });
}

export function listKnowledgeReviewActions(
  client: KnowledgeHttpClient,
  knowledgeItemId: string,
) {
  return client.request<KnowledgeReviewActionViewModel[]>({
    method: "GET",
    url: `/api/v1/knowledge/${knowledgeItemId}/review-actions`,
  });
}

export function archiveKnowledgeItem(
  client: KnowledgeHttpClient,
  knowledgeItemId: string,
) {
  return client.request<KnowledgeItemViewModel>({
    method: "POST",
    url: `/api/v1/knowledge/${knowledgeItemId}/archive`,
  });
}
