export type ProofreadingIssueSeverity =
  | "critical"
  | "high"
  | "medium"
  | "low";

export type ProofreadingIssueSource =
  | "governed_rule"
  | "knowledge_base"
  | "quality_check"
  | "residual_ai"
  | "legacy_correction";

export type ProofreadingSuggestionAction =
  | "replace_text"
  | "rewrite_manually"
  | "verify_fact"
  | "explain_only";

export interface ProofreadingIssueAnchor {
  blockIndex: number;
  quote: string;
  sectionLabel?: string;
  blockKind?: string;
}

export interface ProofreadingIssueSuggestion {
  action: ProofreadingSuggestionAction;
  replacementText?: string;
  note?: string;
}

export interface ProofreadingIssue {
  itemId: string;
  title: string;
  description: string;
  severity: ProofreadingIssueSeverity;
  source: ProofreadingIssueSource;
  issueType: string;
  blocksFinal: boolean;
  anchor: ProofreadingIssueAnchor;
  suggestion?: ProofreadingIssueSuggestion;
}

export interface ProofreadingLegacyCorrection {
  targetText: string;
  replacementText: string;
  category?: string;
}

export interface ProofreadingAiPlan {
  role: string;
  summary: string;
  issues: ProofreadingIssue[];
  manualReviewItems: string[];
  corrections?: ProofreadingLegacyCorrection[];
}
