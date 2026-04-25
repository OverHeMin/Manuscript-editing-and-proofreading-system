import type {
  EditingCompletionGateManualObjectDecision,
  EditingCompletionGatePendingItem,
  EditingCompletionGateSummary,
  EditingSlotGovernanceSummary,
  EditingSlotResolutionState,
  ManuscriptQualityIssue,
} from "@medical/contracts";
import type { TableDocxPatchResult } from "../document-pipeline/table-docx-patch-plan.ts";
import type {
  ContentRuleCandidate,
  ManualReviewItem,
  SkippedAiReplacement,
  TableRuleInspectionFinding,
} from "../editorial-execution/types.ts";

const RESOLVED_SLOT_STATES = new Set<EditingSlotResolutionState>([
  "resolved_auto",
  "resolved_manual",
]);
const MANUAL_RESOLUTION_GUARDRAIL_REASONS = new Set([
  "meaning_risk",
  "anchor_not_precise",
  "numeric_entity_present",
  "medical_entity_present",
]);
const HIGH_RISK_OBJECT_GUARDRAIL_REASONS = new Set(["object_type_not_safe"]);
const BLOCKING_FORMAT_GUARDRAIL_REASONS = new Set(["insufficient_style_evidence"]);

export function buildEditingCompletionGateSummary(input: {
  journalTemplateId?: string;
  targetModelVersionId?: string;
  targetModelVersionNo?: number;
  sourceJobId?: string;
  currentAssetId?: string;
  generatedAt: string;
  slotGovernanceSummary: EditingSlotGovernanceSummary;
  planManualReviewItems?: readonly string[];
  manualReviewItems: readonly ManualReviewItem[];
  contentRuleCandidates: readonly ContentRuleCandidate[];
  qualityFindings: readonly ManuscriptQualityIssue[];
  tableInspectionFindings: readonly TableRuleInspectionFinding[];
  tablePatchResults: readonly TableDocxPatchResult[];
  skippedAiReplacements: readonly SkippedAiReplacement[];
  objectRiskItems?: readonly EditingCompletionGatePendingItem[];
  previousSummary?: EditingCompletionGateSummary;
}): EditingCompletionGateSummary {
  const manualObjectDecisions = normalizeManualObjectDecisions(
    input.previousSummary?.manual_object_decisions,
  );
  const overrideReasons = normalizeOverrideReasons(
    input.previousSummary?.override_reasons,
  );

  if (input.slotGovernanceSummary.observation_status !== "reported") {
    return {
      observation_status: "failed_open",
      journal_template_id: input.journalTemplateId,
      target_model_version_id: input.targetModelVersionId,
      target_model_version_no: input.targetModelVersionNo,
      ...(input.sourceJobId ? { source_job_id: input.sourceJobId } : {}),
      ...(input.currentAssetId ? { current_asset_id: input.currentAssetId } : {}),
      generated_at: input.generatedAt,
      passed: false,
      blocker_count: 0,
      unresolved_required_slots: [],
      pending_manual_resolution_items: [],
      high_risk_object_items: [],
      table_high_risk_items: [],
      blocking_format_failures: [],
      ...(manualObjectDecisions.length > 0
        ? { manual_object_decisions: manualObjectDecisions }
        : {}),
      ...(overrideReasons.length > 0 ? { override_reasons: overrideReasons } : {}),
      error:
        input.slotGovernanceSummary.error ??
        "Editing completion gate could not be derived because slot governance failed open.",
    };
  }

  const unresolvedRequiredSlots = buildRequiredSlotItems(input.slotGovernanceSummary);
  const pendingManualResolutionItems = filterDecisionResolvedItems(
    dedupePendingItems([
      ...buildGuardrailPendingItems(input.planManualReviewItems, "manual_resolution"),
      ...input.manualReviewItems.map((item) => buildManualReviewPendingItem(item)),
      ...input.contentRuleCandidates.map((item) =>
        buildContentRuleCandidatePendingItem(item),
      ),
      ...input.qualityFindings
        .filter((issue) => issue.category !== "table_text_consistency")
        .map((issue) => buildQualityFindingPendingItem(issue, "manual_resolution")),
      ...buildSkippedReplacementPendingItems(
        input.skippedAiReplacements,
        "manual_resolution",
      ),
    ]),
    manualObjectDecisions,
  );
  const highRiskObjectItems = filterDecisionResolvedItems(
    dedupePendingItems([
      ...(input.objectRiskItems ?? []).map((item) => structuredClone(item)),
      ...buildGuardrailPendingItems(input.planManualReviewItems, "high_risk_object"),
      ...buildSkippedReplacementPendingItems(
        input.skippedAiReplacements,
        "high_risk_object",
      ),
    ]),
    manualObjectDecisions,
  );
  const tableHighRiskItems = filterDecisionResolvedItems(
    dedupePendingItems([
      ...input.tableInspectionFindings.map((item) =>
        buildTableInspectionPendingItem(item),
      ),
      ...input.qualityFindings
        .filter((issue) => issue.category === "table_text_consistency")
        .map((issue) => buildQualityFindingPendingItem(issue, "table_high_risk")),
    ]),
    manualObjectDecisions,
  );
  const blockingFormatFailures = filterDecisionResolvedItems(
    dedupePendingItems([
      ...buildGuardrailPendingItems(
        input.planManualReviewItems,
        "blocking_format_failure",
      ),
      ...buildSkippedReplacementPendingItems(
        input.skippedAiReplacements,
        "blocking_format_failure",
      ),
      ...input.tablePatchResults
        .filter((item) => item.status !== "applied")
        .map((item) => buildTablePatchFailurePendingItem(item)),
    ]),
    manualObjectDecisions,
  );

  const verdict = deriveEditingCompletionGateVerdict({
    unresolvedRequiredSlots,
    pendingManualResolutionItems,
    highRiskObjectItems,
    tableHighRiskItems,
    blockingFormatFailures,
  });

  return {
    observation_status: "reported",
    verdict,
    journal_template_id: input.journalTemplateId,
    target_model_version_id: input.targetModelVersionId,
    target_model_version_no: input.targetModelVersionNo,
    ...(input.sourceJobId ? { source_job_id: input.sourceJobId } : {}),
    ...(input.currentAssetId ? { current_asset_id: input.currentAssetId } : {}),
    generated_at: input.generatedAt,
    passed: verdict === "passed",
    blocker_count:
      unresolvedRequiredSlots.length +
      pendingManualResolutionItems.length +
      highRiskObjectItems.length +
      tableHighRiskItems.length +
      blockingFormatFailures.length,
    unresolved_required_slots: unresolvedRequiredSlots,
    pending_manual_resolution_items: pendingManualResolutionItems,
    high_risk_object_items: highRiskObjectItems,
    table_high_risk_items: tableHighRiskItems,
    blocking_format_failures: blockingFormatFailures,
    ...(manualObjectDecisions.length > 0
      ? { manual_object_decisions: manualObjectDecisions }
      : {}),
    ...(overrideReasons.length > 0 ? { override_reasons: overrideReasons } : {}),
  };
}

