import type { AgentRuntimeRecord } from "./agent-runtime-record.ts";

export interface AgentRuntimeRepository {
  save(record: AgentRuntimeRecord): Promise<void>;
  findById(id: string): Promise<AgentRuntimeRecord | undefined>;
  list(): Promise<AgentRuntimeRecord[]>;
}
