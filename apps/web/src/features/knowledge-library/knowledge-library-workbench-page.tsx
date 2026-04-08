import { useEffect, useState } from "react";
import { formatWorkbenchHash } from "../../app/workbench-routing.ts";
import { WorkbenchCoreStrip } from "../../app/workbench-core-strip.tsx";
import { createBrowserHttpClient } from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/index.ts";
import type { KnowledgeItemStatus, KnowledgeKind } from "../knowledge/index.ts";
import type { ManuscriptModule, ManuscriptType } from "../manuscripts/types.ts";
import {
  createKnowledgeLibraryWorkbenchController,
  type KnowledgeLibraryWorkbenchController,
} from "./knowledge-library-controller.ts";
import type {
  CreateKnowledgeLibraryDraftInput,
  KnowledgeLibraryFilterState,
  KnowledgeLibraryWorkbenchViewModel,
  KnowledgeRevisionBindingInput,
  KnowledgeRevisionBindingKind,
  UpdateKnowledgeLibraryDraftInput,
} from "./types.ts";
import "./knowledge-library-workbench.css";

export interface KnowledgeLibraryWorkbenchPageProps {
  controller?: KnowledgeLibraryWorkbenchController;
  actorRole?: AuthRole;
  initialViewModel?: KnowledgeLibraryWorkbenchViewModel | null;
  prefilledAssetId?: string;
  prefilledRevisionId?: string;
}

interface KnowledgeLibraryFormState {
  title: string;
  canonicalText: string;
  summary: string;
  knowledgeKind: KnowledgeKind;
  moduleScope: ManuscriptModule | "any";
  manuscriptTypes: string;
  sections: string;
  riskTags: string;
  disciplineTags: string;
  aliases: string;
  evidenceLevel: string;
  sourceType: string;
  sourceLink: string;
  effectiveAt: string;
  expiresAt: string;
  bindingsText: string;
}

const defaultController = createKnowledgeLibraryWorkbenchController(
  createBrowserHttpClient(),
);

const knowledgeKinds: Array<KnowledgeKind | "all"> = [
  "all",
  "rule",
  "case_pattern",
  "checklist",
  "prompt_snippet",
  "reference",
  "other",
];

const knowledgeStatuses: Array<KnowledgeItemStatus | "all"> = [
  "all",
  "draft",
  "pending_review",
  "approved",
  "superseded",
  "archived",
];

const moduleOptions: Array<ManuscriptModule | "any"> = [
  "any",
  "screening",
  "editing",
  "proofreading",
  "manual",
  "learning",
];

const defaultFormState: KnowledgeLibraryFormState = {
  title: "",
  canonicalText: "",
  summary: "",
  knowledgeKind: "rule",
  moduleScope: "any",
  manuscriptTypes: "any",
  sections: "",
  riskTags: "",
  disciplineTags: "",
  aliases: "",
  evidenceLevel: "unknown",
  sourceType: "other",
  sourceLink: "",
  effectiveAt: "",
  expiresAt: "",
  bindingsText: "",
};

