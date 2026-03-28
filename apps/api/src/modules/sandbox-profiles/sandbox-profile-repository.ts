import type { SandboxProfileRecord } from "./sandbox-profile-record.ts";

export interface SandboxProfileRepository {
  save(record: SandboxProfileRecord): Promise<void>;
  findById(id: string): Promise<SandboxProfileRecord | undefined>;
  list(): Promise<SandboxProfileRecord[]>;
}
