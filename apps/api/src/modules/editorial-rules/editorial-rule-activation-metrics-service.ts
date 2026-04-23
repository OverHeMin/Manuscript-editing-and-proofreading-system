import type {
  EditorialRuleActivationMetricKey,
  EditorialRuleActivationMetricRates,
  EditorialRuleActivationMetricRecord,
  EditorialRuleActivationMetricTotals,
  EditorialRuleActivationMetricsSummary,
  EditorialRuleReleaseComparisonSummary,
  EditorialRuleSetRecord,
} from "./editorial-rule-record.ts";
import type { TableDocxPatchResult } from "../document-pipeline/table-docx-patch-plan.ts";
import {
  EDITORIAL_RULE_ACTIVATION_METRIC_KEYS,
} from "./editorial-rule-record.ts";
import type { EditorialRuleRepository } from "./editorial-rule-repository.ts";
import type { EditorialRuleActivationMetricsRepository } from "./editorial-rule-activation-metrics-repository.ts";

export interface EditorialRuleActivationMetricsServiceOptions {
  repository: EditorialRuleActivationMetricsRepository;
  editorialRuleRepository: Pick<
    EditorialRuleRepository,
    | "findRuleById"
    | "findRuleSetById"
    | "listRulesByRuleSetId"
    | "listRuleSetsByTemplateFamilyAndModule"
  >;
  now?: () => Date;
}

export class EditorialRuleActivationMetricsService {
  private readonly repository: EditorialRuleActivationMetricsRepository;
  private readonly editorialRuleRepository: Pick<
    EditorialRuleRepository,
    | "findRuleById"
    | "findRuleSetById"
    | "listRulesByRuleSetId"
    | "listRuleSetsByTemplateFamilyAndModule"
  >;
  private readonly now: () => Date;

  constructor(options: EditorialRuleActivationMetricsServiceOptions) {
    this.repository = options.repository;
    this.editorialRuleRepository = options.editorialRuleRepository;
    this.now = options.now ?? (() => new Date());
  }

  recordGovernedHit(ruleIds: readonly string[] | undefined): Promise<void> {
    return this.recordMetricForRuleIds(ruleIds, "governed_hit_count");
  }

  async recordGovernedDecision(
    ruleIds: readonly string[] | undefined,
    action:
      | "accept_change_only"
      | "reject_as_false_positive"
      | "route_to_rule_candidate"
      | "route_to_knowledge_candidate"
      | "route_to_prompt_candidate"
      | "archive_as_evidence_only",
  ): Promise<void> {
    const metricKeys: EditorialRuleActivationMetricKey[] =
      action === "reject_as_false_positive"
        ? ["false_positive_count"]
        : action === "accept_change_only"
          ? ["human_confirmation_count", "accept_change_only_count"]
          : action === "archive_as_evidence_only"
            ? ["human_confirmation_count", "evidence_only_archive_count"]
            : action === "route_to_rule_candidate"
              ? ["human_confirmation_count", "routed_rule_candidate_count"]
              : action === "route_to_knowledge_candidate"
                ? ["human_confirmation_count", "routed_knowledge_candidate_count"]
                : ["human_confirmation_count", "routed_prompt_candidate_count"];

    for (const metricKey of metricKeys) {
      await this.recordMetricForRuleIds(ruleIds, metricKey);
    }
  }

  recordWritebackCreated(ruleIds: readonly string[] | undefined): Promise<void> {
    return this.recordMetricForRuleIds(ruleIds, "writeback_created_count");
  }

  recordWritebackApplied(ruleIds: readonly string[] | undefined): Promise<void> {
    return this.recordMetricForRuleIds(ruleIds, "writeback_applied_count");
  }

  async recordTablePatchResults(
    results: readonly Pick<TableDocxPatchResult, "rule_id" | "status">[],
  ): Promise<void> {
    for (const result of results) {
      const metricKey = mapTablePatchStatusToMetricKey(result.status);
      if (!metricKey) {
        continue;
      }

      await this.recordMetricForRuleIds([result.rule_id], metricKey);
    }
  }

  async getRuleMetrics(ruleId: string): Promise<EditorialRuleActivationMetricsSummary> {
    const rule = await this.editorialRuleRepository.findRuleById(ruleId);
    const metrics = await this.repository.listMetricsByRuleIds([ruleId]);
    return summarizeMetrics(metrics, {
      ruleId,
      ruleSetId: rule?.rule_set_id,
    });
  }

