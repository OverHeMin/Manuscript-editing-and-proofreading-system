import type { PdfConsistencyIssueRecord } from "./pdf-consistency-record.ts";

export interface PdfConsistencyIssueRepository {
  saveMany(records: PdfConsistencyIssueRecord[]): Promise<void>;
  listByReportAssetId(reportAssetId: string): Promise<PdfConsistencyIssueRecord[]>;
  listByManuscriptId(manuscriptId: string): Promise<PdfConsistencyIssueRecord[]>;
}
