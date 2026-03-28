import type { KnowledgeReviewQueueItemViewModel } from "../knowledge/index.ts";
import {
  applyKnowledgeReviewFilters,
  createKnowledgeReviewWorkbenchState,
  isKnowledgeReviewWorkbenchEmpty,
  receiveKnowledgeReviewQueueRefresh,
  resolveKnowledgeReviewActiveItem,
  resolveKnowledgeReviewQueueView,
  resolveNextActiveItemAfterReviewSuccess,
  type KnowledgeReviewFilterState,
  type KnowledgeReviewWorkbenchState,
} from "./index.ts";

const firstQueueItem: KnowledgeReviewQueueItemViewModel = {
  id: "knowledge-1",
  title: "Protect patient privacy in case reports",
  canonical_text: "Remove all personally identifying details.",
  knowledge_kind: "checklist",
  status: "pending_review",
  routing: {
    module_scope: "proofreading",
    manuscript_types: ["case_report"],
    risk_tags: ["privacy"],
  },
  evidence_level: "high",
  source_type: "guideline",
};

const secondQueueItem: KnowledgeReviewQueueItemViewModel = {
  id: "knowledge-2",
  title: "Use consistent terminology in trial summaries",
  canonical_text: "Standardize names for interventions and outcomes.",
  knowledge_kind: "rule",
  status: "pending_review",
  routing: {
    module_scope: "editing",
    manuscript_types: ["clinical_study"],
  },
  evidence_level: "medium",
  source_type: "paper",
};

const filterCheck: KnowledgeReviewFilterState = {
  moduleScope: "all",
  manuscriptType: "all",
  knowledgeKind: "all",
  evidenceLevel: "all",
  sourceType: "all",
  searchText: "privacy",
};

const state: KnowledgeReviewWorkbenchState = createKnowledgeReviewWorkbenchState({
  queue: [firstQueueItem, secondQueueItem],
  activeItemId: firstQueueItem.id,
  filters: filterCheck,
});

const filteredQueue = applyKnowledgeReviewFilters(state.queue, state.filters);
const activeItem = resolveKnowledgeReviewActiveItem(filteredQueue, state.activeItemId);
const withRefresh = receiveKnowledgeReviewQueueRefresh(state, {
  queue: [secondQueueItem],
});
const resolvedView = resolveKnowledgeReviewQueueView(withRefresh);
const nextActiveId = resolveNextActiveItemAfterReviewSuccess(
  resolvedView.visibleQueue,
  secondQueueItem.id,
);
const emptyStateCheck = isKnowledgeReviewWorkbenchEmpty(resolvedView);

export {
  activeItem,
  emptyStateCheck,
  filteredQueue,
  nextActiveId,
  resolvedView,
  state,
  withRefresh,
};
