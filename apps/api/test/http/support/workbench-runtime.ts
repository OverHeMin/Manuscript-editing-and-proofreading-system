import { once } from "node:events";
import type { AddressInfo } from "node:net";
import assert from "node:assert/strict";
import {
  createApiHttpServer,
  type ApiHttpServer,
} from "../../../src/http/api-http-server.ts";
import {
  createDemoHttpAuthRuntime,
  type DemoHttpAuthRuntime,
} from "../../../src/http/demo-auth-runtime.ts";
import { LocalAssetMaterializationService } from "../../../src/http/local-asset-materialization.ts";
import { InMemoryAuditService } from "../../../src/audit/audit-service.ts";
import { PermissionGuard } from "../../../src/auth/permission-guard.ts";
import { DocumentAssetService } from "../../../src/modules/assets/document-asset-service.ts";
import { InMemoryDocumentAssetRepository } from "../../../src/modules/assets/in-memory-document-asset-repository.ts";
import { AgentExecutionOrchestrationService } from "../../../src/modules/agent-execution/agent-execution-orchestration-service.ts";
import { AgentExecutionService } from "../../../src/modules/agent-execution/agent-execution-service.ts";
import { InMemoryAgentExecutionRepository } from "../../../src/modules/agent-execution/in-memory-agent-execution-repository.ts";
import { AgentProfileService } from "../../../src/modules/agent-profiles/agent-profile-service.ts";
import { InMemoryAgentProfileRepository } from "../../../src/modules/agent-profiles/in-memory-agent-profile-repository.ts";
import { AgentRuntimeService } from "../../../src/modules/agent-runtime/agent-runtime-service.ts";
import { InMemoryAgentRuntimeRepository } from "../../../src/modules/agent-runtime/in-memory-agent-runtime-repository.ts";
import { AiGatewayService } from "../../../src/modules/ai-gateway/ai-gateway-service.ts";
import { DocumentExportService } from "../../../src/modules/document-pipeline/document-export-service.ts";
import { createEditingApi } from "../../../src/modules/editing/editing-api.ts";
import { EditingService } from "../../../src/modules/editing/editing-service.ts";
import { InMemoryEditorialRuleRepository } from "../../../src/modules/editorial-rules/in-memory-editorial-rule-repository.ts";
import { InMemoryExecutionGovernanceRepository } from "../../../src/modules/execution-governance/in-memory-execution-governance-repository.ts";
import { ExecutionGovernanceService } from "../../../src/modules/execution-governance/execution-governance-service.ts";
import { ExecutionTrackingService } from "../../../src/modules/execution-tracking/execution-tracking-service.ts";
import { InMemoryExecutionTrackingRepository } from "../../../src/modules/execution-tracking/in-memory-execution-tracking-repository.ts";
import { InMemoryJobRepository } from "../../../src/modules/jobs/in-memory-job-repository.ts";
import { InMemoryKnowledgeRepository } from "../../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import { createManuscriptApi } from "../../../src/modules/manuscripts/manuscript-api.ts";
import { ManuscriptLifecycleService } from "../../../src/modules/manuscripts/manuscript-lifecycle-service.ts";
import { InMemoryManuscriptRepository } from "../../../src/modules/manuscripts/in-memory-manuscript-repository.ts";
import {
  InMemoryModelRegistryRepository,
  InMemoryModelRoutingPolicyRepository,
} from "../../../src/modules/model-registry/in-memory-model-registry-repository.ts";
import { InMemoryPromptSkillRegistryRepository } from "../../../src/modules/prompt-skill-registry/in-memory-prompt-skill-repository.ts";
import { createProofreadingApi } from "../../../src/modules/proofreading/proofreading-api.ts";
import { ProofreadingService } from "../../../src/modules/proofreading/proofreading-service.ts";
import { InMemoryRuntimeBindingRepository } from "../../../src/modules/runtime-bindings/in-memory-runtime-binding-repository.ts";
import { RuntimeBindingService } from "../../../src/modules/runtime-bindings/runtime-binding-service.ts";
import { InMemorySandboxProfileRepository } from "../../../src/modules/sandbox-profiles/in-memory-sandbox-profile-repository.ts";
import { SandboxProfileService } from "../../../src/modules/sandbox-profiles/sandbox-profile-service.ts";
import { createScreeningApi } from "../../../src/modules/screening/screening-api.ts";
import { ScreeningService } from "../../../src/modules/screening/screening-service.ts";
import { InMemoryModuleTemplateRepository } from "../../../src/modules/templates/in-memory-template-family-repository.ts";
import { InMemoryToolPermissionPolicyRepository } from "../../../src/modules/tool-permission-policies/in-memory-tool-permission-policy-repository.ts";
import { ToolPermissionPolicyService } from "../../../src/modules/tool-permission-policies/tool-permission-policy-service.ts";
import { InMemoryVerificationOpsRepository } from "../../../src/modules/verification-ops/in-memory-verification-ops-repository.ts";
import { createVerificationOpsApi } from "../../../src/modules/verification-ops/verification-ops-api.ts";
import { VerificationOpsService } from "../../../src/modules/verification-ops/verification-ops-service.ts";

