import { startTransition, useEffect, useState } from "react";
import { createBrowserHttpClient, BrowserHttpClientError } from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/index.ts";
import type {
  ResolvedExecutionBundleViewModel,
} from "../execution-governance/index.ts";
import { formatExecutionResolutionModelSourceLabel } from "../execution-governance/index.ts";
import type { ManuscriptType } from "../manuscripts/index.ts";
import type {
  CreateModelRegistryEntryInput,
  ModelRegistryEntryViewModel,
} from "../model-registry/index.ts";
import type {
  CreateModuleTemplateDraftInput,
  ModuleTemplateViewModel,
  TemplateFamilyViewModel,
  TemplateModule,
} from "../templates/index.ts";
import {
  createAdminGovernanceWorkbenchController,
  type AdminGovernanceWorkbenchController,
  type AdminGovernanceOverview,
} from "./admin-governance-controller.ts";
import { AgentToolingGovernanceSection } from "./agent-tooling-governance-section.tsx";
import "./admin-governance-workbench.css";

const defaultController = createAdminGovernanceWorkbenchController(
  createBrowserHttpClient(),
);

const templateModules: TemplateModule[] = ["screening", "editing", "proofreading"];

export interface AdminGovernanceWorkbenchPageProps {
  actorRole?: AuthRole;
  controller?: AdminGovernanceWorkbenchController;
}