export function refreshEditingCompletionGateSummaryWithSlotSummary(input: {
  previousSummary?: EditingCompletionGateSummary;
  slotGovernanceSummary: EditingSlotGovernanceSummary;
  generatedAt: string;
}): EditingCompletionGateSummary | undefined {
  const previousSummary = input.previousSummary;
  if (!previousSummary) {
    return undefined;
  }

  const manualObjectDecisions = normalizeManualObjectDecisions(
    previousSummary.manual_object_decisions,
  );
  const overrideReasons = normalizeOverrideReasons(previousSummary.override_reasons);
  if (input.slotGovernanceSummary.observation_status !== "reported") {
    return {
      ...cloneCompletionGateSummary(previousSummary),
      observation_status: "failed_open",
      generated_at: input.generatedAt,
      passed: false,
      blocker_count:
        previousSummary.pending_manual_resolution_items.length +
        previousSummary.high_risk_object_items.length +
        previousSummary.table_high_risk_items.length +
        previousSummary.blocking_format_failures.length,
      unresolved_required_slots: [],
      ...(manualObjectDecisions.length > 0
        ? { manual_object_decisions: manualObjectDecisions }
        : {}),
      ...(overrideReasons.length > 0 ? { override_reasons: overrideReasons } : {}),
      error:
        input.slotGovernanceSummary.error ??
        previousSummary.error ??
        "Editing completion gate could not be refreshed because slot governance failed open.",
    };
  }

  const unresolvedRequiredSlots = buildRequiredSlotItems(input.slotGovernanceSummary);
  const pendingManualResolutionItems = clonePendingItems(
    previousSummary.pending_manual_resolution_items,
  );
  const highRiskObjectItems = clonePendingItems(previousSummary.high_risk_object_items);
  const tableHighRiskItems = clonePendingItems(previousSummary.table_high_risk_items);
  const blockingFormatFailures = clonePendingItems(
    previousSummary.blocking_format_failures,
  );
  const verdict = deriveEditingCompletionGateVerdict({
    unresolvedRequiredSlots,
    pendingManualResolutionItems,
    highRiskObjectItems,
    tableHighRiskItems,
    blockingFormatFailures,
  });

  return {
    ...cloneCompletionGateSummary(previousSummary),
    observation_status: "reported",
    verdict,
    generated_at: input.generatedAt,
    passed: verdict === "passed",
    blocker_count:
      unresolvedRequiredSlots.length +
      pendingManualResolutionItems.length +
      highRiskObjectItems.length +
      tableHighRiskItems.length +
      blockingFormatFailures.length,
    unresolved_required_slots: unresolvedRequiredSlots,
    pending_manual_resolution_items: pendingManualResolutionItems,
    high_risk_object_items: highRiskObjectItems,
    table_high_risk_items: tableHighRiskItems,
    blocking_format_failures: blockingFormatFailures,
    ...(manualObjectDecisions.length > 0
      ? { manual_object_decisions: manualObjectDecisions }
      : {}),
    ...(overrideReasons.length > 0 ? { override_reasons: overrideReasons } : {}),
    error: undefined,
  };
}

