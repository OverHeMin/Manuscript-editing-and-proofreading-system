import type { AuditRecord, AuditRecordInput } from "./audit-record.ts";

export interface AuditService {
  record(entry: AuditRecordInput): Promise<void>;
}

export class InMemoryAuditService implements AuditService {
  private readonly records: AuditRecord[] = [];

  async record(entry: AuditRecordInput): Promise<void> {
    this.records.push({
      ...entry,
      metadata: entry.metadata ? { ...entry.metadata } : undefined,
    });
  }

  list(): AuditRecord[] {
    return this.records.map((record) => ({
      ...record,
      metadata: record.metadata ? { ...record.metadata } : undefined,
    }));
  }
}
