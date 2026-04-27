import type {
  DocumentAssetExportViewModel,
  DocumentAssetViewModel,
  JobViewModel,
  ManuscriptHarnessMatrixViewModel,
  ModuleExecutionConcurrencySnapshotViewModel,
  UploadManuscriptBatchInput,
  UploadManuscriptBatchResult,
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

export function uploadManuscriptBatch(
  client: ManuscriptHttpClient,
  input: UploadManuscriptBatchInput,
) {
  return client.request<UploadManuscriptBatchResult>({
    method: "POST",
    url: "/api/v1/manuscripts/upload-batch",
    body: input,
  });
}

export function listManuscripts(client: ManuscriptHttpClient, limit = 50) {
  return client.request<ManuscriptViewModel[]>({
    method: "GET",
    url: limit === 50 ? "/api/v1/manuscripts" : `/api/v1/manuscripts?limit=${encodeURIComponent(String(limit))}`,
  });
}

export function getManuscript(client: ManuscriptHttpClient, manuscriptId: string) {
  return client.request<ManuscriptViewModel>({
    method: "GET",
    url: `/api/v1/manuscripts/${manuscriptId}`,
  });
}

export function archiveManuscript(
  client: ManuscriptHttpClient,
  manuscriptId: string,
) {
  return client.request<ManuscriptViewModel>({
    method: "POST",
    url: `/api/v1/manuscripts/${encodeURIComponent(manuscriptId)}/archive`,
  });
}

export function getManuscriptHarnessMatrix(
  client: ManuscriptHttpClient,
  manuscriptId: string,
) {
  return client.request<ManuscriptHarnessMatrixViewModel>({
    method: "GET",
    url: `/api/v1/manuscripts/${manuscriptId}/harness-matrix`,
  });
}

export function retryProofreadingDeepPassRun(
  client: ManuscriptHttpClient,
  passRunId: string,
) {
  return client.request<unknown>({
    method: "POST",
    url: `/api/v1/modules/proofreading/pass-runs/${passRunId}/retry`,
  });
}

export interface ProofreadingPassRunDetailViewModel {
  id: string;
  status: string;
  pass_no: number;
  pass_kind: string;
  output?: {
    summary?: string;
    segmentation?: {
      mode: string;
      segmentCount: number;
      completedSegmentCount: number;
      failedSegmentCount: number;
      coverageRatio: number;
      segments: Array<{
        segmentNo: number;
        status: string;
        attemptCount: number;
        elapsedMs: number;
        blockIndexes: number[];
        inputPreview: Array<{
          blockIndex: number;
          section?: string;
          blockKind?: string;
          textPreview: string;
        }>;
        errorMessage?: string;
      }>;
    };
  };
}

export function getProofreadingDeepPassRun(
  client: ManuscriptHttpClient,
  passRunId: string,
) {
  return client.request<ProofreadingPassRunDetailViewModel>({
    method: "GET",
    url: `/api/v1/modules/proofreading/pass-runs/${passRunId}`,
  });
}

export function updateManuscriptTemplateSelection(
  client: ManuscriptHttpClient,
  input: {
    manuscriptId: string;
    templateFamilyId?: string | null;
    journalTemplateId?: string | null;
  },
) {
  return client.request<ManuscriptViewModel>({
    method: "POST",
    url: `/api/v1/manuscripts/${input.manuscriptId}/template-selection`,
    body: {
      templateFamilyId: input.templateFamilyId ?? null,
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

export function getModuleExecutionConcurrency(client: ManuscriptHttpClient) {
  return client.request<ModuleExecutionConcurrencySnapshotViewModel>({
    method: "GET",
    url: "/api/v1/module-execution/concurrency",
  });
}
