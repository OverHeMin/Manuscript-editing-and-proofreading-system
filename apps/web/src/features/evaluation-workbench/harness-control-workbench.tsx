import { useEffect, useState } from "react";
import { formatWorkbenchHash } from "../../app/workbench-routing.ts";
import type {
  AdminGovernanceOverview,
  AdminGovernanceWorkbenchController,
  AdminHarnessScopeViewModel,
  HarnessEnvironmentPreviewViewModel,
} from "../admin-governance/admin-governance-controller.ts";
import { formatHarnessSurfaceName } from "../admin-governance/harness-surface-copy.ts";
import type { AuthRole } from "../auth/index.ts";
import type { WorkbenchHarnessSection } from "../auth/workbench.ts";
import { HarnessDatasetsWorkbenchPage } from "../harness-datasets/harness-datasets-workbench-page.tsx";
import type { HarnessDatasetsWorkbenchOverview } from "../harness-datasets/types.ts";
import type {
  EvaluationWorkbenchFinalizedRunHistoryEntry,
  EvaluationWorkbenchController,
  EvaluationWorkbenchOverview,
} from "./evaluation-workbench-controller.ts";
import type { EvaluationWorkbenchHistoryWindowPreset } from "./evaluation-workbench-operations.ts";
import {
  HarnessOperatorSection,
  type HarnessOperatorWorkspaceSnapshot,
} from "./harness-operator-section.tsx";

if (typeof document !== "undefined") {
  void import("./harness-control-workbench.css");
}

export type HarnessWorkbenchMode =
  | "ab_acceptance"
  | "regression_inspection"
  | "release_gate"
  | "single_manuscript_diagnosis"
  | "validation_sample_sets";

type HarnessHistoryFilter = "all" | "recommended" | "needs_review" | "rejected";
type HarnessHistorySortMode = "newest" | "failures_first";

interface HarnessControlWorkbenchProps {
  actorRole?: AuthRole;
  harnessController: AdminGovernanceWorkbenchController;
  section: WorkbenchHarnessSection;
  initialMode?: HarnessWorkbenchMode;
  overview: EvaluationWorkbenchOverview;
  prefilledManuscriptId?: string;
  initialHarnessOverview?: AdminGovernanceOverview | null;
  initialHarnessScope?: AdminHarnessScopeViewModel | null;
  initialHarnessPreview?: HarnessEnvironmentPreviewViewModel | null;
  initialDatasetsOverview?: HarnessDatasetsWorkbenchOverview | null;
  statusMessage?: string | null;
  errorMessage?: string | null;
  historyFilter: HarnessHistoryFilter;
  historySortMode: HarnessHistorySortMode;
  selectedRunItemId: string | null;
  onSelectSuite: (suiteId: string) => void;
  onSelectRun: (runId: string) => void;
  onSelectRunItem: (runItemId: string) => void;
  onSelectHistoryWindow: (preset: EvaluationWorkbenchHistoryWindowPreset) => void;
  onSelectHistoryFilter: (filter: HarnessHistoryFilter) => void;
  onSelectHistorySortMode: (sortMode: HarnessHistorySortMode) => void;
  onRunHarnessAbAcceptance: (
    input: Parameters<EvaluationWorkbenchController["runHarnessAbAcceptanceAndReload"]>[0],
  ) => void;
  onRunHarnessActiveRegression: (
    input: Parameters<EvaluationWorkbenchController["runHarnessActiveRegressionAndReload"]>[0],
  ) => void;
  onRunHarnessReleaseGate: (
    input: Parameters<EvaluationWorkbenchController["runHarnessReleaseGateAndReload"]>[0],
  ) => void;
  onDiagnoseManuscript?: (manuscriptId: string) => void;
}

const harnessModeOptions: Array<{
  mode: HarnessWorkbenchMode;
  label: string;
  primaryAction: string;
  summary: string;
}> = [
  {
    mode: "ab_acceptance",
    label: "A/B 验收",
    primaryAction: "运行 candidate vs active",
    summary: "用当前 Active 作为 baseline，比对一个候选变量，核对命中、证据和激活风险。",
  },
  {
    mode: "regression_inspection",
    label: "回归巡检",
    primaryAction: "运行回归巡检",
    summary: "只看当前 Active 的历史稳定性，不暴露候选激活或回滚入口。",
  },
  {
    mode: "release_gate",
    label: "发布门",
    primaryAction: "检查发布门",
    summary: "基于现有发布配置和已定稿证据做只读发布就绪判断。",
  },
  {
    mode: "single_manuscript_diagnosis",
    label: "单稿诊断",
    primaryAction: "诊断单稿",
    summary: "按稿件 ID 回查命中的运行、证据和样本上下文。",
  },
  {
    mode: "validation_sample_sets",
    label: "验证样本集",
    primaryAction: "查看验证样本集",
    summary: "查看版本化验收样本、已发布版本、导出记录和发布冻结状态。",
  },
];

