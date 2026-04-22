export function formatWorkbenchExecutionTrustModeLabel(
  mode: "governed" | "bare" | undefined,
): string {
  if (mode === "governed") {
    return "受治理执行";
  }

  if (mode === "bare") {
    return "单次 AI 识别";
  }

  return "待确认";
}

export function formatWorkbenchExecutionModelSourceLabel(
  source: string | undefined,
): string {
  switch (source) {
    case "template_family_policy":
      return "模板族策略";
    case "module_policy":
      return "模块策略";
    case "legacy_template_override":
      return "历史模板覆写";
    case "legacy_module_default":
      return "历史模块默认";
    case "legacy_system_default":
      return "历史系统默认";
    case "task_override":
      return "任务覆写";
    case undefined:
      return "集中默认";
    default:
      return source;
  }
}

export function formatWorkbenchProviderReadinessLabel(
  status: string | undefined,
): string {
  if (status === "ok") {
    return "就绪";
  }

  if (status === "warning") {
    return "需关注";
  }

  return "未上报";
}

export function formatWorkbenchRuntimeBindingReadinessLabel(
  status: string | undefined,
): string {
  if (status === "ready") {
    return "就绪";
  }

  if (status === "degraded") {
    return "已降级";
  }

  if (status === "missing") {
    return "缺失";
  }

  return "未上报";
}