  async listRuleMetrics(
    ruleIds: readonly string[],
  ): Promise<Map<string, EditorialRuleActivationMetricsSummary>> {
    const uniqueRuleIds = normalizeStringArray(ruleIds);
    const metrics = await this.repository.listMetricsByRuleIds(uniqueRuleIds);
    const grouped = groupMetricsByRuleId(metrics);
    const summaries = new Map<string, EditorialRuleActivationMetricsSummary>();

    await Promise.all(
      uniqueRuleIds.map(async (ruleId) => {
        const rule = await this.editorialRuleRepository.findRuleById(ruleId);
        summaries.set(
          ruleId,
          summarizeMetrics(grouped.get(ruleId) ?? [], {
            ruleId,
            ruleSetId: rule?.rule_set_id,
          }),
        );
      }),
    );

    return summaries;
  }

  async getRuleSetMetrics(
    ruleSetId: string,
  ): Promise<EditorialRuleActivationMetricsSummary> {
    const metrics = await this.repository.listMetricsByRuleSetIds([ruleSetId]);
    return summarizeMetrics(metrics, {
      ruleSetId,
    });
  }

  async buildReleaseComparison(
    ruleSetId: string,
  ): Promise<EditorialRuleReleaseComparisonSummary> {
    const comparedRuleSet = await this.editorialRuleRepository.findRuleSetById(ruleSetId);
    const candidateMetrics = await this.getRuleSetMetrics(ruleSetId);

    if (!comparedRuleSet) {
      return {
        status: "insufficient_data",
        recommendation: "hold",
        compared_rule_set_id: ruleSetId,
        baseline_metrics: createEmptyMetricsSummary(),
        candidate_metrics: candidateMetrics,
        reasons: ["Compared rule set was not found."],
      };
    }

    const baselineRuleSet = await this.findBaselineRuleSet(comparedRuleSet);
    if (!baselineRuleSet) {
      return {
        status: "insufficient_data",
        recommendation: "hold",
        compared_rule_set_id: ruleSetId,
        baseline_metrics: createEmptyMetricsSummary(),
        candidate_metrics: candidateMetrics,
        reasons: ["No baseline rule set is available for comparison."],
      };
    }

    const baselineMetrics = await this.getRuleSetMetrics(baselineRuleSet.id);
    const reasons: string[] = [];
    if (candidateMetrics.totals.governed_hit_count === 0) {
      reasons.push("Candidate rule set has no governed-hit metrics yet.");
    }
    if (baselineMetrics.totals.governed_hit_count === 0) {
      reasons.push("Baseline rule set has no governed-hit metrics yet.");
    }

    if (reasons.length > 0) {
      return {
        status: "insufficient_data",
        recommendation: "hold",
        baseline_rule_set_id: baselineRuleSet.id,
        compared_rule_set_id: ruleSetId,
        baseline_metrics: baselineMetrics,
        candidate_metrics: candidateMetrics,
        reasons,
      };
    }

    const degradedReasons: string[] = [];
    if (
      candidateMetrics.rates.false_positive_rate >
      baselineMetrics.rates.false_positive_rate + 0.1
    ) {
      degradedReasons.push("False-positive rate regressed versus baseline.");
    }
    if (
      candidateMetrics.rates.human_confirmation_rate + 0.1 <
      baselineMetrics.rates.human_confirmation_rate
    ) {
      degradedReasons.push("Human confirmation rate regressed versus baseline.");
    }
    if (
      candidateMetrics.rates.writeback_success_rate + 0.1 <
      baselineMetrics.rates.writeback_success_rate
    ) {
      degradedReasons.push("Writeback success rate regressed versus baseline.");
    }

    return {
      status: degradedReasons.length > 0 ? "degraded" : "stable",
      recommendation:
        comparedRuleSet.status === "active" && degradedReasons.length > 0
          ? "rollback_recommended"
          : degradedReasons.length > 0
            ? "hold"
            : "promote",
      baseline_rule_set_id: baselineRuleSet.id,
      compared_rule_set_id: ruleSetId,
      baseline_metrics: baselineMetrics,
      candidate_metrics: candidateMetrics,
      reasons:
        degradedReasons.length > 0
          ? degradedReasons
          : ["Metrics are stable versus the current baseline."],
    };
  }

  private async recordMetricForRuleIds(
    ruleIds: readonly string[] | undefined,
    metricKey: EditorialRuleActivationMetricKey,
  ): Promise<void> {
    const targets = await this.resolveMetricTargets(ruleIds);
    const timestamp = this.now().toISOString();

    await Promise.all(
      targets.map((target) =>
        this.repository.incrementMetric({
          ruleId: target.ruleId,
          ruleSetId: target.ruleSetId,
          metricKey,
          amount: 1,
          timestamp,
        }),
      ),
    );
  }

