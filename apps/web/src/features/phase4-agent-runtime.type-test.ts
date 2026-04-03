import {
  archiveAgentRuntime,
  createAgentRuntime,
  getAgentRuntime,
  listAgentRuntimes,
  listAgentRuntimesByModule,
  publishAgentRuntime,
  type AgentRuntimeStatus,
  type AgentRuntimeViewModel,
  type CreateAgentRuntimeInput,
  type PublishAgentRuntimeInput,
} from "./agent-runtime/index.ts";
import {
  createToolGatewayTool,
  getToolGatewayTool,
  listToolGatewayTools,
  listToolGatewayToolsByScope,
  updateToolGatewayTool,
  type CreateToolGatewayToolInput,
  type ToolGatewayScope,
  type ToolGatewayToolViewModel,
  type UpdateToolGatewayToolInput,
} from "./tool-gateway/index.ts";
import {
  activateSandboxProfile,
  createSandboxProfile,
  listSandboxProfiles,
  type CreateSandboxProfileInput,
  type SandboxMode,
  type SandboxProfileViewModel,
} from "./sandbox-profiles/index.ts";
import {
  createAgentProfile,
  listAgentProfiles,
  publishAgentProfile,
  type AgentProfileRoleKey,
  type AgentProfileViewModel,
  type CreateAgentProfileInput,
} from "./agent-profiles/index.ts";
import {
  activateRuntimeBinding,
  createRuntimeBinding,
  listRuntimeBindings,
  type CreateRuntimeBindingInput,
  type RuntimeBindingStatus,
  type RuntimeBindingViewModel,
} from "./runtime-bindings/index.ts";
import {
  activateToolPermissionPolicy,
  createToolPermissionPolicy,
  listToolPermissionPolicies,
  type CreateToolPermissionPolicyInput,
  type ToolPermissionPolicyStatus,
  type ToolPermissionPolicyViewModel,
} from "./tool-permission-policies/index.ts";
import {
  completeAgentExecutionLog,
  createAgentExecutionLog,
  getAgentExecutionLog,
  listAgentExecutionLogs,
  type AgentExecutionLogViewModel,
  type AgentExecutionStatus,
  type CompleteAgentExecutionLogInput,
  type CreateAgentExecutionLogInput,
} from "./agent-execution/index.ts";
import {
  activateEvaluationSuite,
  completeEvaluationRun,
  createEvaluationRun,
  createEvaluationSuite,
  createReleaseCheckProfile,
  createVerificationCheckProfile,
  listEvaluationSuites,
  listVerificationCheckProfiles,
  publishReleaseCheckProfile,
  publishVerificationCheckProfile,
  recordVerificationEvidence,
  type CreateEvaluationRunInput,
  type CreateEvaluationSuiteInput,
  type CreateReleaseCheckProfileInput,
  type CreateVerificationCheckProfileInput,
  type EvaluationRunStatus,
  type EvaluationRunViewModel,
  type EvaluationSuiteType,
  type EvaluationSuiteViewModel,
  type ReleaseCheckProfileViewModel,
  type VerificationCheckProfileViewModel,
  type VerificationEvidenceKind,
  type VerificationEvidenceViewModel,
} from "./verification-ops/index.ts";

const runtimeStatusCheck: AgentRuntimeStatus = "active";
const runtimeViewModelCheck: AgentRuntimeViewModel = {
  id: "runtime-1",
  name: "Deep Agents Runtime",
  adapter: "deepagents",
  status: runtimeStatusCheck,
  sandbox_profile_id: "sandbox-1",
  allowed_modules: ["editing"],
  version: 2,
  runtime_slot: "editing",
  admin_only: true,
};

const runtimeInputCheck: CreateAgentRuntimeInput = {
  actorRole: "admin",
  name: "Editing Runtime",
  adapter: "deepagents",
  sandboxProfileId: "sandbox-1",
  allowedModules: ["editing"],
  runtimeSlot: "editing",
};
const publishRuntimeInputCheck: PublishAgentRuntimeInput = {
  actorRole: "admin",
};

