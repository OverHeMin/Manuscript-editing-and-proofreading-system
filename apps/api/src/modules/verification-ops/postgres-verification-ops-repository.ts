import type { QueryResultRow } from "pg";
import type {
  EvaluationEvidencePackRecord,
  EvaluationPromotionRecommendationRecord,
  EvaluationRunRecord,
  EvaluationRunItemRecord,
  EvaluationSampleSetItemRecord,
  EvaluationSampleSetRecord,
  EvaluationSuiteRecord,
  ReleaseCheckProfileRecord,
  VerificationCheckProfileRecord,
  VerificationEvidenceRecord,
} from "./verification-ops-record.ts";
import type { VerificationOpsRepository } from "./verification-ops-repository.ts";

interface SqlClient {
  query<TResult extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: TResult[] }>;
}

export interface PostgresVerificationOpsRepositoryOptions {
  client: SqlClient;
}

type TimestampValue = Date | string | null;

export class PostgresVerificationOpsRepository
  implements VerificationOpsRepository
{
  private readonly client: SqlClient;

  constructor(options: PostgresVerificationOpsRepositoryOptions) {
    this.client = options.client;
  }

  async saveEvaluationSampleSet(record: EvaluationSampleSetRecord): Promise<void> {
    await this.client.query(
      `
        insert into evaluation_sample_sets (
          id, name, module, manuscript_types, risk_tags, sample_count,
          source_policy, status, admin_only, updated_at
        )
        values (
          $1, $2, $3::module_type, $4::manuscript_type[], $5::text[], $6,
          $7::jsonb, $8::registry_asset_status, $9, now()
        )
        on conflict (id) do update
        set name = excluded.name,
            module = excluded.module,
            manuscript_types = excluded.manuscript_types,
            risk_tags = excluded.risk_tags,
            sample_count = excluded.sample_count,
            source_policy = excluded.source_policy,
            status = excluded.status,
            admin_only = excluded.admin_only,
            updated_at = now()
      `,
      [
        record.id,
        record.name,
        record.module,
        record.manuscript_types,
        record.risk_tags ?? null,
        record.sample_count,
        JSON.stringify(record.source_policy),
        record.status,
        record.admin_only,
      ],
    );
  }

  async findEvaluationSampleSetById(id: string) {
    return this.queryOne<EvaluationSampleSetRecord>(
      `
        select id, name, module, manuscript_types, risk_tags, sample_count,
               source_policy, status, admin_only
        from evaluation_sample_sets
        where id = $1
      `,
      [id],
      (row) => clone({
        id: row.id,
        name: row.name,
        module: row.module,
        manuscript_types:
          asTypedArray<EvaluationSampleSetRecord["manuscript_types"][number]>(
            row.manuscript_types,
          ) ?? [],
        sample_count: row.sample_count,
        source_policy: row.source_policy,
        status: row.status,
        admin_only: row.admin_only,
        ...(asTypedArray<string>(row.risk_tags)
          ? { risk_tags: asTypedArray<string>(row.risk_tags) }
          : {}),
      }),
    );
  }

  async listEvaluationSampleSets() {
    return this.queryMany<EvaluationSampleSetRecord>(
      `
        select id, name, module, manuscript_types, risk_tags, sample_count,
               source_policy, status, admin_only
        from evaluation_sample_sets
        order by id asc
      `,
      [],
      (row) => clone({
        id: row.id,
        name: row.name,
        module: row.module,
        manuscript_types:
          asTypedArray<EvaluationSampleSetRecord["manuscript_types"][number]>(
            row.manuscript_types,
          ) ?? [],
        sample_count: row.sample_count,
        source_policy: row.source_policy,
        status: row.status,
        admin_only: row.admin_only,
        ...(asTypedArray<string>(row.risk_tags)
          ? { risk_tags: asTypedArray<string>(row.risk_tags) }
          : {}),
      }),
    );
  }

  async saveEvaluationSampleSetItem(record: EvaluationSampleSetItemRecord): Promise<void> {
    await this.client.query(
      `
        insert into evaluation_sample_set_items (
          id, sample_set_id, manuscript_id, snapshot_asset_id,
          reviewed_case_snapshot_id, module, manuscript_type, risk_tags
        )
        values ($1, $2, $3, $4, $5, $6::module_type, $7::manuscript_type, $8::text[])
        on conflict (id) do update
        set sample_set_id = excluded.sample_set_id,
            manuscript_id = excluded.manuscript_id,
            snapshot_asset_id = excluded.snapshot_asset_id,
            reviewed_case_snapshot_id = excluded.reviewed_case_snapshot_id,
            module = excluded.module,
            manuscript_type = excluded.manuscript_type,
            risk_tags = excluded.risk_tags
      `,
      [
        record.id,
        record.sample_set_id,
        record.manuscript_id,
        record.snapshot_asset_id,
        record.reviewed_case_snapshot_id,
        record.module,
        record.manuscript_type,
        record.risk_tags ?? null,
      ],
    );
  }

  async listEvaluationSampleSetItemsBySampleSetId(sampleSetId: string) {
    return this.queryMany<EvaluationSampleSetItemRecord>(
      `
        select id, sample_set_id, manuscript_id, snapshot_asset_id,
               reviewed_case_snapshot_id, module, manuscript_type, risk_tags
        from evaluation_sample_set_items
        where sample_set_id = $1
        order by id asc
      `,
      [sampleSetId],
      (row) => clone({
        id: row.id,
        sample_set_id: row.sample_set_id,
        manuscript_id: row.manuscript_id,
        snapshot_asset_id: row.snapshot_asset_id,
        reviewed_case_snapshot_id: row.reviewed_case_snapshot_id,
        module: row.module,
        manuscript_type: row.manuscript_type,
        ...(asTypedArray<string>(row.risk_tags)
          ? { risk_tags: asTypedArray<string>(row.risk_tags) }
          : {}),
      }),
    );
  }

  async saveVerificationCheckProfile(record: VerificationCheckProfileRecord): Promise<void> {
    await this.client.query(
      `
        insert into verification_check_profiles (
          id, name, check_type, status, tool_ids, admin_only, updated_at
        )
        values (
          $1, $2, $3::verification_check_type, $4::registry_asset_status, $5::text[], $6, now()
        )
        on conflict (id) do update
        set name = excluded.name,
            check_type = excluded.check_type,
            status = excluded.status,
            tool_ids = excluded.tool_ids,
            admin_only = excluded.admin_only,
            updated_at = now()
      `,
      [
        record.id,
        record.name,
        record.check_type,
        record.status,
        record.tool_ids ?? null,
        record.admin_only,
      ],
    );
  }

  async findVerificationCheckProfileById(id: string) {
    return this.queryOne<VerificationCheckProfileRecord>(
      `
        select id, name, check_type, status, tool_ids, admin_only
        from verification_check_profiles
        where id = $1
      `,
      [id],
      (row) => clone({
        id: row.id,
        name: row.name,
        check_type: row.check_type,
        status: row.status,
        admin_only: row.admin_only,
        ...(asTypedArray<string>(row.tool_ids)
          ? { tool_ids: asTypedArray<string>(row.tool_ids) }
          : {}),
      }),
    );
  }

  async listVerificationCheckProfiles() {
    return this.queryMany<VerificationCheckProfileRecord>(
      `
        select id, name, check_type, status, tool_ids, admin_only
        from verification_check_profiles
        order by id asc
      `,
      [],
      (row) => clone({
        id: row.id,
        name: row.name,
        check_type: row.check_type,
        status: row.status,
        admin_only: row.admin_only,
        ...(asTypedArray<string>(row.tool_ids)
          ? { tool_ids: asTypedArray<string>(row.tool_ids) }
          : {}),
      }),
    );
  }

  async saveReleaseCheckProfile(record: ReleaseCheckProfileRecord): Promise<void> {
    await this.client.query(
      `
        insert into release_check_profiles (
          id, name, check_type, status, verification_check_profile_ids, admin_only, updated_at
        )
        values (
          $1, $2, $3::verification_check_type, $4::registry_asset_status, $5::text[], $6, now()
        )
        on conflict (id) do update
        set name = excluded.name,
            check_type = excluded.check_type,
            status = excluded.status,
            verification_check_profile_ids = excluded.verification_check_profile_ids,
            admin_only = excluded.admin_only,
            updated_at = now()
      `,
      [
        record.id,
        record.name,
        record.check_type,
        record.status,
        record.verification_check_profile_ids,
        record.admin_only,
      ],
    );
  }

  async findReleaseCheckProfileById(id: string) {
    return this.queryOne<ReleaseCheckProfileRecord>(
      `
        select id, name, check_type, status, verification_check_profile_ids, admin_only
        from release_check_profiles
        where id = $1
      `,
      [id],
      (row) => clone({
        id: row.id,
        name: row.name,
        check_type: row.check_type,
        status: row.status,
        verification_check_profile_ids:
          asTypedArray<string>(row.verification_check_profile_ids) ?? [],
        admin_only: row.admin_only,
      }),
    );
  }

  async listReleaseCheckProfiles() {
    return this.queryMany<ReleaseCheckProfileRecord>(
      `
        select id, name, check_type, status, verification_check_profile_ids, admin_only
        from release_check_profiles
        order by id asc
      `,
      [],
      (row) => clone({
        id: row.id,
        name: row.name,
        check_type: row.check_type,
        status: row.status,
        verification_check_profile_ids:
          asTypedArray<string>(row.verification_check_profile_ids) ?? [],
        admin_only: row.admin_only,
      }),
    );
  }

  async saveEvaluationSuite(record: EvaluationSuiteRecord): Promise<void> {
    await this.client.query(
      `
        insert into evaluation_suites (
          id, name, suite_type, status, verification_check_profile_ids,
          module_scope, module_scope_is_any, requires_production_baseline,
          supports_ab_comparison, hard_gate_policy, score_weights, admin_only, updated_at
        )
        values (
          $1, $2, $3::evaluation_suite_type, $4::evaluation_suite_status, $5::text[],
          $6::module_type[], $7, $8, $9, $10::jsonb, $11::jsonb, $12, now()
        )
        on conflict (id) do update
        set name = excluded.name,
            suite_type = excluded.suite_type,
            status = excluded.status,
            verification_check_profile_ids = excluded.verification_check_profile_ids,
            module_scope = excluded.module_scope,
            module_scope_is_any = excluded.module_scope_is_any,
            requires_production_baseline = excluded.requires_production_baseline,
            supports_ab_comparison = excluded.supports_ab_comparison,
            hard_gate_policy = excluded.hard_gate_policy,
            score_weights = excluded.score_weights,
            admin_only = excluded.admin_only,
            updated_at = now()
      `,
      [
        record.id,
        record.name,
        record.suite_type,
        record.status,
        record.verification_check_profile_ids,
        record.module_scope === "any" ? null : record.module_scope,
        record.module_scope === "any",
        record.requires_production_baseline,
        record.supports_ab_comparison,
        JSON.stringify(record.hard_gate_policy),
        JSON.stringify(record.score_weights),
        record.admin_only,
      ],
    );
  }

  async findEvaluationSuiteById(id: string) {
    return this.queryOne<EvaluationSuiteRecord>(
      `
        select id, name, suite_type, status, verification_check_profile_ids,
               module_scope, module_scope_is_any, requires_production_baseline,
               supports_ab_comparison, hard_gate_policy, score_weights, admin_only
        from evaluation_suites
        where id = $1
      `,
      [id],
      (row) => clone({
        id: row.id,
        name: row.name,
        suite_type: row.suite_type,
        status: row.status,
        verification_check_profile_ids:
          asTypedArray<string>(row.verification_check_profile_ids) ?? [],
        module_scope: row.module_scope_is_any
          ? "any"
          : (
              asTypedArray<
                Extract<EvaluationSuiteRecord["module_scope"], string[]>[number]
              >(row.module_scope) ?? []
            ),
        requires_production_baseline: row.requires_production_baseline,
        supports_ab_comparison: row.supports_ab_comparison,
        hard_gate_policy: row.hard_gate_policy,
        score_weights: row.score_weights,
        admin_only: row.admin_only,
      }),
    );
  }

  async listEvaluationSuites() {
    return this.queryMany<EvaluationSuiteRecord>(
      `
        select id, name, suite_type, status, verification_check_profile_ids,
               module_scope, module_scope_is_any, requires_production_baseline,
               supports_ab_comparison, hard_gate_policy, score_weights, admin_only
        from evaluation_suites
        order by id asc
      `,
      [],
      (row) => clone({
        id: row.id,
        name: row.name,
        suite_type: row.suite_type,
        status: row.status,
        verification_check_profile_ids:
          asTypedArray<string>(row.verification_check_profile_ids) ?? [],
        module_scope: row.module_scope_is_any
          ? "any"
          : (
              asTypedArray<
                Extract<EvaluationSuiteRecord["module_scope"], string[]>[number]
              >(row.module_scope) ?? []
            ),
        requires_production_baseline: row.requires_production_baseline,
        supports_ab_comparison: row.supports_ab_comparison,
        hard_gate_policy: row.hard_gate_policy,
        score_weights: row.score_weights,
        admin_only: row.admin_only,
      }),
    );
  }

  async saveVerificationEvidence(record: VerificationEvidenceRecord): Promise<void> {
    await this.client.query(
      `
        insert into verification_evidence (
          id, kind, label, uri, artifact_asset_id, check_profile_id, created_at
        )
        values ($1, $2::verification_evidence_kind, $3, $4, $5, $6, $7::timestamptz)
        on conflict (id) do update
        set kind = excluded.kind,
            label = excluded.label,
            uri = excluded.uri,
            artifact_asset_id = excluded.artifact_asset_id,
            check_profile_id = excluded.check_profile_id,
            created_at = excluded.created_at
      `,
      [
        record.id,
        record.kind,
        record.label,
        record.uri ?? null,
        record.artifact_asset_id ?? null,
        record.check_profile_id ?? null,
        record.created_at,
      ],
    );
  }

  async findVerificationEvidenceById(id: string) {
    return this.queryOne<VerificationEvidenceRecord>(
      `
        select id, kind, label, uri, artifact_asset_id, check_profile_id, created_at
        from verification_evidence
        where id = $1
      `,
      [id],
      (row) => clone({
        id: row.id,
        kind: row.kind,
        label: row.label,
        created_at: asIso(row.created_at),
        ...(row.uri ? { uri: row.uri } : {}),
        ...(row.artifact_asset_id
          ? { artifact_asset_id: row.artifact_asset_id }
          : {}),
        ...(row.check_profile_id ? { check_profile_id: row.check_profile_id } : {}),
      }),
    );
  }

  async listVerificationEvidence() {
    return this.queryMany<VerificationEvidenceRecord>(
      `
        select id, kind, label, uri, artifact_asset_id, check_profile_id, created_at
        from verification_evidence
        order by id asc
      `,
      [],
      (row) => clone({
        id: row.id,
        kind: row.kind,
        label: row.label,
        created_at: asIso(row.created_at),
        ...(row.uri ? { uri: row.uri } : {}),
        ...(row.artifact_asset_id
          ? { artifact_asset_id: row.artifact_asset_id }
          : {}),
        ...(row.check_profile_id ? { check_profile_id: row.check_profile_id } : {}),
      }),
    );
  }

  async saveEvaluationRun(record: EvaluationRunRecord): Promise<void> {
    await this.client.query(
      `
        insert into evaluation_runs (
          id, suite_id, sample_set_id, baseline_binding, candidate_binding,
          release_check_profile_id, run_item_count, status, evidence_ids,
          started_at, finished_at, updated_at
        )
        values (
          $1, $2, $3, $4::jsonb, $5::jsonb,
          $6, $7, $8::evaluation_run_status, $9::text[],
          $10::timestamptz, $11::timestamptz, now()
        )
        on conflict (id) do update
        set suite_id = excluded.suite_id,
            sample_set_id = excluded.sample_set_id,
            baseline_binding = excluded.baseline_binding,
            candidate_binding = excluded.candidate_binding,
            release_check_profile_id = excluded.release_check_profile_id,
            run_item_count = excluded.run_item_count,
            status = excluded.status,
            evidence_ids = excluded.evidence_ids,
            started_at = excluded.started_at,
            finished_at = excluded.finished_at,
            updated_at = now()
      `,
      [
        record.id,
        record.suite_id,
        record.sample_set_id ?? null,
        record.baseline_binding ? JSON.stringify(record.baseline_binding) : null,
        record.candidate_binding ? JSON.stringify(record.candidate_binding) : null,
        record.release_check_profile_id ?? null,
        record.run_item_count,
        record.status,
        record.evidence_ids,
        record.started_at,
        record.finished_at ?? null,
      ],
    );
  }

  async findEvaluationRunById(id: string) {
    return this.queryOne<EvaluationRunRecord>(
      `
        select id, suite_id, sample_set_id, baseline_binding, candidate_binding,
               release_check_profile_id, run_item_count, status, evidence_ids,
               started_at, finished_at
        from evaluation_runs
        where id = $1
      `,
      [id],
      (row) => clone({
        id: row.id,
        suite_id: row.suite_id,
        run_item_count: row.run_item_count,
        status: row.status,
        evidence_ids: asTypedArray<string>(row.evidence_ids) ?? [],
        started_at: asIso(row.started_at),
        ...(row.sample_set_id ? { sample_set_id: row.sample_set_id } : {}),
        ...(row.baseline_binding ? { baseline_binding: row.baseline_binding } : {}),
        ...(row.candidate_binding ? { candidate_binding: row.candidate_binding } : {}),
        ...(row.release_check_profile_id
          ? { release_check_profile_id: row.release_check_profile_id }
          : {}),
        ...(row.finished_at ? { finished_at: asIso(row.finished_at) } : {}),
      }),
    );
  }

  async listEvaluationRunsBySuiteId(suiteId: string) {
    return this.queryMany<EvaluationRunRecord>(
      `
        select id, suite_id, sample_set_id, baseline_binding, candidate_binding,
               release_check_profile_id, run_item_count, status, evidence_ids,
               started_at, finished_at
        from evaluation_runs
        where suite_id = $1
        order by id asc
      `,
      [suiteId],
      (row) => clone({
        id: row.id,
        suite_id: row.suite_id,
        run_item_count: row.run_item_count,
        status: row.status,
        evidence_ids: asTypedArray<string>(row.evidence_ids) ?? [],
        started_at: asIso(row.started_at),
        ...(row.sample_set_id ? { sample_set_id: row.sample_set_id } : {}),
        ...(row.baseline_binding ? { baseline_binding: row.baseline_binding } : {}),
        ...(row.candidate_binding ? { candidate_binding: row.candidate_binding } : {}),
        ...(row.release_check_profile_id
          ? { release_check_profile_id: row.release_check_profile_id }
          : {}),
        ...(row.finished_at ? { finished_at: asIso(row.finished_at) } : {}),
      }),
    );
  }

  async saveEvaluationRunItem(record: EvaluationRunItemRecord): Promise<void> {
    await this.client.query(
      `
        insert into evaluation_run_items (
          id, evaluation_run_id, sample_set_item_id, lane, result_asset_id,
          hard_gate_passed, weighted_score, failure_kind, failure_reason,
          diff_summary, requires_human_review, updated_at
        )
        values (
          $1, $2, $3, $4::frozen_experiment_lane, $5,
          $6, $7, $8::evaluation_run_item_failure_kind, $9,
          $10, $11, now()
        )
        on conflict (id) do update
        set evaluation_run_id = excluded.evaluation_run_id,
            sample_set_item_id = excluded.sample_set_item_id,
            lane = excluded.lane,
            result_asset_id = excluded.result_asset_id,
            hard_gate_passed = excluded.hard_gate_passed,
            weighted_score = excluded.weighted_score,
            failure_kind = excluded.failure_kind,
            failure_reason = excluded.failure_reason,
            diff_summary = excluded.diff_summary,
            requires_human_review = excluded.requires_human_review,
            updated_at = now()
      `,
      [
        record.id,
        record.evaluation_run_id,
        record.sample_set_item_id,
        record.lane,
        record.result_asset_id ?? null,
        record.hard_gate_passed ?? null,
        record.weighted_score ?? null,
        record.failure_kind ?? null,
        record.failure_reason ?? null,
        record.diff_summary ?? null,
        record.requires_human_review ?? null,
      ],
    );
  }

  async findEvaluationRunItemById(id: string) {
    return this.queryOne<EvaluationRunItemRecord>(
      `
        select id, evaluation_run_id, sample_set_item_id, lane, result_asset_id,
               hard_gate_passed, weighted_score, failure_kind, failure_reason,
               diff_summary, requires_human_review
        from evaluation_run_items
        where id = $1
      `,
      [id],
      (row) => clone({
        id: row.id,
        evaluation_run_id: row.evaluation_run_id,
        sample_set_item_id: row.sample_set_item_id,
        lane: row.lane,
        ...(row.result_asset_id ? { result_asset_id: row.result_asset_id } : {}),
        ...(row.hard_gate_passed != null
          ? { hard_gate_passed: row.hard_gate_passed }
          : {}),
        ...(row.weighted_score != null
          ? { weighted_score: row.weighted_score }
          : {}),
        ...(row.failure_kind ? { failure_kind: row.failure_kind } : {}),
        ...(row.failure_reason ? { failure_reason: row.failure_reason } : {}),
        ...(row.diff_summary ? { diff_summary: row.diff_summary } : {}),
        ...(row.requires_human_review != null
          ? { requires_human_review: row.requires_human_review }
          : {}),
      }),
    );
  }

  async listEvaluationRunItemsByRunId(runId: string) {
    return this.queryMany<EvaluationRunItemRecord>(
      `
        select id, evaluation_run_id, sample_set_item_id, lane, result_asset_id,
               hard_gate_passed, weighted_score, failure_kind, failure_reason,
               diff_summary, requires_human_review
        from evaluation_run_items
        where evaluation_run_id = $1
        order by id asc
      `,
      [runId],
      (row) => clone({
        id: row.id,
        evaluation_run_id: row.evaluation_run_id,
        sample_set_item_id: row.sample_set_item_id,
        lane: row.lane,
        ...(row.result_asset_id ? { result_asset_id: row.result_asset_id } : {}),
        ...(row.hard_gate_passed != null
          ? { hard_gate_passed: row.hard_gate_passed }
          : {}),
        ...(row.weighted_score != null
          ? { weighted_score: row.weighted_score }
          : {}),
        ...(row.failure_kind ? { failure_kind: row.failure_kind } : {}),
        ...(row.failure_reason ? { failure_reason: row.failure_reason } : {}),
        ...(row.diff_summary ? { diff_summary: row.diff_summary } : {}),
        ...(row.requires_human_review != null
          ? { requires_human_review: row.requires_human_review }
          : {}),
      }),
    );
  }

  async saveEvaluationEvidencePack(record: EvaluationEvidencePackRecord): Promise<void> {
    await this.client.query(
      `
        insert into evaluation_evidence_packs (
          id, experiment_run_id, summary_status, score_summary, regression_summary,
          failure_summary, cost_summary, latency_summary, created_at
        )
        values (
          $1, $2, $3::evaluation_decision_status, $4, $5,
          $6, $7, $8, $9::timestamptz
        )
        on conflict (id) do update
        set experiment_run_id = excluded.experiment_run_id,
            summary_status = excluded.summary_status,
            score_summary = excluded.score_summary,
            regression_summary = excluded.regression_summary,
            failure_summary = excluded.failure_summary,
            cost_summary = excluded.cost_summary,
            latency_summary = excluded.latency_summary,
            created_at = excluded.created_at
      `,
      [
        record.id,
        record.experiment_run_id,
        record.summary_status,
        record.score_summary ?? null,
        record.regression_summary ?? null,
        record.failure_summary ?? null,
        record.cost_summary ?? null,
        record.latency_summary ?? null,
        record.created_at,
      ],
    );
  }

  async findEvaluationEvidencePackById(id: string) {
    return this.queryOne<EvaluationEvidencePackRecord>(
      `
        select id, experiment_run_id, summary_status, score_summary, regression_summary,
               failure_summary, cost_summary, latency_summary, created_at
        from evaluation_evidence_packs
        where id = $1
      `,
      [id],
      (row) => clone({
        id: row.id,
        experiment_run_id: row.experiment_run_id,
        summary_status: row.summary_status,
        created_at: asIso(row.created_at),
        ...(row.score_summary ? { score_summary: row.score_summary } : {}),
        ...(row.regression_summary
          ? { regression_summary: row.regression_summary }
          : {}),
        ...(row.failure_summary ? { failure_summary: row.failure_summary } : {}),
        ...(row.cost_summary ? { cost_summary: row.cost_summary } : {}),
        ...(row.latency_summary ? { latency_summary: row.latency_summary } : {}),
      }),
    );
  }

  async saveEvaluationPromotionRecommendation(
    record: EvaluationPromotionRecommendationRecord,
  ): Promise<void> {
    await this.client.query(
      `
        insert into evaluation_promotion_recommendations (
          id, experiment_run_id, evidence_pack_id, status,
          decision_reason, learning_candidate_ids, created_at
        )
        values ($1, $2, $3, $4::evaluation_decision_status, $5, $6::text[], $7::timestamptz)
        on conflict (id) do update
        set experiment_run_id = excluded.experiment_run_id,
            evidence_pack_id = excluded.evidence_pack_id,
            status = excluded.status,
            decision_reason = excluded.decision_reason,
            learning_candidate_ids = excluded.learning_candidate_ids,
            created_at = excluded.created_at
      `,
      [
        record.id,
        record.experiment_run_id,
        record.evidence_pack_id,
        record.status,
        record.decision_reason ?? null,
        record.learning_candidate_ids ?? null,
        record.created_at,
      ],
    );
  }

  private async queryOne<T>(
    sql: string,
    values: readonly unknown[],
    map: (row: QueryResultRow) => T,
  ): Promise<T | undefined> {
    const result = await this.client.query(sql, values);
    return result.rows[0] ? map(result.rows[0]) : undefined;
  }

  private async queryMany<T>(
    sql: string,
    values: readonly unknown[],
    map: (row: QueryResultRow) => T,
  ): Promise<T[]> {
    const result = await this.client.query(sql, values);
    return result.rows.map(map);
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function asIso(value: TimestampValue): string {
  if (!value) {
    throw new Error("Expected timestamp value to be present.");
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function asTypedArray<T extends string>(
  value: T[] | string | null | undefined,
): T[] | undefined {
  if (value == null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return [...value] as T[];
  }

  return parsePgArray(value) as T[];
}

function parsePgArray(value: string): string[] {
  if (value === "{}") {
    return [];
  }

  return value
    .slice(1, -1)
    .split(",")
    .map((item) => item.replace(/^\"|\"$/g, ""))
    .filter((item) => item.length > 0);
}
