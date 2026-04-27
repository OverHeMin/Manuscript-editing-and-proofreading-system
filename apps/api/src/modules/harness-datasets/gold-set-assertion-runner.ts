import type { ProofreadingIssue } from "../proofreading/proofreading-issue-contract.ts";
import type { HarnessGoldSetItemRecord } from "./harness-dataset-record.ts";

export interface GoldSetExpectedIssue {
  id: string;
  severity?: string;
  issueType?: string;
  layerId?: string;
  quote?: string;
  blockIndex?: number;
}

export interface GoldSetAssertionEvaluationInput {
  items: readonly HarnessGoldSetItemRecord[];
  actualIssues: readonly ProofreadingIssue[];
}

export interface GoldSetAssertionEvaluationResult {
  expectedIssueCount: number;
  matchedExpectedIssueCount: number;
  missedExpectedIssueCount: number;
  falsePositiveIssueCount: number;
  recall: number;
  criticalRecall: number;
  missedExpectedIssueIds: string[];
  falsePositiveIssueIds: string[];
  thresholds: {
    criticalRecallThreshold?: number;
    falsePositiveReviewThreshold?: number;
    criticalRecallPassed?: boolean;
    falsePositiveReviewPassed?: boolean;
    requiredLayerCoveragePassed?: boolean;
  };
  requiredLayers: string[];
  harnessQualityReport: {
    mode: "report_only";
    scope: "gold_set_assertions";
    expectedIssueCount: number;
    actualIssueCount: number;
    caseCount: number;
    assertionCount: number;
    recall: number;
    falsePositiveCount: number;
    falseNegativeCount: number;
    ruleHitCoverage: number;
    knowledgeHitCoverage: number;
    residualCoverage: number;
    requiredLayerCoverage: {
      requiredLayerCount: number;
      coveredLayerCount: number;
      missingLayerIds: string[];
    };
    manualReviewSamplingRequired: boolean;
    limitations: string[];
    residualRisks: string[];
  };
}

export function evaluateGoldSetAssertions(
  input: GoldSetAssertionEvaluationInput,
): GoldSetAssertionEvaluationResult {
  const expectedIssues = input.items.flatMap(extractExpectedIssues);
  const requiredLayers = Array.from(
    new Set(input.items.flatMap(extractRequiredLayers)),
  );
  const criticalRecallThreshold = maxOptionalNumber(
    input.items.map(
      (item) =>
        asRecord(item.expected_structured_output)?.criticalRecallThreshold,
    ),
  );
  const falsePositiveReviewThreshold = maxOptionalNumber(
    input.items.map(
      (item) =>
        asRecord(item.expected_structured_output)?.falsePositiveReviewThreshold,
    ),
  );

  const matchedActualIssueIds = new Set<string>();
  const matchedActualIssues: ProofreadingIssue[] = [];
  const missedExpectedIssueIds: string[] = [];
  let matchedExpectedIssueCount = 0;
  let expectedCriticalIssueCount = 0;
  let matchedCriticalIssueCount = 0;

  for (const expectedIssue of expectedIssues) {
    if (expectedIssue.severity === "critical") {
      expectedCriticalIssueCount += 1;
    }
    const matchedIssue = input.actualIssues.find(
      (actualIssue) =>
        !matchedActualIssueIds.has(actualIssue.itemId) &&
        issueMatchesExpectedIssue(actualIssue, expectedIssue),
    );
    if (matchedIssue) {
      matchedExpectedIssueCount += 1;
      matchedActualIssueIds.add(matchedIssue.itemId);
      matchedActualIssues.push(matchedIssue);
      if (expectedIssue.severity === "critical") {
        matchedCriticalIssueCount += 1;
      }
    } else {
      missedExpectedIssueIds.push(expectedIssue.id);
    }
  }

  const falsePositiveIssueIds = input.actualIssues
    .filter((issue) => !matchedActualIssueIds.has(issue.itemId))
    .map((issue) => issue.itemId);
  const recall =
    expectedIssues.length > 0 ? matchedExpectedIssueCount / expectedIssues.length : 1;
  const criticalRecall =
    expectedCriticalIssueCount > 0
      ? matchedCriticalIssueCount / expectedCriticalIssueCount
      : 1;
  const falsePositiveRate =
    input.actualIssues.length > 0
      ? falsePositiveIssueIds.length / input.actualIssues.length
      : 0;
  const matchedExpectedIssues = expectedIssues.filter(
    (expectedIssue) =>
      !missedExpectedIssueIds.includes(expectedIssue.id),
  );
  const coveredLayerIds = new Set(
    matchedExpectedIssues
      .map((issue) => issue.layerId)
      .filter((layerId): layerId is string => Boolean(layerId)),
  );
  const missingLayerIds = requiredLayers.filter(
    (layerId) => !coveredLayerIds.has(layerId),
  );
  const requiredLayerCoveragePassed = missingLayerIds.length === 0;
  const harnessQualityReport = buildHarnessQualityReport({
    itemCount: input.items.length,
    actualIssueCount: input.actualIssues.length,
    expectedIssueCount: expectedIssues.length,
    matchedExpectedIssueCount,
    missedExpectedIssueCount: missedExpectedIssueIds.length,
    falsePositiveIssueCount: falsePositiveIssueIds.length,
    recall,
    requiredLayers,
    missingLayerIds,
    matchedActualIssues,
  });

  return {
    expectedIssueCount: expectedIssues.length,
    matchedExpectedIssueCount,
    missedExpectedIssueCount: missedExpectedIssueIds.length,
    falsePositiveIssueCount: falsePositiveIssueIds.length,
    recall,
    criticalRecall,
    missedExpectedIssueIds,
    falsePositiveIssueIds,
    thresholds: {
      ...(criticalRecallThreshold !== undefined
        ? {
            criticalRecallThreshold,
            criticalRecallPassed: criticalRecall >= criticalRecallThreshold,
          }
        : {}),
      ...(falsePositiveReviewThreshold !== undefined
        ? {
            falsePositiveReviewThreshold,
            falsePositiveReviewPassed:
              falsePositiveRate <= falsePositiveReviewThreshold,
          }
        : {}),
      ...(requiredLayers.length > 0
        ? {
            requiredLayerCoveragePassed,
          }
        : {}),
    },
    requiredLayers,
    harnessQualityReport,
  };
}

