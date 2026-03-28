import type { LearningWritebackRecord } from "./learning-governance-record.ts";

export interface LearningGovernanceRepository {
  save(record: LearningWritebackRecord): Promise<void>;
  findById(id: string): Promise<LearningWritebackRecord | undefined>;
  list(): Promise<LearningWritebackRecord[]>;
  listByCandidateId(learningCandidateId: string): Promise<LearningWritebackRecord[]>;
}
