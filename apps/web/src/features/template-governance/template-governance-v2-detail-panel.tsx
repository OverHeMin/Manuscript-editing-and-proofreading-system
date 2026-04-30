import {
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { AuthRole } from "../auth/index.ts";
import type {
  ExtractionTaskCandidateViewModel,
  RuleAiIntakeDraftResponseViewModel,
  TransitionEditorialRuleSetInput,
} from "../editorial-rules/index.ts";
import { RuleLearningPane } from "./rule-learning-pane.tsx";
import { RulePlatformReleasePanel } from "./rule-platform-release-panel.tsx";
import { TemplateGovernanceRuleWizard } from "./template-governance-rule-wizard.tsx";
import {
  createRuleWizardEntryFormState,
  type RuleWizardEntryFormState,
  type RuleWizardReleaseAction,
} from "./template-governance-rule-wizard-api.ts";
import {
  advanceRuleWizardState,
  createRuleWizardState,
  rewindRuleWizardState,
  type RuleWizardState,
} from "./template-governance-rule-wizard-state.ts";
import type { RuleWizardCandidateHandoffViewModel } from "./template-governance-rule-wizard.tsx";
import type { TemplateGovernanceWorkbenchController } from "./template-governance-controller.ts";
import { TemplateGovernanceCandidateConfirmationForm, type TemplateGovernanceCandidateConfirmationFormValues } from "./template-governance-candidate-confirmation-form.tsx";
import { TemplateGovernanceContentModuleForm, type TemplateGovernanceContentModuleFormValues } from "./template-governance-content-module-form.tsx";
import {
  TemplateGovernanceExtractionTaskForm,
  type TemplateGovernanceExtractionTaskFormDraft,
  type TemplateGovernanceExtractionTaskFormProps,
} from "./template-governance-extraction-task-form.tsx";
import { TemplateGovernanceJournalTemplateForm, type TemplateGovernanceJournalTemplateFormValues } from "./template-governance-journal-template-form.tsx";
import { TemplateGovernanceTemplateForm, type TemplateGovernanceTemplateFormValues } from "./template-governance-template-form.tsx";
import { TemplateGovernanceV2AdvancedPanel } from "./template-governance-v2-advanced-panel.tsx";
import type { TemplateGovernanceV2SectionData } from "./template-governance-v2-data.ts";
import type { TemplateGovernanceV2RouteState } from "./template-governance-v2-types.ts";

type RuleSetTransitionInput = Omit<TransitionEditorialRuleSetInput, "actorRole">;

export interface TemplateGovernanceV2AiIntakeState {
  description: string;
  result: RuleAiIntakeDraftResponseViewModel | null;
  isGenerating: boolean;
  errorMessage: string | null;
  onDescriptionChange: (value: string) => void;
  onGenerate: () => void;
  onApplyResult: () => void;
}

export interface TemplateGovernanceV2TemplateActionState {
  formMode: "create" | "edit" | null;
  formValues: TemplateGovernanceTemplateFormValues;
  journalFormMode: "create" | "edit" | null;
  journalFormValues: TemplateGovernanceJournalTemplateFormValues;
  isBusy: boolean;
  statusMessage: string | null;
  errorMessage: string | null;
  onOpenCreateForm: () => void;
  onOpenEditForm: () => void;
  onArchiveSelected: () => void;
  onActivateSelected: () => void;
  onFormChange: Dispatch<SetStateAction<TemplateGovernanceTemplateFormValues>>;
  onFormCancel: () => void;
  onFormSubmit: () => void;
  onJournalFormChange: Dispatch<SetStateAction<TemplateGovernanceJournalTemplateFormValues>>;
  onJournalFormCancel: () => void;
  onJournalFormSubmit: () => void;
}

export interface TemplateGovernanceV2PackageActionState {
  formMode: "create" | "edit" | null;
  formValues: TemplateGovernanceContentModuleFormValues;
  isBusy: boolean;
  statusMessage: string | null;
  errorMessage: string | null;
  onOpenCreateForm: () => void;
  onOpenEditForm: () => void;
  onArchiveSelected: () => void;
  onOpenDefaultRules: () => void;
  onFormChange: Dispatch<SetStateAction<TemplateGovernanceContentModuleFormValues>>;
  onFormCancel: () => void;
  onFormSubmit: () => void;
}

export interface TemplateGovernanceV2ExtractionActionState {
  taskFormOpen: boolean;
  taskDraft: TemplateGovernanceExtractionTaskFormDraft;
  candidateFormOpen: boolean;
  candidateFormValues: TemplateGovernanceCandidateConfirmationFormValues;
  selectedCandidate: ExtractionTaskCandidateViewModel | null;
  isBusy: boolean;
  statusMessage: string | null;
  errorMessage: string | null;
  onOpenTaskForm: () => void;
  onOpenCandidateForm: () => void;
  onTaskDraftChange: Dispatch<SetStateAction<TemplateGovernanceExtractionTaskFormDraft>>;
  onOriginalFileSelect?: TemplateGovernanceExtractionTaskFormProps["onOriginalFileSelect"];
  onEditedFileSelect?: TemplateGovernanceExtractionTaskFormProps["onEditedFileSelect"];
  onTaskFormCancel: () => void;
  onTaskFormSubmit: () => void;
  onCandidateFormChange: (
    recipe: (
      current: TemplateGovernanceCandidateConfirmationFormValues,
    ) => TemplateGovernanceCandidateConfirmationFormValues,
  ) => void;
  onCandidateFormCancel: () => void;
  onCandidateHold: () => void;
  onCandidateReject: () => void;
  onCandidateConfirm: () => void;
  onConvertToDraft: () => void;
}

export interface TemplateGovernanceV2ReleaseActionState {
  isBusy: boolean;
  statusMessage: string | null;
  errorMessage: string | null;
  onTransitionRuleSet: (input: RuleSetTransitionInput) => Promise<void> | void;
}

export interface TemplateGovernanceV2DetailPanelProps {
  controller: TemplateGovernanceWorkbenchController;
  actorRole?: AuthRole;
  data: TemplateGovernanceV2SectionData | null;
  routeState: TemplateGovernanceV2RouteState;
  aiIntakeState: TemplateGovernanceV2AiIntakeState;
  templateActionState: TemplateGovernanceV2TemplateActionState;
  packageActionState: TemplateGovernanceV2PackageActionState;
  extractionActionState: TemplateGovernanceV2ExtractionActionState;
  releaseActionState: TemplateGovernanceV2ReleaseActionState;
  prefilledManuscriptId?: string;
  prefilledReviewedCaseSnapshotId?: string;
  initialSelectedLearningCandidateId?: string;
  initialSelectedReviewItemId?: string;
  advancedCompatibilityPanel?: ReactNode;
  ruleWizardEntryForm?: RuleWizardEntryFormState;
  ruleWizardTitle?: string;
  ruleWizardMode?: RuleWizardState["mode"];
  ruleWizardCandidateHandoff?: RuleWizardCandidateHandoffViewModel | null;
  onCloseRuleWizard?: () => void;
  onRuleWizardComplete?: () => void;
}

export function TemplateGovernanceV2DetailPanel({
  controller,
  actorRole = "admin",
  data,
  routeState,
  aiIntakeState,
  templateActionState,
  packageActionState,
  extractionActionState,
  releaseActionState,
  prefilledManuscriptId,
  prefilledReviewedCaseSnapshotId,
  initialSelectedLearningCandidateId,
  initialSelectedReviewItemId,
  advancedCompatibilityPanel,
  ruleWizardEntryForm,
  ruleWizardTitle,
  ruleWizardMode = "create",
  ruleWizardCandidateHandoff,
  onCloseRuleWizard,
  onRuleWizardComplete,
}: TemplateGovernanceV2DetailPanelProps) {
  if (routeState.panel === "rule-wizard") {
    return (
      <div data-v2-detail-panel="rule-wizard">
        <TemplateGovernanceV2RuleWizardPanel
          controller={controller}
          initialMode={ruleWizardMode}
          initialEntryFormState={ruleWizardEntryForm}
          title={ruleWizardTitle}
          candidateHandoff={ruleWizardCandidateHandoff ?? undefined}
          onClose={onCloseRuleWizard}
          onComplete={onRuleWizardComplete}
        />
      </div>
    );
  }

  if (routeState.section === "recovery" && data?.section === "recovery") {
    const selectedCandidateId = resolveSelectedLearningCandidateId(
      data,
      initialSelectedLearningCandidateId,
    );
    const selectedReviewItemId = resolveSelectedReviewItemId(
      data,
      initialSelectedReviewItemId,
    );
    const pendingCount = data.candidates.length + data.reviewItems.length;
    const normalizedPrefilledManuscriptId = prefilledManuscriptId?.trim() ?? "";
    const normalizedPrefilledReviewedCaseSnapshotId =
      prefilledReviewedCaseSnapshotId?.trim() ?? "";

    return (
      <div
        data-v2-detail-panel={routeState.panel}
        data-initial-candidate-id={selectedCandidateId}
        data-initial-review-item-id={selectedReviewItemId}
      >
        <section
          className="template-governance-recovery-route"
          data-mode="rule-center-recovery"
        >
          <header className="template-governance-ledger-toolbar template-governance-recovery-toolbar">
            <div className="template-governance-ledger-toolbar-copy">
              <p className="template-governance-eyebrow">规则中心 · 统一复核中心</p>
              <h2>回流候选转规则</h2>
            </div>
            <div className="template-governance-chip-row">
              <span className="template-governance-chip">统一复核中心</span>
              <span className="template-governance-chip template-governance-chip-secondary">
                转规则站
              </span>
              <span className="template-governance-chip template-governance-chip-secondary">
                待处理 {pendingCount}
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
            initialCandidates={data.candidates}
            initialSelectedCandidateId={selectedCandidateId}
            initialReviewItems={data.reviewItems}
            initialSelectedReviewItemId={selectedReviewItemId}
          />
        </section>
      </div>
    );
  }

  if (routeState.section === "release" && data?.section === "release") {
    const selectedRuleSet = data.overview.selectedRuleSet ?? data.overview.ruleSets[0];
    if (selectedRuleSet) {
      return (
        <div data-v2-detail-panel="release-check">
          <RulePlatformReleasePanel
            selectedRuleSet={selectedRuleSet}
            manuscriptType={data.overview.selectedTemplateFamily?.manuscript_type ?? null}
            rules={data.overview.rules}
            isBusy={releaseActionState.isBusy}
            onTransitionRuleSet={releaseActionState.onTransitionRuleSet}
          />
          {releaseActionState.statusMessage ? (
            <p className="template-governance-status">{releaseActionState.statusMessage}</p>
          ) : null}
          {releaseActionState.errorMessage ? (
            <p className="template-governance-error" role="alert">
              {releaseActionState.errorMessage}
            </p>
          ) : null}
        </div>
      );
    }
  }

  if (routeState.section === "advanced") {
    return (
      <div data-v2-detail-panel="advanced-compatibility">
        {advancedCompatibilityPanel ?? <TemplateGovernanceV2AdvancedPanel />}
      </div>
    );
  }

  if (routeState.section === "ai-intake") {
    const result = aiIntakeState.result;
    return (
      <div data-v2-detail-panel="ai-intake">
        <label className="rule-center-v2__field">
          <span>人工输入</span>
          <textarea
            name="rule-ai-intake-panel"
            rows={6}
            value={aiIntakeState.description}
            onChange={(event) => aiIntakeState.onDescriptionChange(event.target.value)}
          />
        </label>
        <div className="template-governance-actions">
          <button
            type="button"
            disabled={aiIntakeState.isGenerating || aiIntakeState.description.trim().length === 0}
            onClick={aiIntakeState.onGenerate}
          >
            {aiIntakeState.isGenerating ? "解析中..." : "解析规则"}
          </button>
          <button type="button" disabled={!result} onClick={aiIntakeState.onApplyResult}>
            应用到向导
          </button>
        </div>
        {aiIntakeState.errorMessage ? (
          <p className="template-governance-error" role="alert">
            {aiIntakeState.errorMessage}
          </p>
        ) : null}
        {result ? (
          <section className="template-governance-detail-grid">
            <div>
              <span>AI 理解</span>
              <p>{result.draft.ai_understanding_summary}</p>
            </div>
            <div>
              <span>推荐层级</span>
              <p>{result.draft.recommended_governance_layer}</p>
            </div>
            <div>
              <span>命中对象</span>
              <p>{result.draft.target_object}</p>
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  if (data?.section === "templates") {
    const isJournal = data.subtype === "journal";
    return (
      <div data-v2-detail-panel="template-detail">
        {templateActionState.statusMessage ? (
          <p className="template-governance-status">{templateActionState.statusMessage}</p>
        ) : null}
        {templateActionState.errorMessage ? (
          <p className="template-governance-error" role="alert">
            {templateActionState.errorMessage}
          </p>
        ) : null}
        <strong>
          {!isJournal
            ? data.ledger.selectedTemplate?.name ?? data.ledger.templates[0]?.name ?? "大模板"
            : data.overview.selectedJournalTemplateProfile?.journal_name ??
              data.overview.journalTemplateProfiles[0]?.journal_name ??
              "期刊模板"}
        </strong>
        <div className="template-governance-actions">
          <button type="button" onClick={templateActionState.onOpenCreateForm}>
            新建模板
          </button>
          <button type="button" onClick={templateActionState.onOpenEditForm}>
            编辑模板
          </button>
          <button type="button" onClick={templateActionState.onArchiveSelected}>
            归档模板
          </button>
          {isJournal ? (
            <button type="button" onClick={templateActionState.onActivateSelected}>
              启用期刊模板
            </button>
          ) : null}
        </div>
        {!isJournal && templateActionState.formMode ? (
          <TemplateGovernanceTemplateForm
            mode={templateActionState.formMode}
            initialValues={templateActionState.formValues}
            isBusy={templateActionState.isBusy}
            onChange={templateActionState.onFormChange}
            onCancel={templateActionState.onFormCancel}
            onSubmit={templateActionState.onFormSubmit}
          />
        ) : null}
        {isJournal && templateActionState.journalFormMode ? (
          <TemplateGovernanceJournalTemplateForm
            mode={templateActionState.journalFormMode}
            initialValues={templateActionState.journalFormValues}
            isBusy={templateActionState.isBusy}
            onChange={templateActionState.onJournalFormChange}
            onCancel={templateActionState.onJournalFormCancel}
            onSubmit={templateActionState.onJournalFormSubmit}
          />
        ) : null}
      </div>
    );
  }

  if (data?.section === "packages") {
    const selectedModule = data.ledger.selectedModule ?? data.ledger.modules[0] ?? null;
    return (
      <div data-v2-detail-panel="package-detail">
        {packageActionState.statusMessage ? (
          <p className="template-governance-status">{packageActionState.statusMessage}</p>
        ) : null}
        {packageActionState.errorMessage ? (
          <p className="template-governance-error" role="alert">
            {packageActionState.errorMessage}
          </p>
        ) : null}
        <strong>{selectedModule?.name ?? "规则包"}</strong>
        <div className="template-governance-actions">
          <button type="button" onClick={packageActionState.onOpenCreateForm}>
            新建规则包
          </button>
          <button type="button" onClick={packageActionState.onOpenEditForm}>
            编辑规则包
          </button>
          <button type="button" onClick={packageActionState.onArchiveSelected}>
            归档规则包
          </button>
          <button type="button" onClick={packageActionState.onOpenDefaultRules}>
            默认规则
          </button>
        </div>
        {packageActionState.formMode ? (
          <TemplateGovernanceContentModuleForm
            ledgerKind={data.subtype === "medical" ? "medical_specialized" : "general"}
            mode={packageActionState.formMode}
            initialValues={packageActionState.formValues}
            isBusy={packageActionState.isBusy}
            onChange={packageActionState.onFormChange}
            onCancel={packageActionState.onFormCancel}
            onSubmit={packageActionState.onFormSubmit}
          />
        ) : null}
      </div>
    );
  }

  if (data?.section === "extraction") {
    const selectedTask = data.ledger.selectedTask;
    const fallbackTask = data.ledger.tasks[0] ?? null;
    const selectedCandidate = selectedTask?.candidates[0] ?? null;
    return (
      <div data-v2-detail-panel="extraction-detail">
        {extractionActionState.statusMessage ? (
          <p className="template-governance-status">{extractionActionState.statusMessage}</p>
        ) : null}
        {extractionActionState.errorMessage ? (
          <p className="template-governance-error" role="alert">
            {extractionActionState.errorMessage}
          </p>
        ) : null}
        <strong>
          {extractionActionState.selectedCandidate?.title ??
            selectedCandidate?.title ??
            selectedTask?.task_name ??
            fallbackTask?.task_name ??
            "提取任务"}
        </strong>
        <div className="template-governance-actions">
          <button type="button" onClick={extractionActionState.onOpenCandidateForm}>
            暂存候选
          </button>
          <button type="button" onClick={extractionActionState.onOpenCandidateForm}>
            驳回候选
          </button>
          <button type="button" onClick={extractionActionState.onOpenCandidateForm}>
            确认入库
          </button>
          <button type="button" onClick={extractionActionState.onConvertToDraft}>
            转成草稿
          </button>
          <button type="button" onClick={extractionActionState.onOpenTaskForm}>
            新建提取任务
          </button>
        </div>
        {extractionActionState.taskFormOpen ? (
          <TemplateGovernanceExtractionTaskForm
            draft={extractionActionState.taskDraft}
            isBusy={extractionActionState.isBusy}
            onDraftChange={extractionActionState.onTaskDraftChange}
            onOriginalFileSelect={extractionActionState.onOriginalFileSelect}
            onEditedFileSelect={extractionActionState.onEditedFileSelect}
            onCancel={extractionActionState.onTaskFormCancel}
            onSubmit={extractionActionState.onTaskFormSubmit}
          />
        ) : null}
        {extractionActionState.candidateFormOpen && extractionActionState.selectedCandidate ? (
          <TemplateGovernanceCandidateConfirmationForm
            candidate={extractionActionState.selectedCandidate}
            values={extractionActionState.candidateFormValues}
            isBusy={extractionActionState.isBusy}
            onChange={extractionActionState.onCandidateFormChange}
            onCancel={extractionActionState.onCandidateFormCancel}
            onHold={extractionActionState.onCandidateHold}
            onReject={extractionActionState.onCandidateReject}
            onConfirm={extractionActionState.onCandidateConfirm}
          />
        ) : null}
      </div>
    );
  }

  if (data?.section === "rules") {
    const selectedRow = data.ledger.selectedRow ?? data.ledger.rows[0] ?? null;
    return (
      <div data-v2-detail-panel="rule-detail">
        {selectedRow ? (
          <article>
            <strong>{selectedRow.title}</strong>
            <dl>
              <dt>类型</dt>
              <dd>{selectedRow.asset_kind}</dd>
              <dt>模块</dt>
              <dd>{selectedRow.module_label}</dd>
              <dt>发布</dt>
              <dd>{selectedRow.publish_status}</dd>
            </dl>
          </article>
        ) : (
          <p className="template-governance-empty">未选择项目</p>
        )}
      </div>
    );
  }

  return (
    <div data-v2-detail-panel={routeState.panel}>
      <p className="template-governance-empty">未选择项目</p>
    </div>
  );
}

interface TemplateGovernanceV2RuleWizardPanelProps {
  controller: TemplateGovernanceWorkbenchController;
  initialMode?: RuleWizardState["mode"];
  initialEntryFormState?: RuleWizardEntryFormState;
  title?: string;
  candidateHandoff?: RuleWizardCandidateHandoffViewModel;
  onClose?: () => void;
  onComplete?: () => void;
}

function resolveSelectedLearningCandidateId(
  data: Extract<TemplateGovernanceV2SectionData, { section: "recovery" }>,
  selectedId: string | undefined,
): string | undefined {
  if (!selectedId) {
    return undefined;
  }

  return data.candidates.some((candidate) => candidate.id === selectedId)
    ? selectedId
    : undefined;
}

function resolveSelectedReviewItemId(
  data: Extract<TemplateGovernanceV2SectionData, { section: "recovery" }>,
  selectedId: string | undefined,
): string | undefined {
  if (!selectedId) {
    return undefined;
  }

  return data.reviewItems.some((item) => item.id === selectedId)
    ? selectedId
    : undefined;
}

function TemplateGovernanceV2RuleWizardPanel({
  controller,
  initialMode = "create",
  initialEntryFormState,
  title,
  candidateHandoff,
  onClose,
  onComplete,
}: TemplateGovernanceV2RuleWizardPanelProps) {
  const [wizardState, setWizardState] = useState<RuleWizardState>(() =>
    createRuleWizardState(initialMode),
  );
  const [entryFormState, setEntryFormState] = useState<RuleWizardEntryFormState>(() =>
    initialEntryFormState ?? createRuleWizardEntryFormState(),
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEntryFormState(initialEntryFormState ?? createRuleWizardEntryFormState());
    setWizardState(createRuleWizardState(initialMode));
  }, [initialEntryFormState, initialMode]);

  async function handleSaveDraft() {
    if (isSaving) {
      return;
    }

    if (wizardState.step !== "entry" && wizardState.draftRevisionId) {
      setWizardState((current) => ({ ...current, dirty: false }));
      setStatusMessage("规则草稿已暂存。");
      setErrorMessage(null);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const result = await controller.saveRuleWizardEntryDraft({
        form: entryFormState,
        draftAssetId: wizardState.draftAssetId,
        draftRevisionId: wizardState.draftRevisionId,
      });
      setWizardState((current) => ({
        ...current,
        dirty: false,
        draftAssetId: result.draftAssetId,
        draftRevisionId: result.draftRevisionId,
      }));
      setStatusMessage("规则草稿已暂存。");
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "规则录入草稿保存失败",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleEntryFormChange(nextValue: RuleWizardEntryFormState) {
    setEntryFormState(nextValue);
    setWizardState((current) => ({ ...current, dirty: true }));
    setStatusMessage(null);
    setErrorMessage(null);
  }

  function handleComplete(_input?: { releaseAction?: RuleWizardReleaseAction }) {
    setWizardState(createRuleWizardState("create"));
    setEntryFormState(createRuleWizardEntryFormState());
    setStatusMessage(null);
    setErrorMessage(null);
    onComplete?.();
  }

  return (
    <>
      {statusMessage ? (
        <p className="template-governance-status" data-v2-rule-wizard-status="success">
          {statusMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="template-governance-error" data-v2-rule-wizard-status="error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <TemplateGovernanceRuleWizard
        state={wizardState}
        title={title}
        candidateHandoff={candidateHandoff}
        entryFormState={entryFormState}
        onEntryFormChange={handleEntryFormChange}
        onBack={onClose}
        onPrevious={() => {
          setWizardState((current) => rewindRuleWizardState(current));
        }}
        onNext={() => {
          setWizardState((current) => advanceRuleWizardState(current));
        }}
        onSaveDraft={() => {
          void handleSaveDraft();
        }}
        onComplete={handleComplete}
      />
    </>
  );
}
