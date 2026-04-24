import assert from "node:assert/strict";
import test from "node:test";

import {
  buildQualityPackageKindBindingKeywords,
  formatQualityPackageBindingDisplayLabel,
  formatQualityPackageBindingModeLabel,
  formatQualityPackageExactBindingLabel,
  formatQualityPackageKindBindingLabel,
  formatQualityPackageKindBindingMeta,
  isQualityPackageKindBindingId,
} from "../src/features/manuscript-quality-packages/binding-kind-options.ts";

test("quality package kind binding helpers expose stable ids labels and keywords", () => {
  assert.equal(isQualityPackageKindBindingId("general_style_package"), true);
  assert.equal(isQualityPackageKindBindingId("medical_analyzer_package"), true);
  assert.equal(isQualityPackageKindBindingId("pkg-general-v3"), false);

  assert.equal(
    formatQualityPackageKindBindingLabel("general_style_package"),
    "按通用包类型激活（不锁版本）",
  );
  assert.equal(
    formatQualityPackageKindBindingMeta("medical_analyzer_package"),
    "医学专用包 · 按类型激活",
  );
  assert.deepEqual(
    buildQualityPackageKindBindingKeywords("general_style_package"),
    [
      "general_style_package",
      "通用包",
      "按类型激活",
      "不锁版本",
      "所有通用包",
    ],
  );
});

test("quality package binding helpers distinguish exact-version and package-kind displays", () => {
  assert.equal(
    formatQualityPackageExactBindingLabel({
      packageName: "General Package",
      version: 3,
      packageKind: "general_style_package",
    }),
    "General Package v3 / 通用包（锁定具体版本）",
  );
  assert.equal(
    formatQualityPackageBindingModeLabel("medical_analyzer_package"),
    "按类型激活",
  );
  assert.equal(
    formatQualityPackageBindingDisplayLabel({
      bindingKind: "general_package",
      bindingTargetId: "pkg-general-v3",
      bindingTargetLabel: "通用包 A",
    }),
    "通用包 A（锁定具体版本）",
  );
  assert.equal(
    formatQualityPackageBindingDisplayLabel({
      bindingKind: "general_package",
      bindingTargetId: "general_style_package",
      bindingTargetLabel: "按通用包类型激活（不锁版本）",
    }),
    "按通用包类型激活（不锁版本）",
  );
});