function deriveEditingCompletionGateVerdict(input: {
  unresolvedRequiredSlots: readonly EditingCompletionGatePendingItem[];
  pendingManualResolutionItems: readonly EditingCompletionGatePendingItem[];
  highRiskObjectItems: readonly EditingCompletionGatePendingItem[];
  tableHighRiskItems: readonly EditingCompletionGatePendingItem[];
  blockingFormatFailures: readonly EditingCompletionGatePendingItem[];
}): EditingCompletionGateSummary["verdict"] {
  if (input.unresolvedRequiredSlots.length > 0) {
    return "blocked_by_missing_required_slots";
  }

  if (
    input.highRiskObjectItems.length > 0 ||
    input.tableHighRiskItems.length > 0 ||
    input.blockingFormatFailures.length > 0
  ) {
    return "blocked_by_high_risk_objects";
  }

  if (input.pendingManualResolutionItems.length > 0) {
    return "needs_manual_resolution";
  }

  return "passed";
}

function buildRequiredSlotItems(
  slotGovernanceSummary: EditingSlotGovernanceSummary,
): EditingCompletionGatePendingItem[] {
  const blockingSlotKeys = new Set(slotGovernanceSummary.blocking_slot_keys);
  return slotGovernanceSummary.slots
    .filter((slot) => slot.required && slot.enabled)
    .filter((slot) => blockingSlotKeys.has(slot.slot_key))
    .filter((slot) => !RESOLVED_SLOT_STATES.has(slot.state))
    .map((slot) => ({
      item_key: `slot:${slot.slot_key}`,
      category: "required_slot" as const,
      source: "slot_governance" as const,
      summary: `${slot.label} 尚未解决`,
      detail: slot.resolution_reason,
      location_text: `锚点：${slot.anchor}`,
      related_slot_key: slot.slot_key,
      status: "pending" as const,
    }));
}

