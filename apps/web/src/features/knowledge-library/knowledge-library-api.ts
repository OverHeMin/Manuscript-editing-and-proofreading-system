import type { KnowledgeHttpClient } from "../knowledge/index.ts";
import type {
  CreateKnowledgeLibraryDraftInput,
  KnowledgeAssetDetailViewModel,
  KnowledgeLibrarySummaryViewModel,
  UpdateKnowledgeLibraryDraftInput,
} from "./types.ts";

export type KnowledgeLibraryHttpClient = KnowledgeHttpClient;

export function listKnowledgeLibraryAssets(client: KnowledgeLibraryHttpClient) {
  return client.request<KnowledgeLibrarySummaryViewModel[]>({
    method: "GET",
    url: "/api/v1/knowledge/library",
  });
}

export function getKnowledgeAssetDetail(
  client: KnowledgeLibraryHttpClient,
  assetId: string,
  revisionId?: string,
) {
  const query =
    revisionId && revisionId.trim().length > 0
      ? `?revisionId=${encodeURIComponent(revisionId.trim())}`
      : "";

  return client.request<KnowledgeAssetDetailViewModel>({
    method: "GET",
    url: `/api/v1/knowledge/assets/${assetId}${query}`,
  });
}

export function createKnowledgeLibraryDraft(
  client: KnowledgeLibraryHttpClient,
  input: CreateKnowledgeLibraryDraftInput,
) {
  return client.request<KnowledgeAssetDetailViewModel>({
    method: "POST",
    url: "/api/v1/knowledge/assets/drafts",
    body: input,
  });
}

export function createKnowledgeDraftRevision(
  client: KnowledgeLibraryHttpClient,
  assetId: string,
) {
  return client.request<KnowledgeAssetDetailViewModel>({
    method: "POST",
    url: `/api/v1/knowledge/assets/${assetId}/revisions`,
  });
}

export function updateKnowledgeRevisionDraft(
  client: KnowledgeLibraryHttpClient,
  revisionId: string,
  input: UpdateKnowledgeLibraryDraftInput,
) {
  return client.request<KnowledgeAssetDetailViewModel>({
    method: "POST",
    url: `/api/v1/knowledge/revisions/${revisionId}/draft`,
    body: input,
  });
}

export function submitKnowledgeRevisionForReview(
  client: KnowledgeLibraryHttpClient,
  revisionId: string,
) {
  return client.request<KnowledgeAssetDetailViewModel>({
    method: "POST",
    url: `/api/v1/knowledge/revisions/${revisionId}/submit`,
  });
}
