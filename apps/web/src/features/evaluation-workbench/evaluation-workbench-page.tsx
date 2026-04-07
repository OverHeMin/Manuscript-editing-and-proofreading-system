import { useEffect, useState } from "react";
import { formatWorkbenchHash } from "../../app/workbench-routing.ts";
import { createBrowserHttpClient, BrowserHttpClientError } from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/index.ts";
import type { ManuscriptWorkbenchMode } from "../manuscript-workbench/manuscript-workbench-controller.ts";
import type {
  FinalizeEvaluationRunResultViewModel,
  VerificationEvidenceKind,
  VerificationEvidenceViewModel,
} from "../verification-ops/index.ts";
import {
  createEvaluationWorkbenchController,
  type EvaluationWorkbenchController,
  type EvaluationWorkbenchFinalizedRunHistoryEntry,
  type EvaluationWorkbenchOverview,
} from "./evaluation-workbench-controller.ts";
import type { EvaluationWorkbenchHistoryWindowPreset } from "./evaluation-workbench-operations.ts";

const defaultController = createEvaluationWorkbenchController(createBrowserHttpClient());
const baseFinalizeForm = {
  status: "passed" as "passed" | "failed",
  evidenceKind: "url" as VerificationEvidenceKind,
  evidenceLabel: "Browser QA evidence",
  evidenceUrl: "https://example.test/evidence/browser-qa",
  artifactAssetId: "",
};
export type EvaluationWorkbenchHistoryFilter =
  | "all"
  | "recommended"
  | "needs_review"
  | "rejected";
export type EvaluationWorkbenchHistoryScope = "suite" | "manuscript";
export type EvaluationWorkbenchHistorySortMode = "newest" | "failures_first";

export interface EvaluationWorkbenchPageProps {
  controller?: EvaluationWorkbenchController;
  actorRole?: AuthRole;
  prefilledManuscriptId?: string;
  initialOverview?: EvaluationWorkbenchOverview | null;
}

export function EvaluationWorkbenchPage({
  controller = defaultController,
  prefilledManuscriptId,
  initialOverview = null,
}: EvaluationWorkbenchPageProps) {
  const normalizedPrefilledManuscriptId = prefilledManuscriptId?.trim() ?? "";
  const activeManuscriptContextId =
    normalizedPrefilledManuscriptId.length > 0 ? normalizedPrefilledManuscriptId : null;
  const [overview, setOverview] = useState<EvaluationWorkbenchOverview | null>(initialOverview);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">(
    initialOverview ? "ready" : "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedRunItemId, setSelectedRunItemId] = useState<string | null>(null);
  const [historyWindowPreset, setHistoryWindowPreset] =
    useState<EvaluationWorkbenchHistoryWindowPreset>(
      initialOverview?.suiteOperations.defaultWindow ?? "latest_10",
    );
  const [historyFilter, setHistoryFilter] = useState<EvaluationWorkbenchHistoryFilter>("all");
  const [historySortMode, setHistorySortMode] =
    useState<EvaluationWorkbenchHistorySortMode>("newest");

  useEffect(() => {
    if (initialOverview != null) return;
    void loadOverview(
      normalizedPrefilledManuscriptId.length > 0
        ? {
            manuscriptId: normalizedPrefilledManuscriptId,
            historyWindowPreset,
          }
        : { historyWindowPreset },
    );
  }, [controller, normalizedPrefilledManuscriptId, initialOverview]);

  useEffect(() => {
    if (!overview) return;
    const nextRunItemId = resolveSelectedId(
      overview.runItems.map((item) => item.id),
      selectedRunItemId,
    );
    if (nextRunItemId !== selectedRunItemId) {
      setSelectedRunItemId(nextRunItemId);
    }
  }, [overview, selectedRunItemId]);

  useEffect(() => {
    setHistoryFilter("all");
    setHistorySortMode("newest");
  }, [overview?.selectedSuiteId]);

  if (loadStatus === "error" && !overview) {
    return (
      <article className="workbench-placeholder" role="alert">
        <h2>Evaluation Workbench Unavailable</h2>
        <p>{errorMessage ?? "Unable to load evaluation governance data."}</p>
      </article>
    );
  }

  if (!overview) {
    return (
      <article className="workbench-placeholder" role="status">
        <h2>Evaluation Workbench</h2>
        <p>Loading suites, runs, and verification assets...</p>
      </article>
    );
  }

  return (
    <EvaluationWorkbenchOperationsView
      overview={overview}
      prefilledManuscriptId={normalizedPrefilledManuscriptId}
      statusMessage={statusMessage}
      errorMessage={errorMessage}
      historyFilter={historyFilter}
      historySortMode={historySortMode}
      selectedRunItemId={selectedRunItemId}
      onSelectSuite={(suiteId) => void handleSelectSuite(suiteId)}
      onSelectRun={(runId) => void handleSelectRun(runId)}
      onSelectRunItem={setSelectedRunItemId}
      onSelectHistoryWindow={(preset) => void handleSelectHistoryWindow(preset)}
      onSelectHistoryFilter={setHistoryFilter}
      onSelectHistorySortMode={setHistorySortMode}
    />
  );

  async function handleSelectHistoryWindow(preset: EvaluationWorkbenchHistoryWindowPreset) {
    if (!overview) return;
    if (preset === historyWindowPreset) return;
    setStatusMessage(null);
    await loadOverview({
      selectedSuiteId: overview.selectedSuiteId,
      selectedRunId: overview.selectedRunId,
      manuscriptId: activeManuscriptContextId,
      historyWindowPreset: preset,
    });
  }

  async function loadOverview(input?: {
    selectedSuiteId?: string | null;
    selectedRunId?: string | null;
    manuscriptId?: string | null;
    historyWindowPreset?: EvaluationWorkbenchHistoryWindowPreset;
  }) {
    setLoadStatus("loading");
    setErrorMessage(null);
    try {
      const nextOverview = await controller.loadOverview({
        ...input,
        historyWindowPreset: input?.historyWindowPreset ?? historyWindowPreset,
      });
      setOverview(nextOverview);
      setHistoryWindowPreset(nextOverview.suiteOperations.defaultWindow);
      setLoadStatus("ready");
    } catch (error) {
      setLoadStatus("error");
      setErrorMessage(toErrorMessage(error));
    }
  }

  async function handleSelectSuite(suiteId: string) {
    setStatusMessage(null);
    await loadOverview({
      selectedSuiteId: suiteId,
      selectedRunId: null,
      manuscriptId: activeManuscriptContextId,
      historyWindowPreset,
    });
  }

  async function handleSelectRun(runId: string) {
    if (!overview) return;
    setStatusMessage(null);
    await loadOverview({
      selectedSuiteId: overview.selectedSuiteId,
      selectedRunId: runId,
      manuscriptId: activeManuscriptContextId,
      historyWindowPreset,
    });
  }
}

