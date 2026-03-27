import type {
  ApproveLearningCandidateInput,
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
    url: "/api/v1/learning/snapshots",
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
