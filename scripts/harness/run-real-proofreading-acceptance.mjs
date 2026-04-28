import { pathToFileURL } from "node:url";
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
  const passReports = [];

  for (const passFocus of PASS_FOCI.slice(0, config.passLimit)) {
    const plan = await service.createPlan({
      manuscriptId: "real-acceptance-proofreading-fixture",
      sourceFileName: "real-acceptance-proofreading-fixture.docx",
      sourceBlocks,
      governedFailedChecks: [
        {
          ruleId: "rule-unit-format-1",
          severity: "error",
          actual: "5 mg per dL",
          expected: "5 mg/dL",
          blockIndex: 2,
        },
      ],
      governedManualReviewItems: [
        {
          ruleId: "rule-table-text-consistency-1",
          reason: "Confirm table-text consistency before release.",
          evidence_pack: {
            excerpt: "Table 1 lists 120 cases while Results says 118.",
          },
        },
      ],
      qualityIssues: [
        {
          severity: "high",
          issue_type: "evidence_alignment.overstated_conclusion",
          explanation:
            "The conclusion states proven efficacy even though the main endpoint is not statistically significant.",
          action: "manual_review",
          text_excerpt: "This therapy proves significant efficacy.",
          suggested_replacement:
            "This therapy may be associated with improved outcomes and requires confirmation.",
        },
      ],
      knowledgeHits: [
        {
          knowledgeItemId: "knowledge-stat-significance-1",
          title: "Statistical significance wording",
          summary:
            "Do not describe p values above 0.05 as statistically significant.",
          canonicalText:
            "When p is greater than or equal to 0.05, conclusions should avoid claiming statistical significance.",
          matchReasons: ["statistical expression"],
        },
        {
          knowledgeItemId: "knowledge-table-consistency-1",
          title: "Table and text consistency",
          summary:
            "Sample sizes, adverse events, and key values must match between tables and body text.",
          canonicalText:
            "If table totals and body text values differ, route the item to manual verification.",
          matchReasons: ["table consistency"],
        },
      ],
      promptGuardrails: {
        roleLabel: "Medical manuscript final proofreader",
        systemInstructions:
          "Inspect the whole manuscript after governed deterministic checks.",
        taskFrame:
          "Return residual findings only and do not rewrite the full manuscript.",
        manualReviewPolicy:
          "Escalate any medical meaning, data, or table consistency risk.",
        forbiddenOperations: ["rewrite_full_manuscript", "invent_missing_evidence"],
        outputContract: "Return JSON with residual issues and manual review notes.",
      },
      passFocus,
    });

    const contextEvidence = contextEvidenceReports.at(-1) ?? {};
    passReports.push({
      passNo: passFocus.passNo,
      passKind: passFocus.passKind,
      issueCount: plan.issues.length,
      residualIssueCount: plan.issues.filter(
        (issue) => issue.source === "residual_ai",
      ).length,
      summary: plan.summary,
      issues: plan.issues.map((issue) => ({
        itemId: issue.itemId,
        title: issue.title,
        severity: issue.severity,
        source: issue.source,
        issueType: issue.issueType,
        blockIndex: issue.anchor.blockIndex,
      })),
      contextEvidence,
    });
  }

  return evaluateRealProofreadingAcceptanceReport({
    provider: config.reportable,
    passReports,
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
          (report.contextEvidence?.ruleIds?.length ?? 0) > 0 &&
          (report.contextEvidence?.knowledgeItemIds?.length ?? 0) > 0,
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
  return {
    hasLocalBlockContext: Boolean(layers.localBlockContext),
    hasNeighborContext: Boolean(layers.neighborContext),
    hasSectionContext: Boolean(layers.sectionContext),
    hasGlobalConsistencyContext: Boolean(layers.globalConsistencyContext),
    ruleIds: layers.ruleCitationContext?.ruleIds ?? [],
    knowledgeItemIds: layers.knowledgeCitationContext?.knowledgeItemIds ?? [],
    residualRunsAfterGovernedCoverage:
      layers.residualAnalysisContext?.runsAfterGovernedCoverage === true,
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
        "Results: 118 patients completed follow-up. The primary endpoint p value was 0.06. Dosage was recorded as 5 mg per dL.",
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
