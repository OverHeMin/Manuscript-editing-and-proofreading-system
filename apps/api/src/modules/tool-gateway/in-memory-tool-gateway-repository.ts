import type { ToolGatewayToolRecord } from "./tool-gateway-record.ts";
import type { ToolGatewayRepository } from "./tool-gateway-repository.ts";

function cloneRecord(record: ToolGatewayToolRecord): ToolGatewayToolRecord {
  return { ...record };
}

function compareRecords(
  left: ToolGatewayToolRecord,
  right: ToolGatewayToolRecord,
): number {
  if (left.scope !== right.scope) {
    return left.scope.localeCompare(right.scope);
  }

  if (left.name !== right.name) {
    return left.name.localeCompare(right.name);
  }

  return left.id.localeCompare(right.id);
}

export class InMemoryToolGatewayRepository implements ToolGatewayRepository {
  private readonly records = new Map<string, ToolGatewayToolRecord>();

  async save(record: ToolGatewayToolRecord): Promise<void> {
    this.records.set(record.id, cloneRecord(record));
  }

  async findById(id: string): Promise<ToolGatewayToolRecord | undefined> {
    const record = this.records.get(id);
    return record ? cloneRecord(record) : undefined;
  }

  async list(): Promise<ToolGatewayToolRecord[]> {
    return [...this.records.values()].sort(compareRecords).map(cloneRecord);
  }
}
