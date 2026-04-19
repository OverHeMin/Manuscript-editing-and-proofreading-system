import type { ManualFeedbackCategory } from "../feedback-governance/index.ts";
import type { JobViewModel } from "../manuscripts/index.ts";
import type { ModuleJobViewModel } from "../screening/index.ts";

type AnyWorkbenchJob = JobViewModel | ModuleJobViewModel;

export interface ManuscriptWorkbenchHighRiskReviewItemViewModel {
  id: string;
  title: string;
  feedbackCategory: ManualFeedbackCategory;
  candidate_posture: "candidate_change" | "inspect_only";
  riskLevel: "low" | "medium" | "high" | "critical";
  summary?: string;
  excerpt?: string;
  location?: Record<string, unknown>;
  locationText: string;
  suggestion?: string;
  rationale?: string;
  evidence_pack?: {
    location?: Record<string, unknown>;
    excerpt?: string;
    suggestion?: string;
    rationale?: string;
  };
  relatedRuleIds?: string[];
  relatedKnowledgeItemIds?: string[];
  recommendedRoute?:
    | "rule_candidate"
    | "knowledge_candidate"
    | "prompt_template_candidate";
  originPayload?: Record<string, unknown>;
}

export function buildHighRiskReviewItemsFromJob(
  latestJob: AnyWorkbenchJob | null,
): ManuscriptWorkbenchHighRiskReviewItemViewModel[] {
  if (!latestJob) {
    return [];
  }

  const payload = latestJob.payload;
  return [
    ...extractManualReviewHighRiskItems(payload),
    ...extractTableInspectionHighRiskItems(payload),
    ...extractQualityFindingHighRiskItems(payload),
    ...extractContentRuleCandidateHighRiskItems(payload),
    ...extractFailedCheckHighRiskItems(payload),
  ];
}

export function collectHighRiskEvidenceFromJob(
  latestJob: AnyWorkbenchJob | null,
): { reasons: string[]; ruleIds: string[] } {
  const items = buildHighRiskReviewItemsFromJob(latestJob);
  return {
    reasons: uniqueValues(
      items
        .map(
          (item) =>
            item.rationale?.trim() ??
            item.summary?.trim() ??
            item.excerpt?.trim() ??
            "",
        )
        .filter((value) => value.length > 0),
    ),
    ruleIds: uniqueValues(
      items.flatMap((item) => item.relatedRuleIds ?? []).filter(Boolean),
    ),
  };
}

export function formatHighRiskReviewPostureLabel(
  posture: ManuscriptWorkbenchHighRiskReviewItemViewModel["candidate_posture"],
): string {
  return posture === "candidate_change" ? "候选修改" : "仅检查";
}

export function formatHighRiskRecommendedRouteLabel(
  route:
    | ManuscriptWorkbenchHighRiskReviewItemViewModel["recommendedRoute"]
    | undefined,
): string {
  switch (route) {
    case "knowledge_candidate":
      return "知识候选";
    case "prompt_template_candidate":
      return "Prompt/模板候选";
    case "rule_candidate":
      return "规则候选";
    default:
      return "待人工判定";
  }
}

function extractFailedCheckHighRiskItems(
  payload: Record<string, unknown> | undefined,
): ManuscriptWorkbenchHighRiskReviewItemViewModel[] {
  const proofreadingFindings = asRecord(payload?.proofreadingFindings);
  const failedChecks = Array.isArray(proofreadingFindings?.failedChecks)
    ? proofreadingFindings.failedChecks
    : [];

  return failedChecks
    .map((item, index) => {
      const record = asRecord(item);
      if (!record) {
        return undefined;
      }

      const ruleId = asNonEmptyString(record.ruleId);
      const expected = asNonEmptyString(record.expected);
      const actual = asNonEmptyString(record.actual);
      const explanation =
        asNonEmptyString(record.explanation) ??
        asNonEmptyString(record.reason) ??
        buildFailedCheckRationale(ruleId, expected, actual);
      const location = normalizeLocationRecord(
        record.location ?? record.semantic_hit,
      );
      const evidencePack =
        normalizeEvidencePack(record.evidence_pack) ??
        buildGovernedEvidencePack({
          excerpt: actual,
          location,
          rationale: explanation,
          suggestion: expected,
        });

      return {
        id: ruleId ?? `failed-check-${index + 1}`,
        title: ruleId
          ? `规则 ${ruleId} 需要人工确认`
          : "高风险规则命中需要人工确认",
        feedbackCategory: "incorrect_hit",
        candidate_posture: expected ? "candidate_change" : "inspect_only",
        riskLevel: resolveHighRiskLevel(asNonEmptyString(record.severity)),
        summary: explanation,
        excerpt: actual,
        location,
        locationText: buildHighRiskReviewLocationText(location),
        suggestion: expected,
        rationale: explanation,
        evidence_pack: evidencePack,
        relatedRuleIds: ruleId ? [ruleId] : undefined,
        relatedKnowledgeItemIds: asStringArray(record.relatedKnowledgeItemIds),
        recommendedRoute: "rule_candidate",
        originPayload: {
          source: "failed_check",
          ...(ruleId ? { ruleId } : {}),
        },
      } satisfies ManuscriptWorkbenchHighRiskReviewItemViewModel;
    })
    .filter(isDefined);
}

