import { useEffect, useMemo, useState } from "react";
import { formatWorkbenchHash } from "../../app/workbench-routing.ts";
import { createBrowserHttpClient, BrowserHttpClientError } from "../../lib/browser-http-client.ts";
import {
  createAdminGovernanceWorkbenchController,
  type AdminGovernanceOverview,
  type AdminGovernanceWorkbenchController,
  type AdminHarnessScopeViewModel,
  type HarnessEnvironmentPreviewViewModel,
} from "../admin-governance/admin-governance-controller.ts";
import { HarnessActivationGate } from "../admin-governance/harness-activation-gate.tsx";
import { HarnessEnvironmentEditor } from "../admin-governance/harness-environment-editor.tsx";
import { HarnessQualityLab } from "../admin-governance/harness-quality-lab.tsx";
import type { AuthRole } from "../auth/index.ts";
import type { WorkbenchHarnessSection } from "../auth/workbench.ts";
import type { ManuscriptType } from "../manuscripts/index.ts";
import type { TemplateModule } from "../templates/index.ts";
import { HarnessDatasetsWorkbenchPage } from "../harness-datasets/harness-datasets-workbench-page.tsx";
import type { HarnessDatasetsWorkbenchOverview } from "../harness-datasets/types.ts";
import type {
  ModuleExecutionProfileViewModel,
  ResolveExecutionBundlePreviewInput,
} from "../execution-governance/index.ts";
import type {
  EvaluationRunViewModel,
  FrozenExperimentBindingInput,
} from "../verification-ops/index.ts";

if (typeof document !== "undefined") {
  void import("../admin-governance/admin-governance-workbench.css");
}

const defaultHarnessController = createAdminGovernanceWorkbenchController(
  createBrowserHttpClient(),
);

interface HarnessScopeSelection {
  executionProfileId: string;
  runtimeBindingId: string;
  modelRoutingPolicyVersionId: string;
  retrievalPresetId: string;
  manualReviewPolicyId: string;
}

export interface HarnessOperatorSectionProps {
  actorRole?: AuthRole;
  section: WorkbenchHarnessSection;
  harnessController?: AdminGovernanceWorkbenchController;
  initialHarnessOverview?: AdminGovernanceOverview | null;
  initialHarnessScope?: AdminHarnessScopeViewModel | null;
  initialHarnessPreview?: HarnessEnvironmentPreviewViewModel | null;
  initialDatasetsOverview?: HarnessDatasetsWorkbenchOverview | null;
}

