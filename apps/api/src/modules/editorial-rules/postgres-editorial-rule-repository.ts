import type {
  EditorialRuleRecord,
  EditorialRuleSetRecord,
} from "./editorial-rule-record.ts";
import type { EditorialRuleRepository } from "./editorial-rule-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface EditorialRuleSetRow {
  id: string;
  template_family_id: string;
  journal_template_id: string | null;
  module: EditorialRuleSetRecord["module"];
  version_no: number;
  status: EditorialRuleSetRecord["status"];
}

interface EditorialRuleRow {
  id: string;
  rule_set_id: string;
  order_no: number;
  rule_object: string;
  rule_type: EditorialRuleRecord["rule_type"];
  execution_mode: EditorialRuleRecord["execution_mode"];
  scope: Record<string, unknown> | string | null;
  selector: Record<string, unknown> | string | null;
  trigger: Record<string, unknown> | string | null;
  action: Record<string, unknown> | string | null;
  authoring_payload: Record<string, unknown> | string | null;
  evidence_level: EditorialRuleRecord["evidence_level"] | null;
  confidence_policy: EditorialRuleRecord["confidence_policy"];
  severity: EditorialRuleRecord["severity"];
  enabled: boolean;
  example_before: string | null;
  example_after: string | null;
  manual_review_reason_template: string | null;
}

export class PostgresEditorialRuleRepository implements EditorialRuleRepository {
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async saveRuleSet(record: EditorialRuleSetRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into editorial_rule_sets (
          id,
          template_family_id,
          journal_template_id,
          module,
          version_no,
          status
        )
        values ($1, $2, $3, $4, $5, $6)
        on conflict (id) do update
        set
          template_family_id = excluded.template_family_id,
          journal_template_id = excluded.journal_template_id,
          module = excluded.module,
          version_no = excluded.version_no,
          status = excluded.status,
          updated_at = now()
      `,
      [
        record.id,
        record.template_family_id,
        record.journal_template_id ?? null,
        record.module,
        record.version_no,
        record.status,
      ],
    );
  }

  async findRuleSetById(
    id: string,
  ): Promise<EditorialRuleSetRecord | undefined> {
    const result = await this.dependencies.client.query<EditorialRuleSetRow>(
      `
        select
          id,
          template_family_id,
          journal_template_id,
          module,
          version_no,
          status
        from editorial_rule_sets
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapRuleSetRow(result.rows[0]) : undefined;
  }

  async listRuleSets(): Promise<EditorialRuleSetRecord[]> {
    const result = await this.dependencies.client.query<EditorialRuleSetRow>(
      `
        select
          id,
          template_family_id,
          journal_template_id,
          module,
          version_no,
          status
        from editorial_rule_sets
        order by template_family_id asc, module asc, version_no asc, id asc
      `,
    );

    return result.rows.map(mapRuleSetRow);
  }

  async listRuleSetsByTemplateFamilyAndModule(
    templateFamilyId: string,
    module: EditorialRuleSetRecord["module"],
  ): Promise<EditorialRuleSetRecord[]> {
    const result = await this.dependencies.client.query<EditorialRuleSetRow>(
      `
        select
          id,
          template_family_id,
          journal_template_id,
          module,
          version_no,
          status
        from editorial_rule_sets
        where template_family_id = $1
          and module = $2
        order by template_family_id asc, module asc, version_no asc, id asc
      `,
      [templateFamilyId, module],
    );

    return result.rows.map(mapRuleSetRow);
  }

  async reserveNextRuleSetVersion(
    templateFamilyId: string,
    module: EditorialRuleSetRecord["module"],
    journalTemplateId?: string,
  ): Promise<number> {
    await this.dependencies.client.query(
      `
        select pg_advisory_xact_lock(hashtext($1))
      `,
      [
        `editorial-rule-set-version:${templateFamilyId}:${journalTemplateId ?? "<base>"}:${module}`,
      ],
    );

    const result = await this.dependencies.client.query<{ next_version: number }>(
      `
        select coalesce(max(version_no), 0) + 1 as next_version
        from editorial_rule_sets
        where template_family_id = $1
          and module = $2
          and (
            ($3::uuid is null and journal_template_id is null)
            or journal_template_id = $3::uuid
          )
      `,
      [templateFamilyId, module, journalTemplateId ?? null],
    );

    return Number(result.rows[0]?.next_version ?? 1);
  }

