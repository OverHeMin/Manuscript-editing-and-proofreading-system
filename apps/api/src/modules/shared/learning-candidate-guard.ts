import type { LearningCandidateRecord } from "../learning/learning-record.ts";
import type { LearningCandidateRepository } from "../learning/learning-repository.ts";

export class LearningCandidateRepositoryRequiredError extends Error {
  constructor() {
    super(
      "Learning candidate repository is required for governed learning writeback helpers.",
    );
    this.name = "LearningCandidateRepositoryRequiredError";
  }
}

export class ApprovedLearningCandidateRequiredError extends Error {
  constructor(candidateId: string, status?: string) {
    super(
      status
        ? `Learning candidate ${candidateId} must be approved before governed writeback, received ${status}.`
        : `Learning candidate ${candidateId} must exist and be approved before governed writeback.`,
    );
    this.name = "ApprovedLearningCandidateRequiredError";
  }
}

export async function requireApprovedLearningCandidate(
  repository: LearningCandidateRepository | undefined,
  candidateId: string,
): Promise<LearningCandidateRecord> {
  if (!repository) {
    throw new LearningCandidateRepositoryRequiredError();
  }

  const candidate = await repository.findById(candidateId);
  if (!candidate || candidate.status !== "approved") {
    throw new ApprovedLearningCandidateRequiredError(
      candidateId,
      candidate?.status,
    );
  }

  return candidate;
}
