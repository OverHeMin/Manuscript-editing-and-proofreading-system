import { useState } from "react";
import {
  MAX_MANUSCRIPT_BATCH_UPLOAD_COUNT,
  type UploadManuscriptInput,
} from "../manuscripts/index.ts";
import type {
  ManuscriptWorkbenchMode,
  ManuscriptWorkbenchReadOnlyExecutionContextViewModel,
} from "./manuscript-workbench-controller.ts";

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
  secondaryActionLabel?: string;
  options: WorkbenchSelectOption[];
  selectedContextLabel?: string;
  onSelect(value: string): void;
  onRun(): void;
  onSecondaryRun?(): void;
}

export interface ManuscriptWorkbenchUtilitiesPanelProps {
  canExport: boolean;
  canRefreshLatestJob: boolean;
  canPublishHumanFinal?: boolean;
  onExport(): void;
  onRefreshLatestJob(): void;
  onPublishHumanFinal?(): void;
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

  return (
    <section
      className={sectionClassName}
      aria-label={layout === "drawer" ? "批量处理与辅助动作" : "工作台操作区"}
    >
      {showScaffoldHeader ? (
        <header className="manuscript-workbench-controls-intro">
          <div className="manuscript-workbench-controls-copy">
            <span className="manuscript-workbench-section-eyebrow">操作台</span>
            <h3>同屏完成接入、检索与治理动作</h3>
            <p>让稿件接入、工作台检索和治理动作保持在同一张轻量工作桌面上。</p>
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
                <p>按稿件 ID 打开工作区，然后继续执行当前工作线动作。</p>
              </div>
            </div>
            <div className="manuscript-workbench-panel-body">
              <label className={resolveFieldClassName(!canLoadWorkspace)}>
                <span>稿件 ID</span>
                <input
                  value={lookup.manuscriptId}
                  onChange={(event) => lookup.onChange(event.target.value)}
                />
              </label>
              {!canLoadWorkspace ? (
                <p className="manuscript-workbench-help is-warning">
                  请先输入稿件 ID 再加载工作区。
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
                <p>导出当前资产、刷新最新任务，或在需要时发布人工终稿。</p>
              </div>
            </div>
            <div className="manuscript-workbench-panel-body">
              {!utilities.canRefreshLatestJob ? (
                <p className="manuscript-workbench-help is-warning">
                  至少生成一条任务后，才可以刷新最新任务。
                </p>
              ) : null}
              <div className="manuscript-workbench-button-row manuscript-workbench-button-row--sticky">
                {utilities.canPublishHumanFinal && utilities.onPublishHumanFinal ? (
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
                  导出当前资产
                </button>
                <button
                  type="button"
                  disabled={busy || !utilities.canRefreshLatestJob}
                  onClick={() => utilities.onRefreshLatestJob()}
                >
                  刷新最新任务
                </button>
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
  return (
    <article
      className="manuscript-workbench-panel"
      data-execution-context="readonly"
      data-execution-mode={executionContext.mode}
    >
      <div className="manuscript-workbench-panel-heading">
        <div>
          <h3>执行上下文</h3>
          <p>AI 接入已在系统设置统一治理，这里只展示当前工作线的只读解析结果。</p>
        </div>
      </div>
      <div className="manuscript-workbench-panel-body">
        <div className="manuscript-workbench-selection-context">
          <span>AI 接入</span>
          <strong>集中默认</strong>
        </div>
        <div className="manuscript-workbench-selection-context">
          <span>模型 ID</span>
          <strong>{executionContext.resolvedModelId ?? "未解析"}</strong>
        </div>
        <div className="manuscript-workbench-selection-context">
          <span>路由策略</span>
          <strong>{executionContext.modelRoutingPolicyVersionId ?? "未解析"}</strong>
        </div>
        <div className="manuscript-workbench-selection-context">
          <span>执行画像</span>
          <strong>{executionContext.executionProfileId ?? "未解析"}</strong>
        </div>
        <div className="manuscript-workbench-selection-context">
          <span>模型来源</span>
          <strong>{formatExecutionModelSourceLabel(executionContext.modelSource)}</strong>
        </div>
        <div className="manuscript-workbench-selection-context">
          <span>服务商就绪</span>
          <strong>{formatProviderReadinessLabel(executionContext.providerReadinessStatus)}</strong>
        </div>
        <div className="manuscript-workbench-selection-context">
          <span>运行时绑定</span>
          <strong>
            {formatExecutionRuntimeBindingReadinessLabel(
              executionContext.runtimeBindingReadinessStatus,
            )}
          </strong>
        </div>
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
      (intake.uploadForm.fileContentBase64?.trim().length ?? 0) === 0 &&
      (intake.uploadForm.storageKey?.trim().length ?? 0) === 0,
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
          <p>支持本地上传和存储键接入，稿件类型默认交给 AI 在上传时识别。</p>
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
        <label className={resolveFieldClassName(requiresUploadPayload)}>
          <span>存储键</span>
          <input
            value={intake.uploadForm.storageKey ?? ""}
            placeholder="选择本地文件后可不填写"
            onChange={(event) => intake.onStorageKeyChange(event.target.value)}
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
        {intake.attachedFileNames.length > 0 ? (
          <div className="manuscript-workbench-selection-context">
            <span>已附加文件</span>
            <strong>{intake.attachedFileNames.join("、")}</strong>
          </div>
        ) : null}
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
  const shouldShowManualManuscriptTypeSelect =
    templateSelection.showManualManuscriptTypeSelect &&
    (templateSelection.manualManuscriptTypeOptions?.length ?? 0) > 0 &&
    typeof templateSelection.onManualManuscriptTypeSelect === "function";

  return (
    <article className="manuscript-workbench-panel">
      <div className="manuscript-workbench-panel-heading">
        <div>
          <h3>
            {templateSelection.title === "Journal Template"
              ? "稿件类型与期刊模板"
              : templateSelection.title}
          </h3>
          <p>先看系统解析后的上下文，无需修正时可直接继续，需要时再做人工确认和期刊细化。</p>
        </div>
      </div>
      <div className="manuscript-workbench-panel-body">
        <div
          className="manuscript-workbench-resolved-context"
          data-confidence-level={templateSelection.confidenceLevel ?? "medium"}
        >
          <div className="manuscript-workbench-selection-context">
            <span>AI 识别稿件类型</span>
            <strong>{templateSelection.resolvedManuscriptTypeLabel}</strong>
          </div>
          <div className="manuscript-workbench-selection-context">
            <span>识别置信度</span>
            <strong>{templateSelection.confidenceLabel}</strong>
          </div>
          <div className="manuscript-workbench-selection-context">
            <span>基础模板家族</span>
            <strong>{templateSelection.baseTemplateLabel}</strong>
          </div>
          <div className="manuscript-workbench-selection-context">
            <span>当前生效上下文</span>
            <strong>{resolveAppliedTemplateLabel(templateSelection)}</strong>
          </div>
        </div>
        <details
          className="manuscript-workbench-template-override"
          open={templateSelection.requiresOperatorReview}
        >
          <summary>
            {shouldShowManualManuscriptTypeSelect
              ? "人工修正稿件类型与模板"
              : "修正基础模板家族"}
          </summary>
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
            <span>基础模板家族</span>
            <select
              value={templateSelection.selectedTemplateFamilyId}
              onChange={(event) => templateSelection.onTemplateFamilySelect(event.target.value)}
            >
              {templateSelection.templateFamilyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </details>
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
        {templateSelection.hasPendingChange ? (
          <p className="manuscript-workbench-help is-warning">
            已有未保存的模板切换，请先保存，再触发新的治理动作。
          </p>
        ) : null}
        {templateSelection.requiresOperatorReview ? (
          <p className="manuscript-workbench-help is-warning">
            AI 识别失败或低置信度时请先人工确认稿件类型，再选择期刊模板。
          </p>
        ) : null}
        <p className="manuscript-workbench-help">
          期刊模板用于细化小期刊或场景要求；如不选择，将仅按基础模板家族继续处理。
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
  const hasSecondaryAction =
    typeof action.onSecondaryRun === "function" &&
    (action.secondaryActionLabel?.trim().length ?? 0) > 0;
  const secondaryActionLabel = hasSecondaryAction
    ? action.secondaryActionLabel ?? ""
    : undefined;

  return (
    <article className="manuscript-workbench-panel">
      <div className="manuscript-workbench-panel-heading">
        <div>
          <h3>{formatWorkbenchPanelTitle(action.title)}</h3>
          <p>{description}</p>
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
          data-secondary-action={hasSecondaryAction ? "available" : "hidden"}
        >
          <button
            type="button"
            disabled={busy || !canRun}
            onClick={() => action.onRun()}
          >
            {busy ? "处理中..." : formatWorkbenchActionLabel(action.actionLabel)}
          </button>
          {hasSecondaryAction ? (
            <button
              type="button"
              className="manuscript-workbench-button-secondary"
              disabled={busy || !canRun}
              onClick={() => action.onSecondaryRun?.()}
            >
              {busy ? "处理中..." : formatWorkbenchActionLabel(secondaryActionLabel ?? "")}
            </button>
          ) : null}
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
    (input.fileContentBase64?.trim().length ?? 0) === 0 &&
    (input.storageKey?.trim().length ?? 0) === 0
  ) {
    messages.push("请先选择本地文件或填写存储键。");
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
    return `已选择 ${intake.attachedFileCount} 个文件，提交后会按批量任务处理。`;
  }

  if (intake.attachedFileNames[0]) {
    return `已选择文件：${intake.attachedFileNames[0]}`;
  }

  if (intake.uploadForm.fileContentBase64?.trim()) {
    return `已附加内联文件：${intake.uploadForm.fileName}`;
  }

  return "尚未选择本地文件，可直接上传，也可以只填写存储键。";
}

function formatWorkbenchPanelTitle(title: string): string {
  if (title === "Screening Run") return "初筛执行";
  if (title === "Editing Run") return "编辑执行";
  if (title === "Proofreading Draft") return "校对草稿生成";
  if (title === "Proofreading Final") return "校对定稿";
  return title;
}

function formatWorkbenchActionLabel(label: string): string {
  if (label === "Run Screening") return "执行初筛";
  if (label === "Run Editing") return "执行编辑";
  if (label === "Create Draft") return "生成草稿";
  if (label === "Finalize Proofreading") return "校对定稿";
  if (label === "Run Bare AI Once") return "AI 自动处理（本次）";
  return label;
}

function formatSelectionContextLabel(label: string | undefined): string {
  if (label === "Selected Parent Asset") return "已选父资产";
  if (label === "Selected Draft Asset") return "已选草稿资产";
  if (label === "Selected Asset") return "已选资产";
  return label ?? "已选资产";
}

function formatExecutionModelSourceLabel(source: string | undefined): string {
  switch (source) {
    case "template_family_policy":
      return "模板族策略";
    case "module_policy":
      return "模块策略";
    case "legacy_template_override":
      return "历史模板覆写";
    case "legacy_module_default":
      return "历史模块默认";
    case "legacy_system_default":
      return "历史系统默认";
    case "task_override":
      return "任务覆写";
    case undefined:
      return "集中默认";
    default:
      return source;
  }
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
