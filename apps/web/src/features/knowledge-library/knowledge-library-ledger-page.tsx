import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserHttpClient } from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/roles.ts";
import {
  SearchableMultiSelectField,
  type SearchableMultiSelectOption,
} from "../../lib/searchable-multi-select.tsx";
import type { ManuscriptType } from "../manuscripts/types.ts";
import {
  EDITORIAL_SECTION_OPTIONS,
  formatEditorialKnowledgeKindLabel,
  formatEditorialManuscriptTypeLabel,
  formatEditorialModuleLabel,
  formatEditorialSectionLabel,
} from "../shared/editorial-taxonomy.ts";
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
import {
  applyAiIntakeSuggestion,
  buildCreateDraftInput,
  createLedgerComposerFromKnowledgeCandidatePrefill,
  createLedgerComposerFromDraftPrefill,
  createEmptyLedgerComposer,
  createLedgerComposerFromKnowledgeRevision,
  type KnowledgeLibraryLedgerComposer,
} from "./knowledge-library-ledger-composer.ts";
import { KnowledgeCandidateSourceStrip } from "./knowledge-candidate-source-strip.tsx";
import {
  applyKnowledgeLibrarySemanticSuggestion,
  buildKnowledgeLibrarySemanticAnalysisNotes,
  generateKnowledgeLibrarySemanticSuggestion,
} from "./knowledge-library-semantic-generation.ts";
import { buildTableProofreadingKnowledgeDraftPrefill } from "../template-governance/template-governance-table-proofreading-guidance.ts";
import {
  createKnowledgeLibraryWorkbenchController,
  type KnowledgeLibraryWorkbenchController,
} from "./knowledge-library-controller.ts";
import {
  KnowledgeLibraryEntryForm,
  type KnowledgeLibraryEntryAiAssistMode,
} from "./knowledge-library-entry-form.tsx";
import { createKnowledgeLibraryEvidenceGateSummary } from "./knowledge-library-evidence-gate.ts";
import {
  KnowledgeLibraryLedgerGrid,
  KNOWLEDGE_LIBRARY_LEDGER_COLUMNS,
  type KnowledgeLibraryLedgerColumnDefinition,
  type KnowledgeLibraryLedgerColumnKey,
  type KnowledgeLibraryLedgerColumnWidthMap,
} from "./knowledge-library-ledger-grid.tsx";
import {
  KnowledgeLibraryLedgerToolbar,
  type KnowledgeLibraryLedgerDensity,
} from "./knowledge-library-ledger-toolbar.tsx";
import type {
  DuplicateKnowledgeCheckInput,
  DuplicateKnowledgeMatchViewModel,
  KnowledgeContentBlockViewModel,
  KnowledgeLibraryFilterState,
  KnowledgeLibraryQueryMode,
  KnowledgeLibrarySummaryViewModel,
  KnowledgeLibraryWorkbenchViewModel,
  KnowledgeRevisionBindingInput,
  KnowledgeRevisionBindingKind,
  KnowledgeRevisionViewModel,
  KnowledgeSemanticLayerInput,
  KnowledgeSemanticLayerViewModel,
  KnowledgeUploadViewModel,
} from "./types.ts";

if (typeof document !== "undefined") {
  void import("./knowledge-library-ledger-page.css");
}

const defaultHttpClient = createBrowserHttpClient();
const defaultController = createKnowledgeLibraryWorkbenchController(defaultHttpClient);

interface LedgerBindingCatalog {
  templateFamilyOptions: SearchableMultiSelectOption[];
  moduleTemplateOptions: SearchableMultiSelectOption[];
  journalTemplateOptions: SearchableMultiSelectOption[];
  generalPackageOptions: SearchableMultiSelectOption[];
  medicalPackageOptions: SearchableMultiSelectOption[];
  knowledgeItemOptions: SearchableMultiSelectOption[];
  sectionOptions: SearchableMultiSelectOption[];
}

