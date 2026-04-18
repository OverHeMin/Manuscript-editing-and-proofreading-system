import type {
  ResidualConfidenceBand,
  ResidualHarnessValidationStatus,
  ResidualIssueRiskLevel,
  ResidualIssueRoute,
} from "@medical/contracts";

export interface ResidualConfidenceInput {
  modelConfidence?: number;
  recurrenceCount: number;
  riskLevel: ResidualIssueRiskLevel;
  recommendedRoute: ResidualIssueRoute;
  harnessValidationStatus: ResidualHarnessValidationStatus;
}

export function calculateResidualConfidenceBand(
  input: ResidualConfidenceInput,
): ResidualConfidenceBand {
  if (
    input.recommendedRoute === "manual_only" ||
    input.recommendedRoute === "evidence_only"
  ) {
    return input.riskLevel === "high" || input.riskLevel === "critical"
      ? "L1_review_pending"
      : "L0_observation";
  }

  if (input.harnessValidationStatus === "failed") {
    return input.riskLevel === "high" || input.riskLevel === "critical"
      ? "L0_observation"
      : "L1_review_pending";
  }

  let score = 0;

  if ((input.modelConfidence ?? 0) >= 0.75) {
    score += 1;
  }

  if (input.recurrenceCount >= 2) {
    score += 1;
  }

  if (input.harnessValidationStatus === "passed") {
    score += 1;
  }

  if (input.riskLevel === "high" || input.riskLevel === "critical") {
    score -= 1;
  }

  if (score >= 3) {
    return "L3_strongly_reusable";
  }

  if (score >= 2) {
    return "L2_candidate_ready";
  }

  if (score >= 1) {
    return "L1_review_pending";
  }

  return "L0_observation";
}
