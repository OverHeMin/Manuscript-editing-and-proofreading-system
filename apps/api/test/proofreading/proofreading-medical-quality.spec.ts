import test from "node:test";
import assert from "node:assert/strict";
import { ProofreadingService } from "../../src/modules/proofreading/proofreading-service.ts";
import {
  BEFORE_HEADING,
  seedMedicalQualityFixture,
} from "../shared/medical-quality-fixture.ts";

test("proofreading draft payloads include advisory medical findings without changing governed rule inspection flow", async () => {
  const harness = await seedMedicalQualityFixture();
  let recordedQualityInput: Record<string, unknown> | undefined;

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
            section: "conclusion",
            block_kind: "paragraph",
            text: "Conclusion: the observational study proves the treatment cures every patient.",
          },
        ];
      },
    } as never,
    manuscriptQualityService: {
      async runChecks(input: Record<string, unknown>) {
        recordedQualityInput = input;
        return {
          requested_scopes: ["general_proofreading", "medical_specialized"],
          completed_scopes: ["general_proofreading", "medical_specialized"],
          issues: [
            {
              issue_id: "proofreading-general-1",
              module_scope: "general_proofreading",
              issue_type: "punctuation.repeated_mark",
              category: "punctuation_and_pairs",
              severity: "low",
              action: "auto_fix",
              confidence: 0.99,
              paragraph_index: 1,
              sentence_index: 0,
              source_kind: "deterministic_rule",
              source_id: "punctuation/repeated-mark",
              text_excerpt: "Result..",
              explanation: "Repeated punctuation marks are mechanical.",
            },
            {
              issue_id: "proofreading-medical-1",
              module_scope: "medical_specialized",
              issue_type: "evidence_alignment.overstated_conclusion",
              category: "medical_logic",
              severity: "high",
              action: "manual_review",
              confidence: 0.87,
              paragraph_index: 1,
              sentence_index: 0,
              source_kind: "language_model",
              source_id: "medical/evidence-alignment",
              text_excerpt:
                "Conclusion: the observational study proves the treatment cures every patient.",
              explanation:
                "The conclusion language appears stronger than the study design supports.",
            },
          ],
          quality_findings_summary: {
            total_issue_count: 2,
            issue_count_by_scope: {
              general_proofreading: 1,
              medical_specialized: 1,
            },
            issue_count_by_action: {
              auto_fix: 1,
              manual_review: 1,
            },
            issue_count_by_severity: {
              low: 1,
              high: 1,
            },
            highest_action: "manual_review",
            representative_issue_ids: [
              "proofreading-general-1",
              "proofreading-medical-1",
            ],
          },
          resolved_quality_packages: [
            {
              package_id: "quality-package-general-1",
              package_name: "Medical Research Style",
              package_kind: "general_style_package",
              target_scopes: ["general_proofreading"],
              version: 1,
            },
            {
              package_id: "quality-package-medical-1",
              package_name: "Medical Analyzer Default",
              package_kind: "medical_analyzer_package",
              target_scopes: ["medical_specialized"],
              version: 1,
            },
          ],
        };
      },
    } as never,
    documentStructureService: {
      async extract() {
        return {
          manuscript_id: "manuscript-1",
          asset_id: "asset-original-1",
          file_name: "original.docx",
          status: "ready",
          parser: "python_docx",
          sections: [],
          tables: [
            {
              table_id: "Table 1",
              profile: {
                is_three_line_table: true,
                header_depth: 1,
                has_stub_column: true,
                has_statistical_footnotes: false,
                has_unit_markers: false,
              },
              header_cells: [],
              data_cells: [
                {
                  id: "cell-1",
                  text: "18.2 ± 1.3",
                  row_index: 0,
                  column_index: 0,
                  row_key: "ALT",
                  column_key: "treatment group",
                  coordinate: {
                    table_id: "Table 1",
                    target: "data_cell",
                    row_key: "ALT",
                    column_key: "treatment group",
                  },
                },
              ],
              footnote_items: [],
            },
          ],
          warnings: [],
        };
      },
    } as never,
    now: () => new Date("2026-04-07T10:00:00.000Z"),
    createId: () => "job-proofreading-medical-1",
  } as never);

  const result = await proofreadingService.createDraft({
    manuscriptId: "manuscript-1",
    parentAssetId: harness.originalAssetId,
    requestedBy: "proofreader-1",
    actorRole: "proofreader",
    storageKey: "proofreading/manuscript-1/medical-draft-report.md",
    fileName: "medical-draft-report.md",
  });

  assert.deepEqual(recordedQualityInput?.requestedScopes, [
    "general_proofreading",
    "medical_specialized",
  ]);
  assert.equal(
    (
      recordedQualityInput as {
        tableSnapshots?: Array<{ table_id: string }>;
      }
    )?.tableSnapshots?.[0]?.table_id,
    "Table 1",
  );
  assert.equal(recordedQualityInput?.targetModule, "proofreading");
  assert.deepEqual(recordedQualityInput?.qualityPackageVersionIds, [
    "quality-package-general-1",
    "quality-package-medical-1",
  ]);
  assert.equal(
    (
      result.job.payload?.proofreadingFindings as {
        qualityFindings?: Array<{ module_scope: string }>;
      }
    ).qualityFindings?.[1]?.module_scope,
    "medical_specialized",
  );
  assert.equal(
    (
      result.job.payload?.proofreadingFindings as {
        qualityFindingSummary?: { highest_action: string };
      }
    ).qualityFindingSummary?.highest_action,
    "manual_review",
  );
  assert.match(
    String(result.job.payload?.reportMarkdown),
    /evidence_alignment\.overstated_conclusion/,
  );
  assert.ok(result.snapshot_id);
  const snapshot = await harness.executionTrackingRepository.findSnapshotById(
    result.snapshot_id,
  );
  assert.deepEqual(snapshot?.quality_packages, [
    {
      package_id: "quality-package-general-1",
      package_name: "Medical Research Style",
      package_kind: "general_style_package",
      target_scopes: ["general_proofreading"],
      version: 1,
    },
    {
      package_id: "quality-package-medical-1",
      package_name: "Medical Analyzer Default",
      package_kind: "medical_analyzer_package",
      target_scopes: ["medical_specialized"],
      version: 1,
    },
  ]);
  assert.equal(result.job.status, "completed");
});
