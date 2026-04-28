import { pathToFileURL } from "node:url";
import { DeepProofreadingOrchestrator } from "../../apps/api/src/modules/proofreading/deep-proofreading-orchestrator.ts";
import { ProofreadingAiPlanService } from "../../apps/api/src/modules/proofreading/proofreading-ai-plan-service.ts";

const REDACTED_SECRET = "[redacted]";
const DEFAULT_MIN_FINDINGS = 1;
const DEFAULT_PASS_LIMIT = 5;

const PASS_FOCI = [
  {
    passNo: 1,
    passKind: "medical_facts_and_terminology",
    instruction: "Check medical facts, terminology, abbreviations, and clinical meaning.",
  },
  {
    passNo: 2,
    passKind: "structure_logic_and_consistency",
    instruction: "Check cross-section logic, study design consistency, and conclusion strength.",
  },
  {
    passNo: 3,
    passKind: "data_statistics_units_and_tables",
    instruction: "Check data, statistics, units, and table-text consistency.",
  },
  {
    passNo: 4,
    passKind: "language_style_punctuation_and_format",
    instruction: "Check language, punctuation, formatting, and editorial style.",
  },
  {
    passNo: 5,
    passKind: "residual_synthesis",
    instruction: "Free-play residual pass after deterministic checks.",
  },
];

export function buildRealProofreadingAcceptanceConfig(env = process.env) {
  const provider = readRequiredEnv(env, "REAL_ACCEPTANCE_PROVIDER");
  const baseUrl = normalizeBaseUrl(readRequiredEnv(env, "REAL_ACCEPTANCE_BASE_URL"));
  const model = readRequiredEnv(env, "REAL_ACCEPTANCE_MODEL");
  const apiKey = readRequiredEnv(env, "REAL_ACCEPTANCE_API_KEY");
  const passLimit = readPositiveInteger(
    env.REAL_ACCEPTANCE_PASS_LIMIT,
    DEFAULT_PASS_LIMIT,
  );
  const minFindings = readPositiveInteger(
    env.REAL_ACCEPTANCE_MIN_FINDINGS,
    DEFAULT_MIN_FINDINGS,
  );

  return {
    provider,
    baseUrl,
    model,
    apiKey,
    passLimit: Math.min(passLimit, PASS_FOCI.length),
    minFindings,
    reportable: {
      provider,
      baseUrl,
      model,
      apiKey: REDACTED_SECRET,
    },
  };
}

export async function runRealProofreadingAcceptance({
  env = process.env,
  fetchImpl = fetch,
} = {}) {
  const config = buildRealProofreadingAcceptanceConfig(env);
  const contextEvidenceReports = [];
  const service = new ProofreadingAiPlanService({
    mainlineAiRuntimeExecutor: createOpenAiCompatibleJsonExecutor({
      config,
      fetchImpl,
      onContextEvidence: (contextEvidence) => {
        contextEvidenceReports.push(contextEvidence);
      },
    }),
  });

  const sourceBlocks = buildAcceptanceSourceBlocks();
  const orchestrator = new DeepProofreadingOrchestrator({
    proofreadingAiPlanService: service,
  });
  const orchestratorResult = await orchestrator.run({
    manuscriptId: "real-acceptance-proofreading-fixture",
    manuscriptType: "clinical_study",
    templateFamilyId: "acceptance-family",
    sourceBlocks,
    documentStructure: buildAcceptanceDocumentStructure(),
    rules: buildAcceptanceRules(),
    knowledge: buildAcceptanceKnowledge(),
  });
  const passReports = orchestratorResult.deepProofreading.passRuns
    .slice(0, config.passLimit)
    .map((passRun, index) => {
      const issues = orchestratorResult.issueCards.filter(
        (issue) =>
          issue.passKind === passRun.passKind &&
          (issue.sliceId === undefined || issue.sliceId === passRun.sliceId),
      );
      return {
        passNo: index + 1,
        passKind: passRun.passKind,
        sliceId: passRun.sliceId,
        issueCount: issues.length,
        residualIssueCount: issues.filter((issue) => issue.source === "residual_ai")
          .length,
        summary: `Deep proofreading ${passRun.passKind} on ${passRun.sliceId}.`,
        issues: issues.map((issue) => ({
          itemId: issue.itemId,
          title: issue.title,
          severity: issue.severity,
          source: issue.source,
          issueType: issue.issueType,
          blockIndex: issue.anchor.blockIndex,
        })),
        contextEvidence: contextEvidenceReports[index] ?? {},
      };
    });

  return evaluateRealProofreadingAcceptanceReport({
    provider: config.reportable,
    passReports,
    deepProofreading: orchestratorResult.deepProofreading,
    minFindings: config.minFindings,
  });
}

