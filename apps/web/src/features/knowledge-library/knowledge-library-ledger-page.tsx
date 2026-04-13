import type { AuthRole } from "../auth/index.ts";

export interface KnowledgeLibraryLedgerPageProps {
  actorRole?: AuthRole;
  prefilledAssetId?: string;
  prefilledRevisionId?: string;
}

export function KnowledgeLibraryLedgerPage({
  actorRole = "knowledge_reviewer",
  prefilledAssetId,
  prefilledRevisionId,
}: KnowledgeLibraryLedgerPageProps) {
  return (
    <main className="knowledge-library-ledger-page">
      <header className="knowledge-library-ledger-page__hero">
        <span className="knowledge-library-ledger-page__eyebrow">Knowledge Library</span>
        <h1>Knowledge Ledger</h1>
        <p>
          Sheet-first ledger mode is enabled for rapid entry and review-first AI
          assistance.
        </p>
      </header>
      <dl className="knowledge-library-ledger-page__meta">
        <div>
          <dt>Role</dt>
          <dd>{actorRole}</dd>
        </div>
        <div>
          <dt>Asset</dt>
          <dd>{prefilledAssetId ?? "none"}</dd>
        </div>
        <div>
          <dt>Revision</dt>
          <dd>{prefilledRevisionId ?? "none"}</dd>
        </div>
      </dl>
    </main>
  );
}
