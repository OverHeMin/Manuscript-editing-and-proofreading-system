import {
  DEFAULT_EDITORIAL_RULE_PRIORITY,
} from "./editorial-rule-record.ts";
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
  release_scope: Record<string, unknown> | string | null;
  candidate_validation_run_id: string | null;
  candidate_validation_evidence_pack_id: string | null;
  online_regression_run_id: string | null;
  online_regression_evidence_pack_id: string | null;
  rollback_rule_set_id: string | null;
}

interface EditorialRuleRow {
  id: string;
  rule_set_id: string;
  order_no: number;
  priority: number | null;
  rule_object: string;
  rule_type: EditorialRuleRecord["rule_type"];
  execution_mode: EditorialRuleRecord["execution_mode"];
  scope: Record<string, unknown> | string | null;
  selector: Record<string, unknown> | string | null;
  trigger: Record<string, unknown> | string | null;
  action: Record<string, unknown> | string | null;
  authoring_payload: Record<string, unknown> | string | null;
  explanation_payload: Record<string, unknown> | string | null;
  linkage_payload: Record<string, unknown> | string | null;
  projection_payload: Record<string, unknown> | string | null;
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
          status,
          release_scope,
          candidate_validation_run_id,
          candidate_validation_evidence_pack_id,
          online_regression_run_id,
          online_regression_evidence_pack_id,
          rollback_rule_set_id
        )
        values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12::uuid)
        on conflict (id) do update
        set
          template_family_id = excluded.template_family_id,
          journal_template_id = excluded.journal_template_id,
          module = excluded.module,
          version_no = excluded.version_no,
          status = excluded.status,
          release_scope = excluded.release_scope,
          candidate_validation_run_id = excluded.candidate_validation_run_id,
          candidate_validation_evidence_pack_id = excluded.candidate_validation_evidence_pack_id,
          online_regression_run_id = excluded.online_regression_run_id,
          online_regression_evidence_pack_id = excluded.online_regression_evidence_pack_id,
          rollback_rule_set_id = excluded.rollback_rule_set_id,
          updated_at = now()
      `,
      [
        record.id,
        record.template_family_id,
        record.journal_template_id ?? null,
        record.module,
        record.version_no,
        record.status,
        JSON.stringify(record.release_scope ?? {}),
        record.candidate_validation_run_id ?? null,
        record.candidate_validation_evidence_pack_id ?? null,
        record.online_regression_run_id ?? null,
        record.online_regression_evidence_pack_id ?? null,
        record.rollback_rule_set_id ?? null,
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
          status,
          release_scope,
          candidate_validation_run_id,
          candidate_validation_evidence_pack_id,
          online_regression_run_id,
          online_regression_evidence_pack_id,
          rollback_rule_set_id
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
          status,
          release_scope,
          candidate_validation_run_id,
          candidate_validation_evidence_pack_id,
          online_regression_run_id,
          online_regression_evidence_pack_id,
          rollback_rule_set_id
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
          status,
          release_scope,
          candidate_validation_run_id,
          candidate_validation_evidence_pack_id,
          online_regression_run_id,
          online_regression_evidence_pack_id,
          rollback_rule_set_id
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
          priority,
          rule_object,
          rule_type,
          execution_mode,
          scope,
          selector,
          trigger,
          action,
          authoring_payload,
          explanation_payload,
          linkage_payload,
          projection_payload,
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
          $7,
          $8::jsonb,
          $9::jsonb,
          $10::jsonb,
          $11::jsonb,
          $12::jsonb,
          $13::jsonb,
          $14::jsonb,
          $15::jsonb,
          $16,
          $17,
          $18,
          $19,
          $20,
          $21,
          $22
        )
        on conflict (id) do update
        set
          rule_set_id = excluded.rule_set_id,
          order_no = excluded.order_no,
          priority = excluded.priority,
          rule_object = excluded.rule_object,
          rule_type = excluded.rule_type,
          execution_mode = excluded.execution_mode,
          scope = excluded.scope,
          selector = excluded.selector,
          trigger = excluded.trigger,
          action = excluded.action,
          authoring_payload = excluded.authoring_payload,
          explanation_payload = excluded.explanation_payload,
          linkage_payload = excluded.linkage_payload,
          projection_payload = excluded.projection_payload,
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
        record.priority ?? DEFAULT_EDITORIAL_RULE_PRIORITY,
        record.rule_object,
        record.rule_type,
        record.execution_mode,
        JSON.stringify(record.scope),
        JSON.stringify(record.selector),
        JSON.stringify(record.trigger),
        JSON.stringify(record.action),
        JSON.stringify(record.authoring_payload),
        JSON.stringify(record.explanation_payload ?? {}),
        JSON.stringify(record.linkage_payload ?? {}),
        JSON.stringify(record.projection_payload ?? {}),
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
          priority,
          rule_object,
          rule_type,
          execution_mode,
          scope,
          selector,
          trigger,
          action,
          authoring_payload,
          explanation_payload,
          linkage_payload,
          projection_payload,
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
          priority,
          rule_object,
          rule_type,
          execution_mode,
          scope,
          selector,
          trigger,
          action,
          authoring_payload,
          explanation_payload,
          linkage_payload,
          projection_payload,
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
    ...(hasObjectKeys(row.release_scope)
      ? {
          release_scope: parseJsonObject<NonNullable<EditorialRuleSetRecord["release_scope"]>>(
            row.release_scope,
          ),
        }
      : {}),
    ...(row.candidate_validation_run_id
      ? { candidate_validation_run_id: row.candidate_validation_run_id }
      : {}),
    ...(row.candidate_validation_evidence_pack_id
      ? {
          candidate_validation_evidence_pack_id:
            row.candidate_validation_evidence_pack_id,
        }
      : {}),
    ...(row.online_regression_run_id
      ? { online_regression_run_id: row.online_regression_run_id }
      : {}),
    ...(row.online_regression_evidence_pack_id
      ? {
          online_regression_evidence_pack_id:
            row.online_regression_evidence_pack_id,
        }
      : {}),
    ...(row.rollback_rule_set_id
      ? { rollback_rule_set_id: row.rollback_rule_set_id }
      : {}),
  };
}

function mapRuleRow(row: EditorialRuleRow): EditorialRuleRecord {
  const explanationPayload = parseOptionalJsonObject<
    NonNullable<EditorialRuleRecord["explanation_payload"]>
  >(row.explanation_payload);
  const linkagePayload = parseOptionalJsonObject<
    NonNullable<EditorialRuleRecord["linkage_payload"]>
  >(row.linkage_payload);
  const projectionPayload = parseOptionalJsonObject<
    NonNullable<EditorialRuleRecord["projection_payload"]>
  >(row.projection_payload);

  return {
    id: row.id,
    rule_set_id: row.rule_set_id,
    order_no: Number(row.order_no),
    priority: Number(row.priority ?? DEFAULT_EDITORIAL_RULE_PRIORITY),
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
    ...(explanationPayload ? { explanation_payload: explanationPayload } : {}),
    ...(linkagePayload ? { linkage_payload: linkagePayload } : {}),
    ...(projectionPayload ? { projection_payload: projectionPayload } : {}),
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

function parseJsonObject<T extends object>(
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

function parseOptionalJsonObject<T extends object>(
  value: Record<string, unknown> | string | null,
): T | undefined {
  const parsed = parseJsonObject<T>(value);
  return Object.keys(parsed).length > 0 ? parsed : undefined;
}

function hasObjectKeys(value: Record<string, unknown> | string | null): boolean {
  return Object.keys(parseJsonObject<Record<string, unknown>>(value)).length > 0;
}
