import { createHash } from "node:crypto";
import type {
  ConfirmedAiTablePackage,
  ConfirmedTableSnapshot,
  TableEvidenceAsset,
  TableEvidenceRevision,
  TableFidelityReport,
  TableSourceSnapshot,
} from "./table-evidence-record.ts";

export function buildConfirmedAiTablePackage(input: {
  packageId: string;
  asset: TableEvidenceAsset;
  revision: TableEvidenceRevision;
  sourceSnapshot: TableSourceSnapshot;
  confirmedSnapshot: ConfirmedTableSnapshot;
  fidelityReport: TableFidelityReport;
}): ConfirmedAiTablePackage {
  const authority =
    input.revision.confirmation_status === "confirmed"
      ? "authoritative"
      : "review_required";
  const basePackage: ConfirmedAiTablePackage = {
    package_id: input.packageId,
    asset_id: input.asset.id,
    revision_id: input.revision.id,
    revision_no: input.revision.revision_no,
    source_file_asset_id: input.asset.source_file_asset_id,
    authority,
    confirmation_status: input.revision.confirmation_status,
    fidelity_status: input.fidelityReport.status,
    confirmed_by_human: input.revision.confirmation_status === "confirmed",
    ...(input.revision.confirmed_by ? { confirmed_by: input.revision.confirmed_by } : {}),
    ...(input.revision.confirmed_at ? { confirmed_at: input.revision.confirmed_at } : {}),
    parser: input.asset.parser,
    parser_version: input.asset.parser_version,
    source_snapshot_hash: hashJson(input.sourceSnapshot),
    confirmed_snapshot_hash: hashJson(input.confirmedSnapshot),
    ai_table_package_hash: "",
    ...(input.confirmedSnapshot.caption
      ? { caption: structuredClone(input.confirmedSnapshot.caption) }
      : {}),
    notes: structuredClone(input.confirmedSnapshot.notes),
    structure: {
      row_count: input.confirmedSnapshot.row_count,
      column_count: input.confirmedSnapshot.column_count,
      header_depth: inferHeaderDepth(input.confirmedSnapshot),
      merged_cells: input.confirmedSnapshot.grid_cells
        .filter((cell) => cell.rowspan > 1 || cell.colspan > 1)
        .map((cell) => ({
          cell_id: cell.cell_id,
          row: cell.row,
          column: cell.column,
          rowspan: cell.rowspan,
          colspan: cell.colspan,
        })),
    },
    cells: structuredClone(input.confirmedSnapshot.grid_cells),
    fidelity_report: structuredClone(input.fidelityReport),
  };

  return {
    ...basePackage,
    ai_table_package_hash: hashJson(basePackage),
  };
}

export function hashJson(value: unknown): string {
  return createHash("sha256").update(stableSerialize(value)).digest("hex");
}

function inferHeaderDepth(snapshot: ConfirmedTableSnapshot): number {
  const headerRows = snapshot.grid_cells
    .filter((cell) => cell.role === "header")
    .map((cell) => cell.row + cell.rowspan);
  return headerRows.length ? Math.max(...headerRows) : 0;
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`)
    .join(",")}}`;
}
