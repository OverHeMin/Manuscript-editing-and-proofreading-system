import type { AgentRuntimeRecord } from "./agent-runtime-record.ts";

export interface AgentRuntimeRepository {
  save(record: AgentRuntimeRecord): Promise<void>;
  findById(id: string): Promise<AgentRuntimeRecord | undefined>;
  list(): Promise<AgentRuntimeRecord[]>;
  listByModule(
    module: AgentRuntimeRecord["allowed_modules"][number],
    activeOnly?: boolean,
  ): Promise<AgentRuntimeRecord[]>;
}
