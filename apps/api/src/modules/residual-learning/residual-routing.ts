import type {
  ResidualIssueRiskLevel,
  ResidualIssueRoute,
} from "@medical/contracts";

export interface ResidualRoutingInput {
  issueType: string;
  riskLevel: ResidualIssueRiskLevel;
}

export function routeResidualIssue(
  input: ResidualRoutingInput,
): ResidualIssueRoute {
  if (
    input.riskLevel === "high" ||
    input.riskLevel === "critical" ||
    input.issueType === "medical_meaning_risk"
  ) {
    return "manual_only";
  }

  switch (input.issueType) {
    case "unit_expression_gap":
    case "table_annotation_gap":
    case "style_consistency_gap":
      return "rule_candidate";
    case "terminology_gap":
      return "knowledge_candidate";
    case "uncovered_local_language_issue":
      return "prompt_template_candidate";
    case "ambiguous_reviewer_escalation":
      return "evidence_only";
    default:
      return "evidence_only";
  }
}