export interface WorkbenchSeededIds {
  manuscriptId: string;
  originalAssetId: string;
  screeningSuiteId: string;
  editingSuiteId: string;
  proofreadingSuiteId: string;
  screeningKnowledgeId: string;
  editingKnowledgeId: string;
  proofreadingKnowledgeId: string;
  screeningModelId: string;
  editingModelId: string;
  proofreadingModelId: string;
}

export interface WorkbenchRuntimeBundle {
  authRuntime: DemoHttpAuthRuntime;
  permissionGuard: PermissionGuard;
  manuscriptApi: ReturnType<typeof createManuscriptApi>;
  documentPipelineApi: {
    exportCurrentAsset: (input: {
      manuscriptId: string;
      preferredAssetType?: string;
    }) => Promise<{
      status: number;
      body: {
        manuscript_id: string;
        asset: {
          id: string;
          storage_key: string;
          mime_type: string;
          file_name?: string;
        };
        download: {
          storage_key: string;
          file_name?: string;
          mime_type: string;
          url: string;
        };
      };
    }>;
    downloadAsset: (input: {
      assetId: string;
      uploadRootDir: string;
    }) => Promise<{
      status: number;
      body: null;
      rawBody: Buffer;
      headers: Record<string, string>;
    }>;
  };
  screeningApi: ReturnType<typeof createScreeningApi>;
  editingApi: ReturnType<typeof createEditingApi>;
  proofreadingApi: ReturnType<typeof createProofreadingApi>;
  verificationOpsApi: ReturnType<typeof createVerificationOpsApi>;
  seededIds: WorkbenchSeededIds;
}

