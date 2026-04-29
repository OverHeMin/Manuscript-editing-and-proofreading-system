import type {
  DocumentAssetType,
  HumanFeedbackRecord,
  HumanReviewDiffItem,
  KnowledgeItemRouting,
  ModuleExecutionProfile,
  LearningRun,
  ManuscriptType,
  ResolvedModel,
  RuleAiIntakeDraftRequest,
  RuleAiIntakeDraftResponse,
  RuleAiParsingRequest,
  RuleAiParsingResponse,
  TemplateKnowledgeBinding,
} from "@medical/contracts";

type IsAny<T> = 0 extends 1 & T ? true : false;
type NotAny<T> = IsAny<T> extends true ? false : true;
type Assert<T extends true> = T;
type IsEqual<A, B> = (<T>() => T extends A ? 1 : 2) extends <
  T
>() => T extends B ? 1 : 2
  ? true
  : false;

// Package entry must resolve and expose key surfaces.
type _LearningRunNotAny = Assert<NotAny<LearningRun>>;
type _TemplateKnowledgeBindingNotAny = Assert<NotAny<TemplateKnowledgeBinding>>;
type _ResolvedModelNotAny = Assert<NotAny<ResolvedModel>>;
type _ModuleExecutionProfileNotAny = Assert<NotAny<ModuleExecutionProfile>>;
type _HumanFeedbackRecordNotAny = Assert<NotAny<HumanFeedbackRecord>>;
type _HumanReviewDiffItemNotAny = Assert<NotAny<HumanReviewDiffItem>>;

// Spot-check a couple of tricky unions via the package entry.
type _DocumentAssetTypeHasFinalProofOutputs = Assert<
  IsEqual<
    Extract<DocumentAssetType, "final_proof_issue_report" | "final_proof_annotated_docx">,
    "final_proof_issue_report" | "final_proof_annotated_docx"
  >
>;

type _DocumentAssetTypeHasHumanReviewWorkingAsset = Assert<
  IsEqual<
    Extract<DocumentAssetType, "human_review_working_docx">,
    "human_review_working_docx"
  >
>;

type _KnowledgeItemRoutingManuscriptTypesSupportsAny = Assert<
  IsEqual<KnowledgeItemRouting["manuscript_types"], ManuscriptType[] | "any">
>;

const intakeRequestCheck: RuleAiIntakeDraftRequest = {
  source_kind: "manual_description",
  description: "摘要首次出现英文缩写时使用中文全称（英文缩写）。",
  context: {
    module_scope: "proofreading",
    manuscript_types: ["clinical_study"],
    sections: ["abstract"],
  },
};

const intakeResponseCheck: RuleAiIntakeDraftResponse = {
  draft: {
    source_kind: "manual_description",
    ai_understanding_summary: "摘要首次出现英文缩写需要补全中文全称。",
    recommended_governance_layer: "journal_template",
    target_object: "abstract_abbreviation",
    trigger: "first_abbreviation_occurrence",
    action: "manual_review_or_replace",
    scope: {
      module_scope: "proofreading",
      manuscript_types: ["clinical_study"],
      sections: ["abstract"],
    },
    evidence: [
      {
        kind: "user_description",
        text: "摘要首次出现英文缩写时使用中文全称（英文缩写）。",
      },
    ],
    confidence: { overall: 0.8 },
    uncertainties: [],
  },
  template_match: { status: "matched", template_id: "abstract-abbreviation" },
  similar_rule_matches: [],
};

const parsingRequestCheck: RuleAiParsingRequest = {
  parse_mode: "publish",
  rule_fields: {
    title: "摘要缩写规范",
    rule_body: "摘要首次出现英文缩写时使用中文全称（英文缩写）。",
    module_scope: "proofreading",
    manuscript_types: ["clinical_study"],
  },
};

const parsingResponseCheck: RuleAiParsingResponse = {
  ai_understanding_summary: "摘要英文缩写首次出现需要补全中文全称。",
  consistency: "consistent",
  findings: [],
  requires_human_confirmation: false,
};

void intakeRequestCheck;
void intakeResponseCheck;
void parsingRequestCheck;
void parsingResponseCheck;

