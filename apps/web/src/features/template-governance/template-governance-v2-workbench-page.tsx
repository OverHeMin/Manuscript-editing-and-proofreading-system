import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createBrowserHttpClient } from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/index.ts";
import {
  createInlineUploadFields,
  type BrowserUploadFile,
} from "../manuscript-workbench/manuscript-upload-file.ts";
import type {
  RuleCenterMode,
  TemplateGovernanceView,
} from "../../app/workbench-routing.ts";
import type { TransitionEditorialRuleSetInput } from "../editorial-rules/index.ts";
import type { LearningCandidateViewModel } from "../learning-review/index.ts";
import type { ReviewItemViewModel } from "../review-items/index.ts";
import type { GovernedContentModuleClass } from "../templates/index.ts";
import { executeExtractionCandidateAction } from "./template-governance-extraction-candidate-actions.ts";
import { isRuleCenterReviewItem } from "./rule-learning-state.ts";
import {
  createRuleWizardCandidateHandoffViewModel,
  createRuleWizardEntryFormStateFromAiDraft,
  createRuleWizardEntryFormStateFromLearningCandidate,
  isRuleCenterLearningCandidate,
  resolveRuleWizardCandidateTitle,
} from "./template-governance-rule-wizard-handoff.ts";
import {
  createRuleWizardEntryFormState,
  type RuleWizardEntryFormState,
} from "./template-governance-rule-wizard-api.ts";
import type { RuleWizardCandidateHandoffViewModel } from "./template-governance-rule-wizard.tsx";
import type { RuleWizardState } from "./template-governance-rule-wizard-state.ts";
import {
  createTemplateGovernanceWorkbenchController,
  type TemplateGovernanceWorkbenchController,
} from "./template-governance-controller.ts";
import type { TemplateGovernanceCandidateConfirmationFormValues } from "./template-governance-candidate-confirmation-form.tsx";
import type { TemplateGovernanceContentModuleFormValues } from "./template-governance-content-module-form.tsx";
import type { TemplateGovernanceExtractionTaskFormDraft } from "./template-governance-extraction-task-form.tsx";
import type { TemplateGovernanceJournalTemplateFormValues } from "./template-governance-journal-template-form.tsx";
import type { TemplateGovernanceTemplateFormValues } from "./template-governance-template-form.tsx";
import { TemplateGovernanceV2DetailPanel } from "./template-governance-v2-detail-panel.tsx";
import {
  loadTemplateGovernanceV2SectionData,
  type TemplateGovernanceV2SectionData,
} from "./template-governance-v2-data.ts";
import { resolveTemplateGovernanceV2RouteState } from "./template-governance-v2-route.ts";
import { TemplateGovernanceV2Shell } from "./template-governance-v2-shell.tsx";
import type { TemplateGovernanceV2Command } from "./template-governance-v2-command-bar.tsx";
import type {
  TemplateGovernanceV2Panel,
  TemplateGovernanceV2RouteState,
  TemplateGovernanceV2Section,
} from "./template-governance-v2-types.ts";
import { TemplateGovernanceV2WorkQueue } from "./template-governance-v2-work-queue.tsx";
import {
  createV2CandidateConfirmationFormValues,
  createV2ContentModuleFormValues,
  createV2ExtractionTaskDraft,
  createV2JournalTemplateFormValues,
  createV2TemplateFormValues,
  selectV2ContentModule,
  selectV2ExtractionCandidate,
  selectV2TemplateComposition,
  toV2ContentModuleCreateInput,
  toV2ContentModuleFormValues,
  toV2ContentModuleUpdateInput,
  toV2ErrorMessage,
  toV2JournalTemplateFormValues,
  toV2TemplateFormValues,
  validateV2CandidateConfirmationFormValues,
  validateV2ContentModuleFormValues,
  validateV2JournalTemplateFormValues,
  validateV2TemplateFormValues,
} from "./template-governance-v2-workbench-state.ts";

if (typeof document !== "undefined") {
  void import("./template-governance-v2-workbench.css");
}

const defaultController = createTemplateGovernanceWorkbenchController(
  createBrowserHttpClient(),
);

export interface TemplateGovernanceV2WorkbenchPageProps {
  controller?: TemplateGovernanceWorkbenchController;
  actorRole?: AuthRole;
  initialMode?: RuleCenterMode;
  initialView?: TemplateGovernanceView;
  initialSelectedRuleLedgerRowId?: string;
  prefilledManuscriptId?: string;
  prefilledReviewedCaseSnapshotId?: string;
  initialSelectedLearningCandidateId?: string;
  initialSelectedReviewItemId?: string;
  initialLearningCandidates?: readonly LearningCandidateViewModel[];
  initialReviewItems?: readonly ReviewItemViewModel[];
  initialSectionData?: TemplateGovernanceV2SectionData | null;
  advancedCompatibilityPanel?: ReactNode;
}

