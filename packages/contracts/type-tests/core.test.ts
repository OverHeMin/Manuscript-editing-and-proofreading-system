import type {
  DocumentAsset,
  DocumentAssetStatus,
  DocumentAssetType,
  DocumentAssetId,
  EvidenceLevel,
  KnowledgeItemRouting,
  KnowledgeKind,
  KnowledgeItem,
  KnowledgeItemStatus,
  KnowledgeSourceType,
  ManuscriptModule,
  LearningCandidateStatus,
  LearningCandidateType,
  LearningCandidate,
  LearningRun,
  Manuscript,
  ManuscriptId,
  ManuscriptStatus,
  ManuscriptType,
  ModelCostProfile,
  ModelProvider,
  ModelRegistryId,
  ModelRegistryEntry,
  ModelRateLimit,
  ModelRouteRequest,
  ResolvedModel,
  ModelSelectionLayer,
  ModuleTemplateId,
  ModuleType,
  ModuleTemplateStatus,
  ModuleTemplate,
  TemplateKnowledgeBinding,
  TemplateFamily,
  TemplateKnowledgeBindingPurpose,
  TemplateFamilyId,
  TemplateFamilyStatus,
  ResidualConfidenceBand,
  ResidualHarnessValidationStatus,
  ResidualIssue,
  ResidualIssueRoute,
  UserId,
} from "../src/index.js";

type IsEqual<A, B> = (<T>() => T extends A ? 1 : 2) extends <
  T
>() => T extends B ? 1 : 2
  ? true
  : false;
type Assert<T extends true> = T;
type IsAssignable<A, B> = A extends B ? true : false;
type IsAny<T> = 0 extends 1 & T ? true : false;
type NotAny<T> = IsAny<T> extends true ? false : true;
type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;

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

type ExpectedManuscript = {
  id: ManuscriptId;
  title: string;
  manuscript_type: ManuscriptType;
  status: ManuscriptStatus;
  created_by: UserId;
  current_screening_asset_id?: DocumentAssetId;
  current_editing_asset_id?: DocumentAssetId;
  current_proofreading_asset_id?: DocumentAssetId;
  current_template_family_id?: TemplateFamilyId;
};

type _ManuscriptNotAny = Assert<NotAny<Manuscript>>;
type _ManuscriptHasId = Assert<HasKey<Manuscript, "id">>;
type _ManuscriptHasStatus = Assert<HasKey<Manuscript, "status">>;
type _ManuscriptShapeForward = Assert<IsAssignable<Manuscript, ExpectedManuscript>>;
type _ManuscriptShapeBackward = Assert<
  IsAssignable<ExpectedManuscript, Manuscript>
>;
type _ManuscriptStatusNotAny = Assert<NotAny<Manuscript["status"]>>;
type _ManuscriptTypeNotAny = Assert<NotAny<Manuscript["manuscript_type"]>>;

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
    | "final_proof_issue_report"
    | "final_proof_annotated_docx"
    | "pdf_consistency_report"
    | "human_final_docx"
    | "learning_snapshot_attachment"
  >
>;

type ExpectedDocumentAsset = {
  id: DocumentAssetId;
  manuscript_id: ManuscriptId;
  asset_type: DocumentAssetType;
  status: DocumentAssetStatus;
  storage_key: string;
  mime_type: string;
  parent_asset_id?: DocumentAssetId;
  source_module: ManuscriptModule;
  source_job_id?: string;
  created_by: UserId;
  version_no: number;
  is_current: boolean;
};

type _DocumentAssetNotAny = Assert<NotAny<DocumentAsset>>;
type _DocumentAssetHasStorageKey = Assert<HasKey<DocumentAsset, "storage_key">>;
type _DocumentAssetShapeForward = Assert<
  IsAssignable<DocumentAsset, ExpectedDocumentAsset>
>;
type _DocumentAssetShapeBackward = Assert<
  IsAssignable<ExpectedDocumentAsset, DocumentAsset>
>;
type _DocumentAssetTypeNotAny = Assert<NotAny<DocumentAsset["asset_type"]>>;
type _DocumentAssetStatusNotAny = Assert<NotAny<DocumentAsset["status"]>>;

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

type ExpectedKnowledgeItem = {
  id: string;
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
  template_bindings?: string[];
};

type _KnowledgeItemNotAny = Assert<NotAny<KnowledgeItem>>;
type _KnowledgeItemHasRouting = Assert<HasKey<KnowledgeItem, "routing">>;
type _KnowledgeItemShapeForward = Assert<
  IsAssignable<KnowledgeItem, ExpectedKnowledgeItem>
