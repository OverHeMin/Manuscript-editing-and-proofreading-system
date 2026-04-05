import type { SnapshotCapableRepository } from "../shared/write-transaction-manager.ts";
import type { AgentExecutionLogRecord } from "./agent-execution-record.ts";
import type {
  AgentExecutionRepository,
  SaveIfOrchestrationStateMatchesInput,
} from "./agent-execution-repository.ts";

function cloneRecord(record: AgentExecutionLogRecord): AgentExecutionLogRecord {
  return {
    ...record,
    knowledge_item_ids: [...record.knowledge_item_ids],
    verification_check_profile_ids: [...record.verification_check_profile_ids],
    evaluation_suite_ids: [...record.evaluation_suite_ids],
    verification_evidence_ids: [...record.verification_evidence_ids],
    orchestration_last_error: record.orchestration_last_error,
    orchestration_last_attempt_started_at:
      record.orchestration_last_attempt_started_at,
    orchestration_last_attempt_finished_at:
      record.orchestration_last_attempt_finished_at,
    orchestration_attempt_claim_token: record.orchestration_attempt_claim_token,
    orchestration_next_retry_at: record.orchestration_next_retry_at,
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

  async saveIfOrchestrationStateMatches(
    input: SaveIfOrchestrationStateMatchesInput,
  ): Promise<AgentExecutionLogRecord | undefined> {
    const existing = this.records.get(input.record.id);
    if (!existing) {
      return undefined;
    }

    if (
      existing.orchestration_status !== input.expected.orchestration_status ||
      existing.orchestration_attempt_count !==
        input.expected.orchestration_attempt_count ||
      existing.orchestration_last_attempt_started_at !==
        input.expected.orchestration_last_attempt_started_at ||
      existing.orchestration_next_retry_at !==
        input.expected.orchestration_next_retry_at ||
      existing.orchestration_attempt_claim_token !==
        input.expected.orchestration_attempt_claim_token
    ) {
      return undefined;
    }

    const cloned = cloneRecord(input.record);
    this.records.set(input.record.id, cloned);
    return cloneRecord(cloned);
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
