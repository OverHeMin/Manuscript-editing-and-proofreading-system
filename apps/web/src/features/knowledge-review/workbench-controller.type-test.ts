import { createBrowserHttpClient } from "../../lib/browser-http-client.ts";
import type {
  KnowledgeReviewActionViewModel,
  KnowledgeReviewQueueItemViewModel,
} from "../knowledge/index.ts";
import {
  applyKnowledgeReviewSuccess,
  approveKnowledgeReviewItem,
  createKnowledgeReviewWorkbenchState,
  createKnowledgeReviewWorkbenchController,
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
  id: "knowledge-queue-1",
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
  knowledge_item_id: queueItemCheck.id,
  action: "submitted_for_review",
  actor_role: "knowledge_reviewer",
  created_at: "2026-03-29T00:00:00.000Z",
};

const followupQueueItemCheck: KnowledgeReviewQueueItemViewModel = {
  ...queueItemCheck,
  id: "knowledge-queue-2",
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
    knowledgeItemId: queueItemCheck.id,
  });
const approveResultCheck: Promise<KnowledgeReviewItemActionResult> =
  approveKnowledgeReviewItem(browserClient, {
    knowledgeItemId: queueItemCheck.id,
    actorRole: "knowledge_reviewer",
    reviewNote: "Looks good to publish.",
    state: successFlowSeedStateCheck,
  });
const rejectResultCheck: Promise<KnowledgeReviewItemActionResult> =
  rejectKnowledgeReviewItem(browserClient, {
    knowledgeItemId: queueItemCheck.id,
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
    knowledgeItemId: followupQueueItemCheck.id,
    actions: [historyItemCheck],
  },
  historyKnowledgeItemId: followupQueueItemCheck.id,
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
  historyKnowledgeItemId: null,
};

const failedActionResultShapeCheck: KnowledgeReviewItemActionResult = {
  status: "error",
  reviewNote: "keep note for retry",
  error: new Error("network failed"),
};

void knowledgeWorkbenchController.loadDesk({});
void knowledgeWorkbenchController.loadHistory({
  knowledgeItemId: queueItemCheck.id,
});
void knowledgeWorkbenchController.approveItem({
  knowledgeItemId: queueItemCheck.id,
  actorRole: "knowledge_reviewer",
  reviewNote: "Approved after guideline cross-check.",
});
void knowledgeWorkbenchController.rejectItem({
  knowledgeItemId: queueItemCheck.id,
  actorRole: "knowledge_reviewer",
  reviewNote: "Rejected until stronger evidence is attached.",
});

export {
  approveResultCheck,
  browserClient,
  deskLoadResultCheck,
  historyItemCheck,
  historyLoadResultCheck,
  knowledgeWorkbenchController,
  queueItemCheck,
  rejectResultCheck,
  successFlowSeedStateCheck,
  successResultShapeCheck,
  emptyDeskSuccessResultShapeCheck,
  failedActionResultShapeCheck,
};
