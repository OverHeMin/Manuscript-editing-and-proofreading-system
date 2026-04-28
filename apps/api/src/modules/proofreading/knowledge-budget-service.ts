import type { KnowledgeKind } from "../knowledge/knowledge-record.ts";
import type { DeepProofreadingBudgetDecision } from "./deep-proofreading-contracts.ts";

export interface ProofreadingKnowledgeBudgetCandidate {
  knowledgeItemId: string;
  score: number;
  reasons: string[];
  title?: string;
  summary?: string;
  promptSnippet?: string;
  knowledgeKind: KnowledgeKind;
  estimatedTokens?: number;
}

export interface BudgetedProofreadingKnowledge
  extends ProofreadingKnowledgeBudgetCandidate {
  budgetDecision: DeepProofreadingBudgetDecision;
}

export function selectKnowledgeBudget(input: {
  candidates: readonly ProofreadingKnowledgeBudgetCandidate[];
  maxItems?: number;
  maxEstimatedTokens?: number;
}): {
  selected: BudgetedProofreadingKnowledge[];
  excluded: BudgetedProofreadingKnowledge[];
} {
  const byId = new Map<string, ProofreadingKnowledgeBudgetCandidate>();
  const excluded: BudgetedProofreadingKnowledge[] = [];

  for (const candidate of input.candidates) {
    const existing = byId.get(candidate.knowledgeItemId);
    if (!existing || scoreForBudget(candidate) > scoreForBudget(existing)) {
      if (existing) {
        excluded.push(withDecision(existing, "excluded", ["duplicate"]));
      }
      byId.set(candidate.knowledgeItemId, candidate);
    } else {
      excluded.push(withDecision(candidate, "excluded", ["duplicate"]));
    }
  }

  const maxItems = input.maxItems ?? 12;
  const maxEstimatedTokens = input.maxEstimatedTokens ?? 4_000;
  let usedTokens = 0;
  const selected: BudgetedProofreadingKnowledge[] = [];

  for (const candidate of [...byId.values()].sort(
    (left, right) =>
      scoreForBudget(right) - scoreForBudget(left) ||
      left.knowledgeItemId.localeCompare(right.knowledgeItemId),
  )) {
    const estimatedTokens = candidate.estimatedTokens ?? 100;
    if (selected.length >= maxItems || usedTokens + estimatedTokens > maxEstimatedTokens) {
      excluded.push(withDecision(candidate, "excluded", ["budget_trimmed"]));
      continue;
    }
    usedTokens += estimatedTokens;
    selected.push(withDecision(candidate, "selected", ["budget_selected"]));
  }

  return { selected, excluded };
}

function withDecision(
  candidate: ProofreadingKnowledgeBudgetCandidate,
  decision: "selected" | "excluded",
  extraReasons: string[],
): BudgetedProofreadingKnowledge {
  return {
    ...candidate,
    budgetDecision: {
      itemId: candidate.knowledgeItemId,
      itemKind: "knowledge",
      decision,
      reasons: [...candidate.reasons, ...extraReasons],
      estimatedTokens: candidate.estimatedTokens,
    },
    reasons: [...candidate.reasons, ...extraReasons],
  };
}

function scoreForBudget(candidate: ProofreadingKnowledgeBudgetCandidate): number {
  return (
    candidate.score +
    (candidate.knowledgeKind === "prompt_snippet" || candidate.promptSnippet ? 100 : 0) +
    (candidate.reasons.includes("binding_match") ? 20 : 0) +
    (candidate.reasons.includes("context_rank") ? 5 : 0)
  );
}
