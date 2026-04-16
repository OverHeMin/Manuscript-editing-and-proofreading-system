import test from "node:test";
import assert from "node:assert/strict";
import { ScreeningService } from "../../src/modules/screening/screening-service.ts";
import { ModuleTemplateFamilyNotConfiguredError } from "../../src/modules/shared/module-run-support.ts";
import { seedMedicalQualityFixture } from "../shared/medical-quality-fixture.ts";

test("screening bare mode succeeds without a current template family while governed mode still fails", async () => {
  const harness = await seedMedicalQualityFixture();
  const manuscript = await harness.manuscriptRepository.findById("manuscript-1");
  assert.ok(manuscript);
  await harness.manuscriptRepository.save({
    ...manuscript,
    current_template_family_id: undefined,
  });

  let nextJobId = 0;
  const screeningService = new ScreeningService({
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
    createId: () => `job-screening-bare-${++nextJobId}`,
    now: () => new Date("2026-04-16T10:30:00.000Z"),
  } as never);

  await assert.rejects(
    () =>
      screeningService.run({
        manuscriptId: "manuscript-1",
        parentAssetId: harness.originalAssetId,
        requestedBy: "screener-1",
        actorRole: "screener",
        storageKey: "runs/manuscript-1/screening/governed.md",
        fileName: "screening-governed.md",
      }),
    ModuleTemplateFamilyNotConfiguredError,
  );

  const result = await screeningService.run({
    manuscriptId: "manuscript-1",
    parentAssetId: harness.originalAssetId,
    requestedBy: "screener-1",
    actorRole: "screener",
    storageKey: "runs/manuscript-1/screening/bare.md",
    fileName: "screening-bare.md",
    executionMode: "bare",
  });

  assert.equal(result.asset.asset_type, "screening_report");
  assert.equal(result.template_id, "bare-screening-template");
  assert.equal(result.model_id, "model-1");
  assert.equal(result.job.payload?.executionMode, "bare");
});
