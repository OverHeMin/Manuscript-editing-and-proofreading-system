import test from "node:test";
import assert from "node:assert/strict";
import { ProofreadingService } from "../../src/modules/proofreading/proofreading-service.ts";
import { InMemoryResidualIssueRepository } from "../../src/modules/residual-learning/in-memory-residual-learning-repository.ts";
import { ResidualLearningService } from "../../src/modules/residual-learning/residual-learning-service.ts";
import { ModuleTemplateFamilyNotConfiguredError } from "../../src/modules/shared/module-run-support.ts";
import type { MainlineAiRuntimeExecutor } from "../../src/modules/shared/mainline-ai-runtime-executor.ts";
import { seedMedicalQualityFixture } from "../shared/medical-quality-fixture.ts";

test("proofreading bare mode draft succeeds without a current template family while governed mode still fails", async () => {
  const harness = await seedMedicalQualityFixture();
  const residualIssueRepository = new InMemoryResidualIssueRepository();
  const residualLearningService = new ResidualLearningService({
    residualIssueRepository,
    createId: () => "residual-proofreading-bare-1",
    now: () => new Date("2026-04-18T10:20:00.000Z"),
  });
  const manuscript = await harness.manuscriptRepository.findById("manuscript-1");
  assert.ok(manuscript);
  await harness.manuscriptRepository.save({
    ...manuscript,
    current_template_family_id: undefined,
  });

  let nextJobId = 0;
  const proofreadingExecutor: MainlineAiRuntimeExecutor = {
    async executeJson() {
      return {
        summary: "AI proofreading plan for bare mode.",
        corrections: [
          {
            targetText: "5 mg per dL",
            replacementText: "5 mg/dL",
            category: "style",
          },
        ],
        manualReviewItems: [
          "Verify the normalized unit against the source table before release.",
        ],
      };
    },
    async executeMarkdown() {
      throw new Error("Proofreading runs should request structured JSON.");
    },
  };
  const proofreadingService = new ProofreadingService({
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
    mainlineAiRuntimeExecutor: proofreadingExecutor,
    editorialDocxTransformService: {
      async applyDeterministicRules() {
        return {
          appliedRuleIds: ["proofreading-correction-1"],
          appliedChanges: [
            {
              ruleId: "proofreading-correction-1",
              before: "5 mg per dL",
              after: "5 mg/dL",
            },
          ],
          tableInspectionFindings: [],
        };
      },
    } as never,
    residualLearningService,
    proofreadingSourceBlockResolver: {
      async resolveBlocks() {
        return [
          {
            section: "results",
            block_kind: "paragraph",
            text: "Dose was 5 mg per dL in the bare proofreading report.",
            residualHints: [
              {
                issue_type: "unit_expression_gap",
                excerpt: "5 mg per dL",
                suggestion: "Normalize the unit expression to mg/dL.",
                rationale: "This is a repeatable formatting pattern.",
                model_confidence: 0.86,
              },
            ],
          },
        ];
      },
    } as never,
    createId: () => `job-proofreading-bare-${++nextJobId}`,
    now: () => new Date("2026-04-16T10:40:00.000Z"),
  } as never);

  await assert.rejects(
    () =>
      proofreadingService.createDraft({
        manuscriptId: "manuscript-1",
        parentAssetId: harness.originalAssetId,
        requestedBy: "proofreader-1",
        actorRole: "proofreader",
        storageKey: "runs/manuscript-1/proofreading/governed.md",
        fileName: "proofreading-governed.md",
      }),
    ModuleTemplateFamilyNotConfiguredError,
  );

  const result = await proofreadingService.createDraft({
    manuscriptId: "manuscript-1",
    parentAssetId: harness.originalAssetId,
    requestedBy: "proofreader-1",
    actorRole: "proofreader",
    storageKey: "runs/manuscript-1/proofreading/bare.md",
    fileName: "proofreading-bare.md",
    executionMode: "bare",
  });

  assert.equal(result.asset.asset_type, "proofreading_draft_report");
  assert.equal(result.template_id, "bare-proofreading-template");
  assert.equal(result.model_id, "model-1");
  assert.equal(result.job.payload?.executionMode, "bare");
  const proofreadingPayload = result.job.payload as
    | {
        reportMarkdown?: string;
        proofreadingPlan?: {
          summary?: string;
          corrections?: Array<{
            targetText?: string;
            replacementText?: string;
            category?: string;
          }>;
          manualReviewItems?: unknown[];
        };
      }
    | undefined;

  assert.match(proofreadingPayload?.reportMarkdown ?? "", /\S/u);
  assert.ok(
    proofreadingPayload?.proofreadingPlan,
    "Expected proofreading bare runs to persist an AI correction plan.",
  );
  assert.equal(
    proofreadingPayload.proofreadingPlan?.summary,
    "AI proofreading plan for bare mode.",
  );
  assert.deepEqual(proofreadingPayload.proofreadingPlan?.corrections, [
    {
      targetText: "5 mg per dL",
      replacementText: "5 mg/dL",
      category: "style",
    },
  ]);
  assert.deepEqual(proofreadingPayload.proofreadingPlan?.manualReviewItems, [
    "Verify the normalized unit against the source table before release.",
  ]);
  const proofreadingAssets = await harness.assetRepository.listByManuscriptId(
    "manuscript-1",
  );
  const generatedProofreadingDocx = proofreadingAssets.find(
    (asset) => asset.asset_type === "final_proof_annotated_docx",
  );
  assert.ok(
    generatedProofreadingDocx,
    "Expected proofreading bare runs to also create a downloadable manuscript asset.",
  );
  const updatedManuscript = await harness.manuscriptRepository.findById(
    "manuscript-1",
  );
  assert.equal(
    updatedManuscript?.current_proofreading_asset_id,
    generatedProofreadingDocx?.id,
  );
  assert.ok(result.snapshot_id);
  assert.equal(
    (await residualIssueRepository.listByExecutionSnapshotId(result.snapshot_id))
      .length,
    0,
  );
});
