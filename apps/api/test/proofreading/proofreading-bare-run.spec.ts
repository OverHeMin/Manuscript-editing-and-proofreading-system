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
        role: "医学稿件终校审校员",
        summary: "AI proofreading plan for bare mode.",
        issues: [
          {
            itemId: "issue-1",
            title: "单位表达不规范",
            description: "将单位表达统一为标准写法。",
            severity: "medium",
            source: "residual_ai",
            issueType: "style",
            blocksFinal: false,
            anchor: {
              blockIndex: 0,
              quote: "5 mg per dL",
              sectionLabel: "results",
            },
            suggestion: {
              action: "replace_text",
              replacementText: "5 mg/dL",
            },
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
        proofreadingSourceBlocks?: Array<{
          blockIndex?: number;
          section?: string;
          block_kind?: string;
          text?: string;
        }>;
        proofreadingPlan?: {
          role?: string;
          summary?: string;
          issues?: Array<{
            itemId?: string;
            title?: string;
            description?: string;
            severity?: string;
            source?: string;
            issueType?: string;
            blocksFinal?: boolean;
            anchor?: {
              blockIndex?: number;
              quote?: string;
              sectionLabel?: string;
            };
            suggestion?: {
              action?: string;
              replacementText?: string;
            };
          }>;
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
    proofreadingPayload?.proofreadingPlan?.role,
    "医学稿件终校审校员",
  );
  assert.equal(
    proofreadingPayload.proofreadingPlan?.summary,
    "AI proofreading plan for bare mode.",
  );
  assert.deepEqual(proofreadingPayload.proofreadingPlan?.issues, [
    {
      itemId: "issue-1",
      title: "单位表达不规范",
      description: "将单位表达统一为标准写法。",
      severity: "medium",
      source: "residual_ai",
      issueType: "style",
      blocksFinal: false,
      anchor: {
        blockIndex: 0,
        blockKind: "paragraph",
        quote: "5 mg per dL",
        sectionLabel: "results",
      },
      suggestion: {
        action: "replace_text",
        replacementText: "5 mg/dL",
      },
    },
  ]);
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
  assert.deepEqual(
    proofreadingPayload?.proofreadingSourceBlocks?.map((block) => ({
      blockIndex: block.blockIndex,
      section: block.section,
      block_kind: block.block_kind,
      text: block.text,
    })),
    [
      {
        blockIndex: 0,
        section: "results",
        block_kind: "paragraph",
        text: "Dose was 5 mg per dL in the bare proofreading report.",
      },
    ],
  );
  const proofreadingAssets = await harness.assetRepository.listByManuscriptId(
    "manuscript-1",
  );
  const generatedProofreadingDocx = proofreadingAssets.find(
    (asset) => asset.asset_type === "final_proof_annotated_docx",
  );
  assert.equal(
    generatedProofreadingDocx,
    undefined,
    "Draft proofreading should only emit the issue workbench report until human confirmation.",
  );
  const updatedManuscript = await harness.manuscriptRepository.findById(
    "manuscript-1",
  );
  assert.equal(
    updatedManuscript?.current_proofreading_asset_id,
    undefined,
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
      sourceManuscriptAssetId: harness.originalAssetId,
      executionMode: "governed",
      executionProfileId: "profile-proofreading-1",
      runtimeBindingId: "binding-proofreading-1",
      modelId: "model-1",
      modelSource: "legacy_module_default",
      snapshotId: "snapshot-proof-draft-1",
      knowledgeItemIds: ["knowledge-proof-1"],
      proofreadingPlan: {
        role: "医学稿件终校审校员",
        summary: "Proofreading draft plan.",
        issues: [
          {
            itemId: "issue-1",
            title: "单位表达不规范",
            description: "单位写法需要统一。",
            severity: "medium",
            source: "residual_ai",
            issueType: "style",
            blocksFinal: false,
            anchor: {
              blockIndex: 0,
              quote: "5 mg per dL",
              sectionLabel: "results",
            },
            suggestion: {
              action: "replace_text",
              replacementText: "5 mg/dL",
            },
          },
          {
            itemId: "issue-2",
            title: "主谓一致错误",
            description: "需要修正语法一致性。",
            severity: "medium",
            source: "residual_ai",
            issueType: "grammar",
            blocksFinal: false,
            anchor: {
              blockIndex: 1,
              quote: "The hemoglobin were stable.",
              sectionLabel: "results",
            },
            suggestion: {
              action: "replace_text",
              replacementText: "The hemoglobin was stable.",
            },
          },
          {
            itemId: "issue-3",
            title: "术语应写全称",
            description: "术语首次出现应补足全称。",
            severity: "medium",
            source: "residual_ai",
            issueType: "terminology",
            blocksFinal: false,
            anchor: {
              blockIndex: 2,
              quote: "ALT remained stable.",
              sectionLabel: "results",
            },
            suggestion: {
              action: "replace_text",
              replacementText: "Alanine aminotransferase remained stable.",
            },
          },
          {
            itemId: "issue-4",
            title: "标点连接不规范",
            description: "连接副词前后标点需要统一。",
            severity: "medium",
            source: "residual_ai",
            issueType: "punctuation",
            blocksFinal: false,
            anchor: {
              blockIndex: 3,
              quote: "Patients improved, however the sample stayed small.",
              sectionLabel: "discussion",
            },
            suggestion: {
              action: "replace_text",
              replacementText: "Patients improved; however the sample stayed small.",
            },
          },
          {
            itemId: "issue-5",
            title: "该建议应被驳回",
            description: "保留原文，不应自动改写。",
            severity: "medium",
            source: "residual_ai",
            issueType: "style",
            blocksFinal: false,
            anchor: {
              blockIndex: 4,
              quote: "No action should survive.",
              sectionLabel: "discussion",
            },
            suggestion: {
              action: "replace_text",
              replacementText: "This correction should be rejected.",
            },
          },
        ],
        manualReviewItems: [],
      },
      proofreadingSourceBlocks: [
        {
          blockIndex: 0,
          section: "results",
          block_kind: "paragraph",
          text: "5 mg per dL",
        },
        {
          blockIndex: 1,
          section: "results",
          block_kind: "paragraph",
          text: "The hemoglobin were stable.",
        },
        {
          blockIndex: 2,
          section: "results",
          block_kind: "paragraph",
          text: "ALT remained stable.",
        },
        {
          blockIndex: 3,
          section: "discussion",
          block_kind: "paragraph",
          text: "Patients improved, however the sample stayed small.",
        },
        {
          blockIndex: 4,
          section: "discussion",
          block_kind: "paragraph",
          text: "No action should survive.",
        },
      ],
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
    finalAssetId: "asset-proof-draft-1",
    requestedBy: "proofreader-1",
    actorRole: "proofreader",
    storageKey: "runs/manuscript-1/proofreading/human-final.docx",
    fileName: "human-final.docx",
    confirmationDecisions: [
      {
        itemId: "issue-1",
        targetText: "5 mg per dL",
        replacementText: "5 mg/dL",
        action: "route_to_rule_candidate",
      },
      {
        itemId: "issue-2",
        targetText: "The hemoglobin were stable.",
        replacementText: "The hemoglobin was stable.",
        action: "accepted_with_manual_edit",
        editedReplacementText: "The hemoglobin levels were stable.",
      },
      {
        itemId: "issue-3",
        targetText: "ALT remained stable.",
        replacementText: "Alanine aminotransferase remained stable.",
        action: "accepted_with_manual_edit",
        editedReplacementText: "Serum alanine aminotransferase (ALT) remained stable.",
      },
      {
        itemId: "issue-4",
        targetText: "Patients improved, however the sample stayed small.",
        replacementText: "Patients improved; however the sample stayed small.",
        action: "accepted_with_manual_edit",
        editedReplacementText: "Patients improved; however, the sample stayed small.",
      },
      {
        itemId: "issue-5",
        targetText: "No action should survive.",
        replacementText: "This correction should be rejected.",
        action: "rejected",
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
    {
      targetText: "ALT remained stable.",
      replacementText: "Serum alanine aminotransferase (ALT) remained stable.",
      reason: "terminology",
    },
    {
      targetText: "Patients improved, however the sample stayed small.",
      replacementText: "Patients improved; however, the sample stayed small.",
      reason: "punctuation",
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
        executionMode?: string;
        sourceSnapshotId?: string;
        executionProfileId?: string;
        runtimeBindingId?: string;
        modelId?: string;
        modelSource?: string;
        confirmationDecisions?: Array<{
          action?: string;
          targetText?: string;
          finalReplacementText?: string;
        }>;
      }
    | undefined;
  assert.equal(payload?.confirmationSummary?.totalItems, 5);
  assert.equal(payload?.confirmationSummary?.acceptedIntoManuscriptCount, 4);
  assert.equal(payload?.confirmationSummary?.rejectedCount, 1);
  assert.equal(payload?.confirmationSummary?.routedRuleCandidateCount, 1);
  assert.equal(payload?.executionMode, "governed");
  assert.equal(payload?.sourceSnapshotId, "snapshot-proof-draft-1");
  assert.equal(payload?.executionProfileId, "profile-proofreading-1");
  assert.equal(payload?.runtimeBindingId, "binding-proofreading-1");
  assert.equal(payload?.modelId, "model-1");
  assert.equal(payload?.modelSource, "legacy_module_default");
  assert.deepEqual(payload?.confirmationDecisions, [
    {
      itemId: "issue-1",
      action: "route_to_rule_candidate",
      targetText: "5 mg per dL",
      replacementText: "5 mg/dL",
      finalReplacementText: "5 mg/dL",
    },
    {
      itemId: "issue-2",
      action: "accepted_with_manual_edit",
      targetText: "The hemoglobin were stable.",
      replacementText: "The hemoglobin was stable.",
      finalReplacementText: "The hemoglobin levels were stable.",
    },
    {
      itemId: "issue-3",
      action: "accepted_with_manual_edit",
      targetText: "ALT remained stable.",
      replacementText: "Alanine aminotransferase remained stable.",
      finalReplacementText: "Serum alanine aminotransferase (ALT) remained stable.",
    },
    {
      itemId: "issue-4",
      action: "accepted_with_manual_edit",
      targetText: "Patients improved, however the sample stayed small.",
      replacementText: "Patients improved; however the sample stayed small.",
      finalReplacementText: "Patients improved; however, the sample stayed small.",
    },
    {
      itemId: "issue-5",
      action: "rejected",
      targetText: "No action should survive.",
      replacementText: "This correction should be rejected.",
      finalReplacementText: undefined,
    },
  ]);

  assert.equal(governedHitSubmissions.length, 1);
  assert.equal(reviewDecisions.length, 1);
  assert.equal(reviewDecisions[0]?.action, "route_to_rule_candidate");
  assert.equal(residualObservations.length, 1);
  assert.deepEqual(residualObservations[0]?.sourceBlocks, [
    {
      blockIndex: 1,
      text: "The hemoglobin were stable.",
      residualHints: [
        {
          issue_type: "uncovered_local_language_issue",
          excerpt: "The hemoglobin were stable.",
          suggestion: "The hemoglobin levels were stable.",
          rationale:
            "Human adjusted the proofreading issue before final publication.",
          source_stage: "model_residual",
        },
      ],
    },
    {
      blockIndex: 2,
      text: "ALT remained stable.",
      residualHints: [
        {
          issue_type: "terminology_gap",
          excerpt: "ALT remained stable.",
          suggestion: "Serum alanine aminotransferase (ALT) remained stable.",
          rationale:
            "Human adjusted the proofreading issue before final publication.",
          source_stage: "model_residual",
        },
      ],
    },
    {
      blockIndex: 3,
      text: "Patients improved, however the sample stayed small.",
      residualHints: [
        {
          issue_type: "style_consistency_gap",
          excerpt: "Patients improved, however the sample stayed small.",
          suggestion: "Patients improved; however, the sample stayed small.",
          rationale:
            "Human adjusted the proofreading issue before final publication.",
          source_stage: "model_residual",
        },
      ],
    },
    {
      blockIndex: 4,
      text: "No action should survive.",
      residualHints: [
        {
          issue_type: "unsupported_correction_proposal",
          excerpt: "No action should survive.",
          suggestion: "This correction should be rejected.",
          rationale: "Human rejected the proofreading issue.",
          source_stage: "model_residual",
          signal_breakdown: {
            promotion_evidence: {
              source: "proofreading_confirmation",
              decision_action: "reject",
              correction_category: "style",
            },
          },
        },
      ],
    },
  ]);
});
