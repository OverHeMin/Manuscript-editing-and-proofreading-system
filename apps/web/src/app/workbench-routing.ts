import type { WorkbenchId } from "../features/auth/index.ts";
import type { ManuscriptWorkbenchMode } from "../features/manuscript-workbench/manuscript-workbench-controller.ts";

export type WorkbenchRenderKind =
  | "manuscript-workbench"
  | "knowledge-library"
  | "knowledge-review"
  | "learning-review"
  | "admin-governance"
  | "evaluation-workbench"
  | "harness-datasets"
  | "template-governance"
  | "system-settings"
  | "placeholder";

export type RuleCenterMode = "authoring" | "learning";

export interface WorkbenchLocation {
  workbenchId: WorkbenchId | null;
  manuscriptId?: string;
  knowledgeItemId?: string;
  assetId?: string;
  revisionId?: string;
  reviewedCaseSnapshotId?: string;
  sampleSetItemId?: string;
  ruleCenterMode?: RuleCenterMode;
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

  if (workbenchId === "knowledge-library") {
    return "knowledge-library";
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

  if (workbenchId === "harness-datasets") {
    return "harness-datasets";
  }

  if (workbenchId === "template-governance") {
    return "template-governance";
  }

  if (workbenchId === "evaluation-workbench") {
    return "evaluation-workbench";
  }

  if (workbenchId === "system-settings") {
    return "system-settings";
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
        assetId?: string;
        revisionId?: string;
        reviewedCaseSnapshotId?: string;
        sampleSetItemId?: string;
        ruleCenterMode?: RuleCenterMode;
      },
): string {
  const params = new URLSearchParams();
  const manuscriptId =
    typeof handoff === "string" ? handoff : handoff?.manuscriptId;
  const knowledgeItemId =
    typeof handoff === "string" ? undefined : handoff?.knowledgeItemId;
  const assetId = typeof handoff === "string" ? undefined : handoff?.assetId;
  const revisionId =
    typeof handoff === "string" ? undefined : handoff?.revisionId;
  const reviewedCaseSnapshotId =
    typeof handoff === "string" ? undefined : handoff?.reviewedCaseSnapshotId;
  const sampleSetItemId =
    typeof handoff === "string" ? undefined : handoff?.sampleSetItemId;
  const ruleCenterMode =
    typeof handoff === "string" ? undefined : handoff?.ruleCenterMode;

  if (manuscriptId && manuscriptId.trim().length > 0) {
    params.set("manuscriptId", manuscriptId.trim());
  }

  if (knowledgeItemId && knowledgeItemId.trim().length > 0) {
    params.set("knowledgeItemId", knowledgeItemId.trim());
  }

  if (assetId && assetId.trim().length > 0) {
    params.set("assetId", assetId.trim());
  }

  if (revisionId && revisionId.trim().length > 0) {
    params.set("revisionId", revisionId.trim());
  }

  if (reviewedCaseSnapshotId && reviewedCaseSnapshotId.trim().length > 0) {
    params.set("reviewedCaseSnapshotId", reviewedCaseSnapshotId.trim());
  }

  if (sampleSetItemId && sampleSetItemId.trim().length > 0) {
    params.set("sampleSetItemId", sampleSetItemId.trim());
  }

  if (ruleCenterMode) {
    params.set("ruleCenterMode", ruleCenterMode);
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
  const assetId = params.get("assetId")?.trim();
  const revisionId = params.get("revisionId")?.trim();
  const reviewedCaseSnapshotId = params.get("reviewedCaseSnapshotId")?.trim();
  const sampleSetItemId = params.get("sampleSetItemId")?.trim();
  const ruleCenterMode = normalizeRuleCenterMode(params.get("ruleCenterMode"));

  return {
    workbenchId: rawWorkbenchId,
    ...(manuscriptId && manuscriptId.length > 0 ? { manuscriptId } : {}),
    ...(knowledgeItemId && knowledgeItemId.length > 0 ? { knowledgeItemId } : {}),
    ...(assetId && assetId.length > 0 ? { assetId } : {}),
    ...(revisionId && revisionId.length > 0 ? { revisionId } : {}),
    ...(reviewedCaseSnapshotId && reviewedCaseSnapshotId.length > 0
      ? { reviewedCaseSnapshotId }
      : {}),
    ...(sampleSetItemId && sampleSetItemId.length > 0 ? { sampleSetItemId } : {}),
    ...(ruleCenterMode ? { ruleCenterMode } : {}),
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

function normalizeRuleCenterMode(value: string | null): RuleCenterMode | undefined {
  if (value === "authoring" || value === "learning") {
    return value;
  }

  return undefined;
}

function isWorkbenchId(value: string): value is WorkbenchId {
  return (
    value === "submission" ||
    value === "screening" ||
    value === "editing" ||
    value === "proofreading" ||
    value === "knowledge-library" ||
    value === "knowledge-review" ||
    value === "learning-review" ||
    value === "admin-console" ||
    value === "evaluation-workbench" ||
    value === "harness-datasets" ||
    value === "template-governance" ||
    value === "system-settings"
  );
}
