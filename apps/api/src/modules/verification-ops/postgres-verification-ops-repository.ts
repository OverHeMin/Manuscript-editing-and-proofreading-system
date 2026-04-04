import type {
  EvaluationEvidencePackRecord,
  EvaluationPromotionRecommendationRecord,
  EvaluationRunRecord,
  EvaluationRunItemRecord,
  EvaluationSampleSetItemRecord,
  EvaluationSampleSetRecord,
  FrozenExperimentBindingRecord,
  EvaluationSuiteRecord,
  GovernedExecutionEvaluationSourceRecord,
  ReleaseCheckProfileRecord,
  VerificationCheckProfileRecord,
  VerificationEvidenceRecord,
} from "./verification-ops-record.ts";
import type {
  EvaluationSuiteFinalizationHistoryWindowPreset,
  EvaluationSuiteFinalizationRecord,
  VerificationOpsRepository,
} from "./verification-ops-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface EvaluationSampleSetRow {
  id: string;
  name: string;
  module: EvaluationSampleSetRecord["module"];
  manuscript_types: string[] | string;
  risk_tags: string[] | string;
  sample_count: number;
  source_policy: EvaluationSampleSetRecord["source_policy"] | string;
  status: EvaluationSampleSetRecord["status"];
  admin_only: boolean;
}

interface EvaluationSampleSetItemRow {
  id: string;
  sample_set_id: string;
  manuscript_id: string;
  snapshot_asset_id: string;
  reviewed_case_snapshot_id: string;
  module: EvaluationSampleSetItemRecord["module"];
  manuscript_type: EvaluationSampleSetItemRecord["manuscript_type"];
  risk_tags: string[] | string;
}

interface VerificationCheckProfileRow {
  id: string;
  name: string;
  check_type: VerificationCheckProfileRecord["check_type"];
  status: VerificationCheckProfileRecord["status"];
  tool_ids: string[] | string;
  admin_only: boolean;
}

interface ReleaseCheckProfileRow {
  id: string;
  name: string;
  check_type: ReleaseCheckProfileRecord["check_type"];
  status: ReleaseCheckProfileRecord["status"];
  verification_check_profile_ids: string[] | string;
  admin_only: boolean;
}

interface EvaluationSuiteRow {
  id: string;
  name: string;
  suite_type: EvaluationSuiteRecord["suite_type"];
  status: EvaluationSuiteRecord["status"];
  verification_check_profile_ids: string[] | string;
  module_scope: string[] | string | null;
  requires_production_baseline: boolean;
  supports_ab_comparison: boolean;
  hard_gate_policy: EvaluationSuiteRecord["hard_gate_policy"] | string;
  score_weights: EvaluationSuiteRecord["score_weights"] | string;
  admin_only: boolean;
}

interface VerificationEvidenceRow {
  id: string;
  kind: VerificationEvidenceRecord["kind"];
  label: string;
  uri: string | null;
  artifact_asset_id: string | null;
  check_profile_id: string | null;
  retrieval_snapshot_id: string | null;
  retrieval_quality_run_id: string | null;
  created_at: Date;
}

interface EvaluationRunRow {
  id: string;
  suite_id: string;
  sample_set_id: string | null;
  baseline_binding: FrozenExperimentBindingRecord | string | null;
  candidate_binding: FrozenExperimentBindingRecord | string | null;
  governed_source: GovernedExecutionEvaluationSourceRecord | string | null;
  release_check_profile_id: string | null;
  run_item_count: number;
  status: EvaluationRunRecord["status"];
  evidence_ids: string[] | string;
  started_at: Date;
  finished_at: Date | null;
}

interface EvaluationRunItemRow {
  id: string;
  evaluation_run_id: string;
  sample_set_item_id: string;
  lane: EvaluationRunItemRecord["lane"];
  result_asset_id: string | null;
  hard_gate_passed: boolean | null;
  weighted_score: number | null;
  failure_kind: EvaluationRunItemRecord["failure_kind"] | null;
  failure_reason: string | null;
  diff_summary: string | null;
  requires_human_review: boolean | null;
}

interface EvaluationEvidencePackRow {
  id: string;
  experiment_run_id: string;
  summary_status: EvaluationEvidencePackRecord["summary_status"];
  score_summary: string | null;
  regression_summary: string | null;
  failure_summary: string | null;
  cost_summary: string | null;
  latency_summary: string | null;
  created_at: Date;
}

interface EvaluationPromotionRecommendationRow {
  id: string;
  experiment_run_id: string;
  evidence_pack_id: string;
  status: EvaluationPromotionRecommendationRecord["status"];
  decision_reason: string | null;
  learning_candidate_ids: string[] | string;
  created_at: Date;
}

