import type {
  ApplyLearningWritebackInput,
  CreateLearningWritebackInput,
  LearningWritebackViewModel,
} from "./types.ts";

export interface LearningGovernanceHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function createLearningWriteback(
  client: LearningGovernanceHttpClient,
  input: CreateLearningWritebackInput,
) {
  return client.request<LearningWritebackViewModel>({
    method: "POST",
    url: "/api/v1/learning-governance/writebacks",
    body: {
      actorRole: input.actorRole,
      input: {
        learningCandidateId: input.learningCandidateId,
        targetType: input.targetType,
        createdBy: input.createdBy,
      },
    },
  });
}

export function applyLearningWriteback(
  client: LearningGovernanceHttpClient,
  input: ApplyLearningWritebackInput,
) {
  // Keep actorRole outside the nested input so the request mirrors the API contract.
  const { actorRole, ...writebackInput } = input;

  return client.request<LearningWritebackViewModel>({
    method: "POST",
    url: `/api/v1/learning-governance/writebacks/${input.writebackId}/apply`,
    body: {
      actorRole,
      input: writebackInput,
    },
  });
}

export function listLearningWritebacksByCandidate(
  client: LearningGovernanceHttpClient,
  learningCandidateId: string,
) {
  return client.request<LearningWritebackViewModel[]>({
    method: "GET",
    url: `/api/v1/learning-governance/candidates/${learningCandidateId}/writebacks`,
  });
}
