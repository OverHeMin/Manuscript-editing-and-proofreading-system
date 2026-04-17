import type {
  KnowledgeSemanticLayerInput,
  KnowledgeSemanticLayerViewModel,
  KnowledgeSemanticStatus,
} from "./types.ts";

export interface KnowledgeLibrarySemanticPanelProps {
  semanticLayer?: KnowledgeSemanticLayerViewModel;
  onChange: (next: KnowledgeSemanticLayerInput) => void;
  onRegenerate: () => void;
  onConfirm: () => void;
  isBusy?: boolean;
  actionLabels?: {
    regenerate?: string;
    confirm?: string;
  };
}

export function KnowledgeLibrarySemanticPanel({
  semanticLayer,
  onChange,
  onRegenerate,
  onConfirm,
  isBusy = false,
  actionLabels,
}: KnowledgeLibrarySemanticPanelProps) {
  const pageSummary = semanticLayer?.page_summary ?? "";
  const retrievalTerms = semanticLayer?.retrieval_terms ?? [];
  const retrievalSnippets = (semanticLayer?.retrieval_snippets ?? []).join("\n");
  const status = semanticLayer?.status ?? "not_generated";

  return (
    <section className="knowledge-library-panel knowledge-library-semantic-panel">
      <header className="knowledge-library-panel-header">
        <div>
          <h2>语义层</h2>
          <p>
            审看 AI 生成的召回表达，补充人工确认后的检索词和检索片段，再确认语义层。
          </p>
        </div>
        <span className={`knowledge-library-semantic-status is-${status}`}>
          {formatKnowledgeSemanticStatusLabel(status)}
        </span>
      </header>

      <label className="knowledge-library-block-editor">
        <span>页面摘要</span>
        <textarea
          rows={4}
          value={pageSummary}
          onChange={(event) => onChange({ pageSummary: event.target.value })}
          placeholder="概括这条知识在什么场景下应该被召回。"
        />
      </label>

      <div
        className="knowledge-library-structured-field knowledge-library-form-full"
        data-knowledge-semantic-tag-list="retrieval-terms"
      >
        <div className="knowledge-library-structured-field-header">
          <span>检索词条</span>
          <small>一行一个检索词条，可逐条补充和删除。</small>
        </div>
        <div className="knowledge-library-tag-editor-list">
          {retrievalTerms.length > 0 ? (
            retrievalTerms.map((term, index) => (
              <div
                key={`retrieval-term-${index}`}
                className="knowledge-library-tag-editor-row"
              >
                <input
                  value={term}
                  onChange={(event) =>
                    onChange({
                      retrievalTerms: updateStringListValue(
                        retrievalTerms,
                        index,
                        event.target.value,
                      ),
                    })
                  }
                  placeholder="例如：表格校对"
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      retrievalTerms: removeStringListValue(retrievalTerms, index),
                    })
                  }
                >
                  删除
                </button>
              </div>
            ))
          ) : (
            <p className="knowledge-library-structured-empty">
              暂未添加检索词条。
            </p>
          )}
        </div>
        <button
          type="button"
          className="knowledge-library-secondary-button"
          onClick={() =>
            onChange({
              retrievalTerms: [...retrievalTerms, ""],
            })
          }
        >
          添加检索词条
        </button>
      </div>

      <label className="knowledge-library-block-editor">
        <span>检索片段</span>
        <textarea
          rows={4}
          value={retrievalSnippets}
          onChange={(event) =>
            onChange({
              retrievalSnippets: splitLineSeparated(event.target.value),
            })
          }
          placeholder="每行一个检索片段"
        />
      </label>

      <div className="knowledge-library-actions">
        <button type="button" disabled={isBusy} onClick={onRegenerate}>
          {actionLabels?.regenerate ?? "重新生成语义层"}
        </button>
        <button type="button" disabled={isBusy} onClick={onConfirm}>
          {actionLabels?.confirm ?? "确认语义层"}
        </button>
      </div>
    </section>
  );
}

export function formatKnowledgeSemanticStatusLabel(
  status: KnowledgeSemanticStatus,
): string {
  switch (status) {
    case "pending_confirmation":
      return "待确认";
    case "confirmed":
      return "已确认";
    case "stale":
      return "已过期";
    case "not_generated":
    default:
      return "未生成";
  }
}

function splitLineSeparated(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function updateStringListValue(values: readonly string[], index: number, value: string): string[] {
  return values.map((currentValue, currentIndex) =>
    currentIndex === index ? value : currentValue,
  );
}

function removeStringListValue(values: readonly string[], index: number): string[] {
  return values.filter((_, currentIndex) => currentIndex !== index);
}
