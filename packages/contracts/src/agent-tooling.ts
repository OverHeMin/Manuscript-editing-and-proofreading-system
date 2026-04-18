import type { ManuscriptModule } from "./assets.js";
import type {
  DocumentAssetId,
  ManuscriptId,
  ManuscriptType,
  TemplateFamilyId,
  UserId,
} from "./manuscript.js";
import type { LearningCandidateId } from "./learning.js";
import type { ModuleType } from "./templates.js";

export type AgentRuntimeAdapter = "internal_prompt" | "deepagents";
export type AgentRuntimeStatus = "draft" | "active" | "archived";
export type ToolGatewayAccessMode = "read" | "write";
export type ToolGatewayScope =
  | "manuscripts"
  | "assets"
  | "knowledge"
  | "templates"
  | "audit"
  | "agent_runtime"
  | "prompt_skill";
export type SkillPackageScope = "admin_only";
export type RegistryAssetStatus = "draft" | "published" | "archived";
export type PromptTemplateStatus = RegistryAssetStatus;
export type SkillPackageStatus = RegistryAssetStatus;
export type SandboxProfileStatus = "draft" | "active" | "archived";
export type SandboxMode = "read_only" | "workspace_write" | "full_access";
export type AgentRoleKey = "superpowers" | "gstack" | "subagent";
export type RuntimeBindingStatus = "draft" | "active" | "archived";
export type ToolPermissionPolicyStatus = "draft" | "active" | "archived";
export type AgentExecutionStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";
export type AgentExecutionOrchestrationStatus =
  | "not_required"
  | "pending"
  | "running"
  | "retryable"
  | "completed"
  | "failed";
export type VerificationCheckType =
  | "browser_qa"
  | "benchmark"
  | "deploy_verification"
  | "retrieval_quality"
  | "residual_issue_validation";
export type VerificationEvidenceKind = "url" | "artifact";
export type EvaluationSuiteStatus = "draft" | "active" | "archived";
export type EvaluationSuiteType = "regression" | "release_gate";
export type EvaluationRunStatus = "queued" | "running" | "passed" | "failed";

export type AgentRuntimeId = string;
export type SandboxProfileId = string;
export type AgentProfileId = string;
export type RuntimeBindingId = string;
export type ToolPermissionPolicyId = string;
export type AgentExecutionLogId = string;
export type VerificationCheckProfileId = string;
export type ReleaseCheckProfileId = string;
export type EvaluationSuiteId = string;
export type EvaluationRunId = string;
export type VerificationEvidenceId = string;

export interface AgentRuntime {
  id: AgentRuntimeId;
  name: string;
  adapter: AgentRuntimeAdapter;
  status: AgentRuntimeStatus;
  sandbox_profile_id?: SandboxProfileId;
  allowed_modules: ManuscriptModule[];
  version?: number;
  runtime_slot?: string;
  admin_only: true;
  created_at?: string;
  updated_at?: string;
}

export interface ToolGatewayTool {
  id: string;
  name: string;
  description?: string;
  scope: ToolGatewayScope;
  access_mode: ToolGatewayAccessMode;
  admin_only: true;
  created_at?: string;
  updated_at?: string;
}

export interface SandboxProfile {
  id: SandboxProfileId;
  name: string;
  status: SandboxProfileStatus;
  sandbox_mode: SandboxMode;
  network_access: boolean;
  approval_required: boolean;
  allowed_tool_ids?: ToolGatewayTool["id"][];
  admin_only: true;
}

export interface AgentProfile {
  id: AgentProfileId;
  name: string;
  role_key: AgentRoleKey;
  status: RegistryAssetStatus;
  module_scope: ManuscriptModule[] | "any";
  manuscript_types: ManuscriptType[] | "any";
  description?: string;
  admin_only: true;
}

