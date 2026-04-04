import type {
  HarnessAdapterViewModel,
  HarnessExecutionViewModel,
} from "./types.ts";

export interface HarnessIntegrationsHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function listHarnessAdapters(client: HarnessIntegrationsHttpClient) {
  return client.request<HarnessAdapterViewModel[]>({
    method: "GET",
    url: "/api/v1/harness-integrations/adapters",
  });
}

export function listHarnessExecutionsByAdapterId(
  client: HarnessIntegrationsHttpClient,
  adapterId: string,
) {
  return client.request<HarnessExecutionViewModel[]>({
    method: "GET",
    url: `/api/v1/harness-integrations/adapters/${adapterId}/executions`,
  });
}
