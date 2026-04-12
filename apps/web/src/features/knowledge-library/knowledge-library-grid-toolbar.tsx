import type { KnowledgeLibraryQueryMode } from "./types.ts";

export interface KnowledgeLibraryGridToolbarProps {
  searchText: string;
  queryMode: KnowledgeLibraryQueryMode;
  resultCount: number;
  selectedAssetLabel?: string | null;
  onSearchTextChange: (value: string) => void;
  onQueryModeChange: (value: KnowledgeLibraryQueryMode) => void;
  onStartNewAsset: () => void;
}

export function KnowledgeLibraryGridToolbar({
  searchText,
  queryMode,
  resultCount,
  selectedAssetLabel = null,
  onSearchTextChange,
  onQueryModeChange,
  onStartNewAsset,
}: KnowledgeLibraryGridToolbarProps) {
  return (
    <section className="knowledge-library-panel knowledge-library-grid-toolbar">
      <header className="knowledge-library-panel-header knowledge-library-grid-toolbar-header">
        <div>
          <h2>知识搜索</h2>
          <p>
            先搜再看表，再从右侧抽屉补充文字、图片、表格与语义层，保持录入节奏简单顺手。
          </p>
        </div>
        <button type="button" onClick={onStartNewAsset}>
          新建知识
        </button>
      </header>

      <div className="knowledge-library-grid-toolbar-controls">
        <label className="knowledge-library-grid-search">
          <span>知识搜索</span>
          <input
            type="search"
            value={searchText}
            onChange={(event) => onSearchTextChange(event.target.value)}
            placeholder="搜索标题、摘要或确认后的语义词"
          />
        </label>

        <div className="knowledge-library-query-mode" role="group" aria-label="检索模式">
          <button
            type="button"
            className={queryMode === "keyword" ? "is-active" : ""}
            aria-pressed={queryMode === "keyword"}
            onClick={() => onQueryModeChange("keyword")}
          >
            关键词检索
          </button>
          <button
            type="button"
            className={queryMode === "semantic" ? "is-active" : ""}
            aria-pressed={queryMode === "semantic"}
            onClick={() => onQueryModeChange("semantic")}
          >
            语义检索
          </button>
        </div>
      </div>

      <div className="knowledge-library-grid-toolbar-meta">
        <p>当前视图共 {resultCount} 条记录。</p>
        <p>当前打开：{selectedAssetLabel && selectedAssetLabel.length > 0 ? selectedAssetLabel : "新建草稿"}</p>
      </div>
    </section>
  );
}
