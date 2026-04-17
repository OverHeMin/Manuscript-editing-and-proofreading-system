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
  type TemplateGovernanceView,
} from "../../app/workbench-routing.ts";
import { WorkbenchCoreStrip } from "../../app/workbench-core-strip.tsx";
import { createBrowserHttpClient, BrowserHttpClientError } from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/index.ts";
import { getKnowledgeAssetDetail } from "../knowledge-library/knowledge-library-api.ts";
import type { KnowledgeAssetDetailViewModel } from "../knowledge-library/types.ts";
import type { LearningCandidateViewModel } from "../learning-review/index.ts";
import type { RuleAuthoringPrefillFromLearningCandidate } from "../learning-review/index.ts";
import type {
  CreateKnowledgeDraftInput,
  EvidenceLevel,
  KnowledgeItemStatus,
  KnowledgeKind,
  KnowledgeSourceType,
  UpdateKnowledgeDraftInput,
} from "../knowledge/index.ts";
import type { ManuscriptType } from "../manuscripts/types.ts";
import { EDITORIAL_MANUSCRIPT_TYPE_OPTIONS } from "../shared/editorial-taxonomy.ts";
import {
  createInlineUploadFields,
  type BrowserUploadFile,
} from "../manuscript-workbench/manuscript-upload-file.ts";
import type {
  PromptTemplateKind,
  PromptTemplateViewModel,
} from "../prompt-skill-registry/index.ts";
import type {
  CreateRulePackageExampleSourceSessionInput,
  EditorialRuleConfidencePolicy,
  EditorialRuleExecutionMode,
  EditorialRuleSeverity,
  EditorialRuleSetViewModel,
  ExtractionTaskCandidateViewModel,
  EditorialRuleType,
  RulePackageDraftViewModel,
  RulePackageWorkspaceSourceInputViewModel,
} from "../editorial-rules/index.ts";
import type {
  GovernedContentModuleClass,
  GovernedContentModuleViewModel,
  JournalTemplateProfileViewModel,
  ModuleTemplateViewModel,
  RuleEvidenceExampleViewModel,
  TemplateModule,
  TemplateCompositionViewModel,
  TemplateFamilyStatus,
} from "../templates/index.ts";
import { RuleAuthoringForm } from "./rule-authoring-form.tsx";
import { RuleAuthoringGrid } from "./rule-authoring-grid.tsx";
import { RuleAuthoringNavigation } from "./rule-authoring-navigation.tsx";
import { RuleAuthoringExplainability } from "./rule-authoring-explainability.tsx";
import { RuleAuthoringPreviewPanel } from "./rule-authoring-preview.tsx";
import { RulePackageAuthoringShell } from "./rule-package-authoring-shell.tsx";
import {
  buildRulePackagePreviewSampleText,
  createRulePackageAuthoringWorkspaceState,
  getSelectedRulePackageDraft,
  rebaseRulePackageAuthoringWorkspaceState,
  restoreRulePackageAuthoringWorkspaceState,
  serializeRulePackageAuthoringWorkspaceState,
  setRulePackageCompilePreview,
  setRulePackageCompileResult,
  selectRulePackageWorkspaceCandidate,
  setRulePackagePreview,
  toggleRulePackageAdvancedEditor,
  updateRulePackageSemanticDraft,
  type RulePackageWorkspaceViewModel,
} from "./rule-package-authoring-state.ts";
import { RuleLearningPane } from "./rule-learning-pane.tsx";
import { TemplateGovernanceProofreadingStrategyPane } from "./template-governance-proofreading-strategy-pane.tsx";
import {
  loadRulePackageDraft,
  saveRulePackageDraft,
} from "./rule-package-draft-storage.ts";
import { RulePackageUploadIntake } from "./rule-package-upload-intake.tsx";
import {
  createRuleAuthoringDraft,
  resolveRuleAuthoringDraftForOverview,
  serializeRuleAuthoringDraft,
} from "./rule-authoring-serialization.ts";
import type { RuleAuthoringDraft, RuleAuthoringObject } from "./rule-authoring-types.ts";
import {
  createTemplateGovernanceWorkbenchController,
  type TemplateGovernanceContentModuleLedgerViewModel,
  type TemplateGovernanceExtractionLedgerViewModel,
  type TemplateGovernanceTemplateLedgerViewModel,
  type TemplateGovernanceWorkbenchController,
  type TemplateGovernanceWorkbenchFilters,
  type TemplateGovernanceWorkbenchOverview,
} from "./template-governance-controller.ts";
import {
  buildTemplateGovernanceOverviewFallbackPendingItems,
  buildTemplateGovernanceOverviewFallbackUpdates,
  TemplateGovernanceOverviewPage,
  type TemplateGovernanceOverviewPendingItem,
  type TemplateGovernanceOverviewMetrics,
  type TemplateGovernanceOverviewRecentUpdate,
} from "./template-governance-overview-page.tsx";
import {
  applyTemplateGovernanceRuleLedgerClientFilters,
  buildTemplateGovernanceRuleLedgerSearchState,
  collectTemplateGovernanceRuleLedgerFilterOptions,
  TemplateGovernanceRuleLedgerPage,
} from "./template-governance-rule-ledger-page.tsx";
import { TemplateGovernanceRuleWizard } from "./template-governance-rule-wizard.tsx";
import { TemplateGovernanceContentModuleLedgerPage } from "./template-governance-content-module-ledger-page.tsx";
import type { TemplateGovernanceContentModuleFormValues } from "./template-governance-content-module-form.tsx";
import { TemplateGovernanceExtractionLedgerPage } from "./template-governance-extraction-ledger-page.tsx";
import type { TemplateGovernanceExtractionTaskFormDraft } from "./template-governance-extraction-task-form.tsx";
import {
  TemplateGovernanceJournalTemplateLedgerPage,
  type TemplateGovernanceJournalTemplateLedgerViewModel,
} from "./template-governance-journal-template-ledger-page.tsx";
import type { TemplateGovernanceJournalTemplateFormValues } from "./template-governance-journal-template-form.tsx";
import type { TemplateGovernanceCandidateConfirmationFormValues } from "./template-governance-candidate-confirmation-form.tsx";
import { TemplateGovernanceLedgerToolbar } from "./template-governance-ledger-toolbar.tsx";
import type { TemplateGovernanceLedgerSearchState } from "./template-governance-ledger-types.ts";
import {
  createTemplateGovernanceNavigationItems,
  type TemplateGovernanceNavigationTarget,
} from "./template-governance-navigation.ts";
import { TemplateGovernanceTemplateLedgerPage } from "./template-governance-template-ledger-page.tsx";
import type { TemplateGovernanceTemplateFormValues } from "./template-governance-template-form.tsx";
import type {
  TemplateGovernanceRuleLedgerCategory,
  TemplateGovernanceRuleLedgerRow,
  TemplateGovernanceRuleLedgerViewModel,
} from "./template-governance-ledger-types.ts";
import {
  createEmptyTemplateGovernanceRuleLedgerViewModel,
  createTemplateGovernanceRuleLedgerViewModel,
  selectTemplateGovernanceRuleLedgerRow,
} from "./template-governance-rule-ledger-state.ts";
import {
  advanceRuleWizardState,
  createRuleWizardState,
  rewindRuleWizardState,
  type RuleWizardState,
} from "./template-governance-rule-wizard-state.ts";
import {
  createRuleWizardEntryFormState,
  createRuleWizardEntryFormStateFromDetail,
  type RuleWizardEntryFormState,
  type RuleWizardReleaseAction,
} from "./template-governance-rule-wizard-api.ts";
import {
  formatRulePackageKindLabel,
  formatTemplateGovernanceConfidencePolicyLabel,
  formatTemplateGovernanceExecutionModeLabel,
  formatTemplateGovernanceFamilyStatusLabel,
  formatTemplateGovernanceGovernedAssetStatusLabel,
  formatTemplateGovernanceInstructionOperationLabel,
  formatTemplateGovernanceExtractionCandidateStatusLabel,
  formatTemplateGovernanceExtractionDestinationLabel,
  formatTemplateGovernanceExtractionTaskStatusLabel,
  formatTemplateGovernanceKnowledgeKindLabel,
  formatTemplateGovernanceManuscriptTypeLabel,
  formatTemplateGovernanceModuleLabel,
  formatTemplateGovernancePromptTemplateKindLabel,
  formatTemplateGovernanceRetrievalSignalKindLabel,
  formatTemplateGovernanceRuleTypeLabel,
  formatTemplateGovernanceSeverityLabel,
} from "./template-governance-display.ts";

if (typeof document !== "undefined") {
  void import("./template-governance-workbench.css");
}

const defaultController = createTemplateGovernanceWorkbenchController(
  createBrowserHttpClient(),
);
const defaultRuleWizardAssetClient = createBrowserHttpClient();
const manuscriptTypes: readonly ManuscriptType[] = EDITORIAL_MANUSCRIPT_TYPE_OPTIONS;
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
  manuscriptTypes: ManuscriptType[] | "any";
  templateBindings: string[];
  aliases: string[];
  sections: string[];
  riskTags: string[];
  disciplineTags: string[];
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
  initialView?: TemplateGovernanceView;
  initialSelectedRuleLedgerRowId?: string;
  prefilledManuscriptId?: string;
  prefilledReviewedCaseSnapshotId?: string;
  initialRulePackageWorkspace?: RulePackageWorkspaceViewModel | null;
  initialLearningCandidates?: readonly LearningCandidateViewModel[];
  initialSelectedLearningCandidateId?: string;
}

