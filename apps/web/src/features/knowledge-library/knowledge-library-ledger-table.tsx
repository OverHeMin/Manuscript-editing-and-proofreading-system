import type { KnowledgeLibrarySummaryViewModel } from "./types.ts";

export interface KnowledgeLibraryLedgerTableProps {
  items: readonly KnowledgeLibrarySummaryViewModel[];
  selectedAssetId: string | null;
  onSelectAsset: (assetId: string) => void;
}

export function KnowledgeLibraryLedgerTable({
  items,
  selectedAssetId,
  onSelectAsset,
}: KnowledgeLibraryLedgerTableProps) {
  return (
    <section className="knowledge-library-ledger-table">
      <header className="knowledge-library-ledger-table__header">
        <div>
          <h2>Ledger</h2>
          <p>Browse the knowledge base like a sheet before opening the workspace.</p>
        </div>
        <span>{items.length} rows</span>
      </header>

      <div className="knowledge-library-ledger-table__grid" role="table" aria-label="Knowledge Ledger Table">
        <div className="knowledge-library-ledger-table__row knowledge-library-ledger-table__row--head" role="row">
          <span role="columnheader">Title</span>
          <span role="columnheader">Summary</span>
          <span role="columnheader">Kind</span>
          <span role="columnheader">Semantic</span>
        </div>

        {items.length === 0 ? (
          <p className="knowledge-library-ledger-table__empty">
            No knowledge records match the current ledger view.
          </p>
        ) : null}

        {items.map((item) => {
          const isActive = item.id === selectedAssetId;
          return (
            <button
              key={item.id}
              type="button"
              role="row"
              className={`knowledge-library-ledger-table__row${isActive ? " is-active" : ""}`}
              onClick={() => onSelectAsset(item.id)}
            >
              <span role="cell">
                <strong>{item.title}</strong>
              </span>
              <span role="cell">{item.summary ?? "No summary yet"}</span>
              <span role="cell">{item.knowledge_kind}</span>
              <span role="cell">{item.semantic_status ?? "not_generated"}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
