import type {
  HarnessDatasetExportApiResult,
  HarnessDatasetExportFormat,
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
