import type { WorkbenchId } from "../features/auth/index.ts";
import type { ManuscriptWorkbenchMode } from "../features/manuscript-workbench/manuscript-workbench-controller.ts";

export type WorkbenchRenderKind =
  | "manuscript-workbench"
  | "knowledge-review"
  | "learning-review"
  | "admin-governance"
  | "evaluation-workbench"
  | "template-governance"
  | "placeholder";

export interface WorkbenchLocation {
  workbenchId: WorkbenchId | null;
  manuscriptId?: string;
  knowledgeItemId?: string;
}

export function resolveWorkbenchRenderKind(
  workbenchId: WorkbenchId | null | undefined,
): WorkbenchRenderKind {
  if (
    workbenchId === "submission" ||
    workbenchId === "screening" ||
    workbenchId === "editing" ||
    workbenchId === "proofreading"
  ) {
    return "manuscript-workbench";
  }

  if (workbenchId === "knowledge-review") {
    return "knowledge-review";
  }

  if (workbenchId === "learning-review") {
    return "learning-review";
  }

  if (workbenchId === "admin-console") {
    return "admin-governance";
  }

  if (workbenchId === "template-governance") {
    return "template-governance";
  }

  if (workbenchId === "evaluation-workbench") {
    return "evaluation-workbench";
  }

  return "placeholder";
}

export function isWorkbenchImplemented(
  workbenchId: WorkbenchId | null | undefined,
): boolean {
  return resolveWorkbenchRenderKind(workbenchId) !== "placeholder";
}

export function formatWorkbenchHash(
  workbenchId: WorkbenchId,
  handoff?:
    | string
    | {
        manuscriptId?: string;
        knowledgeItemId?: string;
      },
): string {
  const params = new URLSearchParams();
  const manuscriptId =
    typeof handoff === "string" ? handoff : handoff?.manuscriptId;
  const knowledgeItemId =
    typeof handoff === "string" ? undefined : handoff?.knowledgeItemId;

  if (manuscriptId && manuscriptId.trim().length > 0) {
    params.set("manuscriptId", manuscriptId.trim());
  }

  if (knowledgeItemId && knowledgeItemId.trim().length > 0) {
    params.set("knowledgeItemId", knowledgeItemId.trim());
  }

  const query = params.toString();
  return `#${workbenchId}${query ? `?${query}` : ""}`;
}

export function resolveWorkbenchLocation(hash: string): WorkbenchLocation {
  const normalized = hash.startsWith("#") ? hash.slice(1) : hash;
  if (normalized.trim().length === 0) {
    return {
      workbenchId: null,
    };
  }

  const [rawWorkbenchId, rawQuery = ""] = normalized.split("?", 2);
  if (!isWorkbenchId(rawWorkbenchId)) {
    return {
      workbenchId: null,
    };
  }

  const params = new URLSearchParams(rawQuery);
  const manuscriptId = params.get("manuscriptId")?.trim();
  const knowledgeItemId = params.get("knowledgeItemId")?.trim();

  return {
    workbenchId: rawWorkbenchId,
    ...(manuscriptId && manuscriptId.length > 0 ? { manuscriptId } : {}),
    ...(knowledgeItemId && knowledgeItemId.length > 0 ? { knowledgeItemId } : {}),
  };
}

export function isManuscriptWorkbenchId(
  workbenchId: WorkbenchId | null | undefined,
): workbenchId is ManuscriptWorkbenchMode {
  return (
    workbenchId === "submission" ||
    workbenchId === "screening" ||
    workbenchId === "editing" ||
    workbenchId === "proofreading"
  );
}

function isWorkbenchId(value: string): value is WorkbenchId {
  return (
    value === "submission" ||
    value === "screening" ||
    value === "editing" ||
    value === "proofreading" ||
    value === "knowledge-review" ||
    value === "learning-review" ||
    value === "admin-console" ||
    value === "evaluation-workbench" ||
    value === "template-governance" ||
    value === "system-settings"
  );
}
