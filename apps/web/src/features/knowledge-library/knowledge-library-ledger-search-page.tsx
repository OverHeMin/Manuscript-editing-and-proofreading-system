import type { ReactNode } from "react";
import type { KnowledgeLibraryQueryMode } from "./types.ts";

export interface KnowledgeLibraryLedgerSearchPageProps {
  query: string;
  queryMode: KnowledgeLibraryQueryMode;
  resultCount: number;
  onQueryChange: (value: string) => void;
  onQueryModeChange: (value: KnowledgeLibraryQueryMode) => void;
  onRunSearch: () => void;
  onBack: () => void;
  children: ReactNode;
}

export function KnowledgeLibraryLedgerSearchPage({
  query,
  queryMode,
  resultCount,
  onQueryChange,
  onQueryModeChange,
  onRunSearch,
  onBack,
  children,
}: KnowledgeLibraryLedgerSearchPageProps) {
  return (
    <section className="knowledge-library-ledger-search" aria-label="知识查找结果">
      <header className="knowledge-library-ledger-search__header">
        <div>
          <p className="knowledge-library-ledger-search__eyebrow">搜索结果</p>
          <h2>搜索结果</h2>
          <p>基础文本与 AI 语义层会一起参与查找，结果仍保持表格视图。</p>
        </div>

        <button type="button" onClick={onBack}>
          返回台账
        </button>
      </header>

      <div className="knowledge-library-ledger-search__controls">
        <label>
          <span>查找内容</span>
          <input
            type="search"
            value={query}
            placeholder="输入标题、答案、语义摘要或检索词"
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>

        <div
          className="knowledge-library-ledger-search__modes"
          role="group"
          aria-label="查找模式"
        >
          <button
            type="button"
            className={queryMode === "keyword" ? "is-active" : ""}
            aria-pressed={queryMode === "keyword"}
            onClick={() => onQueryModeChange("keyword")}
          >
            关键词
          </button>
          <button
            type="button"
            className={queryMode === "semantic" ? "is-active" : ""}
            aria-pressed={queryMode === "semantic"}
            onClick={() => onQueryModeChange("semantic")}
          >
            语义
          </button>
        </div>

        <button type="button" onClick={onRunSearch}>
          执行查找
        </button>
      </div>

      <p className="knowledge-library-ledger-search__meta">命中 {resultCount} 条记录</p>

      {children}
    </section>
  );
}