export function KnowledgeLibraryWorkbenchPage({
  controller = defaultController,
  actorRole = "knowledge_reviewer",
  initialViewModel = null,
  prefilledAssetId,
  prefilledRevisionId,
}: KnowledgeLibraryWorkbenchPageProps) {
  const [viewModel, setViewModel] = useState<KnowledgeLibraryWorkbenchViewModel | null>(
    initialViewModel,
  );
  const [formState, setFormState] = useState<KnowledgeLibraryFormState>(() =>
    toFormState(initialViewModel?.detail ?? null),
  );
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">(
    initialViewModel ? "ready" : "idle",
  );
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const normalizedPrefilledAssetId = prefilledAssetId?.trim() ?? "";
  const normalizedPrefilledRevisionId = prefilledRevisionId?.trim() ?? "";

  useEffect(() => {
    if (initialViewModel) {
      setViewModel(initialViewModel);
      setFormState(toFormState(initialViewModel.detail));
      setLoadStatus("ready");
      return;
    }

    void loadWorkbench({
      selectedAssetId:
        normalizedPrefilledAssetId.length > 0 ? normalizedPrefilledAssetId : undefined,
      selectedRevisionId:
        normalizedPrefilledRevisionId.length > 0 ? normalizedPrefilledRevisionId : undefined,
    });
  }, [controller, initialViewModel, normalizedPrefilledAssetId, normalizedPrefilledRevisionId]);

  useEffect(() => {
    setFormState(toFormState(viewModel?.detail ?? null));
  }, [viewModel?.selectedRevisionId]);

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
        selectedRevisionId: input.selectedRevisionId ?? viewModel?.selectedRevisionId ?? null,
        filters: input.filters ?? viewModel?.filters,
      });
      setViewModel(nextViewModel);
      setLoadStatus("ready");
      setStatusMessage(null);
    } catch (error) {
      setLoadStatus("error");
      setErrorMessage(toErrorMessage(error, "Knowledge library load failed"));
    }
  }

  async function runMutation(
    action: () => Promise<KnowledgeLibraryWorkbenchViewModel>,
    successMessage: string,
  ) {
    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const nextViewModel = await action();
      setViewModel(nextViewModel);
      setLoadStatus("ready");
      setStatusMessage(successMessage);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "Knowledge library action failed"));
    } finally {
      setIsBusy(false);
    }
  }

  function updateFilters(nextFilters: Partial<KnowledgeLibraryFilterState>) {
    void loadWorkbench({
      filters: {
        ...(viewModel?.filters ?? {}),
        ...nextFilters,
      },
      selectedAssetId: viewModel?.selectedAssetId ?? undefined,
      selectedRevisionId: viewModel?.selectedRevisionId ?? undefined,
    });
  }

  function handleSelectAsset(assetId: string) {
    void loadWorkbench({
      selectedAssetId: assetId,
      filters: viewModel?.filters,
    });
  }

  function handleSelectRevision(revisionId: string) {
    if (!viewModel?.selectedAssetId) {
      return;
    }

    void loadWorkbench({
      selectedAssetId: viewModel.selectedAssetId,
      selectedRevisionId: revisionId,
      filters: viewModel.filters,
    });
  }

  function handleStartNewAsset() {
    setViewModel((current) =>
      current == null
        ? current
        : {
            ...current,
            selectedAssetId: null,
            selectedRevisionId: null,
            selectedSummary: null,
            detail: null,
          },
    );
    setFormState(defaultFormState);
    setStatusMessage("Draft form cleared for a new knowledge asset.");
    setErrorMessage(null);
  }

  async function handleCreateDraft() {
    await runMutation(
      () =>
        controller.createDraftAndLoad({
          ...toCreateInput(formState),
          filters: viewModel?.filters,
        }),
      "Knowledge asset draft created.",
    );
  }

  async function handleSaveDraft() {
    const revisionId = viewModel?.selectedRevisionId;
    if (!revisionId || !viewModel) {
      return;
    }

    await runMutation(
      () =>
        controller.saveDraftAndLoad({
          revisionId,
          input: toUpdateInput(formState),
          filters: viewModel.filters,
        }),
      "Draft revision saved.",
    );
  }

  async function handleCreateDerivedDraft() {
    const assetId = viewModel?.selectedAssetId;
    if (!assetId || !viewModel) {
      return;
    }

    await runMutation(
      () =>
        controller.createDerivedDraftAndLoad({
          assetId,
          filters: viewModel.filters,
        }),
      "Update draft derived from the approved revision.",
    );
  }

  async function handleSubmitDraft() {
    const revisionId = viewModel?.selectedRevisionId;
    if (!revisionId || !viewModel) {
      return;
    }

    await runMutation(
      () =>
        controller.submitDraftAndLoad({
          revisionId,
          filters: viewModel.filters,
        }),
      "Draft submitted to knowledge review.",
    );
  }

  const selectedRevision = viewModel?.detail?.selected_revision ?? null;
  const selectedApprovedRevision = viewModel?.detail?.current_approved_revision ?? null;
  const isDraftSelected = selectedRevision?.status === "draft";
  const reviewHash =
    selectedRevision == null
      ? null
      : formatWorkbenchHash("knowledge-review", {
          revisionId: selectedRevision.id,
        });

  const activeRevisionId = viewModel?.selectedRevisionId ?? null;

  return (
    <main className="knowledge-library-workbench">
      <header className="knowledge-library-hero">
        <div className="knowledge-library-hero-copy">
          <span className="knowledge-library-eyebrow">Knowledge Library</span>
          <h1>Knowledge Library</h1>
          <p>
            Author, revise, bind, and submit governed knowledge assets from a
            standalone workbench instead of embedding the flow inside rule
            governance.
          </p>
          <WorkbenchCoreStrip
            activePillarId="knowledge"
            heading="Authoring Pipeline"
            description="Keep draft authoring, structured bindings, and review handoff on the same knowledge track."
          />
        </div>
        <dl className="knowledge-library-hero-stats">
          <div>
            <dt>Role</dt>
            <dd>{formatActorRole(actorRole)}</dd>
          </div>
          <div>
            <dt>Selected Asset</dt>
            <dd>{viewModel?.selectedAssetId ?? "New draft"}</dd>
          </div>
          <div>
            <dt>Selected Revision</dt>
            <dd>{viewModel?.selectedRevisionId ?? "Not selected"}</dd>
          </div>
        </dl>
      </header>

      {statusMessage ? (
        <div className="knowledge-library-banner" role="status">
          {statusMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="knowledge-library-banner knowledge-library-banner-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <div className="knowledge-library-layout">
        <section className="knowledge-library-panel knowledge-library-queue">
          <header className="knowledge-library-panel-header">
            <div>
              <h2>Library Queue</h2>
              <p>
                Browse authoring projections, search drafts, and reopen a
                revision for editing.
              </p>
            </div>
            <button type="button" onClick={handleStartNewAsset}>
              Start New Asset
            </button>
          </header>

          <div className="knowledge-library-filters">
            <label>
              Search
              <input
                type="search"
                value={viewModel?.filters.searchText ?? ""}
                onChange={(event) => updateFilters({ searchText: event.target.value })}
                placeholder="Title, summary, alias, or binding"
              />
            </label>
            <label>
              Status
              <select
                value={viewModel?.filters.status ?? "all"}
                onChange={(event) =>
                  updateFilters({
                    status: event.target.value as KnowledgeLibraryFilterState["status"],
                  })
                }
              >
                {knowledgeStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Kind
              <select
                value={viewModel?.filters.knowledgeKind ?? "all"}
                onChange={(event) =>
                  updateFilters({
                    knowledgeKind:
                      event.target.value as KnowledgeLibraryFilterState["knowledgeKind"],
                  })
                }
              >
                {knowledgeKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loadStatus === "loading" && (viewModel?.library.length ?? 0) === 0 ? (
            <p className="knowledge-library-empty">Loading knowledge library...</p>
          ) : null}

          {(viewModel?.visibleLibrary.length ?? 0) === 0 && loadStatus !== "loading" ? (
            <p className="knowledge-library-empty">
              No knowledge assets match the current authoring filters.
            </p>
          ) : null}

          <ul className="knowledge-library-list">
            {(viewModel?.visibleLibrary ?? []).map((item) => {
              const isActive = item.id === viewModel?.selectedAssetId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`knowledge-library-list-item${isActive ? " is-active" : ""}`}
                    onClick={() => handleSelectAsset(item.id)}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.status}</span>
                    <small>{item.knowledge_kind}</small>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="knowledge-library-main-column">
          <section className="knowledge-library-panel knowledge-library-editor">
            <header className="knowledge-library-panel-header">
              <div>
                <h2>Draft Editor</h2>
                <p>
                  Edit the current draft revision, or create a new asset when no
                  revision is selected.
                </p>
              </div>
              {reviewHash ? (
                <a className="knowledge-library-link" href={reviewHash}>
                  Open Review Queue
                </a>
              ) : null}
            </header>

            <div className="knowledge-library-editor-meta">
              <span>
                Current Asset: <strong>{viewModel?.selectedAssetId ?? "New draft"}</strong>
              </span>
              <span>
                Current Revision:{" "}
                <strong>{viewModel?.selectedRevisionId ?? "Not selected"}</strong>
              </span>
              <span>
                Approved Revision:{" "}
                <strong>{selectedApprovedRevision?.id ?? "None yet"}</strong>
              </span>
            </div>

            <div className="knowledge-library-form-grid">
              <label>
                Title
                <input
                  value={formState.title}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Knowledge title"
                />
              </label>
              <label>
                Knowledge Kind
                <select
                  value={formState.knowledgeKind}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      knowledgeKind: event.target.value as KnowledgeKind,
                    }))
                  }
                >
                  {knowledgeKinds
                    .filter((kind): kind is KnowledgeKind => kind !== "all")
                    .map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                </select>
              </label>
              <label className="knowledge-library-form-full">
                Canonical Text
                <textarea
                  rows={6}
                  value={formState.canonicalText}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      canonicalText: event.target.value,
                    }))
                  }
                  placeholder="Canonical knowledge text"
                />
              </label>
              <label className="knowledge-library-form-full">
                Summary
                <textarea
                  rows={3}
                  value={formState.summary}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, summary: event.target.value }))
                  }
                  placeholder="Short operator summary"
                />
              </label>
              <label>
                Module Scope
                <select
                  value={formState.moduleScope}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      moduleScope: event.target.value as ManuscriptModule | "any",
                    }))
                  }
                >
                  {moduleOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Manuscript Types
                <input
                  value={formState.manuscriptTypes}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      manuscriptTypes: event.target.value,
                    }))
                  }
                  placeholder="any or comma-separated types"
                />
              </label>
              <label>
                Sections
                <input
                  value={formState.sections}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, sections: event.target.value }))
                  }
                  placeholder="methods, discussion"
                />
              </label>
              <label>
                Risk Tags
                <input
                  value={formState.riskTags}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, riskTags: event.target.value }))
                  }
                  placeholder="consistency, statistics"
                />
              </label>
              <label>
                Discipline Tags
                <input
                  value={formState.disciplineTags}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      disciplineTags: event.target.value,
                    }))
                  }
                  placeholder="cardiology, oncology"
                />
              </label>
              <label>
                Aliases
                <input
                  value={formState.aliases}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, aliases: event.target.value }))
                  }
                  placeholder="endpoint, primary endpoint"
                />
              </label>
              <label>
                Evidence Level
                <input
                  value={formState.evidenceLevel}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      evidenceLevel: event.target.value,
                    }))
                  }
                  placeholder="high"
                />
              </label>
              <label>
                Source Type
                <input
                  value={formState.sourceType}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, sourceType: event.target.value }))
                  }
                  placeholder="guideline"
                />
              </label>
              <label className="knowledge-library-form-full">
                Source Link
                <input
                  value={formState.sourceLink}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, sourceLink: event.target.value }))
                  }
                  placeholder="https://..."
                />
              </label>
              <label>
                Effective At
                <input
                  value={formState.effectiveAt}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      effectiveAt: event.target.value,
                    }))
                  }
                  placeholder="2026-04-08T00:00:00.000Z"
                />
              </label>
              <label>
                Expires At
                <input
                  value={formState.expiresAt}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      expiresAt: event.target.value,
                    }))
                  }
                  placeholder="Optional ISO timestamp"
                />
              </label>
            </div>

            <div className="knowledge-library-actions">
              <button type="button" disabled={isBusy} onClick={() => void handleCreateDraft()}>
                Create Draft Asset
              </button>
              <button
                type="button"
                disabled={isBusy || !isDraftSelected}
                onClick={() => void handleSaveDraft()}
              >
                Save Draft
              </button>
              <button
                type="button"
                disabled={isBusy || !viewModel?.selectedAssetId}
                onClick={() => void handleCreateDerivedDraft()}
              >
                Create Update Draft
              </button>
              <button
                type="button"
                disabled={isBusy || !isDraftSelected}
                onClick={() => void handleSubmitDraft()}
              >
                Submit To Review
              </button>
            </div>
          </section>

          <section className="knowledge-library-panel knowledge-library-bindings">
            <header className="knowledge-library-panel-header">
              <div>
                <h2>Structured Bindings</h2>
                <p>
                  Edit bindings as one line per record using{" "}
                  <code>binding_kind | target_id | label</code>.
                </p>
              </div>
            </header>
            <textarea
              rows={8}
              value={formState.bindingsText}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  bindingsText: event.target.value,
                }))
              }
              placeholder="module_template | template-screening-1 | Screening Template"
            />
            <ul className="knowledge-library-binding-list">
              {parseBindings(formState.bindingsText).map((binding) => (
                <li key={`${binding.bindingKind}:${binding.bindingTargetId}`}>
                  <strong>{binding.bindingTargetLabel}</strong>
                  <span>{binding.bindingKind}</span>
                </li>
              ))}
            </ul>
          </section>
        </section>

        <aside className="knowledge-library-side-column">
          <section className="knowledge-library-panel knowledge-library-history">
            <header className="knowledge-library-panel-header">
              <div>
                <h2>Revision Timeline</h2>
                <p>
                  Track approved history, current drafts, and review handoff for
                  the selected asset.
                </p>
              </div>
            </header>

            {viewModel?.detail == null ? (
              <p className="knowledge-library-empty">
                Select an asset from the library queue to inspect revision history.
              </p>
            ) : null}

            <ol className="knowledge-library-revision-list">
              {(viewModel?.detail?.revisions ?? []).map((revision) => {
                const isActive = revision.id === activeRevisionId;
                return (
                  <li key={revision.id}>
                    <button
                      type="button"
                      className={`knowledge-library-revision-item${isActive ? " is-active" : ""}`}
                      onClick={() => handleSelectRevision(revision.id)}
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
        </aside>
      </div>
    </main>
  );
}

function toFormState(detail: KnowledgeLibraryWorkbenchViewModel["detail"]): KnowledgeLibraryFormState {
  if (!detail) {
    return defaultFormState;
  }

  const revision = detail.selected_revision;
  return {
    title: revision.title,
    canonicalText: revision.canonical_text,
    summary: revision.summary ?? "",
    knowledgeKind: revision.knowledge_kind,
    moduleScope: revision.routing.module_scope,
    manuscriptTypes:
      revision.routing.manuscript_types === "any"
        ? "any"
        : revision.routing.manuscript_types.join(", "),
    sections: (revision.routing.sections ?? []).join(", "),
    riskTags: (revision.routing.risk_tags ?? []).join(", "),
    disciplineTags: (revision.routing.discipline_tags ?? []).join(", "),
    aliases: (revision.aliases ?? []).join(", "),
    evidenceLevel: revision.evidence_level ?? "unknown",
    sourceType: revision.source_type ?? "other",
    sourceLink: revision.source_link ?? "",
    effectiveAt: revision.effective_at ?? "",
    expiresAt: revision.expires_at ?? "",
    bindingsText: revision.bindings
      .map(
        (binding) =>
          `${binding.binding_kind} | ${binding.binding_target_id} | ${binding.binding_target_label}`,
      )
      .join("\n"),
  };
}

function toCreateInput(formState: KnowledgeLibraryFormState): CreateKnowledgeLibraryDraftInput {
  return {
    title: formState.title.trim(),
    canonicalText: formState.canonicalText.trim(),
    summary: optionalTrimmedValue(formState.summary),
    knowledgeKind: formState.knowledgeKind,
    moduleScope: formState.moduleScope,
    manuscriptTypes: parseManuscriptTypes(formState.manuscriptTypes),
    sections: splitCommaSeparated(formState.sections),
    riskTags: splitCommaSeparated(formState.riskTags),
    disciplineTags: splitCommaSeparated(formState.disciplineTags),
    aliases: splitCommaSeparated(formState.aliases),
    evidenceLevel: optionalTrimmedValue(formState.evidenceLevel) as
      | CreateKnowledgeLibraryDraftInput["evidenceLevel"]
      | undefined,
    sourceType: optionalTrimmedValue(formState.sourceType) as
      | CreateKnowledgeLibraryDraftInput["sourceType"]
      | undefined,
    sourceLink: optionalTrimmedValue(formState.sourceLink),
    effectiveAt: optionalTrimmedValue(formState.effectiveAt),
    expiresAt: optionalTrimmedValue(formState.expiresAt),
    bindings: parseBindings(formState.bindingsText),
  };
}

function toUpdateInput(formState: KnowledgeLibraryFormState): UpdateKnowledgeLibraryDraftInput {
  return toCreateInput(formState);
}

function parseBindings(value: string): KnowledgeRevisionBindingInput[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      const [bindingKind, bindingTargetId, bindingTargetLabel] = line
        .split("|")
        .map((part) => part.trim());
      if (!bindingKind || !bindingTargetId || !bindingTargetLabel) {
        return [];
      }

      return [
        {
          bindingKind: bindingKind as KnowledgeRevisionBindingKind,
          bindingTargetId,
          bindingTargetLabel,
        },
      ];
    });
}

function splitCommaSeparated(value: string): string[] | undefined {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return parts.length > 0 ? parts : undefined;
}

function parseManuscriptTypes(value: string): ManuscriptType[] | "any" {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.toLowerCase() === "any") {
    return "any";
  }

  return trimmed
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is ManuscriptType => Boolean(part));
}

function optionalTrimmedValue(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function formatActorRole(role: AuthRole): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "knowledge_reviewer":
      return "Knowledge Reviewer";
    case "editor":
      return "Editor";
    case "proofreader":
      return "Proofreader";
    case "screener":
      return "Screener";
    case "user":
    default:
      return "User";
  }
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return `${fallback}: ${error.message}`;
  }

  return fallback;
}
