import type { PromptTemplate, SkillPackage } from "./agent-tooling.js";
import type { KnowledgeItemId } from "./knowledge.js";
import type {
  DocumentAssetId,
  JournalTemplateId,
  ManuscriptId,
  ManuscriptType,
  TemplateFamilyId,
  UserId,
} from "./manuscript.js";
import type { LearningCandidateId } from "./learning.js";
import type {
  ModuleTemplateId,
  ModuleType,
  TemplateKnowledgeBindingPurpose,
} from "./templates.js";
import type { ManuscriptQualityFindingSummary } from "./manuscript-quality.js";
import type { ManuscriptQualityPackageVersionRef } from "./manuscript-quality-packages.js";

export type ModuleExecutionProfileId = string;
export type KnowledgeBindingRuleId = string;
export type ModuleExecutionSnapshotId = string;
export type KnowledgeHitLogId = string;
export type HumanFeedbackRecordId = string;
export type LearningCandidateSourceLinkId = string;
export type ModuleExecutionMode = "governed" | "bare";
export type GovernedExecutionContextObservationStatus = "reported" | "failed_open";
export type GovernedExecutionModuleSummaryStatus =
  | "resolved"
  | "not_configured"
  | "failed_open";
export type JournalTemplateSelectionState = "base_family_only" | "selected";
export type GovernedRuleSourceLayer = "general" | "medical" | "journal";
export type GovernedRuleActivationSourceKind =
  | "template_family_rule_set"
  | "general_package"
  | "medical_package"
  | "journal_template_rule_set";
export type GovernedRuleExecutionPosture = "auto" | "guarded" | "inspect_only";
export type GovernedKnowledgeBindingReason =
  | "binding_rule"
  | "template_family"
  | "module_template"
  | "general_package"
  | "medical_package"
  | "journal_template"
  | "knowledge_item_binding";

export type KnowledgeBindingMode = "profile_only" | "profile_plus_dynamic";
export type ExecutionProfileStatus = "draft" | "active" | "archived";
export type KnowledgeBindingRuleStatus = "draft" | "active" | "archived";
export type KnowledgeHitMatchSource =
  | "binding_rule"
  | "template_binding"
  | "dynamic_routing"
  | "knowledge_item_binding"
  | "draft_snapshot_reuse";
export type HumanFeedbackType =
  | "manual_confirmation"
  | "manual_correction"
  | "manual_rejection";

export interface GovernedRuleEffectiveScope {
  manuscript_types?: ManuscriptType[];
  sections?: string[];
  object_granularity?: string[];
}

export interface GovernedResolvedRuleSummary {
  rule_id: string;
  rule_object: string;
  rule_type: string;
  coverage_key: string;
  source_layer: GovernedRuleSourceLayer;
  activation_source_kind: GovernedRuleActivationSourceKind;
  activation_source_id: string;
  overridden_rule_ids: string[];
  resolution_reason: string;
  execution_posture: GovernedRuleExecutionPosture;
  effective_scope: GovernedRuleEffectiveScope;
  supporting_knowledge_item_ids?: KnowledgeItemId[];
  conflict_kind?: "merge" | "override";
}

export interface GovernedKnowledgeBindingMatchSummary {
  reason: GovernedKnowledgeBindingReason;
  source_id: string;
  priority: number;
}

export interface GovernedKnowledgeSelectionSummary {
  knowledge_item_id: KnowledgeItemId;
  title: string;
  match_source: KnowledgeHitMatchSource;
  match_reasons: string[];
  match_source_id?: string;
  binding_rule_id?: KnowledgeBindingRuleId;
  binding_priority?: number;
  retrieval_score?: number;
  primary_binding?: GovernedKnowledgeBindingMatchSummary;
  binding_matches?: GovernedKnowledgeBindingMatchSummary[];
}

export interface GovernedExecutionModuleSummary {
  module: ModuleType;
  status: GovernedExecutionModuleSummaryStatus;
  execution_profile_id?: ModuleExecutionProfileId;
  module_template_id?: ModuleTemplateId;
  runtime_binding_id?: string;
  model_routing_policy_version_id?: string;
  retrieval_preset_id?: string;
  manual_review_policy_id?: string;
  resolved_model_id?: string;
  model_source?: string;
  provider_readiness_status?: "ok" | "warning";
  runtime_binding_readiness_status?: "ready" | "degraded" | "missing";
  quality_package_ids?: string[];
  resolved_rule_count?: number;
  knowledge_selection_count?: number;
  resolved_rules?: GovernedResolvedRuleSummary[];
  knowledge_selections?: GovernedKnowledgeSelectionSummary[];
  warning_codes?: string[];
  error?: string;
}