interface EvaluationSuiteFinalizationRow extends EvaluationRunRow {
  evidence_pack_id: string;
  evidence_pack_experiment_run_id: string;
  evidence_pack_summary_status: EvaluationEvidencePackRecord["summary_status"];
  evidence_pack_score_summary: string | null;
  evidence_pack_regression_summary: string | null;
  evidence_pack_failure_summary: string | null;
  evidence_pack_cost_summary: string | null;
  evidence_pack_latency_summary: string | null;
  evidence_pack_created_at: Date;
  recommendation_id: string;
  recommendation_experiment_run_id: string;
  recommendation_evidence_pack_id: string;
  recommendation_status: EvaluationPromotionRecommendationRecord["status"];
  recommendation_decision_reason: string | null;
  recommendation_learning_candidate_ids: string[] | string;
  recommendation_created_at: Date;
}

export class PostgresVerificationOpsRepository
  implements VerificationOpsRepository
{
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async saveEvaluationSampleSet(record: EvaluationSampleSetRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into evaluation_sample_sets (
          id,
          name,
          module,
          manuscript_types,
          risk_tags,
          sample_count,
          source_policy,
          status,
          admin_only
        )
        values ($1, $2, $3, $4::manuscript_type[], $5::text[], $6, $7::jsonb, $8, $9)
        on conflict (id) do update
        set
          name = excluded.name,
          module = excluded.module,
          manuscript_types = excluded.manuscript_types,
          risk_tags = excluded.risk_tags,
          sample_count = excluded.sample_count,
          source_policy = excluded.source_policy,
          status = excluded.status,
          admin_only = excluded.admin_only
      `,
      [
        record.id,
        record.name,
        record.module,
        record.manuscript_types,
        record.risk_tags ?? [],
        record.sample_count,
        JSON.stringify(record.source_policy),
        record.status,
        record.admin_only,
      ],
    );
  }

  async findEvaluationSampleSetById(
    id: string,
  ): Promise<EvaluationSampleSetRecord | undefined> {
    const result = await this.dependencies.client.query<EvaluationSampleSetRow>(
      `
        select
          id,
          name,
          module,
          manuscript_types,
          risk_tags,
          sample_count,
          source_policy,
          status,
          admin_only
        from evaluation_sample_sets
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapEvaluationSampleSetRow(result.rows[0]) : undefined;
  }

  async listEvaluationSampleSets(): Promise<EvaluationSampleSetRecord[]> {
    const result = await this.dependencies.client.query<EvaluationSampleSetRow>(
      `
        select
          id,
          name,
          module,
          manuscript_types,
          risk_tags,
          sample_count,
          source_policy,
          status,
          admin_only
        from evaluation_sample_sets
        order by id asc
      `,
    );

    return result.rows.map(mapEvaluationSampleSetRow);
  }

  async saveEvaluationSampleSetItem(
    record: EvaluationSampleSetItemRecord,
  ): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into evaluation_sample_set_items (
          id,
          sample_set_id,
          manuscript_id,
          snapshot_asset_id,
          reviewed_case_snapshot_id,
          module,
          manuscript_type,
          risk_tags
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::text[])
        on conflict (id) do update
        set
          sample_set_id = excluded.sample_set_id,
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
        record.risk_tags ?? [],
      ],
    );
  }

  async listEvaluationSampleSetItemsBySampleSetId(
    sampleSetId: string,
  ): Promise<EvaluationSampleSetItemRecord[]> {
    const result =
      await this.dependencies.client.query<EvaluationSampleSetItemRow>(
        `
          select
            id,
            sample_set_id,
            manuscript_id,
            snapshot_asset_id,
            reviewed_case_snapshot_id,
            module,
            manuscript_type,
            risk_tags
          from evaluation_sample_set_items
          where sample_set_id = $1
          order by id asc
        `,
        [sampleSetId],
      );

    return result.rows.map(mapEvaluationSampleSetItemRow);
  }

  async saveVerificationCheckProfile(
    record: VerificationCheckProfileRecord,
  ): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into verification_check_profiles (
          id,
          name,
          check_type,
          status,
          tool_ids,
          admin_only
        )
        values ($1, $2, $3, $4, $5::text[], $6)
        on conflict (id) do update
        set
          name = excluded.name,
          check_type = excluded.check_type,
          status = excluded.status,
          tool_ids = excluded.tool_ids,
          admin_only = excluded.admin_only
      `,
      [
        record.id,
        record.name,
        record.check_type,
        record.status,
        record.tool_ids ?? [],
        record.admin_only,
      ],
    );
  }

  async findVerificationCheckProfileById(
    id: string,
  ): Promise<VerificationCheckProfileRecord | undefined> {
    const result =
      await this.dependencies.client.query<VerificationCheckProfileRow>(
        `
          select
            id,
            name,
            check_type,
            status,
            tool_ids,
            admin_only
          from verification_check_profiles
          where id = $1
        `,
        [id],
      );

    return result.rows[0]
      ? mapVerificationCheckProfileRow(result.rows[0])
      : undefined;
  }

  async listVerificationCheckProfiles(): Promise<VerificationCheckProfileRecord[]> {
    const result =
      await this.dependencies.client.query<VerificationCheckProfileRow>(
        `
          select
            id,
            name,
            check_type,
            status,
            tool_ids,
            admin_only
          from verification_check_profiles
          order by id asc
        `,
      );

    return result.rows.map(mapVerificationCheckProfileRow);
  }

  async saveReleaseCheckProfile(record: ReleaseCheckProfileRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into release_check_profiles (
          id,
          name,
          check_type,
          status,
          verification_check_profile_ids,
          admin_only
        )
        values ($1, $2, $3, $4, $5::text[], $6)
        on conflict (id) do update
        set
          name = excluded.name,
          check_type = excluded.check_type,
          status = excluded.status,
          verification_check_profile_ids = excluded.verification_check_profile_ids,
          admin_only = excluded.admin_only
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

  async findReleaseCheckProfileById(
    id: string,
  ): Promise<ReleaseCheckProfileRecord | undefined> {
    const result = await this.dependencies.client.query<ReleaseCheckProfileRow>(
      `
        select
          id,
          name,
          check_type,
          status,
          verification_check_profile_ids,
          admin_only
        from release_check_profiles
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapReleaseCheckProfileRow(result.rows[0]) : undefined;
  }

  async listReleaseCheckProfiles(): Promise<ReleaseCheckProfileRecord[]> {
    const result = await this.dependencies.client.query<ReleaseCheckProfileRow>(
      `
        select
          id,
          name,
          check_type,
          status,
          verification_check_profile_ids,
          admin_only
        from release_check_profiles
        order by id asc
      `,
    );

    return result.rows.map(mapReleaseCheckProfileRow);
  }

  async saveEvaluationSuite(record: EvaluationSuiteRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into evaluation_suites (
          id,
          name,
          suite_type,
          status,
          verification_check_profile_ids,
          module_scope,
          requires_production_baseline,
          supports_ab_comparison,
          hard_gate_policy,
          score_weights,
          admin_only
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5::text[],
          $6::manuscript_module[],
          $7,
          $8,
          $9::jsonb,
          $10::jsonb,
          $11
        )
        on conflict (id) do update
        set
          name = excluded.name,
          suite_type = excluded.suite_type,
          status = excluded.status,
          verification_check_profile_ids = excluded.verification_check_profile_ids,
          module_scope = excluded.module_scope,
          requires_production_baseline = excluded.requires_production_baseline,
          supports_ab_comparison = excluded.supports_ab_comparison,
          hard_gate_policy = excluded.hard_gate_policy,
          score_weights = excluded.score_weights,
          admin_only = excluded.admin_only
      `,
      [
        record.id,
        record.name,
        record.suite_type,
        record.status,
        record.verification_check_profile_ids,
        record.module_scope === "any" ? null : record.module_scope,
        record.requires_production_baseline,
        record.supports_ab_comparison,
        JSON.stringify(record.hard_gate_policy),
        JSON.stringify(record.score_weights),
        record.admin_only,
      ],
    );
  }

  async findEvaluationSuiteById(
    id: string,
  ): Promise<EvaluationSuiteRecord | undefined> {
    const result = await this.dependencies.client.query<EvaluationSuiteRow>(
      `
        select
          id,
          name,
          suite_type,
          status,
          verification_check_profile_ids,
          module_scope,
          requires_production_baseline,
          supports_ab_comparison,
          hard_gate_policy,
          score_weights,
          admin_only
        from evaluation_suites
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapEvaluationSuiteRow(result.rows[0]) : undefined;
  }

  async listEvaluationSuites(): Promise<EvaluationSuiteRecord[]> {
    const result = await this.dependencies.client.query<EvaluationSuiteRow>(
      `
        select
          id,
          name,
          suite_type,
          status,
          verification_check_profile_ids,
          module_scope,
          requires_production_baseline,
          supports_ab_comparison,
          hard_gate_policy,
          score_weights,
          admin_only
        from evaluation_suites
        order by id asc
      `,
    );

    return result.rows.map(mapEvaluationSuiteRow);
  }

  async saveVerificationEvidence(record: VerificationEvidenceRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into verification_evidence (
          id,
          kind,
          label,
          uri,
          artifact_asset_id,
          check_profile_id,
          retrieval_snapshot_id,
          retrieval_quality_run_id,
          created_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        on conflict (id) do update
        set
          kind = excluded.kind,
          label = excluded.label,
          uri = excluded.uri,
          artifact_asset_id = excluded.artifact_asset_id,
          check_profile_id = excluded.check_profile_id,
          retrieval_snapshot_id = excluded.retrieval_snapshot_id,
          retrieval_quality_run_id = excluded.retrieval_quality_run_id,
          created_at = excluded.created_at
      `,
      [
        record.id,
        record.kind,
        record.label,
        record.uri ?? null,
        record.artifact_asset_id ?? null,
        record.check_profile_id ?? null,
        record.retrieval_snapshot_id ?? null,
        record.retrieval_quality_run_id ?? null,
        record.created_at,
      ],
    );
  }

  async findVerificationEvidenceById(
    id: string,
  ): Promise<VerificationEvidenceRecord | undefined> {
    const result = await this.dependencies.client.query<VerificationEvidenceRow>(
      `
        select
          id,
          kind,
          label,
          uri,
          artifact_asset_id,
          check_profile_id,
          retrieval_snapshot_id,
          retrieval_quality_run_id,
          created_at
        from verification_evidence
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapVerificationEvidenceRow(result.rows[0]) : undefined;
  }

  async listVerificationEvidence(): Promise<VerificationEvidenceRecord[]> {
    const result = await this.dependencies.client.query<VerificationEvidenceRow>(
      `
        select
          id,
          kind,
          label,
          uri,
          artifact_asset_id,
          check_profile_id,
          retrieval_snapshot_id,
          retrieval_quality_run_id,
          created_at
        from verification_evidence
        order by created_at asc, id asc
      `,
    );

    return result.rows.map(mapVerificationEvidenceRow);
  }

  async saveEvaluationRun(record: EvaluationRunRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into evaluation_runs (
          id,
          suite_id,
          sample_set_id,
          baseline_binding,
          candidate_binding,
          governed_source,
          release_check_profile_id,
          run_item_count,
          status,
          evidence_ids,
          started_at,
          finished_at
        )
        values (
          $1,
          $2,
          $3,
          $4::jsonb,
          $5::jsonb,
          $6::jsonb,
          $7,
          $8,
          $9,
          $10::text[],
          $11,
          $12
        )
        on conflict (id) do update
        set
          suite_id = excluded.suite_id,
          sample_set_id = excluded.sample_set_id,
          baseline_binding = excluded.baseline_binding,
          candidate_binding = excluded.candidate_binding,
          governed_source = excluded.governed_source,
          release_check_profile_id = excluded.release_check_profile_id,
          run_item_count = excluded.run_item_count,
          status = excluded.status,
          evidence_ids = excluded.evidence_ids,
          started_at = excluded.started_at,
          finished_at = excluded.finished_at
      `,
      [
        record.id,
        record.suite_id,
        record.sample_set_id ?? null,
        record.baseline_binding ? JSON.stringify(record.baseline_binding) : null,
        record.candidate_binding ? JSON.stringify(record.candidate_binding) : null,
        record.governed_source ? JSON.stringify(record.governed_source) : null,
        record.release_check_profile_id ?? null,
        record.run_item_count,
        record.status,
        record.evidence_ids,
        record.started_at,
        record.finished_at ?? null,
      ],
    );
  }

  async findEvaluationRunById(
    id: string,
  ): Promise<EvaluationRunRecord | undefined> {
    const result = await this.dependencies.client.query<EvaluationRunRow>(
      `
        select
          id,
          suite_id,
          sample_set_id,
          baseline_binding,
          candidate_binding,
          governed_source,
          release_check_profile_id,
          run_item_count,
          status,
          evidence_ids,
          started_at,
          finished_at
        from evaluation_runs
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapEvaluationRunRow(result.rows[0]) : undefined;
  }

  async listEvaluationRunsBySuiteId(suiteId: string): Promise<EvaluationRunRecord[]> {
    const result = await this.dependencies.client.query<EvaluationRunRow>(
      `
        select
          id,
          suite_id,
          sample_set_id,
          baseline_binding,
          candidate_binding,
          governed_source,
          release_check_profile_id,
          run_item_count,
          status,
          evidence_ids,
          started_at,
          finished_at
        from evaluation_runs
        where suite_id = $1
        order by id asc
      `,
      [suiteId],
    );

    return result.rows.map(mapEvaluationRunRow);
  }

  async listEvaluationSuiteFinalizations(
    suiteId: string,
    input?: {
      historyWindowPreset?: EvaluationSuiteFinalizationHistoryWindowPreset;
    },
  ): Promise<EvaluationSuiteFinalizationRecord[]> {
    const preset = input?.historyWindowPreset ?? "latest_10";
    const { whereClause, params, limitClause } = buildSuiteFinalizationWindowSql({
      suiteId,
      historyWindowPreset: preset,
    });

    const finalizedResult =
      await this.dependencies.client.query<EvaluationSuiteFinalizationRow>(
        `
          with latest_recommendations as (
            select distinct on (experiment_run_id)
              id,
              experiment_run_id,
              evidence_pack_id,
              status,
              decision_reason,
              learning_candidate_ids,
              created_at
            from evaluation_promotion_recommendations
            order by experiment_run_id asc, created_at desc, id desc
          ),
          latest_evidence_packs as (
            select distinct on (experiment_run_id)
              id,
              experiment_run_id,
              summary_status,
              score_summary,
              regression_summary,
              failure_summary,
              cost_summary,
              latency_summary,
              created_at
            from evaluation_evidence_packs
            order by experiment_run_id asc, created_at desc, id desc
          ),
          finalized as (
            select
              runs.id,
              runs.suite_id,
              runs.sample_set_id,
              runs.baseline_binding,
              runs.candidate_binding,
              runs.governed_source,
              runs.release_check_profile_id,
              runs.run_item_count,
              runs.status,
              runs.evidence_ids,
              runs.started_at,
              runs.finished_at,
              evidence_packs.id as evidence_pack_id,
              evidence_packs.experiment_run_id as evidence_pack_experiment_run_id,
              evidence_packs.summary_status as evidence_pack_summary_status,
              evidence_packs.score_summary as evidence_pack_score_summary,
              evidence_packs.regression_summary as evidence_pack_regression_summary,
              evidence_packs.failure_summary as evidence_pack_failure_summary,
              evidence_packs.cost_summary as evidence_pack_cost_summary,
              evidence_packs.latency_summary as evidence_pack_latency_summary,
              evidence_packs.created_at as evidence_pack_created_at,
              recommendations.id as recommendation_id,
              recommendations.experiment_run_id as recommendation_experiment_run_id,
              recommendations.evidence_pack_id as recommendation_evidence_pack_id,
              recommendations.status as recommendation_status,
              recommendations.decision_reason as recommendation_decision_reason,
              recommendations.learning_candidate_ids as recommendation_learning_candidate_ids,
              recommendations.created_at as recommendation_created_at
            from evaluation_runs runs
            join latest_recommendations recommendations
              on recommendations.experiment_run_id = runs.id
            join latest_evidence_packs evidence_packs
              on evidence_packs.id = recommendations.evidence_pack_id
            where runs.suite_id = $1
          ),
          anchored as (
            select max(recommendation_created_at) as anchor_created_at
            from finalized
          )
          select finalized.*
          from finalized
          cross join anchored
          ${whereClause}
          order by finalized.recommendation_created_at desc, finalized.id desc
          ${limitClause}
        `,
        params,
      );

    const runIds = finalizedResult.rows.map((row) => row.id);
    const evidenceByRunId = await this.listEvidenceByRunIds(runIds);

    return finalizedResult.rows.map((row) => ({
      run: mapEvaluationRunRow(row),
      evidence_pack: mapEvaluationSuiteEvidencePackRow(row),
      recommendation: mapEvaluationSuiteRecommendationRow(row),
      evidence: evidenceByRunId.get(row.id) ?? [],
    }));
  }

  async saveEvaluationRunItem(record: EvaluationRunItemRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into evaluation_run_items (
          id,
          evaluation_run_id,
          sample_set_item_id,
          lane,
          result_asset_id,
          hard_gate_passed,
          weighted_score,
          failure_kind,
          failure_reason,
          diff_summary,
          requires_human_review
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        on conflict (id) do update
        set
          evaluation_run_id = excluded.evaluation_run_id,
          sample_set_item_id = excluded.sample_set_item_id,
          lane = excluded.lane,
          result_asset_id = excluded.result_asset_id,
          hard_gate_passed = excluded.hard_gate_passed,
          weighted_score = excluded.weighted_score,
          failure_kind = excluded.failure_kind,
          failure_reason = excluded.failure_reason,
          diff_summary = excluded.diff_summary,
          requires_human_review = excluded.requires_human_review
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

  async findEvaluationRunItemById(
    id: string,
  ): Promise<EvaluationRunItemRecord | undefined> {
    const result = await this.dependencies.client.query<EvaluationRunItemRow>(
      `
        select
          id,
          evaluation_run_id,
          sample_set_item_id,
          lane,
          result_asset_id,
          hard_gate_passed,
          weighted_score,
          failure_kind,
          failure_reason,
          diff_summary,
          requires_human_review
        from evaluation_run_items
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapEvaluationRunItemRow(result.rows[0]) : undefined;
  }

  async listEvaluationRunItemsByRunId(
    runId: string,
  ): Promise<EvaluationRunItemRecord[]> {
    const result = await this.dependencies.client.query<EvaluationRunItemRow>(
      `
        select
          id,
          evaluation_run_id,
          sample_set_item_id,
          lane,
          result_asset_id,
          hard_gate_passed,
          weighted_score,
          failure_kind,
          failure_reason,
          diff_summary,
          requires_human_review
        from evaluation_run_items
        where evaluation_run_id = $1
        order by id asc
      `,
      [runId],
    );

    return result.rows.map(mapEvaluationRunItemRow);
  }

  async saveEvaluationEvidencePack(
    record: EvaluationEvidencePackRecord,
  ): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into evaluation_evidence_packs (
          id,
          experiment_run_id,
          summary_status,
          score_summary,
          regression_summary,
          failure_summary,
          cost_summary,
          latency_summary,
          created_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        on conflict (id) do update
        set
          experiment_run_id = excluded.experiment_run_id,
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

  async findEvaluationEvidencePackById(
    id: string,
  ): Promise<EvaluationEvidencePackRecord | undefined> {
    const result = await this.dependencies.client.query<EvaluationEvidencePackRow>(
      `
        select
          id,
          experiment_run_id,
          summary_status,
          score_summary,
          regression_summary,
          failure_summary,
          cost_summary,
          latency_summary,
          created_at
        from evaluation_evidence_packs
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapEvaluationEvidencePackRow(result.rows[0]) : undefined;
  }

  async findLatestEvaluationEvidencePackByRunId(
    runId: string,
  ): Promise<EvaluationEvidencePackRecord | undefined> {
    const result = await this.dependencies.client.query<EvaluationEvidencePackRow>(
      `
        select
          id,
          experiment_run_id,
          summary_status,
          score_summary,
          regression_summary,
          failure_summary,
          cost_summary,
          latency_summary,
          created_at
        from evaluation_evidence_packs
        where experiment_run_id = $1
        order by created_at desc, id desc
        limit 1
      `,
      [runId],
    );

    return result.rows[0] ? mapEvaluationEvidencePackRow(result.rows[0]) : undefined;
  }

  async saveEvaluationPromotionRecommendation(
    record: EvaluationPromotionRecommendationRecord,
  ): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into evaluation_promotion_recommendations (
          id,
          experiment_run_id,
          evidence_pack_id,
          status,
          decision_reason,
          learning_candidate_ids,
          created_at
        )
        values ($1, $2, $3, $4, $5, $6::text[], $7)
        on conflict (id) do update
        set
          experiment_run_id = excluded.experiment_run_id,
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
        record.learning_candidate_ids ?? [],
        record.created_at,
      ],
    );
  }

  async findLatestEvaluationPromotionRecommendationByRunId(
    runId: string,
  ): Promise<EvaluationPromotionRecommendationRecord | undefined> {
    const result =
      await this.dependencies.client.query<EvaluationPromotionRecommendationRow>(
        `
          select
            id,
            experiment_run_id,
            evidence_pack_id,
            status,
            decision_reason,
            learning_candidate_ids,
            created_at
          from evaluation_promotion_recommendations
          where experiment_run_id = $1
          order by created_at desc, id desc
          limit 1
        `,
        [runId],
      );

    return result.rows[0]
      ? mapEvaluationPromotionRecommendationRow(result.rows[0])
      : undefined;
  }

  private async listEvidenceByRunIds(
    runIds: string[],
  ): Promise<Map<string, VerificationEvidenceRecord[]>> {
    if (runIds.length === 0) {
      return new Map();
    }

    const result = await this.dependencies.client.query<
      VerificationEvidenceRow & { run_id: string }
    >(
      `
        select
          run_evidence.run_id,
          evidence.id,
          evidence.kind,
          evidence.label,
          evidence.uri,
          evidence.artifact_asset_id,
          evidence.check_profile_id,
          evidence.retrieval_snapshot_id,
          evidence.retrieval_quality_run_id,
          evidence.created_at
        from (
          select
            runs.id as run_id,
            unnest(runs.evidence_ids) as evidence_id
          from evaluation_runs runs
          where runs.id = any($1::text[])
        ) as run_evidence
        join verification_evidence evidence
          on evidence.id = run_evidence.evidence_id
        order by run_evidence.run_id asc, evidence.created_at asc, evidence.id asc
      `,
      [runIds],
    );

    const evidenceByRunId = new Map<string, VerificationEvidenceRecord[]>();
    for (const row of result.rows) {
      const bucket = evidenceByRunId.get(row.run_id) ?? [];
      bucket.push(mapVerificationEvidenceRow(row));
      evidenceByRunId.set(row.run_id, bucket);
    }

    return evidenceByRunId;
  }
}