function buildHarnessQualityReport(input: {
  itemCount: number;
  actualIssueCount: number;
  expectedIssueCount: number;
  matchedExpectedIssueCount: number;
  missedExpectedIssueCount: number;
  falsePositiveIssueCount: number;
  recall: number;
  requiredLayers: string[];
  missingLayerIds: string[];
  matchedActualIssues: readonly ProofreadingIssue[];
}): GoldSetAssertionEvaluationResult["harnessQualityReport"] {
  const residualRisks: string[] = [];
  if (input.missedExpectedIssueCount > 0) {
    residualRisks.push(
      `${input.missedExpectedIssueCount} expected issue(s) were missed by the current proofreading output.`,
    );
  }
  if (input.falsePositiveIssueCount > 0) {
    residualRisks.push(
      `${input.falsePositiveIssueCount} unmatched issue(s) require false-positive review.`,
    );
  }
  if (input.missingLayerIds.length > 0) {
    residualRisks.push(
      `${input.missingLayerIds.length} required layer(s) were not covered by matched expected issues.`,
    );
  }

  return {
    mode: "report_only",
    scope: "gold_set_assertions",
    expectedIssueCount: input.expectedIssueCount,
    actualIssueCount: input.actualIssueCount,
    caseCount: input.itemCount,
    assertionCount: input.expectedIssueCount,
    recall: input.recall,
    falsePositiveCount: input.falsePositiveIssueCount,
    falseNegativeCount: input.missedExpectedIssueCount,
    ruleHitCoverage: calculateMatchedSourceCoverage(input.matchedActualIssues, input.expectedIssueCount, [
      "governed_rule",
      "quality_check",
    ]),
    knowledgeHitCoverage: calculateMatchedSourceCoverage(input.matchedActualIssues, input.expectedIssueCount, [
      "knowledge_base",
    ]),
    residualCoverage: calculateMatchedSourceCoverage(input.matchedActualIssues, input.expectedIssueCount, [
      "residual_ai",
    ]),
    requiredLayerCoverage: {
      requiredLayerCount: input.requiredLayers.length,
      coveredLayerCount: input.requiredLayers.length - input.missingLayerIds.length,
      missingLayerIds: [...input.missingLayerIds],
    },
    manualReviewSamplingRequired:
      input.falsePositiveIssueCount > 0 || input.missedExpectedIssueCount > 0,
    limitations: [
      "Harness gold-set metrics are bounded by the published cases and do not represent universal manuscript accuracy.",
      "Report-only gates record quality risks without changing release behavior unless enforcement is separately enabled.",
    ],
    residualRisks,
  };
}

