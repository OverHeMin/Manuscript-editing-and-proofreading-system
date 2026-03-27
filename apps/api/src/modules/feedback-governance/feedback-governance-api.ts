import type {
  HumanFeedbackRecord,
  LearningCandidateSourceLinkRecord,
} from "./feedback-governance-record.ts";
import type {
  FeedbackGovernanceService,
  LinkLearningCandidateSourceInput,
  RecordHumanFeedbackInput,
} from "./feedback-governance-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateFeedbackGovernanceApiOptions {
  feedbackGovernanceService: FeedbackGovernanceService;
}

export function createFeedbackGovernanceApi(
  options: CreateFeedbackGovernanceApiOptions,
) {
  const { feedbackGovernanceService } = options;

  return {
    async recordHumanFeedback({
      input,
    }: {
      input: RecordHumanFeedbackInput;
    }): Promise<RouteResponse<HumanFeedbackRecord>> {
      return {
        status: 201,
        body: await feedbackGovernanceService.recordHumanFeedback(input),
      };
    },

    async linkLearningCandidateSource({
      input,
    }: {
      input: LinkLearningCandidateSourceInput;
    }): Promise<RouteResponse<LearningCandidateSourceLinkRecord>> {
      return {
        status: 201,
        body: await feedbackGovernanceService.linkLearningCandidateSource(input),
      };
    },

    async listHumanFeedbackBySnapshotId({
      snapshotId,
    }: {
      snapshotId: string;
    }): Promise<RouteResponse<HumanFeedbackRecord[]>> {
      return {
        status: 200,
        body: await feedbackGovernanceService.listHumanFeedbackBySnapshotId(
          snapshotId,
        ),
      };
    },

    async listLearningCandidateSourceLinksByCandidateId({
      learningCandidateId,
    }: {
      learningCandidateId: string;
    }): Promise<RouteResponse<LearningCandidateSourceLinkRecord[]>> {
      return {
        status: 200,
        body:
          await feedbackGovernanceService.listLearningCandidateSourceLinksByCandidateId(
            learningCandidateId,
          ),
      };
    },
  };
}
