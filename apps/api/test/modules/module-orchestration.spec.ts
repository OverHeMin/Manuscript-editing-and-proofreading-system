import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryAuditService } from "../../src/audit/audit-service.ts";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import { DocumentAssetService } from "../../src/modules/assets/document-asset-service.ts";
import { InMemoryDocumentAssetRepository } from "../../src/modules/assets/in-memory-document-asset-repository.ts";
import { InMemoryAgentExecutionRepository } from "../../src/modules/agent-execution/in-memory-agent-execution-repository.ts";
import { AgentExecutionService } from "../../src/modules/agent-execution/agent-execution-service.ts";
import { InMemoryAgentProfileRepository } from "../../src/modules/agent-profiles/in-memory-agent-profile-repository.ts";
import { AgentProfileService } from "../../src/modules/agent-profiles/agent-profile-service.ts";
import { InMemoryAgentRuntimeRepository } from "../../src/modules/agent-runtime/in-memory-agent-runtime-repository.ts";
import { AgentRuntimeService } from "../../src/modules/agent-runtime/agent-runtime-service.ts";
import { createScreeningApi } from "../../src/modules/screening/screening-api.ts";
import { ScreeningService } from "../../src/modules/screening/screening-service.ts";
import { createEditingApi } from "../../src/modules/editing/editing-api.ts";
import { EditingService } from "../../src/modules/editing/editing-service.ts";
import {
  createProofreadingApi,
} from "../../src/modules/proofreading/proofreading-api.ts";
import { ProofreadingService } from "../../src/modules/proofreading/proofreading-service.ts";
import { InMemoryExecutionGovernanceRepository } from "../../src/modules/execution-governance/in-memory-execution-governance-repository.ts";
import { ExecutionGovernanceService } from "../../src/modules/execution-governance/execution-governance-service.ts";
import { InMemoryExecutionTrackingRepository } from "../../src/modules/execution-tracking/in-memory-execution-tracking-repository.ts";
import { ExecutionTrackingService } from "../../src/modules/execution-tracking/execution-tracking-service.ts";
import { InMemoryJobRepository } from "../../src/modules/jobs/in-memory-job-repository.ts";
import { InMemoryKnowledgeRepository } from "../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import { InMemoryManuscriptRepository } from "../../src/modules/manuscripts/in-memory-manuscript-repository.ts";
import {
  InMemoryModelRegistryRepository,
  InMemoryModelRoutingPolicyRepository,
} from "../../src/modules/model-registry/in-memory-model-registry-repository.ts";
import { ModelRegistryService } from "../../src/modules/model-registry/model-registry-service.ts";
import { InMemoryPromptSkillRegistryRepository } from "../../src/modules/prompt-skill-registry/in-memory-prompt-skill-repository.ts";
import { InMemoryRuntimeBindingRepository } from "../../src/modules/runtime-bindings/in-memory-runtime-binding-repository.ts";
import { RuntimeBindingService } from "../../src/modules/runtime-bindings/runtime-binding-service.ts";
import { InMemorySandboxProfileRepository } from "../../src/modules/sandbox-profiles/in-memory-sandbox-profile-repository.ts";
import { SandboxProfileService } from "../../src/modules/sandbox-profiles/sandbox-profile-service.ts";
import {
  InMemoryModuleTemplateRepository,
  InMemoryTemplateFamilyRepository,
} from "../../src/modules/templates/in-memory-template-family-repository.ts";
import { InMemoryToolGatewayRepository } from "../../src/modules/tool-gateway/in-memory-tool-gateway-repository.ts";
import { ToolGatewayService } from "../../src/modules/tool-gateway/tool-gateway-service.ts";
import { InMemoryToolPermissionPolicyRepository } from "../../src/modules/tool-permission-policies/in-memory-tool-permission-policy-repository.ts";
import { ToolPermissionPolicyService } from "../../src/modules/tool-permission-policies/tool-permission-policy-service.ts";
import { AiGatewayService } from "../../src/modules/ai-gateway/ai-gateway-service.ts";
import { InMemoryVerificationOpsRepository } from "../../src/modules/verification-ops/in-memory-verification-ops-repository.ts";

