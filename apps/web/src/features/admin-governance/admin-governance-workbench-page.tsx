import { startTransition, useEffect, useState } from "react";
import { createBrowserHttpClient, BrowserHttpClientError } from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/index.ts";
import type {
  CreateModuleTemplateDraftInput,
  ModuleTemplateViewModel,
  TemplateFamilyViewModel,
  TemplateModule,
} from "../templates/index.ts";
import {
  createAdminGovernanceWorkbenchController,
  type AdminGovernanceOverview,
} from "./admin-governance-controller.ts";
import "./admin-governance-workbench.css";

const defaultController = createAdminGovernanceWorkbenchController(
  createBrowserHttpClient(),
);

const templateModules: TemplateModule[] = ["screening", "editing", "proofreading"];

export interface AdminGovernanceWorkbenchPageProps {
  actorRole?: AuthRole;
}

export function AdminGovernanceWorkbenchPage({
  actorRole = "admin",
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

  useEffect(() => {
    void loadOverview();
  }, []);

  useEffect(() => {
    if (!overview?.selectedTemplateFamilyId) {
      return;
    }

    setModuleDraftForm((current) => ({
      ...current,
      templateFamilyId: overview.selectedTemplateFamilyId ?? "",
    }));
  }, [overview?.selectedTemplateFamilyId]);

  async function loadOverview(input?: { selectedTemplateFamilyId?: string | null }) {
    setLoadStatus("loading");
    setErrorMessage(null);

    try {
      const nextOverview = await defaultController.loadOverview(input);
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
      const result = await defaultController.createTemplateFamilyAndReload({
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
      const result = await defaultController.createModuleTemplateDraftAndReload({
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
      const nextOverview = await defaultController.publishModuleTemplateAndReload({
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
            Manage template families and inspect the Prompt/Skill registry that feeds governed
            manuscript execution.
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
