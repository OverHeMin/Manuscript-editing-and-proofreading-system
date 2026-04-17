import test from "node:test";
import assert from "node:assert/strict";
import {
  formatRulePackageAutomationPostureLabel,
  formatRulePackageTargetLabel,
} from "../src/features/template-governance/template-governance-display.ts";

test("rule package target labels cover rule-center authored objects", () => {
  assert.equal(formatRulePackageTargetLabel("heading_hierarchy"), "标题层级");
  assert.equal(formatRulePackageTargetLabel("statistical_expression"), "统计表达");
  assert.equal(formatRulePackageTargetLabel("template_family"), "模板族");
});

test("rule package automation posture labels cover new guarded values", () => {
  assert.equal(formatRulePackageAutomationPostureLabel("safe_auto"), "直接自动");
  assert.equal(formatRulePackageAutomationPostureLabel("inspect_only"), "仅检查");
});
