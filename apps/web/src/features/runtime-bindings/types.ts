import type { AuthRole } from "../auth/roles.ts";
import type { ManuscriptType } from "../manuscripts/types.ts";
import type { TemplateModule } from "../templates/types.ts";

export type RuntimeBindingStatus = "draft" | "active" | "archived";

export interface RuntimeBindingViewModel {
  id: string;
  module: TemplateModule;
  manuscript_type: ManuscriptType;
  template_family_id: string;
  runtime_id: string;
  sandbox_profile_id: string;
  agent_profile_id: string;
  tool_permission_policy_id: string;
  prompt_template_id: string;
  skill_package_ids: string[];
  execution_profile_id?: string;
  verification_check_profile_ids: string[];
  evaluation_suite_ids: string[];
  release_check_profile_id?: string;
  status: RuntimeBindingStatus;
  version: number;
}

export interface CreateRuntimeBindingInput {
  actorRole: AuthRole;
  module: TemplateModule;
  manuscriptType: ManuscriptType;
  templateFamilyId: string;
  runtimeId: string;
  sandboxProfileId: string;
  agentProfileId: string;
  toolPermissionPolicyId: string;
  promptTemplateId: string;
  skillPackageIds: string[];
  executionProfileId?: string;
  verificationCheckProfileIds?: string[];
  evaluationSuiteIds?: string[];
  releaseCheckProfileId?: string;
}

export interface ActivateRuntimeBindingInput {
  actorRole: AuthRole;
}

export interface ArchiveRuntimeBindingInput {
  actorRole: AuthRole;
}

export interface ListRuntimeBindingsForScopeInput {
  module: TemplateModule;
  manuscriptType: ManuscriptType;
  templateFamilyId: string;
  activeOnly?: boolean;
}
