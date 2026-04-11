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
      <h3>Activation Gate</h3>
      <p className="admin-governance-empty">
        Promotion and rollback stay here so Harness changes the live environment through governed
        activation, not through detached UI-only state.
      </p>

      <div className="admin-governance-policy-grid">
        <article className="admin-governance-asset-row">
          <span>Changed Components</span>
          <small>
            {props.preview?.diff.changed_components.join(", ") ?? "Preview candidate to inspect diffs"}
          </small>
        </article>
        <article className="admin-governance-asset-row">
          <span>Promotion Target</span>
          <small>
            {props.preview?.candidate_environment.execution_profile.id ??
              "No candidate selected"}
          </small>
        </article>
      </div>

      <label className="admin-governance-field">
        <span>Operator Reason</span>
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
          Activate Candidate Environment
        </button>
        <button
          type="button"
          className="workbench-secondary-action"
          onClick={props.onRollback}
          disabled={props.isMutating}
        >
          Roll Back Scope
        </button>
      </div>
    </article>
  );
}
