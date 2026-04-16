import test from "node:test";
import assert from "node:assert/strict";
import { EditingService } from "../../src/modules/editing/editing-service.ts";
import { ModuleTemplateFamilyNotConfiguredError } from "../../src/modules/shared/module-run-support.ts";
import { seedMedicalQualityFixture } from "../shared/medical-quality-fixture.ts";

test("editing bare mode succeeds without a current template family while governed mode still fails", async () => {
  const harness = await seedMedicalQualityFixture();
  const manuscript = await harness.manuscriptRepository.findById("manuscript-1");
  assert.ok(manuscript);
  await harness.manuscriptRepository.save({
    ...manuscript,
    current_template_family_id: undefined,
  });

  let nextJobId = 0;
  const editingService = new EditingService({
    manuscriptRepository: harness.manuscriptRepository,
    assetRepository: harness.assetRepository,
    moduleTemplateRepository: harness.moduleTemplateRepository,
    promptSkillRegistryRepository: harness.promptSkillRegistryRepository,
    knowledgeRepository: harness.knowledgeRepository,
    executionGovernanceService: harness.executionGovernanceService,
    executionTrackingService: harness.executionTrackingService,
    jobRepository: harness.jobRepository,
    documentAssetService: harness.documentAssetService,
    aiGatewayService: harness.aiGatewayService,
    sandboxProfileService: harness.sandboxProfileService,
    agentProfileService: harness.agentProfileService,
    agentRuntimeService: harness.agentRuntimeService,
    runtimeBindingService: harness.runtimeBindingService,
    toolPermissionPolicyService: harness.toolPermissionPolicyService,
    agentExecutionService: harness.agentExecutionService,
    agentExecutionOrchestrationService: {
      async dispatchBestEffort() {
        return undefined;
      },
    } as never,
    editorialDocxTransformService: {
      async applyDeterministicRules() {
        return {
          appliedRuleIds: [],
          appliedChanges: [],
          tableInspectionFindings: [],
        };
      },
    } as never,
    createId: () => `job-editing-bare-${++nextJobId}`,
    now: () => new Date("2026-04-16T10:35:00.000Z"),
  } as never);

  await assert.rejects(
    () =>
      editingService.run({
        manuscriptId: "manuscript-1",
        parentAssetId: harness.originalAssetId,
        requestedBy: "editor-1",
        actorRole: "editor",
        storageKey: "runs/manuscript-1/editing/governed.docx",
        fileName: "editing-governed.docx",
      }),
    ModuleTemplateFamilyNotConfiguredError,
  );

  const result = await editingService.run({
    manuscriptId: "manuscript-1",
    parentAssetId: harness.originalAssetId,
    requestedBy: "editor-1",
    actorRole: "editor",
    storageKey: "runs/manuscript-1/editing/bare.docx",
    fileName: "editing-bare.docx",
    executionMode: "bare",
  });

  assert.equal(result.asset.asset_type, "edited_docx");
  assert.equal(result.template_id, "bare-editing-template");
  assert.equal(result.model_id, "model-1");
  assert.equal(result.job.payload?.executionMode, "bare");
  assert.deepEqual(result.job.payload?.appliedRuleIds, []);
});