export function HarnessControlWorkbench(props: HarnessControlWorkbenchProps) {
  const [activeMode, setActiveMode] = useState<HarnessWorkbenchMode>(() =>
    props.initialMode ?? resolveInitialHarnessMode(props.section),
  );
  const [advancedDetailsOpen, setAdvancedDetailsOpen] = useState(false);
  const [showAbOperator, setShowAbOperator] = useState(false);
  const [localStatusMessage, setLocalStatusMessage] = useState<string | null>(null);
  const [operatorSnapshot, setOperatorSnapshot] = useState<HarnessOperatorWorkspaceSnapshot>(() =>
    createInitialHarnessOperatorSnapshot({
      initialHarnessOverview: props.initialHarnessOverview,
      initialHarnessScope: props.initialHarnessScope,
      initialHarnessPreview: props.initialHarnessPreview,
    }),
  );
  const [diagnosisManuscriptId, setDiagnosisManuscriptId] = useState(
    props.prefilledManuscriptId?.trim() ?? "",
  );

  useEffect(() => {
    if (props.initialHarnessScope != null) {
      return;
    }

    let disposed = false;

    async function loadActiveHarnessScope() {
      try {
        const nextOverview =
          props.initialHarnessOverview ?? (await props.harnessController.loadOverview());
        if (disposed) {
          return;
        }

        const scopeProfile = resolveDefaultHarnessScopeProfile(nextOverview, props.overview);
        setOperatorSnapshot((current) => ({
          ...current,
          overview: nextOverview,
          isLoading: scopeProfile != null,
          errorMessage: null,
        }));

        if (scopeProfile == null) {
          setOperatorSnapshot((current) => ({
            ...current,
            isLoading: false,
          }));
          return;
        }

        const nextScope = await props.harnessController.loadHarnessScope({
          module: scopeProfile.module,
          manuscriptType: scopeProfile.manuscript_type,
          templateFamilyId: scopeProfile.template_family_id,
        });
        if (disposed) {
          return;
        }

        setOperatorSnapshot((current) => ({
          ...current,
          overview: nextOverview,
          scope: nextScope,
          isLoading: false,
          errorMessage: null,
        }));
      } catch (error) {
        if (disposed) {
          return;
        }

        setOperatorSnapshot((current) => ({
          ...current,
          isLoading: false,
          errorMessage: toHarnessControlErrorMessage(error),
        }));
      }
    }

    void loadActiveHarnessScope();

    return () => {
      disposed = true;
    };
  }, [
    props.harnessController,
    props.initialHarnessOverview,
    props.initialHarnessScope,
    props.overview,
  ]);

  useEffect(() => {
    setActiveMode(props.initialMode ?? resolveInitialHarnessMode(props.section));
  }, [props.initialMode, props.section]);

  const modeConfig = harnessModeOptions.find((option) => option.mode === activeMode) ??
    harnessModeOptions[0];
  const harnessOverview = operatorSnapshot.overview ?? props.initialHarnessOverview ?? null;
  const harnessScope = operatorSnapshot.scope ?? props.initialHarnessScope ?? null;
  const harnessPreview = operatorSnapshot.preview ?? props.initialHarnessPreview ?? null;
  const activeEnvironment = harnessScope?.activeEnvironment ?? null;
  const datasetDraftCount = props.initialDatasetsOverview?.draftVersions.length ?? 0;
  const datasetPublishedCount = props.initialDatasetsOverview?.publishedVersions.length ?? 0;
  const selectedRun =
    props.overview.runs.find((run) => run.id === props.overview.selectedRunId) ?? null;
  const selectedHistoryEntry =
    selectedRun == null
      ? null
      : props.overview.finalizedRunHistory.find((entry) => entry.run.id === selectedRun.id) ??
        null;
  const defaultComparison = props.overview.suiteOperations.defaultComparison;
  const latestHistoryEntry = props.overview.suiteOperations.visibleHistory[0] ??
    props.overview.finalizedRunHistory[0] ??
    null;

  return (
    <section
      className="evaluation-workbench evaluation-workbench-single-page harness-control-workbench"
      data-harness-mode={activeMode}
    >
      <header className="harness-control-header">
        <div className="harness-control-header-copy">
          <p className="harness-control-breadcrumb">
            管理区 / 验证治理 / {modeConfig.label}
          </p>
          <div className="harness-control-title-row">
            <div>
              <h2>验证治理</h2>
              <p>{modeConfig.summary}</p>
            </div>
            <button
              type="button"
              className="harness-control-advanced-toggle"
              aria-pressed={advancedDetailsOpen}
              onClick={() => setAdvancedDetailsOpen((current) => !current)}
            >
              高级详情：{advancedDetailsOpen ? "开" : "关"}
            </button>
          </div>
          {props.errorMessage ? (
            <p className="harness-control-error" role="alert">
              {props.errorMessage}
            </p>
          ) : null}
          {props.statusMessage ? (
            <p className="harness-control-status" role="status">
              {props.statusMessage}
            </p>
          ) : null}
          {localStatusMessage ? (
            <p className="harness-control-status" role="status">
              {localStatusMessage}
            </p>
          ) : null}
        </div>
        <div className="harness-control-active-strip" aria-label="当前生效环境">
          <span>当前生效环境</span>
          <strong>{describeActiveEnvironment(activeEnvironment)}</strong>
          <small>{describeCandidateDiff(harnessPreview)}</small>
        </div>
      </header>

      <nav className="harness-control-mode-tabs" aria-label="验证任务模式">
        {harnessModeOptions.map((option) => (
          <button
            key={option.mode}
            type="button"
            className={`harness-control-mode-tab${
              option.mode === activeMode ? " is-active" : ""
            }`}
            aria-pressed={option.mode === activeMode}
            onClick={() => switchHarnessMode(option.mode, setActiveMode)}
          >
            <span>{option.label}</span>
            <small>{option.primaryAction}</small>
          </button>
        ))}
      </nav>

      <div className="harness-control-workspace">
        <aside className="harness-control-settings">
          <ModeSettingsPanel
            mode={activeMode}
            overview={props.overview}
            harnessOverview={harnessOverview}
            harnessScope={harnessScope}
            harnessPreview={harnessPreview}
            datasetDraftCount={datasetDraftCount}
            datasetPublishedCount={datasetPublishedCount}
            diagnosisManuscriptId={diagnosisManuscriptId}
            onDiagnosisManuscriptIdChange={setDiagnosisManuscriptId}
            onPrimaryAction={() => {
              setLocalStatusMessage(null);
              const workflowInput = createHarnessWorkflowInput({
                mode: activeMode,
                overview: props.overview,
                activeEnvironment,
                harnessPreview,
                actorRole: props.actorRole ?? "admin",
              });

              if (workflowInput.kind === "ab_acceptance") {
                props.onRunHarnessAbAcceptance(workflowInput.input);
                return;
              }

              if (workflowInput.kind === "regression_inspection") {
                props.onRunHarnessActiveRegression(workflowInput.input);
                return;
              }

              if (workflowInput.kind === "release_gate") {
                props.onRunHarnessReleaseGate(workflowInput.input);
                return;
              }

              if (
                workflowInput.kind === "unavailable" &&
                (activeMode === "ab_acceptance" || activeMode === "release_gate")
              ) {
                setShowAbOperator(true);
                setLocalStatusMessage(
                  activeMode === "release_gate"
                    ? "请先在真实执行面板生成候选预览，再回到发布门发起检查。"
                    : "请先在真实执行面板生成候选预览，再运行 candidate vs active。",
                );
                return;
              }

              if (
                activeMode === "single_manuscript_diagnosis" &&
                diagnosisManuscriptId.trim().length > 0
              ) {
                props.onDiagnoseManuscript?.(diagnosisManuscriptId.trim());
                return;
              }

              if (activeMode === "validation_sample_sets") {
                setLocalStatusMessage("验证样本集已在右侧显示，可直接复制草稿、发布、归档或导出。");
                return;
              }

              if (workflowInput.kind === "unavailable") {
                setLocalStatusMessage(workflowInput.reason);
              }
            }}
          />
        </aside>

        <main className="harness-control-results">
          <ModeResultsPanel
            mode={activeMode}
            overview={props.overview}
            selectedRun={selectedRun}
            selectedHistoryEntry={selectedHistoryEntry}
            latestHistoryEntry={latestHistoryEntry}
            defaultComparison={defaultComparison}
            historyFilter={props.historyFilter}
            historySortMode={props.historySortMode}
            selectedRunItemId={props.selectedRunItemId}
            onSelectSuite={props.onSelectSuite}
            onSelectRun={props.onSelectRun}
            onSelectRunItem={props.onSelectRunItem}
            onSelectHistoryWindow={props.onSelectHistoryWindow}
            onSelectHistoryFilter={props.onSelectHistoryFilter}
            onSelectHistorySortMode={props.onSelectHistorySortMode}
            initialDatasetsOverview={props.initialDatasetsOverview}
            diagnosisManuscriptId={diagnosisManuscriptId}
          />
        </main>
      </div>

      {(activeMode === "ab_acceptance" || activeMode === "release_gate") && showAbOperator ? (
        <section className="harness-control-operator-panel">
          <div className="harness-control-section-heading">
            <p>真实执行面板</p>
            <h3>候选预览、运行发起、激活与回滚</h3>
            <span>
              这里复用现有验证治理能力；复杂绑定和危险动作集中在展开后的执行区。
            </span>
          </div>
          <HarnessOperatorSection
            actorRole={props.actorRole}
            harnessController={props.harnessController}
            initialHarnessOverview={harnessOverview}
            initialHarnessScope={harnessScope}
            initialHarnessPreview={harnessPreview}
            layout="split"
            showScopeSummary={false}
            onStateChange={setOperatorSnapshot}
          />
        </section>
      ) : null}

      {advancedDetailsOpen ? (
        <section className="harness-control-advanced-panel">
          <div className="harness-control-section-heading">
            <p>高级详情</p>
            <h3>内部 ID 与支持信息</h3>
            <span>默认关闭，用于排查时复制给工程或运维。</span>
          </div>
          <dl className="harness-control-advanced-grid">
            <div>
              <dt>当前套件</dt>
              <dd>{props.overview.selectedSuiteId ?? "未选择"}</dd>
            </div>
            <div>
              <dt>当前运行</dt>
              <dd>{props.overview.selectedRunId ?? "未选择"}</dd>
            </div>
            <div>
              <dt>运行绑定</dt>
              <dd>{activeEnvironment?.runtime_binding.id ?? "未加载"}</dd>
            </div>
            <div>
              <dt>候选差异</dt>
              <dd>{describeCandidateDiff(harnessPreview)}</dd>
            </div>
          </dl>
        </section>
      ) : null}
    </section>
  );
}

