import type {
  WorkbenchEntry,
  WorkbenchId,
  WorkbenchNavGroup,
} from "../features/auth/index.ts";

export interface WorkbenchNavigationItem {
  id: WorkbenchId;
  label: string;
  entry: WorkbenchEntry;
}

export interface WorkbenchNavigationGroup {
  id: WorkbenchNavGroup;
  label: string;
  items: WorkbenchNavigationItem[];
}

const GROUP_LABELS: Record<WorkbenchNavGroup, string> = {
  general: "我的工作",
  mainline: "主工作线",
  knowledge: "知识库",
  governance: "管理区",
};

const GROUP_ORDER: WorkbenchNavGroup[] = [
  "general",
  "mainline",
  "knowledge",
  "governance",
];

export function buildWorkbenchNavigationGroups(
  entries: readonly WorkbenchEntry[],
): WorkbenchNavigationGroup[] {
  return GROUP_ORDER.flatMap((groupId) => {
    const items = entries
      .filter((entry) => entry.navGroup === groupId)
      .map((entry) => ({
        id: entry.id,
        label: entry.navLabel,
        entry,
      }));

    if (items.length === 0) {
      return [];
    }

    return [
      {
        id: groupId,
        label: GROUP_LABELS[groupId],
        items,
      },
    ];
  });
}
