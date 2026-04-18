import { useEffect, useMemo, useState } from "react";
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
import type { ManuscriptType } from "../manuscripts/index.ts";
import type { TemplateModule } from "../templates/index.ts";
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
  harnessController?: AdminGovernanceWorkbenchController;
  initialHarnessOverview?: AdminGovernanceOverview | null;
  initialHarnessScope?: AdminHarnessScopeViewModel | null;
  initialHarnessPreview?: HarnessEnvironmentPreviewViewModel | null;
}

export function HarnessOperatorSection({
  actorRole = "admin",
  harnessController = defaultHarnessController,
  initialHarnessOverview = null,
  initialHarnessScope = null,
  initialHarnessPreview = null,
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
  const availableManuscriptTypes = useMemo(
    () => resolveManuscriptTypesForModule(overview, scopeProfile?.module ?? null),
    [overview, scopeProfile],
  );
  const activeTemplateFamily = useMemo(
    () => resolveTemplateFamily(overview, scopeProfile),
    [overview, scopeProfile],
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
  }, [harnessController, scope, scopeProfile]);

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
    const nextManuscriptTypes = resolveManuscriptTypesForModule(overview, nextModule);
    const preferredManuscriptType =
      scopeProfile && nextManuscriptTypes.includes(scopeProfile.manuscript_type)
        ? scopeProfile.manuscript_type
        : nextManuscriptTypes[0] ?? null;

    if (preferredManuscriptType == null) {
      setErrorMessage("No Harness scope is configured for the selected module.");
      return;
    }

    selectScope(nextModule, preferredManuscriptType);
  }

  function handleManuscriptTypeChange(nextManuscriptType: ManuscriptType) {
    const activeModule = scopeProfile?.module ?? overview?.executionProfiles[0]?.module ?? null;
    if (activeModule == null) {
      setErrorMessage("No Harness scope is configured yet.");
      return;
    }

    selectScope(activeModule, nextManuscriptType);
  }

  function handleSelectionChange(patch: Partial<HarnessScopeSelection>) {
    setSelection((current) => ({ ...current, ...patch }));
    setPreview(null);
    setStatusMessage(null);
  }

  function selectScope(module: TemplateModule, manuscriptType: ManuscriptType) {
    const nextProfile = resolvePreferredScopeProfile(overview, {
      module,
      manuscriptType,
      preferredTemplateFamilyId: scopeProfile?.template_family_id ?? null,
    });
    if (nextProfile == null) {
      setErrorMessage("No Harness scope is configured for the selected module and manuscript type.");
      return;
    }

    setPreview(null);
    setErrorMessage(null);
    setStatusMessage(null);
    setActiveScopeKey(buildScopeKey(nextProfile));
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
      setStatusMessage("Candidate environment preview refreshed.");
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
      setStatusMessage(`Created candidate run ${createdRun.id}.`);
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
      setStatusMessage("Candidate environment activated for the current Harness scope.");
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
      setStatusMessage("Harness scope rolled back to the current active environment.");
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsMutating(false);
    }
  }

  if (overview == null && isLoading) {
    return (
      <article className="evaluation-workbench-panel">
        <div className="evaluation-workbench-panel-header">
          <h3>Harness Control Plane</h3>
          <span>Loading</span>
        </div>
        <p className="evaluation-workbench-empty">
          Loading governed scope, runtime bindings, and candidate controls...
        </p>
      </article>
    );
  }

  return (
    <section className="evaluation-workbench-operator-stack">
      {statusMessage ? <p className="evaluation-workbench-status">{statusMessage}</p> : null}
      {errorMessage ? <p className="evaluation-workbench-error">{errorMessage}</p> : null}

      <article className="evaluation-workbench-panel evaluation-workbench-operator-summary">
        <div className="evaluation-workbench-panel-header">
          <h3>Harness Control Plane</h3>
          <span>Scope boundary</span>
        </div>
        <div className="evaluation-workbench-history-compare">
          <span>Module: {scopeProfile?.module ?? "unresolved"}</span>
          <span>Manuscript Type: {scopeProfile?.manuscript_type ?? "unresolved"}</span>
          <span>
            Template Family:{" "}
            {scopeProfile == null
              ? "unresolved"
              : activeTemplateFamily
                ? `${activeTemplateFamily.name} (${activeTemplateFamily.id})`
                : scopeProfile.template_family_id}
          </span>
        </div>
      </article>

      <HarnessEnvironmentEditor
        module={scopeProfile?.module ?? "editing"}
        manuscriptType={scopeProfile?.manuscript_type ?? "clinical_study"}
        availableManuscriptTypes={availableManuscriptTypes}
        templateFamilyName={activeTemplateFamily?.name ?? null}
        templateFamilyId={scopeProfile?.template_family_id ?? null}
        activeScope={scope}
        preview={preview}
        qualityPackages={overview?.qualityPackages ?? []}
        executionProfiles={scopedExecutionProfiles}
        runtimeBindings={scopedRuntimeBindings}
        routingVersions={routingVersions}
        selection={selection}
        onModuleChange={handleModuleChange}
        onManuscriptTypeChange={handleManuscriptTypeChange}
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
    </section>
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

function resolveManuscriptTypesForModule(
  overview: AdminGovernanceOverview | null,
  module: TemplateModule | null,
): ManuscriptType[] {
  if (overview == null || module == null) {
    return [];
  }

  return [...new Set(
    overview.executionProfiles
      .filter((profile) => profile.module === module)
      .map((profile) => profile.manuscript_type),
  )];
}

function resolveTemplateFamily(
  overview: AdminGovernanceOverview | null,
  scopeProfile: ModuleExecutionProfileViewModel | null,
) {
  if (overview == null || scopeProfile == null) {
    return null;
  }

  return (
    overview.templateFamilies.find((family) => family.id === scopeProfile.template_family_id) ??
    null
  );
}

function resolvePreferredScopeProfile(
  overview: AdminGovernanceOverview | null,
  input: {
    module: TemplateModule;
    manuscriptType: ManuscriptType;
    preferredTemplateFamilyId: string | null;
  },
) {
  if (overview == null) {
    return null;
  }

  return (
    overview.executionProfiles.find(
      (profile) =>
        profile.module === input.module &&
        profile.manuscript_type === input.manuscriptType &&
        profile.template_family_id === input.preferredTemplateFamilyId,
    ) ??
    overview.executionProfiles.find(
      (profile) =>
        profile.module === input.module && profile.manuscript_type === input.manuscriptType,
    ) ??
    null
  );
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

function toErrorMessage(error: unknown) {
  if (error instanceof BrowserHttpClientError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unable to update the Harness control plane right now.";
}
