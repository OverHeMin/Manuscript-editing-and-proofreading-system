import type { ManuscriptQualityFindingSummary } from "@medical/contracts";
import type { MainlineAiRuntimeExecutor } from "../shared/mainline-ai-runtime-executor.ts";

export type ScreeningRiskLevel = "low" | "medium" | "high" | "critical";

export type ScreeningRecommendedDecision =
  | "accept"
  | "minor_revision"
  | "major_revision"
  | "reject";

export interface ScreeningAiReport {
  summary: string;
  majorFindings: string[];
  minorFindings: string[];
  riskLevel: ScreeningRiskLevel;
  recommendedDecision: ScreeningRecommendedDecision;
}

export interface ScreeningAiReportServiceOptions {
  mainlineAiRuntimeExecutor?: MainlineAiRuntimeExecutor;
}

export interface CreateScreeningAiReportInput {
  manuscriptId: string;
  sourceFileName?: string;
  sourceBlocks?: Array<{
    text: string;
    blockKind?: string;
  }>;
  tableCount?: number;
  qualityIssues?: Array<{
    severity?: string;
    explanation?: string;
  }>;
  qualitySummary?: ManuscriptQualityFindingSummary;
}

export interface ScreeningAiReportResult {
  report: ScreeningAiReport;
  markdown: string;
}

export class ScreeningAiReportService {
  private readonly mainlineAiRuntimeExecutor?: MainlineAiRuntimeExecutor;

  constructor(options: ScreeningAiReportServiceOptions) {
    this.mainlineAiRuntimeExecutor = options.mainlineAiRuntimeExecutor;
  }

  async createReport(
    input: CreateScreeningAiReportInput,
  ): Promise<ScreeningAiReportResult> {
    const fallbackReport = buildFallbackScreeningReport(input);
    const report = this.mainlineAiRuntimeExecutor
      ? normalizeScreeningAiReport(
          await this.mainlineAiRuntimeExecutor.executeJson<Record<string, unknown>>({
            module: "screening",
            systemPrompt: buildScreeningSystemPrompt(),
            userPayload: buildScreeningUserPayload(input),
          }),
          fallbackReport,
        )
      : fallbackReport;

    return {
      report,
      markdown: renderScreeningReportMarkdown(report),
    };
  }
}

function buildScreeningSystemPrompt(): string {
  return [
    "You are a medical manuscript screening reviewer.",
    "Return JSON only.",
    "Ground every finding in the provided manuscript excerpts and quality signals.",
    "Keep findings concise, concrete, and operator-facing.",
    "Use this exact schema:",
    JSON.stringify({
      summary: "string",
      majorFindings: ["string"],
      minorFindings: ["string"],
      riskLevel: "low|medium|high|critical",
      recommendedDecision: "accept|minor_revision|major_revision|reject",
    }),
  ].join(" ");
}

function buildScreeningUserPayload(input: CreateScreeningAiReportInput) {
  return {
    task: "screening_report",
    manuscriptId: input.manuscriptId,
    sourceFileName: input.sourceFileName,
    sourceBlocks: (input.sourceBlocks ?? [])
      .map((block) => ({
        blockKind: block.blockKind,
        text: block.text.trim(),
      }))
      .filter((block) => block.text.length > 0)
      .slice(0, 12),
    tableCount: input.tableCount ?? 0,
    qualitySummary: input.qualitySummary ?? {},
    qualityIssues: (input.qualityIssues ?? []).map((issue) => ({
      severity: issue.severity ?? "info",
      explanation: issue.explanation ?? "",
    })),
    contract: {
      summary: "string",
      majorFindings: ["string"],
      minorFindings: ["string"],
      riskLevel: "low|medium|high|critical",
      recommendedDecision: "accept|minor_revision|major_revision|reject",
    },
  };
}

function buildFallbackScreeningReport(
  input: CreateScreeningAiReportInput,
): ScreeningAiReport {
  const qualityIssues = input.qualityIssues ?? [];
  const majorFindings = qualityIssues
    .filter((issue) => issue.severity === "error" || issue.severity === "warning")
    .map((issue) => issue.explanation?.trim() ?? "")
    .filter((issue) => issue.length > 0);
  const minorFindings = qualityIssues
    .filter((issue) => issue.severity !== "error" && issue.severity !== "warning")
    .map((issue) => issue.explanation?.trim() ?? "")
    .filter((issue) => issue.length > 0);
  const riskLevel = deriveFallbackRiskLevel(qualityIssues);
  const recommendedDecision = deriveFallbackDecision(riskLevel);

  return {
    summary:
      majorFindings.length > 0 || minorFindings.length > 0
        ? `Preliminary screening review for ${input.manuscriptId}.`
        : `No blocking screening issues were detected for ${input.manuscriptId}.`,
    majorFindings,
    minorFindings,
    riskLevel,
    recommendedDecision,
  };
}

function normalizeScreeningAiReport(
  payload: Record<string, unknown>,
  fallback: ScreeningAiReport,
): ScreeningAiReport {
  const summary = toNonEmptyString(payload.summary) ?? fallback.summary;
  const majorFindings = toStringArray(payload.majorFindings);
  const minorFindings = toStringArray(payload.minorFindings);

  return {
    summary,
    majorFindings:
      majorFindings.length > 0 ? majorFindings : fallback.majorFindings,
    minorFindings:
      minorFindings.length > 0 ? minorFindings : fallback.minorFindings,
    riskLevel: normalizeRiskLevel(payload.riskLevel) ?? fallback.riskLevel,
    recommendedDecision:
      normalizeRecommendedDecision(payload.recommendedDecision) ??
      fallback.recommendedDecision,
  };
}

function renderScreeningReportMarkdown(report: ScreeningAiReport): string {
  return [
    "# Screening Report",
    "",
    "Summary:",
    report.summary,
    "",
    "Major Findings:",
    ...(report.majorFindings.length > 0
      ? report.majorFindings.map((finding) => `- ${finding}`)
      : ["- None recorded."]),
    "",
    "Minor Findings:",
    ...(report.minorFindings.length > 0
      ? report.minorFindings.map((finding) => `- ${finding}`)
      : ["- None recorded."]),
    "",
    `Risk Level: ${report.riskLevel}`,
    `Recommended Decision: ${report.recommendedDecision}`,
  ].join("\n");
}

function deriveFallbackRiskLevel(
  issues: Array<{
    severity?: string;
  }>,
): ScreeningRiskLevel {
  if (issues.some((issue) => issue.severity === "critical")) {
    return "critical";
  }

  if (issues.some((issue) => issue.severity === "error")) {
    return "high";
  }

  if (issues.some((issue) => issue.severity === "warning")) {
    return "medium";
  }

  return "low";
}

function deriveFallbackDecision(
  riskLevel: ScreeningRiskLevel,
): ScreeningRecommendedDecision {
  switch (riskLevel) {
    case "critical":
      return "reject";
    case "high":
      return "major_revision";
    case "medium":
      return "minor_revision";
    case "low":
      return "accept";
  }
}

function normalizeRiskLevel(value: unknown): ScreeningRiskLevel | undefined {
  if (
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "critical"
  ) {
    return value;
  }

  return undefined;
}

function normalizeRecommendedDecision(
  value: unknown,
): ScreeningRecommendedDecision | undefined {
  if (
    value === "accept" ||
    value === "minor_revision" ||
    value === "major_revision" ||
    value === "reject"
  ) {
    return value;
  }

  return undefined;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function toNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