function mapEvaluationSampleSetRow(
  row: EvaluationSampleSetRow,
): EvaluationSampleSetRecord {
  const riskTags = decodeTextArray(row.risk_tags);

  return {
    id: row.id,
    name: row.name,
    module: row.module,
    manuscript_types:
      decodeTextArray(row.manuscript_types) as EvaluationSampleSetRecord["manuscript_types"],
    sample_count: Number(row.sample_count),
    source_policy: decodeJsonValue<EvaluationSampleSetRecord["source_policy"]>(
      row.source_policy,
    ),
    status: row.status,
    admin_only: true,
    ...(riskTags.length > 0 ? { risk_tags: riskTags } : {}),
  };
}

function mapEvaluationSampleSetItemRow(
  row: EvaluationSampleSetItemRow,
): EvaluationSampleSetItemRecord {
  const riskTags = decodeTextArray(row.risk_tags);

  return {
    id: row.id,
    sample_set_id: row.sample_set_id,
    manuscript_id: row.manuscript_id,
    snapshot_asset_id: row.snapshot_asset_id,
    reviewed_case_snapshot_id: row.reviewed_case_snapshot_id,
    module: row.module,
    manuscript_type: row.manuscript_type,
    ...(riskTags.length > 0 ? { risk_tags: riskTags } : {}),
  };
}

