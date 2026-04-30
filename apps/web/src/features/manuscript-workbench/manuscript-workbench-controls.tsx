import { useState } from "react";
import {
  MAX_MANUSCRIPT_BATCH_UPLOAD_COUNT,
  type UploadManuscriptInput,
} from "../manuscripts/index.ts";
import type {
  ManuscriptWorkbenchMode,
  ManuscriptWorkbenchReadOnlyExecutionContextViewModel,
} from "./manuscript-workbench-controller.ts";
import {
  formatWorkbenchExecutionTrustModeLabel,
} from "./manuscript-workbench-execution-labels.ts";

export interface WorkbenchSelectOption {
  value: string;
  label: string;
}

export interface ManuscriptWorkbenchIntakePanelProps {
  uploadForm: UploadManuscriptInput;
  attachedFileCount: number;
  attachedFileNames: string[];
  canSubmit: boolean;
  onTitleChange(value: string): void;
  onStorageKeyChange(value: string): void;
  onFilesSelect(files: File[]): void;
  onSubmit(): void;
}

export interface ManuscriptWorkbenchLookupPanelProps {
  manuscriptId: string;
  onChange(value: string): void;
  onLoad(): void;
}

export interface ManuscriptWorkbenchTemplateSelectionPanelProps {
  title: string;
  bindingEnabled?: boolean;
  resolvedManuscriptTypeLabel: string;
  confidenceLabel: string;
  confidenceLevel?: "low" | "medium" | "high";
  requiresOperatorReview: boolean;
  showManualManuscriptTypeSelect?: boolean;
  manualManuscriptTypeValue?: string;
  manualManuscriptTypeOptions?: WorkbenchSelectOption[];
  baseTemplateLabel: string;
  selectedTemplateFamilyId: string;
  templateFamilyOptions: WorkbenchSelectOption[];
  selectedJournalTemplateId: string;
  currentAppliedLabel: string;
  hasPendingChange: boolean;
  options: WorkbenchSelectOption[];
  onBindingEnabledChange?(value: boolean): void;
  onManualManuscriptTypeSelect?(value: string): void;
  onTemplateFamilySelect(value: string): void;
  onSelect(value: string): void;
  onApply(): void;
}

export interface ManuscriptWorkbenchActionPanelProps {
  title: string;
  selectedAssetId: string;
  emptyLabel: string;
  actionLabel: string;
  options: WorkbenchSelectOption[];
  selectedContextLabel?: string;
  onSelect(value: string): void;
  onRun(): void;
}

export interface ManuscriptWorkbenchUtilitiesPanelProps {
  canExport: boolean;
  canRefreshLatestJob: boolean;
  canPublishHumanFinal?: boolean;
  canOpenHarnessMatrix?: boolean;
  onExport(): void;
  onRefreshLatestJob(): void;
  onPublishHumanFinal?(): void;
  onOpenHarnessMatrix?(): void;
}

export interface ManuscriptWorkbenchExecutionContextPanelProps
  extends ManuscriptWorkbenchReadOnlyExecutionContextViewModel {}

export interface ManuscriptWorkbenchControlsProps {
  mode: ManuscriptWorkbenchMode;
  busy: boolean;
  layout?: "full" | "drawer";
  showLookupPanel?: boolean;
  intake?: ManuscriptWorkbenchIntakePanelProps;
  lookup: ManuscriptWorkbenchLookupPanelProps;
  templateSelection?: ManuscriptWorkbenchTemplateSelectionPanelProps;
  executionContext?: ManuscriptWorkbenchExecutionContextPanelProps;
  moduleAction?: ManuscriptWorkbenchActionPanelProps;
  finalizeAction?: ManuscriptWorkbenchActionPanelProps;
  utilities?: ManuscriptWorkbenchUtilitiesPanelProps;
}

