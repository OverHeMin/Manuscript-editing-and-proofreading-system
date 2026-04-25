import test from "node:test";
import assert from "node:assert/strict";
import type { EditorialDocxTransformService } from "../../src/modules/document-pipeline/editorial-docx-transform-service.ts";
import { ProofreadingService } from "../../src/modules/proofreading/proofreading-service.ts";
import { InMemoryResidualIssueRepository } from "../../src/modules/residual-learning/in-memory-residual-learning-repository.ts";
import { ResidualLearningService } from "../../src/modules/residual-learning/residual-learning-service.ts";
import type { ReviewItemsService } from "../../src/modules/review-items/review-items-service.ts";
import { getBareModulePromptSkeleton } from "../../src/modules/shared/bare-module-prompt-skeletons.ts";
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
    documentStructureService: {
      async extract() {
        return {
          manuscript_id: "manuscript-1",
          asset_id: harness.originalAssetId,
          file_name: "proofreading-bare.docx",
          status: "ready",
          parser: "python_docx",
          sections: [],
          metadata_candidates: [],
          tables: [],
          objects: [
            {
              object_id: "object-1",
              object_kind: "image",
              container_kind: "paragraph",
              source_zone: "body",
              source_locator: "body:p:4",
              original_tag: "drawing",
              relationship_id: "rId8",
              evidence_text: "卡方检验符号图片",
              intended_target: "χ²",
            },
          ],
          warnings: [],
        };
      },
    },
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

  const bareSkeleton = getBareModulePromptSkeleton("proofreading");
  assert.equal(result.asset.asset_type, "proofreading_draft_report");
  assert.equal(result.template_id, bareSkeleton.templateId);
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
  assert.match(
    proofreadingPayload?.reportMarkdown ?? "",
    /高风险对象待人工核对：图片对象/u,
  );
  assert.match(
    proofreadingPayload?.reportMarkdown ?? "",
    /原始对象=图片对象\/drawing\/rId8/u,
  );
  assert.match(
    proofreadingPayload?.reportMarkdown ?? "",
    /意图目标=χ²/u,
  );
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
        documentLocator: {
          anchorKind: "paragraph",
          anchorKey: "paragraph:results:0",
          confidence: "derived",
          blockIndex: 0,
          sectionLabel: "results",
          ordinalWithinSection: 0,
        },
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
  let observedResidualJobStatus: string | undefined;

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
        observedResidualJobStatus = input.jobId
          ? (await harness.jobRepository.findById(input.jobId))?.status
          : undefined;
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
  assert.equal(observedResidualJobStatus, "completed");
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
          signal_breakdown: {
            promotion_evidence: {
              source: "proofreading_confirmation",
              decision_action: "accept_and_edit",
              correction_category: "grammar",
            },
          },
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
          signal_breakdown: {
            promotion_evidence: {
              source: "proofreading_confirmation",
              decision_action: "accept_and_edit",
              correction_category: "terminology",
            },
          },
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
          signal_breakdown: {
            promotion_evidence: {
              source: "proofreading_confirmation",
              decision_action: "accept_and_edit",
              correction_category: "punctuation",
            },
          },
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

