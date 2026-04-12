import test from "node:test";
import assert from "node:assert/strict";
import { EditingService } from "../../src/modules/editing/editing-service.ts";
import { seedMedicalQualityFixture } from "../shared/medical-quality-fixture.ts";

test("editing keeps medical terminology and statistics findings advisory instead of turning them into deterministic rewrites", async () => {
  const harness = await seedMedicalQualityFixture();
  let recordedQualityInput: Record<string, unknown> | undefined;

  const editingService = new EditingService({
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
      async applyDeterministicRules() {
        return {
          appliedRuleIds: [],
          appliedChanges: [],
        };
      },
    } as never,
    manuscriptQualitySourceBlockResolver: {
      async resolveBlocks() {
        return [
          {
            section: "discussion",
            block_kind: "paragraph",
            text: "Results: aspartate aminotransferase (ALT) improved after treatment.",
          },
          {
            section: "results",
            block_kind: "paragraph",
            text: "Results: p = 0.07, yet the manuscript claims a statistically significant improvement.",
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
              issue_id: "editing-medical-1",
              module_scope: "medical_specialized",
              issue_type: "medical_terminology.abbreviation_drift",
              category: "medical_logic",
              severity: "high",
              action: "manual_review",
              confidence: 0.9,
              paragraph_index: 0,
              sentence_index: 0,
              source_kind: "deterministic_rule",
              source_id: "medical-terminology/abbreviation-drift",
              text_excerpt: "aspartate aminotransferase (ALT)",
              explanation: "Abbreviation ALT maps to multiple long forms.",
            },
            {
              issue_id: "editing-medical-2",
              module_scope: "medical_specialized",
              issue_type: "statistical_expression.significance_mismatch",
              category: "medical_calculation_and_parsing",
              severity: "high",
              action: "manual_review",
              confidence: 0.89,
              paragraph_index: 1,
              sentence_index: 0,
              source_kind: "deterministic_rule",
              source_id: "statistics/significance-mismatch",
              text_excerpt:
                "Results: p = 0.07, yet the manuscript claims a statistically significant improvement.",
              explanation:
                "The stated statistical significance appears inconsistent with the reported p-value.",
            },
          ],
          quality_findings_summary: {
            total_issue_count: 2,
            issue_count_by_scope: {
              medical_specialized: 2,
            },
            issue_count_by_action: {
              manual_review: 2,
            },
            issue_count_by_severity: {
              high: 2,
            },
            highest_action: "manual_review",
            representative_issue_ids: ["editing-medical-1", "editing-medical-2"],
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
    createId: () => "job-editing-medical-1",
  } as never);

  const result = await editingService.run({
    manuscriptId: "manuscript-1",
    parentAssetId: harness.originalAssetId,
    requestedBy: "editor-1",
    actorRole: "editor",
    storageKey: "edited/manuscript-1/medical-output.docx",
    fileName: "medical-output.docx",
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
  assert.equal(recordedQualityInput?.targetModule, "editing");
  assert.deepEqual(recordedQualityInput?.qualityPackageVersionIds, [
    "quality-package-general-1",
    "quality-package-medical-1",
  ]);
  assert.equal(
    (
      result.job.payload?.qualityFindings as Array<{ module_scope: string }>
    )?.[0]?.module_scope,
    "medical_specialized",
  );
  assert.deepEqual(result.job.payload?.appliedChanges, []);
  assert.deepEqual(result.job.payload?.manualReviewItems, [
    {
      ruleId: "rule-discussion-reshape-editing",
      reason: "medical_meaning_risk",
    },
  ]);
  assert.equal(
    (
      result.job.payload?.qualityFindingSummary as { total_issue_count: number }
    )?.total_issue_count,
    2,
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
