import type {
  AiProviderConnectionRecord,
  AiProviderConnectionTestStatus,
  AiProviderCredentialRecord,
} from "./ai-provider-connection-record.ts";

export interface AiProviderConnectionRepository {
  save(record: AiProviderConnectionRecord): Promise<void>;
  findById(id: string): Promise<AiProviderConnectionRecord | undefined>;
  list(): Promise<AiProviderConnectionRecord[]>;
  saveCredential(record: AiProviderCredentialRecord): Promise<AiProviderCredentialRecord>;
  findCredentialByConnectionId(
    connectionId: string,
  ): Promise<AiProviderCredentialRecord | undefined>;
  updateConnectionTestStatus(input: {
    connection_id: string;
    status: AiProviderConnectionTestStatus;
    error_summary?: string;
    tested_at: Date;
  }): Promise<void>;
}
