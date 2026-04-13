import {
  MAX_MANUSCRIPT_BATCH_UPLOAD_COUNT,
  type ManuscriptType,
  type UploadManuscriptInput,
} from "../manuscripts/index.ts";
import type { ManuscriptWorkbenchMode } from "./manuscript-workbench-controller.ts";

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
  onManuscriptTypeChange(value: ManuscriptType): void;
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
  baseTemplateLabel: string;
  selectedJournalTemplateId: string;
  currentAppliedLabel: string;
  hasPendingChange: boolean;
  options: WorkbenchSelectOption[];
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
  onExport(): void;
  onRefreshLatestJob(): void;
  onPublishHumanFinal?(): void;
}

export interface ManuscriptWorkbenchControlsProps {
  mode: ManuscriptWorkbenchMode;
  busy: boolean;
  layout?: "full" | "drawer";
  showLookupPanel?: boolean;
  intake?: ManuscriptWorkbenchIntakePanelProps;
  lookup: ManuscriptWorkbenchLookupPanelProps;
  templateSelection?: ManuscriptWorkbenchTemplateSelectionPanelProps;
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

  return (
    <section
      className={sectionClassName}
      aria-label={layout === "drawer" ? "批量处理与辅助动作" : "工作台操作区"}
    >
      <header className="manuscript-workbench-controls-intro">
        <div className="manuscript-workbench-controls-copy">
          <span className="manuscript-workbench-section-eyebrow">
            {layout === "drawer" ? "低频动作区" : "操作台"}
          </span>
          <h3>{layout === "drawer" ? "批量处理与辅助动作" : "同屏完成接入、检索与治理动作"}</h3>
          <p>
            {layout === "drawer"
              ? "把批量上传、模板切换和导出动作收纳到右侧，中央工作区只保留当前稿件判断。"
              : "让稿件接入、工作台检索和治理动作保持在同一张轻量工作桌面上。"}
          </p>
        </div>
        <div className="manuscript-workbench-desk-stat">
          <span>当前工作线</span>
          <strong>{describeMode(mode)}</strong>
        </div>
      </header>

      {layout === "drawer" ? (
        <div className="manuscript-workbench-batch-drawer-trigger">
          <button type="button" aria-expanded="true">
            批量处理
          </button>
          <span>上传、导出和模板动作集中在这里，避免打断中间的单稿判断。</span>
        </div>
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
              <div className="manuscript-workbench-button-row">
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
          <article className="manuscript-workbench-panel">
            <div className="manuscript-workbench-panel-heading">
              <div>
                <h3>{templateSelection.title === "Journal Template" ? "期刊模板" : templateSelection.title}</h3>
                <p>先选定基础模板家族和期刊覆盖，再继续下游治理动作。</p>
              </div>
            </div>
            <div className="manuscript-workbench-panel-body">
              <div className="manuscript-workbench-selection-context">
                <span>基础模板家族</span>
                <strong>{templateSelection.baseTemplateLabel}</strong>
              </div>
              <label className="manuscript-workbench-field">
                <span>期刊模板</span>
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
              <div className="manuscript-workbench-selection-context">
                <span>当前生效上下文</span>
                <strong>{resolveAppliedTemplateLabel(templateSelection)}</strong>
              </div>
              {templateSelection.hasPendingChange ? (
                <p className="manuscript-workbench-help is-warning">
                  已有未保存的模板切换，请先保存，再触发新的治理动作。
                </p>
              ) : null}
              <div className="manuscript-workbench-button-row">
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
              <div className="manuscript-workbench-button-row">
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

function IntakePanel({
  busy,
  intake,
}: {
  busy: boolean;
  intake: ManuscriptWorkbenchIntakePanelProps;
}) {
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
        <label className={resolveFieldClassName(requiresUploadPayload || hasTooManyFiles)}>
          <span>稿件文件</span>
          <input
            type="file"
            multiple
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length > 0) {
                intake.onFilesSelect(files);
              }
            }}
          />
        </label>
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
        <div className="manuscript-workbench-button-row">
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
        <div className="manuscript-workbench-button-row">
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
  return title;
}

function formatWorkbenchActionLabel(label: string): string {
  if (label === "Run Screening") return "执行初筛";
  if (label === "Run Editing") return "执行编辑";
  if (label === "Create Draft") return "生成草稿";
  if (label === "Finalize Proofreading") return "校对定稿";
  return label;
}

function formatSelectionContextLabel(label: string | undefined): string {
  if (label === "Selected Parent Asset") return "已选父资产";
  if (label === "Selected Draft Asset") return "已选草稿资产";
  if (label === "Selected Asset") return "已选资产";
  return label ?? "已选资产";
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
