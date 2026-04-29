import { useMemo, useState } from "react";
import { SpecialCodepointInspector } from "./special-codepoint-inspector.tsx";
import { TableEvidenceCellEditor } from "./table-evidence-cell-editor.tsx";
import { TableEvidenceDiffView } from "./table-evidence-diff-view.tsx";
import { TableEvidenceFidelityPanel } from "./table-evidence-fidelity-panel.tsx";
import { TableEvidenceFormatPanel } from "./table-evidence-format-panel.tsx";
import { applyTableEvidencePatch } from "./table-evidence-patch.ts";
import { TableEvidenceRenderer } from "./table-evidence-renderer.tsx";
import { TableEvidenceRunToolbar } from "./table-evidence-run-toolbar.tsx";
import { TableEvidenceStructureToolbar } from "./table-evidence-structure-toolbar.tsx";
import type {
  ConfirmedTableSnapshot,
  TableCorrectionOperation,
  TableCorrectionPatch,
  TableEvidenceAsset,
  TableEvidenceBindingRole,
  TableEvidenceBindingTargetType,
  TableEvidenceCellSnapshot,
  TableEvidenceRevision,
  TableFidelityReport,
  TableSourceSnapshot,
} from "./table-evidence-types.ts";

export type TableEvidenceWorkspaceViewMode = "source" | "corrected" | "diff";

export interface TableEvidenceWorkspaceProps {
  asset: TableEvidenceAsset;
  revision: TableEvidenceRevision;
  onSavePatch: (patch: TableCorrectionPatch) => Promise<TableEvidenceRevision>;
  onConfirm: (input: {
    revisionId: string;
    invisibleCharsConfirmed: boolean;
    specialSymbolsConfirmed: boolean;
  }) => Promise<void>;
  onBind: (input: {
    revisionId: string;
    targetType: TableEvidenceBindingTargetType;
    targetId: string;
    bindingRole: TableEvidenceBindingRole;
  }) => Promise<void>;
}

