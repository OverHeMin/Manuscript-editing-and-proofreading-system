import { useEffect, useState } from "react";
import { formatWorkbenchHash } from "../../app/workbench-routing.ts";
import { createBrowserHttpClient, BrowserHttpClientError } from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/index.ts";
import type { LearningCandidateType } from "../learning-review/types.ts";
import type { EvaluationRunItemFailureKind } from "../verification-ops/index.ts";
import {
  createEvaluationWorkbenchController,
  type EvaluationWorkbenchController,
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
  evidenceLabel: "Browser QA evidence",
  evidenceUrl: "https://example.test/evidence/browser-qa",
};
const baseLearningForm = {
  reviewedCaseSnapshotId: "reviewed-case-snapshot-demo-1",
  sourceAssetId: "human-final-demo-1",
  candidateType: "prompt_optimization_candidate" as LearningCandidateType,
  title: "Promote evaluated editing binding",
  proposalText: "Promote the candidate binding after governed evaluation approval.",
  createdBy: "admin-1",
};

export interface EvaluationWorkbenchPageProps {
  controller?: EvaluationWorkbenchController;
  actorRole?: AuthRole;
}

export function EvaluationWorkbenchPage({
  controller = defaultController,
  actorRole = "admin",
}: EvaluationWorkbenchPageProps) {
  const [overview, setOverview] = useState<EvaluationWorkbenchOverview | null>(null);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isActivatingSuiteId, setIsActivatingSuiteId] = useState<string | null>(null);
  const [selectedRunItemId, setSelectedRunItemId] = useState<string | null>(null);
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
    void loadOverview();
  }, [controller]);

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
  const selectedRunItem = overview?.runItems.find((item) => item.id === selectedRunItemId) ?? null;
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
    if (!selectedRun || finalizedResult?.run.id === selectedRun.id) return;
    setFinalizedResult(null);
    setCreatedLearningCandidate(null);
  }, [selectedRun, finalizedResult]);

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
                <Field label="Evidence Label"><input value={finalizeForm.evidenceLabel} onChange={(event) => setFinalizeForm((current) => ({ ...current, evidenceLabel: event.target.value }))} /></Field>
                <Field label="Evidence URL" wide><input value={finalizeForm.evidenceUrl} onChange={(event) => setFinalizeForm((current) => ({ ...current, evidenceUrl: event.target.value }))} /></Field>
              </div>
              <button type="button" onClick={() => void handleCompleteAndFinalizeRun()} disabled={isBusy}>Complete And Finalize Run</button>
              {finalizedResult ? (
                <div className="evaluation-workbench-result evaluation-workbench-finalized">
                  <strong>Finalized Recommendation</strong>
                  <div>
                    <span>Run: {finalizedResult.run.id}</span>
                    <span>Evidence Pack: {finalizedResult.evidence_pack.id}</span>
                    <span>Summary: {finalizedResult.evidence_pack.summary_status}</span>
                    <span>Recommendation: {finalizedResult.recommendation.status}</span>
                    {finalizedResult.recommendation.decision_reason ? <span>{finalizedResult.recommendation.decision_reason}</span> : null}
                  </div>
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
            <span>{finalizedResult ? createdLearningCandidate?.id ?? "Ready to create" : "Finalize run first"}</span>
          </div>
          {!finalizedResult ? (
            <p className="evaluation-workbench-empty">The learning handoff stays gated until the evaluation run is finalized.</p>
          ) : (
            <>
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

  async function loadOverview(input?: { selectedSuiteId?: string | null; selectedRunId?: string | null }) {
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
    if (!finalizeForm.evidenceLabel.trim() || !finalizeForm.evidenceUrl.trim()) {
      return setErrorMessage("Evidence label and URL are required before finalization.");
    }
    await runBusyTask(async () => {
      const result = await controller.completeRunWithEvidenceAndFinalize({
        actorRole,
        suiteId: selectedSuite.id,
        runId: selectedRun.id,
        status: finalizeForm.status,
        existingEvidenceIds: selectedRun.evidence_ids,
        evidence: { kind: "url", label: finalizeForm.evidenceLabel.trim(), uri: finalizeForm.evidenceUrl.trim() },
      });
      setOverview(result.overview);
      setFinalizedResult(result.finalized);
      setCreatedLearningCandidate(null);
      setStatusMessage(`Finalized evaluation run ${result.finalized.run.id} with ${result.finalized.recommendation.status} recommendation.`);
    });
  }

  async function handleCreateLearningCandidate() {
    if (!finalizedResult) return setErrorMessage("Finalize the evaluation run before creating a learning candidate.");
    await runBusyTask(async () => {
      const learningCandidate = await controller.createLearningCandidateFromEvaluation({
        actorRole,
        runId: finalizedResult.run.id,
        evidencePackId: finalizedResult.evidence_pack.id,
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

function formatRunItemSummary(item: EvaluationWorkbenchOverview["runItems"][number]) {
  return [
    item.hard_gate_passed == null ? "Hard gate pending" : item.hard_gate_passed ? "Hard gate passed" : "Hard gate failed",
    item.weighted_score == null ? "Score pending" : `Score ${item.weighted_score}`,
    item.requires_human_review ? "Needs review" : "No manual review flag",
  ].join(" 路 ");
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
