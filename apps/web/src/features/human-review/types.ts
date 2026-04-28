import type {
  HumanReviewContentDecision,
  HumanReviewDiffItem,
  HumanReviewGovernanceIntent,
  HumanReviewModule,
} from "@medical/contracts";
import type { DocumentAssetViewModel, JobViewModel } from "../manuscripts/index.ts";

export type HumanReviewDiffItemViewModel = HumanReviewDiffItem;
export type HumanReviewPublishModule = Extract<
  HumanReviewModule,
  "proofreading" | "editing"
>;
export type HumanReviewBackflowTarget =
  | "rule_candidate"
  | "knowledge_candidate";
export type HumanReviewBackflowStatus = "pending" | "succeeded" | "failed";

export interface HumanReviewDiffItemDecisionPatch {
  content_decision?: HumanReviewContentDecision;
  governance_intents?: Partial<HumanReviewGovernanceIntent>;
  note?: string;
}

export interface HumanReviewDiffItemFilters {
  status?:
    | "all"
    | HumanReviewContentDecision
    | "confirmed"
    | "unsafe"
    | "writeback_failed";
  module?: HumanReviewPublishModule | "all";
  governanceIntent?: HumanReviewBackflowTarget | "all";
  query?: string;
}

export interface HumanReviewDiffSummaryViewModel {
  total_count: number;
  unconfirmed_count: number;
  deferred_count: number;
  unsafe_blocking_count: number;
  materialization_blocking_count: number;
  kept_count: number;
  rejected_count: number;
  rule_intent_count: number;
  knowledge_intent_count: number;
  backflow_failed_count: number;
  can_publish: boolean;
}

export interface HumanReviewPublishPreflightResultViewModel {
  can_publish: boolean;
  blocking_reasons: string[];
  summary: {
    total_count: number;
    unconfirmed_count: number;
    deferred_count: number;
    unsafe_count: number;
    kept_count: number;
    rejected_count: number;
  };
}

export interface HumanReviewBackflowAttemptViewModel {
  id: string;
  diff_item_id: string;
  target: HumanReviewBackflowTarget;
  status: HumanReviewBackflowStatus;
  learning_candidate_id?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface HumanReviewBackflowResultViewModel {
  attempts: HumanReviewBackflowAttemptViewModel[];
  summary: {
    attempted_count: number;
    succeeded_count: number;
    failed_count: number;
  };
}

export interface HumanReviewPublishFinalResultViewModel {
  job: JobViewModel;
  asset: DocumentAssetViewModel;
  preflight: HumanReviewPublishPreflightResultViewModel;
  backflow: HumanReviewBackflowResultViewModel;
}
