export type RuleWizardStep =
  | "entry"
  | "semantic"
  | "confirm"
  | "binding"
  | "publish";

export interface RuleWizardState {
  mode: "create" | "edit" | "candidate";
  step: RuleWizardStep;
  dirty: boolean;
  draftAssetId?: string;
  draftRevisionId?: string;
  sourceRowId?: string;
}

const ruleWizardStepOrder: readonly RuleWizardStep[] = [
  "entry",
  "semantic",
  "confirm",
  "binding",
  "publish",
];

const ruleWizardStepLabels: Record<RuleWizardStep, string> = {
  entry: "带入候选",
  semantic: "整理草稿",
  confirm: "确认规则意图",
  binding: "绑定适用范围",
  publish: "提交发布",
};

export function createRuleWizardState(
  mode: RuleWizardState["mode"],
  input: Partial<Omit<RuleWizardState, "mode">> = {},
): RuleWizardState {
  return {
    mode,
    step: input.step ?? "entry",
    dirty: input.dirty ?? false,
    draftAssetId: input.draftAssetId,
    draftRevisionId: input.draftRevisionId,
    sourceRowId: input.sourceRowId,
  };
}

export function getRuleWizardStepLabels(): string[] {
  return ruleWizardStepOrder.map((step) => ruleWizardStepLabels[step]);
}

export function getRuleWizardStepLabel(step: RuleWizardStep): string {
  return ruleWizardStepLabels[step];
}

export function getNextRuleWizardStep(step: RuleWizardStep): RuleWizardStep | null {
  const stepIndex = ruleWizardStepOrder.indexOf(step);
  return ruleWizardStepOrder[stepIndex + 1] ?? null;
}

export function getPreviousRuleWizardStep(step: RuleWizardStep): RuleWizardStep | null {
  const stepIndex = ruleWizardStepOrder.indexOf(step);
  return stepIndex > 0 ? ruleWizardStepOrder[stepIndex - 1] : null;
}

export function advanceRuleWizardState(state: RuleWizardState): RuleWizardState {
  const nextStep = getNextRuleWizardStep(state.step);
  return nextStep == null ? state : { ...state, step: nextStep, dirty: true };
}

export function rewindRuleWizardState(state: RuleWizardState): RuleWizardState {
  const previousStep = getPreviousRuleWizardStep(state.step);
  return previousStep == null ? state : { ...state, step: previousStep };
}
