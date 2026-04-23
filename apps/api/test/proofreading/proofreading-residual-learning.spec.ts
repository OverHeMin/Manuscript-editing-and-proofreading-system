import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryResidualIssueRepository } from "../../src/modules/residual-learning/in-memory-residual-learning-repository.ts";
import { ResidualLearningService } from "../../src/modules/residual-learning/residual-learning-service.ts";
import { ProofreadingService } from "../../src/modules/proofreading/proofreading-service.ts";
import type { EditorialDocxTransformService } from "../../src/modules/document-pipeline/editorial-docx-transform-service.ts";
import { seedMedicalQualityFixture } from "../shared/medical-quality-fixture.ts";

test("governed proofreading draft stores residual issues with snapshot and asset lineage", async () => {
  const harness = await seedMedicalQualityFixture();
  const residualIssueRepository = new InMemoryResidualIssueRepository();
  const residualLearningService = new ResidualLearningService({
    residualIssueRepository,
    createId: () => "residual-proofreading-1",
    now: () => new Date("2026-04-18T10:10:00.000Z"),
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
    residualLearningService,
    proofreadingSourceBlockResolver: {
      async resolveBlocks() {
        return [
          {
            section: "results",
            block_kind: "paragraph",
            text: "Dose was 5 mg per dL in the governed proofreading report.",
            residualHints: [
              {
                issue_type: "unit_expression_gap",
                excerpt: "5 mg per dL",
                suggestion: "Normalize the unit expression to mg/dL.",
                rationale: "This is a repeatable formatting pattern.",
                model_confidence: 0.86,
                signal_breakdown: {
                  semantic_context: {
                    table_id: "table-1",
                    semantic_target: "note_zone",
                  },
                  promotion_evidence: {
                    source: "table_patch_result",
                    patch_type: "replace_table_note_text",
                    patch_status: "skipped_conflict",
                  },
                },
              },
            ],
          },
        ];
      },
    } as never,
    manuscriptQualityService: {
      async runChecks() {
        return {
          requested_scopes: ["general_proofreading", "medical_specialized"],
          completed_scopes: ["general_proofreading", "medical_specialized"],
          issues: [],
          quality_findings_summary: {
            total_issue_count: 0,
            issue_count_by_scope: {},
            issue_count_by_action: {},
            issue_count_by_severity: {},
            representative_issue_ids: [],
          },
          resolved_quality_packages: [],
        };
      },
    } as never,
    now: () => new Date("2026-04-18T10:10:00.000Z"),
    createId: () => "job-proofreading-residual-1",
  } as never);

  const result = await proofreadingService.createDraft({
    manuscriptId: "manuscript-1",
    parentAssetId: harness.originalAssetId,
    requestedBy: "proofreader-1",
    actorRole: "proofreader",
    storageKey: "proofreading/manuscript-1/residual-draft-report.md",
    fileName: "residual-draft-report.md",
  });

  assert.ok(result.snapshot_id);
  const storedIssues = await residualIssueRepository.listByExecutionSnapshotId(
    result.snapshot_id,
  );

  const payload = result.job.payload as
    | {
        executionMode?: string;
        executionProfileId?: string;
        runtimeBindingId?: string;
        modelId?: string;
        modelSource?: string;
        snapshotId?: string;
      }
    | undefined;

  assert.equal(result.snapshot_id, "snapshot-1");
  assert.equal(payload?.executionMode, "governed");
  assert.equal(payload?.executionProfileId, "profile-proofreading-1");
  assert.equal(payload?.runtimeBindingId, "binding-proofreading-1");
  assert.equal(payload?.modelId, "model-1");
  assert.equal(payload?.modelSource, "legacy_module_default");
  assert.equal(payload?.snapshotId, "snapshot-1");
  assert.equal(storedIssues.length, 1);
  assert.equal(storedIssues[0]?.execution_snapshot_id, "snapshot-1");
  assert.equal(storedIssues[0]?.output_asset_id, result.asset.id);
  assert.equal(storedIssues[0]?.module, "proofreading");
  assert.deepEqual(storedIssues[0]?.signal_breakdown, {
    semantic_context: {
      table_id: "table-1",
      semantic_target: "note_zone",
    },
    promotion_evidence: {
      source: "table_patch_result",
      patch_type: "replace_table_note_text",
      patch_status: "skipped_conflict",
    },
  });
});

