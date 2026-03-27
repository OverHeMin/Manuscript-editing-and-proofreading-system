import type { PdfConsistencyIssueViewModel } from "./types.ts";

export interface PdfConsistencyHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function listPdfConsistencyIssues(
  client: PdfConsistencyHttpClient,
  manuscriptId: string,
) {
  return client.request<PdfConsistencyIssueViewModel[]>({
    method: "GET",
    url: `/api/v1/pdf-consistency/${manuscriptId}/issues`,
  });
}