export function HarnessOperatorSection({
  actorRole = "admin",
  section,
  harnessController = defaultHarnessController,
  initialHarnessOverview = null,
  initialHarnessScope = null,
  initialHarnessPreview = null,
  initialDatasetsOverview = null,
}: HarnessOperatorSectionProps) {
  const [overview, setOverview] = useState<AdminGovernanceOverview | null>(initialHarnessOverview);
  const [scope, setScope] = useState<AdminHarnessScopeViewModel | null>(initialHarnessScope);
  const [preview, setPreview] = useState<HarnessEnvironmentPreviewViewModel | null>(
    initialHarnessPreview,
  );
  const [latestRun, setLatestRun] = useState<EvaluationRunViewModel | null>(null);
  const [isLoading, setIsLoading] = useState(initialHarnessOverview == null);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [operatorReason, setOperatorReason] = useState("");
  const [activeScopeKey, setActiveScopeKey] = useState<string | null>(
    () => resolveInitialScopeKey(initialHarnessOverview, initialHarnessScope),
  );
  const [selection, setSelection] = useState<HarnessScopeSelection>(
    () => resolveSelectionFromScope(initialHarnessScope),
  );
  const [selectedSuiteId, setSelectedSuiteId] = useState<string>(
    initialHarnessOverview?.evaluationSuites[0]?.id ?? "",
  );

  useEffect(() => {
    if (initialHarnessOverview != null) {
      return;
    }

    let disposed = false;
    setIsLoading(true);
    void harnessController
      .loadOverview()
      .then((nextOverview) => {
        if (disposed) {
          return;
        }
        setOverview(nextOverview);
        setSelectedSuiteId((current) => current || nextOverview.evaluationSuites[0]?.id || "");
        setActiveScopeKey((current) => current ?? resolveDefaultScopeKey(nextOverview));
        setIsLoading(false);
      })
      .catch((error) => {
        if (disposed) {
          return;
        }
        setErrorMessage(toErrorMessage(error));
        setIsLoading(false);
      });

    return () => {
      disposed = true;
    };
  }, [harnessController, initialHarnessOverview]);

  const scopeProfile = useMemo(
    () => resolveScopeProfile(overview, activeScopeKey),
    [overview, activeScopeKey],
  );
  const scopedExecutionProfiles = useMemo(
    () => filterExecutionProfilesForScope(overview, scopeProfile),
    [overview, scopeProfile],
  );
  const scopedRuntimeBindings = useMemo(
    () => filterRuntimeBindingsForScope(overview, scopeProfile),
    [overview, scopeProfile],
  );
  const scopedEvaluationSuites = useMemo(
    () => filterEvaluationSuitesForScope(overview, scopeProfile),
    [overview, scopeProfile],
  );
  const routingVersions = useMemo(
    () => filterRoutingVersionsForScope(overview, scopeProfile),
    [overview, scopeProfile],
  );

  useEffect(() => {
    if (scopeProfile == null) {
      return;
    }

    if (
      scope?.activeEnvironment.execution_profile.module === scopeProfile.module &&
      scope.activeEnvironment.execution_profile.manuscript_type === scopeProfile.manuscript_type &&
      scope.activeEnvironment.execution_profile.template_family_id === scopeProfile.template_family_id
    ) {
      return;
    }

    let disposed = false;
    setErrorMessage(null);
    void harnessController
      .loadHarnessScope({
        module: scopeProfile.module,
        manuscriptType: scopeProfile.manuscript_type,
        templateFamilyId: scopeProfile.template_family_id,
      })
      .then((nextScope) => {
        if (disposed) {
          return;
        }
        setScope(nextScope);
        setSelection(resolveSelectionFromScope(nextScope));
      })
      .catch((error) => {
        if (disposed) {
          return;
        }
        setErrorMessage(toErrorMessage(error));
      });

    return () => {
      disposed = true;
    };
  }, [harnessController, scopeProfile]);

  useEffect(() => {
    if (scopedEvaluationSuites.length === 0) {
      return;
    }

    if (scopedEvaluationSuites.some((suite) => suite.id === selectedSuiteId)) {
      return;
    }

    setSelectedSuiteId(scopedEvaluationSuites[0]?.id ?? "");
  }, [scopedEvaluationSuites, selectedSuiteId]);

  function handleModuleChange(nextModule: TemplateModule) {
    const matchingProfile =
      overview?.executionProfiles.find((profile) => profile.module === nextModule) ?? null;
    if (matchingProfile == null) {
      setErrorMessage("当前模块还没有可用的 Harness 作用域。");
      return;
    }

    setPreview(null);
    setErrorMessage(null);
    setStatusMessage(null);
    setActiveScopeKey(buildScopeKey(matchingProfile));
  }

  function handleSelectionChange(patch: Partial<HarnessScopeSelection>) {
    setSelection((current) => ({ ...current, ...patch }));
    setPreview(null);
    setStatusMessage(null);
  }

  async function handlePreview() {
    if (scopeProfile == null) {
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const nextPreview = await harnessController.previewHarnessEnvironment(
        buildPreviewInput(scopeProfile, selection),
      );
      setPreview(nextPreview);
      setStatusMessage("候选环境预览已更新。");
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleLaunch() {
    if (preview == null || selectedSuiteId.trim().length === 0) {
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const createdRun = await harnessController.createHarnessRun({
        actorRole,
        suiteId: selectedSuiteId,
        candidateBinding: buildFrozenBinding(preview.candidate_environment, "candidate"),
        baselineBinding: buildFrozenBinding(preview.active_environment, "baseline"),
        releaseCheckProfileId:
          preview.candidate_environment.runtime_binding.release_check_profile_id,
      });
      setLatestRun(createdRun);
      setStatusMessage(`已创建候选运行 ${createdRun.id}。`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleActivate() {
    if (scopeProfile == null) {
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const nextEnvironment = await harnessController.activateHarnessEnvironment({
        actorRole,
        module: scopeProfile.module,
        manuscriptType: scopeProfile.manuscript_type,
        templateFamilyId: scopeProfile.template_family_id,
        executionProfileId: selection.executionProfileId,
        runtimeBindingId: selection.runtimeBindingId,
        modelRoutingPolicyVersionId: selection.modelRoutingPolicyVersionId,
        retrievalPresetId: selection.retrievalPresetId,
        manualReviewPolicyId: selection.manualReviewPolicyId,
        reason: operatorReason.trim() || undefined,
      });
      const nextScope = {
        activeEnvironment: nextEnvironment,
        retrievalPresets: scope?.retrievalPresets ?? [],
        manualReviewPolicies: scope?.manualReviewPolicies ?? [],
      };
      setScope(nextScope);
      setSelection(resolveSelectionFromScope(nextScope));
      setPreview(null);
      setStatusMessage("候选环境已激活到当前 Harness 作用域。");
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleRollback() {
    if (scopeProfile == null) {
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const nextEnvironment = await harnessController.rollbackHarnessEnvironment({
        actorRole,
        module: scopeProfile.module,
        manuscriptType: scopeProfile.manuscript_type,
        templateFamilyId: scopeProfile.template_family_id,
        reason: operatorReason.trim() || undefined,
      });
      const nextScope = {
        activeEnvironment: nextEnvironment,
        retrievalPresets: scope?.retrievalPresets ?? [],
        manualReviewPolicies: scope?.manualReviewPolicies ?? [],
      };
      setScope(nextScope);
      setSelection(resolveSelectionFromScope(nextScope));
      setPreview(null);
      setStatusMessage("当前 Harness 作用域已回滚。");
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <>
      <section className="evaluation-workbench-panel evaluation-workbench-harness-shell">
        <div className="evaluation-workbench-panel-header">
          <h3>Harness 内部视图</h3>
          <span>控制区、运行和数据入口仍然属于同一个 Harness 页面。</span>
        </div>
        <nav className="evaluation-workbench-harness-nav" aria-label="Harness 内部视图">
          <a
            className={buildHarnessNavLinkClassName(section === "overview")}
            href={formatWorkbenchHash("evaluation-workbench", { harnessSection: "overview" })}
          >
            总览
          </a>
          <a
            className={buildHarnessNavLinkClassName(section === "runs")}
            href={formatWorkbenchHash("evaluation-workbench", { harnessSection: "runs" })}
          >
            运行记录
          </a>
          <a
            className={buildHarnessNavLinkClassName(section === "datasets")}
            href={formatWorkbenchHash("evaluation-workbench", { harnessSection: "datasets" })}
          >
            数据与样本
          </a>
        </nav>
        {statusMessage ? <p className="evaluation-workbench-status">{statusMessage}</p> : null}
        {errorMessage ? <p className="evaluation-workbench-error">{errorMessage}</p> : null}
        {section === "datasets" ? (
          <HarnessDatasetsWorkbenchPage
            embedded
            initialOverview={initialDatasetsOverview}
          />
        ) : (
          <article className="evaluation-workbench-harness-datasets-entry">
            <strong>数据与样本</strong>
            <p className="evaluation-workbench-harness-copy">
              数据集入口仍然收口在 Harness 内部。需要整理金标准、核对发布版本或导出本地数据时，
              直接从这里进入，不再跳去一个独立产品。
            </p>
            <div className="evaluation-workbench-history-compare">
              <span>
                {initialDatasetsOverview
                  ? `草稿 ${initialDatasetsOverview.draftVersions.length} 个`
                  : "可查看草稿队列"}
              </span>
              <span>
                {initialDatasetsOverview
                  ? `已发布 ${initialDatasetsOverview.publishedVersions.length} 个`
                  : "可查看已发布版本"}
              </span>
            </div>
            <a
              className="workbench-secondary-action"
              href={formatWorkbenchHash("evaluation-workbench", { harnessSection: "datasets" })}
            >
              打开数据与样本
            </a>
          </article>
        )}
      </section>

      <section className="evaluation-workbench-harness-grid">
        {overview == null && isLoading ? (
          <article className="evaluation-workbench-panel">
            <div className="evaluation-workbench-panel-header">
              <h3>Harness 控制区</h3>
              <span>正在加载</span>
            </div>
            <p className="evaluation-workbench-empty">正在加载真实控制区与作用域配置...</p>
          </article>
        ) : (
          <>
            <HarnessEnvironmentEditor
              module={scopeProfile?.module ?? "editing"}
              manuscriptType={scopeProfile?.manuscript_type ?? "clinical_study"}
              activeScope={scope}
              preview={preview}
              qualityPackages={overview?.qualityPackages ?? []}
              executionProfiles={scopedExecutionProfiles}
              runtimeBindings={scopedRuntimeBindings}
              routingVersions={routingVersions}
              selection={selection}
              onModuleChange={handleModuleChange}
              onSelectionChange={handleSelectionChange}
              onPreview={() => void handlePreview()}
              isMutating={isMutating}
            />
            <HarnessQualityLab
              evaluationSuites={scopedEvaluationSuites}
              selectedSuiteId={selectedSuiteId}
              preview={preview}
              latestRun={latestRun}
              onSuiteChange={setSelectedSuiteId}
              onLaunch={() => void handleLaunch()}
              isMutating={isMutating}
            />
            <HarnessActivationGate
              preview={preview}
              reason={operatorReason}
              onReasonChange={setOperatorReason}
              onActivate={() => void handleActivate()}
              onRollback={() => void handleRollback()}
              isMutating={isMutating}
            />
          </>
        )}
      </section>
    </>
  );
}

function resolveInitialScopeKey(
  overview: AdminGovernanceOverview | null,
  scope: AdminHarnessScopeViewModel | null,
) {
  if (scope != null) {
    return buildScopeKey(scope.activeEnvironment.execution_profile);
  }

  return resolveDefaultScopeKey(overview);
}

function resolveDefaultScopeKey(overview: AdminGovernanceOverview | null) {
  const preferredProfile =
    overview?.executionProfiles.find((profile) => profile.status === "active") ??
    overview?.executionProfiles[0] ??
    null;

  return preferredProfile ? buildScopeKey(preferredProfile) : null;
}

function resolveScopeProfile(
  overview: AdminGovernanceOverview | null,
  scopeKey: string | null,
) {
  if (overview == null || scopeKey == null) {
    return null;
  }

  return overview.executionProfiles.find((profile) => buildScopeKey(profile) === scopeKey) ?? null;
}

function buildScopeKey(profile: ModuleExecutionProfileViewModel) {
  return `${profile.module}::${profile.manuscript_type}::${profile.template_family_id}`;
}

function resolveSelectionFromScope(
  scope: AdminHarnessScopeViewModel | null,
): HarnessScopeSelection {
  return {
    executionProfileId: scope?.activeEnvironment.execution_profile.id ?? "",
    runtimeBindingId: scope?.activeEnvironment.runtime_binding.id ?? "",
    modelRoutingPolicyVersionId: scope?.activeEnvironment.model_routing_policy_version.id ?? "",
    retrievalPresetId: scope?.activeEnvironment.retrieval_preset.id ?? "",
    manualReviewPolicyId: scope?.activeEnvironment.manual_review_policy.id ?? "",
  };
}

function filterExecutionProfilesForScope(
  overview: AdminGovernanceOverview | null,
  scopeProfile: ModuleExecutionProfileViewModel | null,
) {
  if (overview == null) {
    return [];
  }

  if (scopeProfile == null) {
    return overview.executionProfiles;
  }

  return overview.executionProfiles.filter(
    (profile) =>
      profile.module === scopeProfile.module &&
      profile.manuscript_type === scopeProfile.manuscript_type &&
      profile.template_family_id === scopeProfile.template_family_id,
  );
}

function filterRuntimeBindingsForScope(
  overview: AdminGovernanceOverview | null,
  scopeProfile: ModuleExecutionProfileViewModel | null,
) {
  if (overview == null) {
    return [];
  }

  if (scopeProfile == null) {
    return overview.runtimeBindings;
  }

  return overview.runtimeBindings.filter(
    (binding) =>
      binding.module === scopeProfile.module &&
      binding.manuscript_type === scopeProfile.manuscript_type &&
      binding.template_family_id === scopeProfile.template_family_id,
  );
}

function filterEvaluationSuitesForScope(
  overview: AdminGovernanceOverview | null,
  scopeProfile: ModuleExecutionProfileViewModel | null,
) {
  if (overview == null) {
    return [];
  }

  if (scopeProfile == null) {
    return overview.evaluationSuites;
  }

  return overview.evaluationSuites.filter((suite) =>
    suite.module_scope.includes(scopeProfile.module),
  );
}

function filterRoutingVersionsForScope(
  overview: AdminGovernanceOverview | null,
  scopeProfile: ModuleExecutionProfileViewModel | null,
) {
  const versions = overview?.routingPolicies.flatMap((policy) => policy.versions) ?? [];
  if (scopeProfile == null) {
    return versions;
  }

  return versions.filter((version) => {
    if (version.scope_kind === "module") {
      return version.scope_value === scopeProfile.module;
    }

    return version.scope_value === scopeProfile.template_family_id;
  });
}

function buildPreviewInput(
  profile: ModuleExecutionProfileViewModel,
  selection: HarnessScopeSelection,
): ResolveExecutionBundlePreviewInput {
  return {
    module: profile.module,
    manuscriptType: profile.manuscript_type,
    templateFamilyId: profile.template_family_id,
    executionProfileId: selection.executionProfileId || undefined,
    runtimeBindingId: selection.runtimeBindingId || undefined,
    modelRoutingPolicyVersionId: selection.modelRoutingPolicyVersionId || undefined,
    retrievalPresetId: selection.retrievalPresetId || undefined,
    manualReviewPolicyId: selection.manualReviewPolicyId || undefined,
  };
}

function buildFrozenBinding(
  environment: NonNullable<HarnessEnvironmentPreviewViewModel>["candidate_environment"],
  lane: FrozenExperimentBindingInput["lane"],
): FrozenExperimentBindingInput {
  return {
    lane,
    executionProfileId: environment.execution_profile.id,
    runtimeBindingId: environment.runtime_binding.id,
    modelRoutingPolicyVersionId: environment.model_routing_policy_version.id,
    retrievalPresetId: environment.retrieval_preset.id,
    manualReviewPolicyId: environment.manual_review_policy.id,
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

function buildHarnessNavLinkClassName(isActive: boolean) {
  return `evaluation-workbench-harness-nav-link${isActive ? " is-active" : ""}`;
}

function toErrorMessage(error: unknown) {
  if (error instanceof BrowserHttpClientError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "暂时无法更新 Harness 控制区。";
}
