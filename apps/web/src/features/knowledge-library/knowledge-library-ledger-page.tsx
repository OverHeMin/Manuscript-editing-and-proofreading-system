import { type FormEvent, useEffect, useState } from "react";
import { createBrowserHttpClient } from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/index.ts";
import {
  buildCreateDraftInput,
  createEmptyLedgerComposer,
  type KnowledgeLibraryLedgerComposer,
} from "./knowledge-library-ledger-composer.ts";
import {
  createKnowledgeLibraryWorkbenchController,
  type KnowledgeLibraryWorkbenchController,
} from "./knowledge-library-controller.ts";
import { KnowledgeLibraryLedgerTable } from "./knowledge-library-ledger-table.tsx";
import type {
  KnowledgeLibraryFilterState,
  KnowledgeLibraryWorkbenchViewModel,
} from "./types.ts";

if (typeof document !== "undefined") {
  void import("./knowledge-library-ledger-page.css");
}

const defaultController = createKnowledgeLibraryWorkbenchController(
  createBrowserHttpClient(),
);

type LedgerWorkspaceTab = "fields" | "semantic" | "content_blocks";

export interface KnowledgeLibraryLedgerPageProps {
  controller?: KnowledgeLibraryWorkbenchController;
  actorRole?: AuthRole;
  initialViewModel?: KnowledgeLibraryWorkbenchViewModel | null;
  initialComposer?: KnowledgeLibraryLedgerComposer | null;
  prefilledAssetId?: string;
  prefilledRevisionId?: string;
}

