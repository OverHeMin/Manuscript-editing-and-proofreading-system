import type {
  HarnessDatasetExportApiResult,
  HarnessDatasetExportFormat,
  HarnessDatasetVersionApiRecord,
  HarnessDatasetWorkbenchApiOverview,
} from "./types.ts";

export interface HarnessDatasetsHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function getHarnessDatasetsWorkbenchOverview(
  client: HarnessDatasetsHttpClient,
) {
  return client.request<HarnessDatasetWorkbenchApiOverview>({
    method: "GET",
    url: "/api/v1/harness-datasets/workbench",
  });
}

export function exportHarnessGoldSetVersion(
  client: HarnessDatasetsHttpClient,
  goldSetVersionId: string,
  format: HarnessDatasetExportFormat,
) {
  return client.request<HarnessDatasetExportApiResult>({
    method: "POST",
    url: `/api/v1/harness-datasets/gold-set-versions/${goldSetVersionId}/export`,
    body: {
      format,
    },
  });
}

export function publishHarnessGoldSetVersion(
  client: HarnessDatasetsHttpClient,
  goldSetVersionId: string,
) {
  return client.request<HarnessDatasetVersionApiRecord>({
    method: "POST",
    url: `/api/v1/harness-datasets/gold-set-versions/${goldSetVersionId}/publish`,
    body: {},
  });
}

export function archiveHarnessGoldSetVersion(
  client: HarnessDatasetsHttpClient,
  goldSetVersionId: string,
) {
  return client.request<HarnessDatasetVersionApiRecord>({
    method: "POST",
    url: `/api/v1/harness-datasets/gold-set-versions/${goldSetVersionId}/archive`,
    body: {},
  });
}

export function copyHarnessGoldSetVersionToDraft(
  client: HarnessDatasetsHttpClient,
  goldSetVersionId: string,
  input: {
    publicationNotes?: string;
  } = {},
) {
  return client.request<HarnessDatasetVersionApiRecord>({
    method: "POST",
    url: `/api/v1/harness-datasets/gold-set-versions/${goldSetVersionId}/copy-draft`,
    body: {
      input,
    },
  });
}
