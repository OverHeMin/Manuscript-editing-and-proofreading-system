import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import {
  formatWorkbenchHash,
  type RuleCenterMode,
} from "../../app/workbench-routing.ts";
import { WorkbenchCoreStrip } from "../../app/workbench-core-strip.tsx";
import { createBrowserHttpClient, BrowserHttpClientError } from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/index.ts";
import type { LearningCandidateViewModel } from "../learning-review/index.ts";
import type { RuleAuthoringPrefillFromLearningCandidate } from "../learning-review/index.ts";
import type {
  EvidenceLevel,
  KnowledgeItemStatus,
  KnowledgeKind,
  KnowledgeSourceType,
} from "../knowledge/index.ts";
import type { ManuscriptType } from "../manuscripts/types.ts";
import type {
  PromptTemplateKind,
  PromptTemplateViewModel,
} from "../prompt-skill-registry/index.ts";
import type {
  EditorialRuleConfidencePolicy,
  EditorialRuleExecutionMode,
  EditorialRuleSeverity,
  EditorialRuleSetViewModel,
  EditorialRuleType,
} from "../editorial-rules/index.ts";
import type {
  ModuleTemplateViewModel,
  TemplateModule,
  TemplateFamilyStatus,
} from "../templates/index.ts";
import { RuleAuthoringForm } from "./rule-authoring-form.tsx";
import { RuleAuthoringGrid } from "./rule-authoring-grid.tsx";
import { RuleAuthoringNavigation } from "./rule-authoring-navigation.tsx";
import { RuleAuthoringExplainability } from "./rule-authoring-explainability.tsx";
import { RuleAuthoringPreviewPanel } from "./rule-authoring-preview.tsx";
import { RuleLearningPane } from "./rule-learning-pane.tsx";
import {
  createRuleAuthoringDraft,
  hydrateRuleAuthoringDraft,
  serializeRuleAuthoringDraft,
} from "./rule-authoring-serialization.ts";
import type { RuleAuthoringDraft, RuleAuthoringObject } from "./rule-authoring-types.ts";
import { isRuleAuthoringDraft } from "./rule-authoring-types.ts";
import {
  createTemplateGovernanceWorkbenchController,
  type TemplateGovernanceWorkbenchController,
  type TemplateGovernanceWorkbenchFilters,
  type TemplateGovernanceWorkbenchOverview,
} from "./template-governance-controller.ts";

if (typeof document !== "undefined") {
  void import("./template-governance-workbench.css");
}

const defaultController = createTemplateGovernanceWorkbenchController(
  createBrowserHttpClient(),
);
const manuscriptTypes: ManuscriptType[] = [
  "clinical_study",
  "review",
  "systematic_review",
  "meta_analysis",
  "case_report",
  "guideline_interpretation",
  "expert_consensus",
  "diagnostic_study",
  "basic_research",
  "nursing_study",
  "methodology_paper",
  "brief_report",
  "other",
];
const templateModules = ["screening", "editing", "proofreading"] as const;
const editorialInstructionModules = ["editing", "proofreading"] as const;
const knowledgeKinds: KnowledgeKind[] = [
  "rule",
  "case_pattern",
  "checklist",
  "prompt_snippet",
  "reference",
  "other",
];
const knowledgeStatuses: Array<KnowledgeItemStatus | "all"> = [
  "all",
  "draft",
  "pending_review",
  "approved",
  "deprecated",
  "superseded",
  "archived",
];
const evidenceLevels: EvidenceLevel[] = [
  "unknown",
  "low",
  "medium",
  "high",
  "expert_opinion",
];
const knowledgeSourceTypes: KnowledgeSourceType[] = [
  "other",
  "paper",
  "guideline",
  "book",
  "website",
  "internal_case",
];
const templateFamilyStatuses: TemplateFamilyStatus[] = [
  "draft",
  "active",
  "archived",
];
const editorialRuleTypes: EditorialRuleType[] = ["format", "content"];
const editorialRuleExecutionModes: EditorialRuleExecutionMode[] = [
  "apply",
  "inspect",
  "apply_and_inspect",
];
const editorialRuleConfidencePolicies: EditorialRuleConfidencePolicy[] = [
  "always_auto",
  "high_confidence_only",
  "manual_only",
];
const editorialRuleSeverities: EditorialRuleSeverity[] = ["info", "warning", "error"];
const promptTemplateKinds: PromptTemplateKind[] = [
  "editing_instruction",
  "proofreading_instruction",
];

interface TemplateFamilyFormState {
  manuscriptType: ManuscriptType;
  name: string;
}

interface SelectedTemplateFamilyFormState {
  name: string;
  status: TemplateFamilyStatus;
}

interface ModuleTemplateFormState {
  module: (typeof templateModules)[number];
  prompt: string;
  checklist: string;
  sectionRequirements: string;
}

interface KnowledgeDraftFormState {
  title: string;
  canonicalText: string;
  summary: string;
  knowledgeKind: KnowledgeKind;
  moduleScope: "any" | "screening" | "editing" | "proofreading";
  manuscriptTypes: string;
  templateBindings: string;
  aliases: string;
  sections: string;
  riskTags: string;
  disciplineTags: string;
  evidenceLevel: EvidenceLevel;
  sourceType: KnowledgeSourceType;
  sourceLink: string;
}

interface RuleSetFormState {
  module: TemplateModule;
}

interface RuleDraftFormState {
  orderNo: string;
  ruleType: EditorialRuleType;
  executionMode: EditorialRuleExecutionMode;
  scopeSections: string;
  scopeBlockKind: string;
  triggerKind: string;
  triggerText: string;
  actionKind: string;
  actionTarget: string;
  confidencePolicy: EditorialRuleConfidencePolicy;
  severity: EditorialRuleSeverity;
  exampleBefore: string;
  exampleAfter: string;
  manualReviewReasonTemplate: string;
}

interface InstructionTemplateFormState {
  name: string;
  version: string;
  module: (typeof editorialInstructionModules)[number];
  templateKind: PromptTemplateKind;
  systemInstructions: string;
  taskFrame: string;
  hardRuleSummary: string;
  allowedContentOperations: string;
  forbiddenOperations: string;
  manualReviewPolicy: string;
  outputContract: string;
  reportStyle: string;
}

export type TemplateGovernanceWorkbenchMode = RuleCenterMode;

export interface TemplateGovernanceWorkbenchPageProps {
  controller?: TemplateGovernanceWorkbenchController;
  actorRole?: AuthRole;
  initialOverview?: TemplateGovernanceWorkbenchOverview | null;
  initialMode?: TemplateGovernanceWorkbenchMode;
  prefilledManuscriptId?: string;
  prefilledReviewedCaseSnapshotId?: string;
  initialLearningCandidates?: readonly LearningCandidateViewModel[];
  initialSelectedLearningCandidateId?: string;
}

