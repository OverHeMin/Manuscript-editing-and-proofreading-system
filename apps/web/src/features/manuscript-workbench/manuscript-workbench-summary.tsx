import type { ReactNode } from "react";
import type { JobViewModel, DocumentAssetViewModel } from "../manuscripts/index.ts";
import type { ModuleJobViewModel } from "../screening/index.ts";
import type {
  ManuscriptWorkbenchMode,
  ManuscriptWorkbenchWorkspace,
} from "./manuscript-workbench-controller.ts";

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
  mode: ManuscriptWorkbenchMode;
  accessibleHandoffModes?: readonly ManuscriptWorkbenchMode[];
  workspace: ManuscriptWorkbenchWorkspace;
  latestJob: AnyWorkbenchJob | null;
  latestExport: string;
  latestActionResult?: WorkbenchActionResultViewModel | null;
}

export function ManuscriptWorkbenchSummary({
  mode,
  accessibleHandoffModes = [],
  workspace,
  latestJob,
  latestExport,
  latestActionResult = null,
}: ManuscriptWorkbenchSummaryProps) {
  const recommendedNextStep = buildRecommendedNextStep(
    mode,
    workspace,
    latestJob,
    latestExport,
  );

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

        <SummaryCard title="Recommended Next Step">
          <SummaryMetric label="Focus" value={recommendedNextStep.focus} />
          <SummaryMetric label="Guidance" value={recommendedNextStep.guidance} />
          {recommendedNextStep.details.map((detail) => (
            <SummaryMetric
              key={`${detail.label}:${detail.value}`}
              label={detail.label}
              value={detail.value}
            />
          ))}
          {recommendedNextStep.targetMode &&
          accessibleHandoffModes.includes(recommendedNextStep.targetMode) ? (
            <a
              className="manuscript-workbench-shortcut"
              href={formatWorkbenchHandoffHref(
                recommendedNextStep.targetMode,
                workspace.manuscript.id,
              )}
            >
              {recommendedNextStep.targetLabel ??
                `Open ${formatWorkbenchModeLabel(recommendedNextStep.targetMode)} Workbench`}
            </a>
          ) : null}
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
              mode,
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

interface RecommendedNextStepViewModel {
  focus: string;
  guidance: string;
  details: WorkbenchActionResultDetail[];
  targetMode?: ManuscriptWorkbenchMode;
  targetLabel?: string;
}

function buildRecommendedNextStep(
  mode: ManuscriptWorkbenchMode,
  workspace: ManuscriptWorkbenchWorkspace,
  latestJob: AnyWorkbenchJob | null,
  latestExport: string,
): RecommendedNextStepViewModel {
  if (mode === "submission") {
    if (latestExport) {
      return {
        focus: "Hand off the prepared submission package",
        guidance: "Submission and export are ready for downstream screening or delivery.",
        details: [
          {
            label: "Manuscript",
            value: workspace.manuscript.id,
          },
          {
            label: "Export",
            value: latestExport,
          },
        ],
      };
    }

    return {
      focus: "Move this manuscript into screening",
      guidance: "Use the manuscript ID in Screening Workbench or prepare an export for downstream handoff.",
      details: [
        {
          label: "Manuscript",
          value: workspace.manuscript.id,
        },
        {
          label: "Current Asset",
          value: describeAsset(workspace.currentAsset),
        },
      ],
    };
  }

  if (mode === "screening") {
    if (latestJob?.module === "screening" && latestJob.status === "completed") {
      return {
        focus: "Advance this manuscript into editing",
        guidance: "Screening output is ready for the next governed editing handoff.",
        details: [
          {
            label: "Manuscript",
            value: workspace.manuscript.id,
          },
          {
            label: "Current Asset",
            value: describeAsset(workspace.currentAsset),
          },
        ],
        targetMode: "editing",
        targetLabel: "Open Editing Workbench",
      };
    }

    return {
      focus: "Run screening on the recommended parent asset",
      guidance: "Launch Screening Workbench execution before any editing handoff.",
      details: [
        {
          label: "Recommended Parent",
          value: describeAsset(workspace.suggestedParentAsset),
        },
        {
          label: "Current Asset",
          value: describeAsset(workspace.currentAsset),
        },
      ],
    };
  }

  if (mode === "editing") {
    if (latestJob?.module === "editing" && latestJob.status === "completed") {
      return {
        focus: "Advance this manuscript into proofreading",
        guidance: "The edited asset is ready for proofreading draft generation.",
        details: [
          {
            label: "Manuscript",
            value: workspace.manuscript.id,
          },
          {
            label: "Current Asset",
            value: describeAsset(workspace.currentAsset),
          },
        ],
        targetMode: "proofreading",
        targetLabel: "Open Proofreading Workbench",
      };
    }

    return {
      focus: "Run editing on the screened manuscript asset",
      guidance: "Generate the governed editing output before proofreading begins.",
      details: [
        {
          label: "Recommended Parent",
          value: describeAsset(workspace.suggestedParentAsset),
        },
        {
          label: "Current Asset",
          value: describeAsset(workspace.currentAsset),
        },
      ],
    };
  }

  if (isFinalProofAsset(workspace.currentAsset)) {
    return {
      focus: "Export or hand off the finalized proofreading output",
      guidance: "The proofreading final is active and ready for downstream delivery.",
      details: [
        {
          label: "Current Asset",
          value: describeAsset(workspace.currentAsset),
        },
        {
          label: "Export",
          value: latestExport || "Prepare export from Workspace Utilities",
        },
      ],
    };
  }

  if (workspace.latestProofreadingDraftAsset) {
    return {
      focus: "Finalize the reviewed proofreading draft",
      guidance: "Human confirmation is still required before producing the proofreading final.",
      details: [
        {
          label: "Draft Asset",
          value: describeAsset(workspace.latestProofreadingDraftAsset),
        },
        {
          label: "Current Asset",
          value: describeAsset(workspace.currentAsset),
        },
      ],
    };
  }

  return {
    focus: "Create the proofreading draft",
    guidance: "Produce the draft first, then confirm it manually before finalization.",
    details: [
      {
        label: "Recommended Parent",
        value: describeAsset(workspace.suggestedParentAsset),
      },
      {
        label: "Current Asset",
        value: describeAsset(workspace.currentAsset),
      },
    ],
  };
}

function describeAsset(asset: DocumentAssetViewModel | null): string {
  if (!asset) {
    return "Not available";
  }

  return `${asset.file_name ?? asset.asset_type} / ${asset.asset_type} / ${asset.id}`;
}

function isFinalProofAsset(asset: DocumentAssetViewModel | null): boolean {
  if (!asset) {
    return false;
  }

  return (
    asset.asset_type === "final_proof_issue_report" ||
    asset.asset_type === "final_proof_annotated_docx" ||
    asset.asset_type === "human_final_docx"
  );
}

function formatWorkbenchHandoffHref(
  targetMode: ManuscriptWorkbenchMode,
  manuscriptId: string,
): string {
  const params = new URLSearchParams({
    manuscriptId,
  });

  return `#${targetMode}?${params.toString()}`;
}

function formatWorkbenchModeLabel(targetMode: ManuscriptWorkbenchMode): string {
  if (targetMode === "submission") {
    return "Submission";
  }
  if (targetMode === "screening") {
    return "Screening";
  }
  if (targetMode === "editing") {
    return "Editing";
  }

  return "Proofreading";
}
