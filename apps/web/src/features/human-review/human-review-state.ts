import type {
  HumanReviewDiffItemDecisionPatch,
  HumanReviewDiffItemFilters,
  HumanReviewDiffItemViewModel,
  HumanReviewDiffSummaryViewModel,
} from "./types.ts";

export function filterHumanReviewDiffItems(
  items: readonly HumanReviewDiffItemViewModel[],
  filters: HumanReviewDiffItemFilters = {},
): HumanReviewDiffItemViewModel[] {
  return items.filter((item) => {
    if (!matchesStatusFilter(item, filters.status ?? "all")) {
      return false;
    }

    if (
      filters.module &&
      filters.module !== "all" &&
      item.module !== filters.module
    ) {
      return false;
    }

    if (
      filters.governanceIntent &&
      filters.governanceIntent !== "all" &&
      !matchesGovernanceIntent(item, filters.governanceIntent)
    ) {
      return false;
    }

    const query = filters.query?.trim().toLowerCase();
    if (query && !matchesQuery(item, query)) {
      return false;
    }

    return true;
  });
}

export function applyHumanReviewBatchDecision(
  items: readonly HumanReviewDiffItemViewModel[],
  patch: HumanReviewDiffItemDecisionPatch,
): HumanReviewDiffItemViewModel[] {
  return items.map((item) => ({
    ...item,
    ...(patch.content_decision
      ? { content_decision: patch.content_decision }
      : {}),
    ...(patch.note !== undefined ? { note: patch.note } : {}),
    governance_intents: patch.governance_intents
      ? {
          ...item.governance_intents,
          ...patch.governance_intents,
        }
      : {
          ...item.governance_intents,
        },
  }));
}

export function summarizeHumanReviewDiffItems(
  items: readonly HumanReviewDiffItemViewModel[],
): HumanReviewDiffSummaryViewModel {
  const unconfirmedCount = items.filter(
    (item) => item.content_decision === "unconfirmed",
  ).length;
  const deferredCount = items.filter(
    (item) => item.content_decision === "defer",
  ).length;
  const unsafeBlockingCount = items.filter(isUnsafeBlockingItem).length;
  const materializationBlockingCount = items.filter(
    (item) =>
      item.content_decision === "keep" && !canV1MaterializeKeptDiffItem(item),
  ).length;

  return {
    total_count: items.length,
    unconfirmed_count: unconfirmedCount,
    deferred_count: deferredCount,
    unsafe_blocking_count: unsafeBlockingCount,
    materialization_blocking_count: materializationBlockingCount,
    kept_count: items.filter((item) => item.content_decision === "keep").length,
    rejected_count: items.filter((item) => item.content_decision === "reject")
      .length,
    rule_intent_count: items.filter(
      (item) => item.governance_intents.rule_candidate,
    ).length,
    knowledge_intent_count: items.filter(
      (item) => item.governance_intents.knowledge_candidate,
    ).length,
    backflow_failed_count: items.filter(
      (item) => item.status === "writeback_failed",
    ).length,
    can_publish:
      unconfirmedCount === 0 &&
      deferredCount === 0 &&
      unsafeBlockingCount === 0 &&
      materializationBlockingCount === 0,
  };
}

function matchesStatusFilter(
  item: HumanReviewDiffItemViewModel,
  status: NonNullable<HumanReviewDiffItemFilters["status"]>,
): boolean {
  switch (status) {
    case "all":
      return true;
    case "unconfirmed":
    case "keep":
    case "reject":
    case "defer":
      return item.content_decision === status;
    case "confirmed":
      return item.status === "confirmed";
    case "unsafe":
      return isUnsafeBlockingItem(item);
    case "writeback_failed":
      return item.status === "writeback_failed";
  }
}

function matchesGovernanceIntent(
  item: HumanReviewDiffItemViewModel,
  intent: "rule_candidate" | "knowledge_candidate",
): boolean {
  return intent === "rule_candidate"
    ? item.governance_intents.rule_candidate
    : item.governance_intents.knowledge_candidate;
}

function matchesQuery(
  item: HumanReviewDiffItemViewModel,
  query: string,
): boolean {
  return [
    item.id,
    item.summary,
    item.before_text,
    item.after_text,
    item.note,
    item.location?.section_label,
  ]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(query));
}

function isUnsafeBlockingItem(item: HumanReviewDiffItemViewModel): boolean {
  return (
    item.apply_capability === "unsafe_needs_manual_review" ||
    item.status === "blocks_publish"
  );
}

function canV1MaterializeKeptDiffItem(
  item: HumanReviewDiffItemViewModel,
): boolean {
  return (
    item.apply_capability === "auto_apply_revert" &&
    Boolean(item.before_text?.trim()) &&
    Boolean(item.after_text?.trim())
  );
}