export function formatHarnessModeHash(
  currentHash: string,
  mode: HarnessWorkbenchMode,
): string {
  const normalizedHash = currentHash.startsWith("#") ? currentHash.slice(1) : currentHash;
  const [, rawQuery = ""] = normalizedHash.split("?", 2);
  const params = new URLSearchParams(rawQuery);
  const manuscriptId = params.get("manuscriptId")?.trim();

  return formatWorkbenchHash("evaluation-workbench", {
    ...(manuscriptId && manuscriptId.length > 0 ? { manuscriptId } : {}),
    harnessMode: mode,
  });
}

function switchHarnessMode(
  mode: HarnessWorkbenchMode,
  setActiveMode: (mode: HarnessWorkbenchMode) => void,
) {
  setActiveMode(mode);

  if (typeof window === "undefined") {
    return;
  }

  const nextHash = formatHarnessModeHash(window.location.hash, mode);
  if (window.location.hash !== nextHash) {
    window.history.replaceState(null, "", nextHash);
  }
}

function ModeSettingsPanel(props: {
  mode: HarnessWorkbenchMode;
  overview: EvaluationWorkbenchOverview;
  harnessOverview: AdminGovernanceOverview | null;
  harnessScope: AdminHarnessScopeViewModel | null;
  harnessPreview: HarnessEnvironmentPreviewViewModel | null;
  datasetDraftCount: number;
  datasetPublishedCount: number;
  diagnosisManuscriptId: string;
  onDiagnosisManuscriptIdChange: (value: string) => void;
  onPrimaryAction: () => void;
}) {
  const selectedSuite =
    props.overview.suites.find((suite) => suite.id === props.overview.selectedSuiteId) ?? null;
  const selectedSampleSet =
    props.overview.sampleSets.find(
      (sampleSet) => sampleSet.id === props.overview.runs[0]?.sample_set_id,
    ) ?? props.overview.sampleSets[0] ??
    null;
  const modeConfig = harnessModeOptions.find((option) => option.mode === props.mode) ??
    harnessModeOptions[0];
  const activeEnvironment = props.harnessScope?.activeEnvironment ?? null;
  const workflowInput = createHarnessWorkflowInput({
    mode: props.mode,
    overview: props.overview,
    activeEnvironment,
    harnessPreview: props.harnessPreview,
    actorRole: "admin",
  });
  const primaryActionDisabled =
    props.mode === "single_manuscript_diagnosis" &&
    props.diagnosisManuscriptId.trim().length === 0;

  return (
    <section className="harness-control-panel">
      <div className="harness-control-section-heading">
        <p>{modeConfig.label}</p>
        <h3>设置</h3>
        <span>{modeConfig.summary}</span>
      </div>

      {props.mode === "single_manuscript_diagnosis" ? (
        <label className="harness-control-field">
          <span>稿件 ID</span>
          <input
            value={props.diagnosisManuscriptId}
            onChange={(event) => props.onDiagnosisManuscriptIdChange(event.target.value)}
            placeholder="输入 manuscript ID"
          />
        </label>
      ) : null}

      <dl className="harness-control-setting-list">
        <div>
          <dt>模块</dt>
          <dd>{formatModuleLabel(activeEnvironment?.execution_profile.module ?? selectedSuite?.module_scope?.[0] ?? "未选择")}</dd>
        </div>
        <div>
          <dt>稿件类型</dt>
          <dd>{formatManuscriptTypeLabel(activeEnvironment?.execution_profile.manuscript_type ?? "未选择")}</dd>
        </div>
        <div>
          <dt>评测套件</dt>
          <dd>{selectedSuite ? formatHarnessSurfaceName(selectedSuite.name) : "暂无套件"}</dd>
        </div>
        <div>
          <dt>验证样本集</dt>
          <dd>{selectedSampleSet ? selectedSampleSet.name : "暂无已连接样本集"}</dd>
        </div>
      </dl>

      {props.mode === "ab_acceptance" ? (
        <div className="harness-control-readiness">
          <strong>主差异检查</strong>
          <span>{describePrimaryDiffReadiness(props.harnessPreview)}</span>
        </div>
      ) : null}

      {props.mode === "validation_sample_sets" ? (
        <div className="harness-control-readiness">
          <strong>版本状态</strong>
          <span>
            草稿 {props.datasetDraftCount} 个，已发布 {props.datasetPublishedCount} 个。已发布版本只读。
          </span>
        </div>
      ) : null}

      {props.mode === "release_gate" ? (
        <div className="harness-control-readiness">
          <strong>发布门准备</strong>
          <span>{describeWorkflowReadiness(workflowInput)}</span>
        </div>
      ) : null}

      {props.mode === "regression_inspection" ? (
        <div className="harness-control-readiness">
          <strong>回归巡检准备</strong>
          <span>{describeWorkflowReadiness(workflowInput)}</span>
        </div>
      ) : null}

      <button
        type="button"
        className="harness-control-primary-action"
        data-harness-primary-action={props.mode}
        disabled={primaryActionDisabled}
        onClick={props.onPrimaryAction}
      >
        {modeConfig.primaryAction}
      </button>
    </section>
  );
}

