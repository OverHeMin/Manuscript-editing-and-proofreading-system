import assert from "node:assert/strict";
import test from "node:test";

const {
  getRuleWizardStepLabels,
} = await import(
  "../src/features/template-governance/template-governance-rule-wizard-state.ts"
);

test("rule wizard state exposes the approved five-step labels", () => {
  assert.deepEqual(getRuleWizardStepLabels(), [
    "带入候选",
    "整理草稿",
    "确认规则意图",
    "绑定适用范围",
    "提交发布",
  ]);
});
