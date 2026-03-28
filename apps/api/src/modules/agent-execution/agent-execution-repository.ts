import type { AgentExecutionLogRecord } from "./agent-execution-record.ts";

export interface AgentExecutionRepository {
  save(record: AgentExecutionLogRecord): Promise<void>;
  findById(id: string): Promise<AgentExecutionLogRecord | undefined>;
  list(): Promise<AgentExecutionLogRecord[]>;
}
