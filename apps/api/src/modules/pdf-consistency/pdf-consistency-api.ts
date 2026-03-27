import { PdfConsistencyService } from "./pdf-consistency-service.ts";
import type {
  CreatePdfConsistencyReportInput,
  PdfConsistencyReportResult,
} from "./pdf-consistency-service.ts";
import type { PdfConsistencyIssueContent } from "./pdf-consistency-record.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreatePdfConsistencyApiOptions {
  pdfConsistencyService: PdfConsistencyService;
}

export function createPdfConsistencyApi(
  options: CreatePdfConsistencyApiOptions,
) {
  const { pdfConsistencyService } = options;

  return {
    async createReport(
      input: CreatePdfConsistencyReportInput,
    ): Promise<RouteResponse<PdfConsistencyReportResult>> {
      return {
        status: 201,
        body: await pdfConsistencyService.createReport(input),
      };
    },

    async listIssues({
      manuscriptId,
    }: {
      manuscriptId: string;
    }): Promise<RouteResponse<PdfConsistencyIssueContent[]>> {
      return {
        status: 200,
        body: await pdfConsistencyService.listCurrentIssues(manuscriptId),
      };
    },
  };
}
