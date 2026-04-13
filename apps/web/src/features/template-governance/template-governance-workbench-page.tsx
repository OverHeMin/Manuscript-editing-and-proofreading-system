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
import type { LearningCandidateViewModel } from "../learning-review/index.ts";
import type { RuleAuthoringPrefillFromLearningCandidate } from "../learning-review/index.ts";
import type {
  EvidenceLevel,
  KnowledgeItemStatus,
  KnowledgeKind,
  KnowledgeSourceType,
} from "../knowledge/index.ts";
import type { ManuscriptType } from "../manuscripts/types.ts";
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
  EditorialRuleType,
  RulePackageDraftViewModel,
  RulePackageWorkspaceSourceInputViewModel,
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
  type TemplateGovernanceWorkbenchController,
  type TemplateGovernanceWorkbenchFilters,
  type TemplateGovernanceWorkbenchOverview,
} from "./template-governance-controller.ts";
import {
  formatTemplateGovernanceConfidencePolicyLabel,
  formatTemplateGovernanceExecutionModeLabel,
  formatTemplateGovernanceFamilyStatusLabel,
  formatTemplateGovernanceGovernedAssetStatusLabel,
  formatTemplateGovernanceKnowledgeKindLabel,
  formatTemplateGovernanceManuscriptTypeLabel,
  formatTemplateGovernanceModuleLabel,
  formatTemplateGovernancePromptTemplateKindLabel,
  formatTemplateGovernanceRuleTypeLabel,
  formatTemplateGovernanceSeverityLabel,
} from "./template-governance-display.ts";

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
  initialView?: TemplateGovernanceView;
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
  prefilledManuscriptId,
  prefilledReviewedCaseSnapshotId,
  initialRulePackageWorkspace = null,
  initialLearningCandidates = [],
  initialSelectedLearningCandidateId,
}: TemplateGovernanceWorkbenchPageProps) {
  if (initialView === "overview") {
    return <TemplateGovernanceOverviewPlaceholder overview={initialOverview} />;
  }

  if (initialView === "extraction-ledger") {
    return <TemplateGovernanceExtractionLedgerPlaceholder />;
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

  return (
    <section className="template-governance-workbench">
      <header className="template-governance-hero">
        <div className="template-governance-hero-copy">
          <p className="template-governance-eyebrow">规则中心</p>
          <h2>规则中心</h2>
          <p>
            把规则创建、模板套用、校对策略和学习回流放进同一块可解释的治理工作台，但把高频入口做得更清楚、更好上手。
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
          学习回流
        </a>
      </nav>

      {normalizedPrefilledReviewedCaseSnapshotId.length > 0 ? (
        <p className="template-governance-context-note">
          已保留学习上下文：复核快照 {normalizedPrefilledReviewedCaseSnapshotId}
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
                    <small>{signal.kind}</small>
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

function TemplateGovernanceOverviewPlaceholder({
  overview,
}: {
  overview: TemplateGovernanceWorkbenchOverview | null;
}) {
  const templateCount = overview?.templateFamilies.length ?? 0;
  const moduleCount = overview?.moduleTemplates.length ?? 0;
  const pendingKnowledgeCount =
    overview?.visibleKnowledgeItems.filter(
      (item) => item.status === "draft" || item.status === "pending_review",
    ).length ?? 0;

  return (
    <section className="template-governance-overview-page">
      <header className="template-governance-hero">
        <div className="template-governance-hero-copy">
          <p className="template-governance-eyebrow">规则中心总览</p>
          <h1>规则中心总览</h1>
          <p>先看总览数据，再进入模板、提取与模块台账。</p>
        </div>
      </header>

      <div className="template-governance-overview-metrics">
        <article className="template-governance-card">
          <h2>模板数量</h2>
          <p>{templateCount}</p>
        </article>
        <article className="template-governance-card">
          <h2>模块数量</h2>
          <p>{moduleCount}</p>
        </article>
        <article className="template-governance-card">
          <h2>待确认提取候选</h2>
          <p>{pendingKnowledgeCount}</p>
        </article>
      </div>

      <div className="template-governance-overview-links">
        <article className="template-governance-card">
          <h2>模板台账</h2>
          <p>管理模板容器、版本和套用入口。</p>
        </article>
        <article className="template-governance-card">
          <h2>原稿/编辑稿提取台账</h2>
          <p>先提取候选，再确认 AI 语义与入库去向。</p>
        </article>
        <article className="template-governance-card">
          <h2>通用模块台账</h2>
          <p>沉淀跨稿件场景复用的通用模块。</p>
        </article>
        <article className="template-governance-card">
          <h2>医学专用模块台账</h2>
          <p>沉淀医学专用的高风险高价值模块。</p>
        </article>
      </div>
    </section>
  );
}

function TemplateGovernanceExtractionLedgerPlaceholder() {
  return (
    <section className="template-governance-extraction-ledger-page">
      <header className="template-governance-hero">
        <div className="template-governance-hero-copy">
          <p className="template-governance-eyebrow">提取台账</p>
          <h1>原稿/编辑稿提取台账</h1>
          <p>这是新的候选中枢入口，后续会承接任务表、候选表和 AI 语义确认。</p>
        </div>
      </header>

      <div className="template-governance-actions">
        <button type="button">新建提取任务</button>
        <button type="button">搜索任务</button>
      </div>

      <article className="template-governance-card">
        <h2>待确认数</h2>
        <p>后续这里会显示提取任务表和候选确认表。</p>
      </article>
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
                placeholder="sentence_rewrite"
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
                placeholder="change_medical_meaning"
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
                    {selectedInstructionTemplate.allowed_content_operations?.join(", ") ??
                      "未填写"}
                  </p>
                </div>
                <div>
                  <span>禁止操作</span>
                  <p>
                    {selectedInstructionTemplate.forbidden_operations?.join(", ") ?? "未填写"}
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
