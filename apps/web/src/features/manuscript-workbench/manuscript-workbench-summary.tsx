import type { ReactNode } from "react";
import type { JobViewModel, DocumentAssetViewModel } from "../manuscripts/index.ts";
import type { ModuleJobViewModel } from "../screening/index.ts";
import type { ManuscriptWorkbenchWorkspace } from "./manuscript-workbench-controller.ts";

type AnyWorkbenchJob = JobViewModel | ModuleJobViewModel;

export interface WorkbenchActionResultDetail {
  label: string;
  value: string;
}

export interface WorkbenchActionResultViewModel {
  tone: "success" | "error";
  actionLabel: string;
  message: string;
  details: WorkbenchActionResultDetail[];
}

export interface ManuscriptWorkbenchSummaryProps {
  workspace: ManuscriptWorkbenchWorkspace;
  latestJob: AnyWorkbenchJob | null;
  latestExport: string;
  latestActionResult?: WorkbenchActionResultViewModel | null;
}

export function ManuscriptWorkbenchSummary({
  workspace,
  latestJob,
  latestExport,
  latestActionResult = null,
}: ManuscriptWorkbenchSummaryProps) {
  return (
    <section className="manuscript-workbench-summary">
      <div className="manuscript-workbench-summary-grid">
        <SummaryCard title="Latest Action Result">
          {latestActionResult ? (
            <>
              <SummaryMetric label="Action" value={latestActionResult.actionLabel} />
              <SummaryMetric
                label="Outcome"
                value={
                  <StatusPill tone={latestActionResult.tone}>
                    {latestActionResult.tone === "success" ? "success" : "attention needed"}
                  </StatusPill>
                }
              />
              <SummaryMetric label="Result" value={latestActionResult.message} />
              {latestActionResult.details.map((detail) => (
                <SummaryMetric
                  key={`${detail.label}:${detail.value}`}
                  label={detail.label}
                  value={detail.value}
                />
              ))}
            </>
          ) : (
            <p className="manuscript-workbench-empty">
              Complete an upload, module run, export, or refresh to pin the latest operator action.
            </p>
          )}
        </SummaryCard>

        <SummaryCard title="Manuscript Overview">
          <SummaryMetric label="Title" value={workspace.manuscript.title} />
          <SummaryMetric label="Manuscript ID" value={workspace.manuscript.id} />
          <SummaryMetric
            label="Type"
            value={workspace.manuscript.manuscript_type}
          />
          <SummaryMetric
            label="Status"
            value={<StatusPill tone="neutral">{workspace.manuscript.status}</StatusPill>}
          />
          <SummaryMetric
            label="Created By"
            value={workspace.manuscript.created_by}
          />
          <SummaryMetric
            label="Last Updated"
            value={formatTimestamp(workspace.manuscript.updated_at)}
          />
        </SummaryCard>

        <SummaryCard title="Current Asset">
          {workspace.currentAsset ? (
            <>
              <SummaryMetric
                label="Current Asset"
                value={renderAssetIdentity(workspace.currentAsset)}
              />
              <SummaryMetric
                label="Storage Key"
                value={<code>{workspace.currentAsset.storage_key}</code>}
              />
              <SummaryMetric
                label="Recommended Parent"
                value={
                  workspace.suggestedParentAsset
                    ? renderAssetIdentity(workspace.suggestedParentAsset)
                    : "No recommended parent asset"
                }
              />
              <SummaryMetric
                label="Latest Proof Draft"
                value={
                  workspace.latestProofreadingDraftAsset
                    ? renderAssetIdentity(workspace.latestProofreadingDraftAsset)
                    : "No proofreading draft yet"
                }
              />
            </>
          ) : (
            <p className="manuscript-workbench-empty">
              Load or upload a manuscript to populate the asset chain.
            </p>
          )}
        </SummaryCard>

        <SummaryCard title="Latest Job">
          {latestJob ? (
            <>
              <SummaryMetric label="Job ID" value={<code>{latestJob.id}</code>} />
              <SummaryMetric label="Module" value={latestJob.module} />
              <SummaryMetric label="Job Type" value={latestJob.job_type} />
              <SummaryMetric
                label="Status"
                value={
                  <StatusPill tone={latestJob.status === "completed" ? "success" : "neutral"}>
                    {latestJob.status}
                  </StatusPill>
                }
              />
              <SummaryMetric label="Requested By" value={latestJob.requested_by} />
              <SummaryMetric
                label="Last Updated"
                value={formatTimestamp(latestJob.updated_at)}
              />
            </>
          ) : (
            <p className="manuscript-workbench-empty">
              Trigger a module run or upload to see the latest execution job.
            </p>
          )}
        </SummaryCard>

        <SummaryCard title="Latest Export">
          {latestExport ? (
            <>
              <SummaryMetric
                label="Export Storage Key"
                value={<code>{latestExport}</code>}
              />
              <SummaryMetric label="Ready State" value="Prepared for downstream delivery" />
            </>
          ) : (
            <p className="manuscript-workbench-empty">
              Use the export action to prepare the current manuscript asset.
            </p>
          )}
        </SummaryCard>
      </div>

      <article className="manuscript-workbench-assets-card">
        <div className="manuscript-workbench-section-heading">
          <div>
            <h3>Asset Chain</h3>
            <p>Newest assets stay on top so operators can confirm the active chain quickly.</p>
          </div>
          <span className="manuscript-workbench-section-meta">
            {workspace.assets.length} asset{workspace.assets.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="manuscript-workbench-table-wrap">
          <table className="manuscript-workbench-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Type</th>
                <th>Version</th>
                <th>Status</th>
                <th>Source</th>
                <th>Storage</th>
              </tr>
            </thead>
            <tbody>
              {workspace.assets.map((asset) => (
                <tr key={asset.id}>
                  <td>
                    <div className="manuscript-workbench-asset-cell">
                      <strong>{asset.file_name ?? asset.id}</strong>
                      <code>{asset.id}</code>
                    </div>
                  </td>
                  <td>{asset.asset_type}</td>
                  <td>v{asset.version_no}</td>
                  <td>
                    <StatusPill tone={asset.is_current ? "success" : "neutral"}>
                      {asset.is_current ? "current" : asset.status}
                    </StatusPill>
                  </td>
                  <td>{asset.source_module}</td>
                  <td>
                    <code>{asset.storage_key}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <details className="manuscript-workbench-debug-panel">
        <summary>Debug Snapshot</summary>
        <pre>
          {JSON.stringify(
            {
              workspace,
              latestJob,
              latestExport,
            },
            null,
            2,
          )}
        </pre>
      </details>
    </section>
  );
}

interface SummaryCardProps {
  title: string;
  children: ReactNode;
}

function SummaryCard({ title, children }: SummaryCardProps) {
  return (
    <article className="manuscript-workbench-summary-card">
      <h3>{title}</h3>
      <div className="manuscript-workbench-metric-list">{children}</div>
    </article>
  );
}

interface SummaryMetricProps {
  label: string;
  value: ReactNode;
}

function SummaryMetric({ label, value }: SummaryMetricProps) {
  return (
    <div className="manuscript-workbench-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function renderAssetIdentity(asset: DocumentAssetViewModel): ReactNode {
  return (
    <span className="manuscript-workbench-asset-identity">
      <span>{asset.file_name ?? asset.asset_type}</span>
      <code>{asset.id}</code>
    </span>
  );
}

interface StatusPillProps {
  tone: "neutral" | "success" | "error";
  children: ReactNode;
}

function StatusPill({ tone, children }: StatusPillProps) {
  return (
    <span className={`manuscript-workbench-status-pill is-${tone}`}>{children}</span>
  );
}

function formatTimestamp(value: string | undefined): string {
  if (!value) {
    return "Not available";
  }

  return value.replace("T", " ").replace(".000Z", "Z");
}
