import type {
  EditorialRule,
  EditorialRuleExecutionPosture,
  EditorialRuleExplanationPayload,
  EditorialRuleLinkagePayload,
  EditorialRuleObjectCatalogEntry,
  EditorialRulePreviewMatchedRule,
  EditorialRulePreviewResult,
  EditorialRuleProjectionPayload,
  EditorialRuleSet,
  JournalTemplateId,
  JournalTemplateProfile,
  KnowledgeItem,
  LearningCandidate,
  LearningWriteback,
  LearningWritebackTarget,
  RuleObjectKey,
  TemplateFamilyId,
} from "../src/index.js";

type IsEqual<A, B> = (<T>() => T extends A ? 1 : 2) extends <
  T
>() => T extends B ? 1 : 2
  ? true
  : false;
type Assert<T extends true> = T;
type IsAssignable<A, B> = A extends B ? true : false;
type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;

type _RuleObjectKey = Assert<
  IsEqual<
    RuleObjectKey,
    | "title"
    | "author_line"
    | "abstract"
    | "keyword"
    | "heading_hierarchy"
    | "terminology"
    | "numeric_unit"
    | "statistical_expression"
    | "table"
    | "figure"
    | "reference"
    | "statement"
    | "manuscript_structure"
    | "journal_column"
  >
>;

type ExpectedJournalTemplateProfile = {
  id: JournalTemplateId;
  template_family_id: TemplateFamilyId;
  journal_key: string;
  journal_name: string;
  status: "draft" | "active" | "archived";
};

type _JournalTemplateProfileShapeForward = Assert<
  IsAssignable<JournalTemplateProfile, ExpectedJournalTemplateProfile>
>;
type _JournalTemplateProfileShapeBackward = Assert<
  IsAssignable<ExpectedJournalTemplateProfile, JournalTemplateProfile>
>;

type _EditorialRuleSetHasJournalTemplate = Assert<
  HasKey<EditorialRuleSet, "journal_template_id">
>;
type _EditorialRuleHasExplanationPayload = Assert<
  HasKey<EditorialRule, "explanation_payload">
>;
type _EditorialRuleHasLinkagePayload = Assert<
  HasKey<EditorialRule, "linkage_payload">
>;
type _EditorialRuleHasProjectionPayload = Assert<
  HasKey<EditorialRule, "projection_payload">
>;

type ExpectedExplanationPayload = {
  rationale: string;
  applies_when?: string[];
  not_applies_when?: string[];
  correct_example?: string;
  incorrect_example?: string;
  review_prompt?: string;
};

type _ExplanationPayloadShapeForward = Assert<
  IsAssignable<EditorialRuleExplanationPayload, ExpectedExplanationPayload>
>;
type _ExplanationPayloadShapeBackward = Assert<
  IsAssignable<ExpectedExplanationPayload, EditorialRuleExplanationPayload>
>;

type ExpectedLinkagePayload = {
  source_learning_candidate_id?: string;
  source_snapshot_asset_id?: string;
  projected_knowledge_item_ids?: string[];
  overrides_rule_ids?: string[];
};

type _LinkagePayloadShapeForward = Assert<
  IsAssignable<EditorialRuleLinkagePayload, ExpectedLinkagePayload>
>;
type _LinkagePayloadShapeBackward = Assert<
  IsAssignable<ExpectedLinkagePayload, EditorialRuleLinkagePayload>
>;

type ExpectedProjectionPayload = {
  projection_kind: "rule" | "checklist" | "prompt_snippet";
  summary?: string;
  standard_example?: string;
  incorrect_example?: string;
};

type _ProjectionPayloadShapeForward = Assert<
  IsAssignable<EditorialRuleProjectionPayload, ExpectedProjectionPayload>
>;
type _ProjectionPayloadShapeBackward = Assert<
  IsAssignable<ExpectedProjectionPayload, EditorialRuleProjectionPayload>
>;

type _LearningCandidateHasCandidatePayload = Assert<
  HasKey<LearningCandidate, "candidate_payload">
>;
type _LearningCandidateHasSuggestedRuleObject = Assert<
  HasKey<LearningCandidate, "suggested_rule_object">
>;
type _LearningCandidateHasSuggestedTemplateFamilyId = Assert<
  HasKey<LearningCandidate, "suggested_template_family_id">
>;
type _LearningCandidateHasSuggestedJournalTemplateId = Assert<
  HasKey<LearningCandidate, "suggested_journal_template_id">
>;

type _LearningWritebackTarget = Assert<
  IsEqual<
    LearningWritebackTarget,
    | "knowledge_item"
    | "module_template"
    | "prompt_template"
    | "skill_package"
    | "editorial_rule_draft"
  >
>;

type _LearningWritebackTargetShape = Assert<
  IsAssignable<
    {
      target_type: "editorial_rule_draft";
    },
    Pick<LearningWriteback, "target_type">
  >
>;

type _KnowledgeItemHasProjectionSource = Assert<
  HasKey<KnowledgeItem, "projection_source">
>;

type _EditorialRuleExecutionPosture = Assert<
  IsEqual<
    EditorialRuleExecutionPosture,
    "auto" | "guarded" | "inspect_only"
  >
>;

type ExpectedPreviewMatchedRule = {
  rule_id: string;
  rule_object: RuleObjectKey;
  coverage_key: string;
  execution_posture: EditorialRuleExecutionPosture;
  overridden_rule_ids: string[];
  reason: string;
};

type _PreviewMatchedRuleShapeForward = Assert<
  IsAssignable<EditorialRulePreviewMatchedRule, ExpectedPreviewMatchedRule>
>;
type _PreviewMatchedRuleShapeBackward = Assert<
  IsAssignable<ExpectedPreviewMatchedRule, EditorialRulePreviewMatchedRule>
>;

type ExpectedPreviewResult = {
  matched_rule_ids: string[];
  overridden_rule_ids: string[];
  reasons: string[];
  output?: string;
  execution_posture: EditorialRuleExecutionPosture;
  inspect_only: boolean;
  matched_rules: EditorialRulePreviewMatchedRule[];
};

type _PreviewResultShapeForward = Assert<
  IsAssignable<EditorialRulePreviewResult, ExpectedPreviewResult>
>;
type _PreviewResultShapeBackward = Assert<
  IsAssignable<ExpectedPreviewResult, EditorialRulePreviewResult>
>;

type ExpectedRuleObjectCatalogEntry = {
  key: RuleObjectKey;
  label: string;
  default_execution_posture: EditorialRuleExecutionPosture;
  preview_strategy: "text_transform" | "finding_only";
  projection_kinds: Array<"rule" | "checklist" | "prompt_snippet">;
};

type _RuleObjectCatalogEntryShapeForward = Assert<
  IsAssignable<EditorialRuleObjectCatalogEntry, ExpectedRuleObjectCatalogEntry>
>;
type _RuleObjectCatalogEntryShapeBackward = Assert<
  IsAssignable<ExpectedRuleObjectCatalogEntry, EditorialRuleObjectCatalogEntry>
>;
