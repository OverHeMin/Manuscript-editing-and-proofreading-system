import {
  WORKBENCH_SHELL_TARGETS,
  type WorkbenchEntry,
  type WorkbenchHarnessSection,
  type WorkbenchId,
  type WorkbenchSettingsSection,
  type WorkbenchShellTargetDescriptor,
} from "../features/auth/index.ts";

export type WorkbenchNavigationGroupId =
  | "general"
  | "core-workbench"
  | "supporting-workbench"
  | "governance";

export type WorkbenchNavigationItemEmphasis = "core" | "supporting" | "secondary";

export interface WorkbenchNavigationTarget {
  workbenchId: WorkbenchId;
  settingsSection?: WorkbenchSettingsSection;
  harnessSection?: WorkbenchHarnessSection;
}

export interface WorkbenchNavigationItem {
  key: string;
  id: WorkbenchId;
  label: string;
  description: string;
  emphasis: WorkbenchNavigationItemEmphasis;
  entry: WorkbenchEntry;
  target: WorkbenchNavigationTarget;
  targetKey: string;
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
    label: "首页",
    description: "个人工作入口与稿件处理进度",
    prominence: "supporting",
  },
  "core-workbench": {
    label: "核心流程",
    description: "初筛、编辑、校对与知识库主线协同",
    prominence: "primary",
  },
  "supporting-workbench": {
    label: "协作与回收区",
    description: "知识审核与规则中心协作入口",
    prominence: "supporting",
  },
  governance: {
    label: "管理区",
    description: "面向管理侧的总览、接入与控制入口",
    prominence: "secondary",
  },
};

const GROUP_TARGETS: Record<
  WorkbenchNavigationGroupId,
  readonly WorkbenchShellTargetDescriptor[]
> = {
  general: WORKBENCH_SHELL_TARGETS.filter((target) => target.group === "home"),
  "core-workbench": WORKBENCH_SHELL_TARGETS.filter(
    (target) => target.group === "core-process",
  ),
  "supporting-workbench": WORKBENCH_SHELL_TARGETS.filter(
    (target) => target.group === "collaboration-recovery",
  ),
  governance: WORKBENCH_SHELL_TARGETS.filter((target) => target.group === "management"),
};

const GROUP_ORDER: readonly WorkbenchNavigationGroupId[] = [
  "general",
  "core-workbench",
  "supporting-workbench",
  "governance",
];

export function buildWorkbenchNavigationGroups(
  entries: readonly WorkbenchEntry[],
): WorkbenchNavigationGroup[] {
  if (entries.length === 0) {
    return [];
  }

  const entryMap = new Map(entries.map((entry) => [entry.id, entry]));
  const groups: WorkbenchNavigationGroup[] = [];

  for (const groupId of GROUP_ORDER) {
    const items = GROUP_TARGETS[groupId].flatMap((target) => {
      const entry = entryMap.get(target.workbenchId);
      if (!entry) {
        return [];
      }

      return [buildNavigationItem(entry, target, resolveGroupEmphasis(groupId))];
    });

    if (items.length > 0) {
      groups.push({
        id: groupId,
        label: GROUP_META[groupId].label,
        description: GROUP_META[groupId].description,
        prominence: GROUP_META[groupId].prominence,
        items,
      });
    }
  }

  return groups;
}

export function getWorkbenchNavigationTargetKey(
  target: WorkbenchNavigationTarget,
): string {
  const params = new URLSearchParams();
  if (target.settingsSection) {
    params.set("settingsSection", target.settingsSection);
  }
  if (target.harnessSection) {
    params.set("harnessSection", target.harnessSection);
  }

  const query = params.toString();
  return `${target.workbenchId}${query ? `?${query}` : ""}`;
}

function resolveGroupEmphasis(
  groupId: WorkbenchNavigationGroupId,
): WorkbenchNavigationItemEmphasis {
  if (groupId === "core-workbench") {
    return "core";
  }

  return groupId === "governance" ? "secondary" : "supporting";
}

function buildNavigationItem(
  entry: WorkbenchEntry,
  target: WorkbenchShellTargetDescriptor,
  emphasis: WorkbenchNavigationItemEmphasis,
): WorkbenchNavigationItem {
  const navigationTarget: WorkbenchNavigationTarget = {
    workbenchId: target.workbenchId,
    settingsSection: target.settingsSection,
    harnessSection: target.harnessSection,
  };

  return {
    key: target.key,
    id: target.workbenchId,
    label: target.label,
    description: target.description,
    emphasis,
    entry,
    target: navigationTarget,
    targetKey: getWorkbenchNavigationTargetKey(navigationTarget),
  };
}
