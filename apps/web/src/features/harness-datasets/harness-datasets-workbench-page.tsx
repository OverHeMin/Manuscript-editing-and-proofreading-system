import { useEffect, useState, type ReactNode } from "react";
import { WorkbenchCoreStrip } from "../../app/workbench-core-strip.tsx";
import { createBrowserHttpClient, BrowserHttpClientError } from "../../lib/browser-http-client.ts";
import {
  createHarnessDatasetsWorkbenchController,
  type HarnessDatasetsWorkbenchController,
} from "./harness-datasets-controller.ts";
import type {
  HarnessDatasetExportFormat,
  HarnessDatasetVersionViewModel,
  HarnessDatasetsWorkbenchOverview,
} from "./types.ts";

if (typeof document !== "undefined") {
  void import("./harness-datasets-workbench.css");
}

const defaultController = createHarnessDatasetsWorkbenchController(
  createBrowserHttpClient(),
);

export interface HarnessDatasetsWorkbenchPageProps {
  controller?: HarnessDatasetsWorkbenchController;
  initialOverview?: HarnessDatasetsWorkbenchOverview | null;
}

export function HarnessDatasetsWorkbenchPage({
  controller = defaultController,
  initialOverview = null,
}: HarnessDatasetsWorkbenchPageProps) {
  const [overview, setOverview] = useState<HarnessDatasetsWorkbenchOverview | null>(
    initialOverview,
  );
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">(
    initialOverview ? "ready" : "idle",
  );
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialOverview != null) {
      return;
    }

    void loadOverview();
  }, [controller, initialOverview]);

  if (loadStatus === "error" && !overview) {
    return (
      <article className="workbench-placeholder" role="alert">
        <h2>Harness Dataset Workbench Unavailable</h2>
        <p>{errorMessage ?? "Unable to load harness dataset governance state."}</p>
      </article>
    );
  }

  if (!overview) {
    return (
      <article className="workbench-placeholder" role="status">
        <h2>Harness Dataset Workbench</h2>
        <p>Loading gold-set drafts, published versions, and rubric links...</p>
      </article>
    );
  }

  return (
    <section className="harness-datasets-workbench">
      <header className="harness-datasets-hero">
        <div className="harness-datasets-hero-copy">
          <p className="harness-datasets-eyebrow">Operations Management Zone</p>
          <h2>Harness Dataset Workbench</h2>
          <p>
            Bounded admin-only workbench for governed gold-set curation and local
            export.
          </p>
          <WorkbenchCoreStrip variant="secondary" />
        </div>
        {statusMessage ? (
          <p className="harness-datasets-status" role="status">
            {statusMessage}
          </p>
        ) : null}
      </header>

      {errorMessage ? (
        <p className="harness-datasets-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <section className="harness-datasets-summary">
        <article className="harness-datasets-summary-card">
          <span>Draft Queue</span>
          <strong>{overview.draftVersions.length}</strong>
        </article>
        <article className="harness-datasets-summary-card">
          <span>Published Versions</span>
          <strong>{overview.publishedVersions.length}</strong>
        </article>
        <article className="harness-datasets-summary-card">
          <span>Published Rubrics</span>
          <strong>
            {overview.rubrics.filter((rubric) => rubric.status === "published").length}
          </strong>
        </article>
        <article className="harness-datasets-summary-card harness-datasets-summary-card-wide">
          <span>Local export root</span>
          <strong>{overview.exportRootDir}</strong>
        </article>
      </section>

      <div className="harness-datasets-layout">
        <article className="harness-datasets-panel">
          <div className="harness-datasets-panel-header">
            <h3>Draft Queue</h3>
            <span>{overview.draftVersions.length} draft version(s)</span>
          </div>
          {overview.draftVersions.length > 0 ? (
            <div className="harness-datasets-stack">
              {overview.draftVersions.map((version) => (
                <HarnessDatasetVersionCard key={version.id} version={version} />
              ))}
            </div>
          ) : (
            <p className="harness-datasets-empty">
              No draft gold-set versions are waiting in the curation queue.
            </p>
          )}
        </article>

        <article className="harness-datasets-panel">
          <div className="harness-datasets-panel-header">
            <h3>Published Versions</h3>
            <span>{overview.publishedVersions.length} published version(s)</span>
          </div>
          <p className="harness-datasets-note">
            Local export root: {overview.exportRootDir}
          </p>
          {overview.publishedVersions.length > 0 ? (
            <div className="harness-datasets-stack">
              {overview.publishedVersions.map((version) => (
                <HarnessDatasetVersionCard
                  key={version.id}
                  version={version}
                  actions={
                    <div className="harness-datasets-actions">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleExport(version.id, "json")}
                      >
                        Export JSON
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleExport(version.id, "jsonl")}
                      >
                        Export JSONL
                      </button>
                    </div>
                  }
                />
              ))}
            </div>
          ) : (
            <p className="harness-datasets-empty">
              No published gold-set versions are available for export yet.
            </p>
          )}
        </article>
      </div>
    </section>
  );

  async function loadOverview() {
    setLoadStatus("loading");
    setErrorMessage(null);

    try {
      const nextOverview = await controller.loadOverview();
      setOverview(nextOverview);
      setLoadStatus("ready");
    } catch (error) {
      setLoadStatus("error");
      setErrorMessage(toErrorMessage(error));
    }
  }

  async function handleExport(
    goldSetVersionId: string,
    format: HarnessDatasetExportFormat,
  ) {
    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const result = await controller.exportGoldSetVersionAndReload({
        goldSetVersionId,
        format,
      });
      setOverview(result.overview);
      setLoadStatus("ready");
      setStatusMessage(
        `Local ${format.toUpperCase()} export saved to ${result.exportResult.outputPath}.`,
      );
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }
}

