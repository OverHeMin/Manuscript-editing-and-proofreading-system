import type { ToolPermissionPolicyRecord } from "./tool-permission-policy-record.ts";
import type { ToolPermissionPolicyRepository } from "./tool-permission-policy-repository.ts";

function cloneRecord(
  record: ToolPermissionPolicyRecord,
): ToolPermissionPolicyRecord {
  return {
    ...record,
    allowed_tool_ids: [...record.allowed_tool_ids],
    high_risk_tool_ids: record.high_risk_tool_ids
      ? [...record.high_risk_tool_ids]
      : undefined,
  };
}

function compareRecords(
  left: ToolPermissionPolicyRecord,
  right: ToolPermissionPolicyRecord,
): number {
  if (left.name !== right.name) {
    return left.name.localeCompare(right.name);
  }

  return left.id.localeCompare(right.id);
}

export class InMemoryToolPermissionPolicyRepository
  implements ToolPermissionPolicyRepository
{
  private readonly records = new Map<string, ToolPermissionPolicyRecord>();

  async save(record: ToolPermissionPolicyRecord): Promise<void> {
    this.records.set(record.id, cloneRecord(record));
  }

  async findById(id: string): Promise<ToolPermissionPolicyRecord | undefined> {
    const record = this.records.get(id);
    return record ? cloneRecord(record) : undefined;
  }

  async list(): Promise<ToolPermissionPolicyRecord[]> {
    return [...this.records.values()].sort(compareRecords).map(cloneRecord);
  }
}