export function evaluateRealProofreadingAcceptanceReport(input) {
  const totalIssues = input.passReports.reduce(
    (sum, report) => sum + report.issueCount,
    0,
  );
  const residualIssues = input.passReports.reduce(
    (sum, report) => sum + report.residualIssueCount,
    0,
  );
  const gates = {
    modelCompletion: buildGate(
      input.passReports.length > 0,
      "At least one real-model proofreading pass completed.",
    ),
    minFindings: buildGate(
      totalIssues >= input.minFindings,
      `Expected at least ${input.minFindings} finding(s), observed ${totalIssues}.`,
    ),
    contextLayerEvidence: buildGate(
      input.passReports.every((report) =>
        Boolean(
          report.contextEvidence?.hasLocalBlockContext &&
            report.contextEvidence?.hasNeighborContext &&
            report.contextEvidence?.hasSectionContext &&
            report.contextEvidence?.hasGlobalConsistencyContext,
        ),
      ),
      "Every pass must carry local, neighbor, section, and global context layers.",
    ),
    governedCitationEvidence: buildGate(
      input.passReports.some(
        (report) =>
          ((report.contextEvidence?.ruleIds?.length ?? 0) > 0 &&
            (report.contextEvidence?.knowledgeItemIds?.length ?? 0) > 0) ||
          ((report.contextEvidence?.activatedRuleCount ?? 0) > 0 &&
            (report.contextEvidence?.budgetedKnowledgeCount ?? 0) > 0),
      ),
      "At least one pass must cite governed rule and knowledge identifiers.",
    ),
    residualLayerEvidence: buildGate(
      input.passReports.every(
        (report) =>
          report.contextEvidence?.residualRunsAfterGovernedCoverage === true,
      ),
      "Every pass must prove residual analysis runs after governed coverage.",
    ),
    deepPayloadEvidence: buildGate(
      Boolean(
        input.deepProofreading?.factLedgerSummary &&
          input.deepProofreading?.tableFidelityDiagnostics &&
          input.deepProofreading?.selectedRuleDiagnostics &&
          input.deepProofreading?.selectedKnowledgeBudgetDiagnostics &&
          Array.isArray(input.deepProofreading?.passRuns),
      ) &&
        (input.deepProofreading?.factLedgerSummary?.conflictCount ?? 0) > 0 &&
        (input.deepProofreading?.selectedRuleDiagnostics?.totalSelected ?? 0) > 0 &&
        (input.deepProofreading?.selectedKnowledgeBudgetDiagnostics
          ?.totalSelected ?? 0) > 0,
      "Deep proofreading payload must include fact ledger, table fidelity, rule activation, knowledge budget, and pass diagnostics.",
    ),
    deepPassCoverage: buildGate(
      new Set(
        (input.deepProofreading?.passRuns ?? []).map((pass) => pass.passKind),
      ).has("data_statistics_units_and_tables") &&
        new Set(
          (input.deepProofreading?.passRuns ?? []).map((pass) => pass.passKind),
        ).has("residual_synthesis"),
      "Deep proofreading pass coverage must include data/statistics/tables and residual synthesis.",
    ),
    finalRegressionDiagnostic: buildGate(
      (input.deepProofreading?.stageDiagnostics ?? []).some(
        (stage) => stage.passKind === "final_regression_preparation",
      ),
      "Final regression preparation must be exposed as a diagnostic stage.",
    ),
  };
  const status = Object.values(gates).every((gate) => gate.status === "passed")
    ? "passed"
    : "failed";

  return {
    status,
    provider: input.provider,
    metrics: {
      passCount: input.passReports.length,
      totalIssues,
      residualIssues,
      minFindings: input.minFindings,
    },
    gates,
    deepProofreading: input.deepProofreading,
    passReports: input.passReports,
  };
}

