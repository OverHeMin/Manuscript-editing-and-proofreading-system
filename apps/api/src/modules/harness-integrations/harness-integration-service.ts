import { randomUUID } from "node:crypto";
import {
  createDirectWriteTransactionManager,
  createScopedWriteTransactionManager,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import { InMemoryHarnessIntegrationRepository } from "./in-memory-harness-integration-repository.ts";
import type {
  HarnessAdapterRecord,
  HarnessExecutionAuditRecord,
  HarnessFeatureFlagChangeRecord,
  HarnessRedactionProfileRecord,
} from "./harness-integration-record.ts";
import type { HarnessIntegrationRepository } from "./harness-integration-repository.ts";

export interface UpsertHarnessRedactionProfileInput {
  name: string;
  redactionMode: HarnessRedactionProfileRecord["redaction_mode"];
  structuredFields: string[];
  allowRawPayloadExport: boolean;
}

export interface RegisterHarnessAdapterInput {
  kind: HarnessAdapterRecord["kind"];
  displayName: string;
  executionMode: HarnessAdapterRecord["execution_mode"];
  failOpen?: boolean;
  redactionProfileId: string;
  featureFlagKeys: string[];
  resultEnvelopeVersion: string;
  config?: Record<string, unknown>;
}

export interface RecordHarnessFeatureFlagChangeInput {
  adapterId: string;
  flagKey: string;
  enabled: boolean;
  changedBy: string;
  changeReason?: string;
}

export interface RecordHarnessExecutionAuditInput {
  adapterId: string;
  triggerKind: HarnessExecutionAuditRecord["trigger_kind"];
  inputReference: string;
  datasetId?: string;
  artifactUri?: string;
  status: HarnessExecutionAuditRecord["status"];
  degradationReason?: string;
  resultSummary?: Record<string, unknown>;
}

interface HarnessIntegrationWriteContext {
  repository: HarnessIntegrationRepository;
}

export interface HarnessIntegrationServiceOptions {
  repository: HarnessIntegrationRepository;
  transactionManager?: WriteTransactionManager<HarnessIntegrationWriteContext>;
  createId?: () => string;
  now?: () => Date;
}

export class HarnessIntegrationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HarnessIntegrationValidationError";
  }
}

