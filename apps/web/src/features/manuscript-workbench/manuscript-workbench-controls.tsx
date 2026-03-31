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
  onSelect(value: string): void;
  onRun(): void;
}

export interface ManuscriptWorkbenchUtilitiesPanelProps {
  canExport: boolean;
  canRefreshLatestJob: boolean;
  onExport(): void;
  onRefreshLatestJob(): void;
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
              <label className="manuscript-workbench-field">
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
              <label className="manuscript-workbench-field">
                <span>Storage Key</span>
                <input
                  value={intake.uploadForm.storageKey ?? ""}
                  placeholder="Optional when a local file is selected"
                  onChange={(event) => intake.onStorageKeyChange(event.target.value)}
                />
              </label>
              <label className="manuscript-workbench-field">
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
            <label className="manuscript-workbench-field">
              <span>Manuscript ID</span>
              <input
                value={lookup.manuscriptId}
                onChange={(event) => lookup.onChange(event.target.value)}
              />
            </label>
            <div className="manuscript-workbench-button-row">
              <button type="button" disabled={busy} onClick={() => lookup.onLoad()}>
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
              <label className="manuscript-workbench-field">
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
              <div className="manuscript-workbench-button-row">
                <button
                  type="button"
                  disabled={busy || moduleAction.selectedAssetId.length === 0}
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
              <label className="manuscript-workbench-field">
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
              <div className="manuscript-workbench-button-row">
                <button
                  type="button"
                  disabled={busy || finalizeAction.selectedAssetId.length === 0}
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
              <div className="manuscript-workbench-button-row">
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
