import type {
  DocumentAssetStatus,
  DocumentAssetType,
  KnowledgeItemStatus,
  LearningCandidateStatus,
  LearningCandidateType,
  ManuscriptStatus,
  ManuscriptType,
  ModuleTemplateStatus,
  TemplateKnowledgeBindingPurpose,
} from "../src/index.js";

type IsEqual<A, B> = (<T>() => T extends A ? 1 : 2) extends <
  T
>() => T extends B ? 1 : 2
  ? true
  : false;
type Assert<T extends true> = T;

// Manuscript
type _ManuscriptStatus = Assert<
  IsEqual<
    ManuscriptStatus,
    | "draft"
    | "uploaded"
    | "processing"
    | "awaiting_review"
    | "completed"
    | "archived"
  >
>;

type _ManuscriptType = Assert<
  IsEqual<
    ManuscriptType,
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
    | "other"
  >
>;

// Assets
type _DocumentAssetStatus = Assert<
  IsEqual<DocumentAssetStatus, "created" | "active" | "superseded" | "archived">
>;

type _DocumentAssetType = Assert<
  IsEqual<
    DocumentAssetType,
    | "original"
    | "normalized_docx"
    | "screening_report"
    | "edited_docx"
    | "proofreading_draft_report"
    | "proofread_annotated_docx"
    | "pdf_consistency_report"
    | "human_final_docx"
    | "learning_snapshot_attachment"
  >
>;

// Knowledge
type _KnowledgeItemStatus = Assert<
  IsEqual<
    KnowledgeItemStatus,
    | "draft"
    | "pending_review"
    | "approved"
    | "deprecated"
    | "superseded"
    | "archived"
  >
>;

// Learning
type _LearningCandidateType = Assert<
  IsEqual<
    LearningCandidateType,
    | "rule_candidate"
    | "case_pattern_candidate"
    | "template_update_candidate"
    | "prompt_optimization_candidate"
    | "checklist_update_candidate"
  >
>;

type _LearningCandidateStatus = Assert<
  IsEqual<
    LearningCandidateStatus,
    "draft" | "pending_review" | "approved" | "rejected" | "archived"
  >
>;

// Templates
type _ModuleTemplateStatus = Assert<
  IsEqual<ModuleTemplateStatus, "draft" | "published" | "archived">
>;

type _TemplateKnowledgeBindingPurpose = Assert<
  IsEqual<
    TemplateKnowledgeBindingPurpose,
    "required" | "recommended" | "risk_guardrail" | "section_specific"
  >
>;

