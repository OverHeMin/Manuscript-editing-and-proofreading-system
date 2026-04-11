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
          <h2>AI Understanding</h2>
          <p>
            This layer is user-editable. Confirmed semantic fields become the preferred
            retrieval surface for downstream AI modules.
          </p>
        </div>
        <span className={`knowledge-library-semantic-status is-${status}`}>
          {formatKnowledgeSemanticStatusLabel(status)}
        </span>
      </header>

      <label className="knowledge-library-block-editor">
        <span>Page Summary</span>
        <textarea
          rows={4}
          value={pageSummary}
          onChange={(event) => onChange({ pageSummary: event.target.value })}
          placeholder="Summarize when this knowledge should be retrieved"
        />
      </label>

      <label className="knowledge-library-block-editor">
        <span>Retrieval Terms</span>
        <input
          value={retrievalTerms}
          onChange={(event) =>
            onChange({
              retrievalTerms: splitCommaSeparated(event.target.value),
            })
          }
          placeholder="Comma-separated semantic retrieval terms"
        />
      </label>

      <label className="knowledge-library-block-editor">
        <span>Retrieval Snippets</span>
        <textarea
          rows={4}
          value={retrievalSnippets}
          onChange={(event) =>
            onChange({
              retrievalSnippets: splitLineSeparated(event.target.value),
            })
          }
          placeholder="One retrieval snippet per line"
        />
      </label>

      <div className="knowledge-library-actions">
        <button type="button" disabled={isBusy} onClick={onRegenerate}>
          Regenerate Semantics
        </button>
        <button type="button" disabled={isBusy} onClick={onConfirm}>
          Confirm Semantic Layer
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
      return "Pending Confirmation";
    case "confirmed":
      return "Confirmed";
    case "stale":
      return "Stale";
    case "not_generated":
    default:
      return "Not Generated";
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