export interface GovernedExecutionContextSummary {
  observation_status: GovernedExecutionContextObservationStatus;
  manuscript_type: ManuscriptType;
  base_template_family_id?: TemplateFamilyId;
  journal_template_selection_state: JournalTemplateSelectionState;
  journal_template_id?: JournalTemplateId;
  journal_template_target_model_version_id?: string;
  journal_template_target_model_version_no?: number;
  modules: GovernedExecutionModuleSummary[];
  error?: string;
}

export interface ModuleTemplateVersionRef {
  id: ModuleTemplateId;
  version_no: number;
}

export interface PromptTemplateVersionRef {
  id: PromptTemplate["id"];
  version: PromptTemplate["version"];
}

export interface SkillPackageVersionRef {
  id: SkillPackage["id"];
  version: SkillPackage["version"];
}

export interface ModelVersionRef {
  id: string;
  version?: string;
}

export interface ModuleExecutionProfile {
  id: ModuleExecutionProfileId;
  module: ModuleType;
  manuscript_type: ManuscriptType;
  template_family_id: TemplateFamilyId;
  module_template: ModuleTemplateVersionRef;
  prompt_template: PromptTemplateVersionRef;
  skill_packages: SkillPackageVersionRef[];
  knowledge_binding_mode: KnowledgeBindingMode;
  status: ExecutionProfileStatus;
  version: number;
  notes?: string;
}

export interface KnowledgeBindingRule {
  id: KnowledgeBindingRuleId;
  knowledge_item_id: KnowledgeItemId;
  module: ModuleType;
  manuscript_types: ManuscriptType[] | "any";
  template_family_ids?: TemplateFamilyId[];
  module_template_ids?: ModuleTemplateId[];
  sections?: string[];
  risk_tags?: string[];
  priority?: number;
  binding_purpose: TemplateKnowledgeBindingPurpose;
  status: KnowledgeBindingRuleStatus;
}

export interface ModuleExecutionSnapshot {
  id: ModuleExecutionSnapshotId;
  manuscript_id: ManuscriptId;
  module: ModuleType;
  job_id: string;
  execution_profile_id: ModuleExecutionProfileId;
  module_template: ModuleTemplateVersionRef;
  prompt_template: PromptTemplateVersionRef;
  skill_packages: SkillPackageVersionRef[];
  model: ModelVersionRef;
  quality_packages?: ManuscriptQualityPackageVersionRef[];
  knowledge_item_ids: KnowledgeItemId[];
  created_asset_ids: DocumentAssetId[];
  draft_snapshot_id?: ModuleExecutionSnapshotId;
  quality_findings_summary?: ManuscriptQualityFindingSummary;
  created_at: string;
}

export type KnowledgeHitSourceRef =
  | {
      type: "binding_rule";
      id: KnowledgeBindingRuleId;
    }
  | {
      type: "template_binding";
      id: string;
    }
  | {
      type: "dynamic_routing";
      id?: string;
    }
  | {
      type: "knowledge_item_binding";
      id: KnowledgeItemId;
    }
  | {
      type: "draft_snapshot_reuse";
      id: ModuleExecutionSnapshotId;
    };

interface KnowledgeHitLogBase {
  id: KnowledgeHitLogId;
  snapshot_id: ModuleExecutionSnapshotId;
  knowledge_item_id: KnowledgeItemId;
  match_reasons: string[];
  score?: number;
  section?: string;
  created_at: string;
}

export type KnowledgeHitLog =
  | (KnowledgeHitLogBase & {
      match_source: "binding_rule";
      source: Extract<KnowledgeHitSourceRef, { type: "binding_rule" }>;
    })
  | (KnowledgeHitLogBase & {
      match_source: "template_binding";
      source: Extract<KnowledgeHitSourceRef, { type: "template_binding" }>;
    })
  | (KnowledgeHitLogBase & {
      match_source: "dynamic_routing";
      source: Extract<KnowledgeHitSourceRef, { type: "dynamic_routing" }>;
    })
  | (KnowledgeHitLogBase & {
      match_source: "knowledge_item_binding";
      source: Extract<KnowledgeHitSourceRef, { type: "knowledge_item_binding" }>;
    })
  | (KnowledgeHitLogBase & {
      match_source: "draft_snapshot_reuse";
      source: Extract<KnowledgeHitSourceRef, { type: "draft_snapshot_reuse" }>;
    });

export interface HumanFeedbackRecord {
  id: HumanFeedbackRecordId;
  manuscript_id: ManuscriptId;
  module: ModuleType;
  snapshot_id: ModuleExecutionSnapshotId;
  feedback_type: HumanFeedbackType;
  feedback_text?: string;
  created_by: UserId;
  created_at: string;
}

export interface LearningCandidateSourceLink {
  id: LearningCandidateSourceLinkId;
  learning_candidate_id: LearningCandidateId;
  snapshot_id: ModuleExecutionSnapshotId;
  feedback_record_id: HumanFeedbackRecordId;
  source_asset_id: DocumentAssetId;
  created_at: string;
}