function mapVerificationCheckProfileRow(
  row: VerificationCheckProfileRow,
): VerificationCheckProfileRecord {
  const toolIds = decodeTextArray(row.tool_ids);

  return {
    id: row.id,
    name: row.name,
    check_type: row.check_type,
    status: row.status,
    admin_only: true,
    ...(toolIds.length > 0 ? { tool_ids: toolIds } : {}),
  };
}

function mapReleaseCheckProfileRow(
  row: ReleaseCheckProfileRow,
): ReleaseCheckProfileRecord {
  return {
    id: row.id,
    name: row.name,
    check_type: row.check_type,
    status: row.status,
    verification_check_profile_ids: decodeTextArray(
      row.verification_check_profile_ids,
    ),
    admin_only: true,
  };
}

function mapEvaluationSuiteRow(row: EvaluationSuiteRow): EvaluationSuiteRecord {
  const moduleScope = decodeNullableTextArray(row.module_scope);

  return {
    id: row.id,
    name: row.name,
    suite_type: row.suite_type,
    status: row.status,
    verification_check_profile_ids: decodeTextArray(
      row.verification_check_profile_ids,
    ),
    module_scope:
      moduleScope == null
        ? "any"
        : (moduleScope as Exclude<EvaluationSuiteRecord["module_scope"], "any">),
    requires_production_baseline: row.requires_production_baseline,
    supports_ab_comparison: row.supports_ab_comparison,
    hard_gate_policy: decodeJsonValue<EvaluationSuiteRecord["hard_gate_policy"]>(
      row.hard_gate_policy,
    ),
    score_weights: decodeJsonValue<EvaluationSuiteRecord["score_weights"]>(
      row.score_weights,
    ),
    admin_only: true,
  };
}

