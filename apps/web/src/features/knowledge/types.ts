import type { ManuscriptType } from "../manuscripts/types.ts";
import type { ManuscriptModule } from "../manuscripts/types.ts";

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

export type KnowledgeProjectionKind = "rule" | "checklist" | "prompt_snippet";

export type EvidenceLevel = "low" | "medium" | "high" | "expert_opinion" | "unknown";

export type KnowledgeSourceType =
  | "paper"
  | "guideline"
  | "book"
  | "website"
  | "internal_case"
  | "other";

export interface KnowledgeProjectionSourceViewModel {
  source_kind: "editorial_rule_projection";
  rule_set_id: string;
  rule_id: string;
  projection_kind: KnowledgeProjectionKind;
}

export interface KnowledgeItemViewModel {
  id: string;
  asset_id?: string;
  revision_id?: string;
  title: string;
  canonical_text: string;
  summary?: string;
  knowledge_kind: KnowledgeKind;
  status: KnowledgeItemStatus;
  routing: {
    module_scope: ManuscriptModule | "any";
    manuscript_types: ManuscriptType[] | "any";
    sections?: string[];
    risk_tags?: string[];
    discipline_tags?: string[];
  };
  evidence_level?: EvidenceLevel;
  source_type?: KnowledgeSourceType;
  source_link?: string;
  effective_at?: string;
  expires_at?: string;
  aliases?: string[];
  template_bindings?: string[];
  projection_source?: KnowledgeProjectionSourceViewModel;
}

export interface KnowledgeReviewQueueItemViewModel extends KnowledgeItemViewModel {
  asset_id: string;
  revision_id: string;
}

export interface KnowledgeReviewActionViewModel {
  id: string;
  knowledge_item_id: string;
  revision_id?: string;
  action: "submitted_for_review" | "approved" | "rejected";
  actor_role:
    | "admin"
    | "screener"
    | "editor"
    | "proofreader"
    | "knowledge_reviewer"
    | "user";
  review_note?: string;
  created_at: string;
}

export interface CreateKnowledgeDraftInput {
  title: string;
  canonicalText: string;
  summary?: string;
  knowledgeKind: KnowledgeKind;
  moduleScope: ManuscriptModule | "any";
  manuscriptTypes: ManuscriptType[] | "any";
  sections?: string[];
  riskTags?: string[];
  disciplineTags?: string[];
  evidenceLevel?: EvidenceLevel;
  sourceType?: KnowledgeSourceType;
  sourceLink?: string;
  aliases?: string[];
  templateBindings?: string[];
}

export interface UpdateKnowledgeDraftInput {
  title?: string;
  canonicalText?: string;
  summary?: string;
  sections?: string[];
  riskTags?: string[];
  disciplineTags?: string[];
  aliases?: string[];
  templateBindings?: string[];
}