function ModeResultsPanel(props: {
  mode: HarnessWorkbenchMode;
  overview: EvaluationWorkbenchOverview;
  selectedRun: EvaluationWorkbenchOverview["runs"][number] | null;
  selectedHistoryEntry: EvaluationWorkbenchFinalizedRunHistoryEntry | null;
  latestHistoryEntry: EvaluationWorkbenchFinalizedRunHistoryEntry | null;
  defaultComparison: EvaluationWorkbenchOverview["suiteOperations"]["defaultComparison"];
  historyFilter: HarnessHistoryFilter;
  historySortMode: HarnessHistorySortMode;
  selectedRunItemId: string | null;
  onSelectSuite: (suiteId: string) => void;
  onSelectRun: (runId: string) => void;
  onSelectRunItem: (runItemId: string) => void;
  onSelectHistoryWindow: (preset: EvaluationWorkbenchHistoryWindowPreset) => void;
  onSelectHistoryFilter: (filter: HarnessHistoryFilter) => void;
  onSelectHistorySortMode: (sortMode: HarnessHistorySortMode) => void;
  initialDatasetsOverview?: HarnessDatasetsWorkbenchOverview | null;
  diagnosisManuscriptId: string;
}) {
  const visibleHistory = sortHarnessHistory(
    filterHarnessHistory(props.overview.suiteOperations.visibleHistory, props.historyFilter),
    props.historySortMode,
  );

  if (props.mode === "validation_sample_sets") {
    return (
      <section className="evaluation-workbench-region evaluation-workbench-region-datasets is-emphasized harness-control-result-mode">
        <div className="harness-control-section-heading">
          <p>验证样本集</p>
          <h3>版本、冻结和导出</h3>
          <span>已发布版本只读；修改需要复制为新草稿版本后再发布。</span>
        </div>
        <HarnessDatasetsWorkbenchPage
          embedded
          initialOverview={props.initialDatasetsOverview}
        />
      </section>
    );
  }

  if (props.mode === "single_manuscript_diagnosis") {
    return (
      <section className="harness-control-result-mode">
        <HarnessMetricGrid
          metrics={[
            ["命中运行", props.overview.manuscriptContext?.matchedRunId ?? "未命中"],
            ["命中套件", props.overview.manuscriptContext?.matchedSuiteId ?? "默认套件"],
            ["历史命中", `${props.overview.manuscriptContext?.matchedHistoryRunIds.length ?? 0} 条`],
          ]}
        />
        <article className="harness-control-result-card">
          <h3>单稿诊断结果</h3>
          <p>
            {props.diagnosisManuscriptId.trim().length > 0
              ? `当前诊断稿件：${props.diagnosisManuscriptId.trim()}`
              : "请输入稿件 ID 后诊断。"}
          </p>
          <p>
            完整 hit/miss 归因、expected vs actual 和原因分类需要后续单稿诊断 API；当前先基于已有运行历史和样本上下文回查。
          </p>
        </article>
        <HistoryList
          entries={visibleHistory}
          selectedRunId={props.selectedRun?.id ?? null}
          onSelectRun={props.onSelectRun}
        />
      </section>
    );
  }

  if (props.mode === "release_gate") {
    return (
      <section className="harness-control-result-mode">
        <HarnessMetricGrid
          metrics={[
            ["发布配置", `${props.overview.releaseCheckProfiles.length} 个`],
            ["当前证据", props.selectedHistoryEntry ? "已定稿" : "未定稿"],
            ["建议状态", formatRecommendationStatus(props.selectedHistoryEntry?.finalized.recommendation.status ?? null)],
          ]}
        />
        <article className="harness-control-result-card">
          <h3>发布门摘要</h3>
          <p>{describeReleaseGateSummary(props.defaultComparison, props.selectedHistoryEntry)}</p>
          <p>
            发布门将基于所选发布配置生成证据包，结论进入运行历史后再决定是否激活。
          </p>
        </article>
        <HistoryList
          entries={visibleHistory}
          selectedRunId={props.selectedRun?.id ?? null}
          onSelectRun={props.onSelectRun}
        />
      </section>
    );
  }

  if (props.mode === "regression_inspection") {
    return (
      <section
        className="harness-control-result-mode"
        data-evaluation-comparison-state={props.defaultComparison != null ? "ready" : "unavailable"}
      >
        <HarnessMetricGrid
          metrics={[
            ["可见历史", `${props.overview.suiteOperations.visibleHistory.length} 条`],
            ["回归提及", `${props.overview.suiteOperations.signals.recurrence.regressionMentions} 次`],
            ["失败提及", `${props.overview.suiteOperations.signals.recurrence.failureMentions} 次`],
          ]}
        />
        <HistoryControls
          historyFilter={props.historyFilter}
          historySortMode={props.historySortMode}
          historyWindow={props.overview.suiteOperations.defaultWindow}
          onSelectHistoryFilter={props.onSelectHistoryFilter}
          onSelectHistorySortMode={props.onSelectHistorySortMode}
          onSelectHistoryWindow={props.onSelectHistoryWindow}
        />
        <SuiteList
          suites={props.overview.suites}
          selectedSuiteId={props.overview.selectedSuiteId}
          onSelectSuite={props.onSelectSuite}
        />
        <HistoryList
          entries={visibleHistory}
          selectedRunId={props.selectedRun?.id ?? null}
          onSelectRun={props.onSelectRun}
        />
      </section>
    );
  }

  return (
    <section className="harness-control-result-mode">
      <HarnessMetricGrid
        metrics={[
          ["命中/建议", formatRecommendationStatus(props.latestHistoryEntry?.finalized.recommendation.status ?? null)],
          ["证据完整度", describeEvidenceCompleteness(props.latestHistoryEntry)],
          ["硬门禁", formatSummaryStatus(props.latestHistoryEntry?.finalized.evidence_pack.summary_status ?? null)],
        ]}
      />
      <article className="harness-control-result-card">
        <h3>A/B 验收结果</h3>
        <p>{describeAbAcceptanceSummary(props.latestHistoryEntry, props.defaultComparison)}</p>
        <p>
          激活和回滚只在展开真实执行面板后出现，并继续走现有验证治理能力。
        </p>
      </article>
      <HistoryList
        entries={visibleHistory}
        selectedRunId={props.selectedRun?.id ?? null}
        onSelectRun={props.onSelectRun}
      />
    </section>
  );
}

