import type {
  TableSemanticDataCell,
  TableSemanticFootnoteItem,
  TableSemanticHeaderCell,
  TableSemanticProfile,
} from "./table-semantics.js";
import type { RuleObjectKey } from "./editorial-rules.js";
import type { ManuscriptType } from "./manuscript.js";
import type { ModuleType } from "./templates.js";

export type RulePackageKind =
  | "front_matter"
  | "abstract_keywords"
  | "terminology"
  | "heading_hierarchy"
  | "statement"
  | "manuscript_structure"
  | "numeric_statistics"
  | "three_line_table"
  | "reference";

export type RulePackageSuggestedLayer = "template_family" | "journal_template";
export type RulePackageAutomationPosture =
  | "safe_auto"
  | "guarded_auto"
  | "inspect_only";
export type RulePackageDraftStatus = "draft" | "ready_for_review";
export type ExampleDocumentSource = "original" | "edited";
export type ExampleDocumentParserStatus =
  | "ready"
  | "partial"
  | "needs_manual_review";
export type ExampleBlockKind = "paragraph" | "heading" | "table";
export type ExampleSignalType =
  | "label_normalization"
  | "inserted_block"
  | "deleted_block"
  | "text_style_normalization"
  | "table_semantic_change"
  | "reference_style_change";

export interface RulePackageGenerationContext {
  manuscript_type: ManuscriptType;
  module: ModuleType;
  journal_key?: string;
}

export interface ExampleDocumentSectionSnapshot {
  order: number;
  heading: string;
  level?: number;
  paragraph_index?: number;
  page_no?: number;
}

export interface ExampleDocumentBlockSnapshot {
  block_id: string;
  kind: ExampleBlockKind;
  section_key: string;
  semantic_role: string;
  text: string;
  style?: string;
  paragraph_index?: number;
}

export interface ExampleDocumentTableSnapshot {
  table_id: string;
  label?: string;
  title?: string;
  profile: TableSemanticProfile;
  header_cells: TableSemanticHeaderCell[];
  data_cells: TableSemanticDataCell[];
  footnote_items: TableSemanticFootnoteItem[];
}

export interface ExampleDocumentSnapshot {
  source: ExampleDocumentSource;
  parser_status: ExampleDocumentParserStatus;
  sections: ExampleDocumentSectionSnapshot[];
  blocks: ExampleDocumentBlockSnapshot[];
  tables: ExampleDocumentTableSnapshot[];
  warnings: string[];
}

export interface ExamplePairUploadInput {
  context: RulePackageGenerationContext;
  original: ExampleDocumentSnapshot;
  edited: ExampleDocumentSnapshot;
}

export interface GenerateRulePackageCandidatesFromReviewedCaseInput {
  reviewedCaseSnapshotId: string;
  journalKey?: string;
}

export interface InlineUploadFilePayload {
  fileName: string;
  mimeType: string;
  fileContentBase64: string;
}

export interface CreateRulePackageExampleSourceSessionInput {
  originalFile: InlineUploadFilePayload;
  editedFile: InlineUploadFilePayload;
  journalKey?: string;
}

export interface RulePackageExampleSourceSession {
  session_id: string;
  source_kind: "uploaded_example_pair";
  original_asset: {
    file_name: string;
    mime_type: string;
  };
  edited_asset: {
    file_name: string;
    mime_type: string;
  };
  journal_key?: string;
  created_at: string;
  expires_at: string;
}

export type RulePackageWorkspaceSourceInput =
  | {
      sourceKind: "reviewed_case";
      reviewedCaseSnapshotId: string;
      journalKey?: string;
    }
  | {
      sourceKind: "uploaded_example_pair";
      exampleSourceSessionId: string;
      journalKey?: string;
    };

export interface RuleEvidenceExample {
  before: string;
  after: string;
  note?: string;
}

export interface EditIntentSignal {
  id: string;
  package_hint: RulePackageKind | "unknown";
  signal_type: ExampleSignalType;
  object_hint: string;
  before?: string;
  after?: string;
  rationale: string;
  confidence: number;
  risk_flags: string[];
}

export interface RulePackageWhatCard {
  title: string;
  object: RuleObjectKey | string;
  publish_layer: RulePackageSuggestedLayer;
}

export interface RulePackageAiUnderstandingCard {
  summary: string;
  hit_objects: string[];
  hit_locations: string[];
}

export interface RulePackageApplicabilityCard {
  manuscript_types: ManuscriptType[];
  modules: ModuleType[];
  sections: string[];
  table_targets: string[];
}

export interface RulePackageEvidenceCard {
  examples: RuleEvidenceExample[];
}

