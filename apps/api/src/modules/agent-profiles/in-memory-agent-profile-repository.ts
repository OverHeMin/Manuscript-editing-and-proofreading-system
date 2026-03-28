import type { AgentProfileRecord } from "./agent-profile-record.ts";
import type { AgentProfileRepository } from "./agent-profile-repository.ts";

function cloneRecord(record: AgentProfileRecord): AgentProfileRecord {
  return {
    ...record,
    module_scope:
      record.module_scope === "any" ? "any" : [...record.module_scope],
    manuscript_types:
      record.manuscript_types === "any"
        ? "any"
        : [...record.manuscript_types],
  };
}

function compareRecords(left: AgentProfileRecord, right: AgentProfileRecord): number {
  if (left.role_key !== right.role_key) {
    return left.role_key.localeCompare(right.role_key);
  }

  if (left.name !== right.name) {
    return left.name.localeCompare(right.name);
  }

  return left.id.localeCompare(right.id);
}

export class InMemoryAgentProfileRepository implements AgentProfileRepository {
  private readonly records = new Map<string, AgentProfileRecord>();

  async save(record: AgentProfileRecord): Promise<void> {
    this.records.set(record.id, cloneRecord(record));
  }

  async findById(id: string): Promise<AgentProfileRecord | undefined> {
    const record = this.records.get(id);
    return record ? cloneRecord(record) : undefined;
  }

  async list(): Promise<AgentProfileRecord[]> {
    return [...this.records.values()].sort(compareRecords).map(cloneRecord);
  }
}
