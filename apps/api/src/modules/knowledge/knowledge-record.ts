import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { ManuscriptModule } from "../jobs/job-record.ts";

export type KnowledgeItemStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "deprecated"
  | "superseded"
  | "archived";

export type KnowledgeAssetStatus = "active" | "archived";

export type KnowledgeRevisionStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "superseded"
  | "archived";

export type KnowledgeKind =
  | "rule"
  | "case_pattern"
  | "checklist"
  | "prompt_snippet"
  | "reference"
  | "other";

export type EvidenceLevel = "low" | "medium" | "high" | "expert_opinion" | "unknown";

export type KnowledgeSourceType =
  | "paper"
  | "guideline"
  | "book"
  | "website"
  | "internal_case"
  | "other";

export type KnowledgeEvidencePackageStatus =
  | "raw"
  | "captured"
  | "non_authoritative"
  | "authoritative"
  | "linked_to_rule"
  | "retired";
export type KnowledgeEvidencePackageKind =
  | "official_guideline_text"
  | "official_sample_screenshot"
  | "word_sample_table"
  | "wps_sample_table"
  | "docx_sample_table"
  | "correct_example"
  | "incorrect_example"
  | "object_symbol_sample"
  | "journal_article_example"
  | "operator_annotation";
export type KnowledgeEvidenceAuthorityLevel =
  | "official_journal_guideline"
  | "official_journal_sample"
  | "journal_published_recent_article"
  | "institutional_editorial_standard"
  | "operator_curated_experience";
export type TableEvidenceSourceKind =
  | "word_clipboard"
  | "wps_clipboard"
  | "docx_upload"
  | "manual_review_import";
export type TableEvidenceAuthoritativeStatus =
  | "authoritative"
  | "non_authoritative"
  | "blocked"
  | "manual_review_required";
export type TableEvidenceFactAuthority =
  | "authoritative"
  | "mixed"
  | "unavailable"
  | "unsupported";
export type TableEvidenceMandatoryFactGroup =
  | "identity"
  | "structure"
  | "border_system"
  | "layout"
  | "paragraph_style"
  | "typography"
  | "rich_content"
  | "object_content"
  | "authority_markers";

export interface TableEvidenceSourceEnvironmentRecord {
  source_application: "word" | "wps" | "docx_upload" | "manual_review";
  application_version?: string;
  browser?: string;
  os?: string;
  clipboard_mime_types?: string[];
  clipboard_html_available?: boolean;
  ooxml_fragment_available?: boolean;
  fallback_posture?: "none" | "non_authoritative" | "manual_review_required";
}

export interface TableFullFidelitySnapshotRecord {
  snapshot_id?: string;
  mandatory_fact_authority: Record<
    TableEvidenceMandatoryFactGroup,
    TableEvidenceFactAuthority
  >;
  facts: Record<string, unknown>;
}

export type KnowledgeProjectionKind = "rule" | "checklist" | "prompt_snippet";

export type KnowledgeDuplicateSeverity = "exact" | "high" | "possible";

export type KnowledgeDuplicateReason =
  | "canonical_text_exact_match"
  | "canonical_text_high_overlap"
  | "title_exact_match"
  | "title_high_similarity"
  | "alias_overlap"
  | "same_knowledge_kind"
  | "same_module_scope"
  | "manuscript_type_overlap"
  | "binding_overlap";

export interface KnowledgeProjectionContextRecord {
  module: ManuscriptModule;
  manuscript_type: ManuscriptType;
  template_family_id: string;
  journal_template_id?: string;
  journal_key?: string;
  rule_object: string;
  standard_example?: string;
  incorrect_example?: string;
  not_applicable_boundary?: string;
  evidence_summary?: string;
}

export interface KnowledgeProjectionSourceRecord {
  source_kind: "editorial_rule_projection";
  rule_set_id: string;
  rule_id: string;
  projection_kind: KnowledgeProjectionKind;
  projection_context?: KnowledgeProjectionContextRecord;
}

export interface KnowledgeRoutingRecord {
  module_scope: ManuscriptModule | "any";
  manuscript_types: ManuscriptType[] | "any";
  sections?: string[];
  risk_tags?: string[];
  discipline_tags?: string[];
}

export interface KnowledgeBindingTargetsRecord {
  template_family_ids?: string[];
  module_template_ids?: string[];
  journal_template_ids?: string[];
  general_package_ids?: string[];
  medical_package_ids?: string[];
  target_model_block_ids?: string[];
}

export interface KnowledgeRecord {
  id: string;
  title: string;
  canonical_text: string;
  summary?: string;
  knowledge_kind: KnowledgeKind;
  status: KnowledgeItemStatus;
  routing: KnowledgeRoutingRecord;
  evidence_level?: EvidenceLevel;
  source_type?: KnowledgeSourceType;
  source_link?: string;
  aliases?: string[];
  binding_targets?: KnowledgeBindingTargetsRecord;
  template_bindings?: string[];
  linked_knowledge_item_ids?: string[];
  source_learning_candidate_id?: string;
  projection_source?: KnowledgeProjectionSourceRecord;
}

