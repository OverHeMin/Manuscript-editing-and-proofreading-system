import type { ManuscriptModule, ManuscriptType } from "../manuscripts/types.ts";
import type { KnowledgeKind, KnowledgeReviewQueueItemViewModel } from "../knowledge/index.ts";
import type { KnowledgeReviewFilterState } from "./workbench-state.ts";

export type KnowledgeReviewStatusFilter = "pending_review";

export interface KnowledgeReviewQueuePaneProps {
  filters: Pick<KnowledgeReviewFilterState, "searchText" | "knowledgeKind" | "moduleScope">;
  statusFilter: KnowledgeReviewStatusFilter;
  queue: readonly KnowledgeReviewQueueItemViewModel[];
  totalQueueCount: number;
  activeItemId: string | null;
  isLoading: boolean;
  loadErrorMessage: string | null;
  isQueueEmpty: boolean;
  isNoResults: boolean;
  onSearchTextChange(value: string): void;
  onStatusFilterChange(value: KnowledgeReviewStatusFilter): void;
  onKnowledgeKindChange(value: KnowledgeReviewFilterState["knowledgeKind"]): void;
  onModuleScopeChange(value: KnowledgeReviewFilterState["moduleScope"]): void;
  onSelectItem(itemId: string): void;
  onRetryQueue(): void;
}

const moduleOptions: Array<{
  value: KnowledgeReviewFilterState["moduleScope"];
  label: string;
}> = [
  { value: "all", label: "All modules" },
  { value: "any", label: "Any module" },
  { value: "upload", label: "Upload" },
  { value: "screening", label: "Screening" },
  { value: "editing", label: "Editing" },
  { value: "proofreading", label: "Proofreading" },
  { value: "pdf_consistency", label: "PDF Consistency" },
  { value: "learning", label: "Learning" },
  { value: "manual", label: "Manual" },
];

const knowledgeKindOptions: Array<{
  value: KnowledgeReviewFilterState["knowledgeKind"];
  label: string;
}> = [
  { value: "all", label: "All kinds" },
  { value: "rule", label: "Rule" },
  { value: "case_pattern", label: "Case Pattern" },
  { value: "checklist", label: "Checklist" },
  { value: "prompt_snippet", label: "Prompt Snippet" },
  { value: "reference", label: "Reference" },
  { value: "other", label: "Other" },
];