export async function startWorkbenchServer(input: {
  uploadRootDir?: string;
} = {}): Promise<{
  server: ApiHttpServer;
  baseUrl: string;
  seededIds: WorkbenchSeededIds;
}> {
  const runtime = createWorkbenchRuntime();
  const server = createApiHttpServer({
    appEnv: "local",
    allowedOrigins: ["http://127.0.0.1:4173"],
    runtime: runtime as never,
    uploadRootDir: input.uploadRootDir,
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  assert.ok(address && typeof address !== "string", "Expected a tcp server address.");

  return {
    server,
    baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
    seededIds: runtime.seededIds,
  };
}

export async function stopServer(server: ApiHttpServer): Promise<void> {
  if (!server.listening) {
    return;
  }

  server.close();
  await once(server, "close");
}

export async function loginAsDemoUser(
  baseUrl: string,
  username: string,
): Promise<string> {
  const response = await fetch(`${baseUrl}/api/v1/auth/local/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password: "demo-password",
    }),
  });

  assert.equal(response.status, 200);
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, "Expected auth login to return a session cookie.");
  return setCookie.split(";")[0] ?? "";
}

export function createWorkbenchRuntime(): WorkbenchRuntimeBundle {
  const authRuntime = createDemoHttpAuthRuntime();
  const permissionGuard = new PermissionGuard();
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const assetRepository = new InMemoryDocumentAssetRepository();
  const jobRepository = new InMemoryJobRepository();
  const knowledgeRepository = new InMemoryKnowledgeRepository();
  const editorialRuleRepository = new InMemoryEditorialRuleRepository();
  const moduleTemplateRepository = new InMemoryModuleTemplateRepository();
  const promptSkillRegistryRepository = new InMemoryPromptSkillRegistryRepository();
  const executionGovernanceRepository = new InMemoryExecutionGovernanceRepository();
  const executionTrackingRepository = new InMemoryExecutionTrackingRepository();
  const sandboxProfileRepository = new InMemorySandboxProfileRepository();
  const agentProfileRepository = new InMemoryAgentProfileRepository();
  const agentRuntimeRepository = new InMemoryAgentRuntimeRepository();
  const runtimeBindingRepository = new InMemoryRuntimeBindingRepository();
  const toolPermissionPolicyRepository =
    new InMemoryToolPermissionPolicyRepository();
  const verificationOpsRepository = new InMemoryVerificationOpsRepository();
  const agentExecutionRepository = new InMemoryAgentExecutionRepository();
  const modelRepository = new InMemoryModelRegistryRepository();
  const routingPolicyRepository = new InMemoryModelRoutingPolicyRepository();
  const auditService = new InMemoryAuditService();

  const counters = new Map<string, number>();
  const nextId = (prefix: string) => {
    const nextValue = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, nextValue);
    return `${prefix}-${nextValue}`;
  };

  const sandboxProfileService = new SandboxProfileService({
    repository: sandboxProfileRepository,
  });
  const agentProfileService = new AgentProfileService({
    repository: agentProfileRepository,
  });
  const agentRuntimeService = new AgentRuntimeService({
    repository: agentRuntimeRepository,
  });
  const toolPermissionPolicyService = new ToolPermissionPolicyService({
    repository: toolPermissionPolicyRepository,
    toolGatewayRepository: {
      save: async () => undefined,
      findById: async () => undefined,
      list: async () => [],
      listByScope: async () => [],
    },
  });
  const runtimeBindingService = new RuntimeBindingService({
    repository: runtimeBindingRepository,
    agentRuntimeRepository,
    sandboxProfileRepository,
    agentProfileRepository,
    toolPermissionPolicyRepository,
    promptSkillRegistryRepository,
    verificationOpsRepository,
  });
  const documentAssetService = new DocumentAssetService({
    assetRepository,
    manuscriptRepository,
    createId: () => nextId("asset"),
    now: () => new Date("2026-03-31T08:00:00.000Z"),
  });
  const manuscriptApi = createManuscriptApi({
    manuscriptService: new ManuscriptLifecycleService({
      manuscriptRepository,
      assetRepository,
      jobRepository,
      createId: () => nextId("upload"),
      now: () => new Date("2026-03-31T08:00:00.000Z"),
    }),
    assetService: documentAssetService,
  });
  const exportService = new DocumentExportService({
    assetRepository,
    manuscriptRepository,
  });
  const aiGatewayService = new AiGatewayService({
    repository: modelRepository,
    routingPolicyRepository,
    auditService,
    now: () => new Date("2026-03-31T08:00:00.000Z"),
  });
  const executionGovernanceService = new ExecutionGovernanceService({
    repository: executionGovernanceRepository,
    editorialRuleRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
  });
  const executionTrackingService = new ExecutionTrackingService({
    repository: executionTrackingRepository,
    createId: () => nextId("snapshot"),
    now: () => new Date("2026-03-31T08:00:00.000Z"),
  });
  const agentExecutionService = new AgentExecutionService({
    repository: agentExecutionRepository,
    createId: () => nextId("execution"),
    now: () => new Date("2026-03-31T08:00:00.000Z"),
  });
  const verificationOpsService = new VerificationOpsService({
    repository: verificationOpsRepository,
    toolGatewayRepository: {
      save: async () => undefined,
      findById: async () => undefined,
      list: async () => [],
      listByScope: async () => [],
    },
    createId: () => nextId("evaluation-run"),
    now: () => new Date("2026-03-31T08:00:00.000Z"),
  });
  const agentExecutionOrchestrationService =
    new AgentExecutionOrchestrationService({
      agentExecutionService,
      executionTrackingService,
      verificationOpsService,
      now: () => new Date("2026-03-31T08:05:00.000Z"),
    });

  seedWorkbenchGovernance({
    manuscriptRepository,
    assetRepository,
    knowledgeRepository,
    editorialRuleRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    executionGovernanceRepository,
    sandboxProfileRepository,
    agentProfileRepository,
    agentRuntimeRepository,
    runtimeBindingRepository,
    toolPermissionPolicyRepository,
    verificationOpsRepository,
    modelRepository,
    routingPolicyRepository,
  });

  return {
    authRuntime,
    permissionGuard,
    manuscriptApi,
    documentPipelineApi: {
      async exportCurrentAsset(input) {
        return {
          status: 200,
          body: await exportService.exportCurrentAsset({
            manuscriptId: input.manuscriptId,
            preferredAssetType: input.preferredAssetType as never,
          }),
        };
      },
      async downloadAsset(input) {
        const downloadService = new LocalAssetMaterializationService({
          assetRepository,
          manuscriptRepository,
          rootDir: input.uploadRootDir,
        });
        const download = await downloadService.downloadAsset(input.assetId);

        return {
          status: 200,
          body: null,
          rawBody: download.bytes,
          headers: {
            "Content-Type": download.mimeType,
            "Content-Length": String(download.bytes.byteLength),
            "Content-Disposition": `attachment; filename="${download.fileName.replace(/["\\\\]/g, "-")}"`,
            "Cache-Control": "no-store",
          },
        };
      },
    },
    screeningApi: createScreeningApi({
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
        agentExecutionOrchestrationService,
        createId: () => nextId("job-screening"),
        now: () => new Date("2026-03-31T08:00:00.000Z"),
      }),
    }),
    editingApi: createEditingApi({
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
        agentExecutionOrchestrationService,
        createId: () => nextId("job-editing"),
        now: () => new Date("2026-03-31T08:00:00.000Z"),
      }),
    }),
    proofreadingApi: createProofreadingApi({
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
        agentExecutionOrchestrationService,
        createId: () => nextId("job-proofreading"),
        now: () => new Date("2026-03-31T08:00:00.000Z"),
      }),
    }),
    verificationOpsApi: createVerificationOpsApi({
      verificationOpsService,
    }),
    seededIds: {
      manuscriptId: "manuscript-seeded-1",
      originalAssetId: "original-seeded-1",
      screeningSuiteId: "suite-screening-1",
      editingSuiteId: "suite-editing-1",
      proofreadingSuiteId: "suite-proofreading-1",
      screeningKnowledgeId: "knowledge-screening-1",
      editingKnowledgeId: "knowledge-editing-1",
      proofreadingKnowledgeId: "knowledge-proofreading-1",
      screeningModelId: "model-screening-1",
      editingModelId: "model-editing-1",
      proofreadingModelId: "model-proofreading-1",
    },
  };
}

