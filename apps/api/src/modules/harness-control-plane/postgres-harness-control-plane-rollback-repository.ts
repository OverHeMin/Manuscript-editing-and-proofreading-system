import { randomUUID } from "node:crypto";
import type {
  HarnessControlPlaneRollbackRepository,
  HarnessEnvironmentRollbackEntryRecord,
  HarnessEnvironmentRollbackScopeInput,
  HarnessEnvironmentRollbackSnapshotRecord,
} from "./harness-control-plane-rollback-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface HarnessEnvironmentRollbackRow {
  id: string;
  module: HarnessEnvironmentRollbackScopeInput["module"];
  manuscript_type: HarnessEnvironmentRollbackScopeInput["manuscriptType"];
  template_family_id: string;
  snapshot: HarnessEnvironmentRollbackSnapshotRecord | string;
  created_at: Date;
}

export interface PostgresHarnessControlPlaneRollbackRepositoryOptions {
  client: QueryableClient;
  createId?: () => string;
  now?: () => string;
}

export class PostgresHarnessControlPlaneRollbackRepository
  implements HarnessControlPlaneRollbackRepository
{
  private readonly client: QueryableClient;
  private readonly createId: () => string;
  private readonly now: () => string;

  constructor(options: PostgresHarnessControlPlaneRollbackRepositoryOptions) {
    this.client = options.client;
    this.createId = options.createId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async appendSnapshot(input: {
    scope: HarnessEnvironmentRollbackScopeInput;
    snapshot: HarnessEnvironmentRollbackSnapshotRecord;
  }): Promise<HarnessEnvironmentRollbackEntryRecord> {
    const entry: HarnessEnvironmentRollbackEntryRecord = {
      id: this.createId(),
      scope: cloneScope(input.scope),
      snapshot: cloneSnapshot(input.snapshot),
      created_at: this.now(),
    };

    await this.client.query(
      `
        insert into harness_environment_rollbacks (
          id,
          module,
          manuscript_type,
          template_family_id,
          snapshot,
          created_at
        )
        values ($1, $2, $3, $4, $5::jsonb, $6)
      `,
      [
        entry.id,
        entry.scope.module,
        entry.scope.manuscriptType,
        entry.scope.templateFamilyId,
        JSON.stringify(entry.snapshot),
        entry.created_at,
      ],
    );

    return entry;
  }

  async getLatestSnapshot(
    scope: HarnessEnvironmentRollbackScopeInput,
  ): Promise<HarnessEnvironmentRollbackEntryRecord | undefined> {
    const result = await this.client.query<HarnessEnvironmentRollbackRow>(
      `
        select
          id,
          module,
          manuscript_type,
          template_family_id,
          snapshot,
          created_at
        from harness_environment_rollbacks
        where module = $1
          and manuscript_type = $2
          and template_family_id = $3
        order by created_at desc, id desc
        limit 1
      `,
      [scope.module, scope.manuscriptType, scope.templateFamilyId],
    );

    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  }

  async deleteSnapshot(snapshotId: string): Promise<void> {
    await this.client.query(
      `
        delete from harness_environment_rollbacks
        where id = $1
      `,
      [snapshotId],
    );
  }
}

function mapRow(
  row: HarnessEnvironmentRollbackRow,
): HarnessEnvironmentRollbackEntryRecord {
  return {
    id: row.id,
    scope: {
      module: row.module,
      manuscriptType: row.manuscript_type,
      templateFamilyId: row.template_family_id,
    },
    snapshot: cloneSnapshot(decodeSnapshot(row.snapshot)),
    created_at: row.created_at.toISOString(),
  };
}

function decodeSnapshot(
  value: HarnessEnvironmentRollbackSnapshotRecord | string,
): HarnessEnvironmentRollbackSnapshotRecord {
  return typeof value === "string"
    ? (JSON.parse(value) as HarnessEnvironmentRollbackSnapshotRecord)
    : value;
}

function cloneScope(
  scope: HarnessEnvironmentRollbackScopeInput,
): HarnessEnvironmentRollbackScopeInput {
  return {
    module: scope.module,
    manuscriptType: scope.manuscriptType,
    templateFamilyId: scope.templateFamilyId,
  };
}

function cloneSnapshot(
  snapshot: HarnessEnvironmentRollbackSnapshotRecord,
): HarnessEnvironmentRollbackSnapshotRecord {
  return {
    execution_profile_id: snapshot.execution_profile_id,
    runtime_binding_id: snapshot.runtime_binding_id,
    model_routing_policy_version_id: snapshot.model_routing_policy_version_id,
    ...(snapshot.retrieval_preset_id
      ? { retrieval_preset_id: snapshot.retrieval_preset_id }
      : {}),
    ...(snapshot.manual_review_policy_id
      ? { manual_review_policy_id: snapshot.manual_review_policy_id }
      : {}),
  };
}
