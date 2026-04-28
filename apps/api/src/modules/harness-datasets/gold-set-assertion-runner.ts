export type GoldSetAssertionMode = "internal_test" | "release";

export type GoldSetExpectedIssueCategory =
  | "terminology"
  | "table_text_consistency"
  | "statistical_expression"
  | "other";

export type GoldSetIssueRiskLevel = "low" | "medium" | "high";

export interface GoldSetExpectedIssue {
  issueId: string;
  category: GoldSetExpectedIssueCategory;
  expectedRuleHitIds?: string[];
  expectedKnowledgeItemIds?: string[];
  riskLevel?: GoldSetIssueRiskLevel;
}

export interface GoldSetAssertionItem {
  itemId: string;
  manuscriptSnippet: string;
  expectedIssues: GoldSetExpectedIssue[];
}

export interface GoldSetActualFinding {
  findingId: string;
  itemId: string;
  matchedExpectedIssueId?: string;
  ruleHitIds?: string[];
  knowledgeItemIds?: string[];
  manualReview?: {
    required: boolean;
    outcome?: "accepted" | "confirmed" | "rejected" | "pending";
  };
}

export interface GoldSetAssertionThresholds {
  recall?: number;
  precision?: number;
  highRiskManualReviewPassRate?: number;
}

export interface GoldSetAssertionInput {
  mode: GoldSetAssertionMode;
  executionStatus: "passed" | "failed" | "blocked";
  goldSetItems: GoldSetAssertionItem[];
  findings: GoldSetActualFinding[];
  thresholds?: GoldSetAssertionThresholds;
}

export interface GoldSetAssertionIssueSummary {
  itemId: string;
  issueId: string;
  reason: string;
}

export interface GoldSetAssertionFindingSummary {
  itemId: string;
  findingId: string;
  reason: string;
}

export interface GoldSetCitationFailure {
  itemId: string;
  issueId: string;
  findingId: string;
  missingIds: string[];
}

export interface GoldSetAssertionResult {
  executionStatus: GoldSetAssertionInput["executionStatus"];
  contentGate: {
    status: "passed" | "failed";
  };
  failedGateIds: string[];
  metrics: {
    goldSetItemCount: number;
    expectedIssueCount: number;
    detectedExpectedIssueCount: number;
    falsePositiveCount: number;
    falseNegativeCount: number;
    recall: number;
    precision: number;
    highRiskManualReviewPassRate: number;
  };
  falseNegatives: GoldSetAssertionIssueSummary[];
  falsePositives: GoldSetAssertionFindingSummary[];
  ruleCitationFailures: GoldSetCitationFailure[];
  knowledgeCitationFailures: GoldSetCitationFailure[];
}

const REQUIRED_INTERNAL_TEST_CATEGORIES = new Set<GoldSetExpectedIssueCategory>([
  "terminology",
  "table_text_consistency",
  "statistical_expression",
]);

