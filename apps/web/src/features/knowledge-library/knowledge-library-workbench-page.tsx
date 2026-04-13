import { useEffect, useRef, useState } from "react";
import { formatWorkbenchHash } from "../../app/workbench-routing.ts";
import { WorkbenchCoreStrip } from "../../app/workbench-core-strip.tsx";
import { createBrowserHttpClient } from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/index.ts";
import type { KnowledgeKind } from "../knowledge/index.ts";
import type { ManuscriptModule, ManuscriptType } from "../manuscripts/types.ts";
import {
  createKnowledgeLibraryWorkbenchController,
  type KnowledgeLibraryWorkbenchController,
} from "./knowledge-library-controller.ts";
import { KnowledgeLibraryDuplicatePanel } from "./knowledge-library-duplicate-panel.tsx";
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

interface KnowledgeLibraryFormState {
  title: string;
  canonicalText: string;
  summary: string;
  knowledgeKind: KnowledgeKind;
  moduleScope: ManuscriptModule | "any";
  manuscriptTypes: string;
  sections: string;
  riskTags: string;
  disciplineTags: string;
  aliases: string;
  evidenceLevel: string;
  sourceType: string;
  sourceLink: string;
  effectiveAt: string;
  expiresAt: string;
  bindingsText: string;
}

interface DuplicateCheckDraftFields {
  title: string;
  canonicalText: string;
  summary: string;
  knowledgeKind: KnowledgeKind;
  moduleScope: ManuscriptModule | "any";
  manuscriptTypes: string;
  sections: string;
  riskTags: string;
  disciplineTags: string;
  aliases: string;
  bindingsText: string;
}

interface ImmediateDuplicateCheckContext {
  selectedRevisionId: string | null;
  duplicateCheckSignature: string | null;
}

const defaultController = createKnowledgeLibraryWorkbenchController(
  createBrowserHttpClient(),
);

const knowledgeKinds: Array<KnowledgeKind | "all"> = [
  "all",
  "rule",
  "case_pattern",
  "checklist",
  "prompt_snippet",
  "reference",
  "other",
];

const moduleOptions: Array<ManuscriptModule | "any"> = [
  "any",
  "screening",
  "editing",
  "proofreading",
  "manual",
  "learning",
];

const defaultFormState: KnowledgeLibraryFormState = {
  title: "",
  canonicalText: "",
  summary: "",
  knowledgeKind: "rule",
  moduleScope: "any",
  manuscriptTypes: "any",
  sections: "",
  riskTags: "",
  disciplineTags: "",
  aliases: "",
  evidenceLevel: "unknown",
  sourceType: "other",
  sourceLink: "",
  effectiveAt: "",
  expiresAt: "",
  bindingsText: "",
};

