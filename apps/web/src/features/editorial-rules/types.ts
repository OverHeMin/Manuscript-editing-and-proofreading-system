import type { AuthRole } from "../auth/roles.ts";
import type { ManuscriptType } from "../manuscripts/types.ts";
import type { TemplateModule } from "../templates/types.ts";
import type {
  RuleAiIntakeDraftRequest,
  RuleAiIntakeDraftResponse,
  RuleAiParsingRequest,
  RuleAiParsingResponse,
} from "@medical/contracts";

export type EditorialRuleSetStatus =
  | "draft"
  | "candidate"
  | "canary"
  | "active"
  | "published"
  | "archived"
  | "rolled_back";
export type EditorialRuleType = "format" | "content";
export type EditorialRuleExecutionMode =
  | "apply"
  | "inspect"
  | "apply_and_inspect";
export type EditorialRuleConfidencePolicy =
  | "always_auto"
  | "high_confidence_only"
  | "manual_only";
export type EditorialRuleSeverity = "info" | "warning" | "error";
export type EditorialRuleEvidenceLevel =
  | "low"
  | "medium"
  | "high"
  | "expert_opinion"
  | "unknown";
export type EditorialRuleTableSemanticTarget =
  | "header_cell"
  | "stub_column"
  | "data_cell"
  | "footnote_item";
export type EditorialRuleTableFootnoteKind =
  | "statistical_significance"
  | "abbreviation"
  | "general";
export type EditorialRuleTableUnitContext = "header" | "stub" | "footnote";
export type EditorialRuleActivationMetricKey =
  | "governed_hit_count"
  | "false_positive_count"
  | "human_confirmation_count"
  | "accept_change_only_count"
  | "evidence_only_archive_count"
  | "routed_rule_candidate_count"
  | "routed_knowledge_candidate_count"
  | "routed_prompt_candidate_count"
  | "writeback_created_count"
  | "writeback_applied_count";

export type RuleAiIntakeDraftRequestViewModel = RuleAiIntakeDraftRequest;
export type RuleAiIntakeDraftResponseViewModel = RuleAiIntakeDraftResponse;
export type RuleAiParsingRequestViewModel = RuleAiParsingRequest;
export type RuleAiParsingResponseViewModel = RuleAiParsingResponse;

export interface EditorialRuleScope {
  manuscript_types?: string[];
  sections?: string[];
  object_granularity?: string[];
  [key: string]: unknown;
}

export interface EditorialRuleSelector {
  [key: string]: unknown;
}

export interface EditorialRuleTableSemanticSelector extends EditorialRuleSelector {
  semantic_target: EditorialRuleTableSemanticTarget;
  header_path_includes?: string[];
  row_key?: string;
  column_key?: string;
  note_kind?: EditorialRuleTableFootnoteKind;
  unit_context?: EditorialRuleTableUnitContext;
}

export interface EditorialRuleTrigger {
  kind: string;
  [key: string]: unknown;
}

export interface EditorialRuleAction {
  kind: string;
  [key: string]: unknown;
}

export interface EditorialRuleExplanationPayload {
  rationale?: string;
  applies_when?: string[];
  not_applies_when?: string[];
  correct_example?: string;
  incorrect_example?: string;
  review_prompt?: string;
}

export interface EditorialRuleLinkagePayload {
  source_learning_candidate_id?: string;
  source_snapshot_asset_id?: string;
  projected_knowledge_item_ids?: string[];
  overrides_rule_ids?: string[];
}

export interface EditorialRuleProjectionPayload {
  projection_kind?: string;
  summary?: string;
  standard_example?: string;
  incorrect_example?: string;
}

export interface EditorialRuleSetReleaseScope {
  manuscript_types?: string[];
  sections?: string[];
  object_granularity?: string[];
  [key: string]: unknown;
}

export interface EditorialRuleActivationMetricTotals {
  governed_hit_count: number;
  false_positive_count: number;
  human_confirmation_count: number;
  accept_change_only_count: number;
  evidence_only_archive_count: number;
  routed_rule_candidate_count: number;
  routed_knowledge_candidate_count: number;
  routed_prompt_candidate_count: number;
  writeback_created_count: number;
  writeback_applied_count: number;
}

