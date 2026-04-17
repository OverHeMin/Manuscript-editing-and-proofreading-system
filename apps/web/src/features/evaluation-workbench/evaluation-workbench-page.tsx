import { useEffect, useState } from "react";
import { WorkbenchCoreStrip } from "../../app/workbench-core-strip.tsx";
import { formatWorkbenchHash } from "../../app/workbench-routing.ts";
import { createBrowserHttpClient, BrowserHttpClientError } from "../../lib/browser-http-client.ts";
import type {
  AdminGovernanceOverview,
  AdminGovernanceWorkbenchController,
  AdminHarnessScopeViewModel,
  HarnessEnvironmentPreviewViewModel,
} from "../admin-governance/admin-governance-controller.ts";
import type { AuthRole } from "../auth/index.ts";
import type { WorkbenchHarnessSection } from "../auth/workbench.ts";
import { HarnessOperatorSection } from "./harness-operator-section.tsx";
import { HarnessDatasetsWorkbenchPage } from "../harness-datasets/harness-datasets-workbench-page.tsx";
import type { HarnessDatasetsWorkbenchOverview } from "../harness-datasets/types.ts";
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
  evidenceLabel: "浏览器 QA 证据",
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
  harnessController?: AdminGovernanceWorkbenchController;
  actorRole?: AuthRole;
  section?: WorkbenchHarnessSection;
  prefilledManuscriptId?: string;
  initialOverview?: EvaluationWorkbenchOverview | null;
  initialHarnessOverview?: AdminGovernanceOverview | null;
  initialHarnessScope?: AdminHarnessScopeViewModel | null;
  initialHarnessPreview?: HarnessEnvironmentPreviewViewModel | null;
  initialDatasetsOverview?: HarnessDatasetsWorkbenchOverview | null;
}

