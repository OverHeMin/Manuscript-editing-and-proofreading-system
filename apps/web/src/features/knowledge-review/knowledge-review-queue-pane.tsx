import type { ManuscriptModule, ManuscriptType } from "../manuscripts/types.ts";
import type { KnowledgeKind, KnowledgeReviewQueueItemViewModel } from "../knowledge/index.ts";
import type { KnowledgeReviewFilterState } from "./workbench-state.ts";

export interface KnowledgeReviewQueuePaneProps {
  filters: Pick<KnowledgeReviewFilterState, "searchText" | "knowledgeKind" | "moduleScope">;
  queue: readonly KnowledgeReviewQueueItemViewModel[];
  totalQueueCount: number;
  activeItemId: string | null;
  isLoading: boolean;
  loadErrorMessage: string | null;
  isQueueEmpty: boolean;
  isNoResults: boolean;
  onSearchTextChange(value: string): void;
  onKnowledgeKindChange(value: KnowledgeReviewFilterState["knowledgeKind"]): void;
  onModuleScopeChange(value: KnowledgeReviewFilterState["moduleScope"]): void;
  onSelectItem(itemId: string): void;
  onRetryQueue(): void;
}

const moduleOptions: Array<{
  value: KnowledgeReviewFilterState["moduleScope"];
  label: string;
}> = [
  { value: "all", label: "All Modules" },
  { value: "any", label: "Any Module" },
  { value: "upload", label: "Upload Intake" },
  { value: "screening", label: "Screening" },
  { value: "editing", label: "Editing" },
  { value: "proofreading", label: "Proofreading" },
  { value: "pdf_consistency", label: "PDF Consistency" },
  { value: "learning", label: "Learning Rewrite" },
  { value: "manual", label: "Manual Curation" },
];

const knowledgeKindOptions: Array<{
  value: KnowledgeReviewFilterState["knowledgeKind"];
  label: string;
}> = [
  { value: "all", label: "All Kinds" },
  { value: "rule", label: "Rule" },
  { value: "case_pattern", label: "Case Pattern" },
  { value: "checklist", label: "Checklist" },
  { value: "prompt_snippet", label: "Prompt Snippet" },
  { value: "reference", label: "Reference" },
  { value: "other", label: "Other" },
];

export function KnowledgeReviewQueuePane({
  filters,
  queue,
  totalQueueCount,
  activeItemId,
  isLoading,
  loadErrorMessage,
  isQueueEmpty,
  isNoResults,
  onSearchTextChange,
  onKnowledgeKindChange,
  onModuleScopeChange,
  onSelectItem,
  onRetryQueue,
}: KnowledgeReviewQueuePaneProps) {
  return (
    <section className="knowledge-review-panel knowledge-review-queue-pane">
      <header className="knowledge-review-pane-header">
        <h2>Pending Review Queue</h2>
        <p>{`Showing ${queue.length} of ${totalQueueCount} pending revisions.`}</p>
      </header>

      <div className="knowledge-review-queue-controls">
        <label>
          Search
          <input
            type="search"
            value={filters.searchText}
            placeholder="Search title, canonical text, alias, or risk tag"
            onChange={(event) => onSearchTextChange(event.target.value)}
          />
        </label>

        <div className="knowledge-review-inline-filters">
          <label>
            Status
            <select value="pending_review" disabled>
              <option value="pending_review">Pending Review</option>
            </select>
            <span className="knowledge-review-filter-note">Locked for this workbench</span>
          </label>

          <label>
            Knowledge Kind
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
            Module Scope
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
            Reload Queue
          </button>
        </div>
      ) : null}

      {isLoading && totalQueueCount === 0 ? (
        <div className="knowledge-review-empty-state" role="status">
          Loading pending review revisions...
        </div>
      ) : null}

      {!isLoading && isQueueEmpty ? (
        <div className="knowledge-review-empty-state">
          There are no revisions waiting for review.
        </div>
      ) : null}

      {!isLoading && !isQueueEmpty && isNoResults ? (
        <div className="knowledge-review-empty-state">
          No queue items match the active review filters.
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
                    <span>{item.asset_id}</span>
                    <span>{item.revision_id}</span>
                  </p>
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
    case "rule":
      return "Rule";
    case "case_pattern":
      return "Case Pattern";
    case "checklist":
      return "Checklist";
    case "prompt_snippet":
      return "Prompt Snippet";
    case "reference":
      return "Reference";
    case "other":
      return "Other";
    default:
      return startCase(kind);
  }
}

function formatModuleScope(moduleScope: ManuscriptModule | "any"): string {
  if (moduleScope === "any") {
    return "Any Module";
  }

  if (moduleScope === "pdf_consistency") {
    return "PDF Consistency";
  }

  if (moduleScope === "upload") {
    return "Upload Intake";
  }

  if (moduleScope === "screening") {
    return "Screening";
  }

  if (moduleScope === "editing") {
    return "Editing";
  }

  if (moduleScope === "proofreading") {
    return "Proofreading";
  }

  if (moduleScope === "learning") {
    return "Learning Rewrite";
  }

  if (moduleScope === "manual") {
    return "Manual Curation";
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
    return "Evidence: Expert Opinion";
  }

  return `Evidence: ${startCase(evidenceLevel)}`;
}

function formatManuscriptTypes(types: ManuscriptType[] | "any"): string {
  if (types === "any") {
    return "Manuscripts: Any";
  }

  if (types.length === 0) {
    return "Manuscripts: Not configured";
  }

  return `Manuscripts: ${types.map(formatManuscriptType).join(", ")}`;
}

function resolveHintText(item: KnowledgeReviewQueueItemViewModel): string {
  const templateHint = compactHint("Templates", item.template_bindings);
  const riskHint = compactHint("Risks", item.routing.risk_tags);
  const hints = [templateHint, riskHint].filter((value): value is string => Boolean(value));

  return hints.join(" | ");
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

function formatManuscriptType(type: ManuscriptType): string {
  switch (type) {
    case "clinical_study":
      return "Clinical Study";
    case "systematic_review":
      return "Systematic Review";
    case "meta_analysis":
      return "Meta Analysis";
    case "case_report":
      return "Case Report";
    case "guideline_interpretation":
      return "Guideline Interpretation";
    case "expert_consensus":
      return "Expert Consensus";
    case "diagnostic_study":
      return "Diagnostic Study";
    case "basic_research":
      return "Basic Research";
    case "nursing_study":
      return "Nursing Study";
    case "methodology_paper":
      return "Methodology Paper";
    case "brief_report":
      return "Brief Report";
    case "other":
      return "Other";
    case "review":
    default:
      return "Review";
  }
}

function startCase(value: string): string {
  return value
    .split("_")
    .map((part) => (part.length === 0 ? part : `${part[0].toUpperCase()}${part.slice(1)}`))
    .join(" ");
}
