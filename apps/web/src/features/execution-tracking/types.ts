import type { TemplateModule } from "../templates/types.ts";

export type KnowledgeHitMatchSource =
  | "binding_rule"
  | "template_binding"
  | "dynamic_routing"
  | "draft_snapshot_reuse";

export interface ModuleExecutionSnapshotViewModel {
  id: string;
  manuscript_id: string;
  module: TemplateModule;
  job_id: string;
  execution_profile_id: string;
  module_template_id: string;
  module_template_version_no: number;
  prompt_template_id: string;
  prompt_template_version: string;
  skill_package_ids: string[];
  skill_package_versions: string[];
  model_id: string;
  model_version?: string;
  knowledge_item_ids: string[];
  created_asset_ids: string[];
  draft_snapshot_id?: string;
  created_at: string;
}

export interface KnowledgeHitLogViewModel {
  id: string;
  snapshot_id: string;
  knowledge_item_id: string;
  match_source_id?: string;
  binding_rule_id?: string;
  match_source: KnowledgeHitMatchSource;
  match_reasons: string[];
  score?: number;
  section?: string;
  created_at: string;
}

export interface RecordKnowledgeHitInput {
  knowledgeItemId: string;
  matchSourceId?: string;
  bindingRuleId?: string;
  matchSource: KnowledgeHitMatchSource;
  matchReasons: string[];
  score?: number;
  section?: string;
}

export interface RecordExecutionSnapshotInput {
  manuscriptId: string;
  module: TemplateModule;
  jobId: string;
  executionProfileId: string;
  moduleTemplateId: string;
  moduleTemplateVersionNo: number;
  promptTemplateId: string;
  promptTemplateVersion: string;
  skillPackageIds: string[];
  skillPackageVersions: string[];
  modelId: string;
  modelVersion?: string;
  createdAssetIds?: string[];
  draftSnapshotId?: string;
  knowledgeHits: RecordKnowledgeHitInput[];
}
