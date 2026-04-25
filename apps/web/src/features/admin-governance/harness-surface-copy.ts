const harnessSeededNameMap: Record<string, string> = {
  "Editing Governed Evaluation": "编辑治理评测",
  "Proofreading Governed Evaluation": "校对治理评测",
  "Screening Governed Evaluation": "初筛治理评测",
  "Editing Browser QA": "编辑浏览器验收",
  "Proofreading Browser QA": "校对浏览器验收",
  "Screening Browser QA": "初筛浏览器验收",
  "Latest browser QA": "最新浏览器验收",
  "Needs review browser QA": "待复核浏览器验收",
  "Rejected browser QA": "已拒绝浏览器验收",
  "已拒绝 browser QA": "已拒绝浏览器验收",
  "Editing Release Gate": "编辑发布门",
  "Proofreading Release Gate": "校对发布门",
  "Screening Release Gate": "初筛发布门",
  "Editing Runtime": "编辑运行时",
  "Editing Preview Runtime": "编辑预览运行时",
  "Proofreading Runtime": "校对运行时",
  "Screening Runtime": "初筛运行时",
  "Editing Sandbox": "编辑沙箱配置",
  "Editing Preview Sandbox": "编辑预览沙箱配置",
  "Proofreading Sandbox": "校对沙箱配置",
  "Screening Sandbox": "初筛沙箱配置",
  "Editing Executor": "编辑代理档案",
  "Editing Preview Executor": "编辑预览代理档案",
  "Proofreading Executor": "校对代理档案",
  "Screening Executor": "初筛代理档案",
  "Editing Policy": "编辑工具策略",
  "Editing Preview Policy": "编辑预览工具策略",
  "Proofreading Policy": "校对工具策略",
  "Screening Policy": "初筛工具策略",
  "Editing retrieval": "编辑检索预设",
  "Editing retrieval preview": "编辑检索预设预览",
  "Editing review policy": "编辑人工复核策略",
  "Editing review preview": "编辑人工复核策略预览",
  "Seeded Clinical Study Family": "预置临床研究模板族",
};

export function formatHarnessSurfaceName(name: string): string {
  const seededName = harnessSeededNameMap[name];
  if (seededName) {
    return seededName;
  }

  const activeSuiteMatch = /^(.*) Active Evaluation Suite$/.exec(name);
  if (activeSuiteMatch) {
    return `${activeSuiteMatch[1]} 生效评测套件`;
  }

  const browserCheckMatch = /^(.*) Browser QA Check$/.exec(name);
  if (browserCheckMatch) {
    return `${browserCheckMatch[1]} 浏览器验收核查`;
  }

  return name;
}

export function formatHarnessStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "生效中";
    case "draft":
      return "草稿";
    case "published":
      return "已发布";
    case "pending_review":
      return "待审核";
    case "approved":
      return "已批准";
    case "archived":
      return "已归档";
    case "running":
      return "运行中";
    case "completed":
      return "已完成";
    case "failed":
      return "失败";
    case "queued":
      return "排队中";
    case "passed":
      return "通过";
    case "rejected":
      return "已拒绝";
    case "needs_review":
      return "待复核";
    default:
      return status;
  }
}

export function formatHarnessModuleLabel(module: string): string {
  switch (module) {
    case "screening":
      return "初筛";
    case "editing":
      return "编辑";
    case "proofreading":
      return "校对";
    default:
      return module;
  }
}

export function formatHarnessScopeKindLabel(
  scopeKind: "template_family" | "module",
): string {
  return scopeKind === "template_family" ? "模板族" : "模块";
}

export function formatHarnessExecutionStatusFilterLabel(
  statusFilter: "all" | "running" | "completed" | "failed" | "queued",
  count: number,
): string {
  switch (statusFilter) {
    case "all":
      return `全部 (${count})`;
    case "running":
      return `运行中 (${count})`;
    case "completed":
      return `已完成 (${count})`;
    case "failed":
      return `失败 (${count})`;
    case "queued":
      return `排队中 (${count})`;
  }
}

export function formatHarnessNarrative(text: string): string {
  switch (text) {
    case "All run items passed hard gates and completed scoring without recorded regressions.":
      return "所有运行条目均通过硬门限并完成评分，未记录回归。";
    case "Run scoring is incomplete, so human review is required before any recommendation.":
      return "当前运行评分尚未完整，需先完成人工复核后才能给出建议。";
    case "No weighted scores were recorded.":
      return "当前没有已记录的加权评分。";
    case "No explicit regression failures were recorded.":
      return "当前没有已记录的明确回归失败。";
    case "Evidence-linked routing governance draft.":
      return "与证据关联的路由治理草稿。";
    default:
      return text;
  }
}
