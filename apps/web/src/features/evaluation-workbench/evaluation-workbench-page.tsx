import { useEffect, useState } from "react";
import { formatWorkbenchHash } from "../../app/workbench-routing.ts";
import { createBrowserHttpClient, BrowserHttpClientError } from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/index.ts";
import type { LearningCandidateType } from "../learning-review/types.ts";
import type { ManuscriptWorkbenchMode } from "../manuscript-workbench/manuscript-workbench-controller.ts";
import type {
  EvaluationRunItemFailureKind,
  VerificationEvidenceKind,
  VerificationEvidenceViewModel,
} from "../verification-ops/index.ts";
import {
  createEvaluationWorkbenchController,
  type EvaluationWorkbenchController,
  type EvaluationWorkbenchFinalizedRunHistoryEntry,
  type EvaluationWorkbenchOverview,
} from "./evaluation-workbench-controller.ts";

const defaultController = createEvaluationWorkbenchController(createBrowserHttpClient());
const learningCandidateTypes: LearningCandidateType[] = [
  "rule_candidate",
  "case_pattern_candidate",
  "template_update_candidate",
  "prompt_optimization_candidate",
  "checklist_update_candidate",
  "skill_update_candidate",
];
const failureKinds: EvaluationRunItemFailureKind[] = [
  "governance_failed",
  "runtime_failed",
  "scoring_failed",
  "regression_failed",
];
const baseRunForm = {
  sampleSetId: "",
  baselineModelId: "demo-model-prod-1",
  candidateModelId: "demo-model-candidate-1",
  runtimeId: "demo-runtime-prod-1",
  promptTemplateId: "demo-prompt-prod-1",
  skillPackageIds: "demo-skill-prod-1",
  moduleTemplateId: "demo-template-prod-1",
  releaseCheckProfileId: "",
};
const baseRunItemForm = {
  resultAssetId: "human-final-demo-1",
  hardGatePassed: true,
  weightedScore: "91",
  diffSummary: "Candidate improves editing structure stability.",
  requiresHumanReview: false,
  failureKind: "" as "" | EvaluationRunItemFailureKind,
  failureReason: "",
};
const baseFinalizeForm = {
  status: "passed" as "passed" | "failed",
  evidenceKind: "url" as VerificationEvidenceKind,
  evidenceLabel: "Browser QA evidence",
  evidenceUrl: "https://example.test/evidence/browser-qa",
  artifactAssetId: "",
};
const baseLearningForm = {
  reviewedCaseSnapshotId: "reviewed-case-snapshot-demo-1",
  sourceAssetId: "human-final-demo-1",
  candidateType: "prompt_optimization_candidate" as LearningCandidateType,
  title: "Promote evaluated editing binding",
  proposalText: "Promote the candidate binding after governed evaluation approval.",
  createdBy: "admin-1",
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
}