function extractManualReviewHighRiskItems(
  payload: Record<string, unknown> | undefined,
): ManuscriptWorkbenchHighRiskReviewItemViewModel[] {
  const directItems = getManualReviewItemsValue(payload?.manualReviewItems);
  const proofreadingFindings = asRecord(payload?.proofreadingFindings);
  const nestedItems = getManualReviewItemsValue(
    proofreadingFindings?.manualReviewItems,
  );

  return [...directItems, ...nestedItems].map((item, index) => ({
    id: item.ruleId || `manual-review-${index + 1}`,
    title: item.ruleId
      ? `规则 ${item.ruleId} 需要人工确认`
      : "高风险规则命中需要人工确认",
    feedbackCategory: "incorrect_hit",
    candidate_posture: "inspect_only",
    riskLevel: "high",
    summary: "高风险命中需要人工确认后再决定是否沉淀。",
    excerpt: item.reason,
    locationText: "待人工定位",
    rationale: item.reason,
    evidence_pack: buildGovernedEvidencePack({
      excerpt: item.reason,
      rationale: item.reason,
    }),
    relatedRuleIds: item.ruleId ? [item.ruleId] : undefined,
    recommendedRoute: "rule_candidate",
    originPayload: {
      source: "manual_review_item",
      ...(item.ruleId ? { ruleId: item.ruleId } : {}),
    },
  }));
}

function extractTableInspectionHighRiskItems(
  payload: Record<string, unknown> | undefined,
): ManuscriptWorkbenchHighRiskReviewItemViewModel[] {
  const findings = Array.isArray(payload?.tableInspectionFindings)
    ? payload.tableInspectionFindings
    : [];

  return findings
    .map((item, index) => {
      const record = asRecord(item);
      if (!record) {
        return undefined;
      }

      const ruleId = asNonEmptyString(record.ruleId);
      const reason =
        asNonEmptyString(record.reason) ??
        asNonEmptyString(record.summary) ??
        asNonEmptyString(record.explanation);
      const location = normalizeLocationRecord(
        record.semantic_hit ?? record.location,
      );
      const evidencePack =
        normalizeEvidencePack(record.evidence_pack) ??
        buildGovernedEvidencePack({
          excerpt: reason,
          location,
          rationale: reason,
        });

      return {
        id: ruleId ?? `table-inspection-${index + 1}`,
        title: ruleId
          ? `规则 ${ruleId} 需要人工确认`
          : "表格高风险规则命中需要人工确认",
        feedbackCategory: "incorrect_hit",
        candidate_posture: "inspect_only",
        riskLevel: "high",
        summary: "命中的表格规则需要人工复核后再决定是否沉淀。",
        excerpt: reason,
        location,
        locationText: buildHighRiskReviewLocationText(location),
        rationale: reason,
        evidence_pack: evidencePack,
        relatedRuleIds: ruleId ? [ruleId] : undefined,
        recommendedRoute: "rule_candidate",
        originPayload: {
          source: "table_inspection_finding",
          ...(ruleId ? { ruleId } : {}),
          ...(location ? { semantic_hit: location } : {}),
        },
      } satisfies ManuscriptWorkbenchHighRiskReviewItemViewModel;
    })
    .filter(isDefined);
}