function createModuleHarness() {
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const assetRepository = new InMemoryDocumentAssetRepository();
  const jobRepository = new InMemoryJobRepository();
  const knowledgeRepository = new InMemoryKnowledgeRepository();
  const templateFamilyRepository = new InMemoryTemplateFamilyRepository();
  const moduleTemplateRepository = new InMemoryModuleTemplateRepository();
  const promptSkillRegistryRepository = new InMemoryPromptSkillRegistryRepository();
  const executionGovernanceRepository = new InMemoryExecutionGovernanceRepository();
  const executionTrackingRepository = new InMemoryExecutionTrackingRepository();
  const sandboxProfileRepository = new InMemorySandboxProfileRepository();
  const agentProfileRepository = new InMemoryAgentProfileRepository();
  const agentRuntimeRepository = new InMemoryAgentRuntimeRepository();
  const runtimeBindingRepository = new InMemoryRuntimeBindingRepository();
  const toolGatewayRepository = new InMemoryToolGatewayRepository();
  const toolPermissionPolicyRepository =
    new InMemoryToolPermissionPolicyRepository();
  const verificationOpsRepository = new InMemoryVerificationOpsRepository();
  const agentExecutionRepository = new InMemoryAgentExecutionRepository();
  const modelRepository = new InMemoryModelRegistryRepository();
  const routingPolicyRepository = new InMemoryModelRoutingPolicyRepository();
  const auditService = new InMemoryAuditService();

  const assetIds = [
    "asset-1",
    "asset-2",
    "asset-3",
    "asset-4",
    "asset-5",
    "asset-6",
  ];
  const modelIds = ["model-1", "model-2", "model-3", "model-4", "model-5"];
  const screeningJobIds = ["job-screening-1"];
  const editingJobIds = ["job-editing-1"];
  const proofreadingJobIds = ["job-proofreading-1", "job-proofreading-2"];
  const sandboxIds = [
    "sandbox-screening-1",
    "sandbox-editing-1",
    "sandbox-proofreading-1",
  ];
  const agentProfileIds = [
    "agent-profile-screening-1",
    "agent-profile-editing-1",
    "agent-profile-proofreading-1",
  ];
  const runtimeIds = [
    "runtime-screening-1",
    "runtime-editing-1",
    "runtime-proofreading-1",
  ];
  const toolIds = ["tool-screening-1", "tool-editing-1", "tool-proofreading-1"];
  const toolPolicyIds = [
    "policy-screening-1",
    "policy-editing-1",
    "policy-proofreading-1",
  ];
  const runtimeBindingIds = [
    "binding-screening-1",
    "binding-editing-1",
    "binding-proofreading-1",
  ];
  const agentExecutionIds = ["execution-log-1", "execution-log-2"];
  const trackingIds = [
    "snapshot-1",
    "hit-1",
    "snapshot-2",
    "hit-2",
    "snapshot-3",
    "hit-3",
    "snapshot-4",
    "hit-4",
  ];
  const nextValue = (bucket: string[], label: string) => {
    const value = bucket.shift();
    assert.ok(value, `Expected a ${label} id to be available.`);
    return value;
  };

  const documentAssetService = new DocumentAssetService({
    assetRepository,
    manuscriptRepository,
    createId: () => nextValue(assetIds, "asset"),
    now: () => new Date("2026-03-27T09:00:00.000Z"),
  });
  const modelRegistryService = new ModelRegistryService({
    repository: modelRepository,
    routingPolicyRepository,
    createId: () => nextValue(modelIds, "model"),
  });
  const aiGatewayService = new AiGatewayService({
    repository: modelRepository,
    routingPolicyRepository,
    auditService,
    now: () => new Date("2026-03-27T09:00:00.000Z"),
  });
  const executionGovernanceService = new ExecutionGovernanceService({
    repository: executionGovernanceRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
  });
  const executionTrackingService = new ExecutionTrackingService({
    repository: executionTrackingRepository,
    createId: () => nextValue(trackingIds, "execution tracking"),
    now: () => new Date("2026-03-27T09:00:00.000Z"),
  });
  const sandboxProfileService = new SandboxProfileService({
    repository: sandboxProfileRepository,
    createId: () => nextValue(sandboxIds, "sandbox profile"),
  });
  const agentProfileService = new AgentProfileService({
    repository: agentProfileRepository,
    createId: () => nextValue(agentProfileIds, "agent profile"),
  });
  const agentRuntimeService = new AgentRuntimeService({
    repository: agentRuntimeRepository,
    createId: () => nextValue(runtimeIds, "agent runtime"),
  });
  const toolGatewayService = new ToolGatewayService({
    repository: toolGatewayRepository,
    createId: () => nextValue(toolIds, "tool"),
  });
  const toolPermissionPolicyService = new ToolPermissionPolicyService({
    repository: toolPermissionPolicyRepository,
    toolGatewayRepository,
    createId: () => nextValue(toolPolicyIds, "tool permission policy"),
  });
  const runtimeBindingService = new RuntimeBindingService({
    repository: runtimeBindingRepository,
    agentRuntimeRepository,
    sandboxProfileRepository,
    agentProfileRepository,
    toolPermissionPolicyRepository,
    promptSkillRegistryRepository,
    verificationOpsRepository,
    createId: () => nextValue(runtimeBindingIds, "runtime binding"),
  });
  const agentExecutionService = new AgentExecutionService({
    repository: agentExecutionRepository,
    createId: () => nextValue(agentExecutionIds, "agent execution"),
    now: () => new Date("2026-03-27T09:00:00.000Z"),
  });

  const screeningApi = createScreeningApi({
    screeningService: new ScreeningService({
      manuscriptRepository,
      assetRepository,
      moduleTemplateRepository,
      promptSkillRegistryRepository,
      knowledgeRepository,
      executionGovernanceService,
      executionTrackingService,
      jobRepository,
      documentAssetService,
      aiGatewayService,
      sandboxProfileService,
      agentProfileService,
      agentRuntimeService,
      runtimeBindingService,
      toolPermissionPolicyService,
      agentExecutionService,
      createId: () => nextValue(screeningJobIds, "screening job"),
      now: () => new Date("2026-03-27T09:00:00.000Z"),
    }),
  });
  const editingApi = createEditingApi({
    editingService: new EditingService({
      manuscriptRepository,
      assetRepository,
      moduleTemplateRepository,
      promptSkillRegistryRepository,
      knowledgeRepository,
      executionGovernanceService,
      executionTrackingService,
      jobRepository,
      documentAssetService,
      aiGatewayService,
      sandboxProfileService,
      agentProfileService,
      agentRuntimeService,
      runtimeBindingService,
      toolPermissionPolicyService,
      agentExecutionService,
      createId: () => nextValue(editingJobIds, "editing job"),
      now: () => new Date("2026-03-27T09:00:00.000Z"),
    }),
  });
  const proofreadingApi = createProofreadingApi({
    proofreadingService: new ProofreadingService({
      manuscriptRepository,
      assetRepository,
      moduleTemplateRepository,
      promptSkillRegistryRepository,
      knowledgeRepository,
      executionGovernanceService,
      executionTrackingService,
      jobRepository,
      documentAssetService,
      aiGatewayService,
      sandboxProfileService,
      agentProfileService,
      agentRuntimeService,
      runtimeBindingService,
      toolPermissionPolicyService,
      agentExecutionService,
      createId: () => nextValue(proofreadingJobIds, "proofreading job"),
      now: () => new Date("2026-03-27T09:00:00.000Z"),
    }),
  });

  return {
    manuscriptRepository,
    assetRepository,
    jobRepository,
    knowledgeRepository,
    templateFamilyRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    executionGovernanceRepository,
    executionTrackingRepository,
    verificationOpsRepository,
    sandboxProfileService,
    agentProfileService,
    agentRuntimeService,
    toolGatewayService,
    toolPermissionPolicyService,
    runtimeBindingService,
    agentExecutionRepository,
    documentAssetService,
    modelRegistryService,
    screeningApi,
    editingApi,
    proofreadingApi,
  };
}

