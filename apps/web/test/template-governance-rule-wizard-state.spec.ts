import assert from "node:assert/strict";
import test from "node:test";

const {
  getRuleWizardStepLabels,
} = await import(
  "../src/features/template-governance/template-governance-rule-wizard-state.ts"
);

test("rule wizard state exposes the approved five-step labels", () => {
  assert.deepEqual(getRuleWizardStepLabels(), [
    "基础录入与证据补充",
    "AI 识别语义层",
    "人工确认 AI 结果",
    "放入模板 / 规则包",
    "保存与发布",
  ]);
});
