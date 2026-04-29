import type {
  TableCorrectionOperation,
  TableEvidenceCaption,
  TableEvidenceCellSnapshot,
  TableEvidenceParagraph,
} from "./table-evidence-types.ts";

export interface TableEvidenceFormatPanelProps {
  cell?: TableEvidenceCellSnapshot;
  caption?: TableEvidenceCaption;
  notes: TableEvidenceParagraph[];
  onOperation: (operation: TableCorrectionOperation) => void;
}

export function TableEvidenceFormatPanel({
  cell,
  caption,
  notes,
  onOperation,
}: TableEvidenceFormatPanelProps) {
  function setBorder(borderProfile: string, threeLineRole?: string) {
    if (!cell) {
      return;
    }

    onOperation({
      op: "set_cell_borders",
      cell_id: cell.cell_id,
      border_profile: borderProfile,
      border_payload: {
        source: "table-evidence-workspace",
        three_line_role: threeLineRole ?? cell.style_summary.three_line_role ?? "none",
      },
    });
  }

  function setAlignment(horizontalAlignment?: string, verticalAlignment?: string) {
    if (!cell) {
      return;
    }

    onOperation({
      op: "set_cell_alignment",
      cell_id: cell.cell_id,
      horizontal_alignment: horizontalAlignment,
      vertical_alignment: verticalAlignment,
    });
  }

  function replaceCaption(text: string) {
    onOperation({
      op: "replace_caption",
      caption: {
        text,
        label_text: caption?.label_text,
        title_text: caption?.title_text,
        runs: caption?.runs ?? [],
      },
    });
  }

  function replaceNotes(text: string) {
    onOperation({
      op: "replace_notes",
      notes: [
        {
          id: notes[0]?.id ?? "note-1",
          paragraph_boundary_after: false,
          runs: [
            {
              id: `${notes[0]?.id ?? "note-1"}-run-1`,
              kind: "text",
              text,
              codepoints: codepointsForText(text),
              style: {},
              invisible_chars: [],
            },
          ],
        },
      ],
    });
  }

  return (
    <section className="table-evidence-panel table-evidence-format-panel">
      <h3>格式</h3>
      <div className="table-evidence-control-row" aria-label="边框">
        <button type="button" disabled={!cell} onClick={() => setBorder("none")}>
          无边框
        </button>
        <button type="button" disabled={!cell} onClick={() => setBorder("thin_grid")}>
          细网格
        </button>
        <button
          type="button"
          disabled={!cell}
          onClick={() => setBorder("three_line_table", "top_rule")}
        >
          三线表顶线
        </button>
      </div>
      <div className="table-evidence-control-row" aria-label="对齐">
        <button type="button" disabled={!cell} onClick={() => setAlignment("left")}>
          左
        </button>
        <button type="button" disabled={!cell} onClick={() => setAlignment("center")}>
          中
        </button>
        <button type="button" disabled={!cell} onClick={() => setAlignment("right")}>
          右
        </button>
        <button type="button" disabled={!cell} onClick={() => setAlignment(undefined, "middle")}>
          垂直居中
        </button>
      </div>
      <label>
        表题
        <input
          data-format-field="caption"
          defaultValue={caption?.text ?? ""}
          onBlur={(event) => replaceCaption(event.currentTarget.value)}
        />
      </label>
      <label>
        注释
        <textarea
          data-format-field="notes"
          defaultValue={notes.map((note) => note.runs.map((run) => run.text).join("")).join("\n")}
          onBlur={(event) => replaceNotes(event.currentTarget.value)}
          rows={3}
        />
      </label>
    </section>
  );
}

function codepointsForText(text: string): string[] {
  return [...text].map((character) =>
    character.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0") ?? "",
  );
}
