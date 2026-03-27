import type { PromptTemplate, SkillPackage } from "./agent-tooling.js";
import type { KnowledgeItemId } from "./knowledge.js";
import type {
  DocumentAssetId,
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

export type ModuleExecutionProfileId = string;
export type KnowledgeBindingRuleId = string;
export type ModuleExecutionSnapshotId = string;
export type KnowledgeHitLogId = string;
export type HumanFeedbackRecordId = string;
export type LearningCandidateSourceLinkId = string;

export type KnowledgeBindingMode = "profile_only" | "profile_plus_dynamic";
export type ExecutionProfileStatus = "draft" | "active" | "archived";
export type KnowledgeBindingRuleStatus = "draft" | "active" | "archived";
export type KnowledgeHitMatchSource =
  | "binding_rule"
  | "template_binding"
  | "dynamic_routing"
  | "draft_snapshot_reuse";
export type HumanFeedbackType =
  | "manual_confirmation"
  | "manual_correction"
  | "manual_rejection";

export interface ModuleExecutionProfile {
  id: ModuleExecutionProfileId;
  module: ModuleType;
  manuscript_type: ManuscriptType;
  template_family_id: TemplateFamilyId;
  // IDs always point to immutable version records; the explicit version fields
  // preserve human-readable provenance without a second lookup.
  module_template_id: ModuleTemplateId;
  module_template_version_no: number;
  prompt_template_id: PromptTemplate["id"];
  prompt_template_version: PromptTemplate["version"];
  skill_package_ids: SkillPackage["id"][];
  skill_package_versions: SkillPackage["version"][];
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
  module_template_id: ModuleTemplateId;
  module_template_version_no: number;
  prompt_template_id: PromptTemplate["id"];
  prompt_template_version: PromptTemplate["version"];
  skill_package_ids: SkillPackage["id"][];
  skill_package_versions: SkillPackage["version"][];
  model_id: string;
  model_version?: string;
  knowledge_item_ids: KnowledgeItemId[];
  created_asset_ids: DocumentAssetId[];
  draft_snapshot_id?: ModuleExecutionSnapshotId;
  created_at: string;
}

export interface KnowledgeHitLog {
  id: KnowledgeHitLogId;
  snapshot_id: ModuleExecutionSnapshotId;
  knowledge_item_id: KnowledgeItemId;
  match_source_id?: string;
  binding_rule_id?: KnowledgeBindingRuleId;
  match_source: KnowledgeHitMatchSource;
  match_reasons: string[];
  score?: number;
  section?: string;
  created_at: string;
}

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
