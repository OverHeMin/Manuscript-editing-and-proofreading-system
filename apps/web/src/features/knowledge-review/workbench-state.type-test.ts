import type { KnowledgeReviewQueueItemViewModel } from "../knowledge/index.ts";
import {
  applyKnowledgeReviewSuccess,
  applyKnowledgeReviewFilters,
  createKnowledgeReviewWorkbenchState,
  isKnowledgeReviewFilterResultEmpty,
  isKnowledgeReviewQueueTrulyEmpty,
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

const thirdQueueItem: KnowledgeReviewQueueItemViewModel = {
  id: "knowledge-3",
  title: "Section ordering for methodology papers",
  canonical_text: "Present methods before results and discussion.",
  knowledge_kind: "rule",
  status: "pending_review",
  routing: {
    module_scope: "editing",
    manuscript_types: ["methodology_paper"],
  },
  evidence_level: "high",
  source_type: "guideline",
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
  queue: [firstQueueItem, secondQueueItem, thirdQueueItem],
  activeItemId: secondQueueItem.id,
});

const filteredQueueWithSearch = applyKnowledgeReviewFilters(state.queue, filterCheck);
const activeItemBeforeReview = resolveKnowledgeReviewActiveItem(
  state.visibleQueue,
  state.activeItemId,
);
const afterReviewSuccess = applyKnowledgeReviewSuccess(state, secondQueueItem.id);
const expectedNextByPreRemovalOrder = resolveNextActiveItemAfterReviewSuccess(
  state.visibleQueue,
  afterReviewSuccess.visibleQueue,
  secondQueueItem.id,
);

const withRefreshPayload = receiveKnowledgeReviewQueueRefresh(afterReviewSuccess, {
  queue: [firstQueueItem, thirdQueueItem],
});
const resolvedView = resolveKnowledgeReviewQueueView(withRefreshPayload);
const activeItemAfterRefresh = resolveKnowledgeReviewActiveItem(
  resolvedView.visibleQueue,
  resolvedView.activeItemId,
);

const noVisibleMatchesState = createKnowledgeReviewWorkbenchState({
  queue: [firstQueueItem, secondQueueItem, thirdQueueItem],
  filters: {
    searchText: "non-existent-search-term",
  },
});
const filteredEmptyState = isKnowledgeReviewFilterResultEmpty(noVisibleMatchesState);
const trulyEmptyState = isKnowledgeReviewQueueTrulyEmpty(
  createKnowledgeReviewWorkbenchState({
    queue: [],
  }),
);

export {
  activeItemAfterRefresh,
  activeItemBeforeReview,
  afterReviewSuccess,
  expectedNextByPreRemovalOrder,
  filteredEmptyState,
  filteredQueueWithSearch,
  resolvedView,
  state,
  trulyEmptyState,
  withRefreshPayload,
};