const toolScopeCheck: ToolGatewayScope = "benchmark";
const toolViewModelCheck: ToolGatewayToolViewModel = {
  id: "tool-1",
  name: "gstack.benchmark",
  scope: toolScopeCheck,
  access_mode: "read",
  admin_only: true,
};
const toolInputCheck: CreateToolGatewayToolInput = {
  actorRole: "admin",
  name: "gstack.browser.qa",
  scope: "browser_qa",
};
const toolUpdateCheck: UpdateToolGatewayToolInput = {
  actorRole: "admin",
  scope: "deploy_verification",
  accessMode: "write",
};

const sandboxModeCheck: SandboxMode = "workspace_write";
const sandboxViewModelCheck: SandboxProfileViewModel = {
  id: "sandbox-1",
  name: "Editing Sandbox",
  status: "active",
  sandbox_mode: sandboxModeCheck,
  network_access: false,
  approval_required: true,
  allowed_tool_ids: ["tool-1"],
  admin_only: true,
};
const sandboxInputCheck: CreateSandboxProfileInput = {
  actorRole: "admin",
  name: "Editing Sandbox",
  sandboxMode: sandboxModeCheck,
  networkAccess: false,
  approvalRequired: true,
  allowedToolIds: ["tool-1"],
};

const agentProfileRoleCheck: AgentProfileRoleKey = "subagent";
const agentProfileViewModelCheck: AgentProfileViewModel = {
  id: "agent-profile-1",
  name: "Editing Executor",
  role_key: agentProfileRoleCheck,
  status: "published",
  module_scope: ["editing"],
  manuscript_types: ["clinical_study"],
  admin_only: true,
};
const agentProfileInputCheck: CreateAgentProfileInput = {
  actorRole: "admin",
  name: "Editing Executor",
  roleKey: "subagent",
  moduleScope: ["editing"],
  manuscriptTypes: ["clinical_study"],
};

const runtimeBindingStatusCheck: RuntimeBindingStatus = "active";
const runtimeBindingViewModelCheck: RuntimeBindingViewModel = {
  id: "binding-1",
  module: "editing",
  manuscript_type: "clinical_study",
  template_family_id: "family-1",
  runtime_id: "runtime-1",
  sandbox_profile_id: "sandbox-1",
  agent_profile_id: "agent-profile-1",
  tool_permission_policy_id: "policy-1",
  prompt_template_id: "prompt-1",
  skill_package_ids: ["skill-1"],
  execution_profile_id: "profile-1",
  verification_check_profile_ids: ["check-profile-1"],
  evaluation_suite_ids: ["evaluation-suite-1"],
  release_check_profile_id: "release-profile-1",
  status: runtimeBindingStatusCheck,
  version: 2,
};
const runtimeBindingInputCheck: CreateRuntimeBindingInput = {
  actorRole: "admin",
  module: "editing",
  manuscriptType: "clinical_study",
  templateFamilyId: "family-1",
  runtimeId: "runtime-1",
  sandboxProfileId: "sandbox-1",
  agentProfileId: "agent-profile-1",
  toolPermissionPolicyId: "policy-1",
  promptTemplateId: "prompt-1",
  skillPackageIds: ["skill-1"],
  executionProfileId: "profile-1",
  verificationCheckProfileIds: ["check-profile-1"],
  evaluationSuiteIds: ["evaluation-suite-1"],
  releaseCheckProfileId: "release-profile-1",
};

const toolPolicyStatusCheck: ToolPermissionPolicyStatus = "active";
const toolPolicyViewModelCheck: ToolPermissionPolicyViewModel = {
  id: "policy-1",
  name: "Editing Policy",
  status: toolPolicyStatusCheck,
  default_mode: "read",
  allowed_tool_ids: ["tool-1"],
  high_risk_tool_ids: [],
  write_requires_confirmation: true,
  admin_only: true,
};
const toolPolicyInputCheck: CreateToolPermissionPolicyInput = {
  actorRole: "admin",
  name: "Editing Policy",
  allowedToolIds: ["tool-1"],
  highRiskToolIds: [],
};

