import test from "node:test";
import assert from "node:assert/strict";
import type { EditorialDocxTransformService } from "../../src/modules/document-pipeline/editorial-docx-transform-service.ts";
import { ProofreadingService } from "../../src/modules/proofreading/proofreading-service.ts";
import { InMemoryResidualIssueRepository } from "../../src/modules/residual-learning/in-memory-residual-learning-repository.ts";
import { ResidualLearningService } from "../../src/modules/residual-learning/residual-learning-service.ts";
import type { ReviewItemsService } from "../../src/modules/review-items/review-items-service.ts";
import { ModuleTemplateFamilyNotConfiguredError } from "../../src/modules/shared/module-run-support.ts";
import type {
  ExecuteMainlineAiInput,
  MainlineAiRuntimeExecutor,
} from "../../src/modules/shared/mainline-ai-runtime-executor.ts";
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
    async executeJson<T>(_input: ExecuteMainlineAiInput): Promise<T> {
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
      } as T;
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

test("publishHumanFinal applies human confirmation decisions, routes rule candidates, and records residual observations", async () => {
  const harness = await seedMedicalQualityFixture();
  const transformCalls: Array<
    Parameters<EditorialDocxTransformService["applyDeterministicRules"]>[0]
  > = [];
  const governedHitSubmissions: Array<
    Parameters<ReviewItemsService["submitGovernedHit"]>[0]
  > = [];
  const reviewDecisions: Array<Parameters<ReviewItemsService["decideReviewItem"]>[0]> = [];
  const residualObservations: Array<
    Parameters<ResidualLearningService["observeProofreadingResiduals"]>[0]
  > = [];

  await harness.jobRepository.save({
    id: "job-proof-draft-1",
    manuscript_id: "manuscript-1",
    module: "proofreading",
    job_type: "proofreading_draft_run",
    status: "completed",
    requested_by: "proofreader-1",
    payload: {
      parentAssetId: harness.originalAssetId,
      proofreadingManuscriptAssetId: "asset-proof-manuscript-1",
      proofreadingPlan: {
        summary: "Proofreading draft plan.",
        corrections: [
          {
            targetText: "5 mg per dL",
            replacementText: "5 mg/dL",
            category: "style",
          },
          {
            targetText: "The hemoglobin were stable.",
            replacementText: "The hemoglobin was stable.",
            category: "grammar",
          },
          {
            targetText: "No action should survive.",
            replacementText: "This correction should be rejected.",
            category: "style",
          },
        ],
        manualReviewItems: [],
      },
    },
    attempt_count: 1,
    created_at: "2026-04-18T07:50:00.000Z",
    updated_at: "2026-04-18T07:52:00.000Z",
  });
  await harness.assetRepository.save({
    id: "asset-proof-draft-1",
    manuscript_id: "manuscript-1",
    asset_type: "proofreading_draft_report",
    status: "active",
    storage_key: "runs/manuscript-1/proofreading/draft.md",
    mime_type: "text/markdown",
    parent_asset_id: harness.originalAssetId,
    source_module: "proofreading",
    source_job_id: "job-proof-draft-1",
    created_by: "proofreader-1",
    version_no: 2,
    is_current: false,
    file_name: "proofreading-draft.md",
    created_at: "2026-04-18T07:52:00.000Z",
    updated_at: "2026-04-18T07:52:00.000Z",
  });
  await harness.jobRepository.save({
    id: "job-proof-final-1",
    manuscript_id: "manuscript-1",
    module: "proofreading",
    job_type: "proofreading_confirm",
    status: "completed",
    requested_by: "proofreader-1",
    payload: {
      parentAssetId: "asset-proof-draft-1",
      snapshotId: "snapshot-proof-final-1",
      knowledgeItemIds: ["knowledge-proof-1"],
    },
    attempt_count: 1,
    created_at: "2026-04-18T08:00:00.000Z",
    updated_at: "2026-04-18T08:02:00.000Z",
  });
  await harness.assetRepository.save({
    id: "asset-proof-final-1",
    manuscript_id: "manuscript-1",
    asset_type: "final_proof_annotated_docx",
    status: "active",
    storage_key: "runs/manuscript-1/proofreading/final.docx",
    mime_type:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    parent_asset_id: "asset-proof-draft-1",
    source_module: "proofreading",
    source_job_id: "job-proof-final-1",
    created_by: "proofreader-1",
    version_no: 3,
    is_current: true,
    file_name: "proofreading-final.docx",
    created_at: "2026-04-18T08:02:00.000Z",
    updated_at: "2026-04-18T08:02:00.000Z",
  });

  let nextId = 0;
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
    editorialDocxTransformService: {
      async applyDeterministicRules(
        input: Parameters<EditorialDocxTransformService["applyDeterministicRules"]>[0],
      ) {
        transformCalls.push(input);
        return {
          appliedRuleIds: [],
          appliedChanges: [],
          tableInspectionFindings: [],
        };
      },
    } as never,
    reviewItemsService: {
      async recordExecutionGovernedHits() {
        return [];
      },
      async submitGovernedHit(
        input: Parameters<ReviewItemsService["submitGovernedHit"]>[0],
      ) {
        governedHitSubmissions.push(input);
        return {
          feedback: {
            id: "feedback-route-1",
          },
          item: {
            id: "review-item-route-1",
          },
        } as never;
      },
      async decideReviewItem(input: Parameters<ReviewItemsService["decideReviewItem"]>[0]) {
        reviewDecisions.push(input);
        return {
          action: input.action,
          item: null,
        };
      },
    } as never,
    residualLearningService: {
      async observeProofreadingResiduals(
        input: Parameters<ResidualLearningService["observeProofreadingResiduals"]>[0],
      ) {
        residualObservations.push(input);
        return [];
      },
    } as never,
    createId: () => `job-proof-human-${++nextId}`,
    now: () => new Date("2026-04-18T08:10:00.000Z"),
  } as never);

  const result = await proofreadingService.publishHumanFinal({
    manuscriptId: "manuscript-1",
    finalAssetId: "asset-proof-final-1",
    requestedBy: "proofreader-1",
    actorRole: "proofreader",
    storageKey: "runs/manuscript-1/proofreading/human-final.docx",
    fileName: "human-final.docx",
    confirmationDecisions: [
      {
        itemId: "correction-1",
        targetText: "5 mg per dL",
        replacementText: "5 mg/dL",
        action: "route_to_rule_candidate",
      },
      {
        itemId: "correction-2",
        targetText: "The hemoglobin were stable.",
        replacementText: "The hemoglobin was stable.",
        action: "accept_and_edit",
        editedReplacementText: "The hemoglobin levels were stable.",
      },
      {
        itemId: "correction-3",
        targetText: "No action should survive.",
        replacementText: "This correction should be rejected.",
        action: "reject",
      },
    ],
  });

  assert.equal(result.asset.asset_type, "human_final_docx");
  assert.equal(transformCalls.length, 1);
  assert.equal(transformCalls[0]?.sourceAssetId, harness.originalAssetId);
  assert.deepEqual(transformCalls[0]?.aiReplacements, [
    {
      targetText: "5 mg per dL",
      replacementText: "5 mg/dL",
      reason: "style",
    },
    {
      targetText: "The hemoglobin were stable.",
      replacementText: "The hemoglobin levels were stable.",
      reason: "grammar",
    },
  ]);

  const payload = result.job.payload as
    | {
        confirmationSummary?: {
          totalItems?: number;
          acceptedIntoManuscriptCount?: number;
          rejectedCount?: number;
          routedRuleCandidateCount?: number;
        };
        confirmationDecisions?: Array<{
          action?: string;
          targetText?: string;
          finalReplacementText?: string;
        }>;
      }
    | undefined;
  assert.equal(payload?.confirmationSummary?.totalItems, 3);
  assert.equal(payload?.confirmationSummary?.acceptedIntoManuscriptCount, 2);
  assert.equal(payload?.confirmationSummary?.rejectedCount, 1);
  assert.equal(payload?.confirmationSummary?.routedRuleCandidateCount, 1);
  assert.deepEqual(payload?.confirmationDecisions, [
    {
      itemId: "correction-1",
      action: "route_to_rule_candidate",
      targetText: "5 mg per dL",
      replacementText: "5 mg/dL",
      finalReplacementText: "5 mg/dL",
    },
    {
      itemId: "correction-2",
      action: "accept_and_edit",
      targetText: "The hemoglobin were stable.",
      replacementText: "The hemoglobin was stable.",
      finalReplacementText: "The hemoglobin levels were stable.",
    },
    {
      itemId: "correction-3",
      action: "reject",
      targetText: "No action should survive.",
      replacementText: "This correction should be rejected.",
      finalReplacementText: undefined,
    },
  ]);

  assert.equal(governedHitSubmissions.length, 1);
  assert.equal(reviewDecisions.length, 1);
  assert.equal(reviewDecisions[0]?.action, "route_to_rule_candidate");
  assert.equal(residualObservations.length, 1);
});
