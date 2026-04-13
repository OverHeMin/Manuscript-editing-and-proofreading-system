export type KnowledgeLibraryLedgerDensity = "compact" | "standard" | "relaxed";

export interface KnowledgeLibraryLedgerToolbarProps {
  totalCount: number;
  selectedCount: number;
  density: KnowledgeLibraryLedgerDensity;
  onDensityChange: (value: KnowledgeLibraryLedgerDensity) => void;
  onAdd: () => void;
  onDelete: () => void;
  onSearch: () => void;
}

export function KnowledgeLibraryLedgerToolbar({
  totalCount,
  selectedCount,
  density,
  onDensityChange,
  onAdd,
  onDelete,
  onSearch,
}: KnowledgeLibraryLedgerToolbarProps) {
  return (
    <section className="knowledge-library-ledger-toolbar" aria-label="台账工具条">
      <div className="knowledge-library-ledger-toolbar__group">
        <button type="button" onClick={onAdd}>
          添加
        </button>
        <button type="button" onClick={onDelete} disabled={selectedCount === 0}>
          删除
        </button>
        <button type="button" onClick={onSearch}>
          查找
        </button>
      </div>

      <div className="knowledge-library-ledger-toolbar__group knowledge-library-ledger-toolbar__group--density">
        <span className="knowledge-library-ledger-toolbar__label">行距</span>
        <button
          type="button"
          className={density === "compact" ? "is-active" : ""}
          aria-pressed={density === "compact"}
          onClick={() => onDensityChange("compact")}
        >
          紧凑
        </button>
        <button
          type="button"
          className={density === "standard" ? "is-active" : ""}
          aria-pressed={density === "standard"}
          onClick={() => onDensityChange("standard")}
        >
          标准
        </button>
        <button
          type="button"
          className={density === "relaxed" ? "is-active" : ""}
          aria-pressed={density === "relaxed"}
          onClick={() => onDensityChange("relaxed")}
        >
          宽松
        </button>
      </div>

      <div className="knowledge-library-ledger-toolbar__meta">
        <span>当前共 {totalCount} 条</span>
        <span>已选 {selectedCount} 条</span>
      </div>
    </section>
  );
}