function mapVerificationEvidenceRow(
  row: VerificationEvidenceRow,
): VerificationEvidenceRecord {
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    created_at: row.created_at.toISOString(),
    ...(row.uri != null ? { uri: row.uri } : {}),
    ...(row.artifact_asset_id != null
      ? { artifact_asset_id: row.artifact_asset_id }
      : {}),
    ...(row.check_profile_id != null
      ? { check_profile_id: row.check_profile_id }
      : {}),
    ...(row.retrieval_snapshot_id != null
      ? { retrieval_snapshot_id: row.retrieval_snapshot_id }
      : {}),
    ...(row.retrieval_quality_run_id != null
      ? { retrieval_quality_run_id: row.retrieval_quality_run_id }
      : {}),
  };
}

function mapEvaluationRunRow(row: EvaluationRunRow): EvaluationRunRecord {
  const baselineBinding = decodeNullableJsonValue<FrozenExperimentBindingRecord>(
    row.baseline_binding,
  );
  const candidateBinding = decodeNullableJsonValue<FrozenExperimentBindingRecord>(
    row.candidate_binding,
  );
  const governedSource =
    decodeNullableJsonValue<GovernedExecutionEvaluationSourceRecord>(
      row.governed_source,
    );

  return {
    id: row.id,
    suite_id: row.suite_id,
    run_item_count: Number(row.run_item_count),
    status: row.status,
    evidence_ids: decodeTextArray(row.evidence_ids),
    started_at: row.started_at.toISOString(),
    ...(row.sample_set_id != null ? { sample_set_id: row.sample_set_id } : {}),
    ...(baselineBinding != null
      ? { baseline_binding: normalizeFrozenExperimentBinding(baselineBinding) }
      : {}),
    ...(candidateBinding != null
      ? { candidate_binding: normalizeFrozenExperimentBinding(candidateBinding) }
      : {}),
    ...(governedSource != null ? { governed_source: governedSource } : {}),
    ...(row.release_check_profile_id != null
      ? { release_check_profile_id: row.release_check_profile_id }
      : {}),
    ...(row.finished_at != null ? { finished_at: row.finished_at.toISOString() } : {}),
  };
}

