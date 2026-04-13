import type { KnowledgeLibrarySemanticAssistSuggestionViewModel } from "./types.ts";

export interface KnowledgeLibrarySemanticAssistantPanelProps {
  instructionText: string;
  onInstructionTextChange: (value: string) => void;
  suggestion?: KnowledgeLibrarySemanticAssistSuggestionViewModel | null;
  onApplySuggestion?: () => void;
  onDiscardSuggestion?: () => void;
}

export function KnowledgeLibrarySemanticAssistantPanel({
  instructionText,
  onInstructionTextChange,
  suggestion = null,
  onApplySuggestion,
  onDiscardSuggestion,
}: KnowledgeLibrarySemanticAssistantPanelProps) {
  return (
    <section className="knowledge-library-ledger-panel">
      <header className="knowledge-library-ledger-panel__header">
        <div>
          <h2>Semantic Assistant</h2>
          <p>Describe how this record should be rephrased for retrieval and semantic recall.</p>
        </div>
      </header>

      <label className="knowledge-library-ledger-panel__field">
        <span>Semantic instruction</span>
        <textarea
          rows={4}
          value={instructionText}
          onChange={(event) => onInstructionTextChange(event.target.value)}
        />
      </label>

      {suggestion ? (
        <section className="knowledge-library-ledger-panel__suggestion">
          <h3>Suggested semantic patch</h3>
          <p>{suggestion.suggestedSemanticLayer.pageSummary}</p>
          <div className="knowledge-library-ledger-panel__actions">
            {onApplySuggestion ? (
              <button type="button" onClick={onApplySuggestion}>
                Apply Suggestion
              </button>
            ) : null}
            {onDiscardSuggestion ? (
              <button type="button" onClick={onDiscardSuggestion}>
                Discard Suggestion
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </section>
  );
}
