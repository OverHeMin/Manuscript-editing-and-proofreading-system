import type { GovernedHitReviewItemRecord } from "./review-item-record.ts";

export interface ReviewItemsRepository {
  saveGovernedHit(record: GovernedHitReviewItemRecord): Promise<void>;
  findGovernedHitById(id: string): Promise<GovernedHitReviewItemRecord | undefined>;
  listGovernedHits(): Promise<GovernedHitReviewItemRecord[]>;
}
