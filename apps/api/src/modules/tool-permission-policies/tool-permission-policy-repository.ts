import type { ToolPermissionPolicyRecord } from "./tool-permission-policy-record.ts";

export interface ToolPermissionPolicyRepository {
  save(record: ToolPermissionPolicyRecord): Promise<void>;
  findById(id: string): Promise<ToolPermissionPolicyRecord | undefined>;
  list(): Promise<ToolPermissionPolicyRecord[]>;
}
