import type {
  KnowledgeRetrievalQualityRunViewModel,
  KnowledgeRetrievalSnapshotViewModel,
} from "./types.ts";

export interface KnowledgeRetrievalHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function getLatestTemplateFamilyRetrievalQualityRun(
  client: KnowledgeRetrievalHttpClient,
  templateFamilyId: string,
) {
  return client.request<KnowledgeRetrievalQualityRunViewModel>({
    method: "GET",
    url: `/api/v1/templates/families/${templateFamilyId}/retrieval-quality-runs/latest`,
  });
}

export function getRetrievalSnapshot(
  client: KnowledgeRetrievalHttpClient,
  snapshotId: string,
) {
  return client.request<KnowledgeRetrievalSnapshotViewModel>({
    method: "GET",
    url: `/api/v1/knowledge/retrieval-snapshots/${snapshotId}`,
  });
}