export function EvaluationWorkbenchPage({
  controller = defaultController,
  actorRole = "admin",
  prefilledManuscriptId,
}: EvaluationWorkbenchPageProps) {
  const normalizedPrefilledManuscriptId = prefilledManuscriptId?.trim() ?? "";
  const [overview, setOverview] = useState<EvaluationWorkbenchOverview | null>(null);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isActivatingSuiteId, setIsActivatingSuiteId] = useState<string | null>(null);
  const [selectedRunItemId, setSelectedRunItemId] = useState<string | null>(null);
  const [historyScope, setHistoryScope] = useState<EvaluationWorkbenchHistoryScope>("suite");
  const [historyFilter, setHistoryFilter] = useState<EvaluationWorkbenchHistoryFilter>("all");
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historySortMode, setHistorySortMode] =
    useState<EvaluationWorkbenchHistorySortMode>("newest");
  const [runForm, setRunForm] = useState(baseRunForm);
  const [runItemForm, setRunItemForm] = useState(baseRunItemForm);
  const [finalizeForm, setFinalizeForm] = useState(baseFinalizeForm);
  const [learningForm, setLearningForm] = useState(baseLearningForm);
  const [finalizedResult, setFinalizedResult] = useState<Awaited<
    ReturnType<EvaluationWorkbenchController["completeRunWithEvidenceAndFinalize"]>
  >["finalized"] | null>(null);
  const [createdLearningCandidate, setCreatedLearningCandidate] = useState<Awaited<
    ReturnType<EvaluationWorkbenchController["createLearningCandidateFromEvaluation"]>
  > | null>(null);

  useEffect(() => {
    void loadOverview(
      normalizedPrefilledManuscriptId.length > 0
        ? { manuscriptId: normalizedPrefilledManuscriptId }
        : undefined,
    );
  }, [controller, normalizedPrefilledManuscriptId]);

  useEffect(() => {
    if (!overview) return;
    const suite = overview.suites.find((item) => item.id === overview.selectedSuiteId) ?? null;
    const preferredSampleSetId = resolveSampleSetId(overview, runForm.sampleSetId, suite);
    if (preferredSampleSetId !== runForm.sampleSetId) {
      setRunForm((current) => ({ ...current, sampleSetId: preferredSampleSetId }));
    }
    const nextRunItemId = resolveSelectedId(
      overview.runItems.map((item) => item.id),
      selectedRunItemId,
    );
    if (nextRunItemId !== selectedRunItemId) {
      setSelectedRunItemId(nextRunItemId);
    }
  }, [overview, runForm.sampleSetId, selectedRunItemId]);

  const selectedSuite = overview?.suites.find((item) => item.id === overview.selectedSuiteId) ?? null;
  const selectedRun = overview?.runs.find((item) => item.id === overview.selectedRunId) ?? null;
  const effectiveFinalizedResult =
    selectedRun != null && finalizedResult?.run.id === selectedRun.id
      ? finalizedResult
      : overview?.selectedRunFinalization ?? null;
  const finalizedRunHistory = overview?.finalizedRunHistory ?? [];
  const matchedHistoryRunIds = overview?.manuscriptContext?.matchedHistoryRunIds ?? [];
  const canScopeHistoryToManuscript =
    normalizedPrefilledManuscriptId.length > 0 && matchedHistoryRunIds.length > 0;
  const effectiveHistoryScope =
    historyScope === "manuscript" && canScopeHistoryToManuscript ? "manuscript" : "suite";
  const scopedFinalizedRunHistory = filterFinalizedRunHistoryByScope(
    finalizedRunHistory,
    effectiveHistoryScope,
    matchedHistoryRunIds,
  );
  const selectedRunHistoryEntry =
    selectedRun == null
      ? null
      : scopedFinalizedRunHistory.find((entry) => entry.run.id === selectedRun.id) ?? null;
  const previousRunHistoryEntry =
    selectedRun == null
      ? null
      : findPreviousFinalizedRunHistoryEntry(scopedFinalizedRunHistory, selectedRun.id);
  const historyComparisonGuidance = describeHistoryComparisonGuidance({
    selectedRun,
    selectedRunHistoryEntry,
    previousRunHistoryEntry,
    scope: effectiveHistoryScope,
    totalFinalizedCount: finalizedRunHistory.length,
    scopedCount: scopedFinalizedRunHistory.length,
  });
  const canSwitchToSuiteHistoryForComparison =
    effectiveHistoryScope === "manuscript" &&
    selectedRunHistoryEntry != null &&
    previousRunHistoryEntry == null &&
    finalizedRunHistory.length > scopedFinalizedRunHistory.length;
  const comparisonScopeLabel = describeComparisonScopeLabel({
    scope: effectiveHistoryScope,
    hasManuscriptContext: normalizedPrefilledManuscriptId.length > 0,
  });
  const selectedComparisonOriginLabel = describeHistoryEntryOriginLabel({
    runId: selectedRunHistoryEntry?.run.id ?? null,
    matchedRunIds: matchedHistoryRunIds,
    hasManuscriptContext: normalizedPrefilledManuscriptId.length > 0,
    scope: effectiveHistoryScope,
  });
  const previousComparisonOriginLabel = describeHistoryEntryOriginLabel({
    runId: previousRunHistoryEntry?.run.id ?? null,
    matchedRunIds: matchedHistoryRunIds,
    hasManuscriptContext: normalizedPrefilledManuscriptId.length > 0,
    scope: effectiveHistoryScope,
  });
  const historyCounts = summarizeHistoryCounts(scopedFinalizedRunHistory);
  const filteredFinalizedRunHistory = filterFinalizedRunHistory(
    scopedFinalizedRunHistory,
    historyFilter,
  );
  const visibleFinalizedRunHistory = searchFinalizedRunHistory(
    filteredFinalizedRunHistory,
    historySearchQuery,
  );
  const sortedVisibleFinalizedRunHistory = sortFinalizedRunHistory(
    visibleFinalizedRunHistory,
    historySortMode,
  );
  const historyOriginSummary = describeHistoryOriginSummary({
    runIds: sortedVisibleFinalizedRunHistory.map((entry) => entry.run.id),
    matchedRunIds: matchedHistoryRunIds,
    hasManuscriptContext: normalizedPrefilledManuscriptId.length > 0,
    scope: effectiveHistoryScope,
  });
  const isSelectedRunHiddenByHistoryControls = isSelectedRunHiddenFromHistoryList(
    sortedVisibleFinalizedRunHistory,
    selectedRun?.id ?? null,
  );
  const sampleSetItems = overview?.sampleSetItems ?? [];
  const selectedRunEvidence = overview?.selectedRunEvidence ?? [];
  const previousRunEvidence = overview?.previousRunEvidence ?? [];
  const selectedRunItem = overview?.runItems.find((item) => item.id === selectedRunItemId) ?? null;
  const selectedSampleSet =
    selectedRun == null || overview == null
      ? null
      : overview.sampleSets.find((item) => item.id === selectedRun.sample_set_id) ?? null;
  const linkedSampleSetItem =
    selectedRunItem == null
      ? null
      : sampleSetItems.find((item) => item.id === selectedRunItem.sample_set_item_id) ?? null;
  const finalizeArtifactOptions = createFinalizeArtifactOptions(
    selectedRunItem,
    linkedSampleSetItem,
  );
  const learningReviewHash = createdLearningCandidate ? formatWorkbenchHash("learning-review") : null;

  useEffect(() => {
    if (!selectedRunItem) return;
    setRunItemForm({
      resultAssetId: selectedRunItem.result_asset_id ?? "human-final-demo-1",
      hardGatePassed: selectedRunItem.hard_gate_passed ?? true,
      weightedScore:
        selectedRunItem.weighted_score == null ? "91" : String(selectedRunItem.weighted_score),
      diffSummary: selectedRunItem.diff_summary ?? "Candidate improves editing structure stability.",
      requiresHumanReview: selectedRunItem.requires_human_review ?? false,
      failureKind: selectedRunItem.failure_kind ?? "",
      failureReason: selectedRunItem.failure_reason ?? "",
    });
    setLearningForm((current) => ({
      ...current,
      sourceAssetId: selectedRunItem.result_asset_id ?? current.sourceAssetId,
    }));
  }, [selectedRunItem]);

  useEffect(() => {
    if (!linkedSampleSetItem) return;
    setLearningForm((current) => ({
      ...current,
      reviewedCaseSnapshotId: linkedSampleSetItem.reviewed_case_snapshot_id,
    }));
  }, [linkedSampleSetItem]);

  useEffect(() => {
    if (!selectedRun || finalizedResult?.run.id === selectedRun.id) return;
    setFinalizedResult(null);
    setCreatedLearningCandidate(null);
  }, [selectedRun, finalizedResult]);

  useEffect(() => {
    setHistoryFilter("all");
    setHistorySearchQuery("");
    setHistorySortMode("newest");
  }, [overview?.selectedSuiteId]);

  useEffect(() => {
    if (!overview) return;
    if (normalizedPrefilledManuscriptId.length === 0) {
      setHistoryScope("suite");
      return;
    }
    setHistoryScope(
      overview.manuscriptContext?.matchedHistoryRunIds.length ? "manuscript" : "suite",
    );
  }, [
    overview?.selectedSuiteId,
    overview?.manuscriptContext?.manuscriptId,
    normalizedPrefilledManuscriptId,
  ]);

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
    <section className="evaluation-workbench">
      <header className="evaluation-workbench-hero">
        <div>
          <h2>Evaluation Workbench</h2>
          <p>Run governed evaluations, finalize evidence, and hand approved results into learning review.</p>
          {errorMessage ? <p className="evaluation-workbench-error">{errorMessage}</p> : null}
        </div>
        {statusMessage ? <p className="evaluation-workbench-status">{statusMessage}</p> : null}
      </header>

      {normalizedPrefilledManuscriptId.length > 0 ? (
        <div className="evaluation-workbench-result">
          <strong>Manuscript Handoff</strong>
          <div className="evaluation-workbench-history-compare">
            <span>Context manuscript: {normalizedPrefilledManuscriptId}</span>
            <span>
              {overview.manuscriptContext?.matchedRunId
                ? `Matched run: ${overview.manuscriptContext.matchedRunId}`
                : "No matched evaluation run yet"}
            </span>
            <span>
              {overview.manuscriptContext?.matchedSuiteId
                ? `Matched suite: ${overview.manuscriptContext.matchedSuiteId}`
                : "Showing the default evaluation suite"}
            </span>
          </div>
        </div>
      ) : null}

      <section className="evaluation-workbench-summary">
        <SummaryCard label="Check Profiles" value={overview.checkProfiles.length} />
        <SummaryCard label="Release Profiles" value={overview.releaseCheckProfiles.length} />
        <SummaryCard label="Sample Sets" value={overview.sampleSets.length} />
        <SummaryCard label="Suites" value={overview.suites.length} />
        <SummaryCard label="Runs" value={overview.runs.length} />
        <SummaryCard label="Run Items" value={overview.runItems.length} />
      </section>

      <div className="evaluation-workbench-layout">
        <section className="evaluation-workbench-panel">
          <div className="evaluation-workbench-panel-header">
            <h3>Verification Assets</h3>
            <span>{overview.sampleSets.length} sample sets</span>
          </div>
          <dl className="evaluation-workbench-metadata">
            <div>
              <dt>Published checks</dt>
              <dd>{overview.checkProfiles.filter((item) => item.status === "published").length}</dd>
            </div>
            <div>
              <dt>Release gates</dt>
              <dd>{overview.releaseCheckProfiles.filter((item) => item.status === "published").length}</dd>
            </div>
            <div>
              <dt>Covered modules</dt>
              <dd>{summarizeCoveredModules(overview)}</dd>
            </div>
          </dl>
          <ul className="evaluation-workbench-inline-list">
            {overview.sampleSets.map((sampleSet) => (
              <li key={sampleSet.id}>
                <strong>{sampleSet.name}</strong>
                <span>{sampleSet.module} 路 {sampleSet.sample_count} samples 路 {sampleSet.status}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="evaluation-workbench-panel">
          <div className="evaluation-workbench-panel-header">
            <h3>Suites</h3>
            <span>{overview.suites.length} configured</span>
          </div>
          {overview.suites.length === 0 ? (
            <p className="evaluation-workbench-empty">No evaluation suites are configured yet.</p>
          ) : (
            <ul className="evaluation-workbench-stack">
              {overview.suites.map((suite) => (
                <li key={suite.id}>
                  <button
                    type="button"
                    className={`evaluation-workbench-select${suite.id === overview.selectedSuiteId ? " is-selected" : ""}`}
                    onClick={() => void handleSelectSuite(suite.id)}
                  >
                    <strong>{suite.name}</strong>
                    <span>{suite.suite_type} 路 {suite.status}</span>
                  </button>
                  {suite.status === "draft" ? (
                    <button
                      type="button"
                      className="evaluation-workbench-action"
                      disabled={isBusy || isActivatingSuiteId === suite.id}
                      onClick={() => void handleActivateSuite(suite.id)}
                    >
                      {isActivatingSuiteId === suite.id ? "Activating..." : "Activate"}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="evaluation-workbench-panel">
          <div className="evaluation-workbench-panel-header">
            <h3>Run Launch</h3>
            <span>{selectedSuite?.name ?? "Select suite first"}</span>
          </div>
          {selectedSuite == null ? (
            <p className="evaluation-workbench-empty">Select a suite before creating a run.</p>
          ) : (
            <>
              <div className="evaluation-workbench-form-grid">
                <Field label="Sample Set">
                  <select value={runForm.sampleSetId} onChange={(event) => setRunForm((current) => ({ ...current, sampleSetId: event.target.value }))}>
                    {overview.sampleSets.map((sampleSet) => (
                      <option key={sampleSet.id} value={sampleSet.id}>{sampleSet.name} ({sampleSet.status})</option>
                    ))}
                  </select>
                </Field>
                <Field label="Baseline Model ID"><input value={runForm.baselineModelId} onChange={(event) => setRunForm((current) => ({ ...current, baselineModelId: event.target.value }))} /></Field>
                <Field label="Candidate Model ID"><input value={runForm.candidateModelId} onChange={(event) => setRunForm((current) => ({ ...current, candidateModelId: event.target.value }))} /></Field>
                <Field label="Runtime ID"><input value={runForm.runtimeId} onChange={(event) => setRunForm((current) => ({ ...current, runtimeId: event.target.value }))} /></Field>
                <Field label="Prompt Template ID"><input value={runForm.promptTemplateId} onChange={(event) => setRunForm((current) => ({ ...current, promptTemplateId: event.target.value }))} /></Field>
                <Field label="Skill Package IDs"><input value={runForm.skillPackageIds} onChange={(event) => setRunForm((current) => ({ ...current, skillPackageIds: event.target.value }))} /></Field>
                <Field label="Module Template ID"><input value={runForm.moduleTemplateId} onChange={(event) => setRunForm((current) => ({ ...current, moduleTemplateId: event.target.value }))} /></Field>
                <Field label="Release Check Profile ID"><input value={runForm.releaseCheckProfileId} onChange={(event) => setRunForm((current) => ({ ...current, releaseCheckProfileId: event.target.value }))} /></Field>
              </div>
              <button type="button" onClick={() => void handleCreateRun()} disabled={isBusy}>Create Evaluation Run</button>
            </>
          )}
        </section>

        <section className="evaluation-workbench-panel">
          <div className="evaluation-workbench-panel-header">
            <h3>Runs</h3>
            <span>{selectedSuite?.name ?? "No suite selected"}</span>
          </div>
          {selectedSuite == null ? (
            <p className="evaluation-workbench-empty">Select a suite to inspect runs.</p>
          ) : overview.runs.length === 0 ? (
            <p className="evaluation-workbench-empty">No runs have been recorded for this suite yet.</p>
          ) : (
            <ul className="evaluation-workbench-stack">
              {overview.runs.map((run) => (
                <li key={run.id}>
                  <button
                    type="button"
                    aria-label={`Run ${run.id}`}
                    className={`evaluation-workbench-select${run.id === overview.selectedRunId ? " is-selected" : ""}`}
                    onClick={() => void handleSelectRun(run.id)}
                  >
                    <strong>{run.id}</strong>
                    <span>{run.status} 路 {run.run_item_count ?? 0} items</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="evaluation-workbench-panel evaluation-workbench-history">
          <div className="evaluation-workbench-panel-header">
            <h3>Run History</h3>
            <span>
              {describeHistoryResultCount({
                totalFinalizedCount: finalizedRunHistory.length,
                scopedCount: scopedFinalizedRunHistory.length,
                visibleCount: visibleFinalizedRunHistory.length,
                filter: historyFilter,
                query: historySearchQuery,
                scope: effectiveHistoryScope,
              })}
            </span>
          </div>
          {selectedSuite == null ? (
            <p className="evaluation-workbench-empty">Select a suite to compare finalized run history.</p>
          ) : scopedFinalizedRunHistory.length === 0 ? (
            selectedRun && !selectedRunHistoryEntry ? (
              <p className="evaluation-workbench-empty">{historyComparisonGuidance}</p>
            ) : (
              <p className="evaluation-workbench-empty">
                {effectiveHistoryScope === "manuscript"
                  ? "Finalize at least one run for this manuscript to unlock manuscript-scoped history."
                  : "Finalize at least one run to unlock suite-level history."}
              </p>
            )
          ) : (
            <>
              <dl className="evaluation-workbench-metadata">
                <div>
                  <dt>Recommended</dt>
                  <dd>{historyCounts.recommended}</dd>
                </div>
                <div>
                  <dt>Needs Review</dt>
                  <dd>{historyCounts.needsReview}</dd>
                </div>
                <div>
                  <dt>Rejected</dt>
                  <dd>{historyCounts.rejected}</dd>
                </div>
              </dl>
              {historyOriginSummary ? (
                <div className="evaluation-workbench-history-compare">
                  <span>{historyOriginSummary}</span>
                </div>
              ) : null}
              {normalizedPrefilledManuscriptId.length > 0 ? (
                <div className="evaluation-workbench-inline-list" role="group" aria-label="Run history scope">
                  {createHistoryScopeOptions(matchedHistoryRunIds.length).map((option) => {
                    const isSelected = effectiveHistoryScope === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`evaluation-workbench-action${isSelected ? " is-selected" : ""}`}
                        aria-pressed={isSelected}
                        disabled={option.value === "manuscript" && !canScopeHistoryToManuscript}
                        onClick={() => setHistoryScope(option.value)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              <div className="evaluation-workbench-inline-list" role="group" aria-label="Run history filters">
                {createHistoryFilterOptions(historyCounts, scopedFinalizedRunHistory.length).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`evaluation-workbench-action${historyFilter === option.value ? " is-selected" : ""}`}
                    aria-pressed={historyFilter === option.value}
                    onClick={() => setHistoryFilter(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="evaluation-workbench-inline-list" role="group" aria-label="Run history sort">
                {createHistorySortOptions().map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`evaluation-workbench-action${historySortMode === option.value ? " is-selected" : ""}`}
                    aria-pressed={historySortMode === option.value}
                    onClick={() => setHistorySortMode(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <Field label="Search History" wide>
                <input
                  value={historySearchQuery}
                  placeholder="Run ID, model, decision, regression, or evidence pack"
                  onChange={(event) => setHistorySearchQuery(event.target.value)}
                />
              </Field>
              {isSelectedRunHiddenByHistoryControls ? (
                <div className="evaluation-workbench-result evaluation-workbench-history-hidden-selection">
                  <strong>Selected run is currently hidden by history controls.</strong>
                  <div className="evaluation-workbench-history-compare">
                    <span>Selected run: {selectedRun?.id}</span>
                    <span>Scope: {effectiveHistoryScope === "manuscript" ? "manuscript" : "suite"}</span>
                    <span>Filter: {historyFilter}</span>
                    <span>Search: {historySearchQuery || "None"}</span>
                  </div>
                  <button
                    type="button"
                    className="evaluation-workbench-action"
                    onClick={() => {
                      if (effectiveHistoryScope === "manuscript") {
                        setHistoryScope("suite");
                      }
                      setHistoryFilter("all");
                      setHistorySearchQuery("");
                    }}
                  >
                    Show Selected Run
                  </button>
                </div>
              ) : null}
              {selectedRunHistoryEntry && previousRunHistoryEntry ? (
                <EvaluationWorkbenchRunComparisonCard
                  comparisonScopeLabel={comparisonScopeLabel}
                  selectedOriginLabel={selectedComparisonOriginLabel}
                  previousOriginLabel={previousComparisonOriginLabel}
                  selectedEntry={selectedRunHistoryEntry}
                  previousEntry={previousRunHistoryEntry}
                  selectedEvidence={selectedRunEvidence}
                  previousEvidence={previousRunEvidence}
                />
              ) : historyComparisonGuidance && canSwitchToSuiteHistoryForComparison ? (
                <div className="evaluation-workbench-result evaluation-workbench-history-guidance">
                  <strong>History Compare Guidance</strong>
                  <p className="evaluation-workbench-empty">{historyComparisonGuidance}</p>
                  <button
                    type="button"
                    className="evaluation-workbench-action"
                    onClick={() => setHistoryScope("suite")}
                  >
                    Compare Against Entire Suite History
                  </button>
                </div>
              ) : historyComparisonGuidance ? (
                <p className="evaluation-workbench-empty">{historyComparisonGuidance}</p>
              ) : null}
              {selectedRunHistoryEntry ? (
                <div className="evaluation-workbench-result evaluation-workbench-history-detail">
                  <strong>Selected History Detail</strong>
                  <div className="evaluation-workbench-history-compare">
                    <span>Run: {selectedRunHistoryEntry.run.id}</span>
                    {selectedComparisonOriginLabel ? (
                      <span>Origin: {selectedComparisonOriginLabel}</span>
                    ) : null}
                    <span>Recommendation: {selectedRunHistoryEntry.finalized.recommendation.status}</span>
                    <span>Evidence Pack: {selectedRunHistoryEntry.finalized.evidence_pack.id}</span>
                    {selectedRunHistoryEntry.finalized.recommendation.decision_reason ? (
                      <span>{selectedRunHistoryEntry.finalized.recommendation.decision_reason}</span>
                    ) : null}
                    {selectedRunItem?.failure_reason ? <span>{selectedRunItem.failure_reason}</span> : null}
                    {linkedSampleSetItem ? (
                      <span>Reviewed Snapshot: {linkedSampleSetItem.reviewed_case_snapshot_id}</span>
                    ) : null}
                  </div>
                  <EvaluationWorkbenchEvidencePackSummary
                    evidencePack={selectedRunHistoryEntry.finalized.evidence_pack}
                  />
                  <EvaluationWorkbenchLinkedSampleContextList
                    runItems={overview.runItems}
                    sampleSetItems={sampleSetItems}
                    selectedRunItemId={selectedRunItemId}
                    defaultWorkbenchMode={resolveLinkedSampleWorkbenchMode(
                      selectedSampleSet?.module,
                    )}
                    onFocusRunItem={(runItemId) => setSelectedRunItemId(runItemId)}
                  />
                  <EvaluationWorkbenchEvidenceList
                    evidence={selectedRunEvidence}
                    emptyMessage="No persisted verification evidence is attached to this run."
                  />
                </div>
              ) : null}
              {sortedVisibleFinalizedRunHistory.length > 0 ? (
                <ul className="evaluation-workbench-stack evaluation-workbench-history-list">
                  {sortedVisibleFinalizedRunHistory.map((entry) => (
                    <li key={entry.run.id}>
                      <button
                        type="button"
                        aria-label={`History run ${entry.run.id}`}
                        className={`evaluation-workbench-select${entry.run.id === selectedRun?.id ? " is-selected" : ""}`}
                        onClick={() => void handleSelectRun(entry.run.id)}
                      >
                        <strong>{entry.run.id}</strong>
                        <span>{entry.finalized.recommendation.status} 路 {entry.finalized.evidence_pack.summary_status}</span>
                        {(() => {
                          const historyEntryOriginLabel = describeHistoryEntryOriginLabel({
                            runId: entry.run.id,
                            matchedRunIds: matchedHistoryRunIds,
                            hasManuscriptContext: normalizedPrefilledManuscriptId.length > 0,
                            scope: effectiveHistoryScope,
                          });
                          return historyEntryOriginLabel ? (
                            <span>Origin: {historyEntryOriginLabel}</span>
                          ) : null;
                        })()}
                        <EvaluationWorkbenchHistoryEntrySignals entry={entry} />
                        {summarizeFinalizedEntry(entry) ? (
                          <span>{summarizeFinalizedEntry(entry)}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="evaluation-workbench-result evaluation-workbench-history-empty-state">
                  <strong>No finalized runs match the current history controls.</strong>
                  <div className="evaluation-workbench-history-compare">
                    <span>Scope: {effectiveHistoryScope === "manuscript" ? "manuscript" : "suite"}</span>
                    <span>Filter: {historyFilter}</span>
                    <span>Search: {historySearchQuery || "None"}</span>
                    <span>Sort: {historySortMode}</span>
                  </div>
                  <button
                    type="button"
                    className="evaluation-workbench-action"
                    onClick={() => {
                      setHistoryFilter("all");
                      setHistorySearchQuery("");
                      setHistorySortMode("newest");
                    }}
                  >
                    Reset History Controls
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <section className="evaluation-workbench-panel">
          <div className="evaluation-workbench-panel-header">
            <h3>Run Items</h3>
            <span>{selectedRun?.id ?? "No run selected"}</span>
          </div>
          {selectedRun == null ? (
            <p className="evaluation-workbench-empty">Pick a run to review run-item outcomes.</p>
          ) : overview.runItems.length === 0 ? (
            <p className="evaluation-workbench-empty">This run has no recorded run-item results yet.</p>
          ) : (
            <>
              <ul className="evaluation-workbench-stack">
                {overview.runItems.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`evaluation-workbench-select${item.id === selectedRunItemId ? " is-selected" : ""}`}
                      onClick={() => setSelectedRunItemId(item.id)}
                    >
                      <strong>{item.id} 路 {item.lane}</strong>
                      <span>{formatRunItemSummary(item)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {selectedRunItem ? (
                <>
                  <EvaluationWorkbenchSelectedRunItemDetailCard
                    selectedRun={selectedRun}
                    selectedRunItem={selectedRunItem}
                    linkedSampleSetItem={linkedSampleSetItem}
                  />
                  <div className="evaluation-workbench-form-grid">
                    <Field label="Result Asset ID"><input value={runItemForm.resultAssetId} onChange={(event) => setRunItemForm((current) => ({ ...current, resultAssetId: event.target.value }))} /></Field>
                    <Field label="Weighted Score"><input type="number" min="0" max="100" value={runItemForm.weightedScore} onChange={(event) => setRunItemForm((current) => ({ ...current, weightedScore: event.target.value }))} /></Field>
                    <Field label="Failure Kind">
                      <select value={runItemForm.failureKind} onChange={(event) => setRunItemForm((current) => ({ ...current, failureKind: event.target.value as typeof current.failureKind }))}>
                        <option value="">No failure</option>
                        {failureKinds.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </Field>
                    <Field label="Failure Reason"><input value={runItemForm.failureReason} onChange={(event) => setRunItemForm((current) => ({ ...current, failureReason: event.target.value }))} /></Field>
                    <Field label="Diff Summary" wide><textarea value={runItemForm.diffSummary} onChange={(event) => setRunItemForm((current) => ({ ...current, diffSummary: event.target.value }))} /></Field>
                  </div>
                  <div className="evaluation-workbench-check-row">
                    <label className="evaluation-workbench-check">
                      <input type="checkbox" checked={runItemForm.hardGatePassed} onChange={(event) => setRunItemForm((current) => ({ ...current, hardGatePassed: event.target.checked }))} />
                      <span>Hard Gate Passed</span>
                    </label>
                    <label className="evaluation-workbench-check">
                      <input type="checkbox" checked={runItemForm.requiresHumanReview} onChange={(event) => setRunItemForm((current) => ({ ...current, requiresHumanReview: event.target.checked }))} />
                      <span>Requires Human Review</span>
                    </label>
                  </div>
                  <button type="button" onClick={() => void handleSaveRunItemResult()} disabled={isBusy}>Save Run Item Result</button>
                </>
              ) : null}
            </>
          )}
        </section>

        <section className="evaluation-workbench-panel">
          <div className="evaluation-workbench-panel-header">
            <h3>Finalize Run</h3>
            <span>{selectedRun?.id ?? "Select run first"}</span>
          </div>
          {selectedRun == null ? (
            <p className="evaluation-workbench-empty">Choose a run before recording evidence and finalizing it.</p>
          ) : (
            <>
              <div className="evaluation-workbench-form-grid">
                <Field label="Run Status">
                  <select value={finalizeForm.status} onChange={(event) => setFinalizeForm((current) => ({ ...current, status: event.target.value as "passed" | "failed" }))}>
                    <option value="passed">passed</option>
                    <option value="failed">failed</option>
                  </select>
                </Field>
                <Field label="Evidence Type">
                  <select
                    value={finalizeForm.evidenceKind}
                    onChange={(event) =>
                      setFinalizeForm((current) => {
                        const nextEvidenceKind = event.target.value as VerificationEvidenceKind;
                        return {
                          ...current,
                          evidenceKind: nextEvidenceKind,
                          artifactAssetId:
                            nextEvidenceKind === "artifact" && !current.artifactAssetId
                              ? resolvePreferredFinalizeArtifactAssetId(finalizeArtifactOptions)
                              : current.artifactAssetId,
                        };
                      })}
                  >
                    <option value="url">url</option>
                    <option value="artifact">artifact</option>
                  </select>
                </Field>
                <Field label="Evidence Label"><input value={finalizeForm.evidenceLabel} onChange={(event) => setFinalizeForm((current) => ({ ...current, evidenceLabel: event.target.value }))} /></Field>
                {finalizeForm.evidenceKind === "url" ? (
                  <Field label="Evidence URL" wide><input value={finalizeForm.evidenceUrl} onChange={(event) => setFinalizeForm((current) => ({ ...current, evidenceUrl: event.target.value }))} /></Field>
                ) : (
                  <Field label="Artifact Asset ID" wide><input value={finalizeForm.artifactAssetId} onChange={(event) => setFinalizeForm((current) => ({ ...current, artifactAssetId: event.target.value }))} /></Field>
                )}
              </div>
              {finalizeForm.evidenceKind === "artifact" ? (
                finalizeArtifactOptions.length > 0 ? (
                  <div className="evaluation-workbench-inline-list" role="group" aria-label="Artifact evidence suggestions">
                    {finalizeArtifactOptions.map((option) => (
                      <button
                        key={`${option.source}-${option.assetId}`}
                        type="button"
                        className="evaluation-workbench-action"
                        onClick={() =>
                          setFinalizeForm((current) => ({
                            ...current,
                            artifactAssetId: option.assetId,
                          }))
                        }
                      >
                        {option.actionLabel}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="evaluation-workbench-empty">
                    Save a run-item result or load linked sample context to reuse an internal artifact as evidence.
                  </p>
                )
              ) : null}
              <button type="button" onClick={() => void handleCompleteAndFinalizeRun()} disabled={isBusy}>Complete And Finalize Run</button>
              {effectiveFinalizedResult ? (
                <div className="evaluation-workbench-result evaluation-workbench-finalized">
                  <strong>Finalized Recommendation</strong>
                  <div>
                    <span>Run: {effectiveFinalizedResult.run.id}</span>
                    <span>Evidence Pack: {effectiveFinalizedResult.evidence_pack.id}</span>
                    <span>Summary: {effectiveFinalizedResult.evidence_pack.summary_status}</span>
                    <span>Recommendation: {effectiveFinalizedResult.recommendation.status}</span>
                    {effectiveFinalizedResult.recommendation.decision_reason ? <span>{effectiveFinalizedResult.recommendation.decision_reason}</span> : null}
                  </div>
                  <EvaluationWorkbenchEvidencePackSummary
                    evidencePack={effectiveFinalizedResult.evidence_pack}
                  />
                  <EvaluationWorkbenchEvidenceList evidence={selectedRunEvidence} />
                </div>
              ) : (
                <p className="evaluation-workbench-empty">Finalize the run to produce a governed recommendation.</p>
              )}
            </>
          )}
        </section>

        <section className="evaluation-workbench-panel">
          <div className="evaluation-workbench-panel-header">
            <h3>Learning Handoff</h3>
            <span>{effectiveFinalizedResult ? createdLearningCandidate?.id ?? "Ready to create" : "Finalize run first"}</span>
          </div>
          {!effectiveFinalizedResult ? (
            <p className="evaluation-workbench-empty">The learning handoff stays gated until the evaluation run is finalized.</p>
          ) : (
            <>
              {linkedSampleSetItem ? (
                <p className="evaluation-workbench-empty">
                  Snapshot auto-linked from sample item {linkedSampleSetItem.id}.
                </p>
              ) : null}
              <div className="evaluation-workbench-form-grid">
                <Field label="Reviewed Case Snapshot ID"><input value={learningForm.reviewedCaseSnapshotId} onChange={(event) => setLearningForm((current) => ({ ...current, reviewedCaseSnapshotId: event.target.value }))} /></Field>
                <Field label="Source Asset ID"><input value={learningForm.sourceAssetId} onChange={(event) => setLearningForm((current) => ({ ...current, sourceAssetId: event.target.value }))} /></Field>
                <Field label="Learning Candidate Type">
                  <select value={learningForm.candidateType} onChange={(event) => setLearningForm((current) => ({ ...current, candidateType: event.target.value as LearningCandidateType }))}>
                    {learningCandidateTypes.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="Created By"><input value={learningForm.createdBy} onChange={(event) => setLearningForm((current) => ({ ...current, createdBy: event.target.value }))} /></Field>
                <Field label="Learning Candidate Title"><input value={learningForm.title} onChange={(event) => setLearningForm((current) => ({ ...current, title: event.target.value }))} /></Field>
                <Field label="Learning Proposal" wide><textarea value={learningForm.proposalText} onChange={(event) => setLearningForm((current) => ({ ...current, proposalText: event.target.value }))} /></Field>
              </div>
              <div className="evaluation-workbench-button-row">
                <button type="button" onClick={() => void handleCreateLearningCandidate()} disabled={isBusy}>Create Learning Candidate</button>
                {learningReviewHash ? <a href={learningReviewHash}>Open Learning Review</a> : null}
              </div>
              {createdLearningCandidate ? (
                <div className="evaluation-workbench-result">
                  <strong>Learning Candidate Created</strong>
                  <div>
                    <span>{createdLearningCandidate.id}</span>
                    <span>{createdLearningCandidate.status}</span>
                    <span>{createdLearningCandidate.type}</span>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </section>
  );

  async function loadOverview(input?: {
    selectedSuiteId?: string | null;
    selectedRunId?: string | null;
    manuscriptId?: string | null;
  }) {
    setLoadStatus("loading");
    setErrorMessage(null);
    try {
      setOverview(await controller.loadOverview(input));
      setLoadStatus("ready");
    } catch (error) {
      setLoadStatus("error");
      setErrorMessage(toErrorMessage(error));
    }
  }

  async function handleSelectSuite(suiteId: string) {
    setStatusMessage(null);
    setFinalizedResult(null);
    setCreatedLearningCandidate(null);
    await loadOverview({ selectedSuiteId: suiteId, selectedRunId: null });
  }

  async function handleSelectRun(runId: string) {
    if (!overview) return;
    setStatusMessage(null);
    setFinalizedResult(null);
    setCreatedLearningCandidate(null);
    await loadOverview({ selectedSuiteId: overview.selectedSuiteId, selectedRunId: runId });
  }

  async function handleActivateSuite(suiteId: string) {
    setIsActivatingSuiteId(suiteId);
    setErrorMessage(null);
    try {
      const nextOverview = await controller.activateSuiteAndReload({ suiteId, actorRole });
      setOverview(nextOverview);
      setStatusMessage(`Activated evaluation suite ${suiteId}.`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsActivatingSuiteId(null);
    }
  }

  async function handleCreateRun() {
    if (!selectedSuite) return setErrorMessage("Select a suite before creating a run.");
    if (!runForm.sampleSetId.trim()) return setErrorMessage("Select a sample set before creating a run.");
    await runBusyTask(async () => {
      const result = await controller.createRunAndReload({
        actorRole,
        suiteId: selectedSuite.id,
        sampleSetId: runForm.sampleSetId.trim(),
        baselineBinding: createBinding("baseline", runForm.baselineModelId, runForm),
        candidateBinding: createBinding("candidate", runForm.candidateModelId, runForm),
        releaseCheckProfileId: optional(runForm.releaseCheckProfileId),
      });
      setOverview(result.overview);
      setFinalizedResult(null);
      setCreatedLearningCandidate(null);
      setStatusMessage(`Created evaluation run ${result.run.id}.`);
    });
  }

  async function handleSaveRunItemResult() {
    if (!selectedSuite || !selectedRun || !selectedRunItem) {
      return setErrorMessage("Select a suite, run, and run item before saving the result.");
    }
    await runBusyTask(async () => {
      const result = await controller.recordRunItemResultAndReload({
        actorRole,
        suiteId: selectedSuite.id,
        runId: selectedRun.id,
        runItemId: selectedRunItem.id,
        resultAssetId: optional(runItemForm.resultAssetId),
        hardGatePassed: runItemForm.hardGatePassed,
        weightedScore: numberOrUndefined(runItemForm.weightedScore),
        diffSummary: optional(runItemForm.diffSummary),
        requiresHumanReview: runItemForm.requiresHumanReview,
        failureKind: runItemForm.failureKind || undefined,
        failureReason: optional(runItemForm.failureReason),
      });
      setOverview(result.overview);
      setFinalizedResult(null);
      setCreatedLearningCandidate(null);
      setStatusMessage(`Saved run item result ${result.runItem.id}.`);
    });
  }

  async function handleCompleteAndFinalizeRun() {
    if (!selectedSuite || !selectedRun) return setErrorMessage("Select a run before finalizing it.");
    if (!finalizeForm.evidenceLabel.trim()) {
      return setErrorMessage("Evidence label is required before finalization.");
    }
    if (finalizeForm.evidenceKind === "url" && !finalizeForm.evidenceUrl.trim()) {
      return setErrorMessage("Evidence URL is required when recording URL evidence.");
    }
    if (finalizeForm.evidenceKind === "artifact" && !finalizeForm.artifactAssetId.trim()) {
      return setErrorMessage("Artifact asset ID is required when recording artifact evidence.");
    }
    await runBusyTask(async () => {
      const result = await controller.completeRunWithEvidenceAndFinalize({
        actorRole,
        suiteId: selectedSuite.id,
        runId: selectedRun.id,
        status: finalizeForm.status,
        existingEvidenceIds: selectedRun.evidence_ids,
        evidence:
          finalizeForm.evidenceKind === "artifact"
            ? {
                kind: "artifact",
                label: finalizeForm.evidenceLabel.trim(),
                artifactAssetId: finalizeForm.artifactAssetId.trim(),
              }
            : {
                kind: "url",
                label: finalizeForm.evidenceLabel.trim(),
                uri: finalizeForm.evidenceUrl.trim(),
              },
      });
      setOverview(result.overview);
      setFinalizedResult(result.finalized);
      setCreatedLearningCandidate(null);
      setStatusMessage(`Finalized evaluation run ${result.finalized.run.id} with ${result.finalized.recommendation.status} recommendation.`);
    });
  }

  async function handleCreateLearningCandidate() {
    if (!effectiveFinalizedResult) return setErrorMessage("Finalize the evaluation run before creating a learning candidate.");
    await runBusyTask(async () => {
      const learningCandidate = await controller.createLearningCandidateFromEvaluation({
        actorRole,
        runId: effectiveFinalizedResult.run.id,
        evidencePackId: effectiveFinalizedResult.evidence_pack.id,
        reviewedCaseSnapshotId: learningForm.reviewedCaseSnapshotId.trim(),
        candidateType: learningForm.candidateType,
        title: optional(learningForm.title),
        proposalText: optional(learningForm.proposalText),
        createdBy: learningForm.createdBy.trim(),
        sourceAssetId: learningForm.sourceAssetId.trim(),
      });
      setCreatedLearningCandidate(learningCandidate);
      setStatusMessage(`Created learning candidate ${learningCandidate.id}.`);
    });
  }

  async function runBusyTask(task: () => Promise<void>) {
    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await task();
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }
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
          const manuscriptWorkbenchHash =
            sampleSetItem?.manuscript_id?.trim()
              ? formatWorkbenchHash(manuscriptWorkbenchMode, {
                  manuscriptId: sampleSetItem.manuscript_id,
                })
              : null;
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
  const manuscriptWorkbenchHash =
    linkedSampleSetItem?.manuscript_id?.trim()
      ? formatWorkbenchHash(
          resolveLinkedSampleWorkbenchMode(linkedSampleSetItem.module),
          { manuscriptId: linkedSampleSetItem.manuscript_id },
        )
      : null;
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

function formatRunItemSummary(item: EvaluationWorkbenchOverview["runItems"][number]) {
  return [
    item.hard_gate_passed == null ? "Hard gate pending" : item.hard_gate_passed ? "Hard gate passed" : "Hard gate failed",
    item.weighted_score == null ? "Score pending" : `Score ${item.weighted_score}`,
    item.requires_human_review ? "Needs review" : "No manual review flag",
  ].join(" 路 ");
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
  entries: EvaluationWorkbenchOverview["finalizedRunHistory"],
  filter: EvaluationWorkbenchHistoryFilter,
) {
  if (filter === "all") return entries;
  return entries.filter((entry) => entry.finalized.recommendation.status === filter);
}

export function sortFinalizedRunHistory(
  entries: EvaluationWorkbenchOverview["finalizedRunHistory"],
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
  entries: EvaluationWorkbenchOverview["finalizedRunHistory"],
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
  entries: EvaluationWorkbenchOverview["finalizedRunHistory"],
  selectedRunId: string | null,
) {
  if (selectedRunId == null) return false;
  return !entries.some((entry) => entry.run.id === selectedRunId);
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

function summarizeFinalizedEntry(
  entry: EvaluationWorkbenchOverview["finalizedRunHistory"][number],
) {
  return [
    entry.finalized.recommendation.decision_reason,
    entry.run.finished_at ? `Finished ${entry.run.finished_at}` : undefined,
  ]
    .filter((value) => Boolean(value))
    .join(" 路 ");
}

function resolveSampleSetId(overview: EvaluationWorkbenchOverview, preferredId: string, selectedSuite: EvaluationWorkbenchOverview["suites"][number] | null) {
  if (preferredId && overview.sampleSets.some((item) => item.id === preferredId)) return preferredId;
  const scope = selectedSuite?.module_scope === "any" ? [] : selectedSuite?.module_scope ?? [];
  return overview.sampleSets.find((item) => (scope.length === 0 ? true : scope.includes(item.module)))?.id ?? overview.sampleSets[0]?.id ?? "";
}

function resolveSelectedId(ids: readonly string[], preferredId: string | null) {
  return preferredId && ids.includes(preferredId) ? preferredId : ids[0] ?? null;
}

function createBinding(lane: "baseline" | "candidate", modelId: string, form: typeof baseRunForm) {
  return {
    lane,
    modelId: modelId.trim(),
    runtimeId: form.runtimeId.trim(),
    promptTemplateId: form.promptTemplateId.trim(),
    skillPackageIds: form.skillPackageIds.split(",").map((item) => item.trim()).filter(Boolean),
    moduleTemplateId: form.moduleTemplateId.trim(),
  };
}

function optional(value: string) {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
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

function summarizeEvidenceLabels(evidence: VerificationEvidenceViewModel[]) {
  return evidence.length > 0 ? evidence.map((item) => item.label).join(", ") : "None recorded";
}

function createFinalizeArtifactOptions(
  selectedRunItem: EvaluationWorkbenchOverview["runItems"][number] | null,
  linkedSampleSetItem: EvaluationWorkbenchOverview["sampleSetItems"][number] | null,
) {
  const options: Array<{
    source: "result_asset" | "sample_snapshot";
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

function numberOrUndefined(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toErrorMessage(error: unknown) {
  if (error instanceof BrowserHttpClientError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Unexpected evaluation workbench error.";
}
