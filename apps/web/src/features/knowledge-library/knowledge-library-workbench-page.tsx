import { useEffect, useMemo, useRef, useState } from "react";
import { formatWorkbenchHash } from "../../app/workbench-routing.ts";
import { WorkbenchCoreStrip } from "../../app/workbench-core-strip.tsx";
import { createBrowserHttpClient } from "../../lib/browser-http-client.ts";
import {
  SearchableMultiSelectField,
  type SearchableMultiSelectOption,
} from "../../lib/searchable-multi-select.tsx";
import type { AuthRole } from "../auth/index.ts";
import type { KnowledgeKind } from "../knowledge/index.ts";
import type { ManuscriptModule, ManuscriptType } from "../manuscripts/types.ts";
import {
  EDITORIAL_EVIDENCE_LEVEL_OPTIONS,
  EDITORIAL_KNOWLEDGE_SOURCE_TYPE_OPTIONS,
  EDITORIAL_MANUSCRIPT_TYPE_OPTIONS,
  EDITORIAL_SECTION_OPTIONS,
  KNOWLEDGE_ENTRY_KIND_OPTIONS,
  KNOWLEDGE_MODULE_SCOPE_OPTIONS,
  type KnowledgeKindRuleLabelVariant,
  formatEditorialEvidenceLevelLabel,
  formatEditorialKnowledgeKindLabel,
  formatEditorialKnowledgeSourceTypeLabel,
  formatEditorialManuscriptTypeLabel,
  formatEditorialModuleLabel,
  formatEditorialSectionLabel,
} from "../shared/editorial-taxonomy.ts";
import {
  createKnowledgeLibraryWorkbenchController,
  type KnowledgeLibraryWorkbenchController,
} from "./knowledge-library-controller.ts";
import {
  listJournalTemplateProfilesByTemplateFamilyId,
  listModuleTemplatesByTemplateFamilyId,
  listTemplateFamilies,
} from "../templates/template-api.ts";
import { listManuscriptQualityPackages } from "../manuscript-quality-packages/manuscript-quality-packages-api.ts";
import {
  buildQualityPackageKindBindingKeywords,
  formatQualityPackageBindingDisplayLabel,
  formatQualityPackageExactBindingLabel,
  formatQualityPackageKindBindingLabel,
  formatQualityPackageKindBindingMeta,
} from "../manuscript-quality-packages/binding-kind-options.ts";
import { KnowledgeLibraryDuplicatePanel } from "./knowledge-library-duplicate-panel.tsx";
import { createKnowledgeLibraryEvidenceGateSummary } from "./knowledge-library-evidence-gate.ts";
import { KnowledgeLibraryGridTable } from "./knowledge-library-grid-table.tsx";
import { KnowledgeLibraryGridToolbar } from "./knowledge-library-grid-toolbar.tsx";
import { KnowledgeLibraryRecordDrawer } from "./knowledge-library-record-drawer.tsx";
import { KnowledgeLibraryRichContentEditor } from "./knowledge-library-rich-content-editor.tsx";
import { KnowledgeLibrarySemanticPanel } from "./knowledge-library-semantic-panel.tsx";
import type {
  CreateKnowledgeLibraryDraftInput,
  KnowledgeContentBlockViewModel,
  DuplicateKnowledgeCheckInput,
  DuplicateKnowledgeMatchViewModel,
  DuplicateWarningAcknowledgementInput,
  KnowledgeLibraryFilterState,
  KnowledgeSemanticLayerInput,
  KnowledgeSemanticLayerViewModel,
  KnowledgeUploadInput,
  KnowledgeUploadViewModel,
  KnowledgeLibraryWorkbenchViewModel,
  KnowledgeRevisionBindingInput,
  KnowledgeRevisionBindingKind,
  UpdateKnowledgeLibraryDraftInput,
} from "./types.ts";

if (typeof document !== "undefined") {
  void import("./knowledge-library-workbench.css");
}

export type KnowledgeLibraryDuplicateCheckState =
  | "not_checked"
  | "checking"
  | "checked"
  | "error";

export interface KnowledgeLibraryWorkbenchPageProps {
  controller?: KnowledgeLibraryWorkbenchController;
  actorRole?: AuthRole;
  initialViewModel?: KnowledgeLibraryWorkbenchViewModel | null;
  prefilledAssetId?: string;
  prefilledRevisionId?: string;
}

export interface KnowledgeLibraryFormState {
  title: string;
  canonicalText: string;
  summary: string;
  knowledgeKind: KnowledgeKind;
  moduleScope: ManuscriptModule | "any";
  manuscriptTypes: ManuscriptType[] | "any";
  sections: string[];
  riskTags: string[];
  disciplineTags: string[];
  aliases: string[];
  evidenceLevel: string;
  sourceType: string;
  sourceLink: string;
  effectiveAt: string;
  expiresAt: string;
  bindings: KnowledgeRevisionBindingInput[];
}

interface DuplicateCheckDraftFields {
  title: string;
  canonicalText: string;
  summary: string;
  knowledgeKind: KnowledgeKind;
  moduleScope: ManuscriptModule | "any";
  manuscriptTypes: ManuscriptType[] | "any";
  sections: string[];
  riskTags: string[];
  disciplineTags: string[];
  aliases: string[];
  bindings: KnowledgeRevisionBindingInput[];
}

interface KnowledgeLibraryBindingCatalog {
  templateFamilyOptions: SearchableMultiSelectOption[];
  moduleTemplateOptions: SearchableMultiSelectOption[];
  journalTemplateOptions: SearchableMultiSelectOption[];
  generalPackageOptions: SearchableMultiSelectOption[];
  medicalPackageOptions: SearchableMultiSelectOption[];
  knowledgeItemOptions: SearchableMultiSelectOption[];
  sectionOptions: SearchableMultiSelectOption[];
}

interface ImmediateDuplicateCheckContext {
  selectedRevisionId: string | null;
  duplicateCheckSignature: string | null;
}

const defaultHttpClient = createBrowserHttpClient();

const defaultController = createKnowledgeLibraryWorkbenchController(defaultHttpClient);

const knowledgeKindEntryOptions: readonly KnowledgeKind[] = KNOWLEDGE_ENTRY_KIND_OPTIONS;

const moduleOptions: ReadonlyArray<ManuscriptModule | "any"> =
  KNOWLEDGE_MODULE_SCOPE_OPTIONS;

const evidenceLevelOptions = EDITORIAL_EVIDENCE_LEVEL_OPTIONS;

const sourceTypeOptions = EDITORIAL_KNOWLEDGE_SOURCE_TYPE_OPTIONS;

const manuscriptTypeOptions: readonly ManuscriptType[] = EDITORIAL_MANUSCRIPT_TYPE_OPTIONS;

const sectionOptions = EDITORIAL_SECTION_OPTIONS;

const knowledgeLibraryBindingFieldDefinitions: ReadonlyArray<{
  kind: KnowledgeRevisionBindingKind;
  label: string;
  helpText: string;
  dataKey: string;
  getOptions(catalog: KnowledgeLibraryBindingCatalog): SearchableMultiSelectOption[];
}> = [
  {
    kind: "template_family",
    label: "模板族",
    helpText: "决定哪些模板族会默认命中这条知识。",
    dataKey: "binding-template-families",
    getOptions: (catalog) => catalog.templateFamilyOptions,
  },
  {
    kind: "module_template",
    label: "模块模板",
    helpText: "把知识直接挂到具体执行模块模板上。",
    dataKey: "binding-module-templates",
    getOptions: (catalog) => catalog.moduleTemplateOptions,
  },
  {
    kind: "journal_template",
    label: "期刊模板",
    helpText: "把知识绑定到具体期刊格式模板。",
    dataKey: "binding-journal-templates",
    getOptions: (catalog) => catalog.journalTemplateOptions,
  },
  {
    kind: "general_package",
    label: "通用包",
    helpText: "校对和编辑通用规则会从这里按包复用。",
    dataKey: "binding-general-packages",
    getOptions: (catalog) => catalog.generalPackageOptions,
  },
  {
    kind: "medical_package",
    label: "医学专用包",
    helpText: "医学专用规则和知识会从这里按包复用。",
    dataKey: "binding-medical-packages",
    getOptions: (catalog) => catalog.medicalPackageOptions,
  },
  {
    kind: "knowledge_item",
    label: "关联知识项",
    helpText: "把这条知识和其他已批准知识建立复用关系。",
    dataKey: "binding-knowledge-items",
    getOptions: (catalog) => catalog.knowledgeItemOptions,
  },
  {
    kind: "section",
    label: "绑定章节",
    helpText: "这里是复用命中章节，不等于上面的章节标签。",
    dataKey: "binding-sections",
    getOptions: (catalog) => catalog.sectionOptions,
  },
];

const defaultFormState: KnowledgeLibraryFormState = {
  title: "",
  canonicalText: "",
  summary: "",
  knowledgeKind: "reference",
  moduleScope: "any",
  manuscriptTypes: "any",
  sections: [],
  riskTags: [],
  disciplineTags: [],
  aliases: [],
  evidenceLevel: "unknown",
  sourceType: "other",
  sourceLink: "",
  effectiveAt: "",
  expiresAt: "",
  bindings: [],
};

function createInitialKnowledgeLibraryBindingCatalog(): KnowledgeLibraryBindingCatalog {
  return {
    templateFamilyOptions: [],
    moduleTemplateOptions: [],
    journalTemplateOptions: [],
    generalPackageOptions: [],
    medicalPackageOptions: [],
    knowledgeItemOptions: [],
    sectionOptions: sectionOptions.map((section) => ({
      value: section,
      label: formatKnowledgeLibrarySection(section),
      keywords: [section, formatKnowledgeLibrarySection(section)],
    })),
  };
}

