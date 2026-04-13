import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserHttpClient } from "../../lib/browser-http-client.ts";
import {
  buildCreateDraftInput,
  createEmptyLedgerComposer,
  type KnowledgeLibraryLedgerComposer,
} from "./knowledge-library-ledger-composer.ts";
import {
  createKnowledgeLibraryWorkbenchController,
  type KnowledgeLibraryWorkbenchController,
} from "./knowledge-library-controller.ts";
import { KnowledgeLibraryEntryForm } from "./knowledge-library-entry-form.tsx";
import {
  KnowledgeLibraryLedgerGrid,
  KNOWLEDGE_LIBRARY_LEDGER_COLUMNS,
  type KnowledgeLibraryLedgerColumnKey,
  type KnowledgeLibraryLedgerColumnWidthMap,
} from "./knowledge-library-ledger-grid.tsx";
import { KnowledgeLibraryLedgerSearchPage } from "./knowledge-library-ledger-search-page.tsx";
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

type LedgerSurface = "table" | "search";
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
  initialSearchOpen?: boolean;
  initialSearchQuery?: string;
  actorRole?: string;
  prefilledAssetId?: string;
  prefilledRevisionId?: string;
}

export function KnowledgeLibraryLedgerPage({
  controller = defaultController,
  initialViewModel = null,
  initialComposer = null,
  initialFormMode = "closed",
  initialSearchOpen = false,
  initialSearchQuery = "",
  actorRole = "knowledge_reviewer",
  prefilledAssetId,
  prefilledRevisionId,
}: KnowledgeLibraryLedgerPageProps) {
  const [viewModel, setViewModel] = useState<KnowledgeLibraryWorkbenchViewModel | null>(
    initialViewModel,
  );
  const [composer, setComposer] = useState<KnowledgeLibraryLedgerComposer | null>(() => {
    if (initialComposer) {
      return initialComposer;
    }

    return initialFormMode === "create" ? createEmptyLedgerComposer() : null;
  });
  const [surface, setSurface] = useState<LedgerSurface>(
    initialSearchOpen ? "search" : "table",
  );
  const [formMode, setFormMode] = useState<EntryFormMode>(initialFormMode);
  const [density, setDensity] =
    useState<KnowledgeLibraryLedgerDensity>("compact");
  const [columnWidths, setColumnWidths] = useState<KnowledgeLibraryLedgerColumnWidthMap>(
    DEFAULT_COLUMN_WIDTHS,
  );
  const [selectedRowId, setSelectedRowId] = useState<string | null>(
    initialViewModel?.selectedAssetId ?? null,
  );
  const [hiddenAssetIds, setHiddenAssetIds] = useState<string[]>([]);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">(
    initialViewModel ? "ready" : "idle",
  );
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(
    initialSearchQuery || initialViewModel?.filters.searchText || "",
  );
  const [searchMode, setSearchMode] = useState<KnowledgeLibraryQueryMode>(
    initialViewModel?.filters.queryMode ?? "keyword",
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
  const resizeStateRef = useRef<ColumnResizeState | null>(null);

  useEffect(() => {
    if (initialViewModel) {
      return;
    }

    void loadWorkbench({
      selectedAssetId: prefilledAssetId,
      selectedRevisionId: prefilledRevisionId,
      filters:
        initialSearchOpen || initialSearchQuery.length > 0
          ? {
              searchText: initialSearchQuery,
              queryMode: searchMode,
            }
          : undefined,
    });
  }, [
    controller,
    initialSearchOpen,
    initialSearchQuery,
    initialViewModel,
    prefilledAssetId,
    prefilledRevisionId,
    searchMode,
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

  const visibleLibraryItems = useMemo(
    () =>
      (viewModel?.visibleLibrary ?? []).filter(
        (item) => !hiddenAssetIds.includes(item.id),
      ),
    [hiddenAssetIds, viewModel?.visibleLibrary],
  );
  const ledgerRows = useMemo(
    () =>
      visibleLibraryItems.map((item) =>
        createLedgerRow(
          item,
          viewModel?.detail?.asset.id === item.id ? viewModel.detail.selected_revision : null,
        ),
      ),
    [viewModel?.detail, visibleLibraryItems],
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
          <p className="knowledge-library-ledger-page__eyebrow">Knowledge Library</p>
          <h1>多维知识台账</h1>
          <p>只保留表格主视图，用同一张表单完成录入、编辑和 AI 语义确认。</p>
        </div>

        <div className="knowledge-library-ledger-page__meta">
          <span>当前角色：{actorRole}</span>
          <span>当前模式：{surface === "search" ? "查找结果" : "台账总览"}</span>
        </div>
      </header>

      <KnowledgeLibraryLedgerToolbar
        totalCount={visibleLibraryItems.length}
        selectedCount={selectedRowId ? 1 : 0}
        density={density}
        onDensityChange={setDensity}
        onAdd={handleOpenCreateForm}
        onDelete={handleDeleteSelected}
        onSearch={() => setSurface("search")}
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

      <section className="knowledge-library-ledger-page__content">
        {surface === "search" ? (
          <KnowledgeLibraryLedgerSearchPage
            query={searchQuery}
            queryMode={searchMode}
            resultCount={visibleLibraryItems.length}
            onQueryChange={setSearchQuery}
            onQueryModeChange={setSearchMode}
            onRunSearch={() => void handleRunSearch()}
            onBack={() => void handleBackToLedger()}
          >
            <KnowledgeLibraryLedgerGrid
              rows={ledgerRows}
              density={density}
              selectedAssetId={selectedRowId}
              columnWidths={columnWidths}
              onSelectAsset={(assetId) => void handleSelectAsset(assetId)}
              onEditAsset={(assetId) => void handleEditAsset(assetId)}
              onColumnResizeStart={handleColumnResizeStart}
            />
          </KnowledgeLibraryLedgerSearchPage>
        ) : (
          <KnowledgeLibraryLedgerGrid
            rows={ledgerRows}
            density={density}
            selectedAssetId={selectedRowId}
            columnWidths={columnWidths}
            onSelectAsset={(assetId) => void handleSelectAsset(assetId)}
            onEditAsset={(assetId) => void handleEditAsset(assetId)}
            onColumnResizeStart={handleColumnResizeStart}
          />
        )}

        {formMode !== "closed" && composer ? (
          <KnowledgeLibraryEntryForm
            mode={formMode === "create" ? "create" : "edit"}
            composer={composer}
            attachments={attachments}
            duplicateSummary={duplicateSummary}
            semanticStatusLabel={semanticStatusLabel}
            semanticNotes={semanticNotes}
            isBusy={isBusy}
            canGenerateSemantic={canGenerateSemantic}
            canApplySemantic={canApplySemantic}
            canConfirmEntry={canConfirmEntry}
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
    setFormMode("create");
    setSurface("table");
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
      setFormMode("edit");
      setSurface("table");
      setSemanticNotes(nextComposer.warnings);
      setStatusMessage(null);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "打开知识编辑表单失败。"));
    } finally {
      setIsBusy(false);
    }
  }

  function handleCancelForm() {
    setFormMode("closed");
    setSemanticNotes([]);
    setErrorMessage(null);
    setComposer(createEditableComposerFromViewModel(viewModel));
  }

  function handleDeleteSelected() {
    if (!selectedRowId) {
      return;
    }

    setHiddenAssetIds((current) =>
      current.includes(selectedRowId) ? current : [...current, selectedRowId],
    );
    setStatusMessage("已从当前台账视图移除所选记录。");
    setErrorMessage(null);

    if (composer?.persistedAssetId === selectedRowId) {
      setComposer(null);
      setFormMode("closed");
    }

    setSelectedRowId(null);
  }

  async function handleRunSearch() {
    await loadWorkbench({
      selectedAssetId: selectedRowId ?? undefined,
      filters: {
        searchText: searchQuery,
        queryMode: searchMode,
      },
    });
    setSurface("search");
  }

  async function handleBackToLedger() {
    setSearchQuery("");
    setSearchMode("keyword");
    await loadWorkbench({
      selectedAssetId: selectedRowId ?? undefined,
      filters: {
        searchText: "",
        queryMode: "keyword",
      },
    });
    setSurface("table");
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

const DEFAULT_COLUMN_WIDTHS: KnowledgeLibraryLedgerColumnWidthMap = {
  title: 240,
  answer: 320,
  category: 140,
  detail: 220,
  attachments: 180,
  semanticStatus: 140,
  contributor: 140,
  date: 120,
  semanticSummary: 220,
  retrievalTerms: 220,
  aliases: 220,
  scenarios: 220,
  riskTags: 180,
};

const MIN_COLUMN_WIDTHS: KnowledgeLibraryLedgerColumnWidthMap =
  KNOWLEDGE_LIBRARY_LEDGER_COLUMNS.reduce(
    (result, column) => ({
      ...result,
      [column.key]: column.minWidth,
    }),
    {} as KnowledgeLibraryLedgerColumnWidthMap,
  );

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

function createLedgerRow(
  item: KnowledgeLibrarySummaryViewModel,
  revision: KnowledgeRevisionViewModel | null,
) {
  return {
    id: item.id,
    title: item.title,
    answer: revision?.canonical_text ?? item.summary ?? "",
    category: formatKnowledgeKind(item.knowledge_kind),
    detail: revision?.summary ?? item.summary ?? "",
    attachments: formatAttachmentLabel(revision?.content_blocks ?? []),
    semanticStatus: formatSemanticStatusLabel(item.semantic_status ?? "not_generated"),
    contributor: item.contributor_label ?? "",
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
