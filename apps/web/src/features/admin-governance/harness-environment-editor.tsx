import type {
  AdminHarnessScopeViewModel,
  HarnessEnvironmentPreviewViewModel,
} from "./admin-governance-controller.ts";
import type { ModelRoutingPolicyVersionViewModel } from "../model-routing-governance/index.ts";
import type { ModuleExecutionProfileViewModel } from "../execution-governance/index.ts";
import type { ManuscriptType } from "../manuscripts/index.ts";
import type { RuntimeBindingViewModel } from "../runtime-bindings/index.ts";
import type { TemplateModule } from "../templates/index.ts";
import type {
  ManuscriptQualityPackageViewModel,
} from "../manuscript-quality-packages/index.ts";

export interface HarnessEnvironmentEditorProps {
  module: TemplateModule;
  manuscriptType: ManuscriptType;
  activeScope: AdminHarnessScopeViewModel | null;
  preview: HarnessEnvironmentPreviewViewModel | null;
  qualityPackages: readonly ManuscriptQualityPackageViewModel[];
  executionProfiles: readonly ModuleExecutionProfileViewModel[];
  runtimeBindings: readonly RuntimeBindingViewModel[];
  routingVersions: readonly ModelRoutingPolicyVersionViewModel[];
  selection: {
    executionProfileId: string;
    runtimeBindingId: string;
    modelRoutingPolicyVersionId: string;
    retrievalPresetId: string;
    manualReviewPolicyId: string;
  };
  onModuleChange: (module: TemplateModule) => void;
  onSelectionChange: (
    patch: Partial<HarnessEnvironmentEditorProps["selection"]>,
  ) => void;
  onPreview: () => void;
  isMutating: boolean;
}

export function HarnessEnvironmentEditor(
  props: HarnessEnvironmentEditorProps,
) {
  const activeEnvironment = props.activeScope?.activeEnvironment ?? null;

  return (
    <article className="admin-governance-panel admin-governance-panel-wide">
      <h3>Environment Editor</h3>
      <p className="admin-governance-empty">
        Tune the real governed environment for one scope, then preview the exact candidate bundle
        before it reaches activation.
      </p>

      <div className="admin-governance-form-grid">
        <label className="admin-governance-field">
          <span>Module</span>
          <select
            value={props.module}
            onChange={(event) =>
              props.onModuleChange(event.target.value as TemplateModule)
            }
            disabled={props.isMutating}
          >
            <option value="screening">screening</option>
            <option value="editing">editing</option>
            <option value="proofreading">proofreading</option>
          </select>
        </label>

        <label className="admin-governance-field">
          <span>Manuscript Type</span>
          <input type="text" value={props.manuscriptType} readOnly />
        </label>

        <label className="admin-governance-field">
          <span>Execution Profile</span>
          <select
            value={props.selection.executionProfileId}
            onChange={(event) =>
              props.onSelectionChange({ executionProfileId: event.target.value })
            }
            disabled={props.isMutating}
          >
            {props.executionProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.id}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-governance-field">
          <span>Runtime Binding</span>
          <select
            value={props.selection.runtimeBindingId}
            onChange={(event) =>
              props.onSelectionChange({ runtimeBindingId: event.target.value })
            }
            disabled={props.isMutating}
          >
            {props.runtimeBindings.map((binding) => (
              <option key={binding.id} value={binding.id}>
                {binding.id}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-governance-field">
          <span>Routing Version</span>
          <select
            value={props.selection.modelRoutingPolicyVersionId}
            onChange={(event) =>
              props.onSelectionChange({
                modelRoutingPolicyVersionId: event.target.value,
              })
            }
            disabled={props.isMutating}
          >
            {props.routingVersions.map((version) => (
              <option key={version.id} value={version.id}>
                {version.id}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-governance-field">
          <span>Retrieval Preset</span>
          <select
            value={props.selection.retrievalPresetId}
            onChange={(event) =>
              props.onSelectionChange({ retrievalPresetId: event.target.value })
            }
            disabled={props.isMutating}
          >
            {(props.activeScope?.retrievalPresets ?? []).map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name} ({preset.id})
              </option>
            ))}
          </select>
        </label>

        <label className="admin-governance-field">
          <span>Manual Review Policy</span>
          <select
            value={props.selection.manualReviewPolicyId}
            onChange={(event) =>
              props.onSelectionChange({ manualReviewPolicyId: event.target.value })
            }
            disabled={props.isMutating}
          >
            {(props.activeScope?.manualReviewPolicies ?? []).map((policy) => (
              <option key={policy.id} value={policy.id}>
                {policy.name} ({policy.id})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="auth-actions">
        <button
          type="button"
          className="auth-primary-action"
          onClick={props.onPreview}
          disabled={props.isMutating || activeEnvironment == null}
        >
          Preview Candidate Environment
        </button>
      </div>

      <div className="admin-governance-policy-grid">
        <HarnessEnvironmentCard
          title="Active Environment"
          summary={
            activeEnvironment == null
              ? "Loading active governed environment."
              : summarizeEnvironment(activeEnvironment)
          }
        />
        <HarnessEnvironmentCard
          title="Candidate Preview"
          summary={
            props.preview == null
              ? "Choose governed objects and preview the candidate bundle."
              : summarizeEnvironment(props.preview.candidate_environment)
          }
        />
        <HarnessEnvironmentCard
          title="Diff"
          summary={
            props.preview == null
              ? "No candidate diff yet."
              : props.preview.diff.changed_components.join(", ") || "No changes"
          }
        />
        <HarnessEnvironmentCard
          title="Active Quality Packages"
          summary={
            activeEnvironment == null
              ? "Loading active quality package refs."
              : formatQualityPackageSummary(
                  activeEnvironment.runtime_binding.quality_package_version_ids ?? [],
                  props.qualityPackages,
                )
          }
        />
        <HarnessEnvironmentCard
          title="Candidate Quality Packages"
          summary={
            props.preview == null
              ? "Preview a candidate to inspect bound package refs."
              : formatQualityPackageSummary(
                  props.preview.candidate_environment.runtime_binding
                    .quality_package_version_ids ?? [],
                  props.qualityPackages,
                )
          }
        />
      </div>
    </article>
  );
}

function HarnessEnvironmentCard(props: {
  title: string;
  summary: string;
}) {
  return (
    <article className="admin-governance-asset-row">
      <span>{props.title}</span>
      <small>{props.summary}</small>
    </article>
  );
}

function summarizeEnvironment(
  environment: NonNullable<HarnessEnvironmentEditorProps["activeScope"]>["activeEnvironment"],
) {
  return [
    `Execution Profile ${environment.execution_profile.id}`,
    `Runtime Binding ${environment.runtime_binding.id}`,
    `Routing ${environment.model_routing_policy_version.id}`,
    `Retrieval ${environment.retrieval_preset.id}`,
    `Manual Review ${environment.manual_review_policy.id}`,
  ].join(" | ");
}

function formatQualityPackageSummary(
  ids: readonly string[],
  packages: readonly ManuscriptQualityPackageViewModel[],
) {
  if (ids.length === 0) {
    return "none";
  }

  return ids
    .map((id) => {
      const record = packages.find((candidate) => candidate.id === id);
      return record ? `${record.package_name} v${record.version}` : id;
    })
    .join(" | ");
}
