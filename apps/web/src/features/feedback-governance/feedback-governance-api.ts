import type {
  CreateManualFeedbackHandoffInput,
  HumanFeedbackRecordViewModel,
  LearningCandidateSourceLinkViewModel,
  LinkLearningCandidateSourceInput,
  ManualFeedbackHandoffViewModel,
  RecordHumanFeedbackInput,
} from "./types.ts";

export interface FeedbackGovernanceHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function recordHumanFeedback(
  client: FeedbackGovernanceHttpClient,
  input: RecordHumanFeedbackInput,
) {
  return client.request<HumanFeedbackRecordViewModel>({
    method: "POST",
    url: "/api/v1/feedback-governance/human-feedback",
    body: {
      input,
    },
  });
}

export function listHumanFeedbackBySnapshotId(
  client: FeedbackGovernanceHttpClient,
  snapshotId: string,
) {
  return client.request<HumanFeedbackRecordViewModel[]>({
    method: "GET",
    url: `/api/v1/feedback-governance/snapshots/${snapshotId}/human-feedback`,
  });
}

export function linkLearningCandidateSource(
  client: FeedbackGovernanceHttpClient,
  input: LinkLearningCandidateSourceInput,
) {
  return client.request<LearningCandidateSourceLinkViewModel>({
    method: "POST",
    url: "/api/v1/feedback-governance/learning-candidate-source-links",
    body: {
      input,
    },
  });
}

export function listLearningCandidateSourceLinksByCandidateId(
  client: FeedbackGovernanceHttpClient,
  learningCandidateId: string,
) {
  return client.request<LearningCandidateSourceLinkViewModel[]>({
    method: "GET",
    url: `/api/v1/feedback-governance/learning-candidates/${learningCandidateId}/source-links`,
  });
}

export function createManualFeedbackHandoff(
  client: FeedbackGovernanceHttpClient,
  input: CreateManualFeedbackHandoffInput,
) {
  return client.request<ManualFeedbackHandoffViewModel>({
    method: "POST",
    url: "/api/v1/feedback-governance/manual-feedback-handoffs",
    body: {
      input,
    },
  });
}
