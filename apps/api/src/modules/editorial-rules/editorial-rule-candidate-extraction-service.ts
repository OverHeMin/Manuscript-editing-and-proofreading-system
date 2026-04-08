import type { ReviewedCaseSnapshotRecord } from "../learning/learning-record.ts";

export type EditorialRuleCandidateExtractionSourceKind =
  | "reviewed_case_snapshot"
  | "human_feedback";

export interface ExtractEditorialRuleCandidateInput {
  sourceKind: EditorialRuleCandidateExtractionSourceKind;
  module: ReviewedCaseSnapshotRecord["module"];
  manuscriptType: ReviewedCaseSnapshotRecord["manuscript_type"];
  beforeFragment: string;
  afterFragment: string;
  evidenceSummary: string;
}

export interface ExtractedEditorialRuleCandidate {
  title: string;
  proposalText: string;
  suggestedRuleObject: string;
  candidatePayload: Record<string, unknown>;
}

const ABSTRACT_BEFORE_HEADING = "摘要 目的";
const ABSTRACT_AFTER_HEADING = "（摘要　目的）";

export class EditorialRuleCandidateExtractionService {
  extract(
    input: ExtractEditorialRuleCandidateInput,
  ): ExtractedEditorialRuleCandidate {
    const beforeFragment = input.beforeFragment.trim();
    const afterFragment = input.afterFragment.trim();
    const evidenceSummary = input.evidenceSummary.trim();
    const extractionContext = `${beforeFragment}\n${afterFragment}\n${evidenceSummary}`;

    if (this.isAbstractHeadingNormalization(beforeFragment, afterFragment)) {
      return {
        title: "Abstract heading normalization",
        proposalText:
          "Normalize abstract objective headings to the governed journal style.",
        suggestedRuleObject: "abstract",
        candidatePayload: {
          extraction_kind: "reviewed_fragment_diff",
          before_fragment: beforeFragment,
          after_fragment: afterFragment,
          evidence_summary: evidenceSummary,
          scope: {
            sections: ["abstract"],
          },
          selector: {
            section_selector: "abstract",
            label_selector: {
              text: beforeFragment,
            },
          },
          trigger: {
            kind: "exact_text",
            text: beforeFragment,
          },
          action: {
            kind: "replace_heading",
            to: afterFragment,
          },
        },
      };
    }

    if (this.isTableNormalization(extractionContext)) {
      return {
        title: "Three-line table normalization",
        proposalText:
          "Inspect tables against the governed three-line-table requirements before applying layout changes.",
        suggestedRuleObject: "table",
        candidatePayload: {
          extraction_kind:
            input.sourceKind === "human_feedback"
              ? "feedback_fragment_diff"
              : "reviewed_fragment_diff",
          before_fragment: beforeFragment,
          after_fragment: afterFragment,
          evidence_summary: evidenceSummary,
          scope: {
            sections: ["table"],
          },
          selector: {
            object_kind: "table",
          },
          trigger: {
            kind: "table_layout_mismatch",
            signals: ["three_line_table", "remove_vertical_rules"],
          },
          action: {
            kind: "inspect_table_format",
            require_three_line_table: true,
            forbid_vertical_rules: true,
            place_table_notes_below: true,
          },
          execution_posture: "inspect_only",
        },
      };
    }

    return {
      title: "Manual rule review candidate",
      proposalText:
        "Review the fragment diff manually and decide whether it should become a governed editorial rule.",
      suggestedRuleObject: "manuscript_structure",
      candidatePayload: {
        extraction_kind:
          input.sourceKind === "human_feedback"
            ? "feedback_fragment_diff"
            : "reviewed_fragment_diff",
        before_fragment: beforeFragment,
        after_fragment: afterFragment,
        evidence_summary: evidenceSummary,
        scope: {
          sections: [input.module],
        },
        selector: {
          object_kind: "generic",
        },
        trigger: {
          kind: "manual_review_required",
        },
        action: {
          kind: "manual_rule_review",
        },
        execution_posture: "inspect_only",
      },
    };
  }

  private isAbstractHeadingNormalization(
    beforeFragment: string,
    afterFragment: string,
  ): boolean {
    if (
      beforeFragment === ABSTRACT_BEFORE_HEADING &&
      afterFragment === ABSTRACT_AFTER_HEADING
    ) {
      return true;
    }

    return (
      beforeFragment.includes("摘要") &&
      beforeFragment.includes("目的") &&
      afterFragment.includes("摘要") &&
      afterFragment.startsWith("（") &&
      afterFragment.endsWith("）")
    );
  }

  private isTableNormalization(extractionContext: string): boolean {
    return (
      extractionContext.includes("表") &&
      (extractionContext.includes("三线表") ||
        extractionContext.includes("竖线") ||
        extractionContext.includes("表注"))
    );
  }
}
