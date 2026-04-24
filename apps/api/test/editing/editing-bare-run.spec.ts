import test from "node:test";
import assert from "node:assert/strict";
import { EditingService } from "../../src/modules/editing/editing-service.ts";
import { getBareModulePromptSkeleton } from "../../src/modules/shared/bare-module-prompt-skeletons.ts";
import { ModuleTemplateFamilyNotConfiguredError } from "../../src/modules/shared/module-run-support.ts";
import type {
  ExecuteMainlineAiInput,
  MainlineAiRuntimeExecutor,
} from "../../src/modules/shared/mainline-ai-runtime-executor.ts";
import { seedMedicalQualityFixture } from "../shared/medical-quality-fixture.ts";

test("editing bare mode succeeds without a current template family while governed mode still fails", async () => {
  const harness = await seedMedicalQualityFixture();
  const manuscript = await harness.manuscriptRepository.findById("manuscript-1");
  assert.ok(manuscript);
  await harness.manuscriptRepository.save({
    ...manuscript,
    current_template_family_id: undefined,
  });
  const editingExecutor: MainlineAiRuntimeExecutor = {
    async executeJson<T>(_input: ExecuteMainlineAiInput): Promise<T> {
      return {
        summary: "AI editing plan for bare mode.",
        replacements: [
          {
            targetText: "摘要 目的",
            replacementText: "（摘要 目的）",
            reason: "Normalize abstract heading punctuation.",
          },
        ],
        manualReviewItems: ["Verify the rewritten heading against the journal template."],
      } as T;
    },
    async executeMarkdown() {
      throw new Error("Editing runs should request structured JSON.");
    },
  };

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
    mainlineAiRuntimeExecutor: editingExecutor,
    editorialDocxTransformService: {
      async applyDeterministicRules() {
        return {
          appliedRuleIds: [],
          appliedChanges: [],
          tableInspectionFindings: [],
          skippedAiReplacements: [
            {
              replacementId: "ai-replacement-1",
              reason: "anchor_not_precise",
              targetText: "摘要 目的",
            },
          ],
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

  const bareSkeleton = getBareModulePromptSkeleton("editing");
  assert.equal(result.asset.asset_type, "edited_docx");
  assert.equal(result.template_id, bareSkeleton.templateId);
  assert.equal(result.model_id, "model-1");
  assert.equal(result.job.payload?.executionMode, "bare");
  assert.deepEqual(result.job.payload?.appliedRuleIds, []);
  const editingPayload = result.job.payload as
    | {
        editingPlan?: {
          summary?: string;
          replacements?: Array<{
            targetText?: string;
            replacementText?: string;
            reason?: string;
          }>;
          manualReviewItems?: unknown[];
        };
        skippedAiReplacements?: Array<{
          replacementId?: string;
          reason?: string;
          targetText?: string;
        }>;
      }
    | undefined;

  assert.ok(
    editingPayload?.editingPlan,
    "Expected editing bare runs to persist an AI replacement plan.",
  );
  assert.equal(
    editingPayload.editingPlan?.summary,
    "AI editing plan for bare mode.",
  );
  assert.deepEqual(editingPayload.editingPlan?.replacements, [
    {
      targetText: "摘要 目的",
      replacementText: "（摘要 目的）",
      reason: "Normalize abstract heading punctuation.",
    },
  ]);
  assert.deepEqual(editingPayload.editingPlan?.manualReviewItems, [
    "Verify the rewritten heading against the journal template.",
  ]);
  assert.deepEqual(editingPayload.skippedAiReplacements, [
    {
      replacementId: "ai-replacement-1",
      reason: "anchor_not_precise",
      targetText: "摘要 目的",
    },
  ]);
});