async function seedWorkflowContext() {
  const harness = createModuleHarness();

  await harness.manuscriptRepository.save({
    id: "manuscript-1",
    title: "Clinical Study Screening Fixture",
    manuscript_type: "clinical_study",
    status: "uploaded",
    created_by: "user-1",
    current_screening_asset_id: undefined,
    current_editing_asset_id: undefined,
    current_proofreading_asset_id: undefined,
    current_template_family_id: "family-1",
    created_at: "2026-03-27T08:55:00.000Z",
    updated_at: "2026-03-27T08:55:00.000Z",
  });

  await harness.templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical Study Family",
    status: "active",
  });
  await harness.moduleTemplateRepository.save({
    id: "template-screening-1",
    template_family_id: "family-1",
    module: "screening",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Screening prompt",
  });
  await harness.moduleTemplateRepository.save({
    id: "template-editing-1",
    template_family_id: "family-1",
    module: "editing",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Editing prompt",
  });
  await harness.moduleTemplateRepository.save({
    id: "template-proofreading-1",
    template_family_id: "family-1",
    module: "proofreading",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Proofreading prompt",
  });
  await harness.promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-screening-1",
    name: "screening_mainline",
    version: "1.0.0",
    status: "published",
    module: "screening",
    manuscript_types: ["clinical_study"],
  });
  await harness.promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-editing-1",
    name: "editing_mainline",
    version: "1.0.0",
    status: "published",
    module: "editing",
    manuscript_types: ["clinical_study"],
  });
  await harness.promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-proofreading-1",
    name: "proofreading_mainline",
    version: "1.0.0",
    status: "published",
    module: "proofreading",
    manuscript_types: ["clinical_study"],
  });
  await harness.promptSkillRegistryRepository.saveSkillPackage({
    id: "skill-screening-1",
    name: "screening_skills",
    version: "1.0.0",
    scope: "admin_only",
    status: "published",
    applies_to_modules: ["screening"],
  });
  await harness.promptSkillRegistryRepository.saveSkillPackage({
    id: "skill-editing-1",
    name: "editing_skills",
    version: "1.0.0",
    scope: "admin_only",
    status: "published",
    applies_to_modules: ["editing"],
  });
  await harness.promptSkillRegistryRepository.saveSkillPackage({
    id: "skill-proofreading-1",
    name: "proofreading_skills",
    version: "1.0.0",
    scope: "admin_only",
    status: "published",
    applies_to_modules: ["proofreading"],
  });
  await harness.executionGovernanceRepository.saveProfile({
    id: "profile-screening-1",
    module: "screening",
    manuscript_type: "clinical_study",
    template_family_id: "family-1",
    module_template_id: "template-screening-1",
    prompt_template_id: "prompt-screening-1",
    skill_package_ids: ["skill-screening-1"],
    knowledge_binding_mode: "profile_plus_dynamic",
    status: "active",
    version: 1,
  });
  await harness.executionGovernanceRepository.saveProfile({
    id: "profile-editing-1",
    module: "editing",
    manuscript_type: "clinical_study",
    template_family_id: "family-1",
    module_template_id: "template-editing-1",
    prompt_template_id: "prompt-editing-1",
    skill_package_ids: ["skill-editing-1"],
    knowledge_binding_mode: "profile_plus_dynamic",
    status: "active",
    version: 1,
  });
  await harness.executionGovernanceRepository.saveProfile({
    id: "profile-proofreading-1",
    module: "proofreading",
    manuscript_type: "clinical_study",
    template_family_id: "family-1",
    module_template_id: "template-proofreading-1",
    prompt_template_id: "prompt-proofreading-1",
    skill_package_ids: ["skill-proofreading-1"],
    knowledge_binding_mode: "profile_plus_dynamic",
    status: "active",
    version: 1,
  });
  await harness.executionGovernanceRepository.saveKnowledgeBindingRule({
    id: "rule-screening-1",
    knowledge_item_id: "knowledge-screening-1",
    module: "screening",
    manuscript_types: ["clinical_study"],
    template_family_ids: ["family-1"],
    module_template_ids: ["template-screening-1"],
    priority: 10,
    binding_purpose: "required",
    status: "active",
  });
  await harness.executionGovernanceRepository.saveKnowledgeBindingRule({
    id: "rule-editing-1",
    knowledge_item_id: "knowledge-editing-1",
    module: "editing",
    manuscript_types: ["clinical_study"],
    template_family_ids: ["family-1"],
    module_template_ids: ["template-editing-1"],
    priority: 10,
    binding_purpose: "required",
    status: "active",
  });
  await harness.executionGovernanceRepository.saveKnowledgeBindingRule({
    id: "rule-proofreading-1",
    knowledge_item_id: "knowledge-proof-1",
    module: "proofreading",
    manuscript_types: ["clinical_study"],
    template_family_ids: ["family-1"],
    module_template_ids: ["template-proofreading-1"],
    priority: 10,
    binding_purpose: "required",
    status: "active",
  });

  await harness.knowledgeRepository.save({
    id: "knowledge-screening-1",
    title: "Screening rule",
    canonical_text: "Check ethics approval.",
    knowledge_kind: "rule",
    status: "approved",
    routing: {
      module_scope: "screening",
      manuscript_types: ["clinical_study"],
    },
    template_bindings: ["template-screening-1"],
  });
  await harness.knowledgeRepository.save({
    id: "knowledge-editing-1",
    title: "Editing rule",
    canonical_text: "Normalize trial terminology.",
    knowledge_kind: "rule",
    status: "approved",
    routing: {
      module_scope: "editing",
      manuscript_types: ["clinical_study"],
    },
    template_bindings: ["template-editing-1"],
  });
  await harness.knowledgeRepository.save({
    id: "knowledge-proof-1",
    title: "Proofreading rule",
    canonical_text: "Flag punctuation drift.",
    knowledge_kind: "checklist",
    status: "approved",
    routing: {
      module_scope: "proofreading",
      manuscript_types: ["clinical_study"],
    },
    template_bindings: ["template-proofreading-1"],
  });
  await harness.knowledgeRepository.save({
    id: "knowledge-draft-excluded",
    title: "Draft knowledge should not route",
    canonical_text: "Do not use draft knowledge.",
    knowledge_kind: "rule",
    status: "draft",
    routing: {
      module_scope: "screening",
      manuscript_types: ["clinical_study"],
    },
  });

  const systemModel = await harness.modelRegistryService.createModelEntry("admin", {
    provider: "openai",
    modelName: "gpt-5-safe-default",
    modelVersion: "2026-03",
    allowedModules: ["screening", "editing", "proofreading"],
    isProdAllowed: true,
  });
  const screeningModel = await harness.modelRegistryService.createModelEntry("admin", {
    provider: "openai",
    modelName: "gpt-5-screening",
    modelVersion: "2026-03",
    allowedModules: ["screening"],
    isProdAllowed: true,
  });
  const editingModel = await harness.modelRegistryService.createModelEntry("admin", {
    provider: "openai",
    modelName: "gpt-5-editing",
    modelVersion: "2026-03",
    allowedModules: ["editing"],
    isProdAllowed: true,
  });
  const proofreadingModel = await harness.modelRegistryService.createModelEntry(
    "admin",
    {
      provider: "openai",
      modelName: "gpt-5-proofreading",
      modelVersion: "2026-03",
      allowedModules: ["proofreading"],
      isProdAllowed: true,
    },
  );

  await harness.modelRegistryService.updateRoutingPolicy("admin", {
    systemDefaultModelId: systemModel.id,
    moduleDefaults: {
      screening: screeningModel.id,
      editing: editingModel.id,
      proofreading: proofreadingModel.id,
    },
  });

  const screeningTool = await harness.toolGatewayService.createTool("admin", {
    name: "screening.knowledge.search",
    scope: "knowledge",
  });
  const editingTool = await harness.toolGatewayService.createTool("admin", {
    name: "editing.knowledge.search",
    scope: "knowledge",
  });
  const proofreadingTool = await harness.toolGatewayService.createTool("admin", {
    name: "proofreading.knowledge.search",
    scope: "knowledge",
  });

  const screeningPolicy = await harness.toolPermissionPolicyService.createPolicy(
    "admin",
    {
      name: "Screening Policy",
      allowedToolIds: [screeningTool.id],
      highRiskToolIds: [],
    },
  );
  await harness.toolPermissionPolicyService.activatePolicy(
    screeningPolicy.id,
    "admin",
  );
  const editingPolicy = await harness.toolPermissionPolicyService.createPolicy(
    "admin",
    {
      name: "Editing Policy",
      allowedToolIds: [editingTool.id],
      highRiskToolIds: [],
    },
  );
  await harness.toolPermissionPolicyService.activatePolicy(
    editingPolicy.id,
    "admin",
  );
  const proofreadingPolicy =
    await harness.toolPermissionPolicyService.createPolicy("admin", {
      name: "Proofreading Policy",
      allowedToolIds: [proofreadingTool.id],
      highRiskToolIds: [],
    });
  await harness.toolPermissionPolicyService.activatePolicy(
    proofreadingPolicy.id,
    "admin",
  );

  await harness.verificationOpsRepository.saveVerificationCheckProfile({
    id: "check-profile-screening-1",
    name: "Screening Browser QA",
    check_type: "browser_qa",
    status: "published",
    tool_ids: [screeningTool.id],
    admin_only: true,
  });
  await harness.verificationOpsRepository.saveVerificationCheckProfile({
    id: "check-profile-editing-1",
    name: "Editing Browser QA",
    check_type: "browser_qa",
    status: "published",
    tool_ids: [editingTool.id],
    admin_only: true,
  });
  await harness.verificationOpsRepository.saveVerificationCheckProfile({
    id: "check-profile-proofreading-1",
    name: "Proofreading Browser QA",
    check_type: "browser_qa",
    status: "published",
    tool_ids: [proofreadingTool.id],
    admin_only: true,
  });
  await harness.verificationOpsRepository.saveReleaseCheckProfile({
    id: "release-profile-screening-1",
    name: "Screening Release Gate",
    check_type: "deploy_verification",
    status: "published",
    verification_check_profile_ids: ["check-profile-screening-1"],
    admin_only: true,
  });
  await harness.verificationOpsRepository.saveReleaseCheckProfile({
    id: "release-profile-editing-1",
    name: "Editing Release Gate",
    check_type: "deploy_verification",
    status: "published",
    verification_check_profile_ids: ["check-profile-editing-1"],
    admin_only: true,
  });
  await harness.verificationOpsRepository.saveReleaseCheckProfile({
    id: "release-profile-proofreading-1",
    name: "Proofreading Release Gate",
    check_type: "deploy_verification",
    status: "published",
    verification_check_profile_ids: ["check-profile-proofreading-1"],
    admin_only: true,
  });
  await harness.verificationOpsRepository.saveEvaluationSuite({
    id: "suite-screening-1",
    name: "Screening Regression Suite",
    suite_type: "regression",
    status: "active",
    verification_check_profile_ids: ["check-profile-screening-1"],
    module_scope: ["screening"],
    requires_production_baseline: false,
    supports_ab_comparison: true,
    hard_gate_policy: {
      must_use_deidentified_samples: true,
      requires_parsable_output: true,
    },
    score_weights: {
      structure: 0.2,
      terminology: 0.2,
      knowledge_coverage: 0.2,
      risk_detection: 0.2,
      human_edit_burden: 0.1,
      cost_and_latency: 0.1,
    },
    admin_only: true,
  });
  await harness.verificationOpsRepository.saveEvaluationSuite({
    id: "suite-editing-1",
    name: "Editing Regression Suite",
    suite_type: "regression",
    status: "active",
    verification_check_profile_ids: ["check-profile-editing-1"],
    module_scope: ["editing"],
    requires_production_baseline: false,
    supports_ab_comparison: true,
    hard_gate_policy: {
      must_use_deidentified_samples: true,
      requires_parsable_output: true,
    },
    score_weights: {
      structure: 0.2,
      terminology: 0.2,
      knowledge_coverage: 0.2,
      risk_detection: 0.2,
      human_edit_burden: 0.1,
      cost_and_latency: 0.1,
    },
    admin_only: true,
  });
  await harness.verificationOpsRepository.saveEvaluationSuite({
    id: "suite-proofreading-1",
    name: "Proofreading Regression Suite",
    suite_type: "regression",
    status: "active",
    verification_check_profile_ids: ["check-profile-proofreading-1"],
    module_scope: ["proofreading"],
    requires_production_baseline: false,
    supports_ab_comparison: true,
    hard_gate_policy: {
      must_use_deidentified_samples: true,
      requires_parsable_output: true,
    },
    score_weights: {
      structure: 0.2,
      terminology: 0.2,
      knowledge_coverage: 0.2,
      risk_detection: 0.2,
      human_edit_burden: 0.1,
      cost_and_latency: 0.1,
    },
    admin_only: true,
  });

  const screeningSandbox = await harness.sandboxProfileService.createProfile(
    "admin",
    {
      name: "Screening Sandbox",
      sandboxMode: "workspace_write",
      networkAccess: false,
      approvalRequired: true,
      allowedToolIds: [screeningTool.id],
    },
  );
  await harness.sandboxProfileService.activateProfile(
    screeningSandbox.id,
    "admin",
  );
  const editingSandbox = await harness.sandboxProfileService.createProfile(
    "admin",
    {
      name: "Editing Sandbox",
      sandboxMode: "workspace_write",
      networkAccess: false,
      approvalRequired: true,
      allowedToolIds: [editingTool.id],
    },
  );
  await harness.sandboxProfileService.activateProfile(editingSandbox.id, "admin");
  const proofreadingSandbox =
    await harness.sandboxProfileService.createProfile("admin", {
      name: "Proofreading Sandbox",
      sandboxMode: "workspace_write",
      networkAccess: false,
      approvalRequired: true,
      allowedToolIds: [proofreadingTool.id],
    });
  await harness.sandboxProfileService.activateProfile(
    proofreadingSandbox.id,
    "admin",
  );

  const screeningRuntime = await harness.agentRuntimeService.createRuntime(
    "admin",
    {
      name: "Screening Runtime",
      adapter: "deepagents",
      sandboxProfileId: screeningSandbox.id,
      allowedModules: ["screening"],
      runtimeSlot: "screening",
    },
  );
  await harness.agentRuntimeService.publishRuntime(screeningRuntime.id, "admin");
  const editingRuntime = await harness.agentRuntimeService.createRuntime(
    "admin",
    {
      name: "Editing Runtime",
      adapter: "deepagents",
      sandboxProfileId: editingSandbox.id,
      allowedModules: ["editing"],
      runtimeSlot: "editing",
    },
  );
  await harness.agentRuntimeService.publishRuntime(editingRuntime.id, "admin");
  const proofreadingRuntime =
    await harness.agentRuntimeService.createRuntime("admin", {
      name: "Proofreading Runtime",
      adapter: "deepagents",
      sandboxProfileId: proofreadingSandbox.id,
      allowedModules: ["proofreading"],
      runtimeSlot: "proofreading",
    });
  await harness.agentRuntimeService.publishRuntime(
    proofreadingRuntime.id,
    "admin",
  );

  const screeningAgentProfile = await harness.agentProfileService.createProfile(
    "admin",
    {
      name: "Screening Executor",
      roleKey: "subagent",
      moduleScope: ["screening"],
      manuscriptTypes: ["clinical_study"],
    },
  );
  await harness.agentProfileService.publishProfile(
    screeningAgentProfile.id,
    "admin",
  );
  const editingAgentProfile = await harness.agentProfileService.createProfile(
    "admin",
    {
      name: "Editing Executor",
      roleKey: "subagent",
      moduleScope: ["editing"],
      manuscriptTypes: ["clinical_study"],
    },
  );
  await harness.agentProfileService.publishProfile(
    editingAgentProfile.id,
    "admin",
  );
  const proofreadingAgentProfile =
    await harness.agentProfileService.createProfile("admin", {
      name: "Proofreading Executor",
      roleKey: "subagent",
      moduleScope: ["proofreading"],
      manuscriptTypes: ["clinical_study"],
    });
  await harness.agentProfileService.publishProfile(
    proofreadingAgentProfile.id,
    "admin",
  );

  const screeningBinding = await harness.runtimeBindingService.createBinding(
    "admin",
    {
      module: "screening",
      manuscriptType: "clinical_study",
      templateFamilyId: "family-1",
      runtimeId: screeningRuntime.id,
      sandboxProfileId: screeningSandbox.id,
      agentProfileId: screeningAgentProfile.id,
      toolPermissionPolicyId: screeningPolicy.id,
      promptTemplateId: "prompt-screening-1",
      skillPackageIds: ["skill-screening-1"],
      executionProfileId: "profile-screening-1",
      verificationCheckProfileIds: ["check-profile-screening-1"],
      evaluationSuiteIds: ["suite-screening-1"],
      releaseCheckProfileId: "release-profile-screening-1",
    },
  );
  await harness.runtimeBindingService.activateBinding(
    screeningBinding.id,
    "admin",
  );
  const editingBinding = await harness.runtimeBindingService.createBinding(
    "admin",
    {
      module: "editing",
      manuscriptType: "clinical_study",
      templateFamilyId: "family-1",
      runtimeId: editingRuntime.id,
      sandboxProfileId: editingSandbox.id,
      agentProfileId: editingAgentProfile.id,
      toolPermissionPolicyId: editingPolicy.id,
      promptTemplateId: "prompt-editing-1",
      skillPackageIds: ["skill-editing-1"],
      executionProfileId: "profile-editing-1",
      verificationCheckProfileIds: ["check-profile-editing-1"],
      evaluationSuiteIds: ["suite-editing-1"],
      releaseCheckProfileId: "release-profile-editing-1",
    },
  );
  await harness.runtimeBindingService.activateBinding(editingBinding.id, "admin");
  const proofreadingBinding = await harness.runtimeBindingService.createBinding(
    "admin",
    {
      module: "proofreading",
      manuscriptType: "clinical_study",
      templateFamilyId: "family-1",
      runtimeId: proofreadingRuntime.id,
      sandboxProfileId: proofreadingSandbox.id,
      agentProfileId: proofreadingAgentProfile.id,
      toolPermissionPolicyId: proofreadingPolicy.id,
      promptTemplateId: "prompt-proofreading-1",
      skillPackageIds: ["skill-proofreading-1"],
      executionProfileId: "profile-proofreading-1",
      verificationCheckProfileIds: ["check-profile-proofreading-1"],
      evaluationSuiteIds: ["suite-proofreading-1"],
      releaseCheckProfileId: "release-profile-proofreading-1",
    },
  );
  await harness.runtimeBindingService.activateBinding(
    proofreadingBinding.id,
    "admin",
  );

  const originalAsset = await harness.documentAssetService.createAsset({
    manuscriptId: "manuscript-1",
    assetType: "original",
    storageKey: "uploads/manuscript-1/original.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "user-1",
    fileName: "original.docx",
    sourceModule: "upload",
  });

  return {
    ...harness,
    originalAsset,
  };
}

