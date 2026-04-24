import type { EvaluationRunViewModel, EvaluationSuiteViewModel } from "../verification-ops/index.ts";
import type { HarnessEnvironmentPreviewViewModel } from "./admin-governance-controller.ts";
import {
  formatHarnessStatusLabel,
  formatHarnessSurfaceName,
} from "./harness-surface-copy.ts";

export interface HarnessQualityLabProps {
  evaluationSuites: readonly EvaluationSuiteViewModel[];
  selectedSuiteId: string;
  selectedSuite: EvaluationSuiteViewModel | null;
  preview: HarnessEnvironmentPreviewViewModel | null;
  latestRun: EvaluationRunViewModel | null;
  canLaunch: boolean;
  launchGuidance: string | null;
  onSuiteChange: (suiteId: string) => void;
  onLaunch: () => void;
  isMutating: boolean;
}

export function HarnessQualityLab(props: HarnessQualityLabProps) {
  return (
    <article className="admin-governance-panel">
      <h3>验证实验区</h3>
      <p className="admin-governance-empty">
        从同一控制链路发起绑定候选环境的验证运行，确保质量证据对应的就是将要激活的那套环境。
      </p>

      <label className="admin-governance-field">
        <span>评测套件</span>
        <select
          value={props.selectedSuiteId}
          onChange={(event) => props.onSuiteChange(event.target.value)}
          disabled={props.isMutating}
        >
          <option value="">请选择套件</option>
          {props.evaluationSuites.map((suite) => (
            <option key={suite.id} value={suite.id}>
              {formatHarnessSurfaceName(suite.name)} ({suite.id})
            </option>
          ))}
        </select>
      </label>

      <div className="admin-governance-policy-grid">
        <article className="admin-governance-asset-row">
          <span>候选组合</span>
          <small>
            {props.preview
              ? props.preview.candidate_environment.execution_profile.id
              : "请先预览候选环境"}
          </small>
        </article>
        <article className="admin-governance-asset-row">
          <span>最近候选运行</span>
          <small>
            {props.latestRun
              ? `${props.latestRun.id} · ${formatHarnessStatusLabel(props.latestRun.status)}`
              : "尚未发起候选运行"}
          </small>
        </article>
      </div>

      {props.selectedSuite ? (
        <p className="admin-governance-empty">
          当前套件：{formatHarnessSurfaceName(props.selectedSuite.name)}
          {props.selectedSuite.supports_ab_comparison
            ? "，要求候选与基线恰好存在 1 处主差异。"
            : "，当前按非 A/B 方式执行验证。"}
        </p>
      ) : null}
      {props.launchGuidance ? (
        <p className="admin-governance-empty">{props.launchGuidance}</p>
      ) : null}

      <div className="auth-actions">
        <button
          type="button"
          className="auth-primary-action"
          onClick={props.onLaunch}
          disabled={
            props.isMutating ||
            props.preview == null ||
            props.selectedSuiteId.trim().length === 0 ||
            !props.canLaunch
          }
        >
          发起候选验证
        </button>
      </div>
    </article>
  );
}
