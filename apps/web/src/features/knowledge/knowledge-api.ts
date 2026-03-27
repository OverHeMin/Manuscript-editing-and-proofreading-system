import type { AuthRole } from "../auth/roles.ts";
import type {
  CreateKnowledgeDraftInput,
  KnowledgeItemViewModel,
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
) {
  return client.request<KnowledgeItemViewModel>({
    method: "POST",
    url: `/api/v1/knowledge/${knowledgeItemId}/approve`,
    body: {
      actorRole,
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

export function archiveKnowledgeItem(
  client: KnowledgeHttpClient,
  knowledgeItemId: string,
) {
  return client.request<KnowledgeItemViewModel>({
    method: "POST",
    url: `/api/v1/knowledge/${knowledgeItemId}/archive`,
  });
}