test("publishHumanFinal allows human-edited verify_fact issues to publish and route knowledge candidates", async () => {
  const harness = await seedMedicalQualityFixture();
  const transformCalls: Array<
    Parameters<EditorialDocxTransformService["applyDeterministicRules"]>[0]
  > = [];
  const governedHitSubmissions: Array<
    Parameters<ReviewItemsService["submitGovernedHit"]>[0]
  > = [];
  const reviewDecisions: Array<Parameters<ReviewItemsService["decideReviewItem"]>[0]> = [];

  await harness.jobRepository.save({
    id: "job-proof-draft-verify-fact-1",
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
      snapshotId: "snapshot-proof-verify-fact-1",
      knowledgeItemIds: ["knowledge-proof-1"],
      proofreadingPlan: {
        role: "医学稿件终校审校员",
        summary: "Proofreading draft plan for verify-fact confirmation.",
        issues: [
          {
            itemId: "issue-verify-fact-1",
            title: "ALT 单位错误",
            description: "ALT 不应使用 mg/dL 作为单位，需要人工核实并改正。",
            severity: "critical",
            source: "residual_ai",
            issueType: "medical_fact_error",
            blocksFinal: false,
            anchor: {
              blockIndex: 0,
              quote: "the unit expression 5 mg per dL should be normalized.",
              sectionLabel: "results",
            },
            suggestion: {
              action: "verify_fact",
              note: "人工核实后应改成 ALT 的正确单位表达。",
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
          text: "the unit expression 5 mg per dL should be normalized.",
        },
      ],
    },
    attempt_count: 1,
    created_at: "2026-04-24T09:00:00.000Z",
    updated_at: "2026-04-24T09:02:00.000Z",
  });
  await harness.assetRepository.save({
    id: "asset-proof-draft-verify-fact-1",
    manuscript_id: "manuscript-1",
    asset_type: "proofreading_draft_report",
    status: "active",
    storage_key: "runs/manuscript-1/proofreading/verify-fact-draft.md",
    mime_type: "text/markdown",
    parent_asset_id: harness.originalAssetId,
    source_module: "proofreading",
    source_job_id: "job-proof-draft-verify-fact-1",
    created_by: "proofreader-1",
    version_no: 2,
    is_current: false,
    file_name: "verify-fact-draft.md",
    created_at: "2026-04-24T09:02:00.000Z",
    updated_at: "2026-04-24T09:02:00.000Z",
  });
  await harness.jobRepository.save({
    id: "job-proof-final-verify-fact-1",
    manuscript_id: "manuscript-1",
    module: "proofreading",
    job_type: "proofreading_confirm",
    status: "completed",
    requested_by: "proofreader-1",
    payload: {
      parentAssetId: "asset-proof-draft-verify-fact-1",
      sourceManuscriptAssetId: harness.originalAssetId,
      executionMode: "governed",
      executionProfileId: "profile-proofreading-1",
      runtimeBindingId: "binding-proofreading-1",
      modelId: "model-1",
      modelSource: "legacy_module_default",
      snapshotId: "snapshot-proof-verify-fact-1",
      knowledgeItemIds: ["knowledge-proof-1"],
    },
    attempt_count: 1,
    created_at: "2026-04-24T09:05:00.000Z",
    updated_at: "2026-04-24T09:07:00.000Z",
  });
  await harness.assetRepository.save({
    id: "asset-proof-final-verify-fact-1",
    manuscript_id: "manuscript-1",
    asset_type: "final_proof_annotated_docx",
    status: "active",
    storage_key: "runs/manuscript-1/proofreading/verify-fact-final.docx",
    mime_type:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    parent_asset_id: "asset-proof-draft-verify-fact-1",
    source_module: "proofreading",
    source_job_id: "job-proof-final-verify-fact-1",
    created_by: "proofreader-1",
    version_no: 3,
    is_current: true,
    file_name: "verify-fact-final.docx",
    created_at: "2026-04-24T09:07:00.000Z",
    updated_at: "2026-04-24T09:07:00.000Z",
  });

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
            id: "feedback-knowledge-verify-fact-1",
          },
          item: {
            id: "review-item-knowledge-verify-fact-1",
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
    createId: (() => {
      let nextId = 0;
      return () => `job-proof-human-verify-fact-${++nextId}`;
    })(),
    now: () => new Date("2026-04-24T09:10:00.000Z"),
  } as never);

  const result = await proofreadingService.publishHumanFinal({
    manuscriptId: "manuscript-1",
    finalAssetId: "asset-proof-final-verify-fact-1",
    requestedBy: "proofreader-1",
    actorRole: "proofreader",
    storageKey: "runs/manuscript-1/proofreading/verify-fact-human-final.docx",
    fileName: "verify-fact-human-final.docx",
    confirmationDecisions: [
      {
        itemId: "issue-verify-fact-1",
        targetText: "the unit expression 5 mg per dL should be normalized.",
        replacementText: "",
        action: "route_to_knowledge_candidate",
        editedReplacementText: "the unit expression 5 U/L should be normalized.",
        note: "人工核实 ALT 正确单位后改写，并转知识候选。",
      },
    ],
  });

  assert.equal(result.asset.asset_type, "human_final_docx");
  assert.equal(transformCalls.length, 1);
  assert.deepEqual(transformCalls[0]?.aiReplacements, [
    {
      targetText: "the unit expression 5 mg per dL should be normalized.",
      replacementText: "the unit expression 5 U/L should be normalized.",
      reason: "medical_fact_error",
    },
  ]);

  const payload = result.job.payload as
    | {
        confirmationSummary?: {
          acceptedIntoManuscriptCount?: number;
          routedKnowledgeCandidateCount?: number;
        };
        writebackLedger?: Array<{
          itemId?: string;
          applied?: boolean;
          disposition?: string;
        }>;
      }
    | undefined;
  assert.equal(payload?.confirmationSummary?.acceptedIntoManuscriptCount, 1);
  assert.equal(payload?.confirmationSummary?.routedKnowledgeCandidateCount, 1);
  assert.deepEqual(payload?.writebackLedger, [
    {
      itemId: "issue-verify-fact-1",
      action: "route_to_knowledge_candidate",
      applied: true,
      disposition: "auto_writeback",
      anchorBlockIndex: 0,
    },
  ]);

  assert.equal(governedHitSubmissions.length, 1);
  assert.equal(
    governedHitSubmissions[0]?.suggestion,
    "the unit expression 5 U/L should be normalized.",
  );
  assert.equal(reviewDecisions.length, 1);
  assert.equal(reviewDecisions[0]?.action, "route_to_knowledge_candidate");
});

