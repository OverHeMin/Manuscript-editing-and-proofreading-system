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

export type DocumentAssetType =
  | "original"
  | "normalized_docx"
  | "screening_report"
  | "edited_docx"
  | "proofreading_draft_report"
  | "final_proof_issue_report"
  | "final_proof_annotated_docx"
  | "pdf_consistency_report"
  | "human_final_docx"
  | "learning_snapshot_attachment";

export type ManuscriptModule =
  | "upload"
  | "screening"
  | "editing"
  | "proofreading"
  | "pdf_consistency"
  | "learning"
  | "manual";

export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type MainlineSettlementModule =
  | "screening"
  | "editing"
  | "proofreading";

export type ModuleMainlineSettlementDerivedStatus =
  | "not_started"
  | "job_in_progress"
  | "job_failed"
  | "business_completed_unlinked"
  | "business_completed_follow_up_pending"
  | "business_completed_follow_up_running"
  | "business_completed_follow_up_retryable"
  | "business_completed_follow_up_failed"
  | "business_completed_settled";

export interface ModuleMainlineSettlementViewModel {
  derived_status: ModuleMainlineSettlementDerivedStatus;
  business_completed: boolean;
  orchestration_completed: boolean;
  attention_required: boolean;
  reason: string;
}

export type AgentExecutionCompletionDerivedStatus =
  | "business_in_progress"
  | "business_failed"
  | "business_completed_follow_up_pending"
  | "business_completed_follow_up_running"
  | "business_completed_follow_up_retryable"
  | "business_completed_follow_up_failed"
  | "business_completed_settled";

export type AgentExecutionRecoveryCategory =
  | "recoverable_now"
  | "stale_running"
  | "deferred_retry"
  | "attention_required"
  | "not_recoverable";

export type AgentExecutionRecoveryReadiness =
  | "ready_now"
  | "waiting_retry_eligibility"
  | "waiting_running_timeout"
  | "not_recoverable";

export interface LinkedAgentExecutionCompletionSummaryViewModel {
  derived_status: AgentExecutionCompletionDerivedStatus;
  business_completed: boolean;
  follow_up_required: boolean;
  fully_settled: boolean;
  attention_required: boolean;
}

export interface LinkedAgentExecutionRecoverySummaryViewModel {
  category: AgentExecutionRecoveryCategory;
  recovery_readiness: AgentExecutionRecoveryReadiness;
  recovery_ready_at?: string;
  reason: string;
}

export type RuntimeBindingReadinessStatus = "ready" | "degraded" | "missing";

export interface RuntimeBindingReadinessIssueViewModel {
  code: string;
  message: string;
}

export interface RuntimeBindingExecutionProfileAlignmentViewModel {
  status: "aligned" | "drifted" | "missing_active_profile";
  binding_execution_profile_id?: string;
  active_execution_profile_id?: string;
}

export interface RuntimeBindingReadinessScopeViewModel {
  module: ManuscriptModule;
  manuscriptType: ManuscriptType;
  templateFamilyId: string;
}

export interface RuntimeBindingReadinessReportViewModel {
  status: RuntimeBindingReadinessStatus;
  scope: RuntimeBindingReadinessScopeViewModel;
  binding?: {
    id: string;
    status: string;
    version: number;
    runtime_id: string;
    sandbox_profile_id: string;
    agent_profile_id: string;
    tool_permission_policy_id: string;
    prompt_template_id: string;
    skill_package_ids: string[];
    execution_profile_id: string;
    verification_check_profile_ids: string[];
    evaluation_suite_ids: string[];
    release_check_profile_id?: string;
  };
  issues: RuntimeBindingReadinessIssueViewModel[];
  execution_profile_alignment: RuntimeBindingExecutionProfileAlignmentViewModel;
}

export interface LinkedAgentExecutionSnapshotViewModel {
  id: string;
  status: string;
  orchestration_status: string;
  orchestration_attempt_count?: number;
  completion_summary: LinkedAgentExecutionCompletionSummaryViewModel;
  recovery_summary: LinkedAgentExecutionRecoverySummaryViewModel;
}

