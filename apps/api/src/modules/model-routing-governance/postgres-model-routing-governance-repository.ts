import type {
  ModelRoutingPolicyDecisionKind,
  ModelRoutingPolicyDecisionRecord,
  ModelRoutingPolicyEvidenceLinkRecord,
  ModelRoutingPolicyRecord,
  ModelRoutingPolicyScopeKind,
  ModelRoutingPolicyScopeRecord,
  ModelRoutingPolicyVersionRecord,
} from "./model-routing-governance-record.ts";
import type { ModelRoutingGovernanceRepository } from "./model-routing-governance-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface ScopeRow {
  id: string;
  scope_kind: ModelRoutingPolicyScopeKind;
  scope_value: string;
  active_version_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface VersionRow {
  id: string;
  policy_scope_id: string;
  scope_kind: ModelRoutingPolicyScopeKind;
  scope_value: string;
  version_no: number;
  primary_model_id: string;
  fallback_model_ids: string[] | string;
  temperature: number | string | null;
  evidence_links: ModelRoutingPolicyEvidenceLinkRecord[] | null;
  notes: string | null;
  status: ModelRoutingPolicyVersionRecord["status"];
  created_at: Date | string;
  updated_at: Date | string;
}

interface DecisionRow {
  id: string;
  policy_scope_id: string;
  policy_version_id: string;
  decision_kind: ModelRoutingPolicyDecisionKind;
  actor_id: string | null;
  actor_role: ModelRoutingPolicyDecisionRecord["actor_role"] | null;
  reason: string | null;
  evidence_links: ModelRoutingPolicyEvidenceLinkRecord[] | null;
  created_at: Date | string;
}

