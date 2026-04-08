import type {
  WorkbenchEntry,
  WorkbenchId,
  WorkbenchNavGroup,
} from "../features/auth/index.ts";

export type WorkbenchNavigationGroupId =
  | WorkbenchNavGroup
  | "core-workbench"
  | "supporting-workbench";

export type WorkbenchNavigationItemEmphasis = "core" | "supporting" | "secondary";

export interface WorkbenchNavigationItem {
  id: WorkbenchId;
  label: string;
  description: string;
  emphasis: WorkbenchNavigationItemEmphasis;
  entry: WorkbenchEntry;
}

export type WorkbenchNavigationProminence = "primary" | "supporting" | "secondary";

export interface WorkbenchNavigationGroup {
  id: WorkbenchNavigationGroupId;
  label: string;
  description: string;
  prominence: WorkbenchNavigationProminence;
  items: WorkbenchNavigationItem[];
}

const GROUP_META: Record<
  WorkbenchNavigationGroupId,
  {
    label: string;
    description: string;
    prominence: WorkbenchNavigationProminence;
  }
> = {
  general: {
    label: "我的工作",
    description: "个人稿件入口与处理进度",
    prominence: "supporting",
  },
  mainline: {
    label: "主工作线",
    description: "聚焦稿件处理主流程",
    prominence: "primary",
  },
  knowledge: {
    label: "知识治理",
    description: "连接知识库、知识审核与学习回收",
    prominence: "primary",
  },
  "core-workbench": {
    label: "核心工作台",
    description: "突出初筛、编辑、校对与知识库四个核心栏目",
    prominence: "primary",
  },
  "supporting-workbench": {
    label: "协同与回收",
    description: "保留知识审核、学习复核等辅助协同入口",
    prominence: "supporting",
  },
  governance: {
    label: "管理区",
    description: "管理员可见的治理与配置面板",
    prominence: "secondary",
  },
};

const CORE_WORKBENCH_ORDER: readonly WorkbenchId[] = [
  "screening",
  "editing",
  "proofreading",
  "knowledge-library",
];

const SUPPORTING_WORKBENCH_ORDER: readonly WorkbenchId[] = [
  "knowledge-review",
  "learning-review",
  "submission",
];

const GOVERNANCE_WORKBENCH_ORDER: readonly WorkbenchId[] = [
  "admin-console",
  "template-governance",
  "evaluation-workbench",
  "harness-datasets",
  "system-settings",
];

export function buildWorkbenchNavigationGroups(
  entries: readonly WorkbenchEntry[],
): WorkbenchNavigationGroup[] {
  if (entries.length === 0) {
    return [];
  }

  const navigationEntries = filterNavigationEntries(entries);
  const entryMap = new Map(navigationEntries.map((entry) => [entry.id, entry]));
  const usedEntryIds = new Set<WorkbenchId>();
  const groups: WorkbenchNavigationGroup[] = [];

  if (navigationEntries.every((entry) => entry.id === "submission")) {
    const generalItems = buildNavigationItems(
      entryMap,
      ["submission"],
      usedEntryIds,
      "supporting",
    );

    return generalItems.length > 0
      ? [
          {
            id: "general",
            label: GROUP_META.general.label,
            description: GROUP_META.general.description,
            prominence: GROUP_META.general.prominence,
            items: generalItems,
          },
        ]
      : [];
  }

  const coreItems = buildNavigationItems(
    entryMap,
    CORE_WORKBENCH_ORDER,
    usedEntryIds,
    "core",
  );
  if (coreItems.length > 0) {
    groups.push({
      id: "core-workbench",
      label: GROUP_META["core-workbench"].label,
      description: GROUP_META["core-workbench"].description,
      prominence: GROUP_META["core-workbench"].prominence,
      items: coreItems,
    });
  }

  const supportingItems = buildNavigationItems(
    entryMap,
    SUPPORTING_WORKBENCH_ORDER,
    usedEntryIds,
    "supporting",
  );
  if (supportingItems.length > 0) {
    groups.push({
      id: "supporting-workbench",
      label: GROUP_META["supporting-workbench"].label,
      description: GROUP_META["supporting-workbench"].description,
      prominence: GROUP_META["supporting-workbench"].prominence,
      items: supportingItems,
    });
  }

  const governanceItems = buildNavigationItems(
    entryMap,
    GOVERNANCE_WORKBENCH_ORDER,
    usedEntryIds,
    "secondary",
  );
  if (governanceItems.length > 0) {
    groups.push({
      id: "governance",
      label: GROUP_META.governance.label,
      description: GROUP_META.governance.description,
      prominence: GROUP_META.governance.prominence,
      items: governanceItems,
    });
  }

  const remainingSupportingItems = navigationEntries
    .filter((entry) => !usedEntryIds.has(entry.id) && entry.placement !== "admin")
    .map((entry) => buildNavigationItem(entry, "supporting"));
  if (remainingSupportingItems.length > 0) {
    groups.push({
      id: "supporting-workbench",
      label: GROUP_META["supporting-workbench"].label,
      description: GROUP_META["supporting-workbench"].description,
      prominence: GROUP_META["supporting-workbench"].prominence,
      items: remainingSupportingItems,
    });
  }

  const remainingGovernanceItems = navigationEntries
    .filter((entry) => !usedEntryIds.has(entry.id) && entry.placement === "admin")
    .map((entry) => buildNavigationItem(entry, "secondary"));
  if (remainingGovernanceItems.length > 0) {
    groups.push({
      id: "governance",
      label: GROUP_META.governance.label,
      description: GROUP_META.governance.description,
      prominence: GROUP_META.governance.prominence,
      items: remainingGovernanceItems,
    });
  }

  return groups;
}

