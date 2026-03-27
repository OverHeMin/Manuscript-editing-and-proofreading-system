import type {
  HumanFeedbackRecord,
  LearningCandidateSourceLinkRecord,
} from "./feedback-governance-record.ts";

export interface FeedbackGovernanceRepository {
  saveHumanFeedback(record: HumanFeedbackRecord): Promise<void>;
  findHumanFeedbackById(id: string): Promise<HumanFeedbackRecord | undefined>;
  listHumanFeedbackBySnapshotId(snapshotId: string): Promise<HumanFeedbackRecord[]>;
  saveLearningCandidateSourceLink(
    record: LearningCandidateSourceLinkRecord,
  ): Promise<void>;
  listLearningCandidateSourceLinksByCandidateId(
    learningCandidateId: string,
  ): Promise<LearningCandidateSourceLinkRecord[]>;
}
