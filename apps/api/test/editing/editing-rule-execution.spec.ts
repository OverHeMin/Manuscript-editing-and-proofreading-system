import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryAuditService } from "../../src/audit/audit-service.ts";
import { AiGatewayService } from "../../src/modules/ai-gateway/ai-gateway-service.ts";
import { InMemoryAgentProfileRepository } from "../../src/modules/agent-profiles/in-memory-agent-profile-repository.ts";
import { AgentProfileService } from "../../src/modules/agent-profiles/agent-profile-service.ts";
import { InMemoryAgentRuntimeRepository } from "../../src/modules/agent-runtime/in-memory-agent-runtime-repository.ts";
import { AgentRuntimeService } from "../../src/modules/agent-runtime/agent-runtime-service.ts";
import { InMemoryDocumentAssetRepository } from "../../src/modules/assets/in-memory-document-asset-repository.ts";
import { EditingService } from "../../src/modules/editing/editing-service.ts";
import { InMemoryEditorialRuleRepository } from "../../src/modules/editorial-rules/in-memory-editorial-rule-repository.ts";
import { InMemoryExecutionGovernanceRepository } from "../../src/modules/execution-governance/in-memory-execution-governance-repository.ts";
import { ExecutionGovernanceService } from "../../src/modules/execution-governance/execution-governance-service.ts";
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
import { InMemoryModuleTemplateRepository } from "../../src/modules/templates/in-memory-template-family-repository.ts";
import { InMemoryToolGatewayRepository } from "../../src/modules/tool-gateway/in-memory-tool-gateway-repository.ts";
import { ToolGatewayService } from "../../src/modules/tool-gateway/tool-gateway-service.ts";
import { InMemoryToolPermissionPolicyRepository } from "../../src/modules/tool-permission-policies/in-memory-tool-permission-policy-repository.ts";
import { ToolPermissionPolicyService } from "../../src/modules/tool-permission-policies/tool-permission-policy-service.ts";
import { InMemoryVerificationOpsRepository } from "../../src/modules/verification-ops/in-memory-verification-ops-repository.ts";

const BEFORE_HEADING = "\u6458\u8981 \u76ee\u7684";
const AFTER_HEADING = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09";

