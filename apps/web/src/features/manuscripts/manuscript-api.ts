import type {
  DocumentAssetExportViewModel,
  DocumentAssetViewModel,
  JobViewModel,
  ManuscriptViewModel,
  UploadManuscriptInput,
  UploadManuscriptResult,
} from "./types.ts";

export interface ManuscriptHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function uploadManuscript(
  client: ManuscriptHttpClient,
  input: UploadManuscriptInput,
) {
  return client.request<UploadManuscriptResult>({
    method: "POST",
    url: "/api/v1/manuscripts/upload",
    body: input,
  });
}

export function getManuscript(client: ManuscriptHttpClient, manuscriptId: string) {
  return client.request<ManuscriptViewModel>({
    method: "GET",
    url: `/api/v1/manuscripts/${manuscriptId}`,
  });
}

export function updateManuscriptTemplateSelection(
  client: ManuscriptHttpClient,
  input: {
    manuscriptId: string;
    journalTemplateId?: string | null;
  },
) {
  return client.request<ManuscriptViewModel>({
    method: "POST",
    url: `/api/v1/manuscripts/${input.manuscriptId}/template-selection`,
    body: {
      journalTemplateId: input.journalTemplateId ?? null,
    },
  });
}

export function listManuscriptAssets(
  client: ManuscriptHttpClient,
  manuscriptId: string,
) {
  return client.request<DocumentAssetViewModel[]>({
    method: "GET",
    url: `/api/v1/manuscripts/${manuscriptId}/assets`,
  });
}

export function exportCurrentAsset(
  client: ManuscriptHttpClient,
  input: {
    manuscriptId: string;
    preferredAssetType?: DocumentAssetViewModel["asset_type"];
  },
) {
  return client.request<DocumentAssetExportViewModel>({
    method: "POST",
    url: "/api/v1/document-pipeline/export-current-asset",
    body: input,
  });
}

export function getJob(client: ManuscriptHttpClient, jobId: string) {
  return client.request<JobViewModel>({
    method: "GET",
    url: `/api/v1/jobs/${jobId}`,
  });
}
