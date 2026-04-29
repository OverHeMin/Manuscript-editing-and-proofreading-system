export type TemplateGovernanceV2Section =
  | "dashboard"
  | "rules"
  | "templates"
  | "packages"
  | "extraction"
  | "ai-intake"
  | "recovery"
  | "release"
  | "advanced";

export type TemplateGovernanceV2Panel =
  | "none"
  | "rule-detail"
  | "rule-wizard"
  | "ai-intake"
  | "candidate-detail"
  | "review-item-detail"
  | "template-detail"
  | "package-detail"
  | "extraction-detail"
  | "release-check"
  | "advanced-compatibility";

export type TemplateGovernanceV2SelectedKind =
  | "none"
  | "rule-ledger-row"
  | "learning-candidate"
  | "review-item"
  | "template"
  | "package"
  | "extraction-task";

export type TemplateGovernanceV2Subtype =
  | "large"
  | "journal"
  | "general"
  | "medical";

export interface TemplateGovernanceV2RouteState {
  section: TemplateGovernanceV2Section;
  panel: TemplateGovernanceV2Panel;
  selectedKind: TemplateGovernanceV2SelectedKind;
  selectedId: string | undefined;
  subtype: TemplateGovernanceV2Subtype | undefined;
}
