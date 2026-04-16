import type {
  EvidenceLevel,
  KnowledgeKind,
  KnowledgeSourceType,
} from "../knowledge/index.ts";
import type { ManuscriptModule, ManuscriptType } from "../manuscripts/types.ts";

export type KnowledgeRevisionStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "superseded"
  | "archived";

export type KnowledgeRevisionBindingKind =
  | "template_family"
  | "module_template"
  | "section"
  | "journal_template"
  | "general_package"
  | "medical_package";

export interface KnowledgeRevisionBindingViewModel {
  id: string;
  revision_id: string;
  binding_kind: KnowledgeRevisionBindingKind;
  binding_target_id: string;
  binding_target_label: string;
  created_at: string;
}

export interface KnowledgeAssetViewModel {
  id: string;
  status: "active" | "archived";
  current_revision_id?: string;
  current_approved_revision_id?: string;
  contributor_label?: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeRevisionViewModel {
  id: string;
  asset_id: string;
  revision_no: number;
  status: KnowledgeRevisionStatus;
  title: string;
  canonical_text: string;
  summary?: string;
  knowledge_kind: KnowledgeKind;
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
  effective_at?: string;
  expires_at?: string;
  based_on_revision_id?: string;
  content_blocks: KnowledgeContentBlockViewModel[];
  semantic_layer?: KnowledgeSemanticLayerViewModel;
  bindings: KnowledgeRevisionBindingViewModel[];
  contributor_label?: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeAssetDetailViewModel {
  asset: KnowledgeAssetViewModel;
  selected_revision: KnowledgeRevisionViewModel;
  current_approved_revision?: KnowledgeRevisionViewModel;
  revisions: KnowledgeRevisionViewModel[];
}

export type KnowledgeLibraryQueryMode = "keyword" | "semantic";

export type KnowledgeSemanticStatus =
  | "not_generated"
  | "pending_confirmation"
  | "confirmed"
  | "stale";

export type KnowledgeContentBlockType = "text_block" | "table_block" | "image_block";

export interface KnowledgeContentBlockViewModel {
  id: string;
  revision_id: string;
  block_type: KnowledgeContentBlockType;
  order_no: number;
  status: "active" | "archived";
  content_payload: Record<string, unknown>;
  table_semantics?: Record<string, unknown>;
  image_understanding?: Record<string, unknown>;
}

export interface KnowledgeSemanticLayerViewModel {
  revision_id: string;
  status: KnowledgeSemanticStatus;
  page_summary?: string;
  retrieval_terms?: string[];
  retrieval_snippets?: string[];
  table_semantics?: Record<string, unknown>;
  image_understanding?: Record<string, unknown>;
}

export interface KnowledgeSemanticLayerInput {
  pageSummary?: string;
  retrievalTerms?: string[];
  retrievalSnippets?: string[];
  tableSemantics?: Record<string, unknown>;
  imageUnderstanding?: Record<string, unknown>;
}

export interface KnowledgeUploadViewModel {
  upload_id: string;
  storage_key: string;
  file_name: string;
  mime_type: string;
  byte_length: number;
  uploaded_at: string;
}

export interface KnowledgeUploadInput {
  fileName: string;
  mimeType: string;
  fileContentBase64: string;
}

export interface KnowledgeLibrarySummaryViewModel {
  id: string;
  title: string;
  summary?: string;
  knowledge_kind: KnowledgeKind;
  status: KnowledgeRevisionStatus;
  module_scope: ManuscriptModule | "any";
  manuscript_types: ManuscriptType[] | "any";
  selected_revision_id?: string;
  semantic_status?: KnowledgeSemanticStatus;
  content_block_count: number;
  contributor_label?: string;
  archived_at?: string;
  archived_by_role?: string;
  updated_at?: string;
}

export interface KnowledgeLibraryFilterState {
  searchText: string;
  queryMode: KnowledgeLibraryQueryMode;
  knowledgeKind: KnowledgeKind | "all";
  moduleScope: ManuscriptModule | "any";
  semanticStatus: KnowledgeSemanticStatus | "all";
  contributorText: string;
  assetStatus?: "active" | "archived" | "all";
}

export interface KnowledgeRevisionBindingInput {
  bindingKind: KnowledgeRevisionBindingKind;
  bindingTargetId: string;
  bindingTargetLabel: string;
}

export type DuplicateKnowledgeSeverity = "exact" | "high" | "possible";

export type DuplicateKnowledgeReason =
  | "canonical_text_exact_match"
  | "canonical_text_high_overlap"
  | "title_exact_match"
  | "title_high_similarity"
  | "alias_overlap"
  | "same_knowledge_kind"
  | "same_module_scope"
  | "manuscript_type_overlap"
  | "binding_overlap";

export interface DuplicateKnowledgeMatchViewModel {
  severity: DuplicateKnowledgeSeverity;
  score: number;
  matched_asset_id: string;
  matched_revision_id: string;
  matched_title: string;
  matched_status: KnowledgeRevisionStatus;
  matched_summary?: string;
  reasons: DuplicateKnowledgeReason[];
}

export interface DuplicateKnowledgeCheckInput extends CreateKnowledgeLibraryDraftInput {
  currentAssetId?: string;
  currentRevisionId?: string;
}

export type DuplicateWarningAcknowledgementMatchInput = Pick<
  DuplicateKnowledgeMatchViewModel,
  "matched_asset_id" | "matched_revision_id" | "severity"
>;

export interface DuplicateWarningAcknowledgementInput {
  acknowledged: boolean;
  matches: DuplicateWarningAcknowledgementMatchInput[];
}

export interface KnowledgeLibraryAiIntakeSuggestionInput {
  sourceText: string;
  sourceLabel?: string;
  sourceLink?: string;
  operatorHints?: string;
}

export interface KnowledgeLibraryAiIntakeSuggestionViewModel {
  suggestedDraft: CreateKnowledgeLibraryDraftInput;
  suggestedContentBlocks: KnowledgeContentBlockViewModel[];
  suggestedSemanticLayer?: KnowledgeSemanticLayerViewModel;
  warnings: string[];
}

export interface KnowledgeLibrarySemanticAssistInput {
  revisionId: string;
  instructionText: string;
  targetScopes?: string[];
}

export interface KnowledgeLibrarySemanticAssistSuggestionViewModel {
  suggestedSemanticLayer: KnowledgeSemanticLayerInput;
  suggestedFieldPatch?: UpdateKnowledgeLibraryDraftInput;
  warnings: string[];
}

export interface CreateKnowledgeLibraryDraftInput {
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
  effectiveAt?: string;
  expiresAt?: string;
  bindings?: KnowledgeRevisionBindingInput[];
}

export interface UpdateKnowledgeLibraryDraftInput {
  title?: string;
  canonicalText?: string;
  summary?: string;
  knowledgeKind?: KnowledgeKind;
  moduleScope?: ManuscriptModule | "any";
  manuscriptTypes?: ManuscriptType[] | "any";
  sections?: string[];
  riskTags?: string[];
  disciplineTags?: string[];
  evidenceLevel?: EvidenceLevel;
  sourceType?: KnowledgeSourceType;
  sourceLink?: string;
  aliases?: string[];
  effectiveAt?: string;
  expiresAt?: string;
  bindings?: KnowledgeRevisionBindingInput[];
}

export interface KnowledgeLibraryWorkbenchViewModel {
  library: KnowledgeLibrarySummaryViewModel[];
  visibleLibrary: KnowledgeLibrarySummaryViewModel[];
  filters: KnowledgeLibraryFilterState;
  selectedAssetId: string | null;
  selectedRevisionId: string | null;
  selectedSummary: KnowledgeLibrarySummaryViewModel | null;
  detail: KnowledgeAssetDetailViewModel | null;
}