export function AdminGovernanceWorkbenchPage({
  actorRole = "admin",
  controller = defaultController,
}: AdminGovernanceWorkbenchPageProps) {
  const [overview, setOverview] = useState<AdminGovernanceOverview | null>(null);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [familyForm, setFamilyForm] = useState({
    manuscriptType: "review" as TemplateFamilyViewModel["manuscript_type"],
    name: "Review governance family",
  });
  const [moduleDraftForm, setModuleDraftForm] = useState<CreateModuleTemplateDraftInput>({
    templateFamilyId: "",
    module: "proofreading",
    manuscriptType: "review",
    prompt: "Generate proofreading draft first, then wait for confirmation before final output.",
    checklist: ["Consistency", "Privacy"],
    sectionRequirements: ["discussion", "references"],
  });
  const [modelForm, setModelForm] = useState<{
    provider: ModelRegistryEntryViewModel["provider"];
    modelName: string;
    modelVersion: string;
    allowedModules: TemplateModule[];
    isProdAllowed: boolean;
  }>({
    provider: "openai",
    modelName: "gpt-5.4",
    modelVersion: "",
    allowedModules: [...templateModules],
    isProdAllowed: true,
  });
  const [routingPolicyForm, setRoutingPolicyForm] = useState<{
    systemDefaultModelId: string;
    moduleDefaults: Record<TemplateModule, string>;
  }>({
    systemDefaultModelId: "",
    moduleDefaults: {
      screening: "",
      editing: "",
      proofreading: "",
    },
  });
  const [executionPreviewForm, setExecutionPreviewForm] = useState<{
    module: TemplateModule;
    manuscriptType: ManuscriptType;
    templateFamilyId: string;
  }>({
    module: "editing",
    manuscriptType: "review",
    templateFamilyId: "",
  });
  const [executionPreview, setExecutionPreview] =
    useState<ResolvedExecutionBundleViewModel | null>(null);

  useEffect(() => {
    void loadOverview();
  }, []);

  useEffect(() => {
    if (!overview?.selectedTemplateFamilyId) {
      return;
    }

    const selectedFamily = overview.templateFamilies.find(
      (family) => family.id === overview.selectedTemplateFamilyId,
    );

    setModuleDraftForm((current) => ({
      ...current,
      templateFamilyId: overview.selectedTemplateFamilyId ?? "",
      manuscriptType: selectedFamily?.manuscript_type ?? current.manuscriptType,
    }));
    setExecutionPreviewForm((current) => ({
      ...current,
      manuscriptType: selectedFamily?.manuscript_type ?? current.manuscriptType,
      templateFamilyId: overview.selectedTemplateFamilyId ?? "",
    }));
    setExecutionPreview(null);
  }, [overview?.selectedTemplateFamilyId]);

  useEffect(() => {
    if (!overview) {
      return;
    }

    setRoutingPolicyForm({
      systemDefaultModelId: overview.modelRoutingPolicy.system_default_model_id ?? "",
      moduleDefaults: {
        screening: overview.modelRoutingPolicy.module_defaults.screening ?? "",
        editing: overview.modelRoutingPolicy.module_defaults.editing ?? "",
        proofreading: overview.modelRoutingPolicy.module_defaults.proofreading ?? "",
      },
    });
  }, [overview]);

  async function loadOverview(input?: { selectedTemplateFamilyId?: string | null }) {
    setLoadStatus("loading");
    setErrorMessage(null);

    try {
      const nextOverview = await controller.loadOverview(input);
      startTransition(() => {
        setOverview(nextOverview);
        setLoadStatus("ready");
      });
    } catch (error) {
      startTransition(() => {
        setLoadStatus("error");
        setErrorMessage(toErrorMessage(error));
      });
    }
  }

  async function handleCreateFamily() {
    await runMutation(async () => {
      const result = await controller.createTemplateFamilyAndReload({
        manuscriptType: familyForm.manuscriptType,
        name: familyForm.name.trim(),
      });

      startTransition(() => {
        setOverview(result.overview);
        setStatusMessage(`Created template family: ${result.createdFamily.name}`);
      });
    });
  }

  async function handleCreateModuleDraft() {
    if (!overview?.selectedTemplateFamilyId) {
      return;
    }
    const selectedTemplateFamilyId = overview.selectedTemplateFamilyId;

    await runMutation(async () => {
      const result = await controller.createModuleTemplateDraftAndReload({
        selectedTemplateFamilyId,
        draft: {
          ...moduleDraftForm,
          templateFamilyId: selectedTemplateFamilyId,
          prompt: moduleDraftForm.prompt.trim(),
          checklist: normalizeCommaSeparatedList(moduleDraftForm.checklist),
          sectionRequirements: normalizeCommaSeparatedList(
            moduleDraftForm.sectionRequirements,
          ),
        },
      });

      startTransition(() => {
        setOverview(result.overview);
        setStatusMessage(`Created module template draft v${result.createdDraft.version_no}.`);
      });
    });
  }

  async function handlePublishModuleTemplate(moduleTemplateId: string) {
    if (!overview?.selectedTemplateFamilyId) {
      return;
    }
    const selectedTemplateFamilyId = overview.selectedTemplateFamilyId;

    await runMutation(async () => {
      const nextOverview = await controller.publishModuleTemplateAndReload({
        selectedTemplateFamilyId,
        moduleTemplateId,
        actorRole,
      });

      startTransition(() => {
        setOverview(nextOverview);
        setStatusMessage(`Published module template: ${moduleTemplateId}`);
      });
    });
  }

  async function handleCreateModelEntry() {
    await runMutation(async () => {
      const result = await controller.createModelEntryAndReload({
        actorRole,
        provider: modelForm.provider,
        modelName: modelForm.modelName.trim(),
        modelVersion: normalizeOptionalText(modelForm.modelVersion),
        allowedModules: modelForm.allowedModules,
        isProdAllowed: modelForm.isProdAllowed,
      });

      startTransition(() => {
        setOverview(result.overview);
        setStatusMessage(`Created model entry: ${result.createdModel.model_name}`);
      });
    });
  }

  async function handleSaveRoutingPolicy() {
    await runMutation(async () => {
      const nextOverview = await controller.updateRoutingPolicyAndReload({
        actorRole,
        systemDefaultModelId: normalizeOptionalSelection(
          routingPolicyForm.systemDefaultModelId,
        ),
        moduleDefaults: {
          screening: normalizeOptionalSelection(
            routingPolicyForm.moduleDefaults.screening,
          ),
          editing: normalizeOptionalSelection(routingPolicyForm.moduleDefaults.editing),
          proofreading: normalizeOptionalSelection(
            routingPolicyForm.moduleDefaults.proofreading,
          ),
        },
      });

      startTransition(() => {
        setOverview(nextOverview);
        setStatusMessage("Updated legacy fallback defaults.");
      });
    });
  }

  async function handleResolveExecutionPreview() {
    const templateFamilyId = executionPreviewForm.templateFamilyId.trim();
    if (templateFamilyId.length === 0) {
      return;
    }

    await runMutation(async () => {
      const preview = await controller.resolveExecutionBundlePreview({
        module: executionPreviewForm.module,
        manuscriptType: executionPreviewForm.manuscriptType,
        templateFamilyId,
      });

      startTransition(() => {
        setExecutionPreview(preview);
        setStatusMessage("Resolved execution bundle preview.");
      });
    });
  }

  if (loadStatus === "loading" && overview == null) {
    return (
      <article className="workbench-placeholder" role="status">
        <h2>Loading Governance Console</h2>
        <p>Fetching template governance and prompt/skill registry state.</p>
      </article>
    );
  }

  if (loadStatus === "error") {
    return (
      <article className="workbench-placeholder" role="alert">
        <h2>Governance Console Unavailable</h2>
        <p>{errorMessage ?? "Unable to load governance data."}</p>
      </article>
    );
  }

  return (
    <section className="admin-governance-workbench">
      <header className="admin-governance-hero">
        <div>
          <h2>Admin Governance Console</h2>
          <p>
            Manage template governance, model routing, and the agent-tooling runtime registry that
            powers governed manuscript execution.
          </p>
          {errorMessage ? <p className="admin-governance-error">{errorMessage}</p> : null}
        </div>
        {statusMessage ? <p className="admin-governance-status">{statusMessage}</p> : null}
      </header>

      <section className="admin-governance-summary">
        <SummaryCard label="Template Families" value={overview?.templateFamilies.length ?? 0} />
        <SummaryCard label="Module Templates" value={overview?.moduleTemplates.length ?? 0} />
        <SummaryCard label="Prompt Templates" value={overview?.promptTemplates.length ?? 0} />
        <SummaryCard label="Skill Packages" value={overview?.skillPackages.length ?? 0} />
        <SummaryCard label="Execution Profiles" value={overview?.executionProfiles.length ?? 0} />
        <SummaryCard label="Model Entries" value={overview?.modelRegistryEntries.length ?? 0} />
        <SummaryCard label="Routing Policies" value={overview?.routingPolicies.length ?? 0} />
        <SummaryCard label="Tool Gateway" value={overview?.toolGatewayTools.length ?? 0} />
        <SummaryCard label="Sandbox Profiles" value={overview?.sandboxProfiles.length ?? 0} />
        <SummaryCard label="Agent Profiles" value={overview?.agentProfiles.length ?? 0} />
        <SummaryCard label="Agent Runtimes" value={overview?.agentRuntimes.length ?? 0} />
        <SummaryCard label="Runtime Bindings" value={overview?.runtimeBindings.length ?? 0} />
        <SummaryCard label="Harness Adapters" value={overview?.harnessAdapters.length ?? 0} />
      </section>

      <section className="admin-governance-grid">
        <article className="admin-governance-panel">
          <h3>Create Template Family</h3>
          <label className="admin-governance-field">
            <span>Manuscript Type</span>
            <select
              value={familyForm.manuscriptType}
              onChange={(event) =>
                setFamilyForm((current) => ({
                  ...current,
                  manuscriptType: event.target.value as TemplateFamilyViewModel["manuscript_type"],
                }))
              }
              disabled={isMutating}
            >
              <option value="review">Review</option>
              <option value="clinical_study">Clinical Study</option>
              <option value="case_report">Case Report</option>
              <option value="guideline_interpretation">Guideline Interpretation</option>
            </select>
          </label>
          <label className="admin-governance-field">
            <span>Family Name</span>
            <input
              type="text"
              value={familyForm.name}
              onChange={(event) =>
                setFamilyForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              disabled={isMutating}
            />
          </label>
          <button
            type="button"
            className="auth-primary-action"
            onClick={() => void handleCreateFamily()}
            disabled={isMutating || familyForm.name.trim().length === 0}
          >
            Create Family
          </button>
        </article>

        <article className="admin-governance-panel">
          <h3>Template Families</h3>
          <ul className="admin-governance-list">
            {(overview?.templateFamilies ?? []).map((family) => {
              const isSelected = family.id === overview?.selectedTemplateFamilyId;
              return (
                <li key={family.id}>
                  <button
                    type="button"
                    className={`admin-governance-list-button${isSelected ? " is-active" : ""}`}
                    onClick={() => void loadOverview({ selectedTemplateFamilyId: family.id })}
                  >
                    <span>{family.name}</span>
                    <small>
                      {family.manuscript_type} · {family.status}
                    </small>
                  </button>
                </li>
              );
            })}
          </ul>
        </article>

        <article className="admin-governance-panel admin-governance-panel-wide">
          <h3>Module Template Drafts</h3>
          {overview?.selectedTemplateFamilyId ? (
            <>
              <div className="admin-governance-form-grid">
                <label className="admin-governance-field">
                  <span>Module</span>
                  <select
                    value={moduleDraftForm.module}
                    onChange={(event) =>
                      setModuleDraftForm((current) => ({
                        ...current,
                        module: event.target.value as TemplateModule,
                      }))
                    }
                    disabled={isMutating}
                  >
                    {templateModules.map((module) => (
                      <option key={module} value={module}>
                        {module}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-governance-field">
                  <span>Prompt</span>
                  <textarea
                    rows={4}
                    value={moduleDraftForm.prompt}
                    onChange={(event) =>
                      setModuleDraftForm((current) => ({
                        ...current,
                        prompt: event.target.value,
                      }))
                    }
                    disabled={isMutating}
                  />
                </label>
                <label className="admin-governance-field">
                  <span>Checklist</span>
                  <input
                    type="text"
                    value={renderCommaSeparatedList(moduleDraftForm.checklist)}
                    onChange={(event) =>
                      setModuleDraftForm((current) => ({
                        ...current,
                        checklist: normalizeCommaSeparatedList(event.target.value),
                      }))
                    }
                    disabled={isMutating}
                  />
                </label>
                <label className="admin-governance-field">
                  <span>Section Requirements</span>
                  <input
                    type="text"
                    value={renderCommaSeparatedList(moduleDraftForm.sectionRequirements)}
                    onChange={(event) =>
                      setModuleDraftForm((current) => ({
                        ...current,
                        sectionRequirements: normalizeCommaSeparatedList(event.target.value),
                      }))
                    }
                    disabled={isMutating}
                  />
                </label>
              </div>

              <div className="auth-actions">
                <button
                  type="button"
                  className="auth-primary-action"
                  onClick={() => void handleCreateModuleDraft()}
                  disabled={isMutating || moduleDraftForm.prompt.trim().length === 0}
                >
                  Create Module Draft
                </button>
              </div>

              <ul className="admin-governance-list admin-governance-list-spaced">
                {(overview?.moduleTemplates ?? []).map((template) => (
                  <li key={template.id} className="admin-governance-template-row">
                    <div>
                      <strong>
                        {template.module} v{template.version_no}
                      </strong>
                      <p>{template.prompt}</p>
                    </div>
                    <div className="admin-governance-template-actions">
                      <span className="admin-governance-badge">{template.status}</span>
                      {template.status === "draft" ? (
                        <button
                          type="button"
                          className="workbench-secondary-action"
                          onClick={() => void handlePublishModuleTemplate(template.id)}
                          disabled={isMutating}
                        >
                          Publish
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="admin-governance-empty">Create or select a template family first.</p>
          )}
        </article>

        <article className="admin-governance-panel">
          <h3>Prompt Templates</h3>
          <ul className="admin-governance-list">
            {(overview?.promptTemplates ?? []).map((template) => (
              <li key={template.id} className="admin-governance-asset-row">
                <span>
                  {template.name} {template.version}
                </span>
                <small>
                  {template.module} · {template.status}
                </small>
              </li>
            ))}
          </ul>
        </article>

        <article className="admin-governance-panel">
          <h3>Skill Packages</h3>
          <ul className="admin-governance-list">
            {(overview?.skillPackages ?? []).map((skillPackage) => (
              <li key={skillPackage.id} className="admin-governance-asset-row">
                <span>
                  {skillPackage.name} {skillPackage.version}
                </span>
                <small>{skillPackage.status}</small>
              </li>
            ))}
          </ul>
        </article>

        <article className="admin-governance-panel admin-governance-panel-wide">
          <h3>Model Registry</h3>
          <div className="admin-governance-form-grid">
            <label className="admin-governance-field">
              <span>Provider</span>
              <select
                value={modelForm.provider}
                onChange={(event) =>
                  setModelForm((current) => ({
                    ...current,
                    provider: event.target.value as ModelRegistryEntryViewModel["provider"],
                  }))
                }
                disabled={isMutating}
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google</option>
                <option value="azure_openai">Azure OpenAI</option>
                <option value="local">Local</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="admin-governance-field">
              <span>Model Name</span>
              <input
                type="text"
                value={modelForm.modelName}
                onChange={(event) =>
                  setModelForm((current) => ({
                    ...current,
                    modelName: event.target.value,
                  }))
                }
                disabled={isMutating}
              />
            </label>
            <label className="admin-governance-field">
              <span>Model Version</span>
              <input
                type="text"
                value={modelForm.modelVersion}
                onChange={(event) =>
                  setModelForm((current) => ({
                    ...current,
                    modelVersion: event.target.value,
                  }))
                }
                disabled={isMutating}
                placeholder="optional"
              />
            </label>
            <label className="admin-governance-field">
              <span>Production Approved</span>
              <select
                value={modelForm.isProdAllowed ? "yes" : "no"}
                onChange={(event) =>
                  setModelForm((current) => ({
                    ...current,
                    isProdAllowed: event.target.value === "yes",
                  }))
                }
                disabled={isMutating}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          </div>

          <fieldset className="admin-governance-module-selector">
            <legend>Allowed Modules</legend>
            <div className="admin-governance-module-options">
              {templateModules.map((module) => (
                <label key={module} className="admin-governance-module-option">
                  <input
                    type="checkbox"
                    checked={modelForm.allowedModules.includes(module)}
                    onChange={() =>
                      setModelForm((current) => ({
                        ...current,
                        allowedModules: toggleModuleSelection(
                          current.allowedModules,
                          module,
                        ),
                      }))
                    }
                    disabled={isMutating}
                  />
                  <span>{module}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="auth-actions">
            <button
              type="button"
              className="auth-primary-action"
              onClick={() => void handleCreateModelEntry()}
              disabled={
                isMutating ||
                modelForm.modelName.trim().length === 0 ||
                modelForm.allowedModules.length === 0
              }
            >
              Create Model Entry
            </button>
          </div>

          {(overview?.modelRegistryEntries.length ?? 0) > 0 ? (
            <ul className="admin-governance-list admin-governance-list-spaced">
              {(overview?.modelRegistryEntries ?? []).map((model) => (
                <li key={model.id} className="admin-governance-template-row">
                  <div>
                    <strong>
                      {model.provider} / {model.model_name}
                    </strong>
                    <p>
                      Version {model.model_version || "default"} · Modules{" "}
                      {model.allowed_modules.join(", ")}
                    </p>
                  </div>
                  <div className="admin-governance-template-actions">
                    <span className="admin-governance-badge">
                      {model.is_prod_allowed ? "prod_allowed" : "review_only"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-governance-empty">
              No model entries yet. Add at least one production-approved model before assigning
              routing defaults.
            </p>
          )}
        </article>

        <article className="admin-governance-panel admin-governance-panel-wide">
          <h3>Legacy Fallback Defaults</h3>
          {(overview?.modelRegistryEntries.length ?? 0) > 0 ? (
            <>
              <div className="admin-governance-form-grid">
                <label className="admin-governance-field">
                  <span>System Default</span>
                  <select
                    value={routingPolicyForm.systemDefaultModelId}
                    onChange={(event) =>
                      setRoutingPolicyForm((current) => ({
                        ...current,
                        systemDefaultModelId: event.target.value,
                      }))
                    }
                    disabled={isMutating}
                  >
                    <option value="">Unassigned</option>
                    {(overview?.modelRegistryEntries ?? []).map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.provider} / {model.model_name}
                      </option>
                    ))}
                  </select>
                </label>
                {templateModules.map((module) => (
                  <label key={module} className="admin-governance-field">
                    <span>{module} Default</span>
                    <select
                      value={routingPolicyForm.moduleDefaults[module]}
                      onChange={(event) =>
                        setRoutingPolicyForm((current) => ({
                          ...current,
                          moduleDefaults: {
                            ...current.moduleDefaults,
                            [module]: event.target.value,
                          },
                        }))
                      }
                      disabled={isMutating}
                    >
                      <option value="">Unassigned</option>
                      {(overview?.modelRegistryEntries ?? [])
                        .filter((model) => model.allowed_modules.includes(module))
                        .map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.provider} / {model.model_name}
                          </option>
                        ))}
                    </select>
                  </label>
                ))}
              </div>

              <div className="auth-actions">
                <button
                  type="button"
                  className="auth-primary-action"
                    onClick={() => void handleSaveRoutingPolicy()}
                    disabled={isMutating}
                  >
                  Save Legacy Defaults
                </button>
              </div>

              <div className="admin-governance-policy-grid">
              <article className="admin-governance-asset-row">
                  <span>Legacy System Default</span>
                  <small>
                    {overview?.modelRoutingPolicy.system_default_model_id ?? "Unassigned"}
                  </small>
                </article>
                <article className="admin-governance-asset-row">
                  <span>Legacy Template Overrides</span>
                  <small>
                    {Object.keys(overview?.modelRoutingPolicy.template_overrides ?? {}).length}
                  </small>
                </article>
              </div>
            </>
          ) : (
            <p className="admin-governance-empty">
              Add a model entry first. Module defaults only allow models that support the selected
              module.
            </p>
          )}
        </article>

        <article className="admin-governance-panel admin-governance-panel-wide">
          <h3>Execution Governance</h3>
          {(overview?.executionProfiles.length ?? 0) > 0 ? (
            <ul className="admin-governance-list admin-governance-list-spaced">
              {(overview?.executionProfiles ?? []).map((profile) => (
                <li key={profile.id} className="admin-governance-template-row">
                  <div>
                    <strong>
                      {profile.module} / {profile.manuscript_type}
                    </strong>
                    <p>
                      Family {profile.template_family_id} 路 Template {profile.module_template_id}
                    </p>
                  </div>
                  <div className="admin-governance-template-actions">
                    <span className="admin-governance-badge">{profile.status}</span>
                    <small>v{profile.version}</small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-governance-empty">
              No execution profiles yet. Publish at least one governance profile to resolve a live
              runtime bundle.
            </p>
          )}

          <div className="admin-governance-form-grid">
            <label className="admin-governance-field">
              <span>Template Family</span>
              <select
                value={executionPreviewForm.templateFamilyId}
                onChange={(event) =>
                  setExecutionPreviewForm((current) => {
                    const selectedFamily = overview?.templateFamilies.find(
                      (family) => family.id === event.target.value,
                    );

                    return {
                      ...current,
                      templateFamilyId: event.target.value,
                      manuscriptType:
                        selectedFamily?.manuscript_type ?? current.manuscriptType,
                    };
                  })
                }
                disabled={isMutating}
              >
                <option value="">Select family</option>
                {(overview?.templateFamilies ?? []).map((family) => (
                  <option key={family.id} value={family.id}>
                    {family.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-governance-field">
              <span>Module</span>
              <select
                value={executionPreviewForm.module}
                onChange={(event) =>
                  setExecutionPreviewForm((current) => ({
                    ...current,
                    module: event.target.value as TemplateModule,
                  }))
                }
                disabled={isMutating}
              >
                {templateModules.map((module) => (
                  <option key={module} value={module}>
                    {module}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="auth-actions">
            <button
              type="button"
              className="auth-primary-action"
              onClick={() => void handleResolveExecutionPreview()}
              disabled={isMutating || executionPreviewForm.templateFamilyId.trim().length === 0}
            >
              Preview Execution Bundle
            </button>
          </div>

          {executionPreview ? (
            <div className="admin-governance-resolution-grid">
              <article className="admin-governance-asset-row">
                <span>Resolved Profile</span>
                <small>{executionPreview.profile.id}</small>
              </article>
              <article className="admin-governance-asset-row">
                <span>Resolved Model</span>
                <small>
                  {executionPreview.resolved_model.provider} /{" "}
                  {executionPreview.resolved_model.model_name}
                </small>
              </article>
              <article className="admin-governance-asset-row">
                <span>Model Source</span>
                <small>
                  {formatExecutionResolutionModelSourceLabel(
                    executionPreview.model_source,
                  )}{" "}
                  ({executionPreview.model_source})
                </small>
              </article>
              <article className="admin-governance-asset-row">
                <span>Knowledge Hits</span>
                <small>{executionPreview.knowledge_items.length}</small>
              </article>
              <article className="admin-governance-asset-row">
                <span>Prompt Template</span>
                <small>{executionPreview.prompt_template.name}</small>
              </article>
              <article className="admin-governance-asset-row">
                <span>Skill Packages</span>
                <small>{executionPreview.skill_packages.length}</small>
              </article>
            </div>
          ) : (
            <p className="admin-governance-empty">
              Resolve a family/module pair to preview the exact governed runtime bundle the system
              will execute.
            </p>
          )}
        </article>

        <article className="admin-governance-panel admin-governance-panel-wide">
          <h3>Harness Integrations</h3>
          <p className="admin-governance-empty">
            Read-only visibility for local harness adapters. This surface does not change routing,
            publish state, or production control-plane policy.
          </p>

          {(overview?.harnessAdapterHealth.length ?? 0) > 0 ? (
            <ul className="admin-governance-list admin-governance-list-spaced">
              {(overview?.harnessAdapterHealth ?? []).map((record) => (
                <li key={record.adapter.id} className="admin-governance-template-row">
                  <div>
                    <strong>{record.adapter.display_name}</strong>
                    <p>
                      {record.adapter.kind} 路 {record.adapter.execution_mode} 路 latest{" "}
                      {record.latest_status}
                    </p>
                  </div>
                  <div className="admin-governance-template-actions">
                    <span className="admin-governance-badge">
                      trace {record.trace_availability}
                    </span>
                    {record.latest_degradation_reason ? (
                      <small>{record.latest_degradation_reason}</small>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-governance-empty">
              No harness adapters are registered yet.
            </p>
          )}

          {overview?.latestJudgeCalibrationBatchOutcome ? (
            <div className="admin-governance-policy-grid">
              <article className="admin-governance-asset-row">
                <span>Latest Judge Batch</span>
                <small>{overview.latestJudgeCalibrationBatchOutcome.execution_id}</small>
              </article>
              <article className="admin-governance-asset-row">
                <span>Judge Status</span>
                <small>{overview.latestJudgeCalibrationBatchOutcome.status}</small>
              </article>
              <article className="admin-governance-asset-row">
                <span>Exact Match Rate</span>
                <small>
                  {overview.latestJudgeCalibrationBatchOutcome.exact_match_rate ?? "unknown"}
                </small>
              </article>
              <article className="admin-governance-asset-row">
                <span>Disagreements</span>
                <small>
                  {overview.latestJudgeCalibrationBatchOutcome.disagreement_count ?? "unknown"}
                </small>
              </article>
            </div>
          ) : (
            <p className="admin-governance-empty">
              No judge calibration outcome has been recorded yet.
            </p>
          )}
        </article>

        {overview ? (
          <AgentToolingGovernanceSection
            actorRole={actorRole}
            controller={controller}
            overview={overview}
            isMutating={isMutating}
            runMutation={runMutation}
            onOverviewChange={(
              nextOverview: AdminGovernanceOverview,
              nextStatusMessage: string,
            ) => {
              startTransition(() => {
                setOverview(nextOverview);
                setStatusMessage(nextStatusMessage);
              });
            }}
          />
        ) : null}
      </section>
    </section>
  );

  async function runMutation(work: () => Promise<void>) {
    setIsMutating(true);
    setErrorMessage(null);

    try {
      await work();
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsMutating(false);
    }
  }
}

function SummaryCard(props: { label: string; value: number }) {
  return (
    <article className="admin-governance-summary-card">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </article>
  );
}

function normalizeCommaSeparatedList(input: string | string[] | undefined): string[] | undefined {
  const values = Array.isArray(input)
    ? input
    : input
        ?.split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0);

  return values && values.length > 0 ? values : undefined;
}

function renderCommaSeparatedList(values: string[] | undefined): string {
  return values?.join(", ") ?? "";
}

function normalizeOptionalText(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionalSelection(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toggleModuleSelection(
  currentModules: readonly TemplateModule[],
  module: TemplateModule,
): TemplateModule[] {
  if (currentModules.includes(module)) {
    return currentModules.filter((value) => value !== module);
  }

  return [...currentModules, module];
}

function toErrorMessage(error: unknown): string {
  if (error instanceof BrowserHttpClientError) {
    const responseBody = error.responseBody;
    if (responseBody && typeof responseBody === "object") {
      const message = (responseBody as Record<string, unknown>).message;
      if (typeof message === "string" && message.trim().length > 0) {
        return message;
      }
    }

    return `Request failed (${error.status}).`;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return "Request failed.";
}