test("saveConfirmationDraft stores a proofreading-owned confirmation draft without publishing side effects", async () => {
  const harness = await seedMedicalQualityFixture();
  const transformCalls: Array<unknown> = [];

  await harness.jobRepository.save({
    id: "job-proof-draft-save-1",
    manuscript_id: "manuscript-1",
    module: "proofreading",
    job_type: "proofreading_draft_run",
    status: "completed",
    requested_by: "proofreader-1",
    payload: {
      parentAssetId: harness.originalAssetId,
      sourceManuscriptAssetId: harness.originalAssetId,
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
            title: "术语应写全称",
            description: "术语首次出现应补足全称。",
            severity: "medium",
            source: "residual_ai",
            issueType: "terminology",
            blocksFinal: false,
            anchor: {
              blockIndex: 1,
              quote: "ALT remained stable.",
              sectionLabel: "results",
            },
            suggestion: {
              action: "replace_text",
              replacementText: "Alanine aminotransferase remained stable.",
            },
          },
        ],
      },
    },
    attempt_count: 1,
    created_at: "2026-04-24T14:00:00.000Z",
    updated_at: "2026-04-24T14:05:00.000Z",
  });
  await harness.assetRepository.save({
    id: "asset-proof-draft-save-1",
    manuscript_id: "manuscript-1",
    asset_type: "proofreading_draft_report",
    status: "active",
    storage_key: "runs/manuscript-1/proofreading/draft-save.md",
    mime_type: "text/markdown",
    parent_asset_id: harness.originalAssetId,
    source_module: "proofreading",
    source_job_id: "job-proof-draft-save-1",
    created_by: "proofreader-1",
    version_no: 2,
    is_current: false,
    file_name: "proofreading-draft-save.md",
    created_at: "2026-04-24T14:05:00.000Z",
    updated_at: "2026-04-24T14:05:00.000Z",
  });
  await harness.jobRepository.save({
    id: "job-proof-confirm-save-1",
    manuscript_id: "manuscript-1",
    module: "proofreading",
    job_type: "proofreading_confirm",
    status: "completed",
    requested_by: "proofreader-1",
    payload: {
      parentAssetId: "asset-proof-draft-save-1",
      sourceManuscriptAssetId: harness.originalAssetId,
    },
    attempt_count: 1,
    created_at: "2026-04-24T14:10:00.000Z",
    updated_at: "2026-04-24T14:12:00.000Z",
  });
  await harness.assetRepository.save({
    id: "asset-proof-final-save-1",
    manuscript_id: "manuscript-1",
    asset_type: "final_proof_annotated_docx",
    status: "active",
    storage_key: "runs/manuscript-1/proofreading/final-save.docx",
    mime_type:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    parent_asset_id: "asset-proof-draft-save-1",
    source_module: "proofreading",
    source_job_id: "job-proof-confirm-save-1",
    created_by: "proofreader-1",
    version_no: 3,
    is_current: true,
    file_name: "proofreading-final-save.docx",
    created_at: "2026-04-24T14:12:00.000Z",
    updated_at: "2026-04-24T14:12:00.000Z",
  });

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
      async applyDeterministicRules(input: unknown) {
        transformCalls.push(input);
        return {
          appliedRuleIds: [],
          appliedChanges: [],
          tableInspectionFindings: [],
        };
      },
    } as never,
    createId: () => "unused-save-draft-id",
    now: () => new Date("2026-04-24T15:00:00.000Z"),
  } as never);

  const result = await proofreadingService.saveConfirmationDraft({
    manuscriptId: "manuscript-1",
    confirmationAssetId: "asset-proof-final-save-1",
    requestedBy: "proofreader-1",
    actorRole: "proofreader",
    confirmationDecisions: [
      {
        itemId: "issue-1",
        targetText: "5 mg per dL",
        replacementText: "5 mg/dL",
        action: "accepted",
      },
      {
        itemId: "issue-2",
        targetText: "ALT remained stable.",
        replacementText: "Alanine aminotransferase remained stable.",
        action: "accepted_with_manual_edit",
        editedReplacementText: "Serum alanine aminotransferase (ALT) remained stable.",
        note: "补足术语全称。",
      },
    ],
  });

  assert.equal(result.job.id, "job-proof-confirm-save-1");
  assert.equal(transformCalls.length, 0);

  const savedJob = await harness.jobRepository.findById("job-proof-confirm-save-1");
  const payload = savedJob?.payload as
    | {
        confirmationDraft?: {
          assetId?: string;
          totalItems?: number;
          savedDecisionCount?: number;
          confirmationSummary?: {
            totalItems?: number;
            acceptedIntoManuscriptCount?: number;
            rejectedCount?: number;
          };
          confirmationDecisions?: Array<{
            itemId?: string;
            action?: string;
            targetText?: string;
            replacementText?: string;
            finalReplacementText?: string;
            note?: string;
          }>;
        };
      }
    | undefined;

  assert.deepEqual(payload?.confirmationDraft, {
    assetId: "asset-proof-final-save-1",
    sourceProofreadingJobId: "job-proof-draft-save-1",
    totalItems: 2,
    savedDecisionCount: 2,
    updatedAt: "2026-04-24T15:00:00.000Z",
    confirmationSummary: {
      totalItems: 2,
      acceptedIntoManuscriptCount: 2,
      rejectedCount: 0,
      routedRuleCandidateCount: 0,
      routedKnowledgeCandidateCount: 0,
      manualOnlyCount: 0,
    },
    confirmationDecisions: [
      {
        itemId: "issue-1",
        action: "accepted",
        targetText: "5 mg per dL",
        replacementText: "5 mg/dL",
        finalReplacementText: "5 mg/dL",
      },
      {
        itemId: "issue-2",
        action: "accepted_with_manual_edit",
        targetText: "ALT remained stable.",
        replacementText: "Alanine aminotransferase remained stable.",
        finalReplacementText: "Serum alanine aminotransferase (ALT) remained stable.",
        note: "补足术语全称。",
      },
    ],
  });
});

