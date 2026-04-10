export type ManuscriptStatus =
  | "draft"
  | "uploaded"
  | "processing"
  | "awaiting_review"
  | "completed"
  | "archived";

export type ManuscriptType =
  | "clinical_study"
  | "review"
  | "systematic_review"
  | "meta_analysis"
  | "case_report"
  | "guideline_interpretation"
  | "expert_consensus"
  | "diagnostic_study"
  | "basic_research"
  | "nursing_study"
  | "methodology_paper"
  | "brief_report"
  | "other";

export interface ManuscriptRecord {
  id: string;
  title: string;
  manuscript_type: ManuscriptType;
  status: ManuscriptStatus;
  created_by: string;
  current_screening_asset_id?: string;
  current_editing_asset_id?: string;
  current_proofreading_asset_id?: string;
  current_template_family_id?: string;
  current_journal_template_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ManuscriptViewRecord extends ManuscriptRecord {
  result_asset_matrix: import("../assets/document-asset-record.ts").ResultAssetMatrixRecord;
  current_export_selection?: import("../assets/document-asset-record.ts").CurrentExportSelectionRecord;
  module_execution_overview: import("./manuscript-mainline-settlement.ts").ManuscriptModuleExecutionOverviewRecord;
  mainline_readiness_summary: import("./manuscript-mainline-settlement.ts").ManuscriptMainlineReadinessSummaryRecord;
  mainline_attention_handoff_pack: import("./manuscript-mainline-settlement.ts").ManuscriptMainlineAttentionHandoffPackRecord;
  mainline_attempt_ledger: import("./manuscript-mainline-settlement.ts").ManuscriptMainlineAttemptLedgerRecord;
}
