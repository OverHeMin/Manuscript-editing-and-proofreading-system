import type {
  AgentExecutionLog,
  AgentExecutionOrchestrationStatus,
  AgentProfile,
  EvaluationRun,
  EvaluationSuite,
  ReleaseCheckProfile,
  RuntimeBinding,
  SandboxProfile,
  ToolPermissionPolicy,
  VerificationCheckProfile,
} from "../src/index.js";

export const sandboxProfileModeCheck: SandboxProfile["sandbox_mode"] =
  "workspace_write";
export const agentProfileRoleCheck: AgentProfile["role_key"] = "gstack";
export const runtimeBindingStatusCheck: RuntimeBinding["status"] = "active";
export const toolPolicyModeCheck: ToolPermissionPolicy["default_mode"] = "read";
export const executionLogStatusCheck: AgentExecutionLog["status"] = "completed";
export const executionOrchestrationStatusCheck: AgentExecutionOrchestrationStatus =
  "retryable";
export const evaluationSuiteTypeCheck: EvaluationSuite["suite_type"] =
  "regression";
export const evaluationRunStatusCheck: EvaluationRun["status"] = "passed";
export const releaseCheckProfileTypeCheck: ReleaseCheckProfile["check_type"] =
  "deploy_verification";
export const verificationProfileTypeCheck: VerificationCheckProfile["check_type"] =
  "browser_qa";
export const executionLogOrchestrationMaxAttemptsCheck: AgentExecutionLog["orchestration_max_attempts"] =
  3;
export const executionLogOrchestrationNextRetryAtCheck: AgentExecutionLog["orchestration_next_retry_at"] =
  "2026-04-05T09:06:00.000Z";
