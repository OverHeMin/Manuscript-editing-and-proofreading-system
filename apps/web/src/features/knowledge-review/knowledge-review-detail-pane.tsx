import type {
  KnowledgeReviewActionViewModel,
  KnowledgeReviewQueueItemViewModel,
} from "../knowledge/index.ts";

export interface KnowledgeReviewHistoryViewState {
  revisionId: string | null;
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
          <p>Select a pending revision from the queue to inspect its review context.</p>
        </header>
        <div className="knowledge-review-empty-state knowledge-review-neutral-empty">
          Choose a queue item to load the selected asset, revision context, and review history.
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
            ? "The live queue is temporarily unavailable, so the last stable selection is being preserved."
            : "Review the selected knowledge revision with stable asset and revision context."}
        </p>
      </header>

      <dl className="knowledge-review-detail-grid">
        <div>
          <dt>Asset ID</dt>
          <dd>{item.asset_id}</dd>
        </div>
        <div>
          <dt>Revision ID</dt>
          <dd>{item.revision_id}</dd>
        </div>
        <div>
          <dt>Revision Status</dt>
          <dd>{renderStatus(item.status)}</dd>
        </div>
        <div>
          <dt>Canonical Text</dt>
          <dd className="knowledge-review-canonical-text">{item.canonical_text}</dd>
        </div>
        <div>
          <dt>Summary</dt>
          <dd>{item.summary?.trim().length ? item.summary : "Not provided"}</dd>
        </div>
        <div>
          <dt>Evidence Level</dt>
          <dd>{renderEvidenceLevel(item.evidence_level)}</dd>
        </div>
        <div>
          <dt>Source Type</dt>
          <dd>{item.source_type ? startCase(item.source_type) : "Not provided"}</dd>
        </div>
        <div>
          <dt>Source Link</dt>
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
          <dt>Effective Window</dt>
          <dd>{renderEffectiveWindow(item.effective_at, item.expires_at)}</dd>
        </div>
        <div>
          <dt>Routing Scope</dt>
          <dd>{renderRoutingScope(item)}</dd>
        </div>
        <div>
          <dt>Template Bindings</dt>
          <dd>{item.template_bindings?.length ? item.template_bindings.join(", ") : "None"}</dd>
        </div>
      </dl>

      <section className="knowledge-review-history">
        <header>
          <h3>Review History</h3>
          <p>Trace revision-level review events and reviewer notes.</p>
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
            <p>{history.errorMessage ?? "Review history failed to load."}</p>
            <button type="button" onClick={onRetryHistory}>
              Reload History
            </button>
          </div>
        ) : null}

        {history.actions.length === 0 && history.status !== "loading" ? (
          <p className="knowledge-review-history-state">No review actions recorded yet.</p>
        ) : null}

        {history.actions.length > 0 ? (
          <ol className="knowledge-review-history-list">
            {history.actions.map((action) => (
              <li key={action.id}>
                <p className="knowledge-review-history-event">
                  {eventLabel(action.action)} | {actorLabel(action.actor_role)}
                </p>
                <p className="knowledge-review-history-event">
                  Revision {action.revision_id ?? action.knowledge_item_id}
                </p>
                <p className="knowledge-review-history-time">{formatTimestamp(action.created_at)}</p>
                <p className="knowledge-review-history-note">
                  {action.review_note?.trim().length
                    ? action.review_note
                    : "No reviewer note recorded."}
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
    return "Expert Opinion";
  }

  return startCase(evidenceLevel);
}

function renderRoutingScope(item: KnowledgeReviewQueueItemViewModel): string {
  const moduleScope =
    item.routing.module_scope === "any" ? "Any Module" : startCase(item.routing.module_scope);
  const manuscriptScope =
    item.routing.manuscript_types === "any"
      ? "Any Manuscript Type"
      : item.routing.manuscript_types.map(startCase).join(", ");

  return `${moduleScope} | ${manuscriptScope}`;
}

function renderEffectiveWindow(
  effectiveAt: string | undefined,
  expiresAt: string | undefined,
): string {
  if (!effectiveAt && !expiresAt) {
    return "Always active";
  }

  const start = effectiveAt ? formatTimestamp(effectiveAt) : "Immediately";
  const end = expiresAt ? formatTimestamp(expiresAt) : "No expiry";
  return `${start} -> ${end}`;
}

function renderStatus(status: KnowledgeReviewQueueItemViewModel["status"]): string {
  switch (status) {
    case "pending_review":
      return "Pending Review";
    case "approved":
      return "Approved";
    case "draft":
      return "Draft";
    case "deprecated":
      return "Deprecated";
    case "superseded":
      return "Superseded";
    case "archived":
      return "Archived";
    default:
      return startCase(status);
  }
}

function eventLabel(action: KnowledgeReviewActionViewModel["action"]): string {
  switch (action) {
    case "submitted_for_review":
      return "Submitted For Review";
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
      return "Knowledge Reviewer";
    default:
      return startCase(actorRole);
  }
}

function formatTimestamp(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return isoTimestamp;
  }

  return parsed.toLocaleString("en-GB", {
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
