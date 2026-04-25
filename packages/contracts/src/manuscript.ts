import type { GovernedExecutionContextSummary } from "./governed-execution.js";

export type ManuscriptId = string;
export type UserId = string;
export type TemplateFamilyId = string;
export type JournalTemplateId = string;
export type DocumentAssetId = string;

export const MAX_MANUSCRIPT_BATCH_UPLOAD_COUNT = 10;

// Lifecycle per docs/superpowers/specs/01-domain-model-and-lifecycle.md
export type ManuscriptStatus =
  | "draft"
  | "uploaded"
  | "processing"
  | "awaiting_review"
  | "completed"
  | "archived";

// Fixed type set per docs/superpowers/specs/2026-03-25-medical-manuscript-system-v1-design.md
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

export type ManuscriptTypeDetectionSource = "ai" | "heuristic";
export type ManuscriptTypeDetectionConfidenceLevel = "low" | "medium" | "high";
export type EditingMetadataSourceZone =
  | "front_matter"
  | "title_area"
  | "abstract_neighborhood"
  | "header"
  | "footer"
  | "document_tail"
  | "suspicious_nearby_paragraph";
export type EditingMetadataCandidateRecommendedAction =
  | "auto_place_candidate"
  | "move_to_target"
  | "manual_review"
  | "manual_fill";
export type EditingSlotResolutionState =
  | "resolved_auto"
  | "resolved_manual"
  | "recognized_misplaced"
  | "conflicted_candidates"
  | "low_confidence_pending_review"
  | "missing";
export type EditingSlotManualResolutionKind =
  | "picked_candidate"
  | "manual_entry"
  | "waived";
export type EditingCompletionGateVerdict =
  | "passed"
  | "needs_manual_resolution"
  | "blocked_by_missing_required_slots"
  | "blocked_by_high_risk_objects";
export type EditingCompletionGatePendingItemCategory =
  | "required_slot"
  | "manual_resolution"
  | "high_risk_object"
  | "table_high_risk"
  | "blocking_format_failure";
export type EditingCompletionGatePendingItemSource =
  | "slot_governance"
  | "editing_guardrail"
  | "manual_review_item"
  | "content_rule_candidate"
  | "quality_finding"
  | "table_inspection_finding"
  | "table_patch_result"
  | "skipped_ai_replacement";
export type EditingCompletionGatePendingItemStatus =
  | "pending"
  | "resolved"
  | "waived";
export type EditingCompletionGateManualObjectDecisionKind =
  | "accepted_change_only"
  | "manual_only"
  | "waived";

export interface ManuscriptTypeDetectionSummary {
  detected_type: ManuscriptType;
  final_type: ManuscriptType;
  source: ManuscriptTypeDetectionSource;
  confidence: number;
  confidence_level: ManuscriptTypeDetectionConfidenceLevel;
  requires_operator_review: boolean;
  matched_signals?: string[];
}

export interface EditingMetadataCandidateEvidence {
  source_zone: EditingMetadataSourceZone;
  source_locator: string;
}

export interface EditingMetadataCandidate {
  candidate_id: string;
  slot_key: string;
  raw_text: string;
  normalized_text: string;
  source_zone: EditingMetadataSourceZone;
  source_locator: string;
  semantic_role: string;
  confidence: number;
  recommended_action: EditingMetadataCandidateRecommendedAction;
  evidences?: EditingMetadataCandidateEvidence[];
}

export interface EditingSlotManualResolution {
  slot_key: string;
  resolution_kind: EditingSlotManualResolutionKind;
  resolved_text?: string;
  selected_candidate_id?: string;
  note?: string;
  applied_by?: UserId;
  applied_at?: string;
}

export interface EditingSlotResolutionSummary {
  slot_key: string;
  label: string;
  required: boolean;
  enabled: boolean;
  zone: string;
  anchor: string;
  completion_gate: string;
  state: EditingSlotResolutionState;
  resolution_reason: string;
  resolved_text?: string;
  candidate_count: number;
  candidates: EditingMetadataCandidate[];
  manual_resolution?: EditingSlotManualResolution;
}

export interface EditingSlotGovernanceSummary {
  observation_status: "reported" | "failed_open";
  journal_template_id?: JournalTemplateId;
  target_model_version_id?: string;
  target_model_version_no?: number;
  generated_at?: string;
  unresolved_required_count: number;
  blocking_slot_keys: string[];
  slots: EditingSlotResolutionSummary[];
  manual_resolutions?: EditingSlotManualResolution[];
  error?: string;
}

export interface EditingCompletionGatePendingItem {
  item_key: string;
  category: EditingCompletionGatePendingItemCategory;
  source: EditingCompletionGatePendingItemSource;
  summary: string;
  detail?: string;
  location_text?: string;
  related_slot_key?: string;
  related_rule_id?: string;
  review_item_id?: string;
  status: EditingCompletionGatePendingItemStatus;
}

export interface EditingCompletionGateManualObjectDecision {
  item_key: string;
  decision: EditingCompletionGateManualObjectDecisionKind;
  note?: string;
  applied_by?: UserId;
  applied_at?: string;
}

export interface EditingCompletionGateSummary {
  observation_status: "reported" | "failed_open";
  verdict?: EditingCompletionGateVerdict;
  journal_template_id?: JournalTemplateId;
  target_model_version_id?: string;
  target_model_version_no?: number;
  source_job_id?: string;
  current_asset_id?: DocumentAssetId;
  generated_at?: string;
  passed: boolean;
  blocker_count: number;
  unresolved_required_slots: EditingCompletionGatePendingItem[];
  pending_manual_resolution_items: EditingCompletionGatePendingItem[];
  high_risk_object_items: EditingCompletionGatePendingItem[];
  table_high_risk_items: EditingCompletionGatePendingItem[];
  blocking_format_failures: EditingCompletionGatePendingItem[];
  manual_object_decisions?: EditingCompletionGateManualObjectDecision[];
  override_reasons?: string[];
  error?: string;
}

export interface Manuscript {
  id: ManuscriptId;
  title: string;
  manuscript_type: ManuscriptType;
  manuscript_type_detection_summary?: ManuscriptTypeDetectionSummary;
  status: ManuscriptStatus;
  created_by: UserId;
  current_screening_asset_id?: DocumentAssetId;
  current_editing_asset_id?: DocumentAssetId;
  current_proofreading_asset_id?: DocumentAssetId;
  current_template_family_id?: TemplateFamilyId;
  current_journal_template_id?: JournalTemplateId;
  governed_execution_context_summary?: GovernedExecutionContextSummary;
  editing_slot_governance_summary?: EditingSlotGovernanceSummary;
  editing_completion_gate_summary?: EditingCompletionGateSummary;
}