function buildManualReviewPendingItem(
  item: ManualReviewItem,
): EditingCompletionGatePendingItem {
  return {
    item_key: `manual-review:${item.ruleId}:${item.reason}`,
    category: "manual_resolution",
    source: "manual_review_item",
    summary: item.ruleId
      ? `规则 ${item.ruleId} 需要人工复核`
      : "规则命中需要人工复核",
    detail: item.reason,
    ...(item.reviewItemId ? { review_item_id: item.reviewItemId } : {}),
    ...(item.ruleId ? { related_rule_id: item.ruleId } : {}),
    status: "pending",
  };
}

function buildContentRuleCandidatePendingItem(
  item: ContentRuleCandidate,
): EditingCompletionGatePendingItem {
  return {
    item_key: `content-rule:${item.ruleId}:${item.actionKind}:${item.reason}`,
    category: "manual_resolution",
    source: "content_rule_candidate",
    summary: item.ruleId
      ? `内容规则 ${item.ruleId} 需要人工确认`
      : "内容规则候选需要人工确认",
    detail: item.reason,
    ...(item.reviewItemId ? { review_item_id: item.reviewItemId } : {}),
    ...(item.ruleId ? { related_rule_id: item.ruleId } : {}),
    status: "pending",
  };
}

function buildQualityFindingPendingItem(
  issue: ManuscriptQualityIssue,
  category: "manual_resolution" | "table_high_risk",
): EditingCompletionGatePendingItem {
  return {
    item_key: `quality:${issue.issue_id}`,
    category,
    source: "quality_finding",
    summary:
      category === "table_high_risk"
        ? `表格质量问题 ${issue.issue_type} 需要处理`
        : `质量问题 ${issue.issue_type} 需要人工确认`,
    detail: issue.explanation,
    location_text: buildQualityFindingLocationText(issue),
    status: "pending",
  };
}

function buildTableInspectionPendingItem(
  item: TableRuleInspectionFinding,
): EditingCompletionGatePendingItem {
  return {
    item_key: [
      "table-inspection",
      item.ruleId,
      item.semantic_hit.table_id,
      item.semantic_hit.semantic_target,
      item.semantic_hit.header_path?.join(">") ?? "",
      item.semantic_hit.column_key ?? "",
    ].join(":"),
    category: "table_high_risk",
    source: "table_inspection_finding",
    summary: item.ruleId
      ? `表格规则 ${item.ruleId} 需要人工复核`
      : "表格规则命中需要人工复核",
    detail: item.reason,
    location_text: buildTableLocationText({
      tableId: item.semantic_hit.table_id,
      semanticTarget: item.semantic_hit.semantic_target,
      headerPath: item.semantic_hit.header_path,
      columnKey: item.semantic_hit.column_key,
    }),
    ...(item.reviewItemId ? { review_item_id: item.reviewItemId } : {}),
    ...(item.ruleId ? { related_rule_id: item.ruleId } : {}),
    status: "pending",
  };
}

function buildTablePatchFailurePendingItem(
  item: TableDocxPatchResult,
): EditingCompletionGatePendingItem {
  return {
    item_key: `table-patch:${item.patch_id}:${item.status}`,
    category: "blocking_format_failure",
    source: "table_patch_result",
    summary: `表格格式处理 ${item.patch_type} 未完成`,
    detail: item.reason,
    location_text: buildTableLocationText({
      tableId: item.table_id,
      semanticTarget: item.semantic_target,
      headerPath: item.anchor?.header_path,
      columnKey: item.anchor?.column_key,
    }),
    ...(item.rule_id ? { related_rule_id: item.rule_id } : {}),
    status: "pending",
  };
}