export interface EditorialRuleActivationMetricRates {
  false_positive_rate: number;
  human_confirmation_rate: number;
  evidence_only_archive_rate: number;
  writeback_success_rate: number;
}

export interface EditorialRuleActivationMetricsSummary {
  rule_id?: string;
  rule_set_id?: string;
  totals: EditorialRuleActivationMetricTotals;
  rates: EditorialRuleActivationMetricRates;
}

export interface EditorialRuleReleaseComparisonSummary {
  status: "stable" | "degraded" | "insufficient_data";
  recommendation: "promote" | "hold" | "rollback_recommended";
  baseline_rule_set_id?: string;
  compared_rule_set_id: string;
  baseline_metrics: EditorialRuleActivationMetricsSummary;
  candidate_metrics: EditorialRuleActivationMetricsSummary;
  reasons: string[];
}

export interface EditorialRuleSetViewModel {
  id: string;
  template_family_id: string;
  journal_template_id?: string;
  module: TemplateModule;
  version_no: number;
  status: EditorialRuleSetStatus;
  release_scope?: EditorialRuleSetReleaseScope;
  candidate_validation_run_id?: string;
  candidate_validation_evidence_pack_id?: string;
  online_regression_run_id?: string;
  online_regression_evidence_pack_id?: string;
  rollback_rule_set_id?: string;
  metrics_summary?: EditorialRuleActivationMetricsSummary;
  release_comparison?: EditorialRuleReleaseComparisonSummary;
}

export interface EditorialRuleViewModel {
  id: string;
  rule_set_id: string;
  order_no: number;
  priority?: number;
  rule_object: string;
  rule_type: EditorialRuleType;
  execution_mode: EditorialRuleExecutionMode;
  scope: EditorialRuleScope;
  selector: EditorialRuleSelector;
  trigger: EditorialRuleTrigger;
  action: EditorialRuleAction;
  authoring_payload: Record<string, unknown>;
  explanation_payload?: EditorialRuleExplanationPayload;
  linkage_payload?: EditorialRuleLinkagePayload;
  projection_payload?: EditorialRuleProjectionPayload;
  evidence_level?: EditorialRuleEvidenceLevel;
  confidence_policy: EditorialRuleConfidencePolicy;
  severity: EditorialRuleSeverity;
  enabled: boolean;
  example_before?: string;
  example_after?: string;
  manual_review_reason_template?: string;
  metrics_summary?: EditorialRuleActivationMetricsSummary;
}

export interface CreateEditorialRuleSetInput {
  actorRole: AuthRole;
  templateFamilyId: string;
  journalTemplateId?: string;
  module: TemplateModule;
}

export interface CreateEditorialRuleInput {
  actorRole: AuthRole;
  orderNo: number;
  priority?: number;
  ruleObject?: string;
  ruleType: EditorialRuleType;
  executionMode: EditorialRuleExecutionMode;
  scope: EditorialRuleScope;
  selector?: EditorialRuleSelector;
  trigger: EditorialRuleTrigger;
  action: EditorialRuleAction;
  authoringPayload?: Record<string, unknown>;
  explanationPayload?: EditorialRuleExplanationPayload;
  linkagePayload?: EditorialRuleLinkagePayload;
  projectionPayload?: EditorialRuleProjectionPayload;
  evidenceLevel?: EditorialRuleEvidenceLevel;
  confidencePolicy: EditorialRuleConfidencePolicy;
  severity: EditorialRuleSeverity;
  enabled?: boolean;
  exampleBefore?: string;
  exampleAfter?: string;
  manualReviewReasonTemplate?: string;
}

export type TransitionEditorialRuleSetTargetStatus = Extract<
  EditorialRuleSetStatus,
  "candidate" | "canary" | "active" | "rolled_back"
>;

export interface TransitionEditorialRuleSetInput {
  actorRole: AuthRole;
  targetStatus: TransitionEditorialRuleSetTargetStatus;
  releaseScope?: EditorialRuleSetReleaseScope;
  candidateValidationRunId?: string;
  candidateValidationEvidencePackId?: string;
  onlineRegressionRunId?: string;
  onlineRegressionEvidencePackId?: string;
}

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
export type RulePackageWorkspaceSourceKind =
  | "reviewed_case"
  | "uploaded_example_pair";

