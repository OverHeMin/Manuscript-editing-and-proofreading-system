import assert from "node:assert/strict";
import { InMemoryAuditService } from "../../src/audit/audit-service.ts";
import { AiGatewayService } from "../../src/modules/ai-gateway/ai-gateway-service.ts";
import { InMemoryAgentExecutionRepository } from "../../src/modules/agent-execution/in-memory-agent-execution-repository.ts";
import { AgentExecutionService } from "../../src/modules/agent-execution/agent-execution-service.ts";
import { InMemoryAgentProfileRepository } from "../../src/modules/agent-profiles/in-memory-agent-profile-repository.ts";
import { AgentProfileService } from "../../src/modules/agent-profiles/agent-profile-service.ts";
import { InMemoryAgentRuntimeRepository } from "../../src/modules/agent-runtime/in-memory-agent-runtime-repository.ts";
import { AgentRuntimeService } from "../../src/modules/agent-runtime/agent-runtime-service.ts";
import { DocumentAssetService } from "../../src/modules/assets/document-asset-service.ts";
import { InMemoryDocumentAssetRepository } from "../../src/modules/assets/in-memory-document-asset-repository.ts";
import { InMemoryEditorialRuleRepository } from "../../src/modules/editorial-rules/in-memory-editorial-rule-repository.ts";
import { InMemoryExecutionGovernanceRepository } from "../../src/modules/execution-governance/in-memory-execution-governance-repository.ts";
import { ExecutionGovernanceService } from "../../src/modules/execution-governance/execution-governance-service.ts";
import { InMemoryExecutionTrackingRepository } from "../../src/modules/execution-tracking/in-memory-execution-tracking-repository.ts";
import { ExecutionTrackingService } from "../../src/modules/execution-tracking/execution-tracking-service.ts";
import { InMemoryJobRepository } from "../../src/modules/jobs/in-memory-job-repository.ts";
import { InMemoryKnowledgeRepository } from "../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import { InMemoryManuscriptQualityPackageRepository } from "../../src/modules/manuscript-quality-packages/in-memory-manuscript-quality-package-repository.ts";
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
import { InMemoryModuleTemplateRepository } from "../../src/modules/templates/in-memory-template-family-repository.ts";
import { InMemoryToolGatewayRepository } from "../../src/modules/tool-gateway/in-memory-tool-gateway-repository.ts";
import { ToolGatewayService } from "../../src/modules/tool-gateway/tool-gateway-service.ts";
import { InMemoryToolPermissionPolicyRepository } from "../../src/modules/tool-permission-policies/in-memory-tool-permission-policy-repository.ts";
import { ToolPermissionPolicyService } from "../../src/modules/tool-permission-policies/tool-permission-policy-service.ts";
import { InMemoryVerificationOpsRepository } from "../../src/modules/verification-ops/in-memory-verification-ops-repository.ts";

export const BEFORE_HEADING = "\u6458\u8981 \u76ee\u7684";
export const AFTER_HEADING = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09";

