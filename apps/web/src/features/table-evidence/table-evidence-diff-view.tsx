import type {
  ConfirmedTableSnapshot,
  TableEvidenceCellSnapshot,
  TableEvidenceParagraph,
  TableSourceSnapshot,
} from "./table-evidence-types.ts";

export interface TableEvidenceDiffViewProps {
  sourceSnapshot: TableSourceSnapshot;
  correctedSnapshot: ConfirmedTableSnapshot;
}

export function TableEvidenceDiffView({
  sourceSnapshot,
  correctedSnapshot,
}: TableEvidenceDiffViewProps) {
  const changes = compareTableEvidenceSnapshots(sourceSnapshot, correctedSnapshot);

  return (
    <section className="table-evidence-diff-view" data-diff-count={changes.length}>
      <h3>差异</h3>
      {changes.length === 0 ? (
        <p data-diff-empty="true">无差异</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>范围</th>
              <th>来源</th>
              <th>修订</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((change) => (
              <tr key={`${change.scope}-${change.before}-${change.after}`}>
                <td>{change.scope}</td>
                <td>{change.before}</td>
                <td>{change.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export interface TableEvidenceDiffChange {
  scope: string;
  before: string;
  after: string;
}

export function compareTableEvidenceSnapshots(
  sourceSnapshot: TableSourceSnapshot,
  correctedSnapshot: ConfirmedTableSnapshot,
): TableEvidenceDiffChange[] {
  const changes: TableEvidenceDiffChange[] = [];
  const correctedCells = new Map(
    correctedSnapshot.grid_cells.map((cell) => [cell.cell_id, cell] as const),
  );

  for (const sourceCell of sourceSnapshot.grid_cells) {
    const correctedCell = correctedCells.get(sourceCell.cell_id);
    if (!correctedCell) {
      changes.push({ scope: `cell ${sourceCell.cell_id}`, before: "存在", after: "缺失" });
      continue;
    }

    compareCell(sourceCell, correctedCell).forEach((change) => changes.push(change));
  }

  const sourceCaption = sourceSnapshot.caption?.text ?? "";
  const correctedCaption = correctedSnapshot.caption?.text ?? "";
  if (sourceCaption !== correctedCaption) {
    changes.push({ scope: "caption", before: sourceCaption, after: correctedCaption });
  }

  const sourceNotes = paragraphText(sourceSnapshot.notes);
  const correctedNotes = paragraphText(correctedSnapshot.notes);
  if (sourceNotes !== correctedNotes) {
    changes.push({ scope: "notes", before: sourceNotes, after: correctedNotes });
  }

  return changes;
}

function compareCell(
  sourceCell: TableEvidenceCellSnapshot,
  correctedCell: TableEvidenceCellSnapshot,
): TableEvidenceDiffChange[] {
  const changes: TableEvidenceDiffChange[] = [];
  const scope = `cell ${sourceCell.cell_id}`;

  if (sourceCell.text !== correctedCell.text) {
    changes.push({ scope: `${scope} text`, before: sourceCell.text, after: correctedCell.text });
  }

  if (sourceCell.codepoints.join(" ") !== correctedCell.codepoints.join(" ")) {
    changes.push({
      scope: `${scope} codepoints`,
      before: sourceCell.codepoints.join(" "),
      after: correctedCell.codepoints.join(" "),
    });
  }

  const sourceStructure = `${sourceCell.row}:${sourceCell.column}:${sourceCell.rowspan}:${sourceCell.colspan}`;
  const correctedStructure = `${correctedCell.row}:${correctedCell.column}:${correctedCell.rowspan}:${correctedCell.colspan}`;
  if (sourceStructure !== correctedStructure) {
    changes.push({ scope: `${scope} structure`, before: sourceStructure, after: correctedStructure });
  }

  if (sourceCell.style_summary.border_profile !== correctedCell.style_summary.border_profile) {
    changes.push({
      scope: `${scope} border`,
      before: sourceCell.style_summary.border_profile ?? "",
      after: correctedCell.style_summary.border_profile ?? "",
    });
  }

  const sourceRunStyle = JSON.stringify(sourceCell.runs.map((run) => [run.id, run.style]));
  const correctedRunStyle = JSON.stringify(correctedCell.runs.map((run) => [run.id, run.style]));
  if (sourceRunStyle !== correctedRunStyle) {
    changes.push({ scope: `${scope} run_style`, before: sourceRunStyle, after: correctedRunStyle });
  }

  return changes;
}

function paragraphText(paragraphs: TableEvidenceParagraph[]): string {
  return paragraphs.map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n");
}
