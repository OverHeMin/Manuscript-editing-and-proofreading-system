import type { RuleAiDraft, RuleAiTemplateMatch } from "@medical/contracts";

export class RuleTemplateMatchingService {
  match(input: { draft: RuleAiDraft }): RuleAiTemplateMatch {
    const haystack = [
      input.draft.target_object,
      input.draft.trigger,
      input.draft.action,
      input.draft.ai_understanding_summary,
    ]
      .join(" ")
      .toLowerCase();

    if (haystack.includes("abstract") || haystack.includes("摘要")) {
      return {
        status: "matched",
        template_id: "abstract_rule_template",
      };
    }

    if (haystack.includes("table") || haystack.includes("表格")) {
      return {
        status: "matched",
        template_id: "table_rule_template",
      };
    }

    return {
      status: "no_match",
      new_template_candidate: {
        title: `${input.draft.target_object} template candidate`,
        rationale: "No existing deterministic template matched this AI draft.",
        review_required: true,
      },
    };
  }
}