function filterNavigationEntries(entries: readonly WorkbenchEntry[]): WorkbenchEntry[] {
  const shouldHideLearningReview = entries.some(
    (entry) => entry.id === "template-governance",
  );

  return shouldHideLearningReview
    ? entries.filter((entry) => entry.id !== "learning-review")
    : [...entries];
}

function buildNavigationItems(
  entryMap: Map<WorkbenchId, WorkbenchEntry>,
  orderedIds: readonly WorkbenchId[],
  usedEntryIds: Set<WorkbenchId>,
  emphasis: WorkbenchNavigationItemEmphasis,
): WorkbenchNavigationItem[] {
  return orderedIds.flatMap((workbenchId) => {
    const entry = entryMap.get(workbenchId);
    if (!entry) {
      return [];
    }

    usedEntryIds.add(workbenchId);
    return [buildNavigationItem(entry, emphasis)];
  });
}

function buildNavigationItem(
  entry: WorkbenchEntry,
  emphasis: WorkbenchNavigationItemEmphasis,
): WorkbenchNavigationItem {
  return {
    id: entry.id,
    label: resolveNavigationItemLabel(entry),
    description: describeWorkbenchEntry(entry.id),
    emphasis,
    entry,
  };
}

function resolveNavigationItemLabel(entry: WorkbenchEntry): string {
  if (entry.id === "knowledge-library") {
    return "知识库";
  }

  if (entry.id === "knowledge-review") {
    return "知识审核";
  }

  if (entry.id === "template-governance") {
    return "规则中心";
  }

  return entry.navLabel;
}

function describeWorkbenchEntry(workbenchId: WorkbenchId): string {
  switch (workbenchId) {
    case "submission":
      return "稿件上传与处理进度跟踪";
    case "screening":
      return "来稿接收与质控判断";
    case "editing":
      return "正文修订与模板落位";
    case "proofreading":
      return "终稿核验与发布前收口";
    case "knowledge-library":
      return "知识录入、修订治理与结构化绑定";
    case "knowledge-review":
      return "面向 revision 的审核队列与审批动作";
    case "learning-review":
      return "候选回收与经验复核";
    case "admin-console":
      return "运营概览与全局治理";
    case "evaluation-workbench":
      return "评测结果与差异观察";
    case "harness-datasets":
      return "金标准数据与版本导出";
    case "template-governance":
      return "模板、规则与提示词治理";
    case "system-settings":
      return "系统级参数与访问控制";
    default:
      return workbenchId;
  }
}
