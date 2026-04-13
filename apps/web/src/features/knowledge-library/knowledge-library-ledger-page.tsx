import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserHttpClient } from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/index.ts";
import type { ManuscriptType } from "../manuscripts/types.ts";
import {
  applyAiIntakeSuggestion,
  buildCreateDraftInput,
  createEmptyLedgerComposer,
  type KnowledgeLibraryLedgerComposer,
} from "./knowledge-library-ledger-composer.ts";
import { KnowledgeLibraryAiIntakePanel } from "./knowledge-library-ai-intake-panel.tsx";
import {
  createKnowledgeLibraryWorkbenchController,
  type KnowledgeLibraryWorkbenchController,
} from "./knowledge-library-controller.ts";
import { KnowledgeLibraryDuplicatePanel } from "./knowledge-library-duplicate-panel.tsx";
import { KnowledgeLibraryLedgerTable } from "./knowledge-library-ledger-table.tsx";
import { KnowledgeLibraryRichContentEditor } from "./knowledge-library-rich-content-editor.tsx";
import { KnowledgeLibrarySemanticAssistantPanel } from "./knowledge-library-semantic-assistant-panel.tsx";
import { KnowledgeLibrarySemanticPanel } from "./knowledge-library-semantic-panel.tsx";
import {
  buildDuplicateCheckTriggerSignature,
  getStrongDuplicateMatches,
  isImmediateDuplicateCheckResultStale,
  KnowledgeLibraryDuplicateStatusRow,
  KnowledgeLibraryDuplicateSubmitConfirmation,
  resolveDuplicateAcknowledgementSubmitDecision,
  resolveDuplicateSubmitDecision,
  shouldInvalidateDuplicateSubmitConfirmation,
  type KnowledgeLibraryDuplicateCheckState,
} from "./knowledge-library-workbench-page.tsx";
import type {
  DuplicateKnowledgeCheckInput,
  DuplicateKnowledgeMatchViewModel,
  DuplicateWarningAcknowledgementInput,
  KnowledgeLibraryAiIntakeSuggestionViewModel,
  KnowledgeLibraryFilterState,
  KnowledgeLibrarySemanticAssistSuggestionViewModel,
  KnowledgeRevisionViewModel,
  KnowledgeSemanticLayerViewModel,
  KnowledgeLibraryWorkbenchViewModel,
  KnowledgeSemanticLayerInput,
  KnowledgeUploadInput,
  KnowledgeUploadViewModel,
} from "./types.ts";

if (typeof document !== "undefined") {
  void import("./knowledge-library-ledger-page.css");
}

const defaultController = createKnowledgeLibraryWorkbenchController(
  createBrowserHttpClient(),
);

type LedgerWorkspaceTab = "fields" | "semantic" | "content_blocks";

interface ImmediateDuplicateCheckContext {
  selectedRevisionId: string | null;
  duplicateCheckSignature: string | null;
}

export interface KnowledgeLibraryLedgerPageProps {
  controller?: KnowledgeLibraryWorkbenchController;
  actorRole?: AuthRole;
  initialViewModel?: KnowledgeLibraryWorkbenchViewModel | null;
  initialComposer?: KnowledgeLibraryLedgerComposer | null;
  initialWorkspaceTab?: LedgerWorkspaceTab;
  initialAiIntakeOpen?: boolean;
  initialAiIntakeSuggestion?: KnowledgeLibraryAiIntakeSuggestionViewModel | null;
  initialSemanticSuggestion?: KnowledgeLibrarySemanticAssistSuggestionViewModel | null;
  prefilledAssetId?: string;
  prefilledRevisionId?: string;
}

