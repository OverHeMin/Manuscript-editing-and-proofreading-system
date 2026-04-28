import type {
  HumanReviewBackflowAttemptRecord,
  HumanReviewDiffRecord,
  ListHumanReviewDiffItemsFilter,
} from "./human-review-record.ts";

export type HumanReviewDiffItemPatch = Partial<Omit<HumanReviewDiffRecord, "id">>;

export interface HumanReviewRepository {
  saveDiffItem(record: HumanReviewDiffRecord): Promise<void>;
  saveDiffItems(records: readonly HumanReviewDiffRecord[]): Promise<void>;
  findDiffItemById(id: string): Promise<HumanReviewDiffRecord | undefined>;
  listDiffItems(
    filter?: ListHumanReviewDiffItemsFilter,
  ): Promise<HumanReviewDiffRecord[]>;
  updateDiffItem(
    id: string,
    patch: HumanReviewDiffItemPatch,
  ): Promise<HumanReviewDiffRecord | undefined>;
  saveBackflowAttempt(record: HumanReviewBackflowAttemptRecord): Promise<void>;
  findBackflowAttemptById(
    id: string,
  ): Promise<HumanReviewBackflowAttemptRecord | undefined>;
  listBackflowAttemptsByDiffItemId(
    diffItemId: string,
  ): Promise<HumanReviewBackflowAttemptRecord[]>;
}