function filterHarnessHistory(
  entries: readonly EvaluationWorkbenchFinalizedRunHistoryEntry[],
  filter: HarnessHistoryFilter,
) {
  if (filter === "all") {
    return entries;
  }

  return entries.filter((entry) => entry.finalized.recommendation.status === filter);
}

function sortHarnessHistory(
  entries: readonly EvaluationWorkbenchFinalizedRunHistoryEntry[],
  sortMode: HarnessHistorySortMode,
) {
  if (sortMode !== "failures_first") {
    return entries;
  }

  return [...entries].sort((left, right) => {
    const severityDelta =
      getHarnessRecommendationSeverity(left.finalized.recommendation.status) -
      getHarnessRecommendationSeverity(right.finalized.recommendation.status);
    if (severityDelta !== 0) {
      return severityDelta;
    }

    const leftTime = Date.parse(left.run.finished_at ?? left.run.started_at);
    const rightTime = Date.parse(right.run.finished_at ?? right.run.started_at);
    return rightTime - leftTime;
  });
}

function getHarnessRecommendationSeverity(
  status: EvaluationWorkbenchFinalizedRunHistoryEntry["finalized"]["recommendation"]["status"],
) {
  if (status === "rejected") return 0;
  if (status === "needs_review") return 1;
  return 2;
}