test("saveConfirmationDraft also persists decisions from the live proofreading workspace draft page", async () => {
  const harness = await seedMedicalQualityFixture();
  const transformCalls: Array<unknown> = [];

  await harness.jobRepository.save({
    id: "job-proof-draft-workspace-save-1",
    manuscript_id: "manuscript-1",
    module: "proofreading",
    job_type: "proofreading_draft_run",
    status: "completed",
    requested_by: "proofreader-1",
    payload: {
      parentAssetId: harness.originalAssetId,
      sourceManuscriptAssetId: harness.originalAssetId,
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
        ],
      },
    },
    attempt_count: 1,
    created_at: "2026-04-24T14:00:00.000Z",
    updated_at: "2026-04-24T14:05:00.000Z",
  });
  await harness.assetRepository.save({
    id: "asset-proof-draft-workspace-save-1",
    manuscript_id: "manuscript-1",
    asset_type: "proofreading_draft_report",
    status: "active",
    storage_key: "runs/manuscript-1/proofreading/draft-workspace-save.md",
    mime_type: "text/markdown",
    parent_asset_id: harness.originalAssetId,
    source_module: "proofreading",
    source_job_id: "job-proof-draft-workspace-save-1",
    created_by: "proofreader-1",
    version_no: 2,
    is_current: true,
    file_name: "proofreading-draft-workspace-save.md",
    created_at: "2026-04-24T14:05:00.000Z",
    updated_at: "2026-04-24T14:05:00.000Z",
  });

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
      async applyDeterministicRules(input: unknown) {
        transformCalls.push(input);
        return {
          appliedRuleIds: [],
          appliedChanges: [],
          tableInspectionFindings: [],
        };
      },
    } as never,
    createId: () => "unused-save-draft-id",
    now: () => new Date("2026-04-24T15:00:00.000Z"),
  } as never);

  const result = await proofreadingService.saveConfirmationDraft({
    manuscriptId: "manuscript-1",
    confirmationAssetId: "asset-proof-draft-workspace-save-1",
    requestedBy: "proofreader-1",
    actorRole: "proofreader",
    confirmationDecisions: [
      {
        itemId: "issue-1",
        targetText: "5 mg per dL",
        replacementText: "5 mg/dL",
        action: "accepted_with_manual_edit",
        editedReplacementText: "5 mg/dL",
        note: "直接在工作台保存人工确认。",
      },
    ],
  });

  assert.equal(result.job.id, "job-proof-draft-workspace-save-1");
  assert.equal(transformCalls.length, 0);

  const savedJob = await harness.jobRepository.findById(
    "job-proof-draft-workspace-save-1",
  );
  const payload = savedJob?.payload as
    | {
        confirmationDraft?: {
          assetId?: string;
          sourceProofreadingJobId?: string;
          savedDecisionCount?: number;
          confirmationDecisions?: Array<{
            itemId?: string;
            action?: string;
            finalReplacementText?: string;
            note?: string;
          }>;
        };
      }
    | undefined;

  assert.equal(
    payload?.confirmationDraft?.assetId,
    "asset-proof-draft-workspace-save-1",
  );
  assert.equal(payload?.confirmationDraft?.sourceProofreadingJobId, undefined);
  assert.equal(payload?.confirmationDraft?.savedDecisionCount, 1);
  assert.equal(
    payload?.confirmationDraft?.confirmationDecisions?.[0]?.itemId,
    "issue-1",
  );
  assert.equal(
    payload?.confirmationDraft?.confirmationDecisions?.[0]?.action,
    "accepted_with_manual_edit",
  );
  assert.equal(
    payload?.confirmationDraft?.confirmationDecisions?.[0]?.finalReplacementText,
    "5 mg/dL",
  );
  assert.equal(
    payload?.confirmationDraft?.confirmationDecisions?.[0]?.note,
    "直接在工作台保存人工确认。",
  );
});

