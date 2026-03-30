import type {
  ApproveLearningCandidateInput,
  CreateGovernedLearningCandidateInput,
  CreateLearningCandidateInput,
  CreateReviewedCaseSnapshotInput,
  LearningCandidateViewModel,
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

export function listLearningCandidates(client: LearningReviewHttpClient) {
  return client.request<LearningCandidateViewModel[]>({
    method: "GET",
    url: "/api/v1/learning/candidates",
  });
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
    },
  });
}