export interface ExecutionTrackingAgentExecutionObservationViewModel {
  observation_status: "reported" | "not_linked" | "failed_open";
  log_id?: string;
  log?: LinkedAgentExecutionSnapshotViewModel;
  error?: string;
}

export interface ExecutionTrackingRuntimeBindingReadinessObservationViewModel {
  observation_status: "reported" | "failed_open";
  report?: RuntimeBindingReadinessReportViewModel;
  error?: string;
}

export interface ModuleExecutionSnapshotViewModel {
  id: string;
  manuscript_id: string;
  module: ManuscriptModule;
  job_id: string;
  execution_profile_id: string;
  module_template_id: string;
  module_template_version_no: number;
  prompt_template_id: string;
  prompt_template_version: string;
  skill_package_ids: string[];
  skill_package_versions: string[];
  model_id: string;
  model_version?: string;
  knowledge_item_ids: string[];
  created_asset_ids: string[];
  agent_execution_log_id?: string;
  draft_snapshot_id?: string;
  created_at: string;
  agent_execution: ExecutionTrackingAgentExecutionObservationViewModel;
  runtime_binding_readiness: ExecutionTrackingRuntimeBindingReadinessObservationViewModel;
}

export interface ModuleExecutionOverviewViewModel {
  module: MainlineSettlementModule;
  observation_status: "reported" | "not_started" | "failed_open";
  latest_job?: JobViewModel;
  latest_snapshot?: ModuleExecutionSnapshotViewModel;
  settlement?: ModuleMainlineSettlementViewModel;
  error?: string;
}

export interface ManuscriptModuleExecutionOverviewViewModel {
  screening: ModuleExecutionOverviewViewModel;
  editing: ModuleExecutionOverviewViewModel;
  proofreading: ModuleExecutionOverviewViewModel;
}

export type ManuscriptMainlineReadinessDerivedStatus =
  | "ready_for_next_step"
  | "in_progress"
  | "waiting_for_follow_up"
  | "attention_required"
  | "completed";

export interface ManuscriptMainlineReadinessSummaryViewModel {
  observation_status: "reported" | "failed_open";
  derived_status?: ManuscriptMainlineReadinessDerivedStatus;
  active_module?: MainlineSettlementModule;
  next_module?: MainlineSettlementModule;
  recovery_ready_at?: string;
  runtime_binding_status?: RuntimeBindingReadinessStatus;
  runtime_binding_issue_count?: number;
  reason?: string;
  error?: string;
}

export type MainlineAttentionStatus = "clear" | "monitoring" | "action_required";

export type MainlineHandoffStatus =
  | "ready_now"
  | "blocked_by_in_progress"
  | "blocked_by_follow_up"
  | "blocked_by_attention"
  | "completed";

export type MainlineAttentionItemKind =
  | "job_in_progress"
  | "follow_up_pending"
  | "follow_up_running"
  | "follow_up_retryable"
  | "follow_up_failed"
  | "settlement_unlinked"
  | "job_failed"
  | "runtime_binding_degraded"
  | "runtime_binding_missing";

export type MainlineAttentionItemSeverity = "monitoring" | "action_required";

export interface MainlineAttentionItemViewModel {
  module: MainlineSettlementModule;
  kind: MainlineAttentionItemKind;
  severity: MainlineAttentionItemSeverity;
  job_id?: string;
  snapshot_id?: string;
  recovery_ready_at?: string;
  summary: string;
}

export interface ManuscriptMainlineAttentionHandoffPackViewModel {
  observation_status: "reported" | "failed_open";
  attention_status?: MainlineAttentionStatus;
  handoff_status?: MainlineHandoffStatus;
  focus_module?: MainlineSettlementModule;
  from_module?: MainlineSettlementModule;
  to_module?: MainlineSettlementModule;
  latest_job_id?: string;
  latest_snapshot_id?: string;
  recovery_ready_at?: string;
  runtime_binding_status?: RuntimeBindingReadinessStatus;
  runtime_binding_issue_count?: number;
  reason?: string;
  attention_items: MainlineAttentionItemViewModel[];
  error?: string;
}

