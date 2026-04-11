import type { EvaluationRunViewModel, EvaluationSuiteViewModel } from "../verification-ops/index.ts";
import type { HarnessEnvironmentPreviewViewModel } from "./admin-governance-controller.ts";

export interface HarnessQualityLabProps {
  evaluationSuites: readonly EvaluationSuiteViewModel[];
  selectedSuiteId: string;
  preview: HarnessEnvironmentPreviewViewModel | null;
  latestRun: EvaluationRunViewModel | null;
  onSuiteChange: (suiteId: string) => void;
  onLaunch: () => void;
  isMutating: boolean;
}

export function HarnessQualityLab(props: HarnessQualityLabProps) {
  return (
    <article className="admin-governance-panel">
      <h3>Quality Lab</h3>
      <p className="admin-governance-empty">
        Launch a candidate-bound verification run from the same control plane so the quality
        evidence is tied to the exact environment you are about to activate.
      </p>

      <label className="admin-governance-field">
        <span>Evaluation Suite</span>
        <select
          value={props.selectedSuiteId}
          onChange={(event) => props.onSuiteChange(event.target.value)}
          disabled={props.isMutating}
        >
          <option value="">Select suite</option>
          {props.evaluationSuites.map((suite) => (
            <option key={suite.id} value={suite.id}>
              {suite.name} ({suite.id})
            </option>
          ))}
        </select>
      </label>

      <div className="admin-governance-policy-grid">
        <article className="admin-governance-asset-row">
          <span>Candidate Bundle</span>
          <small>
            {props.preview
              ? props.preview.candidate_environment.execution_profile.id
              : "Preview a candidate first"}
          </small>
        </article>
        <article className="admin-governance-asset-row">
          <span>Latest Candidate Run</span>
          <small>
            {props.latestRun
              ? `${props.latestRun.id} · ${props.latestRun.status}`
              : "No candidate-bound run launched yet"}
          </small>
        </article>
      </div>

      <div className="auth-actions">
        <button
          type="button"
          className="auth-primary-action"
          onClick={props.onLaunch}
          disabled={
            props.isMutating ||
            props.preview == null ||
            props.selectedSuiteId.trim().length === 0
          }
        >
          Launch Candidate Run
        </button>
      </div>
    </article>
  );
}
