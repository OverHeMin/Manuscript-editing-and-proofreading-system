import { BrowserHttpClientError } from "../../lib/browser-http-client.ts";
import type { ManuscriptType } from "../manuscripts/types.ts";
import { EDITORIAL_MANUSCRIPT_TYPE_OPTIONS } from "../shared/editorial-taxonomy.ts";
import type { ExtractionTaskCandidateViewModel } from "../editorial-rules/index.ts";
import type {
  GovernedContentModuleClass,
  GovernedContentModuleViewModel,
  JournalTemplateProfileViewModel,
  RuleEvidenceExampleViewModel,
  TemplateCompositionViewModel,
  TemplateModule,
} from "../templates/index.ts";
import type {
  TemplateGovernanceContentModuleLedgerViewModel,
  TemplateGovernanceTemplateLedgerViewModel,
} from "./template-governance-controller.ts";
import type { TemplateGovernanceCandidateConfirmationFormValues } from "./template-governance-candidate-confirmation-form.tsx";
import type { TemplateGovernanceContentModuleFormValues } from "./template-governance-content-module-form.tsx";
import {
  formatTemplateGovernanceManuscriptTypeLabel,
  formatTemplateGovernanceModuleLabel,
} from "./template-governance-display.ts";
import type { TemplateGovernanceExtractionTaskFormDraft } from "./template-governance-extraction-task-form.tsx";
import type { TemplateGovernanceJournalTemplateFormValues } from "./template-governance-journal-template-form.tsx";
import type { TemplateGovernanceTemplateFormValues } from "./template-governance-template-form.tsx";

const manuscriptTypes: readonly ManuscriptType[] = EDITORIAL_MANUSCRIPT_TYPE_OPTIONS;
const templateModules = ["screening", "editing", "proofreading"] as const;

export function createV2ExtractionTaskDraft(
  manuscriptType: ManuscriptType = "clinical_study",
): TemplateGovernanceExtractionTaskFormDraft {
  return {
    taskName: "",
    manuscriptType,
    journalKey: "",
  };
}

export function createV2CandidateConfirmationFormValues(
  candidate?: ExtractionTaskCandidateViewModel,
): TemplateGovernanceCandidateConfirmationFormValues {
  return {
    semanticSummary: candidate?.semantic_draft_payload.semantic_summary ?? "",
    applicability: candidate?.semantic_draft_payload.applicability.join(", ") ?? "",
    suggestedDestination: candidate?.suggested_destination ?? "template",
    confirmationStatus: candidate?.confirmation_status ?? "ai_semantic_ready",
  };
}

export function createV2ContentModuleFormValues(
  ledgerKind: GovernedContentModuleClass,
): TemplateGovernanceContentModuleFormValues {
  return {
    name: "",
    category: "",
    manuscriptTypeScope: "",
    executionModuleScope: "",
    applicableSections: "",
    summary: "",
    guidance: "",
    examples: "",
    evidenceLevel: "unknown",
    riskLevel: ledgerKind === "medical_specialized" ? "medium" : "medium",
  };
}

export function createV2TemplateFormValues(): TemplateGovernanceTemplateFormValues {
  return {
    name: "",
    manuscriptType: "",
    journalScope: "",
    executionModuleScope: "",
    generalModuleIds: "",
    medicalModuleIds: "",
    notes: "",
  };
}

export function createV2JournalTemplateFormValues(
  templateFamilyId = "",
): TemplateGovernanceJournalTemplateFormValues {
  return {
    templateFamilyId,
    journalName: "",
    journalKey: "",
    targetModel: {
      skeleton: [
        "front_matter",
        "title",
        "abstract",
        "keywords",
        "body",
        "figures_tables",
        "references",
      ],
      target_blocks: [],
    },
  };
}

export function selectV2ExtractionCandidate(
  candidates: readonly ExtractionTaskCandidateViewModel[],
  selectedCandidateId: string | null,
): ExtractionTaskCandidateViewModel | null {
  if (selectedCandidateId) {
    return candidates.find((candidate) => candidate.id === selectedCandidateId) ?? candidates[0] ?? null;
  }

  return candidates[0] ?? null;
}

