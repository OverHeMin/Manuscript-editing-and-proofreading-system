import type { SnapshotCapableRepository } from "../shared/write-transaction-manager.ts";
import type {
  FeedbackGovernanceRepository,
} from "./feedback-governance-repository.ts";
import type {
  HumanFeedbackRecord,
  LearningCandidateSourceLinkRecord,
} from "./feedback-governance-record.ts";

function cloneHumanFeedbackRecord(record: HumanFeedbackRecord): HumanFeedbackRecord {
  return { ...record };
}

function cloneLearningCandidateSourceLinkRecord(
  record: LearningCandidateSourceLinkRecord,
): LearningCandidateSourceLinkRecord {
  return { ...record };
}

function compareHumanFeedback(
  left: HumanFeedbackRecord,
  right: HumanFeedbackRecord,
): number {
  if (left.created_at !== right.created_at) {
    return left.created_at.localeCompare(right.created_at);
  }

  return left.id.localeCompare(right.id);
}

function compareLearningCandidateSourceLinks(
  left: LearningCandidateSourceLinkRecord,
  right: LearningCandidateSourceLinkRecord,
): number {
  if (left.created_at !== right.created_at) {
    return left.created_at.localeCompare(right.created_at);
  }

  return left.id.localeCompare(right.id);
}

export class InMemoryFeedbackGovernanceRepository
  implements
    FeedbackGovernanceRepository,
    SnapshotCapableRepository<{
      feedback: Map<string, HumanFeedbackRecord>;
      links: Map<string, LearningCandidateSourceLinkRecord>;
    }>
{
  private readonly feedback = new Map<string, HumanFeedbackRecord>();
  private readonly links = new Map<string, LearningCandidateSourceLinkRecord>();

  async saveHumanFeedback(record: HumanFeedbackRecord): Promise<void> {
    this.feedback.set(record.id, cloneHumanFeedbackRecord(record));
  }

  async findHumanFeedbackById(
    id: string,
  ): Promise<HumanFeedbackRecord | undefined> {
    const record = this.feedback.get(id);
    return record ? cloneHumanFeedbackRecord(record) : undefined;
  }

  async listHumanFeedbackBySnapshotId(
    snapshotId: string,
  ): Promise<HumanFeedbackRecord[]> {
    return [...this.feedback.values()]
      .filter((record) => record.snapshot_id === snapshotId)
      .sort(compareHumanFeedback)
      .map(cloneHumanFeedbackRecord);
  }

  async saveLearningCandidateSourceLink(
    record: LearningCandidateSourceLinkRecord,
  ): Promise<void> {
    this.links.set(record.id, cloneLearningCandidateSourceLinkRecord(record));
  }

  async listLearningCandidateSourceLinksByCandidateId(
    learningCandidateId: string,
  ): Promise<LearningCandidateSourceLinkRecord[]> {
    return [...this.links.values()]
      .filter((record) => record.learning_candidate_id === learningCandidateId)
      .sort(compareLearningCandidateSourceLinks)
      .map(cloneLearningCandidateSourceLinkRecord);
  }

  snapshotState(): {
    feedback: Map<string, HumanFeedbackRecord>;
    links: Map<string, LearningCandidateSourceLinkRecord>;
  } {
    return {
      feedback: new Map(
        [...this.feedback.entries()].map(([id, record]) => [
          id,
          cloneHumanFeedbackRecord(record),
        ]),
      ),
      links: new Map(
        [...this.links.entries()].map(([id, record]) => [
          id,
          cloneLearningCandidateSourceLinkRecord(record),
        ]),
      ),
    };
  }

  restoreState(snapshot: {
    feedback: Map<string, HumanFeedbackRecord>;
    links: Map<string, LearningCandidateSourceLinkRecord>;
  }): void {
    this.feedback.clear();
    for (const [id, record] of snapshot.feedback.entries()) {
      this.feedback.set(id, cloneHumanFeedbackRecord(record));
    }

    this.links.clear();
    for (const [id, record] of snapshot.links.entries()) {
      this.links.set(id, cloneLearningCandidateSourceLinkRecord(record));
    }
  }
}