function createOpenAiCompatibleJsonExecutor({
  config,
  fetchImpl,
  onContextEvidence,
}) {
  return {
    async executeJson(input) {
      onContextEvidence(readContextEvidence(input.userPayload));
      const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: "system",
              content: input.systemPrompt,
            },
            {
              role: "user",
              content: JSON.stringify(input.userPayload),
            },
          ],
          temperature: 0.2,
          response_format: {
            type: "json_object",
          },
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Real proofreading model request failed with HTTP ${response.status}.`,
        );
      }

      const bodyText =
        typeof response.text === "function"
          ? await response.text()
          : JSON.stringify(await response.json());
      const body = JSON.parse(bodyText);
      return parseModelJsonContent(extractOpenAiCompatibleContent(body));
    },
    async executeMarkdown() {
      throw new Error("Real proofreading acceptance only supports JSON output.");
    },
  };
}

function readContextEvidence(userPayload) {
  const layers = userPayload?.proofreadingContextLayers ?? {};
  const deepProofreading = userPayload?.deepProofreading ?? {};
  return {
    hasLocalBlockContext: Boolean(layers.localBlockContext),
    hasNeighborContext: Boolean(layers.neighborContext),
    hasSectionContext: Boolean(layers.sectionContext),
    hasGlobalConsistencyContext: Boolean(layers.globalConsistencyContext),
    ruleIds: layers.ruleCitationContext?.ruleIds ?? [],
    knowledgeItemIds: layers.knowledgeCitationContext?.knowledgeItemIds ?? [],
    residualRunsAfterGovernedCoverage:
      layers.residualAnalysisContext?.runsAfterGovernedCoverage === true,
    hasSliceContext: Boolean(deepProofreading.sliceContext),
    hasFactLedgerSummary: Boolean(deepProofreading.factLedgerSummary),
    activatedRuleCount: deepProofreading.activatedRules?.length ?? 0,
    budgetedKnowledgeCount: deepProofreading.budgetedKnowledge?.length ?? 0,
  };
}

function buildAcceptanceSourceBlocks() {
  return [
    {
      section: "abstract",
      block_kind: "paragraph",
      text:
        "Objective: To observe a therapy in 120 elderly patients with cerebral infarction.",
    },
    {
      section: "methods",
      block_kind: "paragraph",
      text:
        "Methods: A retrospective observational study enrolled 120 patients from January to June.",
    },
    {
      section: "results",
      block_kind: "paragraph",
      text:
        "Results: 表1 reports 120 cases; 118 patients completed follow-up. The primary endpoint p value was 0.06. Dosage was recorded as 5 mg per dL.",
    },
    {
      section: "table",
      block_kind: "table",
      text:
        "Table 1: Total cases 120; adverse reactions 8 cases; completion cases 120.",
    },
    {
      section: "conclusion",
      block_kind: "paragraph",
      text:
        "Conclusion: This therapy proves the treatment is effective and no adverse reactions occurred.",
    },
  ];
}

function buildAcceptanceDocumentStructure() {
  return {
    manuscript_id: "real-acceptance-proofreading-fixture",
    asset_id: "real-acceptance-asset",
    file_name: "real-acceptance-proofreading-fixture.docx",
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
        caption_fields: {
          text: "表1 研究对象完成情况",
        },
        header_cells: [],
        data_cells: [],
        footnote_items: [],
        grid_cells: [
          {
            id: "cell-total-cases",
            text: "120",
            display_text: "120",
            normalized_text: "120",
            raw_xml_text: "120",
            row_index: 0,
            column_index: 0,
            row_span: 1,
            column_span: 1,
            inferred_role: "data",
            style_evidence: {},
            paragraphs: [],
          },
        ],
      },
    ],
    objects: [],
    warnings: [],
  };
}

function buildAcceptanceRules() {
  return [
    {
      id: "rule-table-text-consistency-1",
      rule_set_id: "rule-set-proofreading-acceptance",
      order_no: 1,
      priority: 1,
      rule_object: "table",
      rule_type: "content",
      execution_mode: "inspect",
      scope_layer: "journal",
      scope: {
        manuscript_types: ["clinical_study"],
        object_granularity: ["table"],
      },
      selector: {},
      trigger: {
        kind: "table_text_consistency",
      },
      action: {
        kind: "manual_review_required",
      },
      authoring_payload: {},
      explanation_payload: {
        rationale:
          "Sample sizes, completion counts, and key table values must match body text.",
      },
      confidence_policy: "manual_only",
      severity: "error",
      enabled: true,
    },
    {
      id: "rule-unit-format-1",
      rule_set_id: "rule-set-proofreading-acceptance",
      order_no: 2,
      priority: 5,
      rule_object: "generic",
      rule_type: "format",
      execution_mode: "inspect",
      scope_layer: "general",
      scope: {
        manuscript_types: ["clinical_study"],
      },
      selector: {},
      trigger: {
        kind: "unit_format",
      },
      action: {
        kind: "suggest_change",
      },
      authoring_payload: {},
      explanation_payload: {
        rationale: "Units should use compact medical journal expressions.",
      },
      confidence_policy: "manual_only",
      severity: "warning",
      enabled: true,
    },
  ];
}

function buildAcceptanceKnowledge() {
  return [
    {
      id: "knowledge-stat-significance-1",
      title: "Statistical significance wording",
      canonical_text:
        "When p is greater than or equal to 0.05, conclusions should avoid claiming statistical significance.",
      summary:
        "Do not describe p values above 0.05 as statistically significant.",
      knowledge_kind: "prompt_snippet",
      status: "approved",
      routing: {
        module_scope: "proofreading",
        manuscript_types: ["clinical_study"],
      },
      binding_targets: {
        template_family_ids: ["acceptance-family"],
      },
    },
    {
      id: "knowledge-table-consistency-1",
      title: "Table and text consistency",
      canonical_text:
        "If table totals and body text values differ, route the item to manual verification.",
      summary:
        "Sample sizes, adverse events, and key values must match between tables and body text.",
      knowledge_kind: "prompt_snippet",
      status: "approved",
      routing: {
        module_scope: "proofreading",
        manuscript_types: ["clinical_study"],
      },
      binding_targets: {
        template_family_ids: ["acceptance-family"],
      },
    },
  ];
}

function extractOpenAiCompatibleContent(body) {
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((entry) => entry?.text ?? "")
      .filter((text) => text.trim().length > 0)
      .join("\n");
  }
  throw new Error("Real proofreading model response did not include content.");
}

function parseModelJsonContent(content) {
  const trimmed = content.trim();
  if (trimmed.startsWith("```")) {
    const withoutFence = trimmed
      .replace(/^```(?:json)?/u, "")
      .replace(/```$/u, "")
      .trim();
    return JSON.parse(withoutFence);
  }
  return JSON.parse(trimmed);
}

function buildGate(condition, message) {
  return {
    status: condition ? "passed" : "failed",
    message,
  };
}

function readRequiredEnv(env, name) {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}.`);
  }
  return value;
}

function readPositiveInteger(value, fallback) {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/u, "");
}

async function main() {
  const report = await runRealProofreadingAcceptance();
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== "passed") {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Real proofreading acceptance failed.",
    );
    process.exitCode = 1;
  });
}