function extractQualityFindingHighRiskItems(
  payload: Record<string, unknown> | undefined,
): ManuscriptWorkbenchHighRiskReviewItemViewModel[] {
  const proofreadingFindings = asRecord(payload?.proofreadingFindings);
  const findings = Array.isArray(proofreadingFindings?.qualityFindings)
    ? proofreadingFindings.qualityFindings
    : [];

  return findings
    .map((item) => mapGenericHighRiskReviewItem(item, "generic_high_risk_item"))
    .filter(isDefined);
}

function extractContentRuleCandidateHighRiskItems(
  payload: Record<string, unknown> | undefined,
): ManuscriptWorkbenchHighRiskReviewItemViewModel[] {
  const candidates = Array.isArray(payload?.contentRuleCandidates)
    ? payload.contentRuleCandidates
    : [];

  return candidates
    .map((item) =>
      mapGenericHighRiskReviewItem(item, "content_rule_candidate"),
    )
    .filter(isDefined);
}

function mapGenericHighRiskReviewItem(
  value: unknown,
  source: "generic_high_risk_item" | "content_rule_candidate",
): ManuscriptWorkbenchHighRiskReviewItemViewModel | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const id = asNonEmptyString(record.id) ?? asNonEmptyString(record.ruleId);
  const excerpt =
    asNonEmptyString(record.excerpt) ?? asNonEmptyString(record.actual);
  const suggestion =
    asNonEmptyString(record.suggestion) ?? asNonEmptyString(record.expected);
  const rationale =
    asNonEmptyString(record.rationale) ??
    asNonEmptyString(record.explanation) ??
    asNonEmptyString(record.reason);
  const location = normalizeLocationRecord(
    record.location ?? record.semantic_hit,
  );
  const evidencePack =
    normalizeEvidencePack(record.evidence_pack) ??
    buildGovernedEvidencePack({
      excerpt,
      location,
      rationale,
      suggestion,
    });
  const candidatePosture = resolveGovernedCandidatePosture(record);
  const recommendedRoute = resolveRecommendedRoute(record);

  return {
    id: id ?? `${source}-${Date.now()}`,
    title:
      asNonEmptyString(record.title) ??
      asNonEmptyString(record.name) ??
      "高风险命中需要人工确认",
    feedbackCategory: resolveFeedbackCategory(record, recommendedRoute),
    candidate_posture: candidatePosture,
    riskLevel: resolveGenericRiskLevel(record),
    summary: asNonEmptyString(record.summary) ?? rationale,
    excerpt,
    location,
    locationText: buildHighRiskReviewLocationText(location),
    suggestion,
    rationale,
    evidence_pack: evidencePack,
    relatedRuleIds: asStringArray(record.relatedRuleIds),
    relatedKnowledgeItemIds: asStringArray(record.relatedKnowledgeItemIds),
    recommendedRoute,
    originPayload: {
      source,
      ...(id ? { itemId: id } : {}),
    },
  };
}

function resolveFeedbackCategory(
  record: Record<string, unknown>,
  recommendedRoute:
    | ManuscriptWorkbenchHighRiskReviewItemViewModel["recommendedRoute"]
    | undefined,
): ManualFeedbackCategory {
  const explicit = asNonEmptyString(record.feedbackCategory);
  if (
    explicit === "missed_hit" ||
    explicit === "incorrect_hit" ||
    explicit === "missing_knowledge"
  ) {
    return explicit;
  }

  if (recommendedRoute === "knowledge_candidate") {
    return "missing_knowledge";
  }

  return "incorrect_hit";
}

function resolveRecommendedRoute(
  record: Record<string, unknown>,
): ManuscriptWorkbenchHighRiskReviewItemViewModel["recommendedRoute"] {
  const explicit = asNonEmptyString(record.recommended_route);
  if (
    explicit === "rule_candidate" ||
    explicit === "knowledge_candidate" ||
    explicit === "prompt_template_candidate"
  ) {
    return explicit;
  }

  if (asStringArray(record.relatedKnowledgeItemIds).length > 0) {
    return "knowledge_candidate";
  }

  return "rule_candidate";
}

