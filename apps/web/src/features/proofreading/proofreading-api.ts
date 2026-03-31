import type {
  ConfirmProofreadingFinalInput,
  CreateProofreadingDraftInput,
  ProofreadingHumanFinalPublishResultViewModel,
  ProofreadingRunResultViewModel,
  PublishProofreadingHumanFinalInput,
} from "./types.ts";

export interface ProofreadingHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function createProofreadingDraft(
  client: ProofreadingHttpClient,
  input: CreateProofreadingDraftInput,
) {
  return client.request<ProofreadingRunResultViewModel>({
    method: "POST",
    url: "/api/v1/modules/proofreading/draft",
    body: input,
  });
}

export function confirmProofreadingFinal(
  client: ProofreadingHttpClient,
  input: ConfirmProofreadingFinalInput,
) {
  return client.request<ProofreadingRunResultViewModel>({
    method: "POST",
    url: "/api/v1/modules/proofreading/finalize",
    body: input,
  });
}

export function publishProofreadingHumanFinal(
  client: ProofreadingHttpClient,
  input: PublishProofreadingHumanFinalInput,
) {
  return client.request<ProofreadingHumanFinalPublishResultViewModel>({
    method: "POST",
    url: "/api/v1/modules/proofreading/publish-human-final",
    body: input,
  });
}