export function TableEvidenceWorkspace({
  asset,
  revision,
  onSavePatch,
  onConfirm,
  onBind,
}: TableEvidenceWorkspaceProps) {
  const [viewMode, setViewMode] = useState<TableEvidenceWorkspaceViewMode>("source");
  const [showInvisibleCharacters, setShowInvisibleCharacters] = useState(false);
  const [selectedCellId, setSelectedCellId] = useState(
    revision.source_snapshot.grid_cells[0]?.cell_id,
  );
  const [localPatch, setLocalPatch] = useState<TableCorrectionPatch>(revision.correction_patch);
  const [invisibleCharsConfirmed, setInvisibleCharsConfirmed] = useState(
    revision.fidelity_report.invisible_chars_confirmed,
  );
  const [specialSymbolsConfirmed, setSpecialSymbolsConfirmed] = useState(
    revision.fidelity_report.special_symbols_confirmed,
  );
  const [bindingTargetId, setBindingTargetId] = useState("");

  const correctedPreview = useMemo(
    () =>
      buildCorrectedSnapshotPreview({
        sourceSnapshot: revision.source_snapshot,
        correctionPatch: localPatch,
        fallback: revision.confirmed_snapshot,
      }),
    [revision.source_snapshot, revision.confirmed_snapshot, localPatch],
  );
  const correctedSnapshot = correctedPreview.snapshot;
  const activeSnapshot = viewMode === "source" ? revision.source_snapshot : correctedSnapshot;
  const selectedCell = correctedSnapshot.grid_cells.find((cell) => cell.cell_id === selectedCellId);
  const confirmDisabled = isConfirmDisabled(
    {
      report: revision.fidelity_report,
      invisibleCharsConfirmed,
      specialSymbolsConfirmed,
      patchError: correctedPreview.patchError,
    },
  );
  const saveDisabled = correctedPreview.patchError !== undefined;

  function appendOperation(operation: TableCorrectionOperation) {
    setLocalPatch((patch) => appendTableEvidenceOperation(patch, operation));
  }

  function setConfirmation(kind: "invisible_chars" | "special_symbols", checked: boolean) {
    if (kind === "invisible_chars") {
      setInvisibleCharsConfirmed(checked);
      if (checked) {
        appendOperation(buildConfirmInvisibleCharsOperation(revision.source_snapshot));
      }
      return;
    }

    setSpecialSymbolsConfirmed(checked);
    if (checked) {
      appendOperation(buildConfirmSpecialSymbolsOperation(revision.source_snapshot));
    }
  }

  async function handleConfirm() {
    if (confirmDisabled) {
      return;
    }
    await confirmTableEvidenceWorkspaceRevision({
      patch: localPatch,
      invisibleCharsConfirmed,
      specialSymbolsConfirmed,
      onSavePatch,
      onConfirm,
    });
  }

  async function handleBind() {
    if (!bindingTargetId.trim()) {
      return;
    }
    await onBind({
      revisionId: revision.id,
      targetType: "knowledge_revision",
      targetId: bindingTargetId.trim(),
      bindingRole: "source_evidence",
    });
  }

  return (
    <section
      className="table-evidence-workspace"
      data-asset-id={asset.id}
      data-revision-id={revision.id}
      data-view-mode={viewMode}
    >
      <style>{TABLE_EVIDENCE_WORKSPACE_STYLE}</style>
      <header className="table-evidence-workspace-header">
        <div>
          <h2>{asset.title}</h2>
          <p>{asset.source_file_name}</p>
        </div>
        <div className="table-evidence-segmented-control" role="group" aria-label="视图">
          {(["source", "corrected", "diff"] as const).map((mode) => (
            <button
              aria-pressed={viewMode === mode}
              data-view-mode-option={mode}
              key={mode}
              onClick={() => setViewMode(mode)}
              type="button"
            >
              {resolveViewModeLabel(mode)}
            </button>
          ))}
        </div>
      </header>

      <section className="table-evidence-workspace-controls">
        <label>
          <input
            checked={showInvisibleCharacters}
            data-toggle="invisible-characters"
            onChange={(event) => setShowInvisibleCharacters(event.currentTarget.checked)}
            type="checkbox"
          />
          显示不可见字符
        </label>
        <button
          data-save-disabled={saveDisabled ? "true" : "false"}
          disabled={saveDisabled}
          onClick={() => void onSavePatch(localPatch)}
          type="button"
        >
          保存修订
        </button>
        <button
          data-confirm-disabled={confirmDisabled ? "true" : "false"}
          disabled={confirmDisabled}
          onClick={() => void handleConfirm()}
          type="button"
        >
          确认表格证据
        </button>
      </section>
      {correctedPreview.patchError ? (
        <section
          className="table-evidence-panel table-evidence-patch-error"
          data-patch-error="true"
          role="alert"
        >
          <h3>修订补丁错误</h3>
          <p>{correctedPreview.patchError}</p>
        </section>
      ) : null}

      <div className="table-evidence-workspace-grid">
        <main className="table-evidence-main-pane">
          <TableEvidenceRunToolbar cell={selectedCell} onOperation={appendOperation} />
          <TableEvidenceStructureToolbar cell={selectedCell} />
          {viewMode === "diff" ? (
            <TableEvidenceDiffView
              correctedSnapshot={correctedSnapshot}
              sourceSnapshot={revision.source_snapshot}
            />
          ) : (
            <TableEvidenceRenderer
              onSelectCell={setSelectedCellId}
              selectedCellId={selectedCellId}
              showInvisibleCharacters={showInvisibleCharacters}
              snapshot={activeSnapshot}
            />
          )}
        </main>
        <aside className="table-evidence-side-pane">
          <TableEvidenceCellEditor cell={selectedCell} onOperation={appendOperation} />
          <SpecialCodepointInspector cell={selectedCell} />
          <TableEvidenceFormatPanel
            caption={correctedSnapshot.caption}
            cell={selectedCell}
            notes={correctedSnapshot.notes}
            onOperation={appendOperation}
          />
          <TableEvidenceFidelityPanel
            confirmationStatus={revision.confirmation_status}
            invisibleCharsConfirmed={invisibleCharsConfirmed}
            onInvisibleCharsConfirmedChange={(checked) =>
              setConfirmation("invisible_chars", checked)
            }
            onSpecialSymbolsConfirmedChange={(checked) =>
              setConfirmation("special_symbols", checked)
            }
            report={revision.fidelity_report}
            specialSymbolsConfirmed={specialSymbolsConfirmed}
          />
          <section className="table-evidence-panel table-evidence-binding-panel">
            <h3>绑定</h3>
            <label>
              知识版本 ID
              <input
                data-binding-target-id="true"
                onChange={(event) => setBindingTargetId(event.currentTarget.value)}
                value={bindingTargetId}
              />
            </label>
            <button type="button" onClick={() => void handleBind()}>
              绑定证据
            </button>
          </section>
        </aside>
      </div>
    </section>
  );
}