function mapEvaluationRunItemRow(
  row: EvaluationRunItemRow,
): EvaluationRunItemRecord {
  return {
    id: row.id,
    evaluation_run_id: row.evaluation_run_id,
    sample_set_item_id: row.sample_set_item_id,
    lane: row.lane,
    ...(row.result_asset_id != null ? { result_asset_id: row.result_asset_id } : {}),
    ...(row.hard_gate_passed != null
      ? { hard_gate_passed: row.hard_gate_passed }
      : {}),
    ...(row.weighted_score != null ? { weighted_score: row.weighted_score } : {}),
    ...(row.failure_kind != null ? { failure_kind: row.failure_kind } : {}),
    ...(row.failure_reason != null ? { failure_reason: row.failure_reason } : {}),
    ...(row.diff_summary != null ? { diff_summary: row.diff_summary } : {}),
    ...(row.requires_human_review != null
      ? { requires_human_review: row.requires_human_review }
      : {}),
  };
}

function mapEvaluationEvidencePackRow(
  row: EvaluationEvidencePackRow,
): EvaluationEvidencePackRecord {
  return {
    id: row.id,
    experiment_run_id: row.experiment_run_id,
    summary_status: row.summary_status,
    created_at: row.created_at.toISOString(),
    ...(row.score_summary != null ? { score_summary: row.score_summary } : {}),
    ...(row.regression_summary != null
      ? { regression_summary: row.regression_summary }
      : {}),
    ...(row.failure_summary != null ? { failure_summary: row.failure_summary } : {}),
    ...(row.cost_summary != null ? { cost_summary: row.cost_summary } : {}),
    ...(row.latency_summary != null ? { latency_summary: row.latency_summary } : {}),
  };
}

