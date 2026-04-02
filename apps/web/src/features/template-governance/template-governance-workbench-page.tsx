import { useEffect, useRef, useState, type FormEvent } from "react";
import { createBrowserHttpClient, BrowserHttpClientError } from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/index.ts";
import type {
  EvidenceLevel,
  KnowledgeItemStatus,
  KnowledgeKind,
  KnowledgeSourceType,
} from "../knowledge/index.ts";
import type { ManuscriptType } from "../manuscripts/types.ts";
import type {
  ModuleTemplateViewModel,
  TemplateFamilyStatus,
} from "../templates/index.ts";
import {
  createTemplateGovernanceWorkbenchController,
  type TemplateGovernanceWorkbenchController,
  type TemplateGovernanceWorkbenchFilters,
  type TemplateGovernanceWorkbenchOverview,
} from "./template-governance-controller.ts";
import "./template-governance-workbench.css";

const defaultController = createTemplateGovernanceWorkbenchController(
  createBrowserHttpClient(),
);
const manuscriptTypes: ManuscriptType[] = [
  "clinical_study",
  "review",
  "systematic_review",
  "meta_analysis",
  "case_report",
  "guideline_interpretation",
  "expert_consensus",
  "diagnostic_study",
  "basic_research",
  "nursing_study",
  "methodology_paper",
  "brief_report",
  "other",
];
const templateModules = ["screening", "editing", "proofreading"] as const;
const knowledgeKinds: KnowledgeKind[] = [
  "rule",
  "case_pattern",
  "checklist",
  "prompt_snippet",
  "reference",
  "other",
];
const knowledgeStatuses: Array<KnowledgeItemStatus | "all"> = [
  "all",
  "draft",
  "pending_review",
  "approved",
  "deprecated",
  "superseded",
  "archived",
];
const evidenceLevels: EvidenceLevel[] = [
  "unknown",
  "low",
  "medium",
  "high",
  "expert_opinion",
];
const knowledgeSourceTypes: KnowledgeSourceType[] = [
  "other",
  "paper",
  "guideline",
  "book",
  "website",
  "internal_case",
];
const templateFamilyStatuses: TemplateFamilyStatus[] = [
  "draft",
  "active",
  "archived",
];

interface TemplateFamilyFormState {
  manuscriptType: ManuscriptType;
  name: string;
}

interface SelectedTemplateFamilyFormState {
  name: string;
  status: TemplateFamilyStatus;
}

interface ModuleTemplateFormState {
  module: (typeof templateModules)[number];
  prompt: string;
  checklist: string;
  sectionRequirements: string;
}

interface KnowledgeDraftFormState {
  title: string;
  canonicalText: string;
  summary: string;
  knowledgeKind: KnowledgeKind;
  moduleScope: "any" | "screening" | "editing" | "proofreading";
  manuscriptTypes: string;
  templateBindings: string;
  aliases: string;
  sections: string;
  riskTags: string;
  disciplineTags: string;
  evidenceLevel: EvidenceLevel;
  sourceType: KnowledgeSourceType;
  sourceLink: string;
}

export interface TemplateGovernanceWorkbenchPageProps {
  controller?: TemplateGovernanceWorkbenchController;
  actorRole?: AuthRole;
}

