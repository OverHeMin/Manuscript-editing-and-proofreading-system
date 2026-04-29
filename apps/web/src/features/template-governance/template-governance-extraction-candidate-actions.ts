import type { ExtractionTaskCandidateViewModel } from "../editorial-rules/index.ts";
import type { GovernedContentModuleClass } from "../templates/index.ts";
import type { TemplateGovernanceCandidateConfirmationFormValues } from "./template-governance-candidate-confirmation-form.tsx";
import type {
  TemplateGovernanceExtractionLedgerViewModel,
  TemplateGovernanceWorkbenchController,
} from "./template-governance-controller.ts";
import {
  createContentModuleIntakePayload,
  createTemplateIntakePayload,
  readExtractionCandidateIntakeRecord,
} from "./template-governance-extraction-intake.ts";
import { formatTemplateGovernanceExtractionDestinationLabel } from "./template-governance-display.ts";

export async function executeExtractionCandidateAction(input: {
  controller: Pick<
    TemplateGovernanceWorkbenchController,
    | "updateExtractionTaskCandidateAndReload"
    | "createContentModuleDraftFromCandidateAndReload"
    | "createTemplateCompositionDraftFromCandidateAndReload"
  >;
  taskId: string;
  candidate: ExtractionTaskCandidateViewModel;
  values: TemplateGovernanceCandidateConfirmationFormValues;
  confirmationStatus: TemplateGovernanceCandidateConfirmationFormValues["confirmationStatus"];
  successMessage: string;
}): Promise<{
  ledger: TemplateGovernanceExtractionLedgerViewModel;
  statusMessage?: string;
  errorMessage?: string;
}> {
  const confirmed = await input.controller.updateExtractionTaskCandidateAndReload({
    taskId: input.taskId,
    candidateId: input.candidate.id,
    input: toCandidateUpdateInput(
      input.candidate,
      input.values,
      input.confirmationStatus,
    ),
  });

  if (input.confirmationStatus !== "confirmed") {
    return {
      ledger: confirmed.ledger,
      statusMessage: input.successMessage,
    };
  }

  const confirmedCandidate =
    selectExtractionCandidate(confirmed.ledger, input.candidate.id) ?? input.candidate;
  const existingIntake = readExtractionCandidateIntakeRecord(confirmedCandidate);
  if (existingIntake) {
    return {
      ledger: confirmed.ledger,
      statusMessage: `候选语义已更新，当前已关联${formatExtractionIntakeDraftLabel(existingIntake.target_kind)}草稿：${existingIntake.target_name}。`,
    };
  }

  if (input.values.suggestedDestination === "template") {
    const { templateComposition } =
      await input.controller.createTemplateCompositionDraftFromCandidateAndReload({
        taskId: input.taskId,
        candidateId: input.candidate.id,
      });
    const { ledger } = await input.controller.updateExtractionTaskCandidateAndReload({
      taskId: input.taskId,
      candidateId: input.candidate.id,
      input: {
        intakePayload: createTemplateIntakePayload(templateComposition),
      },
    });
    return {
      ledger,
      statusMessage: `候选已确认，并已入库到大模板草稿：${templateComposition.name}。`,
    };
  }

  const moduleClass: GovernedContentModuleClass =
    input.values.suggestedDestination === "medical_module"
      ? "medical_specialized"
      : "general";
  const { contentModule } =
    await input.controller.createContentModuleDraftFromCandidateAndReload({
      taskId: input.taskId,
      candidateId: input.candidate.id,
      moduleClass,
    });
  const { ledger } = await input.controller.updateExtractionTaskCandidateAndReload({
    taskId: input.taskId,
    candidateId: input.candidate.id,
    input: {
      intakePayload: createContentModuleIntakePayload(contentModule),
    },
  });
  return {
    ledger,
    statusMessage: `候选已确认，并已入库到${formatExtractionIntakeDraftLabel(
      input.values.suggestedDestination,
    )}草稿：${contentModule.name}。`,
  };
}

function selectExtractionCandidate(
  ledger: TemplateGovernanceExtractionLedgerViewModel,
  selectedCandidateId: string | null,
): ExtractionTaskCandidateViewModel | null {
  const candidates = ledger.selectedTask?.candidates ?? [];
  if (selectedCandidateId) {
    const selectedCandidate = candidates.find(
      (candidate) => candidate.id === selectedCandidateId,
    );
    if (selectedCandidate) {
      return selectedCandidate;
    }
  }

  return candidates[0] ?? null;
}

function toCandidateUpdateInput(
  candidate: ExtractionTaskCandidateViewModel,
  values: TemplateGovernanceCandidateConfirmationFormValues,
  confirmationStatus: TemplateGovernanceCandidateConfirmationFormValues["confirmationStatus"],
) {
  return {
    confirmationStatus,
    suggestedDestination: values.suggestedDestination,
    semanticDraftPayload: {
      ...candidate.semantic_draft_payload,
      semantic_summary: values.semanticSummary.trim(),
      applicability: parseStringList(values.applicability),
    },
  };
}

function parseStringList(value: string): string[] {
  return value
    .split(/[,\n]/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatExtractionIntakeDraftLabel(
  value: "general_module" | "medical_module" | "template",
): string {
  switch (value) {
    case "general_module":
      return "通用包";
    case "medical_module":
      return "医学专用包";
    case "template":
      return "大模板";
    default:
      return formatTemplateGovernanceExtractionDestinationLabel(value);
  }
}