function EvaluationWorkbenchOperationsView(props: {
  overview: EvaluationWorkbenchOverview;
  prefilledManuscriptId?: string;
  statusMessage?: string | null;
  errorMessage?: string | null;
  historyFilter: EvaluationWorkbenchHistoryFilter;
  historySortMode: EvaluationWorkbenchHistorySortMode;
  selectedRunItemId: string | null;
  onSelectSuite: (suiteId: string) => void;
  onSelectRun: (runId: string) => void;
  onSelectRunItem: (runItemId: string) => void;
  onSelectHistoryWindow: (preset: EvaluationWorkbenchHistoryWindowPreset) => void;
  onSelectHistoryFilter: (filter: EvaluationWorkbenchHistoryFilter) => void;
  onSelectHistorySortMode: (sortMode: EvaluationWorkbenchHistorySortMode) => void;
}) {
  const normalizedPrefilledManuscriptId = props.prefilledManuscriptId?.trim() ?? "";
  const selectedRun =
    props.overview.runs.find((item) => item.id === props.overview.selectedRunId) ?? null;
  const selectedRunHistoryEntry =
    selectedRun == null
      ? null
      : props.overview.finalizedRunHistory.find((entry) => entry.run.id === selectedRun.id) ?? null;
  const selectedRunItem =
    props.overview.runItems.find((item) => item.id === props.selectedRunItemId) ?? null;
  const linkedSampleSetItem =
    selectedRunItem == null
      ? null
      : props.overview.sampleSetItems.find((item) => item.id === selectedRunItem.sample_set_item_id) ??
        null;
  const selectedSampleSet =
    selectedRun == null
      ? null
      : props.overview.sampleSets.find((item) => item.id === selectedRun.sample_set_id) ?? null;
  const visibleHistory = props.overview.suiteOperations.visibleHistory;
  const filteredVisibleHistory = filterFinalizedRunHistory(visibleHistory, props.historyFilter);
  const sortedVisibleHistory = sortFinalizedRunHistory(
    filteredVisibleHistory,
    props.historySortMode,
  );
  const defaultComparison = props.overview.suiteOperations.defaultComparison;
  const defaultComparisonDetail = props.overview.suiteOperations.defaultComparisonDetail;
  const selectedRunOutsideVisibleWindow =
    selectedRun != null && !visibleHistory.some((entry) => entry.run.id === selectedRun.id);
  const selectedInspectionFinalization =
    selectedRunHistoryEntry?.finalized ?? props.overview.selectedRunFinalization;

  return (
    <section className="evaluation-workbench">
      <header className="evaluation-workbench-hero">
        <div className="evaluation-workbench-hero-copy">
          <p className="evaluation-workbench-eyebrow">Read-Only Operations Desk</p>
          <h2>Evaluation Workbench</h2>
          <p>
            Delta-first operations view for finalized suite movement, bounded history, and
            read-only inspection.
          </p>
          {props.errorMessage ? <p className="evaluation-workbench-error">{props.errorMessage}</p> : null}
        </div>
        {props.statusMessage ? <p className="evaluation-workbench-status">{props.statusMessage}</p> : null}
      </header>

      {normalizedPrefilledManuscriptId.length > 0 ? (
        <div className="evaluation-workbench-result">
          <strong>Manuscript Handoff</strong>
          <div className="evaluation-workbench-history-compare">
            <span>Context manuscript: {normalizedPrefilledManuscriptId}</span>
            <span>
              {props.overview.manuscriptContext?.matchedRunId
                ? `Matched run: ${props.overview.manuscriptContext.matchedRunId}`
                : "No matched evaluation run yet"}
            </span>
            <span>
              {props.overview.manuscriptContext?.matchedSuiteId
                ? `Matched suite: ${props.overview.manuscriptContext.matchedSuiteId}`
                : "Showing the default evaluation suite"}
            </span>
          </div>
        </div>
      ) : null}

      <section className="evaluation-workbench-panel evaluation-workbench-delta-summary">
        <div className="evaluation-workbench-panel-header">
          <h3>Delta Summary</h3>
          <span>{describeHistoryWindowPresetLabel(props.overview.suiteOperations.defaultWindow)}</span>
        </div>
        {props.overview.suiteOperations.delta != null && defaultComparison != null ? (
          <>
            <div className="evaluation-workbench-delta-badge-row">
              <span className={`evaluation-workbench-delta-badge is-${props.overview.suiteOperations.delta.classification}`}>
                Classification: {props.overview.suiteOperations.delta.classification}
              </span>
              <span className="evaluation-workbench-delta-inline-note">
                Default comparison: {defaultComparison.selected.run.id} vs {defaultComparison.baseline.run.id}.
              </span>
            </div>
            <p className="evaluation-workbench-delta-copy">
              {describeDeltaReasonCopy({
                delta: props.overview.suiteOperations.delta,
                defaultComparison,
              })}
            </p>
            <p className="evaluation-workbench-delta-copy">
              Next operator cue:{" "}
              {describeDeltaNextOperatorCue({
                selectedEntry: defaultComparison.selected,
                baselineEntry: defaultComparison.baseline,
              })}
            </p>
            <div className="evaluation-workbench-delta-meta">
              <span>Latest-versus-previous finalized comparison</span>
              <span>
                Visible history window: {visibleHistory.length} of {props.overview.finalizedRunHistory.length} finalized runs are in scope.
              </span>
            </div>
          </>
        ) : (
          <>
            <p className="evaluation-workbench-delta-copy">
              {describeHonestDegradationCopy({
                honestDegradation: props.overview.suiteOperations.honestDegradation,
                windowPreset: props.overview.suiteOperations.defaultWindow,
              })}
            </p>
            <p className="evaluation-workbench-delta-copy">
              {describeHonestDegradationNextStep(props.overview.suiteOperations.honestDegradation)}
            </p>
          </>
        )}
      </section>

      <section className="evaluation-workbench-panel evaluation-workbench-comparison-panel">
        <div className="evaluation-workbench-panel-header">
          <h3>Run Comparison</h3>
          <span>Latest-versus-previous finalized comparison</span>
        </div>
        {defaultComparison != null && defaultComparisonDetail != null ? (
          <EvaluationWorkbenchRunComparisonCard
            comparisonScopeLabel="Latest-versus-previous finalized comparison"
            selectedEntry={defaultComparison.selected}
            previousEntry={defaultComparison.baseline}
            selectedEvidence={[...defaultComparisonDetail.selectedEvidence]}
            previousEvidence={[...defaultComparisonDetail.baselineEvidence]}
          />
        ) : (
          <div className="evaluation-workbench-result evaluation-workbench-history-guidance">
            <strong>Comparison unavailable</strong>
            <p className="evaluation-workbench-empty">
              {describeHonestDegradationCopy({
                honestDegradation: props.overview.suiteOperations.honestDegradation,
                windowPreset: props.overview.suiteOperations.defaultWindow,
              })}
            </p>
          </div>
        )}
      </section>

      <section className="evaluation-workbench-summary">
        <SummaryCard label="Check Profiles" value={props.overview.checkProfiles.length} />
        <SummaryCard label="Release Profiles" value={props.overview.releaseCheckProfiles.length} />
        <SummaryCard label="Sample Sets" value={props.overview.sampleSets.length} />
        <SummaryCard label="Suites" value={props.overview.suites.length} />
        <SummaryCard label="Runs" value={props.overview.runs.length} />
        <SummaryCard label="Run Items" value={props.overview.runItems.length} />
      </section>

      <div className="evaluation-workbench-layout">
        <section className="evaluation-workbench-panel">
          <div className="evaluation-workbench-panel-header">
            <h3>Visible History</h3>
            <span>{visibleHistory.length} visible / {props.overview.finalizedRunHistory.length} total</span>
          </div>
          <p className="evaluation-workbench-empty">
            Visible history window: {visibleHistory.length} of {props.overview.finalizedRunHistory.length} finalized runs are in scope.
          </p>
          <div className="evaluation-workbench-control-grid">
            <Field label="History Window">
              <select
                value={props.overview.suiteOperations.defaultWindow}
                onChange={(event) =>
                  props.onSelectHistoryWindow(
                    event.target.value as EvaluationWorkbenchHistoryWindowPreset,
                  )
                }
              >
                {createHistoryWindowOptions().map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Recommendation Filter">
              <select
                value={props.historyFilter}
                onChange={(event) =>
                  props.onSelectHistoryFilter(
                    event.target.value as EvaluationWorkbenchHistoryFilter,
                  )
                }
              >
                {createHistoryFilterControlOptions().map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sort Mode">
              <select
                value={props.historySortMode}
                onChange={(event) =>
                  props.onSelectHistorySortMode(
                    event.target.value as EvaluationWorkbenchHistorySortMode,
                  )
                }
              >
                {createHistorySortControlOptions().map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {selectedRunOutsideVisibleWindow && selectedRun ? (
            <div className="evaluation-workbench-result evaluation-workbench-history-hidden-selection">
              <strong>Selected inspection run: {selectedRun.id}</strong>
              <p className="evaluation-workbench-empty">
                Selected run {selectedRun.id} is outside the visible history window.
              </p>
            </div>
          ) : null}
          {sortedVisibleHistory.length > 0 ? (
            <ul className="evaluation-workbench-stack evaluation-workbench-history-list">
              {sortedVisibleHistory.map((entry) => (
                <li key={entry.run.id}>
                  <button
                    type="button"
                    aria-label={`History run ${entry.run.id}`}
                    className={`evaluation-workbench-select${entry.run.id === selectedRun?.id ? " is-selected" : ""}`}
                    onClick={() => props.onSelectRun(entry.run.id)}
                  >
                    <strong>{entry.run.id}</strong>
                    <span>
                      {describeHistoryStatusPair(
                        entry.finalized.recommendation.status,
                        entry.finalized.evidence_pack.summary_status,
                      )}
                    </span>
                    <EvaluationWorkbenchHistoryEntrySignals entry={entry} />
                    {summarizeFinalizedEntry(entry) ? <span>{summarizeFinalizedEntry(entry)}</span> : null}
                    {describeDefaultComparisonRoleLabel(entry.run.id, defaultComparison).map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="evaluation-workbench-result evaluation-workbench-history-empty-state">
              <strong>No finalized runs match the current history controls.</strong>
            </div>
          )}
        </section>

        <section className="evaluation-workbench-panel">
          <div className="evaluation-workbench-panel-header">
            <h3>Suite Signal Summary</h3>
            <span>{describeHistoryWindowPresetLabel(props.overview.suiteOperations.defaultWindow)}</span>
          </div>
          <div className="evaluation-workbench-history-summary-grid">
            <article className="evaluation-workbench-history-summary-card">
              <strong>Recommendation Distribution</strong>
              <span>
                {formatSignalDistributionSummary(
                  props.overview.suiteOperations.signals.recommendationDistribution,
                )}
              </span>
            </article>
            <article className="evaluation-workbench-history-summary-card">
              <strong>Evidence Pack Outcomes</strong>
              <span>
                {formatSignalDistributionSummary(
                  props.overview.suiteOperations.signals.evidencePackOutcomeMix,
                )}
              </span>
            </article>
            <article className="evaluation-workbench-history-summary-card">
              <strong>Recurrence Signals</strong>
              <span>
                {formatRecurrenceSignalSummary(props.overview.suiteOperations.signals.recurrence)}
              </span>
            </article>
          </div>
        </section>

        <section className="evaluation-workbench-panel">
          <div className="evaluation-workbench-panel-header">
            <h3>Suites</h3>
            <span>{props.overview.suites.length} configured</span>
          </div>
          {props.overview.suites.length === 0 ? (
            <p className="evaluation-workbench-empty">No evaluation suites are configured yet.</p>
          ) : (
            <ul className="evaluation-workbench-stack">
              {props.overview.suites.map((suite) => (
                <li key={suite.id}>
                  <button
                    type="button"
                    className={`evaluation-workbench-select${suite.id === props.overview.selectedSuiteId ? " is-selected" : ""}`}
                    onClick={() => props.onSelectSuite(suite.id)}
                  >
                    <strong>{suite.name}</strong>
                    <span>{suite.suite_type} | {suite.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="evaluation-workbench-panel">
          <div className="evaluation-workbench-panel-header">
            <h3>Selected Inspection</h3>
            <span>{selectedRun?.id ?? "Select run first"}</span>
          </div>
          {selectedRun == null ? (
            <p className="evaluation-workbench-empty">
              Select a run to inspect its finalized evidence and read-only details.
            </p>
          ) : (
            <>
              <div className="evaluation-workbench-result evaluation-workbench-history-detail">
                <strong>Selected inspection run: {selectedRun.id}</strong>
                <div className="evaluation-workbench-history-compare">
                  <span>Status: {selectedRun.status}</span>
                  <span>Run items: {selectedRun.run_item_count ?? 0}</span>
                  {selectedInspectionFinalization ? (
                    <>
                      <span>Recommendation: {selectedInspectionFinalization.recommendation.status}</span>
                      <span>Evidence Pack: {selectedInspectionFinalization.evidence_pack.id}</span>
                      {selectedInspectionFinalization.recommendation.decision_reason ? (
                        <span>{selectedInspectionFinalization.recommendation.decision_reason}</span>
                      ) : null}
                    </>
                  ) : (
                    <span>No finalized recommendation is available for the selected inspection run yet.</span>
                  )}
                  {selectedRunOutsideVisibleWindow ? (
                    <span>
                      This run is outside the finalized history slice that powers the default delta summary.
                    </span>
                  ) : null}
                  {!selectedRunOutsideVisibleWindow && !selectedInspectionFinalization ? (
                    <span>
                      This run remains within the visible history window but has not been finalized yet.
                    </span>
                  ) : null}
                </div>
              </div>
              {selectedInspectionFinalization ? (
                <EvaluationWorkbenchEvidencePackSummary
                  evidencePack={selectedInspectionFinalization.evidence_pack}
                />
              ) : null}
              {selectedRun.governed_source ? (
                <EvaluationWorkbenchGovernedSourceDetailCard selectedRun={selectedRun} />
              ) : null}
              {props.overview.runItems.length > 0 ? (
                <>
                  <EvaluationWorkbenchLinkedSampleContextList
                    runItems={props.overview.runItems}
                    sampleSetItems={props.overview.sampleSetItems}
                    selectedRunItemId={props.selectedRunItemId}
                    defaultWorkbenchMode={resolveLinkedSampleWorkbenchMode(selectedSampleSet?.module)}
                    onFocusRunItem={props.onSelectRunItem}
                  />
                  {selectedRunItem && linkedSampleSetItem ? (
                    <EvaluationWorkbenchSelectedRunItemDetailCard
                      selectedRun={selectedRun}
                      selectedRunItem={selectedRunItem}
                      linkedSampleSetItem={linkedSampleSetItem}
                    />
                  ) : null}
                </>
              ) : (
                <p className="evaluation-workbench-empty">
                  This inspection lane stays read-only and no sample-backed run items are available for the selected run.
                </p>
              )}
              <EvaluationWorkbenchEvidenceList
                evidence={props.overview.selectedRunEvidence}
                emptyMessage="No persisted verification evidence is attached to this run."
              />
            </>
          )}
        </section>
      </div>
    </section>
  );
}

function describeDefaultComparisonRoleLabel(
  entryRunId: string,
  defaultComparison: EvaluationWorkbenchOverview["suiteOperations"]["defaultComparison"],
) {
  if (defaultComparison == null) return [];
  if (entryRunId === defaultComparison.selected.run.id) {
    return ["Default latest run"];
  }
  if (entryRunId === defaultComparison.baseline.run.id) {
    return ["Default baseline"];
  }
  return [];
}

function describeDeltaReasonCopy(input: {
  delta: NonNullable<EvaluationWorkbenchOverview["suiteOperations"]["delta"]>;
  defaultComparison: NonNullable<EvaluationWorkbenchOverview["suiteOperations"]["defaultComparison"]>;
}) {
  const selectedRecommendation = input.defaultComparison.selected.finalized.recommendation.status;
  const baselineRecommendation = input.defaultComparison.baseline.finalized.recommendation.status;
  const selectedStatus = input.defaultComparison.selected.run.status;
  const baselineStatus = input.defaultComparison.baseline.run.status;

  if (input.delta.reason === "recommendation_improved") {
    return `Chosen because the latest finalized recommendation improved from ${baselineRecommendation} to ${selectedRecommendation}.`;
  }
  if (input.delta.reason === "recommendation_regressed") {
    return `Chosen because the latest finalized recommendation regressed from ${baselineRecommendation} to ${selectedRecommendation}.`;
  }
  if (input.delta.reason === "finalized_status_improved") {
    return `Chosen because the latest finalized run status improved from ${baselineStatus} to ${selectedStatus}.`;
  }
  if (input.delta.reason === "finalized_status_regressed") {
    return `Chosen because the latest finalized run status regressed from ${baselineStatus} to ${selectedStatus}.`;
  }
  return `Chosen because the latest finalized comparison showed no material change between ${input.defaultComparison.selected.run.id} and ${input.defaultComparison.baseline.run.id}.`;
}

function describeDeltaNextOperatorCue(input: {
  selectedEntry: EvaluationWorkbenchFinalizedRunHistoryEntry;
  baselineEntry: EvaluationWorkbenchFinalizedRunHistoryEntry;
}) {
  const selectedScore = parseAverageWeightedScore(input.selectedEntry.finalized.evidence_pack.score_summary);
  const baselineScore = parseAverageWeightedScore(input.baselineEntry.finalized.evidence_pack.score_summary);
  return describeComparisonTriageHint({
    selectedStatus: input.selectedEntry.finalized.recommendation.status,
    previousStatus: input.baselineEntry.finalized.recommendation.status,
    scoreDelta:
      selectedScore != null && baselineScore != null ? selectedScore - baselineScore : null,
  });
}

function describeHonestDegradationCopy(input: {
  honestDegradation: EvaluationWorkbenchOverview["suiteOperations"]["honestDegradation"];
  windowPreset: EvaluationWorkbenchHistoryWindowPreset;
}) {
  if (input.honestDegradation?.reason === "fewer_than_two_visible_finalized_runs") {
    return `Honest degradation: fewer than two finalized runs are visible in the ${describeHistoryWindowPresetLabel(input.windowPreset)} window, so no default delta can be claimed yet.`;
  }
  if (input.honestDegradation?.reason === "insufficient_comparison_data") {
    return "Honest degradation: the visible finalized runs do not provide enough comparison data to classify the suite as better, worse, or flat.";
  }
  return "Honest degradation: no default comparison is currently available for this suite.";
}

function describeHonestDegradationNextStep(
  honestDegradation: EvaluationWorkbenchOverview["suiteOperations"]["honestDegradation"],
) {
  if (honestDegradation?.reason === "fewer_than_two_visible_finalized_runs") {
    return "Finalize one more run in the visible window before treating the suite as improved, worse, or flat.";
  }
  if (honestDegradation?.reason === "insufficient_comparison_data") {
    return "Inspect the latest finalized runs directly until a deterministic comparison pair becomes available.";
  }
  return "Inspect the selected run directly until a deterministic comparison pair becomes available.";
}

function createHistoryWindowOptions() {
  return [
    { value: "latest_10" as const, label: "Latest 10" },
    { value: "last_7_days" as const, label: "Last 7 Days" },
    { value: "last_30_days" as const, label: "Last 30 Days" },
    { value: "all_suite" as const, label: "All Suite History" },
  ];
}

function describeHistoryWindowPresetLabel(preset: EvaluationWorkbenchHistoryWindowPreset) {
  return (
    createHistoryWindowOptions().find((option) => option.value === preset)?.label ?? "Latest 10"
  );
}

function createHistoryFilterControlOptions() {
  return [
    { value: "all" as const, label: "All" },
    { value: "recommended" as const, label: "Recommended" },
    { value: "needs_review" as const, label: "Needs Review" },
    { value: "rejected" as const, label: "Rejected" },
  ];
}

function createHistorySortControlOptions() {
  return [
    { value: "newest" as const, label: "Newest First" },
    { value: "failures_first" as const, label: "Failures First" },
  ];
}

function formatSignalDistributionSummary(input: {
  recommended: number;
  needs_review: number;
  rejected: number;
}) {
  return `${input.recommended} recommended / ${input.needs_review} needs review / ${input.rejected} rejected`;
}

function formatRecurrenceSignalSummary(input: {
  regressionMentions: number;
  failureMentions: number;
  runsWithRecurrenceSignals: number;
}) {
  return `${input.regressionMentions} regression mentions / ${input.failureMentions} failure mentions / ${input.runsWithRecurrenceSignals} runs flagged`;
}

export function EvaluationWorkbenchRunComparisonCard(props: {
  comparisonScopeLabel: string;
  selectedOriginLabel?: string | null;
  previousOriginLabel?: string | null;
  selectedEntry: EvaluationWorkbenchFinalizedRunHistoryEntry;
  previousEntry: EvaluationWorkbenchFinalizedRunHistoryEntry;
  selectedEvidence: VerificationEvidenceViewModel[];
  previousEvidence: VerificationEvidenceViewModel[];
}) {
  const bindingChanges = summarizeBindingChanges(props.selectedEntry.run, props.previousEntry.run);
  const evidencePackChanges = summarizeEvidencePackChanges(
    props.selectedEntry.finalized.evidence_pack,
    props.previousEntry.finalized.evidence_pack,
  );
  const recommendationShift = describeRecommendationShift(
    props.selectedEntry.finalized.recommendation.status,
    props.previousEntry.finalized.recommendation.status,
  );
  const evidenceCountSummary = describeEvidenceCountChange(
    props.selectedEvidence,
    props.previousEvidence,
  );
  const operatorSummary = describeComparisonOperatorSummary({
    comparisonScopeLabel: props.comparisonScopeLabel,
    selectedStatus: props.selectedEntry.finalized.recommendation.status,
    previousStatus: props.previousEntry.finalized.recommendation.status,
    selectedScoreSummary: props.selectedEntry.finalized.evidence_pack.score_summary,
    previousScoreSummary: props.previousEntry.finalized.evidence_pack.score_summary,
  });
  const baselinePolicy = describeComparisonBaselinePolicy(props.comparisonScopeLabel);
  const selectedScore = parseAverageWeightedScore(props.selectedEntry.finalized.evidence_pack.score_summary);
  const previousScore = parseAverageWeightedScore(props.previousEntry.finalized.evidence_pack.score_summary);
  const scoreDelta =
    selectedScore != null && previousScore != null ? selectedScore - previousScore : null;
  const triageHint = describeComparisonTriageHint({
    selectedStatus: props.selectedEntry.finalized.recommendation.status,
    previousStatus: props.previousEntry.finalized.recommendation.status,
    scoreDelta,
  });

  return (
    <div className="evaluation-workbench-result evaluation-workbench-history-comparison">
      <strong>Comparing against {props.previousEntry.run.id}</strong>
      <div className="evaluation-workbench-history-compare">
        <span>{operatorSummary}</span>
        <span>{baselinePolicy}</span>
        <span>{triageHint}</span>
        <span>Comparison scope: {props.comparisonScopeLabel}</span>
        {props.selectedOriginLabel ? (
          <span>Selected origin: {props.selectedOriginLabel}</span>
        ) : null}
        {props.previousOriginLabel ? (
          <span>Previous origin: {props.previousOriginLabel}</span>
        ) : null}
        <span>{recommendationShift}</span>
        <span>{evidenceCountSummary}</span>
        <span>Selected recommendation: {props.selectedEntry.finalized.recommendation.status}</span>
        <span>Previous recommendation: {props.previousEntry.finalized.recommendation.status}</span>
        <span>Selected summary: {summarizeFinalizedEntry(props.selectedEntry)}</span>
        <span>Previous summary: {summarizeFinalizedEntry(props.previousEntry)}</span>
      </div>
      <div className="evaluation-workbench-history-compare">
        <strong>Binding Changes</strong>
        {bindingChanges.length > 0 ? (
          bindingChanges.map((change) => <span key={change}>{change}</span>)
        ) : (
          <span>Bindings unchanged from the previous finalized run.</span>
        )}
        <span>Selected evidence: {summarizeEvidenceLabels(props.selectedEvidence)}</span>
        <span>Previous evidence: {summarizeEvidenceLabels(props.previousEvidence)}</span>
      </div>
      <div className="evaluation-workbench-history-compare">
        <strong>Evidence Pack Changes</strong>
        {evidencePackChanges.length > 0 ? (
          evidencePackChanges.map((change) => <span key={change}>{change}</span>)
        ) : (
          <span>Evidence-pack summaries unchanged from the previous finalized run.</span>
        )}
      </div>
      <div className="evaluation-workbench-history-summary-grid">
        <div className="evaluation-workbench-history-summary-card">
          <strong>Selected evidence pack</strong>
          <EvaluationWorkbenchEvidencePackSummary
            evidencePack={props.selectedEntry.finalized.evidence_pack}
          />
        </div>
        <div className="evaluation-workbench-history-summary-card">
          <strong>Previous evidence pack</strong>
          <EvaluationWorkbenchEvidencePackSummary
            evidencePack={props.previousEntry.finalized.evidence_pack}
          />
        </div>
      </div>
    </div>
  );
}

export function EvaluationWorkbenchFinalizePanel(props: {
  selectedRun: EvaluationWorkbenchOverview["runs"][number] | null;
  effectiveFinalizedResult: FinalizeEvaluationRunResultViewModel | null;
  finalizeForm: typeof baseFinalizeForm;
  finalizeArtifactOptions: ReturnType<typeof createFinalizeArtifactOptions>;
  selectedRunEvidence: VerificationEvidenceViewModel[];
  isBusy: boolean;
  onFinalizeStatusChange: (status: "passed" | "failed") => void;
  onEvidenceKindChange: (kind: VerificationEvidenceKind) => void;
  onEvidenceLabelChange: (label: string) => void;
  onEvidenceUrlChange: (url: string) => void;
  onArtifactAssetIdChange: (assetId: string) => void;
  onSelectArtifactSuggestion: (assetId: string) => void;
  onCompleteAndFinalize: () => void;
  onFinalizeRecommendation: () => void;
}) {
  const finalizeMode = resolveFinalizeRunMode({
    selectedRun: props.selectedRun,
    hasFinalizedResult: props.effectiveFinalizedResult != null,
  });

  if (props.selectedRun == null) {
    return (
      <p className="evaluation-workbench-empty">
        Choose a run before recording evidence and finalizing it.
      </p>
    );
  }

  if (finalizeMode === "finalize_recommendation") {
    return (
      <>
        <div className="evaluation-workbench-result">
          <strong>Machine-Completed Governed Run</strong>
          <div className="evaluation-workbench-history-compare">
            <span>Run Status: {props.selectedRun.status}</span>
            {props.selectedRun.governed_source ? (
              <span>
                Governed Source: {props.selectedRun.governed_source.source_module} /{" "}
                {props.selectedRun.governed_source.manuscript_id}
              </span>
            ) : null}
          </div>
          <p className="evaluation-workbench-empty">
            Automatic governed checks completed. Review machine evidence before finalizing.
          </p>
          <EvaluationWorkbenchEvidenceList
            evidence={props.selectedRunEvidence}
            emptyMessage="No persisted machine evidence is attached to this governed run."
          />
        </div>
        <button
          type="button"
          onClick={props.onFinalizeRecommendation}
          disabled={props.isBusy}
        >
          Finalize Recommendation
        </button>
      </>
    );
  }

  if (props.effectiveFinalizedResult) {
    return (
      <div className="evaluation-workbench-result evaluation-workbench-finalized">
        <strong>Finalized Recommendation</strong>
        <div>
          <span>Run: {props.effectiveFinalizedResult.run.id}</span>
          <span>Evidence Pack: {props.effectiveFinalizedResult.evidence_pack.id}</span>
          <span>Summary: {props.effectiveFinalizedResult.evidence_pack.summary_status}</span>
          <span>Recommendation: {props.effectiveFinalizedResult.recommendation.status}</span>
          {props.effectiveFinalizedResult.recommendation.decision_reason ? (
            <span>{props.effectiveFinalizedResult.recommendation.decision_reason}</span>
          ) : null}
        </div>
        <EvaluationWorkbenchEvidencePackSummary
          evidencePack={props.effectiveFinalizedResult.evidence_pack}
        />
        <EvaluationWorkbenchEvidenceList evidence={props.selectedRunEvidence} />
      </div>
    );
  }

  return (
    <>
      <div className="evaluation-workbench-form-grid">
        <Field label="Run Status">
          <select
            value={props.finalizeForm.status}
            onChange={(event) =>
              props.onFinalizeStatusChange(event.target.value as "passed" | "failed")
            }
          >
            <option value="passed">passed</option>
            <option value="failed">failed</option>
          </select>
        </Field>
        <Field label="Evidence Type">
          <select
            value={props.finalizeForm.evidenceKind}
            onChange={(event) =>
              props.onEvidenceKindChange(event.target.value as VerificationEvidenceKind)
            }
          >
            <option value="url">url</option>
            <option value="artifact">artifact</option>
          </select>
        </Field>
        <Field label="Evidence Label">
          <input
            value={props.finalizeForm.evidenceLabel}
            onChange={(event) => props.onEvidenceLabelChange(event.target.value)}
          />
        </Field>
        {props.finalizeForm.evidenceKind === "url" ? (
          <Field label="Evidence URL" wide>
            <input
              value={props.finalizeForm.evidenceUrl}
              onChange={(event) => props.onEvidenceUrlChange(event.target.value)}
            />
          </Field>
        ) : (
          <Field label="Artifact Asset ID" wide>
            <input
              value={props.finalizeForm.artifactAssetId}
              onChange={(event) => props.onArtifactAssetIdChange(event.target.value)}
            />
          </Field>
        )}
      </div>
      {props.finalizeForm.evidenceKind === "artifact" ? (
        props.finalizeArtifactOptions.length > 0 ? (
          <div
            className="evaluation-workbench-inline-list"
            role="group"
            aria-label="Artifact evidence suggestions"
          >
            {props.finalizeArtifactOptions.map((option) => (
              <button
                key={`${option.source}-${option.assetId}`}
                type="button"
                className="evaluation-workbench-action"
                onClick={() => props.onSelectArtifactSuggestion(option.assetId)}
              >
                {option.actionLabel}
              </button>
            ))}
          </div>
        ) : (
          <p className="evaluation-workbench-empty">
            Save a run-item result or load linked sample context to reuse an internal artifact as
            evidence.
          </p>
        )
      ) : null}
      <button type="button" onClick={props.onCompleteAndFinalize} disabled={props.isBusy}>
        Complete And Finalize Run
      </button>
      <p className="evaluation-workbench-empty">
        Finalize the run to produce a governed recommendation.
      </p>
    </>
  );
}

export function EvaluationWorkbenchEvidenceList(props: {
  evidence: VerificationEvidenceViewModel[];
  emptyMessage?: string;
}) {
  const { evidence, emptyMessage = "No persisted verification evidence is attached yet." } = props;

  if (evidence.length === 0) {
    return <p className="evaluation-workbench-empty">{emptyMessage}</p>;
  }

  return (
    <ul className="evaluation-workbench-inline-list">
      {evidence.map((item) => (
        <li key={item.id}>
          <strong>{item.label}</strong>
          <span>{item.kind}</span>
          <span>{item.uri ?? item.artifact_asset_id ?? item.id}</span>
          {item.kind === "url" && item.uri ? (
            <a href={item.uri} target="_blank" rel="noreferrer">
              Open evidence link
            </a>
          ) : null}
          {item.kind === "artifact" && item.artifact_asset_id ? (
            <a href={`/api/v1/document-assets/${item.artifact_asset_id}/download`}>
              Download evidence artifact
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function EvaluationWorkbenchEvidencePackSummary(props: {
  evidencePack: EvaluationWorkbenchOverview["finalizedRunHistory"][number]["finalized"]["evidence_pack"];
}) {
  const { evidencePack } = props;
  const summaryRows = [
    { label: "Summary Status", value: evidencePack.summary_status },
    { label: "Score Summary", value: evidencePack.score_summary },
    { label: "Regression Summary", value: evidencePack.regression_summary },
    { label: "Failure Summary", value: evidencePack.failure_summary },
    { label: "Cost Summary", value: evidencePack.cost_summary },
    { label: "Latency Summary", value: evidencePack.latency_summary },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));

  if (summaryRows.length === 0) {
    return (
      <p className="evaluation-workbench-empty">
        No evidence-pack summaries were recorded for this finalized run.
      </p>
    );
  }

  return (
    <div className="evaluation-workbench-history-compare">
      {summaryRows.map((row) => (
        <span key={row.label}>
          <strong>{row.label}:</strong> {row.value}
        </span>
      ))}
    </div>
  );
}

export function EvaluationWorkbenchHistoryEntrySignals(props: {
  entry: EvaluationWorkbenchOverview["finalizedRunHistory"][number];
}) {
  const summaryRows = [
    { label: "Score", value: props.entry.finalized.evidence_pack.score_summary },
    { label: "Regression", value: props.entry.finalized.evidence_pack.regression_summary },
    { label: "Failure", value: props.entry.finalized.evidence_pack.failure_summary },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));

  if (summaryRows.length === 0) {
    return null;
  }

  return (
    <div className="evaluation-workbench-history-signals">
      {summaryRows.map((row) => (
        <span key={row.label}>
          <strong>{row.label}:</strong> {row.value}
        </span>
      ))}
    </div>
  );
}

export function EvaluationWorkbenchLinkedSampleContextList(props: {
  runItems: EvaluationWorkbenchOverview["runItems"];
  sampleSetItems: EvaluationWorkbenchOverview["sampleSetItems"];
  selectedRunItemId?: string | null;
  defaultWorkbenchMode?: ManuscriptWorkbenchMode;
  onFocusRunItem?: (runItemId: string) => void;
}) {
  if (props.runItems.length === 0) {
    return (
      <p className="evaluation-workbench-empty">
        No run-item sample context is available for this history selection.
      </p>
    );
  }

  return (
    <div className="evaluation-workbench-history-compare">
      <strong>Linked Sample Context</strong>
      <ul className="evaluation-workbench-inline-list evaluation-workbench-linked-sample-list">
        {props.runItems.map((runItem) => {
          const sampleSetItem =
            props.sampleSetItems.find((item) => item.id === runItem.sample_set_item_id) ?? null;
          const isFocused = props.selectedRunItemId === runItem.id;
          const manuscriptWorkbenchMode = resolveLinkedSampleWorkbenchMode(
            sampleSetItem?.module,
            props.defaultWorkbenchMode,
          );
          const manuscriptWorkbenchHash = createLinkedSampleWorkbenchHash({
            mode: manuscriptWorkbenchMode,
            manuscriptId: sampleSetItem?.manuscript_id,
            reviewedCaseSnapshotId: sampleSetItem?.reviewed_case_snapshot_id,
            sampleSetItemId: sampleSetItem?.id,
          });
          return (
            <li key={runItem.id}>
              <strong>Run Item: {runItem.id}</strong>
              {isFocused ? <span>Focused</span> : null}
              <span>Lane: {runItem.lane}</span>
              <span>Weighted Score: {runItem.weighted_score ?? "Not scored"}</span>
              {runItem.failure_reason ? <span>Failure: {runItem.failure_reason}</span> : null}
              {sampleSetItem ? (
                <>
                  <span>Sample Item: {sampleSetItem.id}</span>
                  <span>Module: {sampleSetItem.module}</span>
                  <span>Manuscript Type: {sampleSetItem.manuscript_type}</span>
                  <span>Reviewed Snapshot: {sampleSetItem.reviewed_case_snapshot_id}</span>
                  <span>Manuscript: {sampleSetItem.manuscript_id}</span>
                </>
              ) : (
                <span>No linked sample-set item is available for this run item.</span>
              )}
              {runItem.result_asset_id ? (
                <a href={`/api/v1/document-assets/${runItem.result_asset_id}/download`}>
                  Download Result Asset
                </a>
              ) : null}
              {sampleSetItem?.snapshot_asset_id ? (
                <a href={`/api/v1/document-assets/${sampleSetItem.snapshot_asset_id}/download`}>
                  Download Sample Snapshot
                </a>
              ) : null}
              {manuscriptWorkbenchHash ? (
                <a href={manuscriptWorkbenchHash}>
                  {createLinkedSampleWorkbenchLabel(manuscriptWorkbenchMode)}
                </a>
              ) : null}
              {props.onFocusRunItem ? (
                <button
                  type="button"
                  className="evaluation-workbench-action"
                  onClick={() => props.onFocusRunItem?.(runItem.id)}
                >
                  Focus Run Item {runItem.id}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function EvaluationWorkbenchSelectedRunItemDetailCard(props: {
  selectedRun: EvaluationWorkbenchOverview["runs"][number];
  selectedRunItem: EvaluationWorkbenchOverview["runItems"][number];
  linkedSampleSetItem: EvaluationWorkbenchOverview["sampleSetItems"][number] | null;
}) {
  const { selectedRun, selectedRunItem, linkedSampleSetItem } = props;
  const manuscriptWorkbenchHash = createLinkedSampleWorkbenchHash({
    mode: resolveLinkedSampleWorkbenchMode(linkedSampleSetItem?.module),
    manuscriptId: linkedSampleSetItem?.manuscript_id,
    reviewedCaseSnapshotId: linkedSampleSetItem?.reviewed_case_snapshot_id,
    sampleSetItemId: linkedSampleSetItem?.id,
  });
  const manuscriptWorkbenchLabel = createLinkedSampleWorkbenchLabel(
    resolveLinkedSampleWorkbenchMode(linkedSampleSetItem?.module),
  );

  return (
    <div className="evaluation-workbench-result evaluation-workbench-run-item-detail">
      <strong>Selected Sample Detail</strong>
      <div className="evaluation-workbench-history-compare">
        <span>Run Item: {selectedRunItem.id}</span>
        <span>Lane: {selectedRunItem.lane}</span>
        <span>Hard Gate: {describeHardGate(selectedRunItem.hard_gate_passed)}</span>
        <span>
          Weighted Score: {selectedRunItem.weighted_score == null ? "Pending" : selectedRunItem.weighted_score}
        </span>
        <span>Result Asset: {selectedRunItem.result_asset_id ?? "Pending"}</span>
        <span>Manual Review: {selectedRunItem.requires_human_review ? "Required" : "Not required"}</span>
        {selectedRunItem.diff_summary ? <span>{selectedRunItem.diff_summary}</span> : null}
        {selectedRunItem.failure_reason ? <span>{selectedRunItem.failure_reason}</span> : null}
        {linkedSampleSetItem ? (
          <>
            <span>Sample Item: {linkedSampleSetItem.id}</span>
            <span>Module: {linkedSampleSetItem.module}</span>
            <span>Manuscript Type: {linkedSampleSetItem.manuscript_type}</span>
            <span>Risk Tags: {formatOptionalList(linkedSampleSetItem.risk_tags)}</span>
            <span>Snapshot Asset: {linkedSampleSetItem.snapshot_asset_id}</span>
            <span>Reviewed Snapshot: {linkedSampleSetItem.reviewed_case_snapshot_id}</span>
            <span>Manuscript: {linkedSampleSetItem.manuscript_id}</span>
            {manuscriptWorkbenchHash ? (
              <a href={manuscriptWorkbenchHash}>{manuscriptWorkbenchLabel}</a>
            ) : null}
          </>
        ) : selectedRun.governed_source ? (
          <EvaluationWorkbenchGovernedSourceInlineDetails selectedRun={selectedRun} />
        ) : (
          <span>No linked sample-set item is available for this run item.</span>
        )}
      </div>
      <ul className="evaluation-workbench-inline-list">
        <li>
          <strong>Baseline Binding</strong>
          <span>{summarizeBinding(selectedRun.baseline_binding)}</span>
        </li>
        <li>
          <strong>Candidate Binding</strong>
          <span>{summarizeBinding(selectedRun.candidate_binding)}</span>
        </li>
      </ul>
    </div>
  );
}

export function EvaluationWorkbenchGovernedSourceDetailCard(props: {
  selectedRun: EvaluationWorkbenchOverview["runs"][number];
}) {
  if (!props.selectedRun.governed_source) {
    return (
      <p className="evaluation-workbench-empty">
        No governed source is attached to this run.
      </p>
    );
  }

  return (
    <div className="evaluation-workbench-result evaluation-workbench-run-item-detail">
      <strong>Governed Source Detail</strong>
      <div className="evaluation-workbench-history-compare">
        <span>Run: {props.selectedRun.id}</span>
        <EvaluationWorkbenchGovernedSourceInlineDetails selectedRun={props.selectedRun} />
      </div>
      <ul className="evaluation-workbench-inline-list">
        <li>
          <strong>Baseline Binding</strong>
          <span>{summarizeBinding(props.selectedRun.baseline_binding)}</span>
        </li>
        <li>
          <strong>Candidate Binding</strong>
          <span>{summarizeBinding(props.selectedRun.candidate_binding)}</span>
        </li>
      </ul>
    </div>
  );
}

function EvaluationWorkbenchGovernedSourceInlineDetails(props: {
  selectedRun: EvaluationWorkbenchOverview["runs"][number];
}) {
  const governedSource = props.selectedRun.governed_source;
  if (!governedSource) {
    return null;
  }

  const manuscriptWorkbenchMode = resolveLinkedSampleWorkbenchMode(
    governedSource.source_module,
  );
  const manuscriptWorkbenchHash = createLinkedSampleWorkbenchHash({
    mode: manuscriptWorkbenchMode,
    manuscriptId: governedSource.manuscript_id,
  });
  const outputAssetDownloadHref = createDocumentAssetDownloadHref(
    governedSource.output_asset_id,
  );

  return (
    <>
      <span>Source Module: {governedSource.source_module}</span>
      <span>Manuscript: {governedSource.manuscript_id}</span>
      <span>Execution Snapshot: {governedSource.execution_snapshot_id}</span>
      <span>Agent Execution Log: {governedSource.agent_execution_log_id}</span>
      <span>Output Asset: {governedSource.output_asset_id}</span>
      {props.selectedRun.release_check_profile_id ? (
        <span>Release Check Profile: {props.selectedRun.release_check_profile_id}</span>
      ) : null}
      {outputAssetDownloadHref ? (
        <a href={outputAssetDownloadHref}>Download Governed Output Asset</a>
      ) : null}
      {manuscriptWorkbenchHash ? (
        <a href={manuscriptWorkbenchHash}>
          {createLinkedSampleWorkbenchLabel(manuscriptWorkbenchMode)}
        </a>
      ) : null}
    </>
  );
}

function Field(props: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={`evaluation-workbench-field${props.wide ? " evaluation-workbench-field--wide" : ""}`}><span>{props.label}</span>{props.children}</label>;
}

function SummaryCard(props: { label: string; value: number }) {
  return <article className="evaluation-workbench-summary-card"><span>{props.label}</span><strong>{props.value}</strong></article>;
}

function summarizeCoveredModules(overview: EvaluationWorkbenchOverview) {
  const modules = Array.from(new Set(overview.sampleSets.map((item) => item.module)));
  return modules.length > 0 ? modules.join(", ") : "Not available";
}

function resolveLinkedSampleWorkbenchMode(
  sampleModule: string | null | undefined,
  defaultWorkbenchMode: ManuscriptWorkbenchMode = "editing",
): ManuscriptWorkbenchMode {
  if (
    sampleModule === "submission" ||
    sampleModule === "screening" ||
    sampleModule === "editing" ||
    sampleModule === "proofreading"
  ) {
    return sampleModule;
  }

  return defaultWorkbenchMode;
}

function createLinkedSampleWorkbenchLabel(mode: ManuscriptWorkbenchMode): string {
  if (mode === "submission") return "Open Submission Workbench";
  if (mode === "screening") return "Open Screening Workbench";
  if (mode === "editing") return "Open Editing Workbench";
  return "Open Proofreading Workbench";
}

function createLinkedSampleWorkbenchHash(input: {
  mode: ManuscriptWorkbenchMode;
  manuscriptId: string | null | undefined;
  reviewedCaseSnapshotId?: string | null;
  sampleSetItemId?: string | null;
}) {
  if (!input.manuscriptId?.trim()) {
    return null;
  }

  return formatWorkbenchHash(input.mode, {
    manuscriptId: input.manuscriptId,
    reviewedCaseSnapshotId: input.reviewedCaseSnapshotId ?? undefined,
    sampleSetItemId: input.sampleSetItemId ?? undefined,
  });
}

function formatRunItemSummary(item: EvaluationWorkbenchOverview["runItems"][number]) {
  return [
    item.hard_gate_passed == null ? "Hard gate pending" : item.hard_gate_passed ? "Hard gate passed" : "Hard gate failed",
    item.weighted_score == null ? "Score pending" : `Score ${item.weighted_score}`,
    item.requires_human_review ? "Needs review" : "No manual review flag",
  ].join(" | ");
}

function summarizeHistoryCounts(
  entries: EvaluationWorkbenchOverview["finalizedRunHistory"],
) {
  return entries.reduce(
    (summary, entry) => {
      if (entry.finalized.recommendation.status === "recommended") summary.recommended += 1;
      if (entry.finalized.recommendation.status === "needs_review") summary.needsReview += 1;
      if (entry.finalized.recommendation.status === "rejected") summary.rejected += 1;
      return summary;
    },
    { recommended: 0, needsReview: 0, rejected: 0 },
  );
}

function createHistoryFilterOptions(
  historyCounts: ReturnType<typeof summarizeHistoryCounts>,
  total: number,
) {
  return [
    { value: "all" as const, label: `All (${total})` },
    {
      value: "recommended" as const,
      label: `Recommended (${historyCounts.recommended})`,
    },
    {
      value: "needs_review" as const,
      label: `Needs Review (${historyCounts.needsReview})`,
    },
    { value: "rejected" as const, label: `Rejected (${historyCounts.rejected})` },
  ];
}

function createHistoryScopeOptions(manuscriptRunCount: number) {
  return [
    { value: "suite" as const, label: "Entire Suite History" },
    {
      value: "manuscript" as const,
      label: `Matched Manuscript Runs (${manuscriptRunCount})`,
    },
  ];
}

function createHistorySortOptions() {
  return [
    { value: "newest" as const, label: "Newest" },
    { value: "failures_first" as const, label: "Failures First" },
  ];
}

function filterFinalizedRunHistoryByScope(
  entries: EvaluationWorkbenchOverview["finalizedRunHistory"],
  scope: EvaluationWorkbenchHistoryScope,
  matchedRunIds: readonly string[],
) {
  if (scope === "suite") return entries;

  const matchedRunIdSet = new Set(matchedRunIds);
  return entries.filter((entry) => matchedRunIdSet.has(entry.run.id));
}

function describeHistoryResultCount(input: {
  totalFinalizedCount: number;
  scopedCount: number;
  visibleCount: number;
  filter: EvaluationWorkbenchHistoryFilter;
  query: string;
  scope: EvaluationWorkbenchHistoryScope;
}) {
  const scopeLabel =
    input.scope === "manuscript" ? "manuscript-scoped finalized runs" : "finalized runs";
  const hasSecondaryControls =
    input.filter !== "all" || input.query.trim().length > 0 || input.scope === "manuscript";

  if (!hasSecondaryControls) {
    return `${input.totalFinalizedCount} ${scopeLabel}`;
  }

  return `${input.visibleCount} of ${input.scopedCount} ${scopeLabel}`;
}

export function filterFinalizedRunHistory(
  entries: ReadonlyArray<EvaluationWorkbenchFinalizedRunHistoryEntry>,
  filter: EvaluationWorkbenchHistoryFilter,
) {
  if (filter === "all") return entries;
  return entries.filter((entry) => entry.finalized.recommendation.status === filter);
}

export function sortFinalizedRunHistory(
  entries: ReadonlyArray<EvaluationWorkbenchFinalizedRunHistoryEntry>,
  sortMode: EvaluationWorkbenchHistorySortMode,
) {
  const nextEntries = [...entries];
  if (sortMode === "newest") {
    return nextEntries.sort((left, right) => compareHistoryRecency(left, right));
  }

  return nextEntries.sort((left, right) => {
    const severityDelta =
      getRecommendationSeverity(left.finalized.recommendation.status) -
      getRecommendationSeverity(right.finalized.recommendation.status);
    if (severityDelta !== 0) return severityDelta;
    return compareHistoryRecency(left, right);
  });
}

export function searchFinalizedRunHistory(
  entries: ReadonlyArray<EvaluationWorkbenchFinalizedRunHistoryEntry>,
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return entries;

  return entries.filter((entry) =>
    createHistorySearchHaystack(entry).some((value) =>
      value.toLowerCase().includes(normalizedQuery),
    ),
  );
}

export function isSelectedRunHiddenFromHistoryList(
  entries: ReadonlyArray<EvaluationWorkbenchFinalizedRunHistoryEntry>,
  selectedRunId: string | null,
) {
  if (selectedRunId == null) return false;
  return !entries.some((entry) => entry.run.id === selectedRunId);
}

function resolveFinalizeRunMode(input: {
  selectedRun: EvaluationWorkbenchOverview["runs"][number] | null;
  hasFinalizedResult: boolean;
}) {
  if (input.selectedRun == null) {
    return "unselected" as const;
  }

  if (input.hasFinalizedResult) {
    return "finalized" as const;
  }

  if (
    input.selectedRun.governed_source &&
    (input.selectedRun.status === "passed" || input.selectedRun.status === "failed")
  ) {
    return "finalize_recommendation" as const;
  }

  return "complete_and_finalize" as const;
}

export function describeHistoryComparisonGuidance(input: {
  selectedRun: EvaluationWorkbenchOverview["runs"][number] | null;
  selectedRunHistoryEntry: EvaluationWorkbenchFinalizedRunHistoryEntry | null;
  previousRunHistoryEntry: EvaluationWorkbenchFinalizedRunHistoryEntry | null;
  scope?: EvaluationWorkbenchHistoryScope;
  totalFinalizedCount?: number;
  scopedCount?: number;
}) {
  const { previousRunHistoryEntry, selectedRun, selectedRunHistoryEntry } = input;
  const scope = input.scope ?? "suite";
  const totalFinalizedCount = input.totalFinalizedCount ?? input.scopedCount ?? 0;
  const scopedCount = input.scopedCount ?? totalFinalizedCount;
  if (selectedRunHistoryEntry && previousRunHistoryEntry) return null;
  if (selectedRun && !selectedRunHistoryEntry) {
    if (
      selectedRun.governed_source &&
      (selectedRun.status === "passed" || selectedRun.status === "failed")
    ) {
      return `Current run ${selectedRun.id} already completed automatic governed checks. Finalize the recommendation to compare against history.`;
    }
    return `Current run ${selectedRun.id} is still ${selectedRun.status}. Complete and finalize it to compare against history.`;
  }
  if (selectedRunHistoryEntry) {
    if (scope === "manuscript" && totalFinalizedCount > scopedCount) {
      return "This manuscript only has one finalized run. Switch to Entire Suite History to compare it against broader suite history.";
    }
    if (scope === "manuscript") {
      return "Finalize one more run for this manuscript to compare the current result against manuscript history.";
    }
    return "Finalize one more run in this suite to compare the current result against history.";
  }
  if (scope === "manuscript") {
    return "Select a finalized run from this manuscript to compare it against prior manuscript history.";
  }
  return "Select a finalized run from the suite to compare it against prior history.";
}

export function describeHistoryComparisonGuidanceSummary(input: {
  selectedRun: EvaluationWorkbenchOverview["runs"][number] | null;
  selectedRunHistoryEntry: EvaluationWorkbenchFinalizedRunHistoryEntry | null;
  previousRunHistoryEntry: EvaluationWorkbenchFinalizedRunHistoryEntry | null;
  scope?: EvaluationWorkbenchHistoryScope;
  totalFinalizedCount?: number;
  scopedCount?: number;
}) {
  const { previousRunHistoryEntry, selectedRun, selectedRunHistoryEntry } = input;
  const scope = input.scope ?? "suite";
  const totalFinalizedCount = input.totalFinalizedCount ?? input.scopedCount ?? 0;
  const scopedCount = input.scopedCount ?? totalFinalizedCount;

  if (selectedRunHistoryEntry && previousRunHistoryEntry) return null;
  if (selectedRun && !selectedRunHistoryEntry) {
    return "Comparison unlocks after this run reaches a finalized recommendation with persisted evidence.";
  }
  if (selectedRunHistoryEntry) {
    if (scope === "manuscript" && totalFinalizedCount > scopedCount) {
      const additionalRunCount = totalFinalizedCount - scopedCount;
      return `Broader suite history already has ${additionalRunCount} additional finalized run${additionalRunCount === 1 ? "" : "s"} available for comparison.`;
    }
    return `Current ${scope} history only contains this finalized run, so there is no earlier baseline yet.`;
  }
  if (scopedCount > 0) {
    return `Visible ${scope} history currently has ${scopedCount} finalized run${scopedCount === 1 ? "" : "s"} ready for compare selection.`;
  }
  return null;
}

export function describeHistoryComparisonRoleLabels(input: {
  entryRunId: string;
  selectedRunId: string | null;
  previousRunId: string | null;
}) {
  const labels: string[] = [];
  if (input.entryRunId === input.selectedRunId) {
    labels.push("Selected run");
  }
  if (input.entryRunId === input.previousRunId) {
    labels.push("Compare baseline");
  }
  return labels;
}

export function describeHistoryStatusPair(
  recommendationStatus: string,
  summaryStatus: string,
) {
  return `${recommendationStatus} / ${summaryStatus}`;
}

function compareHistoryRecency(
  left: EvaluationWorkbenchOverview["finalizedRunHistory"][number],
  right: EvaluationWorkbenchOverview["finalizedRunHistory"][number],
) {
  const leftTimestamp = left.run.finished_at ?? left.run.started_at ?? "";
  const rightTimestamp = right.run.finished_at ?? right.run.started_at ?? "";
  return rightTimestamp.localeCompare(leftTimestamp);
}

function getRecommendationSeverity(
  status: EvaluationWorkbenchOverview["finalizedRunHistory"][number]["finalized"]["recommendation"]["status"],
) {
  if (status === "rejected") return 0;
  if (status === "needs_review") return 1;
  return 2;
}

function describeRecommendationShift(
  selectedStatus: EvaluationWorkbenchOverview["finalizedRunHistory"][number]["finalized"]["recommendation"]["status"],
  previousStatus: EvaluationWorkbenchOverview["finalizedRunHistory"][number]["finalized"]["recommendation"]["status"],
) {
  if (selectedStatus === previousStatus) {
    return `Recommendation shift: unchanged at ${selectedStatus}`;
  }
  return `Recommendation shift: ${selectedStatus} (was ${previousStatus})`;
}

export function describeComparisonOperatorSummary(input: {
  comparisonScopeLabel: string;
  selectedStatus: EvaluationWorkbenchOverview["finalizedRunHistory"][number]["finalized"]["recommendation"]["status"];
  previousStatus: EvaluationWorkbenchOverview["finalizedRunHistory"][number]["finalized"]["recommendation"]["status"];
  selectedScoreSummary?: string | null;
  previousScoreSummary?: string | null;
}) {
  const scopeLabel = input.comparisonScopeLabel.toLowerCase();
  const selectedSeverity = getRecommendationSeverity(input.selectedStatus);
  const previousSeverity = getRecommendationSeverity(input.previousStatus);
  const selectedScore = parseAverageWeightedScore(input.selectedScoreSummary);
  const previousScore = parseAverageWeightedScore(input.previousScoreSummary);
  const scoreDelta =
    selectedScore != null && previousScore != null ? selectedScore - previousScore : null;

  if (selectedSeverity === previousSeverity) {
    if (scoreDelta != null && scoreDelta > 0.05) {
      return `Operator summary: Improved over ${scopeLabel} by ${scoreDelta.toFixed(1)} weighted points while holding ${input.selectedStatus}.`;
    }
    if (scoreDelta != null && scoreDelta < -0.05) {
      return `Operator summary: Regressed against ${scopeLabel} and dropped ${Math.abs(scoreDelta).toFixed(1)} weighted points while staying ${input.selectedStatus}.`;
    }
    return `Operator summary: Held steady against ${scopeLabel} at ${input.selectedStatus}.`;
  }

  if (selectedSeverity > previousSeverity) {
    const scoreTail =
      scoreDelta != null && Math.abs(scoreDelta) > 0.05
        ? ` and gained ${scoreDelta.toFixed(1)} weighted points`
        : "";
    return `Operator summary: Improved over ${scopeLabel} (${input.previousStatus} -> ${input.selectedStatus})${scoreTail}.`;
  }

  const scoreTail =
    scoreDelta != null && Math.abs(scoreDelta) > 0.05
      ? ` and dropped ${Math.abs(scoreDelta).toFixed(1)} weighted points`
      : "";
  return `Operator summary: Regressed against ${scopeLabel} (${input.previousStatus} -> ${input.selectedStatus})${scoreTail}.`;
}

export function describeComparisonBaselinePolicy(comparisonScopeLabel: string) {
  return `Baseline policy: Chronological previous finalized run within ${comparisonScopeLabel.toLowerCase()}.`;
}

export function describeComparisonTriageHint(input: {
  selectedStatus: EvaluationWorkbenchOverview["finalizedRunHistory"][number]["finalized"]["recommendation"]["status"];
  previousStatus: EvaluationWorkbenchOverview["finalizedRunHistory"][number]["finalized"]["recommendation"]["status"];
  scoreDelta: number | null;
}) {
  if (input.selectedStatus === "rejected") {
    return "Suggested action: Investigate regression";
  }

  if (input.selectedStatus === "needs_review") {
    return "Suggested action: Review manually";
  }

  if (input.previousStatus !== "recommended") {
    return "Suggested action: Promote candidate";
  }

  if (input.scoreDelta != null && input.scoreDelta > 0.05) {
    return "Suggested action: Promote candidate";
  }

  return "Suggested action: Monitor before promote";
}

function describeEvidenceCountChange(
  selectedEvidence: VerificationEvidenceViewModel[],
  previousEvidence: VerificationEvidenceViewModel[],
) {
  return `Evidence count: ${selectedEvidence.length} (was ${previousEvidence.length})`;
}

function parseAverageWeightedScore(summary: string | null | undefined) {
  if (!summary) return null;
  const match = /Average weighted score ([0-9]+(?:\.[0-9]+)?)/.exec(summary);
  if (!match) return null;
  return Number(match[1]);
}

function findPreviousFinalizedRunHistoryEntry(
  entries: EvaluationWorkbenchOverview["finalizedRunHistory"],
  selectedRunId: string,
) {
  const selectedIndex = entries.findIndex((entry) => entry.run.id === selectedRunId);
  if (selectedIndex === -1) return null;
  return entries.slice(selectedIndex + 1).find((entry) => entry != null) ?? null;
}

export function summarizeFinalizedEntry(
  entry: EvaluationWorkbenchOverview["finalizedRunHistory"][number],
) {
  return [
    entry.finalized.recommendation.decision_reason,
    entry.run.finished_at ? `Finished ${entry.run.finished_at}` : undefined,
  ]
    .filter((value) => Boolean(value))
    .join(" | ");
}

function resolveSelectedId(ids: readonly string[], preferredId: string | null) {
  return preferredId && ids.includes(preferredId) ? preferredId : ids[0] ?? null;
}

function describeHardGate(hardGatePassed: boolean | undefined) {
  if (hardGatePassed == null) return "Pending";
  return hardGatePassed ? "Passed" : "Failed";
}

function describeComparisonScopeLabel(input: {
  scope: EvaluationWorkbenchHistoryScope;
  hasManuscriptContext: boolean;
}) {
  if (input.scope === "manuscript") return "Matched manuscript history";
  return input.hasManuscriptContext ? "Broader suite history" : "Entire suite history";
}

export function describeHistoryEntryOriginLabel(input: {
  runId: string | null;
  matchedRunIds: readonly string[];
  hasManuscriptContext: boolean;
  scope: EvaluationWorkbenchHistoryScope;
}) {
  if (!input.hasManuscriptContext || input.runId == null) return null;
  if (input.scope === "manuscript") return "Matched manuscript";

  const matchedRunIdSet = new Set(input.matchedRunIds);
  return matchedRunIdSet.has(input.runId) ? "Current manuscript" : "Broader suite";
}

export function describeHistoryOriginSummary(input: {
  runIds: readonly string[];
  matchedRunIds: readonly string[];
  hasManuscriptContext: boolean;
  scope: EvaluationWorkbenchHistoryScope;
}) {
  if (!input.hasManuscriptContext) return null;
  if (input.runIds.length === 0) return null;
  if (input.scope === "manuscript") {
    return `Matched manuscript runs: ${input.runIds.length}`;
  }

  const matchedRunIdSet = new Set(input.matchedRunIds);
  const manuscriptCount = input.runIds.filter((runId) => matchedRunIdSet.has(runId)).length;
  const broaderSuiteCount = input.runIds.length - manuscriptCount;
  return `Current manuscript runs: ${manuscriptCount} | Broader suite references: ${broaderSuiteCount}`;
}

export function describeHistoryVisibilitySummary(input: {
  visibleCount: number;
  totalCount: number;
  scope: EvaluationWorkbenchHistoryScope;
  filter: EvaluationWorkbenchHistoryFilter;
  searchQuery: string;
  sortMode: EvaluationWorkbenchHistorySortMode;
  selectedRunId: string | null;
  selectedRunHidden: boolean;
}) {
  const scopeLabel = input.scope === "manuscript" ? "manuscript-scoped" : "suite-scoped";
  const controls: string[] = [];

  if (input.filter !== "all") {
    controls.push(`filter ${describeHistoryFilterLabel(input.filter)}`);
  }

  if (input.searchQuery.trim()) {
    controls.push(`search "${input.searchQuery.trim()}"`);
  }

  if (input.sortMode !== "newest") {
    controls.push(`sort ${describeHistorySortModeLabel(input.sortMode)}`);
  }

  return [
    `Visibility summary: ${input.visibleCount} of ${input.totalCount} finalized runs visible in ${scopeLabel} history.`,
    controls.length > 0 ? `Active controls: ${controls.join(", ")}.` : null,
    input.selectedRunHidden && input.selectedRunId
      ? `Selected run ${input.selectedRunId} is outside the current result set.`
      : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

export function describeHistoryControlSummaryLines(input: {
  scope: EvaluationWorkbenchHistoryScope;
  filter: EvaluationWorkbenchHistoryFilter;
  searchQuery: string;
  sortMode: EvaluationWorkbenchHistorySortMode;
}) {
  return [
    `Scope: ${describeHistoryScopeSummaryLabel(input.scope)}`,
    `Filter: ${describeHistoryFilterSummaryLabel(input.filter)}`,
    `Search: ${input.searchQuery.trim() || "None"}`,
    `Sort: ${describeHistorySortModeSummaryLabel(input.sortMode)}`,
  ];
}

export function describeHistoryCompareStatusSummary(input: {
  selectedRunHistoryEntry: EvaluationWorkbenchFinalizedRunHistoryEntry | null;
  previousRunHistoryEntry: EvaluationWorkbenchFinalizedRunHistoryEntry | null;
  historyComparisonGuidance: string | null;
  historyComparisonGuidanceSummary: string | null;
}) {
  if (input.selectedRunHistoryEntry && input.previousRunHistoryEntry) {
    return "Compare status: Current compare summary remains available for the selected run and compare baseline.";
  }
  const fallback = input.historyComparisonGuidanceSummary ?? input.historyComparisonGuidance;
  return fallback ? `Compare status: ${fallback}` : null;
}

export function describeGovernedLearningHandoffGuidance(input: {
  hasFinalizedResult: boolean;
  hasLinkedSampleContext: boolean;
  hasGovernedSource: boolean;
}) {
  if (!input.hasFinalizedResult) {
    return null;
  }

  if (input.hasLinkedSampleContext || !input.hasGovernedSource) {
    return null;
  }

  return "Learning handoff is unavailable for governed-source runs until a reviewed snapshot is linked.";
}

function describeHistoryScopeSummaryLabel(scope: EvaluationWorkbenchHistoryScope) {
  if (scope === "manuscript") return "Matched manuscript runs";
  return "Entire suite history";
}

function describeHistoryFilterLabel(filter: EvaluationWorkbenchHistoryFilter) {
  if (filter === "needs_review") return "needs review";
  return filter;
}

function describeHistorySortModeLabel(sortMode: EvaluationWorkbenchHistorySortMode) {
  if (sortMode === "failures_first") return "failures first";
  return "newest first";
}

function describeHistoryFilterSummaryLabel(filter: EvaluationWorkbenchHistoryFilter) {
  if (filter === "all") return "All finalized runs";
  if (filter === "needs_review") return "Needs review only";
  return `${capitalizeLabel(filter)} only`;
}

function describeHistorySortModeSummaryLabel(sortMode: EvaluationWorkbenchHistorySortMode) {
  if (sortMode === "failures_first") return "Failures first";
  return "Newest first";
}

function capitalizeLabel(value: string) {
  if (!value) return value;
  return `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}`;
}

function formatOptionalList(values: readonly string[] | undefined) {
  return values != null && values.length > 0 ? values.join(", ") : "None";
}

function summarizeBinding(
  binding: EvaluationWorkbenchOverview["runs"][number]["baseline_binding"],
) {
  if (!binding) return "Not recorded";

  return [
    `Model ${binding.model_id}`,
    `Runtime ${binding.runtime_id}`,
    `Prompt ${binding.prompt_template_id}`,
    `Skills ${formatOptionalList(binding.skill_package_ids)}`,
    `Module Template ${binding.module_template_id}`,
  ].join(" | ");
}

function summarizeBindingChanges(
  selectedRun: EvaluationWorkbenchOverview["runs"][number],
  previousRun: EvaluationWorkbenchOverview["runs"][number],
) {
  return [
    ...compareBindingFields("Baseline", selectedRun.baseline_binding, previousRun.baseline_binding),
    ...compareBindingFields("Candidate", selectedRun.candidate_binding, previousRun.candidate_binding),
  ];
}

export function summarizeEvidencePackChanges(
  selectedPack: EvaluationWorkbenchOverview["finalizedRunHistory"][number]["finalized"]["evidence_pack"],
  previousPack: EvaluationWorkbenchOverview["finalizedRunHistory"][number]["finalized"]["evidence_pack"],
) {
  const changes: string[] = [];

  pushOptionalChange(changes, "Summary status", selectedPack.summary_status, previousPack.summary_status);
  pushOptionalChange(changes, "Score summary", selectedPack.score_summary, previousPack.score_summary);
  pushOptionalChange(
    changes,
    "Regression summary",
    selectedPack.regression_summary,
    previousPack.regression_summary,
  );
  pushOptionalChange(
    changes,
    "Failure summary",
    selectedPack.failure_summary,
    previousPack.failure_summary,
  );
  pushOptionalChange(changes, "Cost summary", selectedPack.cost_summary, previousPack.cost_summary);
  pushOptionalChange(
    changes,
    "Latency summary",
    selectedPack.latency_summary,
    previousPack.latency_summary,
  );

  return changes;
}

function compareBindingFields(
  label: "Baseline" | "Candidate",
  selectedBinding: EvaluationWorkbenchOverview["runs"][number]["baseline_binding"],
  previousBinding: EvaluationWorkbenchOverview["runs"][number]["baseline_binding"],
) {
  const changes: string[] = [];

  if (!selectedBinding || !previousBinding) {
    if (selectedBinding?.model_id !== previousBinding?.model_id) {
      changes.push(
        `${label} binding availability changed: ${summarizeBinding(selectedBinding)} (was ${summarizeBinding(previousBinding)})`,
      );
    }
    return changes;
  }

  pushBindingChange(changes, `${label} model`, selectedBinding.model_id, previousBinding.model_id);
  pushBindingChange(changes, `${label} runtime`, selectedBinding.runtime_id, previousBinding.runtime_id);
  pushBindingChange(
    changes,
    `${label} prompt`,
    selectedBinding.prompt_template_id,
    previousBinding.prompt_template_id,
  );
  pushBindingChange(
    changes,
    `${label} skills`,
    formatOptionalList(selectedBinding.skill_package_ids),
    formatOptionalList(previousBinding.skill_package_ids),
  );
  pushBindingChange(
    changes,
    `${label} module template`,
    selectedBinding.module_template_id,
    previousBinding.module_template_id,
  );

  return changes;
}

function pushBindingChange(
  changes: string[],
  label: string,
  selectedValue: string,
  previousValue: string,
) {
  if (selectedValue === previousValue) return;
  changes.push(`${label} changed: ${selectedValue} (was ${previousValue})`);
}

function pushOptionalChange(
  changes: string[],
  label: string,
  selectedValue: string | undefined,
  previousValue: string | undefined,
) {
  const normalizedSelectedValue = selectedValue ?? "None recorded";
  const normalizedPreviousValue = previousValue ?? "None recorded";
  if (normalizedSelectedValue === normalizedPreviousValue) return;
  changes.push(`${label} changed: ${normalizedSelectedValue} (was ${normalizedPreviousValue})`);
}

function summarizeEvidenceLabels(evidence: VerificationEvidenceViewModel[]) {
  return evidence.length > 0 ? evidence.map((item) => item.label).join(", ") : "None recorded";
}

function createDocumentAssetDownloadHref(assetId: string | null | undefined) {
  if (!assetId?.trim()) {
    return null;
  }

  return `/api/v1/document-assets/${assetId}/download`;
}

function createFinalizeArtifactOptions(
  selectedRunItem: EvaluationWorkbenchOverview["runItems"][number] | null,
  linkedSampleSetItem: EvaluationWorkbenchOverview["sampleSetItems"][number] | null,
  governedSource: EvaluationWorkbenchOverview["runs"][number]["governed_source"] | null,
) {
  const options: Array<{
    source: "result_asset" | "sample_snapshot" | "governed_output";
    assetId: string;
    actionLabel: string;
  }> = [];

  if (selectedRunItem?.result_asset_id) {
    options.push({
      source: "result_asset",
      assetId: selectedRunItem.result_asset_id,
      actionLabel: `Use Result Asset (${selectedRunItem.result_asset_id})`,
    });
  }

  if (
    linkedSampleSetItem?.snapshot_asset_id &&
    linkedSampleSetItem.snapshot_asset_id !== selectedRunItem?.result_asset_id
  ) {
    options.push({
      source: "sample_snapshot",
      assetId: linkedSampleSetItem.snapshot_asset_id,
      actionLabel: `Use Sample Snapshot (${linkedSampleSetItem.snapshot_asset_id})`,
    });
  }

  if (
    governedSource?.output_asset_id &&
    governedSource.output_asset_id !== selectedRunItem?.result_asset_id &&
    governedSource.output_asset_id !== linkedSampleSetItem?.snapshot_asset_id
  ) {
    options.push({
      source: "governed_output",
      assetId: governedSource.output_asset_id,
      actionLabel: `Use Governed Output (${governedSource.output_asset_id})`,
    });
  }

  return options;
}

function resolvePreferredFinalizeArtifactAssetId(
  options: ReturnType<typeof createFinalizeArtifactOptions>,
) {
  return options[0]?.assetId ?? "";
}

function createHistorySearchHaystack(
  entry: EvaluationWorkbenchOverview["finalizedRunHistory"][number],
) {
  return [
    entry.run.id,
    entry.finalized.recommendation.status,
    entry.finalized.recommendation.decision_reason,
    entry.finalized.recommendation.evidence_pack_id,
    entry.finalized.evidence_pack.id,
    entry.finalized.evidence_pack.summary_status,
    entry.finalized.evidence_pack.score_summary,
    entry.finalized.evidence_pack.regression_summary,
    entry.finalized.evidence_pack.failure_summary,
    entry.run.baseline_binding?.model_id,
    entry.run.baseline_binding?.runtime_id,
    entry.run.baseline_binding?.prompt_template_id,
    formatOptionalList(entry.run.baseline_binding?.skill_package_ids),
    entry.run.candidate_binding?.model_id,
    entry.run.candidate_binding?.runtime_id,
    entry.run.candidate_binding?.prompt_template_id,
    formatOptionalList(entry.run.candidate_binding?.skill_package_ids),
  ].filter((value): value is string => Boolean(value));
}

function toErrorMessage(error: unknown) {
  if (error instanceof BrowserHttpClientError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Unexpected evaluation workbench error.";
}