function buildSkippedReplacementPendingItems(
  replacements: readonly SkippedAiReplacement[],
  category:
    | "manual_resolution"
    | "high_risk_object"
    | "blocking_format_failure",
): EditingCompletionGatePendingItem[] {
  return replacements.flatMap((replacement) => {
    const mappedCategory = classifyGuardrailCategory(replacement.reason);
    if (mappedCategory !== category) {
      return [];
    }

    return [
      {
        item_key: `skipped-ai:${replacement.replacementId}:${replacement.reason}`,
        category,
        source: "skipped_ai_replacement",
        summary: buildGuardrailSummary(replacement.reason, category),
        detail: replacement.targetText ?? replacement.replacementId,
        status: "pending" as const,
      },
    ];
  });
}

function buildGuardrailPendingItems(
  values: readonly string[] | undefined,
  category:
    | "manual_resolution"
    | "high_risk_object"
    | "blocking_format_failure",
): EditingCompletionGatePendingItem[] {
  return (values ?? []).flatMap((value) => {
    const parsed = parseEditingGuardrailManualReviewItem(value);
    if (!parsed || classifyGuardrailCategory(parsed.reasonCode) !== category) {
      return [];
    }

    return [
      {
        item_key: `editing-guardrail:${parsed.sourceStage}:${parsed.reasonCode}:${parsed.excerpt}`,
        category,
        source: "editing_guardrail" as const,
        summary: buildGuardrailSummary(parsed.reasonCode, category),
        detail: parsed.excerpt,
        status: "pending" as const,
      },
    ];
  });
}

function classifyGuardrailCategory(
  reasonCode: string,
):
  | "manual_resolution"
  | "high_risk_object"
  | "blocking_format_failure"
  | undefined {
  if (MANUAL_RESOLUTION_GUARDRAIL_REASONS.has(reasonCode)) {
    return "manual_resolution";
  }

  if (HIGH_RISK_OBJECT_GUARDRAIL_REASONS.has(reasonCode)) {
    return "high_risk_object";
  }

  if (BLOCKING_FORMAT_GUARDRAIL_REASONS.has(reasonCode)) {
    return "blocking_format_failure";
  }

  return undefined;
}

function buildGuardrailSummary(
  reasonCode: string,
  category:
    | "manual_resolution"
    | "high_risk_object"
    | "blocking_format_failure",
): string {
  if (category === "high_risk_object") {
    return `高风险对象内容待人工确认：${formatEditingGuardrailReasonLabel(reasonCode)}`;
  }

  if (category === "blocking_format_failure") {
    return `格式证据不足，当前不能自动完成：${formatEditingGuardrailReasonLabel(
      reasonCode,
    )}`;
  }

  return `编辑护栏要求人工确认：${formatEditingGuardrailReasonLabel(reasonCode)}`;
}

function buildQualityFindingLocationText(
  issue: ManuscriptQualityIssue,
): string | undefined {
  const parts: string[] = [];
  if (typeof issue.paragraph_index === "number") {
    parts.push(`段落 ${issue.paragraph_index + 1}`);
  }
  if (typeof issue.sentence_index === "number") {
    parts.push(`句子 ${issue.sentence_index + 1}`);
  }
  return parts.length > 0 ? parts.join(" / ") : undefined;
}

function buildTableLocationText(input: {
  tableId?: string;
  semanticTarget?: string;
  headerPath?: readonly string[];
  columnKey?: string;
}): string | undefined {
  const parts: string[] = [];
  if (input.tableId) {
    parts.push(`表格 ${input.tableId}`);
  }
  if (input.semanticTarget) {
    parts.push(input.semanticTarget);
  }
  if (input.headerPath && input.headerPath.length > 0) {
    parts.push(input.headerPath.join(" > "));
  } else if (input.columnKey) {
    parts.push(input.columnKey);
  }
  return parts.length > 0 ? parts.join(" / ") : undefined;
}