test("editing service resolves governed rules and persists deterministic changes into the job payload", async () => {
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const assetRepository = new InMemoryDocumentAssetRepository();
  const moduleTemplateRepository = new InMemoryModuleTemplateRepository();
  const promptSkillRegistryRepository = new InMemoryPromptSkillRegistryRepository();
  const knowledgeRepository = new InMemoryKnowledgeRepository();
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
    createId: () => "sandbox-1",
  });
  const agentProfileService = new AgentProfileService({
    repository: agentProfileRepository,
    createId: () => "agent-profile-1",
  });
  const agentRuntimeService = new AgentRuntimeService({
    repository: agentRuntimeRepository,
    createId: () => "runtime-1",
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
    createId: () => "binding-1",
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
      editing: "model-1",
    },
  });

  await manuscriptRepository.save({
    id: "manuscript-1",
    title: "Editing fixture",
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
    id: "template-editing-1",
    template_family_id: "family-1",
    module: "editing",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Editing template",
  });
  await promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-editing-1",
    name: "editing_mainline",
    version: "1.0.0",
    status: "published",
    module: "editing",
    manuscript_types: ["clinical_study"],
  });
  await editorialRuleRepository.saveRuleSet({
    id: "rule-set-1",
    template_family_id: "family-1",
    module: "editing",
    version_no: 1,
    status: "published",
  });
  await editorialRuleRepository.saveRule({
    id: "rule-abstract-objective",
    rule_set_id: "rule-set-1",
    order_no: 10,
    rule_type: "format",
    execution_mode: "apply_and_inspect",
    scope: {
      sections: ["abstract"],
      block_kind: "heading",
    },
    trigger: {
      kind: "exact_text",
      text: BEFORE_HEADING,
    },
    action: {
      kind: "replace_heading",
      to: AFTER_HEADING,
    },
    confidence_policy: "always_auto",
    severity: "error",
    enabled: true,
    example_before: BEFORE_HEADING,
    example_after: AFTER_HEADING,
  });
  await editorialRuleRepository.saveRule({
    id: "rule-discussion-reshape",
    rule_set_id: "rule-set-1",
    order_no: 20,
    rule_type: "content",
    execution_mode: "apply",
    scope: {
      sections: ["discussion"],
      block_kind: "paragraph",
    },
    trigger: {
      kind: "semantic_pattern",
      tag: "needs_clarity",
    },
    action: {
      kind: "rewrite_content",
    },
    confidence_policy: "high_confidence_only",
    severity: "warning",
    enabled: true,
  });
  await executionGovernanceRepository.saveProfile({
    id: "profile-1",
    module: "editing",
    manuscript_type: "clinical_study",
    template_family_id: "family-1",
    module_template_id: "template-editing-1",
    rule_set_id: "rule-set-1",
    prompt_template_id: "prompt-editing-1",
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
    name: "Editing Policy",
    allowedToolIds: [tool.id],
    highRiskToolIds: [],
  });
  await toolPermissionPolicyService.activatePolicy(policy.id, "admin");

  const sandboxProfile = await sandboxProfileService.createProfile("admin", {
    name: "Editing Sandbox",
    sandboxMode: "workspace_write",
    networkAccess: false,
    approvalRequired: true,
    allowedToolIds: [tool.id],
  });
  await sandboxProfileService.activateProfile(sandboxProfile.id, "admin");

  const runtime = await agentRuntimeService.createRuntime("admin", {
    name: "Editing Runtime",
    adapter: "deepagents",
    sandboxProfileId: sandboxProfile.id,
    allowedModules: ["editing"],
  });
  await agentRuntimeService.publishRuntime(runtime.id, "admin");

  const agentProfile = await agentProfileService.createProfile("admin", {
    name: "Editing Executor",
    roleKey: "subagent",
    moduleScope: ["editing"],
    manuscriptTypes: ["clinical_study"],
  });
  await agentProfileService.publishProfile(agentProfile.id, "admin");

  const binding = await runtimeBindingService.createBinding("admin", {
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    runtimeId: runtime.id,
    sandboxProfileId: sandboxProfile.id,
    agentProfileId: agentProfile.id,
    toolPermissionPolicyId: policy.id,
    promptTemplateId: "prompt-editing-1",
    skillPackageIds: [],
    executionProfileId: "profile-1",
  });
  await runtimeBindingService.activateBinding(binding.id, "admin");

  const transformCalls: Array<Record<string, unknown>> = [];
  const createdAssets: Array<Record<string, unknown>> = [];
  const editingService = new EditingService({
    manuscriptRepository,
    assetRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    executionGovernanceService,
    executionTrackingService: {
      async recordSnapshot() {
        return {
          id: "snapshot-1",
        };
      },
    } as never,
    jobRepository,
    documentAssetService: {
      createScoped() {
        return {
          async createAsset(input: Record<string, unknown>) {
            const asset = {
              id: "asset-edited-1",
              manuscript_id: input.manuscriptId,
              asset_type: input.assetType,
              status: "active",
              storage_key: input.storageKey,
              mime_type: input.mimeType,
              parent_asset_id: input.parentAssetId,
              source_module: input.sourceModule,
              source_job_id: input.sourceJobId,
              created_by: input.createdBy,
              version_no: 1,
              is_current: true,
              file_name: input.fileName,
              created_at: "2026-04-07T10:00:00.000Z",
              updated_at: "2026-04-07T10:00:00.000Z",
            };
            createdAssets.push(asset);
            return asset;
          },
        };
      },
    } as never,
    aiGatewayService,
    sandboxProfileService,
    agentProfileService,
    agentRuntimeService,
    runtimeBindingService,
    toolPermissionPolicyService,
    agentExecutionService: {
      async createLog() {
        return { id: "log-1" };
      },
      async completeLog() {
        return { id: "log-1" };
      },
    } as never,
    agentExecutionOrchestrationService: {
      async dispatchBestEffort() {
        return undefined;
      },
    } as never,
    editorialDocxTransformService: {
      async applyDeterministicRules(input: Record<string, unknown>) {
        transformCalls.push(input);
        return {
          appliedRuleIds: ["rule-abstract-objective"],
          appliedChanges: [
            {
              ruleId: "rule-abstract-objective",
              before: BEFORE_HEADING,
              after: AFTER_HEADING,
            },
          ],
        };
      },
    } as never,
    now: () => new Date("2026-04-07T10:00:00.000Z"),
    createId: () => "job-1",
  } as never);

  const result = await editingService.run({
    manuscriptId: "manuscript-1",
    parentAssetId: "asset-original-1",
    requestedBy: "editor-1",
    actorRole: "editor",
    storageKey: "edited/manuscript-1/output.docx",
    fileName: "output.docx",
  });

  assert.equal(transformCalls.length, 1);
  assert.deepEqual(transformCalls[0]?.rules, [
    {
      id: "rule-abstract-objective",
      rule_set_id: "rule-set-1",
      order_no: 10,
      rule_type: "format",
      execution_mode: "apply_and_inspect",
      scope: {
        sections: ["abstract"],
        block_kind: "heading",
      },
      trigger: {
        kind: "exact_text",
        text: BEFORE_HEADING,
      },
      action: {
        kind: "replace_heading",
        to: AFTER_HEADING,
      },
      confidence_policy: "always_auto",
      severity: "error",
      enabled: true,
      example_before: BEFORE_HEADING,
      example_after: AFTER_HEADING,
    },
    {
      id: "rule-discussion-reshape",
      rule_set_id: "rule-set-1",
      order_no: 20,
      rule_type: "content",
      execution_mode: "apply",
      scope: {
        sections: ["discussion"],
        block_kind: "paragraph",
      },
      trigger: {
        kind: "semantic_pattern",
        tag: "needs_clarity",
      },
      action: {
        kind: "rewrite_content",
      },
      confidence_policy: "high_confidence_only",
      severity: "warning",
      enabled: true,
    },
  ]);
  assert.deepEqual(result.job.payload?.appliedRuleIds, ["rule-abstract-objective"]);
  assert.deepEqual(result.job.payload?.appliedChanges, [
    {
      ruleId: "rule-abstract-objective",
      before: BEFORE_HEADING,
      after: AFTER_HEADING,
    },
  ]);
  assert.equal(createdAssets[0]?.storage_key, "edited/manuscript-1/output.docx");
  assert.equal(result.asset.id, "asset-edited-1");
});