const LEDGER_BINDING_FIELD_DEFINITIONS: ReadonlyArray<{
  kind: KnowledgeRevisionBindingKind;
  label: string;
  helpText: string;
  dataKey: string;
  getOptions(catalog: LedgerBindingCatalog): SearchableMultiSelectOption[];
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

type EntryFormMode = "closed" | "create" | "edit";
type KnowledgeLibraryDuplicateCheckState =
  | "not_checked"
  | "checking"
  | "checked"
  | "error";

interface ColumnResizeState {
  key: KnowledgeLibraryLedgerColumnKey;
  startX: number;
  startWidth: number;
}

export interface KnowledgeLibraryLedgerPageProps {
  controller?: KnowledgeLibraryWorkbenchController;
  initialViewModel?: KnowledgeLibraryWorkbenchViewModel | null;
  initialComposer?: KnowledgeLibraryLedgerComposer | null;
  initialFormMode?: EntryFormMode;
  initialAiAssistMode?: KnowledgeLibraryEntryAiAssistMode;
  initialSearchOpen?: boolean;
  initialSearchQuery?: string;
  actorRole?: AuthRole;
  prefilledAssetId?: string;
  prefilledRevisionId?: string;
  prefilledKnowledgeTemplateId?: string;
  prefilledLearningCandidateId?: string;
  prefilledReviewItemId?: string;
  initialPriorityOrder?: string[];
  initialColumnOrder?: KnowledgeLibraryLedgerColumnKey[];
  initialColumnOrderPanelOpen?: boolean;
}

export function KnowledgeLibraryLedgerPage({
  controller = defaultController,
  initialViewModel = null,
  initialComposer = null,
  initialFormMode = "closed",
  initialAiAssistMode = "manual",
  initialSearchOpen = false,
  initialSearchQuery = "",
  actorRole = "knowledge_reviewer",
  prefilledAssetId,
  prefilledRevisionId,
  prefilledKnowledgeTemplateId,
  prefilledLearningCandidateId,
  prefilledReviewItemId,
  initialPriorityOrder,
  initialColumnOrder,
  initialColumnOrderPanelOpen = false,
}: KnowledgeLibraryLedgerPageProps) {
  const prefilledTemplateDraft =
    prefilledKnowledgeTemplateId != null
      ? buildTableProofreadingKnowledgeDraftPrefill(prefilledKnowledgeTemplateId)
      : null;
  const initialPrefilledComposer =
    initialComposer == null && prefilledTemplateDraft != null
      ? createLedgerComposerFromDraftPrefill(prefilledTemplateDraft)
      : null;
  const shouldStartInCreateMode =
    initialFormMode === "create" || initialPrefilledComposer != null;
  const [viewModel, setViewModel] = useState<KnowledgeLibraryWorkbenchViewModel | null>(
    initialViewModel,
  );
  const initialFilters = initialViewModel?.filters;
  const [composer, setComposer] = useState<KnowledgeLibraryLedgerComposer | null>(() => {
    if (initialComposer) {
      return initialComposer;
    }

    if (initialPrefilledComposer) {
      return initialPrefilledComposer;
    }

    return shouldStartInCreateMode ? createEmptyLedgerComposer() : null;
  });
  const [boardMode, setBoardMode] = useState<EntryFormMode>(
    shouldStartInCreateMode ? "create" : initialFormMode,
  );
  const setFormMode = setBoardMode;
  const [aiAssistMode, setAiAssistMode] = useState<KnowledgeLibraryEntryAiAssistMode>(
    initialAiAssistMode,
  );
  const [, setSurface] = useState<"table">("table");
  const [density, setDensity] =
    useState<KnowledgeLibraryLedgerDensity>("compact");
  const [columnWidths, setColumnWidths] = useState<KnowledgeLibraryLedgerColumnWidthMap>(
    DEFAULT_COLUMN_WIDTHS,
  );
  const [selectedRowId, setSelectedRowId] = useState<string | null>(
    initialViewModel?.selectedAssetId ?? null,
  );
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">(
    initialViewModel ? "ready" : "idle",
  );
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(() =>
    initialPrefilledComposer
      ? `已按知识模板“${initialPrefilledComposer.draft.title}”预填草稿。`
      : null,
  );
  const [searchQuery, setSearchQuery] = useState(
    initialSearchQuery || initialFilters?.searchText || "",
  );
  const [queryMode, setQueryMode] = useState<KnowledgeLibraryQueryMode>(
    initialFilters?.queryMode ?? "keyword",
  );
  const searchMode = queryMode;
  const setSearchMode = setQueryMode;
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [knowledgeKindFilter, setKnowledgeKindFilter] = useState<
    KnowledgeLibraryFilterState["knowledgeKind"]
  >(initialFilters?.knowledgeKind ?? "all");
  const [moduleScopeFilter, setModuleScopeFilter] = useState<
    KnowledgeLibraryFilterState["moduleScope"]
  >(initialFilters?.moduleScope ?? "any");
  const [semanticStatusFilter, setSemanticStatusFilter] = useState<
    KnowledgeLibraryFilterState["semanticStatus"]
  >(initialFilters?.semanticStatus ?? "all");
  const [assetStatusFilter, setAssetStatusFilter] = useState<
    NonNullable<KnowledgeLibraryFilterState["assetStatus"]>
  >(initialFilters?.assetStatus ?? "active");
  const [contributorQuery, setContributorQuery] = useState(
    initialFilters?.contributorText ?? "",
  );
  const [duplicateMatches, setDuplicateMatches] = useState<
    DuplicateKnowledgeMatchViewModel[]
  >([]);
  const [duplicateCheckState, setDuplicateCheckState] =
    useState<KnowledgeLibraryDuplicateCheckState>("not_checked");
  const [duplicateCheckErrorMessage, setDuplicateCheckErrorMessage] = useState<
    string | null
  >(null);
  const [semanticNotes, setSemanticNotes] = useState<string[]>([]);
  const [bindingCatalog, setBindingCatalog] = useState<LedgerBindingCatalog>(() =>
    createInitialLedgerBindingCatalog(),
  );
  const [bindingCatalogStatus, setBindingCatalogStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [bindingCatalogError, setBindingCatalogError] = useState<string | null>(null);
  const [priorityOrder, setPriorityOrder] = useState<string[]>(() =>
    initialPriorityOrder ?? readKnowledgeLibraryPriorityOrder(),
  );
  const [columnOrder, setColumnOrder] = useState<KnowledgeLibraryLedgerColumnKey[]>(
    () =>
      reconcileKnowledgeLibraryColumnOrder(
        initialColumnOrder ?? readKnowledgeLibraryColumnOrder(),
      ),
  );
  const [isColumnOrderPanelOpen, setIsColumnOrderPanelOpen] = useState(
    initialColumnOrderPanelOpen,
  );
  const resizeStateRef = useRef<ColumnResizeState | null>(null);

  useEffect(() => {
    if (initialViewModel) {
      return;
    }

    void loadWorkbench({
      selectedAssetId: prefilledAssetId,
      selectedRevisionId: prefilledRevisionId,
      filters: createCurrentFilterState({
        searchText:
          initialSearchOpen || initialSearchQuery.length > 0
            ? initialSearchQuery
            : initialFilters?.searchText ?? "",
        queryMode,
        knowledgeKind: knowledgeKindFilter,
        moduleScope: moduleScopeFilter,
        semanticStatus: semanticStatusFilter,
        assetStatus: assetStatusFilter,
        contributorText: contributorQuery,
      }),
    });
  }, [
    controller,
    initialSearchOpen,
    initialSearchQuery,
    initialFilters?.searchText,
    initialViewModel,
    knowledgeKindFilter,
    moduleScopeFilter,
    prefilledAssetId,
    prefilledRevisionId,
    queryMode,
    semanticStatusFilter,
    assetStatusFilter,
    contributorQuery,
  ]);

  useEffect(() => {
    if (
      !prefilledLearningCandidateId ||
      initialComposer ||
      prefilledKnowledgeTemplateId
    ) {
      return;
    }

    let isActive = true;
    setIsBusy(true);
    setErrorMessage(null);

    void controller
      .loadKnowledgeCandidatePrefill({
        learningCandidateId: prefilledLearningCandidateId,
      })
      .then((prefill) => {
        if (!isActive) {
          return;
        }

        setComposer(createLedgerComposerFromKnowledgeCandidatePrefill(prefill));
        setFormMode("create");
        setAiAssistMode("manual");
        setStatusMessage(
          "已从学习候选预填知识草稿，保存后会生成知识库草稿，提交审核后才能生效。",
        );
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setErrorMessage(
          toErrorMessage(error, "知识候选加载失败，请回到稿件工作台重试。"),
        );
      })
      .finally(() => {
        if (isActive) {
          setIsBusy(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [
    controller,
    initialComposer,
    prefilledKnowledgeTemplateId,
    prefilledLearningCandidateId,
  ]);

  useEffect(() => {
    let isActive = true;
    setBindingCatalogStatus("loading");
    setBindingCatalogError(null);

    void loadLedgerBindingCatalog()
      .then((catalog) => {
        if (!isActive) {
          return;
        }

        setBindingCatalog(catalog);
        setBindingCatalogStatus("ready");
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setBindingCatalogStatus("error");
        setBindingCatalogError(
          error instanceof Error ? error.message : "绑定目录加载失败。",
        );
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      const current = resizeStateRef.current;
      if (!current) {
        return;
      }

      setColumnWidths((previous) => ({
        ...previous,
        [current.key]: Math.max(
          MIN_COLUMN_WIDTHS[current.key],
          current.startWidth + event.clientX - current.startX,
        ),
      }));
    }

    function handlePointerUp() {
      resizeStateRef.current = null;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  useEffect(() => {
    writeKnowledgeLibraryPriorityOrder(priorityOrder);
  }, [priorityOrder]);

  useEffect(() => {
    writeKnowledgeLibraryColumnOrder(columnOrder);
  }, [columnOrder]);

  useEffect(() => {
    const libraryAssetIds = viewModel?.library.map((item) => item.id) ?? [];
    if (libraryAssetIds.length === 0) {
      return;
    }

    setPriorityOrder((current) => {
      const next = reconcileKnowledgeLibraryPriorityOrder(current, libraryAssetIds);
      return areStringArraysEqual(current, next) ? current : next;
    });
  }, [viewModel?.library]);

  useEffect(() => {
    setColumnOrder((current) => {
      const next = reconcileKnowledgeLibraryColumnOrder(current);
      return areStringArraysEqual(current, next) ? current : next;
    });
  }, []);

  const visibleLibraryItems = useMemo(
    () => [...(viewModel?.visibleLibrary ?? [])],
    [viewModel?.visibleLibrary],
  );
  const orderedColumns = useMemo(
    () => orderKnowledgeLibraryColumns(columnOrder),
    [columnOrder],
  );
  const visiblePriorityAssetIds = useMemo(
    () =>
      visibleLibraryItems
        .filter((item) => item.status !== "archived")
        .map((item) => item.id),
    [visibleLibraryItems],
  );
  const ledgerRows = useMemo(
    () =>
      visibleLibraryItems.map((item) => {
        const priorityIndex = visiblePriorityAssetIds.indexOf(item.id);
        return {
          ...createLedgerRow(
            item,
            viewModel?.detail?.asset.id === item.id ? viewModel.detail.selected_revision : null,
          ),
          priorityRank: priorityIndex === -1 ? undefined : priorityIndex + 1,
          canMovePriorityUp: priorityIndex > 0,
          canMovePriorityDown:
            priorityIndex !== -1 && priorityIndex < visiblePriorityAssetIds.length - 1,
        };
      }),
    [viewModel?.detail, visibleLibraryItems, visiblePriorityAssetIds],
  );
  const attachments = useMemo(
    () => extractAttachments(composer?.contentBlocksDraft ?? []),
    [composer?.contentBlocksDraft],
  );
  const resolvedBindingCatalog = useMemo(
    () =>
      resolveLedgerBindingCatalog({
        catalog: bindingCatalog,
        bindings: composer?.draft.bindings ?? [],
        libraryItems: viewModel?.library ?? [],
        selectedAssetId: selectedRowId,
      }),
    [bindingCatalog, composer?.draft.bindings, selectedRowId, viewModel?.library],
  );
  const normalizedStructuredBindings = useMemo(
    () => normalizeLedgerBindings(composer?.draft.bindings) ?? [],
    [composer?.draft.bindings],
  );
  const duplicateCheckInput = useMemo(
    () => createDuplicateCheckInput(composer),
    [composer],
  );
  const strongDuplicateMatches = useMemo(
    () =>
      duplicateMatches.filter(
        (match) => match.severity === "exact" || match.severity === "high",
      ),
    [duplicateMatches],
  );
  const duplicateSummary = useMemo(() => {
    if (duplicateCheckState === "checking") {
      return "正在检查重复知识。";
    }

    if (duplicateCheckState === "error") {
      return duplicateCheckErrorMessage ?? "重复检查失败。";
    }

    if (strongDuplicateMatches.length > 0) {
      return `发现 ${strongDuplicateMatches.length} 条高风险重复候选，请先核对。`;
    }

    if (duplicateCheckState === "checked") {
      return "未发现高风险重复。";
    }

    return null;
  }, [
    duplicateCheckErrorMessage,
    duplicateCheckState,
    strongDuplicateMatches.length,
  ]);
  const evidenceGateSummary = useMemo(
    () =>
      createKnowledgeLibraryEvidenceGateSummary({
        blocks: composer?.contentBlocksDraft,
        releaseAction: "submit_review",
      }),
    [composer?.contentBlocksDraft],
  );
  const semanticStatusLabel = formatSemanticStatusLabel(
    composer?.semanticLayerDraft?.status ?? "not_generated",
  );
  const canRunAiPrefill =
    composer != null && buildAiPrefillSourceText(composer).trim().length > 0;
  const canGenerateSemantic =
    composer != null && buildSemanticSourceText(composer).trim().length > 0;
  const canApplySemantic =
    composer?.semanticLayerDraft != null &&
    composer.semanticLayerDraft.status !== "confirmed";
  const canConfirmEntry =
    composer != null &&
    composer.draft.title.trim().length > 0 &&
    composer.draft.canonicalText.trim().length > 0 &&
    composer.semanticLayerDraft?.status === "confirmed";
  const activeFilterCount = countActiveFilters({
    knowledgeKind: knowledgeKindFilter,
    moduleScope: moduleScopeFilter,
    semanticStatus: semanticStatusFilter,
    contributorText: contributorQuery,
  });
  const selectedSummary = viewModel?.selectedSummary ?? null;
  const isArchivedScope = assetStatusFilter === "archived";
  const visibleArchivedAssetIds = useMemo(
    () => visibleLibraryItems.filter((item) => item.status === "archived").map((item) => item.id),
    [visibleLibraryItems],
  );
  const selectedArchivedAt = formatDate(
    selectedSummary?.archived_at ??
      (selectedSummary?.status === "archived" ? selectedSummary.updated_at : undefined),
  );
  const selectedArchivedBy = formatArchiveActorRoleLabel(selectedSummary?.archived_by_role);

  useEffect(() => {
    if (!duplicateCheckInput) {
      setDuplicateMatches([]);
      setDuplicateCheckState("not_checked");
      setDuplicateCheckErrorMessage(null);
      return;
    }

    let disposed = false;
    setDuplicateCheckState("checking");
    setDuplicateCheckErrorMessage(null);

    const timer = globalThis.setTimeout(async () => {
      try {
        const matches = await controller.checkDuplicates(duplicateCheckInput);
        if (disposed) {
          return;
        }

        setDuplicateMatches(matches);
        setDuplicateCheckState("checked");
        setDuplicateCheckErrorMessage(null);
      } catch (error) {
        if (disposed) {
          return;
        }

        setDuplicateMatches([]);
        setDuplicateCheckState("error");
        setDuplicateCheckErrorMessage(
          toErrorMessage(error, "重复检查失败，请稍后重试。"),
        );
      }
    }, 450);

    return () => {
      disposed = true;
      globalThis.clearTimeout(timer);
    };
  }, [controller, duplicateCheckInput]);

  return (
    <main
      className="knowledge-library-ledger-page"
      data-prefilled-learning-candidate-id={prefilledLearningCandidateId}
      data-prefilled-review-item-id={prefilledReviewItemId}
    >
      <header className="knowledge-library-ledger-page__header">
        <div>
          <p className="knowledge-library-ledger-page__eyebrow">知识库</p>
          <h1>多维知识台账</h1>
          <p>只保留表格主视图，用同一张表单完成录入、编辑和 AI 语义确认。</p>
        </div>

        <div className="knowledge-library-ledger-page__meta">
          <span>当前角色：{actorRole}</span>
          <span>当前模式：{boardMode === "closed" ? "台账总览" : "录入侧板已打开"}</span>
        </div>
      </header>

      <KnowledgeLibraryLedgerToolbar
        totalCount={visibleLibraryItems.length}
        selectedCount={selectedRowId ? 1 : 0}
        searchQuery={searchQuery}
        activeFilterCount={activeFilterCount}
        isFilterDrawerOpen={isFilterDrawerOpen}
        isColumnOrderPanelOpen={isColumnOrderPanelOpen}
        activeScope={assetStatusFilter}
        onSearchQueryChange={setSearchQuery}
        onSearchSubmit={() => void handleRunSearch()}
        onCreate={handleOpenCreateForm}
        onAiIntake={handleOpenAiIntakeForm}
        onToggleColumnOrder={() =>
          setIsColumnOrderPanelOpen((current) => !current)
        }
        onToggleFilters={() => setIsFilterDrawerOpen((current) => !current)}
        onScopeChange={(scope) => {
          setAssetStatusFilter(scope);
          void loadWorkbench({
            selectedAssetId: selectedRowId ?? undefined,
            filters: createCurrentFilterState({
              searchText: searchQuery,
              queryMode,
              knowledgeKind: knowledgeKindFilter,
              moduleScope: moduleScopeFilter,
              semanticStatus: semanticStatusFilter,
              assetStatus: scope,
              contributorText: contributorQuery,
            }),
          });
        }}
      />

      {statusMessage ? (
        <p className="knowledge-library-ledger-page__notice">{statusMessage}</p>
      ) : null}
      {errorMessage ? (
        <p className="knowledge-library-ledger-page__notice is-error">{errorMessage}</p>
      ) : null}
      {loadStatus === "loading" && !viewModel ? (
        <p className="knowledge-library-ledger-page__notice">正在加载知识台账…</p>
      ) : null}

      <section className={`knowledge-library-ledger-page__content${boardMode !== "closed" && composer ? " has-board" : ""}`}>
        <div className="knowledge-library-ledger-page__main">
          {isArchivedScope ? (
            <section
              className="knowledge-library-ledger-recycle-bar"
              aria-label="回收区管理"
            >
              <div className="knowledge-library-ledger-recycle-bar__meta">
                <strong>回收区管理</strong>
                <span>当前归档 {visibleArchivedAssetIds.length} 条</span>
                <span>恢复后将回到草稿状态，需重新确认后再投入使用。</span>
                {selectedArchivedAt ? <span>选中项回收时间：{selectedArchivedAt}</span> : null}
                {selectedArchivedBy ? <span>选中项回收角色：{selectedArchivedBy}</span> : null}
              </div>
              <div className="knowledge-library-ledger-recycle-bar__actions">
                <button
                  type="button"
                  data-toolbar-action="restore-selected"
                  disabled={!selectedRowId || isBusy}
                  onClick={() => {
                    if (!selectedRowId) {
                      return;
                    }
                    void handleRestoreAsset(selectedRowId);
                  }}
                >
                  恢复当前选中
                </button>
                <button
                  type="button"
                  data-toolbar-action="restore-visible"
                  disabled={visibleArchivedAssetIds.length === 0 || isBusy}
                  onClick={() => void handleRestoreVisibleArchivedAssets()}
                >
                  恢复当前筛选结果
                </button>
              </div>
            </section>
          ) : null}

          {isColumnOrderPanelOpen ? (
            <section
              className="knowledge-library-ledger-column-order"
              data-column-order-panel="true"
              aria-label="列顺序调整"
            >
              <header className="knowledge-library-ledger-column-order__header">
                <div>
                  <p className="knowledge-library-ledger-page__eyebrow">列顺序</p>
                  <h2>调整表格列顺序</h2>
                  <p>左右移动后，最左侧这一列会继续保持固定。</p>
                </div>
                <div className="knowledge-library-ledger-column-order__actions">
                  <button
                    type="button"
                    data-column-order-action="reset"
                    onClick={handleResetColumnOrder}
                  >
                    恢复默认
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsColumnOrderPanelOpen(false)}
                  >
                    关闭
                  </button>
                </div>
              </header>

              <div className="knowledge-library-ledger-column-order__list">
                {orderedColumns.map((column, index) => (
                  <div
                    key={column.key}
                    className="knowledge-library-ledger-column-order__item"
                    data-column-order-item={column.key}
                  >
                    <div className="knowledge-library-ledger-column-order__item-meta">
                      <strong>{column.label}</strong>
                      <span>当前第 {index + 1} 列</span>
                    </div>
                    <div className="knowledge-library-ledger-column-order__item-actions">
                      <button
                        type="button"
                        data-column-order-action="move-left"
                        disabled={index === 0}
                        onClick={() => handleMoveColumn(column.key, "left")}
                      >
                        左移
                      </button>
                      <button
                        type="button"
                        data-column-order-action="move-right"
                        disabled={index === orderedColumns.length - 1}
                        onClick={() => handleMoveColumn(column.key, "right")}
                      >
                        右移
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <KnowledgeLibraryLedgerGrid
            columns={orderedColumns}
            rows={ledgerRows}
            density={density}
            selectedAssetId={selectedRowId}
            columnWidths={columnWidths}
            onSelectAsset={(assetId) => void handleSelectAsset(assetId)}
            onEditAsset={(assetId) => void handleEditAsset(assetId)}
            onArchiveAsset={(assetId) => void handleArchiveAsset(assetId)}
            onRestoreAsset={(assetId) => void handleRestoreAsset(assetId)}
            onMovePriorityUp={(assetId) => handleMovePriority(assetId, "up")}
            onMovePriorityDown={(assetId) => handleMovePriority(assetId, "down")}
            onColumnResizeStart={handleColumnResizeStart}
          />

          {isFilterDrawerOpen ? (
            <aside className="knowledge-library-ledger-filters" aria-label="高级筛选抽屉">
              <header className="knowledge-library-ledger-filters__header">
                <div>
                  <p className="knowledge-library-ledger-page__eyebrow">筛选</p>
                  <h2>筛选条件</h2>
                  <p>高级条件收进抽屉，不再切换到独立搜索页。</p>
                </div>
                <button type="button" onClick={() => setIsFilterDrawerOpen(false)}>
                  关闭
                </button>
              </header>

              <div className="knowledge-library-ledger-filters__body">
                <label>
                  <span>搜索方式</span>
                  <select
                    value={queryMode}
                    onChange={(event) =>
                      setQueryMode(event.target.value as KnowledgeLibraryQueryMode)
                    }
                  >
                    <option value="keyword">关键词检索</option>
                    <option value="semantic">语义检索</option>
                  </select>
                </label>

                <label>
                  <span>分类</span>
                  <select
                    value={knowledgeKindFilter}
                    onChange={(event) =>
                      setKnowledgeKindFilter(
                        event.target.value as KnowledgeLibraryFilterState["knowledgeKind"],
                      )
                    }
                  >
                    {KNOWLEDGE_KIND_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>适用模块</span>
                  <select
                    value={moduleScopeFilter}
                    onChange={(event) =>
                      setModuleScopeFilter(
                        event.target.value as KnowledgeLibraryFilterState["moduleScope"],
                      )
                    }
                  >
                    {MODULE_SCOPE_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>AI语义状态</span>
                  <select
                    value={semanticStatusFilter}
                    onChange={(event) =>
                      setSemanticStatusFilter(
                        event.target.value as KnowledgeLibraryFilterState["semanticStatus"],
                      )
                    }
                  >
                    {SEMANTIC_STATUS_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>贡献人查询</span>
                  <input
                    type="search"
                    value={contributorQuery}
                    onChange={(event) => setContributorQuery(event.target.value)}
                    placeholder="按账号或提交人查询"
                  />
                </label>
              </div>

              <div className="knowledge-library-ledger-filters__actions">
                <button
                  type="button"
                  onClick={() => {
                    setKnowledgeKindFilter("all");
                    setModuleScopeFilter("any");
                    setSemanticStatusFilter("all");
                    setContributorQuery("");
                  }}
                >
                  清空
                </button>
                <button type="button" onClick={() => void handleRunSearch()}>
                  应用筛选
                </button>
              </div>
            </aside>
          ) : null}
        </div>

        {boardMode !== "closed" && composer ? (
          <aside className="knowledge-library-ledger-page__board">
            {composer.sourceSummary ? (
              <KnowledgeCandidateSourceStrip source={composer.sourceSummary} />
            ) : null}
            <KnowledgeLibraryEntryForm
            mode={boardMode === "edit" ? "edit" : "create"}
            aiAssistMode={aiAssistMode}
            composer={composer}
            attachments={attachments}
            contentBlocks={composer.contentBlocksDraft}
            aiIntakeSourceText={composer.aiIntakeSourceText}
            duplicateSummary={duplicateSummary}
            evidenceGateSummary={evidenceGateSummary}
            semanticStatusLabel={semanticStatusLabel}
            semanticNotes={semanticNotes}
            isBusy={isBusy}
            canRunAiPrefill={canRunAiPrefill}
            canGenerateSemantic={canGenerateSemantic}
            canApplySemantic={canApplySemantic}
            canConfirmEntry={canConfirmEntry}
            onAiAssistModeChange={setAiAssistMode}
            onTitleChange={(value) =>
              setComposer((current) =>
                current ? withBaseFieldChange(current, { title: value }) : current,
              )
            }
            onCanonicalTextChange={(value) =>
              setComposer((current) =>
                current
                  ? withBaseFieldChange(current, { canonicalText: value })
                  : current,
              )
            }
            onSummaryChange={(value) =>
              setComposer((current) =>
                current ? withBaseFieldChange(current, { summary: value }) : current,
              )
            }
            onKnowledgeKindChange={(value) =>
              setComposer((current) =>
                current
                  ? withBaseFieldChange(current, { knowledgeKind: value })
                  : current,
              )
            }
            onModuleScopeChange={(value) =>
              setComposer((current) =>
                current ? withBaseFieldChange(current, { moduleScope: value }) : current,
              )
            }
            onEvidenceLevelChange={(value) =>
              setComposer((current) =>
                current ? withBaseFieldChange(current, { evidenceLevel: value }) : current,
              )
            }
            onSourceTypeChange={(value) =>
              setComposer((current) =>
                current ? withBaseFieldChange(current, { sourceType: value }) : current,
              )
            }
            onToggleManuscriptType={(value) =>
              setComposer((current) =>
                current
                  ? withBaseFieldChange(current, {
                      manuscriptTypes: toggleLedgerManuscriptTypeSelection(
                        current.draft.manuscriptTypes,
                        value,
                      ),
                    })
                  : current,
              )
            }
            onSelectAnyManuscriptTypes={() =>
              setComposer((current) =>
                current
                  ? withBaseFieldChange(current, {
                      manuscriptTypes: "any",
                    })
                  : current,
              )
            }
            onToggleSection={(value) =>
              setComposer((current) =>
                current
                  ? withBaseFieldChange(current, {
                      sections: toggleLedgerStringSelection(current.draft.sections ?? [], value),
                    })
                  : current,
              )
            }
            onAiIntakeSourceTextChange={(value) =>
              setComposer((current) =>
                current
                  ? {
                      ...current,
                      aiIntakeSourceText: value,
                    }
                  : current,
              )
            }
            onRunAiPrefill={() => void handleRunAiPrefill()}
            onContentBlocksChange={(blocks) =>
              setComposer((current) =>
                current
                  ? {
                      ...current,
                      contentBlocksDraft: blocks,
                    }
                  : current,
              )
            }
            onUploadImage={(input) => handleUploadInlineImage(input)}
            tableEvidenceClient={
              composer.persistedRevisionId ? defaultHttpClient : undefined
            }
            onSelectFiles={(files) => void handleUploadFiles(files)}
            onRemoveAttachment={(blockId) =>
              setComposer((current) =>
                current
                  ? {
                      ...current,
                      contentBlocksDraft: current.contentBlocksDraft.filter(
                        (block) => block.id !== blockId,
                      ),
                    }
                  : current,
              )
            }
            onAttachmentCaptionChange={(blockId, value) =>
              setComposer((current) =>
                current
                  ? {
                      ...current,
                      contentBlocksDraft: current.contentBlocksDraft.map((block) =>
                        block.id === blockId
                          ? {
                              ...block,
                              content_payload: {
                                ...block.content_payload,
                                caption: value,
                              },
                            }
                          : block,
                      ),
                    }
                  : current,
              )
            }
            onSemanticPageSummaryChange={(value) =>
              setComposer((current) =>
                current
                  ? withSemanticFieldChange(current, {
                      page_summary: value,
                    })
                  : current,
              )
            }
            onGenerateSemantic={() => void handleGenerateSemantic()}
            onApplySemantic={handleApplySemantic}
            onAddRetrievalTerm={() =>
              setComposer((current) =>
                current
                  ? withSemanticFieldChange(current, {
                      retrieval_terms: [...(current.semanticLayerDraft?.retrieval_terms ?? []), ""],
                    })
                  : current,
              )
            }
            onChangeRetrievalTerm={(index, value) =>
              setComposer((current) =>
                current
                  ? withSemanticFieldChange(current, {
                      retrieval_terms: updateListValue(
                        current.semanticLayerDraft?.retrieval_terms ?? [],
                        index,
                        value,
                      ),
                    })
                  : current,
              )
            }
            onRemoveRetrievalTerm={(index) =>
              setComposer((current) =>
                current
                  ? withSemanticFieldChange(current, {
                      retrieval_terms: removeListValue(
                        current.semanticLayerDraft?.retrieval_terms ?? [],
                        index,
                      ),
                    })
                  : current,
              )
            }
            onAddAlias={() =>
              setComposer((current) =>
                current
                  ? withSemanticReviewFieldChange(current, {
                      aliases: [...(current.draft.aliases ?? []), ""],
                    })
                  : current,
              )
            }
            onChangeAlias={(index, value) =>
              setComposer((current) =>
                current
                  ? withSemanticReviewFieldChange(current, {
                      aliases: updateListValue(current.draft.aliases ?? [], index, value),
                    })
                  : current,
              )
            }
            onRemoveAlias={(index) =>
              setComposer((current) =>
                current
                  ? withSemanticReviewFieldChange(current, {
                      aliases: removeListValue(current.draft.aliases ?? [], index),
                    })
                  : current,
              )
            }
            onAddScenario={() =>
              setComposer((current) =>
                current
                  ? withSemanticFieldChange(current, {
                      retrieval_snippets: [
                        ...(current.semanticLayerDraft?.retrieval_snippets ?? []),
                        "",
                      ],
                    })
                  : current,
              )
            }
            onChangeScenario={(index, value) =>
              setComposer((current) =>
                current
                  ? withSemanticFieldChange(current, {
                      retrieval_snippets: updateListValue(
                        current.semanticLayerDraft?.retrieval_snippets ?? [],
                        index,
                        value,
                      ),
                    })
                  : current,
              )
            }
            onRemoveScenario={(index) =>
              setComposer((current) =>
                current
                  ? withSemanticFieldChange(current, {
                      retrieval_snippets: removeListValue(
                        current.semanticLayerDraft?.retrieval_snippets ?? [],
                        index,
                      ),
                    })
                  : current,
              )
            }
            onAddRiskTag={() =>
              setComposer((current) =>
                current
                  ? withSemanticReviewFieldChange(current, {
                      riskTags: [...(current.draft.riskTags ?? []), ""],
                    })
                  : current,
              )
            }
            onChangeRiskTag={(index, value) =>
              setComposer((current) =>
                current
                  ? withSemanticReviewFieldChange(current, {
                      riskTags: updateListValue(current.draft.riskTags ?? [], index, value),
                    })
                  : current,
              )
            }
            onRemoveRiskTag={(index) =>
              setComposer((current) =>
                current
                  ? withSemanticReviewFieldChange(current, {
                      riskTags: removeListValue(current.draft.riskTags ?? [], index),
                    })
                  : current,
              )
            }
            onCancel={handleCancelForm}
            onSaveDraft={() =>
              void persistComposer({
                requireConfirmedSemantic: false,
                closeForm: false,
                submitReview: false,
                successMessage: "草稿已保存。",
              })
            }
            onConfirmEntry={() =>
              void persistComposer({
                requireConfirmedSemantic: true,
                closeForm: true,
                submitReview: false,
                successMessage: "知识已录入台账。",
              })
            }
            onSubmitReview={
              composer.persistedRevisionId
                ? () =>
                    void persistComposer({
                      requireConfirmedSemantic: true,
                      closeForm: false,
                      submitReview: true,
                      successMessage: "知识已提交审核。",
                    })
                : undefined
            }
          />
            <section
              className="knowledge-library-entry-form__section knowledge-library-ledger-bindings-panel"
              data-knowledge-binding-panel="structured"
            >
              <div className="knowledge-library-entry-form__section-header">
                <h3>结构化绑定</h3>
                <p>直接绑定真实模板、规则包、章节和知识项，不再手填伪绑定文本。</p>
              </div>

              {bindingCatalogStatus === "loading" ? (
                <p className="knowledge-library-entry-form__structured-empty">
                  正在加载绑定目录…
                </p>
              ) : null}
              {bindingCatalogError ? (
                <p className="knowledge-library-entry-form__structured-empty">
                  {bindingCatalogError}
                </p>
              ) : null}

              <div className="knowledge-library-entry-form__grid">
                {LEDGER_BINDING_FIELD_DEFINITIONS.map((definition) => {
                  const options = definition.getOptions(resolvedBindingCatalog);
                  return (
                    <KnowledgeLibraryLedgerBindingField
                      key={definition.kind}
                      label={definition.label}
                      helpText={definition.helpText}
                      value={getLedgerBindingSelectionValues(
                        composer.draft.bindings ?? [],
                        definition.kind,
                      )}
                      options={options}
                      dataKey={definition.dataKey}
                      onToggleValue={(value) =>
                        setComposer((current) =>
                          current
                            ? {
                                ...current,
                                draft: {
                                  ...current.draft,
                                  bindings: toggleLedgerBindingSelection(
                                    current.draft.bindings ?? [],
                                    definition.kind,
                                    resolveLedgerBindingOptionByValue(options, value),
                                  ),
                                },
                              }
                            : current,
                        )
                      }
                    />
                  );
                })}
              </div>

              {normalizedStructuredBindings.length > 0 ? (
                <ul
                  className="knowledge-library-entry-form__selected-summary"
                  data-knowledge-binding-summary="structured"
                >
                  {normalizedStructuredBindings.map((binding) => (
                    <li
                      key={`${binding.bindingKind}:${binding.bindingTargetId}`}
                      className="knowledge-library-entry-form__selected-chip"
                    >
                      {binding.bindingTargetLabel}
                      <small>{formatLedgerBindingKindLabel(binding.bindingKind)}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="knowledge-library-entry-form__structured-empty">
                  尚未添加结构化绑定。
                </p>
              )}
            </section>
          </aside>
        ) : null}
      </section>
    </main>
  );

  async function loadWorkbench(
    input: {
      selectedAssetId?: string;
      selectedRevisionId?: string;
      filters?: Partial<KnowledgeLibraryFilterState>;
    } = {},
  ) {
    setLoadStatus("loading");
    setErrorMessage(null);

    try {
      const nextViewModel = await controller.loadWorkbench({
        selectedAssetId:
          input.selectedAssetId ?? viewModel?.selectedAssetId ?? selectedRowId ?? null,
        selectedRevisionId:
          input.selectedRevisionId ?? viewModel?.selectedRevisionId ?? null,
        filters: {
          ...viewModel?.filters,
          ...input.filters,
        },
      });
      applyLoadedWorkbench(nextViewModel);
      return nextViewModel;
    } catch (error) {
      setLoadStatus("error");
      setErrorMessage(toErrorMessage(error, "知识台账加载失败。"));
      return null;
    }
  }

  function applyLoadedWorkbench(nextViewModel: KnowledgeLibraryWorkbenchViewModel) {
    setViewModel(nextViewModel);
    setSelectedRowId(nextViewModel.selectedAssetId ?? null);
    setSearchQuery(nextViewModel.filters.searchText);
    setQueryMode(nextViewModel.filters.queryMode);
    setKnowledgeKindFilter(nextViewModel.filters.knowledgeKind);
    setModuleScopeFilter(nextViewModel.filters.moduleScope);
    setSemanticStatusFilter(nextViewModel.filters.semanticStatus);
    setAssetStatusFilter(nextViewModel.filters.assetStatus ?? "active");
    setContributorQuery(nextViewModel.filters.contributorText);
    setLoadStatus("ready");
  }

  function handleColumnResizeStart(
    key: KnowledgeLibraryLedgerColumnKey,
    startX: number,
  ) {
    resizeStateRef.current = {
      key,
      startX,
      startWidth: columnWidths[key],
    };
  }

  function handleOpenCreateForm() {
    setComposer(createEmptyLedgerComposer());
    setBoardMode("create");
    setAiAssistMode("manual");
    setIsFilterDrawerOpen(false);
    setSemanticNotes([]);
    setErrorMessage(null);
    setStatusMessage(null);
  }

  function handleOpenAiIntakeForm() {
    setComposer(createEmptyLedgerComposer());
    setBoardMode("create");
    setAiAssistMode("prefill");
    setIsFilterDrawerOpen(false);
    setSemanticNotes([]);
    setErrorMessage(null);
    setStatusMessage(null);
  }

  async function handleSelectAsset(assetId: string) {
    setSelectedRowId(assetId);
    if (viewModel?.selectedAssetId === assetId && viewModel.detail?.asset.id === assetId) {
      return;
    }

    await loadWorkbench({
      selectedAssetId: assetId,
      selectedRevisionId: undefined,
      filters: viewModel?.filters,
    });
  }

  async function handleEditAsset(assetId: string) {
    setIsBusy(true);
    setErrorMessage(null);

    try {
      let nextViewModel = viewModel;
      if (
        !nextViewModel ||
        nextViewModel.selectedAssetId !== assetId ||
        nextViewModel.detail?.asset.id !== assetId
      ) {
        nextViewModel = await controller.loadWorkbench({
          selectedAssetId: assetId,
          filters: viewModel?.filters,
        });
        applyLoadedWorkbench(nextViewModel);
      }

      let nextComposer = createEditableComposerFromViewModel(nextViewModel);
      if (!nextComposer) {
        nextViewModel = await controller.createDerivedDraftAndLoad({
          assetId,
          filters: nextViewModel.filters,
        });
        applyLoadedWorkbench(nextViewModel);
        nextComposer = createEditableComposerFromViewModel(nextViewModel);
      }

      if (!nextComposer) {
        throw new Error("暂时无法打开可编辑草稿。");
      }

      setComposer(nextComposer);
      setBoardMode("edit");
      setAiAssistMode("manual");
      setIsFilterDrawerOpen(false);
      setSemanticNotes(nextComposer.warnings);
      setStatusMessage(null);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "打开知识编辑表单失败。"));
    } finally {
      setIsBusy(false);
    }
  }

  function handleCancelForm() {
    setBoardMode("closed");
    setAiAssistMode("manual");
    setSemanticNotes([]);
    setErrorMessage(null);
    setStatusMessage(null);
    setComposer(createEditableComposerFromViewModel(viewModel));
  }

  async function handleArchiveAsset(assetId: string) {
    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const nextViewModel = await controller.archiveAssetAndLoad({
        assetId,
        filters: createCurrentFilterState({
          searchText: searchQuery,
          queryMode,
          knowledgeKind: knowledgeKindFilter,
          moduleScope: moduleScopeFilter,
          semanticStatus: semanticStatusFilter,
          assetStatus: assetStatusFilter,
          contributorText: contributorQuery,
        }),
      });

      applyLoadedWorkbench(nextViewModel);
      setComposer(createEditableComposerFromViewModel(nextViewModel));
      setSemanticNotes([]);
      setStatusMessage("知识已移入回收区。");
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "移入回收区失败。"));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRestoreAsset(assetId: string) {
    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const nextViewModel = await controller.restoreAssetAndLoad({
        assetId,
        filters: createCurrentFilterState({
          searchText: searchQuery,
          queryMode,
          knowledgeKind: knowledgeKindFilter,
          moduleScope: moduleScopeFilter,
          semanticStatus: semanticStatusFilter,
          assetStatus: assetStatusFilter,
          contributorText: contributorQuery,
        }),
      });

      applyLoadedWorkbench(nextViewModel);
      setComposer(createEditableComposerFromViewModel(nextViewModel));
      setSemanticNotes([]);
      setStatusMessage("知识已从回收区恢复为草稿。");
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "恢复知识失败。"));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRestoreVisibleArchivedAssets() {
    if (visibleArchivedAssetIds.length === 0) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const nextViewModel = await controller.restoreAssetsAndLoad({
        assetIds: visibleArchivedAssetIds,
        filters: createCurrentFilterState({
          searchText: searchQuery,
          queryMode,
          knowledgeKind: knowledgeKindFilter,
          moduleScope: moduleScopeFilter,
          semanticStatus: semanticStatusFilter,
          assetStatus: assetStatusFilter,
          contributorText: contributorQuery,
        }),
      });

      applyLoadedWorkbench(nextViewModel);
      setComposer(createEditableComposerFromViewModel(nextViewModel));
      setSemanticNotes([]);
      setStatusMessage(`已恢复 ${visibleArchivedAssetIds.length} 条知识，均已回到草稿。`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "批量恢复失败。"));
    } finally {
      setIsBusy(false);
    }
  }

  function handleDeleteSelected() {
    if (!selectedRowId) {
      return;
    }

    void handleArchiveAsset(selectedRowId);
  }

  async function handleRunSearch() {
    await loadWorkbench({
      selectedAssetId: selectedRowId ?? undefined,
      filters: createCurrentFilterState({
        searchText: searchQuery,
        queryMode,
        knowledgeKind: knowledgeKindFilter,
        moduleScope: moduleScopeFilter,
        semanticStatus: semanticStatusFilter,
        assetStatus: assetStatusFilter,
        contributorText: contributorQuery,
      }),
    });
    setIsFilterDrawerOpen(false);
  }

  async function handleBackToLedger() {
    setSearchQuery("");
    setSearchMode("keyword");
    await loadWorkbench({
      selectedAssetId: selectedRowId ?? undefined,
      filters: {
        searchText: "",
        queryMode: "keyword",
        assetStatus: "active",
      },
    });
    setSurface("table");
  }

  function handleMovePriority(
    assetId: string,
    direction: "up" | "down",
  ) {
    const allAssetIds = viewModel?.library.map((item) => item.id) ?? [];
    const nextPriorityOrder = moveKnowledgeLibraryPriority(
      priorityOrder,
      allAssetIds,
      visiblePriorityAssetIds,
      assetId,
      direction,
    );

    if (areStringArraysEqual(priorityOrder, nextPriorityOrder)) {
      return;
    }

    setPriorityOrder(nextPriorityOrder);
    setErrorMessage(null);
    setStatusMessage(
      direction === "up" ? "已提升列表优先级。" : "已降低列表优先级。",
    );
  }

  function handleMoveColumn(
    columnKey: KnowledgeLibraryLedgerColumnKey,
    direction: "left" | "right",
  ) {
    const nextColumnOrder = moveKnowledgeLibraryColumn(
      columnOrder,
      columnKey,
      direction,
    );
    if (areStringArraysEqual(columnOrder, nextColumnOrder)) {
      return;
    }

    setColumnOrder(nextColumnOrder);
    setErrorMessage(null);
    setStatusMessage(
      direction === "left" ? "已将列向左移动。" : "已将列向右移动。",
    );
  }

  function handleResetColumnOrder() {
    setColumnOrder(DEFAULT_COLUMN_ORDER);
    setErrorMessage(null);
    setStatusMessage("已恢复默认列顺序。");
  }

  async function handleRunAiPrefill() {
    if (!composer) {
      return;
    }

    const sourceText = buildAiPrefillSourceText(composer);
    if (sourceText.trim().length === 0) {
      setErrorMessage("请先粘贴 AI 预填充文本来源，再生成候选内容。");
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      const suggestion = await controller.createAiIntakeSuggestion({
        sourceText,
      });
      setComposer((current) =>
        current ? applyAiIntakeSuggestion(current, suggestion) : current,
      );
      setSemanticNotes(suggestion.warnings);
      setStatusMessage(
        "AI 已根据文本来源填入基础信息、内容材料和语义候选，请逐项核对后再确认录入。",
      );
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "AI 预填充生成失败。"));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleGenerateSemantic() {
    if (!composer) {
      return;
    }

    const sourceText = buildSemanticSourceText(composer);
    if (sourceText.trim().length === 0) {
      setErrorMessage("请先填写名称、答案或详情，再生成 AI 语义。");
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      const analysisTarget = await ensureComposerPersistedForSemanticAnalysis(composer);
      const suggestion = await generateKnowledgeLibrarySemanticSuggestion({
        controller,
        composer: analysisTarget.composer,
        sourceText,
      });
      const nextComposer = applyKnowledgeLibrarySemanticSuggestion(
        analysisTarget.composer,
        suggestion,
      );
      setComposer(nextComposer);
      setSemanticNotes([
        ...buildKnowledgeLibrarySemanticAnalysisNotes({
          composer: analysisTarget.composer,
          autoPersistedDraft: analysisTarget.autoPersisted,
        }),
        ...suggestion.suggestion.warnings,
      ]);
      setStatusMessage(
        analysisTarget.autoPersisted
          ? "AI 语义建议已生成，系统已先保存当前草稿并纳入材料块分析。"
          : "AI 语义建议已生成，请核对后点击“应用建议”。",
      );
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "AI 语义生成失败。"));
    } finally {
      setIsBusy(false);
    }
  }

  async function ensureComposerPersistedForSemanticAnalysis(
    currentComposer: KnowledgeLibraryLedgerComposer,
  ): Promise<{
    composer: KnowledgeLibraryLedgerComposer;
    autoPersisted: boolean;
  }> {
    if (currentComposer.persistedRevisionId) {
      return {
        composer: currentComposer,
        autoPersisted: false,
      };
    }

    let nextViewModel = await controller.createDraftAndLoad({
      ...buildCreateDraftInput(currentComposer),
      filters: viewModel?.filters,
    });
    let revisionId = nextViewModel.detail?.selected_revision.id ?? null;
    if (!revisionId) {
      throw new Error("AI 语义分析前未找到已保存的知识草稿。");
    }

    if (currentComposer.contentBlocksDraft.length > 0) {
      nextViewModel = await controller.replaceContentBlocksAndLoad({
        revisionId,
        blocks: hydrateBlocksForRevision(currentComposer.contentBlocksDraft, revisionId),
        filters: nextViewModel.filters,
      });
      revisionId = nextViewModel.detail?.selected_revision.id ?? revisionId;
    }

    applyLoadedWorkbench(nextViewModel);
    const persistedComposer = createEditableComposerFromViewModel(nextViewModel);
    if (!persistedComposer) {
      throw new Error("AI 语义分析前未能构建可编辑草稿。");
    }

    return {
      composer: {
        ...persistedComposer,
        aiIntakeSourceText: currentComposer.aiIntakeSourceText,
        warnings: currentComposer.warnings,
      },
      autoPersisted: true,
    };
  }

  function handleApplySemantic() {
    setComposer((current) =>
      current?.semanticLayerDraft
        ? {
            ...current,
            semanticLayerDraft: {
              ...current.semanticLayerDraft,
              status: "confirmed",
            },
          }
        : current,
    );
    setStatusMessage("AI 语义已确认，可录入台账。");
  }

  async function persistComposer(input: {
    requireConfirmedSemantic: boolean;
    closeForm: boolean;
    submitReview: boolean;
    successMessage: string;
  }) {
    if (!composer) {
      return;
    }

    if (composer.draft.title.trim().length === 0) {
      setErrorMessage("请先填写名称 / 关键词。");
      return;
    }

    if (composer.draft.canonicalText.trim().length === 0) {
      setErrorMessage("请先填写答案。");
      return;
    }

    if (
      input.requireConfirmedSemantic &&
      composer.semanticLayerDraft?.status !== "confirmed"
    ) {
      setErrorMessage("请先生成并确认 AI 语义，再执行录入。");
      return;
    }

    if (input.submitReview && strongDuplicateMatches.length > 0) {
      setErrorMessage("存在高风险重复项，请先核对后再提交审核。");
      return;
    }

    if (input.submitReview && evidenceGateSummary.hasBlockingIssues) {
      setErrorMessage(
        evidenceGateSummary.blockingMessage ?? "高精度证据未满足提交审核条件。",
      );
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const wasLearningCandidateMaterialized =
        composer.persistedRevisionId == null &&
        composer.sourceLearningCandidateId != null;
      let nextViewModel = composer.persistedRevisionId
        ? await controller.saveDraftAndLoad({
            revisionId: composer.persistedRevisionId,
            input: {
              ...composer.draft,
            },
            filters: viewModel?.filters,
          })
        : composer.sourceLearningCandidateId
          ? await controller.createDraftFromLearningCandidateAndLoad({
              ...buildCreateDraftInput(composer),
              learningCandidateId: composer.sourceLearningCandidateId,
              actorRole,
              filters: viewModel?.filters,
            })
        : await controller.createDraftAndLoad({
            ...buildCreateDraftInput(composer),
            filters: viewModel?.filters,
          });

      let revisionId = nextViewModel.detail?.selected_revision.id ?? null;
      if (!revisionId) {
        throw new Error("保存后未找到知识修订版本。");
      }

      if (composer.contentBlocksDraft.length > 0 || composer.persistedRevisionId !== null) {
        nextViewModel = await controller.replaceContentBlocksAndLoad({
          revisionId,
          blocks: hydrateBlocksForRevision(composer.contentBlocksDraft, revisionId),
          filters: nextViewModel.filters,
        });
        revisionId = nextViewModel.detail?.selected_revision.id ?? revisionId;
      }

      if (composer.semanticLayerDraft?.status === "confirmed") {
        nextViewModel = await controller.confirmSemanticLayerAndLoad({
          revisionId,
          filters: nextViewModel.filters,
          input: toSemanticLayerInput(composer.semanticLayerDraft),
        });
        revisionId = nextViewModel.detail?.selected_revision.id ?? revisionId;
      }

      if (input.submitReview) {
        nextViewModel = await controller.submitDraftAndLoad({
          revisionId,
          filters: nextViewModel.filters,
        });
      }

      applyLoadedWorkbench(nextViewModel);
      const loadedComposer = createEditableComposerFromViewModel(nextViewModel);
      setComposer(
        loadedComposer && composer.sourceSummary
          ? {
              ...loadedComposer,
              sourceSummary: composer.sourceSummary,
            }
          : loadedComposer,
      );
      setSemanticNotes([]);
      setStatusMessage(
        wasLearningCandidateMaterialized
          ? "已从学习候选创建知识草稿，需提交知识审核后才能生效。"
          : input.successMessage,
      );
      setSurface("table");
      if (input.closeForm) {
        setFormMode("closed");
        setAiAssistMode("manual");
      } else {
        setFormMode("edit");
      }
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "知识保存失败。"));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleUploadInlineImage(input: {
    fileName: string;
    mimeType: string;
    fileContentBase64: string;
  }) {
    setIsBusy(true);
    setErrorMessage(null);

    try {
      const uploaded = await controller.uploadImage(input);
      setStatusMessage("图片块上传成功，可直接用于 AI 语义分析。");
      return uploaded;
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "图片块上传失败。"));
      return undefined;
    } finally {
      setIsBusy(false);
    }
  }

  async function handleUploadFiles(files: readonly File[]) {
    if (!composer || files.length === 0) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      const uploadedBlocks: KnowledgeContentBlockViewModel[] = [];

      for (const file of files) {
        const fileContentBase64 = await readFileAsBase64(file);
        const uploaded = await controller.uploadImage({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileContentBase64,
        });
        uploadedBlocks.push(
          createImageBlock({
            upload: uploaded,
            revisionId: composer.persistedRevisionId ?? "local-draft",
            orderNo: composer.contentBlocksDraft.length + uploadedBlocks.length,
          }),
        );
      }

      setComposer((current) =>
        current
          ? {
              ...current,
              contentBlocksDraft: [...current.contentBlocksDraft, ...uploadedBlocks],
            }
          : current,
      );
      setStatusMessage("附件上传成功。");
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "附件上传失败。"));
    } finally {
      setIsBusy(false);
    }
  }
}

const KNOWLEDGE_KIND_FILTER_OPTIONS: ReadonlyArray<{
  value: KnowledgeLibraryFilterState["knowledgeKind"];
  label: string;
}> = [
  { value: "all", label: "全部分类" },
  { value: "rule", label: "规则投影" },
  { value: "case_pattern", label: "案例模式" },
  { value: "checklist", label: "核查清单" },
  { value: "prompt_snippet", label: "提示片段" },
  { value: "reference", label: "参考资料" },
  { value: "other", label: "其他" },
];

const MODULE_SCOPE_FILTER_OPTIONS: ReadonlyArray<{
  value: KnowledgeLibraryFilterState["moduleScope"];
  label: string;
}> = [
  { value: "any", label: "全部模块" },
  { value: "screening", label: "初筛" },
  { value: "editing", label: "编辑" },
  { value: "proofreading", label: "校对" },
  { value: "manual", label: "人工处理" },
  { value: "learning", label: "学习回流" },
];

const SEMANTIC_STATUS_FILTER_OPTIONS: ReadonlyArray<{
  value: KnowledgeLibraryFilterState["semanticStatus"];
  label: string;
}> = [
  { value: "all", label: "全部状态" },
  { value: "not_generated", label: "未生成" },
  { value: "pending_confirmation", label: "待确认" },
  { value: "confirmed", label: "已确认" },
  { value: "stale", label: "待更新" },
];

const KNOWLEDGE_LIBRARY_PRIORITY_STORAGE_KEY =
  "knowledge-library-ledger-priority-v1";

const KNOWLEDGE_LIBRARY_COLUMN_ORDER_STORAGE_KEY =
  "knowledge-library-ledger-column-order-v1";

const DEFAULT_COLUMN_ORDER: KnowledgeLibraryLedgerColumnKey[] =
  KNOWLEDGE_LIBRARY_LEDGER_COLUMNS.map((column) => column.key);

const DEFAULT_COLUMN_WIDTHS: KnowledgeLibraryLedgerColumnWidthMap = {
  title: 320,
  status: 120,
  category: 140,
  moduleScope: 140,
  manuscriptTypes: 180,
  answer: 280,
  detail: 220,
  attachments: 140,
  semanticStatus: 160,
  semanticSummary: 240,
  retrievalTerms: 220,
  aliases: 180,
  scenarios: 220,
  riskTags: 180,
  retrievalCount: 120,
  recentRetrievalCount: 120,
  lastUsedAt: 140,
  revisionCount: 110,
  contributor: 160,
  revisionId: 180,
  archivedAt: 160,
  archivedBy: 140,
  date: 140,
};

const MIN_COLUMN_WIDTHS: KnowledgeLibraryLedgerColumnWidthMap =
  KNOWLEDGE_LIBRARY_LEDGER_COLUMNS.reduce(
    (result, column) => ({
      ...result,
      [column.key]: column.minWidth,
    }),
    {} as KnowledgeLibraryLedgerColumnWidthMap,
  );

function createCurrentFilterState(
  input: Partial<KnowledgeLibraryFilterState>,
): Partial<KnowledgeLibraryFilterState> {
  return {
    searchText: input.searchText?.trim() ?? "",
    queryMode: input.queryMode === "semantic" ? "semantic" : "keyword",
    knowledgeKind: input.knowledgeKind ?? "all",
    moduleScope: input.moduleScope ?? "any",
    semanticStatus: input.semanticStatus ?? "all",
    assetStatus: input.assetStatus ?? "active",
    contributorText: input.contributorText?.trim() ?? "",
  };
}

function countActiveFilters(
  input: Pick<
    KnowledgeLibraryFilterState,
    "knowledgeKind" | "moduleScope" | "semanticStatus" | "contributorText"
  >,
): number {
  return [
    input.knowledgeKind !== "all",
    input.moduleScope !== "any",
    input.semanticStatus !== "all",
    input.contributorText.trim().length > 0,
  ].filter(Boolean).length;
}

function createEditableComposerFromViewModel(
  viewModel: KnowledgeLibraryWorkbenchViewModel | null,
): KnowledgeLibraryLedgerComposer | null {
  const selectedRevision = viewModel?.detail?.selected_revision ?? null;
  if (!selectedRevision || selectedRevision.status !== "draft") {
    return null;
  }

  return createComposerFromSelectedRevision(
    selectedRevision,
    viewModel?.selectedAssetId ?? null,
  );
}

function createComposerFromSelectedRevision(
  selectedRevision: KnowledgeRevisionViewModel,
  selectedAssetId: string | null,
): KnowledgeLibraryLedgerComposer {
  return createLedgerComposerFromKnowledgeRevision(selectedRevision, selectedAssetId);
}

/*
function createLedgerRow(
  item: KnowledgeLibrarySummaryViewModel,
  revision: KnowledgeRevisionViewModel | null,
) {
  return {
    id: item.id,
    title: item.title,
    status: formatRevisionStatusLabel(item.status),
    moduleScope: formatModuleScopeLabel(item.module_scope),
    manuscriptTypes: formatManuscriptTypesLabel(item.manuscript_types),
    answer: revision?.canonical_text ?? item.summary ?? "",
    category: formatKnowledgeKind(item.knowledge_kind),
    detail: revision?.summary ?? item.summary ?? "",
    attachments: formatAttachmentLabel(revision?.content_blocks ?? []),
    semanticStatus: formatSemanticStatusLabel(item.semantic_status ?? "not_generated"),
    contributor: item.contributor_label ?? "",
    revisionId: item.selected_revision_id ?? "",
    date: formatDate(item.updated_at),
    semanticSummary: revision?.semantic_layer?.page_summary ?? "",
    retrievalTerms: (revision?.semantic_layer?.retrieval_terms ?? []).join("、"),
    aliases: (revision?.aliases ?? []).join("、"),
    scenarios: (revision?.semantic_layer?.retrieval_snippets ?? []).join("；"),
    riskTags: (revision?.routing.risk_tags ?? []).join("、"),
  };
}

function formatKnowledgeKind(value: KnowledgeLibrarySummaryViewModel["knowledge_kind"]): string {
  return formatEditorialKnowledgeKindLabel(
    value,
    value === "rule" ? "projection" : "rule",
  );
}

function formatAttachmentLabel(blocks: readonly KnowledgeContentBlockViewModel[]): string {
  const imageCount = blocks.filter((block) => block.block_type === "image_block").length;
  return imageCount > 0 ? `${imageCount} 个附件` : "";
}

function formatDate(value?: string): string {
  if (!value) {
    return "";
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Date(parsed).toISOString().slice(0, 10);
}

function formatSemanticStatusLabel(
  value: KnowledgeSemanticLayerViewModel["status"] | "not_generated",
): string {
  switch (value) {
    case "confirmed":
      return "已确认";
    case "pending_confirmation":
      return "待确认";
    case "stale":
      return "待更新";
    case "not_generated":
    default:
      return "未生成";
  }
}

*/

/*
function createLedgerRow(
  item: KnowledgeLibrarySummaryViewModel,
  revision: KnowledgeRevisionViewModel | null,
) {
  return {
    id: item.id,
    title: item.title,
    status: formatRevisionStatusLabel(item.status),
    category: formatKnowledgeKind(item.knowledge_kind),
    moduleScope: formatModuleScopeLabel(item.module_scope),
    manuscriptTypes: formatManuscriptTypesLabel(item.manuscript_types),
    answer: revision?.canonical_text ?? item.summary ?? "",
    detail: revision?.summary ?? item.summary ?? "",
    attachments: formatAttachmentLabel(revision?.content_blocks ?? []),
    semanticStatus: formatSemanticStatusLabel(item.semantic_status ?? "not_generated"),
    semanticSummary: revision?.semantic_layer?.page_summary ?? "",
    retrievalTerms: (revision?.semantic_layer?.retrieval_terms ?? []).join("、"),
    aliases: (revision?.aliases ?? []).join("、"),
    scenarios: (revision?.semantic_layer?.retrieval_snippets ?? []).join("；"),
    riskTags: (revision?.routing.risk_tags ?? []).join("、"),
    retrievalCount: String(item.usage_metrics?.retrieval_count ?? 0),
    recentRetrievalCount: String(item.usage_metrics?.retrieval_count_30d ?? 0),
    lastUsedAt: formatDate(item.usage_metrics?.last_used_at),
    revisionCount: String(item.usage_metrics?.revision_count ?? 0),
    contributor: item.contributor_label ?? "",
    revisionId: item.selected_revision_id ?? "",
    date: formatDate(item.updated_at),
    isArchived: item.status === "archived",
  };
}

function formatRevisionStatusLabel(
  value: KnowledgeLibrarySummaryViewModel["status"],
): string {
  switch (value) {
    case "draft":
      return "草稿";
    case "pending_review":
      return "待审核";
    case "approved":
      return "已批准";
    case "superseded":
      return "已替换";
    case "archived":
      return "已归档";
    default:
      return "未知";
  }
}

function formatModuleScopeLabel(
  value: KnowledgeLibrarySummaryViewModel["module_scope"] | "qa",
): string {
  switch (value) {
    case "screening":
      return "筛查";
    case "editing":
      return "编辑";
    case "proofreading":
      return "校对";
    case "any":
    default:
      return "通用";
  }
}

function formatManuscriptTypesLabel(
  value: KnowledgeLibrarySummaryViewModel["manuscript_types"],
): string {
  if (value === "any") {
    return "全部稿件";
  }

  return value.map(formatManuscriptTypeLabel).join("、");
}

function formatManuscriptTypeLabel(value: string): string {
  switch (value) {
    case "clinical_study":
      return "临床研究";
    case "review":
      return "综述";
    case "case_report":
      return "病例报告";
    case "basic_research":
      return "基础研究";
    case "guideline":
      return "指南";
    case "consensus":
      return "共识";
    case "meta_analysis":
      return "Meta 分析";
    case "systematic_review":
      return "系统综述";
    case "real_world_study":
      return "真实世界研究";
    default:
      return value;
  }
}

function formatKnowledgeKind(value: KnowledgeLibrarySummaryViewModel["knowledge_kind"]): string {
  return formatEditorialKnowledgeKindLabel(
    value,
    value === "rule" ? "projection" : "rule",
  );
}

function formatAttachmentLabel(blocks: readonly KnowledgeContentBlockViewModel[]): string {
  const imageCount = blocks.filter((block) => block.block_type === "image_block").length;
  return imageCount > 0 ? `${imageCount} 个附件` : "";
}

function formatDate(value?: string): string {
  if (!value) {
    return "";
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Date(parsed).toISOString().slice(0, 10);
}

function formatSemanticStatusLabel(
  value: KnowledgeSemanticLayerViewModel["status"] | "not_generated",
): string {
  switch (value) {
    case "confirmed":
      return "已确认";
    case "pending_confirmation":
      return "待确认";
    case "stale":
      return "待更新";
    case "not_generated":
    default:
      return "未生成";
  }
}

*/

function createLedgerRow(
  item: KnowledgeLibrarySummaryViewModel,
  revision: KnowledgeRevisionViewModel | null,
) {
  return {
    id: item.id,
    title: item.title,
    status: formatRevisionStatusLabel(item.status),
    category: formatKnowledgeKind(item.knowledge_kind),
    moduleScope: formatModuleScopeLabel(item.module_scope),
    manuscriptTypes: formatManuscriptTypesLabel(item.manuscript_types),
    answer: revision?.canonical_text ?? item.summary ?? "",
    detail: revision?.summary ?? item.summary ?? "",
    attachments: formatAttachmentLabel(revision?.content_blocks ?? []),
    semanticStatus: formatSemanticStatusLabel(item.semantic_status ?? "not_generated"),
    semanticSummary: revision?.semantic_layer?.page_summary ?? "",
    retrievalTerms: (revision?.semantic_layer?.retrieval_terms ?? []).join("、"),
    aliases: (revision?.aliases ?? []).join("、"),
    scenarios: (revision?.semantic_layer?.retrieval_snippets ?? []).join("；"),
    riskTags: (revision?.routing.risk_tags ?? []).join("、"),
    retrievalCount: String(item.usage_metrics?.retrieval_count ?? 0),
    recentRetrievalCount: String(item.usage_metrics?.retrieval_count_30d ?? 0),
    lastUsedAt: formatDate(item.usage_metrics?.last_used_at),
    revisionCount: String(item.usage_metrics?.revision_count ?? 0),
    contributor: item.contributor_label ?? "",
    revisionId: item.selected_revision_id ?? "",
    archivedAt: formatDate(item.archived_at ?? (item.status === "archived" ? item.updated_at : undefined)),
    archivedBy: formatArchiveActorRoleLabel(item.archived_by_role),
    date: formatDate(item.updated_at),
    isArchived: item.status === "archived",
  };
}

function formatRevisionStatusLabel(
  value: KnowledgeLibrarySummaryViewModel["status"],
): string {
  switch (value) {
    case "draft":
      return "草稿";
    case "pending_review":
      return "待审核";
    case "approved":
      return "已批准";
    case "superseded":
      return "已替换";
    case "archived":
      return "已归档";
    default:
      return "未知";
  }
}

function formatModuleScopeLabel(
  value: KnowledgeLibrarySummaryViewModel["module_scope"] | "qa",
): string {
  switch (value) {
    case "screening":
      return "筛查";
    case "editing":
      return "编辑";
    case "proofreading":
      return "校对";
    case "qa":
      return "质控";
    case "any":
    default:
      return "通用";
  }
}

function formatManuscriptTypesLabel(
  value: KnowledgeLibrarySummaryViewModel["manuscript_types"],
): string {
  if (value === "any") {
    return "全部稿件";
  }

  return value.map(formatManuscriptTypeLabel).join("、");
}

function formatManuscriptTypeLabel(value: string): string {
  switch (value) {
    case "clinical_study":
      return "临床研究";
    case "review":
      return "综述";
    case "case_report":
      return "病例报告";
    case "basic_research":
      return "基础研究";
    case "guideline":
      return "指南";
    case "consensus":
      return "共识";
    case "meta_analysis":
      return "Meta 分析";
    case "systematic_review":
      return "系统综述";
    case "real_world_study":
      return "真实世界研究";
    default:
      return value;
  }
}

function formatKnowledgeKind(value: KnowledgeLibrarySummaryViewModel["knowledge_kind"]): string {
  return formatEditorialKnowledgeKindLabel(
    value,
    value === "rule" ? "projection" : "rule",
  );
}

function formatAttachmentLabel(blocks: readonly KnowledgeContentBlockViewModel[]): string {
  const imageCount = blocks.filter((block) => block.block_type === "image_block").length;
  return imageCount > 0 ? `${imageCount} 个附件` : "";
}

function formatDate(value?: string): string {
  if (!value) {
    return "";
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Date(parsed).toISOString().slice(0, 10);
}

function formatSemanticStatusLabel(
  value: KnowledgeSemanticLayerViewModel["status"] | "not_generated",
): string {
  switch (value) {
    case "confirmed":
      return "已确认";
    case "pending_confirmation":
      return "待确认";
    case "stale":
      return "待更新";
    case "not_generated":
    default:
      return "未生成";
  }
}

function formatArchiveActorRoleLabel(value?: string): string {
  switch (value) {
    case "admin":
      return "管理员";
    case "screener":
      return "筛查员";
    case "editor":
      return "稿件处理员";
    case "proofreader":
      return "校对";
    case "knowledge_reviewer":
      return "知识治理员";
    case "user":
      return "用户";
    default:
      return "";
  }
}

function createDuplicateCheckInput(
  composer: KnowledgeLibraryLedgerComposer | null,
): DuplicateKnowledgeCheckInput | null {
  if (!composer) {
    return null;
  }

  const title = composer.draft.title.trim();
  const canonicalText = composer.draft.canonicalText.trim();
  if (title.length === 0 || canonicalText.length < 12) {
    return null;
  }

  return {
    title,
    canonicalText,
    summary: optionalTrimmedValue(composer.draft.summary),
    knowledgeKind: composer.draft.knowledgeKind,
    moduleScope: composer.draft.moduleScope,
    manuscriptTypes: composer.draft.manuscriptTypes,
    sections: normalizeStringArray(composer.draft.sections),
    riskTags: normalizeStringArray(composer.draft.riskTags),
    disciplineTags: normalizeStringArray(composer.draft.disciplineTags),
    aliases: normalizeStringArray(composer.draft.aliases),
    bindings: composer.draft.bindings,
    currentAssetId: composer.persistedAssetId ?? undefined,
    currentRevisionId: composer.persistedRevisionId ?? undefined,
  };
}

function normalizeStringArray(values: string[] | undefined): string[] | undefined {
  if (!values) {
    return undefined;
  }

  const normalized = values.map((value) => value.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}

function optionalTrimmedValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : undefined;
}

function withBaseFieldChange(
  composer: KnowledgeLibraryLedgerComposer,
  patch: Partial<KnowledgeLibraryLedgerComposer["draft"]>,
): KnowledgeLibraryLedgerComposer {
  return {
    ...composer,
    draft: {
      ...composer.draft,
      ...patch,
    },
    semanticLayerDraft: composer.semanticLayerDraft
      ? {
          ...composer.semanticLayerDraft,
          status: "stale",
        }
      : composer.semanticLayerDraft,
  };
}

function withSemanticReviewFieldChange(
  composer: KnowledgeLibraryLedgerComposer,
  patch: Partial<KnowledgeLibraryLedgerComposer["draft"]>,
): KnowledgeLibraryLedgerComposer {
  return {
    ...composer,
    draft: {
      ...composer.draft,
      ...patch,
    },
    semanticLayerDraft: composer.semanticLayerDraft
      ? {
          ...composer.semanticLayerDraft,
          status:
            composer.semanticLayerDraft.status === "confirmed"
              ? "pending_confirmation"
              : composer.semanticLayerDraft.status,
        }
      : composer.semanticLayerDraft,
  };
}

function withSemanticFieldChange(
  composer: KnowledgeLibraryLedgerComposer,
  patch: Partial<KnowledgeSemanticLayerViewModel>,
): KnowledgeLibraryLedgerComposer {
  const currentSemanticDraft = ensureSemanticLayerDraft(
    composer.semanticLayerDraft,
    composer.persistedRevisionId,
  );

  return {
    ...composer,
    semanticLayerDraft: {
      ...currentSemanticDraft,
      ...patch,
      status: "pending_confirmation",
    },
  };
}

function ensureSemanticLayerDraft(
  semanticLayerDraft: KnowledgeSemanticLayerViewModel | undefined,
  revisionId: string | null,
): KnowledgeSemanticLayerViewModel {
  return (
    semanticLayerDraft ?? {
      revision_id: revisionId ?? "local-draft",
      status: "pending_confirmation",
      page_summary: "",
      retrieval_terms: [],
      retrieval_snippets: [],
    }
  );
}

function buildSemanticSourceText(composer: KnowledgeLibraryLedgerComposer): string {
  return [
    composer.draft.title,
    composer.draft.canonicalText,
    composer.draft.summary,
    composer.draft.aliases?.join("、"),
    composer.draft.riskTags?.join("、"),
    extractAttachments(composer.contentBlocksDraft)
      .map((attachment) => attachment.caption)
      .join("。"),
  ]
    .filter(Boolean)
    .join("\n");
}

function buildAiPrefillSourceText(
  composer: KnowledgeLibraryLedgerComposer,
): string {
  const attachmentEvidence = extractAttachments(composer.contentBlocksDraft)
    .map((attachment) => [attachment.fileName, attachment.caption].filter(Boolean).join(" "))
    .filter(Boolean)
    .join("\n");

  return [composer.aiIntakeSourceText, attachmentEvidence].filter(Boolean).join("\n");
}

function extractAttachments(blocks: readonly KnowledgeContentBlockViewModel[]) {
  return blocks
    .filter((block) => block.block_type === "image_block")
    .map((block) => ({
      blockId: block.id,
      fileName:
        typeof block.content_payload.file_name === "string"
          ? block.content_payload.file_name
          : "未命名附件",
      mimeType:
        typeof block.content_payload.mime_type === "string"
          ? block.content_payload.mime_type
          : "application/octet-stream",
      byteLength:
        typeof block.content_payload.byte_length === "number"
          ? block.content_payload.byte_length
          : undefined,
      storageKey:
        typeof block.content_payload.storage_key === "string"
          ? block.content_payload.storage_key
          : undefined,
      caption:
        typeof block.content_payload.caption === "string"
          ? block.content_payload.caption
          : "",
    }));
}

function updateListValue(values: readonly string[], index: number, value: string): string[] {
  return values.map((entry, entryIndex) => (entryIndex === index ? value : entry));
}

function removeListValue(values: readonly string[], index: number): string[] {
  return values.filter((_, entryIndex) => entryIndex !== index);
}

function toggleLedgerManuscriptTypeSelection(
  current: KnowledgeLibraryLedgerComposer["draft"]["manuscriptTypes"],
  value: ManuscriptType,
): KnowledgeLibraryLedgerComposer["draft"]["manuscriptTypes"] {
  if (current === "any") {
    return [value];
  }

  return toggleLedgerStringSelection(current, value) as ManuscriptType[];
}

function toggleLedgerStringSelection(current: readonly string[], value: string): string[] {
  return current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value];
}

function hydrateBlocksForRevision(
  blocks: readonly KnowledgeContentBlockViewModel[],
  revisionId: string,
) {
  return blocks.map((block, index) => ({
    ...block,
    revision_id: revisionId,
    order_no: index,
  }));
}

function toSemanticLayerInput(
  semanticLayerDraft: KnowledgeSemanticLayerViewModel,
): KnowledgeSemanticLayerInput {
  return {
    pageSummary: semanticLayerDraft.page_summary,
    retrievalTerms: semanticLayerDraft.retrieval_terms,
    retrievalSnippets: semanticLayerDraft.retrieval_snippets,
    tableSemantics: semanticLayerDraft.table_semantics,
    imageUnderstanding: semanticLayerDraft.image_understanding,
  };
}

function createImageBlock(input: {
  upload: KnowledgeUploadViewModel;
  revisionId: string;
  orderNo: number;
}): KnowledgeContentBlockViewModel {
  return {
    id: `image-block-${input.upload.upload_id}`,
    revision_id: input.revisionId,
    block_type: "image_block",
    order_no: input.orderNo,
    status: "active",
    content_payload: {
      upload_id: input.upload.upload_id,
      storage_key: input.upload.storage_key,
      file_name: input.upload.file_name,
      mime_type: input.upload.mime_type,
      byte_length: input.upload.byte_length,
      uploaded_at: input.upload.uploaded_at,
      caption: "",
    },
  };
}

function readKnowledgeLibraryPriorityOrder(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(
      KNOWLEDGE_LIBRARY_PRIORITY_STORAGE_KEY,
    );
    if (!storedValue) {
      return [];
    }

    const parsed = JSON.parse(storedValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function writeKnowledgeLibraryPriorityOrder(order: readonly string[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      KNOWLEDGE_LIBRARY_PRIORITY_STORAGE_KEY,
      JSON.stringify(order),
    );
  } catch {
    // Ignore storage failures and keep the in-memory order.
  }
}

function readKnowledgeLibraryColumnOrder(): KnowledgeLibraryLedgerColumnKey[] {
  if (typeof window === "undefined") {
    return DEFAULT_COLUMN_ORDER;
  }

  try {
    const storedValue = window.localStorage.getItem(
      KNOWLEDGE_LIBRARY_COLUMN_ORDER_STORAGE_KEY,
    );
    if (!storedValue) {
      return DEFAULT_COLUMN_ORDER;
    }

    const parsed = JSON.parse(storedValue);
    if (!Array.isArray(parsed)) {
      return DEFAULT_COLUMN_ORDER;
    }

    return reconcileKnowledgeLibraryColumnOrder(parsed);
  } catch {
    return DEFAULT_COLUMN_ORDER;
  }
}

function writeKnowledgeLibraryColumnOrder(
  order: readonly KnowledgeLibraryLedgerColumnKey[],
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      KNOWLEDGE_LIBRARY_COLUMN_ORDER_STORAGE_KEY,
      JSON.stringify(order),
    );
  } catch {
    // Ignore storage failures and keep the in-memory order.
  }
}

function reconcileKnowledgeLibraryColumnOrder(
  currentOrder: readonly string[],
): KnowledgeLibraryLedgerColumnKey[] {
  const knownKeys = new Set(DEFAULT_COLUMN_ORDER);
  const nextOrder: KnowledgeLibraryLedgerColumnKey[] = currentOrder
    .filter(
      (columnKey): columnKey is KnowledgeLibraryLedgerColumnKey =>
        typeof columnKey === "string" &&
        knownKeys.has(columnKey as KnowledgeLibraryLedgerColumnKey),
    )
    .map((columnKey) => columnKey as KnowledgeLibraryLedgerColumnKey);

  for (const columnKey of DEFAULT_COLUMN_ORDER) {
    if (!nextOrder.includes(columnKey)) {
      nextOrder.push(columnKey);
    }
  }

  return nextOrder;
}

function orderKnowledgeLibraryColumns(
  currentOrder: readonly KnowledgeLibraryLedgerColumnKey[],
): KnowledgeLibraryLedgerColumnDefinition[] {
  const columnsByKey = new Map(
    KNOWLEDGE_LIBRARY_LEDGER_COLUMNS.map((column) => [column.key, column] as const),
  );

  return reconcileKnowledgeLibraryColumnOrder(currentOrder)
    .map((columnKey) => columnsByKey.get(columnKey))
    .filter(
      (column): column is KnowledgeLibraryLedgerColumnDefinition =>
        column != null,
    )
    .map((column, index) => ({
      ...column,
      pinned: index === 0,
    }));
}

function moveKnowledgeLibraryColumn(
  currentOrder: readonly KnowledgeLibraryLedgerColumnKey[],
  columnKey: KnowledgeLibraryLedgerColumnKey,
  direction: "left" | "right",
): KnowledgeLibraryLedgerColumnKey[] {
  const nextOrder = [...reconcileKnowledgeLibraryColumnOrder(currentOrder)];
  const currentIndex = nextOrder.indexOf(columnKey);
  if (currentIndex === -1) {
    return nextOrder;
  }

  const targetIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= nextOrder.length) {
    return nextOrder;
  }

  [nextOrder[currentIndex], nextOrder[targetIndex]] = [
    nextOrder[targetIndex],
    nextOrder[currentIndex],
  ];

  return nextOrder;
}

function reconcileKnowledgeLibraryPriorityOrder(
  currentOrder: readonly string[],
  assetIds: readonly string[],
): string[] {
  const knownIds = new Set(assetIds);
  const nextOrder = currentOrder.filter((assetId) => knownIds.has(assetId));

  for (const assetId of assetIds) {
    if (!nextOrder.includes(assetId)) {
      nextOrder.push(assetId);
    }
  }

  return nextOrder;
}

function sortKnowledgeLibraryByPriority(
  items: readonly KnowledgeLibrarySummaryViewModel[],
  currentOrder: readonly string[],
): KnowledgeLibrarySummaryViewModel[] {
  if (items.length <= 1) {
    return [...items];
  }

  const reconciledOrder = reconcileKnowledgeLibraryPriorityOrder(
    currentOrder,
    items.map((item) => item.id),
  );
  const priorityById = new Map(
    reconciledOrder.map((assetId, index) => [assetId, index]),
  );

  return [...items].sort((left, right) => {
    const leftPriority = priorityById.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightPriority = priorityById.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    return leftPriority - rightPriority;
  });
}

function moveKnowledgeLibraryPriority(
  currentOrder: readonly string[],
  allAssetIds: readonly string[],
  visibleAssetIds: readonly string[],
  assetId: string,
  direction: "up" | "down",
): string[] {
  if (visibleAssetIds.length <= 1) {
    return [...currentOrder];
  }

  const orderedVisibleIds = reconcileKnowledgeLibraryPriorityOrder(
    currentOrder,
    visibleAssetIds,
  );
  const currentIndex = orderedVisibleIds.indexOf(assetId);
  if (currentIndex === -1) {
    return [...currentOrder];
  }

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= orderedVisibleIds.length) {
    return [...currentOrder];
  }

  const targetAssetId = orderedVisibleIds[targetIndex];
  const nextOrder = reconcileKnowledgeLibraryPriorityOrder(currentOrder, allAssetIds);
  const leftIndex = nextOrder.indexOf(assetId);
  const rightIndex = nextOrder.indexOf(targetAssetId);
  if (leftIndex === -1 || rightIndex === -1) {
    return nextOrder;
  }

  [nextOrder[leftIndex], nextOrder[rightIndex]] = [
    nextOrder[rightIndex],
    nextOrder[leftIndex],
  ];

  return nextOrder;
}

function KnowledgeLibraryLedgerBindingField(props: {
  label: string;
  helpText: string;
  value: readonly string[];
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
      inputDataKey={`ledger-${props.dataKey}`}
      rootDataAttributeName="data-knowledge-binding-multi-select"
      className="knowledge-library-entry-form__multi-select"
      headerClassName="knowledge-library-entry-form__multi-select-header"
      searchFieldClassName="knowledge-library-entry-form__search-field"
      searchPlaceholder={`搜索${props.label}`}
      optionsClassName="knowledge-library-entry-form__multi-select-options"
      optionClassName="knowledge-library-entry-form__multi-select-option"
      emptyClassName="knowledge-library-entry-form__structured-empty"
      showSelectedSummary
      selectedListClassName="knowledge-library-entry-form__selected-summary"
      selectedChipClassName="knowledge-library-entry-form__selected-chip"
      selectedEmptyText={`当前未绑定${props.label}。`}
      emptyOptionsText="当前没有可用绑定项。"
      noResultsText="未找到匹配的绑定项。"
      onToggleValue={props.onToggleValue}
    />
  );
}

function createInitialLedgerBindingCatalog(): LedgerBindingCatalog {
  return {
    templateFamilyOptions: [],
    moduleTemplateOptions: [],
    journalTemplateOptions: [],
    generalPackageOptions: [],
    medicalPackageOptions: [],
    knowledgeItemOptions: [],
    sectionOptions: EDITORIAL_SECTION_OPTIONS.map((section) => ({
      value: section,
      label: formatEditorialSectionLabel(section),
      keywords: [section, formatEditorialSectionLabel(section)],
    })),
  };
}

async function loadLedgerBindingCatalog(
  client = createBrowserHttpClient(),
): Promise<LedgerBindingCatalog> {
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
    templateFamilyOptions: sortLedgerBindingOptions(
      templateFamilies.map((family) => ({
        value: family.id,
        label: family.name,
        meta: `${formatEditorialManuscriptTypeLabel(family.manuscript_type)} · ${formatLedgerTemplateFamilyStatus(family.status)}`,
        group: formatEditorialManuscriptTypeLabel(family.manuscript_type),
        keywords: [family.name, family.id, family.manuscript_type],
      })),
    ),
    moduleTemplateOptions: sortLedgerBindingOptions(
      moduleTemplatesByFamily.flatMap(({ family, templates }) =>
        templates.map((template) => ({
          value: template.id,
          label: `${formatEditorialModuleLabel(template.module)} v${template.version_no}`,
          meta: `${family.name} · ${formatEditorialManuscriptTypeLabel(template.manuscript_type)}`,
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
    journalTemplateOptions: sortLedgerBindingOptions(
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
    generalPackageOptions: sortLedgerBindingOptions(
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
    medicalPackageOptions: sortLedgerBindingOptions(
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
    sectionOptions: createInitialLedgerBindingCatalog().sectionOptions,
  };
}

function resolveLedgerBindingCatalog(input: {
  catalog: LedgerBindingCatalog;
  bindings: readonly KnowledgeRevisionBindingInput[];
  libraryItems: readonly KnowledgeLibraryWorkbenchViewModel["library"][number][];
  selectedAssetId: string | null;
}): LedgerBindingCatalog {
  const knowledgeItemOptions = sortLedgerBindingOptions(
    input.libraryItems
      .filter((item) => item.status === "approved" && item.id !== input.selectedAssetId)
      .map((item) => ({
        value: item.id,
        label: item.title,
        meta: `${formatKnowledgeKind(item.knowledge_kind)} · ${formatModuleScopeLabel(item.module_scope)}`,
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
    templateFamilyOptions: mergeLedgerBindingOptions(
      input.catalog.templateFamilyOptions,
      input.bindings,
      "template_family",
    ),
    moduleTemplateOptions: mergeLedgerBindingOptions(
      input.catalog.moduleTemplateOptions,
      input.bindings,
      "module_template",
    ),
    journalTemplateOptions: mergeLedgerBindingOptions(
      input.catalog.journalTemplateOptions,
      input.bindings,
      "journal_template",
    ),
    generalPackageOptions: mergeLedgerBindingOptions(
      input.catalog.generalPackageOptions,
      input.bindings,
      "general_package",
    ),
    medicalPackageOptions: mergeLedgerBindingOptions(
      input.catalog.medicalPackageOptions,
      input.bindings,
      "medical_package",
    ),
    knowledgeItemOptions: mergeLedgerBindingOptions(
      knowledgeItemOptions,
      input.bindings,
      "knowledge_item",
    ),
    sectionOptions: mergeLedgerBindingOptions(
      input.catalog.sectionOptions,
      input.bindings,
      "section",
    ),
  };
}

function mergeLedgerBindingOptions(
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

    const label = formatLedgerBindingTargetLabel(binding);
    merged.set(binding.bindingTargetId, {
      value: binding.bindingTargetId,
      label,
      meta: "已绑定但当前目录未返回",
      keywords: [binding.bindingTargetId, label],
    });
  }

  return sortLedgerBindingOptions([...merged.values()]);
}

function sortLedgerBindingOptions(
  options: readonly SearchableMultiSelectOption[],
): SearchableMultiSelectOption[] {
  return [...options].sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
}

function getLedgerBindingSelectionValues(
  bindings: readonly KnowledgeRevisionBindingInput[],
  kind: KnowledgeRevisionBindingKind,
): string[] {
  return (normalizeLedgerBindings(bindings) ?? [])
    .filter((binding) => binding.bindingKind === kind)
    .map((binding) => binding.bindingTargetId);
}

function resolveLedgerBindingOptionByValue(
  options: readonly SearchableMultiSelectOption[],
  value: string,
): SearchableMultiSelectOption {
  return options.find((option) => option.value === value) ?? { value, label: value };
}

function toggleLedgerBindingSelection(
  bindings: readonly KnowledgeRevisionBindingInput[],
  kind: KnowledgeRevisionBindingKind,
  option: SearchableMultiSelectOption,
): KnowledgeRevisionBindingInput[] {
  const normalized = normalizeLedgerBindings(bindings) ?? [];
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

function normalizeLedgerBindings(
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
      bindingTargetLabel: formatLedgerBindingTargetLabel({
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

function formatLedgerBindingTargetLabel(input: {
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

function formatLedgerBindingKindLabel(value: KnowledgeRevisionBindingKind): string {
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

function formatLedgerTemplateFamilyStatus(
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

function areStringArraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === "undefined") {
      reject(new Error("当前环境不支持文件读取。"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("文件读取失败。"));
        return;
      }

      const [, base64 = ""] = result.split(",", 2);
      resolve(base64);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("文件读取失败。"));
    };
    reader.readAsDataURL(file);
  });
}

function toErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}
