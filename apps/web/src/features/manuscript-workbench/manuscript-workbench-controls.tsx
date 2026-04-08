import type { ManuscriptType, UploadManuscriptInput } from "../manuscripts/index.ts";
import type { ManuscriptWorkbenchMode } from "./manuscript-workbench-controller.ts";

const manuscriptTypeOptions: ManuscriptType[] = [
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

export interface WorkbenchSelectOption {
  value: string;
  label: string;
}

export interface ManuscriptWorkbenchIntakePanelProps {
  uploadForm: UploadManuscriptInput;
  canSubmit: boolean;
  onTitleChange(value: string): void;
  onManuscriptTypeChange(value: ManuscriptType): void;
  onStorageKeyChange(value: string): void;
  onFileSelect(file: File): void;
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
  intake,
  lookup,
  templateSelection,
  moduleAction,
  finalizeAction,
  utilities,
}: ManuscriptWorkbenchControlsProps) {
  const intakeMessages = intake ? buildIntakeValidationMessages(intake.uploadForm) : [];
  const canLoadWorkspace = lookup.manuscriptId.trim().length > 0;
  const canRunModule = Boolean(moduleAction?.selectedAssetId.length);
  const canFinalizeProofreading = Boolean(finalizeAction?.selectedAssetId.length);
  const requiresUploadPayload = Boolean(
    intake &&
      (intake.uploadForm.fileContentBase64?.trim().length ?? 0) === 0 &&
      (intake.uploadForm.storageKey?.trim().length ?? 0) === 0,
  );
  const selectedModuleOption = resolveSelectedOption(moduleAction);
  const selectedFinalizeOption = resolveSelectedOption(finalizeAction);
  const selectedJournalTemplateOption = templateSelection?.options.find(
    (option) => option.value === templateSelection.selectedJournalTemplateId,
  );

  return (
    <section className="manuscript-workbench-controls" aria-label="工作台操作区">
      <header className="manuscript-workbench-controls-intro">
        <div className="manuscript-workbench-controls-copy">
          <span className="manuscript-workbench-section-eyebrow">操作台</span>
          <h3>在同一桌面完成接入、检索与治理动作。</h3>
          <p>
            让稿件接入、当前工作线执行与辅助工具保持在同一轻量工作面。
          </p>
        </div>
        <div className="manuscript-workbench-desk-stat">
          <span>当前工作线</span>
          <strong>{describeMode(mode)}</strong>
        </div>
      </header>
      <div className="manuscript-workbench-controls-grid">
        {intake ? (
          <article className="manuscript-workbench-panel">
            <div className="manuscript-workbench-panel-heading">
              <div>
                <h3>稿件接入</h3>
                <p>
                  上传本地稿件，或继续使用已有存储键完成接入。
                </p>
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
              <label className="manuscript-workbench-field">
                <span>稿件类型</span>
                <select
                  value={intake.uploadForm.manuscriptType}
                  onChange={(event) =>
                    intake.onManuscriptTypeChange(event.target.value as ManuscriptType)
                  }
                >
                  {manuscriptTypeOptions.map((manuscriptType) => (
                    <option key={manuscriptType} value={manuscriptType}>
                      {manuscriptType}
                    </option>
                  ))}
                </select>
              </label>
              <label className={resolveFieldClassName(requiresUploadPayload)}>
                <span>存储键</span>
                <input
                  value={intake.uploadForm.storageKey ?? ""}
                  placeholder="选择本地文件后可不填写"
                  onChange={(event) => intake.onStorageKeyChange(event.target.value)}
                />
              </label>
              <label className={resolveFieldClassName(requiresUploadPayload)}>
                <span>稿件文件</span>
                <input
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      intake.onFileSelect(file);
                    }
                  }}
                />
              </label>
              <p className="manuscript-workbench-help">
                {intake.uploadForm.fileContentBase64
                  ? `已选择本地文件：${intake.uploadForm.fileName}`
                  : "尚未选择本地文件，可填写存储键继续使用元数据上传。"}
              </p>
              {intakeMessages.length > 0 ? (
                <ul className="manuscript-workbench-validation-list">
                  {intakeMessages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              ) : null}
              <div className="manuscript-workbench-button-row">
                <button
                  type="button"
                  disabled={busy || !intake.canSubmit}
                  onClick={() => intake.onSubmit()}
                >
                  {busy ? "处理中..." : "上传稿件"}
                </button>
              </div>
            </div>
          </article>
        ) : null}

        <article className="manuscript-workbench-panel">
          <div className="manuscript-workbench-panel-heading">
            <div>
              <h3>工作区检索</h3>
              <p>
                按稿件 ID 加载工作区，再继续 {describeMode(mode)} 的相关操作。
              </p>
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

        {templateSelection ? (
          <article className="manuscript-workbench-panel">
            <div className="manuscript-workbench-panel-heading">
              <div>
                <h3>{formatTemplateSelectionTitle(templateSelection.title)}</h3>
                <p>
                  在基础模板家族上选择期刊级小模板，再继续后续治理执行。
                </p>
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
                <strong>
                  {selectedJournalTemplateOption?.label ??
                    templateSelection.currentAppliedLabel}
                </strong>
              </div>
              {templateSelection.hasPendingChange ? (
                <p className="manuscript-workbench-help is-warning">
                  请先保存模板上下文，再让下一次治理执行使用所选期刊覆盖。
                </p>
              ) : null}
              <div className="manuscript-workbench-button-row">
                <button type="button" disabled={busy} onClick={() => templateSelection.onApply()}>
                  {busy ? "处理中..." : "保存模板上下文"}
                </button>
              </div>
            </div>
          </article>
        ) : null}

        {moduleAction ? (
          <article className="manuscript-workbench-panel">
            <div className="manuscript-workbench-panel-heading">
              <div>
                <h3>{formatWorkbenchPanelTitle(moduleAction.title)}</h3>
                <p>选择当前可用的上游资产，作为本次模块执行的输入来源。</p>
              </div>
            </div>
            <div className="manuscript-workbench-panel-body">
              <label className={resolveFieldClassName(!canRunModule)}>
                <span>父资产</span>
                <select
                  value={moduleAction.selectedAssetId}
                  onChange={(event) => moduleAction.onSelect(event.target.value)}
                >
                  <option value="">{moduleAction.emptyLabel}</option>
                  {moduleAction.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {selectedModuleOption ? (
                <div className="manuscript-workbench-selection-context">
                  <span>{formatSelectionContextLabel(moduleAction.selectedContextLabel, "已选资产")}</span>
                  <strong>{selectedModuleOption.label}</strong>
                </div>
              ) : null}
              {!canRunModule ? (
                <p className="manuscript-workbench-help is-warning">
                  请先选择父资产再启动当前模块。
                </p>
              ) : null}
              <div className="manuscript-workbench-button-row">
                <button
                  type="button"
                  disabled={busy || !canRunModule}
                  onClick={() => moduleAction.onRun()}
                >
                  {busy ? "处理中..." : formatWorkbenchActionLabel(moduleAction.actionLabel)}
                </button>
              </div>
            </div>
          </article>
        ) : null}

        {finalizeAction ? (
          <article className="manuscript-workbench-panel">
            <div className="manuscript-workbench-panel-heading">
              <div>
                <h3>{formatWorkbenchActionLabel(finalizeAction.actionLabel)}</h3>
                <p>锁定将要成为人工确认终稿的校对草稿，再完成最终定稿。</p>
              </div>
            </div>
            <div className="manuscript-workbench-panel-body">
              <label className={resolveFieldClassName(!canFinalizeProofreading)}>
                <span>草稿资产</span>
                <select
                  value={finalizeAction.selectedAssetId}
                  onChange={(event) => finalizeAction.onSelect(event.target.value)}
                >
                  <option value="">{finalizeAction.emptyLabel}</option>
                  {finalizeAction.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {selectedFinalizeOption ? (
                <div className="manuscript-workbench-selection-context">
                  <span>{formatSelectionContextLabel(finalizeAction.selectedContextLabel, "已选资产")}</span>
                  <strong>{selectedFinalizeOption.label}</strong>
                </div>
              ) : null}
              {!canFinalizeProofreading ? (
                <p className="manuscript-workbench-help is-warning">
                  请先选择校对草稿再执行定稿。
                </p>
              ) : null}
              <div className="manuscript-workbench-button-row">
                <button
                  type="button"
                  disabled={busy || !canFinalizeProofreading}
                  onClick={() => finalizeAction.onRun()}
                >
                  {busy ? "处理中..." : formatWorkbenchActionLabel(finalizeAction.actionLabel)}
                </button>
              </div>
            </div>
          </article>
        ) : null}

        {utilities ? (
          <article className="manuscript-workbench-panel">
            <div className="manuscript-workbench-panel-heading">
              <div>
                <h3>工作区工具</h3>
                <p>刷新执行证据，或为当前稿件资产准备导出与后续交付。</p>
              </div>
            </div>
            <div className="manuscript-workbench-panel-body">
              {!utilities.canRefreshLatestJob ? (
                <p className="manuscript-workbench-help is-warning">
                  工作区至少生成一条任务后，才可刷新最新任务。
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

function describeMode(mode: ManuscriptWorkbenchMode): string {
  if (mode === "submission") {
    return "投稿";
  }
  if (mode === "screening") {
    return "初筛";
  }
  if (mode === "editing") {
    return "编辑";
  }

  return "校对";
}

function buildIntakeValidationMessages(input: UploadManuscriptInput): string[] {
  const messages: string[] = [];

  if (input.title.trim().length === 0) {
    messages.push("请先填写稿件标题。");
  }

  if (
    (input.fileContentBase64?.trim().length ?? 0) === 0 &&
    (input.storageKey?.trim().length ?? 0) === 0
  ) {
    messages.push("请先选择本地文件或填写存储键。");
  }

  return messages;
}

function resolveFieldClassName(isInvalid: boolean): string {
  return isInvalid
    ? "manuscript-workbench-field is-invalid"
    : "manuscript-workbench-field";
}

function resolveSelectedOption(
  action: ManuscriptWorkbenchActionPanelProps | undefined,
): WorkbenchSelectOption | undefined {
  if (!action?.selectedAssetId) {
    return undefined;
  }

  return action.options.find((option) => option.value === action.selectedAssetId);
}

function formatWorkbenchPanelTitle(title: string): string {
  switch (title) {
    case "Screening Run":
      return "初筛执行";
    case "Editing Run":
      return "编辑执行";
    case "Proofreading Draft":
      return "校对草稿生成";
    default:
      return title;
  }
}

function formatWorkbenchActionLabel(label: string): string {
  switch (label) {
    case "Run Screening":
      return "执行初筛";
    case "Run Editing":
      return "执行编辑";
    case "Create Draft":
      return "生成草稿";
    case "Finalize Proofreading":
      return "校对定稿";
    default:
      return label;
  }
}

function formatTemplateSelectionTitle(title: string): string {
  if (title === "Journal Template") {
    return "期刊模板";
  }

  return title;
}

function formatSelectionContextLabel(label: string | undefined, fallback: string): string {
  if (label === "Selected Parent Asset") {
    return "已选父资产";
  }

  if (label === "Selected Draft Asset") {
    return "已选草稿资产";
  }

  if (label === "Selected Asset") {
    return "已选资产";
  }

  return label ?? fallback;
}