export function selectV2TemplateComposition(
  ledger: TemplateGovernanceTemplateLedgerViewModel,
  selectedTemplateId: string,
): TemplateGovernanceTemplateLedgerViewModel {
  return {
    ...ledger,
    selectedTemplateId,
    selectedTemplate:
      ledger.templates.find((template) => template.id === selectedTemplateId) ?? null,
  };
}

export function selectV2ContentModule(
  ledger: TemplateGovernanceContentModuleLedgerViewModel,
  selectedModuleId: string,
): TemplateGovernanceContentModuleLedgerViewModel {
  return {
    ...ledger,
    selectedModuleId,
    selectedModule: ledger.modules.find((module) => module.id === selectedModuleId) ?? null,
  };
}

export function validateV2CandidateConfirmationFormValues(
  values: TemplateGovernanceCandidateConfirmationFormValues,
): string | null {
  if (values.semanticSummary.trim().length === 0) {
    return "请先确认 AI 语义摘要。";
  }

  return null;
}

export function validateV2ContentModuleFormValues(
  values: TemplateGovernanceContentModuleFormValues,
): string | null {
  if (values.name.trim().length === 0) {
    return "请先填写模块名称。";
  }
  if (parseLedgerManuscriptTypes(values.manuscriptTypeScope).length === 0) {
    return "请至少填写一个稿件类型，可用 clinical_study, review 这类代码。";
  }
  if (parseTemplateModules(values.executionModuleScope).length === 0) {
    return "请至少填写一个执行模块，可用 screening, editing, proofreading。";
  }
  if (values.summary.trim().length === 0) {
    return "请先填写模块摘要。";
  }

  return null;
}

export function validateV2TemplateFormValues(
  values: TemplateGovernanceTemplateFormValues,
  ledger: TemplateGovernanceTemplateLedgerViewModel,
):
  | {
      createInput: {
        name: string;
        manuscriptType: ManuscriptType;
        journalScope?: string;
        generalModuleIds?: string[];
        medicalModuleIds?: string[];
        executionModuleScope: TemplateModule[];
        notes?: string;
      };
      updateInput: {
        name: string;
        journalScope?: string;
        generalModuleIds?: string[];
        medicalModuleIds?: string[];
        executionModuleScope: TemplateModule[];
        notes?: string;
      };
    }
  | {
      error: string;
    } {
  if (values.name.trim().length === 0) {
    return { error: "请先填写模板名称。" };
  }

  const manuscriptType = parseLedgerManuscriptTypes(values.manuscriptType)[0];
  if (!manuscriptType) {
    return { error: "请填写一个有效的稿件类型。" };
  }

  const executionModuleScope = parseTemplateModules(values.executionModuleScope);
  if (executionModuleScope.length === 0) {
    return { error: "请至少填写一个执行模块。" };
  }

  const generalModuleIds = resolveGovernedModuleIds(
    values.generalModuleIds,
    ledger.generalModules,
  );
  if (generalModuleIds.unresolved.length > 0) {
    return {
      error: `这些通用模块未匹配到台账：${generalModuleIds.unresolved.join("、")}`,
    };
  }

  const medicalModuleIds = resolveGovernedModuleIds(
    values.medicalModuleIds,
    ledger.medicalModules,
  );
  if (medicalModuleIds.unresolved.length > 0) {
    return {
      error: `这些医学模块未匹配到台账：${medicalModuleIds.unresolved.join("、")}`,
    };
  }

  const journalScope = values.journalScope.trim();
  const notes = values.notes.trim();

  return {
    createInput: {
      name: values.name.trim(),
      manuscriptType,
      executionModuleScope,
      ...(journalScope ? { journalScope } : {}),
      generalModuleIds: generalModuleIds.ids,
      medicalModuleIds: medicalModuleIds.ids,
      ...(notes ? { notes } : {}),
    },
    updateInput: {
      name: values.name.trim(),
      journalScope,
      generalModuleIds: generalModuleIds.ids,
      medicalModuleIds: medicalModuleIds.ids,
      executionModuleScope,
      notes,
    },
  };
}