export function KnowledgeLibraryWorkbenchPage({
  controller = defaultController,
  actorRole = "knowledge_reviewer",
  initialViewModel = null,
  prefilledAssetId,
  prefilledRevisionId,
}: KnowledgeLibraryWorkbenchPageProps) {
  const initialFormState = toFormState(initialViewModel?.detail ?? null);
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
  const duplicateCheckRequestIdRef = useRef(0);
  const latestDuplicateCheckContextRef =
    useRef<ImmediateDuplicateCheckContext>({
      selectedRevisionId: null,
      duplicateCheckSignature: null,
    });

  const normalizedPrefilledAssetId = prefilledAssetId?.trim() ?? "";
  const normalizedPrefilledRevisionId = prefilledRevisionId?.trim() ?? "";

  useEffect(() => {
    if (initialViewModel) {
      const nextFormState = toFormState(initialViewModel.detail);
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
    const nextFormState = toFormState(viewModel?.detail ?? null);
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
      <header className="knowledge-library-hero">
        <div className="knowledge-library-hero-copy">
          <span className="knowledge-library-eyebrow">协作与回收区</span>
          <h1>知识库</h1>
          <p>
            用一张可搜索、可筛选、可展开抽屉的知识台账来管理规则、案例、图文说明和 AI 语义层，
            让录入与复用都更像工作台，而不是长表单。
          </p>
          <WorkbenchCoreStrip
            activePillarId="knowledge"
            heading="知识沉淀链路"
            description="在同一条工作链路里完成搜索、录入、结构绑定和审核交接。"
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
              <p className="knowledge-library-empty">正在加载知识库...</p>
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

            <div className="knowledge-library-form-grid">
              <label>
                Title
                <input
                  value={formState.title}
                  onChange={(event) =>
                    updateDraftFormState((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Knowledge title"
                />
              </label>
              <label>
                Knowledge Kind
                <select
                  value={formState.knowledgeKind}
                  onChange={(event) =>
                    updateDraftFormState((current) => ({
                      ...current,
                      knowledgeKind: event.target.value as KnowledgeKind,
                    }))
                  }
                >
                  {knowledgeKinds
                    .filter((kind): kind is KnowledgeKind => kind !== "all")
                    .map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                </select>
              </label>
              <label className="knowledge-library-form-full">
                Canonical Text
                <textarea
                  rows={6}
                  value={formState.canonicalText}
                  onChange={(event) =>
                    updateDraftFormState((current) => ({
                      ...current,
                      canonicalText: event.target.value,
                    }))
                  }
                  placeholder="Canonical knowledge text"
                />
              </label>
              <label className="knowledge-library-form-full">
                Summary
                <textarea
                  rows={3}
                  value={formState.summary}
                  onChange={(event) =>
                    updateDraftFormState((current) => ({
                      ...current,
                      summary: event.target.value,
                    }))
                  }
                  placeholder="Short operator summary"
                />
              </label>
              <label>
                Module Scope
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
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Manuscript Types
                <input
                  value={formState.manuscriptTypes}
                  onChange={(event) =>
                    updateDraftFormState((current) => ({
                      ...current,
                      manuscriptTypes: event.target.value,
                    }))
                  }
                  placeholder="any or comma-separated types"
                />
              </label>
              <label>
                Sections
                <input
                  value={formState.sections}
                  onChange={(event) =>
                    updateDraftFormState((current) => ({
                      ...current,
                      sections: event.target.value,
                    }))
                  }
                  placeholder="methods, discussion"
                />
              </label>
              <label>
                Risk Tags
                <input
                  value={formState.riskTags}
                  onChange={(event) =>
                    updateDraftFormState((current) => ({
                      ...current,
                      riskTags: event.target.value,
                    }))
                  }
                  placeholder="consistency, statistics"
                />
              </label>
              <label>
                Discipline Tags
                <input
                  value={formState.disciplineTags}
                  onChange={(event) =>
                    updateDraftFormState((current) => ({
                      ...current,
                      disciplineTags: event.target.value,
                    }))
                  }
                  placeholder="cardiology, oncology"
                />
              </label>
              <label>
                Aliases
                <input
                  value={formState.aliases}
                  onChange={(event) =>
                    updateDraftFormState((current) => ({
                      ...current,
                      aliases: event.target.value,
                    }))
                  }
                  placeholder="endpoint, primary endpoint"
                />
              </label>
              <label>
                Evidence Level
                <input
                  value={formState.evidenceLevel}
                  onChange={(event) =>
                    updateDraftFormState((current) => ({
                      ...current,
                      evidenceLevel: event.target.value,
                    }))
                  }
                  placeholder="high"
                />
              </label>
              <label>
                Source Type
                <input
                  value={formState.sourceType}
                  onChange={(event) =>
                    updateDraftFormState((current) => ({
                      ...current,
                      sourceType: event.target.value,
                    }))
                  }
                  placeholder="guideline"
                />
              </label>
              <label className="knowledge-library-form-full">
                Source Link
                <input
                  value={formState.sourceLink}
                  onChange={(event) =>
                    updateDraftFormState((current) => ({
                      ...current,
                      sourceLink: event.target.value,
                    }))
                  }
                  placeholder="https://..."
                />
              </label>
              <label>
                Effective At
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
                Expires At
                <input
                  value={formState.expiresAt}
                  onChange={(event) =>
                    updateDraftFormState((current) => ({
                      ...current,
                      expiresAt: event.target.value,
                    }))
                  }
                  placeholder="Optional ISO timestamp"
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
                <h2>Structured Bindings</h2>
                <p>
                  Edit bindings as one line per record using{" "}
                  <code>binding_kind | target_id | label</code>.
                </p>
              </div>
            </header>
            <textarea
              rows={8}
              value={formState.bindingsText}
              onChange={(event) =>
                updateDraftFormState((current) => ({
                  ...current,
                  bindingsText: event.target.value,
                }))
              }
              placeholder="module_template | template-screening-1 | Screening Template"
            />
            <ul className="knowledge-library-binding-list">
              {parseBindings(formState.bindingsText).map((binding) => (
                <li key={`${binding.bindingKind}:${binding.bindingTargetId}`}>
                  <strong>{binding.bindingTargetLabel}</strong>
                  <span>{binding.bindingKind}</span>
                </li>
              ))}
            </ul>
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

function toFormState(detail: KnowledgeLibraryWorkbenchViewModel["detail"]): KnowledgeLibraryFormState {
  if (!detail) {
    return defaultFormState;
  }

  const revision = detail.selected_revision;
  return {
    title: revision.title,
    canonicalText: revision.canonical_text,
    summary: revision.summary ?? "",
    knowledgeKind: revision.knowledge_kind,
    moduleScope: revision.routing.module_scope,
    manuscriptTypes:
      revision.routing.manuscript_types === "any"
        ? "any"
        : revision.routing.manuscript_types.join(", "),
    sections: (revision.routing.sections ?? []).join(", "),
    riskTags: (revision.routing.risk_tags ?? []).join(", "),
    disciplineTags: (revision.routing.discipline_tags ?? []).join(", "),
    aliases: (revision.aliases ?? []).join(", "),
    evidenceLevel: revision.evidence_level ?? "unknown",
    sourceType: revision.source_type ?? "other",
    sourceLink: revision.source_link ?? "",
    effectiveAt: revision.effective_at ?? "",
    expiresAt: revision.expires_at ?? "",
    bindingsText: revision.bindings
      .map(
        (binding) =>
          `${binding.binding_kind} | ${binding.binding_target_id} | ${binding.binding_target_label}`,
      )
      .join("\n"),
  };
}

function toCreateInput(formState: KnowledgeLibraryFormState): CreateKnowledgeLibraryDraftInput {
  return {
    title: formState.title.trim(),
    canonicalText: formState.canonicalText.trim(),
    summary: optionalTrimmedValue(formState.summary),
    knowledgeKind: formState.knowledgeKind,
    moduleScope: formState.moduleScope,
    manuscriptTypes: parseManuscriptTypes(formState.manuscriptTypes),
    sections: splitCommaSeparated(formState.sections),
    riskTags: splitCommaSeparated(formState.riskTags),
    disciplineTags: splitCommaSeparated(formState.disciplineTags),
    aliases: splitCommaSeparated(formState.aliases),
    evidenceLevel: optionalTrimmedValue(formState.evidenceLevel) as
      | CreateKnowledgeLibraryDraftInput["evidenceLevel"]
      | undefined,
    sourceType: optionalTrimmedValue(formState.sourceType) as
      | CreateKnowledgeLibraryDraftInput["sourceType"]
      | undefined,
    sourceLink: optionalTrimmedValue(formState.sourceLink),
    effectiveAt: optionalTrimmedValue(formState.effectiveAt),
    expiresAt: optionalTrimmedValue(formState.expiresAt),
    bindings: parseBindings(formState.bindingsText),
  };
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
    manuscriptTypes: formState.manuscriptTypes,
    sections: formState.sections,
    riskTags: formState.riskTags,
    disciplineTags: formState.disciplineTags,
    aliases: formState.aliases,
    bindingsText: formState.bindingsText,
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
    manuscriptTypes: parseManuscriptTypes(formState.manuscriptTypes),
    sections: splitCommaSeparated(formState.sections),
    riskTags: splitCommaSeparated(formState.riskTags),
    disciplineTags: splitCommaSeparated(formState.disciplineTags),
    aliases: splitCommaSeparated(formState.aliases),
    bindings: parseBindings(formState.bindingsText),
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

function parseBindings(value: string): KnowledgeRevisionBindingInput[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      const [bindingKind, bindingTargetId, bindingTargetLabel] = line
        .split("|")
        .map((part) => part.trim());
      if (!bindingKind || !bindingTargetId || !bindingTargetLabel) {
        return [];
      }

      return [
        {
          bindingKind: bindingKind as KnowledgeRevisionBindingKind,
          bindingTargetId,
          bindingTargetLabel,
        },
      ];
    });
}

function normalizeDuplicateCheckBindings(
  bindings: DuplicateKnowledgeCheckInput["bindings"],
): KnowledgeRevisionBindingInput[] {
  return (bindings ?? []).flatMap((binding) => {
    const bindingKind = binding.bindingKind;
    const bindingTargetId = binding.bindingTargetId.trim();
    const bindingTargetLabel = binding.bindingTargetLabel.trim();
    if (!bindingKind || !bindingTargetId || !bindingTargetLabel) {
      return [];
    }

    return [
      {
        bindingKind,
        bindingTargetId,
        bindingTargetLabel,
      },
    ];
  });
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

function splitCommaSeparated(value: string): string[] | undefined {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return parts.length > 0 ? parts : undefined;
}

function parseManuscriptTypes(value: string): ManuscriptType[] | "any" {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.toLowerCase() === "any") {
    return "any";
  }

  return trimmed
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is ManuscriptType => Boolean(part));
}

function optionalTrimmedValue(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function formatActorRole(role: AuthRole): string {
  switch (role) {
    case "admin":
      return "管理员";
    case "knowledge_reviewer":
      return "知识审核";
    case "editor":
      return "编辑";
    case "proofreader":
      return "校对";
    case "screener":
      return "初筛";
    case "user":
    default:
      return "普通用户";
  }
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return `${fallback}: ${error.message}`;
  }

  return fallback;
}
