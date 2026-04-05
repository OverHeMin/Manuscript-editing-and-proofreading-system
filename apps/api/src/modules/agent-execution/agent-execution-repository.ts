import type { AgentExecutionLogRecord } from "./agent-execution-record.ts";

export interface SaveIfOrchestrationStateMatchesInput {
  record: AgentExecutionLogRecord;
  expected: {
    orchestration_status: AgentExecutionLogRecord["orchestration_status"];
    orchestration_attempt_count: number;
    orchestration_last_attempt_started_at?: string;
    orchestration_next_retry_at?: string;
    orchestration_attempt_claim_token?: string;
  };
}

export interface AgentExecutionRepository {
  save(record: AgentExecutionLogRecord): Promise<void>;
  saveIfOrchestrationStateMatches(
    input: SaveIfOrchestrationStateMatchesInput,
  ): Promise<AgentExecutionLogRecord | undefined>;
  findById(id: string): Promise<AgentExecutionLogRecord | undefined>;
  list(): Promise<AgentExecutionLogRecord[]>;
}
