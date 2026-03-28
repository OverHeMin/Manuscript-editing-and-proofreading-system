import type { SandboxProfileRecord } from "./sandbox-profile-record.ts";
import type { SandboxProfileRepository } from "./sandbox-profile-repository.ts";

function cloneRecord(record: SandboxProfileRecord): SandboxProfileRecord {
  return {
    ...record,
    allowed_tool_ids: record.allowed_tool_ids
      ? [...record.allowed_tool_ids]
      : undefined,
  };
}

function compareRecords(
  left: SandboxProfileRecord,
  right: SandboxProfileRecord,
): number {
  if (left.name !== right.name) {
    return left.name.localeCompare(right.name);
  }

  return left.id.localeCompare(right.id);
}

export class InMemorySandboxProfileRepository
  implements SandboxProfileRepository
{
  private readonly records = new Map<string, SandboxProfileRecord>();

  async save(record: SandboxProfileRecord): Promise<void> {
    this.records.set(record.id, cloneRecord(record));
  }

  async findById(id: string): Promise<SandboxProfileRecord | undefined> {
    const record = this.records.get(id);
    return record ? cloneRecord(record) : undefined;
  }

  async list(): Promise<SandboxProfileRecord[]> {
    return [...this.records.values()].sort(compareRecords).map(cloneRecord);
  }
}
