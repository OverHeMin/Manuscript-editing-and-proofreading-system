import type { RunScreeningInput, ScreeningRunResultViewModel } from "./types.ts";

export interface ScreeningHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function runScreening(
  client: ScreeningHttpClient,
  input: RunScreeningInput,
) {
  return client.request<ScreeningRunResultViewModel>({
    method: "POST",
    url: "/api/v1/modules/screening/run",
    body: input,
  });
}
