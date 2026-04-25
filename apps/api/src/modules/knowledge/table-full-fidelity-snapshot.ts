import type {
  DocumentStructureTableCellStyleEvidence,
  DocumentStructureTableGridCell,
  DocumentStructureTableSnapshot,
  DocumentStructureTableStyleFact,
  DocumentStructureObjectEvidence,
} from "../document-pipeline/document-structure-service.ts";
import type {
  TableEvidenceFactAuthority,
  TableEvidenceMandatoryFactGroup,
  TableFullFidelitySnapshotRecord,
} from "./knowledge-record.ts";

const mandatoryFactGroups: TableEvidenceMandatoryFactGroup[] = [
  "identity",
  "structure",
  "border_system",
  "layout",
  "paragraph_style",
  "typography",
  "rich_content",
  "object_content",
  "authority_markers",
];

export function buildTableFullFidelitySnapshotFromDocumentTable(
  table: DocumentStructureTableSnapshot,
): TableFullFidelitySnapshotRecord {
  const mandatoryFactAuthority: Record<
    TableEvidenceMandatoryFactGroup,
    TableEvidenceFactAuthority
  > = {
    identity:
      table.caption_fields || table.table_label || table.table_title
        ? "authoritative"
        : "unavailable",
    structure:
      typeof table.row_count === "number" &&
      typeof table.column_count === "number" &&
      Array.isArray(table.grid_cells)
        ? "authoritative"
        : "unavailable",
    border_system: table.style_profile ? "authoritative" : "unavailable",
    layout: summarizeLayoutAuthority(table.grid_cells ?? []),
    paragraph_style: summarizeParagraphStyleAuthority(table.grid_cells ?? []),
    typography: summarizeTypographyAuthority(table.grid_cells ?? []),
    rich_content: summarizeRichContentAuthority(table.grid_cells ?? []),
    object_content: summarizeObjectContentAuthority(table.grid_cells ?? []),
    authority_markers: "authoritative",
  };

  return {
    snapshot_id: `${table.table_id}-full-fidelity`,
    mandatory_fact_authority: mandatoryFactAuthority,
    facts: {
      table_id: table.table_id,
      identity: {
        label_text: table.table_label?.text ?? table.caption_fields?.label_text,
        title_text: table.table_title?.text ?? table.caption_fields?.title_text,
        caption_text: table.caption_fields?.text,
        note_text: table.note_zone?.text,
        caption_position: table.caption_fields ? "above" : undefined,
        note_position: table.note_zone ? "below" : undefined,
      },
      structure: {
        row_count: table.row_count,
        column_count: table.column_count,
        header_depth: table.profile.header_depth,
        has_stub_column: table.profile.has_stub_column,
        has_merged_headers: table.profile.has_merged_headers,
        merged_relations: table.merged_relations ?? [],
        grid_cells: table.grid_cells ?? [],
      },
      border_system: table.style_profile,
      layout: {
        cell_style_evidence: collectCellStyleEvidence(table.grid_cells ?? []),
      },
      paragraph_style: {
        paragraphs: (table.grid_cells ?? []).flatMap((cell) => cell.paragraphs),
      },
      typography: {
        fragments: (table.grid_cells ?? []).flatMap((cell) =>
          cell.paragraphs.flatMap((paragraph) => paragraph.fragments),
        ),
      },
      rich_content: {
        unit_markers: table.unit_markers ?? [],
        footnote_items: table.footnote_items,
      },
      object_content: {
        table_internal_objects: collectTableInternalObjects(table.grid_cells ?? []),
      },
      authority_markers: mandatoryFactGroups.map((group) => ({
        group,
        authority: mandatoryFactAuthority[group],
      })),
    },
  };
}

function summarizeObjectContentAuthority(
  cells: readonly DocumentStructureTableGridCell[],
): TableEvidenceFactAuthority {
  if (cells.length === 0) {
    return "unavailable";
  }
  return "authoritative";
}

function summarizeLayoutAuthority(
  cells: readonly DocumentStructureTableGridCell[],
): TableEvidenceFactAuthority {
  if (cells.length === 0) {
    return "unavailable";
  }
  return summarizeFacts(
    cells.flatMap((cell) => [
      cell.style_evidence.alignment,
      cell.style_evidence.vertical_alignment,
    ]),
  );
}

function summarizeParagraphStyleAuthority(
  cells: readonly DocumentStructureTableGridCell[],
): TableEvidenceFactAuthority {
  const facts = cells.flatMap((cell) =>
    cell.paragraphs.flatMap((paragraph) => [
      paragraph.style.alignment,
      paragraph.style.spacing_before_pt,
      paragraph.style.spacing_after_pt,
      paragraph.style.line_spacing,
      paragraph.style.line_spacing_mode,
      paragraph.style.left_indent_pt,
      paragraph.style.right_indent_pt,
      paragraph.style.first_line_indent_pt,
      paragraph.style.hanging_indent_pt,
    ]),
  );
  return summarizeFacts(facts);
}

function summarizeTypographyAuthority(
  cells: readonly DocumentStructureTableGridCell[],
): TableEvidenceFactAuthority {
  return summarizeFacts(
    cells.flatMap((cell) => [
      cell.style_evidence.font_family,
      cell.style_evidence.font_size_pt,
      cell.style_evidence.bold,
      cell.style_evidence.italic,
      cell.style_evidence.script_position,
    ]),
  );
}

function summarizeRichContentAuthority(
  cells: readonly DocumentStructureTableGridCell[],
): TableEvidenceFactAuthority {
  if (cells.length === 0) {
    return "unavailable";
  }
  return cells.some((cell) =>
    cell.paragraphs.some((paragraph) => paragraph.fragments.length > 0),
  )
    ? "authoritative"
    : "mixed";
}

function summarizeFacts(
  facts: readonly DocumentStructureTableStyleFact<unknown>[],
): TableEvidenceFactAuthority {
  if (facts.length === 0) {
    return "unavailable";
  }
  if (facts.some((fact) => fact.availability === "unavailable")) {
    return "mixed";
  }
  if (facts.some((fact) => fact.availability === "mixed")) {
    return "mixed";
  }
  return "authoritative";
}

function collectCellStyleEvidence(
  cells: readonly DocumentStructureTableGridCell[],
): DocumentStructureTableCellStyleEvidence[] {
  return cells.map((cell) => cell.style_evidence);
}

function collectTableInternalObjects(
  cells: readonly DocumentStructureTableGridCell[],
): Array<DocumentStructureObjectEvidence & { cell_id: string }> {
  return cells.flatMap((cell) =>
    (cell.object_evidence ?? []).map((objectEvidence) => ({
      ...objectEvidence,
      cell_id: cell.id,
    })),
  );
}
