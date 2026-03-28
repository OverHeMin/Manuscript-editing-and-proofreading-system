import { createBrowserHttpClient } from "../../lib/browser-http-client.ts";
import type {
  KnowledgeReviewActionViewModel,
  KnowledgeReviewQueueItemViewModel,
} from "../knowledge/index.ts";
import {
  approveKnowledgeReviewItem,
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
  });
const rejectResultCheck: Promise<KnowledgeReviewItemActionResult> =
  rejectKnowledgeReviewItem(browserClient, {
    knowledgeItemId: queueItemCheck.id,
    actorRole: "knowledge_reviewer",
    reviewNote: "Need direct citation for the recommendation.",
  });

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
};
