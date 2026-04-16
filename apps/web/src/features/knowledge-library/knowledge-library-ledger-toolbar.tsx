export type KnowledgeLibraryLedgerDensity = "compact" | "standard" | "relaxed";

export interface KnowledgeLibraryLedgerToolbarProps {
  totalCount: number;
  selectedCount: number;
  searchQuery: string;
  activeFilterCount: number;
  isFilterDrawerOpen: boolean;
  isColumnOrderPanelOpen: boolean;
  activeScope: "active" | "all" | "archived";
  onSearchQueryChange: (value: string) => void;
  onSearchSubmit: () => void;
  onCreate: () => void;
  onAiIntake: () => void;
  onToggleColumnOrder: () => void;
  onToggleFilters: () => void;
  onScopeChange: (scope: "active" | "all" | "archived") => void;
}

export function KnowledgeLibraryLedgerToolbar({
  totalCount,
  selectedCount,
  searchQuery,
  activeFilterCount,
  isFilterDrawerOpen,
  isColumnOrderPanelOpen,
  activeScope,
  onSearchQueryChange,
  onSearchSubmit,
  onCreate,
  onAiIntake,
  onToggleColumnOrder,
  onToggleFilters,
  onScopeChange,
}: KnowledgeLibraryLedgerToolbarProps) {
  return (
    <section className="knowledge-library-ledger-toolbar" aria-label="知识库台账工具栏">
      <div className="knowledge-library-ledger-toolbar__search">
        <label
          className="knowledge-library-ledger-toolbar__search-field"
          htmlFor="knowledge-library-inline-search"
        >
          <span>页内搜索</span>
          <input
            id="knowledge-library-inline-search"
            name="knowledge-library-inline-search"
            type="search"
            placeholder="搜索标题、简要、语义词"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </label>
        <button type="button" data-toolbar-action="search" onClick={onSearchSubmit}>
          搜索
        </button>
      </div>

      <div className="knowledge-library-ledger-toolbar__actions">
        <div className="knowledge-library-ledger-toolbar__group" aria-label="台账范围">
          <button
            type="button"
            data-toolbar-action="scope-active"
            className={activeScope === "active" ? "is-active" : undefined}
            aria-pressed={activeScope === "active"}
            onClick={() => onScopeChange("active")}
          >
            台账
          </button>
          <button
            type="button"
            data-toolbar-action="scope-all"
            className={activeScope === "all" ? "is-active" : undefined}
            aria-pressed={activeScope === "all"}
            onClick={() => onScopeChange("all")}
          >
            全部
          </button>
          <button
            type="button"
            data-toolbar-action="scope-archived"
            className={activeScope === "archived" ? "is-active" : undefined}
            aria-pressed={activeScope === "archived"}
            onClick={() => onScopeChange("archived")}
          >
            回收区
          </button>
        </div>
        <button type="button" data-toolbar-action="create" onClick={onCreate}>
          新增知识
        </button>
        <button type="button" data-toolbar-action="ai-intake" onClick={onAiIntake}>
          AI预填充
        </button>
        <button
          type="button"
          data-toolbar-action="column-order"
          aria-pressed={isColumnOrderPanelOpen}
          onClick={onToggleColumnOrder}
        >
          列顺序
        </button>
        <button
          type="button"
          data-toolbar-action="filters"
          aria-pressed={isFilterDrawerOpen}
          onClick={onToggleFilters}
        >
          筛选{activeFilterCount > 0 ? `（${activeFilterCount}）` : ""}
        </button>
      </div>

      <div className="knowledge-library-ledger-toolbar__meta">
        <span>当前共 {totalCount} 条</span>
        <span>已选 {selectedCount} 条</span>
      </div>
    </section>
  );
}
