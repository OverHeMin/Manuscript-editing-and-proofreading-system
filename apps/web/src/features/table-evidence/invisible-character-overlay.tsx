import type { TableEvidenceInvisibleChar } from "./table-evidence-types.ts";

export const INVISIBLE_MARKS = {
  space: "\u00B7",
  leading_space: "\u00B7",
  trailing_space: "\u00B7",
  consecutive_space: "\u00B7\u00B7",
  full_width_space: "\u25A1",
  nbsp: "NBSP",
  tab: "\u2192",
  line_break: "\u21B5",
  paragraph_boundary: "\u00B6",
} as const;

export interface InvisibleCharacterOverlayProps {
  invisibleChars: readonly TableEvidenceInvisibleChar[];
}

export function InvisibleCharacterOverlay({
  invisibleChars,
}: InvisibleCharacterOverlayProps) {
  if (invisibleChars.length === 0) {
    return null;
  }

  return (
    <span className="table-evidence-invisible-overlay" data-overlay="invisible-characters">
      {invisibleChars.map((entry) => (
        <span
          key={entry.id}
          aria-hidden="true"
          className={`table-evidence-invisible-mark invisible-${entry.kind}`}
          data-codepoint={entry.codepoint}
          data-kind={entry.kind}
          data-mark={INVISIBLE_MARKS[entry.kind]}
          data-offset={entry.offset}
        />
      ))}
    </span>
  );
}
