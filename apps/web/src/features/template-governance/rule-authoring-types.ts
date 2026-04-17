import type {
  CreateEditorialRuleInput,
  EditorialRuleConfidencePolicy,
  EditorialRuleEvidenceLevel,
  EditorialRuleExecutionMode,
  EditorialRuleSeverity,
  EditorialRuleTableFootnoteKind,
  EditorialRuleTableSemanticTarget,
  EditorialRuleTableUnitContext,
  EditorialRuleType,
  EditorialRuleViewModel,
} from "../editorial-rules/index.ts";

export type RuleAuthoringObject =
  | "abstract"
  | "heading_hierarchy"
  | "numeric_unit"
  | "statistical_expression"
  | "table"
  | "reference"
  | "declaration"
  | "statement"
  | "title"
  | "author_line"
  | "keyword"
  | "terminology"
  | "figure"
  | "manuscript_structure"
  | "journal_column";

export type RuleAutomationRisk = "safe_auto" | "guarded_auto" | "inspect_only";

export interface RuleAuthoringDraftBase<
  TObject extends RuleAuthoringObject,
  TPayload,
> {
  ruleObject: TObject;
  orderNo: number;
  ruleType: EditorialRuleType;
  executionMode: EditorialRuleExecutionMode;
  confidencePolicy: EditorialRuleConfidencePolicy;
  severity: EditorialRuleSeverity;
  enabled: boolean;
  evidenceLevel: EditorialRuleEvidenceLevel;
  journalTemplateId?: string | null;
  manualReviewReasonTemplate?: string;
  linkedKnowledgeItemIds?: string[];
  payload: TPayload;
}

export interface AbstractRuleAuthoringPayload {
  labelRole: "objective" | "methods" | "results" | "conclusion";
  sourceLabelText: string;
  normalizedLabelText: string;
  punctuationStyle: "full_width_parentheses";
  spacingStyle: "full_width_gap";
}

export interface HeadingHierarchyRuleAuthoringPayload {
  targetSection: "body" | "abstract";
  expectedSequence: string;
  headingPattern: string;
}

export interface NumericUnitRuleAuthoringPayload {
  targetSection: "methods" | "results" | "body";
  unitStandard: string;
  decimalPlaces: string;
}

export interface StatisticalExpressionRuleAuthoringPayload {
  targetSection: "results" | "body";
  expressionPattern: string;
  reportingRequirement: string;
}

export interface TableRuleAuthoringPayload {
  tableKind:
    | "three_line_table"
    | "general_data_table"
    | "baseline_characteristics_table"
    | "outcome_indicator_table";
  semanticTarget: EditorialRuleTableSemanticTarget;
  headerPathIncludes: string[];
  rowKey: string;
  columnKey: string;
  noteKind: EditorialRuleTableFootnoteKind;
  unitContext: EditorialRuleTableUnitContext;
  captionRequirement: string;
  layoutRequirement: string;
  manualReviewReasonTemplate: string;
}

export interface ReferenceRuleAuthoringPayload {
  citationStyle: string;
  numberingScheme: string;
  doiRequirement: string;
}

export interface DeclarationRuleAuthoringPayload {
  declarationKind:
    | "ethics"
    | "trial_registration"
    | "funding"
    | "conflict_of_interest";
  requiredStatement: string;
  placement: string;
}

export interface StatementRuleAuthoringPayload {
  statementKind:
    | "ethics"
    | "trial_registration"
    | "funding"
    | "conflict_of_interest"
    | "author_contribution";
  requiredStatement: string;
  placement: string;
}

export interface TitleRuleAuthoringPayload {
  titlePattern: string;
  casingRule: string;
  subtitleHandling: string;
}

export interface AuthorLineRuleAuthoringPayload {
  separator: string;
  affiliationFormat: string;
  correspondingAuthorRule: string;
}

export interface KeywordRuleAuthoringPayload {
  keywordCount: string;
  separator: string;
  vocabularyRequirement: string;
}

export interface TerminologyRuleAuthoringPayload {
  targetSection: "title" | "abstract" | "body" | "global";
  preferredTerm: string;
  disallowedVariant: string;
}

export interface FigureRuleAuthoringPayload {
  figureKind:
    | "flowchart"
    | "clinical_image"
    | "trend_chart"
    | "pathology_image";
  captionRequirement: string;
  fileRequirement: string;
}

export interface ManuscriptStructureRuleAuthoringPayload {
  manuscriptType: string;
  requiredSections: string;
  sectionOrder: string;
}

export interface JournalColumnRuleAuthoringPayload {
  columnName: string;
  requirement: string;
  sourceSection: string;
}

export type AbstractRuleAuthoringDraft = RuleAuthoringDraftBase<
  "abstract",
  AbstractRuleAuthoringPayload
>;

export type HeadingHierarchyRuleAuthoringDraft = RuleAuthoringDraftBase<
  "heading_hierarchy",
  HeadingHierarchyRuleAuthoringPayload
>;

