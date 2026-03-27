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

export type EvidenceLevel = "low" | "medium" | "high" | "expert_opinion" | "unknown";

export type KnowledgeSourceType =
  | "paper"
  | "guideline"
  | "book"
  | "website"
  | "internal_case"
  | "other";

export interface KnowledgeItemViewModel {
  id: string;
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
  aliases?: string[];
  template_bindings?: string[];
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