export function KnowledgeLibraryLedgerPage({
  controller = defaultController,
  actorRole = "knowledge_reviewer",
  initialViewModel = null,
  initialComposer = null,
  prefilledAssetId,
  prefilledRevisionId,
}: KnowledgeLibraryLedgerPageProps) {
  const [viewModel, setViewModel] = useState<KnowledgeLibraryWorkbenchViewModel | null>(
    initialViewModel,
  );
  const [composer, setComposer] = useState<KnowledgeLibraryLedgerComposer | null>(
    initialComposer,
  );
  const [workspaceTab, setWorkspaceTab] = useState<LedgerWorkspaceTab>("fields");
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">(
    initialViewModel ? "ready" : "idle",
  );
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialViewModel) {
      return;
    }

    void loadWorkbench({
      selectedAssetId: prefilledAssetId,
      selectedRevisionId: prefilledRevisionId,
    });
  }, [controller, initialViewModel, prefilledAssetId, prefilledRevisionId]);

  const selectedAssetId = composer ? null : viewModel?.selectedAssetId ?? null;
  const selectedRevision = composer ? null : viewModel?.detail?.selected_revision ?? null;

  async function loadWorkbench(input: {
    selectedAssetId?: string;
    selectedRevisionId?: string;
    filters?: Partial<KnowledgeLibraryFilterState>;
  } = {}) {
    setLoadStatus("loading");
    setErrorMessage(null);

    try {
      const nextViewModel = await controller.loadWorkbench({
        selectedAssetId: input.selectedAssetId ?? viewModel?.selectedAssetId ?? null,
        selectedRevisionId:
          input.selectedRevisionId ?? viewModel?.selectedRevisionId ?? null,
        filters: input.filters ?? viewModel?.filters,
      });
      setViewModel(nextViewModel);
      setLoadStatus("ready");
    } catch (error) {
      setLoadStatus("error");
      setErrorMessage(toErrorMessage(error, "Knowledge ledger failed to load."));
    }
  }

  async function handleSaveDraft() {
    if (!composer) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const nextViewModel = await controller.createDraftAndLoad({
        ...buildCreateDraftInput(composer),
        filters: viewModel?.filters,
      });
      setViewModel(nextViewModel);
      setComposer(null);
      setStatusMessage("Draft saved.");
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "Draft save failed."));
    } finally {
      setIsBusy(false);
    }
  }

  function handleStartNewRecord() {
    setComposer(createEmptyLedgerComposer());
    setWorkspaceTab("fields");
    setStatusMessage(null);
    setErrorMessage(null);
  }

  function handleSelectAsset(assetId: string) {
    setComposer(null);
    setWorkspaceTab("fields");
    void loadWorkbench({
      selectedAssetId: assetId,
      filters: viewModel?.filters,
    });
  }

  function updateComposer<K extends keyof KnowledgeLibraryLedgerComposer["draft"]>(
    field: K,
    value: KnowledgeLibraryLedgerComposer["draft"][K],
  ) {
    setComposer((current) =>
      current
        ? {
            ...current,
            draft: {
              ...current.draft,
              [field]: value,
            },
          }
        : current,
    );
  }

  return (
    <main className="knowledge-library-ledger-page">
      <header className="knowledge-library-ledger-page__hero">
        <div>
          <span className="knowledge-library-ledger-page__eyebrow">
            Knowledge Library
          </span>
          <h1>Knowledge Ledger</h1>
          <p>
            Sheet-first entry mode keeps the table on the left and the working draft
            on the right.
          </p>
        </div>
        <div className="knowledge-library-ledger-page__hero-meta">
          <span>Role: {actorRole}</span>
          <span>Surface: ledger</span>
          <span>State: {composer ? "local draft" : selectedAssetId ?? "browse"}</span>
        </div>
      </header>

      <section className="knowledge-library-ledger-command-bar">
        <label className="knowledge-library-ledger-command-bar__search">
          <span>Search</span>
          <input
            type="search"
            value={viewModel?.filters.searchText ?? ""}
            placeholder="Search title, summary, or semantic terms"
            readOnly
          />
        </label>
        <div className="knowledge-library-ledger-command-bar__query-mode" role="group">
          <button type="button" className="is-active">
            Keyword
          </button>
          <button type="button">Semantic</button>
        </div>
        <div className="knowledge-library-ledger-command-bar__actions">
          <button type="button" onClick={handleStartNewRecord}>
            New Record
          </button>
          <button type="button">AI Parse Intake</button>
        </div>
      </section>

      {statusMessage ? <p className="knowledge-library-ledger-status">{statusMessage}</p> : null}
      {errorMessage ? (
        <p className="knowledge-library-ledger-status is-error">{errorMessage}</p>
      ) : null}

      <div className="knowledge-library-ledger-layout">
        <KnowledgeLibraryLedgerTable
          items={viewModel?.visibleLibrary ?? []}
          selectedAssetId={selectedAssetId}
          onSelectAsset={handleSelectAsset}
        />

        <section className="knowledge-library-ledger-workspace">
          <header className="knowledge-library-ledger-workspace__header">
            <div>
              <h2>{composer ? "New Record Workspace" : "Editable Workspace"}</h2>
              <p>
                {composer
                  ? "Start locally, review the minimum fields, then save the first governed draft."
                  : "Select a row to edit fields, semantics, and rich content from one workspace."}
              </p>
            </div>
            {composer ? (
              <span className="knowledge-library-ledger-badge">Unsaved local draft</span>
            ) : selectedRevision ? (
              <span className="knowledge-library-ledger-badge is-selected">
                Revision {selectedRevision.revision_no}
              </span>
            ) : null}
          </header>

          <nav className="knowledge-library-ledger-tabs" aria-label="Workspace Tabs">
            <button
              type="button"
              className={workspaceTab === "fields" ? "is-active" : ""}
              onClick={() => setWorkspaceTab("fields")}
            >
              Fields
            </button>
            <button
              type="button"
              className={workspaceTab === "semantic" ? "is-active" : ""}
              onClick={() => setWorkspaceTab("semantic")}
            >
              Semantic
            </button>
            <button
              type="button"
              className={workspaceTab === "content_blocks" ? "is-active" : ""}
              onClick={() => setWorkspaceTab("content_blocks")}
            >
              Content Blocks
            </button>
          </nav>

          {workspaceTab === "fields" ? (
            composer ? (
              <form className="knowledge-library-ledger-fields" onSubmit={preventDefault}>
                <label>
                  <span>Title</span>
                  <input
                    type="text"
                    value={composer.draft.title}
                    onChange={(event) => updateComposer("title", event.target.value)}
                  />
                </label>
                <label>
                  <span>Canonical Text</span>
                  <textarea
                    rows={8}
                    value={composer.draft.canonicalText}
                    onChange={(event) =>
                      updateComposer("canonicalText", event.target.value)
                    }
                  />
                </label>
                <label>
                  <span>Summary</span>
                  <textarea
                    rows={4}
                    value={composer.draft.summary ?? ""}
                    onChange={(event) => updateComposer("summary", event.target.value)}
                  />
                </label>
                <div className="knowledge-library-ledger-fields__actions">
                  <button type="submit" onClick={() => void handleSaveDraft()} disabled={isBusy}>
                    Save Draft
                  </button>
                </div>
              </form>
            ) : selectedRevision ? (
              <section className="knowledge-library-ledger-fields knowledge-library-ledger-fields--readonly">
                <label>
                  <span>Title</span>
                  <input type="text" value={selectedRevision.title} readOnly />
                </label>
                <label>
                  <span>Canonical Text</span>
                  <textarea rows={8} value={selectedRevision.canonical_text} readOnly />
                </label>
                <label>
                  <span>Summary</span>
                  <textarea rows={4} value={selectedRevision.summary ?? ""} readOnly />
                </label>
              </section>
            ) : (
              <p className="knowledge-library-ledger-empty">
                Choose a row or start a new record to open the fields workspace.
              </p>
            )
          ) : workspaceTab === "semantic" ? (
            <p className="knowledge-library-ledger-empty">
              Semantic assistance lands here in the next task.
            </p>
          ) : (
            <p className="knowledge-library-ledger-empty">
              Content blocks stay in the same workspace and will be connected next.
            </p>
          )}
        </section>
      </div>

      {loadStatus === "loading" ? (
        <p className="knowledge-library-ledger-status">Loading ledger…</p>
      ) : null}
    </main>
  );
}

function preventDefault(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
}

function toErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}
