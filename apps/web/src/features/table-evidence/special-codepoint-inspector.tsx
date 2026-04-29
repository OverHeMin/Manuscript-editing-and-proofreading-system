import type {
  TableEvidenceCellSnapshot,
  TableEvidenceTextRun,
} from "./table-evidence-types.ts";

export interface SpecialCodepointInspectorProps {
  cell?: TableEvidenceCellSnapshot;
}

export interface SpecialCodepointInspectionItem {
  runId?: string;
  text: string;
  codepoints: string[];
  symbolFont?: string;
  symbolChar?: string;
}

interface CodepointMetadata {
  codepoint: string;
  label: string;
  character: string;
}

const CODEPOINT_METADATA: Record<string, CodepointMetadata> = {
  "0009": { codepoint: "0009", label: "TAB", character: "\\t" },
  "000A": { codepoint: "000A", label: "LINE FEED", character: "\\n" },
  "0020": { codepoint: "0020", label: "SPACE", character: " " },
  "00A0": { codepoint: "00A0", label: "NO-BREAK SPACE", character: "\u00A0" },
  "2013": { codepoint: "2013", label: "EN DASH", character: "\u2013" },
  "2212": { codepoint: "2212", label: "MINUS SIGN", character: "\u2212" },
  "3000": { codepoint: "3000", label: "IDEOGRAPHIC SPACE", character: "\u3000" },
};

export function collectSpecialCodepoints(
  cell: TableEvidenceCellSnapshot,
): SpecialCodepointInspectionItem[] {
  const runItems = cell.runs.flatMap((run) => inspectRun(run));
  if (runItems.length > 0) {
    return runItems;
  }

  const specialCellCodepoints = cell.codepoints.filter(isInspectableCodepoint);
  return specialCellCodepoints.length > 0
    ? [
        {
          text: cell.text,
          codepoints: specialCellCodepoints,
        },
      ]
    : [];
}

export function SpecialCodepointInspector({ cell }: SpecialCodepointInspectorProps) {
  if (!cell) {
    return null;
  }

  const items = collectSpecialCodepoints(cell);
  if (items.length === 0) {
    return null;
  }

  return (
    <dl className="table-evidence-codepoint-inspector" data-cell-id={cell.cell_id}>
      {items.map((item, index) => (
        <div
          className="table-evidence-codepoint-item"
          data-run-id={item.runId}
          key={`${item.runId ?? "cell"}-${index}`}
        >
          <dt>{item.symbolChar ?? item.text}</dt>
          <dd data-codepoints={item.codepoints.join(" ")}>
            {item.codepoints.map(formatCodepointLabel).join(", ")}
            {item.runId ? ` run ${item.runId}` : ""}
            {item.symbolFont ? ` ${item.symbolFont}` : ""}
            {item.symbolChar ? ` symbol ${item.symbolChar}` : ""}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function inspectRun(run: TableEvidenceTextRun): SpecialCodepointInspectionItem[] {
  const specialCodepoints = run.codepoints.filter(isInspectableCodepoint);
  if (run.kind !== "symbol" && specialCodepoints.length === 0 && !run.symbol_font) {
    return [];
  }

  return [
    {
      runId: run.id,
      text: run.text,
      codepoints: specialCodepoints.length > 0 ? specialCodepoints : [...run.codepoints],
      symbolFont: run.symbol_font,
      symbolChar: run.symbol_char,
    },
  ];
}

function isInspectableCodepoint(codepoint: string): boolean {
  const value = Number.parseInt(codepoint, 16);
  return (
    CODEPOINT_METADATA[normalizeCodepoint(codepoint)] !== undefined ||
    (Number.isFinite(value) && (value > 0x7e || value < 0x20))
  );
}

function formatCodepointLabel(codepoint: string): string {
  const normalized = normalizeCodepoint(codepoint);
  const metadata = CODEPOINT_METADATA[normalized] ?? {
    codepoint: normalized,
    label: "SPECIAL CODEPOINT",
    character: codepointCharacter(normalized),
  };

  return `U+${metadata.codepoint} ${metadata.label} ${metadata.character}`;
}

function normalizeCodepoint(codepoint: string): string {
  return codepoint.toUpperCase().padStart(4, "0");
}

function codepointCharacter(codepoint: string): string {
  const value = Number.parseInt(codepoint, 16);
  return Number.isFinite(value) ? String.fromCodePoint(value) : "";
}
