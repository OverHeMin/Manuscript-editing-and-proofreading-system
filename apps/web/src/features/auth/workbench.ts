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

export interface WorkbenchEntry {
  id: WorkbenchId;
  label: string;
  placement: WorkbenchPlacement;
  surfaces: readonly WorkbenchSurface[];
  roles: readonly AuthRole[];
}

export const WORKBENCH_ENTRIES: readonly WorkbenchEntry[] = [
  {
    id: "submission",
    label: "My Manuscripts",
    placement: "primary",
    surfaces: ["web"],
    roles: ["user"],
  },
  {
    id: "screening",
    label: "Screening",
    placement: "primary",
    surfaces: ["web"],
    roles: ["admin", "screener"],
  },
  {
    id: "editing",
    label: "Editing",
    placement: "primary",
    surfaces: ["web"],
    roles: ["admin", "editor"],
  },
  {
    id: "proofreading",
    label: "Proofreading",
    placement: "primary",
    surfaces: ["web"],
    roles: ["admin", "proofreader"],
  },
  {
    id: "knowledge-review",
    label: "Knowledge Review",
    placement: "primary",
    surfaces: ["web", "mini_program"],
    roles: ["admin", "knowledge_reviewer"],
  },
  {
    id: "learning-review",
    label: "Learning Review",
    placement: "secondary",
    surfaces: ["web"],
    roles: ["admin", "knowledge_reviewer"],
  },
  {
    id: "admin-console",
    label: "Admin Console",
    placement: "admin",
    surfaces: ["web"],
    roles: ["admin"],
  },
  {
    id: "evaluation-workbench",
    label: "Evaluation Workbench",
    placement: "admin",
    surfaces: ["web"],
    roles: ["admin"],
  },
  {
    id: "harness-datasets",
    label: "Harness Datasets",
    placement: "admin",
    surfaces: ["web"],
    roles: ["admin"],
  },
  {
    id: "template-governance",
    label: "Template Governance",
    placement: "admin",
    surfaces: ["web"],
    roles: ["admin"],
  },
  {
    id: "system-settings",
    label: "System Settings",
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
  admin: "admin-console",
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