export interface PromptTemplate {
  id: string;
  name: string;
  version: string;
  template: string;
  module: ManuscriptModule;
  manuscript_types: ManuscriptType[] | "any";
  status: PromptTemplateStatus;
  rollback_version?: string;
  rollback_target_version?: string;
  source_learning_candidate_id?: LearningCandidateId;
  created_at?: string;
  updated_at?: string;
}

export interface SkillPackage {
  id: string;
  name: string;
  version: string;
  description?: string;
  applies_to_modules: ManuscriptModule[];
  scope: SkillPackageScope;
  status: SkillPackageStatus;
  dependency_tools?: string[];
  admin_only: true;
  source_learning_candidate_id?: LearningCandidateId;
  created_at?: string;
  updated_at?: string;
}

export interface ToolPermissionPolicy {
  id: ToolPermissionPolicyId;
  name: string;
  status: ToolPermissionPolicyStatus;
  default_mode: ToolGatewayAccessMode;
  allowed_tool_ids: ToolGatewayTool["id"][];
  high_risk_tool_ids?: ToolGatewayTool["id"][];
  write_requires_confirmation: boolean;
  admin_only: true;
}

export interface RuntimeBinding {
  id: RuntimeBindingId;
  module: ModuleType;
  manuscript_type: ManuscriptType;
  template_family_id: TemplateFamilyId;
  runtime_id: AgentRuntimeId;
  sandbox_profile_id: SandboxProfileId;
  agent_profile_id: AgentProfileId;
  tool_permission_policy_id: ToolPermissionPolicyId;
  prompt_template_id: PromptTemplate["id"];
  skill_package_ids: SkillPackage["id"][];
  execution_profile_id?: string;
  status: RuntimeBindingStatus;
  version: number;
}

export interface VerificationCheckProfile {
  id: VerificationCheckProfileId;
  name: string;
  check_type: VerificationCheckType;
  status: RegistryAssetStatus;
  tool_ids?: ToolGatewayTool["id"][];
  admin_only: true;
}

export interface ReleaseCheckProfile {
  id: ReleaseCheckProfileId;
  name: string;
  check_type: VerificationCheckType;
  status: RegistryAssetStatus;
  verification_check_profile_ids: VerificationCheckProfileId[];
  admin_only: true;
}

export interface EvaluationSuite {
  id: EvaluationSuiteId;
  name: string;
  suite_type: EvaluationSuiteType;
  status: EvaluationSuiteStatus;
  verification_check_profile_ids: VerificationCheckProfileId[];
  module_scope: ManuscriptModule[] | "any";
  admin_only: true;
}

export interface VerificationEvidence {
  id: VerificationEvidenceId;
  kind: VerificationEvidenceKind;
  label: string;
  uri?: string;
  artifact_asset_id?: DocumentAssetId;
  check_profile_id?: VerificationCheckProfileId;
  created_at: string;
}

export interface EvaluationRun {
  id: EvaluationRunId;
  suite_id: EvaluationSuiteId;
  release_check_profile_id?: ReleaseCheckProfileId;
  status: EvaluationRunStatus;
  evidence_ids: VerificationEvidenceId[];
  started_at: string;
  finished_at?: string;
}

export interface AgentExecutionLog {
  id: AgentExecutionLogId;
  manuscript_id: ManuscriptId;
  module: ModuleType;
  triggered_by: UserId;
  runtime_id: AgentRuntimeId;
  sandbox_profile_id: SandboxProfileId;
  agent_profile_id: AgentProfileId;
  runtime_binding_id: RuntimeBindingId;
  tool_permission_policy_id: ToolPermissionPolicyId;
  execution_snapshot_id?: string;
  knowledge_item_ids: string[];
  verification_evidence_ids: VerificationEvidenceId[];
  status: AgentExecutionStatus;
  orchestration_status: AgentExecutionOrchestrationStatus;
  orchestration_attempt_count: number;
  orchestration_max_attempts: number;
  orchestration_last_error?: string;
  orchestration_last_attempt_started_at?: string;
  orchestration_last_attempt_finished_at?: string;
  orchestration_next_retry_at?: string;
  started_at: string;
  finished_at?: string;
}