async function loadKnowledgeLibraryBindingCatalog(
  client = defaultHttpClient,
): Promise<KnowledgeLibraryBindingCatalog> {
  const templateFamiliesResponse = await listTemplateFamilies(client);
  const templateFamilies = templateFamiliesResponse.body.filter(
    (family) => family.status !== "archived",
  );

  const [
    moduleTemplatesByFamily,
    journalTemplatesByFamily,
    generalPackagesResponse,
    medicalPackagesResponse,
  ] = await Promise.all([
    Promise.all(
      templateFamilies.map(async (family) => ({
        family,
        templates: (
          await listModuleTemplatesByTemplateFamilyId(client, family.id)
        ).body.filter((template) => template.status === "published"),
      })),
    ),
    Promise.all(
      templateFamilies.map(async (family) => ({
        family,
        templates: (
          await listJournalTemplateProfilesByTemplateFamilyId(client, family.id)
        ).body.filter((template) => template.status === "active"),
      })),
    ),
    listManuscriptQualityPackages(client, {
      packageKind: "general_style_package",
      status: "published",
    }),
    listManuscriptQualityPackages(client, {
      packageKind: "medical_analyzer_package",
      status: "published",
    }),
  ]);

  return {
    templateFamilyOptions: sortSearchableOptions(
      templateFamilies.map((family) => ({
        value: family.id,
        label: family.name,
        meta: `${formatKnowledgeLibraryManuscriptType(family.manuscript_type)} · ${formatKnowledgeLibraryTemplateFamilyStatus(family.status)}`,
        group: formatKnowledgeLibraryManuscriptType(family.manuscript_type),
        keywords: [family.name, family.id, family.manuscript_type],
      })),
    ),
    moduleTemplateOptions: sortSearchableOptions(
      moduleTemplatesByFamily.flatMap(({ family, templates }) =>
        templates.map((template) => ({
          value: template.id,
          label: `${formatKnowledgeLibraryModuleScope(template.module)} v${template.version_no}`,
          meta: `${family.name} · ${formatKnowledgeLibraryManuscriptType(template.manuscript_type)}`,
          group: family.name,
          keywords: [
            template.id,
            family.name,
            template.module,
            template.manuscript_type,
            `${template.version_no}`,
          ],
        })),
      ),
    ),
    journalTemplateOptions: sortSearchableOptions(
      journalTemplatesByFamily.flatMap(({ family, templates }) =>
        templates.map((template) => ({
          value: template.id,
          label: template.journal_name,
          meta: `${family.name} · ${template.journal_key}`,
          group: family.name,
          keywords: [
            template.id,
            template.journal_name,
            template.journal_key,
            family.name,
          ],
        })),
      ),
    ),
    generalPackageOptions: sortSearchableOptions(
      generalPackagesResponse.body
        .map((record) => ({
          value: record.id,
          label: formatQualityPackageExactBindingLabel({
            packageName: record.package_name,
            version: record.version,
            packageKind: record.package_kind,
          }),
          meta: "通用包 · 锁定具体版本",
          keywords: [
            record.id,
            record.package_name,
            `${record.version}`,
            "通用包",
            "锁定具体版本",
          ],
        }))
        .concat({
          value: "general_style_package",
          label: formatQualityPackageKindBindingLabel("general_style_package"),
          meta: formatQualityPackageKindBindingMeta("general_style_package"),
          keywords: buildQualityPackageKindBindingKeywords("general_style_package"),
        }),
    ),
    medicalPackageOptions: sortSearchableOptions(
      medicalPackagesResponse.body
        .map((record) => ({
          value: record.id,
          label: formatQualityPackageExactBindingLabel({
            packageName: record.package_name,
            version: record.version,
            packageKind: record.package_kind,
          }),
          meta: "医学专用包 · 锁定具体版本",
          keywords: [
            record.id,
            record.package_name,
            `${record.version}`,
            "医学专用包",
            "锁定具体版本",
          ],
        }))
        .concat({
          value: "medical_analyzer_package",
          label: formatQualityPackageKindBindingLabel("medical_analyzer_package"),
          meta: formatQualityPackageKindBindingMeta("medical_analyzer_package"),
          keywords: buildQualityPackageKindBindingKeywords("medical_analyzer_package"),
        }),
    ),
    knowledgeItemOptions: [],
    sectionOptions: createInitialKnowledgeLibraryBindingCatalog().sectionOptions,
  };
}