export function ManuscriptWorkbenchControls({
  mode,
  busy,
  layout = "full",
  showLookupPanel = true,
  intake,
  lookup,
  templateSelection,
  executionContext,
  moduleAction,
  finalizeAction,
  utilities,
}: ManuscriptWorkbenchControlsProps) {
  const canLoadWorkspace = lookup.manuscriptId.trim().length > 0;
  const sectionClassName =
    layout === "drawer"
      ? "manuscript-workbench-controls manuscript-workbench-controls--drawer"
      : "manuscript-workbench-controls";
  const gridClassName =
    layout === "drawer"
      ? "manuscript-workbench-controls-grid manuscript-workbench-controls-grid--drawer"
      : "manuscript-workbench-controls-grid";
  const showScaffoldHeader = layout !== "drawer";
  const utilitiesDescription =
    mode === "proofreading"
      ? "导出当前文件、刷新最新任务。"
      : "导出当前文件、刷新最新任务，或发布人工终稿。";
  const shouldShowUtilitiesPrimaryAction =
    mode !== "proofreading" &&
    utilities?.canPublishHumanFinal &&
    utilities.onPublishHumanFinal;

  return (
    <section
      className={sectionClassName}
      aria-label={layout === "drawer" ? "批量处理与辅助动作" : "工作台操作区"}
    >
      {showScaffoldHeader ? (
        <header className="manuscript-workbench-controls-intro">
          <div className="manuscript-workbench-controls-copy">
            <span className="manuscript-workbench-section-eyebrow">操作台</span>
            <h3>稿件处理</h3>
          </div>
          <div className="manuscript-workbench-desk-stat">
            <span>当前工作线</span>
            <strong>{describeMode(mode)}</strong>
          </div>
        </header>
      ) : null}

      <div className={gridClassName}>
        {intake ? <IntakePanel busy={busy} intake={intake} /> : null}

        {showLookupPanel ? (
          <article className="manuscript-workbench-panel">
            <div className="manuscript-workbench-panel-heading">
              <div>
                <h3>工作区检索</h3>
              </div>
            </div>
            <div className="manuscript-workbench-panel-body">
              <label className={resolveFieldClassName(!canLoadWorkspace)}>
                <span>稿件编号</span>
                <input
                  value={lookup.manuscriptId}
                  onChange={(event) => lookup.onChange(event.target.value)}
                />
              </label>
              {!canLoadWorkspace ? (
                <p className="manuscript-workbench-help is-warning">
                  请先输入稿件编号再加载工作区。
                </p>
              ) : null}
              <div className="manuscript-workbench-button-row manuscript-workbench-button-row--sticky">
                <button
                  type="button"
                  disabled={busy || !canLoadWorkspace}
                  onClick={() => lookup.onLoad()}
                >
                  加载工作区
                </button>
              </div>
            </div>
          </article>
        ) : null}

        {templateSelection ? (
          <TemplateSelectionPanel busy={busy} templateSelection={templateSelection} />
        ) : null}

        {executionContext ? (
          <ExecutionContextPanel executionContext={executionContext} />
        ) : null}

        {moduleAction ? (
          <ActionPanel
            action={moduleAction}
            busy={busy}
            description="选择当前可用的上游资产，作为本次模块执行的输入来源。"
          />
        ) : null}

        {finalizeAction ? (
          <ActionPanel
            action={finalizeAction}
            busy={busy}
            description="锁定将要成为人工确认终稿的校对草稿，然后完成最终定稿。"
          />
        ) : null}

        {utilities ? (
          <article className="manuscript-workbench-panel">
            <div className="manuscript-workbench-panel-heading">
              <div>
                <h3>工作区工具</h3>
                <p>{utilitiesDescription}</p>
              </div>
            </div>
            <div className="manuscript-workbench-panel-body">
              {!utilities.canRefreshLatestJob ? (
                <p className="manuscript-workbench-help is-warning">
                  至少生成一条任务后，才可以刷新最新任务。
                </p>
              ) : null}
              <div className="manuscript-workbench-button-row manuscript-workbench-button-row--sticky">
                {shouldShowUtilitiesPrimaryAction ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => utilities.onPublishHumanFinal?.()}
                  >
                    发布人工终稿
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy || !utilities.canExport}
                  onClick={() => utilities.onExport()}
                >
                  导出当前文件
                </button>
                <button
                  type="button"
                  disabled={busy || !utilities.canRefreshLatestJob}
                  onClick={() => utilities.onRefreshLatestJob()}
                >
                  刷新最新任务
                </button>
                {utilities.onOpenHarnessMatrix ? (
                  <button
                    type="button"
                    disabled={busy || !utilities.canOpenHarnessMatrix}
                    onClick={() => utilities.onOpenHarnessMatrix?.()}
                  >
                    验证矩阵
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}

function ExecutionContextPanel({
  executionContext,
}: {
  executionContext: ManuscriptWorkbenchExecutionContextPanelProps;
}) {
  const templateStatusLabel = resolveExecutionTemplateStatusLabel(executionContext);
  const aiStatusLabel = resolveExecutionAiStatusLabel(executionContext);

  return (
    <article
      className="manuscript-workbench-panel"
      data-execution-context="readonly"
      data-execution-mode={executionContext.mode}
    >
      <div className="manuscript-workbench-panel-heading">
        <div>
          <h3>AI 准备情况</h3>
          <p>当前模块会按已确认模板和系统设置执行，这里不展示内部参数。</p>
        </div>
      </div>
      <div className="manuscript-workbench-panel-body">
        <div className="manuscript-workbench-selection-context">
          <span>当前方式</span>
          <strong>{resolveOperatorFacingExecutionModeLabel(executionContext.mode)}</strong>
        </div>
        <div className="manuscript-workbench-selection-context">
          <span>当前模板</span>
          <strong>{templateStatusLabel}</strong>
        </div>
        <div className="manuscript-workbench-selection-context">
          <span>AI 状态</span>
          <strong>{aiStatusLabel}</strong>
        </div>
        <p className="manuscript-workbench-help">需要调整时前往系统设置。</p>
      </div>
    </article>
  );
}

function IntakePanel({
  busy,
  intake,
}: {
  busy: boolean;
  intake: ManuscriptWorkbenchIntakePanelProps;
}) {
  const [isDragActive, setIsDragActive] = useState(false);
  const requiresUploadPayload = Boolean(
    intake.attachedFileCount === 0 &&
      (intake.uploadForm.fileContentBase64?.trim().length ?? 0) === 0,
  );
  const hasTooManyFiles =
    intake.attachedFileCount > MAX_MANUSCRIPT_BATCH_UPLOAD_COUNT;
  const validationMessages = buildIntakeValidationMessages(
    intake.uploadForm,
    intake.attachedFileCount > 0,
    intake.attachedFileCount,
  );
  const selectedFileSummary = buildSelectedFileSummary(intake);
  const dropzoneClassName = isDragActive
    ? "manuscript-workbench-upload-dropzone is-active"
    : "manuscript-workbench-upload-dropzone";

  function handleSelectedFiles(files: FileList | File[] | null | undefined) {
    const selectedFiles = Array.isArray(files) ? files : Array.from(files ?? []);
    if (selectedFiles.length > 0) {
      intake.onFilesSelect(selectedFiles);
    }
  }

  return (
    <article className="manuscript-workbench-panel">
      <div className="manuscript-workbench-panel-heading">
        <div>
          <h3>稿件接入</h3>
        </div>
      </div>
      <div className="manuscript-workbench-panel-body">
        <label
          className={resolveFieldClassName(intake.uploadForm.title.trim().length === 0)}
        >
          <span>标题</span>
          <input
            value={intake.uploadForm.title}
            onChange={(event) => intake.onTitleChange(event.target.value)}
          />
        </label>
        <div
          className={dropzoneClassName}
          data-dropzone="manuscript-upload"
          data-drag-active={isDragActive ? "true" : "false"}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!isDragActive) {
              setIsDragActive(true);
            }
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragActive(false);
            handleSelectedFiles(event.dataTransfer?.files);
          }}
        >
          <p className="manuscript-workbench-upload-dropzone-copy">
            拖拽稿件到这里，或使用下方文件框批量选择上传。
          </p>
          <label className={resolveFieldClassName(requiresUploadPayload || hasTooManyFiles)}>
            <span>稿件文件</span>
            <input
              type="file"
              multiple
              onChange={(event) => handleSelectedFiles(event.target.files)}
            />
          </label>
        </div>
        <p className="manuscript-workbench-help">
          一次最多 {MAX_MANUSCRIPT_BATCH_UPLOAD_COUNT} 个稿件，超出后提交按钮会自动停用。
        </p>
        <p className="manuscript-workbench-help">{selectedFileSummary}</p>
        {validationMessages.length > 0 ? (
          <ul className="manuscript-workbench-validation-list">
            {validationMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}
        <div className="manuscript-workbench-button-row manuscript-workbench-button-row--sticky">
          <button
            type="button"
            disabled={busy || !intake.canSubmit || hasTooManyFiles}
            onClick={() => intake.onSubmit()}
          >
            {busy ? "处理中..." : "上传稿件"}
          </button>
        </div>
      </div>
    </article>
  );
}

function TemplateSelectionPanel({
  busy,
  templateSelection,
}: {
  busy: boolean;
  templateSelection: ManuscriptWorkbenchTemplateSelectionPanelProps;
}) {
  const bindingEnabled = templateSelection.bindingEnabled !== false;
  const shouldShowManualManuscriptTypeSelect =
    bindingEnabled &&
    templateSelection.showManualManuscriptTypeSelect &&
    (templateSelection.manualManuscriptTypeOptions?.length ?? 0) > 0 &&
    typeof templateSelection.onManualManuscriptTypeSelect === "function";

  return (
    <article className="manuscript-workbench-panel">
      <div className="manuscript-workbench-panel-heading">
        <div>
          <h3>
            {templateSelection.title === "Journal Template"
              ? "模板绑定"
              : templateSelection.title}
          </h3>
        </div>
      </div>
      <div className="manuscript-workbench-panel-body">
        <div
          className="manuscript-workbench-resolved-context"
          data-confidence-level={templateSelection.confidenceLevel ?? "medium"}
        >
          {bindingEnabled ? (
            <>
              <div className="manuscript-workbench-selection-context">
                <span>稿件类型</span>
                <strong>
                  {formatTemplateManuscriptTypeSelection(templateSelection)}
                </strong>
              </div>
              <div className="manuscript-workbench-selection-context">
                <span>大模板</span>
                <strong>{templateSelection.baseTemplateLabel}</strong>
              </div>
              <div className="manuscript-workbench-selection-context">
                <span>小模板</span>
                <strong>{resolveAppliedTemplateLabel(templateSelection)}</strong>
              </div>
              <div className="manuscript-workbench-selection-context">
                <span>规则包</span>
                <strong>
                  {templateSelection.title === "Journal Template" &&
                  templateSelection.selectedTemplateFamilyId.trim().length > 0
                    ? "通用包 + 医用包" +
                      (templateSelection.selectedJournalTemplateId.trim().length > 0
                        ? " + 期刊规则"
                        : "")
                    : "通用包 + 医用包"}
                </strong>
              </div>
              {templateSelection.title === "Journal Template" ? (
                <div className="manuscript-workbench-selection-context">
                  <span>校对方式</span>
                  <strong>深度校对</strong>
                </div>
              ) : null}
            </>
          ) : (
            <div className="manuscript-workbench-selection-context">
              <span>当前方式</span>
              <strong>bare AI</strong>
            </div>
          )}
        </div>
        <fieldset className="manuscript-workbench-field">
          <legend>是否绑定模板</legend>
          <label>
            <input
              type="radio"
              name="template-binding-enabled"
              checked={bindingEnabled}
              onChange={() => templateSelection.onBindingEnabledChange?.(true)}
            />
            是
          </label>
          <label>
            <input
              type="radio"
              name="template-binding-enabled"
              checked={!bindingEnabled}
              onChange={() => templateSelection.onBindingEnabledChange?.(false)}
            />
            否
          </label>
        </fieldset>
        {bindingEnabled ? (
          <div className="manuscript-workbench-template-binding-grid">
            {shouldShowManualManuscriptTypeSelect ? (
              <label className="manuscript-workbench-field">
                <span>人工确认稿件类型</span>
                <select
                  value={templateSelection.manualManuscriptTypeValue ?? ""}
                  onChange={(event) =>
                    templateSelection.onManualManuscriptTypeSelect?.(event.target.value)}
                >
                  {templateSelection.manualManuscriptTypeOptions?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="manuscript-workbench-field">
              <span>大模板</span>
              <select
                value={templateSelection.selectedTemplateFamilyId}
                onChange={(event) => templateSelection.onTemplateFamilySelect(event.target.value)}
              >
                {templateSelection.selectedTemplateFamilyId.trim().length === 0 &&
                templateSelection.templateFamilyOptions.length > 0 ? (
                  <option value="">请选择基础模板家族</option>
                ) : null}
                {templateSelection.templateFamilyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="manuscript-workbench-field">
              <span>期刊模板（小期刊/场景）</span>
              <select
                value={templateSelection.selectedJournalTemplateId}
                onChange={(event) => templateSelection.onSelect(event.target.value)}
              >
                <option value="">仅使用基础家族</option>
                {templateSelection.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        {templateSelection.hasPendingChange ? (
          <p className="manuscript-workbench-help is-warning">
            已有未保存的模板切换，请先保存，再继续处理。
          </p>
        ) : null}
        {templateSelection.requiresOperatorReview ? (
          <p className="manuscript-workbench-help is-warning">
            请人工确认稿件类型，再选择大模板和期刊模板。
          </p>
        ) : null}
        <p className="manuscript-workbench-help">
          {bindingEnabled
            ? "绑定后按 governed 模式执行，自动带入通用包、医用包；校对模块走深度切片校对。"
            : "本次不绑定模板，系统会按 bare AI 方式处理。"}
        </p>
        <div className="manuscript-workbench-button-row manuscript-workbench-button-row--sticky">
          <button
            type="button"
            disabled={busy}
            onClick={() => templateSelection.onApply()}
          >
            {busy ? "处理中..." : "保存模板上下文"}
          </button>
        </div>
      </div>
    </article>
  );
}

function ActionPanel({
  action,
  busy,
  description,
}: {
  action: ManuscriptWorkbenchActionPanelProps;
  busy: boolean;
  description: string;
}) {
  const canRun = action.selectedAssetId.trim().length > 0;
  const selectedOption = action.options.find(
    (option) => option.value === action.selectedAssetId,
  );

  return (
    <article className="manuscript-workbench-panel">
      <div className="manuscript-workbench-panel-heading">
        <div>
          <h3>{formatWorkbenchPanelTitle(action.title)}</h3>
        </div>
      </div>
      <div className="manuscript-workbench-panel-body">
        <label className={resolveFieldClassName(!canRun)}>
          <span>父资产</span>
          <select
            value={action.selectedAssetId}
            onChange={(event) => action.onSelect(event.target.value)}
          >
            <option value="">{action.emptyLabel}</option>
            {action.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {selectedOption ? (
          <div className="manuscript-workbench-selection-context">
            <span>{formatSelectionContextLabel(action.selectedContextLabel)}</span>
            <strong>{selectedOption.label}</strong>
          </div>
        ) : null}
        {!canRun ? (
          <p className="manuscript-workbench-help is-warning">
            请先选择资产，再执行当前模块。
          </p>
        ) : null}
        <div
          className="manuscript-workbench-button-row manuscript-workbench-button-row--sticky"
          data-secondary-action="hidden"
        >
          <button
            type="button"
            disabled={busy || !canRun}
            onClick={() => action.onRun()}
          >
            {busy ? "处理中..." : formatWorkbenchActionLabel(action.actionLabel)}
          </button>
        </div>
      </div>
    </article>
  );
}

function describeMode(mode: ManuscriptWorkbenchMode): string {
  if (mode === "submission") return "投稿";
  if (mode === "screening") return "初筛";
  if (mode === "editing") return "编辑";
  return "校对";
}

function resolveFieldClassName(isInvalid: boolean): string {
  return isInvalid
    ? "manuscript-workbench-field is-invalid"
    : "manuscript-workbench-field";
}

function buildIntakeValidationMessages(
  input: UploadManuscriptInput,
  hasAttachedFiles: boolean,
  attachedFileCount: number,
): string[] {
  const messages: string[] = [];

  if (input.title.trim().length === 0) {
    messages.push("请先填写稿件标题。");
  }

  if (
    !hasAttachedFiles &&
    (input.fileContentBase64?.trim().length ?? 0) === 0
  ) {
    messages.push("请先选择本地稿件。");
  }

  if (attachedFileCount > MAX_MANUSCRIPT_BATCH_UPLOAD_COUNT) {
    messages.push(
      `批量上传不能超过 ${MAX_MANUSCRIPT_BATCH_UPLOAD_COUNT} 个稿件。`,
    );
  }

  return messages;
}

function buildSelectedFileSummary(
  intake: ManuscriptWorkbenchIntakePanelProps,
): string {
  if (intake.attachedFileCount > 1) {
    return `已选择 ${intake.attachedFileCount} 个稿件，提交后会按批量任务处理。`;
  }

  if (intake.attachedFileNames[0]) {
    return "已选择 1 个稿件，提交后会直接开始处理。";
  }

  if (intake.uploadForm.fileContentBase64?.trim()) {
    return "已附加 1 个稿件，提交后会直接开始处理。";
  }

  return "尚未选择稿件。";
}

function formatTemplateManuscriptTypeSelection(
  templateSelection: ManuscriptWorkbenchTemplateSelectionPanelProps,
): string {
  const selectedValue = templateSelection.manualManuscriptTypeValue?.trim() ?? "";
  return (
    templateSelection.manualManuscriptTypeOptions?.find(
      (option) => option.value === selectedValue,
    )?.label ??
    selectedValue ??
    templateSelection.resolvedManuscriptTypeLabel
  );
}

function formatWorkbenchPanelTitle(title: string): string {
  if (title === "Screening Run") return "初筛执行";
  if (title === "Editing Run") return "编辑执行";
  if (title === "Proofreading Draft" || title === "Proofreading Run") return "校对执行";
  if (title === "Proofreading Final") return "校对定稿";
  return title;
}

function legacyFormatWorkbenchActionLabel(label: string): string {
  if (label === "Run Screening") return "执行初筛";
  if (label === "Run Editing") return "执行编辑";
  if (label === "Create Draft" || label === "Run Proofreading") return "执行校对";
  if (label === "Finalize Proofreading") return "校对定稿";
  if (label === "Run Bare AI Once") return "执行处理";
  return label;
}

function formatWorkbenchActionLabel(label: string): string {
  if (label === "Create Draft" || label === "Run Proofreading") return "执行校对";
  if (label === "Finalize Proofreading") return "校对终稿";
  return legacyFormatWorkbenchActionLabel(label);
}

function formatSelectionContextLabel(label: string | undefined): string {
  if (label === "Selected Parent Asset") return "已选父资产";
  if (label === "Selected Draft Asset") return "已选草稿资产";
  if (label === "Selected Asset") return "已选资产";
  return label ?? "已选资产";
}

function formatProviderReadinessLabel(status: string | undefined): string {
  if (status === "ok") {
    return "就绪";
  }

  if (status === "warning") {
    return "需关注";
  }

  return "未报告";
}

function resolveOperatorFacingExecutionModeLabel(mode: ManuscriptWorkbenchMode): string {
  if (mode === "proofreading") {
    return "受控校对";
  }

  return "受控处理";
}

function resolveExecutionTemplateStatusLabel(
  executionContext: ManuscriptWorkbenchExecutionContextPanelProps,
): string {
  const hasResolvedContext = Boolean(
    executionContext.resolvedModelId ||
      executionContext.modelRoutingPolicyVersionId ||
      executionContext.executionProfileId ||
      executionContext.retrievalPresetId ||
      executionContext.runtimeBindingId,
  );

  return hasResolvedContext ? "已按当前模板装载" : "待补充模板设置";
}

function resolveExecutionAiStatusLabel(
  executionContext: ManuscriptWorkbenchExecutionContextPanelProps,
): string {
  const providerStatus = formatProviderReadinessLabel(
    executionContext.providerReadinessStatus,
  );
  const runtimeStatus = formatExecutionRuntimeBindingReadinessLabel(
    executionContext.runtimeBindingReadinessStatus,
  );

  if (providerStatus === "就绪" && runtimeStatus === "就绪") {
    return "已就绪";
  }

  return "需检查";
}

function formatExecutionRuntimeBindingReadinessLabel(
  status: string | undefined,
): string {
  if (status === "ready") {
    return "就绪";
  }

  if (status === "degraded") {
    return "已降级";
  }

  if (status === "missing") {
    return "缺失";
  }

  return "未报告";
}

function resolveAppliedTemplateLabel(
  templateSelection: ManuscriptWorkbenchTemplateSelectionPanelProps,
): string {
  return (
    templateSelection.options.find(
      (option) => option.value === templateSelection.selectedJournalTemplateId,
    )?.label ?? templateSelection.currentAppliedLabel
  );
}