export interface RulePackageExclusionsCard {
  not_applicable_when: string[];
  human_review_required_when: string[];
  risk_posture: RulePackageAutomationPosture;
}

export interface RulePackageSemanticCards {
  rule_what: RulePackageWhatCard;
  ai_understanding: RulePackageAiUnderstandingCard;
  applicability: RulePackageApplicabilityCard;
  evidence: RulePackageEvidenceCard;
  exclusions: RulePackageExclusionsCard;
}

export interface AiRuleUnderstandingPayload {
  semantic_summary: string;
  hit_scope: string[];
  applicability: string[];
  evidence_examples: RuleEvidenceExample[];
  failure_boundaries: string[];
  normalization_recipe: string[];
  review_policy: string[];
  confirmed_fields: string[];
}

export interface RulePackagePreviewEntry {
  target: string;
  reason: string;
  matched_text?: string;
}

export interface RulePackagePreviewDecision {
  automation_posture: RulePackageAutomationPosture;
  needs_human_review: boolean;
  reason: string;
}

export interface RulePackagePreview {
  hit_summary: string;
  hits: RulePackagePreviewEntry[];
  misses: RulePackagePreviewEntry[];
  decision: RulePackagePreviewDecision;
}

export interface RulePackageCandidate {
  package_id: string;
  package_kind: RulePackageKind;
  title: string;
  rule_object: RuleObjectKey | string;
  suggested_layer: RulePackageSuggestedLayer;
  automation_posture: RulePackageAutomationPosture;
  status: RulePackageDraftStatus;
  cards: RulePackageSemanticCards;
  preview: RulePackagePreview;
  semantic_draft?: AiRuleUnderstandingPayload;
  supporting_signals?: EditIntentSignal[];
}

export type RulePackageDraft = Omit<RulePackageCandidate, "preview">;

export interface RulePackageWorkspace {
  source: RulePackageWorkspaceSourceInput;
  candidates: RulePackageCandidate[];
  selectedPackageId: string | null;
}

export interface RulePackagePreviewInput {
  packageDraft: RulePackageDraft;
  sampleText: string;
}

export type RulePackageCompileReadinessStatus =
  | "ready"
  | "ready_with_downgrade"
  | "needs_confirmation"
  | "unsupported";

export interface RulePackageCompileReadiness {
  status: RulePackageCompileReadinessStatus;
  reasons: string[];
}

export interface RulePackageCompileTrace {
  package_id: string;
  package_kind: RulePackageKind;
  source_kind: RulePackageWorkspaceSourceInput["sourceKind"];
  source_id: string;
  semantic_hash: string;
  evidence_examples: RuleEvidenceExample[];
  compiled_at: string;
  compiler_version: string;
}

export interface CompiledEditorialRuleSeed {
  package_id: string;
  coverage_key: string;
  rule_object: string;
  rule_type: "format" | "content";
  execution_mode: "apply" | "inspect" | "apply_and_inspect";
  confidence_policy: "always_auto" | "high_confidence_only" | "manual_only";
  severity: "info" | "warning" | "error";
  scope: Record<string, unknown>;
  selector: Record<string, unknown>;
  trigger: Record<string, unknown>;
  action: Record<string, unknown>;
  authoring_payload: Record<string, unknown>;
  example_before?: string;
  example_after?: string;
  manual_review_reason_template?: string;
}

export interface RulePackageCompilePreviewEntry {
  package_id: string;
  readiness: RulePackageCompileReadiness;
  draft_rule_seeds: CompiledEditorialRuleSeed[];
  overrides_published_coverage_keys: string[];
  warnings: string[];
}

export interface PreviewCompileRulePackagesInput {
  source: RulePackageWorkspaceSourceInput;
  packageDrafts: RulePackageDraft[];
  templateFamilyId: string;
  journalTemplateId?: string;
  module: ModuleType;
}

export interface RulePackageCompilePreview {
  packages: RulePackageCompilePreviewEntry[];
}

export type RulePackageCompileTargetMode =
  | "reused_selected_draft"
  | "created_new_draft";

export type RulePackageCompilePublishReadinessStatus =
  | "ready_to_review"
  | "review_before_publish"
  | "blocked";

export interface RulePackageCompilePublishReadiness {
  status: RulePackageCompilePublishReadinessStatus;
  reasons: string[];
  blocked_package_count: number;
  override_count: number;
  guarded_rule_count: number;
  inspect_rule_count: number;
}

export interface RulePackageCompileProjectionReadiness {
  projected_kinds: Array<"rule" | "checklist" | "prompt_snippet">;
  confirmed_semantic_fields: string[];
  withheld_semantic_fields: string[];
  reasons: string[];
}