export async function seedMedicalQualityFixture() {
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const assetRepository = new InMemoryDocumentAssetRepository();
  const moduleTemplateRepository = new InMemoryModuleTemplateRepository();
  const promptSkillRegistryRepository = new InMemoryPromptSkillRegistryRepository();
  const knowledgeRepository = new InMemoryKnowledgeRepository();
  const manuscriptQualityPackageRepository =
    new InMemoryManuscriptQualityPackageRepository();
  const editorialRuleRepository = new InMemoryEditorialRuleRepository();
  const executionGovernanceRepository = new InMemoryExecutionGovernanceRepository();
  const sandboxProfileRepository = new InMemorySandboxProfileRepository();
  const agentProfileRepository = new InMemoryAgentProfileRepository();
  const agentRuntimeRepository = new InMemoryAgentRuntimeRepository();
  const runtimeBindingRepository = new InMemoryRuntimeBindingRepository();
  const toolGatewayRepository = new InMemoryToolGatewayRepository();
  const toolPermissionPolicyRepository =
    new InMemoryToolPermissionPolicyRepository();
  const verificationOpsRepository = new InMemoryVerificationOpsRepository();
  const jobRepository = new InMemoryJobRepository();
  const executionTrackingRepository = new InMemoryExecutionTrackingRepository();
  const agentExecutionRepository = new InMemoryAgentExecutionRepository();

  const executionGovernanceService = new ExecutionGovernanceService({
    repository: executionGovernanceRepository,
    editorialRuleRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
  });
  const modelRepository = new InMemoryModelRegistryRepository();
  const routingPolicyRepository = new InMemoryModelRoutingPolicyRepository();
  const modelRegistryService = new ModelRegistryService({
    repository: modelRepository,
    routingPolicyRepository,
    createId: () => "model-1",
  });
  const aiGatewayService = new AiGatewayService({
    repository: modelRepository,
    routingPolicyRepository,
    auditService: new InMemoryAuditService(),
    now: () => new Date("2026-04-07T10:00:00.000Z"),
  });
  const sandboxProfileService = new SandboxProfileService({
    repository: sandboxProfileRepository,
    createId: (() => {
      const ids = [
        "sandbox-screening-1",
        "sandbox-editing-1",
        "sandbox-proofreading-1",
      ];
      return () => {
        const value = ids.shift();
        assert.ok(value);
        return value;
      };
    })(),
  });
  const agentProfileService = new AgentProfileService({
    repository: agentProfileRepository,
    createId: (() => {
      const ids = [
        "agent-profile-screening-1",
        "agent-profile-editing-1",
        "agent-profile-proofreading-1",
      ];
      return () => {
        const value = ids.shift();
        assert.ok(value);
        return value;
      };
    })(),
  });
  const agentRuntimeService = new AgentRuntimeService({
    repository: agentRuntimeRepository,
    createId: (() => {
      const ids = [
        "runtime-screening-1",
        "runtime-editing-1",
        "runtime-proofreading-1",
      ];
      return () => {
        const value = ids.shift();
        assert.ok(value);
        return value;
      };
    })(),
  });
  const toolGatewayService = new ToolGatewayService({
    repository: toolGatewayRepository,
    createId: () => "tool-1",
  });
  const toolPermissionPolicyService = new ToolPermissionPolicyService({
    repository: toolPermissionPolicyRepository,
    toolGatewayRepository,
    createId: () => "policy-1",
  });
  const runtimeBindingService = new RuntimeBindingService({
    repository: runtimeBindingRepository,
    agentRuntimeRepository,
    sandboxProfileRepository,
    agentProfileRepository,
    toolPermissionPolicyRepository,
    promptSkillRegistryRepository,
    verificationOpsRepository,
    manuscriptQualityPackageRepository,
    createId: (() => {
      const ids = [
        "binding-screening-1",
        "binding-editing-1",
        "binding-proofreading-1",
      ];
      return () => {
        const value = ids.shift();
        assert.ok(value);
        return value;
      };
    })(),
  });
  const executionTrackingService = new ExecutionTrackingService({
    repository: executionTrackingRepository,
    createId: (() => {
      const ids = ["snapshot-1", "hit-1", "snapshot-2", "hit-2", "snapshot-3", "hit-3"];
      return () => {
        const value = ids.shift();
        assert.ok(value);
        return value;
      };
    })(),
    now: () => new Date("2026-04-07T10:00:00.000Z"),
  });
  const documentAssetService = new DocumentAssetService({
    manuscriptRepository,
    assetRepository,
    createId: (() => {
      const ids = ["asset-1", "asset-2", "asset-3", "asset-4"];
      return () => {
        const value = ids.shift();
        assert.ok(value);
        return value;
      };
    })(),
    now: () => new Date("2026-04-07T10:00:00.000Z"),
  });
  const agentExecutionService = new AgentExecutionService({
    repository: agentExecutionRepository,
    createId: (() => {
      const ids = [
        "execution-log-1",
        "execution-log-2",
        "execution-log-3",
      ];
      return () => {
        const value = ids.shift();
        assert.ok(value);
        return value;
      };
    })(),
    now: () => new Date("2026-04-07T10:00:00.000Z"),
  });

  await modelRegistryService.createModelEntry("admin", {
    provider: "openai",
    modelName: "gpt-5-default",
    modelVersion: "2026-04",
    allowedModules: ["screening", "editing", "proofreading"],
    isProdAllowed: true,
  });
  await modelRegistryService.updateRoutingPolicy("admin", {
    systemDefaultModelId: "model-1",
    moduleDefaults: {
      screening: "model-1",
      editing: "model-1",
      proofreading: "model-1",
    },
  });

  await manuscriptRepository.save({
    id: "manuscript-1",
    title: "Governed manuscript",
    manuscript_type: "clinical_study",
    status: "uploaded",
    created_by: "user-1",
    current_screening_asset_id: undefined,
    current_editing_asset_id: undefined,
    current_proofreading_asset_id: undefined,
    current_template_family_id: "family-1",
    created_at: "2026-04-07T09:00:00.000Z",
    updated_at: "2026-04-07T09:00:00.000Z",
  });
  await assetRepository.save({
    id: "asset-original-1",
    manuscript_id: "manuscript-1",
    asset_type: "original",
    status: "active",
    storage_key: "uploads/manuscript-1/original.docx",
    mime_type:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    source_module: "upload",
    created_by: "user-1",
    version_no: 1,
    is_current: true,
    file_name: "original.docx",
    created_at: "2026-04-07T09:00:00.000Z",
    updated_at: "2026-04-07T09:00:00.000Z",
  });

  await moduleTemplateRepository.save({
    id: "template-screening-1",
    template_family_id: "family-1",
    module: "screening",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Screening template",
  });
  await moduleTemplateRepository.save({
    id: "template-editing-1",
    template_family_id: "family-1",
    module: "editing",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Editing template",
  });
  await moduleTemplateRepository.save({
    id: "template-proofreading-1",
    template_family_id: "family-1",
    module: "proofreading",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Proofreading template",
  });

  await promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-screening-1",
    name: "screening_mainline",
    version: "1.0.0",
    status: "published",
    module: "screening",
    manuscript_types: ["clinical_study"],
  });
  await promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-editing-1",
    name: "editing_mainline",
    version: "1.0.0",
    status: "published",
    module: "editing",
    manuscript_types: ["clinical_study"],
    template_kind: "editing_instruction",
    system_instructions: "Apply editorial rules without changing medical meaning.",
    task_frame: "Apply deterministic rules first, then stage AI-only candidates.",
    allowed_content_operations: ["sentence_rewrite", "paragraph_reshape"],
    forbidden_operations: ["fabrication", "meaning_shift"],
    manual_review_policy: "Escalate any content rewrite with medical meaning risk.",
    output_contract: "Return applied changes and staged manual review items.",
  });
  await promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-proofreading-1",
    name: "proofreading_mainline",
    version: "1.0.0",
    status: "published",
    module: "proofreading",
    manuscript_types: ["clinical_study"],
    template_kind: "proofreading_instruction",
    system_instructions: "Inspect the manuscript against the governed editorial rules.",
    task_frame: "Report failed checks and risk items without rewriting the manuscript.",
    forbidden_operations: ["rewrite_manuscript", "meaning_shift"],
    manual_review_policy: "Escalate any medical meaning risk or unresolved rule match.",
    output_contract: "Return proofreading findings and a markdown report.",
    report_style: "Use concise reviewer-facing markdown.",
  });

  await knowledgeRepository.save({
    id: "knowledge-snippet-editing-1",
    title: "Prompt snippet: abstract objective",
    canonical_text:
      'Instruction snippet: if you encounter "' +
      BEFORE_HEADING +
      '" in abstract section, change it to "' +
      AFTER_HEADING +
      '" and preserve the manuscript\'s medical meaning.',
    knowledge_kind: "prompt_snippet",
    status: "approved",
    routing: {
      module_scope: "any",
      manuscript_types: ["clinical_study"],
    },
    projection_source: {
      source_kind: "editorial_rule_projection",
      rule_set_id: "rule-set-editing-1",
      rule_id: "rule-abstract-objective-editing",
      projection_kind: "prompt_snippet",
    },
  });

  await editorialRuleRepository.saveRuleSet({
    id: "rule-set-screening-1",
    template_family_id: "family-1",
    module: "screening",
    version_no: 1,
    status: "published",
  });
  await editorialRuleRepository.saveRuleSet({
    id: "rule-set-editing-1",
    template_family_id: "family-1",
    module: "editing",
    version_no: 1,
    status: "published",
  });
  await editorialRuleRepository.saveRuleSet({
    id: "rule-set-proofreading-1",
    template_family_id: "family-1",
    module: "proofreading",
    version_no: 1,
    status: "published",
  });

  await editorialRuleRepository.saveRule({
    id: "rule-abstract-objective-editing",
    rule_set_id: "rule-set-editing-1",
    order_no: 10,
    rule_object: "generic",
    rule_type: "format",
    execution_mode: "apply_and_inspect",
    scope: {
      sections: ["abstract"],
      block_kind: "heading",
    },
    selector: {},
    trigger: {
      kind: "exact_text",
      text: BEFORE_HEADING,
    },
    action: {
      kind: "replace_heading",
      to: AFTER_HEADING,
    },
    authoring_payload: {},
    confidence_policy: "always_auto",
    severity: "error",
    enabled: true,
    example_before: BEFORE_HEADING,
    example_after: AFTER_HEADING,
  });
  await editorialRuleRepository.saveRule({
    id: "rule-discussion-reshape-editing",
    rule_set_id: "rule-set-editing-1",
    order_no: 20,
    rule_object: "generic",
    rule_type: "content",
    execution_mode: "apply",
    scope: {
      sections: ["discussion"],
      block_kind: "paragraph",
    },
    selector: {},
    trigger: {
      kind: "semantic_pattern",
      tag: "needs_clarity",
    },
    action: {
      kind: "rewrite_content",
    },
    authoring_payload: {},
    confidence_policy: "high_confidence_only",
    severity: "warning",
    enabled: true,
  });
  await editorialRuleRepository.saveRule({
    id: "rule-abstract-objective-proofreading",
    rule_set_id: "rule-set-proofreading-1",
    order_no: 10,
    rule_object: "generic",
    rule_type: "format",
    execution_mode: "inspect",
    scope: {
      sections: ["abstract"],
      block_kind: "heading",
    },
    selector: {},
    trigger: {
      kind: "exact_text",
      text: BEFORE_HEADING,
    },
    action: {
      kind: "replace_heading",
      to: AFTER_HEADING,
    },
    authoring_payload: {},
    confidence_policy: "always_auto",
    severity: "error",
    enabled: true,
    example_before: BEFORE_HEADING,
    example_after: AFTER_HEADING,
  });

  await executionGovernanceRepository.saveProfile({
    id: "profile-screening-1",
    module: "screening",
    manuscript_type: "clinical_study",
    template_family_id: "family-1",
    module_template_id: "template-screening-1",
    rule_set_id: "rule-set-screening-1",
    prompt_template_id: "prompt-screening-1",
    skill_package_ids: [],
    knowledge_binding_mode: "profile_plus_dynamic",
    status: "active",
    version: 1,
  });
  await executionGovernanceRepository.saveProfile({
    id: "profile-editing-1",
    module: "editing",
    manuscript_type: "clinical_study",
    template_family_id: "family-1",
    module_template_id: "template-editing-1",
    rule_set_id: "rule-set-editing-1",
    prompt_template_id: "prompt-editing-1",
    skill_package_ids: [],
    knowledge_binding_mode: "profile_plus_dynamic",
    status: "active",
    version: 1,
  });
  await executionGovernanceRepository.saveProfile({
    id: "profile-proofreading-1",
    module: "proofreading",
    manuscript_type: "clinical_study",
    template_family_id: "family-1",
    module_template_id: "template-proofreading-1",
    rule_set_id: "rule-set-proofreading-1",
    prompt_template_id: "prompt-proofreading-1",
    skill_package_ids: [],
    knowledge_binding_mode: "profile_plus_dynamic",
    status: "active",
    version: 1,
  });

  const tool = await toolGatewayService.createTool("admin", {
    name: "knowledge.search",
    scope: "knowledge",
  });
  const policy = await toolPermissionPolicyService.createPolicy("admin", {
    name: "Governed Policy",
    allowedToolIds: [tool.id],
    highRiskToolIds: [],
  });
  await toolPermissionPolicyService.activatePolicy(policy.id, "admin");

  const screeningSandbox = await sandboxProfileService.createProfile("admin", {
    name: "Screening Sandbox",
    sandboxMode: "workspace_write",
    networkAccess: false,
    approvalRequired: true,
    allowedToolIds: [tool.id],
  });
  await sandboxProfileService.activateProfile(screeningSandbox.id, "admin");
  const editingSandbox = await sandboxProfileService.createProfile("admin", {
    name: "Editing Sandbox",
    sandboxMode: "workspace_write",
    networkAccess: false,
    approvalRequired: true,
    allowedToolIds: [tool.id],
  });
  await sandboxProfileService.activateProfile(editingSandbox.id, "admin");
  const proofreadingSandbox = await sandboxProfileService.createProfile("admin", {
    name: "Proofreading Sandbox",
    sandboxMode: "workspace_write",
    networkAccess: false,
    approvalRequired: true,
    allowedToolIds: [tool.id],
  });
  await sandboxProfileService.activateProfile(proofreadingSandbox.id, "admin");

  const screeningRuntime = await agentRuntimeService.createRuntime("admin", {
    name: "Screening Runtime",
    adapter: "deepagents",
    sandboxProfileId: screeningSandbox.id,
    allowedModules: ["screening"],
    runtimeSlot: "screening",
  });
  await agentRuntimeService.publishRuntime(screeningRuntime.id, "admin");
  const editingRuntime = await agentRuntimeService.createRuntime("admin", {
    name: "Editing Runtime",
    adapter: "deepagents",
    sandboxProfileId: editingSandbox.id,
    allowedModules: ["editing"],
    runtimeSlot: "editing",
  });
  await agentRuntimeService.publishRuntime(editingRuntime.id, "admin");
  const proofreadingRuntime = await agentRuntimeService.createRuntime("admin", {
    name: "Proofreading Runtime",
    adapter: "deepagents",
    sandboxProfileId: proofreadingSandbox.id,
    allowedModules: ["proofreading"],
    runtimeSlot: "proofreading",
  });
  await agentRuntimeService.publishRuntime(proofreadingRuntime.id, "admin");

  const screeningAgentProfile = await agentProfileService.createProfile("admin", {
    name: "Screening Executor",
    roleKey: "subagent",
    moduleScope: ["screening"],
    manuscriptTypes: ["clinical_study"],
  });
  await agentProfileService.publishProfile(screeningAgentProfile.id, "admin");
  const editingAgentProfile = await agentProfileService.createProfile("admin", {
    name: "Editing Executor",
    roleKey: "subagent",
    moduleScope: ["editing"],
    manuscriptTypes: ["clinical_study"],
  });
  await agentProfileService.publishProfile(editingAgentProfile.id, "admin");
  const proofreadingAgentProfile = await agentProfileService.createProfile("admin", {
    name: "Proofreading Executor",
    roleKey: "subagent",
    moduleScope: ["proofreading"],
    manuscriptTypes: ["clinical_study"],
  });
  await agentProfileService.publishProfile(proofreadingAgentProfile.id, "admin");

  await manuscriptQualityPackageRepository.save({
    id: "quality-package-general-1",
    package_name: "Medical Research Style",
    package_kind: "general_style_package",
    target_scopes: ["general_proofreading"],
    version: 1,
    status: "published",
    manifest: {
      style_family: "medical_research_article",
    },
  });
  await manuscriptQualityPackageRepository.save({
    id: "quality-package-medical-1",
    package_name: "Medical Analyzer Default",
    package_kind: "medical_analyzer_package",
    target_scopes: ["medical_specialized"],
    version: 1,
    status: "published",
    manifest: {
      analyzer_family: "medical_default",
    },
  });

  const screeningBinding = await runtimeBindingService.createBinding("admin", {
    module: "screening",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    runtimeId: screeningRuntime.id,
    sandboxProfileId: screeningSandbox.id,
    agentProfileId: screeningAgentProfile.id,
    toolPermissionPolicyId: policy.id,
    promptTemplateId: "prompt-screening-1",
    skillPackageIds: [],
    qualityPackageVersionIds: [
      "quality-package-general-1",
      "quality-package-medical-1",
    ],
    executionProfileId: "profile-screening-1",
  });
  await runtimeBindingService.activateBinding(screeningBinding.id, "admin");
  const editingBinding = await runtimeBindingService.createBinding("admin", {
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    runtimeId: editingRuntime.id,
    sandboxProfileId: editingSandbox.id,
    agentProfileId: editingAgentProfile.id,
    toolPermissionPolicyId: policy.id,
    promptTemplateId: "prompt-editing-1",
    skillPackageIds: [],
    qualityPackageVersionIds: [
      "quality-package-general-1",
      "quality-package-medical-1",
    ],
    executionProfileId: "profile-editing-1",
  });
  await runtimeBindingService.activateBinding(editingBinding.id, "admin");
  const proofreadingBinding = await runtimeBindingService.createBinding("admin", {
    module: "proofreading",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    runtimeId: proofreadingRuntime.id,
    sandboxProfileId: proofreadingSandbox.id,
    agentProfileId: proofreadingAgentProfile.id,
    toolPermissionPolicyId: policy.id,
    promptTemplateId: "prompt-proofreading-1",
    skillPackageIds: [],
    qualityPackageVersionIds: [
      "quality-package-general-1",
      "quality-package-medical-1",
    ],
    executionProfileId: "profile-proofreading-1",
  });
  await runtimeBindingService.activateBinding(proofreadingBinding.id, "admin");

  return {
    manuscriptRepository,
    assetRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    executionGovernanceService,
    executionTrackingService,
    executionTrackingRepository,
    sandboxProfileService,
    agentProfileService,
    agentRuntimeService,
    runtimeBindingService,
    toolPermissionPolicyService,
    jobRepository,
    aiGatewayService,
    editorialRuleRepository,
    documentAssetService,
    agentExecutionService,
    agentExecutionRepository,
    originalAssetId: "asset-original-1",
  };
}