export class HarnessIntegrationService {
  private readonly repository: HarnessIntegrationRepository;
  private readonly transactionManager: WriteTransactionManager<HarnessIntegrationWriteContext>;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: HarnessIntegrationServiceOptions) {
    this.repository = options.repository;
    this.transactionManager =
      options.transactionManager ??
      createHarnessIntegrationTransactionManager({
        repository: this.repository,
      });
    this.createId = options.createId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  async upsertRedactionProfile(
    input: UpsertHarnessRedactionProfileInput,
  ): Promise<HarnessRedactionProfileRecord> {
    const name = input.name.trim();
    if (!name) {
      throw new HarnessIntegrationValidationError(
        "Harness redaction profiles require a name.",
      );
    }

    const nowIso = this.now().toISOString();

    return this.transactionManager.withTransaction(async ({ repository }) => {
      const existing = await repository.findRedactionProfileByName(name);
      const record: HarnessRedactionProfileRecord = {
        id: existing?.id ?? this.createId(),
        name,
        redaction_mode: input.redactionMode,
        structured_fields: normalizeStringArray(input.structuredFields),
        allow_raw_payload_export: input.allowRawPayloadExport,
        created_at: existing?.created_at ?? nowIso,
        updated_at: nowIso,
      };

      await repository.saveRedactionProfile(record);
      return cloneRedactionProfile(record);
    });
  }

  async registerAdapter(
    input: RegisterHarnessAdapterInput,
  ): Promise<HarnessAdapterRecord> {
    const displayName = input.displayName.trim();
    if (!displayName) {
      throw new HarnessIntegrationValidationError(
        "Harness adapters require a display name.",
      );
    }

    const resultEnvelopeVersion = input.resultEnvelopeVersion.trim();
    if (!resultEnvelopeVersion) {
      throw new HarnessIntegrationValidationError(
        "Harness adapters require a result envelope version.",
      );
    }

    const featureFlagKeys = normalizeStringArray(input.featureFlagKeys);
    if (featureFlagKeys.length === 0) {
      throw new HarnessIntegrationValidationError(
        "Harness adapters require at least one governance feature flag.",
      );
    }

    const nowIso = this.now().toISOString();

    return this.transactionManager.withTransaction(async ({ repository }) => {
      const redactionProfile = await repository.findRedactionProfileById(
        input.redactionProfileId,
      );
      if (!redactionProfile) {
        throw new HarnessIntegrationValidationError(
          `Harness adapters require an existing redaction profile. Missing profile: ${input.redactionProfileId}`,
        );
      }

      const existing = await repository.findAdapterByKind(input.kind);
      const record: HarnessAdapterRecord = {
        id: existing?.id ?? this.createId(),
        kind: input.kind,
        display_name: displayName,
        execution_mode: input.executionMode,
        fail_open: input.failOpen ?? true,
        redaction_profile_id: redactionProfile.id,
        feature_flag_keys: featureFlagKeys,
        result_envelope_version: resultEnvelopeVersion,
        config: cloneJson(input.config),
        created_at: existing?.created_at ?? nowIso,
        updated_at: nowIso,
      };

      await repository.saveAdapter(record);
      return cloneAdapter(record);
    });
  }

  async recordFeatureFlagChange(
    input: RecordHarnessFeatureFlagChangeInput,
  ): Promise<HarnessFeatureFlagChangeRecord> {
    const flagKey = input.flagKey.trim();
    if (!flagKey) {
      throw new HarnessIntegrationValidationError(
        "Harness feature flag changes require a flag key.",
      );
    }

    const changedBy = input.changedBy.trim();
    if (!changedBy) {
      throw new HarnessIntegrationValidationError(
        "Harness feature flag changes require a changedBy value.",
      );
    }

    return this.transactionManager.withTransaction(async ({ repository }) => {
      const adapter = await repository.findAdapterById(input.adapterId);
      if (!adapter) {
        throw new HarnessIntegrationValidationError(
          `Cannot change a harness feature flag for a missing adapter: ${input.adapterId}`,
        );
      }

      if (!adapter.feature_flag_keys.includes(flagKey)) {
        throw new HarnessIntegrationValidationError(
          `Harness adapter ${adapter.kind} does not declare governance flag ${flagKey}.`,
        );
      }

      const record: HarnessFeatureFlagChangeRecord = {
        id: this.createId(),
        adapter_id: adapter.id,
        flag_key: flagKey,
        enabled: input.enabled,
        changed_by: changedBy,
        ...(input.changeReason?.trim()
          ? { change_reason: input.changeReason.trim() }
          : {}),
        created_at: this.now().toISOString(),
      };

      await repository.saveFeatureFlagChange(record);
      return {
        ...record,
      };
    });
  }

  async recordExecutionAudit(
    input: RecordHarnessExecutionAuditInput,
  ): Promise<HarnessExecutionAuditRecord> {
    const inputReference = input.inputReference.trim();
    if (!inputReference) {
      throw new HarnessIntegrationValidationError(
        "Harness execution audits require an input reference.",
      );
    }

    if (input.status === "succeeded" && input.degradationReason) {
      throw new HarnessIntegrationValidationError(
        "Successful harness execution audits cannot include a degradation reason.",
      );
    }

    if (input.status !== "succeeded" && !input.degradationReason?.trim()) {
      throw new HarnessIntegrationValidationError(
        "Degraded or failed harness execution audits require a degradation reason.",
      );
    }

    return this.transactionManager.withTransaction(async ({ repository }) => {
      const adapter = await repository.findAdapterById(input.adapterId);
      if (!adapter) {
        throw new HarnessIntegrationValidationError(
          `Cannot record a harness execution audit for a missing adapter: ${input.adapterId}`,
        );
      }

      const record: HarnessExecutionAuditRecord = {
        id: this.createId(),
        adapter_id: adapter.id,
        trigger_kind: input.triggerKind,
        input_reference: inputReference,
        ...(input.datasetId ? { dataset_id: input.datasetId } : {}),
        ...(input.artifactUri ? { artifact_uri: input.artifactUri } : {}),
        status: input.status,
        ...(input.degradationReason?.trim()
          ? { degradation_reason: input.degradationReason.trim() }
          : {}),
        result_summary: cloneJson(input.resultSummary),
        created_at: this.now().toISOString(),
      };

      await repository.saveExecutionAudit(record);
      return cloneExecutionAudit(record);
    });
  }

  getRedactionProfileById(
    id: string,
  ): Promise<HarnessRedactionProfileRecord | undefined> {
    return this.repository.findRedactionProfileById(id);
  }

  listAdapters(): Promise<HarnessAdapterRecord[]> {
    return this.repository.listAdapters();
  }

  listFeatureFlagChangesByAdapterId(
    adapterId: string,
  ): Promise<HarnessFeatureFlagChangeRecord[]> {
    return this.repository.listFeatureFlagChangesByAdapterId(adapterId);
  }

  listExecutionAuditsByAdapterId(
    adapterId: string,
  ): Promise<HarnessExecutionAuditRecord[]> {
    return this.repository.listExecutionAuditsByAdapterId(adapterId);
  }
}

function createHarnessIntegrationTransactionManager(
  context: HarnessIntegrationWriteContext,
): WriteTransactionManager<HarnessIntegrationWriteContext> {
  if (context.repository instanceof InMemoryHarnessIntegrationRepository) {
    return createScopedWriteTransactionManager({
      queueKey: context.repository,
      context,
      repositories: [context.repository],
    });
  }

  return createDirectWriteTransactionManager(context);
}

function normalizeStringArray(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

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

function cloneExecutionAudit(
  record: HarnessExecutionAuditRecord,
): HarnessExecutionAuditRecord {
  return {
    ...record,
    result_summary: cloneJson(record.result_summary),
  };
}