export class GoldSetAssertionRunner {
  evaluate(input: GoldSetAssertionInput): GoldSetAssertionResult {
    const thresholds = resolveThresholds(input);
    const expectedById = new Map<string, GoldSetExpectedIssue & { itemId: string }>();
    const categories = new Set<GoldSetExpectedIssueCategory>();

    for (const item of input.goldSetItems) {
      for (const issue of item.expectedIssues) {
        expectedById.set(issue.issueId, {
          ...issue,
          itemId: item.itemId,
        });
        categories.add(issue.category);
      }
    }

    const matchedIssueIds = new Set<string>();
    const falsePositives: GoldSetAssertionFindingSummary[] = [];
    const ruleCitationFailures: GoldSetCitationFailure[] = [];
    const knowledgeCitationFailures: GoldSetCitationFailure[] = [];
    let highRiskReviewExpectedCount = 0;
    let highRiskReviewPassedCount = 0;

    for (const finding of input.findings) {
      const expectedIssue = finding.matchedExpectedIssueId
        ? expectedById.get(finding.matchedExpectedIssueId)
        : undefined;

      if (!expectedIssue) {
        falsePositives.push({
          itemId: finding.itemId,
          findingId: finding.findingId,
          reason: "Finding did not match an expected gold-set issue.",
        });
        continue;
      }

      matchedIssueIds.add(expectedIssue.issueId);
      const missingRuleIds = missingIds(
        expectedIssue.expectedRuleHitIds,
        finding.ruleHitIds,
      );
      if (missingRuleIds.length) {
        ruleCitationFailures.push({
          itemId: expectedIssue.itemId,
          issueId: expectedIssue.issueId,
          findingId: finding.findingId,
          missingIds: missingRuleIds,
        });
      }

      const missingKnowledgeIds = missingIds(
        expectedIssue.expectedKnowledgeItemIds,
        finding.knowledgeItemIds,
      );
      if (missingKnowledgeIds.length) {
        knowledgeCitationFailures.push({
          itemId: expectedIssue.itemId,
          issueId: expectedIssue.issueId,
          findingId: finding.findingId,
          missingIds: missingKnowledgeIds,
        });
      }

      if (expectedIssue.riskLevel === "high") {
        highRiskReviewExpectedCount += 1;
        if (
          finding.manualReview?.required &&
          (finding.manualReview.outcome === "accepted" ||
            finding.manualReview.outcome === "confirmed")
        ) {
          highRiskReviewPassedCount += 1;
        }
      }
    }

    const falseNegatives = [...expectedById.values()]
      .filter((issue) => !matchedIssueIds.has(issue.issueId))
      .map((issue) => ({
        itemId: issue.itemId,
        issueId: issue.issueId,
        reason: "Expected gold-set issue was not detected.",
      }));

    const expectedIssueCount = expectedById.size;
    const detectedExpectedIssueCount = matchedIssueIds.size;
    const recall =
      expectedIssueCount === 0 ? 1 : detectedExpectedIssueCount / expectedIssueCount;
    const precision =
      input.findings.length === 0
        ? 1
        : detectedExpectedIssueCount / input.findings.length;
    const highRiskManualReviewPassRate =
      highRiskReviewExpectedCount === 0
        ? 1
        : highRiskReviewPassedCount / highRiskReviewExpectedCount;

    const failedGateIds: string[] = [];
    if (!hasRequiredFixtureCoverage(input.goldSetItems, categories)) {
      failedGateIds.push("fixture_completeness");
    }
    if (recall < thresholds.recall) {
      failedGateIds.push("recall_threshold");
    }
    if (precision < thresholds.precision) {
      failedGateIds.push("precision_threshold");
    }
    if (ruleCitationFailures.length > 0) {
      failedGateIds.push("expected_rule_hits");
    }
    if (knowledgeCitationFailures.length > 0) {
      failedGateIds.push("expected_knowledge_citations");
    }
    if (highRiskManualReviewPassRate < thresholds.highRiskManualReviewPassRate) {
      failedGateIds.push("high_risk_manual_review_pass_rate");
    }

    return {
      executionStatus: input.executionStatus,
      contentGate: {
        status: failedGateIds.length ? "failed" : "passed",
      },
      failedGateIds,
      metrics: {
        goldSetItemCount: input.goldSetItems.length,
        expectedIssueCount,
        detectedExpectedIssueCount,
        falsePositiveCount: falsePositives.length,
        falseNegativeCount: falseNegatives.length,
        recall,
        precision,
        highRiskManualReviewPassRate,
      },
      falseNegatives,
      falsePositives,
      ruleCitationFailures,
      knowledgeCitationFailures,
    };
  }
}

function resolveThresholds(input: GoldSetAssertionInput): Required<GoldSetAssertionThresholds> {
  const defaults =
    input.mode === "internal_test"
      ? {
          recall: 0.8,
          precision: 0.6,
          highRiskManualReviewPassRate: 0.9,
        }
      : {
          recall: 0.9,
          precision: 0.75,
          highRiskManualReviewPassRate: 0.95,
        };

  return {
    ...defaults,
    ...input.thresholds,
  };
}

function missingIds(
  expectedIds: string[] | undefined,
  actualIds: string[] | undefined,
): string[] {
  const actual = new Set(actualIds ?? []);
  return (expectedIds ?? []).filter((id) => !actual.has(id));
}

function hasRequiredFixtureCoverage(
  items: GoldSetAssertionItem[],
  categories: Set<GoldSetExpectedIssueCategory>,
): boolean {
  if (items.length < 3) {
    return false;
  }

  for (const category of REQUIRED_INTERNAL_TEST_CATEGORIES) {
    if (!categories.has(category)) {
      return false;
    }
  }

  return true;
}
