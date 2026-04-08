import { createBrowserHttpClient } from "../../lib/browser-http-client.ts";
import type {
  KnowledgeReviewActionViewModel,
  KnowledgeReviewQueueItemViewModel,
} from "../knowledge/index.ts";
import {
  applyKnowledgeReviewSuccess,
  approveKnowledgeReviewItem,
  createKnowledgeReviewWorkbenchController,
  createKnowledgeReviewWorkbenchState,
  loadKnowledgeReviewDesk,
  loadKnowledgeReviewHistory,
  rejectKnowledgeReviewItem,
  type KnowledgeReviewDeskLoadResult,
  type KnowledgeReviewHistoryLoadResult,
  type KnowledgeReviewItemActionResult,
} from "./index.ts";

const browserClient = createBrowserHttpClient({
  apiBaseUrl: "https://api.medsys.local",
});

const queueItemCheck: KnowledgeReviewQueueItemViewModel = {
  id: "knowledge-asset-1-revision-1",
  asset_id: "knowledge-asset-1",
  revision_id: "knowledge-asset-1-revision-1",
  title: "Case report privacy guardrail",
  canonical_text: "Mask all identifiable patient details.",
  knowledge_kind: "checklist",
  status: "pending_review",
  routing: {
    module_scope: "proofreading",
    manuscript_types: ["case_report"],
  },
  evidence_level: "high",
  source_type: "guideline",
};

const historyItemCheck: KnowledgeReviewActionViewModel = {
  id: "history-1",
  knowledge_item_id: queueItemCheck.asset_id,
  revision_id: queueItemCheck.revision_id,
  action: "submitted_for_review",
  actor_role: "knowledge_reviewer",
  created_at: "2026-03-29T00:00:00.000Z",
};

const followupQueueItemCheck: KnowledgeReviewQueueItemViewModel = {
  ...queueItemCheck,
  id: "knowledge-asset-2-revision-1",
  asset_id: "knowledge-asset-2",
  revision_id: "knowledge-asset-2-revision-1",
  title: "Method section language consistency guardrail",
};

const successFlowSeedStateCheck = applyKnowledgeReviewSuccess(
  createKnowledgeReviewWorkbenchState({
    queue: [queueItemCheck, followupQueueItemCheck],
    activeItemId: queueItemCheck.id,
  }),
  queueItemCheck.id,
);

const knowledgeWorkbenchController = createKnowledgeReviewWorkbenchController(browserClient);

const deskLoadResultCheck: Promise<KnowledgeReviewDeskLoadResult> = loadKnowledgeReviewDesk(
  browserClient,
  {},
);
const historyLoadResultCheck: Promise<KnowledgeReviewHistoryLoadResult> =
  loadKnowledgeReviewHistory(browserClient, {
    revisionId: queueItemCheck.revision_id,
  });
const approveResultCheck: Promise<KnowledgeReviewItemActionResult> =
  approveKnowledgeReviewItem(browserClient, {
    revisionId: queueItemCheck.revision_id,
    actorRole: "knowledge_reviewer",
    reviewNote: "Looks good to publish.",
    state: successFlowSeedStateCheck,
  });
const rejectResultCheck: Promise<KnowledgeReviewItemActionResult> =
  rejectKnowledgeReviewItem(browserClient, {
    revisionId: queueItemCheck.revision_id,
    actorRole: "knowledge_reviewer",
    reviewNote: "Need direct citation for the recommendation.",
    state: successFlowSeedStateCheck,
  });

const successResultShapeCheck: KnowledgeReviewItemActionResult = {
  status: "success",
  reviewNote: "",
  desk: {
    queue: [followupQueueItemCheck],
    visibleQueue: [followupQueueItemCheck],
    selectedItem: followupQueueItemCheck,
    state: successFlowSeedStateCheck,
  },
  history: {
    revisionId: followupQueueItemCheck.revision_id,
    actions: [historyItemCheck],
  },
  historyRevisionId: followupQueueItemCheck.revision_id,
};

const emptyDeskSuccessResultShapeCheck: KnowledgeReviewItemActionResult = {
  status: "success",
  reviewNote: "",
  desk: {
    queue: [],
    visibleQueue: [],
    selectedItem: null,
    state: createKnowledgeReviewWorkbenchState({
      queue: [],
      activeItemId: null,
    }),
  },
  history: null,
  historyRevisionId: null,
};

const failedActionResultShapeCheck: KnowledgeReviewItemActionResult = {
  status: "error",
  reviewNote: "keep note for retry",
  error: new Error("network failed"),
};

void knowledgeWorkbenchController.loadDesk({});
void knowledgeWorkbenchController.loadHistory({
  revisionId: queueItemCheck.revision_id,
});
void knowledgeWorkbenchController.approveItem({
  revisionId: queueItemCheck.revision_id,
  actorRole: "knowledge_reviewer",
  reviewNote: "Approved after guideline cross-check.",
});
void knowledgeWorkbenchController.rejectItem({
  revisionId: queueItemCheck.revision_id,
  actorRole: "knowledge_reviewer",
  reviewNote: "Rejected until stronger evidence is attached.",
});

export {
  approveResultCheck,
  browserClient,
  deskLoadResultCheck,
  emptyDeskSuccessResultShapeCheck,
  failedActionResultShapeCheck,
  historyItemCheck,
  historyLoadResultCheck,
  knowledgeWorkbenchController,
  queueItemCheck,
  rejectResultCheck,
  successFlowSeedStateCheck,
  successResultShapeCheck,
};