function mapEvaluationPromotionRecommendationRow(
  row: EvaluationPromotionRecommendationRow,
): EvaluationPromotionRecommendationRecord {
  const learningCandidateIds = decodeTextArray(row.learning_candidate_ids);

  return {
    id: row.id,
    experiment_run_id: row.experiment_run_id,
    evidence_pack_id: row.evidence_pack_id,
    status: row.status,
    created_at: row.created_at.toISOString(),
    ...(row.decision_reason != null ? { decision_reason: row.decision_reason } : {}),
    ...(learningCandidateIds.length > 0
      ? { learning_candidate_ids: learningCandidateIds }
      : {}),
  };
}

function mapEvaluationSuiteEvidencePackRow(
  row: EvaluationSuiteFinalizationRow,
): EvaluationEvidencePackRecord {
  return {
    id: row.evidence_pack_id,
    experiment_run_id: row.evidence_pack_experiment_run_id,
    summary_status: row.evidence_pack_summary_status,
    created_at: row.evidence_pack_created_at.toISOString(),
    ...(row.evidence_pack_score_summary != null
      ? { score_summary: row.evidence_pack_score_summary }
      : {}),
    ...(row.evidence_pack_regression_summary != null
      ? { regression_summary: row.evidence_pack_regression_summary }
      : {}),
    ...(row.evidence_pack_failure_summary != null
      ? { failure_summary: row.evidence_pack_failure_summary }
      : {}),
    ...(row.evidence_pack_cost_summary != null
      ? { cost_summary: row.evidence_pack_cost_summary }
      : {}),
    ...(row.evidence_pack_latency_summary != null
      ? { latency_summary: row.evidence_pack_latency_summary }
      : {}),
  };
}