export async function confirmTableEvidenceWorkspaceRevision(input: {
  patch: TableCorrectionPatch;
  invisibleCharsConfirmed: boolean;
  specialSymbolsConfirmed: boolean;
  onSavePatch: (patch: TableCorrectionPatch) => Promise<TableEvidenceRevision>;
  onConfirm: (input: {
    revisionId: string;
    invisibleCharsConfirmed: boolean;
    specialSymbolsConfirmed: boolean;
  }) => Promise<void>;
}): Promise<void> {
  const savedRevision = await input.onSavePatch(input.patch);
  await input.onConfirm({
    revisionId: savedRevision.id,
    invisibleCharsConfirmed: input.invisibleCharsConfirmed,
    specialSymbolsConfirmed: input.specialSymbolsConfirmed,
  });
}

export function buildCorrectedSnapshot(input: {
  sourceSnapshot: TableSourceSnapshot;
  correctionPatch: TableCorrectionPatch;
  fallback?: ConfirmedTableSnapshot;
}): ConfirmedTableSnapshot {
  return applyTableEvidencePatch({
    sourceSnapshot: input.sourceSnapshot,
    patch: input.correctionPatch,
  });
}

export interface TableEvidenceCorrectedSnapshotPreview {
  snapshot: ConfirmedTableSnapshot;
  patchError?: string;
}

export function buildCorrectedSnapshotPreview(input: {
  sourceSnapshot: TableSourceSnapshot;
  correctionPatch: TableCorrectionPatch;
  fallback?: ConfirmedTableSnapshot;
}): TableEvidenceCorrectedSnapshotPreview {
  try {
    return {
      snapshot: applyTableEvidencePatch({
        sourceSnapshot: input.sourceSnapshot,
        patch: input.correctionPatch,
      }),
    };
  } catch (error) {
    return {
      snapshot:
        input.fallback ?? {
          snapshot_id: `${input.sourceSnapshot.snapshot_id}:corrected-error-fallback`,
          source_snapshot_id: input.sourceSnapshot.snapshot_id,
          row_count: input.sourceSnapshot.row_count,
          column_count: input.sourceSnapshot.column_count,
          caption: input.sourceSnapshot.caption,
          notes: input.sourceSnapshot.notes,
          grid_cells: input.sourceSnapshot.grid_cells,
        },
      patchError: getPatchErrorMessage(error),
    };
  }
}

export function appendTableEvidenceOperation(
  patch: TableCorrectionPatch,
  operation: TableCorrectionOperation,
): TableCorrectionPatch {
  if (operation.op !== "replace_run_text") {
    return {
      ...patch,
      operations: [...patch.operations, operation],
    };
  }

  const operationIndex = patch.operations.findIndex(
    (entry) =>
      entry.op === "replace_run_text" &&
      entry.cell_id === operation.cell_id &&
      entry.paragraph_id === operation.paragraph_id &&
      entry.run_id === operation.run_id,
  );

  if (operationIndex === -1) {
    return {
      ...patch,
      operations: [...patch.operations, operation],
    };
  }

  const existingOperation = patch.operations[operationIndex];
  if (existingOperation?.op !== "replace_run_text") {
    return {
      ...patch,
      operations: [...patch.operations, operation],
    };
  }

  const mergedOperation: TableCorrectionOperation = {
    ...operation,
    before_text: existingOperation.before_text,
  };

  if (mergedOperation.after_text === mergedOperation.before_text) {
    return {
      ...patch,
      operations: patch.operations.filter((_, index) => index !== operationIndex),
    };
  }

  return {
    ...patch,
    operations: patch.operations.map((entry, index) =>
      index === operationIndex ? mergedOperation : entry,
    ),
  };
}