function parseEditingGuardrailManualReviewItem(
  value: string,
):
  | {
      sourceStage: "planning";
      reasonCode: string;
      excerpt: string;
    }
  | undefined {
  const normalizedValue = value.trim();
  const prefix = "editing_guardrail:";
  if (!normalizedValue.startsWith(prefix)) {
    return undefined;
  }

  const remainder = normalizedValue.slice(prefix.length);
  const separatorIndex = remainder.indexOf(":");
  if (separatorIndex <= 0) {
    return undefined;
  }

  const reasonCode = remainder.slice(0, separatorIndex).trim();
  const excerpt = remainder.slice(separatorIndex + 1).trim();
  if (!reasonCode || !excerpt) {
    return undefined;
  }

  return {
    sourceStage: "planning",
    reasonCode,
    excerpt,
  };
}

function filterDecisionResolvedItems(
  items: readonly EditingCompletionGatePendingItem[],
  manualObjectDecisions: readonly EditingCompletionGateManualObjectDecision[],
): EditingCompletionGatePendingItem[] {
  const decisionsByItemKey = new Map(
    manualObjectDecisions.map((entry) => [entry.item_key, entry.decision]),
  );

  return items.filter((item) => {
    const decision = decisionsByItemKey.get(item.item_key);
    return (
      decision !== "accepted_change_only" &&
      decision !== "manual_only" &&
      decision !== "waived"
    );
  });
}

function dedupePendingItems(
  items: readonly EditingCompletionGatePendingItem[],
): EditingCompletionGatePendingItem[] {
  const deduped = new Map<string, EditingCompletionGatePendingItem>();
  for (const item of items) {
    deduped.set(item.item_key, structuredClone(item));
  }
  return [...deduped.values()];
}

function clonePendingItems(
  items: readonly EditingCompletionGatePendingItem[],
): EditingCompletionGatePendingItem[] {
  return items.map((item) => structuredClone(item));
}

function normalizeManualObjectDecisions(
  values: readonly EditingCompletionGateManualObjectDecision[] | undefined,
): EditingCompletionGateManualObjectDecision[] {
  return (values ?? []).map((value) => structuredClone(value));
}

function normalizeOverrideReasons(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function cloneCompletionGateSummary(
  summary: EditingCompletionGateSummary,
): EditingCompletionGateSummary {
  return {
    ...structuredClone(summary),
    unresolved_required_slots: clonePendingItems(summary.unresolved_required_slots),
    pending_manual_resolution_items: clonePendingItems(
      summary.pending_manual_resolution_items,
    ),
    high_risk_object_items: clonePendingItems(summary.high_risk_object_items),
    table_high_risk_items: clonePendingItems(summary.table_high_risk_items),
    blocking_format_failures: clonePendingItems(summary.blocking_format_failures),
    ...(summary.manual_object_decisions
      ? {
          manual_object_decisions: normalizeManualObjectDecisions(
            summary.manual_object_decisions,
          ),
        }
      : {}),
    ...(summary.override_reasons
      ? { override_reasons: normalizeOverrideReasons(summary.override_reasons) }
      : {}),
  };
}

function formatEditingGuardrailReasonLabel(reasonCode: string): string {
  switch (reasonCode) {
    case "meaning_risk":
      return "存在语义风险";
    case "anchor_not_precise":
      return "锚点不够精确";
    case "numeric_entity_present":
      return "包含数值实体";
    case "medical_entity_present":
      return "包含医学实体";
    case "object_type_not_safe":
      return "对象类型不安全";
    case "insufficient_style_evidence":
      return "样式证据不足";
    default:
      return reasonCode;
  }
}
