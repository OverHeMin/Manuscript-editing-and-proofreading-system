import type { AgentProfileRecord } from "./agent-profile-record.ts";

export interface AgentProfileRepository {
  save(record: AgentProfileRecord): Promise<void>;
  findById(id: string): Promise<AgentProfileRecord | undefined>;
  list(): Promise<AgentProfileRecord[]>;
}