export function KnowledgeLibraryLedgerPage({
  controller = defaultController,
  actorRole = "knowledge_reviewer",
  initialViewModel = null,
  initialComposer = null,
  initialWorkspaceTab = "fields",
  initialAiIntakeOpen = false,
  initialAiIntakeSuggestion = null,
  initialSemanticSuggestion = null,
  prefilledAssetId,
  prefilledRevisionId,
}: KnowledgeLibraryLedgerPageProps) {
  const [viewModel, setViewModel] = useState<KnowledgeLibraryWorkbenchViewModel | null>(
    initialViewModel,
  );
  const [composer, setComposer] = useState<KnowledgeLibraryLedgerComposer | null>(
    () => initialComposer ?? createEditableComposerFromViewModel(initialViewModel),
  );
  const [workspaceTab, setWorkspaceTab] = useState<LedgerWorkspaceTab>(
    initialWorkspaceTab,
  );
  const [isAiIntakeOpen, setIsAiIntakeOpen] = useState(initialAiIntakeOpen);
  const [aiIntakeSourceText, setAiIntakeSourceText] = useState("");
  const [aiIntakeSuggestion, setAiIntakeSuggestion] =
    useState<KnowledgeLibraryAiIntakeSuggestionViewModel | null>(
      initialAiIntakeSuggestion,
    );
  const [semanticInstructionText, setSemanticInstructionText] = useState("");
  const [semanticSuggestion, setSemanticSuggestion] =
    useState<KnowledgeLibrarySemanticAssistSuggestionViewModel | null>(
      initialSemanticSuggestion,
    );
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">(
    initialViewModel ? "ready" : "idle",
  );
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateKnowledgeMatchViewModel[]>(
    [],
  );
  const [duplicateCheckState, setDuplicateCheckState] =
    useState<KnowledgeLibraryDuplicateCheckState>("not_checked");
  const [duplicateCheckErrorMessage, setDuplicateCheckErrorMessage] = useState<
    string | null
  >(null);
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
  const [isImmediateDuplicateCheckPending, setIsImmediateDuplicateCheckPending] =
    useState(false);
  const duplicateCheckRequestIdRef = useRef(0);
  const latestDuplicateCheckContextRef = useRef<ImmediateDuplicateCheckContext>({
    selectedRevisionId: composer?.persistedRevisionId ?? null,
    duplicateCheckSignature: null,
  });

  useEffect(() => {
    if (initialViewModel) {
      return;
    }

    void loadWorkbench({
      selectedAssetId: prefilledAssetId,
      selectedRevisionId: prefilledRevisionId,
    });
  }, [controller, initialViewModel, prefilledAssetId, prefilledRevisionId]);

  const selectedAssetId = composer?.persistedAssetId ?? viewModel?.selectedAssetId ?? null;
  const selectedRevision = viewModel?.detail?.selected_revision ?? null;
  const selectedRevisionId = composer?.persistedRevisionId ?? selectedRevision?.id ?? null;
  const currentDraftSignature = JSON.stringify(composer?.draft ?? null);
  const duplicateCheckInput = useMemo(
    () => createLedgerDuplicateCheckInput(composer),
    [composer],
  );
  const duplicateCheckSignature = useMemo(
    () => buildDuplicateCheckTriggerSignature(duplicateCheckInput),
    [duplicateCheckInput],
  );
  const strongDuplicateMatches = getStrongDuplicateMatches(duplicateMatches);
  const isDuplicateResultStale =
    duplicateCheckState === "checked" &&
    duplicateCheckSignature != null &&
    lastCheckedDuplicateSignature != null &&
    duplicateCheckSignature !== lastCheckedDuplicateSignature;
  const firstPendingStrongDuplicateMatch = pendingSubmitStrongMatches[0] ?? null;

  useEffect(() => {
    latestDuplicateCheckContextRef.current = {
      selectedRevisionId,
      duplicateCheckSignature,
    };
  }, [duplicateCheckSignature, selectedRevisionId]);

  useEffect(() => {
    duplicateCheckRequestIdRef.current += 1;
    setIsImmediateDuplicateCheckPending(false);
  }, [duplicateCheckSignature, selectedRevisionId]);

  useEffect(() => {
    if (
      !shouldInvalidateDuplicateSubmitConfirmation({
        isConfirmationOpen: isDuplicateSubmitConfirmationOpen,
        confirmationDraftSignature: duplicateConfirmationDraftSignature,
        currentDraftSignature,
      })
    ) {
      return;
    }

    setIsDuplicateSubmitConfirmationOpen(false);
    setPendingSubmitStrongMatches([]);
    setDuplicateConfirmationDraftSignature(null);
  }, [
    currentDraftSignature,
    duplicateConfirmationDraftSignature,
    isDuplicateSubmitConfirmationOpen,
  ]);

  useEffect(() => {
    if (!composer || !duplicateCheckInput || !duplicateCheckSignature) {
      setDuplicateMatches([]);
      setDuplicateCheckState("not_checked");
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
        setDuplicateCheckErrorMessage(toErrorMessage(error, "Duplicate check failed."));
        setLastCheckedDuplicateSignature(null);
      }
    }, 450);

    return () => {
      cancelled = true;
      globalThis.clearTimeout(timer);
    };
  }, [
    composer,
    controller,
    duplicateCheckInput,
    duplicateCheckSignature,
    selectedRevisionId,
  ]);

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
        selectedRevisionId:
          input.selectedRevisionId ?? viewModel?.selectedRevisionId ?? null,
        filters: input.filters ?? viewModel?.filters,
      });
      applyLoadedWorkbench(nextViewModel);
    } catch (error) {
      setLoadStatus("error");
      setErrorMessage(toErrorMessage(error, "Knowledge ledger failed to load."));
    }
  }

  function applyLoadedWorkbench(nextViewModel: KnowledgeLibraryWorkbenchViewModel) {
    setViewModel(nextViewModel);
    setComposer(createEditableComposerFromViewModel(nextViewModel));
    setLoadStatus("ready");
    setSemanticSuggestion(null);
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
      applyLoadedWorkbench(nextViewModel);
      setStatusMessage(successMessage);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "Knowledge ledger action failed."));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSaveDraft() {
    if (!composer) {
      return;
    }

    if (composer.persistedRevisionId) {
      await runMutation(
        () =>
          controller.saveDraftAndLoad({
            revisionId: composer.persistedRevisionId!,
            input: {
              ...composer.draft,
            },
            filters: viewModel?.filters,
          }),
        "Draft saved.",
      );
      return;
    }

    await runMutation(
      () =>
        controller.createDraftAndLoad({
          ...buildCreateDraftInput(composer),
          filters: viewModel?.filters,
        }),
      "Draft saved.",
    );
  }

  async function handleCreateDerivedDraft() {
    const assetId = viewModel?.selectedAssetId;
    if (!assetId || !viewModel) {
      return;
    }

    await runMutation(
      () =>
        controller.createDerivedDraftAndLoad({
          assetId,
          filters: viewModel.filters,
        }),
      "Update draft derived from the approved revision.",
    );
  }

  function handleStartNewRecord() {
    setComposer(createEmptyLedgerComposer());
    setWorkspaceTab("fields");
    setIsAiIntakeOpen(false);
    setAiIntakeSuggestion(null);
    setSemanticSuggestion(null);
    setStatusMessage(null);
    setErrorMessage(null);
  }

  function handleSelectAsset(assetId: string) {
    setComposer(null);
    setWorkspaceTab("fields");
    setSemanticSuggestion(null);
    void loadWorkbench({
      selectedAssetId: assetId,
      filters: viewModel?.filters,
    });
  }

  function handleApplyAiIntakeSuggestion() {
    if (!aiIntakeSuggestion) {
      return;
    }

    setComposer((current) =>
      applyAiIntakeSuggestion(
        current?.mode === "new_local" ? current : createEmptyLedgerComposer(),
        aiIntakeSuggestion,
      ),
    );
    setAiIntakeSuggestion(null);
    setIsAiIntakeOpen(false);
    setWorkspaceTab("fields");
    setStatusMessage("AI intake suggestion applied locally.");
  }

  async function handleRunAiIntake() {
    if (aiIntakeSourceText.trim().length === 0) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const nextSuggestion = await controller.createAiIntakeSuggestion({
        sourceText: aiIntakeSourceText.trim(),
      });
      setAiIntakeSuggestion(nextSuggestion);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "AI parse intake failed."));
    } finally {
      setIsBusy(false);
    }
  }

  function handleApplySemanticSuggestion() {
    if (!semanticSuggestion) {
      return;
    }

    setComposer((current) => {
      const baseComposer =
        current ??
        createComposerFromSelectedRevision(selectedRevision, viewModel?.selectedAssetId ?? null);
      if (!baseComposer) {
        return current;
      }

      return {
        ...baseComposer,
        draft: {
          ...baseComposer.draft,
          ...semanticSuggestion.suggestedFieldPatch,
        },
        semanticLayerDraft: toPendingSemanticLayerDraft(
          baseComposer.persistedRevisionId ?? selectedRevision?.id ?? "local-only",
          semanticSuggestion,
        ),
        warnings: [...baseComposer.warnings, ...semanticSuggestion.warnings],
      };
    });
    setSemanticSuggestion(null);
    setStatusMessage("Semantic suggestion applied locally.");
  }

  async function handleRunSemanticAssist() {
    if (!composer?.persistedRevisionId || semanticInstructionText.trim().length === 0) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const nextSuggestion = await controller.assistSemanticLayer({
        revisionId: composer.persistedRevisionId,
        instructionText: semanticInstructionText.trim(),
        targetScopes: ["semantic_layer", "metadata_patch"],
      });
      setSemanticSuggestion(nextSuggestion);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "Semantic assist failed."));
    } finally {
      setIsBusy(false);
    }
  }

  function handleSemanticDraftChange(input: KnowledgeSemanticLayerInput) {
    setComposer((current) => {
      if (!current) {
        return current;
      }

      const currentSemanticLayer = current.semanticLayerDraft ?? selectedRevision?.semantic_layer;
      return {
        ...current,
        semanticLayerDraft: {
          revision_id:
            currentSemanticLayer?.revision_id ??
            current.persistedRevisionId ??
            "draft-revision",
          status: currentSemanticLayer?.status ?? "stale",
          page_summary:
            input.pageSummary ??
            currentSemanticLayer?.page_summary ??
            selectedRevision?.semantic_layer?.page_summary,
          retrieval_terms:
            input.retrievalTerms ?? currentSemanticLayer?.retrieval_terms,
          retrieval_snippets:
            input.retrievalSnippets ?? currentSemanticLayer?.retrieval_snippets,
          table_semantics:
            input.tableSemantics ?? currentSemanticLayer?.table_semantics,
          image_understanding:
            input.imageUnderstanding ?? currentSemanticLayer?.image_understanding,
        },
      };
    });
  }

  async function handleRegenerateSemanticLayer() {
    if (!composer?.persistedRevisionId || !viewModel) {
      return;
    }

    await runMutation(
      () =>
        controller.regenerateSemanticLayerAndLoad({
          revisionId: composer.persistedRevisionId!,
          filters: viewModel.filters,
        }),
      "AI semantic layer regenerated.",
    );
  }

  async function handleConfirmSemanticLayer() {
    if (!composer?.persistedRevisionId || !composer.semanticLayerDraft || !viewModel) {
      return;
    }

    const semanticLayerDraft = composer.semanticLayerDraft;

    await runMutation(
      () =>
        controller.confirmSemanticLayerAndLoad({
          revisionId: composer.persistedRevisionId!,
          filters: viewModel.filters,
          input: {
            pageSummary: semanticLayerDraft.page_summary,
            retrievalTerms: semanticLayerDraft.retrieval_terms,
            retrievalSnippets: semanticLayerDraft.retrieval_snippets,
            tableSemantics: semanticLayerDraft.table_semantics,
            imageUnderstanding: semanticLayerDraft.image_understanding,
          },
        }),
      "AI semantic layer confirmed.",
    );
  }

  async function handleSaveRichContent() {
    if (!composer?.persistedRevisionId || !viewModel) {
      return;
    }

    await runMutation(
      () =>
        controller.replaceContentBlocksAndLoad({
          revisionId: composer.persistedRevisionId!,
          blocks: composer.contentBlocksDraft,
          filters: viewModel.filters,
        }),
      "Rich content saved.",
    );
  }

  async function handleUploadImage(
    input: KnowledgeUploadInput,
  ): Promise<KnowledgeUploadViewModel | void> {
    return controller.uploadImage(input);
  }

  async function handleSubmitDraft() {
    if (
      !composer?.persistedRevisionId ||
      !viewModel ||
      isBusy ||
      isImmediateDuplicateCheckPending
    ) {
      return;
    }

    const submitCheckContext: ImmediateDuplicateCheckContext = {
      selectedRevisionId: composer.persistedRevisionId,
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

    const nextStrongMatches = getStrongDuplicateMatches(matchesForSubmitDecision);
    if (nextStrongMatches.length > 0) {
      setPendingSubmitStrongMatches(nextStrongMatches);
      setIsDuplicateSubmitConfirmationOpen(true);
      setDuplicateConfirmationDraftSignature(currentDraftSignature);
      return;
    }

    setPendingSubmitStrongMatches([]);
    setIsDuplicateSubmitConfirmationOpen(false);
    setDuplicateConfirmationDraftSignature(null);
    await runMutation(
      () =>
        controller.submitDraftAndLoad({
          revisionId: composer.persistedRevisionId!,
          filters: viewModel.filters,
        }),
      "Draft submitted to knowledge review.",
    );
  }

  async function handleContinueSubmitWithDuplicateAcknowledgement() {
    const continueDecision = resolveDuplicateAcknowledgementSubmitDecision({
      revisionId: composer?.persistedRevisionId ?? null,
      hasViewModel: viewModel != null,
      pendingStrongMatchCount: pendingSubmitStrongMatches.length,
      isBusy,
      isImmediateDuplicateCheckPending,
      isConfirmationOpen: isDuplicateSubmitConfirmationOpen,
      confirmationDraftSignature: duplicateConfirmationDraftSignature,
      currentDraftSignature,
    });
    if (continueDecision === "blocked") {
      return;
    }

    if (continueDecision === "stale") {
      setIsDuplicateSubmitConfirmationOpen(false);
      setPendingSubmitStrongMatches([]);
      setDuplicateConfirmationDraftSignature(null);
      setStatusMessage(
        "Draft changed since the duplicate warning opened. Review refreshed duplicate signals before continuing.",
      );
      return;
    }

    if (!composer?.persistedRevisionId || !viewModel) {
      return;
    }

    const duplicateAcknowledgement: DuplicateWarningAcknowledgementInput = {
      acknowledged: true,
      matches: pendingSubmitStrongMatches,
    };
    setPendingSubmitStrongMatches([]);
    setIsDuplicateSubmitConfirmationOpen(false);
    setDuplicateConfirmationDraftSignature(null);
    await runMutation(
      () =>
        controller.submitDraftAndLoad({
          revisionId: composer.persistedRevisionId!,
          filters: viewModel.filters,
          duplicateAcknowledgement,
        }),
      "Draft submitted to knowledge review.",
    );
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
      setDuplicateCheckErrorMessage(toErrorMessage(error, "Duplicate check failed."));
      setLastCheckedDuplicateSignature(null);
      return null;
    } finally {
      setIsImmediateDuplicateCheckPending(false);
    }
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

  function updateComposer<K extends keyof KnowledgeLibraryLedgerComposer["draft"]>(
    field: K,
    value: KnowledgeLibraryLedgerComposer["draft"][K],
  ) {
    setComposer((current) =>
      current
        ? {
            ...current,
            draft: {
              ...current.draft,
              [field]: value,
            },
          }
        : current,
    );
  }

  return (
    <main className="knowledge-library-ledger-page">
      <header className="knowledge-library-ledger-page__hero">
        <div>
          <span className="knowledge-library-ledger-page__eyebrow">
            Knowledge Library
          </span>
          <h1>Knowledge Ledger</h1>
          <p>
            Sheet-first entry mode keeps the table on the left and the working draft
            on the right.
          </p>
        </div>
        <div className="knowledge-library-ledger-page__hero-meta">
          <span>Role: {actorRole}</span>
          <span>Surface: ledger</span>
          <span>
            State:{" "}
            {composer?.mode === "new_local"
              ? "local draft"
              : selectedAssetId ?? "browse"}
          </span>
        </div>
      </header>

      <section className="knowledge-library-ledger-command-bar">
        <label className="knowledge-library-ledger-command-bar__search">
          <span>Search</span>
          <input
            type="search"
            value={viewModel?.filters.searchText ?? ""}
            placeholder="Search title, summary, or semantic terms"
            readOnly
          />
        </label>
        <div className="knowledge-library-ledger-command-bar__query-mode" role="group">
          <button type="button" className="is-active">
            Keyword
          </button>
          <button type="button">Semantic</button>
        </div>
        <div className="knowledge-library-ledger-command-bar__actions">
          <button type="button" onClick={handleStartNewRecord}>
            New Record
          </button>
          <button type="button" onClick={() => setIsAiIntakeOpen((current) => !current)}>
            AI Parse Intake
          </button>
        </div>
      </section>

      {statusMessage ? <p className="knowledge-library-ledger-status">{statusMessage}</p> : null}
      {errorMessage ? (
        <p className="knowledge-library-ledger-status is-error">{errorMessage}</p>
      ) : null}
      {isAiIntakeOpen ? (
        <KnowledgeLibraryAiIntakePanel
          sourceText={aiIntakeSourceText}
          onSourceTextChange={setAiIntakeSourceText}
          suggestion={aiIntakeSuggestion}
          onGenerateSuggestion={() => void handleRunAiIntake()}
          onApplySuggestion={aiIntakeSuggestion ? handleApplyAiIntakeSuggestion : undefined}
          isBusy={isBusy}
        />
      ) : null}

      <div className="knowledge-library-ledger-layout">
        <KnowledgeLibraryLedgerTable
          items={viewModel?.visibleLibrary ?? []}
          selectedAssetId={selectedAssetId}
          onSelectAsset={handleSelectAsset}
        />

        <section className="knowledge-library-ledger-workspace">
          <header className="knowledge-library-ledger-workspace__header">
            <div>
              <h2>{composer ? "Editable Workspace" : "Browse Workspace"}</h2>
              <p>
                {composer
                  ? "Edit draft fields, AI semantic suggestions, and rich content in one governed workspace."
                  : "Select a row to inspect the current revision or create an update draft."}
              </p>
            </div>
            {composer?.mode === "new_local" ? (
              <span className="knowledge-library-ledger-badge">Unsaved local draft</span>
            ) : composer?.persistedRevisionId ? (
              <span className="knowledge-library-ledger-badge is-selected">
                Revision {selectedRevision?.revision_no ?? "draft"}
              </span>
            ) : selectedRevision ? (
              <span className="knowledge-library-ledger-badge is-selected">
                Revision {selectedRevision.revision_no}
              </span>
            ) : null}
          </header>

          {composer?.warnings.length ? (
            <section className="knowledge-library-ledger-warnings">
              <h3>Working Notes</h3>
              <ul>
                {composer.warnings.map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <nav className="knowledge-library-ledger-tabs" aria-label="Workspace Tabs">
            <button
              type="button"
              className={workspaceTab === "fields" ? "is-active" : ""}
              onClick={() => setWorkspaceTab("fields")}
            >
              Fields
            </button>
            <button
              type="button"
              className={workspaceTab === "semantic" ? "is-active" : ""}
              onClick={() => setWorkspaceTab("semantic")}
            >
              Semantic
            </button>
            <button
              type="button"
              className={workspaceTab === "content_blocks" ? "is-active" : ""}
              onClick={() => setWorkspaceTab("content_blocks")}
            >
              Content Blocks
            </button>
          </nav>

          <div className="knowledge-library-ledger-workspace__body">
            {workspaceTab === "fields" ? (
              composer ? (
                <form className="knowledge-library-ledger-fields" onSubmit={preventDefault}>
                  <label>
                    <span>Title</span>
                    <input
                      type="text"
                      aria-label="Title"
                      value={composer.draft.title}
                      onChange={(event) => updateComposer("title", event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Canonical Text</span>
                    <textarea
                      rows={8}
                      aria-label="Canonical Text"
                      value={composer.draft.canonicalText}
                      onChange={(event) =>
                        updateComposer("canonicalText", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    <span>Summary</span>
                    <textarea
                      rows={4}
                      value={composer.draft.summary ?? ""}
                      onChange={(event) => updateComposer("summary", event.target.value)}
                    />
                  </label>
                  <div className="knowledge-library-ledger-fields__actions">
                    <button type="submit" onClick={() => void handleSaveDraft()} disabled={isBusy}>
                      Save Draft
                    </button>
                  </div>
                </form>
              ) : selectedRevision ? (
                <section className="knowledge-library-ledger-fields knowledge-library-ledger-fields--readonly">
                  <label>
                    <span>Title</span>
                    <input type="text" value={selectedRevision.title} readOnly />
                  </label>
                  <label>
                    <span>Canonical Text</span>
                    <textarea rows={8} value={selectedRevision.canonical_text} readOnly />
                  </label>
                  <label>
                    <span>Summary</span>
                    <textarea rows={4} value={selectedRevision.summary ?? ""} readOnly />
                  </label>
                </section>
              ) : (
                <p className="knowledge-library-ledger-empty">
                  Choose a row or start a new record to open the fields workspace.
                </p>
              )
            ) : workspaceTab === "semantic" ? (
              <div className="knowledge-library-ledger-stack">
                <KnowledgeLibrarySemanticAssistantPanel
                  instructionText={semanticInstructionText}
                  onInstructionTextChange={setSemanticInstructionText}
                  suggestion={semanticSuggestion}
                  onGenerateSuggestion={() => void handleRunSemanticAssist()}
                  onApplySuggestion={semanticSuggestion ? handleApplySemanticSuggestion : undefined}
                  onDiscardSuggestion={
                    semanticSuggestion ? () => setSemanticSuggestion(null) : undefined
                  }
                  isBusy={isBusy}
                />
                {composer ? (
                  <KnowledgeLibrarySemanticPanel
                    semanticLayer={composer.semanticLayerDraft ?? selectedRevision?.semantic_layer}
                    onChange={handleSemanticDraftChange}
                    onRegenerate={() => void handleRegenerateSemanticLayer()}
                    onConfirm={() => void handleConfirmSemanticLayer()}
                    isBusy={isBusy}
                    actionLabels={{
                      regenerate: "Regenerate Semantics",
                      confirm: "Confirm Semantic Layer",
                    }}
                  />
                ) : (
                  <p className="knowledge-library-ledger-empty">
                    Save or open a draft revision before confirming semantic changes.
                  </p>
                )}
              </div>
            ) : composer ? (
              <div className="knowledge-library-ledger-stack">
                <KnowledgeLibraryRichContentEditor
                  blocks={composer.contentBlocksDraft}
                  onChange={(blocks) =>
                    setComposer((current) =>
                      current
                        ? {
                            ...current,
                            contentBlocksDraft: blocks,
                          }
                        : current,
                    )
                  }
                  onUploadImage={handleUploadImage}
                />
                <div className="knowledge-library-ledger-fields__actions">
                  <button
                    type="button"
                    disabled={isBusy || !composer.persistedRevisionId}
                    onClick={() => void handleSaveRichContent()}
                  >
                    Save Rich Content
                  </button>
                </div>
              </div>
            ) : (
              <p className="knowledge-library-ledger-empty">
                Create an update draft before editing content blocks.
              </p>
            )}
          </div>

          <footer className="knowledge-library-ledger-workspace__footer">
            <div className="knowledge-library-ledger-workspace__actions">
              {composer?.persistedRevisionId ? (
                <button
                  type="button"
                  disabled={isBusy || isImmediateDuplicateCheckPending}
                  onClick={() => void handleSubmitDraft()}
                >
                  Submit To Review
                </button>
              ) : null}
              {!composer && selectedAssetId ? (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void handleCreateDerivedDraft()}
                >
                  Create Update Draft
                </button>
              ) : null}
            </div>

            {composer ? (
              <KnowledgeLibraryDuplicateStatusRow
                checkState={duplicateCheckState}
                strongMatchCount={strongDuplicateMatches.length}
                isStale={isDuplicateResultStale}
                checkErrorMessage={duplicateCheckErrorMessage}
              />
            ) : null}

            {isDuplicateSubmitConfirmationOpen && firstPendingStrongDuplicateMatch ? (
              <KnowledgeLibraryDuplicateSubmitConfirmation
                match={firstPendingStrongDuplicateMatch}
                isBusy={isBusy}
                onOpenAsset={handleOpenExistingAsset}
                onContinueAnyway={() => void handleContinueSubmitWithDuplicateAcknowledgement()}
              />
            ) : null}

            {composer ? (
              <KnowledgeLibraryDuplicatePanel
                matches={duplicateMatches}
                checkState={duplicateCheckState}
                checkErrorMessage={duplicateCheckErrorMessage}
                onOpenAsset={handleOpenExistingAsset}
              />
            ) : null}
          </footer>
        </section>
      </div>

      {loadStatus === "loading" ? (
        <p className="knowledge-library-ledger-status">Loading ledger...</p>
      ) : null}
    </main>
  );
}

function preventDefault(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
}

function createEditableComposerFromViewModel(
  viewModel: KnowledgeLibraryWorkbenchViewModel | null,
): KnowledgeLibraryLedgerComposer | null {
  const selectedRevision = viewModel?.detail?.selected_revision ?? null;
  if (!selectedRevision || selectedRevision.status !== "draft") {
    return null;
  }

  return createComposerFromSelectedRevision(selectedRevision, viewModel?.selectedAssetId ?? null);
}

function createComposerFromSelectedRevision(
  selectedRevision: KnowledgeRevisionViewModel | null,
  selectedAssetId: string | null,
): KnowledgeLibraryLedgerComposer | null {
  if (!selectedRevision) {
    return null;
  }

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

function createLedgerDuplicateCheckInput(
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
    manuscriptTypes: normalizeManuscriptTypes(composer.draft.manuscriptTypes),
    sections: normalizeStringArray(composer.draft.sections),
    riskTags: normalizeStringArray(composer.draft.riskTags),
    disciplineTags: normalizeStringArray(composer.draft.disciplineTags),
    aliases: normalizeStringArray(composer.draft.aliases),
    bindings: composer.draft.bindings,
    currentAssetId: composer.persistedAssetId ?? undefined,
    currentRevisionId: composer.persistedRevisionId ?? undefined,
  };
}

function toPendingSemanticLayerDraft(
  revisionId: string,
  suggestion: KnowledgeLibrarySemanticAssistSuggestionViewModel,
): KnowledgeSemanticLayerViewModel {
  return {
    revision_id: revisionId,
    status: "pending_confirmation",
    page_summary: suggestion.suggestedSemanticLayer.pageSummary,
    retrieval_terms: suggestion.suggestedSemanticLayer.retrievalTerms,
    retrieval_snippets: suggestion.suggestedSemanticLayer.retrievalSnippets,
    table_semantics: suggestion.suggestedSemanticLayer.tableSemantics,
    image_understanding: suggestion.suggestedSemanticLayer.imageUnderstanding,
  };
}

function normalizeManuscriptTypes(
  value: KnowledgeLibraryLedgerComposer["draft"]["manuscriptTypes"],
): DuplicateKnowledgeCheckInput["manuscriptTypes"] {
  if (value === "any") {
    return "any";
  }

  const normalized = value
    .map((entry) => entry.trim())
    .filter((entry): entry is ManuscriptType => entry.length > 0);
  return normalized.length > 0 ? normalized : "any";
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

function optionalTrimmedValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : undefined;
}

function toErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}