function calculateMatchedSourceCoverage(
  issues: readonly ProofreadingIssue[],
  expectedIssueCount: number,
  sources: readonly string[],
): number {
  if (expectedIssueCount === 0) {
    return 0;
  }
  return (
    issues.filter((issue) => sources.includes(issue.source)).length /
    expectedIssueCount
  );
}

function extractExpectedIssues(
  item: HarnessGoldSetItemRecord,
): GoldSetExpectedIssue[] {
  const expected = asRecord(item.expected_structured_output);
  const expectedIssues = Array.isArray(expected?.expectedIssues)
    ? expected.expectedIssues
    : [];
  return expectedIssues.flatMap((entry): GoldSetExpectedIssue[] => {
    const issue = asRecord(entry);
    const id = readString(issue?.id);
    if (!id) {
      return [];
    }
    return [
      {
        id,
        ...(readString(issue?.severity)
          ? { severity: readString(issue?.severity) }
          : {}),
        ...(readString(issue?.issueType)
          ? { issueType: readString(issue?.issueType) }
          : {}),
        ...(readString(issue?.layerId)
          ? { layerId: readString(issue?.layerId) }
          : {}),
        ...(readString(issue?.quote) ? { quote: readString(issue?.quote) } : {}),
        ...(readNumber(issue?.blockIndex) !== undefined
          ? { blockIndex: readNumber(issue?.blockIndex) }
          : {}),
      },
    ];
  });
}

function extractRequiredLayers(item: HarnessGoldSetItemRecord): string[] {
  const expected = asRecord(item.expected_structured_output);
  return Array.isArray(expected?.requiredLayers)
    ? expected.requiredLayers
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : [];
}

function issueMatchesExpectedIssue(
  actualIssue: ProofreadingIssue,
  expectedIssue: GoldSetExpectedIssue,
): boolean {
  const severityMatches =
    !expectedIssue.severity || actualIssue.severity === expectedIssue.severity;
  const issueTypeMatches =
    !expectedIssue.issueType || actualIssue.issueType === expectedIssue.issueType;
  const layerMatches =
    !expectedIssue.layerId ||
    readString(asRecord(actualIssue)?.layerId) === expectedIssue.layerId ||
    inferProofreadingLayerIds(actualIssue).includes(expectedIssue.layerId);
  const blockIndexMatches =
    expectedIssue.blockIndex === undefined ||
    actualIssue.anchor.blockIndex === expectedIssue.blockIndex;
  const quoteMatches =
    !expectedIssue.quote ||
    normalizeText(actualIssue.anchor.quote).includes(normalizeText(expectedIssue.quote)) ||
    normalizeText(expectedIssue.quote).includes(normalizeText(actualIssue.anchor.quote));
  return (
    severityMatches &&
    issueTypeMatches &&
    layerMatches &&
    blockIndexMatches &&
    quoteMatches
  );
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/gu, " ");
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function inferProofreadingLayerIds(issue: ProofreadingIssue): string[] {
  const layerIds: string[] = [];
  const issueType = issue.issueType;
  if (issueType.includes("statistics") || issueType.includes("p_value")) {
    layerIds.push("statistics_expression");
  }
  if (issueType.includes("table")) {
    layerIds.push("table_proofreading");
  }
  if (issueType.includes("residual")) {
    layerIds.push("residual_discovery");
  }
  if (issueType.includes("consistency") || issueType.includes("sample_size")) {
    layerIds.push("context_consistency");
  }
  if (issue.source === "residual_ai" && !layerIds.includes("residual_discovery")) {
    layerIds.push("residual_discovery");
  }
  return layerIds;
}

function maxOptionalNumber(values: unknown[]): number | undefined {
  const numbers = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  return numbers.length > 0 ? Math.max(...numbers) : undefined;
}
