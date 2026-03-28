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
}