function SuiteList(props: {
  suites: EvaluationWorkbenchOverview["suites"];
  selectedSuiteId: string | null;
  onSelectSuite: (suiteId: string) => void;
}) {
  if (props.suites.length === 0) {
    return (
      <article className="harness-control-result-card">
        <h3>回归套件</h3>
        <p>暂无已配置回归套件。</p>
      </article>
    );
  }

  return (
    <article className="harness-control-result-card">
      <div className="harness-control-card-header">
        <h3>回归套件</h3>
        <span>{props.suites.length} 个</span>
      </div>
      <ul className="harness-control-history-list">
        {props.suites.map((suite) => (
          <li key={suite.id}>
            <button
              type="button"
              className={suite.id === props.selectedSuiteId ? "is-selected" : ""}
              data-evaluation-suite-id={suite.id}
              data-evaluation-suite-type={suite.suite_type}
              onClick={() => props.onSelectSuite(suite.id)}
            >
              <strong>{formatHarnessSurfaceName(suite.name)}</strong>
              <span>{formatSuiteTypeLabel(suite.suite_type)}</span>
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

function HarnessMetricGrid(props: { metrics: Array<[string, string]> }) {
  return (
    <div className="harness-control-metrics">
      {props.metrics.map(([label, value]) => (
        <article key={label} className="harness-control-metric">
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </div>
  );
}

function HistoryControls(props: {
  historyFilter: HarnessHistoryFilter;
  historySortMode: HarnessHistorySortMode;
  historyWindow: EvaluationWorkbenchHistoryWindowPreset;
  onSelectHistoryWindow: (preset: EvaluationWorkbenchHistoryWindowPreset) => void;
  onSelectHistoryFilter: (filter: HarnessHistoryFilter) => void;
  onSelectHistorySortMode: (sortMode: HarnessHistorySortMode) => void;
}) {
  return (
    <div className="harness-control-history-controls">
      <label>
        <span>时间窗口</span>
        <select
          value={props.historyWindow}
          onChange={(event) =>
            props.onSelectHistoryWindow(event.target.value as EvaluationWorkbenchHistoryWindowPreset)
          }
        >
          <option value="latest_10">最近 10 次</option>
          <option value="last_7_days">最近 7 天</option>
          <option value="last_30_days">最近 30 天</option>
          <option value="all_suite">全部套件历史</option>
        </select>
      </label>
      <label>
        <span>建议筛选</span>
        <select
          value={props.historyFilter}
          onChange={(event) => props.onSelectHistoryFilter(event.target.value as HarnessHistoryFilter)}
        >
          <option value="all">全部</option>
          <option value="recommended">可推荐</option>
          <option value="needs_review">待复核</option>
          <option value="rejected">已拒绝</option>
        </select>
      </label>
      <label>
        <span>排序</span>
        <select
          value={props.historySortMode}
          onChange={(event) => props.onSelectHistorySortMode(event.target.value as HarnessHistorySortMode)}
        >
          <option value="newest">最新优先</option>
          <option value="failures_first">失败优先</option>
        </select>
      </label>
    </div>
  );
}

function HistoryList(props: {
  entries: readonly EvaluationWorkbenchFinalizedRunHistoryEntry[];
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
}) {
  if (props.entries.length === 0) {
    return (
      <article className="harness-control-result-card">
        <h3>运行历史</h3>
        <p>当前范围还没有已定稿运行。运行一次验收后会在这里显示证据和建议。</p>
      </article>
    );
  }

  return (
    <article className="harness-control-result-card">
      <div className="harness-control-card-header">
        <h3>运行历史</h3>
        <span>{props.entries.length} 条</span>
      </div>
      <ul className="harness-control-history-list">
        {props.entries.map((entry) => (
          <li key={entry.run.id}>
            <button
              type="button"
              className={entry.run.id === props.selectedRunId ? "is-selected" : ""}
              onClick={() => props.onSelectRun(entry.run.id)}
            >
              <strong>{entry.run.id}</strong>
              <span>{formatRecommendationStatus(entry.finalized.recommendation.status)}</span>
              <small>{entry.finalized.recommendation.decision_reason}</small>
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function resolveInitialHarnessMode(
  section: WorkbenchHarnessSection,
): HarnessWorkbenchMode {
  if (section === "runs") return "regression_inspection";
  if (section === "datasets") return "validation_sample_sets";
  return "ab_acceptance";
}

function createInitialHarnessOperatorSnapshot(input: {
  initialHarnessOverview?: AdminGovernanceOverview | null;
  initialHarnessScope?: AdminHarnessScopeViewModel | null;
  initialHarnessPreview?: HarnessEnvironmentPreviewViewModel | null;
}): HarnessOperatorWorkspaceSnapshot {
  return {
    overview: input.initialHarnessOverview ?? null,
    scope: input.initialHarnessScope ?? null,
    preview: input.initialHarnessPreview ?? null,
    latestRun: null,
    statusMessage: null,
    errorMessage: null,
    isLoading: input.initialHarnessOverview == null,
    isMutating: false,
  };
}

function createHarnessWorkflowInput(input: {
  mode: HarnessWorkbenchMode;
  overview: EvaluationWorkbenchOverview;
  activeEnvironment: AdminHarnessScopeViewModel["activeEnvironment"] | null;
  harnessPreview: HarnessEnvironmentPreviewViewModel | null;
  actorRole: AuthRole;
}):
  | {
      kind: "ab_acceptance";
      input: Parameters<EvaluationWorkbenchController["runHarnessAbAcceptanceAndReload"]>[0];
    }
  | {
      kind: "regression_inspection";
      input: Parameters<EvaluationWorkbenchController["runHarnessActiveRegressionAndReload"]>[0];
    }
  | {
      kind: "release_gate";
      input: Parameters<EvaluationWorkbenchController["runHarnessReleaseGateAndReload"]>[0];
    }
  | {
      kind: "unavailable";
      reason: string;
    } {
  const selectedSuite =
    input.overview.suites.find((suite) => suite.id === input.overview.selectedSuiteId) ??
    null;
  const selectedSampleSet =
    input.overview.sampleSets.find(
      (sampleSet) => sampleSet.id === input.overview.runs[0]?.sample_set_id,
    ) ?? input.overview.sampleSets[0] ??
    null;

  if (selectedSuite == null) {
    return {
      kind: "unavailable",
      reason: "请先选择评测套件。",
    };
  }

  if (input.mode === "regression_inspection") {
    if (input.activeEnvironment == null) {
      return {
        kind: "unavailable",
        reason: "当前生效环境尚未加载，无法发起回归巡检。",
      };
    }

    return {
      kind: "regression_inspection",
      input: {
        actorRole: input.actorRole,
        suiteId: selectedSuite.id,
        sampleSetId: selectedSampleSet?.id,
        activeBinding: buildHarnessBinding(input.activeEnvironment, "candidate"),
      },
    };
  }

  if (input.mode === "ab_acceptance" || input.mode === "release_gate") {
    if (input.harnessPreview == null) {
      return {
        kind: "unavailable",
        reason: "请先生成候选预览，再运行 candidate vs active。",
      };
    }

    if (input.mode === "ab_acceptance") {
      return {
        kind: "ab_acceptance",
        input: {
          actorRole: input.actorRole,
          suiteId: selectedSuite.id,
          sampleSetId: selectedSampleSet?.id,
          activeBinding: buildHarnessBinding(
            input.harnessPreview.active_environment,
            "baseline",
          ),
          candidateBinding: buildHarnessBinding(
            input.harnessPreview.candidate_environment,
            "candidate",
          ),
        },
      };
    }

    const releaseProfile =
      input.overview.releaseCheckProfiles.find(
        (profile) => profile.status === "published",
      ) ?? input.overview.releaseCheckProfiles[0] ??
      null;
    if (releaseProfile == null) {
      return {
        kind: "unavailable",
        reason: "请先配置发布门配置。",
      };
    }

    return {
      kind: "release_gate",
      input: {
        actorRole: input.actorRole,
        suiteId: selectedSuite.id,
        sampleSetId: selectedSampleSet?.id,
        releaseCheckProfileId: releaseProfile.id,
        activeBinding: buildHarnessBinding(
          input.harnessPreview.active_environment,
          "baseline",
        ),
        candidateBinding: buildHarnessBinding(
          input.harnessPreview.candidate_environment,
          "candidate",
        ),
      },
    };
  }

  return {
    kind: "unavailable",
    reason: "当前模式不需要发起验证运行。",
  };
}

function describeWorkflowReadiness(
  workflowInput: ReturnType<typeof createHarnessWorkflowInput>,
) {
  if (workflowInput.kind === "unavailable") {
    return workflowInput.reason;
  }

  if (workflowInput.kind === "regression_inspection") {
    return "将使用当前生效环境作为单路候选绑定，生成回归巡检证据包。";
  }

  if (workflowInput.kind === "release_gate") {
    return "发布门将基于所选发布配置生成证据包，并保留候选与 Active 对照。";
  }

  return "将使用候选预览运行 candidate vs active，并把结果写入证据历史。";
}

function buildHarnessBinding(
  environment: AdminHarnessScopeViewModel["activeEnvironment"],
  lane: "baseline" | "candidate",
) {
  return {
    lane,
    executionProfileId: environment.execution_profile.id,
    runtimeBindingId: environment.runtime_binding.id,
    modelRoutingPolicyVersionId: environment.model_routing_policy_version.id,
    ...(environment.retrieval_preset
      ? { retrievalPresetId: environment.retrieval_preset.id }
      : {}),
    ...(environment.manual_review_policy
      ? { manualReviewPolicyId: environment.manual_review_policy.id }
      : {}),
    modelId: environment.model_routing_policy_version.primary_model_id,
    runtimeId: environment.runtime_binding.runtime_id,
    promptTemplateId: environment.execution_profile.prompt_template_id,
    skillPackageIds: [...environment.execution_profile.skill_package_ids],
    qualityPackageVersionIds: [
      ...(environment.runtime_binding.quality_package_version_ids ?? []),
    ],
    moduleTemplateId: environment.execution_profile.module_template_id,
  };
}

function resolveDefaultHarnessScopeProfile(
  harnessOverview: AdminGovernanceOverview,
  evaluationOverview: EvaluationWorkbenchOverview,
) {
  const selectedSuite =
    evaluationOverview.suites.find((suite) => suite.id === evaluationOverview.selectedSuiteId) ??
    evaluationOverview.suites[0] ??
    null;
  const preferredModules = selectedSuite?.module_scope ?? [];
  const profileForSelectedSuite =
    preferredModules.length > 0
      ? harnessOverview.executionProfiles.find(
          (profile) => profile.status === "active" && preferredModules.includes(profile.module),
        ) ??
        harnessOverview.executionProfiles.find((profile) =>
          preferredModules.includes(profile.module),
        )
      : null;

  return (
    profileForSelectedSuite ??
    harnessOverview.executionProfiles.find((profile) => profile.status === "active") ??
    harnessOverview.executionProfiles[0] ??
    null
  );
}

function describeActiveEnvironment(
  environment: AdminHarnessScopeViewModel["activeEnvironment"] | null,
) {
  if (environment == null) {
    return "尚未加载生效环境";
  }

  return `${formatModuleLabel(environment.execution_profile.module)} / ${formatManuscriptTypeLabel(
    environment.execution_profile.manuscript_type,
  )} / 质量包 ${environment.runtime_binding.quality_package_version_ids?.length ?? 0} 个`;
}

function describeCandidateDiff(preview: HarnessEnvironmentPreviewViewModel | null) {
  if (preview == null) {
    return "尚未生成候选预览";
  }

  if (preview.diff.changed_components.length === 0) {
    return "候选与 Active 没有主差异";
  }

  return `候选主差异：${preview.diff.changed_components
    .map(formatChangedComponentLabel)
    .join("、")}`;
}

function describePrimaryDiffReadiness(preview: HarnessEnvironmentPreviewViewModel | null) {
  if (preview == null) {
    return "尚未生成候选预览；展开真实执行面板后选择候选并点击预览。";
  }

  const diffCount = preview?.diff.changed_components.length ?? 0;

  if (diffCount === 1) {
    return "当前候选存在 1 处主差异，可以进入 A/B 验收。";
  }

  if (diffCount === 0) {
    return "当前候选与 Active 没有主差异，不能运行 A/B 验收。";
  }

  return `当前候选存在 ${diffCount} 处主差异，请收窄到一个候选变量后再验收。`;
}

function describeEvidenceCompleteness(
  entry: EvaluationWorkbenchFinalizedRunHistoryEntry | null,
) {
  if (entry == null) return "暂无证据";
  return entry.finalized.evidence.length > 0
    ? `${entry.finalized.evidence.length} 条证据`
    : "暂无证据";
}

function describeAbAcceptanceSummary(
  latestEntry: EvaluationWorkbenchFinalizedRunHistoryEntry | null,
  defaultComparison: EvaluationWorkbenchOverview["suiteOperations"]["defaultComparison"],
) {
  if (latestEntry == null) {
    return "当前范围还没有可用于 A/B 验收的已定稿运行。";
  }

  if (defaultComparison == null) {
    return `最近运行 ${latestEntry.run.id} 已定稿，但当前窗口还不足以形成 baseline 对照。`;
  }

  return `最近运行 ${defaultComparison.selected.run.id} 相对 baseline ${defaultComparison.baseline.run.id} 的建议为 ${formatRecommendationStatus(
    defaultComparison.selected.finalized.recommendation.status,
  )}。`;
}

function describeReleaseGateSummary(
  defaultComparison: EvaluationWorkbenchOverview["suiteOperations"]["defaultComparison"],
  selectedHistoryEntry: EvaluationWorkbenchFinalizedRunHistoryEntry | null,
) {
  if (selectedHistoryEntry == null) {
    return "所选运行需要先生成已定稿建议与证据包后，才能查看发布门摘要。";
  }

  if (defaultComparison == null) {
    return "当前历史窗口至少需要展示 2 条已定稿运行后，才能生成发布门摘要。";
  }

  return `当前运行 ${defaultComparison.selected.run.id} 相对基线 ${defaultComparison.baseline.run.id} 的结论为 ${formatRecommendationStatus(
    defaultComparison.selected.finalized.recommendation.status,
  )}。`;
}

function formatRecommendationStatus(value: string | null) {
  switch (value) {
    case "recommended":
      return "可推荐";
    case "needs_review":
      return "待复核";
    case "rejected":
      return "已拒绝";
    default:
      return "暂无建议";
  }
}

function formatSummaryStatus(value: string | null) {
  switch (value) {
    case "recommended":
      return "通过";
    case "needs_review":
      return "需复核";
    case "rejected":
      return "阻断";
    default:
      return "暂无";
  }
}

function formatModuleLabel(value: string) {
  switch (value) {
    case "screening":
      return "初筛";
    case "editing":
      return "编辑";
    case "proofreading":
      return "校对";
    default:
      return value;
  }
}

function formatManuscriptTypeLabel(value: string) {
  switch (value) {
    case "clinical_study":
      return "临床研究";
    case "review":
      return "综述";
    case "case_report":
      return "病例报告";
    case "meta_analysis":
      return "Meta 分析";
    case "guideline_interpretation":
      return "指南解读";
    default:
      return value;
  }
}

function formatChangedComponentLabel(component: string) {
  switch (component) {
    case "execution_profile":
      return "执行配置";
    case "runtime_binding":
      return "运行绑定";
    case "model_routing_policy_version":
      return "路由版本";
    case "retrieval_preset":
      return "检索预设";
    case "manual_review_policy":
      return "人工复核策略";
    default:
      return component;
  }
}

function formatSuiteTypeLabel(suiteType: string) {
  switch (suiteType) {
    case "module_regression_suite":
      return "模块回归套件";
    case "scope_regression_suite":
      return "范围回归套件";
    case "rule_family_regression_suite":
      return "规则族回归套件";
    case "governed_evaluation":
      return "治理评测套件";
    default:
      return suiteType;
  }
}

function toHarnessControlErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "验证治理当前生效范围加载失败。";
}