export class PostgresModelRoutingGovernanceRepository
  implements ModelRoutingGovernanceRepository
{
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async saveScope(record: ModelRoutingPolicyScopeRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into model_routing_policy_scopes (
          id,
          scope_kind,
          scope_value,
          active_version_id,
          created_at,
          updated_at
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6
        )
        on conflict (id) do update
        set
          scope_kind = excluded.scope_kind,
          scope_value = excluded.scope_value,
          active_version_id = excluded.active_version_id,
          updated_at = excluded.updated_at
      `,
      [
        record.id,
        record.scope_kind,
        record.scope_value,
        record.active_version_id ?? null,
        record.created_at,
        record.updated_at,
      ],
    );
  }

  async findScopeById(
    id: string,
  ): Promise<ModelRoutingPolicyScopeRecord | undefined> {
    const result = await this.dependencies.client.query<ScopeRow>(
      `
        select
          id,
          scope_kind,
          scope_value,
          active_version_id,
          created_at,
          updated_at
        from model_routing_policy_scopes
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapScopeRow(result.rows[0]) : undefined;
  }

  async findPolicyById(
    policyId: string,
  ): Promise<ModelRoutingPolicyRecord | undefined> {
    const policies = await this.loadPolicies(
      `
        where id = $1
      `,
      [policyId],
    );

    return policies[0];
  }

  async findPolicyByScope(
    scopeKind: ModelRoutingPolicyScopeKind,
    scopeValue: string,
  ): Promise<ModelRoutingPolicyRecord | undefined> {
    const policies = await this.loadPolicies(
      `
        where scope_kind = $1
          and scope_value = $2
      `,
      [scopeKind, scopeValue],
    );

    return policies[0];
  }

  async listPolicies(): Promise<ModelRoutingPolicyRecord[]> {
    return this.loadPolicies();
  }

  async saveVersion(record: ModelRoutingPolicyVersionRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into model_routing_policy_versions (
          id,
          policy_scope_id,
          version_no,
          primary_model_id,
          fallback_model_ids,
          temperature,
          evidence_links,
          notes,
          status,
          created_at,
          updated_at
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5::uuid[],
          $6,
          $7::jsonb,
          $8,
          $9,
          $10,
          $11
        )
        on conflict (id) do update
        set
          version_no = excluded.version_no,
          primary_model_id = excluded.primary_model_id,
          fallback_model_ids = excluded.fallback_model_ids,
          temperature = excluded.temperature,
          evidence_links = excluded.evidence_links,
          notes = excluded.notes,
          status = excluded.status,
          updated_at = excluded.updated_at
      `,
      [
        record.id,
        record.policy_scope_id,
        record.version_no,
        record.primary_model_id,
        record.fallback_model_ids,
        record.temperature ?? null,
        JSON.stringify(record.evidence_links),
        record.notes ?? null,
        record.status,
        record.created_at,
        record.updated_at,
      ],
    );
  }

  async findVersionById(
    id: string,
  ): Promise<ModelRoutingPolicyVersionRecord | undefined> {
    const result = await this.dependencies.client.query<VersionRow>(
      `
        select
          version.id,
          version.policy_scope_id,
          scope.scope_kind,
          scope.scope_value,
          version.version_no,
          version.primary_model_id,
          version.fallback_model_ids,
          version.temperature,
          version.evidence_links,
          version.notes,
          version.status,
          version.created_at,
          version.updated_at
        from model_routing_policy_versions version
        join model_routing_policy_scopes scope
          on scope.id = version.policy_scope_id
        where version.id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapVersionRow(result.rows[0]) : undefined;
  }

  async saveDecision(record: ModelRoutingPolicyDecisionRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into model_routing_policy_decisions (
          id,
          policy_scope_id,
          policy_version_id,
          decision_kind,
          actor_id,
          actor_role,
          reason,
          evidence_links,
          created_at
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8::jsonb,
          $9
        )
      `,
      [
        record.id,
        record.policy_scope_id,
        record.policy_version_id,
        record.decision_kind,
        record.actor_id ?? null,
        record.actor_role ?? null,
        record.reason ?? null,
        JSON.stringify(record.evidence_links),
        record.created_at,
      ],
    );
  }

  private async loadPolicies(
    whereClause = "",
    params: unknown[] = [],
  ): Promise<ModelRoutingPolicyRecord[]> {
    const scopeResult = await this.dependencies.client.query<ScopeRow>(
      `
        select
          id,
          scope_kind,
          scope_value,
          active_version_id,
          created_at,
          updated_at
        from model_routing_policy_scopes
        ${whereClause}
        order by scope_kind asc, scope_value asc, id asc
      `,
      params,
    );

    if (scopeResult.rows.length === 0) {
      return [];
    }

    const scopeIds = scopeResult.rows.map((row) => row.id);
    const versionResult = await this.dependencies.client.query<VersionRow>(
      `
        select
          version.id,
          version.policy_scope_id,
          scope.scope_kind,
          scope.scope_value,
          version.version_no,
          version.primary_model_id,
          version.fallback_model_ids,
          version.temperature,
          version.evidence_links,
          version.notes,
          version.status,
          version.created_at,
          version.updated_at
        from model_routing_policy_versions version
        join model_routing_policy_scopes scope
          on scope.id = version.policy_scope_id
        where version.policy_scope_id = any($1::uuid[])
        order by version.policy_scope_id asc, version.version_no asc, version.id asc
      `,
      [scopeIds],
    );
    const decisionResult = await this.dependencies.client.query<DecisionRow>(
      `
        select
          id,
          policy_scope_id,
          policy_version_id,
          decision_kind,
          actor_id,
          actor_role,
          reason,
          evidence_links,
          created_at
        from model_routing_policy_decisions
        where policy_scope_id = any($1::uuid[])
        order by policy_scope_id asc, created_at asc, id asc
      `,
      [scopeIds],
    );

    const versionsByScopeId = new Map<string, ModelRoutingPolicyVersionRecord[]>();
    const decisionsByScopeId = new Map<string, ModelRoutingPolicyDecisionRecord[]>();

    for (const row of versionResult.rows) {
      const version = mapVersionRow(row);
      const collection = versionsByScopeId.get(version.policy_scope_id) ?? [];
      collection.push(version);
      versionsByScopeId.set(version.policy_scope_id, collection);
    }

    for (const row of decisionResult.rows) {
      const decision = mapDecisionRow(row);
      const collection = decisionsByScopeId.get(decision.policy_scope_id) ?? [];
      collection.push(decision);
      decisionsByScopeId.set(decision.policy_scope_id, collection);
    }

    return scopeResult.rows.map((row) => {
      const scope = mapScopeRow(row);
      const versions = versionsByScopeId.get(scope.id) ?? [];

      return {
        policy_id: scope.id,
        scope_kind: scope.scope_kind,
        scope_value: scope.scope_value,
        ...(scope.active_version_id
          ? {
              active_version: versions.find(
                (record) => record.id === scope.active_version_id,
              ),
            }
          : {}),
        versions,
        decisions: decisionsByScopeId.get(scope.id) ?? [],
      };
    });
  }
}

function mapScopeRow(row: ScopeRow): ModelRoutingPolicyScopeRecord {
  return {
    id: row.id,
    scope_kind: row.scope_kind,
    scope_value: row.scope_value,
    ...(row.active_version_id ? { active_version_id: row.active_version_id } : {}),
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

function mapVersionRow(row: VersionRow): ModelRoutingPolicyVersionRecord {
  return {
    id: row.id,
    policy_scope_id: row.policy_scope_id,
    scope_kind: row.scope_kind,
    scope_value: row.scope_value,
    version_no: row.version_no,
    primary_model_id: row.primary_model_id,
    fallback_model_ids: decodeTextArray(row.fallback_model_ids),
    ...(row.temperature === null || row.temperature === undefined
      ? { temperature: null }
      : { temperature: Number(row.temperature) }),
    evidence_links: cloneEvidenceLinks(row.evidence_links ?? []),
    ...(row.notes ? { notes: row.notes } : {}),
    status: row.status,
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

function mapDecisionRow(row: DecisionRow): ModelRoutingPolicyDecisionRecord {
  return {
    id: row.id,
    policy_scope_id: row.policy_scope_id,
    policy_version_id: row.policy_version_id,
    decision_kind: row.decision_kind,
    ...(row.actor_id ? { actor_id: row.actor_id } : {}),
    ...(row.actor_role ? { actor_role: row.actor_role } : {}),
    ...(row.reason ? { reason: row.reason } : {}),
    evidence_links: cloneEvidenceLinks(row.evidence_links ?? []),
    created_at: toIsoString(row.created_at),
  };
}

function cloneEvidenceLinks(
  evidenceLinks: ModelRoutingPolicyEvidenceLinkRecord[],
): ModelRoutingPolicyEvidenceLinkRecord[] {
  return evidenceLinks.map((link) => ({ ...link }));
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

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}
