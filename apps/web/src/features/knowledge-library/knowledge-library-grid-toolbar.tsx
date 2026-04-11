import type { KnowledgeLibraryQueryMode } from "./types.ts";

export interface KnowledgeLibraryGridToolbarProps {
  searchText: string;
  queryMode: KnowledgeLibraryQueryMode;
  resultCount: number;
  onSearchTextChange: (value: string) => void;
  onQueryModeChange: (value: KnowledgeLibraryQueryMode) => void;
  onStartNewAsset: () => void;
}

export function KnowledgeLibraryGridToolbar({
  searchText,
  queryMode,
  resultCount,
  onSearchTextChange,
  onQueryModeChange,
  onStartNewAsset,
}: KnowledgeLibraryGridToolbarProps) {
  return (
    <section className="knowledge-library-panel knowledge-library-grid-toolbar">
      <header className="knowledge-library-panel-header knowledge-library-grid-toolbar-header">
        <div>
          <h2>Knowledge Summary</h2>
          <p>
            Search inside the summary ledger, switch between keyword and confirmed
            semantic retrieval, then open a record drawer for detail editing.
          </p>
        </div>
        <button type="button" onClick={onStartNewAsset}>
          Start New Asset
        </button>
      </header>

      <div className="knowledge-library-grid-toolbar-controls">
        <label className="knowledge-library-grid-search">
          <span>Search knowledge</span>
          <input
            type="search"
            value={searchText}
            onChange={(event) => onSearchTextChange(event.target.value)}
            placeholder="Title, summary, or confirmed semantic term"
          />
        </label>

        <div className="knowledge-library-query-mode" role="group" aria-label="Query mode">
          <button
            type="button"
            className={queryMode === "keyword" ? "is-active" : ""}
            aria-pressed={queryMode === "keyword"}
            onClick={() => onQueryModeChange("keyword")}
          >
            Keyword Search
          </button>
          <button
            type="button"
            className={queryMode === "semantic" ? "is-active" : ""}
            aria-pressed={queryMode === "semantic"}
            onClick={() => onQueryModeChange("semantic")}
          >
            Semantic Search
          </button>
        </div>
      </div>

      <p className="knowledge-library-grid-toolbar-meta">
        {resultCount} record{resultCount === 1 ? "" : "s"} in the current summary view.
      </p>
    </section>
  );
}
