import type { KnowledgeContentBlockViewModel } from "./types.ts";

export interface KnowledgeLibraryBlockTableEditorProps {
  block: KnowledgeContentBlockViewModel;
  onChange: (nextBlock: KnowledgeContentBlockViewModel) => void;
}

export function KnowledgeLibraryBlockTableEditor({
  block,
  onChange,
}: KnowledgeLibraryBlockTableEditorProps) {
  const rows = Array.isArray(block.content_payload.rows)
    ? (block.content_payload.rows as unknown[][])
    : [];
  const value = rows
    .map((row) =>
      Array.isArray(row)
        ? row
            .map((cell) => (typeof cell === "string" ? cell : String(cell ?? "")))
            .join("\t")
        : "",
    )
    .join("\n");

  return (
    <label className="knowledge-library-block-editor">
      <span>Table Data</span>
      <textarea
        rows={6}
        value={value}
        onChange={(event) =>
          onChange({
            ...block,
            content_payload: {
              ...block.content_payload,
              rows: parseTableRows(event.target.value),
            },
          })
        }
        placeholder="Paste TSV data here"
      />
    </label>
  );
}

function parseTableRows(value: string): string[][] {
  return value
    .split(/\r?\n/)
    .filter((row) => row.trim().length > 0)
    .map((row) => row.split("\t").map((cell) => cell.trim()));
}
