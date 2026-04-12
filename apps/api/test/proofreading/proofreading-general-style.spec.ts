import test from "node:test";
import assert from "node:assert/strict";
import { ProofreadingService } from "../../src/modules/proofreading/proofreading-service.ts";
import {
  BEFORE_HEADING,
  seedMedicalQualityFixture,
} from "../shared/medical-quality-fixture.ts";

test("proofreading reports advisory general style findings alongside governed rule checks", async () => {
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
    proofreadingSourceBlockResolver: {
      async resolveBlocks() {
        return [
          {
            section: "abstract",
            block_kind: "heading",
            text: BEFORE_HEADING,
          },
          {
            section: "abstract",
            block_kind: "paragraph",
            text: "Methods: patients were grouped. Results: symptoms improved. Conclusion: treatment was safe.",
          },
        ];
      },
    } as never,
    manuscriptQualityService: {
      async runChecks() {
        return {
          requested_scopes: ["general_proofreading", "medical_specialized"],
          completed_scopes: ["general_proofreading"],
          issues: [
            {
              issue_id: "proofreading-style-1",
              module_scope: "general_proofreading",
              issue_type: "style.section_expectation_missing",
              category: "sentence_and_logic",
              severity: "medium",
              action: "suggest_fix",
              confidence: 0.78,
              paragraph_index: 0,
              source_kind: "deterministic_rule",
              source_id: "style/section-expectation-missing",
              text_excerpt: "Abstract",
              explanation:
                "Section abstract is missing expected labels: objective.",
            },
          ],
          quality_findings_summary: {
            total_issue_count: 1,
            issue_count_by_scope: {
              general_proofreading: 1,
            },
            issue_count_by_action: {
              suggest_fix: 1,
            },
            issue_count_by_severity: {
              medium: 1,
            },
            highest_action: "suggest_fix",
            representative_issue_ids: ["proofreading-style-1"],
          },
          resolved_quality_packages: [
            {
              package_id: "quality-package-general-1",
              package_name: "Medical Research Style",
              package_kind: "general_style_package",
              target_scopes: ["general_proofreading"],
              version: 1,
            },
          ],
        };
      },
    } as never,
    now: () => new Date("2026-04-07T10:00:00.000Z"),
    createId: () => "job-proofreading-style-1",
  } as never);

  const result = await proofreadingService.createDraft({
    manuscriptId: "manuscript-1",
    parentAssetId: harness.originalAssetId,
    requestedBy: "proofreader-1",
    actorRole: "proofreader",
    storageKey: "proofreading/manuscript-1/style-draft-report.md",
    fileName: "style-draft-report.md",
  });

  assert.equal(
    (
      result.job.payload?.proofreadingFindings as {
        qualityFindings?: Array<{ issue_type: string; action: string }>;
      }
    ).qualityFindings?.[0]?.issue_type,
    "style.section_expectation_missing",
  );
  assert.equal(
    (
      result.job.payload?.proofreadingFindings as {
        qualityFindingSummary?: { highest_action: string };
      }
    ).qualityFindingSummary?.highest_action,
    "suggest_fix",
  );
  assert.match(
    String(result.job.payload?.reportMarkdown),
    /style\.section_expectation_missing/,
  );
});
