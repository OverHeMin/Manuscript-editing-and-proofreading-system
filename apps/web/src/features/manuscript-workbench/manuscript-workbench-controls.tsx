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
  moduleAction?: ManuscriptWorkbenchActionPanelProps;
  finalizeAction?: ManuscriptWorkbenchActionPanelProps;
  utilities?: ManuscriptWorkbenchUtilitiesPanelProps;
}

export function ManuscriptWorkbenchControls({
  mode,
  busy,
  intake,
  lookup,
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

  return (
    <section className="manuscript-workbench-controls">
      <div className="manuscript-workbench-controls-grid">
        {intake ? (
          <article className="manuscript-workbench-panel">
            <div className="manuscript-workbench-panel-heading">
              <div>
                <h3>Submission Intake</h3>
                <p>
                  Upload a local manuscript file or keep using a precomputed storage key.
                </p>
              </div>
            </div>
            <div className="manuscript-workbench-panel-body">
              <label
                className={resolveFieldClassName(intake.uploadForm.title.trim().length === 0)}
              >
                <span>Title</span>
                <input
                  value={intake.uploadForm.title}
                  onChange={(event) => intake.onTitleChange(event.target.value)}
                />
              </label>
              <label className="manuscript-workbench-field">
                <span>Manuscript Type</span>
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
                <span>Storage Key</span>
                <input
                  value={intake.uploadForm.storageKey ?? ""}
                  placeholder="Optional when a local file is selected"
                  onChange={(event) => intake.onStorageKeyChange(event.target.value)}
                />
              </label>
              <label className={resolveFieldClassName(requiresUploadPayload)}>
                <span>Manuscript File</span>
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
                  ? `Selected local file: ${intake.uploadForm.fileName}`
                  : "No local file selected. Enter a storage key to keep using metadata-only uploads."}
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
                  {busy ? "Working..." : "Upload Manuscript"}
                </button>
              </div>
            </div>
          </article>
        ) : null}

        <article className="manuscript-workbench-panel">
          <div className="manuscript-workbench-panel-heading">
            <div>
              <h3>Workspace Lookup</h3>
              <p>
                Load a manuscript workspace by ID before running {describeMode(mode)} operations.
              </p>
            </div>
          </div>
          <div className="manuscript-workbench-panel-body">
            <label className={resolveFieldClassName(!canLoadWorkspace)}>
              <span>Manuscript ID</span>
              <input
                value={lookup.manuscriptId}
                onChange={(event) => lookup.onChange(event.target.value)}
              />
            </label>
            {!canLoadWorkspace ? (
              <p className="manuscript-workbench-help is-warning">
                Enter a manuscript ID before loading the workspace.
              </p>
            ) : null}
            <div className="manuscript-workbench-button-row">
              <button
                type="button"
                disabled={busy || !canLoadWorkspace}
                onClick={() => lookup.onLoad()}
              >
                Load Workspace
              </button>
            </div>
          </div>
        </article>

        {moduleAction ? (
          <article className="manuscript-workbench-panel">
            <div className="manuscript-workbench-panel-heading">
              <div>
                <h3>{moduleAction.title}</h3>
                <p>Select the current upstream asset that should feed this module run.</p>
              </div>
            </div>
            <div className="manuscript-workbench-panel-body">
              <label className={resolveFieldClassName(!canRunModule)}>
                <span>Parent Asset</span>
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
                  <span>{moduleAction.selectedContextLabel ?? "Selected Asset"}</span>
                  <strong>{selectedModuleOption.label}</strong>
                </div>
              ) : null}
              {!canRunModule ? (
                <p className="manuscript-workbench-help is-warning">
                  Select a parent asset before starting this module run.
                </p>
              ) : null}
              <div className="manuscript-workbench-button-row">
                <button
                  type="button"
                  disabled={busy || !canRunModule}
                  onClick={() => moduleAction.onRun()}
                >
                  {busy ? "Working..." : moduleAction.actionLabel}
                </button>
              </div>
            </div>
          </article>
        ) : null}

        {finalizeAction ? (
          <article className="manuscript-workbench-panel">
            <div className="manuscript-workbench-panel-heading">
              <div>
                <h3>{finalizeAction.actionLabel}</h3>
                <p>Pin the proofreading draft that should become the human-confirmed final file.</p>
              </div>
            </div>
            <div className="manuscript-workbench-panel-body">
              <label className={resolveFieldClassName(!canFinalizeProofreading)}>
                <span>Draft Asset</span>
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
                  <span>{finalizeAction.selectedContextLabel ?? "Selected Asset"}</span>
                  <strong>{selectedFinalizeOption.label}</strong>
                </div>
              ) : null}
              {!canFinalizeProofreading ? (
                <p className="manuscript-workbench-help is-warning">
                  Select a proofreading draft before finalizing.
                </p>
              ) : null}
              <div className="manuscript-workbench-button-row">
                <button
                  type="button"
                  disabled={busy || !canFinalizeProofreading}
                  onClick={() => finalizeAction.onRun()}
                >
                  {busy ? "Working..." : finalizeAction.actionLabel}
                </button>
              </div>
            </div>
          </article>
        ) : null}

        {utilities ? (
          <article className="manuscript-workbench-panel">
            <div className="manuscript-workbench-panel-heading">
              <div>
                <h3>Workspace Utilities</h3>
                <p>Refresh execution evidence or prepare the current manuscript asset for export.</p>
              </div>
            </div>
            <div className="manuscript-workbench-panel-body">
              {!utilities.canRefreshLatestJob ? (
                <p className="manuscript-workbench-help is-warning">
                  Refresh becomes available after the workspace creates at least one job.
                </p>
              ) : null}
              <div className="manuscript-workbench-button-row">
                {utilities.canPublishHumanFinal && utilities.onPublishHumanFinal ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => utilities.onPublishHumanFinal?.()}
                  >
                    Publish Human Final
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy || !utilities.canExport}
                  onClick={() => utilities.onExport()}
                >
                  Export Current Asset
                </button>
                <button
                  type="button"
                  disabled={busy || !utilities.canRefreshLatestJob}
                  onClick={() => utilities.onRefreshLatestJob()}
                >
                  Refresh Latest Job
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
    return "submission";
  }
  if (mode === "screening") {
    return "screening";
  }
  if (mode === "editing") {
    return "editing";
  }

  return "proofreading";
}

function buildIntakeValidationMessages(input: UploadManuscriptInput): string[] {
  const messages: string[] = [];

  if (input.title.trim().length === 0) {
    messages.push("Add a manuscript title before upload.");
  }

  if (
    (input.fileContentBase64?.trim().length ?? 0) === 0 &&
    (input.storageKey?.trim().length ?? 0) === 0
  ) {
    messages.push("Choose a local file or enter a storage key before upload.");
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
