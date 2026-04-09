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
  template_bindings?: string[];
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

export type KnowledgeRevisionBindingKind =
  | "template_family"
  | "module_template"
  | "section"
  | "journal_template";

export interface KnowledgeRevisionBindingRecord {
  id: string;
  revision_id: string;
  binding_kind: KnowledgeRevisionBindingKind;
  binding_target_id: string;
  binding_target_label: string;
  created_at: string;
}

export interface KnowledgeReviewActionRecord {
  id: string;
  knowledge_item_id: string;
  revision_id?: string;
  action: "submitted_for_review" | "approved" | "rejected";
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
