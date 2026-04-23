import type { ExtractionTaskCandidateViewModel } from "../editorial-rules/index.ts";
import type {
  GovernedContentModuleViewModel,
  TemplateCompositionViewModel,
} from "../templates/index.ts";

export type ExtractionCandidateIntakeTargetKind =
  | "general_module"
  | "medical_module"
  | "template";

export interface ExtractionCandidateIntakeRecord extends Record<string, unknown> {
  target_kind: ExtractionCandidateIntakeTargetKind;
  target_id: string;
  target_name: string;
  target_status?: string;
}

export function readExtractionCandidateIntakeRecord(
  candidate: Pick<ExtractionTaskCandidateViewModel, "intake_payload">,
): ExtractionCandidateIntakeRecord | null {
  return parseExtractionCandidateIntakeRecord(candidate.intake_payload);
}

export function createContentModuleIntakePayload(
  module: Pick<GovernedContentModuleViewModel, "id" | "name" | "status" | "module_class">,
): ExtractionCandidateIntakeRecord {
  return {
    target_kind:
      module.module_class === "medical_specialized"
        ? "medical_module"
        : "general_module",
    target_id: module.id,
    target_name: module.name,
    target_status: module.status,
  };
}

export function createTemplateIntakePayload(
  template: Pick<TemplateCompositionViewModel, "id" | "name" | "status">,
): ExtractionCandidateIntakeRecord {
  return {
    target_kind: "template",
    target_id: template.id,
    target_name: template.name,
    target_status: template.status,
  };
}

function parseExtractionCandidateIntakeRecord(
  value: Record<string, unknown> | undefined,
): ExtractionCandidateIntakeRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const targetKind = readOptionalString(value.target_kind);
  const targetId = readOptionalString(value.target_id);
  const targetName = readOptionalString(value.target_name);
  const targetStatus = readOptionalString(value.target_status);

  if (
    !targetKind ||
    !targetId ||
    !targetName ||
    (targetKind !== "general_module" &&
      targetKind !== "medical_module" &&
      targetKind !== "template")
  ) {
    return null;
  }

  return {
    target_kind: targetKind,
    target_id: targetId,
    target_name: targetName,
    ...(targetStatus ? { target_status: targetStatus } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}
