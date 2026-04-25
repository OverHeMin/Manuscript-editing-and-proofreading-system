import type {
  EditingRunResultViewModel,
  RunEditingInput,
  SaveEditingSlotManualResolutionInput,
  SaveEditingSlotManualResolutionResultViewModel,
} from "./types.ts";

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

export function saveEditingSlotManualResolution(
  client: EditingHttpClient,
  input: SaveEditingSlotManualResolutionInput,
) {
  return client.request<SaveEditingSlotManualResolutionResultViewModel>({
    method: "POST",
    url: "/api/v1/modules/editing/slot-resolutions",
    body: input,
  });
}