>;
type _KnowledgeItemShapeBackward = Assert<
  IsAssignable<ExpectedKnowledgeItem, KnowledgeItem>
>;
type _KnowledgeKindNotAny = Assert<NotAny<KnowledgeItem["knowledge_kind"]>>;
type _KnowledgeStatusNotAny = Assert<NotAny<KnowledgeItem["status"]>>;
type _KnowledgeRoutingManuscriptTypes = Assert<
  IsEqual<KnowledgeItemRouting["manuscript_types"], ManuscriptType[] | "any">
>;

// Learning
type _LearningCandidateType = Assert<
  IsEqual<
    LearningCandidateType,
    | "rule_candidate"
    | "knowledge_candidate"
    | "case_pattern_candidate"
    | "template_update_candidate"
    | "prompt_optimization_candidate"
    | "checklist_update_candidate"
    | "skill_update_candidate"
  >
>;

type _LearningCandidateStatus = Assert<
  IsEqual<
    LearningCandidateStatus,
    "draft" | "pending_review" | "approved" | "rejected" | "archived"
  >
>;

type ExpectedLearningCandidate = {
  id: string;
  type: LearningCandidateType;
  status: LearningCandidateStatus;
  module: ManuscriptModule;
  manuscript_type: ManuscriptType;
  human_final_asset_id?: DocumentAssetId;
  annotated_asset_id?: DocumentAssetId;
  snapshot_asset_id?: DocumentAssetId;
  title?: string;
  proposal_text?: string;
  created_at?: string;
};

type _LearningCandidateNotAny = Assert<NotAny<LearningCandidate>>;
type _LearningCandidateHasType = Assert<HasKey<LearningCandidate, "type">>;
type _LearningCandidateShapeForward = Assert<
  IsAssignable<LearningCandidate, ExpectedLearningCandidate>
>;
type _LearningCandidateShapeBackward = Assert<
  IsAssignable<ExpectedLearningCandidate, LearningCandidate>
>;
type _LearningCandidateTypeNotAny = Assert<NotAny<LearningCandidate["type"]>>;
type _LearningCandidateStatusNotAny = Assert<NotAny<LearningCandidate["status"]>>;

type ExpectedLearningRun = {
  id: string;
  started_at: string;
  finished_at?: string;
};

type _LearningRunNotAny = Assert<NotAny<LearningRun>>;
type _LearningRunShapeForward = Assert<IsAssignable<LearningRun, ExpectedLearningRun>>;
type _LearningRunShapeBackward = Assert<IsAssignable<ExpectedLearningRun, LearningRun>>;

// Residual learning
type _ResidualConfidenceBand = Assert<
  IsEqual<
    ResidualConfidenceBand,
    | "L0_observation"
    | "L1_review_pending"
    | "L2_candidate_ready"
    | "L3_strongly_reusable"
  >
>;

type _ResidualIssueRoute = Assert<
  IsEqual<
    ResidualIssueRoute,
    | "rule_candidate"
    | "knowledge_candidate"
    | "prompt_template_candidate"
    | "manual_only"
    | "evidence_only"
  >
>;

type _ResidualHarnessValidationStatus = Assert<
  IsEqual<
    ResidualHarnessValidationStatus,
    "not_required" | "queued" | "passed" | "failed"
  >
>;

type ExpectedResidualIssue = {
  id: string;
  module: "proofreading" | "editing" | "screening";
  manuscript_id: ManuscriptId;
  execution_snapshot_id: string;
  issue_type: string;
  novelty_key: string;
  system_confidence_band: ResidualConfidenceBand;
  recommended_route: ResidualIssueRoute;
  harness_validation_status: ResidualHarnessValidationStatus;
};

type _ResidualIssueNotAny = Assert<NotAny<ResidualIssue>>;
type _ResidualIssueHasRoute = Assert<HasKey<ResidualIssue, "recommended_route">>;
type _ResidualIssueShapeForward = Assert<
  IsAssignable<ResidualIssue, ExpectedResidualIssue>
>;
type _ResidualIssueShapeBackward = Assert<
  IsAssignable<ExpectedResidualIssue, ResidualIssue>
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

type ExpectedTemplateFamily = {
  id: TemplateFamilyId;
  manuscript_type: ManuscriptType;
  name: string;
  status: TemplateFamilyStatus;
};

type _TemplateFamilyNotAny = Assert<NotAny<TemplateFamily>>;
type _TemplateFamilyShapeForward = Assert<
  IsAssignable<TemplateFamily, ExpectedTemplateFamily>
