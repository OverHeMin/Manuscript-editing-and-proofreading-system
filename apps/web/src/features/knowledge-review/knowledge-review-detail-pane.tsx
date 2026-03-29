import type {
  KnowledgeReviewActionViewModel,
  KnowledgeReviewQueueItemViewModel,
} from "../knowledge/index.ts";

export interface KnowledgeReviewHistoryViewState {
  knowledgeItemId: string | null;
  status: "idle" | "loading" | "ready" | "error";
  actions: readonly KnowledgeReviewActionViewModel[];
  errorMessage: string | null;
}

export interface KnowledgeReviewDetailPaneProps {
  item: KnowledgeReviewQueueItemViewModel | null;
  history: KnowledgeReviewHistoryViewState;
  isUsingStableSnapshot: boolean;
  historyScopeNote: string | null;
  onRetryHistory(): void;
}

export function KnowledgeReviewDetailPane({
  item,
  history,
  isUsingStableSnapshot,
  historyScopeNote,
  onRetryHistory,
}: KnowledgeReviewDetailPaneProps) {
  if (item == null) {
    return (
      <section className="knowledge-review-panel knowledge-review-detail-pane">
        <header className="knowledge-review-pane-header">
          <h2>Knowledge Detail</h2>
          <p>Select a queue item to review.</p>
        </header>
        <div className="knowledge-review-empty-state knowledge-review-neutral-empty">
          Select a pending knowledge item from the queue to load full context and actions.
        </div>
      </section>
    );
  }

  return (
    <section className="knowledge-review-panel knowledge-review-detail-pane">
      <header className="knowledge-review-pane-header">
        <h2>{item.title}</h2>
        <p>
          {isUsingStableSnapshot
            ? "Showing last stable selection while queue reload recovers."
            : "Review context"}
        </p>
      </header>

      <dl className="knowledge-review-detail-grid">
        <div>
          <dt>Canonical text</dt>
          <dd className="knowledge-review-canonical-text">{item.canonical_text}</dd>
        </div>
        <div>
          <dt>Summary</dt>
          <dd>{item.summary?.trim().length ? item.summary : "Not provided"}</dd>
        </div>
        <div>
          <dt>Evidence level</dt>
          <dd>{renderEvidenceLevel(item.evidence_level)}</dd>
        </div>
        <div>
          <dt>Source type</dt>
          <dd>{item.source_type ? startCase(item.source_type) : "Not provided"}</dd>
        </div>
        <div>
          <dt>Source link</dt>
          <dd>
            {item.source_link ? (
              <a href={item.source_link} target="_blank" rel="noreferrer">
                {item.source_link}
              </a>
            ) : (
              "Not provided"
            )}
          </dd>
        </div>
        <div>
          <dt>Routing scope</dt>
          <dd>{renderRoutingScope(item)}</dd>
        </div>
        <div>
          <dt>Template bindings</dt>
          <dd>{item.template_bindings?.length ? item.template_bindings.join(", ") : "None"}</dd>
        </div>
      </dl>

      <section className="knowledge-review-history">
        <header>
          <h3>Review History</h3>
          <p>Decision trace and reviewer notes.</p>
        </header>

        {historyScopeNote ? (
          <p className="knowledge-review-history-state">{historyScopeNote}</p>
        ) : null}

        {history.status === "loading" ? (
          <p className="knowledge-review-history-state" role="status">
            Loading review history...
          </p>
        ) : null}

        {history.status === "error" ? (
          <div className="knowledge-review-banner knowledge-review-banner-error">
            <p>{history.errorMessage ?? "History failed to load."}</p>
            <button type="button" onClick={onRetryHistory}>
              Retry history
            </button>
          </div>
        ) : null}

        {history.actions.length === 0 && history.status !== "loading" ? (
          <p className="knowledge-review-history-state">No review events recorded yet.</p>
        ) : null}

        {history.actions.length > 0 ? (
          <ol className="knowledge-review-history-list">
            {history.actions.map((action) => (
              <li key={action.id}>
                <p className="knowledge-review-history-event">
                  {eventLabel(action.action)} | {actorLabel(action.actor_role)}
                </p>
                <p className="knowledge-review-history-time">{formatTimestamp(action.created_at)}</p>
                <p className="knowledge-review-history-note">
                  {action.review_note?.trim().length ? action.review_note : "No review note"}
                </p>
              </li>
            ))}
          </ol>
        ) : null}
      </section>
    </section>
  );
}

function renderEvidenceLevel(
  evidenceLevel: KnowledgeReviewQueueItemViewModel["evidence_level"],
): string {
  if (!evidenceLevel) {
    return "Not provided";
  }

  if (evidenceLevel === "expert_opinion") {
    return "Expert opinion";
  }

  return startCase(evidenceLevel);
}

function renderRoutingScope(item: KnowledgeReviewQueueItemViewModel): string {
  const moduleScope =
    item.routing.module_scope === "any" ? "Any module" : startCase(item.routing.module_scope);
  const manuscriptScope =
    item.routing.manuscript_types === "any"
      ? "Any manuscript type"
      : item.routing.manuscript_types.map(startCase).join(", ");

  return `${moduleScope} | ${manuscriptScope}`;
}

function eventLabel(action: KnowledgeReviewActionViewModel["action"]): string {
  switch (action) {
    case "submitted_for_review":
      return "Submitted for review";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return action;
  }
}

function actorLabel(actorRole: KnowledgeReviewActionViewModel["actor_role"]): string {
  switch (actorRole) {
    case "knowledge_reviewer":
      return "Knowledge reviewer";
    default:
      return startCase(actorRole);
  }
}

function formatTimestamp(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return isoTimestamp;
  }

  return parsed.toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function startCase(value: string): string {
  return value
    .split("_")
    .map((part) => (part.length === 0 ? part : `${part[0].toUpperCase()}${part.slice(1)}`))
    .join(" ");
}
