import type {
  ManuscriptQualityIssue,
  ResidualIssueRiskLevel,
  ResidualIssueSourceStage,
} from "@medical/contracts";

export interface ProofreadingResidualHint {
  issue_type: string;
  excerpt: string;
  suggestion: string;
  rationale: string;
  model_confidence?: number;
  source_stage?: ResidualIssueSourceStage;
  risk_level?: ResidualIssueRiskLevel;
  location?: Record<string, unknown>;
  related_rule_ids?: string[];
  related_knowledge_item_ids?: string[];
  related_quality_issue_ids?: string[];
}

export interface ProofreadingResidualSourceBlock {
  section?: string;
  blockIndex?: number;
  text: string;
  residualHints?: ProofreadingResidualHint[];
}

export interface NormalizedProofreadingResidualHint {
  issue_type: string;
  excerpt: string;
  suggestion: string;
  rationale: string;
  novelty_key: string;
  model_confidence?: number;
  source_stage: ResidualIssueSourceStage;
  risk_level: ResidualIssueRiskLevel;
  location?: Record<string, unknown>;
  related_rule_ids?: string[];
  related_knowledge_item_ids?: string[];
  related_quality_issue_ids?: string[];
}

export interface ProofreadingResidualAdapterInput {
  knownRuleIds: string[];
  knownKnowledgeItemIds: string[];
  qualityIssues?: ManuscriptQualityIssue[];
  sourceBlocks: ProofreadingResidualSourceBlock[];
}

export function buildProofreadingResidualHints(
  input: ProofreadingResidualAdapterInput,
): NormalizedProofreadingResidualHint[] {
  const normalizedQualityCoverage = new Set(
    (input.qualityIssues ?? []).map((issue) =>
      `${issue.issue_type}:${normalizeExcerpt(issue.text_excerpt)}`,
    ),
  );

  const knownRuleIds = new Set(input.knownRuleIds);
  const knownKnowledgeItemIds = new Set(input.knownKnowledgeItemIds);

  return input.sourceBlocks.flatMap((block) =>
    (block.residualHints ?? [])
      .filter((hint) =>
        isResidualHintNovel({
          hint,
          knownRuleIds,
          knownKnowledgeItemIds,
          normalizedQualityCoverage,
        }),
      )
      .map((hint) => {
        const hasBlockLocation =
          block.section != null || block.blockIndex != null;
        const derivedLocation =
          hint.location ??
          (hasBlockLocation
            ? {
                ...(block.section != null ? { section: block.section } : {}),
                ...(block.blockIndex != null
                  ? { block_index: block.blockIndex }
                  : {}),
              }
            : undefined);
        return {
          issue_type: hint.issue_type,
          excerpt: hint.excerpt.trim(),
          suggestion: hint.suggestion.trim(),
          rationale: hint.rationale.trim(),
          novelty_key: `${hint.issue_type}:${normalizeExcerpt(hint.excerpt)}`,
          ...(hint.model_confidence != null
            ? { model_confidence: hint.model_confidence }
            : {}),
          source_stage: hint.source_stage ?? "model_residual",
          risk_level: hint.risk_level ?? deriveRiskLevel(hint.issue_type),
          ...(derivedLocation ? { location: derivedLocation } : {}),
          ...(hint.related_rule_ids && hint.related_rule_ids.length > 0
            ? { related_rule_ids: hint.related_rule_ids }
            : {}),
          ...(hint.related_knowledge_item_ids &&
          hint.related_knowledge_item_ids.length > 0
            ? { related_knowledge_item_ids: hint.related_knowledge_item_ids }
            : {}),
          ...(hint.related_quality_issue_ids &&
          hint.related_quality_issue_ids.length > 0
            ? { related_quality_issue_ids: hint.related_quality_issue_ids }
            : {}),
        };
      }),
  );
}

function isResidualHintNovel(input: {
  hint: ProofreadingResidualHint;
  knownRuleIds: Set<string>;
  knownKnowledgeItemIds: Set<string>;
  normalizedQualityCoverage: Set<string>;
}): boolean {
  if (
    input.hint.related_rule_ids?.some((id) => input.knownRuleIds.has(id)) ??
    false
  ) {
    return false;
  }

  if (
    input.hint.related_knowledge_item_ids?.some((id) =>
      input.knownKnowledgeItemIds.has(id),
    ) ?? false
  ) {
    return false;
  }

  return !input.normalizedQualityCoverage.has(
    `${input.hint.issue_type}:${normalizeExcerpt(input.hint.excerpt)}`,
  );
}

function normalizeExcerpt(excerpt: string): string {
  return excerpt.trim().replaceAll(/\s+/g, " ");
}

function deriveRiskLevel(issueType: string): ResidualIssueRiskLevel {
  return issueType === "medical_meaning_risk" ? "high" : "low";
}
