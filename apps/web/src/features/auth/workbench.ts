import type { AuthRole } from "./roles.ts";

export type WorkbenchId =
  | "submission"
  | "screening"
  | "editing"
  | "proofreading"
  | "knowledge-library"
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

export type WorkbenchSettingsSection = "ai-access" | "accounts";
export type WorkbenchHarnessSection = "overview" | "runs" | "datasets";
export type WorkbenchShellGroupId =
  | "home"
  | "core-process"
  | "collaboration-recovery"
  | "management";

export interface WorkbenchEntry {
  id: WorkbenchId;
  label: string;
  navLabel: string;
  navGroup: WorkbenchNavGroup;
  placement: WorkbenchPlacement;
  surfaces: readonly WorkbenchSurface[];
  roles: readonly AuthRole[];
}

export interface WorkbenchShellTargetDescriptor {
  key: string;
  workbenchId: WorkbenchId;
  label: string;
  description: string;
  group: WorkbenchShellGroupId;
  settingsSection?: WorkbenchSettingsSection;
  harnessSection?: WorkbenchHarnessSection;
}

export const WORKBENCH_ENTRIES: readonly WorkbenchEntry[] = [
  {
    id: "submission",
    label: "我的稿件",
    navLabel: "我的稿件",
    navGroup: "general",
    placement: "primary",
    surfaces: ["web"],
    roles: ["user"],
  },
  {
    id: "screening",
    label: "初筛",
    navLabel: "初筛",
    navGroup: "mainline",
    placement: "primary",
    surfaces: ["web"],
    roles: ["admin", "screener"],
  },
  {
    id: "editing",
    label: "编辑",
    navLabel: "编辑",
    navGroup: "mainline",
    placement: "primary",
    surfaces: ["web"],
    roles: ["admin", "editor"],
  },
  {
    id: "proofreading",
    label: "校对",
    navLabel: "校对",
    navGroup: "mainline",
    placement: "primary",
    surfaces: ["web"],
    roles: ["admin", "proofreader"],
  },
  {
    id: "knowledge-library",
    label: "知识库",
    navLabel: "知识库",
    navGroup: "knowledge",
    placement: "primary",
    surfaces: ["web"],
    roles: ["admin", "knowledge_reviewer"],
  },
  {
    id: "knowledge-review",
    label: "知识审核",
    navLabel: "知识审核",
    navGroup: "knowledge",
    placement: "secondary",
    surfaces: ["web", "mini_program"],
    roles: ["admin", "knowledge_reviewer"],
  },
  {
    id: "learning-review",
    label: "质量优化",
    navLabel: "质量优化",
    navGroup: "knowledge",
    placement: "secondary",
    surfaces: ["web"],
    roles: ["admin", "knowledge_reviewer"],
  },
  {
    id: "admin-console",
    label: "管理总览",
    navLabel: "管理总览",
    navGroup: "governance",
    placement: "admin",
    surfaces: ["web"],
    roles: ["admin"],
  },
  {
    id: "evaluation-workbench",
    label: "Harness 控制",
    navLabel: "Harness 控制",
    navGroup: "governance",
    placement: "admin",
    surfaces: ["web"],
    roles: ["admin"],
  },
  {
    id: "harness-datasets",
    label: "Harness 数据集",
    navLabel: "Harness 数据集",
    navGroup: "governance",
    placement: "admin",
    surfaces: ["web"],
    roles: ["admin"],
  },
  {
    id: "template-governance",
    label: "规则中心",
    navLabel: "规则中心",
    navGroup: "governance",
    placement: "admin",
    surfaces: ["web"],
    roles: ["admin", "knowledge_reviewer"],
  },
  {
    id: "system-settings",
    label: "系统设置",
    navLabel: "系统设置",
    navGroup: "governance",
    placement: "admin",
    surfaces: ["web"],
    roles: ["admin"],
  },
] as const;

export const WORKBENCH_SHELL_TARGETS: readonly WorkbenchShellTargetDescriptor[] = [
  {
    key: "home-submission",
    workbenchId: "submission",
    label: "我的稿件",
    description: "稿件上传、进度与个人任务入口",
    group: "home",
  },
  {
    key: "core-screening",
    workbenchId: "screening",
    label: "初筛",
    description: "来稿接收与质控判断",
    group: "core-process",
  },
  {
    key: "core-editing",
    workbenchId: "editing",
    label: "编辑",
    description: "正文修订与模板落位",
    group: "core-process",
  },
  {
    key: "core-proofreading",
    workbenchId: "proofreading",
    label: "校对",
    description: "终稿核验与发布前收口",
    group: "core-process",
  },
  {
    key: "core-knowledge-library",
    workbenchId: "knowledge-library",
    label: "知识库",
    description: "知识资产录入、修订与治理",
    group: "core-process",
  },
  {
    key: "support-knowledge-review",
    workbenchId: "knowledge-review",
    label: "知识审核",
    description: "知识审核队列与审批动作",
    group: "collaboration-recovery",
  },
  {
    key: "support-rule-center",
    workbenchId: "template-governance",
    label: "规则中心",
    description: "规则台账、回流候选与规则包协作入口",
    group: "collaboration-recovery",
  },
  {
    key: "management-overview",
    workbenchId: "admin-console",
    label: "管理总览",
    description: "运营概览与全局治理",
    group: "management",
  },
  {
    key: "management-ai-access",
    workbenchId: "system-settings",
    label: "AI 接入",
    description: "模型、密钥与接入策略",
    group: "management",
    settingsSection: "ai-access",
  },
  {
    key: "management-accounts",
    workbenchId: "system-settings",
    label: "账号与权限",
    description: "账号、角色与访问策略",
    group: "management",
    settingsSection: "accounts",
  },
  {
    key: "management-harness",
    workbenchId: "evaluation-workbench",
    label: "Harness 控制",
    description: "Harness 概览与执行控制",
    group: "management",
    harnessSection: "overview",
  },
] as const;

export const ROLE_WORKBENCHES: Record<AuthRole, readonly WorkbenchId[]> = {
  admin: [
    "screening",
    "editing",
    "proofreading",
    "knowledge-library",
    "knowledge-review",
    "admin-console",
    "evaluation-workbench",
    "harness-datasets",
    "template-governance",
    "system-settings",
  ],
  screener: ["screening"],
  editor: ["editing"],
  proofreader: ["proofreading"],
  knowledge_reviewer: ["knowledge-library", "knowledge-review", "template-governance"],
  user: ["submission"],
};

export const DEFAULT_WORKBENCH_BY_ROLE: Record<AuthRole, WorkbenchId> = {
  admin: "screening",
  screener: "screening",
  editor: "editing",
  proofreader: "proofreading",
  knowledge_reviewer: "knowledge-library",
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
