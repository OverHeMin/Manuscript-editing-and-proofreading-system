export type HumanReviewModule =
  | "proofreading"
  | "editing"
  | "screening_reserved";

export type HumanReviewDiffSource =
  | "ai_suggestion"
  | "human_added"
  | "human_overrode_ai"
  | "human_reverted_ai";

export type HumanReviewContentDecision = "unconfirmed" | "keep" | "reject" | "defer";

export type HumanReviewApplyCapability =
  | "auto_apply_revert"
  | "keep_only_no_safe_revert"
  | "unsafe_needs_manual_review";

export type HumanReviewDiffStatus =
  | "pending"
  | "confirmed"
  | "blocks_publish"
  | "published_writeback_done"
  | "writeback_failed"
  | "stale_after_reextract";

export type HumanReviewComplexityFlag =
  | "format_complex"
  | "table_structure"
  | "image_caption"
  | "reference"
  | "locator_fallback";

export interface HumanReviewGovernanceIntent {
  rule_candidate: boolean;
  knowledge_candidate: boolean;
}

export interface HumanReviewDiffLocation {
  anchor_kind?:
    | "paragraph"
    | "heading"
    | "table"
    | "table_cell"
    | "image"
    | "caption"
    | "reference_entry";
  block_index?: number;
  quote?: string;
  section_label?: string;
  table_id?: string;
  row_key?: string;
  column_key?: string;
}

export interface HumanReviewDiffItem {
  id: string;
  module: HumanReviewModule;
  manuscript_id: string;
  baseline_asset_id: string;
  working_asset_id: string;
  final_asset_id?: string;
  source: HumanReviewDiffSource;
  content_decision: HumanReviewContentDecision;
  governance_intents: HumanReviewGovernanceIntent;
  apply_capability: HumanReviewApplyCapability;
  complexity_flags?: HumanReviewComplexityFlag[];
  status: HumanReviewDiffStatus;
  before_text?: string;
  after_text?: string;
  summary?: string;
  location?: HumanReviewDiffLocation;
  note?: string;
  extraction_revision?: number;
  backflow_error?: string;
  created_at: string;
  updated_at: string;
}
