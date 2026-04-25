import type { LearningCandidateRecord } from "../learning/learning-record.ts";
import type { ResidualIssueRecord } from "../residual-learning/residual-learning-record.ts";
import { deriveResidualCandidateRoute } from "../residual-learning/residual-routing.ts";
import type {
  GovernedHitReviewItemRecord,
  LearningCandidateReviewItemRecord,
  ReviewItemAction,
  ReviewItemRecord,
  ResidualReviewItemRecord,
} from "./review-item-record.ts";

export function mapGovernedHitToReviewItem(
  record: GovernedHitReviewItemRecord,
): GovernedHitReviewItemRecord {
  return {
    ...record,
    ...(record.evidence_pack
      ? {
          evidence_pack: {
            ...record.evidence_pack,
            ...(record.evidence_pack.location
              ? { location: { ...record.evidence_pack.location } }
              : {}),
          },
        }
      : record.location || record.excerpt || record.suggestion || record.rationale
        ? {
            evidence_pack: {
              ...(record.location ? { location: { ...record.location } } : {}),
              ...(record.excerpt ? { excerpt: record.excerpt } : {}),
              ...(record.suggestion ? { suggestion: record.suggestion } : {}),
              ...(record.rationale ? { rationale: record.rationale } : {}),
            },
          }
        : {}),
    available_actions:
      record.review_status === "pending" ? deriveGovernedHitActions() : [],
  };
}

export function mapResidualIssueToReviewItem(
  issue: ResidualIssueRecord,
): ResidualReviewItemRecord {
  return {
    id: issue.id,
    source_kind: "residual_issue",
    source_status: issue.status,
    review_status: deriveResidualIssueReviewStatus(issue),
    module: issue.module,
    manuscript_id: issue.manuscript_id,
    manuscript_type: issue.manuscript_type,
    snapshot_id: issue.execution_snapshot_id,
    title: `Residual ${issue.issue_type} candidate`,
    summary: normalizeSummary(issue.rationale, issue.suggestion, issue.excerpt),
    excerpt: issue.excerpt,
    source_asset_id: issue.output_asset_id,
    location: issue.location,
    risk_level: issue.risk_level,
    suggestion: issue.suggestion,
    rationale: issue.rationale,
    related_rule_ids: issue.related_rule_ids,
    related_knowledge_item_ids: issue.related_knowledge_item_ids,
    recommended_route: issue.recommended_route,
    harness_validation_status: issue.harness_validation_status,
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    available_actions: deriveResidualIssueActions(issue),
    issue_type: issue.issue_type,
    execution_snapshot_id: issue.execution_snapshot_id,
    learning_candidate_id: issue.learning_candidate_id,
    origin_payload: issue.signal_breakdown,
  };
}

export function mapLearningCandidateToReviewItem(
  candidate: LearningCandidateRecord,
): LearningCandidateReviewItemRecord {
  return {
    id: candidate.id,
    source_kind: "learning_candidate",
    source_status: candidate.status,
    review_status: deriveLearningCandidateReviewStatus(candidate),
    status: candidate.status,
    module: candidate.module,
    manuscript_id: candidate.manuscript_id,
    manuscript_type: candidate.manuscript_type,
    title: candidate.title?.trim() || candidate.id,
    summary: normalizeSummary(candidate.proposal_text),
    excerpt: undefined,
    source_asset_id: candidate.snapshot_asset_id,
    recommended_route: mapLearningCandidateTypeToRoute(candidate.type),
    created_at: candidate.created_at,
    updated_at: candidate.updated_at,
    available_actions: candidate.status === "pending_review" ? ["approve", "reject"] : [],
    candidate_type: candidate.type,
    type: candidate.type,
    governed_provenance_kind: candidate.governed_provenance_kind,
    proposal_text: candidate.proposal_text,
    candidate_payload: candidate.candidate_payload,
    suggested_rule_object: candidate.suggested_rule_object,
    suggested_template_family_id: candidate.suggested_template_family_id,
    suggested_journal_template_id: candidate.suggested_journal_template_id,
    created_by: candidate.created_by,
    review_actions: candidate.review_actions,
    origin_payload: candidate.candidate_payload,
  };
}

