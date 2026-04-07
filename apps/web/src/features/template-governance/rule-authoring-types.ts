import type {
  CreateEditorialRuleInput,
  EditorialRuleConfidencePolicy,
  EditorialRuleEvidenceLevel,
  EditorialRuleExecutionMode,
  EditorialRuleSeverity,
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
  | "declaration";

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

export type RuleAuthoringDraft =
  | AbstractRuleAuthoringDraft
  | HeadingHierarchyRuleAuthoringDraft
  | NumericUnitRuleAuthoringDraft
  | StatisticalExpressionRuleAuthoringDraft
  | TableRuleAuthoringDraft
  | ReferenceRuleAuthoringDraft
  | DeclarationRuleAuthoringDraft;

export type AnyRuleAuthoringPreset =
  | RuleAuthoringPreset<"abstract">
  | RuleAuthoringPreset<"heading_hierarchy">
  | RuleAuthoringPreset<"numeric_unit">
  | RuleAuthoringPreset<"statistical_expression">
  | RuleAuthoringPreset<"table">
  | RuleAuthoringPreset<"reference">
  | RuleAuthoringPreset<"declaration">;

export type SerializedRuleAuthoringDraft = Omit<CreateEditorialRuleInput, "actorRole">;

export interface RuleAuthoringPreview {
  selectorSummary: string;
  automationRiskPosture: string;
  templateScopeSummary: string;
  normalizedExample: string;
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
    value === "declaration"
  );
}

export function isRuleAuthoringDraft(
  value: EditorialRuleViewModel,
): value is EditorialRuleViewModel & {
  rule_object: RuleAuthoringObject;
} {
  return isRuleAuthoringObject(value.rule_object);
}
