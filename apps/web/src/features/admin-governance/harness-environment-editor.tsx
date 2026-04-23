import type {
  AdminHarnessScopeViewModel,
  HarnessEnvironmentPreviewViewModel,
} from "./admin-governance-controller.ts";
import type { ModelRoutingPolicyVersionViewModel } from "../model-routing-governance/index.ts";
import type { ModuleExecutionProfileViewModel } from "../execution-governance/index.ts";
import type { ManuscriptType } from "../manuscripts/index.ts";
import type { RuntimeBindingViewModel } from "../runtime-bindings/index.ts";
import { formatEditorialManuscriptTypeLabel } from "../shared/editorial-taxonomy.ts";
import type { TemplateModule } from "../templates/index.ts";
import type {
  ManuscriptQualityPackageViewModel,
} from "../manuscript-quality-packages/index.ts";

export interface HarnessEnvironmentEditorProps {
  module: TemplateModule;
  manuscriptType: ManuscriptType;
  availableManuscriptTypes: readonly ManuscriptType[];
  templateFamilyName: string | null;
  templateFamilyId: string | null;
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
  onManuscriptTypeChange: (manuscriptType: ManuscriptType) => void;
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
      <h3>环境编辑</h3>
      <p className="admin-governance-empty">
        在当前范围内调整真实治理环境，并在激活前预览确切的候选组合。
      </p>

      <div className="admin-governance-form-grid">
        <label className="admin-governance-field">
          <span>模块</span>
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
          <span>稿件类型</span>
          <select
            value={props.manuscriptType}
            onChange={(event) =>
              props.onManuscriptTypeChange(event.target.value as ManuscriptType)
            }
            disabled={props.isMutating || props.availableManuscriptTypes.length === 0}
          >
            {props.availableManuscriptTypes.map((manuscriptType) => (
              <option key={manuscriptType} value={manuscriptType}>
                {formatEditorialManuscriptTypeLabel(manuscriptType)} ({manuscriptType})
              </option>
            ))}
          </select>
        </label>

        <label className="admin-governance-field">
          <span>模板族</span>
          <input
            type="text"
            value={
              props.templateFamilyId == null
                ? "尚未解析范围"
                : props.templateFamilyName
                  ? `${props.templateFamilyName} (${props.templateFamilyId})`
                  : props.templateFamilyId
            }
            readOnly
          />
        </label>

        <label className="admin-governance-field">
          <span>执行配置</span>
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
          <span>运行绑定</span>
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
          <span>路由版本</span>
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
          <span>检索预设</span>
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
          <span>人工复核策略</span>
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
          预览候选环境
        </button>
      </div>

      <div className="admin-governance-policy-grid">
        <HarnessEnvironmentCard
          title="当前生效环境"
          summary={
            activeEnvironment == null
              ? "正在加载当前治理环境。"
              : summarizeEnvironment(activeEnvironment)
          }
        />
        <HarnessEnvironmentCard
          title="候选预览"
          summary={
            props.preview == null
              ? "请选择治理对象并预览候选组合。"
              : summarizeEnvironment(props.preview.candidate_environment)
          }
        />
        <HarnessEnvironmentCard
          title="变更差异"
          summary={
            props.preview == null
              ? "尚未生成候选差异。"
              : props.preview.diff.changed_components.join("、") || "无变化"
          }
        />
        <HarnessEnvironmentCard
          title="当前质量包"
          summary={
            activeEnvironment == null
              ? "正在加载当前质量包引用。"
              : formatQualityPackageSummary(
                  activeEnvironment.runtime_binding.quality_package_version_ids ?? [],
                  props.qualityPackages,
                )
          }
        />
        <HarnessEnvironmentCard
          title="候选质量包"
          summary={
            props.preview == null
              ? "先预览候选环境再查看绑定质量包。"
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
    `执行配置 ${environment.execution_profile.id}`,
    `运行绑定 ${environment.runtime_binding.id}`,
    `路由 ${environment.model_routing_policy_version.id}`,
    `检索 ${environment.retrieval_preset.id}`,
    `复核 ${environment.manual_review_policy.id}`,
  ].join(" | ");
}

function formatQualityPackageSummary(
  ids: readonly string[],
  packages: readonly ManuscriptQualityPackageViewModel[],
) {
  if (ids.length === 0) {
    return "无";
  }

  return ids
    .map((id) => {
      const record = packages.find((candidate) => candidate.id === id);
      return record ? `${record.package_name} v${record.version}` : id;
    })
    .join(" | ");
}