export type MainlineAttemptLedgerEvidenceStatus =
  | "snapshot_linked"
  | "job_only"
  | "failed_open";

export interface MainlineAttemptLedgerItemViewModel {
  module: MainlineSettlementModule;
  job_id: string;
  job_status: JobStatus;
  job_attempt_count: number;
  created_at: string;
  updated_at: string;
  started_at?: string;
  finished_at?: string;
  snapshot_id?: string;
  evidence_status: MainlineAttemptLedgerEvidenceStatus;
  settlement_status?: ModuleMainlineSettlementDerivedStatus;
  orchestration_status?: string;
  orchestration_attempt_count?: number;
  recovery_category?: AgentExecutionRecoveryCategory;
  recovery_ready_at?: string;
  runtime_binding_status?: RuntimeBindingReadinessStatus;
  runtime_binding_issue_count?: number;
  is_latest_for_module: boolean;
  reason: string;
}

export interface ManuscriptMainlineAttemptLedgerViewModel {
  observation_status: "reported" | "failed_open";
  total_attempts: number;
  visible_attempts: number;
  truncated: boolean;
  latest_event_at?: string;
  items: MainlineAttemptLedgerItemViewModel[];
  error?: string;
}

export interface JobExecutionTrackingObservationViewModel {
  observation_status: "reported" | "not_tracked" | "failed_open";
  snapshot?: ModuleExecutionSnapshotViewModel;
  settlement?: ModuleMainlineSettlementViewModel;
  error?: string;
}

export interface ManuscriptViewModel {
  id: string;
  title: string;
  manuscript_type: ManuscriptType;
  status: ManuscriptStatus;
  created_by: string;
  current_screening_asset_id?: string;
  current_editing_asset_id?: string;
  current_proofreading_asset_id?: string;
  current_template_family_id?: string;
  created_at: string;
  updated_at: string;
  module_execution_overview?: ManuscriptModuleExecutionOverviewViewModel;
  mainline_readiness_summary?: ManuscriptMainlineReadinessSummaryViewModel;
  mainline_attention_handoff_pack?: ManuscriptMainlineAttentionHandoffPackViewModel;
  mainline_attempt_ledger?: ManuscriptMainlineAttemptLedgerViewModel;
}

export interface DocumentAssetViewModel {
  id: string;
  manuscript_id: string;
  asset_type: DocumentAssetType;
  status: "created" | "active" | "superseded" | "archived";
  storage_key: string;
  mime_type: string;
  parent_asset_id?: string;
  source_module: ManuscriptModule;
  source_job_id?: string;
  created_by: string;
  version_no: number;
  is_current: boolean;
  file_name?: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentAssetExportViewModel {
  manuscript_id: string;
  asset: DocumentAssetViewModel;
  download: {
    storage_key: string;
    file_name?: string;
    mime_type: string;
    url: string;
  };
}

export interface JobViewModel {
  id: string;
  manuscript_id?: string;
  module: ManuscriptModule;
  job_type: string;
  status: JobStatus;
  requested_by: string;
  payload?: Record<string, unknown>;
  attempt_count: number;
  started_at?: string;
  finished_at?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
  execution_tracking?: JobExecutionTrackingObservationViewModel;
}

export interface UploadManuscriptInput {
  title: string;
  manuscriptType: ManuscriptType;
  createdBy: string;
  fileName: string;
  mimeType: string;
  storageKey?: string;
  fileContentBase64?: string;
}

export interface UploadManuscriptResult {
  manuscript: ManuscriptViewModel;
  asset: DocumentAssetViewModel;
  job: JobViewModel;
}
