import type { RuleAiDraft, RuleAiSimilarityMatch } from "@medical/contracts";

export interface RuleSimilarityLedgerItem {
  id: string;
  title: string;
  targetObject?: string;
  trigger?: string;
  action?: string;
}

export class RuleSimilarityService {
  findSimilar(input: {
    draft: RuleAiDraft;
    existingRules?: readonly RuleSimilarityLedgerItem[];
  }): RuleAiSimilarityMatch[] {
    return (input.existingRules ?? [])
      .map((rule): RuleAiSimilarityMatch | undefined => {
        const sameTarget =
          normalize(rule.targetObject) === normalize(input.draft.target_object);
        const sameTrigger = normalize(rule.trigger) === normalize(input.draft.trigger);
        const sameAction = normalize(rule.action) === normalize(input.draft.action);

        if (sameTarget && sameTrigger && sameAction) {
          return {
            kind: "duplicate",
            rule_id: rule.id,
            title: rule.title,
            rationale: "Target object, trigger, and action match the AI draft.",
            suggested_resolution: "reuse_existing",
          };
        }

        if (sameTarget && (sameTrigger || sameAction)) {
          return {
            kind: "similar",
            rule_id: rule.id,
            title: rule.title,
            rationale: "Target object overlaps with a similar trigger or action.",
            suggested_resolution: "manual_review",
          };
        }

        return undefined;
      })
      .filter((match): match is RuleAiSimilarityMatch => match !== undefined);
  }
}

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/gu, " ");
}
