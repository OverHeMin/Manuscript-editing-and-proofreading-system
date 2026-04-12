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
}

export function KnowledgeLibrarySemanticPanel({
  semanticLayer,
  onChange,
  onRegenerate,
  onConfirm,
  isBusy = false,
}: KnowledgeLibrarySemanticPanelProps) {
  const pageSummary = semanticLayer?.page_summary ?? "";
  const retrievalTerms = (semanticLayer?.retrieval_terms ?? []).join(", ");
  const retrievalSnippets = (semanticLayer?.retrieval_snippets ?? []).join("\n");
  const status = semanticLayer?.status ?? "not_generated";

  return (
    <section className="knowledge-library-panel knowledge-library-semantic-panel">
      <header className="knowledge-library-panel-header">
        <div>
          <h2>语义层</h2>
          <p>
            这里是 AI 读取到的语义层。你可以直接修订摘要、检索词和检索片段，再决定是否确认。
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
          placeholder="概括这条知识应在什么场景下被 AI 优先检索"
        />
      </label>

      <label className="knowledge-library-block-editor">
        <span>检索词</span>
        <input
          value={retrievalTerms}
          onChange={(event) =>
            onChange({
              retrievalTerms: splitCommaSeparated(event.target.value),
            })
          }
          placeholder="用逗号分隔可触发检索的语义词"
        />
      </label>

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
          重算语义层
        </button>
        <button type="button" disabled={isBusy} onClick={onConfirm}>
          确认语义层
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
      return "待刷新";
    case "not_generated":
    default:
      return "未生成";
  }
}

function splitCommaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function splitLineSeparated(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
