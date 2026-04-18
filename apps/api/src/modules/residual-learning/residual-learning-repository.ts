import type { ResidualIssueRecord } from "./residual-learning-record.ts";

export interface ResidualIssueRepository {
  save(record: ResidualIssueRecord): Promise<void>;
  findById(id: string): Promise<ResidualIssueRecord | undefined>;
  list(): Promise<ResidualIssueRecord[]>;
  listByStatus(
    status: ResidualIssueRecord["status"],
  ): Promise<ResidualIssueRecord[]>;
  listByHarnessValidationStatus(
    status: ResidualIssueRecord["harness_validation_status"],
  ): Promise<ResidualIssueRecord[]>;
  listByExecutionSnapshotId(
    executionSnapshotId: string,
  ): Promise<ResidualIssueRecord[]>;
}
