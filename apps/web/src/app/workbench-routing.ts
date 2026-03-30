import type { WorkbenchId } from "../features/auth/index.ts";

export type WorkbenchRenderKind =
  | "knowledge-review"
  | "learning-review"
  | "admin-governance"
  | "placeholder";

export function resolveWorkbenchRenderKind(
  workbenchId: WorkbenchId | null | undefined,
): WorkbenchRenderKind {
  if (workbenchId === "knowledge-review") {
    return "knowledge-review";
  }

  if (workbenchId === "learning-review") {
    return "learning-review";
  }

  if (workbenchId === "admin-console" || workbenchId === "template-governance") {
    return "admin-governance";
  }

  return "placeholder";
}

export function isWorkbenchImplemented(
  workbenchId: WorkbenchId | null | undefined,
): boolean {
  return resolveWorkbenchRenderKind(workbenchId) !== "placeholder";
}
