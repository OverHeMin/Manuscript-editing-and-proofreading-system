import type { ManuscriptType } from "./manuscript.js";
import type { ManuscriptModule } from "./assets.js";
import type { LearningCandidateId } from "./learning.js";

export type KnowledgeItemId = string;

export type KnowledgeItemStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "deprecated"
  | "superseded"
  | "archived";

// V1 keeps kinds coarse; expand as the library stabilizes.
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

export interface KnowledgeProjectionSource {
  source_kind: "editorial_rule_projection";
  rule_set_id: string;
  rule_id: string;
  projection_kind: KnowledgeProjectionKind;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeItemRouting {
  // "Precise retrieval" routing fields per docs/superpowers/specs/04-knowledge-learning-and-retrieval.md
  module_scope: ManuscriptModule | "any";
  // Allow truly generic knowledge without forcing an explicit enumeration.
  manuscript_types: ManuscriptType[] | "any";
  sections?: string[];
  risk_tags?: string[];
  discipline_tags?: string[];
}

export interface KnowledgeItem {
  id: KnowledgeItemId;
  title: string;

  canonical_text: string;
  summary?: string;

  knowledge_kind: KnowledgeKind;
  status: KnowledgeItemStatus;

  routing: KnowledgeItemRouting;

  evidence_level?: EvidenceLevel;
  source_type?: KnowledgeSourceType;
  source_link?: string;

  effective_at?: string;
  expires_at?: string;

  aliases?: string[];

  // Links to templates are modeled separately; keep an escape hatch for projection views.
  template_bindings?: string[];
  source_learning_candidate_id?: LearningCandidateId;
  projection_source?: KnowledgeProjectionSource;
}

export interface KnowledgeContentBlock {
  id: string;
  revision_id: string;
  block_type: "text_block" | "table_block" | "image_block";
  order_no: number;
  status: "active" | "archived";
  content_payload: Record<string, unknown>;
  table_semantics?: Record<string, unknown>;
  image_understanding?: Record<string, unknown>;
}

export interface KnowledgeSemanticLayer {
  revision_id: string;
  status: "not_generated" | "pending_confirmation" | "confirmed" | "stale";
  page_summary?: string;
  retrieval_terms?: string[];
  retrieval_snippets?: string[];
  table_semantics?: Record<string, unknown>;
  image_understanding?: Record<string, unknown>;
}
