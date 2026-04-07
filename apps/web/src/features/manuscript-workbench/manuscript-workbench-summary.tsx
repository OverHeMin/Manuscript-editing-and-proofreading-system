import type { ReactNode } from "react";
import { formatWorkbenchHash } from "../../app/workbench-routing.ts";
import { resolveBrowserApiUrl } from "../../lib/browser-http-client.ts";
import type {
  DocumentAssetExportViewModel,
  DocumentAssetViewModel,
  JobExecutionTrackingObservationViewModel,
  JobViewModel,
  LinkedAgentExecutionRecoverySummaryViewModel,
  MainlineAttentionItemViewModel,
  MainlineAttemptLedgerItemViewModel,
  MainlineSettlementModule,
  ManuscriptMainlineAttentionHandoffPackViewModel,
  ManuscriptMainlineAttemptLedgerViewModel,
  ManuscriptMainlineReadinessSummaryViewModel,
  ManuscriptModuleExecutionOverviewViewModel,
  ModuleExecutionOverviewViewModel,
  ModuleMainlineSettlementDerivedStatus,
  RuntimeBindingReadinessReportViewModel,
} from "../manuscripts/index.ts";
import type { ModuleJobViewModel } from "../screening/index.ts";
import type {
  ManuscriptWorkbenchMode,
  ManuscriptWorkbenchWorkspace,
} from "./manuscript-workbench-controller.ts";

type AnyWorkbenchJob = JobViewModel | ModuleJobViewModel;

const MAINLINE_SETTLEMENT_MODULE_ORDER: readonly MainlineSettlementModule[] = [
  "screening",
  "editing",
  "proofreading",
];

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

export interface WorkbenchStatusPillViewModel {
  tone: "neutral" | "success" | "error";
  label: string;
}

export function buildLatestJobPostureDetails(
  latestJob: JobViewModel | ModuleJobViewModel | null,
  overview?: ManuscriptModuleExecutionOverviewViewModel,
): WorkbenchActionResultDetail[] {
  return buildJobPostureDetails(latestJob, "Latest Job", overview);
}

export function buildJobPostureDetails(
  latestJob: JobViewModel | ModuleJobViewModel | null,
  labelPrefix: string,
  overview?: ManuscriptModuleExecutionOverviewViewModel,
): WorkbenchActionResultDetail[] {
  const executionTracking = getJobExecutionTracking(latestJob);
  if (executionTracking) {
    const details: WorkbenchActionResultDetail[] = [
      {
        label: `${labelPrefix} Settlement`,
        value: describeJobExecutionTracking(executionTracking),
      },
    ];

    const recoveryPosture = describeExecutionTrackingRecoveryPosture(executionTracking);
    if (recoveryPosture) {
      details.push({
        label: `${labelPrefix} Recovery`,
        value: recoveryPosture,
      });
    }

    const recoveryReadyAt = getExecutionTrackingRecoveryReadyAt(executionTracking);
    if (recoveryReadyAt) {
      details.push({
        label: `${labelPrefix} Recovery Ready At`,
        value: formatTimestamp(recoveryReadyAt),
      });
    }

    const runtimeBindingReadiness = describeExecutionTrackingRuntimeBindingReadiness(
      executionTracking,
    );
    if (runtimeBindingReadiness) {
      details.push({
        label: `${labelPrefix} Runtime Readiness`,
        value: runtimeBindingReadiness,
      });
    }

    return details;
  }

  const fallbackOverview = resolveLatestJobOverviewFallback(overview, latestJob);
  if (!fallbackOverview) {
    return [];
  }

  const details: WorkbenchActionResultDetail[] = [
    {
      label: `${labelPrefix} Settlement`,
      value: formatSettlementStatusLabel(fallbackOverview.settlement?.derived_status),
    },
  ];

  const recoveryPosture = describeModuleExecutionRecoveryPosture(fallbackOverview);
  if (recoveryPosture) {
    details.push({
      label: `${labelPrefix} Recovery`,
      value: recoveryPosture,
    });
  }

  const recoveryReadyAt = getModuleExecutionRecoveryReadyAt(fallbackOverview);
  if (recoveryReadyAt) {
    details.push({
      label: `${labelPrefix} Recovery Ready At`,
      value: formatTimestamp(recoveryReadyAt),
    });
  }

  const runtimeBindingReadiness = describeModuleExecutionRuntimeBindingReadiness(
    fallbackOverview,
  );
  if (runtimeBindingReadiness) {
    details.push({
      label: `${labelPrefix} Runtime Readiness`,
      value: runtimeBindingReadiness,
    });
  }

  return details;
}

export function buildManuscriptMainlineReadinessDetails(
  summary?: ManuscriptMainlineReadinessSummaryViewModel,
): WorkbenchActionResultDetail[] {
  if (!summary) {
    return [];
  }

  if (summary.observation_status === "failed_open") {
    const details: WorkbenchActionResultDetail[] = [
      {
        label: "Mainline Readiness",
        value: "Readiness unavailable",
      },
    ];
    if (summary.error) {
      details.push({
        label: "Readiness Error",
        value: summary.error,
      });
    }
    return details;
  }

  const details: WorkbenchActionResultDetail[] = [
    {
      label: "Mainline Readiness",
      value: formatMainlineReadinessLabel(summary),
    },
  ];

  if (summary.active_module) {
    details.push({
      label: "Active Module",
      value: summary.active_module,
    });
  }

  if (summary.next_module) {
    details.push({
      label: "Next Module",
      value: summary.next_module,
    });
  }

  if (summary.recovery_ready_at) {
    details.push({
      label: "Recovery Ready At",
      value: formatTimestamp(summary.recovery_ready_at),
    });
  }

  const runtimeReadiness = formatSummaryRuntimeBindingReadiness(summary);
  if (runtimeReadiness) {
    details.push({
      label: "Runtime Readiness",
      value: runtimeReadiness,
    });
  }

  if (summary.reason) {
    details.push({
      label: "Readiness Reason",
      value: summary.reason,
    });
  }

  return details;
}

export function buildManuscriptMainlineAttemptLedgerDetails(
  ledger?: ManuscriptMainlineAttemptLedgerViewModel,
): WorkbenchActionResultDetail[] {
  if (!ledger || ledger.observation_status !== "reported") {
    return [];
  }

  const details: WorkbenchActionResultDetail[] = [
    {
      label: "Mainline Attempts",
      value: formatMainlineAttemptLedgerSummary(ledger),
    },
  ];

  const latestActivity = ledger.items[0];
  if (latestActivity) {
    details.push({
      label: "Latest Mainline Activity",
      value: formatMainlineAttemptActivityDetail(latestActivity),
    });
  }

  return details;
}

