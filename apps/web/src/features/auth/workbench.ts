import type { AuthRole } from "./roles.ts";

export type WorkbenchId =
  | "submission"
  | "screening"
  | "editing"
  | "proofreading"
  | "knowledge-review"
  | "learning-review"
  | "admin-console"
  | "evaluation-workbench"
  | "harness-datasets"
  | "template-governance"
  | "system-settings";

export type WorkbenchSurface = "web" | "mini_program";
export type WorkbenchPlacement = "primary" | "secondary" | "admin";
export type WorkbenchNavGroup = "general" | "mainline" | "knowledge" | "governance";

export interface WorkbenchEntry {
  id: WorkbenchId;
  label: string;
  navLabel: string;
  navGroup: WorkbenchNavGroup;
  placement: WorkbenchPlacement;
  surfaces: readonly WorkbenchSurface[];
  roles: readonly AuthRole[];
}

export const WORKBENCH_ENTRIES: readonly WorkbenchEntry[] = [
  {
    id: "submission",
    label: "My Manuscripts",
    navLabel: "我的稿件",
    navGroup: "general",
    placement: "primary",
    surfaces: ["web"],
    roles: ["user"],
  },
  {
    id: "screening",
    label: "Screening",
    navLabel: "初筛",
    navGroup: "mainline",
    placement: "primary",
    surfaces: ["web"],
    roles: ["admin", "screener"],
  },
  {
    id: "editing",
    label: "Editing",
    navLabel: "编辑",
    navGroup: "mainline",
    placement: "primary",
    surfaces: ["web"],
    roles: ["admin", "editor"],
  },
  {
    id: "proofreading",
    label: "Proofreading",
    navLabel: "校对",
    navGroup: "mainline",
    placement: "primary",
    surfaces: ["web"],
    roles: ["admin", "proofreader"],
  },
  {
    id: "knowledge-review",
    label: "Knowledge Review",
    navLabel: "知识审核",
    navGroup: "knowledge",
    placement: "primary",
    surfaces: ["web", "mini_program"],
    roles: ["admin", "knowledge_reviewer"],
  },
  {
    id: "learning-review",
    label: "Learning Review",
    navLabel: "学习复核",
    navGroup: "knowledge",
    placement: "secondary",
    surfaces: ["web"],
    roles: ["admin", "knowledge_reviewer"],
  },
  {
    id: "admin-console",
    label: "Admin Console",
    navLabel: "管理控制台",
    navGroup: "governance",
    placement: "admin",
    surfaces: ["web"],
    roles: ["admin"],
  },
  {
    id: "evaluation-workbench",
    label: "Evaluation Workbench",
    navLabel: "评测工作台",
    navGroup: "governance",
    placement: "admin",
    surfaces: ["web"],
    roles: ["admin"],
  },
  {
    id: "harness-datasets",
    label: "Harness Datasets",
    navLabel: "数据集",
    navGroup: "governance",
    placement: "admin",
    surfaces: ["web"],
    roles: ["admin"],
  },
  {
    id: "template-governance",
    label: "Template Governance",
    navLabel: "模板治理",
    navGroup: "governance",
    placement: "admin",
    surfaces: ["web"],
    roles: ["admin"],
  },
  {
    id: "system-settings",
    label: "System Settings",
    navLabel: "系统设置",
    navGroup: "governance",
    placement: "admin",
    surfaces: ["web"],
    roles: ["admin"],
  },
] as const;

export const ROLE_WORKBENCHES: Record<AuthRole, readonly WorkbenchId[]> = {
  admin: [
    "screening",
    "editing",
    "proofreading",
    "knowledge-review",
    "learning-review",
    "admin-console",
    "evaluation-workbench",
    "harness-datasets",
    "template-governance",
    "system-settings",
  ],
  screener: ["screening"],
  editor: ["editing"],
  proofreader: ["proofreading"],
  knowledge_reviewer: ["knowledge-review", "learning-review"],
  user: ["submission"],
};

export const DEFAULT_WORKBENCH_BY_ROLE: Record<AuthRole, WorkbenchId> = {
  admin: "screening",
  screener: "screening",
  editor: "editing",
  proofreader: "proofreading",
  knowledge_reviewer: "knowledge-review",
  user: "submission",
};

export function listWorkbenchesForRole(
  role: AuthRole,
  surface: WorkbenchSurface = "web",
): readonly WorkbenchEntry[] {
  const allowedIds = new Set(ROLE_WORKBENCHES[role]);
  return WORKBENCH_ENTRIES.filter(
    (entry) =>
      allowedIds.has(entry.id) &&
      entry.roles.includes(role) &&
      entry.surfaces.includes(surface),
  );
}