>;
type _TemplateFamilyShapeBackward = Assert<
  IsAssignable<ExpectedTemplateFamily, TemplateFamily>
>;
type _TemplateFamilyStatusNotAny = Assert<NotAny<TemplateFamily["status"]>>;

type ExpectedModuleTemplate = {
  id: ModuleTemplateId;
  template_family_id: TemplateFamilyId;
  module: ModuleType;
  manuscript_type: ManuscriptType;
  version_no: number;
  status: ModuleTemplateStatus;
  prompt: string;
  checklist?: string[];
  section_requirements?: string[];
};

type _ModuleTemplateNotAny = Assert<NotAny<ModuleTemplate>>;
type _ModuleTemplateHasPrompt = Assert<HasKey<ModuleTemplate, "prompt">>;
type _ModuleTemplateShapeForward = Assert<
  IsAssignable<ModuleTemplate, ExpectedModuleTemplate>
>;
type _ModuleTemplateShapeBackward = Assert<
  IsAssignable<ExpectedModuleTemplate, ModuleTemplate>
>;
type _ModuleTemplateStatusNotAny = Assert<NotAny<ModuleTemplate["status"]>>;

type ExpectedTemplateKnowledgeBinding = {
  id: string;
  template_family_id: TemplateFamilyId;
  module_template_id?: ModuleTemplateId;
  section_key?: string;
  knowledge_item_id: string;
  purpose: TemplateKnowledgeBindingPurpose;
  created_at?: string;
};

type _TemplateKnowledgeBindingNotAny = Assert<NotAny<TemplateKnowledgeBinding>>;
type _TemplateKnowledgeBindingShapeForward = Assert<
  IsAssignable<TemplateKnowledgeBinding, ExpectedTemplateKnowledgeBinding>
>;
type _TemplateKnowledgeBindingShapeBackward = Assert<
  IsAssignable<ExpectedTemplateKnowledgeBinding, TemplateKnowledgeBinding>
>;

// Model routing (explicit assertions)
type ExpectedModelRegistryEntry = {
  id: ModelRegistryId;
  provider: ModelProvider;
  model_name: string;
  model_version?: string;
  allowed_modules: ModuleType[];
  is_prod_allowed: boolean;
  cost_profile?: ModelCostProfile;
  rate_limit?: ModelRateLimit;
  fallback_model_id?: ModelRegistryId;
};

type _ModelRegistryEntryNotAny = Assert<NotAny<ModelRegistryEntry>>;
type _ModelRegistryEntryHasProvider = Assert<HasKey<ModelRegistryEntry, "provider">>;
type _ModelRegistryEntryShapeForward = Assert<
  IsAssignable<ModelRegistryEntry, ExpectedModelRegistryEntry>
>;
type _ModelRegistryEntryShapeBackward = Assert<
  IsAssignable<ExpectedModelRegistryEntry, ModelRegistryEntry>
>;
type _ModelRegistryProviderNotAny = Assert<NotAny<ModelRegistryEntry["provider"]>>;
type _ModelRegistryAllowedModulesNotAny = Assert<NotAny<
  ModelRegistryEntry["allowed_modules"]
>>;

type ExpectedModelRouteRequest = {
  module: ModuleType;
  module_template_id?: ModuleTemplateId;
  task_override_model_id?: ModelRegistryId;
  task_override_allow_list?: ModelRegistryId[];
};

type _ModelRouteRequestNotAny = Assert<NotAny<ModelRouteRequest>>;
type _ModelRouteRequestHasModule = Assert<HasKey<ModelRouteRequest, "module">>;
type _ModelRouteRequestShapeForward = Assert<
  IsAssignable<ModelRouteRequest, ExpectedModelRouteRequest>
>;
type _ModelRouteRequestShapeBackward = Assert<
  IsAssignable<ExpectedModelRouteRequest, ModelRouteRequest>
>;
type _ModelRouteModuleNotAny = Assert<NotAny<ModelRouteRequest["module"]>>;

type ExpectedResolvedModel = {
  layer: ModelSelectionLayer;
  model: ModelRegistryEntry;
  fallback?: ModelRegistryEntry;
};

type _ResolvedModelNotAny = Assert<NotAny<ResolvedModel>>;
type _ResolvedModelShapeForward = Assert<IsAssignable<ResolvedModel, ExpectedResolvedModel>>;
type _ResolvedModelShapeBackward = Assert<IsAssignable<ExpectedResolvedModel, ResolvedModel>>;