export function TemplateGovernanceWorkbenchPage({
  controller = defaultController,
  actorRole = "admin",
}: TemplateGovernanceWorkbenchPageProps) {
  const selectedModuleTemplateIdRef = useRef<string | null>(null);
  const [overview, setOverview] = useState<TemplateGovernanceWorkbenchOverview | null>(null);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedModuleTemplateId, setSelectedModuleTemplateId] = useState<string | null>(null);
  const [familyForm, setFamilyForm] = useState<TemplateFamilyFormState>({
    manuscriptType: "clinical_study",
    name: "",
  });
  const [selectedFamilyForm, setSelectedFamilyForm] =
    useState<SelectedTemplateFamilyFormState>({
      name: "",
      status: "draft",
    });
  const [moduleForm, setModuleForm] = useState<ModuleTemplateFormState>({
    module: "screening",
    prompt: "",
    checklist: "",
    sectionRequirements: "",
  });
  const [knowledgeForm, setKnowledgeForm] = useState<KnowledgeDraftFormState>(
    createKnowledgeDraftFormState(),
  );

  useEffect(() => {
    void loadOverview();
  }, [controller]);

  async function loadOverview(input: {
    selectedTemplateFamilyId?: string | null;
    selectedKnowledgeItemId?: string | null;
    filters?: Partial<TemplateGovernanceWorkbenchFilters>;
  } = {}) {
    setLoadStatus("loading");
    setErrorMessage(null);

    try {
      const nextOverview = await controller.loadOverview(input);
      setOverview(nextOverview);
      setLoadStatus("ready");
      synchronizeForms(nextOverview);
    } catch (error) {
      setLoadStatus("error");
      setErrorMessage(toErrorMessage(error, "Template governance load failed"));
    }
  }

  function setModuleTemplateSelection(moduleTemplateId: string | null) {
    selectedModuleTemplateIdRef.current = moduleTemplateId;
    setSelectedModuleTemplateId(moduleTemplateId);
  }

  function synchronizeForms(nextOverview: TemplateGovernanceWorkbenchOverview) {
    if (nextOverview.selectedTemplateFamily) {
      setFamilyForm((current) => ({
        ...current,
        manuscriptType: nextOverview.selectedTemplateFamily?.manuscript_type ?? current.manuscriptType,
      }));
      setSelectedFamilyForm({
        name: nextOverview.selectedTemplateFamily.name,
        status: nextOverview.selectedTemplateFamily.status,
      });
    } else {
      setSelectedFamilyForm({
        name: "",
        status: "draft",
      });
    }

    const selectedModuleTemplate = resolveSelectedModuleTemplate(
      nextOverview.moduleTemplates,
      selectedModuleTemplateIdRef.current,
    );
    if (selectedModuleTemplate?.status === "draft") {
      setModuleForm(toModuleTemplateFormState(selectedModuleTemplate));
    } else {
      setModuleTemplateSelection(null);
      setModuleForm((current) => ({
        ...current,
        prompt: "",
        checklist: "",
        sectionRequirements: "",
      }));
    }

    const selectedDraft = nextOverview.selectedKnowledgeItem;
    if (selectedDraft?.status === "draft") {
      setKnowledgeForm(toKnowledgeDraftFormState(selectedDraft));
      return;
    }

    setKnowledgeForm(
      createKnowledgeDraftFormState({
        manuscriptType: nextOverview.selectedTemplateFamily?.manuscript_type,
        templateBindings: nextOverview.moduleTemplates.map((template) => template.id),
      }),
    );
  }

  async function runBusyAction(
    action: () => Promise<TemplateGovernanceWorkbenchOverview>,
    successMessage: string,
  ) {
    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const nextOverview = await action();
      setOverview(nextOverview);
      setLoadStatus("ready");
      setStatusMessage(successMessage);
      synchronizeForms(nextOverview);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "Template governance action failed"));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCreateTemplateFamily(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (familyForm.name.trim().length === 0) {
      setErrorMessage("Template family name is required.");
      return;
    }

    await runBusyAction(async () => {
      const result = await controller.createTemplateFamilyAndReload({
        manuscriptType: familyForm.manuscriptType,
        name: familyForm.name.trim(),
      });
      setFamilyForm({
        manuscriptType: result.templateFamily.manuscript_type,
        name: "",
      });
      return result.overview;
    }, "Template family created.");
  }

  async function handleUpdateSelectedTemplateFamily(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const selectedTemplateFamilyId = overview?.selectedTemplateFamilyId;
    if (!selectedTemplateFamilyId || !overview) {
      setErrorMessage("Select a template family before updating it.");
      return;
    }

    if (selectedFamilyForm.name.trim().length === 0) {
      setErrorMessage("Selected template family name is required.");
      return;
    }

    await runBusyAction(async () => {
      const result = await controller.updateTemplateFamilyAndReload({
        templateFamilyId: selectedTemplateFamilyId,
        input: {
          name: selectedFamilyForm.name.trim(),
          status: selectedFamilyForm.status,
        },
        selectedTemplateFamilyId,
        selectedKnowledgeItemId: overview.selectedKnowledgeItemId,
        filters: overview.filters,
      });
      return result.overview;
    }, "Template family updated.");
  }

  async function handleSubmitModuleTemplateDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedTemplateFamilyId = overview?.selectedTemplateFamilyId;
    if (!selectedTemplateFamilyId) {
      setErrorMessage("Select a template family before creating a module draft.");
      return;
    }

    if (moduleForm.prompt.trim().length === 0) {
      setErrorMessage("Module prompt is required.");
      return;
    }

    const selectedModuleTemplate = resolveSelectedModuleTemplate(
      overview.moduleTemplates,
      selectedModuleTemplateId,
    );
    const isEditingModuleTemplate = selectedModuleTemplate?.status === "draft";
    const checklist = splitCommaSeparatedValues(moduleForm.checklist);
    const sectionRequirements = splitCommaSeparatedValues(moduleForm.sectionRequirements);

    await runBusyAction(async () => {
      if (isEditingModuleTemplate && selectedModuleTemplate) {
        const result = await controller.updateModuleTemplateDraftAndReload({
          moduleTemplateId: selectedModuleTemplate.id,
          input: {
            prompt: moduleForm.prompt.trim(),
            checklist: checklist ?? [],
            sectionRequirements: sectionRequirements ?? [],
          },
          selectedTemplateFamilyId,
          selectedKnowledgeItemId: overview.selectedKnowledgeItemId,
          filters: overview.filters,
        });
        setModuleTemplateSelection(result.moduleTemplate.id);
        return result.overview;
      }

      const result = await controller.createModuleTemplateDraftAndReload({
        templateFamilyId: selectedTemplateFamilyId,
        manuscriptType:
          overview.selectedTemplateFamily?.manuscript_type ?? familyForm.manuscriptType,
        module: moduleForm.module,
        prompt: moduleForm.prompt.trim(),
        checklist,
        sectionRequirements,
        selectedTemplateFamilyId,
        selectedKnowledgeItemId: overview.selectedKnowledgeItemId,
        filters: overview.filters,
      });
      setModuleTemplateSelection(null);
      setModuleForm((current) => ({
        ...current,
        prompt: "",
        checklist: "",
        sectionRequirements: "",
      }));
      return result.overview;
    }, isEditingModuleTemplate ? "Module template draft updated." : "Module template draft created.");
  }

  async function handlePublishModuleTemplate(moduleTemplateId: string) {
    if (!overview?.selectedTemplateFamilyId) {
      return;
    }

    await runBusyAction(async () => {
      if (selectedModuleTemplateIdRef.current === moduleTemplateId) {
        setModuleTemplateSelection(null);
      }
      const result = await controller.publishModuleTemplateAndReload({
        moduleTemplateId,
        actorRole,
        selectedTemplateFamilyId: overview.selectedTemplateFamilyId,
        selectedKnowledgeItemId: overview.selectedKnowledgeItemId,
        filters: overview.filters,
      });
      return result.overview;
    }, "Module template published.");
  }

  function handleEditModuleTemplate(moduleTemplateId: string) {
    const selectedModuleTemplate = resolveSelectedModuleTemplate(
      overview?.moduleTemplates ?? [],
      moduleTemplateId,
    );

    if (!selectedModuleTemplate || selectedModuleTemplate.status !== "draft") {
      return;
    }

    setStatusMessage(null);
    setErrorMessage(null);
    setModuleTemplateSelection(selectedModuleTemplate.id);
    setModuleForm(toModuleTemplateFormState(selectedModuleTemplate));
  }

  function handleResetModuleTemplateForm() {
    setModuleTemplateSelection(null);
    setModuleForm((current) => ({
      ...current,
      prompt: "",
      checklist: "",
      sectionRequirements: "",
    }));
    setStatusMessage("Module template editor reset for a new draft.");
  }

  async function handleSubmitKnowledgeDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedKnowledgeItem = overview?.selectedKnowledgeItem;
    const isEditingDraft = selectedKnowledgeItem?.status === "draft";
    if (!overview) {
      return;
    }

    if (
      knowledgeForm.title.trim().length === 0 ||
      knowledgeForm.canonicalText.trim().length === 0
    ) {
      setErrorMessage("Knowledge title and canonical text are required.");
      return;
    }

    const payload = {
      title: knowledgeForm.title.trim(),
      canonicalText: knowledgeForm.canonicalText.trim(),
      summary: optionalTrimmedValue(knowledgeForm.summary),
      knowledgeKind: knowledgeForm.knowledgeKind,
      moduleScope: knowledgeForm.moduleScope,
      manuscriptTypes: parseManuscriptTypes(knowledgeForm.manuscriptTypes),
      sections: splitCommaSeparatedValues(knowledgeForm.sections),
      riskTags: splitCommaSeparatedValues(knowledgeForm.riskTags),
      disciplineTags: splitCommaSeparatedValues(knowledgeForm.disciplineTags),
      evidenceLevel: knowledgeForm.evidenceLevel,
      sourceType: knowledgeForm.sourceType,
      sourceLink: optionalTrimmedValue(knowledgeForm.sourceLink),
      aliases: splitCommaSeparatedValues(knowledgeForm.aliases),
      templateBindings: splitCommaSeparatedValues(knowledgeForm.templateBindings),
    } as const;

    await runBusyAction(async () => {
      if (!isEditingDraft || !selectedKnowledgeItem) {
        const result = await controller.createKnowledgeDraftAndReload({
          ...payload,
          selectedTemplateFamilyId: overview.selectedTemplateFamilyId,
          selectedKnowledgeItemId: overview.selectedKnowledgeItemId,
          filters: overview.filters,
        });
        return result.overview;
      }

      const result = await controller.updateKnowledgeDraftAndReload({
        knowledgeItemId: selectedKnowledgeItem.id,
        input: payload,
        selectedTemplateFamilyId: overview.selectedTemplateFamilyId,
        selectedKnowledgeItemId: selectedKnowledgeItem.id,
        filters: overview.filters,
      });
      return result.overview;
    }, isEditingDraft ? "Knowledge draft updated." : "Knowledge draft created.");
  }

  async function handleSubmitForReview() {
    const selectedKnowledgeItem = overview?.selectedKnowledgeItem;
    if (!overview || selectedKnowledgeItem?.status !== "draft") {
      return;
    }

    await runBusyAction(async () => {
      const result = await controller.submitKnowledgeDraftAndReload({
        knowledgeItemId: selectedKnowledgeItem.id,
        selectedTemplateFamilyId: overview.selectedTemplateFamilyId,
        selectedKnowledgeItemId: selectedKnowledgeItem.id,
        filters: overview.filters,
      });
      return result.overview;
    }, "Knowledge draft submitted for review.");
  }

  async function handleArchiveKnowledgeItem() {
    const selectedKnowledgeItem = overview?.selectedKnowledgeItem;
    if (!overview || !selectedKnowledgeItem) {
      return;
    }

    await runBusyAction(async () => {
      const result = await controller.archiveKnowledgeItemAndReload({
        knowledgeItemId: selectedKnowledgeItem.id,
        selectedTemplateFamilyId: overview.selectedTemplateFamilyId,
        selectedKnowledgeItemId: selectedKnowledgeItem.id,
        filters: overview.filters,
      });
      return result.overview;
    }, "Knowledge item archived.");
  }

  function handleTemplateFamilySelection(templateFamilyId: string) {
    if (!overview) {
      return;
    }

    setStatusMessage(null);
    void loadOverview({
      selectedTemplateFamilyId: templateFamilyId,
      selectedKnowledgeItemId: null,
      filters: overview.filters,
    });
  }

  function handleKnowledgeItemSelection(knowledgeItemId: string) {
    if (!overview) {
      return;
    }

    setStatusMessage(null);
    void loadOverview({
      selectedTemplateFamilyId: overview.selectedTemplateFamilyId,
      selectedKnowledgeItemId: knowledgeItemId,
      filters: overview.filters,
    });
  }

  function handleSearchTextChange(searchText: string) {
    if (!overview) {
      return;
    }

    void loadOverview({
      selectedTemplateFamilyId: overview.selectedTemplateFamilyId,
      selectedKnowledgeItemId: overview.selectedKnowledgeItemId,
      filters: {
        ...overview.filters,
        searchText,
      },
    });
  }

  function handleKnowledgeStatusChange(knowledgeStatus: KnowledgeItemStatus | "all") {
    if (!overview) {
      return;
    }

    void loadOverview({
      selectedTemplateFamilyId: overview.selectedTemplateFamilyId,
      selectedKnowledgeItemId: overview.selectedKnowledgeItemId,
      filters: {
        ...overview.filters,
        knowledgeStatus,
      },
    });
  }

  function handleResetKnowledgeDraft() {
    setKnowledgeForm(
      createKnowledgeDraftFormState({
        manuscriptType: overview?.selectedTemplateFamily?.manuscript_type,
        templateBindings: overview?.moduleTemplates.map((template) => template.id),
      }),
    );
    setStatusMessage("Draft editor reset for a new knowledge item.");
  }

  const selectedModuleTemplate = resolveSelectedModuleTemplate(
    overview?.moduleTemplates ?? [],
    selectedModuleTemplateId,
  );
  const isEditingModuleTemplate = selectedModuleTemplate?.status === "draft";
  const selectedKnowledgeItem = overview?.selectedKnowledgeItem ?? null;
  const isEditingDraft = selectedKnowledgeItem?.status === "draft";

  return (
    <section className="template-governance-workbench">
      <header className="template-governance-hero">
        <div>
          <h2>Template Governance</h2>
          <p>
            Govern template families, module template drafts, and knowledge bindings from one
            controlled admin surface. This closes the last placeholder lane between knowledge review
            and governed template release.
          </p>
        </div>
        {statusMessage ? (
          <p className="template-governance-status" role="status">
            {statusMessage}
          </p>
        ) : null}
      </header>

      {errorMessage ? (
        <p className="template-governance-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <section className="template-governance-summary">
        <article className="template-governance-summary-card">
          <span>Template Families</span>
          <strong>{overview?.templateFamilies.length ?? 0}</strong>
        </article>
        <article className="template-governance-summary-card">
          <span>Module Templates</span>
          <strong>{overview?.moduleTemplates.length ?? 0}</strong>
        </article>
        <article className="template-governance-summary-card">
          <span>Visible Knowledge</span>
          <strong>{overview?.visibleKnowledgeItems.length ?? 0}</strong>
        </article>
        <article className="template-governance-summary-card">
          <span>Bound Knowledge</span>
          <strong>{overview?.boundKnowledgeItems.length ?? 0}</strong>
        </article>
      </section>

      <div className="template-governance-grid">
        <article className="template-governance-panel">
          <div className="template-governance-panel-header">
            <div>
              <h3>Template Families</h3>
              <p>Create and switch the family that downstream module drafts and knowledge bindings will target.</p>
            </div>
          </div>

          <form className="template-governance-form-grid" onSubmit={handleCreateTemplateFamily}>
            <label className="template-governance-field">
              <span>Manuscript Type</span>
              <select
                value={familyForm.manuscriptType}
                onChange={(event) =>
                  setFamilyForm((current) => ({
                    ...current,
                    manuscriptType: event.target.value as ManuscriptType,
                  }))
                }
              >
                {manuscriptTypes.map((manuscriptType) => (
                  <option key={manuscriptType} value={manuscriptType}>
                    {manuscriptType}
                  </option>
                ))}
              </select>
            </label>
            <label className="template-governance-field">
              <span>Family Name</span>
              <input
                value={familyForm.name}
                onChange={(event) =>
                  setFamilyForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Clinical Study Core"
              />
            </label>
            <div className="template-governance-actions template-governance-actions-full">
              <button type="submit" disabled={isBusy}>
                {isBusy ? "Saving..." : "Create Family Draft"}
              </button>
            </div>
          </form>

          {loadStatus === "loading" && !overview ? (
            <p className="template-governance-empty">Loading template families...</p>
          ) : null}

          {overview?.templateFamilies.length ? (
            <ul className="template-governance-list">
              {overview.templateFamilies.map((family) => {
                const isActive = family.id === overview.selectedTemplateFamilyId;
                return (
                  <li key={family.id}>
                    <button
                      type="button"
                      className={`template-governance-list-button${isActive ? " is-active" : ""}`}
                      onClick={() => handleTemplateFamilySelection(family.id)}
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
          ) : (
            <p className="template-governance-empty">
              No template families exist yet. Start by creating the family you want to govern.
            </p>
          )}

          {overview?.selectedTemplateFamily ? (
            <form
              className="template-governance-form-grid"
              onSubmit={handleUpdateSelectedTemplateFamily}
            >
              <p className="template-governance-selected-note">
                Editing selected family: <strong>{overview.selectedTemplateFamily.name}</strong>
              </p>
              <label className="template-governance-field">
                <span>Selected Family Name</span>
                <input
                  value={selectedFamilyForm.name}
                  onChange={(event) =>
                    setSelectedFamilyForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Selected family name"
                />
              </label>
              <label className="template-governance-field">
                <span>Status</span>
                <select
                  value={selectedFamilyForm.status}
                  onChange={(event) =>
                    setSelectedFamilyForm((current) => ({
                      ...current,
                      status: event.target.value as TemplateFamilyStatus,
                    }))
                  }
                >
                  {templateFamilyStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <div className="template-governance-actions template-governance-actions-full">
                <button type="submit" disabled={isBusy}>
                  {isBusy ? "Saving..." : "Save Selected Family"}
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    setSelectedFamilyForm({
                      name: overview.selectedTemplateFamily?.name ?? "",
                      status: overview.selectedTemplateFamily?.status ?? "draft",
                    })
                  }
                >
                  Reset Selected Family
                </button>
              </div>
            </form>
          ) : null}
        </article>

        <article className="template-governance-panel">
          <div className="template-governance-panel-header">
            <div>
              <h3>Module Templates</h3>
              <p>
                Create governed module drafts inside the selected family, then publish the ones ready
                for release.
              </p>
            </div>
          </div>

          {overview?.selectedTemplateFamily ? (
            <>
              <p className="template-governance-selected-note">
                Selected family: <strong>{overview.selectedTemplateFamily.name}</strong> (
                {overview.selectedTemplateFamily.manuscript_type})
              </p>
              {isEditingModuleTemplate ? (
                <p className="template-governance-selected-note">
                  Editing draft: <strong>{selectedModuleTemplate.module}</strong> v
                  {selectedModuleTemplate.version_no}
                </p>
              ) : null}
              <form className="template-governance-form-grid" onSubmit={handleSubmitModuleTemplateDraft}>
                <label className="template-governance-field">
                  <span>Module</span>
                  <select
                    value={moduleForm.module}
                    disabled={isEditingModuleTemplate}
                    onChange={(event) =>
                      setModuleForm((current) => ({
                        ...current,
                        module: event.target.value as ModuleTemplateFormState["module"],
                      }))
                    }
                  >
                    {templateModules.map((module) => (
                      <option key={module} value={module}>
                        {module}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="template-governance-field template-governance-field-full">
                  <span>Prompt</span>
                  <textarea
                    rows={5}
                    value={moduleForm.prompt}
                    onChange={(event) =>
                      setModuleForm((current) => ({ ...current, prompt: event.target.value }))
                    }
                    placeholder="Describe the governed module behavior for this manuscript family."
                  />
                </label>
                <label className="template-governance-field">
                  <span>Checklist</span>
                  <input
                    value={moduleForm.checklist}
                    onChange={(event) =>
                      setModuleForm((current) => ({ ...current, checklist: event.target.value }))
                    }
                    placeholder="comma-separated"
                  />
                </label>
                <label className="template-governance-field">
                  <span>Section Requirements</span>
                  <input
                    value={moduleForm.sectionRequirements}
                    onChange={(event) =>
                      setModuleForm((current) => ({
                        ...current,
                        sectionRequirements: event.target.value,
                      }))
                    }
                    placeholder="comma-separated"
                  />
                </label>
                <div className="template-governance-actions template-governance-actions-full">
                  <button type="submit" disabled={isBusy}>
                    {isBusy
                      ? "Saving..."
                      : isEditingModuleTemplate
                        ? "Save Draft Changes"
                        : "Create Module Draft"}
                  </button>
                  <button type="button" disabled={isBusy} onClick={handleResetModuleTemplateForm}>
                    {isEditingModuleTemplate ? "Cancel Editing" : "Reset Draft Form"}
                  </button>
                </div>
              </form>

              {overview.moduleTemplates.length ? (
                <ul className="template-governance-list">
                  {overview.moduleTemplates.map((moduleTemplate) => (
                    <li key={moduleTemplate.id} className="template-governance-card">
                      <div>
                        <strong>
                          {moduleTemplate.module} · v{moduleTemplate.version_no}
                        </strong>
                        <small>
                          {moduleTemplate.status} · {moduleTemplate.manuscript_type}
                        </small>
                      </div>
                      <p>{moduleTemplate.prompt}</p>
                      <div className="template-governance-chip-row">
                        {(moduleTemplate.checklist ?? []).map((item) => (
                          <span key={item} className="template-governance-chip">
                            {item}
                          </span>
                        ))}
                        {(moduleTemplate.section_requirements ?? []).map((item) => (
                          <span
                            key={item}
                            className="template-governance-chip template-governance-chip-secondary"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                      {moduleTemplate.status === "draft" ? (
                        <div className="template-governance-actions">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleEditModuleTemplate(moduleTemplate.id)}
                          >
                            {selectedModuleTemplateId === moduleTemplate.id
                              ? "Editing Draft"
                              : "Edit Draft"}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handlePublishModuleTemplate(moduleTemplate.id)}
                          >
                            Publish Draft
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="template-governance-empty">
                  This family has no module templates yet.
                </p>
              )}
            </>
          ) : (
            <p className="template-governance-empty">
              Select or create a template family to manage module templates.
            </p>
          )}
        </article>

        <article className="template-governance-panel template-governance-panel-wide">
          <div className="template-governance-panel-header">
            <div>
              <h3>Knowledge Library</h3>
              <p>
                Search knowledge items, inspect what is already bound to the selected family, and
                create or update governed drafts.
              </p>
            </div>
          </div>

          <div className="template-governance-toolbar">
            <label className="template-governance-field">
              <span>Search</span>
              <input
                value={overview?.filters.searchText ?? ""}
                onChange={(event) => handleSearchTextChange(event.target.value)}
                placeholder="title, summary, risk tag, template binding"
              />
            </label>
            <label className="template-governance-field">
              <span>Status</span>
              <select
                value={overview?.filters.knowledgeStatus ?? "all"}
                onChange={(event) =>
                  handleKnowledgeStatusChange(
                    event.target.value as TemplateGovernanceWorkbenchFilters["knowledgeStatus"],
                  )
                }
              >
                {knowledgeStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="template-governance-knowledge-grid">
            <div className="template-governance-knowledge-list">
              <h4>Visible Knowledge</h4>
              {overview?.visibleKnowledgeItems.length ? (
                <ul className="template-governance-list">
                  {overview.visibleKnowledgeItems.map((item) => {
                    const isActive = item.id === overview.selectedKnowledgeItemId;
                    const isBound = overview.boundKnowledgeItems.some(
                      (boundItem) => boundItem.id === item.id,
                    );
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={`template-governance-list-button${isActive ? " is-active" : ""}`}
                          onClick={() => handleKnowledgeItemSelection(item.id)}
                        >
                          <span>{item.title}</span>
                          <small>
                            {item.status} · {item.knowledge_kind}
                            {isBound ? " · bound" : ""}
                          </small>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="template-governance-empty">
                  No knowledge items matched the current filters.
                </p>
              )}
            </div>

            <div className="template-governance-knowledge-detail">
              <h4>Selected Knowledge</h4>
              {selectedKnowledgeItem ? (
                <article className="template-governance-card">
                  <strong>{selectedKnowledgeItem.title}</strong>
                  <small>
                    {selectedKnowledgeItem.status} · {selectedKnowledgeItem.knowledge_kind}
                  </small>
                  <p>{selectedKnowledgeItem.summary ?? selectedKnowledgeItem.canonical_text}</p>
                  <div className="template-governance-chip-row">
                    {(selectedKnowledgeItem.template_bindings ?? []).map((binding) => (
                      <span key={binding} className="template-governance-chip">
                        {binding}
                      </span>
                    ))}
                  </div>
                </article>
              ) : (
                <p className="template-governance-empty">
                  Select a knowledge item to inspect its current governed state.
                </p>
              )}

              <form className="template-governance-form-grid" onSubmit={handleSubmitKnowledgeDraft}>
                <label className="template-governance-field">
                  <span>Title</span>
                  <input
                    value={knowledgeForm.title}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="Knowledge draft title"
                  />
                </label>
                <label className="template-governance-field">
                  <span>Knowledge Kind</span>
                  <select
                    value={knowledgeForm.knowledgeKind}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({
                        ...current,
                        knowledgeKind: event.target.value as KnowledgeKind,
                      }))
                    }
                  >
                    {knowledgeKinds.map((knowledgeKind) => (
                      <option key={knowledgeKind} value={knowledgeKind}>
                        {knowledgeKind}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="template-governance-field template-governance-field-full">
                  <span>Canonical Text</span>
                  <textarea
                    rows={6}
                    value={knowledgeForm.canonicalText}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({
                        ...current,
                        canonicalText: event.target.value,
                      }))
                    }
                    placeholder="Normalized governed knowledge text"
                  />
                </label>
                <label className="template-governance-field template-governance-field-full">
                  <span>Summary</span>
                  <textarea
                    rows={3}
                    value={knowledgeForm.summary}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({ ...current, summary: event.target.value }))
                    }
                    placeholder="Operator-facing short summary"
                  />
                </label>
                <label className="template-governance-field">
                  <span>Module Scope</span>
                  <select
                    value={knowledgeForm.moduleScope}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({
                        ...current,
                        moduleScope: event.target.value as KnowledgeDraftFormState["moduleScope"],
                      }))
                    }
                  >
                    <option value="any">any</option>
                    {templateModules.map((module) => (
                      <option key={module} value={module}>
                        {module}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="template-governance-field">
                  <span>Manuscript Types</span>
                  <input
                    value={knowledgeForm.manuscriptTypes}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({
                        ...current,
                        manuscriptTypes: event.target.value,
                      }))
                    }
                    placeholder="review, clinical_study or any"
                  />
                </label>
                <label className="template-governance-field template-governance-field-full">
                  <span>Template Bindings</span>
                  <input
                    value={knowledgeForm.templateBindings}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({
                        ...current,
                        templateBindings: event.target.value,
                      }))
                    }
                    placeholder="template ids, comma-separated"
                  />
                </label>
                <label className="template-governance-field">
                  <span>Aliases</span>
                  <input
                    value={knowledgeForm.aliases}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({ ...current, aliases: event.target.value }))
                    }
                    placeholder="comma-separated"
                  />
                </label>
                <label className="template-governance-field">
                  <span>Sections</span>
                  <input
                    value={knowledgeForm.sections}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({ ...current, sections: event.target.value }))
                    }
                    placeholder="methods, results"
                  />
                </label>
                <label className="template-governance-field">
                  <span>Risk Tags</span>
                  <input
                    value={knowledgeForm.riskTags}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({ ...current, riskTags: event.target.value }))
                    }
                    placeholder="statistics, ethics"
                  />
                </label>
                <label className="template-governance-field">
                  <span>Discipline Tags</span>
                  <input
                    value={knowledgeForm.disciplineTags}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({
                        ...current,
                        disciplineTags: event.target.value,
                      }))
                    }
                    placeholder="cardiology"
                  />
                </label>
                <label className="template-governance-field">
                  <span>Evidence Level</span>
                  <select
                    value={knowledgeForm.evidenceLevel}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({
                        ...current,
                        evidenceLevel: event.target.value as EvidenceLevel,
                      }))
                    }
                  >
                    {evidenceLevels.map((evidenceLevel) => (
                      <option key={evidenceLevel} value={evidenceLevel}>
                        {evidenceLevel}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="template-governance-field">
                  <span>Source Type</span>
                  <select
                    value={knowledgeForm.sourceType}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({
                        ...current,
                        sourceType: event.target.value as KnowledgeSourceType,
                      }))
                    }
                  >
                    {knowledgeSourceTypes.map((sourceType) => (
                      <option key={sourceType} value={sourceType}>
                        {sourceType}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="template-governance-field template-governance-field-full">
                  <span>Source Link</span>
                  <input
                    value={knowledgeForm.sourceLink}
                    onChange={(event) =>
                      setKnowledgeForm((current) => ({
                        ...current,
                        sourceLink: event.target.value,
                      }))
                    }
                    placeholder="https://example.org/source"
                  />
                </label>
                <div className="template-governance-actions template-governance-actions-full">
                  <button type="submit" disabled={isBusy}>
                    {isBusy
                      ? "Saving..."
                      : isEditingDraft
                        ? "Save Draft"
                        : "Create Knowledge Draft"}
                  </button>
                  <button type="button" disabled={isBusy} onClick={handleResetKnowledgeDraft}>
                    Reset Draft Form
                  </button>
                  <button
                    type="button"
                    disabled={isBusy || !isEditingDraft}
                    onClick={() => void handleSubmitForReview()}
                  >
                    Submit Draft for Review
                  </button>
                  <button
                    type="button"
                    disabled={isBusy || !selectedKnowledgeItem}
                    onClick={() => void handleArchiveKnowledgeItem()}
                  >
                    Archive Selected
                  </button>
                </div>
              </form>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

function createKnowledgeDraftFormState(input: {
  manuscriptType?: ManuscriptType;
  templateBindings?: string[];
} = {}): KnowledgeDraftFormState {
  return {
    title: "",
    canonicalText: "",
    summary: "",
    knowledgeKind: "rule",
    moduleScope: "any",
    manuscriptTypes: input.manuscriptType ?? "any",
    templateBindings: (input.templateBindings ?? []).join(", "),
    aliases: "",
    sections: "",
    riskTags: "",
    disciplineTags: "",
    evidenceLevel: "unknown",
    sourceType: "other",
    sourceLink: "",
  };
}

function toModuleTemplateFormState(
  moduleTemplate: Pick<
    ModuleTemplateViewModel,
    "module" | "prompt" | "checklist" | "section_requirements"
  >,
): ModuleTemplateFormState {
  return {
    module: moduleTemplate.module,
    prompt: moduleTemplate.prompt,
    checklist: (moduleTemplate.checklist ?? []).join(", "),
    sectionRequirements: (moduleTemplate.section_requirements ?? []).join(", "),
  };
}

function resolveSelectedModuleTemplate(
  moduleTemplates: readonly ModuleTemplateViewModel[],
  moduleTemplateId: string | null,
): ModuleTemplateViewModel | null {
  if (!moduleTemplateId) {
    return null;
  }

  return moduleTemplates.find((template) => template.id === moduleTemplateId) ?? null;
}

function toKnowledgeDraftFormState(item: {
  title: string;
  canonical_text: string;
  summary?: string;
  knowledge_kind: KnowledgeKind;
  routing: {
    module_scope: string;
    manuscript_types: ManuscriptType[] | "any";
    sections?: string[];
    risk_tags?: string[];
    discipline_tags?: string[];
  };
  aliases?: string[];
  template_bindings?: string[];
  evidence_level?: EvidenceLevel;
  source_type?: KnowledgeSourceType;
  source_link?: string;
}): KnowledgeDraftFormState {
  return {
    title: item.title,
    canonicalText: item.canonical_text,
    summary: item.summary ?? "",
    knowledgeKind: item.knowledge_kind,
    moduleScope: isEditableModuleScope(item.routing.module_scope)
      ? item.routing.module_scope
      : "any",
    manuscriptTypes:
      item.routing.manuscript_types === "any"
        ? "any"
        : item.routing.manuscript_types.join(", "),
    templateBindings: (item.template_bindings ?? []).join(", "),
    aliases: (item.aliases ?? []).join(", "),
    sections: (item.routing.sections ?? []).join(", "),
    riskTags: (item.routing.risk_tags ?? []).join(", "),
    disciplineTags: (item.routing.discipline_tags ?? []).join(", "),
    evidenceLevel: item.evidence_level ?? "unknown",
    sourceType: item.source_type ?? "other",
    sourceLink: item.source_link ?? "",
  };
}

function splitCommaSeparatedValues(value: string): string[] | undefined {
  const values = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return values.length > 0 ? values : undefined;
}

function optionalTrimmedValue(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseManuscriptTypes(value: string): ManuscriptType[] | "any" {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.toLowerCase() === "any") {
    return "any";
  }

  return trimmed
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry): entry is ManuscriptType => manuscriptTypes.includes(entry as ManuscriptType));
}

function isEditableModuleScope(
  value: string,
): value is KnowledgeDraftFormState["moduleScope"] {
  return value === "any" || value === "screening" || value === "editing" || value === "proofreading";
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof BrowserHttpClientError) {
    const body =
      typeof error.responseBody === "string"
        ? error.responseBody
        : JSON.stringify(error.responseBody);
    return `${fallback}: HTTP ${error.status} ${body}`;
  }

  return error instanceof Error ? error.message : fallback;
}