export function KnowledgeLibraryWorkbenchPage({
  controller = defaultController,
  actorRole = "knowledge_reviewer",
  initialViewModel = null,
  prefilledAssetId,
  prefilledRevisionId,
}: KnowledgeLibraryWorkbenchPageProps) {
  const initialFormState = createKnowledgeLibraryFormState(initialViewModel?.detail ?? null);
  const latestFormStateRef = useRef(initialFormState);
  const [viewModel, setViewModel] = useState<KnowledgeLibraryWorkbenchViewModel | null>(
    initialViewModel,
  );
  const [formState, setFormState] = useState<KnowledgeLibraryFormState>(() => initialFormState);
  const latestFormDraftSignatureRef = useRef(
    serializeConfirmationDraftSignature(initialFormState),
  );
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">(
    initialViewModel ? "ready" : "idle",
  );
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateKnowledgeMatchViewModel[]>(
    [],
  );
  const [duplicateCheckErrorMessage, setDuplicateCheckErrorMessage] = useState<string | null>(
    null,
  );
  const [isImmediateDuplicateCheckPending, setIsImmediateDuplicateCheckPending] =
    useState(false);
  const [duplicateCheckState, setDuplicateCheckState] =
    useState<KnowledgeLibraryDuplicateCheckState>("not_checked");
  const [lastCheckedDuplicateSignature, setLastCheckedDuplicateSignature] = useState<
    string | null
  >(null);
  const [pendingSubmitStrongMatches, setPendingSubmitStrongMatches] = useState<
    DuplicateKnowledgeMatchViewModel[]
  >([]);
  const [isDuplicateSubmitConfirmationOpen, setIsDuplicateSubmitConfirmationOpen] =
    useState(false);
  const [duplicateConfirmationDraftSignature, setDuplicateConfirmationDraftSignature] =
    useState<string | null>(null);
  const [contentBlocksDraft, setContentBlocksDraft] = useState<KnowledgeContentBlockViewModel[]>(
    () => initialViewModel?.detail?.selected_revision.content_blocks ?? [],
  );
  const [semanticLayerDraft, setSemanticLayerDraft] = useState<
    KnowledgeSemanticLayerViewModel | undefined
  >(() => initialViewModel?.detail?.selected_revision.semantic_layer);
  const [bindingCatalog, setBindingCatalog] = useState<KnowledgeLibraryBindingCatalog>(
    () => createInitialKnowledgeLibraryBindingCatalog(),
  );
  const [bindingCatalogStatus, setBindingCatalogStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [bindingCatalogError, setBindingCatalogError] = useState<string | null>(null);
  const duplicateCheckRequestIdRef = useRef(0);
  const latestDuplicateCheckContextRef =
    useRef<ImmediateDuplicateCheckContext>({
      selectedRevisionId: null,
      duplicateCheckSignature: null,
    });

  const normalizedPrefilledAssetId = prefilledAssetId?.trim() ?? "";
  const normalizedPrefilledRevisionId = prefilledRevisionId?.trim() ?? "";

  useEffect(() => {
    let isActive = true;
    setBindingCatalogStatus("loading");
    setBindingCatalogError(null);
    void loadKnowledgeLibraryBindingCatalog()
      .then((catalog) => {
        if (!isActive) {
          return;
        }
        setBindingCatalog(catalog);
        setBindingCatalogStatus("ready");
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }
        setBindingCatalogStatus("error");
        setBindingCatalogError(
          error instanceof Error ? error.message : "绑定选项加载失败。",
        );
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (initialViewModel) {
      const nextFormState = createKnowledgeLibraryFormState(initialViewModel.detail);
      setViewModel(initialViewModel);
      latestFormStateRef.current = nextFormState;
      latestFormDraftSignatureRef.current = serializeConfirmationDraftSignature(nextFormState);
      setFormState(nextFormState);
      setContentBlocksDraft(initialViewModel.detail?.selected_revision.content_blocks ?? []);
      setSemanticLayerDraft(initialViewModel.detail?.selected_revision.semantic_layer);
      setLoadStatus("ready");
      return;
    }

    void loadWorkbench({
      selectedAssetId:
        normalizedPrefilledAssetId.length > 0 ? normalizedPrefilledAssetId : undefined,
      selectedRevisionId:
        normalizedPrefilledRevisionId.length > 0 ? normalizedPrefilledRevisionId : undefined,
    });
  }, [controller, initialViewModel, normalizedPrefilledAssetId, normalizedPrefilledRevisionId]);

  useEffect(() => {
    const nextFormState = createKnowledgeLibraryFormState(viewModel?.detail ?? null);
    latestFormStateRef.current = nextFormState;
    latestFormDraftSignatureRef.current = serializeConfirmationDraftSignature(nextFormState);
    setFormState(nextFormState);
    setIsDuplicateSubmitConfirmationOpen(false);
    setPendingSubmitStrongMatches([]);
    setDuplicateConfirmationDraftSignature(null);
    setDuplicateCheckErrorMessage(null);
    setContentBlocksDraft(viewModel?.detail?.selected_revision.content_blocks ?? []);
    setSemanticLayerDraft(viewModel?.detail?.selected_revision.semantic_layer);
  }, [viewModel?.detail, viewModel?.selectedRevisionId]);

  const duplicateCheckDraftFields = toDuplicateCheckDraftFields(formState);
  const duplicateCheckInput = createDuplicateCheckInput(duplicateCheckDraftFields, {
    currentAssetId: viewModel?.selectedAssetId ?? undefined,
    currentRevisionId: viewModel?.selectedRevisionId ?? undefined,
  });
  const selectedRevisionId = viewModel?.selectedRevisionId ?? null;
  const duplicateCheckSignature = buildDuplicateCheckTriggerSignature(duplicateCheckInput);
  const confirmationCurrentDraftSignature = serializeConfirmationDraftSignature(formState);
  const strongDuplicateMatches = getStrongDuplicateMatches(duplicateMatches);
  const firstPendingStrongDuplicateMatch = pendingSubmitStrongMatches[0] ?? null;
  const isDuplicateResultStale =
    duplicateCheckState === "checked" &&
    duplicateCheckSignature != null &&
    lastCheckedDuplicateSignature != null &&
    duplicateCheckSignature !== lastCheckedDuplicateSignature;
  const resolvedBindingCatalog = useMemo(
    () =>
      resolveKnowledgeLibraryBindingCatalog({
        catalog: bindingCatalog,
        bindings: formState.bindings,
        libraryItems: viewModel?.library ?? [],
        selectedAssetId: viewModel?.selectedAssetId ?? null,
      }),
    [bindingCatalog, formState.bindings, viewModel?.library, viewModel?.selectedAssetId],
  );
  const normalizedStructuredBindings = normalizeKnowledgeBindings(formState.bindings) ?? [];

  useEffect(() => {
    latestFormDraftSignatureRef.current = confirmationCurrentDraftSignature;
  }, [confirmationCurrentDraftSignature]);

  useEffect(() => {
    latestDuplicateCheckContextRef.current = {
      selectedRevisionId,
      duplicateCheckSignature,
    };
  }, [selectedRevisionId, duplicateCheckSignature]);

  useEffect(() => {
    duplicateCheckRequestIdRef.current += 1;
    setIsImmediateDuplicateCheckPending(false);
  }, [selectedRevisionId, duplicateCheckSignature]);

  useEffect(() => {
    if (
      !shouldInvalidateDuplicateSubmitConfirmation({
        isConfirmationOpen: isDuplicateSubmitConfirmationOpen,
        confirmationDraftSignature: duplicateConfirmationDraftSignature,
        currentDraftSignature: confirmationCurrentDraftSignature,
      })
    ) {
      return;
    }

    setIsDuplicateSubmitConfirmationOpen(false);
    setPendingSubmitStrongMatches([]);
    setDuplicateConfirmationDraftSignature(null);
  }, [
    confirmationCurrentDraftSignature,
    duplicateConfirmationDraftSignature,
    isDuplicateSubmitConfirmationOpen,
  ]);

  useEffect(() => {
    if (!duplicateCheckInput || !duplicateCheckSignature) {
      setDuplicateCheckState("not_checked");
      setDuplicateMatches([]);
      setDuplicateCheckErrorMessage(null);
      setLastCheckedDuplicateSignature(null);
      return;
    }

    let cancelled = false;
    const requestId = duplicateCheckRequestIdRef.current + 1;
    duplicateCheckRequestIdRef.current = requestId;
    const requestContext: ImmediateDuplicateCheckContext = {
      selectedRevisionId,
      duplicateCheckSignature,
    };
    setDuplicateMatches([]);
    setDuplicateCheckState("checking");
    setDuplicateCheckErrorMessage(null);

    const timer = globalThis.setTimeout(async () => {
      if (
        isImmediateDuplicateCheckResultStale({
          requestId,
          latestRequestId: duplicateCheckRequestIdRef.current,
          expectedContext: requestContext,
          currentContext: latestDuplicateCheckContextRef.current,
        })
      ) {
        return;
      }

      try {
        const matches = await controller.checkDuplicates(duplicateCheckInput);
        if (
          cancelled ||
          isImmediateDuplicateCheckResultStale({
            requestId,
            latestRequestId: duplicateCheckRequestIdRef.current,
            expectedContext: requestContext,
            currentContext: latestDuplicateCheckContextRef.current,
          })
        ) {
          return;
        }

        setDuplicateMatches(matches);
        setDuplicateCheckState("checked");
        setDuplicateCheckErrorMessage(null);
        setLastCheckedDuplicateSignature(duplicateCheckSignature);
      } catch (error) {
        if (
          cancelled ||
          isImmediateDuplicateCheckResultStale({
            requestId,
            latestRequestId: duplicateCheckRequestIdRef.current,
            expectedContext: requestContext,
            currentContext: latestDuplicateCheckContextRef.current,
          })
        ) {
          return;
        }

        setDuplicateMatches([]);
        setDuplicateCheckState("error");
        setDuplicateCheckErrorMessage(toErrorMessage(error, "Duplicate check failed"));
        setLastCheckedDuplicateSignature(null);
      }
    }, 450);

    return () => {
      cancelled = true;
      globalThis.clearTimeout(timer);
    };
  }, [controller, duplicateCheckSignature]);

  async function loadWorkbench(input: {
    selectedAssetId?: string;
    selectedRevisionId?: string;
    filters?: Partial<KnowledgeLibraryFilterState>;
  } = {}) {
    setLoadStatus("loading");
    setErrorMessage(null);

    try {
      const nextViewModel = await controller.loadWorkbench({
        selectedAssetId: input.selectedAssetId ?? viewModel?.selectedAssetId ?? null,
        selectedRevisionId: input.selectedRevisionId ?? viewModel?.selectedRevisionId ?? null,
        filters: input.filters ?? viewModel?.filters,
      });
      setViewModel(nextViewModel);
      setLoadStatus("ready");
      setStatusMessage(null);
    } catch (error) {
      setLoadStatus("error");
      setErrorMessage(toErrorMessage(error, "Knowledge library load failed"));
    }
  }

  async function runMutation(
    action: () => Promise<KnowledgeLibraryWorkbenchViewModel>,
    successMessage: string,
  ) {
    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const nextViewModel = await action();
      setViewModel(nextViewModel);
      setLoadStatus("ready");
      setStatusMessage(successMessage);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "Knowledge library action failed"));
    } finally {
      setIsBusy(false);
    }
  }

  function updateFilters(nextFilters: Partial<KnowledgeLibraryFilterState>) {
    void loadWorkbench({
      filters: {
        ...(viewModel?.filters ?? {}),
        ...nextFilters,
      },
      selectedAssetId: viewModel?.selectedAssetId ?? undefined,
      selectedRevisionId: viewModel?.selectedRevisionId ?? undefined,
    });
  }

  function handleSelectAsset(assetId: string) {
    void loadWorkbench({
      selectedAssetId: assetId,
      filters: viewModel?.filters,
    });
  }

  function handleSelectRevision(revisionId: string) {
    if (!viewModel?.selectedAssetId) {
      return;
    }

    void loadWorkbench({
      selectedAssetId: viewModel.selectedAssetId,
      selectedRevisionId: revisionId,
      filters: viewModel.filters,
    });
  }

  function handleStartNewAsset() {
    setViewModel((current) =>
      current == null
        ? current
        : {
            ...current,
            selectedAssetId: null,
            selectedRevisionId: null,
            selectedSummary: null,
            detail: null,
          },
    );
    latestFormStateRef.current = defaultFormState;
    latestFormDraftSignatureRef.current =
      serializeConfirmationDraftSignature(defaultFormState);
    setFormState(defaultFormState);
    setDuplicateMatches([]);
    setDuplicateCheckErrorMessage(null);
    setDuplicateCheckState("not_checked");
    setLastCheckedDuplicateSignature(null);
    setPendingSubmitStrongMatches([]);
    setIsDuplicateSubmitConfirmationOpen(false);
    setDuplicateConfirmationDraftSignature(null);
    setStatusMessage("Draft form cleared for a new knowledge asset.");
    setErrorMessage(null);
  }

  async function handleCreateDraft() {
    setIsDuplicateSubmitConfirmationOpen(false);
    setPendingSubmitStrongMatches([]);
    setDuplicateConfirmationDraftSignature(null);
    await runMutation(
      () =>
        controller.createDraftAndLoad({
          ...toCreateInput(formState),
          filters: viewModel?.filters,
        }),
      "Knowledge asset draft created.",
    );
  }

  async function handleSaveDraft() {
    const revisionId = viewModel?.selectedRevisionId;
    if (!revisionId || !viewModel) {
      return;
    }

    setIsDuplicateSubmitConfirmationOpen(false);
    setPendingSubmitStrongMatches([]);
    setDuplicateConfirmationDraftSignature(null);
    await runMutation(
      () =>
        controller.saveDraftAndLoad({
          revisionId,
          input: toUpdateInput(formState),
          filters: viewModel.filters,
        }),
      "Draft revision saved.",
    );
  }

  async function handleCreateDerivedDraft() {
    const assetId = viewModel?.selectedAssetId;
    if (!assetId || !viewModel) {
      return;
    }

    setIsDuplicateSubmitConfirmationOpen(false);
    setPendingSubmitStrongMatches([]);
    setDuplicateConfirmationDraftSignature(null);
    await runMutation(
      () =>
        controller.createDerivedDraftAndLoad({
          assetId,
          filters: viewModel.filters,
        }),
      "Update draft derived from the approved revision.",
    );
  }

  async function handleSubmitDraft() {
    const revisionId = viewModel?.selectedRevisionId;
    if (!revisionId || !viewModel || isBusy || isImmediateDuplicateCheckPending) {
      return;
    }

    if (selectedRevisionEvidenceGateSummary.hasBlockingIssues) {
      setPendingSubmitStrongMatches([]);
      setIsDuplicateSubmitConfirmationOpen(false);
      setDuplicateConfirmationDraftSignature(null);
      setStatusMessage(null);
      setErrorMessage(
        selectedRevisionEvidenceGateSummary.blockingMessage ??
          "当前已保存富文本版本还有高精度证据未补齐，暂时不能提交审核。",
      );
      return;
    }

    const submitCheckContext: ImmediateDuplicateCheckContext = {
      selectedRevisionId: revisionId,
      duplicateCheckSignature,
    };
    let matchesForSubmitDecision = duplicateMatches;
    const submitDecision = resolveDuplicateSubmitDecision({
      duplicateCheckInput,
      duplicateCheckState,
      duplicateCheckSignature,
      lastCheckedDuplicateSignature,
      matches: matchesForSubmitDecision,
    });
    if (submitDecision === "refresh_check") {
      const freshMatches = await runImmediateDuplicateCheckBeforeSubmit({
        input: duplicateCheckInput,
        signature: duplicateCheckSignature,
        context: submitCheckContext,
      });
      if (freshMatches == null || freshMatches === "stale") {
        return;
      }

      matchesForSubmitDecision = freshMatches;
    }

    const strongMatches = getStrongDuplicateMatches(matchesForSubmitDecision);
    if (strongMatches.length > 0) {
      setPendingSubmitStrongMatches(strongMatches);
      setIsDuplicateSubmitConfirmationOpen(true);
      setDuplicateConfirmationDraftSignature(confirmationCurrentDraftSignature);
      return;
    }

    setPendingSubmitStrongMatches([]);
    setIsDuplicateSubmitConfirmationOpen(false);
    setDuplicateConfirmationDraftSignature(null);
    await runMutation(
      () =>
        controller.submitDraftAndLoad({
          revisionId,
          filters: viewModel.filters,
        }),
      "Draft submitted to knowledge review.",
    );
  }

  async function handleContinueSubmitWithDuplicateAcknowledgement() {
    const revisionId = viewModel?.selectedRevisionId ?? null;
    const continueSubmitDecision = resolveDuplicateAcknowledgementSubmitDecision({
      revisionId,
      hasViewModel: viewModel != null,
      pendingStrongMatchCount: pendingSubmitStrongMatches.length,
      isBusy,
      isImmediateDuplicateCheckPending,
      isConfirmationOpen: isDuplicateSubmitConfirmationOpen,
      confirmationDraftSignature: duplicateConfirmationDraftSignature,
      currentDraftSignature: latestFormDraftSignatureRef.current,
    });
    if (continueSubmitDecision === "blocked") {
      return;
    }

    if (continueSubmitDecision === "stale") {
      setIsDuplicateSubmitConfirmationOpen(false);
      setPendingSubmitStrongMatches([]);
      setDuplicateConfirmationDraftSignature(null);
      setErrorMessage(null);
      setStatusMessage(
        "Draft changed since the duplicate warning opened. Review refreshed duplicate signals before continuing.",
      );
      return;
    }

    if (selectedRevisionEvidenceGateSummary.hasBlockingIssues) {
      setIsDuplicateSubmitConfirmationOpen(false);
      setPendingSubmitStrongMatches([]);
      setDuplicateConfirmationDraftSignature(null);
      setStatusMessage(null);
      setErrorMessage(
        selectedRevisionEvidenceGateSummary.blockingMessage ??
          "当前已保存富文本版本还有高精度证据未补齐，暂时不能提交审核。",
      );
      return;
    }

    if (!revisionId || !viewModel) {
      return;
    }

    const duplicateAcknowledgement: DuplicateWarningAcknowledgementInput = {
      acknowledged: true,
      matches: pendingSubmitStrongMatches.map((match) => ({
        matched_asset_id: match.matched_asset_id,
        matched_revision_id: match.matched_revision_id,
        severity: match.severity,
      })),
    };

    setIsDuplicateSubmitConfirmationOpen(false);
    setPendingSubmitStrongMatches([]);
    setDuplicateConfirmationDraftSignature(null);
    await runMutation(
      () =>
        controller.submitDraftAndLoad({
          revisionId,
          filters: viewModel.filters,
          duplicateAcknowledgement,
        }),
      "Draft submitted to knowledge review.",
    );
  }

  async function handleSaveRichContent() {
    const revisionId = viewModel?.selectedRevisionId;
    if (!revisionId || !viewModel) {
      return;
    }

    await runMutation(
      () =>
        controller.replaceContentBlocksAndLoad({
          revisionId,
          blocks: contentBlocksDraft,
          filters: viewModel.filters,
        }),
      "Rich content saved.",
    );
  }

  function handleSemanticDraftChange(input: KnowledgeSemanticLayerInput) {
    setSemanticLayerDraft((current) => ({
      revision_id: current?.revision_id ?? viewModel?.selectedRevisionId ?? "draft-revision",
      status: current?.status ?? "stale",
      page_summary:
        input.pageSummary ?? current?.page_summary ?? selectedRevision?.semantic_layer?.page_summary,
      retrieval_terms: input.retrievalTerms ?? current?.retrieval_terms,
      retrieval_snippets: input.retrievalSnippets ?? current?.retrieval_snippets,
      table_semantics: input.tableSemantics ?? current?.table_semantics,
      image_understanding: input.imageUnderstanding ?? current?.image_understanding,
    }));
  }

  async function handleRegenerateSemanticLayer() {
    const revisionId = viewModel?.selectedRevisionId;
    if (!revisionId || !viewModel) {
      return;
    }

    await runMutation(
      () =>
        controller.regenerateSemanticLayerAndLoad({
          revisionId,
          filters: viewModel.filters,
        }),
      "AI semantic layer regenerated.",
    );
  }

  async function handleConfirmSemanticLayer() {
    const revisionId = viewModel?.selectedRevisionId;
    if (!revisionId || !viewModel) {
      return;
    }

    await runMutation(
      () =>
        controller.confirmSemanticLayerAndLoad({
          revisionId,
          filters: viewModel.filters,
          input: {
            pageSummary: semanticLayerDraft?.page_summary,
            retrievalTerms: semanticLayerDraft?.retrieval_terms,
            retrievalSnippets: semanticLayerDraft?.retrieval_snippets,
            tableSemantics: semanticLayerDraft?.table_semantics,
            imageUnderstanding: semanticLayerDraft?.image_understanding,
          },
        }),
      "AI semantic layer confirmed.",
    );
  }

  async function handleUploadImage(
    input: KnowledgeUploadInput,
  ): Promise<KnowledgeUploadViewModel | void> {
    return controller.uploadImage(input);
  }

  function handleOpenExistingAsset(match: DuplicateKnowledgeMatchViewModel) {
    setIsDuplicateSubmitConfirmationOpen(false);
    setPendingSubmitStrongMatches([]);
    setDuplicateConfirmationDraftSignature(null);
    void loadWorkbench({
      selectedAssetId: match.matched_asset_id,
      selectedRevisionId: match.matched_revision_id,
      filters: viewModel?.filters,
    });
  }

  async function runImmediateDuplicateCheckBeforeSubmit(input: {
    input: DuplicateKnowledgeCheckInput | null;
    signature: string | null;
    context: ImmediateDuplicateCheckContext;
  }): Promise<DuplicateKnowledgeMatchViewModel[] | null | "stale"> {
    if (!input.input || !input.signature) {
      return [];
    }

    const requestId = duplicateCheckRequestIdRef.current + 1;
    duplicateCheckRequestIdRef.current = requestId;
    setIsImmediateDuplicateCheckPending(true);
    setDuplicateMatches([]);
    setDuplicateCheckState("checking");
    setDuplicateCheckErrorMessage(null);
    try {
      const matches = await controller.checkDuplicates(input.input);
      if (
        isImmediateDuplicateCheckResultStale({
          requestId,
          latestRequestId: duplicateCheckRequestIdRef.current,
          expectedContext: input.context,
          currentContext: latestDuplicateCheckContextRef.current,
        })
      ) {
        return "stale";
      }

      setDuplicateMatches(matches);
      setDuplicateCheckState("checked");
      setDuplicateCheckErrorMessage(null);
      setLastCheckedDuplicateSignature(input.signature);
      return matches;
    } catch (error) {
      if (
        isImmediateDuplicateCheckResultStale({
          requestId,
          latestRequestId: duplicateCheckRequestIdRef.current,
          expectedContext: input.context,
          currentContext: latestDuplicateCheckContextRef.current,
        })
      ) {
        return "stale";
      }

      setDuplicateMatches([]);
      setDuplicateCheckState("error");
      setDuplicateCheckErrorMessage(toErrorMessage(error, "Duplicate check failed"));
      setLastCheckedDuplicateSignature(null);
      return null;
    } finally {
      if (requestId === duplicateCheckRequestIdRef.current) {
        setIsImmediateDuplicateCheckPending(false);
      }
    }
  }

  function updateDraftFormState(
    updater: (current: KnowledgeLibraryFormState) => KnowledgeLibraryFormState,
  ) {
    const next = updater(latestFormStateRef.current);
    latestFormStateRef.current = next;
    latestFormDraftSignatureRef.current = serializeConfirmationDraftSignature(next);
    setFormState(next);
  }

  const selectedRevision = viewModel?.detail?.selected_revision ?? null;
  const selectedApprovedRevision = viewModel?.detail?.current_approved_revision ?? null;
  const selectedRevisionEvidenceGateSummary = useMemo(
    () =>
      createKnowledgeLibraryEvidenceGateSummary({
        blocks: selectedRevision?.content_blocks ?? [],
        releaseAction: "submit_review",
      }),
    [selectedRevision?.content_blocks],
  );
  const isDraftSelected = selectedRevision?.status === "draft";
  const reviewHash =
    selectedRevision == null
      ? null
      : formatWorkbenchHash("knowledge-review", {
          revisionId: selectedRevision.id,
        });

  const activeRevisionId = selectedRevisionId;

  return (
    <main className="knowledge-library-workbench knowledge-library-workbench-page">
      <header className="knowledge-library-hero">        <div className="knowledge-library-hero-copy">
          <span className="knowledge-library-eyebrow">{"\u534f\u4f5c\u4e0e\u56de\u6536\u533a"}</span>
          <h1>{"\u77e5\u8bc6\u5e93"}</h1>
          <p>
            {"\u7528\u4e00\u5f20\u53ef\u641c\u7d22\u3001\u53ef\u7b5b\u9009\u3001\u53ef\u5c55\u5f00\u62bd\u5c49\u7684\u77e5\u8bc6\u53f0\u8d26\u6765\u7ba1\u7406\u89c4\u5219\u3001\u6848\u4f8b\u3001\u56fe\u6587\u8bf4\u660e\u548c AI \u8bed\u4e49\u5c42\uff0c\u8ba9\u5f55\u5165\u4e0e\u590d\u7528\u90fd\u66f4\u50cf\u5de5\u4f5c\u53f0\uff0c\u800c\u4e0d\u662f\u957f\u8868\u5355\u3002"}
          </p>
          <WorkbenchCoreStrip
            activePillarId="knowledge"
            heading="\u77e5\u8bc6\u6c89\u6dc0\u94fe\u8def"
            description="\u5728\u540c\u4e00\u6761\u5de5\u4f5c\u94fe\u8def\u91cc\u5b8c\u6210\u641c\u7d22\u3001\u5f55\u5165\u3001\u7ed3\u6784\u7ed1\u5b9a\u548c\u5ba1\u6838\u4ea4\u63a5\u3002"
          />
        </div>
        <dl className="knowledge-library-hero-stats">
          <div>
            <dt>当前角色</dt>
            <dd>{formatActorRole(actorRole)}</dd>
          </div>
          <div>
            <dt>当前条目</dt>
            <dd>{viewModel?.selectedAssetId ?? "新建草稿"}</dd>
          </div>
          <div>
            <dt>当前版本</dt>
            <dd>{viewModel?.selectedRevisionId ?? "未选择"}</dd>
          </div>
        </dl>
      </header>

      {statusMessage ? (
        <div className="knowledge-library-banner" role="status">
          {statusMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="knowledge-library-banner knowledge-library-banner-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <div className="knowledge-library-layout knowledge-library-layout--ledger">
        <section className="knowledge-library-grid-shell">
          <KnowledgeLibraryGridToolbar
            searchText={viewModel?.filters.searchText ?? ""}
            queryMode={viewModel?.filters.queryMode ?? "keyword"}
            resultCount={viewModel?.visibleLibrary.length ?? 0}
            selectedAssetLabel={viewModel?.selectedSummary?.title ?? null}
            onSearchTextChange={(value) => updateFilters({ searchText: value })}
            onQueryModeChange={(value) => updateFilters({ queryMode: value })}
            onStartNewAsset={handleStartNewAsset}
          />

          {loadStatus === "loading" && (viewModel?.library.length ?? 0) === 0 ? (
            <section className="knowledge-library-panel">
              <p className="knowledge-library-empty">正在加载知识…</p>
            </section>
          ) : null}

          <KnowledgeLibraryGridTable
            items={viewModel?.visibleLibrary ?? []}
            selectedAssetId={viewModel?.selectedAssetId ?? null}
            onSelectAsset={handleSelectAsset}
          />
        </section>

        <KnowledgeLibraryRecordDrawer
          detail={viewModel?.detail ?? null}
          selectedAssetId={viewModel?.selectedAssetId ?? null}
          selectedRevisionId={viewModel?.selectedRevisionId ?? null}
          reviewHash={reviewHash}
          onSelectRevision={handleSelectRevision}
        >
          <section className="knowledge-library-main-column">
          <section className="knowledge-library-panel knowledge-library-editor">
            <header className="knowledge-library-panel-header">
              <div>
                <h2>Record Metadata</h2>
                <p>
                  Edit the active draft inside the record drawer without leaving the
                  summary ledger.
                </p>
              </div>
            </header>

            <div className="knowledge-library-editor-meta">
              <span>
                Current Asset: <strong>{viewModel?.selectedAssetId ?? "New draft"}</strong>
              </span>
              <span>
                Current Revision:{" "}
                <strong>{viewModel?.selectedRevisionId ?? "Not selected"}</strong>
              </span>
              <span>
                Approved Revision:{" "}
                <strong>{selectedApprovedRevision?.id ?? "None yet"}</strong>
              </span>
            </div>
            <KnowledgeLibraryDuplicateStatusRow
              checkState={duplicateCheckState}
              strongMatchCount={strongDuplicateMatches.length}
              isStale={isDuplicateResultStale}
              checkErrorMessage={duplicateCheckErrorMessage}
            />
            <section
              className="knowledge-library-evidence-gate"
              data-entry-evidence-gate="knowledge"
            >
              <div className="knowledge-library-evidence-gate-header">
                <h3>高精度证据预检</h3>
                <p>
                  按当前已保存富文本版本计算；未保存的富文本改动不会参与提交审核。
                </p>
              </div>

              {selectedRevisionEvidenceGateSummary.itemCount === 0 ? (
                <p className="knowledge-library-empty">
                  当前已保存富文本版本里还没有会触发高精度门禁的表格或视觉符号证据。
                </p>
              ) : (
                <div className="knowledge-library-evidence-gate-body">
                  <p
                    className={`knowledge-library-evidence-summary${selectedRevisionEvidenceGateSummary.hasBlockingIssues ? " is-blocking" : ""}`}
                  >
                    {selectedRevisionEvidenceGateSummary.hasBlockingIssues
                      ? `当前已保存富文本版本有 ${selectedRevisionEvidenceGateSummary.blockingItemCount} 条高精度证据未满足提交审核条件。`
                      : "当前已保存富文本版本已满足提交审核条件。"}
                  </p>
                  <ul className="knowledge-library-evidence-list">
                    {selectedRevisionEvidenceGateSummary.items.map((item) => (
                      <li key={item.blockId} className="knowledge-library-evidence-item">
                        <div className="knowledge-library-evidence-item-header">
                          <strong>{item.title}</strong>
                          <span>{item.statusLabel}</span>
                        </div>
                        <p>{item.detail}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <div className="knowledge-library-form-grid">
              <label>
                标题
                <input
                  value={formState.title}
                  onChange={(event) =>
                    updateDraftFormState((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder={"\u4f8b\u5982\uff1a\u8868\u683c\u6821\u5bf9\u4f9d\u636e"}
                />
              </label>
              <label>
                知识类型
                <select
                  value={formState.knowledgeKind}
                  onChange={(event) =>
                    updateDraftFormState((current) => ({
                      ...current,
                      knowledgeKind: event.target.value as KnowledgeKind,
                    }))
                  }
                >
                  {[
                    ...(formState.knowledgeKind === "rule" ? (["rule"] as KnowledgeKind[]) : []),
                    ...knowledgeKindEntryOptions,
                  ].map((kind) => (
                    <option key={kind} value={kind}>
                      {formatKnowledgeLibraryKnowledgeKind(
                        kind,
                        kind === "rule" ? "projection_legacy" : "projection",
                      )}
                    </option>
                  ))}
                </select>
              </label>
              <label className="knowledge-library-form-full">
                规范文本
                <textarea
                  rows={6}
                  value={formState.canonicalText}
                  onChange={(event) =>
                    updateDraftFormState((current) => ({
                      ...current,
                      canonicalText: event.target.value,
                    }))
                  }
                  placeholder={"\u586b\u5199\u9700\u8981\u88ab\u590d\u7528\u3001\u68c0\u7d22\u6216\u4f5c\u4e3a\u4f9d\u636e\u5f15\u7528\u7684\u6807\u51c6\u6587\u672c\u3002"}
                />
              </label>
              <label className="knowledge-library-form-full">
                摘要说明
                <textarea
                  rows={3}
                  value={formState.summary}
                  onChange={(event) =>
                    updateDraftFormState((current) => ({
                      ...current,
                      summary: event.target.value,
                    }))
                  }
                  placeholder={"\u7528\u4e00\u53e5\u8bdd\u8bf4\u660e\u8fd9\u6761\u77e5\u8bc6\u9002\u5408\u5728\u4ec0\u4e48\u60c5\u51b5\u4e0b\u4f7f\u7528\u3002"}
                />
              </label>
              <label>
                适用模块
                <select
                  value={formState.moduleScope}
                  onChange={(event) =>
                    updateDraftFormState((current) => ({
                      ...current,
                      moduleScope: event.target.value as ManuscriptModule | "any",
                    }))
                  }
                >
                  {moduleOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatKnowledgeLibraryModuleScope(option)}
                    </option>
                  ))}
                </select>
              </label>
              <KnowledgeLibraryMultiSelectField
                label="稿件类型"
                value={formState.manuscriptTypes}
                options={manuscriptTypeOptions.map((option) => ({
                  value: option,
                  label: formatKnowledgeLibraryManuscriptType(option),
                }))}
                dataKey="manuscript-types"
                includeAnyOption
                onToggleValue={(value) =>
                  updateDraftFormState((current) => ({
                    ...current,
                    manuscriptTypes: toggleManuscriptTypeSelection(
                      current.manuscriptTypes,
                      value as ManuscriptType,
                    ),
                  }))
                }
                onSelectAny={() =>
                  updateDraftFormState((current) => ({
                    ...current,
                    manuscriptTypes: "any",
                  }))
                }
              />
              <KnowledgeLibraryMultiSelectField
                label="章节标签"
                value={formState.sections}
                options={sectionOptions.map((option) => ({
                  value: option,
                  label: formatKnowledgeLibrarySection(option),
                }))}
                dataKey="sections"
                onToggleValue={(value) =>
                  updateDraftFormState((current) => ({
                    ...current,
                    sections: toggleStringSelection(current.sections, value),
                  }))
                }
              />
              <KnowledgeLibraryTagListField
                label="风险标签"
                values={formState.riskTags}
                dataKey="risk-tags"
                addLabel="添加风险标签"
                emptyText={"\u6682\u672a\u6dfb\u52a0\u98ce\u9669\u6807\u7b7e\u3002"}
                onAdd={() =>
                  updateDraftFormState((current) => ({
                    ...current,
                    riskTags: [...current.riskTags, ""],
                  }))
                }
                onChange={(index, value) =>
                  updateDraftFormState((current) => ({
                    ...current,
                    riskTags: updateStringListValue(current.riskTags, index, value),
                  }))
                }
                onRemove={(index) =>
                  updateDraftFormState((current) => ({
                    ...current,
                    riskTags: removeStringListValue(current.riskTags, index),
                  }))
                }
              />
              <KnowledgeLibraryTagListField
                label="学科标签"
                values={formState.disciplineTags}
                dataKey="discipline-tags"
                addLabel="添加学科标签"
                emptyText={"\u6682\u672a\u6dfb\u52a0\u5b66\u79d1\u6807\u7b7e\u3002"}
                onAdd={() =>
                  updateDraftFormState((current) => ({
                    ...current,
                    disciplineTags: [...current.disciplineTags, ""],
                  }))
                }
                onChange={(index, value) =>
                  updateDraftFormState((current) => ({
                    ...current,
                    disciplineTags: updateStringListValue(
                      current.disciplineTags,
                      index,
                      value,
                    ),
                  }))
                }
                onRemove={(index) =>
                  updateDraftFormState((current) => ({
                    ...current,
                    disciplineTags: removeStringListValue(
                      current.disciplineTags,
                      index,
                    ),
                  }))
                }
              />
              <KnowledgeLibraryTagListField
                label="别名"
                values={formState.aliases}
                dataKey="aliases"
                addLabel="添加别名"
                emptyText={"\u6682\u672a\u6dfb\u52a0\u522b\u540d\u3002"}
                onAdd={() =>
                  updateDraftFormState((current) => ({
                    ...current,
                    aliases: [...current.aliases, ""],
                  }))
                }
                onChange={(index, value) =>
                  updateDraftFormState((current) => ({
                    ...current,
                    aliases: updateStringListValue(current.aliases, index, value),
                  }))
                }
                onRemove={(index) =>
                  updateDraftFormState((current) => ({
                    ...current,
                    aliases: removeStringListValue(current.aliases, index),
                  }))
                }
              />
              <label>
                证据级别
                <select
                  value={formState.evidenceLevel}
                  onChange={(event) =>
                    updateDraftFormState((current) => ({
                      ...current,
                      evidenceLevel: event.target.value,
                    }))
                  }
                >
                  {evidenceLevelOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatKnowledgeLibraryEvidenceLevel(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                来源类型
                <select
                  value={formState.sourceType}
                  onChange={(event) =>
                    updateDraftFormState((current) => ({
                      ...current,
                      sourceType: event.target.value,
                    }))
                  }
                >
                  {sourceTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatKnowledgeLibrarySourceType(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="knowledge-library-form-full">
                来源链接
                <input
                  value={formState.sourceLink}
                  onChange={(event) =>
                    updateDraftFormState((current) => ({
                      ...current,
                      sourceLink: event.target.value,
                    }))
                  }
                  placeholder={"\u586b\u5199\u6307\u5357\u3001\u8bba\u6587\u6216\u7f51\u9875\u7684\u53ef\u8ffd\u6eaf\u94fe\u63a5\u3002"}
                />
              </label>
              <label>
                生效时间
                <input
                  value={formState.effectiveAt}
                  onChange={(event) =>
                    updateDraftFormState((current) => ({
                      ...current,
                      effectiveAt: event.target.value,
                    }))
                  }
                  placeholder="2026-04-08T00:00:00.000Z"
                />
              </label>
              <label>
                失效时间
                <input
                  value={formState.expiresAt}
                  onChange={(event) =>
                    updateDraftFormState((current) => ({
                      ...current,
                      expiresAt: event.target.value,
                    }))
                  }
                  placeholder={"\u53ef\u9009\uff0cISO \u65f6\u95f4\u6233"}
                />
              </label>
            </div>
            {isDuplicateSubmitConfirmationOpen && pendingSubmitStrongMatches.length > 0 ? (
              firstPendingStrongDuplicateMatch ? (
                <KnowledgeLibraryDuplicateSubmitConfirmation
                  match={firstPendingStrongDuplicateMatch}
                  isBusy={isBusy || isImmediateDuplicateCheckPending}
                  onOpenAsset={handleOpenExistingAsset}
                  onContinueAnyway={() =>
                    void handleContinueSubmitWithDuplicateAcknowledgement()
                  }
                />
              ) : null
            ) : null}

            <div className="knowledge-library-actions">
              <button
                type="button"
                disabled={isBusy || isImmediateDuplicateCheckPending}
                onClick={() => void handleCreateDraft()}
              >
                Create Draft Asset
              </button>
              <button
                type="button"
                disabled={isBusy || isImmediateDuplicateCheckPending || !isDraftSelected}
                onClick={() => void handleSaveDraft()}
              >
                Save Draft
              </button>
              <button
                type="button"
                disabled={
                  isBusy || isImmediateDuplicateCheckPending || !viewModel?.selectedAssetId
                }
                onClick={() => void handleCreateDerivedDraft()}
              >
                Create Update Draft
              </button>
              <button
                type="button"
                disabled={isBusy || isImmediateDuplicateCheckPending || !isDraftSelected}
                onClick={() => void handleSubmitDraft()}
              >
                Submit To Review
              </button>
            </div>
          </section>

          <div className="knowledge-library-drawer-section">
            <KnowledgeLibraryRichContentEditor
              blocks={contentBlocksDraft}
              onChange={setContentBlocksDraft}
              onUploadImage={handleUploadImage}
            />
            <div className="knowledge-library-actions knowledge-library-rich-content-save">
              <button
                type="button"
                disabled={isBusy || !viewModel?.selectedRevisionId}
                onClick={() => void handleSaveRichContent()}
              >
                Save Rich Content
              </button>
            </div>
          </div>

          <div className="knowledge-library-drawer-section">
            <KnowledgeLibrarySemanticPanel
              semanticLayer={semanticLayerDraft}
              onChange={handleSemanticDraftChange}
              onRegenerate={() => void handleRegenerateSemanticLayer()}
              onConfirm={() => void handleConfirmSemanticLayer()}
              isBusy={isBusy}
            />
          </div>

          <section className="knowledge-library-panel knowledge-library-bindings knowledge-library-drawer-section">
            <header className="knowledge-library-panel-header">
              <div>
                <h2>结构化绑定</h2>
                <p>
                  直接选择真实的模板、包、章节和知识项，不再手填伪绑定文本。
                </p>
              </div>
            </header>
            {bindingCatalogStatus === "loading" ? (
              <p className="knowledge-library-empty">正在加载绑定目录…</p>
            ) : null}
            {bindingCatalogError ? (
              <p className="knowledge-library-empty">{bindingCatalogError}</p>
            ) : null}
            <div className="knowledge-library-form-grid">
              {knowledgeLibraryBindingFieldDefinitions.map((definition) => {
                const options = definition.getOptions(resolvedBindingCatalog);
                return (
                  <KnowledgeLibraryBindingMultiSelectField
                    key={definition.kind}
                    label={definition.label}
                    helpText={definition.helpText}
                    value={getKnowledgeBindingSelectionValues(
                      formState.bindings,
                      definition.kind,
                    )}
                    options={options}
                    dataKey={definition.dataKey}
                    onToggleValue={(value) =>
                      updateDraftFormState((current) => ({
                        ...current,
                        bindings: toggleKnowledgeBindingSelection(
                          current.bindings,
                          definition.kind,
                          resolveBindingOptionByValue(options, value),
                        ),
                      }))
                    }
                  />
                );
              })}
            </div>
            {normalizedStructuredBindings.length > 0 ? (
              <ul className="knowledge-library-binding-list">
                {normalizedStructuredBindings.map((binding) => (
                  <li key={`${binding.bindingKind}:${binding.bindingTargetId}`}>
                    <strong>{binding.bindingTargetLabel}</strong>
                    <span>{formatKnowledgeLibraryBindingKind(binding.bindingKind)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="knowledge-library-empty">尚未添加结构化绑定。</p>
            )}
          </section>
        </section>

          <aside className="knowledge-library-side-column">
          <KnowledgeLibraryDuplicatePanel
            matches={duplicateMatches}
            checkState={duplicateCheckState}
            checkErrorMessage={duplicateCheckErrorMessage}
            onOpenAsset={handleOpenExistingAsset}
          />
          <section className="knowledge-library-panel knowledge-library-history">
            <header className="knowledge-library-panel-header">
              <div>
                <h2>Revision Timeline</h2>
                <p>
                  Track approved history, current drafts, and review handoff for
                  the selected asset.
                </p>
              </div>
            </header>

            {viewModel?.detail == null ? (
              <p className="knowledge-library-empty">
                Select an asset from the library queue to inspect revision history.
              </p>
            ) : null}

            <ol className="knowledge-library-revision-list">
              {(viewModel?.detail?.revisions ?? []).map((revision) => {
                const isActive = revision.id === activeRevisionId;
                return (
                  <li key={revision.id}>
                    <button
                      type="button"
                      className={`knowledge-library-revision-item${isActive ? " is-active" : ""}`}
                      onClick={() => handleSelectRevision(revision.id)}
                    >
                      <strong>{revision.title}</strong>
                      <span>{revision.id}</span>
                      <small>
                        Revision {revision.revision_no} · {revision.status}
                      </small>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
          </aside>
        </KnowledgeLibraryRecordDrawer>
      </div>
    </main>
  );
}

export interface KnowledgeLibraryDuplicateStatusRowProps {
  checkState: KnowledgeLibraryDuplicateCheckState;
  strongMatchCount: number;
  isStale: boolean;
  checkErrorMessage?: string | null;
}

export function KnowledgeLibraryDuplicateStatusRow({
  checkState,
  strongMatchCount,
  isStale,
  checkErrorMessage = null,
}: KnowledgeLibraryDuplicateStatusRowProps) {
  const statusText = resolveDuplicateStatusText({
    checkState,
    strongMatchCount,
    checkErrorMessage,
  });

  return (
    <p className="knowledge-library-duplicate-status-row">
      <strong>Duplicate Check:</strong> {statusText}
      {isStale && checkState !== "error" ? (
        <span className="knowledge-library-duplicate-status-stale">
          {" "}
          Draft changed since the last check.
        </span>
      ) : null}
    </p>
  );
}

export interface KnowledgeLibraryDuplicateSubmitConfirmationProps {
  match: DuplicateKnowledgeMatchViewModel;
  isBusy: boolean;
  onOpenAsset: (match: DuplicateKnowledgeMatchViewModel) => void;
  onContinueAnyway: () => void;
}

export function KnowledgeLibraryDuplicateSubmitConfirmation({
  match,
  isBusy,
  onOpenAsset,
  onContinueAnyway,
}: KnowledgeLibraryDuplicateSubmitConfirmationProps) {
  return (
    <section className="knowledge-library-duplicate-confirmation" role="alert">
      <h3>Strong duplicate matches detected</h3>
      <p>
        This draft overlaps existing governed knowledge. Review the existing asset before
        continuing.
      </p>
      <div className="knowledge-library-duplicate-confirmation-actions">
        <button type="button" disabled={isBusy} onClick={() => onOpenAsset(match)}>
          Open Existing Asset
        </button>
        <button type="button" disabled={isBusy} onClick={onContinueAnyway}>
          Continue Anyway
        </button>
      </div>
    </section>
  );
}

function resolveDuplicateStatusText(input: {
  checkState: KnowledgeLibraryDuplicateCheckState;
  strongMatchCount: number;
  checkErrorMessage?: string | null;
}): string {
  if (input.checkState === "not_checked") {
    return "Not checked";
  }

  if (input.checkState === "checking") {
    return "Checking duplicates...";
  }

  if (input.checkState === "error") {
    return input.checkErrorMessage ?? "Duplicate check failed. Retry to continue safely.";
  }

  if (input.strongMatchCount <= 0) {
    return "No strong duplicate signals";
  }

  return `${input.strongMatchCount} strong duplicate matches found`;
}

export type KnowledgeLibraryDuplicateSubmitDecision =
  | "submit"
  | "confirm"
  | "refresh_check";

export function resolveDuplicateSubmitDecision(input: {
  duplicateCheckInput: DuplicateKnowledgeCheckInput | null;
  duplicateCheckState: KnowledgeLibraryDuplicateCheckState;
  duplicateCheckSignature: string | null;
  lastCheckedDuplicateSignature: string | null;
  matches: readonly DuplicateKnowledgeMatchViewModel[];
}): KnowledgeLibraryDuplicateSubmitDecision {
  if (!input.duplicateCheckInput) {
    return "submit";
  }

  if (
    shouldRunImmediateDuplicateCheckBeforeSubmit({
      duplicateCheckInput: input.duplicateCheckInput,
      duplicateCheckState: input.duplicateCheckState,
      duplicateCheckSignature: input.duplicateCheckSignature,
      lastCheckedDuplicateSignature: input.lastCheckedDuplicateSignature,
    })
  ) {
    return "refresh_check";
  }

  return getStrongDuplicateMatches(input.matches).length > 0 ? "confirm" : "submit";
}

export function shouldRunImmediateDuplicateCheckBeforeSubmit(input: {
  duplicateCheckInput: DuplicateKnowledgeCheckInput | null;
  duplicateCheckState: KnowledgeLibraryDuplicateCheckState;
  duplicateCheckSignature: string | null;
  lastCheckedDuplicateSignature: string | null;
}): boolean {
  if (!input.duplicateCheckInput || !input.duplicateCheckSignature) {
    return false;
  }

  if (input.duplicateCheckState !== "checked") {
    return true;
  }

  return input.duplicateCheckSignature !== input.lastCheckedDuplicateSignature;
}

export function shouldInvalidateDuplicateSubmitConfirmation(input: {
  isConfirmationOpen: boolean;
  confirmationDraftSignature: string | null;
  currentDraftSignature: string;
}): boolean {
  if (!input.isConfirmationOpen || !input.confirmationDraftSignature) {
    return false;
  }

  return input.confirmationDraftSignature !== input.currentDraftSignature;
}

export type DuplicateAcknowledgementSubmitDecision = "blocked" | "stale" | "submit";

export function resolveDuplicateAcknowledgementSubmitDecision(input: {
  revisionId: string | null;
  hasViewModel: boolean;
  pendingStrongMatchCount: number;
  isBusy: boolean;
  isImmediateDuplicateCheckPending: boolean;
  isConfirmationOpen: boolean;
  confirmationDraftSignature: string | null;
  currentDraftSignature: string;
}): DuplicateAcknowledgementSubmitDecision {
  if (
    !input.revisionId ||
    !input.hasViewModel ||
    input.pendingStrongMatchCount <= 0 ||
    input.isBusy ||
    input.isImmediateDuplicateCheckPending
  ) {
    return "blocked";
  }

  if (
    shouldInvalidateDuplicateSubmitConfirmation({
      isConfirmationOpen: input.isConfirmationOpen,
      confirmationDraftSignature: input.confirmationDraftSignature,
      currentDraftSignature: input.currentDraftSignature,
    })
  ) {
    return "stale";
  }

  return "submit";
}

export function isImmediateDuplicateCheckResultStale(input: {
  requestId: number;
  latestRequestId: number;
  expectedContext: {
    selectedRevisionId: string | null;
    duplicateCheckSignature: string | null;
  };
  currentContext: {
    selectedRevisionId: string | null;
    duplicateCheckSignature: string | null;
  };
}): boolean {
  if (input.requestId !== input.latestRequestId) {
    return true;
  }

  return (
    input.expectedContext.selectedRevisionId !== input.currentContext.selectedRevisionId ||
    input.expectedContext.duplicateCheckSignature !==
      input.currentContext.duplicateCheckSignature
  );
}

export function getStrongDuplicateMatches(
  matches: readonly DuplicateKnowledgeMatchViewModel[],
): DuplicateKnowledgeMatchViewModel[] {
  return matches.filter((match) => match.severity === "exact" || match.severity === "high");
}

export function createKnowledgeLibraryFormState(
  detail: KnowledgeLibraryWorkbenchViewModel["detail"],
): KnowledgeLibraryFormState {
  if (!detail) {
    return {
      ...defaultFormState,
      sections: [...defaultFormState.sections],
      riskTags: [...defaultFormState.riskTags],
      disciplineTags: [...defaultFormState.disciplineTags],
      aliases: [...defaultFormState.aliases],
    };
  }

  const revision = detail.selected_revision;
  return {
    title: revision.title,
    canonicalText: revision.canonical_text,
    summary: revision.summary ?? "",
    knowledgeKind: revision.knowledge_kind,
    moduleScope: revision.routing.module_scope,
    manuscriptTypes: normalizeManuscriptTypes(revision.routing.manuscript_types),
    sections: normalizeStringArray(revision.routing.sections) ?? [],
    riskTags: normalizeStringArray(revision.routing.risk_tags) ?? [],
    disciplineTags: normalizeStringArray(revision.routing.discipline_tags) ?? [],
    aliases: normalizeStringArray(revision.aliases) ?? [],
    evidenceLevel: revision.evidence_level ?? "unknown",
    sourceType: revision.source_type ?? "other",
    sourceLink: revision.source_link ?? "",
    effectiveAt: revision.effective_at ?? "",
    expiresAt: revision.expires_at ?? "",
    bindings: revision.bindings.map((binding) => ({
      bindingKind: binding.binding_kind,
      bindingTargetId: binding.binding_target_id,
      bindingTargetLabel: binding.binding_target_label,
    })),
  };
}

function toCreateInput(formState: KnowledgeLibraryFormState): CreateKnowledgeLibraryDraftInput {
  return {
    title: formState.title.trim(),
    canonicalText: formState.canonicalText.trim(),
    summary: optionalTrimmedValue(formState.summary),
    knowledgeKind: formState.knowledgeKind,
    moduleScope: formState.moduleScope,
    manuscriptTypes: normalizeManuscriptTypes(formState.manuscriptTypes),
    sections: normalizeStringArray(formState.sections),
    riskTags: normalizeStringArray(formState.riskTags),
    disciplineTags: normalizeStringArray(formState.disciplineTags),
    aliases: normalizeStringArray(formState.aliases),
    evidenceLevel: optionalTrimmedValue(formState.evidenceLevel) as
      | CreateKnowledgeLibraryDraftInput["evidenceLevel"]
      | undefined,
    sourceType: optionalTrimmedValue(formState.sourceType) as
      | CreateKnowledgeLibraryDraftInput["sourceType"]
      | undefined,
    sourceLink: optionalTrimmedValue(formState.sourceLink),
    effectiveAt: optionalTrimmedValue(formState.effectiveAt),
    expiresAt: optionalTrimmedValue(formState.expiresAt),
    bindings: normalizeKnowledgeBindings(formState.bindings),
  };
}

export function createKnowledgeLibraryDraftInput(
  formState: KnowledgeLibraryFormState,
): CreateKnowledgeLibraryDraftInput {
  return toCreateInput(formState);
}

function toUpdateInput(formState: KnowledgeLibraryFormState): UpdateKnowledgeLibraryDraftInput {
  return toCreateInput(formState);
}

function toDuplicateCheckDraftFields(
  formState: KnowledgeLibraryFormState,
): DuplicateCheckDraftFields {
  return {
    title: formState.title,
    canonicalText: formState.canonicalText,
    summary: formState.summary,
    knowledgeKind: formState.knowledgeKind,
    moduleScope: formState.moduleScope,
    manuscriptTypes: normalizeManuscriptTypes(formState.manuscriptTypes),
    sections: normalizeStringArray(formState.sections) ?? [],
    riskTags: normalizeStringArray(formState.riskTags) ?? [],
    disciplineTags: normalizeStringArray(formState.disciplineTags) ?? [],
    aliases: normalizeStringArray(formState.aliases) ?? [],
    bindings: normalizeKnowledgeBindings(formState.bindings) ?? [],
  };
}

function createDuplicateCheckInput(
  formState: DuplicateCheckDraftFields,
  input: { currentAssetId?: string; currentRevisionId?: string },
): DuplicateKnowledgeCheckInput | null {
  const title = formState.title.trim();
  const canonicalText = formState.canonicalText.trim();
  const hasMinimumDraftSignal =
    title.length > 0 && canonicalText.length >= 12;
  if (!hasMinimumDraftSignal) {
    return null;
  }

  return {
    title,
    canonicalText,
    summary: optionalTrimmedValue(formState.summary),
    knowledgeKind: formState.knowledgeKind,
    moduleScope: formState.moduleScope,
    manuscriptTypes: normalizeManuscriptTypes(formState.manuscriptTypes),
    sections: normalizeStringArray(formState.sections),
    riskTags: normalizeStringArray(formState.riskTags),
    disciplineTags: normalizeStringArray(formState.disciplineTags),
    aliases: normalizeStringArray(formState.aliases),
    bindings: normalizeKnowledgeBindings(formState.bindings),
    currentAssetId: input.currentAssetId?.trim() || undefined,
    currentRevisionId: input.currentRevisionId?.trim() || undefined,
  };
}

export function buildDuplicateCheckTriggerSignature(
  input: DuplicateKnowledgeCheckInput | null,
): string | null {
  if (!input) {
    return null;
  }

  return JSON.stringify({
    title: input.title.trim(),
    canonicalText: input.canonicalText.trim(),
    summary: optionalTrimmedValue(input.summary ?? ""),
    knowledgeKind: input.knowledgeKind,
    moduleScope: input.moduleScope,
    manuscriptTypes: normalizeManuscriptTypes(input.manuscriptTypes),
    sections: normalizeStringArray(input.sections),
    riskTags: normalizeStringArray(input.riskTags),
    disciplineTags: normalizeStringArray(input.disciplineTags),
    aliases: normalizeStringArray(input.aliases),
    bindings: normalizeDuplicateCheckBindings(input.bindings),
    currentAssetId: optionalTrimmedValue(input.currentAssetId ?? ""),
    currentRevisionId: optionalTrimmedValue(input.currentRevisionId ?? ""),
  });
}

function serializeConfirmationDraftSignature(formState: KnowledgeLibraryFormState): string {
  return JSON.stringify(formState);
}

function normalizeDuplicateCheckBindings(
  bindings: DuplicateKnowledgeCheckInput["bindings"],
): KnowledgeRevisionBindingInput[] {
  return normalizeKnowledgeBindings(bindings) ?? [];
}

export function normalizeKnowledgeBindings(
  bindings: readonly KnowledgeRevisionBindingInput[] | undefined,
): KnowledgeRevisionBindingInput[] | undefined {
  if (!bindings) {
    return undefined;
  }

  const deduped = new Map<string, KnowledgeRevisionBindingInput>();
  for (const binding of bindings) {
    const bindingTargetId = binding.bindingTargetId.trim();
    if (bindingTargetId.length === 0) {
      continue;
    }

    const normalizedBinding: KnowledgeRevisionBindingInput = {
      bindingKind: binding.bindingKind,
      bindingTargetId,
      bindingTargetLabel: formatKnowledgeBindingTargetLabel({
        bindingKind: binding.bindingKind,
        bindingTargetId,
        bindingTargetLabel: binding.bindingTargetLabel,
      }),
    };
    const key = `${normalizedBinding.bindingKind}:${normalizedBinding.bindingTargetId}`;
    if (!deduped.has(key)) {
      deduped.set(key, normalizedBinding);
    }
  }

  return deduped.size > 0 ? [...deduped.values()] : undefined;
}

function formatKnowledgeBindingTargetLabel(input: {
  bindingKind: KnowledgeRevisionBindingKind;
  bindingTargetId: string;
  bindingTargetLabel: string;
}): string {
  const bindingTargetId = input.bindingTargetId.trim();
  const bindingTargetLabel = input.bindingTargetLabel.trim();

  if (
    input.bindingKind === "general_package" ||
    input.bindingKind === "medical_package"
  ) {
    return formatQualityPackageBindingDisplayLabel({
      bindingKind: input.bindingKind,
      bindingTargetId,
      bindingTargetLabel,
    });
  }

  return bindingTargetLabel || bindingTargetId;
}

function normalizeStringArray(values: string[] | undefined): string[] | undefined {
  if (!values) {
    return undefined;
  }

  const normalized = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeManuscriptTypes(
  value: DuplicateKnowledgeCheckInput["manuscriptTypes"],
): DuplicateKnowledgeCheckInput["manuscriptTypes"] {
  if (value === "any") {
    return "any";
  }

  const normalized = value
    .map((item) => item.trim())
    .filter((item): item is ManuscriptType => item.length > 0);
  return normalized.length > 0 ? normalized : "any";
}

function toggleManuscriptTypeSelection(
  current: KnowledgeLibraryFormState["manuscriptTypes"],
  value: ManuscriptType,
): KnowledgeLibraryFormState["manuscriptTypes"] {
  const currentValues = current === "any" ? [] : current;
  const nextValues = toggleStringSelection(currentValues, value) as ManuscriptType[];
  return nextValues.length > 0 ? nextValues : "any";
}

function toggleStringSelection(current: string[], value: string): string[] {
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
}

function updateStringListValue(values: string[], index: number, value: string): string[] {
  return values.map((currentValue, currentIndex) =>
    currentIndex === index ? value : currentValue,
  );
}

function removeStringListValue(values: string[], index: number): string[] {
  return values.filter((_, currentIndex) => currentIndex !== index);
}

function formatKnowledgeLibraryManuscriptType(value: ManuscriptType): string {
  return formatEditorialManuscriptTypeLabel(value);
}

function formatKnowledgeLibrarySection(value: (typeof sectionOptions)[number]): string {
  return formatEditorialSectionLabel(value);
}

function formatKnowledgeLibraryKnowledgeKind(
  value: KnowledgeKind,
  ruleVariant: KnowledgeKindRuleLabelVariant = "projection",
): string {
  return formatEditorialKnowledgeKindLabel(
    value,
    value === "rule" ? ruleVariant : "rule",
  );
}

function formatKnowledgeLibraryModuleScope(value: ManuscriptModule | "any"): string {
  return formatEditorialModuleLabel(value);
}

function formatKnowledgeLibraryEvidenceLevel(value: string): string {
  return formatEditorialEvidenceLevelLabel(value as typeof evidenceLevelOptions[number]);
}

function formatKnowledgeLibrarySourceType(value: string): string {
  return formatEditorialKnowledgeSourceTypeLabel(
    value as typeof sourceTypeOptions[number],
    "full",
  );
}

function formatKnowledgeLibraryBindingKind(value: KnowledgeRevisionBindingKind): string {
  switch (value) {
    case "template_family":
      return "模板族";
    case "module_template":
      return "模块模板";
    case "journal_template":
      return "期刊模板";
    case "general_package":
      return "通用包";
    case "medical_package":
      return "医学专用包";
    case "knowledge_item":
      return "关联知识项";
    case "section":
      return "绑定章节";
    default:
      return value;
  }
}

function formatKnowledgeLibraryTemplateFamilyStatus(
  status: "draft" | "active" | "archived",
): string {
  switch (status) {
    case "active":
      return "已启用";
    case "draft":
      return "草稿";
    case "archived":
    default:
      return "已归档";
  }
}

function resolveKnowledgeLibraryBindingCatalog(input: {
  catalog: KnowledgeLibraryBindingCatalog;
  bindings: readonly KnowledgeRevisionBindingInput[];
  libraryItems: readonly KnowledgeLibraryWorkbenchViewModel["library"][number][];
  selectedAssetId: string | null;
}): KnowledgeLibraryBindingCatalog {
  const knowledgeItemOptions = sortSearchableOptions(
    input.libraryItems
      .filter(
        (item) => item.status === "approved" && item.id !== input.selectedAssetId,
      )
      .map((item) => ({
        value: item.id,
        label: item.title,
        meta: `${formatKnowledgeLibraryKnowledgeKind(item.knowledge_kind)} · ${formatKnowledgeLibraryModuleScope(item.module_scope)}`,
        keywords: [
          item.id,
          item.title,
          item.knowledge_kind,
          item.module_scope,
          ...(item.manuscript_types === "any" ? ["any"] : item.manuscript_types),
        ],
      })),
  );

  return {
    templateFamilyOptions: mergeBindingOptions(
      input.catalog.templateFamilyOptions,
      input.bindings,
      "template_family",
    ),
    moduleTemplateOptions: mergeBindingOptions(
      input.catalog.moduleTemplateOptions,
      input.bindings,
      "module_template",
    ),
    journalTemplateOptions: mergeBindingOptions(
      input.catalog.journalTemplateOptions,
      input.bindings,
      "journal_template",
    ),
    generalPackageOptions: mergeBindingOptions(
      input.catalog.generalPackageOptions,
      input.bindings,
      "general_package",
    ),
    medicalPackageOptions: mergeBindingOptions(
      input.catalog.medicalPackageOptions,
      input.bindings,
      "medical_package",
    ),
    knowledgeItemOptions: mergeBindingOptions(
      knowledgeItemOptions,
      input.bindings,
      "knowledge_item",
    ),
    sectionOptions: mergeBindingOptions(input.catalog.sectionOptions, input.bindings, "section"),
  };
}

function mergeBindingOptions(
  options: readonly SearchableMultiSelectOption[],
  bindings: readonly KnowledgeRevisionBindingInput[],
  kind: KnowledgeRevisionBindingKind,
): SearchableMultiSelectOption[] {
  const merged = new Map<string, SearchableMultiSelectOption>();
  for (const option of options) {
    merged.set(option.value, option);
  }

  for (const binding of bindings) {
    if (binding.bindingKind !== kind || merged.has(binding.bindingTargetId)) {
      continue;
    }

    const label = formatKnowledgeBindingTargetLabel(binding);
    merged.set(binding.bindingTargetId, {
      value: binding.bindingTargetId,
      label,
      meta: "已绑定但当前目录未返回",
      keywords: [binding.bindingTargetId, label],
    });
  }

  return sortSearchableOptions([...merged.values()]);
}

function sortSearchableOptions(
  options: readonly SearchableMultiSelectOption[],
): SearchableMultiSelectOption[] {
  return [...options].sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
}

function getKnowledgeBindingSelectionValues(
  bindings: readonly KnowledgeRevisionBindingInput[],
  kind: KnowledgeRevisionBindingKind,
): string[] {
  return (normalizeKnowledgeBindings(bindings) ?? [])
    .filter((binding) => binding.bindingKind === kind)
    .map((binding) => binding.bindingTargetId);
}

function resolveBindingOptionByValue(
  options: readonly SearchableMultiSelectOption[],
  value: string,
): SearchableMultiSelectOption {
  return options.find((option) => option.value === value) ?? { value, label: value };
}

function toggleKnowledgeBindingSelection(
  bindings: readonly KnowledgeRevisionBindingInput[],
  kind: KnowledgeRevisionBindingKind,
  option: SearchableMultiSelectOption,
): KnowledgeRevisionBindingInput[] {
  const normalized = normalizeKnowledgeBindings(bindings) ?? [];
  const exists = normalized.some(
    (binding) =>
      binding.bindingKind === kind && binding.bindingTargetId === option.value,
  );
  if (exists) {
    return normalized.filter(
      (binding) =>
        binding.bindingKind !== kind || binding.bindingTargetId !== option.value,
    );
  }

  return [
    ...normalized,
    {
      bindingKind: kind,
      bindingTargetId: option.value,
      bindingTargetLabel: option.label,
    },
  ];
}

function KnowledgeLibraryMultiSelectField(props: {
  label: string;
  value: string[] | "any";
  options: ReadonlyArray<{ value: string; label: string }>;
  dataKey: string;
  includeAnyOption?: boolean;
  onToggleValue(value: string): void;
  onSelectAny?: () => void;
}) {
  return (
    <SearchableMultiSelectField
      label={props.label}
      helpText={
        props.includeAnyOption
          ? "\u652f\u6301\u201c\u5168\u90e8/\u4efb\u610f\u201d\u548c\u591a\u9009\u5207\u6362\u3002"
          : "\u652f\u6301\u7ed3\u6784\u5316\u591a\u9009\u3002"
      }
      value={props.value}
      options={props.options as readonly SearchableMultiSelectOption[]}
      dataKey={props.dataKey}
      rootDataAttributeName="data-knowledge-multi-select"
      className="knowledge-library-structured-field knowledge-library-form-full"
      headerClassName="knowledge-library-structured-field-header"
      searchFieldClassName="knowledge-library-grid-search"
      searchPlaceholder={`\u641c\u7d22${props.label}`}
      optionsClassName="knowledge-library-toggle-group"
      optionClassName="knowledge-library-toggle-chip"
      emptyClassName="knowledge-library-structured-empty"
      includeAnyOption={props.includeAnyOption}
      onToggleValue={props.onToggleValue}
      onSelectAny={props.onSelectAny}
      noResultsText="\u672a\u627e\u5230\u5339\u914d\u7684\u9009\u9879\u3002"
    />
  );
}

function KnowledgeLibraryBindingMultiSelectField(props: {
  label: string;
  helpText: string;
  value: string[];
  options: readonly SearchableMultiSelectOption[];
  dataKey: string;
  onToggleValue(value: string): void;
}) {
  return (
    <SearchableMultiSelectField
      label={props.label}
      helpText={props.helpText}
      value={props.value}
      options={props.options}
      dataKey={props.dataKey}
      rootDataAttributeName="data-knowledge-binding-multi-select"
      className="knowledge-library-structured-field knowledge-library-form-full"
      headerClassName="knowledge-library-structured-field-header"
      searchFieldClassName="knowledge-library-grid-search"
      searchPlaceholder={`搜索${props.label}`}
      optionsClassName="knowledge-library-toggle-group"
      optionClassName="knowledge-library-toggle-chip"
      emptyClassName="knowledge-library-structured-empty"
      emptyOptionsText="当前没有可用绑定项。"
      noResultsText="未找到匹配的绑定项。"
      showSelectedSummary
      selectedListClassName="knowledge-library-toggle-group"
      selectedChipClassName="knowledge-library-toggle-chip is-active"
      selectedEmptyText="尚未选择。"
      onToggleValue={props.onToggleValue}
    />
  );
}

function KnowledgeLibraryTagListField(props: {
  label: string;
  values: string[];
  dataKey: string;
  addLabel: string;
  emptyText: string;
  onAdd(): void;
  onChange(index: number, value: string): void;
  onRemove(index: number): void;
}) {
  return (
    <div
      className="knowledge-library-structured-field knowledge-library-form-full"
      data-knowledge-tag-list={props.dataKey}
    >
      <div className="knowledge-library-structured-field-header">
        <span>{props.label}</span>
        <small>{"\u4e00\u884c\u4e00\u4e2a\u8bcd\u6761\uff0c\u53ef\u9010\u6761\u8865\u5145\u548c\u5220\u9664\u3002"}</small>
      </div>
      <div className="knowledge-library-tag-editor-list">
        {props.values.length > 0 ? (
          props.values.map((value, index) => (
            <div key={`${props.dataKey}-${index}`} className="knowledge-library-tag-editor-row">
              <input
                value={value}
                onChange={(event) => props.onChange(index, event.target.value)}
                placeholder={props.label}
              />
              <button type="button" onClick={() => props.onRemove(index)}>
                {"\u5220\u9664"}
              </button>
            </div>
          ))
        ) : (
          <p className="knowledge-library-structured-empty">{props.emptyText}</p>
        )}
      </div>
      <button
        type="button"
        className="knowledge-library-secondary-button"
        onClick={props.onAdd}
      >
        {props.addLabel}
      </button>
    </div>
  );
}

function optionalTrimmedValue(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function formatActorRole(role: AuthRole): string {
  switch (role) {
    case "admin":
      return "\u7ba1\u7406\u5458";
    case "knowledge_reviewer":
      return "\u77e5\u8bc6\u6cbb\u7406\u5458";
    case "editor":
      return "\u7a3f\u4ef6\u5904\u7406\u5458";
    case "proofreader":
      return "\u6821\u5bf9";
    case "screener":
      return "\u521d\u7b5b";
    case "user":
    default:
      return "\u666e\u901a\u7528\u6237";
  }
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return `${fallback}: ${error.message}`;
  }

  return fallback;
}