const executionStatusCheck: AgentExecutionStatus = "completed";
const executionViewModelCheck: AgentExecutionLogViewModel = {
  id: "execution-log-1",
  manuscript_id: "manuscript-1",
  module: "editing",
  triggered_by: "editor-1",
  runtime_id: "runtime-1",
  sandbox_profile_id: "sandbox-1",
  agent_profile_id: "agent-profile-1",
  runtime_binding_id: "binding-1",
  tool_permission_policy_id: "policy-1",
  execution_snapshot_id: "snapshot-1",
  knowledge_item_ids: ["knowledge-1"],
  verification_check_profile_ids: ["check-profile-1"],
  evaluation_suite_ids: ["evaluation-suite-1"],
  release_check_profile_id: "release-profile-1",
  verification_evidence_ids: ["evidence-1"],
  status: executionStatusCheck,
  started_at: "2026-03-28T14:00:00.000Z",
  finished_at: "2026-03-28T14:02:00.000Z",
};
const executionInputCheck: CreateAgentExecutionLogInput = {
  manuscriptId: "manuscript-1",
  module: "editing",
  triggeredBy: "editor-1",
  runtimeId: "runtime-1",
  sandboxProfileId: "sandbox-1",
  agentProfileId: "agent-profile-1",
  runtimeBindingId: "binding-1",
  toolPermissionPolicyId: "policy-1",
  knowledgeItemIds: ["knowledge-1"],
  verificationCheckProfileIds: ["check-profile-1"],
  evaluationSuiteIds: ["evaluation-suite-1"],
  releaseCheckProfileId: "release-profile-1",
};
const completeExecutionInputCheck: CompleteAgentExecutionLogInput = {
  logId: "execution-log-1",
  executionSnapshotId: "snapshot-1",
  verificationEvidenceIds: ["evidence-1"],
};

const evaluationSuiteTypeCheck: EvaluationSuiteType = "regression";
const evaluationRunStatusCheck: EvaluationRunStatus = "passed";
const verificationEvidenceKindCheck: VerificationEvidenceKind = "url";
const verificationCheckViewModelCheck: VerificationCheckProfileViewModel = {
  id: "check-profile-1",
  name: "Browser QA",
  check_type: "browser_qa",
  status: "published",
  tool_ids: ["tool-1"],
  admin_only: true,
};
const releaseCheckViewModelCheck: ReleaseCheckProfileViewModel = {
  id: "release-profile-1",
  name: "Release Gate",
  check_type: "deploy_verification",
  status: "published",
  verification_check_profile_ids: ["check-profile-1"],
  admin_only: true,
};
const evaluationSuiteViewModelCheck: EvaluationSuiteViewModel = {
  id: "evaluation-suite-1",
  name: "Regression Suite",
  suite_type: evaluationSuiteTypeCheck,
  status: "active",
  verification_check_profile_ids: ["check-profile-1"],
  module_scope: ["editing"],
  admin_only: true,
};
const evidenceViewModelCheck: VerificationEvidenceViewModel = {
  id: "evidence-1",
  kind: verificationEvidenceKindCheck,
  label: "Browser QA Report",
  uri: "https://example.test/report",
  check_profile_id: "check-profile-1",
  created_at: "2026-03-28T14:00:00.000Z",
};
const evaluationRunViewModelCheck: EvaluationRunViewModel = {
  id: "evaluation-run-1",
  suite_id: "evaluation-suite-1",
  release_check_profile_id: "release-profile-1",
  status: evaluationRunStatusCheck,
  evidence_ids: ["evidence-1"],
  started_at: "2026-03-28T14:00:00.000Z",
  finished_at: "2026-03-28T14:05:00.000Z",
};
const verificationCheckInputCheck: CreateVerificationCheckProfileInput = {
  actorRole: "admin",
  name: "Browser QA",
  checkType: "browser_qa",
  toolIds: ["tool-1"],
};
const releaseCheckInputCheck: CreateReleaseCheckProfileInput = {
  actorRole: "admin",
  name: "Release Gate",
  checkType: "deploy_verification",
  verificationCheckProfileIds: ["check-profile-1"],
};
const evaluationSuiteInputCheck: CreateEvaluationSuiteInput = {
  actorRole: "admin",
  name: "Regression Suite",
  suiteType: evaluationSuiteTypeCheck,
  verificationCheckProfileIds: ["check-profile-1"],
  moduleScope: ["editing"],
};
const evaluationRunInputCheck: CreateEvaluationRunInput = {
  actorRole: "admin",
  suiteId: "evaluation-suite-1",
  releaseCheckProfileId: "release-profile-1",
};

