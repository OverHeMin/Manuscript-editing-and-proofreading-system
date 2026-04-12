import test from "node:test";
import assert from "node:assert/strict";
import { ScreeningService } from "../../src/modules/screening/screening-service.ts";
import { seedMedicalQualityFixture } from "../shared/medical-quality-fixture.ts";

test("screening exposes reviewer-facing medical escalation signals for evidence and privacy findings", async () => {
  const harness = await seedMedicalQualityFixture();
  let recordedQualityInput: Record<string, unknown> | undefined;

  const screeningService = new ScreeningService({
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
    manuscriptQualitySourceBlockResolver: {
      async resolveBlocks() {
        return [
          {
            section: "conclusion",
            block_kind: "paragraph",
            text: "Conclusion: the observational study proves the treatment cures every patient.",
          },
          {
            section: "appendix",
            block_kind: "paragraph",
            text: "Contact patient@example.com for follow-up.",
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
              issue_id: "screening-medical-1",
              module_scope: "medical_specialized",
              issue_type: "evidence_alignment.overstated_conclusion",
              category: "medical_logic",
              severity: "high",
              action: "manual_review",
              confidence: 0.86,
              paragraph_index: 0,
              sentence_index: 0,
              source_kind: "language_model",
              source_id: "medical/evidence-alignment",
              text_excerpt:
                "Conclusion: the observational study proves the treatment cures every patient.",
              explanation:
                "The conclusion language appears stronger than the study design supports.",
            },
            {
              issue_id: "screening-medical-2",
              module_scope: "medical_specialized",
              issue_type: "ethics_privacy.direct_identifier",
              category: "medical_logic",
              severity: "critical",
              action: "block",
              confidence: 0.97,
              paragraph_index: 1,
              sentence_index: 0,
              source_kind: "deterministic_rule",
              source_id: "privacy/direct-identifier",
              text_excerpt: "patient@example.com",
              explanation:
                "Potential directly identifying information requires privacy review.",
            },
          ],
          quality_findings_summary: {
            total_issue_count: 2,
            issue_count_by_scope: {
              medical_specialized: 2,
            },
            issue_count_by_action: {
              manual_review: 1,
              block: 1,
            },
            issue_count_by_severity: {
              high: 1,
              critical: 1,
            },
            highest_action: "block",
            representative_issue_ids: [
              "screening-medical-1",
              "screening-medical-2",
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
                  id: "cell-p-1",
                  text: "0.03",
                  row_index: 0,
                  column_index: 1,
                  row_key: "ALT",
                  column_key: "P",
                  coordinate: {
                    table_id: "Table 1",
                    target: "data_cell",
                    row_key: "ALT",
                    column_key: "P",
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
    createId: () => "job-screening-medical-1",
  } as never);

  const result = await screeningService.run({
    manuscriptId: "manuscript-1",
    parentAssetId: harness.originalAssetId,
    requestedBy: "screener-1",
    actorRole: "screener",
    storageKey: "screening/manuscript-1/medical-report.md",
    fileName: "medical-report.md",
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
  assert.equal(recordedQualityInput?.targetModule, "screening");
  assert.deepEqual(recordedQualityInput?.qualityPackageVersionIds, [
    "quality-package-general-1",
    "quality-package-medical-1",
  ]);
  assert.equal(
    (
      result.job.payload?.qualityFindingSummary as { highest_action: string }
    )?.highest_action,
    "block",
  );
  assert.deepEqual(result.job.payload?.medicalReviewSignals, [
    {
      issueId: "screening-medical-1",
      issueType: "evidence_alignment.overstated_conclusion",
      action: "manual_review",
      severity: "high",
      explanation:
        "The conclusion language appears stronger than the study design supports.",
    },
    {
      issueId: "screening-medical-2",
      issueType: "ethics_privacy.direct_identifier",
      action: "block",
      severity: "critical",
      explanation:
        "Potential directly identifying information requires privacy review.",
    },
  ]);
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
