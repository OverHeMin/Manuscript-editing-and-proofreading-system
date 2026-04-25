import type {
  ConfirmProofreadingFinalInput,
  CreateProofreadingDraftInput,
  ProofreadingConfirmationDraftSaveResultViewModel,
  ProofreadingHumanFinalPublishResultViewModel,
  ProofreadingRunResultViewModel,
  PublishProofreadingHumanFinalInput,
  SaveProofreadingConfirmationDraftInput,
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

export function saveProofreadingConfirmationDraft(
  client: ProofreadingHttpClient,
  input: SaveProofreadingConfirmationDraftInput,
) {
  return client.request<ProofreadingConfirmationDraftSaveResultViewModel>({
    method: "POST",
    url: "/api/v1/modules/proofreading/confirmation-draft",
    body: input,
  });
}