function mapEvaluationSuiteRecommendationRow(
  row: EvaluationSuiteFinalizationRow,
): EvaluationPromotionRecommendationRecord {
  const learningCandidateIds = decodeTextArray(row.recommendation_learning_candidate_ids);

  return {
    id: row.recommendation_id,
    experiment_run_id: row.recommendation_experiment_run_id,
    evidence_pack_id: row.recommendation_evidence_pack_id,
    status: row.recommendation_status,
    created_at: row.recommendation_created_at.toISOString(),
    ...(row.recommendation_decision_reason != null
      ? { decision_reason: row.recommendation_decision_reason }
      : {}),
    ...(learningCandidateIds.length > 0
      ? { learning_candidate_ids: learningCandidateIds }
      : {}),
  };
}

function buildSuiteFinalizationWindowSql(input: {
  suiteId: string;
  historyWindowPreset: EvaluationSuiteFinalizationHistoryWindowPreset;
}): {
  whereClause: string;
  params: unknown[];
  limitClause: string;
} {
  switch (input.historyWindowPreset) {
    case "all_suite":
      return {
        whereClause: "",
        params: [input.suiteId],
        limitClause: "",
      };
    case "latest_10":
      return {
        whereClause: "",
        params: [input.suiteId],
        limitClause: "limit 10",
      };
    case "last_7_days":
    case "last_30_days": {
      const days = input.historyWindowPreset === "last_7_days" ? 7 : 30;
      return {
        whereClause:
          "where anchored.anchor_created_at is not null and finalized.recommendation_created_at >= anchored.anchor_created_at - ($2::int * interval '1 day')",
        params: [input.suiteId, days],
        limitClause: "",
      };
    }
  }
}

function decodeNullableTextArray(
  value: string[] | string | null,
): string[] | undefined {
  if (value == null) {
    return undefined;
  }

  const decoded = decodeTextArray(value);
  return decoded.length > 0 ? decoded : undefined;
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

function decodeJsonValue<T>(value: T | string): T {
  return typeof value === "string" ? (JSON.parse(value) as T) : value;
}

function decodeNullableJsonValue<T>(value: T | string | null): T | undefined {
  if (value == null) {
    return undefined;
  }

  return decodeJsonValue(value);
}

function normalizeFrozenExperimentBinding(
  record: FrozenExperimentBindingRecord,
): FrozenExperimentBindingRecord {
  return {
    ...record,
    skill_package_ids: [...record.skill_package_ids],
  };
}
