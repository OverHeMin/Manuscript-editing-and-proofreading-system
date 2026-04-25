import type { ManuscriptQualityPackageKind } from "./types.ts";

export type QualityPackageBindingKind = "general_package" | "medical_package";

export function isQualityPackageKindBindingId(
  value: string,
): value is ManuscriptQualityPackageKind {
  return (
    value === "general_style_package" || value === "medical_analyzer_package"
  );
}

export function formatQualityPackageKindBindingLabel(
  packageKind: ManuscriptQualityPackageKind,
): string {
  switch (packageKind) {
    case "general_style_package":
      return "按通用包类型激活（不锁版本）";
    case "medical_analyzer_package":
      return "按医用包类型激活（不锁版本）";
    default:
      return packageKind;
  }
}

export function formatQualityPackageKindBindingMeta(
  packageKind: ManuscriptQualityPackageKind,
): string {
  switch (packageKind) {
    case "general_style_package":
      return "通用包 · 按类型激活";
    case "medical_analyzer_package":
      return "医学专用包 · 按类型激活";
    default:
      return "按类型激活";
  }
}

export function buildQualityPackageKindBindingKeywords(
  packageKind: ManuscriptQualityPackageKind,
): string[] {
  switch (packageKind) {
    case "general_style_package":
      return [
        packageKind,
        "通用包",
        "按类型激活",
        "不锁版本",
        "所有通用包",
      ];
    case "medical_analyzer_package":
      return [
        packageKind,
        "医学专用包",
        "医用包",
        "按类型激活",
        "不锁版本",
        "所有医用包",
      ];
    default:
      return [packageKind];
  }
}

export function formatQualityPackageExactBindingLabel(input: {
  packageName: string;
  version: number;
  packageKind: ManuscriptQualityPackageKind;
}): string {
  const kindLabel =
    input.packageKind === "general_style_package" ? "通用包" : "医用包";
  return `${input.packageName} v${input.version} / ${kindLabel}（锁定具体版本）`;
}

export function formatQualityPackageBindingModeLabel(bindingTargetId: string): string {
  return isQualityPackageKindBindingId(bindingTargetId)
    ? "按类型激活"
    : "锁定具体版本";
}

export function formatQualityPackageBindingDisplayLabel(input: {
  bindingKind: QualityPackageBindingKind;
  bindingTargetId: string;
  bindingTargetLabel: string;
}): string {
  const baseLabel = input.bindingTargetLabel.trim();

  if (isQualityPackageKindBindingId(input.bindingTargetId)) {
    if (baseLabel.length === 0 || baseLabel === input.bindingTargetId) {
      return formatQualityPackageKindBindingLabel(input.bindingTargetId);
    }

    if (baseLabel.includes("按类型激活") || baseLabel.includes("不锁版本")) {
      return baseLabel;
    }

    return `${baseLabel}（按类型激活）`;
  }

  if (baseLabel.length === 0) {
    return input.bindingTargetId;
  }

  if (baseLabel.includes("锁定具体版本")) {
    return baseLabel;
  }

  return `${baseLabel}（锁定具体版本）`;
}