export function TemplateGovernanceV2WorkbenchPage({
  controller = defaultController,
  actorRole = "admin",
  initialMode,
  initialView = "overview",
  initialSelectedRuleLedgerRowId,
  prefilledManuscriptId,
  prefilledReviewedCaseSnapshotId,
  initialSelectedLearningCandidateId,
  initialSelectedReviewItemId,
  initialLearningCandidates = [],
  initialReviewItems = [],
  initialSectionData = null,
  advancedCompatibilityPanel,
}: TemplateGovernanceV2WorkbenchPageProps) {
  const initialRouteState = useMemo(
    () =>
      resolveTemplateGovernanceV2RouteState({
        templateGovernanceView: initialView,
        ruleCenterMode: initialMode,
        assetId: initialSelectedRuleLedgerRowId,
        learningCandidateId: initialSelectedLearningCandidateId,
        reviewItemId: initialSelectedReviewItemId,
      }),
    [
      initialMode,
      initialSelectedLearningCandidateId,
      initialSelectedReviewItemId,
      initialSelectedRuleLedgerRowId,
      initialView,
    ],
  );
  const [routeState, setRouteState] =
    useState<TemplateGovernanceV2RouteState>(initialRouteState);
  const [sectionData, setSectionData] =
    useState<TemplateGovernanceV2SectionData | null>(initialSectionData);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [aiIntakeDescription, setAiIntakeDescription] = useState("");
  const [aiIntakeResult, setAiIntakeResult] =
    useState<Awaited<ReturnType<TemplateGovernanceWorkbenchController["createRuleAiIntakeDraft"]>> | null>(null);
  const [aiIntakeErrorMessage, setAiIntakeErrorMessage] = useState<string | null>(null);
  const [isAiIntakeGenerating, setIsAiIntakeGenerating] = useState(false);
  const [wizardEntryForm, setWizardEntryForm] = useState<RuleWizardEntryFormState>(() =>
    resolveInitialV2RuleWizardEntryForm({
      initialMode,
      initialSelectedLearningCandidateId,
      initialLearningCandidates,
    }),
  );
  const [wizardTitle, setWizardTitle] = useState<string | undefined>(undefined);
  const [wizardMode, setWizardMode] = useState<RuleWizardState["mode"]>(() =>
    resolveInitialV2RuleWizardMode({
      initialMode,
      initialView,
      initialSelectedLearningCandidateId,
      initialLearningCandidates,
    }),
  );
  const [wizardCandidateHandoff, setWizardCandidateHandoff] =
    useState<RuleWizardCandidateHandoffViewModel | null>(() =>
      resolveInitialV2RuleWizardCandidateHandoff({
        initialMode,
        initialView,
        initialSelectedLearningCandidateId,
        initialLearningCandidates,
        prefilledManuscriptId,
        prefilledReviewedCaseSnapshotId,
      }),
    );
  const [templateFormMode, setTemplateFormMode] = useState<"create" | "edit" | null>(null);
  const [templateFormValues, setTemplateFormValues] =
    useState<TemplateGovernanceTemplateFormValues>(() => createV2TemplateFormValues());
  const [journalFormMode, setJournalFormMode] = useState<"create" | "edit" | null>(null);
  const [journalFormValues, setJournalFormValues] =
    useState<TemplateGovernanceJournalTemplateFormValues>(() =>
      createV2JournalTemplateFormValues(),
    );
  const [templateStatusMessage, setTemplateStatusMessage] = useState<string | null>(null);
  const [templateErrorMessage, setTemplateErrorMessage] = useState<string | null>(null);
  const [isTemplateBusy, setIsTemplateBusy] = useState(false);
  const [packageFormMode, setPackageFormMode] = useState<"create" | "edit" | null>(null);
  const [packageFormValues, setPackageFormValues] =
    useState<TemplateGovernanceContentModuleFormValues>(() =>
      createV2ContentModuleFormValues("general"),
    );
  const [packageStatusMessage, setPackageStatusMessage] = useState<string | null>(null);
  const [packageErrorMessage, setPackageErrorMessage] = useState<string | null>(null);
  const [isPackageBusy, setIsPackageBusy] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskDraft, setTaskDraft] = useState<TemplateGovernanceExtractionTaskFormDraft>(() =>
    createV2ExtractionTaskDraft(),
  );
  const [originalFile, setOriginalFile] = useState<BrowserUploadFile | null>(null);
  const [editedFile, setEditedFile] = useState<BrowserUploadFile | null>(null);
  const [candidateFormOpen, setCandidateFormOpen] = useState(false);
  const [candidateFormValues, setCandidateFormValues] =
    useState<TemplateGovernanceCandidateConfirmationFormValues>(() =>
      createV2CandidateConfirmationFormValues(),
    );
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [extractionStatusMessage, setExtractionStatusMessage] = useState<string | null>(null);
  const [extractionErrorMessage, setExtractionErrorMessage] = useState<string | null>(null);
  const [isExtractionBusy, setIsExtractionBusy] = useState(false);
  const [releaseStatusMessage, setReleaseStatusMessage] = useState<string | null>(null);
  const [releaseErrorMessage, setReleaseErrorMessage] = useState<string | null>(null);
  const [isReleaseBusy, setIsReleaseBusy] = useState(false);

  useEffect(() => {
    setRouteState(initialRouteState);
    setSectionData(initialSectionData);
    setLoadError(null);
  }, [initialRouteState, initialSectionData]);

  useEffect(() => {
    if (initialSectionData) {
      return;
    }

    let isMounted = true;
    void loadTemplateGovernanceV2SectionData(controller, routeState)
      .then((nextData) => {
        if (isMounted) {
          setSectionData(nextData);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setLoadError(error instanceof Error ? error.message : "规则中心加载失败。");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [controller, initialSectionData, routeState]);

  const counts = createSectionCounts(sectionData, {
    initialLearningCandidates,
    initialReviewItems,
  });

  function handleSectionChange(section: TemplateGovernanceV2Section) {
    setRouteState(createRouteStateForSection(section));
    setSectionData(null);
    resetTransientPanels();
  }

  function handleCommand(command: TemplateGovernanceV2Command) {
    setRouteState(createRouteStateForCommand(command));
    setSectionData(null);
    resetTransientPanels();
  }

  function handleSelectItem(input: {
    selectedKind: TemplateGovernanceV2RouteState["selectedKind"];
    selectedId: string;
    panel: TemplateGovernanceV2Panel;
  }) {
    setRouteState({
      ...routeState,
      panel: input.panel,
      selectedKind: input.selectedKind,
      selectedId: input.selectedId,
    });
    setSectionData(null);
    resetTransientPanels();
  }

  const selectedExtractionCandidate =
    sectionData?.section === "extraction"
      ? selectV2ExtractionCandidate(
          sectionData.ledger.selectedTask?.candidates ?? [],
          selectedCandidateId,
        )
      : null;

  function resetTransientPanels() {
    setTemplateFormMode(null);
    setJournalFormMode(null);
    setPackageFormMode(null);
    setTaskFormOpen(false);
    setCandidateFormOpen(false);
    setTemplateStatusMessage(null);
    setTemplateErrorMessage(null);
    setPackageStatusMessage(null);
    setPackageErrorMessage(null);
    setExtractionStatusMessage(null);
    setExtractionErrorMessage(null);
    setReleaseStatusMessage(null);
    setReleaseErrorMessage(null);
  }

  async function refreshSectionData(nextRouteState: TemplateGovernanceV2RouteState = routeState) {
    const nextData = await loadTemplateGovernanceV2SectionData(controller, nextRouteState);
    setSectionData(nextData);
    setLoadError(null);
    return nextData;
  }

  async function handleGenerateRuleAiDraft() {
    const description = aiIntakeDescription.trim();
    if (!description) {
      setAiIntakeErrorMessage("请先输入规则描述。");
      return;
    }

    setIsAiIntakeGenerating(true);
    setAiIntakeErrorMessage(null);

    try {
      const result = await controller.createRuleAiIntakeDraft({
        source_kind: "manual_description",
        description,
      });
      setAiIntakeResult(result);
    } catch (error) {
      setAiIntakeErrorMessage(toV2ErrorMessage(error, "AI 规则草稿生成失败"));
    } finally {
      setIsAiIntakeGenerating(false);
    }
  }

  function handleApplyRuleAiDraft() {
    if (!aiIntakeResult) {
      return;
    }

    setWizardEntryForm(createRuleWizardEntryFormStateFromAiDraft(aiIntakeResult));
    setWizardTitle("AI 生成规则草稿");
    setWizardMode("create");
    setWizardCandidateHandoff(null);
    setRouteState({
      section: "rules",
      panel: "rule-wizard",
      selectedKind: "none",
      selectedId: undefined,
      subtype: undefined,
    });
    setSectionData(null);
  }

  function handleOpenTemplateCreateForm() {
    if (sectionData?.section !== "templates") {
      return;
    }

    setTemplateStatusMessage(null);
    setTemplateErrorMessage(null);
    if (sectionData.subtype === "journal") {
      setTemplateFormMode(null);
      setJournalFormMode("create");
      setJournalFormValues(
        createV2JournalTemplateFormValues(
          sectionData.overview.selectedTemplateFamilyId ??
            sectionData.overview.templateFamilies[0]?.id ??
            "",
        ),
      );
      return;
    }

    setJournalFormMode(null);
    setTemplateFormMode("create");
    setTemplateFormValues(createV2TemplateFormValues());
  }

  function handleOpenTemplateEditForm() {
    if (sectionData?.section !== "templates") {
      return;
    }

    setTemplateStatusMessage(null);
    setTemplateErrorMessage(null);
    if (sectionData.subtype === "journal") {
      const selectedTemplate =
        sectionData.overview.selectedJournalTemplateProfile ??
        sectionData.overview.journalTemplateProfiles[0] ??
        null;
      if (!selectedTemplate) {
        setTemplateErrorMessage("请先在台账中选择一个期刊模板。");
        return;
      }
      setTemplateFormMode(null);
      setJournalFormMode("edit");
      setJournalFormValues(toV2JournalTemplateFormValues(selectedTemplate));
      return;
    }

    const selectedTemplate =
      sectionData.ledger.selectedTemplate ?? sectionData.ledger.templates[0] ?? null;
    if (!selectedTemplate) {
      setTemplateErrorMessage("请先在台账中选择一个模板。");
      return;
    }
    setJournalFormMode(null);
    setTemplateFormMode("edit");
    setTemplateFormValues(
      toV2TemplateFormValues(
        selectedTemplate,
        sectionData.ledger.generalModules,
        sectionData.ledger.medicalModules,
      ),
    );
  }

  async function handleArchiveTemplate() {
    if (sectionData?.section !== "templates") {
      return;
    }

    setIsTemplateBusy(true);
    setTemplateStatusMessage(null);
    setTemplateErrorMessage(null);

    try {
      if (sectionData.subtype === "journal") {
        const selectedTemplate =
          sectionData.overview.selectedJournalTemplateProfile ??
          sectionData.overview.journalTemplateProfiles[0] ??
          null;
        if (!selectedTemplate) {
          setTemplateErrorMessage("请先在台账中选择一个期刊模板。");
          return;
        }
        const { overview } = await controller.archiveJournalTemplateProfileAndReload({
          journalTemplateProfileId: selectedTemplate.id,
          actorRole,
          selectedTemplateFamilyId: sectionData.overview.selectedTemplateFamilyId,
          selectedJournalTemplateId: null,
        });
        setSectionData({ section: "templates", subtype: "journal", overview });
        setTemplateStatusMessage(`期刊模板已删除：${selectedTemplate.journal_name}`);
        setJournalFormMode(null);
        return;
      }

      const selectedTemplate =
        sectionData.ledger.selectedTemplate ?? sectionData.ledger.templates[0] ?? null;
      if (!selectedTemplate) {
        setTemplateErrorMessage("请先在台账中选择一个模板。");
        return;
      }
      const { templateComposition, ledger } =
        await controller.updateTemplateCompositionDraftAndReload({
          templateCompositionId: selectedTemplate.id,
          selectedTemplateId: null,
          input: {
            status: "archived",
          },
        });
      setSectionData({ section: "templates", subtype: "large", ledger });
      setTemplateStatusMessage(`模板已删除：${templateComposition.name}`);
      setTemplateFormMode(null);
    } catch (error) {
      setTemplateErrorMessage(toV2ErrorMessage(error, "删除模板失败"));
    } finally {
      setIsTemplateBusy(false);
    }
  }

  async function handleActivateJournalTemplate() {
    if (sectionData?.section !== "templates" || sectionData.subtype !== "journal") {
      return;
    }
    const selectedTemplate =
      sectionData.overview.selectedJournalTemplateProfile ??
      sectionData.overview.journalTemplateProfiles[0] ??
      null;
    if (!selectedTemplate) {
      setTemplateErrorMessage("请先在台账中选择一个期刊模板。");
      return;
    }

    setIsTemplateBusy(true);
    setTemplateStatusMessage(null);
    setTemplateErrorMessage(null);

    try {
      const { overview } = await controller.activateJournalTemplateProfileAndReload({
        journalTemplateProfileId: selectedTemplate.id,
        actorRole,
        selectedTemplateFamilyId: sectionData.overview.selectedTemplateFamilyId,
        selectedJournalTemplateId: selectedTemplate.id,
      });
      setSectionData({ section: "templates", subtype: "journal", overview });
      setTemplateStatusMessage(`期刊模板已启用：${selectedTemplate.journal_name}`);
    } catch (error) {
      setTemplateErrorMessage(toV2ErrorMessage(error, "启用期刊模板失败"));
    } finally {
      setIsTemplateBusy(false);
    }
  }

  async function handleTemplateFormSubmit() {
    if (sectionData?.section !== "templates" || sectionData.subtype !== "large") {
      return;
    }
    const validatedInput = validateV2TemplateFormValues(templateFormValues, sectionData.ledger);
    if ("error" in validatedInput) {
      setTemplateErrorMessage(validatedInput.error);
      return;
    }

    setIsTemplateBusy(true);
    setTemplateStatusMessage(null);
    setTemplateErrorMessage(null);

    try {
      if (templateFormMode === "edit" && sectionData.ledger.selectedTemplate) {
        const { templateComposition, ledger } =
          await controller.updateTemplateCompositionDraftAndReload({
            templateCompositionId: sectionData.ledger.selectedTemplate.id,
            selectedTemplateId: sectionData.ledger.selectedTemplate.id,
            input: validatedInput.updateInput,
          });
        setSectionData({ section: "templates", subtype: "large", ledger });
        setTemplateStatusMessage(`模板已更新：${templateComposition.name}`);
      } else {
        const { templateComposition, ledger } =
          await controller.createTemplateCompositionDraftAndReload(
            validatedInput.createInput,
          );
        setSectionData({ section: "templates", subtype: "large", ledger });
        setTemplateStatusMessage(`模板已创建：${templateComposition.name}`);
      }
      setTemplateFormMode(null);
    } catch (error) {
      setTemplateErrorMessage(toV2ErrorMessage(error, "保存模板失败"));
    } finally {
      setIsTemplateBusy(false);
    }
  }

  async function handleJournalFormSubmit() {
    if (sectionData?.section !== "templates" || sectionData.subtype !== "journal") {
      return;
    }
    const validationMessage = validateV2JournalTemplateFormValues(journalFormValues);
    if (validationMessage) {
      setTemplateErrorMessage(validationMessage);
      return;
    }

    setIsTemplateBusy(true);
    setTemplateStatusMessage(null);
    setTemplateErrorMessage(null);

    try {
      if (journalFormMode === "edit" && sectionData.overview.selectedJournalTemplateProfile) {
        const { overview, journalTemplateProfile } =
          await controller.updateJournalTemplateProfileAndReload({
            journalTemplateProfileId: sectionData.overview.selectedJournalTemplateProfile.id,
            input: {
              journalName: journalFormValues.journalName.trim(),
              journalKey: journalFormValues.journalKey.trim(),
              journalFormatTargetModel: journalFormValues.targetModel,
            },
            selectedTemplateFamilyId: journalFormValues.templateFamilyId.trim(),
            selectedJournalTemplateId: sectionData.overview.selectedJournalTemplateProfile.id,
          });
        setSectionData({ section: "templates", subtype: "journal", overview });
        setTemplateStatusMessage(`期刊模板已更新：${journalTemplateProfile.journal_name}`);
      } else {
        const selectedFamily = sectionData.overview.templateFamilies.find(
          (family) => family.id === journalFormValues.templateFamilyId.trim(),
        );
        const { overview, journalTemplateProfile } =
          await controller.createJournalTemplateProfileAndReload({
            templateFamilyId: journalFormValues.templateFamilyId.trim(),
            manuscriptType:
              selectedFamily?.manuscript_type ??
              sectionData.overview.selectedTemplateFamily?.manuscript_type ??
              "other",
            journalName: journalFormValues.journalName.trim(),
            journalKey: journalFormValues.journalKey.trim(),
            selectedTemplateFamilyId: journalFormValues.templateFamilyId.trim(),
            selectedJournalTemplateId: null,
          });
        setSectionData({ section: "templates", subtype: "journal", overview });
        setTemplateStatusMessage(`期刊模板已创建：${journalTemplateProfile.journal_name}`);
      }
      setJournalFormMode(null);
    } catch (error) {
      setTemplateErrorMessage(toV2ErrorMessage(error, "保存期刊模板失败"));
    } finally {
      setIsTemplateBusy(false);
    }
  }

  function resolvePackageModuleClass(): GovernedContentModuleClass {
    return routeState.subtype === "medical" ? "medical_specialized" : "general";
  }

  function handleOpenPackageCreateForm() {
    const moduleClass = resolvePackageModuleClass();
    setPackageStatusMessage(null);
    setPackageErrorMessage(null);
    setPackageFormMode("create");
    setPackageFormValues(createV2ContentModuleFormValues(moduleClass));
  }

  function handleOpenPackageEditForm() {
    if (sectionData?.section !== "packages") {
      return;
    }
    const selectedModule = sectionData.ledger.selectedModule ?? sectionData.ledger.modules[0] ?? null;
    if (!selectedModule) {
      setPackageErrorMessage("请先在台账中选择一个模块。");
      return;
    }
    setPackageStatusMessage(null);
    setPackageErrorMessage(null);
    setPackageFormMode("edit");
    setPackageFormValues(toV2ContentModuleFormValues(selectedModule));
  }

  async function handleArchivePackage() {
    if (sectionData?.section !== "packages") {
      return;
    }
    const selectedModule = sectionData.ledger.selectedModule ?? sectionData.ledger.modules[0] ?? null;
    if (!selectedModule) {
      setPackageErrorMessage("请先在台账中选择一个模块。");
      return;
    }

    setIsPackageBusy(true);
    setPackageStatusMessage(null);
    setPackageErrorMessage(null);

    try {
      const { contentModule, ledger } = await controller.updateContentModuleDraftAndReload({
        contentModuleId: selectedModule.id,
        moduleClass: resolvePackageModuleClass(),
        selectedModuleId: null,
        input: {
          status: "archived",
        },
      });
      setSectionData({
        section: "packages",
        subtype: routeState.subtype === "medical" ? "medical" : "general",
        ledger,
      });
      setPackageStatusMessage(`模块已删除：${contentModule.name}`);
      setPackageFormMode(null);
    } catch (error) {
      setPackageErrorMessage(toV2ErrorMessage(error, "删除模块失败"));
    } finally {
      setIsPackageBusy(false);
    }
  }

  async function handlePackageFormSubmit() {
    if (sectionData?.section !== "packages") {
      return;
    }
    const validationMessage = validateV2ContentModuleFormValues(packageFormValues);
    if (validationMessage) {
      setPackageErrorMessage(validationMessage);
      return;
    }

    const moduleClass = resolvePackageModuleClass();
    setIsPackageBusy(true);
    setPackageStatusMessage(null);
    setPackageErrorMessage(null);

    try {
      if (packageFormMode === "edit" && sectionData.ledger.selectedModule) {
        const { contentModule, ledger } =
          await controller.updateContentModuleDraftAndReload({
            contentModuleId: sectionData.ledger.selectedModule.id,
            moduleClass,
            selectedModuleId: sectionData.ledger.selectedModule.id,
            input: toV2ContentModuleUpdateInput(packageFormValues),
          });
        setSectionData({
          section: "packages",
          subtype: routeState.subtype === "medical" ? "medical" : "general",
          ledger,
        });
        setPackageStatusMessage(`模块已更新：${contentModule.name}`);
      } else {
        const { contentModule, ledger } = await controller.createContentModuleDraftAndReload(
          toV2ContentModuleCreateInput(packageFormValues, moduleClass),
        );
        setSectionData({
          section: "packages",
          subtype: routeState.subtype === "medical" ? "medical" : "general",
          ledger,
        });
        setPackageStatusMessage(`模块已创建：${contentModule.name}`);
      }
      setPackageFormMode(null);
    } catch (error) {
      setPackageErrorMessage(toV2ErrorMessage(error, "保存模块失败"));
    } finally {
      setIsPackageBusy(false);
    }
  }

  function handleOpenPackageDefaultRules() {
    setRouteState({
      section: "rules",
      panel: "none",
      selectedKind: "none",
      selectedId: undefined,
      subtype: undefined,
    });
    setSectionData(null);
  }

  function handleOpenExtractionTaskForm() {
    setTaskFormOpen(true);
    setCandidateFormOpen(false);
    setTaskDraft(createV2ExtractionTaskDraft());
    setOriginalFile(null);
    setEditedFile(null);
    setExtractionStatusMessage(null);
    setExtractionErrorMessage(null);
  }

  function handleOpenCandidateForm() {
    if (!selectedExtractionCandidate) {
      setExtractionErrorMessage("请先选择一个候选，再确认 AI 语义。");
      return;
    }
    setTaskFormOpen(false);
    setCandidateFormOpen(true);
    setCandidateFormValues(createV2CandidateConfirmationFormValues(selectedExtractionCandidate));
    setExtractionStatusMessage(null);
    setExtractionErrorMessage(null);
  }

  function handleOriginalFileSelect(file: BrowserUploadFile | null) {
    setOriginalFile(file);
    setTaskDraft((current) => ({
      ...current,
      originalFileLabel: file?.name,
    }));
  }

  function handleEditedFileSelect(file: BrowserUploadFile | null) {
    setEditedFile(file);
    setTaskDraft((current) => ({
      ...current,
      editedFileLabel: file?.name,
    }));
  }

  async function handleTaskFormSubmit() {
    if (taskDraft.taskName.trim().length === 0) {
      setExtractionErrorMessage("请先填写提取任务名称。");
      return;
    }
    if (!originalFile || !editedFile) {
      setExtractionErrorMessage("请同时上传原稿和编辑稿。");
      return;
    }

    setIsExtractionBusy(true);
    setExtractionStatusMessage(null);
    setExtractionErrorMessage(null);

    try {
      const { task, ledger } = await controller.createExtractionTaskAndReload({
        taskName: taskDraft.taskName.trim(),
        manuscriptType: taskDraft.manuscriptType,
        ...(taskDraft.journalKey.trim()
          ? { journalKey: taskDraft.journalKey.trim() }
          : {}),
        originalFile: await createInlineUploadFields(originalFile),
        editedFile: await createInlineUploadFields(editedFile),
      });
      setSectionData({ section: "extraction", ledger });
      setSelectedCandidateId(task.candidates[0]?.id ?? null);
      setTaskFormOpen(false);
      setTaskDraft(createV2ExtractionTaskDraft(task.manuscript_type));
      setOriginalFile(null);
      setEditedFile(null);
      setExtractionStatusMessage(`提取任务已创建：${task.task_name}`);
    } catch (error) {
      setExtractionErrorMessage(toV2ErrorMessage(error, "创建提取任务失败"));
    } finally {
      setIsExtractionBusy(false);
    }
  }

  async function handleCandidateAction(
    confirmationStatus: TemplateGovernanceCandidateConfirmationFormValues["confirmationStatus"],
    successMessage: string,
  ) {
    if (sectionData?.section !== "extraction" || !sectionData.ledger.selectedTask || !selectedExtractionCandidate) {
      setExtractionErrorMessage("请先选择候选，再执行确认。");
      return;
    }
    const validationMessage = validateV2CandidateConfirmationFormValues(candidateFormValues);
    if (validationMessage) {
      setExtractionErrorMessage(validationMessage);
      return;
    }

    setIsExtractionBusy(true);
    setExtractionStatusMessage(null);
    setExtractionErrorMessage(null);

    try {
      const result = await executeExtractionCandidateAction({
        controller,
        taskId: sectionData.ledger.selectedTask.id,
        candidate: selectedExtractionCandidate,
        values: candidateFormValues,
        confirmationStatus,
        successMessage,
      });
      setSectionData({ section: "extraction", ledger: result.ledger });
      if (result.errorMessage) {
        setExtractionErrorMessage(result.errorMessage);
        return;
      }
      setCandidateFormOpen(false);
      setExtractionStatusMessage(result.statusMessage ?? successMessage);
    } catch (error) {
      setExtractionErrorMessage(toV2ErrorMessage(error, "候选语义确认失败"));
    } finally {
      setIsExtractionBusy(false);
    }
  }

  function handleConvertExtractionToDraft() {
    setRouteState({
      section: "rules",
      panel: "rule-wizard",
      selectedKind: "none",
      selectedId: undefined,
      subtype: undefined,
    });
    setWizardTitle(selectedExtractionCandidate?.title ?? "提取候选规则草稿");
    setWizardMode("create");
    setWizardCandidateHandoff(null);
    setWizardEntryForm((current) => ({
      ...current,
      title: selectedExtractionCandidate?.title ?? current.title,
      ruleBody:
        selectedExtractionCandidate?.semantic_draft_payload.semantic_summary ??
        current.ruleBody,
      sourceBasis:
        selectedExtractionCandidate?.semantic_draft_payload.applicability.join("\n") ??
        current.sourceBasis,
    }));
    setSectionData(null);
  }

  async function handleTransitionRuleSet(
    transition: Omit<TransitionEditorialRuleSetInput, "actorRole">,
  ) {
    if (sectionData?.section !== "release") {
      return;
    }
    const selectedRuleSet = sectionData.overview.selectedRuleSet ?? sectionData.overview.ruleSets[0];
    if (!selectedRuleSet) {
      setReleaseErrorMessage("请先选择一个规则集。");
      return;
    }

    setIsReleaseBusy(true);
    setReleaseStatusMessage(null);
    setReleaseErrorMessage(null);

    try {
      const { overview } = await controller.transitionRuleSetAndReload({
        ruleSetId: selectedRuleSet.id,
        transition: {
          actorRole,
          ...transition,
        },
        selectedTemplateFamilyId: sectionData.overview.selectedTemplateFamilyId,
        selectedJournalTemplateId: sectionData.overview.selectedJournalTemplateId,
        selectedRuleSetId: selectedRuleSet.id,
      });
      setSectionData({ section: "release", overview });
      setReleaseStatusMessage("规则发布轨道已更新。");
    } catch (error) {
      setReleaseErrorMessage(toV2ErrorMessage(error, "规则发布轨道更新失败"));
    } finally {
      setIsReleaseBusy(false);
    }
  }

  return (
    <TemplateGovernanceV2Shell
      activeSection={routeState.section}
      activePanel={routeState.panel}
      counts={counts}
      onSectionChange={handleSectionChange}
      onCommand={handleCommand}
      detailPanel={
        <TemplateGovernanceV2DetailPanel
          controller={controller}
          actorRole={actorRole}
          data={sectionData}
          routeState={routeState}
          aiIntakeState={{
            description: aiIntakeDescription,
            result: aiIntakeResult,
            isGenerating: isAiIntakeGenerating,
            errorMessage: aiIntakeErrorMessage,
            onDescriptionChange: setAiIntakeDescription,
            onGenerate: () => {
              void handleGenerateRuleAiDraft();
            },
            onApplyResult: handleApplyRuleAiDraft,
          }}
          templateActionState={{
            formMode: templateFormMode,
            formValues: templateFormValues,
            journalFormMode,
            journalFormValues,
            isBusy: isTemplateBusy,
            statusMessage: templateStatusMessage,
            errorMessage: templateErrorMessage,
            onOpenCreateForm: handleOpenTemplateCreateForm,
            onOpenEditForm: handleOpenTemplateEditForm,
            onArchiveSelected: () => {
              void handleArchiveTemplate();
            },
            onActivateSelected: () => {
              void handleActivateJournalTemplate();
            },
            onFormChange: setTemplateFormValues,
            onFormCancel: () => {
              setTemplateFormMode(null);
            },
            onFormSubmit: () => {
              void handleTemplateFormSubmit();
            },
            onJournalFormChange: setJournalFormValues,
            onJournalFormCancel: () => {
              setJournalFormMode(null);
            },
            onJournalFormSubmit: () => {
              void handleJournalFormSubmit();
            },
          }}
          packageActionState={{
            formMode: packageFormMode,
            formValues: packageFormValues,
            isBusy: isPackageBusy,
            statusMessage: packageStatusMessage,
            errorMessage: packageErrorMessage,
            onOpenCreateForm: handleOpenPackageCreateForm,
            onOpenEditForm: handleOpenPackageEditForm,
            onArchiveSelected: () => {
              void handleArchivePackage();
            },
            onOpenDefaultRules: handleOpenPackageDefaultRules,
            onFormChange: setPackageFormValues,
            onFormCancel: () => {
              setPackageFormMode(null);
            },
            onFormSubmit: () => {
              void handlePackageFormSubmit();
            },
          }}
          extractionActionState={{
            taskFormOpen,
            taskDraft,
            candidateFormOpen,
            candidateFormValues,
            selectedCandidate: selectedExtractionCandidate,
            isBusy: isExtractionBusy,
            statusMessage: extractionStatusMessage,
            errorMessage: extractionErrorMessage,
            onOpenTaskForm: handleOpenExtractionTaskForm,
            onOpenCandidateForm: handleOpenCandidateForm,
            onTaskDraftChange: setTaskDraft,
            onOriginalFileSelect: handleOriginalFileSelect,
            onEditedFileSelect: handleEditedFileSelect,
            onTaskFormCancel: () => {
              setTaskFormOpen(false);
            },
            onTaskFormSubmit: () => {
              void handleTaskFormSubmit();
            },
            onCandidateFormChange: setCandidateFormValues,
            onCandidateFormCancel: () => {
              setCandidateFormOpen(false);
            },
            onCandidateHold: () => {
              void handleCandidateAction("held", "候选已暂存，后续可继续修改 AI 语义。");
            },
            onCandidateReject: () => {
              void handleCandidateAction("rejected", "候选已驳回。");
            },
            onCandidateConfirm: () => {
              void handleCandidateAction("confirmed", "候选已确认入库。");
            },
            onConvertToDraft: handleConvertExtractionToDraft,
          }}
          releaseActionState={{
            isBusy: isReleaseBusy,
            statusMessage: releaseStatusMessage,
            errorMessage: releaseErrorMessage,
            onTransitionRuleSet: (transition) => {
              void handleTransitionRuleSet(transition);
            },
          }}
          prefilledManuscriptId={prefilledManuscriptId}
          prefilledReviewedCaseSnapshotId={prefilledReviewedCaseSnapshotId}
          initialSelectedLearningCandidateId={initialSelectedLearningCandidateId}
          initialSelectedReviewItemId={initialSelectedReviewItemId}
          advancedCompatibilityPanel={advancedCompatibilityPanel}
          onCloseRuleWizard={() => {
            setRouteState(createRouteStateForSection("rules"));
          }}
          onRuleWizardComplete={() => {
            setRouteState(createRouteStateForSection("rules"));
            setSectionData(null);
          }}
          ruleWizardEntryForm={wizardEntryForm}
          ruleWizardTitle={wizardTitle}
          ruleWizardMode={wizardMode}
          ruleWizardCandidateHandoff={wizardCandidateHandoff}
        />
      }
    >
      {loadError ? (
        <p className="template-governance-error" role="alert">
          {loadError}
        </p>
      ) : null}
      <TemplateGovernanceV2WorkQueue
        data={sectionData}
        routeState={routeState}
        onSelectItem={handleSelectItem}
      />
    </TemplateGovernanceV2Shell>
  );
}

function createSectionCounts(
  data: TemplateGovernanceV2SectionData | null,
  input: {
    initialLearningCandidates: readonly LearningCandidateViewModel[];
    initialReviewItems: readonly ReviewItemViewModel[];
  },
): Partial<Record<TemplateGovernanceV2Section, number>> {
  if (!data) {
    return {
      recovery:
        input.initialLearningCandidates.filter(isRuleCenterLearningCandidate).length +
        input.initialReviewItems.filter(isRuleCenterReviewItem).length,
    };
  }

  switch (data.section) {
    case "rules":
      return { rules: data.ledger.rows.length };
    case "templates":
      return {
        templates:
          data.subtype === "large"
            ? data.ledger.templates.length
            : data.overview.journalTemplateProfiles.length,
      };
    case "packages":
      return { packages: data.ledger.modules.length };
    case "extraction":
      return { extraction: data.ledger.tasks.length };
    case "recovery":
      return { recovery: data.candidates.length + data.reviewItems.length };
    case "release":
      return { release: data.overview.ruleSets.length };
    case "dashboard":
      return {
        dashboard:
          data.overview.ruleSets.length +
          data.overview.templateFamilies.length +
          data.overview.journalTemplateProfiles.length,
      };
    default:
      return {};
  }
}

function createRouteStateForSection(
  section: TemplateGovernanceV2Section,
): TemplateGovernanceV2RouteState {
  return {
    section,
    panel: resolveDefaultPanelForSection(section),
    selectedKind: "none",
    selectedId: undefined,
    subtype:
      section === "templates" ? "large" : section === "packages" ? "general" : undefined,
  };
}

function resolveInitialV2RuleWizardMode(input: {
  initialMode?: RuleCenterMode;
  initialView: TemplateGovernanceView;
  initialSelectedLearningCandidateId?: string;
  initialLearningCandidates: readonly LearningCandidateViewModel[];
}): RuleWizardState["mode"] {
  if (input.initialView !== "authoring" && input.initialMode !== "authoring") {
    return "create";
  }

  return resolveInitialV2LearningCandidate(input) ? "candidate" : "create";
}

function resolveInitialV2RuleWizardEntryForm(input: {
  initialMode?: RuleCenterMode;
  initialSelectedLearningCandidateId?: string;
  initialLearningCandidates: readonly LearningCandidateViewModel[];
}): RuleWizardEntryFormState {
  const candidate = resolveInitialV2LearningCandidate(input);
  return candidate
    ? createRuleWizardEntryFormStateFromLearningCandidate(candidate)
    : createRuleWizardEntryFormState();
}

function resolveInitialV2RuleWizardCandidateHandoff(input: {
  initialMode?: RuleCenterMode;
  initialView: TemplateGovernanceView;
  initialSelectedLearningCandidateId?: string;
  initialLearningCandidates: readonly LearningCandidateViewModel[];
  prefilledManuscriptId?: string;
  prefilledReviewedCaseSnapshotId?: string;
}): RuleWizardCandidateHandoffViewModel | null {
  if (input.initialView !== "authoring" && input.initialMode !== "authoring") {
    return null;
  }

  const candidate = resolveInitialV2LearningCandidate(input);
  return candidate
    ? createRuleWizardCandidateHandoffViewModel(candidate, {
        prefilledManuscriptId: input.prefilledManuscriptId,
        prefilledReviewedCaseSnapshotId: input.prefilledReviewedCaseSnapshotId,
      })
    : null;
}

function resolveInitialV2LearningCandidate(input: {
  initialSelectedLearningCandidateId?: string;
  initialLearningCandidates: readonly LearningCandidateViewModel[];
}) {
  if (!input.initialSelectedLearningCandidateId) {
    return null;
  }

  return (
    input.initialLearningCandidates.find(
      (candidate) =>
        candidate.id === input.initialSelectedLearningCandidateId &&
        isRuleCenterLearningCandidate(candidate),
    ) ?? null
  );
}

function resolveDefaultPanelForSection(
  section: TemplateGovernanceV2Section,
): TemplateGovernanceV2Panel {
  switch (section) {
    case "templates":
      return "template-detail";
    case "packages":
      return "package-detail";
    case "extraction":
      return "extraction-detail";
    case "ai-intake":
      return "ai-intake";
    case "release":
      return "release-check";
    case "advanced":
      return "advanced-compatibility";
    default:
      return "none";
  }
}

function createRouteStateForCommand(
  command: TemplateGovernanceV2Command,
): TemplateGovernanceV2RouteState {
  switch (command) {
    case "new-rule":
      return {
        section: "rules",
        panel: "rule-wizard",
        selectedKind: "none",
        selectedId: undefined,
        subtype: undefined,
      };
    case "new-ai-rule":
      return {
        section: "ai-intake",
        panel: "ai-intake",
        selectedKind: "none",
        selectedId: undefined,
        subtype: undefined,
      };
    case "import-extraction":
      return {
        section: "extraction",
        panel: "extraction-detail",
        selectedKind: "none",
        selectedId: undefined,
        subtype: undefined,
      };
    case "review-candidates":
      return {
        section: "recovery",
        panel: "none",
        selectedKind: "none",
        selectedId: undefined,
        subtype: undefined,
      };
    case "release-check":
      return {
        section: "release",
        panel: "release-check",
        selectedKind: "none",
        selectedId: undefined,
        subtype: undefined,
      };
  }
}