  private async resolveMetricTargets(
    ruleIds: readonly string[] | undefined,
  ): Promise<Array<{ ruleId: string; ruleSetId: string }>> {
    const uniqueRuleIds = normalizeStringArray(ruleIds);
    const targets: Array<{ ruleId: string; ruleSetId: string }> = [];

    await Promise.all(
      uniqueRuleIds.map(async (ruleId) => {
        const rule = await this.editorialRuleRepository.findRuleById(ruleId);
        if (rule) {
          targets.push({
            ruleId: rule.id,
            ruleSetId: rule.rule_set_id,
          });
        }
      }),
    );

    return targets;
  }

  private async findBaselineRuleSet(
    ruleSet: EditorialRuleSetRecord,
  ): Promise<EditorialRuleSetRecord | undefined> {
    const relatedRuleSets =
      await this.editorialRuleRepository.listRuleSetsByTemplateFamilyAndModule(
        ruleSet.template_family_id,
        ruleSet.module,
      );

    return relatedRuleSets
      .filter(
        (candidate) =>
          candidate.id !== ruleSet.id &&
          (candidate.journal_template_id ?? undefined) ===
            (ruleSet.journal_template_id ?? undefined) &&
          (candidate.status === "active" || candidate.status === "published"),
      )
      .sort((left, right) => right.version_no - left.version_no)
      [0];
  }
}

function groupMetricsByRuleId(
  metrics: readonly EditorialRuleActivationMetricRecord[],
): Map<string, EditorialRuleActivationMetricRecord[]> {
  const grouped = new Map<string, EditorialRuleActivationMetricRecord[]>();
  for (const metric of metrics) {
    const records = grouped.get(metric.rule_id);
    if (records) {
      records.push(metric);
    } else {
      grouped.set(metric.rule_id, [metric]);
    }
  }
  return grouped;
}

function summarizeMetrics(
  metrics: readonly EditorialRuleActivationMetricRecord[],
  input: {
    ruleId?: string;
    ruleSetId?: string;
  } = {},
): EditorialRuleActivationMetricsSummary {
  const totals = createEmptyMetricTotals();
  let resolvedRuleSetId = input.ruleSetId;

  for (const metric of metrics) {
    totals[metric.metric_key] += metric.metric_count;
    resolvedRuleSetId ??= metric.rule_set_id;
  }

  return {
    ...(input.ruleId ? { rule_id: input.ruleId } : {}),
    ...(resolvedRuleSetId ? { rule_set_id: resolvedRuleSetId } : {}),
    totals,
    rates: createMetricRates(totals),
  };
}

function createMetricRates(
  totals: EditorialRuleActivationMetricTotals,
): EditorialRuleActivationMetricRates {
  return {
    false_positive_rate: divideSafely(
      totals.false_positive_count,
      totals.governed_hit_count,
    ),
    human_confirmation_rate: divideSafely(
      totals.human_confirmation_count,
      totals.governed_hit_count,
    ),
    evidence_only_archive_rate: divideSafely(
      totals.evidence_only_archive_count,
      totals.governed_hit_count,
    ),
    writeback_success_rate: divideSafely(
      totals.writeback_applied_count,
      totals.writeback_created_count,
    ),
  };
}

function divideSafely(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
}

function mapTablePatchStatusToMetricKey(
  status: TableDocxPatchResult["status"],
): EditorialRuleActivationMetricKey | undefined {
  switch (status) {
    case "applied":
      return "table_patch_applied_count";
    case "skipped_no_anchor":
      return "table_patch_skipped_no_anchor_count";
    case "skipped_conflict":
      return "table_patch_skipped_conflict_count";
    case "skipped_unsafe":
      return "table_patch_skipped_unsafe_count";
    default:
      return undefined;
  }
}

function normalizeStringArray(values: readonly string[] | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function createEmptyMetricTotals(): EditorialRuleActivationMetricTotals {
  const totals = {} as EditorialRuleActivationMetricTotals;
  for (const metricKey of EDITORIAL_RULE_ACTIVATION_METRIC_KEYS) {
    totals[metricKey] = 0;
  }
  return totals;
}

function createEmptyMetricsSummary(): EditorialRuleActivationMetricsSummary {
  const totals = createEmptyMetricTotals();
  return {
    totals,
    rates: createMetricRates(totals),
  };
}
