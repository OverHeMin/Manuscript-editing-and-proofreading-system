import type { ReactNode } from "react";
import type { KnowledgeAssetDetailViewModel } from "./types.ts";

export interface KnowledgeLibraryRecordDrawerProps {
  detail: KnowledgeAssetDetailViewModel | null;
  selectedAssetId: string | null;
  selectedRevisionId: string | null;
  reviewHash?: string | null;
  onSelectRevision: (revisionId: string) => void;
  children?: ReactNode;
}

export function KnowledgeLibraryRecordDrawer({
  detail,
  selectedAssetId,
  selectedRevisionId,
  reviewHash = null,
  onSelectRevision,
  children,
}: KnowledgeLibraryRecordDrawerProps) {
  const selectedRevision = detail?.selected_revision ?? null;
  const approvedRevision = detail?.current_approved_revision ?? null;

  return (
    <aside className="knowledge-library-panel knowledge-library-record-drawer">
      <header className="knowledge-library-panel-header">
        <div>
          <h2>Record Drawer</h2>
          <p>Keep the ledger visible while inspecting one governed knowledge record.</p>
        </div>
        {reviewHash ? (
          <a className="knowledge-library-link" href={reviewHash}>
            Open Review Queue
          </a>
        ) : null}
      </header>

      {detail == null || selectedRevision == null ? (
        <p className="knowledge-library-empty">
          Select a knowledge row to open the record drawer.
        </p>
      ) : (
        <>
          <div className="knowledge-library-editor-meta">
            <span>
              Current Asset: <strong>{selectedAssetId ?? "New draft"}</strong>
            </span>
            <span>
              Current Revision: <strong>{selectedRevisionId ?? "Not selected"}</strong>
            </span>
            <span>
              Approved Revision: <strong>{approvedRevision?.id ?? "None yet"}</strong>
            </span>
          </div>

          <section className="knowledge-library-drawer-section">
            <header className="knowledge-library-panel-header">
              <div>
                <h3>Revision Timeline</h3>
                <p>Jump between revisions without leaving the summary grid.</p>
              </div>
            </header>

            <ol className="knowledge-library-revision-list">
              {detail.revisions.map((revision) => {
                const isActive = revision.id === selectedRevisionId;

                return (
                  <li key={revision.id}>
                    <button
                      type="button"
                      className={`knowledge-library-revision-item${isActive ? " is-active" : ""}`}
                      onClick={() => onSelectRevision(revision.id)}
                    >
                      <strong>{revision.title}</strong>
                      <span>{revision.id}</span>
                      <small>
                        Revision {revision.revision_no} · {revision.status}
                      </small>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>

          {children}
        </>
      )}
    </aside>
  );
}