export type NumericUnitRuleAuthoringDraft = RuleAuthoringDraftBase<
  "numeric_unit",
  NumericUnitRuleAuthoringPayload
>;

export type StatisticalExpressionRuleAuthoringDraft = RuleAuthoringDraftBase<
  "statistical_expression",
  StatisticalExpressionRuleAuthoringPayload
>;

export type TableRuleAuthoringDraft = RuleAuthoringDraftBase<
  "table",
  TableRuleAuthoringPayload
>;

export type ReferenceRuleAuthoringDraft = RuleAuthoringDraftBase<
  "reference",
  ReferenceRuleAuthoringPayload
>;

export type DeclarationRuleAuthoringDraft = RuleAuthoringDraftBase<
  "declaration",
  DeclarationRuleAuthoringPayload
>;

export type StatementRuleAuthoringDraft = RuleAuthoringDraftBase<
  "statement",
  StatementRuleAuthoringPayload
>;

export type TitleRuleAuthoringDraft = RuleAuthoringDraftBase<
  "title",
  TitleRuleAuthoringPayload
>;

export type AuthorLineRuleAuthoringDraft = RuleAuthoringDraftBase<
  "author_line",
  AuthorLineRuleAuthoringPayload
>;

export type KeywordRuleAuthoringDraft = RuleAuthoringDraftBase<
  "keyword",
  KeywordRuleAuthoringPayload
>;

export type TerminologyRuleAuthoringDraft = RuleAuthoringDraftBase<
  "terminology",
  TerminologyRuleAuthoringPayload
>;

export type FigureRuleAuthoringDraft = RuleAuthoringDraftBase<
  "figure",
  FigureRuleAuthoringPayload
>;

export type ManuscriptStructureRuleAuthoringDraft = RuleAuthoringDraftBase<
  "manuscript_structure",
  ManuscriptStructureRuleAuthoringPayload
>;

export type JournalColumnRuleAuthoringDraft = RuleAuthoringDraftBase<
  "journal_column",
  JournalColumnRuleAuthoringPayload
>;

export type RuleAuthoringDraft =
  | AbstractRuleAuthoringDraft
  | HeadingHierarchyRuleAuthoringDraft
  | NumericUnitRuleAuthoringDraft
  | StatisticalExpressionRuleAuthoringDraft
  | TableRuleAuthoringDraft
  | ReferenceRuleAuthoringDraft
  | DeclarationRuleAuthoringDraft
  | StatementRuleAuthoringDraft
  | TitleRuleAuthoringDraft
  | AuthorLineRuleAuthoringDraft
  | KeywordRuleAuthoringDraft
  | TerminologyRuleAuthoringDraft
  | FigureRuleAuthoringDraft
  | ManuscriptStructureRuleAuthoringDraft
  | JournalColumnRuleAuthoringDraft;

export type AnyRuleAuthoringPreset =
  | RuleAuthoringPreset<"abstract">
  | RuleAuthoringPreset<"heading_hierarchy">
  | RuleAuthoringPreset<"numeric_unit">
  | RuleAuthoringPreset<"statistical_expression">
  | RuleAuthoringPreset<"table">
  | RuleAuthoringPreset<"reference">
  | RuleAuthoringPreset<"declaration">
  | RuleAuthoringPreset<"statement">
  | RuleAuthoringPreset<"title">
  | RuleAuthoringPreset<"author_line">
  | RuleAuthoringPreset<"keyword">
  | RuleAuthoringPreset<"terminology">
  | RuleAuthoringPreset<"figure">
  | RuleAuthoringPreset<"manuscript_structure">
  | RuleAuthoringPreset<"journal_column">;

export type SerializedRuleAuthoringDraft = Omit<CreateEditorialRuleInput, "actorRole">;

export interface RuleAuthoringPreview {
  selectorSummary: string;
  automationRiskPosture: string;
  templateScopeSummary: string;
  normalizedExample: string;
  semanticHitSummary: string;
  expectedEvidenceSummary: string;
  overrideSummary: string;
}

export interface RuleAuthoringPreset<
  TObject extends RuleAuthoringObject = RuleAuthoringObject,
> {
  object: TObject;
  objectLabel: string;
  description: string;
  automationRisk: RuleAutomationRisk;
  createDraft(): Extract<RuleAuthoringDraft, { ruleObject: TObject }>;
}

export function isRuleAuthoringObject(value: string): value is RuleAuthoringObject {
  return (
    value === "abstract" ||
    value === "heading_hierarchy" ||
    value === "numeric_unit" ||
    value === "statistical_expression" ||
    value === "table" ||
    value === "reference" ||
    value === "declaration" ||
    value === "statement" ||
    value === "title" ||
    value === "author_line" ||
    value === "keyword" ||
    value === "terminology" ||
    value === "figure" ||
    value === "manuscript_structure" ||
    value === "journal_column"
  );
}

export function isRuleAuthoringDraft(
  value: EditorialRuleViewModel,
): value is EditorialRuleViewModel & {
  rule_object: RuleAuthoringObject;
} {
  return isRuleAuthoringObject(value.rule_object);
}
