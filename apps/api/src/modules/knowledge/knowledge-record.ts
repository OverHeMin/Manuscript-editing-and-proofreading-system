import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { ManuscriptModule } from "../jobs/job-record.ts";

export type KnowledgeItemStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "deprecated"
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
}

export interface KnowledgeReviewActionRecord {
  id: string;
  knowledge_item_id: string;
  action: "submitted_for_review" | "approved" | "rejected";
  actor_role: "admin" | "screener" | "editor" | "proofreader" | "knowledge_reviewer" | "user";
  review_note?: string;
  created_at: string;
}
