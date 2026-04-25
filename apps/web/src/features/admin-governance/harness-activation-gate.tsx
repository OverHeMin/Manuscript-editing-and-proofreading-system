import type { HarnessEnvironmentPreviewViewModel } from "./admin-governance-controller.ts";

export interface HarnessActivationGateProps {
  preview: HarnessEnvironmentPreviewViewModel | null;
  reason: string;
  onReasonChange: (reason: string) => void;
  onActivate: () => void;
  onRollback: () => void;
  isMutating: boolean;
}

export function HarnessActivationGate(props: HarnessActivationGateProps) {
  return (
    <article className="admin-governance-panel">
      <h3>激活与回滚</h3>
      <p className="admin-governance-empty">
        激活和回滚必须通过这里完成，确保 Harness 改变的是真实生效环境，而不是脱离后端的界面状态。
      </p>

      <div className="admin-governance-policy-grid">
        <article className="admin-governance-asset-row">
          <span>变更组件</span>
          <small>
            {props.preview?.diff.changed_components.join("、") ?? "请先预览候选环境以查看差异"}
          </small>
        </article>
        <article className="admin-governance-asset-row">
          <span>激活目标</span>
          <small>
            {props.preview?.candidate_environment.execution_profile.id ??
              "尚未选择候选环境"}
          </small>
        </article>
      </div>

      <label className="admin-governance-field">
        <span>操作原因</span>
        <textarea
          rows={3}
          value={props.reason}
          onChange={(event) => props.onReasonChange(event.target.value)}
          disabled={props.isMutating}
        />
      </label>

      <div className="auth-actions">
        <button
          type="button"
          className="auth-primary-action"
          onClick={props.onActivate}
          disabled={props.isMutating || props.preview == null}
        >
          激活候选环境
        </button>
        <button
          type="button"
          className="workbench-secondary-action"
          onClick={props.onRollback}
          disabled={props.isMutating}
        >
          回滚当前范围
        </button>
      </div>
    </article>
  );
}