test("human confirmation residuals preserve long-term routing truth for proofreading follow-up", async () => {
  const harness = await seedMedicalQualityFixture();
  const residualIssueRepository = new InMemoryResidualIssueRepository();
  const residualLearningService = new ResidualLearningService({
    residualIssueRepository,
    createId: (() => {
      let next = 0;
      return () => `residual-proofreading-human-${++next}`;
    })(),
    now: () => new Date("2026-04-18T10:20:00.000Z"),
  });

  await harness.jobRepository.save({
    id: "job-proof-draft-human-1",
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
        summary: "Proofreading draft plan for residual routing.",
        issues: [
          {
            itemId: "issue-1",
            title: "主谓一致错误",
            description: "需要修正文法一致性。",
            severity: "medium",
            source: "residual_ai",
            issueType: "grammar",
            blocksFinal: false,
            anchor: {
              blockIndex: 0,
              quote: "The hemoglobin were stable.",
              sectionLabel: "results",
            },
            suggestion: {
              action: "replace_text",
              replacementText: "The hemoglobin was stable.",
            },
          },
          {
            itemId: "issue-2",
            title: "术语需要写全",
            description: "首次出现应补足全称。",
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
          {
            itemId: "issue-3",
            title: "标点不规范",
            description: "连接副词前后的标点需要统一。",
            severity: "medium",
            source: "residual_ai",
            issueType: "punctuation",
            blocksFinal: false,
            anchor: {
              blockIndex: 2,
              quote: "Patients improved, however the sample stayed small.",
              sectionLabel: "discussion",
            },
            suggestion: {
              action: "replace_text",
              replacementText: "Patients improved; however the sample stayed small.",
            },
          },
          {
            itemId: "issue-4",
            title: "该建议应被驳回",
            description: "保留原文，不应自动改写。",
            severity: "medium",
            source: "residual_ai",
            issueType: "style",
            blocksFinal: false,
            anchor: {
              blockIndex: 3,
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
    },
    attempt_count: 1,
    created_at: "2026-04-18T08:10:00.000Z",
    updated_at: "2026-04-18T08:12:00.000Z",
  });
  await harness.assetRepository.save({
    id: "asset-proof-draft-human-1",
    manuscript_id: "manuscript-1",
    asset_type: "proofreading_draft_report",
    status: "active",
    storage_key: "runs/manuscript-1/proofreading/human-routing-draft.md",
    mime_type: "text/markdown",
    parent_asset_id: harness.originalAssetId,
    source_module: "proofreading",
    source_job_id: "job-proof-draft-human-1",
    created_by: "proofreader-1",
    version_no: 2,
    is_current: false,
    file_name: "human-routing-draft.md",
    created_at: "2026-04-18T08:12:00.000Z",
    updated_at: "2026-04-18T08:12:00.000Z",
  });
  await harness.jobRepository.save({
    id: "job-proof-final-human-1",
    manuscript_id: "manuscript-1",
    module: "proofreading",
    job_type: "proofreading_confirm",
    status: "completed",
    requested_by: "proofreader-1",
    payload: {
      parentAssetId: "asset-proof-draft-human-1",
      executionMode: "governed",
      executionProfileId: "profile-proofreading-1",
      runtimeBindingId: "binding-proofreading-1",
      modelId: "model-1",
      modelSource: "legacy_module_default",
      snapshotId: "snapshot-proof-human-1",
      knowledgeItemIds: ["knowledge-proof-1"],
    },
    attempt_count: 1,
    created_at: "2026-04-18T08:20:00.000Z",
    updated_at: "2026-04-18T08:22:00.000Z",
  });
  await harness.assetRepository.save({
    id: "asset-proof-final-human-1",
    manuscript_id: "manuscript-1",
    asset_type: "final_proof_annotated_docx",
    status: "active",
    storage_key: "runs/manuscript-1/proofreading/human-routing-final.docx",
    mime_type:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    parent_asset_id: "asset-proof-draft-human-1",
    source_module: "proofreading",
    source_job_id: "job-proof-final-human-1",
    created_by: "proofreader-1",
    version_no: 3,
    is_current: true,
    file_name: "human-routing-final.docx",
    created_at: "2026-04-18T08:22:00.000Z",
    updated_at: "2026-04-18T08:22:00.000Z",
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
        _input: Parameters<EditorialDocxTransformService["applyDeterministicRules"]>[0],
      ) {
        return {
          appliedRuleIds: [],
          appliedChanges: [],
          tableInspectionFindings: [],
        };
      },
    } as never,
    residualLearningService,
    createId: () => `job-proof-human-routing-${++nextId}`,
    now: () => new Date("2026-04-18T08:30:00.000Z"),
  } as never);

  const result = await proofreadingService.publishHumanFinal({
    manuscriptId: "manuscript-1",
    finalAssetId: "asset-proof-final-human-1",
    requestedBy: "proofreader-1",
    actorRole: "proofreader",
    storageKey: "runs/manuscript-1/proofreading/human-routing-final.docx",
    fileName: "human-routing-final.docx",
    confirmationDecisions: [
      {
        itemId: "issue-1",
        targetText: "The hemoglobin were stable.",
        replacementText: "The hemoglobin was stable.",
        action: "accepted_with_manual_edit",
        editedReplacementText: "The hemoglobin levels were stable.",
      },
      {
        itemId: "issue-2",
        targetText: "ALT remained stable.",
        replacementText: "Alanine aminotransferase remained stable.",
        action: "accepted_with_manual_edit",
        editedReplacementText: "Serum alanine aminotransferase (ALT) remained stable.",
      },
      {
        itemId: "issue-3",
        targetText: "Patients improved, however the sample stayed small.",
        replacementText: "Patients improved; however the sample stayed small.",
        action: "accepted_with_manual_edit",
        editedReplacementText: "Patients improved; however, the sample stayed small.",
      },
      {
        itemId: "issue-4",
        targetText: "No action should survive.",
        replacementText: "This correction should be rejected.",
        action: "rejected",
      },
    ],
  });

  const storedIssues = await residualIssueRepository.listByExecutionSnapshotId(
    "snapshot-proof-human-1",
  );
  const grammarIssue = storedIssues.find(
    (issue) => issue.issue_type === "uncovered_local_language_issue",
  );
  const terminologyIssue = storedIssues.find(
    (issue) => issue.issue_type === "terminology_gap",
  );
  const punctuationIssue = storedIssues.find(
    (issue) => issue.issue_type === "style_consistency_gap",
  );
  const rejectIssue = storedIssues.find(
    (issue) => issue.issue_type === "unsupported_correction_proposal",
  );

  assert.equal(result.asset.asset_type, "human_final_docx");
  assert.equal(storedIssues.length, 4);
  assert.equal(grammarIssue?.recommended_route, "prompt_template_candidate");
  assert.equal(grammarIssue?.harness_validation_status, "queued");
  assert.equal(grammarIssue?.status, "validation_pending");
  assert.equal(terminologyIssue?.recommended_route, "knowledge_candidate");
  assert.equal(terminologyIssue?.harness_validation_status, "queued");
  assert.equal(punctuationIssue?.recommended_route, "rule_candidate");
  assert.equal(punctuationIssue?.harness_validation_status, "queued");
  assert.equal(rejectIssue?.recommended_route, "evidence_only");
  assert.equal(rejectIssue?.harness_validation_status, "not_required");
  assert.equal(rejectIssue?.status, "evidence_only");
  assert.deepEqual(grammarIssue?.signal_breakdown, {
    promotion_evidence: {
      source: "proofreading_confirmation",
      decision_action: "accept_and_edit",
      correction_category: "grammar",
    },
  });
  assert.deepEqual(rejectIssue?.signal_breakdown, {
    promotion_evidence: {
      source: "proofreading_confirmation",
      decision_action: "reject",
      correction_category: "style",
    },
  });
  assert.ok(
    storedIssues.every(
      (issue) =>
        issue.execution_snapshot_id === "snapshot-proof-human-1" &&
        issue.output_asset_id === result.asset.id &&
        issue.source_stage === "model_residual",
    ),
  );
});
