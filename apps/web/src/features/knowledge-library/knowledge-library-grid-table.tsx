import type { KnowledgeLibrarySummaryViewModel } from "./types.ts";

export interface KnowledgeLibraryGridTableProps {
  items: readonly KnowledgeLibrarySummaryViewModel[];
  selectedAssetId: string | null;
  onSelectAsset: (assetId: string) => void;
}

export function KnowledgeLibraryGridTable({
  items,
  selectedAssetId,
  onSelectAsset,
}: KnowledgeLibraryGridTableProps) {
  return (
    <section className="knowledge-library-panel knowledge-library-grid-panel">
      <header className="knowledge-library-panel-header">
        <div>
          <h2>Ledger Grid</h2>
          <p>Rows stay compact so larger knowledge volumes remain browsable.</p>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="knowledge-library-empty">
          No knowledge records match the current summary query.
        </p>
      ) : null}

      <div className="knowledge-library-grid-table" role="table" aria-label="Knowledge ledger">
        <div className="knowledge-library-grid-row knowledge-library-grid-row-head" role="row">
          <span role="columnheader">Knowledge</span>
          <span role="columnheader">Summary</span>
          <span role="columnheader">Module</span>
          <span role="columnheader">Asset Preview</span>
          <span role="columnheader">AI Semantic Status</span>
        </div>

        {items.map((item) => {
          const isActive = item.id === selectedAssetId;
          return (
            <button
              key={item.id}
              type="button"
              role="row"
              className={`knowledge-library-grid-row knowledge-library-grid-row-button${isActive ? " is-active" : ""}`}
              onClick={() => onSelectAsset(item.id)}
            >
              <span role="cell" className="knowledge-library-grid-cell-main">
                <strong>{item.title}</strong>
                <small>
                  {item.status} · {item.knowledge_kind}
                </small>
              </span>
              <span role="cell">{item.summary ?? "No summary yet"}</span>
              <span role="cell">
                <strong>{item.module_scope}</strong>
                <small>{formatManuscriptTypes(item.manuscript_types)}</small>
              </span>
              <span role="cell">
                <strong>{item.content_block_count} blocks</strong>
                <small>{item.selected_revision_id ?? "No revision selected"}</small>
              </span>
              <span role="cell">
                <strong>{item.semantic_status ?? "not_generated"}</strong>
                <small>{item.updated_at ?? "No timestamp"}</small>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function formatManuscriptTypes(
  manuscriptTypes: KnowledgeLibrarySummaryViewModel["manuscript_types"],
): string {
  if (manuscriptTypes === "any") {
    return "Any manuscript";
  }

  return manuscriptTypes.join(", ");
}
