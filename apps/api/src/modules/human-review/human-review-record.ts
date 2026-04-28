import type {
  HumanReviewDiffItem,
  HumanReviewDiffStatus,
  HumanReviewModule,
} from "@medical/contracts";

export type HumanReviewDiffRecord = HumanReviewDiffItem;

export type HumanReviewBackflowTarget =
  | "rule_candidate"
  | "knowledge_candidate";

export type HumanReviewBackflowStatus = "pending" | "succeeded" | "failed";

export interface HumanReviewBackflowAttemptRecord {
  id: string;
  diff_item_id: string;
  target: HumanReviewBackflowTarget;
  status: HumanReviewBackflowStatus;
  learning_candidate_id?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface ListHumanReviewDiffItemsFilter {
  manuscriptId?: string;
  module?: HumanReviewModule;
  workingAssetId?: string;
  finalAssetId?: string;
  status?: HumanReviewDiffStatus;
}
