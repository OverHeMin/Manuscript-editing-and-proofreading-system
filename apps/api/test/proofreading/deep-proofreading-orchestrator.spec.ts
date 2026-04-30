import test from "node:test";
import assert from "node:assert/strict";
import { DeepProofreadingOrchestrator } from "../../src/modules/proofreading/deep-proofreading-orchestrator.ts";
import type { CreateProofreadingAiPlanInput } from "../../src/modules/proofreading/proofreading-ai-plan-service.ts";

test("deep orchestrator builds diagnostics, scoped AI passes, and deterministic issue cards", async () => {
  const aiCalls: CreateProofreadingAiPlanInput[] = [];
  const orchestrator = new DeepProofreadingOrchestrator({
    proofreadingAiPlanService: {
      async createPlan(input: CreateProofreadingAiPlanInput) {
        aiCalls.push(structuredClone(input));
        return {
          role: "医学稿件终校审校员",
          summary: "slice checked",
          issues: [
            {
              itemId: `ai-${aiCalls.length}`,
              title: "AI切片发现",
              description: "切片内存在需要人工复核的问题。",
              severity: "medium",
              source: "residual_ai",
              issueType: "ai.slice_review",
              blocksFinal: false,
              anchor: {
                blockIndex: 0,
                quote: "ALT为19.5",
              },
            },
          ],
          manualReviewItems: [],
        };
      },
    },
  });

  const result = await orchestrator.run({
    manuscriptId: "manuscript-1",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    sourceBlocks: [
      {
        section: "results",
        block_kind: "paragraph",
        text: "结果见表1，ALT为19.5 U/L。",
      },
    ],
    documentStructure: {
      manuscript_id: "manuscript-1",
      asset_id: "asset-1",
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
              text: "18.2  ±  1.3",
              display_text: "18.2  ±  1.3",
              normalized_text: "18.2±1.3",
              raw_xml_text: "18.2  ±  1.3",
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
              style_runs: [
                {
                  text: "P",
                  italic: true,
                  script_position: "baseline",
                },
              ],
            },
          ],
        },
      ],
      objects: [],
      warnings: [],
    },
    tableEvidenceSnapshot: {
      snapshotId: "snapshot-1",
      manuscriptId: "manuscript-1",
      assetId: "asset-1",
      sourceStorageKey: "uploads/source.docx",
      docxHash: "hash",
      parserVersion: "lossless-v1",
      createdAt: "2026-04-30T00:00:00.000Z",
      status: "complete",
      warnings: [],
      tables: [
        {
          tableId: "table-1",
          ordinal: 1,
          bodyPath: "word/document.xml/body/tbl[1]",
          ooxmlHash: "table-hash",
          rowCount: 1,
          columnCount: 1,
          cells: [],
          aiPayload: {
            tableId: "table-1",
            rowCount: 1,
            columnCount: 1,
            cells: [
              {
                cellId: "table-1-cell-0-0",
                rowIndex: 0,
                columnIndex: 0,
                rowSpan: 1,
                columnSpan: 1,
                text: "18.2  ±  1.3",
                characterClasses: [
                  { index: 5, char: "±", codePoint: "U+00B1", charClass: "symbol" },
                ],
                styleSpans: [{ runId: "run-1", startIndex: 0, endIndex: 1, italic: true }],
              },
            ],
            specialCharacterWarnings: ["table-1-cell-0-0:U+00B1:symbol"],
            lowConfidenceReasons: [],
          },
          fidelityReport: { status: "complete", warnings: [] },
        },
      ],
    },
    rules: [
      {
        id: "rule-table-stat",
        rule_set_id: "rule-set-1",
        order_no: 1,
        priority: 1,
        rule_object: "table",
        rule_type: "format",
        execution_mode: "inspect",
        scope_layer: "journal",
        scope: { manuscript_types: ["clinical_study"], object_granularity: ["table"] },
        selector: {},
        trigger: { kind: "table_stat_symbol" },
        action: { kind: "manual_review_required" },
        authoring_payload: {},
        confidence_policy: "manual_only",
        severity: "error",
        enabled: true,
        explanation_payload: {
          rationale: "表格统计符号和正文数据必须一致。",
        },
      },
    ],
    knowledge: [
      {
        id: "knowledge-table-stat",
        title: "表格统计表达",
        canonical_text: "统计表格中的均数±标准差和正文引用必须一致。",
        summary: "表格统计表达规则摘要。",
        knowledge_kind: "prompt_snippet",
        status: "approved",
        routing: {
          module_scope: "proofreading",
          manuscript_types: ["clinical_study"],
        },
        binding_targets: {
          template_family_ids: ["family-1"],
        },
      },
    ],
  });

  assert.ok(result.deepProofreading.factLedgerSummary.conflictCount >= 1);
  assert.equal(result.deepProofreading.tableFidelityDiagnostics.tableCount, 1);
  assert.ok(result.deepProofreading.selectedRuleDiagnostics.totalSelected >= 1);
  assert.ok(result.deepProofreading.selectedKnowledgeBudgetDiagnostics.totalSelected >= 1);
  assert.ok(
    result.deepProofreading.passRuns.some(
      (pass) => pass.passKind === "data_statistics_units_and_tables",
    ),
  );
  assert.ok(
    result.deepProofreading.stageDiagnostics.some(
      (stage) => stage.passKind === "final_regression_preparation",
    ),
  );
  assert.ok(
    result.issueCards.some((issue) => issue.source === "deterministic_check"),
  );
  assert.ok(result.issueCards.some((issue) => issue.source === "ai_pass"));
  assert.ok(aiCalls.every((call) => call.sliceContext && call.passFocus));
  assert.ok(
    aiCalls.some(
      (call) => (call.activatedRules as unknown[] | undefined)?.length,
    ),
  );
  assert.ok(
    aiCalls.some(
      (call) => (call.budgetedKnowledge as unknown[] | undefined)?.length,
    ),
  );
  assert.ok(
    aiCalls.some(
      (call) =>
        (
          call.sliceContext as
            | {
                tableEvidence?: {
                  aiReadableTablePayload?: {
                    cells?: Array<{ cellId?: string }>;
                  };
                };
              }
            | undefined
        )?.tableEvidence?.aiReadableTablePayload?.cells?.[0]?.cellId ===
        "table-1-cell-0-0",
    ),
  );
});
