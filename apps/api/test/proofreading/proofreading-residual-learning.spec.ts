import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryResidualIssueRepository } from "../../src/modules/residual-learning/in-memory-residual-learning-repository.ts";
import { ResidualLearningService } from "../../src/modules/residual-learning/residual-learning-service.ts";
import { ProofreadingService } from "../../src/modules/proofreading/proofreading-service.ts";
import type { EditorialDocxTransformService } from "../../src/modules/document-pipeline/editorial-docx-transform-service.ts";
import type {
  ExecuteMainlineAiInput,
  MainlineAiRuntimeExecutor,
} from "../../src/modules/shared/mainline-ai-runtime-executor.ts";
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
});

test("governed proofreading draft persists AI residual issues from the proofreading plan", async () => {
  const harness = await seedMedicalQualityFixture();
  const residualIssueRepository = new InMemoryResidualIssueRepository();
  const residualLearningService = new ResidualLearningService({
    residualIssueRepository,
    createId: () => "residual-proofreading-plan-1",
    now: () => new Date("2026-04-18T10:15:00.000Z"),
  });

  const proofreadingExecutor: MainlineAiRuntimeExecutor = {
    async executeJson<T>(_input: ExecuteMainlineAiInput): Promise<T> {
      return {
        role: "医学稿件终校审校员",
        summary: "AI residual plan for governed proofreading.",
        issues: [
          {
            itemId: "issue-plan-1",
            title: "术语需要写全",
            description: "首次出现 ALT 时应补足全称。",
            severity: "medium",
            source: "residual_ai",
            issueType: "terminology_gap",
            blocksFinal: false,
            anchor: {
              blockIndex: 0,
              quote: "ALT remained stable.",
              sectionLabel: "results",
            },
            suggestion: {
              action: "replace_text",
              replacementText: "Alanine aminotransferase remained stable.",
            },
          },
        ],
        manualReviewItems: [],
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
    residualLearningService,
    proofreadingSourceBlockResolver: {
      async resolveBlocks() {
        return [
          {
            section: "results",
            block_kind: "paragraph",
            text: "ALT remained stable throughout follow-up.",
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
    now: () => new Date("2026-04-18T10:15:00.000Z"),
    createId: () => "job-proofreading-plan-1",
  } as never);

  const result = await proofreadingService.createDraft({
    manuscriptId: "manuscript-1",
    parentAssetId: harness.originalAssetId,
    requestedBy: "proofreader-1",
    actorRole: "proofreader",
    storageKey: "proofreading/manuscript-1/plan-draft-report.md",
    fileName: "plan-draft-report.md",
  });

  assert.ok(result.snapshot_id);
  const storedIssues = await residualIssueRepository.listByExecutionSnapshotId(
    result.snapshot_id,
  );

  assert.equal(storedIssues.length, 1);
  assert.equal(storedIssues[0]?.excerpt, "ALT remained stable.");
  assert.equal(
    storedIssues[0]?.suggestion,
    "Alanine aminotransferase remained stable.",
  );
  assert.equal(storedIssues[0]?.recommended_route, "knowledge_candidate");
});

test("proofreading governance handoff includes manual-only residual issues without relying on the rule-center queue", async () => {
  const harness = await seedMedicalQualityFixture();

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
    learningService: {
      async listLearningCandidates() {
        return [
          {
            id: "candidate-proof-1",
            type: "rule_candidate",
            status: "pending_review",
            manuscript_id: "manuscript-1",
            module: "proofreading",
            manuscript_type: "clinical_study",
            governed_provenance_kind: "residual_issue",
            title: "Proofreading residual candidate",
            proposal_text: "Promote the validated proofreading residual to a rule.",
            created_by: "reviewer-1",
            created_at: "2026-04-18T10:35:00.000Z",
            updated_at: "2026-04-18T10:35:00.000Z",
            review_actions: [],
          },
        ];
      },
    } as never,
    residualLearningService: {
      async observeProofreadingResiduals() {
        return [];
      },
      async listIssues() {
        return [
          {
            id: "residual-manual-1",
            module: "proofreading",
            manuscript_id: "manuscript-1",
            manuscript_type: "clinical_study",
            execution_snapshot_id: "snapshot-manual-1",
            issue_type: "medical_meaning_risk",
            source_stage: "model_residual",
            excerpt: "The conclusion reverses the adverse-event trend.",
            novelty_key: "medical_meaning_risk:trend",
            recurrence_count: 1,
            system_confidence_band: "L1_review_pending",
            risk_level: "high",
            recommended_route: "manual_only",
            status: "manual_review_pending",
            harness_validation_status: "not_required",
            created_at: "2026-04-18T10:30:00.000Z",
            updated_at: "2026-04-18T10:31:00.000Z",
          },
          {
            id: "residual-validate-1",
            module: "proofreading",
            manuscript_id: "manuscript-1",
            manuscript_type: "clinical_study",
            execution_snapshot_id: "snapshot-validate-1",
            issue_type: "terminology_gap",
            source_stage: "model_residual",
            excerpt: "ALT remained stable.",
            novelty_key: "terminology_gap:alt",
            recurrence_count: 1,
            system_confidence_band: "L1_review_pending",
            risk_level: "medium",
            recommended_route: "rule_candidate",
            status: "validation_failed",
            harness_validation_status: "failed",
            created_at: "2026-04-18T10:20:00.000Z",
            updated_at: "2026-04-18T10:21:00.000Z",
          },
          {
            id: "residual-created-1",
            module: "proofreading",
            manuscript_id: "manuscript-1",
            manuscript_type: "clinical_study",
            execution_snapshot_id: "snapshot-created-1",
            issue_type: "unit_expression_gap",
            source_stage: "model_residual",
            excerpt: "5 mg per dL",
            novelty_key: "unit_expression_gap:5mg",
            recurrence_count: 1,
            system_confidence_band: "L2_candidate_ready",
            risk_level: "low",
            recommended_route: "rule_candidate",
            status: "candidate_created",
            harness_validation_status: "passed",
            learning_candidate_id: "candidate-proof-1",
            created_at: "2026-04-18T10:10:00.000Z",
            updated_at: "2026-04-18T10:11:00.000Z",
          },
          {
            id: "residual-archived-1",
            module: "proofreading",
            manuscript_id: "manuscript-1",
            manuscript_type: "clinical_study",
            execution_snapshot_id: "snapshot-archived-1",
            issue_type: "style_consistency_gap",
            source_stage: "model_residual",
            excerpt: "Spacing drift.",
            novelty_key: "style_consistency_gap:spacing",
            recurrence_count: 1,
            system_confidence_band: "L1_review_pending",
            risk_level: "low",
            recommended_route: "evidence_only",
            status: "archived",
            harness_validation_status: "not_required",
            created_at: "2026-04-18T10:05:00.000Z",
            updated_at: "2026-04-18T10:06:00.000Z",
          },
          {
            id: "residual-other-manuscript-1",
            module: "proofreading",
            manuscript_id: "manuscript-2",
            manuscript_type: "clinical_study",
            execution_snapshot_id: "snapshot-other-1",
            issue_type: "terminology_gap",
            source_stage: "model_residual",
            excerpt: "AST remained stable.",
            novelty_key: "terminology_gap:ast",
            recurrence_count: 1,
            system_confidence_band: "L1_review_pending",
            risk_level: "medium",
            recommended_route: "manual_only",
            status: "manual_only",
            harness_validation_status: "not_required",
            created_at: "2026-04-18T10:25:00.000Z",
            updated_at: "2026-04-18T10:26:00.000Z",
          },
        ];
      },
    } as never,
    now: () => new Date("2026-04-18T10:40:00.000Z"),
    createId: () => "job-proofreading-handoff-1",
  } as never);

  const handoff = await proofreadingService.getGovernanceHandoff({
    manuscriptId: "manuscript-1",
    actorRole: "proofreader",
  });

  assert.deepEqual(
    handoff.residualReviewItems.map((item) => ({
      id: item.id,
      source_status: item.source_status,
      review_status: item.review_status,
      available_actions: item.available_actions,
      recommended_route: item.recommended_route,
    })),
    [
      {
        id: "residual-manual-1",
        source_status: "manual_review_pending",
        review_status: "pending",
        available_actions: [
          "accept_change_only",
          "reject_as_false_positive",
          "archive_as_evidence_only",
        ],
        recommended_route: "manual_only",
      },
      {
        id: "residual-validate-1",
        source_status: "validation_failed",
        review_status: "pending",
        available_actions: [
          "validate",
          "accept_change_only",
          "reject_as_false_positive",
          "archive_as_evidence_only",
        ],
        recommended_route: "rule_candidate",
      },
    ],
  );
  assert.deepEqual(handoff.ruleCandidates.map((item) => item.id), ["candidate-proof-1"]);
});

test("proofreading governance handoff scopes residual items and rule candidates to the current proofreading snapshot", async () => {
  const harness = await seedMedicalQualityFixture();

  const sourceLinksByCandidateId = new Map([
    [
      "candidate-current-residual",
      [
        {
          id: "link-current-residual",
          learning_candidate_id: "candidate-current-residual",
          source_kind: "residual_issue",
          snapshot_kind: "execution_snapshot",
          snapshot_id: "snapshot-proof-current",
          source_asset_id: "asset-proof-current",
          created_at: "2026-04-23T10:00:00.000Z",
        },
      ],
    ],
    [
      "candidate-current-human",
      [
        {
          id: "link-current-human",
          learning_candidate_id: "candidate-current-human",
          source_kind: "human_feedback",
          snapshot_kind: "execution_snapshot",
          snapshot_id: "snapshot-proof-current",
          feedback_record_id: "feedback-proof-current",
          source_asset_id: "asset-proof-current",
          created_at: "2026-04-23T10:01:00.000Z",
        },
      ],
    ],
    [
      "candidate-stale",
      [
        {
          id: "link-stale",
          learning_candidate_id: "candidate-stale",
          source_kind: "residual_issue",
          snapshot_kind: "execution_snapshot",
          snapshot_id: "snapshot-proof-stale",
          source_asset_id: "asset-proof-stale",
          created_at: "2026-04-23T09:00:00.000Z",
        },
      ],
    ],
  ]);

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
    learningService: {
      async listLearningCandidates() {
        return [
          {
            id: "candidate-current-residual",
            type: "rule_candidate",
            status: "pending_review",
            manuscript_id: "manuscript-1",
            module: "proofreading",
            manuscript_type: "clinical_study",
            governed_provenance_kind: "residual_issue",
            title: "Current proofreading residual candidate",
            created_by: "reviewer-1",
            created_at: "2026-04-23T10:00:00.000Z",
            updated_at: "2026-04-23T10:00:00.000Z",
            review_actions: [],
          },
          {
            id: "candidate-current-human",
            type: "rule_candidate",
            status: "pending_review",
            manuscript_id: "manuscript-1",
            module: "proofreading",
            manuscript_type: "clinical_study",
            governed_provenance_kind: "human_feedback",
            title: "Current proofreading human candidate",
            created_by: "reviewer-1",
            created_at: "2026-04-23T10:01:00.000Z",
            updated_at: "2026-04-23T10:01:00.000Z",
            review_actions: [],
          },
          {
            id: "candidate-stale",
            type: "rule_candidate",
            status: "pending_review",
            manuscript_id: "manuscript-1",
            module: "proofreading",
            manuscript_type: "clinical_study",
            governed_provenance_kind: "residual_issue",
            title: "Stale proofreading residual candidate",
            created_by: "reviewer-1",
            created_at: "2026-04-23T09:00:00.000Z",
            updated_at: "2026-04-23T09:00:00.000Z",
            review_actions: [],
          },
        ];
      },
      async listLearningCandidateSourceLinksByCandidateId(candidateId: string) {
        return sourceLinksByCandidateId.get(candidateId) ?? [];
      },
    } as never,
    residualLearningService: {
      async observeProofreadingResiduals() {
        return [];
      },
      async listIssues() {
        return [
          {
            id: "residual-current-manual",
            module: "proofreading",
            manuscript_id: "manuscript-1",
            manuscript_type: "clinical_study",
            execution_snapshot_id: "snapshot-proof-current",
            issue_type: "cross_section_contradiction",
            source_stage: "model_residual",
            excerpt: "Methods mention 124 patients but results mention 132.",
            novelty_key: "cross_section_contradiction:population",
            recurrence_count: 1,
            system_confidence_band: "L1_review_pending",
            risk_level: "high",
            recommended_route: "manual_only",
            status: "manual_review_pending",
            harness_validation_status: "not_required",
            created_at: "2026-04-23T10:00:00.000Z",
            updated_at: "2026-04-23T10:02:00.000Z",
          },
          {
            id: "residual-current-knowledge",
            module: "proofreading",
            manuscript_id: "manuscript-1",
            manuscript_type: "clinical_study",
            execution_snapshot_id: "snapshot-proof-current",
            issue_type: "terminology_consistency",
            source_stage: "model_residual",
            excerpt: "ALT remained stable.",
            novelty_key: "terminology_consistency:alt",
            recurrence_count: 1,
            system_confidence_band: "L1_review_pending",
            risk_level: "medium",
            recommended_route: "knowledge_candidate",
            status: "validation_pending",
            harness_validation_status: "queued",
            created_at: "2026-04-23T10:03:00.000Z",
            updated_at: "2026-04-23T10:04:00.000Z",
          },
          {
            id: "residual-stale",
            module: "proofreading",
            manuscript_id: "manuscript-1",
            manuscript_type: "clinical_study",
            execution_snapshot_id: "snapshot-proof-stale",
            issue_type: "conclusion_overclaim",
            source_stage: "model_residual",
            excerpt: "The treatment is definitively curative.",
            novelty_key: "conclusion_overclaim:curative",
            recurrence_count: 1,
            system_confidence_band: "L1_review_pending",
            risk_level: "high",
            recommended_route: "manual_only",
            status: "manual_review_pending",
            harness_validation_status: "not_required",
            created_at: "2026-04-23T09:00:00.000Z",
            updated_at: "2026-04-23T09:01:00.000Z",
          },
        ];
      },
    } as never,
  } as never);

  const handoff = await proofreadingService.getGovernanceHandoff({
    manuscriptId: "manuscript-1",
    actorRole: "proofreader",
    snapshotId: "snapshot-proof-current",
  });

  assert.deepEqual(
    handoff.residualReviewItems.map((item) => item.id),
    ["residual-current-knowledge", "residual-current-manual"],
  );
  assert.deepEqual(
    handoff.ruleCandidates.map((item) => item.id).sort(),
    ["candidate-current-human", "candidate-current-residual"],
  );
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
  assert.ok(
    storedIssues.every(
      (issue) =>
        issue.execution_snapshot_id === "snapshot-proof-human-1" &&
        issue.output_asset_id === result.asset.id &&
        issue.source_stage === "model_residual",
    ),
  );
});
