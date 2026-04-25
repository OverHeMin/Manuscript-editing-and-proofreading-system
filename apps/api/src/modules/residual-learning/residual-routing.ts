import type {
  ResidualIssueRiskLevel,
  ResidualIssueRoute,
} from "@medical/contracts";

export interface ResidualRoutingInput {
  issueType: string;
  riskLevel: ResidualIssueRiskLevel;
}

export type ResidualCandidateRoute = Exclude<ResidualIssueRoute, "manual_only">;

const MANUAL_ONLY_PROOFREADING_CONTRADICTION_ISSUE_TYPES = new Set([
  "study_design_consistency",
  "population_definition_consistency",
  "sample_size_consistency",
  "results_vs_conclusion_alignment",
  "follow_up_window_consistency",
  "cross_section_contradiction",
  "conclusion_overclaim",
  "statistical_interpretation_error",
]);

export function routeResidualIssue(
  input: ResidualRoutingInput,
): ResidualIssueRoute {
  if (
    input.riskLevel === "high" ||
    input.riskLevel === "critical" ||
    input.issueType === "medical_meaning_risk" ||
    MANUAL_ONLY_PROOFREADING_CONTRADICTION_ISSUE_TYPES.has(input.issueType)
  ) {
    return "manual_only";
  }

  return deriveResidualCandidateRoute(input.issueType);
}

export function deriveResidualCandidateRoute(
  issueType: string,
): ResidualCandidateRoute {
  const normalizedIssueType = issueType.trim().toLowerCase();

  switch (normalizedIssueType) {
    case "unit_expression_gap":
    case "table_annotation_gap":
    case "style_consistency_gap":
    case "unit_style_consistency":
      return "rule_candidate";
    case "terminology_gap":
    case "terminology_consistency":
    case "terminology_definition_missing":
    case "first_use_expansion":
    case "abbreviation_casing":
      return "knowledge_candidate";
    case "uncovered_local_language_issue":
      return "prompt_template_candidate";
    case "ambiguous_reviewer_escalation":
      return "evidence_only";
    default:
      if (
        normalizedIssueType.includes("terminology") ||
        normalizedIssueType.includes("abbreviation") ||
        normalizedIssueType.includes("definition_missing")
      ) {
        return "knowledge_candidate";
      }

      return "evidence_only";
  }
}
