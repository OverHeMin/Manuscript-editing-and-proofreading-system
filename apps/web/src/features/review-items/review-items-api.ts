import type { EvaluationSuiteViewModel } from "../verification-ops/types.ts";
import type { HumanFeedbackRecordViewModel } from "../feedback-governance/types.ts";
import type {
  GovernedHitReviewItemViewModel,
  ReviewItemDecisionResultViewModel,
  ReviewItemViewModel,
} from "./types.ts";

export interface ReviewItemsHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export interface SubmitGovernedHitInput {
  reviewItemId?: string;
  manuscriptId: string;
  manuscriptType: string;
  module: "screening" | "editing" | "proofreading";
  snapshotId: string;
  sourceAssetId: string;
  feedbackCategory: "missed_hit" | "incorrect_hit" | "missing_knowledge";
  feedbackText?: string;
  title?: string;
  excerpt?: string;
  location?: Record<string, unknown>;
  riskLevel?: "low" | "medium" | "high" | "critical";
  suggestion?: string;
  rationale?: string;
  candidatePosture?: "candidate_change" | "inspect_only";
  decisionSource?: "manual_feedback" | "execution_hit";
  evidencePack?: {
    location?: Record<string, unknown>;
    excerpt?: string;
    suggestion?: string;
    rationale?: string;
  };
  relatedRuleIds?: string[];
  relatedKnowledgeItemIds?: string[];
  originPayload?: Record<string, unknown>;
}

export interface ListReviewItemsFilters {
  sourceKind?: "governed_hit" | "residual_issue" | "learning_candidate";
  module?: string;
  manuscriptId?: string;
  riskLevel?: "low" | "medium" | "high" | "critical";
  reviewStatus?: "pending" | "decided" | "routed";
}

export interface SubmitGovernedHitResultViewModel {
  feedback: HumanFeedbackRecordViewModel;
  item: GovernedHitReviewItemViewModel;
}

export type DecideReviewItemInput =
  | {
      sourceKind: "governed_hit";
      id: string;
      action:
        | "accept_change_only"
        | "reject_as_false_positive"
        | "route_to_rule_candidate"
        | "route_to_knowledge_candidate"
        | "route_to_prompt_candidate"
        | "archive_as_evidence_only";
      title?: string;
      proposalText?: string;
    }
  | {
      sourceKind: "residual_issue";
      id: string;
      action: "validate";
      suiteIds: string[];
      releaseCheckProfileId?: string;
    }
  | {
      sourceKind: "residual_issue";
      id: string;
      action:
        | "accept_change_only"
        | "reject_as_false_positive"
        | "route_to_rule_candidate"
        | "route_to_knowledge_candidate"
        | "route_to_prompt_candidate"
        | "archive_as_evidence_only";
      title?: string;
      proposalText?: string;
    }
  | {
      sourceKind: "learning_candidate";
      id: string;
      action: "approve";
      reviewNote?: string;
    }
  | {
      sourceKind: "learning_candidate";
      id: string;
      action: "reject";
      reviewNote?: string;
    };

export function listReviewItems(
  client: ReviewItemsHttpClient,
  filters: ListReviewItemsFilters = {},
) {
  const query = new URLSearchParams();

  if (filters.sourceKind) {
    query.set("sourceKind", filters.sourceKind);
  }

  if (filters.module?.trim()) {
    query.set("module", filters.module.trim());
  }

  if (filters.manuscriptId?.trim()) {
    query.set("manuscriptId", filters.manuscriptId.trim());
  }

  if (filters.riskLevel) {
    query.set("riskLevel", filters.riskLevel);
  }

  if (filters.reviewStatus) {
    query.set("reviewStatus", filters.reviewStatus);
  }

  return client.request<ReviewItemViewModel[]>({
    method: "GET",
    url: query.size > 0 ? `/api/v1/review-items?${query.toString()}` : "/api/v1/review-items",
  });
}

export function submitGovernedHit(
  client: ReviewItemsHttpClient,
  input: SubmitGovernedHitInput,
) {
  return client.request<SubmitGovernedHitResultViewModel>({
    method: "POST",
    url: "/api/v1/review-items/governed-hits",
    body: input,
  });
}

export function decideReviewItem(
  client: ReviewItemsHttpClient,
  input: DecideReviewItemInput,
) {
  return client.request<ReviewItemDecisionResultViewModel>({
    method: "POST",
    url: `/api/v1/review-items/${encodeURIComponent(input.id)}/decide`,
    body:
      input.action === "validate"
        ? {
            sourceKind: input.sourceKind,
            action: input.action,
            suiteIds: input.suiteIds,
            releaseCheckProfileId: input.releaseCheckProfileId,
          }
        : input.sourceKind !== "learning_candidate"
          ? {
              sourceKind: input.sourceKind,
              action: input.action,
              title: input.title,
              proposalText: input.proposalText,
            }
          : {
              sourceKind: input.sourceKind,
              action: input.action,
              reviewNote: input.reviewNote,
            },
  });
}

export function selectApplicableResidualValidationSuiteIds(
  suites: readonly EvaluationSuiteViewModel[],
  module: string,
): string[] {
  return suites
    .filter(
      (suite) =>
        suite.status === "active" &&
        suite.suite_type === "release_gate" &&
        (suite.module_scope === "any" ||
          suite.module_scope.includes(module as never)),
    )
    .map((suite) => suite.id);
}
