import type {
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

export function listManuscriptAssets(
  client: ManuscriptHttpClient,
  manuscriptId: string,
) {
  return client.request<DocumentAssetViewModel[]>({
    method: "GET",
    url: `/api/v1/manuscripts/${manuscriptId}/assets`,
  });
}

export function getJob(client: ManuscriptHttpClient, jobId: string) {
  return client.request<JobViewModel>({
    method: "GET",
    url: `/api/v1/jobs/${jobId}`,
  });
}
