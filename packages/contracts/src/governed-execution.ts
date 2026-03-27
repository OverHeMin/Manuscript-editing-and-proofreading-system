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
  knowledge_item_ids: KnowledgeItemId[];
  created_asset_ids: DocumentAssetId[];
  draft_snapshot_id?: ModuleExecutionSnapshotId;
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
