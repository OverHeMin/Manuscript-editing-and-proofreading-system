import type { EditingRunResultViewModel, RunEditingInput } from "./types.ts";

export interface EditingHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function runEditing(client: EditingHttpClient, input: RunEditingInput) {
  return client.request<EditingRunResultViewModel>({
    method: "POST",
    url: "/api/v1/modules/editing/run",
    body: input,
  });
}