function seedWorkbenchGovernance(input: {
  manuscriptRepository: InMemoryManuscriptRepository;
  assetRepository: InMemoryDocumentAssetRepository;
  knowledgeRepository: InMemoryKnowledgeRepository;
  editorialRuleRepository: InMemoryEditorialRuleRepository;
  moduleTemplateRepository: InMemoryModuleTemplateRepository;
  promptSkillRegistryRepository: InMemoryPromptSkillRegistryRepository;
  executionGovernanceRepository: InMemoryExecutionGovernanceRepository;
  sandboxProfileRepository: InMemorySandboxProfileRepository;
  agentProfileRepository: InMemoryAgentProfileRepository;
  agentRuntimeRepository: InMemoryAgentRuntimeRepository;
  runtimeBindingRepository: InMemoryRuntimeBindingRepository;
  toolPermissionPolicyRepository: InMemoryToolPermissionPolicyRepository;
  verificationOpsRepository: InMemoryVerificationOpsRepository;
  modelRepository: InMemoryModelRegistryRepository;
  routingPolicyRepository: InMemoryModelRoutingPolicyRepository;
}): void {
  void input.manuscriptRepository.save({
    id: "manuscript-seeded-1",
    title: "Seeded Workbench Manuscript",
    manuscript_type: "clinical_study",
    status: "uploaded",
    created_by: "seed-user",
    current_screening_asset_id: undefined,
    current_editing_asset_id: undefined,
    current_proofreading_asset_id: undefined,
    current_template_family_id: "family-seeded-1",
    created_at: "2026-03-31T07:55:00.000Z",
    updated_at: "2026-03-31T07:55:00.000Z",
  });
  void input.assetRepository.save({
    id: "original-seeded-1",
    manuscript_id: "manuscript-seeded-1",
    asset_type: "original",
    status: "active",
    storage_key: "uploads/seeded/original.docx",
    mime_type:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    parent_asset_id: undefined,
    source_module: "upload",
    source_job_id: undefined,
    created_by: "seed-user",
    version_no: 1,
    is_current: true,
    file_name: "seeded-original.docx",
    created_at: "2026-03-31T07:56:00.000Z",
    updated_at: "2026-03-31T07:56:00.000Z",
  });

  void input.moduleTemplateRepository.save({
    id: "template-screening-1",
    template_family_id: "family-seeded-1",
    module: "screening",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Seeded screening prompt",
  });
  void input.moduleTemplateRepository.save({
    id: "template-editing-1",
    template_family_id: "family-seeded-1",
    module: "editing",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Seeded editing prompt",
  });
  void input.moduleTemplateRepository.save({
    id: "template-proofreading-1",
    template_family_id: "family-seeded-1",
    module: "proofreading",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Seeded proofreading prompt",
  });

  void input.promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-screening-1",
    name: "screening_mainline",
    version: "1.0.0",
    status: "published",
    module: "screening",
    manuscript_types: ["clinical_study"],
  });
  void input.promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-editing-1",
    name: "editing_mainline",
    version: "1.0.0",
    status: "published",
    module: "editing",
    manuscript_types: ["clinical_study"],
  });
  void input.promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-proofreading-1",
    name: "proofreading_mainline",
    version: "1.0.0",
    status: "published",
    module: "proofreading",
    manuscript_types: ["clinical_study"],
  });
  void input.promptSkillRegistryRepository.saveSkillPackage({
    id: "skill-screening-1",
    name: "screening_skills",
    version: "1.0.0",
    scope: "admin_only",
    status: "published",
    applies_to_modules: ["screening"],
  });
  void input.promptSkillRegistryRepository.saveSkillPackage({
    id: "skill-editing-1",
    name: "editing_skills",
    version: "1.0.0",
    scope: "admin_only",
    status: "published",
    applies_to_modules: ["editing"],
  });
  void input.promptSkillRegistryRepository.saveSkillPackage({
    id: "skill-proofreading-1",
    name: "proofreading_skills",
    version: "1.0.0",
    scope: "admin_only",
    status: "published",
    applies_to_modules: ["proofreading"],
  });

  void input.knowledgeRepository.save({
    id: "knowledge-screening-1",
    title: "Screening knowledge",
    canonical_text: "Check endpoint definitions.",
    knowledge_kind: "rule",
    status: "approved",
    routing: {
      module_scope: "screening",
      manuscript_types: ["clinical_study"],
    },
    template_bindings: ["template-screening-1"],
  });
  void input.knowledgeRepository.save({
    id: "knowledge-editing-1",
    title: "Editing knowledge",
    canonical_text: "Normalize manuscript terminology.",
    knowledge_kind: "rule",
    status: "approved",
    routing: {
      module_scope: "editing",
      manuscript_types: ["clinical_study"],
    },
    template_bindings: ["template-editing-1"],
  });
  void input.knowledgeRepository.save({
    id: "knowledge-proofreading-1",
    title: "Proofreading knowledge",
    canonical_text: "Confirm punctuation consistency.",
    knowledge_kind: "checklist",
    status: "approved",
    routing: {
      module_scope: "proofreading",
      manuscript_types: ["clinical_study"],
    },
    template_bindings: ["template-proofreading-1"],
  });

  void input.editorialRuleRepository.saveRuleSet({
    id: "rule-set-screening-1",
    template_family_id: "family-seeded-1",
    module: "screening",
    version_no: 1,
    status: "published",
  });
  void input.editorialRuleRepository.saveRuleSet({
    id: "rule-set-editing-1",
    template_family_id: "family-seeded-1",
    module: "editing",
    version_no: 1,
    status: "published",
  });
  void input.editorialRuleRepository.saveRuleSet({
    id: "rule-set-proofreading-1",
    template_family_id: "family-seeded-1",
    module: "proofreading",
    version_no: 1,
    status: "published",
  });

  void input.executionGovernanceRepository.saveProfile({
    id: "profile-screening-1",
    module: "screening",
    manuscript_type: "clinical_study",
    template_family_id: "family-seeded-1",
    module_template_id: "template-screening-1",
    rule_set_id: "rule-set-screening-1",
    prompt_template_id: "prompt-screening-1",
    skill_package_ids: ["skill-screening-1"],
    knowledge_binding_mode: "profile_plus_dynamic",
    status: "active",
    version: 1,
  });
  void input.executionGovernanceRepository.saveProfile({
    id: "profile-editing-1",
    module: "editing",
    manuscript_type: "clinical_study",
    template_family_id: "family-seeded-1",
    module_template_id: "template-editing-1",
    rule_set_id: "rule-set-editing-1",
    prompt_template_id: "prompt-editing-1",
    skill_package_ids: ["skill-editing-1"],
    knowledge_binding_mode: "profile_plus_dynamic",
    status: "active",
    version: 1,
  });
  void input.executionGovernanceRepository.saveProfile({
    id: "profile-proofreading-1",
    module: "proofreading",
    manuscript_type: "clinical_study",
    template_family_id: "family-seeded-1",
    module_template_id: "template-proofreading-1",
    rule_set_id: "rule-set-proofreading-1",
    prompt_template_id: "prompt-proofreading-1",
    skill_package_ids: ["skill-proofreading-1"],
    knowledge_binding_mode: "profile_plus_dynamic",
    status: "active",
    version: 1,
  });

  void input.verificationOpsRepository.saveVerificationCheckProfile({
    id: "check-profile-screening-1",
    name: "Screening Browser QA",
    check_type: "browser_qa",
    status: "published",
    tool_ids: [],
    admin_only: true,
  });
  void input.verificationOpsRepository.saveVerificationCheckProfile({
    id: "check-profile-editing-1",
    name: "Editing Browser QA",
    check_type: "browser_qa",
    status: "published",
    tool_ids: [],
    admin_only: true,
  });
  void input.verificationOpsRepository.saveVerificationCheckProfile({
    id: "check-profile-proofreading-1",
    name: "Proofreading Browser QA",
    check_type: "browser_qa",
    status: "published",
    tool_ids: [],
    admin_only: true,
  });
  void input.verificationOpsRepository.saveReleaseCheckProfile({
    id: "release-profile-screening-1",
    name: "Screening Release Gate",
    check_type: "deploy_verification",
    status: "published",
    verification_check_profile_ids: ["check-profile-screening-1"],
    admin_only: true,
  });
  void input.verificationOpsRepository.saveReleaseCheckProfile({
    id: "release-profile-editing-1",
    name: "Editing Release Gate",
    check_type: "deploy_verification",
    status: "published",
    verification_check_profile_ids: ["check-profile-editing-1"],
    admin_only: true,
  });
  void input.verificationOpsRepository.saveReleaseCheckProfile({
    id: "release-profile-proofreading-1",
    name: "Proofreading Release Gate",
    check_type: "deploy_verification",
    status: "published",
    verification_check_profile_ids: ["check-profile-proofreading-1"],
    admin_only: true,
  });
  void input.verificationOpsRepository.saveEvaluationSuite({
    id: "suite-screening-1",
    name: "Screening Governed Evaluation",
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
  void input.verificationOpsRepository.saveEvaluationSuite({
    id: "suite-editing-1",
    name: "Editing Governed Evaluation",
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
  void input.verificationOpsRepository.saveEvaluationSuite({
    id: "suite-proofreading-1",
    name: "Proofreading Governed Evaluation",
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

  void input.sandboxProfileRepository.save({
    id: "sandbox-screening-1",
    name: "Screening Sandbox",
    status: "active",
    sandbox_mode: "workspace_write",
    network_access: false,
    approval_required: true,
    allowed_tool_ids: [],
    admin_only: true,
  });
  void input.sandboxProfileRepository.save({
    id: "sandbox-editing-1",
    name: "Editing Sandbox",
    status: "active",
    sandbox_mode: "workspace_write",
    network_access: false,
    approval_required: true,
    allowed_tool_ids: [],
    admin_only: true,
  });
  void input.sandboxProfileRepository.save({
    id: "sandbox-proofreading-1",
    name: "Proofreading Sandbox",
    status: "active",
    sandbox_mode: "workspace_write",
    network_access: false,
    approval_required: true,
    allowed_tool_ids: [],
    admin_only: true,
  });

  void input.agentRuntimeRepository.save({
    id: "runtime-screening-1",
    name: "Screening Runtime",
    adapter: "deepagents",
    status: "active",
    sandbox_profile_id: "sandbox-screening-1",
    allowed_modules: ["screening"],
    runtime_slot: "screening",
    admin_only: true,
  });
  void input.agentRuntimeRepository.save({
    id: "runtime-editing-1",
    name: "Editing Runtime",
    adapter: "deepagents",
    status: "active",
    sandbox_profile_id: "sandbox-editing-1",
    allowed_modules: ["editing"],
    runtime_slot: "editing",
    admin_only: true,
  });
  void input.agentRuntimeRepository.save({
    id: "runtime-proofreading-1",
    name: "Proofreading Runtime",
    adapter: "deepagents",
    status: "active",
    sandbox_profile_id: "sandbox-proofreading-1",
    allowed_modules: ["proofreading"],
    runtime_slot: "proofreading",
    admin_only: true,
  });

  void input.agentProfileRepository.save({
    id: "agent-profile-screening-1",
    name: "Screening Executor",
    role_key: "subagent",
    status: "published",
    module_scope: ["screening"],
    manuscript_types: ["clinical_study"],
    admin_only: true,
  });
  void input.agentProfileRepository.save({
    id: "agent-profile-editing-1",
    name: "Editing Executor",
    role_key: "subagent",
    status: "published",
    module_scope: ["editing"],
    manuscript_types: ["clinical_study"],
    admin_only: true,
  });
  void input.agentProfileRepository.save({
    id: "agent-profile-proofreading-1",
    name: "Proofreading Executor",
    role_key: "subagent",
    status: "published",
    module_scope: ["proofreading"],
    manuscript_types: ["clinical_study"],
    admin_only: true,
  });

  void input.toolPermissionPolicyRepository.save({
    id: "policy-screening-1",
    name: "Screening Policy",
    status: "active",
    default_mode: "read",
    allowed_tool_ids: [],
    high_risk_tool_ids: [],
    write_requires_confirmation: false,
    admin_only: true,
  });
  void input.toolPermissionPolicyRepository.save({
    id: "policy-editing-1",
    name: "Editing Policy",
    status: "active",
    default_mode: "read",
    allowed_tool_ids: [],
    high_risk_tool_ids: [],
    write_requires_confirmation: false,
    admin_only: true,
  });
  void input.toolPermissionPolicyRepository.save({
    id: "policy-proofreading-1",
    name: "Proofreading Policy",
    status: "active",
    default_mode: "read",
    allowed_tool_ids: [],
    high_risk_tool_ids: [],
    write_requires_confirmation: false,
    admin_only: true,
  });

  void input.runtimeBindingRepository.save({
    id: "binding-screening-1",
    module: "screening",
    manuscript_type: "clinical_study",
    template_family_id: "family-seeded-1",
    runtime_id: "runtime-screening-1",
    sandbox_profile_id: "sandbox-screening-1",
    agent_profile_id: "agent-profile-screening-1",
    tool_permission_policy_id: "policy-screening-1",
    prompt_template_id: "prompt-screening-1",
    skill_package_ids: ["skill-screening-1"],
    execution_profile_id: "profile-screening-1",
    verification_check_profile_ids: ["check-profile-screening-1"],
    evaluation_suite_ids: ["suite-screening-1"],
    release_check_profile_id: "release-profile-screening-1",
    status: "active",
    version: 1,
  });
  void input.runtimeBindingRepository.save({
    id: "binding-editing-1",
    module: "editing",
    manuscript_type: "clinical_study",
    template_family_id: "family-seeded-1",
    runtime_id: "runtime-editing-1",
    sandbox_profile_id: "sandbox-editing-1",
    agent_profile_id: "agent-profile-editing-1",
    tool_permission_policy_id: "policy-editing-1",
    prompt_template_id: "prompt-editing-1",
    skill_package_ids: ["skill-editing-1"],
    execution_profile_id: "profile-editing-1",
    verification_check_profile_ids: ["check-profile-editing-1"],
    evaluation_suite_ids: ["suite-editing-1"],
    release_check_profile_id: "release-profile-editing-1",
    status: "active",
    version: 1,
  });
  void input.runtimeBindingRepository.save({
    id: "binding-proofreading-1",
    module: "proofreading",
    manuscript_type: "clinical_study",
    template_family_id: "family-seeded-1",
    runtime_id: "runtime-proofreading-1",
    sandbox_profile_id: "sandbox-proofreading-1",
    agent_profile_id: "agent-profile-proofreading-1",
    tool_permission_policy_id: "policy-proofreading-1",
    prompt_template_id: "prompt-proofreading-1",
    skill_package_ids: ["skill-proofreading-1"],
    execution_profile_id: "profile-proofreading-1",
    verification_check_profile_ids: ["check-profile-proofreading-1"],
    evaluation_suite_ids: ["suite-proofreading-1"],
    release_check_profile_id: "release-profile-proofreading-1",
    status: "active",
    version: 1,
  });

  void input.modelRepository.save({
    id: "model-screening-1",
    provider: "openai",
    model_name: "screening-model",
    model_version: "2026-03-31",
    allowed_modules: ["screening"],
    is_prod_allowed: true,
  });
  void input.modelRepository.save({
    id: "model-editing-1",
    provider: "openai",
    model_name: "editing-model",
    model_version: "2026-03-31",
    allowed_modules: ["editing"],
    is_prod_allowed: true,
  });
  void input.modelRepository.save({
    id: "model-proofreading-1",
    provider: "openai",
    model_name: "proofreading-model",
    model_version: "2026-03-31",
    allowed_modules: ["proofreading"],
    is_prod_allowed: true,
  });
  void input.routingPolicyRepository.save({
    system_default_model_id: undefined,
    module_defaults: {
      screening: "model-screening-1",
      editing: "model-editing-1",
      proofreading: "model-proofreading-1",
    },
    template_overrides: {},
  });
}
