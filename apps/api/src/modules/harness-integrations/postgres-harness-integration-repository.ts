import type {
  HarnessAdapterRecord,
  HarnessExecutionAuditRecord,
  HarnessFeatureFlagChangeRecord,
  HarnessRedactionProfileRecord,
} from "./harness-integration-record.ts";
import type { HarnessIntegrationRepository } from "./harness-integration-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface HarnessRedactionProfileRow {
  id: string;
  name: string;
  redaction_mode: HarnessRedactionProfileRecord["redaction_mode"];
  structured_fields: HarnessRedactionProfileRecord["structured_fields"] | string;
  allow_raw_payload_export: boolean;
  created_at: Date;
  updated_at: Date;
}

interface HarnessAdapterRow {
  id: string;
  kind: HarnessAdapterRecord["kind"];
  display_name: string;
  execution_mode: HarnessAdapterRecord["execution_mode"];
  fail_open: boolean;
  redaction_profile_id: string;
  feature_flag_keys: HarnessAdapterRecord["feature_flag_keys"] | string;
  result_envelope_version: string;
  config: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

interface HarnessFeatureFlagChangeRow {
  id: string;
  adapter_id: string;
  flag_key: string;
  enabled: boolean;
  changed_by: string;
  change_reason: string | null;
  created_at: Date;
}

interface HarnessExecutionAuditRow {
  id: string;
  adapter_id: string;
  trigger_kind: HarnessExecutionAuditRecord["trigger_kind"];
  input_reference: string;
  dataset_id: string | null;
  artifact_uri: string | null;
  status: HarnessExecutionAuditRecord["status"];
  degradation_reason: string | null;
  result_summary: Record<string, unknown> | null;
  created_at: Date;
}

function cloneJson<T>(value: T): T {
  if (value == null) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function decodeTextArray(value: string[] | string): string[] {
  if (Array.isArray(value)) {
    return [...value];
  }

  if (!value || value === "{}") {
    return [];
  }

  return value
    .slice(1, -1)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => item.replace(/^"(.*)"$/, "$1"));
}

function mapRedactionProfileRow(
  row: HarnessRedactionProfileRow,
): HarnessRedactionProfileRecord {
  return {
    id: row.id,
    name: row.name,
    redaction_mode: row.redaction_mode,
    structured_fields: decodeTextArray(row.structured_fields),
    allow_raw_payload_export: row.allow_raw_payload_export,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function mapAdapterRow(row: HarnessAdapterRow): HarnessAdapterRecord {
  return {
    id: row.id,
    kind: row.kind,
    display_name: row.display_name,
    execution_mode: row.execution_mode,
    fail_open: row.fail_open,
    redaction_profile_id: row.redaction_profile_id,
    feature_flag_keys: decodeTextArray(row.feature_flag_keys),
    result_envelope_version: row.result_envelope_version,
    config: cloneJson(row.config ?? undefined),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function mapFeatureFlagChangeRow(
  row: HarnessFeatureFlagChangeRow,
): HarnessFeatureFlagChangeRecord {
  return {
    id: row.id,
    adapter_id: row.adapter_id,
    flag_key: row.flag_key,
    enabled: row.enabled,
    changed_by: row.changed_by,
    ...(row.change_reason != null ? { change_reason: row.change_reason } : {}),
    created_at: row.created_at.toISOString(),
  };
}

function mapExecutionAuditRow(
  row: HarnessExecutionAuditRow,
): HarnessExecutionAuditRecord {
  return {
    id: row.id,
    adapter_id: row.adapter_id,
    trigger_kind: row.trigger_kind,
    input_reference: row.input_reference,
    ...(row.dataset_id != null ? { dataset_id: row.dataset_id } : {}),
    ...(row.artifact_uri != null ? { artifact_uri: row.artifact_uri } : {}),
    status: row.status,
    ...(row.degradation_reason != null
      ? { degradation_reason: row.degradation_reason }
      : {}),
    result_summary: cloneJson(row.result_summary ?? undefined),
    created_at: row.created_at.toISOString(),
  };
}

export class PostgresHarnessIntegrationRepository
  implements HarnessIntegrationRepository
{
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async saveRedactionProfile(
    record: HarnessRedactionProfileRecord,
  ): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into harness_redaction_profiles (
          id,
          name,
          redaction_mode,
          structured_fields,
          allow_raw_payload_export,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        on conflict (id) do update
        set
          name = excluded.name,
          redaction_mode = excluded.redaction_mode,
          structured_fields = excluded.structured_fields,
          allow_raw_payload_export = excluded.allow_raw_payload_export,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `,
      [
        record.id,
        record.name,
        record.redaction_mode,
        record.structured_fields,
        record.allow_raw_payload_export,
        record.created_at,
        record.updated_at,
      ],
    );
  }

  async findRedactionProfileById(
    id: string,
  ): Promise<HarnessRedactionProfileRecord | undefined> {
    const result =
      await this.dependencies.client.query<HarnessRedactionProfileRow>(
        `
          select
            id,
            name,
            redaction_mode,
            structured_fields,
            allow_raw_payload_export,
            created_at,
            updated_at
          from harness_redaction_profiles
          where id = $1
        `,
        [id],
      );

    return result.rows[0] ? mapRedactionProfileRow(result.rows[0]) : undefined;
  }

  async findRedactionProfileByName(
    name: string,
  ): Promise<HarnessRedactionProfileRecord | undefined> {
    const result =
      await this.dependencies.client.query<HarnessRedactionProfileRow>(
        `
          select
            id,
            name,
            redaction_mode,
            structured_fields,
            allow_raw_payload_export,
            created_at,
            updated_at
          from harness_redaction_profiles
          where name = $1
        `,
        [name],
      );

    return result.rows[0] ? mapRedactionProfileRow(result.rows[0]) : undefined;
  }

  async listRedactionProfiles(): Promise<HarnessRedactionProfileRecord[]> {
    const result =
      await this.dependencies.client.query<HarnessRedactionProfileRow>(
        `
          select
            id,
            name,
            redaction_mode,
            structured_fields,
            allow_raw_payload_export,
            created_at,
            updated_at
          from harness_redaction_profiles
          order by updated_at asc, id asc
        `,
      );

    return result.rows.map(mapRedactionProfileRow);
  }

  async saveAdapter(record: HarnessAdapterRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into harness_integrations (
          id,
          kind,
          display_name,
          execution_mode,
          fail_open,
          redaction_profile_id,
          feature_flag_keys,
          result_envelope_version,
          config,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
        on conflict (id) do update
        set
          kind = excluded.kind,
          display_name = excluded.display_name,
          execution_mode = excluded.execution_mode,
          fail_open = excluded.fail_open,
          redaction_profile_id = excluded.redaction_profile_id,
          feature_flag_keys = excluded.feature_flag_keys,
          result_envelope_version = excluded.result_envelope_version,
          config = excluded.config,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `,
      [
        record.id,
        record.kind,
        record.display_name,
        record.execution_mode,
        record.fail_open,
        record.redaction_profile_id,
        record.feature_flag_keys,
        record.result_envelope_version,
        JSON.stringify(record.config ?? {}),
        record.created_at,
        record.updated_at,
      ],
    );
  }

  async findAdapterById(id: string): Promise<HarnessAdapterRecord | undefined> {
    const result = await this.dependencies.client.query<HarnessAdapterRow>(
      `
        select
          id,
          kind,
          display_name,
          execution_mode,
          fail_open,
          redaction_profile_id,
          feature_flag_keys,
          result_envelope_version,
          config,
          created_at,
          updated_at
        from harness_integrations
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapAdapterRow(result.rows[0]) : undefined;
  }

  async findAdapterByKind(
    kind: HarnessAdapterRecord["kind"],
  ): Promise<HarnessAdapterRecord | undefined> {
    const result = await this.dependencies.client.query<HarnessAdapterRow>(
      `
        select
          id,
          kind,
          display_name,
          execution_mode,
          fail_open,
          redaction_profile_id,
          feature_flag_keys,
          result_envelope_version,
          config,
          created_at,
          updated_at
        from harness_integrations
        where kind = $1
      `,
      [kind],
    );

    return result.rows[0] ? mapAdapterRow(result.rows[0]) : undefined;
  }

  async listAdapters(): Promise<HarnessAdapterRecord[]> {
    const result = await this.dependencies.client.query<HarnessAdapterRow>(
      `
        select
          id,
          kind,
          display_name,
          execution_mode,
          fail_open,
          redaction_profile_id,
          feature_flag_keys,
          result_envelope_version,
          config,
          created_at,
          updated_at
        from harness_integrations
        order by updated_at asc, id asc
      `,
    );

    return result.rows.map(mapAdapterRow);
  }

  async saveFeatureFlagChange(
    record: HarnessFeatureFlagChangeRecord,
  ): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into harness_integration_feature_flag_changes (
          id,
          adapter_id,
          flag_key,
          enabled,
          changed_by,
          change_reason,
          created_at
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        on conflict (id) do update
        set
          adapter_id = excluded.adapter_id,
          flag_key = excluded.flag_key,
          enabled = excluded.enabled,
          changed_by = excluded.changed_by,
          change_reason = excluded.change_reason,
          created_at = excluded.created_at
      `,
      [
        record.id,
        record.adapter_id,
        record.flag_key,
        record.enabled,
        record.changed_by,
        record.change_reason ?? null,
        record.created_at,
      ],
    );
  }

  async findLatestFeatureFlagChange(
    adapterId: string,
    flagKey: string,
  ): Promise<HarnessFeatureFlagChangeRecord | undefined> {
    const result =
      await this.dependencies.client.query<HarnessFeatureFlagChangeRow>(
        `
          select
            id,
            adapter_id,
            flag_key,
            enabled,
            changed_by,
            change_reason,
            created_at
          from harness_integration_feature_flag_changes
          where adapter_id = $1
            and flag_key = $2
          order by created_at desc, id desc
          limit 1
        `,
        [adapterId, flagKey],
      );

    return result.rows[0]
      ? mapFeatureFlagChangeRow(result.rows[0])
      : undefined;
  }

  async listFeatureFlagChangesByAdapterId(
    adapterId: string,
  ): Promise<HarnessFeatureFlagChangeRecord[]> {
    const result =
      await this.dependencies.client.query<HarnessFeatureFlagChangeRow>(
        `
          select
            id,
            adapter_id,
            flag_key,
            enabled,
            changed_by,
            change_reason,
            created_at
          from harness_integration_feature_flag_changes
          where adapter_id = $1
          order by created_at asc, id asc
        `,
        [adapterId],
      );

    return result.rows.map(mapFeatureFlagChangeRow);
  }

  async saveExecutionAudit(record: HarnessExecutionAuditRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into harness_execution_audits (
          id,
          adapter_id,
          trigger_kind,
          input_reference,
          dataset_id,
          artifact_uri,
          status,
          degradation_reason,
          result_summary,
          created_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
        on conflict (id) do update
        set
          adapter_id = excluded.adapter_id,
          trigger_kind = excluded.trigger_kind,
          input_reference = excluded.input_reference,
          dataset_id = excluded.dataset_id,
          artifact_uri = excluded.artifact_uri,
          status = excluded.status,
          degradation_reason = excluded.degradation_reason,
          result_summary = excluded.result_summary,
          created_at = excluded.created_at
      `,
      [
        record.id,
        record.adapter_id,
        record.trigger_kind,
        record.input_reference,
        record.dataset_id ?? null,
        record.artifact_uri ?? null,
        record.status,
        record.degradation_reason ?? null,
        JSON.stringify(record.result_summary ?? {}),
        record.created_at,
      ],
    );
  }

  async findExecutionAuditById(
    id: string,
  ): Promise<HarnessExecutionAuditRecord | undefined> {
    const result = await this.dependencies.client.query<HarnessExecutionAuditRow>(
      `
        select
          id,
          adapter_id,
          trigger_kind,
          input_reference,
          dataset_id,
          artifact_uri,
          status,
          degradation_reason,
          result_summary,
          created_at
        from harness_execution_audits
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapExecutionAuditRow(result.rows[0]) : undefined;
  }

  async listExecutionAuditsByAdapterId(
    adapterId: string,
  ): Promise<HarnessExecutionAuditRecord[]> {
    const result = await this.dependencies.client.query<HarnessExecutionAuditRow>(
      `
        select
          id,
          adapter_id,
          trigger_kind,
          input_reference,
          dataset_id,
          artifact_uri,
          status,
          degradation_reason,
          result_summary,
          created_at
        from harness_execution_audits
        where adapter_id = $1
        order by created_at asc, id asc
      `,
      [adapterId],
    );

    return result.rows.map(mapExecutionAuditRow);
  }
}
