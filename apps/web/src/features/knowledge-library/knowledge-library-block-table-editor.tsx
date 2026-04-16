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
    <div className="knowledge-library-block-editor knowledge-library-block-table-editor">
      <label className="knowledge-library-rich-content-editor__field">
        <span>表格内容（支持直接粘贴 Excel / WPS）</span>
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
          placeholder="直接粘贴表格内容，列之间用 Tab 分隔，换行会自动变成下一行"
        />
      </label>
      <p className="knowledge-library-block-editor__hint">
        如果来自 Excel 或 WPS，直接复制整块表格后粘贴到这里就可以。
      </p>
    </div>
  );
}

function parseTableRows(value: string): string[][] {
  return value
    .split(/\r?\n/)
    .filter((row) => row.trim().length > 0)
    .map((row) => row.split("\t").map((cell) => cell.trim()));
}