function resolveGovernedCandidatePosture(
  record: Record<string, unknown>,
): ManuscriptWorkbenchHighRiskReviewItemViewModel["candidate_posture"] {
  const explicit = asNonEmptyString(record.candidate_posture);
  if (explicit === "candidate_change" || explicit === "inspect_only") {
    return explicit;
  }

  return asNonEmptyString(record.suggestion)
    ? "candidate_change"
    : "inspect_only";
}

function resolveGenericRiskLevel(
  record: Record<string, unknown>,
): ManuscriptWorkbenchHighRiskReviewItemViewModel["riskLevel"] {
  const explicit = asNonEmptyString(record.riskLevel);
  if (
    explicit === "low" ||
    explicit === "medium" ||
    explicit === "high" ||
    explicit === "critical"
  ) {
    return explicit;
  }

  return resolveHighRiskLevel(asNonEmptyString(record.severity));
}

function resolveHighRiskLevel(
  severity: string | undefined,
): ManuscriptWorkbenchHighRiskReviewItemViewModel["riskLevel"] {
  switch (severity) {
    case "critical":
      return "critical";
    case "warning":
      return "medium";
    case "info":
      return "low";
    case "error":
    default:
      return "high";
  }
}

function buildHighRiskReviewLocationText(
  location?: Record<string, unknown>,
): string {
  if (!location) {
    return "待人工定位";
  }

  const parts: string[] = [];
  const tableId = asNonEmptyString(location.table_id);
  if (tableId) {
    parts.push(`表格 ${tableId}`);
  }

  const semanticTarget = asNonEmptyString(location.semantic_target);
  if (semanticTarget) {
    parts.push(semanticTarget);
  }

  const paragraphIndex = asPositiveNumber(location.paragraph_index);
  if (paragraphIndex != null) {
    parts.push(`段落 ${paragraphIndex}`);
  }

  const blockIndex = asPositiveNumber(location.blockIndex);
  if (blockIndex != null) {
    parts.push(`块 ${blockIndex}`);
  }

  return parts.length > 0 ? parts.join(" / ") : "待人工定位";
}

function buildGovernedEvidencePack(input: {
  location?: Record<string, unknown>;
  excerpt?: string;
  suggestion?: string;
  rationale?: string;
}) {
  const result: NonNullable<
    ManuscriptWorkbenchHighRiskReviewItemViewModel["evidence_pack"]
  > = {};

  if (input.location) {
    result.location = input.location;
  }
  if (input.excerpt?.trim()) {
    result.excerpt = input.excerpt.trim();
  }
  if (input.suggestion?.trim()) {
    result.suggestion = input.suggestion.trim();
  }
  if (input.rationale?.trim()) {
    result.rationale = input.rationale.trim();
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function normalizeEvidencePack(
  value: unknown,
): ManuscriptWorkbenchHighRiskReviewItemViewModel["evidence_pack"] {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  return buildGovernedEvidencePack({
    location: normalizeLocationRecord(record.location),
    excerpt: asNonEmptyString(record.excerpt),
    suggestion: asNonEmptyString(record.suggestion),
    rationale: asNonEmptyString(record.rationale),
  });
}

function normalizeLocationRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  return Object.keys(record).length > 0 ? record : undefined;
}

function getManualReviewItemsValue(
  value: unknown,
): Array<{ ruleId: string; reason: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return undefined;
      }

      const ruleId = asNonEmptyString(record.ruleId) ?? "";
      const reason = asNonEmptyString(record.reason) ?? "";
      if (ruleId.length === 0 || reason.length === 0) {
        return undefined;
      }

      return { reason, ruleId };
    })
    .filter((item): item is { ruleId: string; reason: string } => Boolean(item));
}

function buildFailedCheckRationale(
  ruleId: string | undefined,
  expected: string | undefined,
  actual: string | undefined,
): string {
  if (ruleId && expected && actual) {
    return `规则 ${ruleId} 未通过，期望 ${expected}，实际 ${actual}`;
  }
  if (ruleId && expected) {
    return `规则 ${ruleId} 未通过，建议改为 ${expected}`;
  }
  if (ruleId) {
    return `规则 ${ruleId} 未通过，需要人工确认。`;
  }
  return "高风险规则命中需要人工确认。";
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueValues(
    value.filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0,
    ),
  );
}

function asPositiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