export function EvaluationWorkbenchPage({
  controller = defaultController,
  harnessController,
  actorRole,
  section = "overview",
  prefilledManuscriptId,
  initialOverview = null,
  initialHarnessOverview = null,
  initialHarnessScope = null,
  initialHarnessPreview = null,
  initialDatasetsOverview = null,
}: EvaluationWorkbenchPageProps) {
  const landingCopy = resolveEvaluationLandingCopy(section);
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
        <h2>{`${landingCopy.title} 暂不可用`}</h2>
        <p>{landingCopy.summary}</p>
        <p>{errorMessage ?? "暂时无法加载 Harness 控制数据。"}</p>
      </article>
    );
  }

  if (!overview) {
    return (
      <article className="workbench-placeholder" role="status">
        <h2>{landingCopy.title}</h2>
        <p>{landingCopy.summary}</p>
        <p>正在加载评测套件、运行记录与核验证据...</p>
      </article>
    );
  }

  return (
    <EvaluationWorkbenchOperationsView
      actorRole={actorRole}
      harnessController={harnessController}
      section={section}
      sectionTitle={landingCopy.title}
      sectionSummary={landingCopy.summary}
      overview={overview}
      prefilledManuscriptId={normalizedPrefilledManuscriptId}
      initialHarnessOverview={initialHarnessOverview}
      initialHarnessScope={initialHarnessScope}
      initialHarnessPreview={initialHarnessPreview}
      initialDatasetsOverview={initialDatasetsOverview}
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
  actorRole?: AuthRole;
  harnessController?: AdminGovernanceWorkbenchController;
  section: WorkbenchHarnessSection;
  sectionTitle: string;
  sectionSummary: string;
  overview: EvaluationWorkbenchOverview;
  prefilledManuscriptId?: string;
  initialHarnessOverview?: AdminGovernanceOverview | null;
  initialHarnessScope?: AdminHarnessScopeViewModel | null;
  initialHarnessPreview?: HarnessEnvironmentPreviewViewModel | null;
  initialDatasetsOverview?: HarnessDatasetsWorkbenchOverview | null;
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
  const datasetDraftCount = props.initialDatasetsOverview?.draftVersions.length ?? 0;
  const datasetPublishedCount = props.initialDatasetsOverview?.publishedVersions.length ?? 0;
  const datasetVersionCount = datasetDraftCount + datasetPublishedCount;

  return (
    <section className="evaluation-workbench">
      <header className="evaluation-workbench-hero">
        <div className="evaluation-workbench-hero-copy">
          <p className="evaluation-workbench-eyebrow">Harness 控制</p>
          <h2>{props.sectionTitle}</h2>
          <p>{props.sectionSummary}</p>
          <WorkbenchCoreStrip variant="secondary" />
          {props.errorMessage ? <p className="evaluation-workbench-error">{props.errorMessage}</p> : null}
        </div>
        {props.statusMessage ? <p className="evaluation-workbench-status">{props.statusMessage}</p> : null}
      </header>

      {normalizedPrefilledManuscriptId.length > 0 ? (
        <div className="evaluation-workbench-result">
          <strong>稿件联动上下文</strong>
          <div className="evaluation-workbench-history-compare">
            <span>当前稿件：{normalizedPrefilledManuscriptId}</span>
            <span>
              {props.overview.manuscriptContext?.matchedRunId
                ? `命中运行：${props.overview.manuscriptContext.matchedRunId}`
                : "尚未命中对应运行"}
            </span>
            <span>
              {props.overview.manuscriptContext?.matchedSuiteId
                ? `命中套件：${props.overview.manuscriptContext.matchedSuiteId}`
                : "当前显示默认评测套件"}
            </span>
          </div>
        </div>
      ) : null}

      <section className="evaluation-workbench-panel evaluation-workbench-delta-summary">
        <div className="evaluation-workbench-panel-header">
          <h3>运行总览</h3>
          <span>{describeHistoryWindowPresetLabel(props.overview.suiteOperations.defaultWindow)}</span>
        </div>
        {props.overview.suiteOperations.delta != null && defaultComparison != null ? (
          <>
            <div className="evaluation-workbench-delta-badge-row">
              <span className={`evaluation-workbench-delta-badge is-${props.overview.suiteOperations.delta.classification}`}>
                变化分类：{formatDeltaClassificationLabel(props.overview.suiteOperations.delta.classification)}
              </span>
              <span className="evaluation-workbench-delta-inline-note">
                默认对照：{defaultComparison.selected.run.id} 对 {defaultComparison.baseline.run.id}
              </span>
            </div>
            <p className="evaluation-workbench-delta-copy">
              {describeDeltaReasonCopy({
                delta: props.overview.suiteOperations.delta,
                defaultComparison,
              })}
            </p>
            <p className="evaluation-workbench-delta-copy">
              {describeDeltaNextOperatorCue({
                selectedEntry: defaultComparison.selected,
                baselineEntry: defaultComparison.baseline,
              })}
            </p>
            <div className="evaluation-workbench-delta-meta">
              <span>最新结果与基线对照</span>
              <span>
                当前时间窗口展示 {visibleHistory.length} / {props.overview.finalizedRunHistory.length} 条已定稿运行
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
          <h3>结果对照</h3>
          <span>最新结果与基线对照</span>
        </div>
        {defaultComparison != null && defaultComparisonDetail != null ? (
          <EvaluationWorkbenchRunComparisonCard
            comparisonScopeLabel="最新结果与基线对照"
            selectedEntry={defaultComparison.selected}
            previousEntry={defaultComparison.baseline}
            selectedEvidence={[...defaultComparisonDetail.selectedEvidence]}
            previousEvidence={[...defaultComparisonDetail.baselineEvidence]}
          />
        ) : (
          <div className="evaluation-workbench-result evaluation-workbench-history-guidance">
            <strong>暂时无法对照</strong>
            <p className="evaluation-workbench-empty">
              {describeHonestDegradationCopy({
                honestDegradation: props.overview.suiteOperations.honestDegradation,
                windowPreset: props.overview.suiteOperations.defaultWindow,
              })}
            </p>
          </div>
        )}
      </section>

      <EvaluationWorkbenchReleaseGateSummaryCard
        defaultComparison={defaultComparison}
        selectedRunId={selectedRun?.id ?? null}
        selectedInspectionFinalization={selectedInspectionFinalization}
        honestDegradation={props.overview.suiteOperations.honestDegradation}
        historyWindowPreset={props.overview.suiteOperations.defaultWindow}
      />

      <section className="evaluation-workbench-summary">
        <SummaryCard label="核查配置" value={props.overview.checkProfiles.length} />
        <SummaryCard label="发布配置" value={props.overview.releaseCheckProfiles.length} />
        <SummaryCard label="样本集" value={props.overview.sampleSets.length} />
        <SummaryCard label="评测套件" value={props.overview.suites.length} />
        <SummaryCard label="运行记录" value={props.overview.runs.length} />
        <SummaryCard label="样本条目" value={props.overview.runItems.length} />
        <SummaryCard label="数据集版本" value={datasetVersionCount} />
      </section>

      <div className="evaluation-workbench-unified-layout">
        <aside className="evaluation-workbench-workspace-sidebar">
          <section className="evaluation-workbench-panel">
            <div className="evaluation-workbench-panel-header">
              <h3>Harness 工作区</h3>
              <span>Unified operator loop</span>
            </div>
            <nav className="evaluation-workbench-harness-nav" aria-label="Harness 工作区">
              <a
                className={buildHarnessWorkspaceNavLinkClassName(props.section === "overview")}
                href={formatWorkbenchHash("evaluation-workbench", { harnessSection: "overview" })}
              >
                总览
              </a>
              <a
                className={buildHarnessWorkspaceNavLinkClassName(props.section === "runs")}
                href={formatWorkbenchHash("evaluation-workbench", { harnessSection: "runs" })}
              >
                运行记录
              </a>
              <a
                className={buildHarnessWorkspaceNavLinkClassName(props.section === "datasets")}
                href={formatWorkbenchHash("evaluation-workbench", { harnessSection: "datasets" })}
              >
                数据与样本
              </a>
            </nav>
            <article className="evaluation-workbench-harness-datasets-entry">
              <strong>数据与样本</strong>
              <p className="evaluation-workbench-harness-copy">
                数据集入口仍然留在当前 Harness 工作区里，方便和最近运行、证据、治理控制放在同一个操作链里。
              </p>
              <div className="evaluation-workbench-history-compare">
                <span>草稿 {datasetDraftCount} 个</span>
                <span>已发布 {datasetPublishedCount} 个</span>
              </div>
              <a
                className="workbench-secondary-action"
                href={formatWorkbenchHash("evaluation-workbench", { harnessSection: "datasets" })}
              >
                打开数据与样本
              </a>
            </article>
          </section>
          <div className="evaluation-workbench-layout">
            <section className="evaluation-workbench-panel">
          <div className="evaluation-workbench-panel-header">
            <h3>历史结果</h3>
            <span>{visibleHistory.length} 条可见 / {props.overview.finalizedRunHistory.length} 条总计</span>
          </div>
          <p className="evaluation-workbench-empty">
            当前时间窗口展示 {visibleHistory.length} / {props.overview.finalizedRunHistory.length} 条已定稿运行。
          </p>
          <div className="evaluation-workbench-control-grid">
            <Field label="时间窗口">
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
            <Field label="建议筛选">
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
            <Field label="排序方式">
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
              <strong>当前查看运行：{selectedRun.id}</strong>
              <p className="evaluation-workbench-empty">
                当前查看运行 {selectedRun.id} 不在当前历史窗口内。
              </p>
            </div>
          ) : null}
          {sortedVisibleHistory.length > 0 ? (
            <ul className="evaluation-workbench-stack evaluation-workbench-history-list">
              {sortedVisibleHistory.map((entry) => (
                <li key={entry.run.id}>
                  <button
                    type="button"
                    aria-label={`历史运行 ${entry.run.id}`}
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
              <strong>当前筛选条件下没有符合的已定稿运行。</strong>
            </div>
          )}
            </section>
          </div>
        </aside>

        <main className={`evaluation-workbench-workspace-main${props.section === "datasets" ? " is-datasets" : ""}`}>
          {props.section === "datasets" ? (
            <HarnessDatasetsWorkbenchPage
              embedded
              initialOverview={props.initialDatasetsOverview}
            />
          ) : null}

          <section className="evaluation-workbench-panel">
          <div className="evaluation-workbench-panel-header">
            <h3>套件信号摘要</h3>
            <span>{describeHistoryWindowPresetLabel(props.overview.suiteOperations.defaultWindow)}</span>
          </div>
          <div className="evaluation-workbench-history-summary-grid">
            <article className="evaluation-workbench-history-summary-card">
              <strong>建议分布</strong>
              <span>
                {formatSignalDistributionSummary(
                  props.overview.suiteOperations.signals.recommendationDistribution,
                )}
              </span>
            </article>
            <article className="evaluation-workbench-history-summary-card">
              <strong>证据包结果</strong>
              <span>
                {formatSignalDistributionSummary(
                  props.overview.suiteOperations.signals.evidencePackOutcomeMix,
                )}
              </span>
            </article>
            <article className="evaluation-workbench-history-summary-card">
              <strong>复发信号</strong>
              <span>
                {formatRecurrenceSignalSummary(props.overview.suiteOperations.signals.recurrence)}
              </span>
            </article>
          </div>
        </section>

        <section className="evaluation-workbench-panel">
          <div className="evaluation-workbench-panel-header">
            <h3>评测套件</h3>
            <span>{props.overview.suites.length} 已配置</span>
          </div>
          {props.overview.suites.length === 0 ? (
            <p className="evaluation-workbench-empty">暂无已配置评测套件。</p>
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
                    <span>{formatSuiteTypeLabel(suite.suite_type)} | {formatLifecycleStatusLabel(suite.status)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="evaluation-workbench-panel">
          <div className="evaluation-workbench-panel-header">
            <h3>当前查看</h3>
            <span>{selectedRun?.id ?? "请先选择运行"}</span>
          </div>
          {selectedRun == null ? (
            <p className="evaluation-workbench-empty">
              请选择一条运行，查看已定稿证据与只读详情。
            </p>
          ) : (
            <>
              <div className="evaluation-workbench-result evaluation-workbench-history-detail">
                <strong>当前查看运行：{selectedRun.id}</strong>
                <div className="evaluation-workbench-history-compare">
                  <span>运行状态：{formatRunStatusLabel(selectedRun.status)}</span>
                  <span>样本条目：{selectedRun.run_item_count ?? 0}</span>
                  {selectedInspectionFinalization ? (
                    <>
                      <span>建议结论：{formatRecommendationStatusLabel(selectedInspectionFinalization.recommendation.status)}</span>
                      <span>证据包：{selectedInspectionFinalization.evidence_pack.id}</span>
                      {selectedInspectionFinalization.recommendation.decision_reason ? (
                        <span>{selectedInspectionFinalization.recommendation.decision_reason}</span>
                      ) : null}
                    </>
                  ) : (
                    <span>当前运行尚未生成已定稿建议。</span>
                  )}
                  {selectedRunOutsideVisibleWindow ? (
                    <span>
                      该运行不在默认摘要使用的历史窗口内。
                    </span>
                  ) : null}
                  {!selectedRunOutsideVisibleWindow && !selectedInspectionFinalization ? (
                    <span>
                      该运行仍在当前窗口中，但尚未完成定稿。
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
                  当前查看区域保持只读，所选运行暂无样本关联条目。
                </p>
              )}
              <EvaluationWorkbenchEvidenceList
                evidence={props.overview.selectedRunEvidence}
                emptyMessage="该运行暂无已保存的核验证据。"
              />
            </>
          )}
        </section>
        </main>

        <aside className="evaluation-workbench-workspace-rail">
          <HarnessOperatorSection
            actorRole={props.actorRole}
            harnessController={props.harnessController}
            initialHarnessOverview={props.initialHarnessOverview}
            initialHarnessScope={props.initialHarnessScope}
            initialHarnessPreview={props.initialHarnessPreview}
          />
        </aside>
      </div>
    </section>
  );
}

function buildHarnessWorkspaceNavLinkClassName(isActive: boolean) {
  return `evaluation-workbench-harness-nav-link${isActive ? " is-active" : ""}`;
}

function resolveEvaluationLandingCopy(section: WorkbenchHarnessSection): {
  title: string;
  summary: string;
} {
  if (section === "runs") {
    return {
      title: "Harness 运行记录",
      summary: "默认聚焦最近运行队列与最终建议变化。",
    };
  }

  if (section === "datasets") {
    return {
      title: "Harness 数据集视图",
      summary: "默认聚焦数据集快照与导出链路核对。",
    };
  }

  return {
    title: "Harness 控制概览",
    summary: "默认聚焦总体评测状态与风险分布。",
  };
}

function EvaluationWorkbenchReleaseGateSummaryCard(input: {
  defaultComparison: EvaluationWorkbenchOverview["suiteOperations"]["defaultComparison"];
  selectedRunId: string | null;
  selectedInspectionFinalization: FinalizeEvaluationRunResultViewModel | null;
  honestDegradation: EvaluationWorkbenchOverview["suiteOperations"]["honestDegradation"];
  historyWindowPreset: EvaluationWorkbenchHistoryWindowPreset;
}) {
  const unavailableCopy = describeReleaseGateUnavailableCopy(input);

  if (unavailableCopy) {
    return (
      <section className="evaluation-workbench-panel evaluation-workbench-release-gate-panel">
        <div className="evaluation-workbench-panel-header">
          <h3>发布门摘要</h3>
          <span>发布就绪</span>
        </div>
        <div className="evaluation-workbench-result evaluation-workbench-history-guidance">
          <strong>发布门摘要暂不可用</strong>
          <p className="evaluation-workbench-empty">{unavailableCopy}</p>
        </div>
      </section>
    );
  }

  const comparison = input.defaultComparison!;
  const candidateEntry = comparison.selected;
  const baselineEntry = comparison.baseline;
  const candidateEvidencePack = candidateEntry.finalized.evidence_pack;
  const manifestReadySummary = buildReleaseGateManifestReadySummary({
    candidateEntry,
    baselineEntry,
  });

  return (
    <section className="evaluation-workbench-panel evaluation-workbench-release-gate-panel">
      <div className="evaluation-workbench-panel-header">
        <h3>发布门摘要</h3>
        <span>发布就绪</span>
      </div>
      <div className="evaluation-workbench-result evaluation-workbench-history-detail">
        <strong>
          当前与基线：{baselineEntry.run.id} 对 {candidateEntry.run.id}
        </strong>
        <div className="evaluation-workbench-history-compare">
          <span>当前运行：{candidateEntry.run.id}</span>
          <span>基线运行：{baselineEntry.run.id}</span>
          <span>
            建议状态：{formatRecommendationStatusLabel(candidateEntry.finalized.recommendation.status)}
          </span>
        </div>
      </div>
      <div className="evaluation-workbench-history-summary-grid">
        <article className="evaluation-workbench-history-summary-card">
          <strong>当前证据包</strong>
          <div className="evaluation-workbench-history-compare">
            <span>
              回归摘要：{" "}
              {localizeEvidenceSummaryText(candidateEvidencePack.regression_summary) ?? "未记录回归摘要。"}
            </span>
            <span>
              失败摘要：{" "}
              {localizeEvidenceSummaryText(candidateEvidencePack.failure_summary) ?? "未记录失败摘要。"}
            </span>
          </div>
        </article>
        <article className="evaluation-workbench-history-summary-card">
          <strong>发布就绪摘要</strong>
          <p className="evaluation-workbench-empty">{manifestReadySummary}</p>
        </article>
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
    return ["默认最新运行"];
  }
  if (entryRunId === defaultComparison.baseline.run.id) {
    return ["默认基线"];
  }
  return [];
}

function describeReleaseGateUnavailableCopy(input: {
  defaultComparison: EvaluationWorkbenchOverview["suiteOperations"]["defaultComparison"];
  selectedRunId: string | null;
  selectedInspectionFinalization: FinalizeEvaluationRunResultViewModel | null;
  honestDegradation: EvaluationWorkbenchOverview["suiteOperations"]["honestDegradation"];
  historyWindowPreset: EvaluationWorkbenchHistoryWindowPreset;
}) {
  if (input.defaultComparison == null) {
    if (input.honestDegradation?.reason === "fewer_than_two_visible_finalized_runs") {
      return "当前历史窗口至少需要展示 2 条已定稿运行后，才能生成发布门摘要。";
    }
    return `需要在${describeHistoryWindowPresetLabel(input.historyWindowPreset)}中形成稳定的基线与当前运行后，才能生成发布门摘要。`;
  }

  if (input.selectedRunId != null && input.selectedInspectionFinalization == null) {
    return "所选运行需要先生成已定稿建议与证据包后，才能查看发布门摘要。";
  }

  return null;
}

function buildReleaseGateManifestReadySummary(input: {
  candidateEntry: EvaluationWorkbenchFinalizedRunHistoryEntry;
  baselineEntry: EvaluationWorkbenchFinalizedRunHistoryEntry;
}) {
  const candidateEvidencePack = input.candidateEntry.finalized.evidence_pack;
  return `当前运行 ${input.candidateEntry.run.id} 相对基线 ${input.baselineEntry.run.id} 的结论为 ${formatRecommendationStatusLabel(input.candidateEntry.finalized.recommendation.status)}。回归摘要：${localizeEvidenceSummaryText(candidateEvidencePack.regression_summary) ?? "未记录回归摘要。"} 失败摘要：${localizeEvidenceSummaryText(candidateEvidencePack.failure_summary) ?? "未记录失败摘要。"}`;
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
    return `本次变化判定为改善，因为最新已定稿建议从${formatRecommendationStatusLabel(baselineRecommendation)}提升为${formatRecommendationStatusLabel(selectedRecommendation)}。`;
  }
  if (input.delta.reason === "recommendation_regressed") {
    return `本次变化判定为回落，因为最新已定稿建议从${formatRecommendationStatusLabel(baselineRecommendation)}变为${formatRecommendationStatusLabel(selectedRecommendation)}。`;
  }
  if (input.delta.reason === "finalized_status_improved") {
    return `本次变化判定为改善，因为最新运行状态从${formatRunStatusLabel(baselineStatus)}提升为${formatRunStatusLabel(selectedStatus)}。`;
  }
  if (input.delta.reason === "finalized_status_regressed") {
    return `本次变化判定为回落，因为最新运行状态从${formatRunStatusLabel(baselineStatus)}变为${formatRunStatusLabel(selectedStatus)}。`;
  }
  return `本次变化判定为持平，因为 ${input.defaultComparison.selected.run.id} 与 ${input.defaultComparison.baseline.run.id} 之间没有出现显著差异。`;
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
    return `当前${describeHistoryWindowPresetLabel(input.windowPreset)}内可见的已定稿运行不足 2 条，暂时无法形成默认变化结论。`;
  }
  if (input.honestDegradation?.reason === "insufficient_comparison_data") {
    return "当前可见的已定稿运行缺少足够对照信息，暂时无法判断套件是改善、回落还是持平。";
  }
  return "当前套件暂无可用的默认对照结果。";
}

function describeHonestDegradationNextStep(
  honestDegradation: EvaluationWorkbenchOverview["suiteOperations"]["honestDegradation"],
) {
  if (honestDegradation?.reason === "fewer_than_two_visible_finalized_runs") {
    return "请先在当前窗口内再完成 1 条运行定稿后，再判断套件是改善、回落还是持平。";
  }
  if (honestDegradation?.reason === "insufficient_comparison_data") {
    return "请先直接查看最新已定稿运行，等待形成稳定的对照对后再判断。";
  }
  return "请先直接查看当前运行，等待形成稳定的对照对后再判断。";
}

function createHistoryWindowOptions() {
  return [
    { value: "latest_10" as const, label: "最近 10 次" },
    { value: "last_7_days" as const, label: "最近 7 天" },
    { value: "last_30_days" as const, label: "最近 30 天" },
    { value: "all_suite" as const, label: "全部套件历史" },
  ];
}

function describeHistoryWindowPresetLabel(preset: EvaluationWorkbenchHistoryWindowPreset) {
  return (
    createHistoryWindowOptions().find((option) => option.value === preset)?.label ?? "最近 10 次"
  );
}

function createHistoryFilterControlOptions() {
  return [
    { value: "all" as const, label: "全部" },
    { value: "recommended" as const, label: "可推荐" },
    { value: "needs_review" as const, label: "待复核" },
    { value: "rejected" as const, label: "已拒绝" },
  ];
}

function createHistorySortControlOptions() {
  return [
    { value: "newest" as const, label: "最新优先" },
    { value: "failures_first" as const, label: "失败优先" },
  ];
}

function formatSignalDistributionSummary(input: {
  recommended: number;
  needs_review: number;
  rejected: number;
}) {
  return `${input.recommended} 可推荐 / ${input.needs_review} 待复核 / ${input.rejected} 已拒绝`;
}

function formatRecurrenceSignalSummary(input: {
  regressionMentions: number;
  failureMentions: number;
  runsWithRecurrenceSignals: number;
}) {
  return `${input.regressionMentions} 次回归提及 / ${input.failureMentions} 次失败提及 / ${input.runsWithRecurrenceSignals} 次运行被标记`;
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
      <strong>对照基线：{props.previousEntry.run.id}</strong>
      <div className="evaluation-workbench-history-compare">
        <span>{operatorSummary}</span>
        <span>{baselinePolicy}</span>
        <span>{triageHint}</span>
        <span>对照范围：{props.comparisonScopeLabel}</span>
        {props.selectedOriginLabel ? (
          <span>当前来源：{props.selectedOriginLabel}</span>
        ) : null}
        {props.previousOriginLabel ? (
          <span>基线来源：{props.previousOriginLabel}</span>
        ) : null}
        <span>{recommendationShift}</span>
        <span>{evidenceCountSummary}</span>
        <span>当前建议：{formatRecommendationStatusLabel(props.selectedEntry.finalized.recommendation.status)}</span>
        <span>基线建议：{formatRecommendationStatusLabel(props.previousEntry.finalized.recommendation.status)}</span>
        <span>当前摘要：{summarizeFinalizedEntry(props.selectedEntry)}</span>
        <span>基线摘要：{summarizeFinalizedEntry(props.previousEntry)}</span>
      </div>
      <div className="evaluation-workbench-history-compare">
        <strong>绑定变化</strong>
        {bindingChanges.length > 0 ? (
          bindingChanges.map((change) => <span key={change}>{change}</span>)
        ) : (
          <span>与基线相比，绑定未发生变化。</span>
        )}
        <span>当前证据：{summarizeEvidenceLabels(props.selectedEvidence)}</span>
        <span>基线证据：{summarizeEvidenceLabels(props.previousEvidence)}</span>
      </div>
      <div className="evaluation-workbench-history-compare">
        <strong>证据包变化</strong>
        {evidencePackChanges.length > 0 ? (
          evidencePackChanges.map((change) => <span key={change}>{change}</span>)
        ) : (
          <span>与基线相比，证据包摘要未发生变化。</span>
        )}
      </div>
      <div className="evaluation-workbench-history-summary-grid">
        <div className="evaluation-workbench-history-summary-card">
          <strong>当前证据包</strong>
          <EvaluationWorkbenchEvidencePackSummary
            evidencePack={props.selectedEntry.finalized.evidence_pack}
          />
        </div>
        <div className="evaluation-workbench-history-summary-card">
          <strong>基线证据包</strong>
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
        请先选择一条运行，再补充证据并完成定稿。
      </p>
    );
  }

  if (finalizeMode === "finalize_recommendation") {
    return (
      <>
        <div className="evaluation-workbench-result">
          <strong>机器已完成的治理运行</strong>
          <div className="evaluation-workbench-history-compare">
            <span>运行状态：{formatRunStatusLabel(props.selectedRun.status)}</span>
            {props.selectedRun.governed_source ? (
              <span>
                治理来源：{formatModuleLabel(props.selectedRun.governed_source.source_module)} /{" "}
                {props.selectedRun.governed_source.manuscript_id}
              </span>
            ) : null}
          </div>
          <p className="evaluation-workbench-empty">
            自动治理检查已完成，请先核对机器证据，再执行最终定稿。
          </p>
          <EvaluationWorkbenchEvidenceList
            evidence={props.selectedRunEvidence}
            emptyMessage="该治理运行暂无已保存的机器证据。"
          />
        </div>
        <button
          type="button"
          onClick={props.onFinalizeRecommendation}
          disabled={props.isBusy}
        >
          完成建议定稿
        </button>
      </>
    );
  }

  if (props.effectiveFinalizedResult) {
    return (
      <div className="evaluation-workbench-result evaluation-workbench-finalized">
        <strong>已定稿建议</strong>
        <div>
          <span>运行：{props.effectiveFinalizedResult.run.id}</span>
          <span>证据包：{props.effectiveFinalizedResult.evidence_pack.id}</span>
          <span>摘要状态：{formatRecommendationStatusLabel(props.effectiveFinalizedResult.evidence_pack.summary_status)}</span>
          <span>建议结论：{formatRecommendationStatusLabel(props.effectiveFinalizedResult.recommendation.status)}</span>
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
        <Field label="运行状态">
          <select
            value={props.finalizeForm.status}
            onChange={(event) =>
              props.onFinalizeStatusChange(event.target.value as "passed" | "failed")
            }
          >
            <option value="passed">已通过</option>
            <option value="failed">已失败</option>
          </select>
        </Field>
        <Field label="证据类型">
          <select
            value={props.finalizeForm.evidenceKind}
            onChange={(event) =>
              props.onEvidenceKindChange(event.target.value as VerificationEvidenceKind)
            }
          >
            <option value="url">链接</option>
            <option value="artifact">制品</option>
          </select>
        </Field>
        <Field label="证据标签">
          <input
            value={props.finalizeForm.evidenceLabel}
            onChange={(event) => props.onEvidenceLabelChange(event.target.value)}
          />
        </Field>
        {props.finalizeForm.evidenceKind === "url" ? (
          <Field label="证据链接" wide>
            <input
              value={props.finalizeForm.evidenceUrl}
              onChange={(event) => props.onEvidenceUrlChange(event.target.value)}
            />
          </Field>
        ) : (
          <Field label="制品资产 ID" wide>
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
            aria-label="制品证据建议"
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
            请先保存运行条目结果，或加载关联样本上下文后再复用内部制品作为证据。
          </p>
        )
      ) : null}
      <button type="button" onClick={props.onCompleteAndFinalize} disabled={props.isBusy}>
        完成运行并定稿
      </button>
      <p className="evaluation-workbench-empty">
        完成定稿后将生成治理建议。
      </p>
    </>
  );
}

export function EvaluationWorkbenchEvidenceList(props: {
  evidence: VerificationEvidenceViewModel[];
  emptyMessage?: string;
}) {
  const { evidence, emptyMessage = "暂无已保存的核验证据。" } = props;

  if (evidence.length === 0) {
    return <p className="evaluation-workbench-empty">{emptyMessage}</p>;
  }

  return (
    <ul className="evaluation-workbench-inline-list">
      {evidence.map((item) => (
        <li key={item.id}>
          <strong>{item.label}</strong>
          <span>{formatEvidenceKindLabel(item.kind)}</span>
          <span>{item.uri ?? item.artifact_asset_id ?? item.id}</span>
          {item.kind === "url" && item.uri ? (
            <a href={item.uri} target="_blank" rel="noreferrer">
              打开证据链接
            </a>
          ) : null}
          {item.kind === "artifact" && item.artifact_asset_id ? (
            <a href={`/api/v1/document-assets/${item.artifact_asset_id}/download`}>
              下载证据制品
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
    { label: "摘要状态", value: formatRecommendationStatusLabel(evidencePack.summary_status) },
    { label: "评分摘要", value: localizeEvidenceSummaryText(evidencePack.score_summary) },
    { label: "回归摘要", value: localizeEvidenceSummaryText(evidencePack.regression_summary) },
    { label: "失败摘要", value: localizeEvidenceSummaryText(evidencePack.failure_summary) },
    { label: "成本摘要", value: localizeEvidenceSummaryText(evidencePack.cost_summary) },
    { label: "时延摘要", value: localizeEvidenceSummaryText(evidencePack.latency_summary) },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));

  if (summaryRows.length === 0) {
    return (
      <p className="evaluation-workbench-empty">
        当前已定稿运行暂无证据包摘要。
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
    { label: "评分", value: localizeEvidenceSummaryText(props.entry.finalized.evidence_pack.score_summary) },
    { label: "回归", value: localizeEvidenceSummaryText(props.entry.finalized.evidence_pack.regression_summary) },
    { label: "失败", value: localizeEvidenceSummaryText(props.entry.finalized.evidence_pack.failure_summary) },
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
        当前历史选择暂无运行条目样本上下文。
      </p>
    );
  }

  return (
    <div className="evaluation-workbench-history-compare">
      <strong>关联样本上下文</strong>
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
              <strong>运行条目：{runItem.id}</strong>
              {isFocused ? <span>当前聚焦</span> : null}
              <span>通道：{formatLaneLabel(runItem.lane)}</span>
              <span>加权得分：{runItem.weighted_score ?? "未评分"}</span>
              {runItem.failure_reason ? <span>失败：{runItem.failure_reason}</span> : null}
              {sampleSetItem ? (
                <>
                  <span>样本条目：{sampleSetItem.id}</span>
                  <span>模块：{formatModuleLabel(sampleSetItem.module)}</span>
                  <span>稿件类型：{formatManuscriptTypeLabel(sampleSetItem.manuscript_type)}</span>
                  <span>复核快照：{sampleSetItem.reviewed_case_snapshot_id}</span>
                  <span>稿件：{sampleSetItem.manuscript_id}</span>
                </>
              ) : (
                <span>该运行条目暂无关联样本条目。</span>
              )}
              {runItem.result_asset_id ? (
                <a href={`/api/v1/document-assets/${runItem.result_asset_id}/download`}>
                  下载结果制品
                </a>
              ) : null}
              {sampleSetItem?.snapshot_asset_id ? (
                <a href={`/api/v1/document-assets/${sampleSetItem.snapshot_asset_id}/download`}>
                  下载样本快照
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
                  查看运行条目 {runItem.id}
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
      <strong>当前样本详情</strong>
      <div className="evaluation-workbench-history-compare">
        <span>运行条目：{selectedRunItem.id}</span>
        <span>通道：{formatLaneLabel(selectedRunItem.lane)}</span>
        <span>硬门限：{describeHardGate(selectedRunItem.hard_gate_passed)}</span>
        <span>
          加权得分：{selectedRunItem.weighted_score == null ? "待补充" : selectedRunItem.weighted_score}
        </span>
        <span>结果制品：{selectedRunItem.result_asset_id ?? "待补充"}</span>
        <span>人工复核：{selectedRunItem.requires_human_review ? "需要" : "不需要"}</span>
        {selectedRunItem.diff_summary ? <span>{selectedRunItem.diff_summary}</span> : null}
        {selectedRunItem.failure_reason ? <span>{selectedRunItem.failure_reason}</span> : null}
        {linkedSampleSetItem ? (
          <>
            <span>样本条目：{linkedSampleSetItem.id}</span>
            <span>模块：{formatModuleLabel(linkedSampleSetItem.module)}</span>
            <span>稿件类型：{formatManuscriptTypeLabel(linkedSampleSetItem.manuscript_type)}</span>
            <span>风险标签：{formatRiskTagList(linkedSampleSetItem.risk_tags)}</span>
            <span>快照制品：{linkedSampleSetItem.snapshot_asset_id}</span>
            <span>复核快照：{linkedSampleSetItem.reviewed_case_snapshot_id}</span>
            <span>稿件：{linkedSampleSetItem.manuscript_id}</span>
            {manuscriptWorkbenchHash ? (
              <a href={manuscriptWorkbenchHash}>{manuscriptWorkbenchLabel}</a>
            ) : null}
          </>
        ) : selectedRun.governed_source ? (
          <EvaluationWorkbenchGovernedSourceInlineDetails selectedRun={selectedRun} />
        ) : (
          <span>该运行条目暂无关联样本条目。</span>
        )}
      </div>
      <ul className="evaluation-workbench-inline-list">
        <li>
          <strong>基线绑定</strong>
          <span>{summarizeBinding(selectedRun.baseline_binding)}</span>
        </li>
        <li>
          <strong>候选绑定</strong>
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
        该运行暂无治理来源信息。
      </p>
    );
  }

  return (
    <div className="evaluation-workbench-result evaluation-workbench-run-item-detail">
      <strong>治理来源详情</strong>
      <div className="evaluation-workbench-history-compare">
        <span>运行：{props.selectedRun.id}</span>
        <EvaluationWorkbenchGovernedSourceInlineDetails selectedRun={props.selectedRun} />
      </div>
      <ul className="evaluation-workbench-inline-list">
        <li>
          <strong>基线绑定</strong>
          <span>{summarizeBinding(props.selectedRun.baseline_binding)}</span>
        </li>
        <li>
          <strong>候选绑定</strong>
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
      <span>来源模块：{formatModuleLabel(governedSource.source_module)}</span>
      <span>稿件：{governedSource.manuscript_id}</span>
      <span>执行快照：{governedSource.execution_snapshot_id}</span>
      <span>Agent 执行日志：{governedSource.agent_execution_log_id}</span>
      <span>输出制品：{governedSource.output_asset_id}</span>
      {props.selectedRun.release_check_profile_id ? (
        <span>发布核查配置：{props.selectedRun.release_check_profile_id}</span>
      ) : null}
      {outputAssetDownloadHref ? (
        <a href={outputAssetDownloadHref}>下载治理输出制品</a>
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

function formatDeltaClassificationLabel(classification: "better" | "worse" | "flat") {
  if (classification === "better") return "改善";
  if (classification === "worse") return "回落";
  return "持平";
}

function formatRecommendationStatusLabel(status: string) {
  if (status === "recommended") return "可推荐";
  if (status === "needs_review") return "待复核";
  if (status === "rejected") return "已拒绝";
  return status;
}

function formatRunStatusLabel(status: string) {
  if (status === "passed") return "已通过";
  if (status === "failed") return "已失败";
  if (status === "running") return "运行中";
  if (status === "queued") return "排队中";
  return status;
}

function formatSuiteTypeLabel(suiteType: string) {
  if (suiteType === "governed_evaluation") return "治理评测";
  if (suiteType === "manual_evaluation") return "人工评测";
  return suiteType;
}

function formatLifecycleStatusLabel(status: string) {
  if (status === "active") return "启用中";
  if (status === "draft") return "草稿";
  if (status === "published") return "已发布";
  if (status === "archived") return "已归档";
  return status;
}

function formatLaneLabel(lane: string) {
  if (lane === "baseline") return "基线";
  if (lane === "candidate") return "候选";
  return lane;
}

function formatModuleLabel(module: string | null | undefined) {
  if (module == null) return "未记录";
  if (module === "submission") return "投稿";
  if (module === "screening") return "初筛";
  if (module === "editing") return "编辑";
  if (module === "proofreading") return "校对";
  return module;
}

function formatManuscriptTypeLabel(manuscriptType: string | null | undefined) {
  if (!manuscriptType) return "未记录";
  return manuscriptType.replaceAll("_", " ");
}

function formatRiskTagList(riskTags: readonly string[] | undefined) {
  return riskTags != null && riskTags.length > 0 ? riskTags.join("，") : "无";
}

function formatBindingSideLabel(label: "Baseline" | "Candidate") {
  return label === "Baseline" ? "基线" : "候选";
}

function formatEvidenceKindLabel(kind: VerificationEvidenceKind) {
  if (kind === "url") return "链接";
  if (kind === "artifact") return "制品";
  return kind;
}

function summarizeCoveredModules(overview: EvaluationWorkbenchOverview) {
  const modules = Array.from(new Set(overview.sampleSets.map((item) => item.module)));
  return modules.length > 0 ? modules.map((item) => formatModuleLabel(item)).join("，") : "未提供";
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
  if (mode === "submission") return "打开投稿工作台";
  if (mode === "screening") return "打开初筛工作台";
  if (mode === "editing") return "打开编辑工作台";
  return "打开校对工作台";
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
    item.hard_gate_passed == null ? "硬门限待判定" : item.hard_gate_passed ? "硬门限已通过" : "硬门限已失败",
    item.weighted_score == null ? "得分待补充" : `得分 ${item.weighted_score}`,
    item.requires_human_review ? "待复核" : "未标记人工复核",
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
      return `当前运行 ${selectedRun.id} 已完成自动治理检查，请先完成建议定稿后再进行历史对照。`;
    }
    return `当前运行 ${selectedRun.id} 状态仍为 ${formatRunStatusLabel(selectedRun.status)}，请先完成运行并定稿后再进行历史对照。`;
  }
  if (selectedRunHistoryEntry) {
    if (scope === "manuscript" && totalFinalizedCount > scopedCount) {
      return "当前稿件仅有 1 条已定稿运行，可切换到全部套件历史查看更广范围的对照。";
    }
    if (scope === "manuscript") {
      return "请先为该稿件再完成 1 条运行定稿，才能与稿件历史进行对照。";
    }
    return "请先在该套件内再完成 1 条运行定稿，才能与历史进行对照。";
  }
  if (scope === "manuscript") {
    return "请先从当前稿件中选择一条已定稿运行，用于与稿件历史结果对照。";
  }
  return "请先选择一条已定稿运行，用于与套件历史对照。";
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
    return "当该运行生成已定稿建议并保存证据后，才可开启结果对照。";
  }
  if (selectedRunHistoryEntry) {
    if (scope === "manuscript" && totalFinalizedCount > scopedCount) {
      const additionalRunCount = totalFinalizedCount - scopedCount;
      return `更广范围的套件历史中已有 ${additionalRunCount} 条额外已定稿运行可用于对照。`;
    }
    return `当前${scope === "manuscript" ? "稿件" : "套件"}历史中仅有这 1 条已定稿运行，暂时没有更早的基线。`;
  }
  if (scopedCount > 0) {
    return `当前可见的${scope === "manuscript" ? "稿件" : "套件"}历史中已有 ${scopedCount} 条已定稿运行可用于选择对照。`;
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
    labels.push("当前运行");
  }
  if (input.entryRunId === input.previousRunId) {
    labels.push("对照基线");
  }
  return labels;
}

export function describeHistoryStatusPair(
  recommendationStatus: string,
  summaryStatus: string,
) {
  return `${formatRecommendationStatusLabel(recommendationStatus)} / ${formatRecommendationStatusLabel(summaryStatus)}`;
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
    return `建议变化：维持 ${formatRecommendationStatusLabel(selectedStatus)}`;
  }
  return `建议变化：${formatRecommendationStatusLabel(selectedStatus)}（原为 ${formatRecommendationStatusLabel(previousStatus)}）`;
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
      return `操作摘要：相较于${scopeLabel}，在维持${formatRecommendationStatusLabel(input.selectedStatus)}的同时提升了 ${scoreDelta.toFixed(1)} 分。`;
    }
    if (scoreDelta != null && scoreDelta < -0.05) {
      return `操作摘要：相较于${scopeLabel}，在维持${formatRecommendationStatusLabel(input.selectedStatus)}的同时下降了 ${Math.abs(scoreDelta).toFixed(1)} 分。`;
    }
    return `操作摘要：相较于${scopeLabel}，当前结果保持在${formatRecommendationStatusLabel(input.selectedStatus)}。`;
  }

  if (selectedSeverity > previousSeverity) {
    const scoreTail =
      scoreDelta != null && Math.abs(scoreDelta) > 0.05
        ? `，并提升 ${scoreDelta.toFixed(1)} 分`
        : "";
    return `操作摘要：相较于${scopeLabel}，结果从${formatRecommendationStatusLabel(input.previousStatus)}提升为${formatRecommendationStatusLabel(input.selectedStatus)}${scoreTail}。`;
  }

  const scoreTail =
    scoreDelta != null && Math.abs(scoreDelta) > 0.05
      ? `，并下降 ${Math.abs(scoreDelta).toFixed(1)} 分`
      : "";
  return `操作摘要：相较于${scopeLabel}，结果从${formatRecommendationStatusLabel(input.previousStatus)}变为${formatRecommendationStatusLabel(input.selectedStatus)}${scoreTail}。`;
}

export function describeComparisonBaselinePolicy(comparisonScopeLabel: string) {
  return `基线策略：按时间顺序选择${comparisonScopeLabel.toLowerCase()}中的上一条已定稿运行。`;
}

export function describeComparisonTriageHint(input: {
  selectedStatus: EvaluationWorkbenchOverview["finalizedRunHistory"][number]["finalized"]["recommendation"]["status"];
  previousStatus: EvaluationWorkbenchOverview["finalizedRunHistory"][number]["finalized"]["recommendation"]["status"];
  scoreDelta: number | null;
}) {
  if (input.selectedStatus === "rejected") {
    return "建议动作：排查回归原因";
  }

  if (input.selectedStatus === "needs_review") {
    return "建议动作：转人工复核";
  }

  if (input.previousStatus !== "recommended") {
    return "建议动作：可推进候选版本";
  }

  if (input.scoreDelta != null && input.scoreDelta > 0.05) {
    return "建议动作：可推进候选版本";
  }

  return "建议动作：继续观察后再推进";
}

function describeEvidenceCountChange(
  selectedEvidence: VerificationEvidenceViewModel[],
  previousEvidence: VerificationEvidenceViewModel[],
) {
  return `证据数量：${selectedEvidence.length}（原为 ${previousEvidence.length}）`;
}

function parseAverageWeightedScore(summary: string | null | undefined) {
  if (!summary) return null;
  const match = /Average weighted score ([0-9]+(?:\.[0-9]+)?)/.exec(summary);
  if (!match) return null;
  return Number(match[1]);
}

function localizeEvidenceSummaryText(summary: string | null | undefined) {
  if (!summary) return summary ?? null;

  const averageScoreMatch = /^Average weighted score ([0-9]+(?:\.[0-9]+)?) across ([0-9]+) item\(s\)\.$/.exec(
    summary,
  );
  if (averageScoreMatch) {
    return `平均加权得分 ${averageScoreMatch[1]}（共 ${averageScoreMatch[2]} 条）`;
  }

  const regressionFailedMatch = /^([0-9]+) regression-failed item\(s\) detected\.$/.exec(summary);
  if (regressionFailedMatch) {
    return `检测到 ${regressionFailedMatch[1]} 条回归失败项。`;
  }

  const regressionDriftMatch = /^Regression drift detected in (.+)\.$/.exec(summary);
  if (regressionDriftMatch) {
    return `检测到 ${regressionDriftMatch[1]} 的回归漂移。`;
  }

  if (summary === "No regression failures were recorded.") {
    return "未发现回归失败。";
  }
  if (summary === "No failure annotations were recorded.") {
    return "未记录失败标注。";
  }
  if (summary === "One hard gate warning remains open.") {
    return "仍有 1 项硬门限告警待处理。";
  }
  if (summary === "Structure regression triggered the hard gate.") {
    return "结构回归触发了硬门限。";
  }
  if (summary === "Cost tracking is not recorded in Phase 6A v1.") {
    return "当前版本暂未记录成本跟踪。";
  }
  if (summary === "Latency tracking is not recorded in Phase 6A v1.") {
    return "当前版本暂未记录时延跟踪。";
  }

  return summary;
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
    entry.run.finished_at ? `完成于 ${entry.run.finished_at}` : undefined,
  ]
    .filter((value) => Boolean(value))
    .join(" | ");
}

function resolveSelectedId(ids: readonly string[], preferredId: string | null) {
  return preferredId && ids.includes(preferredId) ? preferredId : ids[0] ?? null;
}

function describeHardGate(hardGatePassed: boolean | undefined) {
  if (hardGatePassed == null) return "待判定";
  return hardGatePassed ? "已通过" : "已失败";
}

function describeComparisonScopeLabel(input: {
  scope: EvaluationWorkbenchHistoryScope;
  hasManuscriptContext: boolean;
}) {
  if (input.scope === "manuscript") return "命中稿件历史";
  return input.hasManuscriptContext ? "更广范围套件历史" : "全部套件历史";
}

export function describeHistoryEntryOriginLabel(input: {
  runId: string | null;
  matchedRunIds: readonly string[];
  hasManuscriptContext: boolean;
  scope: EvaluationWorkbenchHistoryScope;
}) {
  if (!input.hasManuscriptContext || input.runId == null) return null;
  if (input.scope === "manuscript") return "命中稿件";

  const matchedRunIdSet = new Set(input.matchedRunIds);
  return matchedRunIdSet.has(input.runId) ? "当前稿件" : "更广范围套件";
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
    return `命中稿件运行：${input.runIds.length}`;
  }

  const matchedRunIdSet = new Set(input.matchedRunIds);
  const manuscriptCount = input.runIds.filter((runId) => matchedRunIdSet.has(runId)).length;
  const broaderSuiteCount = input.runIds.length - manuscriptCount;
  return `当前稿件运行：${manuscriptCount} | 更广范围套件参考：${broaderSuiteCount}`;
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
  const scopeLabel = input.scope === "manuscript" ? "稿件范围" : "套件范围";
  const controls: string[] = [];

  if (input.filter !== "all") {
    controls.push(`筛选 ${describeHistoryFilterLabel(input.filter)}`);
  }

  if (input.searchQuery.trim()) {
    controls.push(`搜索“${input.searchQuery.trim()}”`);
  }

  if (input.sortMode !== "newest") {
    controls.push(`排序 ${describeHistorySortModeLabel(input.sortMode)}`);
  }

  return [
    `可见性摘要：${input.visibleCount} / ${input.totalCount} 条已定稿运行处于${scopeLabel}内。`,
    controls.length > 0 ? `当前条件：${controls.join("，")}。` : null,
    input.selectedRunHidden && input.selectedRunId
      ? `当前运行 ${input.selectedRunId} 不在当前结果集中。`
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
    `范围：${describeHistoryScopeSummaryLabel(input.scope)}`,
    `筛选：${describeHistoryFilterSummaryLabel(input.filter)}`,
    `搜索：${input.searchQuery.trim() || "无"}`,
    `排序：${describeHistorySortModeSummaryLabel(input.sortMode)}`,
  ];
}

export function describeHistoryCompareStatusSummary(input: {
  selectedRunHistoryEntry: EvaluationWorkbenchFinalizedRunHistoryEntry | null;
  previousRunHistoryEntry: EvaluationWorkbenchFinalizedRunHistoryEntry | null;
  historyComparisonGuidance: string | null;
  historyComparisonGuidanceSummary: string | null;
}) {
  if (input.selectedRunHistoryEntry && input.previousRunHistoryEntry) {
    return "对照状态：当前运行与对照基线的结果摘要可用。";
  }
  const fallback = input.historyComparisonGuidanceSummary ?? input.historyComparisonGuidance;
  return fallback ? `对照状态：${fallback}` : null;
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

  return "治理来源运行在关联复核快照前，暂不能进入学习回流。";
}

function describeHistoryScopeSummaryLabel(scope: EvaluationWorkbenchHistoryScope) {
  if (scope === "manuscript") return "命中稿件运行";
  return "全部套件历史";
}

function describeHistoryFilterLabel(filter: EvaluationWorkbenchHistoryFilter) {
  return describeHistoryFilterSummaryLabel(filter).replace(/^仅/, "");
}

function describeHistorySortModeLabel(sortMode: EvaluationWorkbenchHistorySortMode) {
  if (sortMode === "failures_first") return "失败优先";
  return "最新优先";
}

function describeHistoryFilterSummaryLabel(filter: EvaluationWorkbenchHistoryFilter) {
  if (filter === "all") return "全部已定稿运行";
  if (filter === "recommended") return "仅可推荐";
  if (filter === "needs_review") return "仅待复核";
  if (filter === "rejected") return "仅已拒绝";
  return filter;
}

function describeHistorySortModeSummaryLabel(sortMode: EvaluationWorkbenchHistorySortMode) {
  if (sortMode === "failures_first") return "失败优先";
  return "最新优先";
}

function capitalizeLabel(value: string) {
  if (!value) return value;
  return `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}`;
}

function formatOptionalList(values: readonly string[] | undefined) {
  return values != null && values.length > 0 ? values.join("，") : "无";
}

function summarizeBinding(
  binding: EvaluationWorkbenchOverview["runs"][number]["baseline_binding"],
) {
  if (!binding) return "未记录";

  return [
    binding.execution_profile_id
      ? `执行配置 ${binding.execution_profile_id}`
      : null,
    binding.runtime_binding_id
      ? `运行时绑定 ${binding.runtime_binding_id}`
      : null,
    binding.model_routing_policy_version_id
      ? `路由版本 ${binding.model_routing_policy_version_id}`
      : null,
    binding.retrieval_preset_id
      ? `检索预设 ${binding.retrieval_preset_id}`
      : null,
    binding.manual_review_policy_id
      ? `人工复核策略 ${binding.manual_review_policy_id}`
      : null,
    `模型 ${binding.model_id}`,
    `运行时 ${binding.runtime_id}`,
    `提示模版 ${binding.prompt_template_id}`,
    `技能包 ${formatOptionalList(binding.skill_package_ids)}`,
    `模块模版 ${binding.module_template_id}`,
  ]
    .filter((value): value is string => value != null)
    .join(" | ");
}

export function summarizeBindingChanges(
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

  pushOptionalChange(
    changes,
    "摘要状态",
    formatRecommendationStatusLabel(selectedPack.summary_status),
    formatRecommendationStatusLabel(previousPack.summary_status),
  );
  pushOptionalChange(
    changes,
    "评分摘要",
    localizeEvidenceSummaryText(selectedPack.score_summary),
    localizeEvidenceSummaryText(previousPack.score_summary),
  );
  pushOptionalChange(
    changes,
    "回归摘要",
    localizeEvidenceSummaryText(selectedPack.regression_summary),
    localizeEvidenceSummaryText(previousPack.regression_summary),
  );
  pushOptionalChange(
    changes,
    "失败摘要",
    localizeEvidenceSummaryText(selectedPack.failure_summary),
    localizeEvidenceSummaryText(previousPack.failure_summary),
  );
  pushOptionalChange(
    changes,
    "成本摘要",
    localizeEvidenceSummaryText(selectedPack.cost_summary),
    localizeEvidenceSummaryText(previousPack.cost_summary),
  );
  pushOptionalChange(
    changes,
    "时延摘要",
    localizeEvidenceSummaryText(selectedPack.latency_summary),
    localizeEvidenceSummaryText(previousPack.latency_summary),
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
        `${formatBindingSideLabel(label)}绑定可用性：${summarizeBinding(selectedBinding)}（原为 ${summarizeBinding(previousBinding)}）`,
      );
    }
    return changes;
  }

  pushBindingChange(changes, `${formatBindingSideLabel(label)}模型`, selectedBinding.model_id, previousBinding.model_id);
  pushBindingChange(changes, `${formatBindingSideLabel(label)}运行时`, selectedBinding.runtime_id, previousBinding.runtime_id);
  pushBindingChange(
    changes,
    `${formatBindingSideLabel(label)}执行配置`,
    selectedBinding.execution_profile_id,
    previousBinding.execution_profile_id,
  );
  pushBindingChange(
    changes,
    `${formatBindingSideLabel(label)}运行时绑定`,
    selectedBinding.runtime_binding_id,
    previousBinding.runtime_binding_id,
  );
  pushBindingChange(
    changes,
    `${formatBindingSideLabel(label)}路由版本`,
    selectedBinding.model_routing_policy_version_id,
    previousBinding.model_routing_policy_version_id,
  );
  pushBindingChange(
    changes,
    `${formatBindingSideLabel(label)}检索预设`,
    selectedBinding.retrieval_preset_id,
    previousBinding.retrieval_preset_id,
  );
  pushBindingChange(
    changes,
    `${formatBindingSideLabel(label)}人工复核策略`,
    selectedBinding.manual_review_policy_id,
    previousBinding.manual_review_policy_id,
  );
  pushBindingChange(
    changes,
    `${formatBindingSideLabel(label)}提示模版`,
    selectedBinding.prompt_template_id,
    previousBinding.prompt_template_id,
  );
  pushBindingChange(
    changes,
    `${formatBindingSideLabel(label)}技能包`,
    formatOptionalList(selectedBinding.skill_package_ids),
    formatOptionalList(previousBinding.skill_package_ids),
  );
  pushBindingChange(
    changes,
    `${formatBindingSideLabel(label)}模块模版`,
    selectedBinding.module_template_id,
    previousBinding.module_template_id,
  );

  return changes;
}

function pushBindingChange(
  changes: string[],
  label: string,
  selectedValue: string | undefined,
  previousValue: string | undefined,
) {
  const normalizedSelectedValue = selectedValue ?? "未记录";
  const normalizedPreviousValue = previousValue ?? "未记录";
  if (normalizedSelectedValue === normalizedPreviousValue) return;
  changes.push(`${label}：${normalizedSelectedValue}（原为 ${normalizedPreviousValue}）`);
}

function pushOptionalChange(
  changes: string[],
  label: string,
  selectedValue: string | null | undefined,
  previousValue: string | null | undefined,
) {
  const normalizedSelectedValue = selectedValue ?? "未记录";
  const normalizedPreviousValue = previousValue ?? "未记录";
  if (normalizedSelectedValue === normalizedPreviousValue) return;
  changes.push(`${label}：${normalizedSelectedValue}（原为 ${normalizedPreviousValue}）`);
}

function summarizeEvidenceLabels(evidence: VerificationEvidenceViewModel[]) {
  return evidence.length > 0 ? evidence.map((item) => item.label).join("，") : "未记录";
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
      actionLabel: `使用结果制品（${selectedRunItem.result_asset_id}）`,
    });
  }

  if (
    linkedSampleSetItem?.snapshot_asset_id &&
    linkedSampleSetItem.snapshot_asset_id !== selectedRunItem?.result_asset_id
  ) {
    options.push({
      source: "sample_snapshot",
      assetId: linkedSampleSetItem.snapshot_asset_id,
      actionLabel: `使用样本快照（${linkedSampleSetItem.snapshot_asset_id}）`,
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
      actionLabel: `使用治理输出（${governedSource.output_asset_id}）`,
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
  return "Harness 控制发生了未预期错误。";
}
