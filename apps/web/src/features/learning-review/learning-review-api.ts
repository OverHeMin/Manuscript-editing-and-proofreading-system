import type {
  ApproveLearningCandidateInput,
  CreateGovernedLearningCandidateInput,
  CreateLearningCandidateInput,
  CreateReviewedCaseSnapshotInput,
  LearningCandidateViewModel,
  RejectLearningCandidateInput,
  ReviewedCaseSnapshotViewModel,
} from "./types.ts";

export interface LearningReviewHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export interface ListLearningCandidatesInput {
  type?: "rule_candidate" | "knowledge_candidate";
  status?: LearningCandidateViewModel["status"];
  module?: "screening" | "editing" | "proofreading";
  manuscriptId?: string;
}

export function createReviewedCaseSnapshot(
  client: LearningReviewHttpClient,
  input: CreateReviewedCaseSnapshotInput,
) {
  return client.request<ReviewedCaseSnapshotViewModel>({
    method: "POST",
    url: "/api/v1/learning/reviewed-case-snapshots",
    body: input,
  });
}

export function createLearningCandidate(
  client: LearningReviewHttpClient,
  input: CreateLearningCandidateInput,
) {
  return client.request<LearningCandidateViewModel>({
    method: "POST",
    url: "/api/v1/learning/candidates",
    body: input,
  });
}

export function listLearningCandidates(
  client: LearningReviewHttpClient,
  input: ListLearningCandidatesInput = {},
) {
  const query = createLearningCandidateListQuery(input);
  return client.request<LearningCandidateViewModel[]>({
    method: "GET",
    url: `/api/v1/learning/candidates${query}`,
  });
}

function createLearningCandidateListQuery(
  input: ListLearningCandidatesInput,
): string {
  const params = new URLSearchParams();
  if (input.type) {
    params.set("type", input.type);
  }
  if (input.status) {
    params.set("status", input.status);
  }
  if (input.module) {
    params.set("module", input.module);
  }
  if (input.manuscriptId?.trim()) {
    params.set("manuscriptId", input.manuscriptId.trim());
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export function listPendingLearningReviewCandidates(
  client: LearningReviewHttpClient,
) {
  return client.request<LearningCandidateViewModel[]>({
    method: "GET",
    url: "/api/v1/learning/candidates/review-queue",
  });
}

export function getLearningCandidate(
  client: LearningReviewHttpClient,
  candidateId: string,
) {
  return client.request<LearningCandidateViewModel>({
    method: "GET",
    url: `/api/v1/learning/candidates/${candidateId}`,
  });
}

export function createGovernedLearningCandidate(
  client: LearningReviewHttpClient,
  input: CreateGovernedLearningCandidateInput,
) {
  return client.request<LearningCandidateViewModel>({
    method: "POST",
    url: "/api/v1/learning/candidates/governed",
    body: input,
  });
}

export function approveLearningCandidate(
  client: LearningReviewHttpClient,
  input: ApproveLearningCandidateInput,
) {
  return client.request<LearningCandidateViewModel>({
    method: "POST",
    url: `/api/v1/learning/candidates/${input.candidateId}/approve`,
    body: {
      actorRole: input.actorRole,
      reviewNote: input.reviewNote,
    },
  });
}

export function rejectLearningCandidate(
  client: LearningReviewHttpClient,
  input: RejectLearningCandidateInput,
) {
  return client.request<LearningCandidateViewModel>({
    method: "POST",
    url: `/api/v1/learning/candidates/${input.candidateId}/reject`,
    body: {
      actorRole: input.actorRole,
      reviewNote: input.reviewNote,
    },
  });
}