export function validateV2JournalTemplateFormValues(
  values: TemplateGovernanceJournalTemplateFormValues,
): string | null {
  if (values.templateFamilyId.trim().length === 0) {
    return "请先选择一个大模板。";
  }

  if (values.journalName.trim().length === 0) {
    return "请填写期刊名称。";
  }

  if (values.journalKey.trim().length === 0) {
    return "请填写期刊键。";
  }

  const blockKeys = new Set<string>();
  for (const block of values.targetModel.target_blocks) {
    if (block.block_key.trim().length === 0) {
      return "格式目标模型中的 block key 不能为空。";
    }
    if (blockKeys.has(block.block_key)) {
      return `格式目标模型中的 block key 不能重复：${block.block_key}`;
    }
    blockKeys.add(block.block_key);
  }

  return null;
}

export function toV2ContentModuleFormValues(
  module: GovernedContentModuleViewModel,
): TemplateGovernanceContentModuleFormValues {
  return {
    name: module.name,
    category: module.category,
    manuscriptTypeScope: module.manuscript_type_scope.join(", "),
    executionModuleScope: module.execution_module_scope.join(", "),
    applicableSections: (module.applicable_sections ?? []).join(", "),
    summary: module.summary,
    guidance: (module.guidance ?? []).join(", "),
    examples: formatRuleEvidenceExamples(module.examples),
    evidenceLevel: module.evidence_level ?? "unknown",
    riskLevel: module.risk_level ?? "medium",
  };
}

export function toV2ContentModuleCreateInput(
  values: TemplateGovernanceContentModuleFormValues,
  moduleClass: GovernedContentModuleClass,
) {
  const applicableSections = parseStringList(values.applicableSections);
  const guidance = parseStringList(values.guidance);
  const examples = parseRuleEvidenceExamples(values.examples);

  return {
    moduleClass,
    name: values.name.trim(),
    category: values.category.trim(),
    manuscriptTypeScope: parseLedgerManuscriptTypes(values.manuscriptTypeScope),
    executionModuleScope: parseTemplateModules(values.executionModuleScope),
    summary: values.summary.trim(),
    ...(applicableSections.length ? { applicableSections } : {}),
    ...(guidance.length ? { guidance } : {}),
    ...(examples.length ? { examples } : {}),
    ...(moduleClass === "medical_specialized"
      ? {
          evidenceLevel: values.evidenceLevel,
          riskLevel: values.riskLevel,
        }
      : {}),
  };
}

export function toV2ContentModuleUpdateInput(
  values: TemplateGovernanceContentModuleFormValues,
) {
  const applicableSections = parseStringList(values.applicableSections);
  const guidance = parseStringList(values.guidance);
  const examples = parseRuleEvidenceExamples(values.examples);

  return {
    name: values.name.trim(),
    category: values.category.trim(),
    manuscriptTypeScope: parseLedgerManuscriptTypes(values.manuscriptTypeScope),
    executionModuleScope: parseTemplateModules(values.executionModuleScope),
    summary: values.summary.trim(),
    applicableSections,
    guidance,
    examples,
    evidenceLevel: values.evidenceLevel,
    riskLevel: values.riskLevel,
  };
}

export function toV2TemplateFormValues(
  template: TemplateCompositionViewModel,
  generalModules: readonly GovernedContentModuleViewModel[],
  medicalModules: readonly GovernedContentModuleViewModel[],
): TemplateGovernanceTemplateFormValues {
  return {
    name: template.name,
    manuscriptType: template.manuscript_type,
    journalScope: template.journal_scope ?? "",
    executionModuleScope: template.execution_module_scope.join(", "),
    generalModuleIds: formatGovernedModuleReferences(
      template.general_module_ids,
      generalModules,
    ),
    medicalModuleIds: formatGovernedModuleReferences(
      template.medical_module_ids,
      medicalModules,
    ),
    notes: template.notes ?? "",
  };
}

