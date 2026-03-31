import { useEffect, useState } from "react";
import { createBrowserHttpClient, BrowserHttpClientError } from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/index.ts";
import {
  createEvaluationWorkbenchController,
  type EvaluationWorkbenchController,
  type EvaluationWorkbenchOverview,
} from "./evaluation-workbench-controller.ts";

const defaultController = createEvaluationWorkbenchController(createBrowserHttpClient());

export interface EvaluationWorkbenchPageProps {
  controller?: EvaluationWorkbenchController;
  actorRole?: AuthRole;
}

export function EvaluationWorkbenchPage({
  controller = defaultController,
  actorRole = "admin",
}: EvaluationWorkbenchPageProps) {
  const [overview, setOverview] = useState<EvaluationWorkbenchOverview | null>(null);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isActivatingSuiteId, setIsActivatingSuiteId] = useState<string | null>(null);

  useEffect(() => {
    void loadOverview();
  }, [controller]);

  if (overview == null) {
    return (
      <article className="workbench-placeholder" role="status">
        <h2>Evaluation Workbench</h2>
        <p>Loading suites, runs, and verification assets...</p>
      </article>
    );
  }

  if (loadStatus === "error") {
    return (
      <article className="workbench-placeholder" role="alert">
        <h2>Evaluation Workbench Unavailable</h2>
        <p>{errorMessage ?? "Unable to load evaluation governance data."}</p>
      </article>
    );
  }

  const selectedSuite =
    overview.suites.find((suite) => suite.id === overview.selectedSuiteId) ?? null;
  const selectedRun =
    overview.runs.find((run) => run.id === overview.selectedRunId) ?? null;

  return (
    <section className="evaluation-workbench">
      <header className="evaluation-workbench-hero">
        <div>
          <h2>Evaluation Workbench</h2>
          <p>
            Review verification profiles, evaluate published suites, and inspect run output before
            deeper promotion or learning handoff steps.
          </p>
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
              <dd>
                {overview.checkProfiles.filter((profile) => profile.status === "published").length}
              </dd>
            </div>
            <div>
              <dt>Release gates</dt>
              <dd>
                {
                  overview.releaseCheckProfiles.filter(
                    (profile) => profile.status === "published",
                  ).length
                }
              </dd>
            </div>
            <div>
              <dt>Covered modules</dt>
              <dd>{summarizeCoveredModules(overview.sampleSets)}</dd>
            </div>
          </dl>
          <ul className="evaluation-workbench-inline-list">
            {overview.sampleSets.map((sampleSet) => (
              <li key={sampleSet.id}>
                <strong>{sampleSet.name}</strong>
                <span>
                  {sampleSet.module} · {sampleSet.sample_count} samples · {sampleSet.status}
                </span>
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
              {overview.suites.map((suite) => {
                const isSelected = suite.id === overview.selectedSuiteId;
                const isActivating = isActivatingSuiteId === suite.id;
                return (
                  <li key={suite.id}>
                    <button
                      type="button"
                      className={`evaluation-workbench-select${isSelected ? " is-selected" : ""}`}
                      onClick={() => void handleSelectSuite(suite.id)}
                    >
                      <strong>{suite.name}</strong>
                      <span>
                        {suite.suite_type} · {suite.status}
                      </span>
                    </button>
                    {suite.status === "draft" ? (
                      <button
                        type="button"
                        className="evaluation-workbench-action"
                        disabled={isActivating}
                        onClick={() => void handleActivateSuite(suite.id)}
                      >
                        {isActivating ? "Activating..." : "Activate"}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="evaluation-workbench-panel">
          <div className="evaluation-workbench-panel-header">
            <h3>Runs</h3>
            <span>{selectedSuite?.name ?? "No suite selected"}</span>
          </div>
          {selectedSuite == null ? (
            <p className="evaluation-workbench-empty">
              Select a suite to inspect persisted evaluation runs.
            </p>
          ) : overview.runs.length === 0 ? (
            <p className="evaluation-workbench-empty">
              No runs have been recorded for this suite yet.
            </p>
          ) : (
            <ul className="evaluation-workbench-stack">
              {overview.runs.map((run) => {
                const isSelected = run.id === overview.selectedRunId;
                return (
                  <li key={run.id}>
                    <button
                      type="button"
                      className={`evaluation-workbench-select${isSelected ? " is-selected" : ""}`}
                      onClick={() => void handleSelectRun(run.id)}
                    >
                      <strong>{run.id}</strong>
                      <span>
                        {run.status} · {run.run_item_count ?? 0} items
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="evaluation-workbench-panel">
          <div className="evaluation-workbench-panel-header">
            <h3>Run Items</h3>
            <span>{selectedRun?.id ?? "No run selected"}</span>
          </div>
          {selectedRun == null ? (
            <p className="evaluation-workbench-empty">
              Pick a run to review candidate/baseline item outcomes.
            </p>
          ) : overview.runItems.length === 0 ? (
            <p className="evaluation-workbench-empty">
              This run has no recorded run-item results yet.
            </p>
          ) : (
            <ul className="evaluation-workbench-inline-list">
              {overview.runItems.map((item) => (
                <li key={item.id}>
                  <strong>
                    {item.id} · {item.lane}
                  </strong>
                  <span>
                    {formatRunItemSummary(item)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );

  async function loadOverview(input?: {
    selectedSuiteId?: string | null;
    selectedRunId?: string | null;
  }) {
    setLoadStatus("loading");
    setErrorMessage(null);

    try {
      const nextOverview = await controller.loadOverview(input);
      setOverview(nextOverview);
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
    });
  }

  async function handleSelectRun(runId: string) {
    if (overview == null) {
      return;
    }

    setStatusMessage(null);
    await loadOverview({
      selectedSuiteId: overview.selectedSuiteId,
      selectedRunId: runId,
    });
  }

  async function handleActivateSuite(suiteId: string) {
    setIsActivatingSuiteId(suiteId);
    setErrorMessage(null);

    try {
      const nextOverview = await controller.activateSuiteAndReload({
        suiteId,
        actorRole,
      });
      setOverview(nextOverview);
      setLoadStatus("ready");
      setStatusMessage(`Activated evaluation suite ${suiteId}.`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsActivatingSuiteId(null);
    }
  }
}

function SummaryCard(props: { label: string; value: number }) {
  return (
    <article className="evaluation-workbench-summary-card">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </article>
  );
}

function summarizeCoveredModules(sampleSets: EvaluationWorkbenchOverview["sampleSets"]): string {
  const moduleNames = Array.from(new Set(sampleSets.map((sampleSet) => sampleSet.module)));
  return moduleNames.length > 0 ? moduleNames.join(", ") : "Not available";
}

function formatRunItemSummary(
  item: EvaluationWorkbenchOverview["runItems"][number],
): string {
  const fragments = [
    item.hard_gate_passed == null
      ? "Hard gate pending"
      : item.hard_gate_passed
        ? "Hard gate passed"
        : "Hard gate failed",
    item.weighted_score == null ? "Score pending" : `Score ${item.weighted_score}`,
    item.requires_human_review ? "Needs review" : "No manual review flag",
  ];

  return fragments.join(" · ");
}

function toErrorMessage(error: unknown): string {
  if (error instanceof BrowserHttpClientError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unexpected evaluation workbench error.";
}
