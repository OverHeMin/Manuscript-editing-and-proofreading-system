import type {
  AiProviderConnectionRecord,
  AiProviderCredentialRecord,
} from "./ai-provider-connection-record.ts";
import type { AiProviderConnectionRepository } from "./ai-provider-connection-repository.ts";

function cloneConnectionRecord(
  record: AiProviderConnectionRecord,
): AiProviderConnectionRecord {
  return {
    ...record,
    connection_metadata: record.connection_metadata
      ? structuredClone(record.connection_metadata)
      : undefined,
    last_test_at: record.last_test_at
      ? new Date(record.last_test_at)
      : undefined,
    credential_summary: record.credential_summary
      ? { ...record.credential_summary }
      : undefined,
  };
}

function cloneCredentialRecord(
  record: AiProviderCredentialRecord,
): AiProviderCredentialRecord {
  return {
    ...record,
    last_rotated_at: new Date(record.last_rotated_at),
  };
}

function compareConnections(
  left: AiProviderConnectionRecord,
  right: AiProviderConnectionRecord,
): number {
  if (left.provider_kind !== right.provider_kind) {
    return left.provider_kind.localeCompare(right.provider_kind);
  }

  if (left.name !== right.name) {
    return left.name.localeCompare(right.name);
  }

  return left.id.localeCompare(right.id);
}

export class InMemoryAiProviderConnectionRepository
  implements AiProviderConnectionRepository
{
  private readonly connections = new Map<string, AiProviderConnectionRecord>();

  private readonly credentialsByConnectionId = new Map<
    string,
    AiProviderCredentialRecord
  >();

  async save(record: AiProviderConnectionRecord): Promise<void> {
    const existing = this.connections.get(record.id);
    this.connections.set(record.id, {
      ...cloneConnectionRecord(record),
      connection_metadata: record.connection_metadata
        ? structuredClone(record.connection_metadata)
        : {},
      last_test_status: record.last_test_status ?? existing?.last_test_status ?? "unknown",
      credential_summary:
        record.credential_summary
          ? { ...record.credential_summary }
          :
        existing?.credential_summary ??
        this.toCredentialSummary(this.credentialsByConnectionId.get(record.id)),
    });
  }

  async findById(id: string): Promise<AiProviderConnectionRecord | undefined> {
    const record = this.connections.get(id);
    if (!record) {
      return undefined;
    }

    return cloneConnectionRecord({
      ...record,
      credential_summary:
        record.credential_summary ??
        this.toCredentialSummary(this.credentialsByConnectionId.get(id)),
    });
  }

  async list(): Promise<AiProviderConnectionRecord[]> {
    return [...this.connections.values()]
      .map((record) =>
        cloneConnectionRecord({
          ...record,
          credential_summary:
            record.credential_summary ??
            this.toCredentialSummary(this.credentialsByConnectionId.get(record.id)),
        }),
      )
      .sort(compareConnections);
  }

  async saveCredential(
    record: AiProviderCredentialRecord,
  ): Promise<AiProviderCredentialRecord> {
    if (!this.connections.has(record.connection_id)) {
      throw new Error(
        `Cannot persist credentials for unknown ai provider connection ${record.connection_id}.`,
      );
    }

    const existing = this.credentialsByConnectionId.get(record.connection_id);
    const nextVersion = existing
      ? Math.max(
          record.credential_version ?? existing.credential_version ?? 0,
          (existing.credential_version ?? 0) + 1,
        )
      : (record.credential_version ?? 1);
    const persisted = cloneCredentialRecord({
      ...record,
      credential_version: nextVersion,
    });
    const previous = existing;

    this.credentialsByConnectionId.set(record.connection_id, persisted);

    if (previous && previous.id !== persisted.id) {
      // No secondary id index is kept, so nothing else needs cleanup today.
    }

    const connection = this.connections.get(record.connection_id);
    if (connection) {
      this.connections.set(record.connection_id, {
        ...connection,
        credential_summary: this.toCredentialSummary(persisted),
      });
    }

    return cloneCredentialRecord(persisted);
  }

  async findCredentialByConnectionId(
    connectionId: string,
  ): Promise<AiProviderCredentialRecord | undefined> {
    const record = this.credentialsByConnectionId.get(connectionId);
    return record ? cloneCredentialRecord(record) : undefined;
  }

  async updateConnectionTestStatus(input: {
    connection_id: string;
    status: AiProviderConnectionRecord["last_test_status"];
    error_summary?: string;
    tested_at: Date;
  }): Promise<void> {
    const existing = this.connections.get(input.connection_id);
    if (!existing) {
      throw new Error(
        `Cannot update test status for unknown ai provider connection ${input.connection_id}.`,
      );
    }

    this.connections.set(input.connection_id, {
      ...existing,
      last_test_status: input.status ?? "unknown",
      last_test_at: new Date(input.tested_at),
      last_error_summary: input.error_summary,
    });
  }

  private toCredentialSummary(
    credential: AiProviderCredentialRecord | undefined,
  ): AiProviderConnectionRecord["credential_summary"] {
    if (!credential) {
      return undefined;
    }

    return {
      mask: credential.credential_mask,
      version: credential.credential_version ?? 1,
    };
  }
}