export function buildManuscriptMainlineAttentionHandoffPackDetails(
  pack?: ManuscriptMainlineAttentionHandoffPackViewModel,
): WorkbenchActionResultDetail[] {
  if (!pack) {
    return [];
  }

  if (pack.observation_status === "failed_open") {
    const details: WorkbenchActionResultDetail[] = [
      {
        label: "Attention Status",
        value: "Attention unavailable",
      },
    ];

    if (pack.error) {
      details.push({
        label: "Attention Error",
        value: pack.error,
      });
    }

    return details;
  }

  const details: WorkbenchActionResultDetail[] = [];
  if (pack.attention_status) {
    details.push({
      label: "Attention Status",
      value: formatAttentionStatusLabel(pack.attention_status),
    });
  }

  if (pack.handoff_status) {
    details.push({
      label: "Next Mainline Handoff",
      value: formatMainlineAttentionHandoffLabel(pack),
    });
  }

  if (pack.reason) {
    details.push({
      label: "Primary Attention Reason",
      value: pack.reason,
    });
  }

  if (pack.attention_items.length > 0) {
    details.push({
      label: "Attention Items",
      value: pack.attention_items.map(formatAttentionItemDetail).join(" | "),
    });
  }

  return details;
}

export function resolveWorkbenchActionOutcomePill(
  latestActionResult: WorkbenchActionResultViewModel,
): WorkbenchStatusPillViewModel {
  const fallback: WorkbenchStatusPillViewModel =
    latestActionResult.tone === "success"
      ? {
          tone: "success",
          label: "success",
        }
      : {
          tone: "error",
          label: "attention needed",
        };

  return resolveWorkbenchPosturePillFromDetails(latestActionResult.details, fallback) ?? fallback;
}

export function resolveWorkbenchLatestJobExecutionPosturePill(
  latestJob: JobViewModel | ModuleJobViewModel,
  overview?: ManuscriptModuleExecutionOverviewViewModel,
): WorkbenchStatusPillViewModel | null {
  return resolveWorkbenchPosturePillFromDetails(
    buildLatestJobPostureDetails(latestJob, overview),
    null,
  );
}

export function resolveWorkbenchLatestJobStatusPill(
  latestJob: JobViewModel | ModuleJobViewModel,
  overview?: ManuscriptModuleExecutionOverviewViewModel,
): WorkbenchStatusPillViewModel {
  if (resolveWorkbenchLatestJobExecutionPosturePill(latestJob, overview)) {
    return {
      tone: "neutral",
      label: latestJob.status,
    };
  }

  return {
    tone: latestJob.status === "completed" ? "success" : "neutral",
    label: latestJob.status,
  };
}

export interface ManuscriptWorkbenchSummaryProps {
  mode: ManuscriptWorkbenchMode;
  accessibleHandoffModes?: readonly ManuscriptWorkbenchMode[];
  canOpenLearningReview?: boolean;
  canOpenEvaluationWorkbench?: boolean;
  prefilledManuscriptId?: string;
  prefilledReviewedCaseSnapshotId?: string;
  prefilledSampleSetItemId?: string;
  workspace: ManuscriptWorkbenchWorkspace;
  latestJob: AnyWorkbenchJob | null;
  latestExport: DocumentAssetExportViewModel | null;
  latestActionResult?: WorkbenchActionResultViewModel | null;
}