  async saveRule(record: EditorialRuleRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into editorial_rules (
          id,
          rule_set_id,
          order_no,
          rule_object,
          rule_type,
          execution_mode,
          scope,
          selector,
          trigger,
          action,
          authoring_payload,
          evidence_level,
          confidence_policy,
          severity,
          enabled,
          example_before,
          example_after,
          manual_review_reason_template
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7::jsonb,
          $8::jsonb,
          $9::jsonb,
          $10::jsonb,
          $11::jsonb,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17,
          $18
        )
        on conflict (id) do update
        set
          rule_set_id = excluded.rule_set_id,
          order_no = excluded.order_no,
          rule_object = excluded.rule_object,
          rule_type = excluded.rule_type,
          execution_mode = excluded.execution_mode,
          scope = excluded.scope,
          selector = excluded.selector,
          trigger = excluded.trigger,
          action = excluded.action,
          authoring_payload = excluded.authoring_payload,
          evidence_level = excluded.evidence_level,
          confidence_policy = excluded.confidence_policy,
          severity = excluded.severity,
          enabled = excluded.enabled,
          example_before = excluded.example_before,
          example_after = excluded.example_after,
          manual_review_reason_template = excluded.manual_review_reason_template,
          updated_at = now()
      `,
      [
        record.id,
        record.rule_set_id,
        record.order_no,
        record.rule_object,
        record.rule_type,
        record.execution_mode,
        JSON.stringify(record.scope),
        JSON.stringify(record.selector),
        JSON.stringify(record.trigger),
        JSON.stringify(record.action),
        JSON.stringify(record.authoring_payload),
        record.evidence_level ?? null,
        record.confidence_policy,
        record.severity,
        record.enabled,
        record.example_before ?? null,
        record.example_after ?? null,
        record.manual_review_reason_template ?? null,
      ],
    );
  }

  async findRuleById(id: string): Promise<EditorialRuleRecord | undefined> {
    const result = await this.dependencies.client.query<EditorialRuleRow>(
      `
        select
          id,
          rule_set_id,
          order_no,
          rule_object,
          rule_type,
          execution_mode,
          scope,
          selector,
          trigger,
          action,
          authoring_payload,
          evidence_level,
          confidence_policy,
          severity,
          enabled,
          example_before,
          example_after,
          manual_review_reason_template
        from editorial_rules
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapRuleRow(result.rows[0]) : undefined;
  }

  async listRulesByRuleSetId(ruleSetId: string): Promise<EditorialRuleRecord[]> {
    const result = await this.dependencies.client.query<EditorialRuleRow>(
      `
        select
          id,
          rule_set_id,
          order_no,
          rule_object,
          rule_type,
          execution_mode,
          scope,
          selector,
          trigger,
          action,
          authoring_payload,
          evidence_level,
          confidence_policy,
          severity,
          enabled,
          example_before,
          example_after,
          manual_review_reason_template
        from editorial_rules
        where rule_set_id = $1
        order by order_no asc, id asc
      `,
      [ruleSetId],
    );

    return result.rows.map(mapRuleRow);
  }
}

function mapRuleSetRow(row: EditorialRuleSetRow): EditorialRuleSetRecord {
  return {
    id: row.id,
    template_family_id: row.template_family_id,
    ...(row.journal_template_id != null
      ? { journal_template_id: row.journal_template_id }
      : {}),
    module: row.module,
    version_no: Number(row.version_no),
    status: row.status,
  };
}

function mapRuleRow(row: EditorialRuleRow): EditorialRuleRecord {
  return {
    id: row.id,
    rule_set_id: row.rule_set_id,
    order_no: Number(row.order_no),
    rule_object: row.rule_object,
    rule_type: row.rule_type,
    execution_mode: row.execution_mode,
    scope: parseJsonObject<EditorialRuleRecord["scope"]>(row.scope),
    selector: parseJsonObject<Record<string, unknown>>(row.selector),
    trigger: parseJsonObject<EditorialRuleRecord["trigger"]>(row.trigger),
    action: parseJsonObject<EditorialRuleRecord["action"]>(row.action),
    authoring_payload: parseJsonObject<Record<string, unknown>>(
      row.authoring_payload,
    ),
    ...(row.evidence_level ? { evidence_level: row.evidence_level } : {}),
    confidence_policy: row.confidence_policy,
    severity: row.severity,
    enabled: row.enabled,
    ...(row.example_before ? { example_before: row.example_before } : {}),
    ...(row.example_after ? { example_after: row.example_after } : {}),
    ...(row.manual_review_reason_template
      ? {
          manual_review_reason_template: row.manual_review_reason_template,
        }
      : {}),
  };
}

function parseJsonObject<T extends Record<string, unknown>>(
  value: Record<string, unknown> | string | null,
): T {
  if (value == null) {
    return {} as T;
  }

  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }

  return value as T;
}