test("saveConfirmationDraft counts governed quality findings and failed checks as confirmation items", async () => {
  const harness = await seedMedicalQualityFixture();
  const transformCalls: Array<unknown> = [];

  await harness.jobRepository.save({
    id: "job-proof-draft-save-findings-1",
    manuscript_id: "manuscript-1",
    module: "proofreading",
    job_type: "proofreading_draft_run",
    status: "completed",
    requested_by: "proofreader-1",
    payload: {
      parentAssetId: harness.originalAssetId,
      sourceManuscriptAssetId: harness.originalAssetId,
      proofreadingFindings: {
        failedChecks: [
          {
            ruleId: "rule-safety-1",
            expected: "The hemoglobin was stable.",
            actual: "The hemoglobin were stable.",
            severity: "warning",
            blockIndex: 1,
            explanation: "需要修正语法一致性。",
          },
        ],
        qualityFindings: [
          {
            issue_id: "quality-stat-1",
            issue_type: "statistical_expression",
            category: "sentence_and_logic",
            severity: "high",
            action: "manual_review",
            confidence: 0.92,
            source_kind: "language_model",
            text_excerpt: "P <0.05",
            suggested_replacement: "P < 0.05",
            explanation: "统计学表达前后空格需要统一。",
            evidence_pack: {
              location: {
                paragraph_index: 2,
              },
              excerpt: "P <0.05",
              suggestion: "P < 0.05",
              rationale: "统计学表达前后空格需要统一。",
            },
          },
        ],
      },
    },
    attempt_count: 1,
    created_at: "2026-04-24T15:10:00.000Z",
    updated_at: "2026-04-24T15:12:00.000Z",
  });
  await harness.assetRepository.save({
    id: "asset-proof-draft-save-findings-1",
    manuscript_id: "manuscript-1",
    asset_type: "proofreading_draft_report",
    status: "active",
    storage_key: "runs/manuscript-1/proofreading/draft-save-findings.md",
    mime_type: "text/markdown",
    parent_asset_id: harness.originalAssetId,
    source_module: "proofreading",
    source_job_id: "job-proof-draft-save-findings-1",
    created_by: "proofreader-1",
    version_no: 2,
    is_current: false,
    file_name: "proofreading-draft-save-findings.md",
    created_at: "2026-04-24T15:12:00.000Z",
    updated_at: "2026-04-24T15:12:00.000Z",
  });
  await harness.jobRepository.save({
    id: "job-proof-confirm-save-findings-1",
    manuscript_id: "manuscript-1",
    module: "proofreading",
    job_type: "proofreading_confirm",
    status: "completed",
    requested_by: "proofreader-1",
    payload: {
      parentAssetId: "asset-proof-draft-save-findings-1",
      sourceManuscriptAssetId: harness.originalAssetId,
    },
    attempt_count: 1,
    created_at: "2026-04-24T15:15:00.000Z",
    updated_at: "2026-04-24T15:17:00.000Z",
  });
  await harness.assetRepository.save({
    id: "asset-proof-final-save-findings-1",
    manuscript_id: "manuscript-1",
    asset_type: "final_proof_annotated_docx",
    status: "active",
    storage_key: "runs/manuscript-1/proofreading/final-save-findings.docx",
    mime_type:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    parent_asset_id: "asset-proof-draft-save-findings-1",
    source_module: "proofreading",
    source_job_id: "job-proof-confirm-save-findings-1",
    created_by: "proofreader-1",
    version_no: 3,
    is_current: true,
    file_name: "proofreading-final-save-findings.docx",
    created_at: "2026-04-24T15:17:00.000Z",
    updated_at: "2026-04-24T15:17:00.000Z",
  });

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
      async applyDeterministicRules(input: unknown) {
        transformCalls.push(input);
        return {
          appliedRuleIds: [],
          appliedChanges: [],
          tableInspectionFindings: [],
        };
      },
    } as never,
    createId: () => "unused-save-findings-id",
    now: () => new Date("2026-04-24T16:00:00.000Z"),
  } as never);

  await proofreadingService.saveConfirmationDraft({
    manuscriptId: "manuscript-1",
    confirmationAssetId: "asset-proof-final-save-findings-1",
    requestedBy: "proofreader-1",
    actorRole: "proofreader",
    confirmationDecisions: [
      {
        itemId: "rule-safety-1",
        targetText: "The hemoglobin were stable.",
        replacementText: "The hemoglobin was stable.",
        action: "accepted",
      },
      {
        itemId: "quality-1",
        targetText: "P <0.05",
        replacementText: "P < 0.05",
        action: "manual_only",
        note: "统计表达需要人工复核。",
      },
    ],
  });

  assert.equal(transformCalls.length, 0);

  const savedJob = await harness.jobRepository.findById(
    "job-proof-confirm-save-findings-1",
  );
  const payload = savedJob?.payload as
    | {
        confirmationDraft?: {
          totalItems?: number;
          savedDecisionCount?: number;
          confirmationSummary?: {
            totalItems?: number;
            manualOnlyCount?: number;
          };
          confirmationDecisions?: Array<{
            itemId?: string;
            action?: string;
          }>;
        };
      }
    | undefined;

  assert.equal(payload?.confirmationDraft?.totalItems, 2);
  assert.equal(payload?.confirmationDraft?.savedDecisionCount, 2);
  assert.equal(payload?.confirmationDraft?.confirmationSummary?.totalItems, 2);
  assert.equal(payload?.confirmationDraft?.confirmationSummary?.manualOnlyCount, 1);
  assert.deepEqual(
    payload?.confirmationDraft?.confirmationDecisions?.map((decision) => ({
      itemId: decision.itemId,
      action: decision.action,
    })),
    [
      {
        itemId: "rule-safety-1",
        action: "accepted",
      },
      {
        itemId: "quality-1",
        action: "manual_only",
      },
    ],
  );
});

