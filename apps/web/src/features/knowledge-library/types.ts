import type {
  EvidenceLevel,
  KnowledgeItemStatus,
  KnowledgeItemViewModel,
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
  | "journal_template";

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
  bindings: KnowledgeRevisionBindingViewModel[];
  created_at: string;
  updated_at: string;
}

export interface KnowledgeAssetDetailViewModel {
  asset: KnowledgeAssetViewModel;
  selected_revision: KnowledgeRevisionViewModel;
  current_approved_revision?: KnowledgeRevisionViewModel;
  revisions: KnowledgeRevisionViewModel[];
}

export type KnowledgeLibrarySummaryViewModel = KnowledgeItemViewModel;

export interface KnowledgeLibraryFilterState {
  searchText: string;
  status: KnowledgeItemStatus | "all";
  knowledgeKind: KnowledgeKind | "all";
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