function isConfirmDisabled(input: {
  report: TableFidelityReport;
  invisibleCharsConfirmed: boolean;
  specialSymbolsConfirmed: boolean;
  patchError?: string;
}): boolean {
  if (
    input.patchError ||
    input.report.failure_codes.length > 0 ||
    input.report.unsupported_fact_groups.length > 0
  ) {
    return true;
  }

  const missingRequiredConfirmation =
    (input.report.required_confirmations.includes("invisible_chars") &&
      !input.invisibleCharsConfirmed) ||
    (input.report.required_confirmations.includes("special_symbols") &&
      !input.specialSymbolsConfirmed);
  if (missingRequiredConfirmation) {
    return true;
  }

  return (
    input.report.status === "needs_review" &&
    input.report.required_confirmations.length === 0
  );
}

function getPatchErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "补丁无法应用";
}

function buildConfirmInvisibleCharsOperation(
  snapshot: TableSourceSnapshot,
): TableCorrectionOperation {
  return {
    op: "confirm_invisible_chars",
    cell_ids: snapshot.grid_cells.map((cell) => cell.cell_id),
    confirmed_invisible_char_ids: snapshot.grid_cells.flatMap((cell) =>
      cell.invisible_chars.map((entry) => entry.id),
    ),
  };
}

function buildConfirmSpecialSymbolsOperation(snapshot: TableSourceSnapshot): TableCorrectionOperation {
  return {
    op: "confirm_special_symbols",
    cell_ids: snapshot.grid_cells.map((cell) => cell.cell_id),
    confirmed_symbol_run_ids: snapshot.grid_cells.flatMap((cell) =>
      cell.runs.filter(isSpecialSymbolRun).map((run) => run.id),
    ),
  };
}

function isSpecialSymbolRun(cellRun: TableEvidenceCellSnapshot["runs"][number]): boolean {
  return (
    cellRun.kind === "symbol" ||
    cellRun.codepoints.some((codepoint) => {
      const value = Number.parseInt(codepoint, 16);
      return Number.isFinite(value) && (value > 0x7e || value < 0x20);
    })
  );
}

function resolveViewModeLabel(mode: TableEvidenceWorkspaceViewMode): string {
  if (mode === "source") {
    return "来源";
  }
  if (mode === "corrected") {
    return "修订";
  }
  return "差异";
}

const TABLE_EVIDENCE_WORKSPACE_STYLE = `
.table-evidence-workspace {
  display: grid;
  gap: 12px;
}

.table-evidence-workspace-header,
.table-evidence-workspace-controls,
.table-evidence-toolbar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.table-evidence-workspace-header {
  justify-content: space-between;
}

.table-evidence-workspace-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr) 320px;
}

.table-evidence-main-pane,
.table-evidence-side-pane {
  min-width: 0;
}

.table-evidence-side-pane {
  display: grid;
  gap: 10px;
}

.table-evidence-panel {
  border: 1px solid #d6d9df;
  border-radius: 6px;
  padding: 10px;
}

.table-evidence-panel h3 {
  font-size: 14px;
  margin: 0 0 8px;
}

.table-evidence-panel label {
  display: grid;
  gap: 4px;
  margin-bottom: 8px;
}

.table-evidence-panel input,
.table-evidence-panel textarea {
  box-sizing: border-box;
  width: 100%;
}

@media (max-width: 900px) {
  .table-evidence-workspace-grid {
    grid-template-columns: 1fr;
  }
}
`;
