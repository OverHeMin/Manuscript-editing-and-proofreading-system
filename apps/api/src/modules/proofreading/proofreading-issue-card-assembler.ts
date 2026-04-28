import type {
  DeepProofreadingIssueCard,
  DeepProofreadingSliceEvidence,
} from "./deep-proofreading-contracts.ts";

export function assembleDeepProofreadingIssueCards(input: {
  deterministicIssues?: readonly DeepProofreadingIssueCard[];
  governedRuleIssues?: readonly DeepProofreadingIssueCard[];
  qualityIssues?: readonly DeepProofreadingIssueCard[];
  aiIssues?: readonly DeepProofreadingIssueCard[];
  residualIssues?: readonly DeepProofreadingIssueCard[];
}): DeepProofreadingIssueCard[] {
  const ordered = [
    ...(input.deterministicIssues ?? []),
    ...(input.governedRuleIssues ?? []),
    ...(input.qualityIssues ?? []),
    ...(input.aiIssues ?? []),
    ...(input.residualIssues ?? []),
  ].sort((left, right) => sourcePriority(left) - sourcePriority(right));

  const byKey = new Map<string, DeepProofreadingIssueCard>();
  for (const issue of ordered) {
    const key = dedupeKey(issue);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...issue, supportingEvidence: [...issue.supportingEvidence] });
      continue;
    }
    existing.supportingEvidence.push(toSupportingEvidence(issue));
    if (issue.suggestion?.replacementText && existing.suggestion?.replacementText) {
      if (issue.suggestion.replacementText !== existing.suggestion.replacementText) {
        existing.conflictFlags = [
          ...new Set([...existing.conflictFlags, "conflicting_suggestions"]),
        ];
      }
    }
  }

  return [...byKey.values()];
}

function dedupeKey(issue: DeepProofreadingIssueCard): string {
  return [
    issue.anchor.documentLocator?.anchorKey ?? `block-${issue.anchor.blockIndex}`,
    issue.issueType,
    issue.anchor.quote,
  ].join("::");
}

function sourcePriority(issue: DeepProofreadingIssueCard): number {
  switch (issue.source) {
    case "deterministic_check":
      return 1;
    case "governed_rule":
      return 2;
    case "quality_package":
    case "quality_check":
      return 3;
    case "ai_pass":
      return 4;
    case "residual_ai":
      return 5;
    default:
      return 6;
  }
}

function toSupportingEvidence(
  issue: DeepProofreadingIssueCard,
): DeepProofreadingSliceEvidence {
  return {
    kind: "fact",
    id: issue.itemId,
    label: `${issue.source}:${issue.title}`,
  };
}
