import type { KnowledgeLibraryAiIntakeSuggestionViewModel } from "./types.ts";

export interface KnowledgeLibraryAiIntakePanelProps {
  sourceText: string;
  onSourceTextChange: (value: string) => void;
  suggestion?: KnowledgeLibraryAiIntakeSuggestionViewModel | null;
  onGenerateSuggestion?: () => void;
  onApplySuggestion?: () => void;
  isBusy?: boolean;
}

export function KnowledgeLibraryAiIntakePanel({
  sourceText,
  onSourceTextChange,
  suggestion = null,
  onGenerateSuggestion,
  onApplySuggestion,
  isBusy = false,
}: KnowledgeLibraryAiIntakePanelProps) {
  return (
    <section className="knowledge-library-ledger-panel">
      <header className="knowledge-library-ledger-panel__header">
        <div>
          <h2>AI Parse Intake</h2>
          <p>Paste source text, review the parsed draft, then decide whether to apply it.</p>
        </div>
      </header>

      <label className="knowledge-library-ledger-panel__field">
        <span>Paste source text</span>
        <textarea
          rows={6}
          value={sourceText}
          onChange={(event) => onSourceTextChange(event.target.value)}
        />
      </label>

      {onGenerateSuggestion ? (
        <div className="knowledge-library-ledger-panel__actions">
          <button
            type="button"
            onClick={onGenerateSuggestion}
            disabled={isBusy || sourceText.trim().length === 0}
          >
            Parse Intake
          </button>
        </div>
      ) : null}

      {suggestion ? (
        <section className="knowledge-library-ledger-panel__suggestion">
          <h3>Suggested draft</h3>
          <p>{suggestion.suggestedDraft.title}</p>
          {suggestion.warnings.length > 0 ? (
            <div>
              <h4>Warnings</h4>
              <ul>
                {suggestion.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {onApplySuggestion ? (
            <button type="button" onClick={onApplySuggestion}>
              Apply Suggested Draft
            </button>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