export function toV2JournalTemplateFormValues(
  template: JournalTemplateProfileViewModel,
): TemplateGovernanceJournalTemplateFormValues {
  return {
    templateFamilyId: template.template_family_id,
    journalName: template.journal_name,
    journalKey: template.journal_key,
    targetModel:
      template.journal_format_target_model ??
      createV2JournalTemplateFormValues(template.template_family_id).targetModel,
    targetModelVersionId: template.target_model_version_id,
    targetModelVersionNo: template.target_model_version_no,
  };
}

export function toV2ErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof BrowserHttpClientError) {
    const body =
      typeof error.responseBody === "string"
        ? error.responseBody
        : JSON.stringify(error.responseBody);
    return `${fallback}: HTTP ${error.status} ${body}`;
  }

  return error instanceof Error ? error.message : fallback;
}

function formatGovernedModuleReferences(
  moduleIds: readonly string[],
  modules: readonly GovernedContentModuleViewModel[],
): string {
  return moduleIds
    .map((moduleId) => modules.find((module) => module.id === moduleId)?.name ?? moduleId)
    .join(", ");
}

function resolveGovernedModuleIds(
  value: string,
  modules: readonly GovernedContentModuleViewModel[],
): {
  ids: string[];
  unresolved: string[];
} {
  const ids: string[] = [];
  const unresolved: string[] = [];

  for (const token of parseStringList(value)) {
    const matchedModule = modules.find(
      (module) => module.id === token || module.name === token,
    );
    if (matchedModule) {
      ids.push(matchedModule.id);
    } else {
      unresolved.push(token);
    }
  }

  return {
    ids: [...new Set(ids)],
    unresolved,
  };
}

function parseLedgerManuscriptTypes(value: string): ManuscriptType[] {
  return parseStringList(value)
    .map((item) => normalizeLedgerManuscriptType(item))
    .filter((item): item is ManuscriptType => item != null);
}

function parseTemplateModules(value: string): TemplateModule[] {
  return parseStringList(value)
    .map((item) => normalizeTemplateModule(item))
    .filter((item): item is TemplateModule => item != null);
}

function normalizeLedgerManuscriptType(value: string): ManuscriptType | null {
  if (manuscriptTypes.includes(value as ManuscriptType)) {
    return value as ManuscriptType;
  }

  const normalizedValue = value.trim().toLowerCase();
  return (
    manuscriptTypes.find(
      (item) =>
        formatTemplateGovernanceManuscriptTypeLabel(item).toLowerCase() ===
        normalizedValue,
    ) ?? null
  );
}

function normalizeTemplateModule(value: string): TemplateModule | null {
  if (templateModules.includes(value as TemplateModule)) {
    return value as TemplateModule;
  }

  const normalizedValue = value.trim().toLowerCase();
  return (
    templateModules.find(
      (item) => formatTemplateGovernanceModuleLabel(item).toLowerCase() === normalizedValue,
    ) ?? null
  );
}

function parseStringList(value: string): string[] {
  return value
    .split(/[\n,，;；]/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseRuleEvidenceExamples(value: string): RuleEvidenceExampleViewModel[] {
  return value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line
        .split(/\s*(?:=>|->|\|)\s*/u)
        .map((part) => part.trim())
        .filter(Boolean);

      if (parts.length === 1) {
        return {
          before: parts[0],
          after: parts[0],
        };
      }

      if (parts.length === 2) {
        return {
          before: parts[0],
          after: parts[1],
        };
      }

      return {
        before: parts[0],
        after: parts[1],
        note: parts.slice(2).join(" | "),
      };
    });
}

function formatRuleEvidenceExamples(
  examples: readonly RuleEvidenceExampleViewModel[] | undefined,
): string {
  return (
    examples
      ?.map((example) => {
        const base = `${example.before} => ${example.after}`;
        return example.note ? `${base} | ${example.note}` : base;
      })
      .join("\n") ?? ""
  );
}