export function compareReviewItems(
  left: ReviewItemRecord,
  right: ReviewItemRecord,
): number {
  if (left.updated_at !== right.updated_at) {
    return right.updated_at.localeCompare(left.updated_at);
  }

  if (left.created_at !== right.created_at) {
    return right.created_at.localeCompare(left.created_at);
  }

  return left.id.localeCompare(right.id);
}

export function isGovernedHitQueueable(
  item: GovernedHitReviewItemRecord,
): boolean {
  return item.review_status === "pending";
}

export function isResidualIssueQueueable(issue: ResidualIssueRecord): boolean {
  return (
    issue.recommended_route === "rule_candidate" &&
    !(
    issue.status === "candidate_created" ||
    issue.status === "manual_only" ||
    issue.status === "evidence_only" ||
    issue.status === "archived"
    )
  );
}

export function isLearningCandidateQueueable(
  candidate: LearningCandidateRecord,
): boolean {
  return (
    candidate.status === "pending_review" &&
    candidate.type === "rule_candidate"
  );
}

function deriveGovernedHitActions(): ReviewItemAction[] {
  return [
    "accept_change_only",
    "reject_as_false_positive",
    "route_to_rule_candidate",
    "route_to_knowledge_candidate",
    "route_to_prompt_candidate",
    "archive_as_evidence_only",
  ];
}

function deriveResidualIssueActions(
  issue: ResidualIssueRecord,
): ReviewItemAction[] {
  const resolutionActions: ReviewItemAction[] = [
    "accept_change_only",
    "reject_as_false_positive",
    "archive_as_evidence_only",
  ];

  if (
    issue.status === "candidate_ready" &&
    issue.harness_validation_status === "passed" &&
    !issue.learning_candidate_id
  ) {
    return [
      ...resolutionActions,
      "route_to_rule_candidate",
      "route_to_knowledge_candidate",
      "route_to_prompt_candidate",
    ];
  }

  if (
    issue.status === "candidate_created" ||
    issue.status === "manual_only" ||
    issue.status === "evidence_only" ||
    issue.status === "archived"
  ) {
    return [];
  }

  if (issue.status === "manual_review_pending") {
    const promotedAction = deriveManualReviewLearningAction(issue);
    return promotedAction
      ? [...resolutionActions, promotedAction]
      : resolutionActions;
  }

  return ["validate", ...resolutionActions];
}

function deriveResidualIssueReviewStatus(
  issue: ResidualIssueRecord,
): ResidualReviewItemRecord["review_status"] {
  if (issue.status === "candidate_created") {
    return "routed";
  }

  if (
    issue.status === "manual_only" ||
    issue.status === "evidence_only" ||
    issue.status === "archived"
  ) {
    return "decided";
  }

  return "pending";
}

function deriveLearningCandidateReviewStatus(
  candidate: LearningCandidateRecord,
): LearningCandidateReviewItemRecord["review_status"] {
  switch (candidate.status) {
    case "approved":
    case "rejected":
      return "decided";
    case "pending_review":
      return "pending";
    default:
      return "routed";
  }
}

function mapLearningCandidateTypeToRoute(
  type: LearningCandidateRecord["type"],
): LearningCandidateReviewItemRecord["recommended_route"] | undefined {
  switch (type) {
    case "rule_candidate":
      return "rule_candidate";
    case "knowledge_candidate":
      return "knowledge_candidate";
    case "prompt_optimization_candidate":
      return "prompt_template_candidate";
    default:
      return undefined;
  }
}

function normalizeSummary(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

function deriveManualReviewLearningAction(
  issue: ResidualIssueRecord,
): ReviewItemAction | undefined {
  if (
    issue.status !== "manual_review_pending" ||
    issue.harness_validation_status !== "not_required" ||
    issue.learning_candidate_id
  ) {
    return undefined;
  }

  return deriveResidualCandidateRoute(issue.issue_type) === "knowledge_candidate"
    ? "route_to_knowledge_candidate"
    : undefined;
}
