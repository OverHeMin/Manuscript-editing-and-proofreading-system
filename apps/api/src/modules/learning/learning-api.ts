import type { RoleKey } from "../../users/roles.ts";
import { LearningService } from "./learning-service.ts";
import type {
  CreateGovernedLearningCandidateInput,
  CreateLearningCandidateInput,
  CreateReviewedCaseSnapshotInput,
  ExtractRuleCandidateInput,
} from "./learning-service.ts";
import type {
  LearningCandidateRecord,
  ReviewedCaseSnapshotRecord,
} from "./learning-record.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateLearningApiOptions {
  learningService: LearningService;
}

export function createLearningApi(options: CreateLearningApiOptions) {
  const { learningService } = options;

  return {
    async createReviewedCaseSnapshot(
      input: CreateReviewedCaseSnapshotInput,
    ): Promise<RouteResponse<ReviewedCaseSnapshotRecord>> {
      return {
        status: 201,
        body: await learningService.createReviewedCaseSnapshot(input),
      };
    },

    async createLearningCandidate(
      input: CreateLearningCandidateInput,
    ): Promise<RouteResponse<LearningCandidateRecord>> {
      return {
        status: 201,
        body: await learningService.createLearningCandidate(input),
      };
    },

    async createGovernedLearningCandidate(
      input: CreateGovernedLearningCandidateInput,
    ): Promise<RouteResponse<LearningCandidateRecord>> {
      return {
        status: 201,
        body: await learningService.createGovernedLearningCandidate(input),
      };
    },

    async extractRuleCandidate(
      input: ExtractRuleCandidateInput,
    ): Promise<RouteResponse<LearningCandidateRecord>> {
      return {
        status: 201,
        body: await learningService.extractRuleCandidate(input),
      };
    },

    async approveLearningCandidate({
      candidateId,
      actorRole,
      reviewNote,
    }: {
      candidateId: string;
      actorRole: RoleKey;
      reviewNote?: string;
    }): Promise<RouteResponse<LearningCandidateRecord>> {
      return {
        status: 200,
        body: await learningService.approveLearningCandidate(
          candidateId,
          actorRole,
          reviewNote,
        ),
      };
    },

    async rejectLearningCandidate({
      candidateId,
      actorRole,
      reviewNote,
    }: {
      candidateId: string;
      actorRole: RoleKey;
      reviewNote?: string;
    }): Promise<RouteResponse<LearningCandidateRecord>> {
      return {
        status: 200,
        body: await learningService.rejectLearningCandidate(
          candidateId,
          actorRole,
          reviewNote,
        ),
      };
    },

    async listLearningCandidates(): Promise<RouteResponse<LearningCandidateRecord[]>> {
      return {
        status: 200,
        body: await learningService.listLearningCandidates(),
      };
    },

    async listPendingReviewCandidates(): Promise<RouteResponse<LearningCandidateRecord[]>> {
      return {
        status: 200,
        body: await learningService.listPendingReviewCandidates(),
      };
    },

    async getLearningCandidate({
      candidateId,
    }: {
      candidateId: string;
    }): Promise<RouteResponse<LearningCandidateRecord>> {
      return {
        status: 200,
        body: await learningService.getLearningCandidate(candidateId),
      };
    },
  };
}