const client = {
  async request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }) {
    void input;
    return {
      status: 200,
      body: undefined as TResponse,
    };
  },
};

void createAgentRuntime(client, runtimeInputCheck);
void listAgentRuntimes(client);
void listAgentRuntimesByModule(client, "editing", true);
void getAgentRuntime(client, "runtime-1");
void archiveAgentRuntime(client, "runtime-1", { actorRole: "admin" });
void publishAgentRuntime(client, "runtime-1", publishRuntimeInputCheck);

void createToolGatewayTool(client, toolInputCheck);
void listToolGatewayTools(client);
void listToolGatewayToolsByScope(client, "benchmark");
void getToolGatewayTool(client, "tool-1");
void updateToolGatewayTool(client, "tool-1", toolUpdateCheck);

void createSandboxProfile(client, sandboxInputCheck);
void listSandboxProfiles(client);
void activateSandboxProfile(client, "sandbox-1", { actorRole: "admin" });

void createAgentProfile(client, agentProfileInputCheck);
void listAgentProfiles(client);
void publishAgentProfile(client, "agent-profile-1", { actorRole: "admin" });

void createRuntimeBinding(client, runtimeBindingInputCheck);
void listRuntimeBindings(client);
void activateRuntimeBinding(client, "binding-1", { actorRole: "admin" });

void createToolPermissionPolicy(client, toolPolicyInputCheck);
void listToolPermissionPolicies(client);
void activateToolPermissionPolicy(client, "policy-1", { actorRole: "admin" });

void createAgentExecutionLog(client, executionInputCheck);
void completeAgentExecutionLog(client, completeExecutionInputCheck);
void getAgentExecutionLog(client, "execution-log-1");
void listAgentExecutionLogs(client);

void createVerificationCheckProfile(client, verificationCheckInputCheck);
void publishVerificationCheckProfile(client, "check-profile-1", { actorRole: "admin" });
void listVerificationCheckProfiles(client);
void createReleaseCheckProfile(client, releaseCheckInputCheck);
void publishReleaseCheckProfile(client, "release-profile-1", { actorRole: "admin" });
void createEvaluationSuite(client, evaluationSuiteInputCheck);
void activateEvaluationSuite(client, "evaluation-suite-1", { actorRole: "admin" });
void listEvaluationSuites(client);
void recordVerificationEvidence(client, {
  actorRole: "admin",
  kind: verificationEvidenceKindCheck,
  label: "Browser QA Report",
  uri: "https://example.test/report",
  checkProfileId: "check-profile-1",
});
void createEvaluationRun(client, evaluationRunInputCheck);
void completeEvaluationRun(client, {
  actorRole: "admin",
  runId: "evaluation-run-1",
  status: evaluationRunStatusCheck,
  evidenceIds: ["evidence-1"],
});

export {
  agentProfileInputCheck,
  agentProfileRoleCheck,
  agentProfileViewModelCheck,
  completeExecutionInputCheck,
  evaluationRunInputCheck,
  evaluationRunStatusCheck,
  evaluationRunViewModelCheck,
  evaluationSuiteInputCheck,
  evaluationSuiteTypeCheck,
  evaluationSuiteViewModelCheck,
  evidenceViewModelCheck,
  executionInputCheck,
  executionStatusCheck,
  executionViewModelCheck,
  publishRuntimeInputCheck,
  releaseCheckInputCheck,
  releaseCheckViewModelCheck,
  runtimeBindingInputCheck,
  runtimeBindingStatusCheck,
  runtimeBindingViewModelCheck,
  runtimeInputCheck,
  runtimeStatusCheck,
  runtimeViewModelCheck,
  sandboxInputCheck,
  sandboxModeCheck,
  sandboxViewModelCheck,
  toolInputCheck,
  toolPolicyInputCheck,
  toolPolicyStatusCheck,
  toolPolicyViewModelCheck,
  toolScopeCheck,
  toolUpdateCheck,
  toolViewModelCheck,
  verificationCheckInputCheck,
  verificationCheckViewModelCheck,
  verificationEvidenceKindCheck,
};
