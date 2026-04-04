import type { SnapshotCapableRepository } from "../shared/write-transaction-manager.ts";
import type {
  HarnessAdapterRecord,
  HarnessExecutionAuditRecord,
  HarnessFeatureFlagChangeRecord,
  HarnessRedactionProfileRecord,
} from "./harness-integration-record.ts";
import type { HarnessIntegrationRepository } from "./harness-integration-repository.ts";

function cloneJson(
  value: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function cloneRedactionProfile(
  record: HarnessRedactionProfileRecord,
): HarnessRedactionProfileRecord {
  return {
    ...record,
    structured_fields: [...record.structured_fields],
  };
}

function cloneAdapter(record: HarnessAdapterRecord): HarnessAdapterRecord {
  return {
    ...record,
    feature_flag_keys: [...record.feature_flag_keys],
    config: cloneJson(record.config),
  };
}

function cloneFeatureFlagChange(
  record: HarnessFeatureFlagChangeRecord,
): HarnessFeatureFlagChangeRecord {
  return {
    ...record,
  };
}

function cloneExecutionAudit(
  record: HarnessExecutionAuditRecord,
): HarnessExecutionAuditRecord {
  return {
    ...record,
    result_summary: cloneJson(record.result_summary),
  };
}

function compareByCreatedAtAsc<T extends { id: string; created_at: string }>(
  left: T,
  right: T,
): number {
  return (
    left.created_at.localeCompare(right.created_at) ||
    left.id.localeCompare(right.id)
  );
}

function compareByUpdatedAtAsc<T extends { id: string; updated_at: string }>(
  left: T,
  right: T,
): number {
  return (
    left.updated_at.localeCompare(right.updated_at) ||
    left.id.localeCompare(right.id)
  );
}

export class InMemoryHarnessIntegrationRepository
  implements
    HarnessIntegrationRepository,
    SnapshotCapableRepository<{
      redactionProfiles: Map<string, HarnessRedactionProfileRecord>;
      adapters: Map<string, HarnessAdapterRecord>;
      featureFlagChanges: Map<string, HarnessFeatureFlagChangeRecord>;
      executionAudits: Map<string, HarnessExecutionAuditRecord>;
    }>
{
  private readonly redactionProfiles = new Map<
    string,
    HarnessRedactionProfileRecord
  >();
  private readonly adapters = new Map<string, HarnessAdapterRecord>();
  private readonly featureFlagChanges = new Map<
    string,
    HarnessFeatureFlagChangeRecord
  >();
  private readonly executionAudits = new Map<string, HarnessExecutionAuditRecord>();

  async saveRedactionProfile(
    record: HarnessRedactionProfileRecord,
  ): Promise<void> {
    this.redactionProfiles.set(record.id, cloneRedactionProfile(record));
  }

  async findRedactionProfileById(
    id: string,
  ): Promise<HarnessRedactionProfileRecord | undefined> {
    const record = this.redactionProfiles.get(id);
    return record ? cloneRedactionProfile(record) : undefined;
  }

  async findRedactionProfileByName(
    name: string,
  ): Promise<HarnessRedactionProfileRecord | undefined> {
    const record = [...this.redactionProfiles.values()].find(
      (candidate) => candidate.name === name,
    );
    return record ? cloneRedactionProfile(record) : undefined;
  }

  async listRedactionProfiles(): Promise<HarnessRedactionProfileRecord[]> {
    return [...this.redactionProfiles.values()]
      .sort(compareByUpdatedAtAsc)
      .map(cloneRedactionProfile);
  }

  async saveAdapter(record: HarnessAdapterRecord): Promise<void> {
    this.adapters.set(record.id, cloneAdapter(record));
  }

  async findAdapterById(id: string): Promise<HarnessAdapterRecord | undefined> {
    const record = this.adapters.get(id);
    return record ? cloneAdapter(record) : undefined;
  }

  async findAdapterByKind(
    kind: HarnessAdapterRecord["kind"],
  ): Promise<HarnessAdapterRecord | undefined> {
    const record = [...this.adapters.values()].find(
      (candidate) => candidate.kind === kind,
    );
    return record ? cloneAdapter(record) : undefined;
  }

  async listAdapters(): Promise<HarnessAdapterRecord[]> {
    return [...this.adapters.values()]
      .sort(compareByUpdatedAtAsc)
      .map(cloneAdapter);
  }

  async saveFeatureFlagChange(
    record: HarnessFeatureFlagChangeRecord,
  ): Promise<void> {
    this.featureFlagChanges.set(record.id, cloneFeatureFlagChange(record));
  }

  async findLatestFeatureFlagChange(
    adapterId: string,
    flagKey: string,
  ): Promise<HarnessFeatureFlagChangeRecord | undefined> {
    const record = [...this.featureFlagChanges.values()]
      .filter(
        (candidate) =>
          candidate.adapter_id === adapterId && candidate.flag_key === flagKey,
      )
      .sort(compareByCreatedAtAsc)
      .at(-1);

    return record ? cloneFeatureFlagChange(record) : undefined;
  }

  async listFeatureFlagChangesByAdapterId(
    adapterId: string,
  ): Promise<HarnessFeatureFlagChangeRecord[]> {
    return [...this.featureFlagChanges.values()]
      .filter((candidate) => candidate.adapter_id === adapterId)
      .sort(compareByCreatedAtAsc)
      .map(cloneFeatureFlagChange);
  }

  async saveExecutionAudit(record: HarnessExecutionAuditRecord): Promise<void> {
    this.executionAudits.set(record.id, cloneExecutionAudit(record));
  }

  async findExecutionAuditById(
    id: string,
  ): Promise<HarnessExecutionAuditRecord | undefined> {
    const record = this.executionAudits.get(id);
    return record ? cloneExecutionAudit(record) : undefined;
  }

  async listExecutionAuditsByAdapterId(
    adapterId: string,
  ): Promise<HarnessExecutionAuditRecord[]> {
    return [...this.executionAudits.values()]
      .filter((candidate) => candidate.adapter_id === adapterId)
      .sort(compareByCreatedAtAsc)
      .map(cloneExecutionAudit);
  }

  snapshotState(): {
    redactionProfiles: Map<string, HarnessRedactionProfileRecord>;
    adapters: Map<string, HarnessAdapterRecord>;
    featureFlagChanges: Map<string, HarnessFeatureFlagChangeRecord>;
    executionAudits: Map<string, HarnessExecutionAuditRecord>;
  } {
    return {
      redactionProfiles: new Map(
        [...this.redactionProfiles.entries()].map(([id, record]) => [
          id,
          cloneRedactionProfile(record),
        ]),
      ),
      adapters: new Map(
        [...this.adapters.entries()].map(([id, record]) => [
          id,
          cloneAdapter(record),
        ]),
      ),
      featureFlagChanges: new Map(
        [...this.featureFlagChanges.entries()].map(([id, record]) => [
          id,
          cloneFeatureFlagChange(record),
        ]),
      ),
      executionAudits: new Map(
        [...this.executionAudits.entries()].map(([id, record]) => [
          id,
          cloneExecutionAudit(record),
        ]),
      ),
    };
  }

  restoreState(snapshot: {
    redactionProfiles: Map<string, HarnessRedactionProfileRecord>;
    adapters: Map<string, HarnessAdapterRecord>;
    featureFlagChanges: Map<string, HarnessFeatureFlagChangeRecord>;
    executionAudits: Map<string, HarnessExecutionAuditRecord>;
  }): void {
    this.redactionProfiles.clear();
    for (const [id, record] of snapshot.redactionProfiles.entries()) {
      this.redactionProfiles.set(id, cloneRedactionProfile(record));
    }

    this.adapters.clear();
    for (const [id, record] of snapshot.adapters.entries()) {
      this.adapters.set(id, cloneAdapter(record));
    }

    this.featureFlagChanges.clear();
    for (const [id, record] of snapshot.featureFlagChanges.entries()) {
      this.featureFlagChanges.set(id, cloneFeatureFlagChange(record));
    }

    this.executionAudits.clear();
    for (const [id, record] of snapshot.executionAudits.entries()) {
      this.executionAudits.set(id, cloneExecutionAudit(record));
    }
  }
}