export function KnowledgeReviewQueuePane({
  filters,
  statusFilter,
  queue,
  totalQueueCount,
  activeItemId,
  isLoading,
  loadErrorMessage,
  isQueueEmpty,
  isNoResults,
  onSearchTextChange,
  onStatusFilterChange,
  onKnowledgeKindChange,
  onModuleScopeChange,
  onSelectItem,
  onRetryQueue,
}: KnowledgeReviewQueuePaneProps) {
  return (
    <section className="knowledge-review-panel knowledge-review-queue-pane">
      <header className="knowledge-review-pane-header">
        <h2>Pending Review Queue</h2>
        <p>{`Visible ${queue.length} of ${totalQueueCount}`}</p>
      </header>

      <div className="knowledge-review-queue-controls">
        <label>
          Search
          <input
            type="search"
            value={filters.searchText}
            placeholder="Search title, canonical text, alias, or risk tags"
            onChange={(event) => onSearchTextChange(event.target.value)}
          />
        </label>

        <div className="knowledge-review-inline-filters">
          <label>
            Status
            <select
              value={statusFilter}
              onChange={(event) =>
                onStatusFilterChange(event.target.value as KnowledgeReviewStatusFilter)
              }
            >
              <option value="pending_review">Pending review</option>
            </select>
          </label>

          <label>
            Knowledge kind
            <select
              value={filters.knowledgeKind}
              onChange={(event) =>
                onKnowledgeKindChange(
                  event.target.value as KnowledgeReviewFilterState["knowledgeKind"],
                )
              }
            >
              {knowledgeKindOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Module
            <select
              value={filters.moduleScope}
              onChange={(event) =>
                onModuleScopeChange(
                  event.target.value as KnowledgeReviewFilterState["moduleScope"],
                )
              }
            >
              {moduleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loadErrorMessage ? (
        <div className="knowledge-review-banner knowledge-review-banner-error" role="status">
          <p>{loadErrorMessage}</p>
          <button type="button" onClick={onRetryQueue}>
            Retry queue load
          </button>
        </div>
      ) : null}

      {isLoading && totalQueueCount === 0 ? (
        <div className="knowledge-review-empty-state" role="status">
          Loading pending knowledge items...
        </div>
      ) : null}

      {!isLoading && isQueueEmpty ? (
        <div className="knowledge-review-empty-state">
          No pending items are waiting for reviewer approval.
        </div>
      ) : null}

      {!isLoading && !isQueueEmpty && isNoResults ? (
        <div className="knowledge-review-empty-state">
          No matching items for the current filters. Adjust filters to continue review.
        </div>
      ) : null}

      {!isQueueEmpty && !isNoResults ? (
        <ul className="knowledge-review-queue-list">
          {queue.map((item) => {
            const isActive = item.id === activeItemId;
            const hints = resolveHintText(item);

            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`knowledge-review-queue-item${isActive ? " is-active" : ""}`}
                  onClick={() => onSelectItem(item.id)}
                >
                  <p className="knowledge-review-queue-title">{item.title}</p>
                  <p className="knowledge-review-queue-meta-row">
                    <span>{formatKnowledgeKind(item.knowledge_kind)}</span>
                    <span>{formatModuleScope(item.routing.module_scope)}</span>
                    <span>{formatEvidenceLevel(item.evidence_level)}</span>
                  </p>
                  <p className="knowledge-review-queue-meta-row">
                    {formatManuscriptTypes(item.routing.manuscript_types)}
                  </p>
                  {hints ? <p className="knowledge-review-queue-hints">{hints}</p> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

function formatKnowledgeKind(kind: KnowledgeKind): string {
  switch (kind) {
    case "case_pattern":
      return "Case pattern";
    case "prompt_snippet":
      return "Prompt snippet";
    default:
      return startCase(kind);
  }
}

function formatModuleScope(moduleScope: ManuscriptModule | "any"): string {
  if (moduleScope === "any") {
    return "Any module";
  }

  if (moduleScope === "pdf_consistency") {
    return "PDF consistency";
  }

  return startCase(moduleScope);
}

function formatEvidenceLevel(
  evidenceLevel: KnowledgeReviewQueueItemViewModel["evidence_level"],
): string {
  if (!evidenceLevel) {
    return "Evidence: Unspecified";
  }

  if (evidenceLevel === "expert_opinion") {
    return "Evidence: Expert opinion";
  }

  return `Evidence: ${startCase(evidenceLevel)}`;
}

function formatManuscriptTypes(types: ManuscriptType[] | "any"): string {
  if (types === "any") {
    return "Manuscript scope: Any";
  }

  if (types.length === 0) {
    return "Manuscript scope: Not set";
  }

  return `Manuscript scope: ${types.map(startCase).join(", ")}`;
}

function resolveHintText(item: KnowledgeReviewQueueItemViewModel): string {
  const templateHint = compactHint("Template", item.template_bindings);
  const riskHint = compactHint("Risk", item.routing.risk_tags);
  const hints = [templateHint, riskHint].filter((value): value is string => Boolean(value));

  return hints.join(" · ");
}

function compactHint(label: string, values: readonly string[] | undefined): string | null {
  if (!values || values.length === 0) {
    return null;
  }

  const renderedValues = values.slice(0, 2);
  const overflow = values.length - renderedValues.length;
  const suffix = overflow > 0 ? ` +${overflow}` : "";

  return `${label}: ${renderedValues.join(", ")}${suffix}`;
}

function startCase(value: string): string {
  return value
    .split("_")
    .map((part) => (part.length === 0 ? part : `${part[0].toUpperCase()}${part.slice(1)}`))
    .join(" ");
}