function HarnessDatasetVersionCard(props: {
  version: HarnessDatasetVersionViewModel;
  actions?: ReactNode;
}) {
  const { version, actions } = props;

  return (
    <article className="harness-datasets-card">
      <header className="harness-datasets-card-header">
        <div>
          <h4>{version.familyName}</h4>
          <p>
            {version.familyScope.module} · v{version.versionNo} · {version.status}
          </p>
        </div>
        <div className="harness-datasets-gates">
          <span>
            De-identification:{" "}
            {version.deidentificationGatePassed ? "passed" : "pending"}
          </span>
          <span>
            Human review: {version.humanReviewGatePassed ? "passed" : "pending"}
          </span>
        </div>
      </header>

      <p className="harness-datasets-copy">
        Focus: {version.familyScope.measureFocus} · Manuscript types:{" "}
        {version.familyScope.manuscriptTypes.join(", ")}
      </p>
      <p className="harness-datasets-copy">
        Rubric: {describeRubricAssignment(version)}
      </p>
      <p className="harness-datasets-copy">Curated items: {version.itemCount}</p>

      <div className="harness-datasets-provenance">
        <strong>Source provenance</strong>
        <ul className="harness-datasets-list">
          {version.sourceProvenance.map((source) => (
            <li key={`${source.sourceKind}:${source.sourceId}`}>
              <span>
                {source.sourceKind}: {source.sourceId}
              </span>
              <small>
                {source.manuscriptType} · {source.manuscriptId}
                {source.riskTags?.length ? ` · ${source.riskTags.join(", ")}` : ""}
              </small>
            </li>
          ))}
        </ul>
      </div>

      {version.publications.length > 0 ? (
        <div className="harness-datasets-publications">
          <strong>Publication history</strong>
          <ul className="harness-datasets-list">
            {version.publications.map((publication) => (
              <li key={publication.id}>
                <span>
                  {publication.exportFormat} · {publication.status}
                </span>
                <small>{publication.outputUri ?? "No local path recorded"}</small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {actions}
    </article>
  );
}

function describeRubricAssignment(version: HarnessDatasetVersionViewModel) {
  if (version.rubricAssignment.status === "missing") {
    return "Manual assignment required";
  }

  return `${version.rubricAssignment.rubricName ?? "Assigned rubric"} v${
    version.rubricAssignment.rubricVersionNo ?? "?"
  } (${version.rubricAssignment.status})`;
}

function toErrorMessage(error: unknown) {
  if (error instanceof BrowserHttpClientError) {
    const body =
      typeof error.responseBody === "string"
        ? error.responseBody
        : JSON.stringify(error.responseBody);
    return `Harness dataset action failed: HTTP ${error.status} ${body}`;
  }

  return error instanceof Error && error.message.trim()
    ? error.message
    : "Unexpected harness dataset workbench error.";
}