export interface KnowledgeAssetRecord {
  id: string;
  status: KnowledgeAssetStatus;
  current_revision_id?: string;
  current_approved_revision_id?: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeRevisionRecord {
  id: string;
  asset_id: string;
  revision_no: number;
  status: KnowledgeRevisionStatus;
  title: string;
  canonical_text: string;
  summary?: string;
  knowledge_kind: KnowledgeKind;
  routing: KnowledgeRoutingRecord;
  evidence_level?: EvidenceLevel;
  source_type?: KnowledgeSourceType;
  source_link?: string;
  effective_at?: string;
  expires_at?: string;
  aliases?: string[];
  source_learning_candidate_id?: string;
  projection_source?: KnowledgeProjectionSourceRecord;
  based_on_revision_id?: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeEvidencePackageRecord {
  id: string;
  knowledge_item_id: string;
  revision_id?: string;
  status: KnowledgeEvidencePackageStatus;
  evidence_kind: KnowledgeEvidencePackageKind;
  authority_level: KnowledgeEvidenceAuthorityLevel;
  source_label: string;
  source_payload: Record<string, unknown>;
  binding_targets?: KnowledgeBindingTargetsRecord;
  linked_rule_ids?: string[];
  linked_target_model_block_ids?: string[];
  created_at: string;
  updated_at: string;
}

export interface TableEvidencePackageRecord extends KnowledgeEvidencePackageRecord {
  source_kind: TableEvidenceSourceKind;
  source_environment: TableEvidenceSourceEnvironmentRecord;
  authoritative_status: TableEvidenceAuthoritativeStatus;
  capture_failure_codes: string[];
  raw_payload_refs?: string[];
  normalized_table_object_id?: string;
  table_full_fidelity_snapshot_id?: string;
  table_full_fidelity_snapshot?: TableFullFidelitySnapshotRecord;
}

export type KnowledgeRevisionBindingKind =
  | "template_family"
  | "module_template"
  | "section"
  | "journal_template"
  | "general_package"
  | "medical_package"
  | "target_model_block"
  | "knowledge_item";

export type KnowledgeContentBlockType =
  | "text_block"
  | "table_block"
  | "table_evidence_block"
  | "image_block";

export type KnowledgeContentBlockStatus = "active" | "archived";

export type KnowledgeSemanticLayerStatus =
  | "not_generated"
  | "pending_confirmation"
  | "confirmed"
  | "stale";

export interface KnowledgeRevisionBindingRecord {
  id: string;
  revision_id: string;
  binding_kind: KnowledgeRevisionBindingKind;
  binding_target_id: string;
  binding_target_label: string;
  created_at: string;
}

export interface KnowledgeContentBlockRecord {
  id: string;
  revision_id: string;
  block_type: KnowledgeContentBlockType;
  order_no: number;
  status: KnowledgeContentBlockStatus;
  content_payload: Record<string, unknown>;
  table_semantics?: Record<string, unknown>;
  image_understanding?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeSemanticLayerRecord {
  revision_id: string;
  status: KnowledgeSemanticLayerStatus;
  page_summary?: string;
  retrieval_terms?: string[];
  retrieval_snippets?: string[];
  table_semantics?: Record<string, unknown>;
  image_understanding?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeReviewActionRecord {
  id: string;
  knowledge_item_id: string;
  revision_id?: string;
  action:
    | "submitted_for_review"
    | "approved"
    | "rejected"
    | "archived"
    | "restored";
  actor_role: "admin" | "screener" | "editor" | "proofreader" | "knowledge_reviewer" | "user";
  review_note?: string;
  created_at: string;
}

export interface KnowledgeDuplicateMatchRecord {
  severity: KnowledgeDuplicateSeverity;
  score: number;
  matched_asset_id: string;
  matched_revision_id: string;
  matched_title: string;
  matched_status: KnowledgeRevisionStatus;
  matched_summary?: string;
  reasons: KnowledgeDuplicateReason[];
}

export interface KnowledgeDuplicateCheckInput {
  currentAssetId?: string;
  currentRevisionId?: string;
  title: string;
  canonicalText: string;
  summary?: string;
  knowledgeKind: KnowledgeKind;
  moduleScope: KnowledgeRoutingRecord["module_scope"];
  manuscriptTypes: KnowledgeRoutingRecord["manuscript_types"];
  sections?: string[];
  riskTags?: string[];
  disciplineTags?: string[];
  aliases?: string[];
  bindings?: string[];
}

export interface KnowledgeDuplicateAcknowledgementRecord {
  matched_asset_id: string;
  matched_revision_id?: string;
  severity?: KnowledgeDuplicateSeverity;
  note?: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
}
