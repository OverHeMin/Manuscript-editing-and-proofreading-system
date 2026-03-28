import type { AgentRuntimeRecord } from "./agent-runtime-record.ts";
import type { AgentRuntimeRepository } from "./agent-runtime-repository.ts";

function cloneRecord(record: AgentRuntimeRecord): AgentRuntimeRecord {
  return {
    ...record,
    allowed_modules: [...record.allowed_modules],
  };
}

function compareRecords(
  left: AgentRuntimeRecord,
  right: AgentRuntimeRecord,
): number {
  if (left.name !== right.name) {
    return left.name.localeCompare(right.name);
  }

  if (left.adapter !== right.adapter) {
    return left.adapter.localeCompare(right.adapter);
  }

  return left.id.localeCompare(right.id);
}

export class InMemoryAgentRuntimeRepository implements AgentRuntimeRepository {
  private readonly records = new Map<string, AgentRuntimeRecord>();

  async save(record: AgentRuntimeRecord): Promise<void> {
    this.records.set(record.id, cloneRecord(record));
  }

  async findById(id: string): Promise<AgentRuntimeRecord | undefined> {
    const record = this.records.get(id);
    return record ? cloneRecord(record) : undefined;
  }

  async list(): Promise<AgentRuntimeRecord[]> {
    return [...this.records.values()].sort(compareRecords).map(cloneRecord);
  }

  async listByModule(
    module: AgentRuntimeRecord["allowed_modules"][number],
    activeOnly = false,
  ): Promise<AgentRuntimeRecord[]> {
    return [...this.records.values()]
      .filter((record) => record.allowed_modules.includes(module))
      .filter((record) => !activeOnly || record.status === "active")
      .sort(compareRecords)
      .map(cloneRecord);
  }
}
