import type {
  HarnessAdapterRecord,
  HarnessExecutionAuditRecord,
  HarnessFeatureFlagChangeRecord,
  HarnessRedactionProfileRecord,
} from "./harness-integration-record.ts";

export interface HarnessIntegrationRepository {
  saveRedactionProfile(record: HarnessRedactionProfileRecord): Promise<void>;
  findRedactionProfileById(
    id: string,
  ): Promise<HarnessRedactionProfileRecord | undefined>;
  findRedactionProfileByName(
    name: string,
  ): Promise<HarnessRedactionProfileRecord | undefined>;
  listRedactionProfiles(): Promise<HarnessRedactionProfileRecord[]>;

  saveAdapter(record: HarnessAdapterRecord): Promise<void>;
  findAdapterById(id: string): Promise<HarnessAdapterRecord | undefined>;
  findAdapterByKind(
    kind: HarnessAdapterRecord["kind"],
  ): Promise<HarnessAdapterRecord | undefined>;
  listAdapters(): Promise<HarnessAdapterRecord[]>;

  saveFeatureFlagChange(record: HarnessFeatureFlagChangeRecord): Promise<void>;
  findLatestFeatureFlagChange(
    adapterId: string,
    flagKey: string,
  ): Promise<HarnessFeatureFlagChangeRecord | undefined>;
  listFeatureFlagChangesByAdapterId(
    adapterId: string,
  ): Promise<HarnessFeatureFlagChangeRecord[]>;

  saveExecutionAudit(record: HarnessExecutionAuditRecord): Promise<void>;
  findExecutionAuditById(
    id: string,
  ): Promise<HarnessExecutionAuditRecord | undefined>;
  listExecutionAuditsByAdapterId(
    adapterId: string,
  ): Promise<HarnessExecutionAuditRecord[]>;
}