test("screening produces a final report asset with routed template, knowledge, and model context", async () => {
  const {
    screeningApi,
    manuscriptRepository,
    agentExecutionRepository,
    originalAsset,
  } =
    await seedWorkflowContext();

  const response = await screeningApi.runScreening({
    manuscriptId: "manuscript-1",
    parentAssetId: originalAsset.id,
    requestedBy: "screener-1",
    actorRole: "screener",
    storageKey: "runs/manuscript-1/screening/report.md",
    fileName: "screening-report.md",
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.asset.asset_type, "screening_report");
  assert.equal(response.body.asset.parent_asset_id, originalAsset.id);
  assert.equal(response.body.template_id, "template-screening-1");
  assert.equal(response.body.execution_profile_id, "profile-screening-1");
  assert.equal(response.body.prompt_template_id, "prompt-screening-1");
  assert.deepEqual(response.body.skill_package_ids, ["skill-screening-1"]);
  assert.equal(response.body.snapshot_id, "snapshot-1");
  assert.deepEqual(response.body.knowledge_item_ids, ["knowledge-screening-1"]);
  assert.equal(response.body.model_id, "model-2");
  assert.equal(response.body.agent_runtime_id, "runtime-screening-1");
  assert.equal(
    response.body.agent_profile_id,
    "agent-profile-screening-1",
  );
  assert.equal(response.body.agent_execution_log_id, "execution-log-1");
  assert.equal(response.body.job.module, "screening");
  const executionLog = await agentExecutionRepository.findById(
    response.body.agent_execution_log_id,
  );
  assert.equal(executionLog?.execution_snapshot_id, response.body.snapshot_id);
  assert.deepEqual(executionLog?.verification_check_profile_ids, [
    "check-profile-screening-1",
  ]);
  assert.deepEqual(executionLog?.evaluation_suite_ids, ["suite-screening-1"]);
  assert.equal(
    executionLog?.release_check_profile_id,
    "release-profile-screening-1",
  );
  assert.equal(
    (await manuscriptRepository.findById("manuscript-1"))
      ?.current_screening_asset_id,
    response.body.asset.id,
  );
});

test("module services enforce workbench permissions per module", async () => {
  const { screeningApi, editingApi, proofreadingApi, originalAsset } =
    await seedWorkflowContext();

  await assert.rejects(
    () =>
      screeningApi.runScreening({
        manuscriptId: "manuscript-1",
        parentAssetId: originalAsset.id,
        requestedBy: "user-1",
        actorRole: "user",
        storageKey: "runs/manuscript-1/screening/forbidden.md",
      }),
    AuthorizationError,
  );

  await assert.rejects(
    () =>
      editingApi.runEditing({
        manuscriptId: "manuscript-1",
        parentAssetId: originalAsset.id,
        requestedBy: "screener-1",
        actorRole: "screener",
        storageKey: "runs/manuscript-1/editing/forbidden.docx",
      }),
    AuthorizationError,
  );

  await assert.rejects(
    () =>
      proofreadingApi.createDraft({
        manuscriptId: "manuscript-1",
        parentAssetId: originalAsset.id,
        requestedBy: "editor-1",
        actorRole: "editor",
        storageKey: "runs/manuscript-1/proofreading/forbidden.md",
      }),
    AuthorizationError,
  );
});

test("editing produces a final docx asset with routed template, knowledge, and model context", async () => {
  const {
    editingApi,
    manuscriptRepository,
    agentExecutionRepository,
    originalAsset,
  } =
    await seedWorkflowContext();

  const response = await editingApi.runEditing({
    manuscriptId: "manuscript-1",
    parentAssetId: originalAsset.id,
    requestedBy: "editor-1",
    actorRole: "editor",
    storageKey: "runs/manuscript-1/editing/final.docx",
    fileName: "edited.docx",
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.asset.asset_type, "edited_docx");
  assert.equal(response.body.asset.parent_asset_id, originalAsset.id);
  assert.equal(response.body.template_id, "template-editing-1");
  assert.equal(response.body.execution_profile_id, "profile-editing-1");
  assert.equal(response.body.prompt_template_id, "prompt-editing-1");
  assert.deepEqual(response.body.skill_package_ids, ["skill-editing-1"]);
  assert.equal(response.body.snapshot_id, "snapshot-1");
  assert.deepEqual(response.body.knowledge_item_ids, ["knowledge-editing-1"]);
  assert.equal(response.body.model_id, "model-3");
  assert.equal(response.body.agent_runtime_id, "runtime-editing-1");
  assert.equal(response.body.agent_profile_id, "agent-profile-editing-1");
  assert.equal(response.body.agent_execution_log_id, "execution-log-1");
  assert.equal(response.body.job.module, "editing");
  const executionLog = await agentExecutionRepository.findById(
    response.body.agent_execution_log_id,
  );
  assert.equal(executionLog?.execution_snapshot_id, response.body.snapshot_id);
  assert.deepEqual(executionLog?.verification_check_profile_ids, [
    "check-profile-editing-1",
  ]);
  assert.deepEqual(executionLog?.evaluation_suite_ids, ["suite-editing-1"]);
  assert.equal(
    executionLog?.release_check_profile_id,
    "release-profile-editing-1",
  );
  assert.equal(
    (await manuscriptRepository.findById("manuscript-1"))?.current_editing_asset_id,
    response.body.asset.id,
  );
});

test("proofreading produces a draft first and only advances the final pointer after confirmation", async () => {
  const {
    proofreadingApi,
    manuscriptRepository,
    moduleTemplateRepository,
    knowledgeRepository,
    modelRegistryService,
    agentExecutionRepository,
    executionTrackingRepository,
    originalAsset,
  } =
    await seedWorkflowContext();

  const draftResponse = await proofreadingApi.createDraft({
    manuscriptId: "manuscript-1",
    parentAssetId: originalAsset.id,
    requestedBy: "proofreader-1",
    actorRole: "proofreader",
    storageKey: "runs/manuscript-1/proofreading/draft-report.md",
    fileName: "proofreading-draft.md",
  });

  assert.equal(draftResponse.status, 201);
  assert.equal(draftResponse.body.asset.asset_type, "proofreading_draft_report");
  assert.equal(draftResponse.body.template_id, "template-proofreading-1");
  assert.equal(draftResponse.body.execution_profile_id, "profile-proofreading-1");
  assert.equal(draftResponse.body.prompt_template_id, "prompt-proofreading-1");
  assert.deepEqual(draftResponse.body.skill_package_ids, ["skill-proofreading-1"]);
  assert.equal(draftResponse.body.snapshot_id, "snapshot-1");
  assert.deepEqual(draftResponse.body.knowledge_item_ids, ["knowledge-proof-1"]);
  assert.equal(draftResponse.body.model_id, "model-4");
  assert.equal(
    draftResponse.body.agent_runtime_id,
    "runtime-proofreading-1",
  );
  assert.equal(
    draftResponse.body.agent_profile_id,
    "agent-profile-proofreading-1",
  );
  assert.equal(draftResponse.body.agent_execution_log_id, "execution-log-1");
  assert.equal(
    (await manuscriptRepository.findById("manuscript-1"))
      ?.current_proofreading_asset_id,
    undefined,
  );

  await moduleTemplateRepository.save({
    id: "template-proofreading-2",
    template_family_id: "family-1",
    module: "proofreading",
    manuscript_type: "clinical_study",
    version_no: 2,
    status: "published",
    prompt: "New proof prompt after draft review",
  });
  await knowledgeRepository.save({
    id: "knowledge-proof-2",
    title: "Late proofreading rule",
    canonical_text: "This should not replace the reviewed draft context.",
    knowledge_kind: "rule",
    status: "approved",
    routing: {
      module_scope: "proofreading",
      manuscript_types: ["clinical_study"],
    },
    template_bindings: ["template-proofreading-2"],
  });
  const newProofModel = await modelRegistryService.createModelEntry("admin", {
    provider: "openai",
    modelName: "gpt-5-proofreading-v2",
    modelVersion: "2026-04",
    allowedModules: ["proofreading"],
    isProdAllowed: true,
  });
  await modelRegistryService.updateRoutingPolicy("admin", {
    moduleDefaults: {
      proofreading: newProofModel.id,
    },
  });

  const finalResponse = await proofreadingApi.confirmFinal({
    manuscriptId: "manuscript-1",
    draftAssetId: draftResponse.body.asset.id,
    requestedBy: "proofreader-1",
    actorRole: "proofreader",
    storageKey: "runs/manuscript-1/proofreading/final.docx",
    fileName: "proofreading-final.docx",
  });

  assert.equal(finalResponse.status, 201);
  assert.equal(finalResponse.body.asset.asset_type, "final_proof_annotated_docx");
  assert.equal(finalResponse.body.asset.parent_asset_id, draftResponse.body.asset.id);
  assert.equal(finalResponse.body.job.module, "proofreading");
  assert.equal(finalResponse.body.template_id, "template-proofreading-1");
  assert.equal(finalResponse.body.execution_profile_id, "profile-proofreading-1");
  assert.equal(finalResponse.body.prompt_template_id, "prompt-proofreading-1");
  assert.deepEqual(finalResponse.body.skill_package_ids, ["skill-proofreading-1"]);
  assert.equal(finalResponse.body.snapshot_id, "snapshot-2");
  assert.deepEqual(finalResponse.body.knowledge_item_ids, ["knowledge-proof-1"]);
  assert.equal(finalResponse.body.model_id, "model-4");
  assert.equal(finalResponse.body.agent_runtime_id, "runtime-proofreading-1");
  assert.equal(
    finalResponse.body.agent_profile_id,
    "agent-profile-proofreading-1",
  );
  assert.equal(
    finalResponse.body.agent_execution_log_id,
    draftResponse.body.agent_execution_log_id,
  );
  const finalSnapshot = await executionTrackingRepository.findSnapshotById(
    finalResponse.body.snapshot_id,
  );
  assert.equal(finalSnapshot?.draft_snapshot_id, draftResponse.body.snapshot_id);
  const executionLog = await agentExecutionRepository.findById(
    draftResponse.body.agent_execution_log_id,
  );
  assert.equal(executionLog?.execution_snapshot_id, draftResponse.body.snapshot_id);
  assert.deepEqual(executionLog?.verification_check_profile_ids, [
    "check-profile-proofreading-1",
  ]);
  assert.deepEqual(executionLog?.evaluation_suite_ids, [
    "suite-proofreading-1",
  ]);
  assert.equal(
    executionLog?.release_check_profile_id,
    "release-profile-proofreading-1",
  );
  assert.equal(
    (await manuscriptRepository.findById("manuscript-1"))
      ?.current_proofreading_asset_id,
    finalResponse.body.asset.id,
  );
});
