import type { DeepProofreadingSlice } from "./deep-proofreading-contracts.ts";
import type { ProofreadingDeepPassKind } from "./proofreading-pass-run-record.ts";

export interface ProofreadingRuleActivationCandidate {
  ruleId: string;
  score: number;
  reasons: string[];
}

export interface ActivatedProofreadingRule extends ProofreadingRuleActivationCandidate {
  passKind: ProofreadingDeepPassKind;
  sliceId: string;
}

export function activateProofreadingRules(input: {
  passKind: ProofreadingDeepPassKind;
  slice: DeepProofreadingSlice;
  candidates: readonly ProofreadingRuleActivationCandidate[];
  maxRules?: number;
}): ActivatedProofreadingRule[] {
  return input.candidates
    .map((candidate) => ({
      ...candidate,
      passKind: input.passKind,
      sliceId: input.slice.id,
      score: candidate.score + priorityBoost(candidate, input.slice),
      reasons: normalizeReasons(candidate, input.slice),
    }))
    .sort(
      (left, right) =>
        right.score - left.score || left.ruleId.localeCompare(right.ruleId),
    )
    .slice(0, input.maxRules ?? 20);
}

function priorityBoost(
  candidate: ProofreadingRuleActivationCandidate,
  slice: DeepProofreadingSlice,
): number {
  let boost = 0;
  if (slice.sliceKind === "table" && candidate.ruleId.includes("table")) {
    boost += 20;
  }
  if (candidate.reasons.includes("medical_package_scope")) {
    boost += 8;
  }
  if (candidate.reasons.includes("general_package_scope")) {
    boost += 3;
  }
  return boost;
}

function normalizeReasons(
  candidate: ProofreadingRuleActivationCandidate,
  slice: DeepProofreadingSlice,
): string[] {
  const reasons = new Set(candidate.reasons);
  if (slice.sliceKind === "table" && candidate.ruleId.includes("table")) {
    reasons.add("exact_object");
  }
  return [...reasons].sort((left, right) => {
    const order = ["exact_object", "binding_match", "keyword_hit"];
    return (order.indexOf(left) === -1 ? 99 : order.indexOf(left)) -
      (order.indexOf(right) === -1 ? 99 : order.indexOf(right));
  });
}
