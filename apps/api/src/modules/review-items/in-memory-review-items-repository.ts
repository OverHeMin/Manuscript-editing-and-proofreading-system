import type { SnapshotCapableRepository } from "../shared/write-transaction-manager.ts";
import type { GovernedHitReviewItemRecord } from "./review-item-record.ts";
import type { ReviewItemsRepository } from "./review-items-repository.ts";

function cloneGovernedHitRecord(
  record: GovernedHitReviewItemRecord,
): GovernedHitReviewItemRecord {
  return {
    ...record,
    ...(record.location ? { location: { ...record.location } } : {}),
    ...(record.evidence_pack
      ? {
          evidence_pack: {
            ...record.evidence_pack,
            ...(record.evidence_pack.location
              ? { location: { ...record.evidence_pack.location } }
              : {}),
          },
        }
      : {}),
    ...(record.related_rule_ids
      ? { related_rule_ids: [...record.related_rule_ids] }
      : {}),
    ...(record.related_knowledge_item_ids
      ? { related_knowledge_item_ids: [...record.related_knowledge_item_ids] }
      : {}),
    ...(record.origin_payload ? { origin_payload: { ...record.origin_payload } } : {}),
  };
}

function compareGovernedHits(
  left: GovernedHitReviewItemRecord,
  right: GovernedHitReviewItemRecord,
): number {
  if (left.updated_at !== right.updated_at) {
    return right.updated_at.localeCompare(left.updated_at);
  }

  if (left.created_at !== right.created_at) {
    return right.created_at.localeCompare(left.created_at);
  }

  return left.id.localeCompare(right.id);
}

export class InMemoryReviewItemsRepository
  implements
    ReviewItemsRepository,
    SnapshotCapableRepository<Map<string, GovernedHitReviewItemRecord>>
{
  private readonly governedHits = new Map<string, GovernedHitReviewItemRecord>();

  async saveGovernedHit(record: GovernedHitReviewItemRecord): Promise<void> {
    this.governedHits.set(record.id, cloneGovernedHitRecord(record));
  }

  async findGovernedHitById(
    id: string,
  ): Promise<GovernedHitReviewItemRecord | undefined> {
    const record = this.governedHits.get(id);
    return record ? cloneGovernedHitRecord(record) : undefined;
  }

  async listGovernedHits(): Promise<GovernedHitReviewItemRecord[]> {
    return [...this.governedHits.values()]
      .sort(compareGovernedHits)
      .map(cloneGovernedHitRecord);
  }

  snapshotState(): Map<string, GovernedHitReviewItemRecord> {
    return new Map(
      [...this.governedHits.entries()].map(([id, record]) => [
        id,
        cloneGovernedHitRecord(record),
      ]),
    );
  }

  restoreState(snapshot: Map<string, GovernedHitReviewItemRecord>): void {
    this.governedHits.clear();
    for (const [id, record] of snapshot.entries()) {
      this.governedHits.set(id, cloneGovernedHitRecord(record));
    }
  }
}