export function TemplateGovernanceWorkbenchPage({
  controller = defaultController,
  actorRole = "admin",
  initialOverview = null,
  initialMode = "authoring",
  initialView = "classic",
  initialSelectedRuleLedgerRowId,
  prefilledManuscriptId,
  prefilledReviewedCaseSnapshotId,
  initialRulePackageWorkspace = null,
  initialLearningCandidates = [],
  initialSelectedLearningCandidateId,
}: TemplateGovernanceWorkbenchPageProps) {
  const shouldShowRuleLedger =
    initialView === "authoring" ||
    initialView === "rule-ledger" ||
    (initialMode === "learning" && initialView !== "overview");

  if (initialView === "overview") {
    return (
      <TemplateGovernanceOverviewRoute
        controller={controller}
        initialOverview={initialOverview}
      />
    );
  }

  if (shouldShowRuleLedger) {
    return (
      <TemplateGovernanceRuleLedgerRoute
        controller={controller}
        actorRole={actorRole}
        recoveryMode={initialMode === "learning"}
        prefilledManuscriptId={prefilledManuscriptId}
        prefilledReviewedCaseSnapshotId={prefilledReviewedCaseSnapshotId}
        initialCategory={initialMode === "learning" ? "recycled_candidate" : "all"}
        initialSelectedRowId={initialSelectedRuleLedgerRowId}
        initialLearningCandidates={initialLearningCandidates}
        initialSelectedLearningCandidateId={initialSelectedLearningCandidateId}
        initialWizardMode={initialView === "authoring" ? "create" : null}
      />
    );
  }

  if (initialView === "extraction-ledger") {
    return <TemplateGovernanceExtractionLedgerRoute controller={controller} />;
  }

  if (initialView === "large-template-ledger") {
    return <TemplateGovernanceTemplateLedgerRoute controller={controller} />;
  }

  if (initialView === "journal-template-ledger") {
    return (
      <TemplateGovernanceJournalTemplateLedgerRoute
        controller={controller}
        actorRole={actorRole}
      />
    );
  }

  if (initialView === "general-package-ledger") {
    return (
      <TemplateGovernanceContentModuleLedgerRoute
        controller={controller}
        moduleClass="general"
      />
    );
  }

  if (initialView === "medical-package-ledger") {
    return (
      <TemplateGovernanceContentModuleLedgerRoute
        controller={controller}
        moduleClass="medical_specialized"
      />
    );
  }

  const initialRuleDraft = resolveInitialRuleAuthoringDraft(initialOverview);
  const normalizedPrefilledManuscriptId = prefilledManuscriptId?.trim() ?? "";
  const normalizedPrefilledReviewedCaseSnapshotId =
    prefilledReviewedCaseSnapshotId?.trim() ?? "";
  const initialRulePackageSource =
    initialRulePackageWorkspace?.source ??
    (normalizedPrefilledReviewedCaseSnapshotId.length > 0
      ? {
          sourceKind: "reviewed_case" as const,
          reviewedCaseSnapshotId: normalizedPrefilledReviewedCaseSnapshotId,
        }
      : null);
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
  const [rulePackageLoadStatus, setRulePackageLoadStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >(initialRulePackageWorkspace ? "ready" : "idle");
  const [rulePackageErrorMessage, setRulePackageErrorMessage] =
    useState<string | null>(null);
  const [isRulePackagePreviewBusy, setIsRulePackagePreviewBusy] = useState(false);
  const [isRulePackageCompilePreviewBusy, setIsRulePackageCompilePreviewBusy] =
    useState(false);
  const [isRulePackageCompileBusy, setIsRulePackageCompileBusy] = useState(false);
  const [rulePackageWorkspaceSource, setRulePackageWorkspaceSource] =
    useState<RulePackageWorkspaceSourceInputViewModel | null>(initialRulePackageSource);
  const [rulePackageOriginalFile, setRulePackageOriginalFile] =
    useState<BrowserUploadFile | null>(null);
  const [rulePackageEditedFile, setRulePackageEditedFile] =
    useState<BrowserUploadFile | null>(null);
  const [rulePackageRestoreMessage, setRulePackageRestoreMessage] =
    useState<string | null>(null);
  const [isStandaloneAdvancedEditorVisible, setIsStandaloneAdvancedEditorVisible] =
    useState(false);
  const [rulePackageWorkspaceState, setRulePackageWorkspaceState] = useState(() =>
    initialRulePackageWorkspace
      ? createRulePackageAuthoringWorkspaceState(initialRulePackageWorkspace)
      : initialRulePackageSource
        ? createRulePackageAuthoringWorkspaceState({
            source: initialRulePackageSource,
            candidates: [],
            selectedPackageId: null,
          })
        : null,
  );
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
  const [selectedRuleObject, setSelectedRuleObject] = useState<RuleAuthoringObject>(
    initialRuleDraft.ruleObject,
  );
  const [ruleSetForm, setRuleSetForm] = useState<RuleSetFormState>({
    module: initialOverview?.selectedRuleSet?.module ?? "editing",
  });
  const [ruleAuthoringDraft, setRuleAuthoringDraft] = useState<RuleAuthoringDraft>(
    () => initialRuleDraft,
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

  useEffect(() => {
    if (!initialRulePackageWorkspace) {
      return;
    }

    setRulePackageWorkspaceSource(initialRulePackageWorkspace.source);
    setRulePackageWorkspaceState((current) =>
      rebaseRulePackageAuthoringWorkspaceState(initialRulePackageWorkspace, current),
    );
    setRulePackageLoadStatus("ready");
    setRulePackageErrorMessage(null);
  }, [initialRulePackageWorkspace]);

  useEffect(() => {
    if (initialRulePackageWorkspace || !initialRulePackageSource) {
      return;
    }

    setRulePackageWorkspaceSource(initialRulePackageSource);
    setRulePackageWorkspaceState((current) =>
      current ??
      createRulePackageAuthoringWorkspaceState({
        source: initialRulePackageSource,
        candidates: [],
        selectedPackageId: null,
      }),
    );
  }, [initialRulePackageSource, initialRulePackageWorkspace]);

  useEffect(() => {
    if (workbenchMode !== "authoring") {
      return;
    }

    if (!rulePackageWorkspaceSource || initialRulePackageWorkspace) {
      return;
    }

    let isCancelled = false;
    setRulePackageLoadStatus("loading");
    setRulePackageErrorMessage(null);
    setRulePackageRestoreMessage(null);
    setRulePackageWorkspaceState((current) =>
      current && isSameRulePackageSource(current.source, rulePackageWorkspaceSource)
        ? current
        : createRulePackageAuthoringWorkspaceState({
            source: rulePackageWorkspaceSource,
            candidates: [],
            selectedPackageId: null,
          }),
    );

    const storedDraft =
      typeof window !== "undefined"
        ? loadRulePackageDraft(window.localStorage, rulePackageWorkspaceSource)
        : null;

    void controller
      .loadRulePackageWorkspace(rulePackageWorkspaceSource)
      .then((workspace) => {
        if (isCancelled) {
          return;
        }

        setRulePackageWorkspaceState((current) =>
          storedDraft
            ? restoreRulePackageAuthoringWorkspaceState(workspace, storedDraft, current)
            : rebaseRulePackageAuthoringWorkspaceState(workspace, current),
        );
        setRulePackageLoadStatus("ready");
        setRulePackageRestoreMessage(
          storedDraft ? "已自动恢复上次草稿。" : null,
        );
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }

        setRulePackageLoadStatus("error");
        setRulePackageErrorMessage(
          toErrorMessage(error, "规则包工作台加载失败"),
        );
      });

    return () => {
      isCancelled = true;
    };
  }, [
    controller,
    initialRulePackageWorkspace,
    rulePackageWorkspaceSource,
    workbenchMode,
  ]);

  useEffect(() => {
    if (typeof window === "undefined" || !rulePackageWorkspaceState) {
      return;
    }

    if (rulePackageWorkspaceState.candidates.length === 0) {
      return;
    }

    saveRulePackageDraft(
      window.localStorage,
      serializeRulePackageAuthoringWorkspaceState(
        rulePackageWorkspaceState,
        new Date().toISOString(),
      ),
    );
  }, [rulePackageWorkspaceState]);

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
      setErrorMessage(toErrorMessage(error, "规则中心加载失败"));
    }
  }

  function setModuleTemplateSelection(moduleTemplateId: string | null) {
    selectedModuleTemplateIdRef.current = moduleTemplateId;
    setSelectedModuleTemplateId(moduleTemplateId);
  }

  function handleSelectRulePackage(packageId: string) {
    setRulePackageWorkspaceState((current) =>
      current ? selectRulePackageWorkspaceCandidate(current, packageId) : current,
    );
  }

  function handleToggleRulePackageAdvancedEditor() {
    if (rulePackageWorkspaceState) {
      setRulePackageWorkspaceState((current) =>
        current ? toggleRulePackageAdvancedEditor(current) : current,
      );
      return;
    }

    setIsStandaloneAdvancedEditorVisible((current) => !current);
  }

  function handleUpdateSelectedRulePackageDraft(
    recipe: (draft: RulePackageDraftViewModel) => RulePackageDraftViewModel,
  ) {
    setRulePackageWorkspaceState((current) => {
      if (!current?.selectedPackageId) {
        return current;
      }

      return updateRulePackageSemanticDraft(current, current.selectedPackageId, recipe);
    });
  }

  async function handleRefreshRulePackagePreview() {
    const selectedDraft = getSelectedRulePackageDraft(rulePackageWorkspaceState);
    if (!selectedDraft) {
      return;
    }

    setIsRulePackagePreviewBusy(true);
    setRulePackageErrorMessage(null);

    try {
      const preview = await controller.previewRulePackageDraft({
        packageDraft: selectedDraft,
        sampleText: buildRulePackagePreviewSampleText(selectedDraft),
      });

      setRulePackageWorkspaceState((current) =>
        current
          ? setRulePackagePreview(current, selectedDraft.package_id, preview)
          : current,
      );
    } catch (error) {
      setRulePackageErrorMessage(toErrorMessage(error, "规则包预览失败"));
    } finally {
      setIsRulePackagePreviewBusy(false);
    }
  }

  async function handlePreviewRulePackageCompile() {
    if (!rulePackageWorkspaceState || rulePackageWorkspaceState.candidates.length === 0) {
      return;
    }

    const compileContext = resolveRulePackageCompileContext(overview);
    if (!compileContext.templateFamilyId) {
      setRulePackageErrorMessage(
        "请先选择模板族，再运行编译预览。",
      );
      return;
    }

    setIsRulePackageCompilePreviewBusy(true);
    setRulePackageErrorMessage(null);

    try {
      const compilePreview = await controller.previewRulePackageCompile({
        source: rulePackageWorkspaceState.source,
        packageDrafts: rulePackageWorkspaceState.candidates.map((candidate) =>
          rulePackageWorkspaceState.editableDraftById[candidate.package_id] ?? {
            ...candidate,
            preview: undefined,
          },
        ),
        templateFamilyId: compileContext.templateFamilyId,
        ...(compileContext.journalTemplateId
          ? { journalTemplateId: compileContext.journalTemplateId }
          : {}),
        module: compileContext.module,
      });

      setRulePackageWorkspaceState((current) =>
        current
          ? setRulePackageCompilePreview(
              setRulePackageCompileResult(current, null),
              compilePreview,
            )
          : current,
      );
    } catch (error) {
      setRulePackageErrorMessage(
        toErrorMessage(error, "规则包编译预览失败"),
      );
    } finally {
      setIsRulePackageCompilePreviewBusy(false);
    }
  }

  async function handleCompileRulePackagesToDraft() {
    if (!rulePackageWorkspaceState || rulePackageWorkspaceState.candidates.length === 0) {
      return;
    }

    const compileContext = resolveRulePackageCompileContext(overview);
    if (!compileContext.templateFamilyId) {
      setRulePackageErrorMessage(
        "请先选择模板族，再把规则包编译成规则集草稿。",
      );
      return;
    }

    setIsRulePackageCompileBusy(true);
    setRulePackageErrorMessage(null);

    try {
      const targetRuleSetId = resolveSelectedDraftCompileTargetRuleSetId(
        overview,
        compileContext,
      );
      const compileResult = await controller.compileRulePackagesToDraft({
        actorRole,
        source: rulePackageWorkspaceState.source,
        ...(targetRuleSetId ? { targetRuleSetId } : {}),
        packageDrafts: rulePackageWorkspaceState.candidates.map((candidate) =>
          rulePackageWorkspaceState.editableDraftById[candidate.package_id] ?? {
            ...candidate,
            preview: undefined,
          },
        ),
        templateFamilyId: compileContext.templateFamilyId,
        ...(compileContext.journalTemplateId
          ? { journalTemplateId: compileContext.journalTemplateId }
          : {}),
        module: compileContext.module,
      });

      setRulePackageWorkspaceState((current) =>
        current ? setRulePackageCompileResult(current, compileResult) : current,
      );
      setStatusMessage(`规则集草稿已就绪：${compileResult.rule_set_id}`);

      await loadOverview({
        selectedTemplateFamilyId: compileContext.templateFamilyId,
        selectedJournalTemplateId: compileContext.journalTemplateId ?? null,
        selectedRuleSetId: compileResult.rule_set_id,
      });
    } catch (error) {
      setRulePackageErrorMessage(
        toErrorMessage(error, "规则包编译为草稿失败"),
      );
    } finally {
      setIsRulePackageCompileBusy(false);
    }
  }

  async function handleOpenCompiledDraftRuleSet() {
    const compileResult = rulePackageWorkspaceState?.compileResult;
    if (!compileResult) {
      return;
    }

    setWorkbenchMode("authoring");
    setIsStandaloneAdvancedEditorVisible(false);
    setRulePackageWorkspaceState((current) =>
      current ? { ...current, isAdvancedEditorVisible: false } : current,
    );
    await loadOverview(
      currentReloadContext({
        selectedRuleSetId: compileResult.rule_set_id,
      }),
    );
      setStatusMessage(`已切换到规则集草稿：${compileResult.rule_set_id}`);
  }

  async function handleOpenCompiledDraftAdvancedEditor() {
    const compileResult = rulePackageWorkspaceState?.compileResult;
    if (!compileResult) {
      return;
    }

    setWorkbenchMode("authoring");
    setIsStandaloneAdvancedEditorVisible(true);
    setRulePackageWorkspaceState((current) =>
      current ? { ...current, isAdvancedEditorVisible: true } : current,
    );
    await loadOverview(
      currentReloadContext({
        selectedRuleSetId: compileResult.rule_set_id,
      }),
    );
    setStatusMessage(`Advanced rule editor opened for ${compileResult.rule_set_id}.`);
  }

  async function handleGoToCompiledDraftPublishArea() {
    const compileResult = rulePackageWorkspaceState?.compileResult;
    if (!compileResult) {
      return;
    }

    setWorkbenchMode("authoring");
    setIsStandaloneAdvancedEditorVisible(true);
    setRulePackageWorkspaceState((current) =>
      current ? { ...current, isAdvancedEditorVisible: true } : current,
    );
    await loadOverview(
      currentReloadContext({
        selectedRuleSetId: compileResult.rule_set_id,
      }),
    );
        setStatusMessage(
          `规则集 ${compileResult.rule_set_id} 已准备就绪，复核完成后即可发布。`,
        );
  }

  function handleSelectRulePackageOriginalFile(file: BrowserUploadFile | null) {
    setRulePackageOriginalFile(file);
  }

  function handleSelectRulePackageEditedFile(file: BrowserUploadFile | null) {
    setRulePackageEditedFile(file);
  }

  async function handleStartRulePackageRecognition() {
    if (!rulePackageOriginalFile || !rulePackageEditedFile) {
      return;
    }

    setRulePackageLoadStatus("loading");
    setRulePackageErrorMessage(null);
    setRulePackageRestoreMessage(null);

    try {
      const sessionInput: CreateRulePackageExampleSourceSessionInput = {
        originalFile: await createInlineUploadFields(rulePackageOriginalFile),
        editedFile: await createInlineUploadFields(rulePackageEditedFile),
      };
      const session = await controller.createRulePackageExampleSourceSession(
        sessionInput,
      );

      setRulePackageWorkspaceSource({
        sourceKind: "uploaded_example_pair",
        exampleSourceSessionId: session.session_id,
        ...(session.journal_key ? { journalKey: session.journal_key } : {}),
      });
    } catch (error) {
      setRulePackageLoadStatus("error");
      setRulePackageErrorMessage(
        toErrorMessage(error, "规则包示例上传失败"),
      );
    }
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
    const nextRuleDraft = resolveRuleAuthoringDraftForOverview({
      overview: nextOverview,
      preferredRuleObject: selectedRuleObject,
      previousSelectedRuleSetId: overview?.selectedRuleSetId ?? null,
    });
    setSelectedRuleObject(nextRuleDraft.ruleObject);
    setRuleAuthoringDraft(nextRuleDraft);

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
      setErrorMessage(toErrorMessage(error, "规则中心操作失败"));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCreateTemplateFamily(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (familyForm.name.trim().length === 0) {
      setErrorMessage("请填写模板族名称。");
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
    }, "模板族草稿已创建。");
  }

  async function handleUpdateSelectedTemplateFamily(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const selectedTemplateFamilyId = overview?.selectedTemplateFamilyId;
    if (!selectedTemplateFamilyId || !overview) {
      setErrorMessage("请先选择模板族，再更新当前模板族。");
      return;
    }

    if (selectedFamilyForm.name.trim().length === 0) {
      setErrorMessage("请填写当前模板族名称。");
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
    }, "模板族已更新。");
  }

  async function handleSubmitModuleTemplateDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedTemplateFamilyId = overview?.selectedTemplateFamilyId;
    if (!selectedTemplateFamilyId) {
      setErrorMessage("请先选择模板族，再创建模块模板草稿。");
      return;
    }

    if (moduleForm.prompt.trim().length === 0) {
      setErrorMessage("请填写模块说明。");
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
    }, isEditingModuleTemplate ? "模块模板草稿已更新。" : "模块模板草稿已创建。");
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
    }, "模块模板已发布。");
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
    setStatusMessage("模块模板编辑器已重置，可继续新建草稿。");
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
        setErrorMessage(toErrorMessage(error, "规则中心加载失败"));
        return;
      }
    }

    setPendingRuleLearningHandoff(prefill);
    setWorkbenchMode("authoring");
    setIsStandaloneAdvancedEditorVisible(true);
    setRuleSetForm({ module: prefill.module });
    setSelectedRuleObject(prefill.ruleDraft.ruleObject);
    setRuleAuthoringDraft({
      ...prefill.ruleDraft,
      journalTemplateId: targetJournalTemplateId,
    });
    setStatusMessage(`已从学习候选项 ${prefill.sourceLearningCandidateId} 预填规则草稿。`);
  }

  async function handleCreateJournalTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedTemplateFamily = overview?.selectedTemplateFamily;
    if (!selectedTemplateFamily) {
      setErrorMessage("请先选择模板族，再创建期刊模板。");
      return;
    }

    if (
      journalTemplateForm.journalName.trim().length === 0 ||
      journalTemplateForm.journalKey.trim().length === 0
    ) {
      setErrorMessage("请同时填写期刊名称和期刊标识。");
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
      }, "期刊模板画像已创建。");
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
      }, "期刊模板画像已启用。");
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
      }, "期刊模板画像已归档。");
  }

  async function handleCreateRuleSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedTemplateFamilyId = overview?.selectedTemplateFamilyId;
    if (!selectedTemplateFamilyId) {
      setErrorMessage("请先选择模板族，再创建规则集。");
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
      }, "规则集草稿已创建。");
  }

  async function handleSubmitRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedRuleSetId = overview?.selectedRuleSetId;
    if (!overview?.selectedTemplateFamilyId || !selectedRuleSetId) {
      setErrorMessage("请先创建或选择规则集，再添加规则。");
      return;
    }
    const serializedDraft = serializeRuleAuthoringDraft({
      ...ruleAuthoringDraft,
      journalTemplateId: overview.selectedJournalTemplateId,
    });
    const explanationPayload = pendingRuleLearningHandoff?.explanationPayload;
    const linkagePayload = {
      ...(pendingRuleLearningHandoff?.linkagePayload ?? {}),
      ...(serializedDraft.linkagePayload ?? {}),
    };
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
          ...(Object.keys(linkagePayload).length > 0 ? { linkagePayload } : {}),
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
    }, "规则草稿已创建。");
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
      }, "规则集已发布。");
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
      setErrorMessage("请先选择模板族，再创建 AI 指令模板。");
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
        "请完整填写指令名称、系统指令、任务框架、人工复核策略和输出约束。",
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
    }, "AI 指令模板草稿已创建。");
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
    }, "AI 指令模板已发布。");
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
      setErrorMessage("请填写知识标题和规范文本。");
      return;
    }

    const payload = createKnowledgeDraftInput(knowledgeForm);

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
    }, isEditingDraft ? "知识草稿已更新。" : "知识草稿已创建。");
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
    }, "知识草稿已提交审核。");
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
    }, "知识条目已归档。");
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
    setStatusMessage("知识草稿编辑器已重置，可继续新建条目。");
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
  const shouldUseRulePackageWorkbench =
    normalizedPrefilledReviewedCaseSnapshotId.length > 0 ||
    initialRulePackageWorkspace != null ||
    workbenchMode === "authoring";
  const knowledgeLibraryHash =
    selectedKnowledgeItem?.asset_id
      ? formatWorkbenchHash("knowledge-library", {
          assetId: selectedKnowledgeItem.asset_id,
          revisionId: selectedKnowledgeItem.revision_id,
        })
      : formatWorkbenchHash("knowledge-library");
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
  const advancedRuleEditor = (
    <div className="template-governance-advanced-shell">
      <div className="template-governance-panel-header">
        <div>
          <h4>高级规则编辑器</h4>
          <p>当需要检查或修补底层规则细节时，仍可打开这块低层编辑工作台。</p>
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
            knowledgeItems={overview?.visibleKnowledgeItems ?? []}
            isBusy={isBusy}
            onDraftChange={setRuleAuthoringDraft}
            onSubmit={handleSubmitRule}
          />
          <RuleAuthoringExplainability draft={ruleAuthoringDraft} />
          <RuleAuthoringPreviewPanel overview={overview} draft={ruleAuthoringDraft} />
          <RuleAuthoringGrid
            overview={overview}
            selectedRuleSet={selectedRuleSet}
            draft={ruleAuthoringDraft}
          />
        </div>
      </div>
    </div>
  );
  const isAdvancedRuleEditorVisible =
    rulePackageWorkspaceState?.isAdvancedEditorVisible ?? isStandaloneAdvancedEditorVisible;
  const proofreadingRuleSetCount =
    overview?.ruleSets.filter((ruleSet) => ruleSet.module === "proofreading").length ?? 0;
  const proofreadingTemplateCount =
    overview?.moduleTemplates.filter((template) => template.module === "proofreading").length ?? 0;
  const proofreadingInstructionCount =
    overview?.instructionTemplates.filter((template) => template.module === "proofreading").length ??
    0;
  const tableRuleCount = overview?.rules.filter(isTableGovernanceRule).length ?? 0;
  const tableKnowledgeCount =
    overview?.visibleKnowledgeItems.filter(isTableGovernanceKnowledgeItem).length ?? 0;

  return (
    <section className="template-governance-workbench">
      <header className="template-governance-hero">
        <div className="template-governance-hero-copy">
          <p className="template-governance-eyebrow">规则中心</p>
          <h2>规则中心</h2>
          <p>
            把规则创建、模板套用、校对策略和回流工作区放进同一块可解释的治理工作台，但把高频入口做得更清楚、更好上手。
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

      <nav className="template-governance-mode-switch" aria-label="规则中心模式">
        <a
          href={authoringModeHash}
          className={`template-governance-mode-tab${workbenchMode === "authoring" ? " is-active" : ""}`}
        >
          规则录入
        </a>
        <a
          href={learningModeHash}
          className={`template-governance-mode-tab${workbenchMode === "learning" ? " is-active" : ""}`}
        >
          回流工作区
        </a>
      </nav>

      {normalizedPrefilledReviewedCaseSnapshotId.length > 0 ? (
        <p className="template-governance-context-note">
          已保留回流上下文：复核快照 {normalizedPrefilledReviewedCaseSnapshotId}
        </p>
      ) : null}

      {pendingRuleLearningHandoff ? (
        <p className="template-governance-context-note">
          已从学习候选预填规则草稿：{pendingRuleLearningHandoff.sourceLearningCandidateId}
          {pendingRuleLearningHandoff.reviewedCaseSnapshotId
            ? ` · 复核快照 ${pendingRuleLearningHandoff.reviewedCaseSnapshotId}`
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
          <span>模板族</span>
          <strong>{overview?.templateFamilies.length ?? 0}</strong>
        </article>
        <article className="template-governance-summary-card">
          <span>模块模板</span>
          <strong>{overview?.moduleTemplates.length ?? 0}</strong>
        </article>
        <article className="template-governance-summary-card">
          <span>可见知识</span>
          <strong>{overview?.visibleKnowledgeItems.length ?? 0}</strong>
        </article>
        <article className="template-governance-summary-card">
          <span>规则集</span>
          <strong>{overview?.ruleSets.length ?? 0}</strong>
        </article>
        <article className="template-governance-summary-card">
          <span>AI 指令模板</span>
          <strong>{overview?.instructionTemplates.length ?? 0}</strong>
        </article>
        <article className="template-governance-summary-card">
          <span>绑定知识</span>
          <strong>{overview?.boundKnowledgeItems.length ?? 0}</strong>
        </article>
        <article className="template-governance-summary-card">
          <span>检索信号</span>
          <strong>{retrievalInsights?.signals.length ?? 0}</strong>
          <small>{formatRetrievalInsightStatus(retrievalInsights?.status ?? "idle")}</small>
        </article>
      </section>

      <section className="template-governance-capability-grid">
        <article className="template-governance-card">
          <strong>规则创建</strong>
          <p>从示例、规则包或高级编辑器进入规则录入，先把高频动作沉淀清楚。</p>
        </article>
        <article className="template-governance-card">
          <strong>模板套用</strong>
          <p>模块模板承接不同稿件族的执行框架，减少前台重复配置。</p>
        </article>
        <article className="template-governance-card">
          <strong>校对策略</strong>
          <p>把通用校对与医学专业校对分开说明，避免前台误解成单纯套模板。</p>
        </article>
        <article className="template-governance-card">
          <strong>AI 指令模板</strong>
          <p>把系统提示、任务框架和人工复核边界拆开管理，便于不同模块复用。</p>
        </article>
        <article className="template-governance-card">
          <strong>知识库</strong>
          <p>知识录入在独立页面完成，这里只保留绑定关系与回流入口。</p>
        </article>
        <article className="template-governance-card">
          <strong>打开知识库</strong>
          <p>需要补充知识说明、修订草稿或查看语义资产时，直接跳转独立知识库。</p>
          <div className="template-governance-actions">
            <a className="template-governance-link-button" href={knowledgeLibraryHash}>
              打开知识库
            </a>
          </div>
        </article>
      </section>

      <div className="template-governance-grid">
        <article className="template-governance-panel">
          <div className="template-governance-panel-header">
            <div>
              <h3>模板族</h3>
              <p>先选定稿件族，再承接模块模板、规则包和知识绑定，避免后台参数散落在不同位置。</p>
            </div>
          </div>

          <form className="template-governance-form-grid" onSubmit={handleCreateTemplateFamily}>
            <label className="template-governance-field">
              <span>稿件类型</span>
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
                    {formatTemplateGovernanceManuscriptTypeLabel(manuscriptType)}
                  </option>
                ))}
              </select>
            </label>
            <label className="template-governance-field">
              <span>族名称</span>
              <input
                value={familyForm.name}
                onChange={(event) =>
                  setFamilyForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="临床研究核心族"
              />
            </label>
            <div className="template-governance-actions template-governance-actions-full">
              <button type="submit" disabled={isBusy}>
                {isBusy ? "保存中..." : "新建模板族草稿"}
              </button>
            </div>
          </form>

          {loadStatus === "loading" && !overview ? (
            <p className="template-governance-empty">正在加载模板族...</p>
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
                        {formatTemplateGovernanceManuscriptTypeLabel(family.manuscript_type)} ·{" "}
                        {formatTemplateGovernanceFamilyStatusLabel(family.status)}
                      </small>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="template-governance-empty">
              还没有模板族，先建立一个治理范围，再继续配置规则与模板。
            </p>
          )}

          {overview?.selectedTemplateFamily ? (
            <form
              className="template-governance-form-grid"
              onSubmit={handleUpdateSelectedTemplateFamily}
            >
              <p className="template-governance-selected-note">
                当前编辑模板族：<strong>{overview.selectedTemplateFamily.name}</strong>
              </p>
              <label className="template-governance-field">
                <span>当前族名称</span>
                <input
                  value={selectedFamilyForm.name}
                  onChange={(event) =>
                    setSelectedFamilyForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="当前模板族名称"
                />
              </label>
              <label className="template-governance-field">
                <span>状态</span>
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
                      {formatTemplateGovernanceFamilyStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="template-governance-actions template-governance-actions-full">
                <button type="submit" disabled={isBusy}>
                  {isBusy ? "保存中..." : "保存当前模板族"}
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
                  重置当前模板族
                </button>
              </div>
            </form>
          ) : null}
        </article>

        <article className="template-governance-panel template-governance-panel-wide">
          <div className="template-governance-panel-header">
            <div>
              <h3>规则创建</h3>
              <p>
                {shouldUseRulePackageWorkbench
                  ? "先从示例驱动的规则包进入，再确认 AI 可读语义；只有需要深修时再打开高级规则编辑器。"
                  : "在同一块治理工作台内维护结构化规则，并保留期刊层与稿件族层的差异。"}
              </p>
            </div>
          </div>

          {shouldUseRulePackageWorkbench ? (
            <>
              <RulePackageUploadIntake
                originalFileName={rulePackageOriginalFile?.name ?? null}
                editedFileName={rulePackageEditedFile?.name ?? null}
                canStart={
                  rulePackageOriginalFile != null && rulePackageEditedFile != null
                }
                isBusy={rulePackageLoadStatus === "loading"}
                onOriginalFileSelect={handleSelectRulePackageOriginalFile}
                onEditedFileSelect={handleSelectRulePackageEditedFile}
                onStart={() => {
                  void handleStartRulePackageRecognition();
                }}
              />
              {rulePackageRestoreMessage ? (
                <p className="template-governance-context-note template-governance-context-note--compact">
                  {rulePackageRestoreMessage}
                </p>
              ) : null}
              <RulePackageAuthoringShell
                workspaceState={rulePackageWorkspaceState}
                targetModule={overview?.selectedRuleSet?.module ?? "editing"}
                isAdvancedEditorVisible={isAdvancedRuleEditorVisible}
                isLoading={rulePackageLoadStatus === "loading"}
                isPreviewRefreshing={isRulePackagePreviewBusy}
                isCompilePreviewBusy={isRulePackageCompilePreviewBusy}
                isCompileBusy={isRulePackageCompileBusy}
                compilePreview={rulePackageWorkspaceState?.compilePreview ?? null}
                compileResult={rulePackageWorkspaceState?.compileResult ?? null}
                canPreviewCompile={
                  rulePackageWorkspaceState != null &&
                  rulePackageWorkspaceState.candidates.length > 0 &&
                  overview?.selectedTemplateFamilyId != null
                }
                canCompile={
                  rulePackageWorkspaceState != null &&
                  rulePackageWorkspaceState.candidates.length > 0 &&
                  overview?.selectedTemplateFamilyId != null
                }
                loadErrorMessage={rulePackageErrorMessage}
                onSelectPackage={handleSelectRulePackage}
                onUpdateDraft={handleUpdateSelectedRulePackageDraft}
                onRefreshPreview={() => {
                  void handleRefreshRulePackagePreview();
                }}
                onPreviewCompile={() => {
                  void handlePreviewRulePackageCompile();
                }}
                onCompileToDraft={() => {
                  void handleCompileRulePackagesToDraft();
                }}
                onOpenDraftRuleSet={() => {
                  void handleOpenCompiledDraftRuleSet();
                }}
                onOpenAdvancedRuleEditor={() => {
                  void handleOpenCompiledDraftAdvancedEditor();
                }}
                onGoToPublishArea={() => {
                  void handleGoToCompiledDraftPublishArea();
                }}
                onToggleAdvancedEditor={handleToggleRulePackageAdvancedEditor}
                advancedEditor={advancedRuleEditor}
              />
            </>
          ) : (
            advancedRuleEditor
          )}
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
              <h3>模板套用</h3>
              <p>
                先在当前稿件族中创建模块模板草稿，再发布已经准备好的版本，不把模板细节堆到业务页面。
              </p>
            </div>
          </div>

          {overview?.selectedTemplateFamily ? (
            <>
              <p className="template-governance-selected-note">
                当前模板族： <strong>{overview.selectedTemplateFamily.name}</strong> (
                {formatTemplateGovernanceManuscriptTypeLabel(
                  overview.selectedTemplateFamily.manuscript_type,
                )}
                )
              </p>
              {isEditingModuleTemplate ? (
                <p className="template-governance-selected-note">
                  当前正在编辑：{" "}
                  <strong>{formatTemplateGovernanceModuleLabel(selectedModuleTemplate.module)}</strong> v
                  {selectedModuleTemplate.version_no}
                </p>
              ) : null}
              <form className="template-governance-form-grid" onSubmit={handleSubmitModuleTemplateDraft}>
                <label className="template-governance-field">
                  <span>模块</span>
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
                        {formatTemplateGovernanceModuleLabel(module)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="template-governance-field template-governance-field-full">
                  <span>模块说明</span>
                  <textarea
                    rows={5}
                    value={moduleForm.prompt}
                    onChange={(event) =>
                      setModuleForm((current) => ({ ...current, prompt: event.target.value }))
                    }
                    placeholder="说明该稿件族在当前模块下的执行目标与约束。"
                  />
                </label>
                <label className="template-governance-field">
                  <span>检查清单</span>
                  <input
                    value={moduleForm.checklist}
                    onChange={(event) =>
                      setModuleForm((current) => ({ ...current, checklist: event.target.value }))
                    }
                    placeholder="用逗号分隔"
                  />
                </label>
                <label className="template-governance-field">
                  <span>章节要求</span>
                  <input
                    value={moduleForm.sectionRequirements}
                    onChange={(event) =>
                      setModuleForm((current) => ({
                        ...current,
                        sectionRequirements: event.target.value,
                      }))
                    }
                    placeholder="用逗号分隔"
                  />
                </label>
                <div className="template-governance-actions template-governance-actions-full">
                  <button type="submit" disabled={isBusy}>
                    {isBusy
                      ? "保存中..."
                      : isEditingModuleTemplate
                        ? "保存草稿修改"
                        : "新建模块模板草稿"}
                  </button>
                  <button type="button" disabled={isBusy} onClick={handleResetModuleTemplateForm}>
                    {isEditingModuleTemplate ? "取消编辑" : "重置草稿表单"}
                  </button>
                </div>
              </form>

              {overview.moduleTemplates.length ? (
                <ul className="template-governance-list">
                  {overview.moduleTemplates.map((moduleTemplate) => (
                    <li key={moduleTemplate.id} className="template-governance-card">
                      <div>
                        <strong>
                          {formatTemplateGovernanceModuleLabel(moduleTemplate.module)} · v
                          {moduleTemplate.version_no}
                        </strong>
                        <small>
                          {formatTemplateGovernanceGovernedAssetStatusLabel(
                            moduleTemplate.status,
                          )}{" "}
                          ·{" "}
                          {formatTemplateGovernanceManuscriptTypeLabel(
                            moduleTemplate.manuscript_type,
                          )}
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
                              ? "正在编辑"
                              : "编辑草稿"}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handlePublishModuleTemplate(moduleTemplate.id)}
                          >
                            发布草稿
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="template-governance-empty">
                  当前模板族还没有模块模板。
                </p>
              )}
            </>
          ) : (
            <p className="template-governance-empty">
              先选择或创建模板族，再管理模板套用。
            </p>
          )}
        </article>

        <TemplateGovernanceProofreadingStrategyPane
          proofreadingRuleSetCount={proofreadingRuleSetCount}
          proofreadingTemplateCount={proofreadingTemplateCount}
          proofreadingInstructionCount={proofreadingInstructionCount}
          tableRuleCount={tableRuleCount}
          tableKnowledgeCount={tableKnowledgeCount}
        />

        <article className="template-governance-panel">
          <div className="template-governance-panel-header">
            <div>
              <h3>检索质量</h3>
              <p>
                在不改变发布流程的前提下，查看当前稿件族最近一次检索质量证据与观察信号。
              </p>
            </div>
          </div>

          <p className="template-governance-selected-note">
            {retrievalInsights?.message ??
              "选定模板族后，这里会显示最近一次检索质量证据。"}
          </p>

          {retrievalInsights?.latestRun ? (
            <article className="template-governance-card">
              <strong>最近一次运行</strong>
              <small>
                {formatTemplateGovernanceModuleLabel(retrievalInsights.latestRun.module)} 路{" "}
                {retrievalInsights.latestRun.created_at}
              </small>
              <p>
                标注集版本 {retrievalInsights.latestRun.gold_set_version_id} 路 快照数{" "}
                {retrievalInsights.latestRun.retrieval_snapshot_ids.length}
              </p>
              <div className="template-governance-chip-row">
                <span className="template-governance-chip">
                  答案相关性 {formatRetrievalMetric(
                    retrievalInsights.latestRun.metric_summary.answer_relevancy,
                  )}
                </span>
                {retrievalInsights.latestRun.metric_summary.context_precision != null ? (
                  <span className="template-governance-chip">
                    上下文精确率{" "}
                    {formatRetrievalMetric(
                      retrievalInsights.latestRun.metric_summary.context_precision,
                    )}
                  </span>
                ) : null}
                {retrievalInsights.latestRun.metric_summary.context_recall != null ? (
                  <span className="template-governance-chip">
                    上下文召回率{" "}
                    {formatRetrievalMetric(
                      retrievalInsights.latestRun.metric_summary.context_recall,
                    )}
                  </span>
                ) : null}
              </div>
            </article>
          ) : (
            <p className="template-governance-empty">
              当前稿件族还没有可查看的检索质量运行记录。
            </p>
          )}

          {retrievalInsights?.latestSnapshot ? (
            <article className="template-governance-card">
              <strong>最近一次快照摘要</strong>
              <small>{retrievalInsights.latestSnapshot.created_at}</small>
              <p>{retrievalInsights.latestSnapshot.query_text}</p>
              <div className="template-governance-chip-row">
                <span className="template-governance-chip">
                  已召回 {retrievalInsights.latestSnapshot.retrieved_count}
                </span>
                <span className="template-governance-chip">
                  已重排 {retrievalInsights.latestSnapshot.reranked_count}
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
              <strong>运营信号</strong>
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
                    <small>{formatTemplateGovernanceRetrievalSignalKindLabel(signal.kind)}</small>
                    <p>{signal.body}</p>
                    <small>
                      证据 路 run {signal.evidence.retrieval_run_id ?? "未记录"} 路 snapshot{" "}
                      {signal.evidence.retrieval_snapshot_id ?? "未记录"}
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
              <h3>知识库</h3>
              <p>
                知识录入已经迁移到独立知识库页面，规则中心这里只保留摘要、绑定关系与跳转入口。
              </p>
            </div>
          </div>

          <div className="template-governance-toolbar">
            <article className="template-governance-card">
              <strong>打开知识库</strong>
              <p>
                需要新增资产、派生修订草稿、管理绑定或提交送审时，直接进入独立知识库页面。
              </p>
              <div className="template-governance-actions">
                <a className="template-governance-link-button" href={knowledgeLibraryHash}>
                  打开知识库
                </a>
              </div>
            </article>
          </div>

          <div className="template-governance-knowledge-grid">
            <div className="template-governance-knowledge-list">
              <h4>Coverage Summary</h4>
              <article className="template-governance-card">
                <strong>知识录入已迁移到独立知识库。</strong>
                <p>
                  在知识库中完成新增或修订后，再回到规则中心查看稿件族绑定关系与下游规则覆盖情况。
                </p>
                <div className="template-governance-detail-grid">
                  <div>
                    <span>当前稿件族</span>
                    <p>{overview?.selectedTemplateFamily?.name ?? "尚未选择"}</p>
                  </div>
                  <div>
                    <span>可见知识项</span>
                    <p>{overview?.visibleKnowledgeItems.length ?? 0}</p>
                  </div>
                  <div>
                    <span>已绑定当前稿件族</span>
                    <p>{overview?.boundKnowledgeItems.length ?? 0}</p>
                  </div>
                  <div>
                    <span>当前是否已有草稿</span>
                    <p>
                      {isEditingDraft
                        ? "有，继续在知识库中处理。"
                        : "当前没有激活草稿。"}
                    </p>
                  </div>
                </div>
              </article>
            </div>

            <div className="template-governance-knowledge-detail">
              <h4>当前选中知识</h4>
              {selectedKnowledgeItem ? (
                <article className="template-governance-card">
                  <strong>{selectedKnowledgeItem.title}</strong>
                  <small>
                    {formatTemplateGovernanceGovernedAssetStatusLabel(
                      selectedKnowledgeItem.status,
                    )}{" "}
                    · {formatTemplateGovernanceKnowledgeKindLabel(selectedKnowledgeItem.knowledge_kind)}
                  </small>
                  <p>{selectedKnowledgeItem.summary ?? selectedKnowledgeItem.canonical_text}</p>
                  <div className="template-governance-detail-grid">
                    <div>
                      <span>资产</span>
                      <p>{selectedKnowledgeItem.asset_id ?? "仅旧版条目"}</p>
                    </div>
                    <div>
                      <span>版本</span>
                      <p>{selectedKnowledgeItem.revision_id ?? "未记录"}</p>
                    </div>
                  </div>
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
                  当前页不再直接编辑知识草稿，需要时请打开知识库查看或修订知识资产。
                </p>
              )}

              <div className="template-governance-actions">
                <a className="template-governance-link-button" href={knowledgeLibraryHash}>
                  打开知识库
                </a>
              </div>
            </div>
          </div>
        </article>
      </div>
        </>
      )}
    </section>
  );
}

function TemplateGovernanceOverviewRoute({
  controller,
  initialOverview,
}: {
  controller: TemplateGovernanceWorkbenchController;
  initialOverview: TemplateGovernanceWorkbenchOverview | null;
}) {
  const [overview, setOverview] = useState(initialOverview);
  const [extractionAwaitingConfirmationCount, setExtractionAwaitingConfirmationCount] =
    useState(0);
  const metrics = buildTemplateGovernanceOverviewMetrics(
    overview,
    extractionAwaitingConfirmationCount,
  );

  useEffect(() => {
    let isCancelled = false;

    if (!initialOverview) {
      void controller.loadOverview().then((nextOverview) => {
        if (!isCancelled) {
          setOverview(nextOverview);
        }
      });
    }

    void controller.loadExtractionLedger().then((ledger) => {
      if (!isCancelled) {
        setExtractionAwaitingConfirmationCount(
          ledger.summary.awaitingConfirmationCount,
        );
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [controller, initialOverview]);

  return (
    <TemplateGovernanceOverviewPage
      metrics={metrics}
      pendingItems={buildTemplateGovernanceOverviewPendingItems(
        overview,
        metrics,
      )}
      recentUpdates={buildTemplateGovernanceOverviewRecentUpdates(overview, metrics)}
      onOpenView={navigateToTemplateGovernanceView}
    />
  );
}

function TemplateGovernanceLearningRecoveryRoute({
  actorRole,
  prefilledManuscriptId,
  prefilledReviewedCaseSnapshotId,
  initialLearningCandidates,
  initialSelectedLearningCandidateId,
  onOpenCandidateRuleDraft,
}: {
  actorRole: AuthRole;
  prefilledManuscriptId?: string;
  prefilledReviewedCaseSnapshotId?: string;
  initialLearningCandidates: readonly LearningCandidateViewModel[];
  initialSelectedLearningCandidateId?: string;
  onOpenCandidateRuleDraft(candidateId: string): void;
}) {
  const normalizedPrefilledManuscriptId = prefilledManuscriptId?.trim() ?? "";
  const normalizedPrefilledReviewedCaseSnapshotId =
    prefilledReviewedCaseSnapshotId?.trim() ?? "";

  return (
    <section
      className="template-governance-recovery-route"
      data-mode="rule-center-recovery"
    >
      <header className="template-governance-ledger-toolbar template-governance-recovery-toolbar">
        <div className="template-governance-ledger-toolbar-copy">
          <p className="template-governance-eyebrow">规则中心 · 转规则站</p>
          <h1>回流候选转规则</h1>
          <p>先完成审核结论，再转成规则草稿。</p>
        </div>

        <div className="template-governance-chip-row">
          <span className="template-governance-chip">转规则站</span>
          <span className="template-governance-chip template-governance-chip-secondary">
            待处理 {initialLearningCandidates.length}
          </span>
          {normalizedPrefilledManuscriptId.length > 0 ? (
            <span className="template-governance-chip template-governance-chip-secondary">
              稿件 {normalizedPrefilledManuscriptId}
            </span>
          ) : null}
          {normalizedPrefilledReviewedCaseSnapshotId.length > 0 ? (
            <span className="template-governance-chip template-governance-chip-secondary">
              快照 {normalizedPrefilledReviewedCaseSnapshotId}
            </span>
          ) : null}
        </div>
      </header>

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
        onConvertToRuleDraft={(prefill) => {
          onOpenCandidateRuleDraft(prefill.sourceLearningCandidateId);
        }}
      />
    </section>
  );
}

function TemplateGovernanceRuleLedgerRoute({
  controller,
  actorRole,
  recoveryMode = false,
  prefilledManuscriptId,
  prefilledReviewedCaseSnapshotId,
  initialCategory = "all",
  initialSelectedRowId,
  initialLearningCandidates = [],
  initialSelectedLearningCandidateId,
  initialWizardMode = null,
}: {
  controller: TemplateGovernanceWorkbenchController;
  actorRole: AuthRole;
  recoveryMode?: boolean;
  prefilledManuscriptId?: string;
  prefilledReviewedCaseSnapshotId?: string;
  initialCategory?: TemplateGovernanceRuleLedgerCategory;
  initialSelectedRowId?: string;
  initialLearningCandidates?: readonly LearningCandidateViewModel[];
  initialSelectedLearningCandidateId?: string;
  initialWizardMode?: RuleWizardState["mode"] | null;
}) {
  const [ledger, setLedger] = useState<TemplateGovernanceRuleLedgerViewModel>(
    () =>
      mergeRuleLedgerWithLearningCandidates(
        createEmptyTemplateGovernanceRuleLedgerViewModel(),
        initialLearningCandidates,
        initialCategory,
        initialSelectedLearningCandidateId,
      ),
  );
  const [searchValue, setSearchValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<TemplateGovernanceRuleLedgerCategory>(initialCategory);
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeCommandPanel, setActiveCommandPanel] = useState<
    "search" | "filter" | "bulk" | null
  >(null);
  const [clientFilterState, setClientFilterState] = useState({
    moduleValue: "all",
    publishStatusValue: "all",
    semanticStatusValue: "all",
  });
  const [bulkSelectedRowIds, setBulkSelectedRowIds] = useState<string[]>([]);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [wizardState, setWizardState] = useState<RuleWizardState | null>(() =>
    initialWizardMode ? createRuleWizardState(initialWizardMode) : null,
  );
  const [wizardTitle, setWizardTitle] = useState<string | undefined>(undefined);
  const [wizardEntryForm, setWizardEntryForm] = useState<RuleWizardEntryFormState>(
    () => createRuleWizardEntryFormState(),
  );
  const [wizardBindingDetail, setWizardBindingDetail] = useState<
    Pick<KnowledgeAssetDetailViewModel, "selected_revision"> | null
  >(null);
  const initialSelectedRowIdRef = useRef(initialSelectedRowId ?? null);

  useEffect(() => {
    let isCancelled = false;
    setIsBusy(true);
    setErrorMessage(null);

    void controller
      .loadRuleLedger({
        category: selectedCategory,
        searchQuery,
        selectedRowId: initialSelectedRowIdRef.current,
      })
      .then((nextLedger) => {
        if (!isCancelled) {
          setLedger(
            mergeRuleLedgerWithLearningCandidates(
              nextLedger,
              initialLearningCandidates,
              selectedCategory,
              initialSelectedLearningCandidateId,
            ),
          );
          initialSelectedRowIdRef.current = null;
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setErrorMessage(toErrorMessage(error, "规则台账加载失败"));
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsBusy(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    controller,
    initialLearningCandidates,
    initialSelectedLearningCandidateId,
    searchQuery,
    selectedCategory,
  ]);

  useEffect(() => {
    const availableRowIds = new Set(ledger.rows.map((row) => row.id));
    setBulkSelectedRowIds((current) => current.filter((rowId) => availableRowIds.has(rowId)));
  }, [ledger.rows]);

  const filterOptions = collectTemplateGovernanceRuleLedgerFilterOptions(ledger.rows);
  const filteredLedgerRows = applyTemplateGovernanceRuleLedgerClientFilters(
    ledger.rows,
    clientFilterState,
  );
  const visibleLedgerRows =
    showSelectedOnly
      ? filteredLedgerRows.filter((row) => bulkSelectedRowIds.includes(row.id))
      : filteredLedgerRows;
  const selectedLedgerRowId = ledger.selectedRowId ?? ledger.selectedRow?.id ?? null;
  const selectedVisibleRowId =
    selectedLedgerRowId &&
    visibleLedgerRows.some((row) => row.id === selectedLedgerRowId)
      ? selectedLedgerRowId
      : null;
  const ruleLedgerSearchState =
    activeCommandPanel === "search"
      ? buildTemplateGovernanceRuleLedgerSearchState(
          visibleLedgerRows,
          searchValue.trim().length > 0 ? searchValue.trim() : searchQuery,
        )
      : createEmptyLedgerSearchState();

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchQuery(searchValue.trim());
    setActiveCommandPanel("search");
    setStatusMessage(null);
  }

  function handleSelectCategory(category: TemplateGovernanceRuleLedgerCategory) {
    setSelectedCategory(category);
    setStatusMessage(null);
    setActiveCommandPanel(null);
    setShowSelectedOnly(false);
    setBulkSelectedRowIds([]);
  }

  function handleSelectRow(rowId: string) {
    setLedger((current) => selectTemplateGovernanceRuleLedgerRow(current, rowId));
  }

  function toggleCommandPanel(nextPanel: "search" | "filter" | "bulk") {
    setActiveCommandPanel((current) => (current === nextPanel ? null : nextPanel));
    setStatusMessage(null);
  }

  function handleToggleBulkRowSelection(rowId: string) {
    setBulkSelectedRowIds((current) =>
      current.includes(rowId)
        ? current.filter((entry) => entry !== rowId)
        : current.concat(rowId),
    );
  }

  function handleOpenCreateRule() {
    setWizardState(createRuleWizardState("create"));
    setWizardTitle(undefined);
    setWizardEntryForm(createRuleWizardEntryFormState());
    setWizardBindingDetail(null);
    setActiveCommandPanel(null);
  }

  async function handleOpenSelectedItem(rowId: string) {
    const selectedRow = ledger.rows.find((row) => row.id === rowId) ?? null;
    if (!selectedRow) {
      return;
    }

    const selectedLearningCandidate =
      selectedRow.asset_kind === "recycled_candidate"
        ? selectedRow.learning_candidate ??
          initialLearningCandidates.find((candidate) => candidate.id === rowId) ??
          null
        : null;

    if (selectedLearningCandidate) {
      setWizardState(
        createRuleWizardState("candidate", {
          sourceRowId: selectedRow.id,
        }),
      );
      setWizardTitle(selectedRow.title);
      setWizardEntryForm(
        createRuleWizardEntryFormStateFromLearningCandidate(selectedLearningCandidate),
      );
      setWizardBindingDetail(null);
      setActiveCommandPanel(null);
      return;
    }

    if (selectedRow.asset_kind !== "rule") {
      setErrorMessage("当前条目暂不支持通过规则向导编辑。");
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      const detail = (
        await getKnowledgeAssetDetail(defaultRuleWizardAssetClient, selectedRow.id)
      ).body;
      const selectedRevision = detail.selected_revision;
      setWizardState(
        createRuleWizardState("edit", {
          sourceRowId: selectedRow.id,
          draftAssetId: detail.asset.id,
          draftRevisionId:
            selectedRevision.status === "draft" ||
            selectedRevision.status === "pending_review"
              ? selectedRevision.id
              : undefined,
        }),
      );
      setWizardTitle(selectedRevision.title);
      setWizardEntryForm(createRuleWizardEntryFormStateFromDetail(detail));
      setWizardBindingDetail(detail);
      setActiveCommandPanel(null);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "规则详情加载失败"));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSaveRuleWizardDraft() {
    if (!wizardState) {
      return;
    }

    if (wizardState.step !== "entry") {
      setWizardState((current) =>
        current == null ? current : { ...current, dirty: false },
      );
      setStatusMessage("规则草稿已暂存。");
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      const result = await controller.saveRuleWizardEntryDraft({
        form: wizardEntryForm,
        draftAssetId: wizardState.draftAssetId,
        draftRevisionId: wizardState.draftRevisionId,
      });
      setWizardState((current) =>
        current == null
          ? current
          : {
              ...current,
              dirty: false,
              draftAssetId: result.draftAssetId,
              draftRevisionId: result.draftRevisionId,
            },
      );
      setStatusMessage("规则草稿已暂存。");
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "规则录入草稿保存失败"));
    } finally {
      setIsBusy(false);
    }
  }

  function handleRuleWizardEntryFormChange(nextValue: RuleWizardEntryFormState) {
    setWizardEntryForm(nextValue);
    setWizardState((current) =>
      current == null ? current : { ...current, dirty: true },
    );
  }

  async function handleCompleteRuleWizard(releaseAction?: RuleWizardReleaseAction) {
    if (!wizardState) {
      return;
    }

    const completedWizardState = wizardState;
    const nextCategory = resolveRuleLedgerCategoryAfterWizardCompletion(
      completedWizardState,
      selectedCategory,
    );

    setWizardState(null);
    setWizardTitle(undefined);
    setWizardBindingDetail(null);
    setActiveCommandPanel(null);
    setShowSelectedOnly(false);
    setBulkSelectedRowIds([]);
    setIsBusy(true);
    setErrorMessage(null);

    try {
      const nextLedger = await controller.loadRuleLedger({
        category: nextCategory,
        searchQuery,
        selectedRowId:
          completedWizardState.draftAssetId ??
          completedWizardState.sourceRowId ??
          null,
      });

      setSelectedCategory(nextCategory);
      setLedger(
        mergeRuleLedgerWithLearningCandidates(
          nextLedger,
          initialLearningCandidates,
          nextCategory,
          initialSelectedLearningCandidateId,
        ),
      );
      setStatusMessage(resolveRuleWizardCompletionMessage(releaseAction));
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "规则台账刷新失败"));
    } finally {
      setIsBusy(false);
    }
  }

  if (wizardState) {
    return (
      <TemplateGovernanceRuleWizard
        state={wizardState}
        title={wizardTitle}
        entryFormState={wizardEntryForm}
        bindingDetail={wizardBindingDetail ?? undefined}
        onEntryFormChange={handleRuleWizardEntryFormChange}
        onBack={() => {
          setWizardState(null);
          setWizardBindingDetail(null);
          setStatusMessage("已返回转规则站。");
        }}
        onPrevious={() => {
          setWizardState((current) =>
            current == null ? current : rewindRuleWizardState(current),
          );
        }}
        onNext={() => {
          setWizardState((current) =>
            current == null ? current : advanceRuleWizardState(current),
          );
        }}
        onSaveDraft={() => {
          void handleSaveRuleWizardDraft();
        }}
        onComplete={(input) => {
          void handleCompleteRuleWizard(input?.releaseAction);
        }}
      />
    );
  }

  if (recoveryMode) {
    return (
      <TemplateGovernanceLearningRecoveryRoute
        actorRole={actorRole}
        prefilledManuscriptId={prefilledManuscriptId}
        prefilledReviewedCaseSnapshotId={prefilledReviewedCaseSnapshotId}
        initialLearningCandidates={initialLearningCandidates}
        initialSelectedLearningCandidateId={initialSelectedLearningCandidateId}
        onOpenCandidateRuleDraft={(candidateId) => {
          handleOpenSelectedItem(candidateId);
        }}
      />
    );
  }

  return (
    <TemplateGovernanceRuleLedgerPage
      initialViewModel={createTemplateGovernanceRuleLedgerViewModel({
        rows: visibleLedgerRows,
        category: selectedCategory,
        searchQuery,
        selectedRowId: selectedVisibleRowId,
      })}
      navigationItems={createTemplateGovernanceNavigationItems(
        "rule-ledger",
        navigateToTemplateGovernanceSection,
      )}
      searchState={ruleLedgerSearchState}
      filterState={{
        isOpen: activeCommandPanel === "filter",
        moduleOptions: filterOptions.moduleOptions,
        publishStatusOptions: filterOptions.publishStatusOptions,
        semanticStatusOptions: filterOptions.semanticStatusOptions,
        moduleValue: clientFilterState.moduleValue,
        publishStatusValue: clientFilterState.publishStatusValue,
        semanticStatusValue: clientFilterState.semanticStatusValue,
        onModuleValueChange: (value) =>
          setClientFilterState((current) => ({ ...current, moduleValue: value })),
        onPublishStatusValueChange: (value) =>
          setClientFilterState((current) => ({
            ...current,
            publishStatusValue: value,
          })),
        onSemanticStatusValueChange: (value) =>
          setClientFilterState((current) => ({
            ...current,
            semanticStatusValue: value,
          })),
      }}
      bulkState={{
        isOpen: activeCommandPanel === "bulk",
        selectedRowIds: bulkSelectedRowIds,
        showSelectedOnly,
        onToggleRowSelection: handleToggleBulkRowSelection,
        onSelectVisibleRows: () => {
          setBulkSelectedRowIds(filteredLedgerRows.map((row) => row.id));
        },
        onClearSelection: () => {
          setBulkSelectedRowIds([]);
          setShowSelectedOnly(false);
        },
        onToggleShowSelectedOnly: () => {
          setShowSelectedOnly((current) => !current);
        },
      }}
      searchValue={searchValue}
      isBusy={isBusy}
      statusMessage={statusMessage}
      errorMessage={errorMessage}
      onSearchValueChange={setSearchValue}
      onSearchSubmit={handleSearchSubmit}
      onSelectCategory={handleSelectCategory}
      onSelectRow={handleSelectRow}
      onOpenCreateRule={handleOpenCreateRule}
      onOpenSelectedItem={(rowId) => {
        void handleOpenSelectedItem(rowId);
      }}
      selectedItemActionLabel={
        ledger.selectedRow?.asset_kind === "recycled_candidate" ? "转成规则草稿" : "编辑规则"
      }
      onOpenSearch={() => {
        setSearchQuery(searchValue.trim());
        toggleCommandPanel("search");
      }}
      onOpenFilter={() => {
        toggleCommandPanel("filter");
      }}
      onOpenBulkActions={() => {
        toggleCommandPanel("bulk");
      }}
      onImport={() => {
        setActiveCommandPanel(null);
        navigateToTemplateGovernanceSection("extraction-ledger");
      }}
    />
  );
}

function TemplateGovernanceExtractionLedgerRoute({
  controller,
}: {
  controller: TemplateGovernanceWorkbenchController;
}) {
  const [ledger, setLedger] = useState<TemplateGovernanceExtractionLedgerViewModel>(
    createEmptyExtractionLedgerViewModel(),
  );
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [searchState, setSearchState] = useState<TemplateGovernanceLedgerSearchState>(
    createEmptyLedgerSearchState(),
  );
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskDraft, setTaskDraft] = useState<TemplateGovernanceExtractionTaskFormDraft>(
    createExtractionTaskDraft(),
  );
  const [candidateFormOpen, setCandidateFormOpen] = useState(false);
  const [candidateFormValues, setCandidateFormValues] =
    useState<TemplateGovernanceCandidateConfirmationFormValues>(
      createCandidateConfirmationFormValues(),
    );
  const [originalFile, setOriginalFile] = useState<BrowserUploadFile | null>(null);
  const [editedFile, setEditedFile] = useState<BrowserUploadFile | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedCandidate = selectExtractionCandidate(ledger, selectedCandidateId);

  useEffect(() => {
    let isCancelled = false;

    void controller
      .loadExtractionLedger()
      .then((nextLedger) => {
        if (!isCancelled) {
          setLedger(nextLedger);
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setErrorMessage(toErrorMessage(error, "提取台账加载失败"));
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [controller]);

  useEffect(() => {
    setSelectedCandidateId((current) => {
      const candidateIds =
        ledger.selectedTask?.candidates.map((candidate) => candidate.id) ?? [];
      if (current && candidateIds.includes(current)) {
        return current;
      }

      return candidateIds[0] ?? null;
    });
  }, [ledger.selectedTask]);

  function resetFeedback() {
    setStatusMessage(null);
    setErrorMessage(null);
  }

  function handleSearchAction() {
    setSearchState(buildExtractionLedgerSearchState(ledger, searchValue));
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleSearchAction();
  }

  function handleOpenTaskForm() {
    resetFeedback();
    setCandidateFormOpen(false);
    setTaskFormOpen(true);
    setOriginalFile(null);
    setEditedFile(null);
    setTaskDraft(createExtractionTaskDraft());
  }

  async function handleSelectTask(taskId: string) {
    resetFeedback();
    setTaskFormOpen(false);
    setCandidateFormOpen(false);
    setIsBusy(true);

    try {
      const nextLedger = await controller.loadExtractionLedger({
        selectedTaskId: taskId,
      });
      setLedger(nextLedger);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "切换提取任务失败"));
    } finally {
      setIsBusy(false);
    }
  }

  function handleSelectCandidate(candidateId: string) {
    resetFeedback();
    setSelectedCandidateId(candidateId);
  }

  function handleOpenCandidateForm() {
    resetFeedback();
    if (!selectedCandidate) {
      setErrorMessage("请先选择一个候选，再确认 AI 语义。");
      return;
    }

    setTaskFormOpen(false);
    setCandidateFormOpen(true);
    setCandidateFormValues(createCandidateConfirmationFormValues(selectedCandidate));
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
    const validationMessage = validateExtractionTaskDraft(taskDraft, {
      originalFile,
      editedFile,
    });
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    if (!originalFile || !editedFile) {
      setErrorMessage("请同时上传原稿和编辑稿。");
      return;
    }

    setIsBusy(true);
    resetFeedback();

    try {
      const { task, ledger: nextLedger } = await controller.createExtractionTaskAndReload({
        taskName: taskDraft.taskName.trim(),
        manuscriptType: taskDraft.manuscriptType,
        ...(taskDraft.journalKey.trim()
          ? { journalKey: taskDraft.journalKey.trim() }
          : {}),
        originalFile: await createInlineUploadFields(originalFile),
        editedFile: await createInlineUploadFields(editedFile),
      });
      setLedger(nextLedger);
      setSelectedCandidateId(task.candidates[0]?.id ?? null);
      setTaskFormOpen(false);
      setTaskDraft(createExtractionTaskDraft(task.manuscript_type));
      setOriginalFile(null);
      setEditedFile(null);
      setStatusMessage(`提取任务已创建：${task.task_name}`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "创建提取任务失败"));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCandidateAction(
    confirmationStatus: TemplateGovernanceCandidateConfirmationFormValues["confirmationStatus"],
    successMessage: string,
  ) {
    if (!ledger.selectedTask || !selectedCandidate) {
      setErrorMessage("请先选择候选，再执行确认。");
      return;
    }

    const validationMessage = validateCandidateConfirmationFormValues(
      candidateFormValues,
    );
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    setIsBusy(true);
    resetFeedback();

    try {
      const { ledger: nextLedger } =
        await controller.updateExtractionTaskCandidateAndReload({
          taskId: ledger.selectedTask.id,
          candidateId: selectedCandidate.id,
          input: toCandidateUpdateInput(
            selectedCandidate,
            candidateFormValues,
            confirmationStatus,
          ),
        });
      setLedger(nextLedger);
      setCandidateFormOpen(false);
      setStatusMessage(successMessage);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "候选语义确认失败"));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <TemplateGovernanceExtractionLedgerPage
      viewModel={ledger}
      selectedCandidateId={selectedCandidateId}
      searchState={searchState}
      searchValue={searchValue}
      taskFormOpen={taskFormOpen}
      taskDraft={taskDraft}
      candidateFormOpen={candidateFormOpen}
      candidateFormValues={candidateFormValues}
      isBusy={isBusy}
      statusMessage={statusMessage}
      errorMessage={errorMessage}
      navigationItems={createTemplateGovernanceNavigationItems(
        "extraction-ledger",
        navigateToTemplateGovernanceSection,
      )}
      onSearchValueChange={setSearchValue}
      onSearchSubmit={handleSearchSubmit}
      onSearchAction={handleSearchAction}
      onOpenTaskForm={handleOpenTaskForm}
      onOpenCandidateForm={handleOpenCandidateForm}
      onSelectTask={(taskId) => {
        void handleSelectTask(taskId);
      }}
      onSelectCandidate={handleSelectCandidate}
      onTaskDraftChange={setTaskDraft}
      onOriginalFileSelect={handleOriginalFileSelect}
      onEditedFileSelect={handleEditedFileSelect}
      onTaskFormCancel={() => {
        setTaskFormOpen(false);
      }}
      onTaskFormSubmit={() => {
        void handleTaskFormSubmit();
      }}
      onCandidateFormChange={setCandidateFormValues}
      onCandidateFormCancel={() => {
        setCandidateFormOpen(false);
      }}
      onCandidateHold={() => {
        void handleCandidateAction("held", "候选已暂存，后续可继续修改 AI 语义。");
      }}
      onCandidateReject={() => {
        void handleCandidateAction("rejected", "候选已驳回。");
      }}
      onCandidateConfirm={() => {
        void handleCandidateAction("confirmed", "候选已确认入库。");
      }}
    />
  );
}

function mergeRuleLedgerWithLearningCandidates(
  ledger: TemplateGovernanceRuleLedgerViewModel,
  learningCandidates: readonly LearningCandidateViewModel[],
  selectedCategory: TemplateGovernanceRuleLedgerCategory,
  initialSelectedLearningCandidateId?: string,
): TemplateGovernanceRuleLedgerViewModel {
  if (!learningCandidates.length) {
    return ledger;
  }

  const candidateRows = learningCandidates.map(createRuleLedgerRowFromLearningCandidate);
  const mergedRows = [
    ...ledger.rows.filter(
      (row) =>
        !candidateRows.some((candidateRow) => candidateRow.id === row.id),
    ),
    ...candidateRows,
  ];
  const preferredRowId =
    initialSelectedLearningCandidateId ??
    ledger.selectedRowId ??
    (selectedCategory === "recycled_candidate" ? candidateRows[0]?.id ?? null : null);
  const mergedLedger = createTemplateGovernanceRuleLedgerViewModel({
    rows: mergedRows,
    category: ledger.category || selectedCategory,
    searchQuery: ledger.searchQuery,
    selectedRowId: preferredRowId,
  });

  return preferredRowId
    ? selectTemplateGovernanceRuleLedgerRow(mergedLedger, preferredRowId)
    : mergedLedger;
}

function createRuleLedgerRowFromLearningCandidate(
  candidate: LearningCandidateViewModel,
): TemplateGovernanceRuleLedgerViewModel["rows"][number] {
  return {
    id: candidate.id,
    asset_kind: "recycled_candidate",
    title: candidate.title ?? "未命名回流候选",
    module_label: formatTemplateGovernanceModuleLabel(
      normalizeLearningCandidateModule(candidate.module),
    ),
    manuscript_type_label: formatTemplateGovernanceManuscriptTypeLabel(
      normalizeLearningCandidateManuscriptType(candidate.manuscript_type),
    ),
    semantic_status: "待治理",
    publish_status:
      candidate.status === "approved" ? "已批准候选" : "候选待处理",
    contributor_label: candidate.created_by,
    updated_at: candidate.updated_at,
    learning_candidate: candidate,
  };
}

export function createRuleWizardEntryFormStateFromRuleLedgerRow(
  row: TemplateGovernanceRuleLedgerRow,
): RuleWizardEntryFormState | null {
  if (row.asset_kind !== "recycled_candidate" || row.learning_candidate == null) {
    return null;
  }

  return createRuleWizardEntryFormStateFromLearningCandidate(row.learning_candidate);
}

export function resolveRuleLedgerCategoryAfterWizardCompletion(
  wizardState: RuleWizardState,
  currentCategory: TemplateGovernanceRuleLedgerCategory,
): TemplateGovernanceRuleLedgerCategory {
  if (
    wizardState.mode === "candidate" &&
    wizardState.draftAssetId &&
    currentCategory === "recycled_candidate"
  ) {
    return "rule";
  }

  return currentCategory;
}

function resolveRuleWizardCompletionMessage(
  releaseAction: RuleWizardReleaseAction | undefined,
): string {
  switch (releaseAction) {
    case "save_draft":
      return "规则草稿已回写到转规则站。";
    case "submit_review":
      return "规则已提交审核并返回转规则站。";
    case "publish_now":
      return "规则已发布并返回转规则站。";
    default:
      return "规则草稿向导已关闭，请继续在转规则站完成后续治理。";
  }
}

function createRuleWizardEntryFormStateFromLearningCandidate(
  candidate: LearningCandidateViewModel,
): RuleWizardEntryFormState {
  const payload = candidate.candidate_payload;

  return createRuleWizardEntryFormState({
    title: candidate.title ?? "未命名回流候选",
    moduleScope: normalizeLearningCandidateModule(candidate.module),
    manuscriptTypes: normalizeLearningCandidateManuscriptType(candidate.manuscript_type),
    sourceType: "internal_case",
    contributor: candidate.created_by,
    ruleBody: candidate.proposal_text ?? "",
    positiveExample:
      payload && typeof payload === "object" && "after_fragment" in payload
        ? String(payload.after_fragment ?? "")
        : "",
    negativeExample:
      payload && typeof payload === "object" && "before_fragment" in payload
        ? String(payload.before_fragment ?? "")
        : "",
    sourceBasis:
      payload && typeof payload === "object" && "evidence_summary" in payload
        ? String(payload.evidence_summary ?? "")
        : "",
  });
}

function normalizeLearningCandidateModule(value: string): RuleWizardEntryFormState["moduleScope"] {
  switch (value) {
    case "screening":
    case "editing":
    case "proofreading":
      return value;
    default:
      return "any";
  }
}

function normalizeLearningCandidateManuscriptType(value: string): string {
  return value.trim().length > 0 ? value : "any";
}

function TemplateGovernanceContentModuleLedgerRoute({
  controller,
  moduleClass,
}: {
  controller: TemplateGovernanceWorkbenchController;
  moduleClass: GovernedContentModuleClass;
}) {
  const [ledger, setLedger] =
    useState<TemplateGovernanceContentModuleLedgerViewModel>(
      createEmptyContentModuleLedgerViewModel(),
    );
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [formValues, setFormValues] = useState<TemplateGovernanceContentModuleFormValues>(
    createContentModuleFormValues(moduleClass),
  );
  const [searchValue, setSearchValue] = useState("");
  const [searchState, setSearchState] = useState<TemplateGovernanceLedgerSearchState>(
    createEmptyLedgerSearchState(),
  );
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedRuleKey, setSelectedRuleKey] = useState<string | null>(null);
  const [wizardState, setWizardState] = useState<RuleWizardState | null>(null);
  const [wizardTitle, setWizardTitle] = useState<string | undefined>(undefined);
  const [wizardEntryForm, setWizardEntryForm] = useState<RuleWizardEntryFormState>(
    createRuleWizardEntryFormState(),
  );
  const [wizardBindingDetail, setWizardBindingDetail] = useState<
    Pick<KnowledgeAssetDetailViewModel, "selected_revision"> | null
  >(null);

  useEffect(() => {
    let isCancelled = false;

    void controller
      .loadContentModuleLedger({
        moduleClass,
      })
      .then((nextLedger) => {
        if (!isCancelled) {
          setLedger(nextLedger);
          setSelectedRuleKey(resolveContentModuleRuleKey(nextLedger.selectedModuleRules[0]));
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setErrorMessage(toErrorMessage(error, "模块台账加载失败"));
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [controller, moduleClass]);

  useEffect(() => {
    setFormValues((current) =>
      formMode === "edit" && ledger.selectedModule
        ? toContentModuleFormValues(ledger.selectedModule)
        : current,
    );
  }, [formMode, ledger.selectedModule]);

  useEffect(() => {
    setSelectedRuleKey((current) => {
      if (ledger.selectedModuleRules.length === 0) {
        return null;
      }

      return ledger.selectedModuleRules.some(
        (rule) => resolveContentModuleRuleKey(rule) === current,
      )
        ? current
        : resolveContentModuleRuleKey(ledger.selectedModuleRules[0]);
    });
  }, [ledger.selectedModuleRules]);

  function resetFeedback() {
    setStatusMessage(null);
    setErrorMessage(null);
  }

  function handleSearchAction() {
    setSearchState(
      buildContentModuleSearchState({
        ledger,
        ledgerKind: moduleClass,
        query: searchValue,
      }),
    );
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleSearchAction();
  }

  async function handleSelectModule(moduleId: string) {
    resetFeedback();
    setFormMode(null);
    setIsBusy(true);

    try {
      const nextLedger = await controller.loadContentModuleLedger({
        moduleClass,
        selectedModuleId: moduleId,
      });
      setLedger(nextLedger);
      setSelectedRuleKey(resolveContentModuleRuleKey(nextLedger.selectedModuleRules[0]));
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "模块切换失败"));
    } finally {
      setIsBusy(false);
    }
  }

  function handleOpenCreateForm() {
    resetFeedback();
    setFormMode("create");
    setFormValues(createContentModuleFormValues(moduleClass));
  }

  function handleOpenEditForm() {
    if (!ledger.selectedModule) {
      setErrorMessage("请先在台账中选择一个模块。");
      return;
    }

    resetFeedback();
    setFormMode("edit");
    setFormValues(toContentModuleFormValues(ledger.selectedModule));
  }

  async function handleArchiveSelected() {
    if (!ledger.selectedModule) {
      setErrorMessage("请先在台账中选择一个模块。");
      return;
    }

    setIsBusy(true);
    resetFeedback();

    try {
      const { contentModule, ledger: nextLedger } =
        await controller.updateContentModuleDraftAndReload({
          contentModuleId: ledger.selectedModule.id,
          moduleClass,
          selectedModuleId: null,
          input: {
            status: "archived",
          },
        });
      setLedger(nextLedger);
      setFormMode(null);
      setStatusMessage(`模块已删除：${contentModule.name}`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "删除模块失败"));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleFormSubmit() {
    const validationMessage = validateContentModuleFormValues(formValues);
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    setIsBusy(true);
    resetFeedback();

    try {
      if (formMode === "edit" && ledger.selectedModule) {
        const { contentModule, ledger: nextLedger } =
          await controller.updateContentModuleDraftAndReload({
            contentModuleId: ledger.selectedModule.id,
            moduleClass,
            selectedModuleId: ledger.selectedModule.id,
            input: toContentModuleUpdateInput(formValues),
          });
        setLedger(nextLedger);
        setStatusMessage(`模块已更新：${contentModule.name}`);
      } else {
        const { contentModule, ledger: nextLedger } =
          await controller.createContentModuleDraftAndReload(
            toContentModuleCreateInput(formValues, moduleClass),
          );
        setLedger(nextLedger);
        setStatusMessage(`模块已创建：${contentModule.name}`);
      }

      setFormMode(null);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "保存模块失败"));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleOpenSelectedRuleEdit() {
    const selectedRule = resolveSelectedContentModuleRule(
      ledger.selectedModuleRules,
      selectedRuleKey,
    );
    if (!selectedRule) {
      setErrorMessage("请先在默认规则中选择一条规则。");
      return;
    }

    try {
      const detail =
        selectedRule.detail ??
        (
          await getKnowledgeAssetDetail(defaultRuleWizardAssetClient, selectedRule.assetId)
        ).body;
      const selectedRevision = detail.selected_revision;
      resetFeedback();
      setWizardState(
        createRuleWizardState("edit", {
          sourceRowId: selectedRule.assetId,
          draftAssetId: detail.asset.id,
          draftRevisionId:
            selectedRevision.status === "draft" ||
            selectedRevision.status === "pending_review"
              ? selectedRevision.id
              : undefined,
        }),
      );
      setWizardTitle(selectedRevision.title);
      setWizardEntryForm(createRuleWizardEntryFormStateFromDetail(detail));
      setWizardBindingDetail(detail);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "规则详情加载失败"));
    }
  }

  async function handleSaveRuleWizardDraft() {
    if (!wizardState) {
      return;
    }

    if (wizardState.step !== "entry") {
      setWizardState((current) =>
        current == null ? current : { ...current, dirty: false },
      );
      setStatusMessage("规则草稿已暂存。");
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      const result = await controller.saveRuleWizardEntryDraft({
        form: wizardEntryForm,
        draftAssetId: wizardState.draftAssetId,
        draftRevisionId: wizardState.draftRevisionId,
      });
      setWizardState((current) =>
        current == null
          ? current
          : {
              ...current,
              dirty: false,
              draftAssetId: result.draftAssetId,
              draftRevisionId: result.draftRevisionId,
            },
      );
      setStatusMessage("规则草稿已暂存。");
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "规则录入草稿保存失败"));
    } finally {
      setIsBusy(false);
    }
  }

  function handleRuleWizardEntryFormChange(nextValue: RuleWizardEntryFormState) {
    setWizardEntryForm(nextValue);
    setWizardState((current) =>
      current == null ? current : { ...current, dirty: true },
    );
  }

  async function handleCompleteRuleWizard(releaseAction?: RuleWizardReleaseAction) {
    if (!wizardState) {
      return;
    }

    const completedWizardState = wizardState;
    setWizardState(null);
    setWizardTitle(undefined);
    setWizardBindingDetail(null);
    setIsBusy(true);
    resetFeedback();

    try {
      const nextLedger = await controller.loadContentModuleLedger({
        moduleClass,
        selectedModuleId: ledger.selectedModuleId,
      });
      setLedger(nextLedger);
      setSelectedRuleKey(
        nextLedger.selectedModuleRules.find(
          (rule) => rule.assetId === (completedWizardState.draftAssetId ?? completedWizardState.sourceRowId),
        )
          ? `${completedWizardState.draftAssetId ?? completedWizardState.sourceRowId}:${nextLedger.selectedModuleRules.find(
              (rule) => rule.assetId === (completedWizardState.draftAssetId ?? completedWizardState.sourceRowId),
            )?.revisionId ?? ""}`
          : resolveContentModuleRuleKey(nextLedger.selectedModuleRules[0]),
      );
      setStatusMessage(resolvePackageRuleWizardCompletionMessage(releaseAction));
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "规则台账刷新失败"));
    } finally {
      setIsBusy(false);
    }
  }

  if (wizardState) {
    return (
      <TemplateGovernanceRuleWizard
        state={wizardState}
        title={wizardTitle}
        entryFormState={wizardEntryForm}
        bindingDetail={wizardBindingDetail ?? undefined}
        onEntryFormChange={handleRuleWizardEntryFormChange}
        onBack={() => {
          setWizardState(null);
          setWizardBindingDetail(null);
          setStatusMessage("已返回规则包台账。");
        }}
        onPrevious={() => {
          setWizardState((current) =>
            current == null ? current : rewindRuleWizardState(current),
          );
        }}
        onNext={() => {
          setWizardState((current) =>
            current == null ? current : advanceRuleWizardState(current),
          );
        }}
        onSaveDraft={() => {
          void handleSaveRuleWizardDraft();
        }}
        onComplete={(input) => {
          void handleCompleteRuleWizard(input?.releaseAction);
        }}
      />
    );
  }

  return (
    <TemplateGovernanceContentModuleLedgerPage
      ledgerKind={moduleClass}
      viewModel={ledger}
      formMode={formMode}
      formValues={formValues}
      searchState={searchState}
      searchValue={searchValue}
      isBusy={isBusy}
      statusMessage={statusMessage}
      errorMessage={errorMessage}
      navigationItems={createTemplateGovernanceNavigationItems(
        moduleClass === "general"
          ? "general-package-ledger"
          : "medical-package-ledger",
        navigateToTemplateGovernanceSection,
      )}
      onSearchValueChange={setSearchValue}
      onSearchSubmit={handleSearchSubmit}
      onOpenCreateForm={handleOpenCreateForm}
      onArchiveSelected={() => {
        void handleArchiveSelected();
      }}
      onJoinTemplate={() => {
        navigateToTemplateGovernanceSection("large-template-ledger");
      }}
      selectedRuleKey={selectedRuleKey}
      onSelectModule={(moduleId) => {
        void handleSelectModule(moduleId);
      }}
      onSelectRule={setSelectedRuleKey}
      onOpenEditForm={handleOpenEditForm}
      onOpenSelectedRuleEdit={() => {
        void handleOpenSelectedRuleEdit();
      }}
      onFormChange={setFormValues}
      onFormCancel={() => {
        setFormMode(null);
      }}
      onFormSubmit={() => {
        void handleFormSubmit();
      }}
    />
  );
}

function TemplateGovernanceJournalTemplateLedgerRoute({
  controller,
  actorRole,
}: {
  controller: TemplateGovernanceWorkbenchController;
  actorRole: AuthRole;
}) {
  const [viewModel, setViewModel] =
    useState<TemplateGovernanceJournalTemplateLedgerViewModel>(
      createEmptyJournalTemplateLedgerViewModel(),
    );
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [formValues, setFormValues] =
    useState<TemplateGovernanceJournalTemplateFormValues>(
      createJournalTemplateFormValues(),
    );
  const [searchValue, setSearchValue] = useState("");
  const [searchState, setSearchState] = useState<TemplateGovernanceLedgerSearchState>(
    createEmptyLedgerSearchState(),
  );
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    void controller
      .loadOverview()
      .then((overview) => {
        if (!isCancelled) {
          setViewModel(toJournalTemplateLedgerViewModel(overview));
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setErrorMessage(toErrorMessage(error, "期刊模板台账加载失败"));
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [controller]);

  function resetFeedback() {
    setStatusMessage(null);
    setErrorMessage(null);
  }

  async function handleReload(input: {
    selectedTemplateFamilyId?: string | null;
    selectedJournalTemplateId?: string | null;
  } = {}) {
    const overview = await controller.loadOverview(input);
    setViewModel(toJournalTemplateLedgerViewModel(overview));
  }

  function handleSearchAction() {
    setSearchState(buildJournalTemplateSearchState(viewModel, searchValue));
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleSearchAction();
  }

  function handleSelectTemplateFamily(templateFamilyId: string) {
    setIsBusy(true);
    resetFeedback();
    setFormMode(null);

    void handleReload({
      selectedTemplateFamilyId: templateFamilyId,
      selectedJournalTemplateId: null,
    })
      .catch((error) => {
        setErrorMessage(toErrorMessage(error, "切换大模板失败"));
      })
      .finally(() => {
        setIsBusy(false);
      });
  }

  function handleSelectJournalTemplate(journalTemplateId: string) {
    resetFeedback();
    setFormMode(null);
    setViewModel((current) =>
      selectJournalTemplateLedger(current, journalTemplateId),
    );
  }

  function handleOpenCreateForm() {
    if (!viewModel.selectedTemplateFamilyId) {
      setErrorMessage("请先选择一个大模板。");
      return;
    }

    resetFeedback();
    setFormMode("create");
    setFormValues(createJournalTemplateFormValues(viewModel.selectedTemplateFamilyId));
  }

  function handleOpenEditForm() {
    if (!viewModel.selectedJournalTemplate) {
      setErrorMessage("请先在台账中选择一个期刊模板。");
      return;
    }

    resetFeedback();
    setFormMode("edit");
    setFormValues(toJournalTemplateFormValues(viewModel.selectedJournalTemplate));
  }

  async function handleArchiveSelected() {
    if (!viewModel.selectedJournalTemplate) {
      setErrorMessage("请先在台账中选择一个期刊模板。");
      return;
    }

    setIsBusy(true);
    resetFeedback();

    try {
      const { overview } = await controller.archiveJournalTemplateProfileAndReload({
        journalTemplateProfileId: viewModel.selectedJournalTemplate.id,
        actorRole,
        selectedTemplateFamilyId: viewModel.selectedTemplateFamilyId,
        selectedJournalTemplateId: null,
      });
      setViewModel(toJournalTemplateLedgerViewModel(overview));
      setFormMode(null);
      setStatusMessage(
        `期刊模板已删除：${viewModel.selectedJournalTemplate.journal_name}`,
      );
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "删除期刊模板失败"));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleActivateSelected() {
    if (!viewModel.selectedJournalTemplate) {
      setErrorMessage("请先在台账中选择一个期刊模板。");
      return;
    }

    if (viewModel.selectedJournalTemplate.status === "active") {
      setStatusMessage("当前期刊模板已经处于启用状态。");
      return;
    }

    setIsBusy(true);
    resetFeedback();

    try {
      const { overview } = await controller.activateJournalTemplateProfileAndReload({
        journalTemplateProfileId: viewModel.selectedJournalTemplate.id,
        actorRole,
        selectedTemplateFamilyId: viewModel.selectedTemplateFamilyId,
        selectedJournalTemplateId: viewModel.selectedJournalTemplate.id,
      });
      setViewModel(toJournalTemplateLedgerViewModel(overview));
      setStatusMessage(
        `期刊模板已启用：${viewModel.selectedJournalTemplate.journal_name}`,
      );
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "启用期刊模板失败"));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleFormSubmit() {
    const validationMessage = validateJournalTemplateFormValues(formValues);
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    if (formMode === "edit") {
      setErrorMessage("当前版本暂不支持直接修改期刊模板，请删除后重建。");
      return;
    }

    setIsBusy(true);
    resetFeedback();

    try {
      const { overview, journalTemplateProfile } =
        await controller.createJournalTemplateProfileAndReload({
          templateFamilyId: formValues.templateFamilyId.trim(),
          manuscriptType:
            viewModel.selectedTemplateFamily?.manuscript_type ?? "other",
          journalName: formValues.journalName.trim(),
          journalKey: formValues.journalKey.trim(),
          selectedTemplateFamilyId: formValues.templateFamilyId.trim(),
          selectedJournalTemplateId: null,
        });
      setViewModel(toJournalTemplateLedgerViewModel(overview));
      setFormMode(null);
      setFormValues(createJournalTemplateFormValues(formValues.templateFamilyId));
      setStatusMessage(`期刊模板已创建：${journalTemplateProfile.journal_name}`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "保存期刊模板失败"));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <TemplateGovernanceJournalTemplateLedgerPage
      viewModel={viewModel}
      formMode={formMode}
      formValues={formValues}
      searchState={searchState}
      searchValue={searchValue}
      isBusy={isBusy}
      statusMessage={statusMessage}
      errorMessage={errorMessage}
      navigationItems={createTemplateGovernanceNavigationItems(
        "journal-template-ledger",
        navigateToTemplateGovernanceSection,
      )}
      onSearchValueChange={setSearchValue}
      onSearchSubmit={handleSearchSubmit}
      onOpenCreateForm={handleOpenCreateForm}
      onArchiveSelected={() => {
        void handleArchiveSelected();
      }}
      onActivateSelected={() => {
        void handleActivateSelected();
      }}
      onSelectTemplateFamily={handleSelectTemplateFamily}
      onSelectJournalTemplate={handleSelectJournalTemplate}
      onOpenEditForm={handleOpenEditForm}
      onFormChange={setFormValues}
      onFormCancel={() => {
        setFormMode(null);
      }}
      onFormSubmit={() => {
        void handleFormSubmit();
      }}
    />
  );
}

function TemplateGovernanceTemplateLedgerRoute({
  controller,
}: {
  controller: TemplateGovernanceWorkbenchController;
}) {
  const [ledger, setLedger] = useState<TemplateGovernanceTemplateLedgerViewModel>(
    createEmptyTemplateLedgerViewModel(),
  );
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [formValues, setFormValues] = useState<TemplateGovernanceTemplateFormValues>(
    createTemplateFormValues(),
  );
  const [searchValue, setSearchValue] = useState("");
  const [searchState, setSearchState] = useState<TemplateGovernanceLedgerSearchState>(
    createEmptyLedgerSearchState(),
  );
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    void controller
      .loadTemplateLedger()
      .then((nextLedger) => {
        if (!isCancelled) {
          setLedger(nextLedger);
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setErrorMessage(toErrorMessage(error, "模板台账加载失败"));
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [controller]);

  useEffect(() => {
    setFormValues((current) =>
      formMode === "edit" && ledger.selectedTemplate
        ? toTemplateFormValues(
            ledger.selectedTemplate,
            ledger.generalModules,
            ledger.medicalModules,
          )
        : current,
    );
  }, [formMode, ledger.generalModules, ledger.medicalModules, ledger.selectedTemplate]);

  function resetFeedback() {
    setStatusMessage(null);
    setErrorMessage(null);
  }

  function handleSearchAction() {
    setSearchState(buildTemplateLedgerSearchState(ledger, searchValue));
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleSearchAction();
  }

  function handleSelectTemplate(templateId: string) {
    resetFeedback();
    setFormMode(null);
    setLedger((current) => selectTemplateComposition(current, templateId));
  }

  function handleOpenCreateForm() {
    resetFeedback();
    setFormMode("create");
    setFormValues(createTemplateFormValues());
  }

  function handleOpenEditForm() {
    if (!ledger.selectedTemplate) {
      setErrorMessage("请先在台账中选择一个模板。");
      return;
    }

    resetFeedback();
    setFormMode("edit");
    setFormValues(
      toTemplateFormValues(
        ledger.selectedTemplate,
        ledger.generalModules,
        ledger.medicalModules,
      ),
    );
  }

  async function handleArchiveSelected() {
    if (!ledger.selectedTemplate) {
      setErrorMessage("请先在台账中选择一个模板。");
      return;
    }

    setIsBusy(true);
    resetFeedback();

    try {
      const { templateComposition, ledger: nextLedger } =
        await controller.updateTemplateCompositionDraftAndReload({
          templateCompositionId: ledger.selectedTemplate.id,
          selectedTemplateId: null,
          input: {
            status: "archived",
          },
        });
      setLedger(nextLedger);
      setFormMode(null);
      setStatusMessage(`模板已删除：${templateComposition.name}`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "删除模板失败"));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleFormSubmit() {
    const validatedInput = validateTemplateFormValues(formValues, ledger);
    if ("error" in validatedInput) {
      setErrorMessage(validatedInput.error);
      return;
    }

    setIsBusy(true);
    resetFeedback();

    try {
      if (formMode === "edit" && ledger.selectedTemplate) {
        const { templateComposition, ledger: nextLedger } =
          await controller.updateTemplateCompositionDraftAndReload({
            templateCompositionId: ledger.selectedTemplate.id,
            selectedTemplateId: ledger.selectedTemplate.id,
            input: validatedInput.updateInput,
          });
        setLedger(nextLedger);
        setStatusMessage(`模板已更新：${templateComposition.name}`);
      } else {
        const { templateComposition, ledger: nextLedger } =
          await controller.createTemplateCompositionDraftAndReload(
            validatedInput.createInput,
          );
        setLedger(nextLedger);
        setStatusMessage(`模板已创建：${templateComposition.name}`);
      }

      setFormMode(null);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "保存模板失败"));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <TemplateGovernanceTemplateLedgerPage
      viewModel={ledger}
      formMode={formMode}
      formValues={formValues}
      searchState={searchState}
      searchValue={searchValue}
      isBusy={isBusy}
      statusMessage={statusMessage}
      errorMessage={errorMessage}
      navigationItems={createTemplateGovernanceNavigationItems(
        "large-template-ledger",
        navigateToTemplateGovernanceSection,
      )}
      onSearchValueChange={setSearchValue}
      onSearchSubmit={handleSearchSubmit}
      onOpenCreateForm={handleOpenCreateForm}
      onArchiveSelected={() => {
        void handleArchiveSelected();
      }}
      onApplyToManuscript={() => {
        setStatusMessage("大模板已整理完成，可继续配置期刊模板。");
      }}
      onSelectTemplate={handleSelectTemplate}
      onOpenEditForm={handleOpenEditForm}
      onFormChange={setFormValues}
      onFormCancel={() => {
        setFormMode(null);
      }}
      onFormSubmit={() => {
        void handleFormSubmit();
      }}
    />
  );
}

function buildTemplateGovernanceOverviewMetrics(
  overview: TemplateGovernanceWorkbenchOverview | null,
  extractionAwaitingConfirmationCount: number,
): TemplateGovernanceOverviewMetrics {
  return {
    templateCount: overview?.templateFamilies.length ?? 0,
    moduleCount: overview?.moduleTemplates.length ?? 0,
    pendingKnowledgeCount:
      overview?.visibleKnowledgeItems.filter(
        (item) => item.status === "draft" || item.status === "pending_review",
      ).length ?? 0,
    extractionAwaitingConfirmationCount,
  };
}

function buildTemplateGovernanceOverviewPendingItems(
  overview: TemplateGovernanceWorkbenchOverview | null,
  metrics: TemplateGovernanceOverviewMetrics,
): TemplateGovernanceOverviewPendingItem[] {
  const items = buildTemplateGovernanceOverviewFallbackPendingItems(metrics);
  const draftRuleSetCount =
    overview?.ruleSets.filter((ruleSet) => ruleSet.status === "draft").length ?? 0;
  const draftInstructionCount =
    overview?.instructionTemplates.filter((template) => template.status === "draft").length ??
    0;

  if (draftRuleSetCount > 0) {
    items.push({
      id: "pending-rule-packages",
      title: "规则包草稿待整理",
      detail: `${draftRuleSetCount} 套规则集仍停留在草稿状态。`,
      emphasis: `草稿 ${draftRuleSetCount} 套`,
      actionLabel: "进入规则台账",
      targetView: "rule-ledger",
    });
  }

  if (draftInstructionCount > 0) {
    items.push({
      id: "pending-instruction-templates",
      title: "AI 指令模板待收口",
      detail: `${draftInstructionCount} 份指令模板尚未进入发布节奏。`,
      emphasis: `待收口 ${draftInstructionCount} 份`,
      actionLabel: "打开期刊模板台账",
      targetView: "journal-template-ledger",
    });
  }

  return items.slice(0, 4);
}

function buildTemplateGovernanceOverviewRecentUpdates(
  overview: TemplateGovernanceWorkbenchOverview | null,
  metrics: TemplateGovernanceOverviewMetrics,
): TemplateGovernanceOverviewRecentUpdate[] {
  const updates: TemplateGovernanceOverviewRecentUpdate[] = [];

  if (overview?.selectedTemplateFamily) {
    updates.push({
      id: `template-family-${overview.selectedTemplateFamily.id}`,
      title: overview.selectedTemplateFamily.name,
      detail: `当前模板族 · ${formatTemplateGovernanceFamilyStatusLabel(
        overview.selectedTemplateFamily.status,
      )}`,
      statusLabel: "模板族",
      targetView: "large-template-ledger",
    });
  }

  if (overview?.selectedJournalTemplateProfile) {
    updates.push({
      id: `journal-template-${overview.selectedJournalTemplateProfile.id}`,
      title: overview.selectedJournalTemplateProfile.journal_name,
      detail: "当前关注的期刊模板差异。",
      statusLabel: "期刊模板",
      targetView: "journal-template-ledger",
    });
  }

  if (overview?.selectedRuleSet) {
    updates.push({
      id: `rule-set-${overview.selectedRuleSet.id}`,
      title: `${formatTemplateGovernanceModuleLabel(overview.selectedRuleSet.module)}规则集 v${overview.selectedRuleSet.version_no}`,
      detail: `当前规则集 · ${formatTemplateGovernanceGovernedAssetStatusLabel(
        overview.selectedRuleSet.status,
      )}`,
      statusLabel: "规则包",
      targetView: "rule-ledger",
    });
  }

  if (overview?.selectedInstructionTemplate) {
    updates.push({
      id: `instruction-template-${overview.selectedInstructionTemplate.id}`,
      title: overview.selectedInstructionTemplate.name,
      detail: "当前 AI 指令模板入口。",
      statusLabel: "AI 指令",
      targetView: "journal-template-ledger",
    });
  }

  return updates.length > 0
    ? updates
    : buildTemplateGovernanceOverviewFallbackUpdates(metrics);
}

function createEmptyExtractionLedgerViewModel(): TemplateGovernanceExtractionLedgerViewModel {
  return {
    tasks: [],
    selectedTaskId: null,
    selectedTask: null,
    summary: {
      totalTaskCount: 0,
      candidateCount: 0,
      awaitingConfirmationCount: 0,
    },
  };
}

function createEmptyContentModuleLedgerViewModel(): TemplateGovernanceContentModuleLedgerViewModel {
  return {
    modules: [],
    selectedModuleId: null,
    selectedModule: null,
    selectedModuleRules: [],
    summary: {
      totalCount: 0,
      draftCount: 0,
      publishedCount: 0,
    },
  };
}

function createEmptyTemplateLedgerViewModel(): TemplateGovernanceTemplateLedgerViewModel {
  return {
    templates: [],
    generalModules: [],
    medicalModules: [],
    selectedTemplateId: null,
    selectedTemplate: null,
    summary: {
      templateCount: 0,
      draftCount: 0,
      publishedCount: 0,
    },
  };
}

function createEmptyJournalTemplateLedgerViewModel(): TemplateGovernanceJournalTemplateLedgerViewModel {
  return {
    templateFamilies: [],
    selectedTemplateFamilyId: null,
    selectedTemplateFamily: null,
    journalTemplates: [],
    selectedJournalTemplateId: null,
    selectedJournalTemplate: null,
    summary: {
      familyCount: 0,
      journalCount: 0,
      activeCount: 0,
    },
  };
}

function createEmptyLedgerSearchState(): TemplateGovernanceLedgerSearchState {
  return {
    mode: "idle",
    query: "",
    title: "",
    rows: [],
  };
}

function createExtractionTaskDraft(
  manuscriptType: ManuscriptType = "clinical_study",
): TemplateGovernanceExtractionTaskFormDraft {
  return {
    taskName: "",
    manuscriptType,
    journalKey: "",
  };
}

function createCandidateConfirmationFormValues(
  candidate?: ExtractionTaskCandidateViewModel,
): TemplateGovernanceCandidateConfirmationFormValues {
  return {
    semanticSummary: candidate?.semantic_draft_payload.semantic_summary ?? "",
    applicability: candidate?.semantic_draft_payload.applicability.join(", ") ?? "",
    suggestedDestination: candidate?.suggested_destination ?? "template",
    confirmationStatus: candidate?.confirmation_status ?? "ai_semantic_ready",
  };
}

function createContentModuleFormValues(
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

function createTemplateFormValues(): TemplateGovernanceTemplateFormValues {
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

function createJournalTemplateFormValues(
  templateFamilyId = "",
): TemplateGovernanceJournalTemplateFormValues {
  return {
    templateFamilyId,
    journalName: "",
    journalKey: "",
  };
}

function toJournalTemplateLedgerViewModel(
  overview: TemplateGovernanceWorkbenchOverview,
): TemplateGovernanceJournalTemplateLedgerViewModel {
  return {
    templateFamilies: overview.templateFamilies,
    selectedTemplateFamilyId: overview.selectedTemplateFamilyId,
    selectedTemplateFamily: overview.selectedTemplateFamily,
    journalTemplates: overview.journalTemplateProfiles,
    selectedJournalTemplateId: overview.selectedJournalTemplateId,
    selectedJournalTemplate: overview.selectedJournalTemplateProfile,
    summary: {
      familyCount: overview.templateFamilies.length,
      journalCount: overview.journalTemplateProfiles.length,
      activeCount: overview.journalTemplateProfiles.filter(
        (template) => template.status === "active",
      ).length,
    },
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

function selectJournalTemplateLedger(
  viewModel: TemplateGovernanceJournalTemplateLedgerViewModel,
  selectedJournalTemplateId: string,
): TemplateGovernanceJournalTemplateLedgerViewModel {
  return {
    ...viewModel,
    selectedJournalTemplateId,
    selectedJournalTemplate:
      viewModel.journalTemplates.find(
        (template) => template.id === selectedJournalTemplateId,
      ) ?? null,
  };
}

function selectContentModule(
  ledger: TemplateGovernanceContentModuleLedgerViewModel,
  selectedModuleId: string,
): TemplateGovernanceContentModuleLedgerViewModel {
  return {
    ...ledger,
    selectedModuleId,
    selectedModule:
      ledger.modules.find((module) => module.id === selectedModuleId) ?? null,
  };
}

function resolveSelectedContentModuleRule(
  rules: TemplateGovernanceContentModuleLedgerViewModel["selectedModuleRules"],
  selectedRuleKey: string | null,
) {
  if (!rules.length) {
    return null;
  }

  if (!selectedRuleKey) {
    return rules[0] ?? null;
  }

  return (
    rules.find((rule) => resolveContentModuleRuleKey(rule) === selectedRuleKey) ??
    rules[0] ??
    null
  );
}

function resolveContentModuleRuleKey(
  rule: TemplateGovernanceContentModuleLedgerViewModel["selectedModuleRules"][number] | undefined,
): string | null {
  return rule ? `${rule.assetId}:${rule.revisionId}` : null;
}

function resolvePackageRuleWizardCompletionMessage(
  releaseAction: RuleWizardReleaseAction | undefined,
): string {
  switch (releaseAction) {
    case "save_draft":
      return "规则草稿已回写到规则包。";
    case "submit_review":
      return "规则已提交审核并返回规则包台账。";
    case "publish_now":
      return "规则已发布并返回规则包台账。";
    default:
      return "规则向导已关闭，请继续在规则包台账中确认细节。";
  }
}

function selectTemplateComposition(
  ledger: TemplateGovernanceTemplateLedgerViewModel,
  selectedTemplateId: string,
): TemplateGovernanceTemplateLedgerViewModel {
  return {
    ...ledger,
    selectedTemplateId,
    selectedTemplate:
      ledger.templates.find((template) => template.id === selectedTemplateId) ??
      null,
  };
}

function buildExtractionLedgerSearchState(
  ledger: TemplateGovernanceExtractionLedgerViewModel,
  query: string,
): TemplateGovernanceLedgerSearchState {
  return {
    mode: "results",
    query: query.trim(),
    title: "原稿/编辑稿提取查找结果",
    rows: [
      ...ledger.tasks
        .filter((task) =>
          matchesLedgerQuery(query, [
            task.task_name,
            task.original_file_name,
            task.edited_file_name,
            task.journal_key,
            formatTemplateGovernanceManuscriptTypeLabel(task.manuscript_type),
            formatTemplateGovernanceExtractionTaskStatusLabel(task.status),
          ]),
        )
        .map((task) => ({
          id: task.id,
          primary: task.task_name,
          secondary: `${task.original_file_name} -> ${task.edited_file_name}`,
          cells: [
            formatTemplateGovernanceManuscriptTypeLabel(task.manuscript_type),
            `${task.candidate_count} 个候选`,
            formatTemplateGovernanceExtractionTaskStatusLabel(task.status),
          ],
        })),
      ...(ledger.selectedTask?.candidates ?? [])
        .filter((candidate) =>
          matchesLedgerQuery(query, [
            candidate.title,
            candidate.semantic_draft_payload.semantic_summary,
            candidate.semantic_draft_payload.applicability.join(" "),
            formatRulePackageKindLabel(candidate.package_kind),
            formatTemplateGovernanceExtractionDestinationLabel(
              candidate.suggested_destination,
            ),
            formatTemplateGovernanceExtractionCandidateStatusLabel(
              candidate.confirmation_status,
            ),
          ]),
        )
        .map((candidate) => ({
          id: candidate.id,
          primary: candidate.title,
          secondary: candidate.semantic_draft_payload.semantic_summary,
          cells: [
            formatRulePackageKindLabel(candidate.package_kind),
            formatTemplateGovernanceExtractionDestinationLabel(
              candidate.suggested_destination,
            ),
            formatTemplateGovernanceExtractionCandidateStatusLabel(
              candidate.confirmation_status,
            ),
          ],
        })),
    ],
  };
}

function buildContentModuleSearchState(input: {
  ledger: TemplateGovernanceContentModuleLedgerViewModel;
  ledgerKind: GovernedContentModuleClass;
  query: string;
}): TemplateGovernanceLedgerSearchState {
  const pageTitle =
    input.ledgerKind === "general" ? "通用包查找结果" : "医学专用包查找结果";

  return {
    mode: "results",
    query: input.query.trim(),
    title: pageTitle,
    rows: input.ledger.modules
      .filter((module) =>
        matchesLedgerQuery(input.query, [
          module.name,
          module.category,
          module.summary,
          ...(module.applicable_sections ?? []),
          ...(module.guidance ?? []),
          ...module.manuscript_type_scope,
          ...module.execution_module_scope,
          ...module.manuscript_type_scope.map((item) =>
            formatTemplateGovernanceManuscriptTypeLabel(item),
          ),
          ...module.execution_module_scope.map((item) =>
            formatTemplateGovernanceModuleLabel(item),
          ),
        ]),
      )
      .map((module) => ({
        id: module.id,
        primary: module.name,
        secondary: module.summary,
        cells: [
          module.category,
          module.manuscript_type_scope
            .map((item) => formatTemplateGovernanceManuscriptTypeLabel(item))
            .join(" / "),
          formatTemplateGovernanceGovernedAssetStatusLabel(module.status),
        ],
      })),
  };
}

function buildTemplateLedgerSearchState(
  ledger: TemplateGovernanceTemplateLedgerViewModel,
  query: string,
): TemplateGovernanceLedgerSearchState {
  return {
    mode: "results",
    query: query.trim(),
    title: "大模板查找结果",
    rows: ledger.templates
      .filter((template) =>
        matchesLedgerQuery(query, [
          template.name,
          template.journal_scope,
          template.notes,
          template.manuscript_type,
          ...template.execution_module_scope,
          ...template.general_module_ids,
          ...template.medical_module_ids,
          formatTemplateGovernanceManuscriptTypeLabel(template.manuscript_type),
          ...template.execution_module_scope.map((item) =>
            formatTemplateGovernanceModuleLabel(item),
          ),
        ]),
      )
      .map((template) => ({
        id: template.id,
        primary: template.name,
        secondary: template.notes ?? "未填写模板说明",
        cells: [
          formatTemplateGovernanceManuscriptTypeLabel(template.manuscript_type),
          template.execution_module_scope
            .map((module) => formatTemplateGovernanceModuleLabel(module))
            .join(" / "),
          formatTemplateGovernanceGovernedAssetStatusLabel(template.status),
        ],
      })),
  };
}

function buildJournalTemplateSearchState(
  viewModel: TemplateGovernanceJournalTemplateLedgerViewModel,
  query: string,
): TemplateGovernanceLedgerSearchState {
  return {
    mode: "results",
    query: query.trim(),
    title: "期刊模板查找结果",
    rows: viewModel.journalTemplates
      .filter((template) => {
        const templateFamily =
          viewModel.templateFamilies.find(
            (family) => family.id === template.template_family_id,
          ) ?? null;

        return matchesLedgerQuery(query, [
          template.journal_name,
          template.journal_key,
          templateFamily?.name,
          templateFamily?.manuscript_type,
          templateFamily
            ? formatTemplateGovernanceManuscriptTypeLabel(
                templateFamily.manuscript_type,
              )
            : undefined,
          formatTemplateGovernanceFamilyStatusLabel(template.status),
        ]);
      })
      .map((template) => {
        const templateFamily =
          viewModel.templateFamilies.find(
            (family) => family.id === template.template_family_id,
          ) ?? null;

        return {
          id: template.id,
          primary: template.journal_name,
          secondary: `${templateFamily?.name ?? "未绑定"} / ${template.journal_key}`,
          cells: [
            templateFamily
              ? formatTemplateGovernanceManuscriptTypeLabel(
                  templateFamily.manuscript_type,
                )
              : "未设置",
            formatTemplateGovernanceFamilyStatusLabel(template.status),
            template.status,
          ],
        };
      }),
  };
}

function matchesLedgerQuery(
  query: string,
  haystacks: readonly (string | null | undefined)[],
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  return haystacks.some((value) => value?.toLowerCase().includes(needle));
}

function validateExtractionTaskDraft(
  draft: TemplateGovernanceExtractionTaskFormDraft,
  files: {
    originalFile: BrowserUploadFile | null;
    editedFile: BrowserUploadFile | null;
  },
): string | null {
  if (draft.taskName.trim().length === 0) {
    return "请先填写提取任务名称。";
  }
  if (!files.originalFile || !files.editedFile) {
    return "请同时上传原稿和编辑稿。";
  }

  return null;
}

function validateCandidateConfirmationFormValues(
  values: TemplateGovernanceCandidateConfirmationFormValues,
): string | null {
  if (values.semanticSummary.trim().length === 0) {
    return "请先确认 AI 语义摘要。";
  }

  return null;
}

function validateContentModuleFormValues(
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

function validateTemplateFormValues(
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

function validateJournalTemplateFormValues(
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

  return null;
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

function toContentModuleFormValues(
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

function toContentModuleCreateInput(
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

function toContentModuleUpdateInput(
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

function toTemplateFormValues(
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

function toJournalTemplateFormValues(
  template: JournalTemplateProfileViewModel,
): TemplateGovernanceJournalTemplateFormValues {
  return {
    templateFamilyId: template.template_family_id,
    journalName: template.journal_name,
    journalKey: template.journal_key,
  };
}

function formatGovernedModuleReferences(
  moduleIds: readonly string[],
  modules: readonly GovernedContentModuleViewModel[],
): string {
  return moduleIds
    .map(
      (moduleId) =>
        modules.find((module) => module.id === moduleId)?.name ?? moduleId,
    )
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
      (item) =>
        formatTemplateGovernanceModuleLabel(item).toLowerCase() ===
        normalizedValue,
    ) ?? null
  );
}

function parseStringList(value: string): string[] {
  return value
    .split(/[\n,，;；]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseRuleEvidenceExamples(value: string): RuleEvidenceExampleViewModel[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line
        .split(/\s*(?:=>|->|\|)\s*/)
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
    examples?.map((example) => {
      const base = `${example.before} => ${example.after}`;
      return example.note ? `${base} | ${example.note}` : base;
    }).join("\n") ?? ""
  );
}

function navigateToTemplateGovernanceView(
  view: TemplateGovernanceView,
) {
  if (view === "classic") {
    navigateToTemplateGovernanceSection("rule-ledger");
    return;
  }

  navigateToTemplateGovernanceSection(view);
}

function navigateToTemplateGovernanceSection(
  target: TemplateGovernanceNavigationTarget,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.location.hash = formatWorkbenchHash("template-governance", {
    ruleCenterMode: target === "authoring" ? "authoring" : undefined,
    templateGovernanceView: target,
  });
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
          <h3>规则集</h3>
          <p>
            这里维护真正执行的规则来源，确保编辑与校对都围绕同一套受控规则运行。
          </p>
        </div>
      </div>

      {overview?.selectedTemplateFamily ? (
        <>
          <p className="template-governance-selected-note">
            当前模板族： <strong>{overview.selectedTemplateFamily.name}</strong> (
            {formatTemplateGovernanceManuscriptTypeLabel(
              overview.selectedTemplateFamily.manuscript_type,
            )}
            )
          </p>
          <form className="template-governance-form-grid" onSubmit={onCreateRuleSet}>
            <label className="template-governance-field">
              <span>规则集模块</span>
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
                    {formatTemplateGovernanceModuleLabel(module)}
                  </option>
                ))}
              </select>
            </label>
            <div className="template-governance-actions template-governance-actions-full">
              <button type="submit" disabled={isBusy}>
                {isBusy ? "保存中..." : "新建规则集草稿"}
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
                        {formatTemplateGovernanceModuleLabel(ruleSet.module)} 规则集 v
                        {ruleSet.version_no}
                      </span>
                      <small>
                        {formatTemplateGovernanceGovernedAssetStatusLabel(ruleSet.status)}
                      </small>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="template-governance-empty">
              当前模板族还没有规则集。
            </p>
          )}

          {selectedRuleSet ? (
            <>
              <article className="template-governance-card">
                <strong>
                  当前规则集：{formatTemplateGovernanceModuleLabel(selectedRuleSet.module)} v
                  {selectedRuleSet.version_no}
                </strong>
                <small>
                  {formatTemplateGovernanceGovernedAssetStatusLabel(selectedRuleSet.status)}
                </small>
                <p>
                  规则在这里保持结构化管理，知识投影只是便于阅读和复用的副本，不是唯一事实来源。
                </p>
                {selectedRuleSet.status === "draft" ? (
                  <div className="template-governance-actions">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void onPublishRuleSet(selectedRuleSet.id)}
                    >
                      发布规则集
                    </button>
                  </div>
                ) : null}
              </article>

              <form className="template-governance-form-grid" onSubmit={onSubmitRule}>
                <label className="template-governance-field">
                  <span>顺序</span>
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
                  <span>规则类型</span>
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
                        {formatTemplateGovernanceRuleTypeLabel(ruleType)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="template-governance-field">
                  <span>执行方式</span>
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
                        {formatTemplateGovernanceExecutionModeLabel(executionMode)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="template-governance-field">
                  <span>置信策略</span>
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
                        {formatTemplateGovernanceConfidencePolicyLabel(policy)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="template-governance-field">
                  <span>严重级别</span>
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
                        {formatTemplateGovernanceSeverityLabel(severity)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="template-governance-field">
                  <span>作用章节</span>
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
                  <span>作用块类型</span>
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
                  <span>触发条件类型</span>
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
                  <span>触发文本</span>
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
                  <span>动作类型</span>
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
                  <span>动作目标</span>
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
                  <span>处理前示例</span>
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
                  <span>处理后示例</span>
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
                  <span>人工复核原因</span>
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
                    {isBusy ? "保存中..." : "新建规则草稿"}
                  </button>
                </div>
              </form>

              {overview.rules.length ? (
                <div className="template-governance-stack">
                  {overview.rules.map((rule) => (
                    <article key={rule.id} className="template-governance-card">
                      <strong>
                        {rule.action.kind} ·{" "}
                        {formatTemplateGovernanceExecutionModeLabel(rule.execution_mode)}
                      </strong>
                      <small>
                        {formatTemplateGovernanceRuleTypeLabel(rule.rule_type)} ·{" "}
                        {formatTemplateGovernanceSeverityLabel(rule.severity)} ·{" "}
                        {formatTemplateGovernanceConfidencePolicyLabel(
                          rule.confidence_policy,
                        )}
                      </small>
                      <div className="template-governance-detail-grid">
                        <div>
                          <span>触发条件</span>
                          <code className="template-governance-code">
                            {JSON.stringify(rule.trigger)}
                          </code>
                        </div>
                        <div>
                          <span>执行动作</span>
                          <code className="template-governance-code">
                            {JSON.stringify(rule.action)}
                          </code>
                        </div>
                        <div>
                          <span>处理前示例</span>
                          <p>{rule.example_before ?? "未填写"}</p>
                        </div>
                        <div>
                          <span>处理后示例</span>
                          <p>{rule.example_after ?? "未填写"}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="template-governance-empty">
                  当前规则集里还没有规则。
                </p>
              )}
            </>
          ) : null}
        </>
      ) : (
        <p className="template-governance-empty">
          先选择模板族，再开始录入规则集与规则。
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
          <h3>AI 指令模板</h3>
          <p>
            把系统提示、任务框架和人工复核边界拆开维护，避免只剩下一段不可控的大提示词。
          </p>
        </div>
      </div>

      {overview?.selectedTemplateFamily ? (
        <>
          <p className="template-governance-selected-note">
            当前模板族： <strong>{overview.selectedTemplateFamily.name}</strong> (
            {formatTemplateGovernanceManuscriptTypeLabel(
              overview.selectedTemplateFamily.manuscript_type,
            )}
            )
          </p>
          <form
            className="template-governance-form-grid"
            onSubmit={onCreateInstructionTemplate}
          >
            <label className="template-governance-field">
              <span>模板名称</span>
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
              <span>版本号</span>
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
              <span>适用模块</span>
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
                    {formatTemplateGovernanceModuleLabel(module)}
                  </option>
                ))}
              </select>
            </label>
            <label className="template-governance-field">
              <span>模板类型</span>
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
                    {formatTemplateGovernancePromptTemplateKindLabel(templateKind)}
                  </option>
                ))}
              </select>
            </label>
            <label className="template-governance-field template-governance-field-full">
              <span>系统提示</span>
              <textarea
                rows={4}
                value={instructionTemplateForm.systemInstructions}
                onChange={(event) =>
                  onInstructionTemplateFormChange((current) => ({
                    ...current,
                    systemInstructions: event.target.value,
                  }))
                }
                placeholder="在任何内容改写前先执行已批准规则。"
              />
            </label>
            <label className="template-governance-field template-governance-field-full">
              <span>任务框架</span>
              <textarea
                rows={3}
                value={instructionTemplateForm.taskFrame}
                onChange={(event) =>
                  onInstructionTemplateFormChange((current) => ({
                    ...current,
                    taskFrame: event.target.value,
                  }))
                }
                placeholder="在不改变医学含义的前提下完成规范化处理。"
              />
            </label>
            <label className="template-governance-field template-governance-field-full">
              <span>硬规则摘要</span>
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
              <span>允许操作</span>
              <input
                value={instructionTemplateForm.allowedContentOperations}
                onChange={(event) =>
                  onInstructionTemplateFormChange((current) => ({
                    ...current,
                    allowedContentOperations: event.target.value,
                  }))
                }
                placeholder="例如：允许改写句式、输出问题说明"
              />
            </label>
            <label className="template-governance-field">
              <span>禁止操作</span>
              <input
                value={instructionTemplateForm.forbiddenOperations}
                onChange={(event) =>
                  onInstructionTemplateFormChange((current) => ({
                    ...current,
                    forbiddenOperations: event.target.value,
                  }))
                }
                placeholder="例如：禁止改变医学含义、禁止直接改写正文"
              />
            </label>
            <label className="template-governance-field template-governance-field-full">
              <span>人工复核策略</span>
              <textarea
                rows={3}
                value={instructionTemplateForm.manualReviewPolicy}
                onChange={(event) =>
                  onInstructionTemplateFormChange((current) => ({
                    ...current,
                    manualReviewPolicy: event.target.value,
                  }))
                }
                placeholder="当内容改动存在医学风险时，必须转人工复核。"
              />
            </label>
            <label className="template-governance-field template-governance-field-full">
              <span>输出约束</span>
              <textarea
                rows={3}
                value={instructionTemplateForm.outputContract}
                onChange={(event) =>
                  onInstructionTemplateFormChange((current) => ({
                    ...current,
                    outputContract: event.target.value,
                  }))
                }
                placeholder="返回受控的编辑或校对结果载荷。"
              />
            </label>
            <label className="template-governance-field template-governance-field-full">
              <span>报告风格</span>
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
                {isBusy ? "保存中..." : "新建 AI 指令草稿"}
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
                        {formatTemplateGovernanceGovernedAssetStatusLabel(template.status)} ·{" "}
                        {formatTemplateGovernancePromptTemplateKindLabel(
                          template.template_kind ?? "legacy_prompt",
                        )}
                      </small>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="template-governance-empty">
              当前稿件族还没有匹配的 AI 指令模板。
            </p>
          )}

          {selectedInstructionTemplate ? (
            <article className="template-governance-card">
              <strong>{selectedInstructionTemplate.name}</strong>
              <small>
                {formatTemplateGovernanceGovernedAssetStatusLabel(
                  selectedInstructionTemplate.status,
                )}{" "}
                ·{" "}
                {formatTemplateGovernancePromptTemplateKindLabel(
                  selectedInstructionTemplate.template_kind ?? "legacy_prompt",
                )}
              </small>
              <div className="template-governance-detail-grid">
                <div>
                  <span>系统提示</span>
                  <p>{selectedInstructionTemplate.system_instructions ?? "未填写"}</p>
                </div>
                <div>
                  <span>任务框架</span>
                  <p>{selectedInstructionTemplate.task_frame ?? "未填写"}</p>
                </div>
                <div>
                  <span>硬规则摘要</span>
                  <p>{selectedInstructionTemplate.hard_rule_summary ?? "未填写"}</p>
                </div>
                <div>
                  <span>允许操作</span>
                  <p>
                    {selectedInstructionTemplate.allowed_content_operations?.length
                      ? selectedInstructionTemplate.allowed_content_operations
                          .map((operation) =>
                            `允许${formatTemplateGovernanceInstructionOperationLabel(operation)}`,
                          )
                          .join("、")
                      : "未填写"}
                  </p>
                </div>
                <div>
                  <span>禁止操作</span>
                  <p>
                    {selectedInstructionTemplate.forbidden_operations?.length
                      ? selectedInstructionTemplate.forbidden_operations
                          .map((operation) =>
                            `禁止${formatTemplateGovernanceInstructionOperationLabel(operation)}`,
                          )
                          .join("、")
                      : "未填写"}
                  </p>
                </div>
                <div>
                  <span>人工复核策略</span>
                  <p>{selectedInstructionTemplate.manual_review_policy ?? "未填写"}</p>
                </div>
                <div className="template-governance-field-full">
                  <span>输出约束</span>
                  <p>{selectedInstructionTemplate.output_contract ?? "未填写"}</p>
                </div>
              </div>
              {selectedInstructionTemplate.status === "draft" ? (
                <div className="template-governance-actions">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void onPublishInstructionTemplate(selectedInstructionTemplate.id)}
                  >
                    发布 AI 指令模板
                  </button>
                </div>
              ) : null}
            </article>
          ) : null}
        </>
      ) : (
        <p className="template-governance-empty">
          先选择模板族，再开始维护 AI 指令模板。
        </p>
      )}
    </article>
  );
}

export function createKnowledgeDraftFormState(input: {
  manuscriptType?: ManuscriptType;
  templateBindings?: string[];
} = {}): KnowledgeDraftFormState {
  return {
    title: "",
    canonicalText: "",
    summary: "",
    knowledgeKind: "reference",
    moduleScope: "any",
    manuscriptTypes: input.manuscriptType ? [input.manuscriptType] : "any",
    templateBindings: [...(input.templateBindings ?? [])],
    aliases: [],
    sections: [],
    riskTags: [],
    disciplineTags: [],
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
    allowedContentOperations: "",
    forbiddenOperations: "",
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

export function createKnowledgeDraftInput(
  form: KnowledgeDraftFormState,
): CreateKnowledgeDraftInput & UpdateKnowledgeDraftInput {
  return {
    title: form.title.trim(),
    canonicalText: form.canonicalText.trim(),
    summary: optionalTrimmedValue(form.summary),
    knowledgeKind: form.knowledgeKind,
    moduleScope: form.moduleScope,
    manuscriptTypes: normalizeKnowledgeDraftManuscriptTypes(form.manuscriptTypes),
    sections: optionalStringArray(form.sections),
    riskTags: optionalStringArray(form.riskTags),
    disciplineTags: optionalStringArray(form.disciplineTags),
    evidenceLevel: form.evidenceLevel,
    sourceType: form.sourceType,
    sourceLink: optionalTrimmedValue(form.sourceLink),
    aliases: optionalStringArray(form.aliases),
    templateBindings: optionalStringArray(form.templateBindings),
  };
}

export function toKnowledgeDraftFormState(item: {
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
        : [...item.routing.manuscript_types],
    templateBindings: [...(item.template_bindings ?? [])],
    aliases: [...(item.aliases ?? [])],
    sections: [...(item.routing.sections ?? [])],
    riskTags: [...(item.routing.risk_tags ?? [])],
    disciplineTags: [...(item.routing.discipline_tags ?? [])],
    evidenceLevel: item.evidence_level ?? "unknown",
    sourceType: item.source_type ?? "other",
    sourceLink: item.source_link ?? "",
  };
}

function resolveInitialRuleAuthoringDraft(
  overview: TemplateGovernanceWorkbenchOverview | null,
): RuleAuthoringDraft {
  if (!overview) {
    return createRuleAuthoringDraft("abstract");
  }

  return resolveRuleAuthoringDraftForOverview({
    overview,
    preferredRuleObject: "abstract",
    previousSelectedRuleSetId: overview.selectedRuleSetId,
  });
}

function resolveRulePackageCompileContext(
  overview: TemplateGovernanceWorkbenchOverview | null,
): {
  templateFamilyId: string | null;
  journalTemplateId?: string;
  module: TemplateModule;
} {
  return {
    templateFamilyId: overview?.selectedTemplateFamilyId ?? null,
    ...(overview?.selectedJournalTemplateId
      ? { journalTemplateId: overview.selectedJournalTemplateId }
      : {}),
    module: overview?.selectedRuleSet?.module ?? "editing",
  };
}

function resolveSelectedDraftCompileTargetRuleSetId(
  overview: TemplateGovernanceWorkbenchOverview | null,
  compileContext: ReturnType<typeof resolveRulePackageCompileContext>,
): string | undefined {
  const selectedRuleSet = overview?.selectedRuleSet;
  if (!selectedRuleSet || selectedRuleSet.status !== "draft") {
    return undefined;
  }

  const selectedJournalTemplateId = selectedRuleSet.journal_template_id ?? undefined;
  if (
    selectedRuleSet.template_family_id !== compileContext.templateFamilyId ||
    selectedJournalTemplateId !== (compileContext.journalTemplateId ?? undefined) ||
    selectedRuleSet.module !== compileContext.module
  ) {
    return undefined;
  }

  return selectedRuleSet.id;
}

function isSameRulePackageSource(
  left: RulePackageWorkspaceSourceInputViewModel,
  right: RulePackageWorkspaceSourceInputViewModel,
): boolean {
  return (
    left.sourceKind === right.sourceKind &&
    readRulePackageSourceIdentity(left) === readRulePackageSourceIdentity(right)
  );
}

function readRulePackageSourceIdentity(
  source: RulePackageWorkspaceSourceInputViewModel,
): string {
  return source.sourceKind === "reviewed_case"
    ? source.reviewedCaseSnapshotId
    : source.exampleSourceSessionId;
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

function optionalStringArray(values: readonly string[]): string[] | undefined {
  const normalized = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeKnowledgeDraftManuscriptTypes(
  value: KnowledgeDraftFormState["manuscriptTypes"],
): ManuscriptType[] | "any" {
  if (value === "any") {
    return "any";
  }

  const normalized = value.filter((entry): entry is ManuscriptType =>
    manuscriptTypes.includes(entry),
  );

  return normalized.length > 0 ? normalized : "any";
}

function isEditableModuleScope(
  value: string,
): value is KnowledgeDraftFormState["moduleScope"] {
  return value === "any" || value === "screening" || value === "editing" || value === "proofreading";
}

function isTableGovernanceRule(
  rule: TemplateGovernanceWorkbenchOverview["rules"][number],
): boolean {
  const scopeSections = Array.isArray(rule.scope.sections)
    ? rule.scope.sections.filter((section): section is string => typeof section === "string")
    : [];

  return (
    rule.rule_object === "table" ||
    rule.action?.kind === "inspect_table_rule" ||
    scopeSections.includes("tables")
  );
}

function isTableGovernanceKnowledgeItem(item: KnowledgeAssetDetailViewModel["selected_revision"] | {
  title: string;
  summary?: string;
  canonical_text: string;
  routing: {
    sections?: string[];
    risk_tags?: string[];
  };
  aliases?: string[];
}): boolean {
  if (item.routing.sections?.includes("tables")) {
    return true;
  }

  const riskTags = item.routing.risk_tags ?? [];
  if (riskTags.some((tag) => tag.toLowerCase().includes("table") || tag.includes("表"))) {
    return true;
  }

  const searchableText = [
    item.title,
    item.summary ?? "",
    item.canonical_text,
    ...(item.aliases ?? []),
  ]
    .join(" ")
    .toLowerCase();

  return (
    searchableText.includes("table") ||
    searchableText.includes("tables") ||
    searchableText.includes("表格") ||
    searchableText.includes("表题") ||
    searchableText.includes("表注")
  );
}

function formatRetrievalInsightStatus(status: NonNullable<TemplateGovernanceWorkbenchOverview["retrievalInsights"]>["status"]): string {
  switch (status) {
    case "available":
      return "证据已就绪";
    case "partial":
      return "证据不完整";
    case "not_started":
      return "尚未开始";
    case "unavailable":
      return "暂不可用";
    case "idle":
    default:
      return "空闲";
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
