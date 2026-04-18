import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryResidualIssueRepository } from "../../src/modules/residual-learning/in-memory-residual-learning-repository.ts";
import { ResidualLearningService } from "../../src/modules/residual-learning/residual-learning-service.ts";
import { ProofreadingService } from "../../src/modules/proofreading/proofreading-service.ts";
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

  assert.equal(result.snapshot_id, "snapshot-1");
  assert.equal(storedIssues.length, 1);
  assert.equal(storedIssues[0]?.execution_snapshot_id, "snapshot-1");
  assert.equal(storedIssues[0]?.output_asset_id, result.asset.id);
  assert.equal(storedIssues[0]?.module, "proofreading");
});