export function TemplateGovernanceWorkbenchPage({
  controller = defaultController,
  actorRole = "admin",
  initialOverview = null,
  initialMode = "authoring",
  prefilledManuscriptId,
  prefilledReviewedCaseSnapshotId,
  initialLearningCandidates = [],
  initialSelectedLearningCandidateId,
}: TemplateGovernanceWorkbenchPageProps) {
  const selectedModuleTemplateIdRef = useRef<string | null>(null);
  const [overview, setOverview] = useState<TemplateGovernanceWorkbenchOverview | null>(
    initialOverview,
  );
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">(
    initialOverview ? "ready" : "idle",
  );
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedModuleTemplateId, setSelectedModuleTemplateId] = useState<string | null>(null);
  const [workbenchMode, setWorkbenchMode] =
    useState<TemplateGovernanceWorkbenchMode>(initialMode);
  const [familyForm, setFamilyForm] = useState<TemplateFamilyFormState>({
    manuscriptType: "clinical_study",
    name: "",
  });
  const [selectedFamilyForm, setSelectedFamilyForm] =
    useState<SelectedTemplateFamilyFormState>({
      name: "",
      status: "draft",
    });
  const [moduleForm, setModuleForm] = useState<ModuleTemplateFormState>({
    module: "screening",
    prompt: "",
    checklist: "",
    sectionRequirements: "",
  });
  const [knowledgeForm, setKnowledgeForm] = useState<KnowledgeDraftFormState>(
    createKnowledgeDraftFormState(),
  );
  const [selectedRuleObject, setSelectedRuleObject] =
    useState<RuleAuthoringObject>("abstract");
  const [ruleSetForm, setRuleSetForm] = useState<RuleSetFormState>({
    module: "editing",
  });
  const [ruleAuthoringDraft, setRuleAuthoringDraft] = useState<RuleAuthoringDraft>(
    () => createRuleAuthoringDraft("abstract"),
  );
  const [pendingRuleLearningHandoff, setPendingRuleLearningHandoff] =
    useState<RuleAuthoringPrefillFromLearningCandidate | null>(null);
  const [journalTemplateForm, setJournalTemplateForm] = useState({
    journalKey: "",
    journalName: "",
  });
  const [instructionTemplateForm, setInstructionTemplateForm] =
    useState<InstructionTemplateFormState>(createInstructionTemplateFormState());

  useEffect(() => {
    if (initialOverview) {
      synchronizeForms(initialOverview);
      return;
    }

    void loadOverview();
  }, [controller, initialOverview]);

  useEffect(() => {
    setWorkbenchMode(initialMode);
  }, [initialMode]);

  async function loadOverview(input: {
    selectedTemplateFamilyId?: string | null;
    selectedJournalTemplateId?: string | null;
    selectedRuleSetId?: string | null;
    selectedInstructionTemplateId?: string | null;
    selectedKnowledgeItemId?: string | null;
    filters?: Partial<TemplateGovernanceWorkbenchFilters>;
  } = {}) {
    setLoadStatus("loading");
    setErrorMessage(null);

    try {
      const nextOverview = await controller.loadOverview(input);
      setOverview(nextOverview);
      setLoadStatus("ready");
      synchronizeForms(nextOverview);
    } catch (error) {
      setLoadStatus("error");
      setErrorMessage(toErrorMessage(error, "Template governance load failed"));
    }
  }

  function setModuleTemplateSelection(moduleTemplateId: string | null) {
    selectedModuleTemplateIdRef.current = moduleTemplateId;
    setSelectedModuleTemplateId(moduleTemplateId);
  }

  function synchronizeForms(nextOverview: TemplateGovernanceWorkbenchOverview) {
    if (nextOverview.selectedTemplateFamily) {
      setFamilyForm((current) => ({
        ...current,
        manuscriptType: nextOverview.selectedTemplateFamily?.manuscript_type ?? current.manuscriptType,
      }));
      setSelectedFamilyForm({
        name: nextOverview.selectedTemplateFamily.name,
        status: nextOverview.selectedTemplateFamily.status,
      });
    } else {
      setSelectedFamilyForm({
        name: "",
        status: "draft",
      });
    }

    setRuleSetForm({
      module: nextOverview.selectedRuleSet?.module ?? "editing",
    });
    const firstStructuredRule = nextOverview.rules.find(isRuleAuthoringDraft);
    const nextRuleDraft = firstStructuredRule
      ? hydrateRuleAuthoringDraft(firstStructuredRule)
      : createRuleAuthoringDraft(selectedRuleObject);
    setSelectedRuleObject(nextRuleDraft.ruleObject);
    setRuleAuthoringDraft({
      ...nextRuleDraft,
      journalTemplateId: nextOverview.selectedJournalTemplateId,
    });

    const defaultHardRuleSummary =
      nextOverview.rules[0]?.example_before && nextOverview.rules[0]?.example_after
        ? `${nextOverview.rules[0].example_before} -> ${nextOverview.rules[0].example_after}`
        : "";
    setInstructionTemplateForm((current) => ({
      ...current,
      module:
        nextOverview.selectedInstructionTemplate?.module === "proofreading"
          ? "proofreading"
          : current.module,
      templateKind:
        nextOverview.selectedInstructionTemplate?.template_kind ??
        inferPromptTemplateKindFromModule(current.module),
      hardRuleSummary:
        current.hardRuleSummary.length > 0 ? current.hardRuleSummary : defaultHardRuleSummary,
    }));

    const selectedModuleTemplate = resolveSelectedModuleTemplate(
      nextOverview.moduleTemplates,
      selectedModuleTemplateIdRef.current,
    );
    if (selectedModuleTemplate?.status === "draft") {
      setModuleForm(toModuleTemplateFormState(selectedModuleTemplate));
    } else {
      setModuleTemplateSelection(null);
      setModuleForm((current) => ({
        ...current,
        prompt: "",
        checklist: "",
        sectionRequirements: "",
      }));
    }

    const selectedDraft = nextOverview.selectedKnowledgeItem;
    if (selectedDraft?.status === "draft") {
      setKnowledgeForm(toKnowledgeDraftFormState(selectedDraft));
      return;
    }

    setKnowledgeForm(
      createKnowledgeDraftFormState({
        manuscriptType: nextOverview.selectedTemplateFamily?.manuscript_type,
        templateBindings: nextOverview.moduleTemplates.map((template) => template.id),
      }),
    );
  }

  function currentReloadContext(overrides: {
    selectedTemplateFamilyId?: string | null;
    selectedJournalTemplateId?: string | null;
    selectedRuleSetId?: string | null;
    selectedInstructionTemplateId?: string | null;
    selectedKnowledgeItemId?: string | null;
    filters?: Partial<TemplateGovernanceWorkbenchFilters>;
  } = {}) {
    return {
      selectedTemplateFamilyId:
        overrides.selectedTemplateFamilyId ?? overview?.selectedTemplateFamilyId ?? null,
      selectedJournalTemplateId:
        overrides.selectedJournalTemplateId !== undefined
          ? overrides.selectedJournalTemplateId
          : overview?.selectedJournalTemplateId ?? null,
      selectedRuleSetId:
        overrides.selectedRuleSetId !== undefined
          ? overrides.selectedRuleSetId
          : overview?.selectedRuleSetId ?? null,
      selectedInstructionTemplateId:
        overrides.selectedInstructionTemplateId !== undefined
          ? overrides.selectedInstructionTemplateId
          : overview?.selectedInstructionTemplateId ?? null,
      selectedKnowledgeItemId:
        overrides.selectedKnowledgeItemId !== undefined
          ? overrides.selectedKnowledgeItemId
          : overview?.selectedKnowledgeItemId ?? null,
      filters: overrides.filters ?? overview?.filters,
    };
  }

  async function runBusyAction(
    action: () => Promise<TemplateGovernanceWorkbenchOverview>,
    successMessage: string,
  ) {
    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const nextOverview = await action();
      setOverview(nextOverview);
      setLoadStatus("ready");
      setStatusMessage(successMessage);
      synchronizeForms(nextOverview);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "Template governance action failed"));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCreateTemplateFamily(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (familyForm.name.trim().length === 0) {
      setErrorMessage("Template family name is required.");
      return;
    }

    await runBusyAction(async () => {
      const result = await controller.createTemplateFamilyAndReload({
        manuscriptType: familyForm.manuscriptType,
        name: familyForm.name.trim(),
      });
      setFamilyForm({
        manuscriptType: result.templateFamily.manuscript_type,
        name: "",
      });
      return result.overview;
    }, "Template family created.");
  }

  async function handleUpdateSelectedTemplateFamily(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const selectedTemplateFamilyId = overview?.selectedTemplateFamilyId;
    if (!selectedTemplateFamilyId || !overview) {
      setErrorMessage("Select a template family before updating it.");
      return;
    }

    if (selectedFamilyForm.name.trim().length === 0) {
      setErrorMessage("Selected template family name is required.");
      return;
    }

    await runBusyAction(async () => {
      const result = await controller.updateTemplateFamilyAndReload({
        templateFamilyId: selectedTemplateFamilyId,
        input: {
          name: selectedFamilyForm.name.trim(),
          status: selectedFamilyForm.status,
        },
        ...currentReloadContext({
          selectedTemplateFamilyId,
        }),
      });
      return result.overview;
    }, "Template family updated.");
  }

  async function handleSubmitModuleTemplateDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedTemplateFamilyId = overview?.selectedTemplateFamilyId;
    if (!selectedTemplateFamilyId) {
      setErrorMessage("Select a template family before creating a module draft.");
      return;
    }

    if (moduleForm.prompt.trim().length === 0) {
      setErrorMessage("Module prompt is required.");
      return;
    }

    const selectedModuleTemplate = resolveSelectedModuleTemplate(
      overview.moduleTemplates,
      selectedModuleTemplateId,
    );
    const isEditingModuleTemplate = selectedModuleTemplate?.status === "draft";
    const checklist = splitCommaSeparatedValues(moduleForm.checklist);
    const sectionRequirements = splitCommaSeparatedValues(moduleForm.sectionRequirements);

    await runBusyAction(async () => {
      if (isEditingModuleTemplate && selectedModuleTemplate) {
        const result = await controller.updateModuleTemplateDraftAndReload({
          moduleTemplateId: selectedModuleTemplate.id,
          input: {
            prompt: moduleForm.prompt.trim(),
            checklist: checklist ?? [],
            sectionRequirements: sectionRequirements ?? [],
          },
          ...currentReloadContext({
            selectedTemplateFamilyId,
          }),
        });
        setModuleTemplateSelection(result.moduleTemplate.id);
        return result.overview;
      }

      const result = await controller.createModuleTemplateDraftAndReload({
        templateFamilyId: selectedTemplateFamilyId,
        manuscriptType:
          overview.selectedTemplateFamily?.manuscript_type ?? familyForm.manuscriptType,
        module: moduleForm.module,
        prompt: moduleForm.prompt.trim(),
        checklist,
        sectionRequirements,
        ...currentReloadContext({
          selectedTemplateFamilyId,
        }),
      });
      setModuleTemplateSelection(null);
      setModuleForm((current) => ({
        ...current,
        prompt: "",
        checklist: "",
        sectionRequirements: "",
      }));
      return result.overview;
    }, isEditingModuleTemplate ? "Module template draft updated." : "Module template draft created.");
  }

  async function handlePublishModuleTemplate(moduleTemplateId: string) {
    if (!overview?.selectedTemplateFamilyId) {
      return;
    }

    await runBusyAction(async () => {
      if (selectedModuleTemplateIdRef.current === moduleTemplateId) {
        setModuleTemplateSelection(null);
      }
      const result = await controller.publishModuleTemplateAndReload({
        moduleTemplateId,
        actorRole,
        ...currentReloadContext(),
      });
      return result.overview;
    }, "Module template published.");
  }

  function handleEditModuleTemplate(moduleTemplateId: string) {
    const selectedModuleTemplate = resolveSelectedModuleTemplate(
      overview?.moduleTemplates ?? [],
      moduleTemplateId,
    );

    if (!selectedModuleTemplate || selectedModuleTemplate.status !== "draft") {
      return;
    }

    setStatusMessage(null);
    setErrorMessage(null);
    setModuleTemplateSelection(selectedModuleTemplate.id);
    setModuleForm(toModuleTemplateFormState(selectedModuleTemplate));
  }

  function handleResetModuleTemplateForm() {
    setModuleTemplateSelection(null);
    setModuleForm((current) => ({
      ...current,
      prompt: "",
      checklist: "",
      sectionRequirements: "",
    }));
    setStatusMessage("Module template editor reset for a new draft.");
  }

  function handleRuleSetSelection(ruleSetId: string) {
    if (!overview) {
      return;
    }

    setStatusMessage(null);
    void loadOverview(currentReloadContext({ selectedRuleSetId: ruleSetId }));
  }

  function clearRuleLearningHandoff() {
    setPendingRuleLearningHandoff(null);
  }

  function handleRuleScopeChange(journalTemplateId: string | null) {
    if (!overview) {
      return;
    }

    setStatusMessage(null);
    clearRuleLearningHandoff();
    setRuleAuthoringDraft((current) => ({
      ...current,
      journalTemplateId,
    }));
    void loadOverview(
      currentReloadContext({
        selectedJournalTemplateId: journalTemplateId,
        selectedRuleSetId: null,
      }),
    );
  }

  function handleRuleModuleChange(module: TemplateModule) {
    setRuleSetForm({ module });
    clearRuleLearningHandoff();
    if (!overview) {
      return;
    }

    const matchingRuleSetId =
      overview.ruleSets.find((ruleSet) => ruleSet.module === module)?.id ?? null;
    setStatusMessage(null);
    void loadOverview(
      currentReloadContext({
        selectedRuleSetId: matchingRuleSetId,
      }),
    );
  }

  function handleRuleObjectChange(ruleObject: RuleAuthoringObject) {
    setSelectedRuleObject(ruleObject);
    clearRuleLearningHandoff();
    const nextDraft = createRuleAuthoringDraft(ruleObject);
    setRuleAuthoringDraft({
      ...nextDraft,
      journalTemplateId: overview?.selectedJournalTemplateId ?? null,
    });
    setStatusMessage(null);
  }

  async function handleConvertLearningCandidateToRuleDraft(
    prefill: RuleAuthoringPrefillFromLearningCandidate,
  ) {
    const targetTemplateFamilyId =
      prefill.selectedTemplateFamilyId ?? overview?.selectedTemplateFamilyId ?? null;
    const targetJournalTemplateId = prefill.selectedJournalTemplateId ?? null;
    const shouldReloadOverview =
      targetTemplateFamilyId !== (overview?.selectedTemplateFamilyId ?? null) ||
      targetJournalTemplateId !== (overview?.selectedJournalTemplateId ?? null);

    setErrorMessage(null);
    if (shouldReloadOverview) {
      setLoadStatus("loading");

      try {
        const nextOverview = await controller.loadOverview({
          selectedTemplateFamilyId: targetTemplateFamilyId,
          selectedJournalTemplateId: targetJournalTemplateId,
          selectedRuleSetId: null,
          selectedInstructionTemplateId: overview?.selectedInstructionTemplateId ?? null,
          selectedKnowledgeItemId: overview?.selectedKnowledgeItemId ?? null,
          filters: overview?.filters,
        });
        setOverview(nextOverview);
        setLoadStatus("ready");
        synchronizeForms(nextOverview);
      } catch (error) {
        setLoadStatus("error");
        setErrorMessage(toErrorMessage(error, "Template governance load failed"));
        return;
      }
    }

    setPendingRuleLearningHandoff(prefill);
    setWorkbenchMode("authoring");
    setRuleSetForm({ module: prefill.module });
    setSelectedRuleObject(prefill.ruleDraft.ruleObject);
    setRuleAuthoringDraft({
      ...prefill.ruleDraft,
      journalTemplateId: targetJournalTemplateId,
    });
    setStatusMessage(
      `Rule draft prefilled from learning candidate ${prefill.sourceLearningCandidateId}.`,
    );
  }

  async function handleCreateJournalTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedTemplateFamily = overview?.selectedTemplateFamily;
    if (!selectedTemplateFamily) {
      setErrorMessage("Select a template family before creating a journal template.");
      return;
    }

    if (
      journalTemplateForm.journalName.trim().length === 0 ||
      journalTemplateForm.journalKey.trim().length === 0
    ) {
      setErrorMessage("Journal name and journal key are required.");
      return;
    }

    await runBusyAction(async () => {
      const result = await controller.createJournalTemplateProfileAndReload({
        templateFamilyId: selectedTemplateFamily.id,
        manuscriptType: selectedTemplateFamily.manuscript_type,
        journalName: journalTemplateForm.journalName.trim(),
        journalKey: journalTemplateForm.journalKey.trim(),
        ...currentReloadContext({
          selectedTemplateFamilyId: selectedTemplateFamily.id,
          selectedRuleSetId: null,
        }),
      });
      setJournalTemplateForm({
        journalKey: "",
        journalName: "",
      });
      return result.overview;
    }, "Journal template profile created.");
  }

  async function handleActivateJournalTemplate(journalTemplateProfileId: string) {
    if (!overview?.selectedTemplateFamilyId) {
      return;
    }

    await runBusyAction(async () => {
      const result = await controller.activateJournalTemplateProfileAndReload({
        journalTemplateProfileId,
        actorRole,
        ...currentReloadContext({
          selectedJournalTemplateId: journalTemplateProfileId,
          selectedRuleSetId: null,
        }),
      });
      return result.overview;
    }, "Journal template profile activated.");
  }

  async function handleArchiveJournalTemplate(journalTemplateProfileId: string) {
    if (!overview?.selectedTemplateFamilyId) {
      return;
    }

    await runBusyAction(async () => {
      const result = await controller.archiveJournalTemplateProfileAndReload({
        journalTemplateProfileId,
        actorRole,
        ...currentReloadContext({
          selectedJournalTemplateId:
            overview.selectedJournalTemplateId === journalTemplateProfileId
              ? null
              : overview.selectedJournalTemplateId,
          selectedRuleSetId: null,
        }),
      });
      return result.overview;
    }, "Journal template profile archived.");
  }

  async function handleCreateRuleSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedTemplateFamilyId = overview?.selectedTemplateFamilyId;
    if (!selectedTemplateFamilyId) {
      setErrorMessage("Select a template family before creating a rule set.");
      return;
    }

    await runBusyAction(async () => {
      const result = await controller.createRuleSetAndReload({
        actorRole,
        templateFamilyId: selectedTemplateFamilyId,
        journalTemplateId: overview?.selectedJournalTemplateId ?? undefined,
        module: ruleSetForm.module,
        ...currentReloadContext({
          selectedTemplateFamilyId,
        }),
      });
      return result.overview;
    }, "Rule set draft created.");
  }

  async function handleSubmitRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedRuleSetId = overview?.selectedRuleSetId;
    if (!overview?.selectedTemplateFamilyId || !selectedRuleSetId) {
      setErrorMessage("Create or select a rule set before adding rules.");
      return;
    }
    const serializedDraft = serializeRuleAuthoringDraft({
      ...ruleAuthoringDraft,
      journalTemplateId: overview.selectedJournalTemplateId,
    });
    const explanationPayload = pendingRuleLearningHandoff?.explanationPayload;
    const linkagePayload = pendingRuleLearningHandoff?.linkagePayload;
    const projectionPayload = pendingRuleLearningHandoff?.projectionPayload;

    await runBusyAction(async () => {
      const result = await controller.createRuleAndReload({
        ruleSetId: selectedRuleSetId,
        input: {
          actorRole,
          orderNo: serializedDraft.orderNo,
          ruleObject: serializedDraft.ruleObject,
          ruleType: serializedDraft.ruleType,
          executionMode: serializedDraft.executionMode,
          scope: serializedDraft.scope,
          selector: serializedDraft.selector,
          trigger: serializedDraft.trigger,
          action: serializedDraft.action,
          authoringPayload: serializedDraft.authoringPayload,
          ...(explanationPayload ? { explanationPayload } : {}),
          ...(linkagePayload ? { linkagePayload } : {}),
          ...(projectionPayload ? { projectionPayload } : {}),
          evidenceLevel: serializedDraft.evidenceLevel,
          confidencePolicy: serializedDraft.confidencePolicy,
          severity: serializedDraft.severity,
          enabled: serializedDraft.enabled,
          exampleBefore: serializedDraft.exampleBefore,
          exampleAfter: serializedDraft.exampleAfter,
          manualReviewReasonTemplate: serializedDraft.manualReviewReasonTemplate,
        },
        ...currentReloadContext({
          selectedRuleSetId,
        }),
      });
      const nextDraft = createRuleAuthoringDraft(selectedRuleObject);
      setRuleAuthoringDraft({
        ...nextDraft,
        journalTemplateId: overview.selectedJournalTemplateId,
      });
      setPendingRuleLearningHandoff(null);
      return result.overview;
    }, "Rule draft created.");
  }

  async function handlePublishRuleSet(ruleSetId: string) {
    if (!overview?.selectedTemplateFamilyId) {
      return;
    }

    await runBusyAction(async () => {
      const result = await controller.publishRuleSetAndReload({
        ruleSetId,
        actorRole,
        ...currentReloadContext({
          selectedRuleSetId: ruleSetId,
        }),
      });
      return result.overview;
    }, "Rule set published.");
  }

  function handleInstructionTemplateSelection(promptTemplateId: string) {
    if (!overview) {
      return;
    }

    setStatusMessage(null);
    void loadOverview(
      currentReloadContext({
        selectedInstructionTemplateId: promptTemplateId,
      }),
    );
  }

  async function handleCreateInstructionTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedTemplateFamily = overview?.selectedTemplateFamily;
    if (!selectedTemplateFamily) {
      setErrorMessage("Select a template family before creating an AI instruction template.");
      return;
    }

    if (
      instructionTemplateForm.name.trim().length === 0 ||
      instructionTemplateForm.systemInstructions.trim().length === 0 ||
      instructionTemplateForm.taskFrame.trim().length === 0 ||
      instructionTemplateForm.manualReviewPolicy.trim().length === 0 ||
      instructionTemplateForm.outputContract.trim().length === 0
    ) {
      setErrorMessage(
        "Instruction name, system instructions, task frame, manual review policy, and output contract are required.",
      );
      return;
    }

    await runBusyAction(async () => {
      const result = await controller.createInstructionTemplateAndReload({
        actorRole,
        name: instructionTemplateForm.name.trim(),
        version: instructionTemplateForm.version.trim() || "1.0.0",
        module: instructionTemplateForm.module,
        manuscriptTypes: [selectedTemplateFamily.manuscript_type],
        templateKind: instructionTemplateForm.templateKind,
        systemInstructions: instructionTemplateForm.systemInstructions.trim(),
        taskFrame: instructionTemplateForm.taskFrame.trim(),
        hardRuleSummary: optionalTrimmedValue(instructionTemplateForm.hardRuleSummary),
        allowedContentOperations:
          splitCommaSeparatedValues(instructionTemplateForm.allowedContentOperations) ?? [],
        forbiddenOperations:
          splitCommaSeparatedValues(instructionTemplateForm.forbiddenOperations) ?? [],
        manualReviewPolicy: instructionTemplateForm.manualReviewPolicy.trim(),
        outputContract: instructionTemplateForm.outputContract.trim(),
        reportStyle: optionalTrimmedValue(instructionTemplateForm.reportStyle),
        ...currentReloadContext(),
      });
      setInstructionTemplateForm(createInstructionTemplateFormState());
      return result.overview;
    }, "AI instruction template draft created.");
  }

  async function handlePublishInstructionTemplate(promptTemplateId: string) {
    if (!overview?.selectedTemplateFamilyId) {
      return;
    }

    await runBusyAction(async () => {
      const result = await controller.publishInstructionTemplateAndReload({
        promptTemplateId,
        actorRole,
        ...currentReloadContext({
          selectedInstructionTemplateId: promptTemplateId,
        }),
      });
      return result.overview;
    }, "AI instruction template published.");
  }

  async function handleSubmitKnowledgeDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedKnowledgeItem = overview?.selectedKnowledgeItem;
    const isEditingDraft = selectedKnowledgeItem?.status === "draft";
    if (!overview) {
      return;
    }

    if (
      knowledgeForm.title.trim().length === 0 ||
      knowledgeForm.canonicalText.trim().length === 0
    ) {
      setErrorMessage("Knowledge title and canonical text are required.");
      return;
    }

    const payload = {
      title: knowledgeForm.title.trim(),
      canonicalText: knowledgeForm.canonicalText.trim(),
      summary: optionalTrimmedValue(knowledgeForm.summary),
      knowledgeKind: knowledgeForm.knowledgeKind,
      moduleScope: knowledgeForm.moduleScope,
      manuscriptTypes: parseManuscriptTypes(knowledgeForm.manuscriptTypes),
      sections: splitCommaSeparatedValues(knowledgeForm.sections),
      riskTags: splitCommaSeparatedValues(knowledgeForm.riskTags),
      disciplineTags: splitCommaSeparatedValues(knowledgeForm.disciplineTags),
      evidenceLevel: knowledgeForm.evidenceLevel,
      sourceType: knowledgeForm.sourceType,
      sourceLink: optionalTrimmedValue(knowledgeForm.sourceLink),
      aliases: splitCommaSeparatedValues(knowledgeForm.aliases),
      templateBindings: splitCommaSeparatedValues(knowledgeForm.templateBindings),
    } as const;

    await runBusyAction(async () => {
      if (!isEditingDraft || !selectedKnowledgeItem) {
        const result = await controller.createKnowledgeDraftAndReload({
          ...payload,
          ...currentReloadContext(),
        });
        return result.overview;
      }

      const result = await controller.updateKnowledgeDraftAndReload({
        knowledgeItemId: selectedKnowledgeItem.id,
        input: payload,
        ...currentReloadContext({
          selectedKnowledgeItemId: selectedKnowledgeItem.id,
        }),
      });
      return result.overview;
    }, isEditingDraft ? "Knowledge draft updated." : "Knowledge draft created.");
  }

  async function handleSubmitForReview() {
    const selectedKnowledgeItem = overview?.selectedKnowledgeItem;
    if (!overview || selectedKnowledgeItem?.status !== "draft") {
      return;
    }

    await runBusyAction(async () => {
      const result = await controller.submitKnowledgeDraftAndReload({
        knowledgeItemId: selectedKnowledgeItem.id,
        ...currentReloadContext({
          selectedKnowledgeItemId: selectedKnowledgeItem.id,
        }),
      });
      return result.overview;
    }, "Knowledge draft submitted for review.");
  }

  async function handleArchiveKnowledgeItem() {
    const selectedKnowledgeItem = overview?.selectedKnowledgeItem;
    if (!overview || !selectedKnowledgeItem) {
      return;
    }

    await runBusyAction(async () => {
      const result = await controller.archiveKnowledgeItemAndReload({
        knowledgeItemId: selectedKnowledgeItem.id,
        ...currentReloadContext({
          selectedKnowledgeItemId: selectedKnowledgeItem.id,
        }),
      });
      return result.overview;
    }, "Knowledge item archived.");
  }

  function handleTemplateFamilySelection(templateFamilyId: string) {
    if (!overview) {
      return;
    }

    setStatusMessage(null);
    void loadOverview(
      currentReloadContext({
        selectedTemplateFamilyId: templateFamilyId,
        selectedJournalTemplateId: null,
        selectedRuleSetId: null,
        selectedInstructionTemplateId: null,
        selectedKnowledgeItemId: null,
      }),
    );
  }

  function handleKnowledgeItemSelection(knowledgeItemId: string) {
    if (!overview) {
      return;
    }

    setStatusMessage(null);
    void loadOverview(
      currentReloadContext({
        selectedKnowledgeItemId: knowledgeItemId,
      }),
    );
  }

  function handleSearchTextChange(searchText: string) {
    if (!overview) {
      return;
    }

    void loadOverview(
      currentReloadContext({
        filters: {
          ...overview.filters,
          searchText,
        },
      }),
    );
  }

  function handleKnowledgeStatusChange(knowledgeStatus: KnowledgeItemStatus | "all") {
    if (!overview) {
      return;
    }

    void loadOverview(
      currentReloadContext({
        filters: {
          ...overview.filters,
          knowledgeStatus,
        },
      }),
    );
  }

  function handleResetKnowledgeDraft() {
    setKnowledgeForm(
      createKnowledgeDraftFormState({
        manuscriptType: overview?.selectedTemplateFamily?.manuscript_type,
        templateBindings: overview?.moduleTemplates.map((template) => template.id),
      }),
    );
    setStatusMessage("Draft editor reset for a new knowledge item.");
  }

  const selectedModuleTemplate = resolveSelectedModuleTemplate(
    overview?.moduleTemplates ?? [],
    selectedModuleTemplateId,
  );
  const isEditingModuleTemplate = selectedModuleTemplate?.status === "draft";
  const selectedRuleSet = overview?.selectedRuleSet ?? null;
  const selectedInstructionTemplate = overview?.selectedInstructionTemplate ?? null;
  const selectedKnowledgeItem = overview?.selectedKnowledgeItem ?? null;
  const isEditingDraft = selectedKnowledgeItem?.status === "draft";
  const retrievalInsights = overview?.retrievalInsights ?? null;
  const normalizedPrefilledManuscriptId = prefilledManuscriptId?.trim() ?? "";
  const normalizedPrefilledReviewedCaseSnapshotId =
    prefilledReviewedCaseSnapshotId?.trim() ?? "";
  const authoringModeHash = formatWorkbenchHash("template-governance", {
    manuscriptId:
      normalizedPrefilledManuscriptId.length > 0
        ? normalizedPrefilledManuscriptId
        : undefined,
    reviewedCaseSnapshotId:
      normalizedPrefilledReviewedCaseSnapshotId.length > 0
        ? normalizedPrefilledReviewedCaseSnapshotId
        : undefined,
    ruleCenterMode: "authoring",
  });
  const learningModeHash = formatWorkbenchHash("template-governance", {
    manuscriptId:
      normalizedPrefilledManuscriptId.length > 0
        ? normalizedPrefilledManuscriptId
        : undefined,
    reviewedCaseSnapshotId:
      normalizedPrefilledReviewedCaseSnapshotId.length > 0
        ? normalizedPrefilledReviewedCaseSnapshotId
        : undefined,
    ruleCenterMode: "learning",
  });

  return (
    <section className="template-governance-workbench">
      <header className="template-governance-hero">
        <div className="template-governance-hero-copy">
          <p className="template-governance-eyebrow">Rule Center</p>
          <h2>规则中心</h2>
          <p>
            Keep rule authoring and rule learning inside one explainable admin surface while still
            preserving the template family, journal, and knowledge context that execution depends on.
          </p>
          <WorkbenchCoreStrip variant="secondary" />
        </div>
        {statusMessage ? (
          <p className="template-governance-status" role="status">
            {statusMessage}
          </p>
        ) : null}
      </header>

      {errorMessage ? (
        <p className="template-governance-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <nav className="template-governance-mode-switch" aria-label="Rule center modes">
        <a
          href={authoringModeHash}
          className={`template-governance-mode-tab${workbenchMode === "authoring" ? " is-active" : ""}`}
        >
          规则录入工作台
        </a>
        <a
          href={learningModeHash}
          className={`template-governance-mode-tab${workbenchMode === "learning" ? " is-active" : ""}`}
        >
          规则学习工作台
        </a>
      </nav>

      {normalizedPrefilledReviewedCaseSnapshotId.length > 0 ? (
        <p className="template-governance-context-note">
          已保留学习上下文：reviewed snapshot {normalizedPrefilledReviewedCaseSnapshotId}
        </p>
      ) : null}

      {pendingRuleLearningHandoff ? (
        <p className="template-governance-context-note">
          已从学习候选预填规则草稿：{pendingRuleLearningHandoff.sourceLearningCandidateId}
          {pendingRuleLearningHandoff.reviewedCaseSnapshotId
            ? ` · reviewed snapshot ${pendingRuleLearningHandoff.reviewedCaseSnapshotId}`
            : ""}
        </p>
      ) : null}

      {workbenchMode === "learning" ? (
        <RuleLearningPane
          actorRole={actorRole}
          prefilledManuscriptId={
            normalizedPrefilledManuscriptId.length > 0
              ? normalizedPrefilledManuscriptId
              : undefined
          }
          prefilledReviewedCaseSnapshotId={
            normalizedPrefilledReviewedCaseSnapshotId.length > 0
              ? normalizedPrefilledReviewedCaseSnapshotId
              : undefined
          }
          initialCandidates={initialLearningCandidates}
          initialSelectedCandidateId={initialSelectedLearningCandidateId}
          onConvertToRuleDraft={handleConvertLearningCandidateToRuleDraft}
        />
      ) : (
        <>
      <section className="template-governance-summary">
        <article className="template-governance-summary-card">
          <span>Template Families</span>
          <strong>{overview?.templateFamilies.length ?? 0}</strong>
        </article>
        <article className="template-governance-summary-card">
          <span>Module Templates</span>
          <strong>{overview?.moduleTemplates.length ?? 0}</strong>
        </article>
        <article className="template-governance-summary-card">
          <span>Visible Knowledge</span>
          <strong>{overview?.visibleKnowledgeItems.length ?? 0}</strong>
        </article>
        <article className="template-governance-summary-card">
          <span>Rule Sets</span>
          <strong>{overview?.ruleSets.length ?? 0}</strong>
        </article>
        <article className="template-governance-summary-card">
          <span>Instruction Templates</span>
          <strong>{overview?.instructionTemplates.length ?? 0}</strong>
        </article>
        <article className="template-governance-summary-card">
          <span>Bound Knowledge</span>
          <strong>{overview?.boundKnowledgeItems.length ?? 0}</strong>
        </article>
        <article className="template-governance-summary-card">
          <span>Retrieval Signals</span>
          <strong>{retrievalInsights?.signals.length ?? 0}</strong>
          <small>{formatRetrievalInsightStatus(retrievalInsights?.status ?? "idle")}</small>
        </article>
      </section>

      <div className="template-governance-grid">
        <article className="template-governance-panel">
          <div className="template-governance-panel-header">
            <div>
              <h3>Template Families</h3>
              <p>Create and switch the family that downstream module drafts and knowledge bindings will target.</p>
            </div>
          </div>

          <form className="template-governance-form-grid" onSubmit={handleCreateTemplateFamily}>
            <label className="template-governance-field">
              <span>Manuscript Type</span>
              <select
                value={familyForm.manuscriptType}
                onChange={(event) =>
                  setFamilyForm((current) => ({
                    ...current,
                    manuscriptType: event.target.value as ManuscriptType,
                  }))
                }
              >
                {manuscriptTypes.map((manuscriptType) => (
                  <option key={manuscriptType} value={manuscriptType}>
                    {manuscriptType}
                  </option>
                ))}
              </select>
            </label>
            <label className="template-governance-field">
              <span>Family Name</span>
              <input
                value={familyForm.name}
                onChange={(event) =>
                  setFamilyForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Clinical Study Core"
              />
            </label>
            <div className="template-governance-actions template-governance-actions-full">
              <button type="submit" disabled={isBusy}>
                {isBusy ? "Saving..." : "Create Family Draft"}
              </button>
            </div>
          </form>

          {loadStatus === "loading" && !overview ? (
            <p className="template-governance-empty">Loading template families...</p>
          ) : null}

          {overview?.templateFamilies.length ? (
            <ul className="template-governance-list">
              {overview.templateFamilies.map((family) => {
                const isActive = family.id === overview.selectedTemplateFamilyId;
                return (
                  <li key={family.id}>
                    <button
                      type="button"
                      className={`template-governance-list-button${isActive ? " is-active" : ""}`}
                      onClick={() => handleTemplateFamilySelection(family.id)}
                    >
                      <span>{family.name}</span>
                      <small>
                        {family.manuscript_type} · {family.status}
                      </small>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="template-governance-empty">
              No template families exist yet. Start by creating the family you want to govern.
            </p>
          )}

          {overview?.selectedTemplateFamily ? (
            <form
              className="template-governance-form-grid"
              onSubmit={handleUpdateSelectedTemplateFamily}
            >
              <p className="template-governance-selected-note">
                Editing selected family: <strong>{overview.selectedTemplateFamily.name}</strong>
              </p>
              <label className="template-governance-field">
                <span>Selected Family Name</span>
                <input
                  value={selectedFamilyForm.name}
                  onChange={(event) =>
                    setSelectedFamilyForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Selected family name"
                />
              </label>
              <label className="template-governance-field">
                <span>Status</span>
                <select
                  value={selectedFamilyForm.status}
                  onChange={(event) =>
                    setSelectedFamilyForm((current) => ({
                      ...current,
                      status: event.target.value as TemplateFamilyStatus,
                    }))
                  }
                >
                  {templateFamilyStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <div className="template-governance-actions template-governance-actions-full">
                <button type="submit" disabled={isBusy}>
                  {isBusy ? "Saving..." : "Save Selected Family"}
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    setSelectedFamilyForm({
                      name: overview.selectedTemplateFamily?.name ?? "",
                      status: overview.selectedTemplateFamily?.status ?? "draft",
                    })
                  }
                >
                  Reset Selected Family
                </button>
              </div>
            </form>
          ) : null}
        </article>

        <article className="template-governance-panel template-governance-panel-wide">
          <div className="template-governance-panel-header">
            <div>
              <h3>Rule Workbench</h3>
              <p>
                Author structured medical editorial rules with family-level defaults and
                journal-level overrides from one governed surface.
              </p>
            </div>
          </div>
          <div className="template-governance-rule-layout">
            <RuleAuthoringNavigation
              overview={overview}
              selectedRuleObject={selectedRuleObject}
              selectedModule={ruleSetForm.module}
              journalTemplateForm={journalTemplateForm}
              isBusy={isBusy}
              onJournalScopeChange={handleRuleScopeChange}
              onModuleChange={handleRuleModuleChange}
              onRuleObjectChange={handleRuleObjectChange}
              onSelectRuleSet={handleRuleSetSelection}
              onCreateRuleSet={handleCreateRuleSet}
              onCreateJournalTemplate={handleCreateJournalTemplate}
              onJournalTemplateFormChange={setJournalTemplateForm}
              onActivateJournalTemplate={handleActivateJournalTemplate}
              onArchiveJournalTemplate={handleArchiveJournalTemplate}
              onPublishRuleSet={(ruleSetId) => {
                void handlePublishRuleSet(ruleSetId);
              }}
            />
            <div className="template-governance-rule-layout-main">
              <RuleAuthoringForm
                selectedRuleSet={selectedRuleSet}
                draft={ruleAuthoringDraft}
                isBusy={isBusy}
                onDraftChange={setRuleAuthoringDraft}
                onSubmit={handleSubmitRule}
              />
              <RuleAuthoringExplainability draft={ruleAuthoringDraft} />
              <RuleAuthoringPreviewPanel
                overview={overview}
                draft={ruleAuthoringDraft}
              />
              <RuleAuthoringGrid
                overview={overview}
                selectedRuleSet={selectedRuleSet}
                draft={ruleAuthoringDraft}
              />
            </div>
          </div>
        </article>

        <TemplateGovernanceInstructionPanel
          overview={overview}
          selectedInstructionTemplate={selectedInstructionTemplate}
          instructionTemplateForm={instructionTemplateForm}
          isBusy={isBusy}
          onInstructionTemplateFormChange={setInstructionTemplateForm}
          onSelectInstructionTemplate={handleInstructionTemplateSelection}
          onCreateInstructionTemplate={handleCreateInstructionTemplate}
          onPublishInstructionTemplate={handlePublishInstructionTemplate}
        />

        <article className="template-governance-panel">
          <div className="template-governance-panel-header">
            <div>
              <h3>Module Templates</h3>
              <p>
                Create governed module drafts inside the selected family, then publish the ones ready
                for release.
              </p>
            </div>
          </div>

          {overview?.selectedTemplateFamily ? (
            <>
              <p className="template-governance-selected-note">
                Selected family: <strong>{overview.selectedTemplateFamily.name}</strong> (
                {overview.selectedTemplateFamily.manuscript_type})
              </p>
              {isEditingModuleTemplate ? (
                <p className="template-governance-selected-note">
                  Editing draft: <strong>{selectedModuleTemplate.module}</strong> v
                  {selectedModuleTemplate.version_no}
                </p>
              ) : null}
              <form className="template-governance-form-grid" onSubmit={handleSubmitModuleTemplateDraft}>
                <label className="template-governance-field">
                  <span>Module</span>
                  <select
                    value={moduleForm.module}
                    disabled={isEditingModuleTemplate}
                    onChange={(event) =>
                      setModuleForm((current) => ({
                        ...current,
                        module: event.target.value as ModuleTemplateFormState["module"],
                      }))
                    }
                  >
                    {templateModules.map((module) => (
                      <option key={module} value={module}>
                        {module}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="template-governance-field template-governance-field-full">
                  <span>Prompt</span>
                  <textarea
                    rows={5}
                    value={moduleForm.prompt}
                    onChange={(event) =>
                      setModuleForm((current) => ({ ...current, prompt: event.target.value }))
                    }
                    placeholder="Describe the governed module behavior for this manuscript family."
                  />
                </label>
                <label className="template-governance-field">
                  <span>Checklist</span>
                  <input
                    value={moduleForm.checklist}
                    onChange={(event) =>
                      setModuleForm((current) => ({ ...current, checklist: event.target.value }))
                    }
                    placeholder="comma-separated"
                  />
                </label>
                <label className="template-governance-field">
                  <span>Section Requirements</span>
                  <input
                    value={moduleForm.sectionRequirements}
                    onChange={(event) =>
                      setModuleForm((current) => ({
                        ...current,
                        sectionRequirements: event.target.value,
                      }))
                    }
                    placeholder="comma-separated"
                  />
                </label>
                <div className="template-governance-actions template-governance-actions-full">
                  <button type="submit" disabled={isBusy}>
                    {isBusy
                      ? "Saving..."
                      : isEditingModuleTemplate
                        ? "Save Draft Changes"
                        : "Create Module Draft"}
                  </button>
                  <button type="button" disabled={isBusy} onClick={handleResetModuleTemplateForm}>
                    {isEditingModuleTemplate ? "Cancel Editing" : "Reset Draft Form"}
                  </button>
                </div>
              </form>

              {overview.moduleTemplates.length ? (
                <ul className="template-governance-list">
                  {overview.moduleTemplates.map((moduleTemplate) => (
                    <li key={moduleTemplate.id} className="template-governance-card">
                      <div>
                        <strong>
                          {moduleTemplate.module} · v{moduleTemplate.version_no}
                        </strong>
                        <small>
                          {moduleTemplate.status} · {moduleTemplate.manuscript_type}
                        </small>
                      </div>
                      <p>{moduleTemplate.prompt}</p>
                      <div className="template-governance-chip-row">
                        {(moduleTemplate.checklist ?? []).map((item) => (
                          <span key={item} className="template-governance-chip">
                            {item}
                          </span>
                        ))}
                        {(moduleTemplate.section_requirements ?? []).map((item) => (
                          <span
                            key={item}
                            className="template-governance-chip template-governance-chip-secondary"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                      {moduleTemplate.status === "draft" ? (
                        <div className="template-governance-actions">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleEditModuleTemplate(moduleTemplate.id)}
                          >
                            {selectedModuleTemplateId === moduleTemplate.id
                              ? "Editing Draft"
                              : "Edit Draft"}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handlePublishModuleTemplate(moduleTemplate.id)}
                          >
                            Publish Draft
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="template-governance-empty">
                  This family has no module templates yet.
                </p>
              )}
            </>
          ) : (
            <p className="template-governance-empty">
              Select or create a template family to manage module templates.
            </p>
          )}
        </article>

        <article className="template-governance-panel">
          <div className="template-governance-panel-header">
            <div>
              <h3>Retrieval Quality</h3>
              <p>
                Inspect the latest retrieval-quality evidence for the selected family without
                changing routing or publication behavior.
              </p>
            </div>
          </div>

          <p className="template-governance-selected-note">
            {retrievalInsights?.message ??
              "Retrieval-quality evidence will appear here once a template family is selected."}
          </p>

          {retrievalInsights?.latestRun ? (
            <article className="template-governance-card">
              <strong>Latest Run</strong>
              <small>
                {retrievalInsights.latestRun.module} 路 {retrievalInsights.latestRun.created_at}
              </small>
              <p>
                Gold set {retrievalInsights.latestRun.gold_set_version_id} 路 snapshots{" "}
                {retrievalInsights.latestRun.retrieval_snapshot_ids.length}
              </p>
              <div className="template-governance-chip-row">
                <span className="template-governance-chip">
                  answer relevancy {formatRetrievalMetric(
                    retrievalInsights.latestRun.metric_summary.answer_relevancy,
                  )}
                </span>
                {retrievalInsights.latestRun.metric_summary.context_precision != null ? (
                  <span className="template-governance-chip">
                    context precision{" "}
                    {formatRetrievalMetric(
                      retrievalInsights.latestRun.metric_summary.context_precision,
                    )}
                  </span>
                ) : null}
                {retrievalInsights.latestRun.metric_summary.context_recall != null ? (
                  <span className="template-governance-chip">
                    context recall{" "}
                    {formatRetrievalMetric(
                      retrievalInsights.latestRun.metric_summary.context_recall,
                    )}
                  </span>
                ) : null}
              </div>
            </article>
          ) : (
            <p className="template-governance-empty">
              No retrieval-quality run is currently available for this family.
            </p>
          )}

          {retrievalInsights?.latestSnapshot ? (
            <article className="template-governance-card">
              <strong>Latest Snapshot Summary</strong>
              <small>{retrievalInsights.latestSnapshot.created_at}</small>
              <p>{retrievalInsights.latestSnapshot.query_text}</p>
              <div className="template-governance-chip-row">
                <span className="template-governance-chip">
                  retrieved {retrievalInsights.latestSnapshot.retrieved_count}
                </span>
                <span className="template-governance-chip">
                  reranked {retrievalInsights.latestSnapshot.reranked_count}
                </span>
                {(retrievalInsights.latestSnapshot.top_knowledge_item_ids ?? []).map((itemId) => (
                  <span
                    key={itemId}
                    className="template-governance-chip template-governance-chip-secondary"
                  >
                    {itemId}
                  </span>
                ))}
              </div>
            </article>
          ) : null}

          {retrievalInsights && retrievalInsights.signals.length > 0 ? (
            <div className="template-governance-card">
              <strong>Operator Signals</strong>
              <div className="template-governance-chip-row">
                {retrievalInsights.signals.map((signal) => (
                  <span key={`${signal.kind}-${signal.title}`} className="template-governance-chip">
                    {signal.title}
                  </span>
                ))}
              </div>
              <div className="template-governance-form-grid">
                {retrievalInsights.signals.map((signal) => (
                  <article key={`${signal.kind}-${signal.body}`} className="template-governance-card">
                    <strong>{signal.title}</strong>
                    <small>{signal.kind}</small>
                    <p>{signal.body}</p>
                    <small>
                      Evidence 路 run {signal.evidence.retrieval_run_id ?? "n/a"} 路 snapshot{" "}
                      {signal.evidence.retrieval_snapshot_id ?? "n/a"}
                    </small>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </article>

        <article className="template-governance-panel template-governance-panel-wide">
          <div className="template-governance-panel-header">
            <div>
              <h3>Knowledge Library</h3>
              <p>
                Search knowledge items, inspect what is already bound to the selected family, and
                create or update governed drafts.
              </p>
            </div>
          </div>

          <div className="template-governance-toolbar">
            <label className="template-governance-field">
              <span>Search</span>
              <input
                value={overview?.filters.searchText ?? ""}
                onChange={(event) => handleSearchTextChange(event.target.value)}
                placeholder="title, summary, risk tag, template binding"
              />
            </label>
            <label className="template-governance-field">
              <span>Status</span>
              <select
                value={overview?.filters.knowledgeStatus ?? "all"}
                onChange={(event) =>
                  handleKnowledgeStatusChange(
                    event.target.value as TemplateGovernanceWorkbenchFilters["knowledgeStatus"],
                  )
                }
              >
                {knowledgeStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="template-governance-knowledge-grid">
            <div className="template-governance-knowledge-list">
              <h4>Visible Knowledge</h4>
              {overview?.visibleKnowledgeItems.length ? (
                <ul className="template-governance-list">
                  {overview.visibleKnowledgeItems.map((item) => {
                    const isActive = item.id === overview.selectedKnowledgeItemId;
                    const isBound = overview.boundKnowledgeItems.some(
                      (boundItem) => boundItem.id === item.id,
                    );
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={`template-governance-list-button${isActive ? " is-active" : ""}`}
                          onClick={() => handleKnowledgeItemSelection(item.id)}
                        >
                          <span>{item.title}</span>
                          <small>
                            {item.status} · {item.knowledge_kind}
                            {isBound ? " · bound" : ""}
                          </small>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="template-governance-empty">
                  No knowledge items matched the current filters.
                </p>
              )}
            </div>

            <div className="template-governance-knowledge-detail">
              <h4>Selected Knowledge</h4>
              {selectedKnowledgeItem ? (
                <article className="template-governance-card">
                  <strong>{selectedKnowledgeItem.title}</strong>
                  <small>
                    {selectedKnowledgeItem.status} · {selectedKnowledgeItem.knowledge_kind}
                  </small>
                  <p>{selectedKnowledgeItem.summary ?? selectedKnowledgeItem.canonical_text}</p>
                  <div className="template-governance-chip-row">
                    {(selectedKnowledgeItem.template_bindings ?? []).map((binding) => (
                      <span key={binding} className="template-governance-chip">
                        {binding}
                      </span>
                    ))}
                  </div>
                </article>
              ) : (
                <p className="template-governance-empty">
                  Select a knowledge item to inspect its current governed state.
                </p>
              )}

              <form className="template-governance-form-grid" onSubmit={handleSubmitKnowledgeDraft}>
                <label className="template-governance-field">
                  <span>Title</span>
                  <input
                    value={knowledgeForm.title}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="Knowledge draft title"
                  />
                </label>
                <label className="template-governance-field">
                  <span>Knowledge Kind</span>
                  <select
                    value={knowledgeForm.knowledgeKind}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({
                        ...current,
                        knowledgeKind: event.target.value as KnowledgeKind,
                      }))
                    }
                  >
                    {knowledgeKinds.map((knowledgeKind) => (
                      <option key={knowledgeKind} value={knowledgeKind}>
                        {knowledgeKind}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="template-governance-field template-governance-field-full">
                  <span>Canonical Text</span>
                  <textarea
                    rows={6}
                    value={knowledgeForm.canonicalText}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({
                        ...current,
                        canonicalText: event.target.value,
                      }))
                    }
                    placeholder="Normalized governed knowledge text"
                  />
                </label>
                <label className="template-governance-field template-governance-field-full">
                  <span>Summary</span>
                  <textarea
                    rows={3}
                    value={knowledgeForm.summary}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({ ...current, summary: event.target.value }))
                    }
                    placeholder="Operator-facing short summary"
                  />
                </label>
                <label className="template-governance-field">
                  <span>Module Scope</span>
                  <select
                    value={knowledgeForm.moduleScope}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({
                        ...current,
                        moduleScope: event.target.value as KnowledgeDraftFormState["moduleScope"],
                      }))
                    }
                  >
                    <option value="any">any</option>
                    {templateModules.map((module) => (
                      <option key={module} value={module}>
                        {module}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="template-governance-field">
                  <span>Manuscript Types</span>
                  <input
                    value={knowledgeForm.manuscriptTypes}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({
                        ...current,
                        manuscriptTypes: event.target.value,
                      }))
                    }
                    placeholder="review, clinical_study or any"
                  />
                </label>
                <label className="template-governance-field template-governance-field-full">
                  <span>Template Bindings</span>
                  <input
                    value={knowledgeForm.templateBindings}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({
                        ...current,
                        templateBindings: event.target.value,
                      }))
                    }
                    placeholder="template ids, comma-separated"
                  />
                </label>
                <label className="template-governance-field">
                  <span>Aliases</span>
                  <input
                    value={knowledgeForm.aliases}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({ ...current, aliases: event.target.value }))
                    }
                    placeholder="comma-separated"
                  />
                </label>
                <label className="template-governance-field">
                  <span>Sections</span>
                  <input
                    value={knowledgeForm.sections}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({ ...current, sections: event.target.value }))
                    }
                    placeholder="methods, results"
                  />
                </label>
                <label className="template-governance-field">
                  <span>Risk Tags</span>
                  <input
                    value={knowledgeForm.riskTags}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({ ...current, riskTags: event.target.value }))
                    }
                    placeholder="statistics, ethics"
                  />
                </label>
                <label className="template-governance-field">
                  <span>Discipline Tags</span>
                  <input
                    value={knowledgeForm.disciplineTags}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({
                        ...current,
                        disciplineTags: event.target.value,
                      }))
                    }
                    placeholder="cardiology"
                  />
                </label>
                <label className="template-governance-field">
                  <span>Evidence Level</span>
                  <select
                    value={knowledgeForm.evidenceLevel}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({
                        ...current,
                        evidenceLevel: event.target.value as EvidenceLevel,
                      }))
                    }
                  >
                    {evidenceLevels.map((evidenceLevel) => (
                      <option key={evidenceLevel} value={evidenceLevel}>
                        {evidenceLevel}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="template-governance-field">
                  <span>Source Type</span>
                  <select
                    value={knowledgeForm.sourceType}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({
                        ...current,
                        sourceType: event.target.value as KnowledgeSourceType,
                      }))
                    }
                  >
                    {knowledgeSourceTypes.map((sourceType) => (
                      <option key={sourceType} value={sourceType}>
                        {sourceType}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="template-governance-field template-governance-field-full">
                  <span>Source Link</span>
                  <input
                    value={knowledgeForm.sourceLink}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({
                        ...current,
                        sourceLink: event.target.value,
                      }))
                    }
                    placeholder="https://example.org/source"
                  />
                </label>
                <div className="template-governance-actions template-governance-actions-full">
                  <button type="submit" disabled={isBusy}>
                    {isBusy
                      ? "Saving..."
                      : isEditingDraft
                        ? "Save Draft"
                        : "Create Knowledge Draft"}
                  </button>
                  <button type="button" disabled={isBusy} onClick={handleResetKnowledgeDraft}>
                    Reset Draft Form
                  </button>
                  <button
                    type="button"
                    disabled={isBusy || !isEditingDraft}
                    onClick={() => void handleSubmitForReview()}
                  >
                    Submit Draft for Review
                  </button>
                  <button
                    type="button"
                    disabled={isBusy || !selectedKnowledgeItem}
                    onClick={() => void handleArchiveKnowledgeItem()}
                  >
                    Archive Selected
                  </button>
                </div>
              </form>
            </div>
          </div>
        </article>
      </div>
        </>
      )}
    </section>
  );
}

interface TemplateGovernanceRulesPanelProps {
  overview: TemplateGovernanceWorkbenchOverview | null;
  selectedRuleSet: EditorialRuleSetViewModel | null;
  ruleSetForm: RuleSetFormState;
  ruleForm: RuleDraftFormState;
  isBusy: boolean;
  onRuleSetFormChange: Dispatch<SetStateAction<RuleSetFormState>>;
  onRuleFormChange: Dispatch<SetStateAction<RuleDraftFormState>>;
  onSelectRuleSet: (ruleSetId: string) => void;
  onCreateRuleSet: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSubmitRule: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onPublishRuleSet: (ruleSetId: string) => Promise<void>;
}

function TemplateGovernanceRulesPanel({
  overview,
  selectedRuleSet,
  ruleSetForm,
  ruleForm,
  isBusy,
  onRuleSetFormChange,
  onRuleFormChange,
  onSelectRuleSet,
  onCreateRuleSet,
  onSubmitRule,
  onPublishRuleSet,
}: TemplateGovernanceRulesPanelProps) {
  return (
    <article className="template-governance-panel">
      <div className="template-governance-panel-header">
        <div>
          <h3>Rules</h3>
          <p>
            Author the exact rule source that editing applies and proofreading inspects.
          </p>
        </div>
      </div>

      {overview?.selectedTemplateFamily ? (
        <>
          <p className="template-governance-selected-note">
            Selected family: <strong>{overview.selectedTemplateFamily.name}</strong> (
            {overview.selectedTemplateFamily.manuscript_type})
          </p>
          <form className="template-governance-form-grid" onSubmit={onCreateRuleSet}>
            <label className="template-governance-field">
              <span>Rule Set Module</span>
              <select
                value={ruleSetForm.module}
                onChange={(event) =>
                  onRuleSetFormChange((current) => ({
                    ...current,
                    module: event.target.value as TemplateModule,
                  }))
                }
              >
                {templateModules.map((module) => (
                  <option key={module} value={module}>
                    {module}
                  </option>
                ))}
              </select>
            </label>
            <div className="template-governance-actions template-governance-actions-full">
              <button type="submit" disabled={isBusy}>
                {isBusy ? "Saving..." : "Create Rule Set Draft"}
              </button>
            </div>
          </form>

          {overview.ruleSets.length ? (
            <ul className="template-governance-list">
              {overview.ruleSets.map((ruleSet) => {
                const isActive = ruleSet.id === overview.selectedRuleSetId;
                return (
                  <li key={ruleSet.id}>
                    <button
                      type="button"
                      className={`template-governance-list-button${isActive ? " is-active" : ""}`}
                      onClick={() => onSelectRuleSet(ruleSet.id)}
                    >
                      <span>
                        {ruleSet.module} rule set v{ruleSet.version_no}
                      </span>
                      <small>{ruleSet.status}</small>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="template-governance-empty">
              No rule sets exist for this family yet.
            </p>
          )}

          {selectedRuleSet ? (
            <>
              <article className="template-governance-card">
                <strong>
                  Active Rule Set: {selectedRuleSet.module} v{selectedRuleSet.version_no}
                </strong>
                <small>{selectedRuleSet.status}</small>
                <p>
                  Rules stay structured here so the knowledge projection can remain a readable copy,
                  not the only source of truth.
                </p>
                {selectedRuleSet.status === "draft" ? (
                  <div className="template-governance-actions">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void onPublishRuleSet(selectedRuleSet.id)}
                    >
                      Publish Rule Set
                    </button>
                  </div>
                ) : null}
              </article>

              <form className="template-governance-form-grid" onSubmit={onSubmitRule}>
                <label className="template-governance-field">
                  <span>Order</span>
                  <input
                    value={ruleForm.orderNo}
                    onChange={(event) =>
                      onRuleFormChange((current) => ({
                        ...current,
                        orderNo: event.target.value,
                      }))
                    }
                    placeholder="10"
                  />
                </label>
                <label className="template-governance-field">
                  <span>Rule Type</span>
                  <select
                    value={ruleForm.ruleType}
                    onChange={(event) =>
                      onRuleFormChange((current) => ({
                        ...current,
                        ruleType: event.target.value as EditorialRuleType,
                      }))
                    }
                  >
                    {editorialRuleTypes.map((ruleType) => (
                      <option key={ruleType} value={ruleType}>
                        {ruleType}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="template-governance-field">
                  <span>Execution Mode</span>
                  <select
                    value={ruleForm.executionMode}
                    onChange={(event) =>
                      onRuleFormChange((current) => ({
                        ...current,
                        executionMode: event.target.value as EditorialRuleExecutionMode,
                      }))
                    }
                  >
                    {editorialRuleExecutionModes.map((executionMode) => (
                      <option key={executionMode} value={executionMode}>
                        {executionMode}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="template-governance-field">
                  <span>Confidence Policy</span>
                  <select
                    value={ruleForm.confidencePolicy}
                    onChange={(event) =>
                      onRuleFormChange((current) => ({
                        ...current,
                        confidencePolicy:
                          event.target.value as EditorialRuleConfidencePolicy,
                      }))
                    }
                  >
                    {editorialRuleConfidencePolicies.map((policy) => (
                      <option key={policy} value={policy}>
                        {policy}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="template-governance-field">
                  <span>Severity</span>
                  <select
                    value={ruleForm.severity}
                    onChange={(event) =>
                      onRuleFormChange((current) => ({
                        ...current,
                        severity: event.target.value as EditorialRuleSeverity,
                      }))
                    }
                  >
                    {editorialRuleSeverities.map((severity) => (
                      <option key={severity} value={severity}>
                        {severity}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="template-governance-field">
                  <span>Scope Sections</span>
                  <input
                    value={ruleForm.scopeSections}
                    onChange={(event) =>
                      onRuleFormChange((current) => ({
                        ...current,
                        scopeSections: event.target.value,
                      }))
                    }
                    placeholder="abstract"
                  />
                </label>
                <label className="template-governance-field">
                  <span>Scope Block Kind</span>
                  <input
                    value={ruleForm.scopeBlockKind}
                    onChange={(event) =>
                      onRuleFormChange((current) => ({
                        ...current,
                        scopeBlockKind: event.target.value,
                      }))
                    }
                    placeholder="heading"
                  />
                </label>
                <label className="template-governance-field">
                  <span>Trigger Kind</span>
                  <input
                    value={ruleForm.triggerKind}
                    onChange={(event) =>
                      onRuleFormChange((current) => ({
                        ...current,
                        triggerKind: event.target.value,
                      }))
                    }
                    placeholder="exact_text"
                  />
                </label>
                <label className="template-governance-field">
                  <span>Trigger Text</span>
                  <input
                    value={ruleForm.triggerText}
                    onChange={(event) =>
                      onRuleFormChange((current) => ({
                        ...current,
                        triggerText: event.target.value,
                      }))
                    }
                    placeholder="摘要 目的"
                  />
                </label>
                <label className="template-governance-field">
                  <span>Action Kind</span>
                  <input
                    value={ruleForm.actionKind}
                    onChange={(event) =>
                      onRuleFormChange((current) => ({
                        ...current,
                        actionKind: event.target.value,
                      }))
                    }
                    placeholder="replace_heading"
                  />
                </label>
                <label className="template-governance-field">
                  <span>Action Target</span>
                  <input
                    value={ruleForm.actionTarget}
                    onChange={(event) =>
                      onRuleFormChange((current) => ({
                        ...current,
                        actionTarget: event.target.value,
                      }))
                    }
                    placeholder="（摘要　目的）"
                  />
                </label>
                <label className="template-governance-field">
                  <span>Example Before</span>
                  <input
                    value={ruleForm.exampleBefore}
                    onChange={(event) =>
                      onRuleFormChange((current) => ({
                        ...current,
                        exampleBefore: event.target.value,
                      }))
                    }
                    placeholder="摘要 目的"
                  />
                </label>
                <label className="template-governance-field">
                  <span>Example After</span>
                  <input
                    value={ruleForm.exampleAfter}
                    onChange={(event) =>
                      onRuleFormChange((current) => ({
                        ...current,
                        exampleAfter: event.target.value,
                      }))
                    }
                    placeholder="（摘要　目的）"
                  />
                </label>
                <label className="template-governance-field template-governance-field-full">
                  <span>Manual Review Reason</span>
                  <input
                    value={ruleForm.manualReviewReasonTemplate}
                    onChange={(event) =>
                      onRuleFormChange((current) => ({
                        ...current,
                        manualReviewReasonTemplate: event.target.value,
                      }))
                    }
                    placeholder="medical_meaning_risk"
                  />
                </label>
                <div className="template-governance-actions template-governance-actions-full">
                  <button type="submit" disabled={isBusy || selectedRuleSet.status !== "draft"}>
                    {isBusy ? "Saving..." : "Create Rule Draft"}
                  </button>
                </div>
              </form>

              {overview.rules.length ? (
                <div className="template-governance-stack">
                  {overview.rules.map((rule) => (
                    <article key={rule.id} className="template-governance-card">
                      <strong>
                        {rule.action.kind} · {rule.execution_mode}
                      </strong>
                      <small>
                        {rule.rule_type} · {rule.severity} · {rule.confidence_policy}
                      </small>
                      <div className="template-governance-detail-grid">
                        <div>
                          <span>Trigger</span>
                          <code className="template-governance-code">
                            {JSON.stringify(rule.trigger)}
                          </code>
                        </div>
                        <div>
                          <span>Action</span>
                          <code className="template-governance-code">
                            {JSON.stringify(rule.action)}
                          </code>
                        </div>
                        <div>
                          <span>Example Before</span>
                          <p>{rule.example_before ?? "n/a"}</p>
                        </div>
                        <div>
                          <span>Example After</span>
                          <p>{rule.example_after ?? "n/a"}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="template-governance-empty">
                  No rules exist inside the selected rule set yet.
                </p>
              )}
            </>
          ) : null}
        </>
      ) : (
        <p className="template-governance-empty">
          Select a template family before authoring rule sets and rules.
        </p>
      )}
    </article>
  );
}

interface TemplateGovernanceInstructionPanelProps {
  overview: TemplateGovernanceWorkbenchOverview | null;
  selectedInstructionTemplate: PromptTemplateViewModel | null;
  instructionTemplateForm: InstructionTemplateFormState;
  isBusy: boolean;
  onInstructionTemplateFormChange: Dispatch<SetStateAction<InstructionTemplateFormState>>;
  onSelectInstructionTemplate: (promptTemplateId: string) => void;
  onCreateInstructionTemplate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onPublishInstructionTemplate: (promptTemplateId: string) => Promise<void>;
}

function TemplateGovernanceInstructionPanel({
  overview,
  selectedInstructionTemplate,
  instructionTemplateForm,
  isBusy,
  onInstructionTemplateFormChange,
  onSelectInstructionTemplate,
  onCreateInstructionTemplate,
  onPublishInstructionTemplate,
}: TemplateGovernanceInstructionPanelProps) {
  return (
    <article className="template-governance-panel">
      <div className="template-governance-panel-header">
        <div>
          <h3>AI Instruction Template</h3>
          <p>
            Store bounded AI-readable instructions as fixed sections instead of one uncontrolled
            paragraph.
          </p>
        </div>
      </div>

      {overview?.selectedTemplateFamily ? (
        <>
          <p className="template-governance-selected-note">
            Selected family: <strong>{overview.selectedTemplateFamily.name}</strong> (
            {overview.selectedTemplateFamily.manuscript_type})
          </p>
          <form
            className="template-governance-form-grid"
            onSubmit={onCreateInstructionTemplate}
          >
            <label className="template-governance-field">
              <span>Name</span>
              <input
                value={instructionTemplateForm.name}
                onChange={(event) =>
                  onInstructionTemplateFormChange((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="editing_instruction_mainline"
              />
            </label>
            <label className="template-governance-field">
              <span>Version</span>
              <input
                value={instructionTemplateForm.version}
                onChange={(event) =>
                  onInstructionTemplateFormChange((current) => ({
                    ...current,
                    version: event.target.value,
                  }))
                }
                placeholder="1.0.0"
              />
            </label>
            <label className="template-governance-field">
              <span>Module</span>
              <select
                value={instructionTemplateForm.module}
                onChange={(event) =>
                  onInstructionTemplateFormChange((current) => {
                    const module = event.target.value as InstructionTemplateFormState["module"];
                    return {
                      ...current,
                      module,
                      templateKind: inferPromptTemplateKindFromModule(module),
                    };
                  })
                }
              >
                {editorialInstructionModules.map((module) => (
                  <option key={module} value={module}>
                    {module}
                  </option>
                ))}
              </select>
            </label>
            <label className="template-governance-field">
              <span>Template Kind</span>
              <select
                value={instructionTemplateForm.templateKind}
                onChange={(event) =>
                  onInstructionTemplateFormChange((current) => ({
                    ...current,
                    templateKind: event.target.value as PromptTemplateKind,
                  }))
                }
              >
                {promptTemplateKinds.map((templateKind) => (
                  <option key={templateKind} value={templateKind}>
                    {templateKind}
                  </option>
                ))}
              </select>
            </label>
            <label className="template-governance-field template-governance-field-full">
              <span>System Instructions</span>
              <textarea
                rows={4}
                value={instructionTemplateForm.systemInstructions}
                onChange={(event) =>
                  onInstructionTemplateFormChange((current) => ({
                    ...current,
                    systemInstructions: event.target.value,
                  }))
                }
                placeholder="Apply hard editorial rules before any content rewrite."
              />
            </label>
            <label className="template-governance-field template-governance-field-full">
              <span>Task Frame</span>
              <textarea
                rows={3}
                value={instructionTemplateForm.taskFrame}
                onChange={(event) =>
                  onInstructionTemplateFormChange((current) => ({
                    ...current,
                    taskFrame: event.target.value,
                  }))
                }
                placeholder="Normalize the manuscript while preserving medical meaning."
              />
            </label>
            <label className="template-governance-field template-governance-field-full">
              <span>Hard Rule Summary</span>
              <textarea
                rows={3}
                value={instructionTemplateForm.hardRuleSummary}
                onChange={(event) =>
                  onInstructionTemplateFormChange((current) => ({
                    ...current,
                    hardRuleSummary: event.target.value,
                  }))
                }
                placeholder="摘要 目的 -> （摘要　目的）"
              />
            </label>
            <label className="template-governance-field">
              <span>Allowed Content Operations</span>
              <input
                value={instructionTemplateForm.allowedContentOperations}
                onChange={(event) =>
                  onInstructionTemplateFormChange((current) => ({
                    ...current,
                    allowedContentOperations: event.target.value,
                  }))
                }
                placeholder="sentence_rewrite"
              />
            </label>
            <label className="template-governance-field">
              <span>Forbidden Operations</span>
              <input
                value={instructionTemplateForm.forbiddenOperations}
                onChange={(event) =>
                  onInstructionTemplateFormChange((current) => ({
                    ...current,
                    forbiddenOperations: event.target.value,
                  }))
                }
                placeholder="change_medical_meaning"
              />
            </label>
            <label className="template-governance-field template-governance-field-full">
              <span>Manual Review Policy</span>
              <textarea
                rows={3}
                value={instructionTemplateForm.manualReviewPolicy}
                onChange={(event) =>
                  onInstructionTemplateFormChange((current) => ({
                    ...current,
                    manualReviewPolicy: event.target.value,
                  }))
                }
                placeholder="Escalate uncertain content changes to manual review."
              />
            </label>
            <label className="template-governance-field template-governance-field-full">
              <span>Output Contract</span>
              <textarea
                rows={3}
                value={instructionTemplateForm.outputContract}
                onChange={(event) =>
                  onInstructionTemplateFormChange((current) => ({
                    ...current,
                    outputContract: event.target.value,
                  }))
                }
                placeholder="Return a bounded editing or proofreading payload."
              />
            </label>
            <label className="template-governance-field template-governance-field-full">
              <span>Report Style</span>
              <input
                value={instructionTemplateForm.reportStyle}
                onChange={(event) =>
                  onInstructionTemplateFormChange((current) => ({
                    ...current,
                    reportStyle: event.target.value,
                  }))
                }
                placeholder="clinical_report"
              />
            </label>
            <div className="template-governance-actions template-governance-actions-full">
              <button type="submit" disabled={isBusy}>
                {isBusy ? "Saving..." : "Create AI Instruction Draft"}
              </button>
            </div>
          </form>

          {overview.instructionTemplates.length ? (
            <ul className="template-governance-list">
              {overview.instructionTemplates.map((template) => {
                const isActive = template.id === overview.selectedInstructionTemplateId;
                return (
                  <li key={template.id}>
                    <button
                      type="button"
                      className={`template-governance-list-button${isActive ? " is-active" : ""}`}
                      onClick={() => onSelectInstructionTemplate(template.id)}
                    >
                      <span>{template.name}</span>
                      <small>
                        {template.status} · {template.template_kind ?? "legacy_prompt"}
                      </small>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="template-governance-empty">
              No AI instruction templates match this family yet.
            </p>
          )}

          {selectedInstructionTemplate ? (
            <article className="template-governance-card">
              <strong>{selectedInstructionTemplate.name}</strong>
              <small>
                {selectedInstructionTemplate.status} ·{" "}
                {selectedInstructionTemplate.template_kind ?? "legacy_prompt"}
              </small>
              <div className="template-governance-detail-grid">
                <div>
                  <span>System Instructions</span>
                  <p>{selectedInstructionTemplate.system_instructions ?? "n/a"}</p>
                </div>
                <div>
                  <span>Task Frame</span>
                  <p>{selectedInstructionTemplate.task_frame ?? "n/a"}</p>
                </div>
                <div>
                  <span>Hard Rule Summary</span>
                  <p>{selectedInstructionTemplate.hard_rule_summary ?? "n/a"}</p>
                </div>
                <div>
                  <span>Allowed Content Operations</span>
                  <p>
                    {selectedInstructionTemplate.allowed_content_operations?.join(", ") ??
                      "n/a"}
                  </p>
                </div>
                <div>
                  <span>Forbidden Operations</span>
                  <p>
                    {selectedInstructionTemplate.forbidden_operations?.join(", ") ?? "n/a"}
                  </p>
                </div>
                <div>
                  <span>Manual Review Policy</span>
                  <p>{selectedInstructionTemplate.manual_review_policy ?? "n/a"}</p>
                </div>
                <div className="template-governance-field-full">
                  <span>Output Contract</span>
                  <p>{selectedInstructionTemplate.output_contract ?? "n/a"}</p>
                </div>
              </div>
              {selectedInstructionTemplate.status === "draft" ? (
                <div className="template-governance-actions">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void onPublishInstructionTemplate(selectedInstructionTemplate.id)}
                  >
                    Publish AI Instruction Template
                  </button>
                </div>
              ) : null}
            </article>
          ) : null}
        </>
      ) : (
        <p className="template-governance-empty">
          Select a template family before authoring AI instruction templates.
        </p>
      )}
    </article>
  );
}

function createKnowledgeDraftFormState(input: {
  manuscriptType?: ManuscriptType;
  templateBindings?: string[];
} = {}): KnowledgeDraftFormState {
  return {
    title: "",
    canonicalText: "",
    summary: "",
    knowledgeKind: "rule",
    moduleScope: "any",
    manuscriptTypes: input.manuscriptType ?? "any",
    templateBindings: (input.templateBindings ?? []).join(", "),
    aliases: "",
    sections: "",
    riskTags: "",
    disciplineTags: "",
    evidenceLevel: "unknown",
    sourceType: "other",
    sourceLink: "",
  };
}

function createRuleDraftFormState(): RuleDraftFormState {
  return {
    orderNo: "10",
    ruleType: "format",
    executionMode: "apply_and_inspect",
    scopeSections: "abstract",
    scopeBlockKind: "heading",
    triggerKind: "exact_text",
    triggerText: "",
    actionKind: "replace_heading",
    actionTarget: "",
    confidencePolicy: "always_auto",
    severity: "error",
    exampleBefore: "",
    exampleAfter: "",
    manualReviewReasonTemplate: "",
  };
}

function createInstructionTemplateFormState(): InstructionTemplateFormState {
  return {
    name: "",
    version: "1.0.0",
    module: "editing",
    templateKind: "editing_instruction",
    systemInstructions: "",
    taskFrame: "",
    hardRuleSummary: "",
    allowedContentOperations: "sentence_rewrite",
    forbiddenOperations: "change_medical_meaning",
    manualReviewPolicy: "",
    outputContract: "",
    reportStyle: "",
  };
}

function inferPromptTemplateKindFromModule(
  module: InstructionTemplateFormState["module"],
): PromptTemplateKind {
  return module === "proofreading"
    ? "proofreading_instruction"
    : "editing_instruction";
}

function toModuleTemplateFormState(
  moduleTemplate: Pick<
    ModuleTemplateViewModel,
    "module" | "prompt" | "checklist" | "section_requirements"
  >,
): ModuleTemplateFormState {
  return {
    module: moduleTemplate.module,
    prompt: moduleTemplate.prompt,
    checklist: (moduleTemplate.checklist ?? []).join(", "),
    sectionRequirements: (moduleTemplate.section_requirements ?? []).join(", "),
  };
}

function resolveSelectedModuleTemplate(
  moduleTemplates: readonly ModuleTemplateViewModel[],
  moduleTemplateId: string | null,
): ModuleTemplateViewModel | null {
  if (!moduleTemplateId) {
    return null;
  }

  return moduleTemplates.find((template) => template.id === moduleTemplateId) ?? null;
}

function toKnowledgeDraftFormState(item: {
  title: string;
  canonical_text: string;
  summary?: string;
  knowledge_kind: KnowledgeKind;
  routing: {
    module_scope: string;
    manuscript_types: ManuscriptType[] | "any";
    sections?: string[];
    risk_tags?: string[];
    discipline_tags?: string[];
  };
  aliases?: string[];
  template_bindings?: string[];
  evidence_level?: EvidenceLevel;
  source_type?: KnowledgeSourceType;
  source_link?: string;
}): KnowledgeDraftFormState {
  return {
    title: item.title,
    canonicalText: item.canonical_text,
    summary: item.summary ?? "",
    knowledgeKind: item.knowledge_kind,
    moduleScope: isEditableModuleScope(item.routing.module_scope)
      ? item.routing.module_scope
      : "any",
    manuscriptTypes:
      item.routing.manuscript_types === "any"
        ? "any"
        : item.routing.manuscript_types.join(", "),
    templateBindings: (item.template_bindings ?? []).join(", "),
    aliases: (item.aliases ?? []).join(", "),
    sections: (item.routing.sections ?? []).join(", "),
    riskTags: (item.routing.risk_tags ?? []).join(", "),
    disciplineTags: (item.routing.discipline_tags ?? []).join(", "),
    evidenceLevel: item.evidence_level ?? "unknown",
    sourceType: item.source_type ?? "other",
    sourceLink: item.source_link ?? "",
  };
}

function splitCommaSeparatedValues(value: string): string[] | undefined {
  const values = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return values.length > 0 ? values : undefined;
}

function optionalTrimmedValue(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseManuscriptTypes(value: string): ManuscriptType[] | "any" {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.toLowerCase() === "any") {
    return "any";
  }

  return trimmed
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry): entry is ManuscriptType => manuscriptTypes.includes(entry as ManuscriptType));
}

function isEditableModuleScope(
  value: string,
): value is KnowledgeDraftFormState["moduleScope"] {
  return value === "any" || value === "screening" || value === "editing" || value === "proofreading";
}

function formatRetrievalInsightStatus(status: NonNullable<TemplateGovernanceWorkbenchOverview["retrievalInsights"]>["status"]): string {
  switch (status) {
    case "available":
      return "evidence ready";
    case "partial":
      return "partial evidence";
    case "not_started":
      return "not started";
    case "unavailable":
      return "fail-open";
    case "idle":
    default:
      return "idle";
  }
}

function formatRetrievalMetric(value: number): string {
  return value.toFixed(2);
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof BrowserHttpClientError) {
    const body =
      typeof error.responseBody === "string"
        ? error.responseBody
        : JSON.stringify(error.responseBody);
    return `${fallback}: HTTP ${error.status} ${body}`;
  }

  return error instanceof Error ? error.message : fallback;
}
