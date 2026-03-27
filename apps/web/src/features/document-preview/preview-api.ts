import type {
  DocumentNormalizationExecutionViewModel,
  DocumentPreviewViewModel,
  DocumentPreviewSessionViewModel,
} from "./types.ts";

export interface DocumentPreviewHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function mapNormalizationPlanToPreview(
  result: DocumentNormalizationExecutionViewModel,
): DocumentPreviewViewModel {
  return {
    manuscript_id: result.plan.manuscript_id,
    source_asset_id: result.preview.source_asset_id,
    normalized_asset_type:
      result.normalized_asset?.asset_type ?? result.plan.derived_asset.asset_type,
    viewer: result.preview.viewer,
    status: result.preview.status,
    mime_type: result.preview.mime_type,
    file_name:
      result.normalized_asset?.file_name ?? result.plan.derived_asset.file_name,
    storage_key:
      result.normalized_asset?.storage_key ?? result.plan.derived_asset.storage_key,
    warnings: [...result.preview.warnings],
  };
}

export function createPreviewSession(
  client: DocumentPreviewHttpClient,
  input: {
    manuscriptId: string;
    assetId: string;
    actorRole: string;
    previewStatus?: "ready" | "pending_normalization";
    comments?: Array<{
      id: string;
      author?: string;
      body: string;
      anchor_text?: string;
      created_at?: string;
    }>;
  },
) {
  return client.request<DocumentPreviewSessionViewModel>({
    method: "POST",
    url: "/api/v1/document-pipeline/preview-session",
    body: input,
  });
}
