export type TemplateGovernanceNavigationTarget =
  | "overview"
  | "rule-ledger"
  | "authoring"
  | "large-template-ledger"
  | "journal-template-ledger"
  | "extraction-ledger"
  | "general-package-ledger"
  | "medical-package-ledger";

export interface TemplateGovernanceNavigationItem {
  key: TemplateGovernanceNavigationTarget;
  label: string;
  isActive: boolean;
  onClick?: () => void;
}

const navigationOrder: readonly TemplateGovernanceNavigationTarget[] = [
  "overview",
  "rule-ledger",
  "large-template-ledger",
  "journal-template-ledger",
  "general-package-ledger",
  "medical-package-ledger",
  "extraction-ledger",
];

const navigationLabels: Record<TemplateGovernanceNavigationTarget, string> = {
  overview: "总览",
  "rule-ledger": "规则台账",
  authoring: "规则录入",
  "large-template-ledger": "大模板台账",
  "journal-template-ledger": "期刊模板台账",
  "extraction-ledger": "原稿/编辑稿提取",
  "general-package-ledger": "通用包台账",
  "medical-package-ledger": "医学专用包台账",
};

export function createTemplateGovernanceNavigationItems(
  activeKey: TemplateGovernanceNavigationTarget,
  onNavigate?: (target: TemplateGovernanceNavigationTarget) => void,
): TemplateGovernanceNavigationItem[] {
  return navigationOrder.map((key) => ({
    key,
    label: navigationLabels[key],
    isActive: key === activeKey,
    ...(onNavigate ? { onClick: () => onNavigate(key) } : {}),
  }));
}