export interface InlineUploadFilePayloadViewModel {
  fileName: string;
  mimeType: string;
  fileContentBase64: string;
}

export interface CreateRulePackageExampleSourceSessionInput {
  originalFile: InlineUploadFilePayloadViewModel;
  editedFile: InlineUploadFilePayloadViewModel;
  journalKey?: string;
}

export interface RulePackageExampleSourceSessionViewModel {
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

export type RulePackageWorkspaceSourceInputViewModel =
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

export interface RuleEvidenceExampleViewModel {
  before: string;
  after: string;
  note?: string;
}

export interface RulePackageSemanticCardsViewModel {
  rule_what: {
    title: string;
    object: string;
    publish_layer: RulePackageSuggestedLayer;
  };
  ai_understanding: {
    summary: string;
    hit_objects: string[];
    hit_locations: string[];
  };
  applicability: {
    manuscript_types: string[];
    modules: string[];
    sections: string[];
    table_targets: string[];
  };
  evidence: {
    examples: RuleEvidenceExampleViewModel[];
  };
  exclusions: {
    not_applicable_when: string[];
    human_review_required_when: string[];
    risk_posture: RulePackageAutomationPosture;
  };
}

export interface RulePackagePreviewViewModel {
  hit_summary: string;
  hits: Array<{
    target: string;
    reason: string;
    matched_text?: string;
  }>;
  misses: Array<{
    target: string;
    reason: string;
    matched_text?: string;
  }>;
  decision: {
    automation_posture: RulePackageAutomationPosture;
    needs_human_review: boolean;
    reason: string;
  };
}

export interface AiRuleUnderstandingPayloadViewModel {
  semantic_summary: string;
  hit_scope: string[];
  applicability: string[];
  evidence_examples: RuleEvidenceExampleViewModel[];
  failure_boundaries: string[];
  normalization_recipe: string[];
  review_policy: string[];
  confirmed_fields: string[];
}

export interface RulePackageCandidateViewModel {
  package_id: string;
  package_kind: RulePackageKind;
  title: string;
  rule_object: string;
  suggested_layer: RulePackageSuggestedLayer;
  automation_posture: RulePackageAutomationPosture;
  status: RulePackageDraftStatus;
  cards: RulePackageSemanticCardsViewModel;
  preview: RulePackagePreviewViewModel;
  semantic_draft?: AiRuleUnderstandingPayloadViewModel;
  supporting_signals?: Array<Record<string, unknown>>;
}

export type RulePackageDraftViewModel = Omit<
  RulePackageCandidateViewModel,
  "preview"
> & { preview?: undefined };

export interface GenerateRulePackageCandidatesFromReviewedCaseInput {
  reviewedCaseSnapshotId: string;
  journalKey?: string;
}

export interface RulePackageWorkspaceViewModel {
  source: RulePackageWorkspaceSourceInputViewModel;
  candidates: RulePackageCandidateViewModel[];
  selectedPackageId: string | null;
}

export type RulePackageCompileReadinessStatus =
  | "ready"
  | "ready_with_downgrade"
  | "needs_confirmation"
  | "unsupported";

export interface RulePackageCompileReadinessViewModel {
  status: RulePackageCompileReadinessStatus;
  reasons: string[];
}

export interface CompiledEditorialRuleSeedViewModel {
  package_id: string;
  coverage_key: string;
  rule_object: string;
  rule_type: EditorialRuleType;
  execution_mode: EditorialRuleExecutionMode;
  confidence_policy: EditorialRuleConfidencePolicy;
  severity: EditorialRuleSeverity;
  scope: EditorialRuleScope;
  selector: EditorialRuleSelector;
  trigger: EditorialRuleTrigger;
  action: EditorialRuleAction;
  authoring_payload: Record<string, unknown>;
  example_before?: string;
  example_after?: string;
  manual_review_reason_template?: string;
}

export interface RulePackageCompilePreviewEntryViewModel {
  package_id: string;
  readiness: RulePackageCompileReadinessViewModel;
  draft_rule_seeds: CompiledEditorialRuleSeedViewModel[];
  overrides_published_coverage_keys: string[];
  warnings: string[];
}

export interface RulePackageCompilePreviewViewModel {
  packages: RulePackageCompilePreviewEntryViewModel[];
}

export type RulePackageCompileTargetModeViewModel =
  | "reused_selected_draft"
  | "created_new_draft";

export type RulePackageCompilePublishReadinessStatusViewModel =
  | "ready_to_review"
  | "review_before_publish"
  | "blocked";

export interface RulePackageCompilePublishReadinessViewModel {
  status: RulePackageCompilePublishReadinessStatusViewModel;
  reasons: string[];
  blocked_package_count: number;
  override_count: number;
  guarded_rule_count: number;
  inspect_rule_count: number;
}

export interface RulePackageCompileProjectionReadinessViewModel {
  projected_kinds: Array<"rule" | "checklist" | "prompt_snippet">;
  confirmed_semantic_fields: string[];
  withheld_semantic_fields: string[];
  reasons: string[];
}

export interface PreviewCompileRulePackagesInputViewModel {
  source: RulePackageWorkspaceSourceInputViewModel;
  packageDrafts: RulePackageDraftViewModel[];
  templateFamilyId: string;
  journalTemplateId?: string;
  module: TemplateModule;
}

export interface CompileRulePackagesToDraftInputViewModel
  extends PreviewCompileRulePackagesInputViewModel {
  actorRole: AuthRole;
  targetRuleSetId?: string;
}

export interface RulePackageCompileToDraftResultViewModel {
  rule_set_id: string;
  target_mode: RulePackageCompileTargetModeViewModel;
  created_rule_ids: string[];
  replaced_rule_ids: string[];
  skipped_packages: Array<{
    package_id: string;
    reason: string;
  }>;
  publish_readiness: RulePackageCompilePublishReadinessViewModel;
  projection_readiness: RulePackageCompileProjectionReadinessViewModel;
}

export type ExtractionTaskStatusViewModel =
  | "awaiting_confirmation"
  | "partially_confirmed"
  | "completed"
  | "failed";

export type ExtractionCandidateConfirmationStatusViewModel =
  | "ai_semantic_ready"
  | "held"
  | "confirmed"
  | "rejected";

export type ExtractionCandidateSuggestedDestinationViewModel =
  | "template"
  | "general_module"
  | "medical_module";

export interface ExtractionTaskViewModel {
  id: string;
  task_name: string;
  manuscript_type: ManuscriptType;
  original_file_name: string;
  edited_file_name: string;
  journal_key?: string;
  source_session_id: string;
  status: ExtractionTaskStatusViewModel;
  candidate_count: number;
  pending_confirmation_count: number;
  created_at: string;
  updated_at: string;
}

export interface ExtractionTaskCandidateViewModel {
  id: string;
  task_id: string;
  package_id: string;
  package_kind: RulePackageKind;
  title: string;
  confirmation_status: ExtractionCandidateConfirmationStatusViewModel;
  suggested_destination: ExtractionCandidateSuggestedDestinationViewModel;
  candidate_payload: RulePackageCandidateViewModel;
  semantic_draft_payload: AiRuleUnderstandingPayloadViewModel;
  intake_payload?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ExtractionTaskDetailViewModel extends ExtractionTaskViewModel {
  candidates: ExtractionTaskCandidateViewModel[];
}

export interface CreateExtractionTaskInputViewModel {
  taskName: string;
  manuscriptType: ManuscriptType;
  originalFile: InlineUploadFilePayloadViewModel;
  editedFile: InlineUploadFilePayloadViewModel;
  journalKey?: string;
}

export interface UpdateExtractionTaskCandidateInputViewModel {
  confirmationStatus?: ExtractionCandidateConfirmationStatusViewModel;
  suggestedDestination?: ExtractionCandidateSuggestedDestinationViewModel;
  semanticDraftPayload?: AiRuleUnderstandingPayloadViewModel;
  intakePayload?: Record<string, unknown>;
}
