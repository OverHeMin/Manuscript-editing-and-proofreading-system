import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryProofreadingPassRunRepository } from "../../src/modules/proofreading/in-memory-proofreading-pass-run-repository.ts";
import { ProofreadingService } from "../../src/modules/proofreading/proofreading-service.ts";
import type { CreateProofreadingAiPlanInput } from "../../src/modules/proofreading/proofreading-ai-plan-service.ts";
import { seedMedicalQualityFixture } from "../shared/medical-quality-fixture.ts";

test("governed proofreading draft uses deep orchestrator diagnostics by default", async () => {
  const harness = await seedMedicalQualityFixture();
  const proofreadingPassRunRepository = new InMemoryProofreadingPassRunRepository();
  const aiCalls: CreateProofreadingAiPlanInput[] = [];
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
    proofreadingPassRunRepository,
    proofreadingAiPlanService: {
      async createPlan(input: CreateProofreadingAiPlanInput) {
        aiCalls.push(structuredClone(input));
        return {
          role: "医学稿件终校审校员",
          summary: "deep slice checked",
          issues: [
            {
              itemId: `ai-${aiCalls.length}`,
              title: "切片建议",
              description: "切片内发现候选问题。",
              severity: "medium",
              source: "residual_ai",
              issueType: "slice.review",
              blocksFinal: false,
              anchor: { blockIndex: 0, quote: "ALT为19.5" },
              suggestion: { action: "verify_fact", note: "人工核对。" },
            },
          ],
          manualReviewItems: [],
        };
      },
    },
    proofreadingSourceBlockResolver: {
      async resolveBlocks() {
        return [
          {
            section: "results",
            block_kind: "paragraph",
            text: "结果见表1，ALT为19.5 U/L。",
          },
        ];
      },
    } as never,
    documentStructureService: {
      async extract() {
        return {
          manuscript_id: "manuscript-1",
          asset_id: harness.originalAssetId,
          file_name: "source.docx",
          status: "ready",
          parser: "python_docx",
          sections: [],
          metadata_candidates: [],
          tables: [
            {
              table_id: "table-1",
              row_count: 1,
              column_count: 1,
              profile: {
                is_three_line_table: true,
                header_depth: 1,
                has_stub_column: true,
                has_statistical_footnotes: false,
                has_unit_markers: true,
              },
              header_cells: [],
              data_cells: [],
              footnote_items: [],
              grid_cells: [
                {
                  id: "cell-1",
                  text: "18.2",
                  display_text: "18.2",
                  normalized_text: "18.2",
                  row_index: 0,
                  column_index: 0,
                  row_span: 1,
                  column_span: 1,
                  inferred_role: "data",
                  style_evidence: {
                    font_family: { availability: "authoritative", value: "Times New Roman" },
                    font_size_pt: { availability: "authoritative", value: 10.5 },
                    bold: { availability: "authoritative", value: false },
                    italic: { availability: "authoritative", value: false },
                    script_position: { availability: "authoritative", value: "baseline" },
                    alignment: { availability: "authoritative", value: "center" },
                    spacing_before_pt: { availability: "authoritative", value: 0 },
                    spacing_after_pt: { availability: "authoritative", value: 0 },
                    line_spacing: { availability: "authoritative", value: 1 },
                    line_spacing_mode: { availability: "authoritative", value: "multiple" },
                    left_indent_pt: { availability: "authoritative", value: 0 },
                    right_indent_pt: { availability: "authoritative", value: 0 },
                    first_line_indent_pt: { availability: "authoritative", value: 0 },
                    hanging_indent_pt: { availability: "authoritative", value: 0 },
                    vertical_alignment: { availability: "authoritative", value: "center" },
                  },
                  paragraphs: [],
                },
              ],
            },
          ],
          objects: [],
          warnings: [],
        };
      },
    },
    createId: () => "job-proofreading-deep-1",
    now: () => new Date("2026-04-28T10:00:00.000Z"),
  } as never);

  const result = await proofreadingService.createDraft({
    manuscriptId: "manuscript-1",
    parentAssetId: harness.originalAssetId,
    requestedBy: "proofreader-1",
    actorRole: "proofreader",
    storageKey: "runs/manuscript-1/proofreading/deep.md",
    fileName: "deep.md",
  });

  const payload = result.job.payload as {
    deepProofreading?: {
      schema?: string;
      factLedgerSummary?: { conflictCount?: number };
      passRuns?: Array<{ passKind?: string; sliceId?: string }>;
      stageDiagnostics?: Array<{ passKind?: string }>;
    };
    proofreadingPlan?: {
      issues?: Array<{ source?: string; passKind?: string; sliceId?: string }>;
    };
    proofreadingDeepPassRuns?: unknown[];
  };
  assert.equal(payload.deepProofreading?.schema, "deep_proofreading_run.v1");
  assert.ok((payload.deepProofreading?.factLedgerSummary?.conflictCount ?? 0) >= 1);
  assert.ok(
    payload.deepProofreading?.stageDiagnostics?.some(
      (stage) => stage.passKind === "final_regression_preparation",
    ),
  );
  assert.ok(
    payload.proofreadingPlan?.issues?.some(
      (issue) => issue.source === "deterministic_check",
    ),
  );
  assert.ok(
    payload.proofreadingPlan?.issues?.some((issue) => issue.source === "ai_pass"),
  );
  assert.equal(
    payload.proofreadingDeepPassRuns,
    undefined,
    "deep orchestrator diagnostics must not be stored as legacy payload pass runs",
  );
  assert.ok(aiCalls.every((call) => call.sliceContext && call.passFocus));

  const persistedPassRuns = await proofreadingPassRunRepository.listByJobId(
    result.job.id,
  );
  assert.ok(persistedPassRuns.length >= 1);
  assert.ok(
    persistedPassRuns.every((run) =>
      [
        "medical_facts_and_terminology",
        "structure_logic_and_consistency",
        "data_statistics_units_and_tables",
        "language_style_punctuation_and_format",
        "residual_synthesis",
      ].includes(run.pass_kind),
    ),
  );
});
