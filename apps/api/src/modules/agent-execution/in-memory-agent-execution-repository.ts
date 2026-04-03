import type { SnapshotCapableRepository } from "../shared/write-transaction-manager.ts";
import type { AgentExecutionLogRecord } from "./agent-execution-record.ts";
import type { AgentExecutionRepository } from "./agent-execution-repository.ts";

function cloneRecord(record: AgentExecutionLogRecord): AgentExecutionLogRecord {
  return {
    ...record,
    knowledge_item_ids: [...record.knowledge_item_ids],
    verification_check_profile_ids: [...record.verification_check_profile_ids],
    evaluation_suite_ids: [...record.evaluation_suite_ids],
    verification_evidence_ids: [...record.verification_evidence_ids],
  };
}

function compareRecords(
  left: AgentExecutionLogRecord,
  right: AgentExecutionLogRecord,
): number {
  if (left.started_at !== right.started_at) {
    return left.started_at.localeCompare(right.started_at);
  }

  return left.id.localeCompare(right.id);
}

export class InMemoryAgentExecutionRepository
  implements
    AgentExecutionRepository,
    SnapshotCapableRepository<Map<string, AgentExecutionLogRecord>>
{
  private readonly records = new Map<string, AgentExecutionLogRecord>();

  async save(record: AgentExecutionLogRecord): Promise<void> {
    this.records.set(record.id, cloneRecord(record));
  }

  async findById(id: string): Promise<AgentExecutionLogRecord | undefined> {
    const record = this.records.get(id);
    return record ? cloneRecord(record) : undefined;
  }

  async list(): Promise<AgentExecutionLogRecord[]> {
    return [...this.records.values()].sort(compareRecords).map(cloneRecord);
  }

  snapshotState(): Map<string, AgentExecutionLogRecord> {
    return new Map(
      [...this.records.entries()].map(([id, record]) => [id, cloneRecord(record)]),
    );
  }

  restoreState(snapshot: Map<string, AgentExecutionLogRecord>): void {
    this.records.clear();

    for (const [id, record] of snapshot.entries()) {
      this.records.set(id, cloneRecord(record));
    }
  }
}
