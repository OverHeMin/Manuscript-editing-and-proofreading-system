import type { EditorialRuleExecutionPosture } from "./editorial-rule-object-catalog.ts";

export type EditorialRuleConflictKind =
  | "override"
  | "merge"
  | "exclusive_conflict";

export interface EditorialRuleConflictCandidate {
  rule_id: string;
  coverage_key: string;
  target_key?: string;
  output?: string;
  execution_posture: EditorialRuleExecutionPosture;
  overridden_rule_ids: string[];
  reason: string;
}

export interface EditorialRuleConflictRecord {
  kind: EditorialRuleConflictKind;
  rule_ids: string[];
  winning_rule_id?: string;
  overridden_rule_ids?: string[];
  coverage_keys: string[];
  reason: string;
  requires_manual_review: boolean;
}

export class EditorialRuleConflictService {
  classifyPreviewConflicts(
    candidates: readonly EditorialRuleConflictCandidate[],
  ): EditorialRuleConflictRecord[] {
    const conflicts: EditorialRuleConflictRecord[] = [];

    for (const candidate of candidates) {
      if (candidate.overridden_rule_ids.length === 0) {
        continue;
      }

      conflicts.push({
        kind: "override",
        rule_ids: [candidate.rule_id, ...candidate.overridden_rule_ids],
        winning_rule_id: candidate.rule_id,
        overridden_rule_ids: [...candidate.overridden_rule_ids],
        coverage_keys: [candidate.coverage_key],
        reason: candidate.reason,
        requires_manual_review: candidate.execution_posture !== "auto",
      });
    }

    const exclusiveConflictRuleIds = new Set<string>();
    const targetGroups = groupConflictCandidatesByTarget(candidates);

    for (const [targetKey, groupedCandidates] of targetGroups.entries()) {
      if (groupedCandidates.length < 2) {
        continue;
      }

      const uniqueOutputs = [...new Set(
        groupedCandidates
          .map((candidate) => candidate.output?.trim())
          .filter((output): output is string => Boolean(output)),
      )];

      if (uniqueOutputs.length > 1) {
        const ruleIds = groupedCandidates.map((candidate) => candidate.rule_id);
        for (const ruleId of ruleIds) {
          exclusiveConflictRuleIds.add(ruleId);
        }

        conflicts.push({
          kind: "exclusive_conflict",
          rule_ids: ruleIds,
          coverage_keys: groupedCandidates.map((candidate) => candidate.coverage_key),
          reason:
            `Rules attempted incompatible actions on target "${targetKey}".`,
          requires_manual_review: true,
        });
      }
    }

    const mergeCandidates = candidates.filter(
      (candidate) => !exclusiveConflictRuleIds.has(candidate.rule_id),
    );
    if (mergeCandidates.length > 1) {
      conflicts.push({
        kind: "merge",
        rule_ids: mergeCandidates.map((candidate) => candidate.rule_id),
        coverage_keys: mergeCandidates.map((candidate) => candidate.coverage_key),
        reason: describeMergeReason(mergeCandidates),
        requires_manual_review: mergeCandidates.some(
          (candidate) => candidate.execution_posture !== "auto",
        ),
      });
    }

    return conflicts;
  }
}

function groupConflictCandidatesByTarget(
  candidates: readonly EditorialRuleConflictCandidate[],
): Map<string, EditorialRuleConflictCandidate[]> {
  const groups = new Map<string, EditorialRuleConflictCandidate[]>();

  for (const candidate of candidates) {
    if (!candidate.target_key) {
      continue;
    }

    const existing = groups.get(candidate.target_key);
    if (existing) {
      existing.push(candidate);
      continue;
    }

    groups.set(candidate.target_key, [candidate]);
  }

  return groups;
}

function describeMergeReason(
  candidates: readonly EditorialRuleConflictCandidate[],
): string {
  const distinctTargetCount = new Set(
    candidates.map((candidate) => candidate.target_key ?? candidate.coverage_key),
  ).size;

  if (distinctTargetCount > 1) {
    return "Rules can merge because they target different governed aspects.";
  }

  return "Rules can merge because they resolve to compatible governed outcomes.";
}