test("publishHumanFinal preserves governed metadata for failed checks and quality findings", async () => {
  const harness = await seedMedicalQualityFixture();
  const transformCalls: Array<
    Parameters<EditorialDocxTransformService["applyDeterministicRules"]>[0]
  > = [];
  const residualObservations: Array<
    Parameters<ResidualLearningService["observeProofreadingResiduals"]>[0]
  > = [];

  await harness.jobRepository.save({
    id: "job-proof-draft-findings-1",
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
      snapshotId: "snapshot-proof-findings-1",
      proofreadingFindings: {
        failedChecks: [
          {
            ruleId: "rule-safety-1",
            expected: "The hemoglobin was stable.",
            actual: "The hemoglobin were stable.",
            severity: "warning",
            blockIndex: 1,
            explanation: "需要修正语法一致性。",
          },
        ],
        qualityFindings: [
          {
            issue_id: "quality-stat-1",
            issue_type: "statistical_expression",
            category: "sentence_and_logic",
            severity: "medium",
            action: "suggest_fix",
            confidence: 0.92,
            source_kind: "language_model",
            text_excerpt: "P <0.05",
            suggested_replacement: "P < 0.05",
            explanation: "统计学表达前后空格需要统一。",
            evidence_pack: {
              location: {
                paragraph_index: 2,
              },
              excerpt: "P <0.05",
              suggestion: "P < 0.05",
              rationale: "统计学表达前后空格需要统一。",
            },
          },
        ],
      },
      proofreadingSourceBlocks: [
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
          text: "P <0.05",
        },
      ],
    },
    attempt_count: 1,
    created_at: "2026-04-24T16:10:00.000Z",
    updated_at: "2026-04-24T16:12:00.000Z",
  });
  await harness.assetRepository.save({
    id: "asset-proof-draft-findings-1",
    manuscript_id: "manuscript-1",
    asset_type: "proofreading_draft_report",
    status: "active",
    storage_key: "runs/manuscript-1/proofreading/draft-findings.md",
    mime_type: "text/markdown",
    parent_asset_id: harness.originalAssetId,
    source_module: "proofreading",
    source_job_id: "job-proof-draft-findings-1",
    created_by: "proofreader-1",
    version_no: 2,
    is_current: false,
    file_name: "proofreading-draft-findings.md",
    created_at: "2026-04-24T16:12:00.000Z",
    updated_at: "2026-04-24T16:12:00.000Z",
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
    residualLearningService: {
      async observeProofreadingResiduals(
        input: Parameters<ResidualLearningService["observeProofreadingResiduals"]>[0],
      ) {
        residualObservations.push(input);
        return [];
      },
    } as never,
    createId: () => `job-proof-findings-human-${++nextId}`,
    now: () => new Date("2026-04-24T16:30:00.000Z"),
  } as never);

  const result = await proofreadingService.publishHumanFinal({
    manuscriptId: "manuscript-1",
    finalAssetId: "asset-proof-draft-findings-1",
    requestedBy: "proofreader-1",
    actorRole: "proofreader",
    storageKey: "runs/manuscript-1/proofreading/human-findings-final.docx",
    fileName: "human-findings-final.docx",
    confirmationDecisions: [
      {
        itemId: "rule-safety-1",
        targetText: "The hemoglobin were stable.",
        replacementText: "The hemoglobin was stable.",
        action: "accepted",
      },
      {
        itemId: "quality-1",
        targetText: "P <0.05",
        replacementText: "P < 0.05",
        action: "accepted_with_manual_edit",
        editedReplacementText: "P < 0.05",
      },
    ],
  });

  assert.equal(result.asset.asset_type, "human_final_docx");
  assert.equal(transformCalls.length, 1);
  assert.deepEqual(transformCalls[0]?.aiReplacements, [
    {
      targetText: "The hemoglobin were stable.",
      replacementText: "The hemoglobin was stable.",
      reason: "failed_check",
    },
    {
      targetText: "P <0.05",
      replacementText: "P < 0.05",
      reason: "statistical_expression",
    },
  ]);

  const payload = result.job.payload as
    | {
        writebackLedger?: Array<{
          itemId?: string;
          applied?: boolean;
          anchorBlockIndex?: number;
        }>;
      }
    | undefined;
  assert.deepEqual(payload?.writebackLedger, [
    {
      itemId: "rule-safety-1",
      action: "accepted",
      applied: true,
      disposition: "auto_writeback",
      anchorBlockIndex: 1,
    },
    {
      itemId: "quality-1",
      action: "accepted_with_manual_edit",
      applied: true,
      disposition: "auto_writeback",
      anchorBlockIndex: 2,
    },
  ]);

  assert.equal(residualObservations.length, 1);
  assert.deepEqual(residualObservations[0]?.sourceBlocks, [
    {
      blockIndex: 2,
      text: "P <0.05",
      residualHints: [
        {
          issue_type: "style_consistency_gap",
          excerpt: "P <0.05",
          suggestion: "P < 0.05",
          rationale:
            "Human adjusted the proofreading issue before final publication.",
          source_stage: "model_residual",
          signal_breakdown: {
            promotion_evidence: {
              source: "proofreading_confirmation",
              decision_action: "accept_and_edit",
              correction_category: "statistical_expression",
            },
          },
        },
      ],
    },
  ]);
});
