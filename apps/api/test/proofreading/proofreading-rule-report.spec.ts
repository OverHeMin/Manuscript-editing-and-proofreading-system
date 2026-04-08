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
import { ProofreadingService } from "../../src/modules/proofreading/proofreading-service.ts";
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

test("editing service persists bounded instruction payloads and manual-review items from the governed rule source", async () => {
  const harness = await seedHarness();
  const transformCalls: Array<Record<string, unknown>> = [];

  const editingService = new EditingService({
    manuscriptRepository: harness.manuscriptRepository,
    assetRepository: harness.assetRepository,
    moduleTemplateRepository: harness.moduleTemplateRepository,
    promptSkillRegistryRepository: harness.promptSkillRegistryRepository,
    knowledgeRepository: harness.knowledgeRepository,
    executionGovernanceService: harness.executionGovernanceService,
    executionTrackingService: {
      async recordSnapshot() {
        return {
          id: "snapshot-editing-1",
        };
      },
    } as never,
    jobRepository: harness.jobRepository,
    documentAssetService: {
      createScoped() {
        return {
          async createAsset(input: Record<string, unknown>) {
            return {
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
          },
        };
      },
    } as never,
    aiGatewayService: harness.aiGatewayService,
    sandboxProfileService: harness.sandboxProfileService,
    agentProfileService: harness.agentProfileService,
    agentRuntimeService: harness.agentRuntimeService,
    runtimeBindingService: harness.runtimeBindingService,
    toolPermissionPolicyService: harness.toolPermissionPolicyService,
    agentExecutionService: {
      async createLog() {
        return { id: "execution-log-editing-1" };
      },
      async completeLog() {
        return { id: "execution-log-editing-1" };
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
          appliedRuleIds: ["rule-abstract-objective-editing"],
          appliedChanges: [
            {
              ruleId: "rule-abstract-objective-editing",
              before: BEFORE_HEADING,
              after: AFTER_HEADING,
            },
          ],
        };
      },
    } as never,
    now: () => new Date("2026-04-07T10:00:00.000Z"),
    createId: () => "job-editing-1",
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
  assert.equal(result.job.payload?.instructionTemplateId, "prompt-editing-1");
  assert.equal(
    (result.job.payload?.instructionPayload as { templateKind: string }).templateKind,
    "editing_instruction",
  );
  assert.ok(
    (
      result.job.payload?.instructionPayload as {
        hardRuleSummary: string;
      }
    ).hardRuleSummary.includes(AFTER_HEADING),
  );
  assert.deepEqual(result.job.payload?.manualReviewItems, [
    {
      ruleId: "rule-discussion-reshape-editing",
      reason: "medical_meaning_risk",
    },
  ]);
  assert.deepEqual(result.job.payload?.contentRuleCandidates, [
    {
      ruleId: "rule-discussion-reshape-editing",
      reason: "medical_meaning_risk",
      severity: "warning",
      actionKind: "rewrite_content",
    },
  ]);
});

test("proofreading draft reports failed checks from the same rule source and never reports applied changes", async () => {
  const harness = await seedHarness();

  const proofreadingService = new ProofreadingService({
    manuscriptRepository: harness.manuscriptRepository,
    assetRepository: harness.assetRepository,
    moduleTemplateRepository: harness.moduleTemplateRepository,
    promptSkillRegistryRepository: harness.promptSkillRegistryRepository,
    knowledgeRepository: harness.knowledgeRepository,
    executionGovernanceService: harness.executionGovernanceService,
    executionTrackingService: {
      async recordSnapshot() {
        return {
          id: "snapshot-proofreading-1",
        };
      },
      async getSnapshot() {
        return undefined;
      },
      async listKnowledgeHitLogsBySnapshotId() {
        return [];
      },
    } as never,
    jobRepository: harness.jobRepository,
    documentAssetService: {
      createScoped() {
        return {
          async createAsset(input: Record<string, unknown>) {
            return {
              id: "asset-proofreading-report-1",
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
          },
        };
      },
    } as never,
    aiGatewayService: harness.aiGatewayService,
    sandboxProfileService: harness.sandboxProfileService,
    agentProfileService: harness.agentProfileService,
    agentRuntimeService: harness.agentRuntimeService,
    runtimeBindingService: harness.runtimeBindingService,
    toolPermissionPolicyService: harness.toolPermissionPolicyService,
    agentExecutionService: {
      async createLog() {
        return { id: "execution-log-proofreading-1" };
      },
      async completeLog() {
        return { id: "execution-log-proofreading-1" };
      },
    } as never,
    agentExecutionOrchestrationService: {
      async dispatchBestEffort() {
        return undefined;
      },
    } as never,
    proofreadingSourceBlockResolver: {
      async resolveBlocks() {
        return [
          {
            section: "abstract",
            block_kind: "heading",
            text: BEFORE_HEADING,
          },
        ];
      },
    } as never,
    now: () => new Date("2026-04-07T10:00:00.000Z"),
    createId: () => "job-proofreading-1",
  } as never);

  const result = await proofreadingService.createDraft({
    manuscriptId: "manuscript-1",
    parentAssetId: "asset-original-1",
    requestedBy: "proofreader-1",
    actorRole: "proofreader",
    storageKey: "proofreading/manuscript-1/draft-report.md",
    fileName: "draft-report.md",
  });

  assert.equal(
    (
      result.job.payload?.proofreadingFindings as {
        failedChecks: Array<{ expected: string }>;
      }
    ).failedChecks[0]?.expected,
    AFTER_HEADING,
  );
  assert.equal(
    (
      result.job.payload?.proofreadingFindings as {
        appliedChanges?: unknown[];
      }
    ).appliedChanges?.length ?? 0,
    0,
  );
  assert.match(
    String(result.job.payload?.reportMarkdown),
    /\uff08\u6458\u8981\u3000\u76ee\u7684\uff09/,
  );
});

test("proofreading draft report includes shared table semantic coordinates for matched table rules", async () => {
  const harness = await seedHarness();

  await harness.editorialRuleRepository.saveRule({
    id: "rule-table-treatment-group-proofreading",
    rule_set_id: "rule-set-proofreading-1",
    order_no: 20,
    rule_object: "table",
    rule_type: "format",
    execution_mode: "inspect",
    scope: {
      sections: ["results"],
    },
    selector: {
      semantic_target: "header_cell",
      header_path_includes: ["Treatment group", "n (%)"],
    },
    trigger: {
      kind: "table_shape",
      layout: "three_line_table",
    },
    action: {
      kind: "emit_finding",
      message: "Journal Beta checks the same semantic table header.",
    },
    authoring_payload: {},
    confidence_policy: "manual_only",
    severity: "warning",
    enabled: true,
  });

  const proofreadingService = new ProofreadingService({
    manuscriptRepository: harness.manuscriptRepository,
    assetRepository: harness.assetRepository,
    moduleTemplateRepository: harness.moduleTemplateRepository,
    promptSkillRegistryRepository: harness.promptSkillRegistryRepository,
    knowledgeRepository: harness.knowledgeRepository,
    executionGovernanceService: harness.executionGovernanceService,
    executionTrackingService: {
      async recordSnapshot() {
        return {
          id: "snapshot-proofreading-table-1",
        };
      },
      async getSnapshot() {
        return undefined;
      },
      async listKnowledgeHitLogsBySnapshotId() {
        return [];
      },
    } as never,
    jobRepository: harness.jobRepository,
    documentAssetService: {
      createScoped() {
        return {
          async createAsset(input: Record<string, unknown>) {
            return {
              id: "asset-proofreading-report-table-1",
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
          },
        };
      },
    } as never,
    aiGatewayService: harness.aiGatewayService,
    sandboxProfileService: harness.sandboxProfileService,
    agentProfileService: harness.agentProfileService,
    agentRuntimeService: harness.agentRuntimeService,
    runtimeBindingService: harness.runtimeBindingService,
    toolPermissionPolicyService: harness.toolPermissionPolicyService,
    agentExecutionService: {
      async createLog() {
        return { id: "execution-log-proofreading-table-1" };
      },
      async completeLog() {
        return { id: "execution-log-proofreading-table-1" };
      },
    } as never,
    agentExecutionOrchestrationService: {
      async dispatchBestEffort() {
        return undefined;
      },
    } as never,
    proofreadingSourceBlockResolver: {
      async resolveBlocks() {
        return [];
      },
    } as never,
    documentStructureService: {
      async extract() {
        return {
          manuscript_id: "manuscript-1",
          asset_id: "asset-original-1",
          file_name: "original.docx",
          status: "ready",
          parser: "python_docx",
          sections: [],
          tables: [
            {
              table_id: "table-1",
              profile: {
                is_three_line_table: true,
                header_depth: 2,
                has_stub_column: true,
                has_statistical_footnotes: true,
                has_unit_markers: true,
              },
              header_cells: [
                {
                  id: "header-1",
                  text: "n (%)",
                  row_index: 1,
                  column_index: 1,
                  header_path: ["Treatment group", "n (%)"],
                  coordinate: {
                    table_id: "table-1",
                    target: "header_cell",
                    header_path: ["Treatment group", "n (%)"],
                    column_key: "Treatment group > n (%)",
                  },
                },
              ],
              data_cells: [],
              footnote_items: [],
            },
          ],
          warnings: [],
        };
      },
    } as never,
    now: () => new Date("2026-04-07T10:00:00.000Z"),
    createId: () => "job-proofreading-table-1",
  } as never);

  const result = await proofreadingService.createDraft({
    manuscriptId: "manuscript-1",
    parentAssetId: "asset-original-1",
    requestedBy: "proofreader-1",
    actorRole: "proofreader",
    storageKey: "proofreading/manuscript-1/table-draft-report.md",
    fileName: "table-draft-report.md",
  });

  assert.equal(
    (
      result.job.payload?.proofreadingFindings as {
        failedChecks: Array<{
          semantic_hit?: { table_id: string; semantic_target: string };
        }>;
      }
    ).failedChecks.find(
      (check) => check.semantic_hit?.semantic_target === "header_cell",
    )?.semantic_hit?.table_id,
    "table-1",
  );
  assert.match(
    String(result.job.payload?.reportMarkdown),
    /Treatment group > n \(%\)/,
  );
});

async function seedHarness() {
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
    createId: (() => {
      const ids = ["sandbox-editing-1", "sandbox-proofreading-1"];
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
      const ids = ["agent-profile-editing-1", "agent-profile-proofreading-1"];
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
      const ids = ["runtime-editing-1", "runtime-proofreading-1"];
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
    createId: (() => {
      const ids = ["binding-editing-1", "binding-proofreading-1"];
      return () => {
        const value = ids.shift();
        assert.ok(value);
        return value;
      };
    })(),
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
    sandboxProfileService,
    agentProfileService,
    agentRuntimeService,
    runtimeBindingService,
    toolPermissionPolicyService,
    jobRepository,
    aiGatewayService,
    editorialRuleRepository,
  };
}
