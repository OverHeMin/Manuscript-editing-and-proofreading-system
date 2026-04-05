import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { TemplateModule } from "../templates/template-record.ts";
import type { RuntimeBindingRecord } from "./runtime-binding-record.ts";

export type RuntimeBindingReadinessStatus = "ready" | "degraded" | "missing";

export type RuntimeBindingReadinessIssueCode =
  | "missing_active_binding"
  | "runtime_missing"
  | "runtime_not_active"
  | "runtime_module_incompatible"
  | "sandbox_missing"
  | "sandbox_not_active"
  | "runtime_sandbox_mismatch"
  | "agent_profile_missing"
  | "agent_profile_not_published"
  | "agent_profile_scope_mismatch"
  | "tool_permission_policy_missing"
  | "tool_permission_policy_not_active"
  | "prompt_template_missing"
  | "prompt_template_not_published"
  | "prompt_template_scope_mismatch"
  | "skill_package_missing"
  | "skill_package_not_published"
  | "skill_package_scope_mismatch"
  | "verification_check_profile_missing"
  | "verification_check_profile_not_published"
  | "evaluation_suite_missing"
  | "evaluation_suite_not_active"
  | "evaluation_suite_scope_mismatch"
  | "release_check_profile_missing"
  | "release_check_profile_not_published"
  | "active_execution_profile_missing"
  | "execution_profile_missing"
  | "execution_profile_not_active"
  | "execution_profile_scope_mismatch"
  | "binding_execution_profile_drift"
  | "binding_prompt_drift"
  | "binding_skill_package_drift";

export interface RuntimeBindingReadinessIssue {
  code: RuntimeBindingReadinessIssueCode;
  message: string;
}

export interface RuntimeBindingReadinessScope {
  module: TemplateModule;
  manuscriptType: ManuscriptType;
  templateFamilyId: string;
}

export interface RuntimeBindingExecutionProfileAlignment {
  status: "aligned" | "drifted" | "missing_active_profile";
  binding_execution_profile_id?: string;
  active_execution_profile_id?: string;
}

export interface RuntimeBindingReadinessReport {
  status: RuntimeBindingReadinessStatus;
  scope: RuntimeBindingReadinessScope;
  binding?: Pick<
    RuntimeBindingRecord,
    | "id"
    | "status"
    | "version"
    | "runtime_id"
    | "sandbox_profile_id"
    | "agent_profile_id"
    | "tool_permission_policy_id"
    | "prompt_template_id"
    | "skill_package_ids"
    | "execution_profile_id"
    | "verification_check_profile_ids"
    | "evaluation_suite_ids"
    | "release_check_profile_id"
  >;
  issues: RuntimeBindingReadinessIssue[];
  execution_profile_alignment: RuntimeBindingExecutionProfileAlignment;
}
