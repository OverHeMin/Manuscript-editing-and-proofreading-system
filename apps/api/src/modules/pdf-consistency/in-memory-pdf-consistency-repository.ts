import type { PdfConsistencyIssueRecord } from "./pdf-consistency-record.ts";
import type { PdfConsistencyIssueRepository } from "./pdf-consistency-repository.ts";

function cloneIssueRecord(
  record: PdfConsistencyIssueRecord,
): PdfConsistencyIssueRecord {
  return {
    ...record,
    toc_heading: record.toc_heading ? { ...record.toc_heading } : undefined,
    body_heading: record.body_heading ? { ...record.body_heading } : undefined,
  };
}

export class InMemoryPdfConsistencyIssueRepository
  implements PdfConsistencyIssueRepository
{
  private readonly records = new Map<string, PdfConsistencyIssueRecord>();

  async saveMany(records: PdfConsistencyIssueRecord[]): Promise<void> {
    for (const record of records) {
      this.records.set(record.id, cloneIssueRecord(record));
    }
  }

  async listByReportAssetId(
    reportAssetId: string,
  ): Promise<PdfConsistencyIssueRecord[]> {
    return [...this.records.values()]
      .filter((record) => record.report_asset_id === reportAssetId)
      .sort((left, right) => left.sequence_no - right.sequence_no)
      .map(cloneIssueRecord);
  }

  async listByManuscriptId(
    manuscriptId: string,
  ): Promise<PdfConsistencyIssueRecord[]> {
    return [...this.records.values()]
      .filter((record) => record.manuscript_id === manuscriptId)
      .sort((left, right) => left.sequence_no - right.sequence_no)
      .map(cloneIssueRecord);
  }

  snapshotState(): Map<string, PdfConsistencyIssueRecord> {
    return new Map(
      [...this.records.entries()].map(([id, record]) => [
        id,
        cloneIssueRecord(record),
      ]),
    );
  }

  restoreState(snapshot: Map<string, PdfConsistencyIssueRecord>): void {
    this.records.clear();
    for (const [id, record] of snapshot.entries()) {
      this.records.set(id, cloneIssueRecord(record));
    }
  }
}
