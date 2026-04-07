import {
  approveKnowledgeItem,
  listKnowledgeReviewActions,
  listPendingKnowledgeReviewItems,
  rejectKnowledgeItem,
  type KnowledgeReviewActionViewModel,
  type KnowledgeReviewQueueItemViewModel,
} from "./knowledge/index.ts";
import {
  buildAuthSessionViewModel,
  listWorkbenchesForRole,
  type WorkbenchEntry,
  type WorkbenchId,
  type WorkbenchSurface,
} from "./auth/index.ts";

const workbenchIdCheck: WorkbenchId = "evaluation-workbench";
const workbenchSurfaceCheck: WorkbenchSurface = "mini_program";

const knowledgeQueueItemCheck: KnowledgeReviewQueueItemViewModel = {
  id: "knowledge-1",
  title: "Case report privacy checklist",
  canonical_text: "Remove patient identifiers before publishing the report.",
  knowledge_kind: "checklist",
  status: "pending_review",
  routing: {
    module_scope: "proofreading",
    manuscript_types: ["case_report"],
    risk_tags: ["privacy"],
  },
  evidence_level: "high",
  source_type: "guideline",
  template_bindings: ["case-report-proofreading-core"],
};

const knowledgeReviewActionCheck: KnowledgeReviewActionViewModel = {
  id: "review-action-1",
  knowledge_item_id: "knowledge-1",
  action: "rejected",
  actor_role: "knowledge_reviewer",
  review_note: "Please add the exact de-identification rule citation.",
  created_at: "2026-03-28T21:00:00.000Z",
};

const adminWorkbenchEntryCheck: WorkbenchEntry = {
  id: workbenchIdCheck,
  label: "Evaluation Workbench",
  navLabel: "评测工作台",
  navGroup: "governance",
  placement: "admin",
  surfaces: ["web"],
  roles: ["admin"],
};

const knowledgeReviewerEntries = listWorkbenchesForRole(
  "knowledge_reviewer",
  workbenchSurfaceCheck,
);
const adminSession = buildAuthSessionViewModel({
  userId: "admin-1",
  username: "admin",
  displayName: "System Admin",
  role: "admin",
});

const knowledgeClient = {
  async request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }) {
    void input;
    return {
      status: 200,
      body: undefined as TResponse,
    };
  },
};

void listPendingKnowledgeReviewItems(knowledgeClient);
void listKnowledgeReviewActions(knowledgeClient, "knowledge-1");
void approveKnowledgeItem(
  knowledgeClient,
  "knowledge-1",
  "knowledge_reviewer",
  "Looks good for publishing.",
);
void rejectKnowledgeItem(
  knowledgeClient,
  "knowledge-1",
  "knowledge_reviewer",
  knowledgeReviewActionCheck.review_note,
);

export {
  adminSession,
  adminWorkbenchEntryCheck,
  knowledgeQueueItemCheck,
  knowledgeReviewActionCheck,
  knowledgeReviewerEntries,
  workbenchIdCheck,
  workbenchSurfaceCheck,
};
