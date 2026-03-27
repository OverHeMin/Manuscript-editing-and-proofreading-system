import type {
  LearningCandidateRecord,
  ReviewedCaseSnapshotRecord,
} from "./learning-record.ts";

export interface ReviewedCaseSnapshotRepository {
  save(record: ReviewedCaseSnapshotRecord): Promise<void>;
  findById(id: string): Promise<ReviewedCaseSnapshotRecord | undefined>;
}

export interface LearningCandidateRepository {
  save(record: LearningCandidateRecord): Promise<void>;
  findById(id: string): Promise<LearningCandidateRecord | undefined>;
}