export function ManuscriptWorkbenchSummary({
  mode,
  accessibleHandoffModes = [],
  canOpenLearningReview = false,
  canOpenEvaluationWorkbench = false,
  prefilledManuscriptId,
  prefilledReviewedCaseSnapshotId,
  prefilledSampleSetItemId,
  workspace,
  latestJob,
  latestExport,
  latestActionResult = null,
}: ManuscriptWorkbenchSummaryProps) {
  const normalizedPrefilledManuscriptId = prefilledManuscriptId?.trim() ?? "";
  const normalizedPrefilledReviewedCaseSnapshotId =
    prefilledReviewedCaseSnapshotId?.trim() ?? "";
  const normalizedPrefilledSampleSetItemId = prefilledSampleSetItemId?.trim() ?? "";
  const shouldPreserveEvaluationSampleContextIds =
    normalizedPrefilledManuscriptId.length > 0 &&
    normalizedPrefilledManuscriptId === workspace.manuscript.id;
  const manuscriptWorkbenchHandoff = {
    manuscriptId: workspace.manuscript.id,
    reviewedCaseSnapshotId: shouldPreserveEvaluationSampleContextIds
      ? normalizedPrefilledReviewedCaseSnapshotId
      : undefined,
    sampleSetItemId: shouldPreserveEvaluationSampleContextIds
      ? normalizedPrefilledSampleSetItemId
      : undefined,
  };
  const mainlineReadinessSummary = workspace.manuscript.mainline_readiness_summary;
  const mainlineAttentionHandoffPack =
    workspace.manuscript.mainline_attention_handoff_pack;
  const mainlineAttemptLedger = workspace.manuscript.mainline_attempt_ledger;
  const mainlineReadinessDetails =
    buildManuscriptMainlineReadinessDetails(mainlineReadinessSummary);
  const mainlineAttentionHandoffDetails =
    buildManuscriptMainlineAttentionHandoffPackDetails(mainlineAttentionHandoffPack);
  const mainlineReadinessPill =
    resolveWorkbenchMainlineReadinessPill(mainlineReadinessSummary);
  const mainlineAttentionHandoffPill =
    resolveWorkbenchAttentionStatusPill(mainlineAttentionHandoffPack);
  const recommendedNextStep = buildRecommendedNextStep(
    mode,
    workspace,
    latestJob,
    latestExport,
    canOpenLearningReview,
  );
  const actionOutcomePill = latestActionResult
    ? resolveWorkbenchActionOutcomePill(latestActionResult)
    : null;
  const latestJobExecutionPosturePill = latestJob
    ? resolveWorkbenchLatestJobExecutionPosturePill(
        latestJob,
        workspace.manuscript.module_execution_overview,
      )
    : null;
  const latestJobStatusPill = latestJob
    ? resolveWorkbenchLatestJobStatusPill(
        latestJob,
        workspace.manuscript.module_execution_overview,
      )
    : null;

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
                  <StatusPill tone={actionOutcomePill?.tone ?? latestActionResult.tone}>
                    {actionOutcomePill?.label ??
                      (latestActionResult.tone === "success"
                        ? "success"
                        : "attention needed")}
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
          {recommendedNextStep.targetHref && recommendedNextStep.targetLabel ? (
            <a
              className="manuscript-workbench-shortcut"
              href={recommendedNextStep.targetHref}
            >
              {recommendedNextStep.targetLabel}
            </a>
          ) : recommendedNextStep.targetMode &&
            accessibleHandoffModes.includes(recommendedNextStep.targetMode) ? (
            <a
              className="manuscript-workbench-shortcut"
              href={formatWorkbenchHash(
                recommendedNextStep.targetMode,
                manuscriptWorkbenchHandoff,
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
            label="Base Template Family"
            value={
              workspace.templateFamily?.name ??
              workspace.manuscript.current_template_family_id ??
              "Not bound"
            }
          />
          <SummaryMetric
            label="Journal Template"
            value={
              workspace.selectedJournalTemplateProfile?.journal_name ??
              workspace.manuscript.current_journal_template_id ??
              "Base family only"
            }
          />
          <SummaryMetric
            label="Journal Overrides"
            value={
              <StatusPill
                tone={
                  workspace.selectedJournalTemplateProfile ||
                  workspace.manuscript.current_journal_template_id
                    ? "success"
                    : "neutral"
                }
              >
                {workspace.selectedJournalTemplateProfile ||
                workspace.manuscript.current_journal_template_id
                  ? "Active"
                  : "Base only"}
              </StatusPill>
            }
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
          {mainlineReadinessPill ? (
            <SummaryMetric
              label="Mainline Readiness"
              value={
                <StatusPill tone={mainlineReadinessPill.tone}>
                  {mainlineReadinessPill.label}
                </StatusPill>
              }
            />
          ) : null}
          {mainlineReadinessDetails
            .filter((detail) => detail.label !== "Mainline Readiness")
            .map((detail) => (
              <SummaryMetric
                key={`${detail.label}:${detail.value}`}
                label={detail.label}
                value={detail.value}
              />
            ))}
          {mainlineAttentionHandoffPill ? (
            <SummaryMetric
              label="Attention Status"
              value={
                <StatusPill tone={mainlineAttentionHandoffPill.tone}>
                  {mainlineAttentionHandoffPill.label}
                </StatusPill>
              }
            />
          ) : null}
          {mainlineAttentionHandoffDetails
            .filter((detail) => detail.label !== "Attention Status")
            .filter((detail) => detail.label !== "Attention Items")
            .map((detail) => (
              <SummaryMetric
                key={`${detail.label}:${detail.value}`}
                label={detail.label}
                value={detail.value}
              />
            ))}
          {renderMainlineAttentionItemsSection(mainlineAttentionHandoffPack)}
          {renderModuleExecutionOverviewMetrics(
            workspace.manuscript.module_execution_overview,
            latestJob,
          )}
          {mainlineAttemptLedger?.observation_status === "reported" ? (
            <SummaryMetric
              label="Mainline Attempts"
              value={formatMainlineAttemptLedgerSummary(mainlineAttemptLedger)}
            />
          ) : null}
          {renderMainlineAttemptLedgerSection(mainlineAttemptLedger)}
          {canOpenEvaluationWorkbench ? (
            <SummaryMetric
              label="Evaluation Context"
              value={
                <a
                  className="manuscript-workbench-shortcut"
                  href={formatWorkbenchHash("evaluation-workbench", manuscriptWorkbenchHandoff)}
                >
                  Open Evaluation Workbench
                </a>
              }
            />
          ) : null}
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
                  <StatusPill tone={latestJobStatusPill?.tone ?? "neutral"}>
                    {latestJobStatusPill?.label ?? latestJob.status}
                  </StatusPill>
                }
              />
              {latestJobExecutionPosturePill ? (
                <SummaryMetric
                  label="Execution Posture"
                  value={
                    <StatusPill tone={latestJobExecutionPosturePill.tone}>
                      {latestJobExecutionPosturePill.label}
                    </StatusPill>
                  }
                />
              ) : null}
              <SummaryMetric label="Requested By" value={latestJob.requested_by} />
              <SummaryMetric
                label="Last Updated"
                value={formatTimestamp(latestJob.updated_at)}
              />
              {renderLatestJobExecutionTrackingMetrics(
                latestJob,
                workspace.manuscript.module_execution_overview,
              )}
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
                value={<code>{latestExport.download.storage_key}</code>}
              />
              <SummaryMetric
                label="Export File Name"
                value={
                  latestExport.download.file_name ??
                  latestExport.asset.file_name ??
                  "Not provided"
                }
              />
              <SummaryMetric
                label="Download MIME Type"
                value={latestExport.download.mime_type}
              />
              <SummaryMetric
                label="Source Asset"
                value={renderAssetIdentity(latestExport.asset)}
              />
              <SummaryMetric
                label="Download"
                value={
                  <a
                    className="manuscript-workbench-shortcut"
                    href={resolveBrowserApiUrl(latestExport.download.url)}
                  >
                    Download Latest Export
                  </a>
                }
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

function renderMainlineAttemptLedgerSection(
  ledger?: ManuscriptMainlineAttemptLedgerViewModel,
): ReactNode | null {
  if (!ledger || ledger.observation_status !== "reported" || ledger.items.length === 0) {
    return null;
  }

  return (
    <div className="manuscript-workbench-metric manuscript-workbench-activity-section">
      <span>Recent Mainline Activity</span>
      <ul className="manuscript-workbench-activity-list">
        {ledger.items.map((item) => (
          <li
            key={`${item.job_id}:${item.updated_at}`}
            className="manuscript-workbench-activity-item"
          >
            <strong>{formatMainlineAttemptHeading(item)}</strong>
            <p>{formatMainlineAttemptActivityStatus(item)}</p>
            <p>{item.reason}</p>
            <small>{`Updated ${formatTimestamp(item.updated_at)}`}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

function renderMainlineAttentionItemsSection(
  pack?: ManuscriptMainlineAttentionHandoffPackViewModel,
): ReactNode | null {
  if (!pack || pack.observation_status !== "reported" || pack.attention_items.length === 0) {
    return null;
  }

  return (
    <div className="manuscript-workbench-metric manuscript-workbench-attention-section">
      <span>Attention Items</span>
      <ul className="manuscript-workbench-attention-list">
        {pack.attention_items.map((item) => (
          <li
            key={`${item.module}:${item.kind}:${item.job_id ?? item.snapshot_id ?? item.summary}`}
            className="manuscript-workbench-attention-item"
          >
            <div className="manuscript-workbench-attention-meta">
              <strong>{formatAttentionItemHeading(item)}</strong>
              <StatusPill
                tone={item.severity === "action_required" ? "error" : "neutral"}
              >
                {formatAttentionSeverityLabel(item.severity)}
              </StatusPill>
            </div>
            <p>{item.summary}</p>
            {item.recovery_ready_at ? (
              <small>{`Recovery ready ${formatTimestamp(item.recovery_ready_at)}`}</small>
            ) : null}
          </li>
        ))}
      </ul>
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

function resolveWorkbenchMainlineReadinessPill(
  summary?: ManuscriptMainlineReadinessSummaryViewModel,
): WorkbenchStatusPillViewModel | null {
  if (!summary) {
    return null;
  }

  if (summary.observation_status === "failed_open") {
    return {
      tone: "error",
      label: "readiness unavailable",
    };
  }

  const label = formatMainlineReadinessLabel(summary);
  if (summary.derived_status === "ready_for_next_step" || summary.derived_status === "completed") {
    return {
      tone: "success",
      label,
    };
  }

  if (
    summary.derived_status === "attention_required"
  ) {
    return {
      tone: "error",
      label,
    };
  }

  return {
    tone: "neutral",
    label,
  };
}

function resolveWorkbenchAttentionStatusPill(
  pack?: ManuscriptMainlineAttentionHandoffPackViewModel,
): WorkbenchStatusPillViewModel | null {
  if (!pack) {
    return null;
  }

  if (pack.observation_status === "failed_open") {
    return {
      tone: "error",
      label: "attention unavailable",
    };
  }

  if (!pack.attention_status) {
    return null;
  }

  const label = formatAttentionStatusLabel(pack.attention_status);
  if (pack.attention_status === "clear") {
    return {
      tone: "success",
      label,
    };
  }

  if (pack.attention_status === "action_required") {
    return {
      tone: "error",
      label,
    };
  }

  return {
    tone: "neutral",
    label,
  };
}

function resolveWorkbenchPosturePillFromDetails(
  details: WorkbenchActionResultDetail[],
  fallback: WorkbenchStatusPillViewModel | null,
): WorkbenchStatusPillViewModel | null {
  const settlement = details.find((detail) => detail.label.endsWith("Settlement"))?.value;
  if (!settlement) {
    return fallback;
  }

  return resolveWorkbenchSettlementPill(settlement) ?? fallback;
}

function resolveWorkbenchSettlementPill(
  settlement: string,
): WorkbenchStatusPillViewModel | null {
  switch (settlement) {
    case "Settled":
      return {
        tone: "success",
        label: "settled",
      };
    case "Business complete, follow-up pending":
      return {
        tone: "neutral",
        label: "follow-up pending",
      };
    case "Business complete, follow-up running":
      return {
        tone: "neutral",
        label: "follow-up running",
      };
    case "Business complete, follow-up retryable":
      return {
        tone: "error",
        label: "follow-up retryable",
      };
    case "Business complete, follow-up failed":
      return {
        tone: "error",
        label: "follow-up failed",
      };
    case "Business complete, settlement unlinked":
      return {
        tone: "error",
        label: "settlement unlinked",
      };
    case "Job failed":
      return {
        tone: "error",
        label: "job failed",
      };
    case "Job in progress":
      return {
        tone: "neutral",
        label: "job in progress",
      };
    case "Not started":
      return {
        tone: "neutral",
        label: "not started",
      };
    case "Reported":
      return {
        tone: "neutral",
        label: "reported",
      };
    default:
      return null;
  }
}

function formatTimestamp(value: string | undefined): string {
  if (!value) {
    return "Not available";
  }

  return value.replace("T", " ").replace(".000Z", "Z");
}

function formatMainlineAttemptLedgerSummary(
  ledger: ManuscriptMainlineAttemptLedgerViewModel,
): string {
  if (ledger.truncated) {
    return `${ledger.total_attempts} total (showing latest ${ledger.visible_attempts})`;
  }

  return `${ledger.total_attempts} total (showing ${ledger.visible_attempts})`;
}

function formatMainlineAttemptActivityDetail(
  item: MainlineAttemptLedgerItemViewModel,
): string {
  return `${formatMainlineAttemptHeading(item)} - ${formatMainlineAttemptActivityStatus(item)}`;
}

function formatMainlineAttemptHeading(
  item: MainlineAttemptLedgerItemViewModel,
): string {
  return `${item.module} attempt ${item.job_attempt_count}`;
}

function formatMainlineAttemptActivityStatus(
  item: MainlineAttemptLedgerItemViewModel,
): string {
  if (item.settlement_status) {
    return formatSettlementStatusLabel(item.settlement_status);
  }

  if (item.evidence_status === "failed_open") {
    return "Observation unavailable";
  }

  if (item.evidence_status === "job_only") {
    return `${formatJobStatusLabel(item.job_status)} (job-only evidence)`;
  }

  return "Reported";
}

function renderModuleExecutionOverviewMetrics(
  overview: ManuscriptModuleExecutionOverviewViewModel | undefined,
  latestJob: AnyWorkbenchJob | null,
): ReactNode[] | null {
  return MAINLINE_SETTLEMENT_MODULE_ORDER.map((module) => (
    <SummaryMetric
      key={`module-overview:${module}`}
      label={`${formatMainlineModuleLabel(module)} Settlement`}
      value={describeModuleExecutionOverviewMetric(module, overview?.[module], latestJob)}
    />
  ));
}

function renderLatestJobExecutionTrackingMetrics(
  latestJob: AnyWorkbenchJob,
  overview: ManuscriptModuleExecutionOverviewViewModel | undefined,
): ReactNode[] | null {
  const executionTracking = getJobExecutionTracking(latestJob);
  if (executionTracking) {
    const metrics: ReactNode[] = [
      <SummaryMetric
        key="job-execution-settlement"
        label="Execution Settlement"
        value={describeJobExecutionTracking(executionTracking)}
      />,
    ];

    const recoveryPosture = describeExecutionTrackingRecoveryPosture(executionTracking);
    if (recoveryPosture) {
      metrics.push(
        <SummaryMetric
          key="job-execution-recovery"
          label="Recovery Posture"
          value={recoveryPosture}
        />,
      );
    }

    const recoveryReadyAt = getExecutionTrackingRecoveryReadyAt(executionTracking);
    if (recoveryReadyAt) {
      metrics.push(
        <SummaryMetric
          key="job-execution-recovery-ready-at"
          label="Recovery Ready At"
          value={formatTimestamp(recoveryReadyAt)}
        />,
      );
    }

    const runtimeBindingReadiness = describeExecutionTrackingRuntimeBindingReadiness(
      executionTracking,
    );
    if (runtimeBindingReadiness) {
      metrics.push(
        <SummaryMetric
          key="job-runtime-binding-readiness"
          label="Runtime Binding Readiness"
          value={runtimeBindingReadiness}
        />,
      );
    }

    if (executionTracking.snapshot) {
      metrics.push(
        <SummaryMetric
          key="job-execution-snapshot"
          label="Execution Snapshot"
          value={<code>{executionTracking.snapshot.id}</code>}
        />,
      );
    }

    if (executionTracking.observation_status === "failed_open" && executionTracking.error) {
      metrics.push(
        <SummaryMetric
          key="job-execution-error"
          label="Execution Tracking Error"
          value={executionTracking.error}
        />,
      );
    }

    if (
      executionTracking.snapshot?.runtime_binding_readiness.observation_status === "failed_open" &&
      executionTracking.snapshot.runtime_binding_readiness.error
    ) {
      metrics.push(
        <SummaryMetric
          key="job-runtime-binding-error"
          label="Runtime Binding Readiness Error"
          value={executionTracking.snapshot.runtime_binding_readiness.error}
        />,
      );
    }

    return metrics;
  }

  const fallbackOverview = resolveLatestJobOverviewFallback(overview, latestJob);
  if (!fallbackOverview) {
    return null;
  }

  const metrics: ReactNode[] = [
    <SummaryMetric
      key="job-overview-fallback-settlement"
      label="Execution Settlement"
      value={formatSettlementStatusLabel(fallbackOverview.settlement?.derived_status)}
    />,
  ];

  const recoveryPosture = describeModuleExecutionRecoveryPosture(fallbackOverview);
  if (recoveryPosture) {
    metrics.push(
      <SummaryMetric
        key="job-overview-fallback-recovery"
        label="Recovery Posture"
        value={recoveryPosture}
      />,
    );
  }

  const recoveryReadyAt = getModuleExecutionRecoveryReadyAt(fallbackOverview);
  if (recoveryReadyAt) {
    metrics.push(
      <SummaryMetric
        key="job-overview-fallback-recovery-ready-at"
        label="Recovery Ready At"
        value={formatTimestamp(recoveryReadyAt)}
      />,
    );
  }

  const runtimeBindingReadiness = describeModuleExecutionRuntimeBindingReadiness(
    fallbackOverview,
  );
  if (runtimeBindingReadiness) {
    metrics.push(
      <SummaryMetric
        key="job-overview-fallback-runtime-binding-readiness"
        label="Runtime Binding Readiness"
        value={runtimeBindingReadiness}
      />,
    );
  }

  if (fallbackOverview.latest_snapshot) {
    metrics.push(
      <SummaryMetric
        key="job-overview-fallback-execution-snapshot"
        label="Execution Snapshot"
        value={<code>{fallbackOverview.latest_snapshot.id}</code>}
      />,
    );
  }

  return metrics;
}

function resolveLatestJobOverviewFallback(
  overview: ManuscriptModuleExecutionOverviewViewModel | undefined,
  latestJob: AnyWorkbenchJob | null,
): ModuleExecutionOverviewViewModel | undefined {
  if (!latestJob) {
    return undefined;
  }

  const moduleOverview = overview?.[latestJob.module as MainlineSettlementModule];
  if (
    !moduleOverview ||
    moduleOverview.observation_status !== "reported" ||
    !moduleOverview.latest_job ||
    moduleOverview.latest_job.id !== latestJob.id
  ) {
    return undefined;
  }

  return moduleOverview;
}

interface RecommendedNextStepViewModel {
  focus: string;
  guidance: string;
  details: WorkbenchActionResultDetail[];
  targetMode?: ManuscriptWorkbenchMode;
  targetLabel?: string;
  targetHref?: string;
}

function buildMainlineReadinessRecommendedNextStep(
  mode: ManuscriptWorkbenchMode,
  workspace: ManuscriptWorkbenchWorkspace,
): RecommendedNextStepViewModel | undefined {
  if (mode === "submission") {
    return undefined;
  }

  const summary = workspace.manuscript.mainline_readiness_summary;
  if (
    !summary ||
    summary.observation_status !== "reported" ||
    !summary.derived_status
  ) {
    return undefined;
  }

  const details = [
    {
      label: "Manuscript",
      value: workspace.manuscript.id,
    },
    ...buildManuscriptMainlineReadinessDetails(summary),
    {
      label: "Current Asset",
      value: describeAsset(workspace.currentAsset),
    },
  ];

  if (summary.derived_status === "ready_for_next_step" && summary.next_module) {
    if (summary.next_module === mode) {
      if (mode === "screening") {
        return {
          focus: "Run screening on the recommended parent asset",
          guidance:
            summary.reason ?? "The manuscript is ready for governed screening.",
          details: [
            ...details,
            {
              label: "Recommended Parent",
              value: describeAsset(workspace.suggestedParentAsset),
            },
          ],
        };
      }

      if (mode === "editing") {
        return {
          focus: "Run editing on the screened manuscript asset",
          guidance:
            summary.reason ?? "The manuscript is ready for governed editing.",
          details: [
            ...details,
            {
              label: "Recommended Parent",
              value: describeAsset(workspace.suggestedParentAsset),
            },
          ],
        };
      }

      return {
        focus: "Create the proofreading draft",
        guidance:
          summary.reason ?? "The manuscript is ready for governed proofreading.",
        details: [
          ...details,
          {
            label: "Recommended Parent",
            value: describeAsset(workspace.suggestedParentAsset),
          },
        ],
      };
    }

    return {
      focus: `Advance this manuscript into ${summary.next_module}`,
      guidance:
        summary.reason ??
        `The manuscript is ready for governed ${summary.next_module}.`,
      details,
      targetMode: summary.next_module,
      targetLabel: `Open ${formatWorkbenchModeLabel(summary.next_module)} Workbench`,
    };
  }

  if (summary.derived_status === "in_progress") {
    return {
      focus: `Wait for ${summary.active_module ?? "mainline"} execution to finish`,
      guidance: summary.reason ?? "The current governed run is still in progress.",
      details,
    };
  }

  if (summary.derived_status === "waiting_for_follow_up") {
    return {
      focus: `Wait for ${summary.active_module ?? "mainline"} follow-up to settle`,
      guidance:
        summary.reason ??
        "Business output exists, but governed follow-up is not settled yet.",
      details,
    };
  }

  if (summary.derived_status === "attention_required") {
    return {
      focus: `Inspect ${summary.active_module ?? "mainline"} posture before continuing`,
      guidance:
        summary.reason ??
        "The current mainline posture needs operator attention before the handoff can continue.",
      details,
    };
  }

  if (summary.derived_status === "completed" && mode !== "proofreading") {
    return {
      focus: "Mainline execution is already settled",
      guidance:
        summary.reason ??
        "Screening, editing, and proofreading are already settled.",
      details,
    };
  }

  return undefined;
}

function buildRecommendedNextStep(
  mode: ManuscriptWorkbenchMode,
  workspace: ManuscriptWorkbenchWorkspace,
  latestJob: AnyWorkbenchJob | null,
  latestExport: DocumentAssetExportViewModel | null,
  canOpenLearningReview: boolean,
): RecommendedNextStepViewModel {
  const summaryRecommendation = buildMainlineReadinessRecommendedNextStep(
    mode,
    workspace,
  );
  if (summaryRecommendation) {
    return summaryRecommendation;
  }

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
            value: latestExport.download.storage_key,
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
    const screeningRecommendation = buildModuleSettlementRecommendedNextStep({
      module: "screening",
      nextMode: "editing",
      nextStageLabel: "editing",
      workspace,
    });
    if (screeningRecommendation) {
      return screeningRecommendation;
    }

    const screeningTrackingRecommendation =
      buildLatestJobExecutionTrackingRecommendedNextStep({
        module: "screening",
        nextMode: "editing",
        nextStageLabel: "editing",
        workspace,
        latestJob,
      });
    if (screeningTrackingRecommendation) {
      return screeningTrackingRecommendation;
    }

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
    const editingRecommendation = buildModuleSettlementRecommendedNextStep({
      module: "editing",
      nextMode: "proofreading",
      nextStageLabel: "proofreading",
      workspace,
    });
    if (editingRecommendation) {
      return editingRecommendation;
    }

    const editingTrackingRecommendation =
      buildLatestJobExecutionTrackingRecommendedNextStep({
        module: "editing",
        nextMode: "proofreading",
        nextStageLabel: "proofreading",
        workspace,
        latestJob,
      });
    if (editingTrackingRecommendation) {
      return editingTrackingRecommendation;
    }

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

  if (workspace.currentAsset?.asset_type === "human_final_docx") {
    return {
      focus: "Hand off this manuscript into learning review",
      guidance: "The human-final manuscript is ready for governed learning snapshot creation.",
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
      targetLabel: canOpenLearningReview ? "Open Learning Review" : undefined,
      targetHref: canOpenLearningReview
        ? formatWorkbenchHash("learning-review", workspace.manuscript.id)
        : undefined,
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
            value: latestExport?.download.storage_key ?? "Prepare export from Workspace Utilities",
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

function buildModuleSettlementRecommendedNextStep(input: {
  module: MainlineSettlementModule;
  nextMode: Exclude<ManuscriptWorkbenchMode, "submission">;
  nextStageLabel: string;
  workspace: ManuscriptWorkbenchWorkspace;
}): RecommendedNextStepViewModel | undefined {
  const overview = input.workspace.manuscript.module_execution_overview?.[input.module];
  if (!overview || overview.observation_status !== "reported" || !overview.settlement) {
    return undefined;
  }

  const details = buildSettlementDetails(overview, input.workspace.currentAsset);

  switch (overview.settlement.derived_status) {
    case "business_completed_settled":
      return {
        focus: `Advance this manuscript into ${input.nextStageLabel}`,
        guidance: `${formatMainlineModuleLabel(input.module)} output is settled and ready for the next governed ${input.nextStageLabel} handoff.`,
        details: [
          {
            label: "Manuscript",
            value: input.workspace.manuscript.id,
          },
          ...details,
        ],
        targetMode: input.nextMode,
        targetLabel: `Open ${formatWorkbenchModeLabel(input.nextMode)} Workbench`,
      };
    case "business_completed_follow_up_pending":
    case "business_completed_follow_up_running":
      return {
        focus: `Wait for ${input.module} follow-up before ${input.nextStageLabel} handoff`,
        guidance: "Business output exists, but orchestration follow-up is not settled yet.",
        details,
      };
    case "business_completed_follow_up_retryable":
      return {
        focus: `Inspect ${input.module} follow-up before ${input.nextStageLabel} handoff`,
        guidance: "Business output exists, but governed follow-up is retryable and not settled yet.",
        details,
      };
    case "business_completed_follow_up_failed":
      return {
        focus: `Inspect ${input.module} follow-up failure before ${input.nextStageLabel} handoff`,
        guidance: "Business output exists, but governed follow-up failed and needs operator attention.",
        details,
      };
    case "business_completed_unlinked":
      return {
        focus: `Inspect ${input.module} settlement linkage before ${input.nextStageLabel} handoff`,
        guidance: "Business output exists, but settlement linkage is incomplete, so the handoff should pause.",
        details,
      };
    case "job_failed":
      return {
        focus: `Inspect the failed ${input.module} run`,
        guidance: "The latest governed attempt failed and needs inspection before the handoff can continue.",
        details,
      };
    case "job_in_progress":
      return {
        focus: `Wait for ${input.module} execution to finish`,
        guidance: "The current governed run is still in progress.",
        details,
      };
    case "not_started":
      return undefined;
  }
}

function buildLatestJobExecutionTrackingRecommendedNextStep(input: {
  module: MainlineSettlementModule;
  nextMode: Exclude<ManuscriptWorkbenchMode, "submission">;
  nextStageLabel: string;
  workspace: ManuscriptWorkbenchWorkspace;
  latestJob: AnyWorkbenchJob | null;
}): RecommendedNextStepViewModel | undefined {
  if (!input.latestJob || input.latestJob.module !== input.module) {
    return undefined;
  }

  const executionTracking = getJobExecutionTracking(input.latestJob);
  if (
    !executionTracking ||
    executionTracking.observation_status !== "reported" ||
    !executionTracking.settlement
  ) {
    return undefined;
  }

  const details = buildLatestJobExecutionTrackingSettlementDetails(
    executionTracking,
    input.workspace.currentAsset,
  );

  switch (executionTracking.settlement.derived_status) {
    case "business_completed_settled":
      return {
        focus: `Advance this manuscript into ${input.nextStageLabel}`,
        guidance: `${formatMainlineModuleLabel(input.module)} output is settled and ready for the next governed ${input.nextStageLabel} handoff.`,
        details: [
          {
            label: "Manuscript",
            value: input.workspace.manuscript.id,
          },
          ...details,
        ],
        targetMode: input.nextMode,
        targetLabel: `Open ${formatWorkbenchModeLabel(input.nextMode)} Workbench`,
      };
    case "business_completed_follow_up_pending":
    case "business_completed_follow_up_running":
      return {
        focus: `Wait for ${input.module} follow-up before ${input.nextStageLabel} handoff`,
        guidance: "Business output exists, but orchestration follow-up is not settled yet.",
        details,
      };
    case "business_completed_follow_up_retryable":
      return {
        focus: `Inspect ${input.module} follow-up before ${input.nextStageLabel} handoff`,
        guidance: "Business output exists, but governed follow-up is retryable and not settled yet.",
        details,
      };
    case "business_completed_follow_up_failed":
      return {
        focus: `Inspect ${input.module} follow-up failure before ${input.nextStageLabel} handoff`,
        guidance: "Business output exists, but governed follow-up failed and needs operator attention.",
        details,
      };
    case "business_completed_unlinked":
      return {
        focus: `Inspect ${input.module} settlement linkage before ${input.nextStageLabel} handoff`,
        guidance: "Business output exists, but settlement linkage is incomplete, so the handoff should pause.",
        details,
      };
    case "job_failed":
      return {
        focus: `Inspect the failed ${input.module} run`,
        guidance: "The latest governed attempt failed and needs inspection before the handoff can continue.",
        details,
      };
    case "job_in_progress":
      return {
        focus: `Wait for ${input.module} execution to finish`,
        guidance: "The current governed run is still in progress.",
        details,
      };
    case "not_started":
      return undefined;
  }
}

function buildSettlementDetails(
  overview: ModuleExecutionOverviewViewModel,
  currentAsset: DocumentAssetViewModel | null,
): WorkbenchActionResultDetail[] {
  const details: WorkbenchActionResultDetail[] = [
    {
      label: "Settlement",
      value: formatSettlementStatusLabel(overview.settlement?.derived_status),
    },
  ];

  const recoveryPosture = describeModuleExecutionRecoveryPosture(overview);
  if (recoveryPosture) {
    details.push({
      label: "Recovery Posture",
      value: recoveryPosture,
    });
  }

  const recoveryReadyAt = getModuleExecutionRecoveryReadyAt(overview);
  if (recoveryReadyAt) {
    details.push({
      label: "Recovery Ready At",
      value: formatTimestamp(recoveryReadyAt),
    });
  }

  const runtimeReadiness = describeModuleExecutionRuntimeBindingReadiness(overview);
  if (runtimeReadiness) {
    details.push({
      label: "Runtime Readiness",
      value: runtimeReadiness,
    });
  }

  if (overview.latest_snapshot) {
    details.push({
      label: "Snapshot",
      value: overview.latest_snapshot.id,
    });
  }

  if (currentAsset) {
    details.push({
      label: "Current Asset",
      value: describeAsset(currentAsset),
    });
  }

  return details;
}

function buildLatestJobExecutionTrackingSettlementDetails(
  executionTracking: JobExecutionTrackingObservationViewModel,
  currentAsset: DocumentAssetViewModel | null,
): WorkbenchActionResultDetail[] {
  const details: WorkbenchActionResultDetail[] = [
    {
      label: "Settlement",
      value: formatSettlementStatusLabel(executionTracking.settlement?.derived_status),
    },
  ];

  const recoveryPosture = describeExecutionTrackingRecoveryPosture(executionTracking);
  if (recoveryPosture) {
    details.push({
      label: "Recovery Posture",
      value: recoveryPosture,
    });
  }

  const recoveryReadyAt = getExecutionTrackingRecoveryReadyAt(executionTracking);
  if (recoveryReadyAt) {
    details.push({
      label: "Recovery Ready At",
      value: formatTimestamp(recoveryReadyAt),
    });
  }

  const runtimeReadiness = describeExecutionTrackingRuntimeBindingReadiness(
    executionTracking,
  );
  if (runtimeReadiness) {
    details.push({
      label: "Runtime Readiness",
      value: runtimeReadiness,
    });
  }

  if (executionTracking.snapshot) {
    details.push({
      label: "Snapshot",
      value: executionTracking.snapshot.id,
    });
  }

  if (currentAsset) {
    details.push({
      label: "Current Asset",
      value: describeAsset(currentAsset),
    });
  }

  return details;
}

function formatMainlineModuleLabel(module: MainlineSettlementModule): string {
  if (module === "screening") {
    return "Screening";
  }
  if (module === "editing") {
    return "Editing";
  }

  return "Proofreading";
}

function describeModuleExecutionOverview(
  overview: ModuleExecutionOverviewViewModel | undefined,
): string {
  if (!overview) {
    return "Not reported";
  }

  if (overview.observation_status === "failed_open") {
    return "Observation unavailable (failed open)";
  }

  if (overview.observation_status === "not_started") {
    return "Not started";
  }

  const parts: string[] = [];
  if (overview.settlement) {
    parts.push(formatSettlementStatusLabel(overview.settlement.derived_status));
  } else {
    parts.push("Reported");
  }

  const recoveryPosture = describeModuleExecutionRecoveryPosture(overview);
  if (recoveryPosture) {
    parts.push(recoveryPosture);
  }

  const recoveryReadyAt = getModuleExecutionRecoveryReadyAt(overview);
  if (recoveryReadyAt) {
    parts.push(`ready at ${formatTimestamp(recoveryReadyAt)}`);
  }

  const compactRuntimeBindingReadiness = describeCompactModuleRuntimeBindingReadiness(
    overview,
  );
  if (compactRuntimeBindingReadiness) {
    parts.push(compactRuntimeBindingReadiness);
  }

  if (overview.latest_job) {
    parts.push(`latest job ${overview.latest_job.status}`);
  }

  if (overview.latest_snapshot) {
    parts.push(`snapshot ${overview.latest_snapshot.id}`);
  }

  return parts.join(" · ");
}

function describeModuleExecutionOverviewMetric(
  module: MainlineSettlementModule,
  overview: ModuleExecutionOverviewViewModel | undefined,
  latestJob: AnyWorkbenchJob | null,
): string {
  if (overview?.observation_status === "reported") {
    return describeModuleExecutionOverview(overview);
  }

  const latestJobFallback = describeLatestJobExecutionTrackingOverview(module, latestJob);
  if (latestJobFallback) {
    return latestJobFallback;
  }

  return describeModuleExecutionOverview(overview);
}

function describeLatestJobExecutionTrackingOverview(
  module: MainlineSettlementModule,
  latestJob: AnyWorkbenchJob | null,
): string | undefined {
  if (!latestJob || latestJob.module !== module) {
    return undefined;
  }

  const executionTracking = getJobExecutionTracking(latestJob);
  if (
    !executionTracking ||
    executionTracking.observation_status !== "reported" ||
    !executionTracking.settlement
  ) {
    return undefined;
  }

  const parts: string[] = [
    formatSettlementStatusLabel(executionTracking.settlement.derived_status),
  ];

  const recoveryPosture = describeExecutionTrackingRecoveryPosture(executionTracking);
  if (recoveryPosture) {
    parts.push(recoveryPosture);
  }

  const compactRuntimeBindingReadiness =
    describeCompactExecutionTrackingRuntimeBindingReadiness(executionTracking);
  if (compactRuntimeBindingReadiness) {
    parts.push(compactRuntimeBindingReadiness);
  }

  if (executionTracking.snapshot) {
    parts.push(`snapshot ${executionTracking.snapshot.id}`);
  }

  parts.push("latest tracked job");

  return parts.join(" · ");
}

function describeJobExecutionTracking(
  executionTracking: JobExecutionTrackingObservationViewModel,
): string {
  if (executionTracking.observation_status === "failed_open") {
    return "Observation unavailable (failed open)";
  }

  if (executionTracking.observation_status === "not_tracked") {
    return "Not tracked";
  }

  return formatSettlementStatusLabel(executionTracking.settlement?.derived_status);
}

function describeExecutionTrackingRecoveryPosture(
  executionTracking: JobExecutionTrackingObservationViewModel,
): string | undefined {
  if (executionTracking.observation_status !== "reported") {
    return undefined;
  }

  return formatRecoveryPostureLabel({
    settlementStatus: executionTracking.settlement?.derived_status,
    recoverySummary:
      executionTracking.snapshot?.agent_execution.observation_status === "reported"
        ? executionTracking.snapshot.agent_execution.log?.recovery_summary
        : undefined,
  });
}

function getExecutionTrackingRecoveryReadyAt(
  executionTracking: JobExecutionTrackingObservationViewModel,
): string | undefined {
  if (executionTracking.observation_status !== "reported") {
    return undefined;
  }

  return executionTracking.snapshot?.agent_execution.observation_status === "reported"
    ? executionTracking.snapshot.agent_execution.log?.recovery_summary.recovery_ready_at
    : undefined;
}

function describeExecutionTrackingRuntimeBindingReadiness(
  executionTracking: JobExecutionTrackingObservationViewModel,
): string | undefined {
  if (executionTracking.observation_status !== "reported") {
    return undefined;
  }

  return formatRuntimeBindingReadinessLabel(
    executionTracking.snapshot?.runtime_binding_readiness,
  );
}

function describeModuleExecutionRecoveryPosture(
  overview: ModuleExecutionOverviewViewModel,
): string | undefined {
  return formatRecoveryPostureLabel({
    settlementStatus: overview.settlement?.derived_status,
    recoverySummary:
      overview.latest_snapshot?.agent_execution.observation_status === "reported"
        ? overview.latest_snapshot.agent_execution.log?.recovery_summary
        : undefined,
  });
}

function getModuleExecutionRecoveryReadyAt(
  overview: ModuleExecutionOverviewViewModel,
): string | undefined {
  return overview.latest_snapshot?.agent_execution.observation_status === "reported"
    ? overview.latest_snapshot.agent_execution.log?.recovery_summary.recovery_ready_at
    : undefined;
}

function describeModuleExecutionRuntimeBindingReadiness(
  overview: ModuleExecutionOverviewViewModel,
): string | undefined {
  return formatRuntimeBindingReadinessLabel(overview.latest_snapshot?.runtime_binding_readiness);
}

function describeCompactModuleRuntimeBindingReadiness(
  overview: ModuleExecutionOverviewViewModel,
): string | undefined {
  return describeCompactRuntimeBindingReadinessObservation(
    overview.latest_snapshot?.runtime_binding_readiness,
  );
}

function describeCompactExecutionTrackingRuntimeBindingReadiness(
  executionTracking: JobExecutionTrackingObservationViewModel,
): string | undefined {
  return describeCompactRuntimeBindingReadinessObservation(
    executionTracking.snapshot?.runtime_binding_readiness,
  );
}

function describeCompactRuntimeBindingReadinessObservation(
  observation:
    | {
        observation_status: "reported" | "failed_open";
        report?: RuntimeBindingReadinessReportViewModel;
      }
    | undefined,
): string | undefined {
  if (!observation) {
    return undefined;
  }

  if (observation.observation_status === "failed_open") {
    return "binding observation unavailable";
  }

  const status = observation.report?.status;
  if (status === "degraded") {
    return "binding degraded";
  }

  if (status === "missing") {
    return "binding missing";
  }

  return undefined;
}

function formatMainlineReadinessLabel(
  summary: ManuscriptMainlineReadinessSummaryViewModel,
): string {
  if (summary.observation_status === "failed_open") {
    return "Readiness unavailable";
  }

  switch (summary.derived_status) {
    case "ready_for_next_step":
      return "Ready for next step";
    case "in_progress":
      return "In progress";
    case "waiting_for_follow_up":
      return "Waiting for follow-up";
    case "attention_required":
      return "Attention required";
    case "completed":
      return "Mainline settled";
    default:
      return "Readiness reported";
  }
}

function formatSummaryRuntimeBindingReadiness(
  summary: ManuscriptMainlineReadinessSummaryViewModel,
): string | undefined {
  if (!summary.runtime_binding_status) {
    return undefined;
  }

  const issueCount = summary.runtime_binding_issue_count ?? 0;
  const issueLabel = `${issueCount} issue${issueCount === 1 ? "" : "s"}`;

  if (summary.runtime_binding_status === "degraded") {
    return `Degraded (${issueLabel})`;
  }

  if (summary.runtime_binding_status === "missing") {
    return `Missing (${issueLabel})`;
  }

  return "Ready";
}

function formatAttentionStatusLabel(
  status: NonNullable<ManuscriptMainlineAttentionHandoffPackViewModel["attention_status"]>,
): string {
  switch (status) {
    case "clear":
      return "Clear";
    case "monitoring":
      return "Monitoring";
    case "action_required":
      return "Action required";
  }
}

function formatMainlineAttentionHandoffLabel(
  pack: ManuscriptMainlineAttentionHandoffPackViewModel,
): string {
  if (pack.observation_status === "failed_open") {
    return "Attention unavailable";
  }

  switch (pack.handoff_status) {
    case "ready_now":
      if (pack.from_module && pack.to_module) {
        return `${pack.from_module} -> ${pack.to_module} ready now`;
      }
      if (pack.to_module) {
        return `${pack.to_module} ready now`;
      }
      return "Ready now";
    case "blocked_by_in_progress":
      if (pack.focus_module && pack.to_module) {
        return `${pack.focus_module} still running before ${pack.to_module}`;
      }
      if (pack.focus_module) {
        return `${pack.focus_module} still running`;
      }
      return "Blocked by in-progress work";
    case "blocked_by_follow_up":
      if (pack.focus_module && pack.to_module) {
        return `${pack.focus_module} follow-up still unsettled before ${pack.to_module}`;
      }
      if (pack.focus_module) {
        return `${pack.focus_module} follow-up still unsettled`;
      }
      return "Blocked by unsettled follow-up";
    case "blocked_by_attention":
      if (pack.from_module && pack.to_module) {
        return `${pack.from_module} -> ${pack.to_module} blocked by attention`;
      }
      if (pack.focus_module) {
        return `${pack.focus_module} blocked by attention`;
      }
      return "Blocked by attention";
    case "completed":
      return "Mainline completed";
    default:
      return "Handoff reported";
  }
}

function formatAttentionItemDetail(item: MainlineAttentionItemViewModel): string {
  return `${item.module} ${formatAttentionSeverityLabel(item.severity).toLowerCase()}: ${item.summary}`;
}

function formatAttentionItemHeading(item: MainlineAttentionItemViewModel): string {
  return `${item.module} ${formatAttentionItemKindLabel(item.kind)}`;
}

function formatAttentionItemKindLabel(
  kind: MainlineAttentionItemViewModel["kind"],
): string {
  switch (kind) {
    case "job_in_progress":
      return "job in progress";
    case "follow_up_pending":
      return "follow-up pending";
    case "follow_up_running":
      return "follow-up running";
    case "follow_up_retryable":
      return "follow-up retryable";
    case "follow_up_failed":
      return "follow-up failed";
    case "settlement_unlinked":
      return "settlement unlinked";
    case "job_failed":
      return "job failed";
    case "runtime_binding_degraded":
      return "runtime degraded";
    case "runtime_binding_missing":
      return "runtime missing";
  }
}

function formatAttentionSeverityLabel(
  severity: MainlineAttentionItemViewModel["severity"],
): string {
  return severity === "action_required" ? "Action required" : "Monitoring";
}

function formatSettlementStatusLabel(
  status: ModuleMainlineSettlementDerivedStatus | undefined,
): string {
  switch (status) {
    case "business_completed_settled":
      return "Settled";
    case "business_completed_follow_up_pending":
      return "Business complete, follow-up pending";
    case "business_completed_follow_up_running":
      return "Business complete, follow-up running";
    case "business_completed_follow_up_retryable":
      return "Business complete, follow-up retryable";
    case "business_completed_follow_up_failed":
      return "Business complete, follow-up failed";
    case "business_completed_unlinked":
      return "Business complete, settlement unlinked";
    case "job_failed":
      return "Job failed";
    case "job_in_progress":
      return "Job in progress";
    case "not_started":
      return "Not started";
    default:
      return "Reported";
  }
}

function formatJobStatusLabel(status: JobViewModel["status"]): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    case "running":
      return "Running";
    case "queued":
      return "Queued";
  }
}

function formatRecoveryPostureLabel(input: {
  settlementStatus?: ModuleMainlineSettlementDerivedStatus;
  recoverySummary?: LinkedAgentExecutionRecoverySummaryViewModel;
}): string | undefined {
  const recoverySummary = input.recoverySummary;
  if (!recoverySummary) {
    return undefined;
  }

  if (
    input.settlementStatus === "business_completed_settled" &&
    recoverySummary.category === "not_recoverable"
  ) {
    return "No recovery needed";
  }

  switch (recoverySummary.category) {
    case "recoverable_now":
      return "Recoverable now";
    case "stale_running":
      return "Stale running reclaimable now";
    case "deferred_retry":
      return "Waiting for retry window";
    case "attention_required":
      return "Attention required";
    case "not_recoverable":
      if (recoverySummary.recovery_readiness === "waiting_running_timeout") {
        return "Waiting for running-timeout window";
      }
      return "Not recoverable";
  }
}

function formatRuntimeBindingReadinessLabel(
  observation:
    | {
        observation_status: "reported" | "failed_open";
        report?: RuntimeBindingReadinessReportViewModel;
        error?: string;
      }
    | undefined,
): string | undefined {
  if (!observation) {
    return undefined;
  }

  if (observation.observation_status === "failed_open") {
    return "Observation unavailable (failed open)";
  }

  const report = observation.report;
  if (!report) {
    return "Reported";
  }

  const issueCount = report.issues.length;
  const issueLabel = `${issueCount} issue${issueCount === 1 ? "" : "s"}`;

  if (report.status === "degraded") {
    return `Degraded (${issueLabel})`;
  }

  if (report.status === "missing") {
    return `Missing (${issueLabel})`;
  }

  return "Ready";
}

function getJobExecutionTracking(
  latestJob: AnyWorkbenchJob | null,
): JobExecutionTrackingObservationViewModel | undefined {
  if (!latestJob || !("execution_tracking" in latestJob)) {
    return undefined;
  }

  return latestJob.execution_tracking;
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
    asset.asset_type === "final_proof_annotated_docx"
  );
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
