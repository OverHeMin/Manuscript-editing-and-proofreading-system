import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserHttpClient } from "../../lib/browser-http-client.ts";
import {
  applyAiIntakeSuggestion,
  buildCreateDraftInput,
  createEmptyLedgerComposer,
  formatLedgerTagText,
  parseLedgerTagText,
  type KnowledgeLibraryLedgerComposer,
} from "./knowledge-library-ledger-composer.ts";
import {
  createKnowledgeLibraryWorkbenchController,
  type KnowledgeLibraryWorkbenchController,
} from "./knowledge-library-controller.ts";
import {
  KnowledgeLibraryEntryForm,
  type KnowledgeLibraryEntryAiAssistMode,
} from "./knowledge-library-entry-form.tsx";
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
  KnowledgeLibraryAiIntakeSuggestionViewModel,
  KnowledgeLibraryFilterState,
  KnowledgeLibraryQueryMode,
  KnowledgeLibrarySummaryViewModel,
  KnowledgeLibraryWorkbenchViewModel,
  KnowledgeRevisionViewModel,
  KnowledgeSemanticLayerInput,
  KnowledgeSemanticLayerViewModel,
  KnowledgeUploadViewModel,
} from "./types.ts";

if (typeof document !== "undefined") {
  void import("./knowledge-library-ledger-page.css");
}

const defaultController = createKnowledgeLibraryWorkbenchController(
  createBrowserHttpClient(),
);

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
  actorRole?: string;
  prefilledAssetId?: string;
  prefilledRevisionId?: string;
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
  initialPriorityOrder,
  initialColumnOrder,
  initialColumnOrderPanelOpen = false,
}: KnowledgeLibraryLedgerPageProps) {
  const [viewModel, setViewModel] = useState<KnowledgeLibraryWorkbenchViewModel | null>(
    initialViewModel,
  );
  const initialFilters = initialViewModel?.filters;
  const [composer, setComposer] = useState<KnowledgeLibraryLedgerComposer | null>(() => {
    if (initialComposer) {
      return initialComposer;
    }

    return initialFormMode === "create" ? createEmptyLedgerComposer() : null;
  });
  const [boardMode, setBoardMode] = useState<EntryFormMode>(initialFormMode);
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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
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
    <main className="knowledge-library-ledger-page">
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
            <KnowledgeLibraryEntryForm
            mode={boardMode === "edit" ? "edit" : "create"}
            aiAssistMode={aiAssistMode}
            composer={composer}
            attachments={attachments}
            contentBlocks={composer.contentBlocksDraft}
            aiIntakeSourceText={composer.aiIntakeSourceText}
            requiredTagsText={formatLedgerTagText(composer.draft.riskTags)}
            duplicateSummary={duplicateSummary}
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
            onRequiredTagsChange={(value) =>
              setComposer((current) =>
                current
                  ? withSemanticReviewFieldChange(current, {
                      riskTags: parseLedgerTagText(value),
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
      const suggestion = await controller.createAiIntakeSuggestion({
        sourceText,
      });
      setComposer((current) =>
        current ? applySemanticSuggestion(current, suggestion) : current,
      );
      setSemanticNotes(suggestion.warnings);
      setStatusMessage("AI 语义建议已生成，请核对后点击“应用建议”。");
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "AI 语义生成失败。"));
    } finally {
      setIsBusy(false);
    }
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

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      let nextViewModel = composer.persistedRevisionId
        ? await controller.saveDraftAndLoad({
            revisionId: composer.persistedRevisionId,
            input: {
              ...composer.draft,
            },
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
      setComposer(createEditableComposerFromViewModel(nextViewModel));
      setSemanticNotes([]);
      setStatusMessage(input.successMessage);
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
  { value: "rule", label: "规则" },
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
  return {
    mode: "existing_revision",
    persistedAssetId: selectedAssetId,
    persistedRevisionId: selectedRevision.id,
    aiIntakeSourceText: selectedRevision.canonical_text,
    draft: {
      title: selectedRevision.title,
      canonicalText: selectedRevision.canonical_text,
      summary: selectedRevision.summary,
      knowledgeKind: selectedRevision.knowledge_kind,
      moduleScope: selectedRevision.routing.module_scope,
      manuscriptTypes: selectedRevision.routing.manuscript_types,
      sections: selectedRevision.routing.sections,
      riskTags: selectedRevision.routing.risk_tags,
      disciplineTags: selectedRevision.routing.discipline_tags,
      evidenceLevel: selectedRevision.evidence_level,
      sourceType: selectedRevision.source_type,
      sourceLink: selectedRevision.source_link,
      aliases: selectedRevision.aliases,
      effectiveAt: selectedRevision.effective_at,
      expiresAt: selectedRevision.expires_at,
      bindings: selectedRevision.bindings.map((binding) => ({
        bindingKind: binding.binding_kind,
        bindingTargetId: binding.binding_target_id,
        bindingTargetLabel: binding.binding_target_label,
      })),
    },
    contentBlocksDraft: [...selectedRevision.content_blocks],
    semanticLayerDraft: selectedRevision.semantic_layer,
    warnings: [],
  };
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
  switch (value) {
    case "rule":
      return "规则";
    case "case_pattern":
      return "案例模式";
    case "checklist":
      return "核查清单";
    case "prompt_snippet":
      return "提示片段";
    case "reference":
      return "参考资料";
    case "other":
    default:
      return "其他";
  }
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
  switch (value) {
    case "rule":
      return "规则";
    case "case_pattern":
      return "案例模式";
    case "checklist":
      return "核查清单";
    case "prompt_snippet":
      return "提示片段";
    case "reference":
      return "参考资料";
    case "other":
    default:
      return "其他";
  }
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
  switch (value) {
    case "rule":
      return "规则";
    case "case_pattern":
      return "案例模式";
    case "checklist":
      return "核查清单";
    case "prompt_snippet":
      return "提示片段";
    case "reference":
      return "参考资料";
    case "other":
    default:
      return "其他";
  }
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
      return "编辑";
    case "proofreader":
      return "校对";
    case "knowledge_reviewer":
      return "知识审核";
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

function applySemanticSuggestion(
  composer: KnowledgeLibraryLedgerComposer,
  suggestion: KnowledgeLibraryAiIntakeSuggestionViewModel,
): KnowledgeLibraryLedgerComposer {
  const nextSemanticDraft = suggestion.suggestedSemanticLayer
    ? {
        ...suggestion.suggestedSemanticLayer,
        revision_id:
          composer.persistedRevisionId ??
          suggestion.suggestedSemanticLayer.revision_id ??
          "local-draft",
        status: "pending_confirmation" as const,
      }
    : {
        revision_id: composer.persistedRevisionId ?? "local-draft",
        status: "pending_confirmation" as const,
        page_summary: composer.draft.summary ?? "",
        retrieval_terms: composer.draft.aliases ?? [],
        retrieval_snippets: [],
      };

  return {
    ...composer,
    draft: {
      ...composer.draft,
      summary:
        composer.draft.summary && composer.draft.summary.trim().length > 0
          ? composer.draft.summary
          : suggestion.suggestedDraft.summary,
      aliases:
        normalizeStringArray(suggestion.suggestedDraft.aliases) ??
        composer.draft.aliases ??
        [],
      riskTags:
        normalizeStringArray(suggestion.suggestedDraft.riskTags) ??
        composer.draft.riskTags ??
        [],
    },
    semanticLayerDraft: nextSemanticDraft,
    warnings: Array.from(new Set([...composer.warnings, ...suggestion.warnings])),
  };
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
