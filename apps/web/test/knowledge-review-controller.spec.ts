import assert from "node:assert/strict";
import test from "node:test";
import {
  createKnowledgeReviewWorkbenchController,
} from "../src/features/knowledge-review/workbench-controller.ts";
import {
  createKnowledgeReviewWorkbenchState,
} from "../src/features/knowledge-review/workbench-state.ts";

test("knowledge review controller enriches the queue with asset and revision identity", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createKnowledgeReviewWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.url === "/api/v1/knowledge/review-queue") {
        return {
          status: 200,
          body: [
            {
              id: "knowledge-1",
              title: "Case report privacy guardrail",
              canonical_text: "Mask all identifiable patient details.",
              knowledge_kind: "checklist",
              status: "pending_review",
              routing: {
                module_scope: "proofreading",
                manuscript_types: ["case_report"],
              },
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/knowledge/assets/knowledge-1") {
        return {
          status: 200,
          body: {
            asset: {
              id: "knowledge-1",
              status: "active",
              current_revision_id: "knowledge-1-revision-2",
              current_approved_revision_id: "knowledge-1-revision-1",
              created_at: "2026-04-08T08:00:00.000Z",
              updated_at: "2026-04-08T08:20:00.000Z",
            },
            selected_revision: {
              id: "knowledge-1-revision-2",
              asset_id: "knowledge-1",
              revision_no: 2,
              status: "pending_review",
              title: "Case report privacy guardrail",
              canonical_text: "Mask all identifiable patient details.",
              summary: "Pending review revision",
              knowledge_kind: "checklist",
              routing: {
                module_scope: "proofreading",
                manuscript_types: ["case_report"],
              },
              evidence_level: "high",
              source_type: "guideline",
              bindings: [
                {
                  id: "knowledge-1-revision-2-binding-1",
                  revision_id: "knowledge-1-revision-2",
                  binding_kind: "module_template",
                  binding_target_id: "template-proofreading-1",
                  binding_target_label: "Proofreading Template",
                  created_at: "2026-04-08T08:20:00.000Z",
                },
              ],
              created_at: "2026-04-08T08:20:00.000Z",
              updated_at: "2026-04-08T08:20:00.000Z",
            },
            revisions: [],
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/knowledge/revisions/knowledge-1-revision-2/review-actions") {
        return {
          status: 200,
          body: [
            {
              id: "history-1",
              knowledge_item_id: "knowledge-1",
              revision_id: "knowledge-1-revision-2",
              action: "submitted_for_review",
              actor_role: "knowledge_reviewer",
              created_at: "2026-04-08T08:20:00.000Z",
            },
          ] as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const desk = await controller.loadDesk({
    activeItemId: "knowledge-1-revision-2",
  });
  const history = await controller.loadHistory({
    revisionId: "knowledge-1-revision-2",
  });

  assert.equal(desk.selectedItem?.id, "knowledge-1-revision-2");
  assert.equal(desk.selectedItem?.asset_id, "knowledge-1");
  assert.equal(desk.selectedItem?.revision_id, "knowledge-1-revision-2");
  assert.equal(history.revisionId, "knowledge-1-revision-2");
  assert.equal(history.actions[0]?.revision_id, "knowledge-1-revision-2");
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "GET /api/v1/knowledge/review-queue",
      "GET /api/v1/knowledge/assets/knowledge-1",
      "GET /api/v1/knowledge/revisions/knowledge-1-revision-2/review-actions",
    ],
  );
});

test("knowledge review controller approves by revision id and advances to the next pending revision", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const queuePasses = [
    [
      {
        id: "knowledge-1",
        title: "Case report privacy guardrail",
        canonical_text: "Mask all identifiable patient details.",
        knowledge_kind: "checklist",
        status: "pending_review",
        routing: {
          module_scope: "proofreading",
          manuscript_types: ["case_report"],
        },
      },
      {
        id: "knowledge-2",
        title: "Terminology consistency guardrail",
        canonical_text: "Use consistent terminology in trial summaries.",
        knowledge_kind: "rule",
        status: "pending_review",
        routing: {
          module_scope: "editing",
          manuscript_types: ["clinical_study"],
        },
      },
    ],
    [
      {
        id: "knowledge-2",
        title: "Terminology consistency guardrail",
        canonical_text: "Use consistent terminology in trial summaries.",
        knowledge_kind: "rule",
        status: "pending_review",
        routing: {
          module_scope: "editing",
          manuscript_types: ["clinical_study"],
        },
      },
    ],
  ];

  const controller = createKnowledgeReviewWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.url === "/api/v1/knowledge/review-queue") {
        return {
          status: 200,
          body: queuePasses.shift() as TResponse,
        };
      }

      if (input.url === "/api/v1/knowledge/assets/knowledge-1") {
        return {
          status: 200,
          body: buildReviewDetail({
            assetId: "knowledge-1",
            revisionId: "knowledge-1-revision-2",
            status: "pending_review",
            title: "Case report privacy guardrail",
            moduleScope: "proofreading",
            manuscriptTypes: ["case_report"],
          }) as TResponse,
        };
      }

      if (input.url === "/api/v1/knowledge/assets/knowledge-2") {
        return {
          status: 200,
          body: buildReviewDetail({
            assetId: "knowledge-2",
            revisionId: "knowledge-2-revision-1",
            status: "pending_review",
            title: "Terminology consistency guardrail",
            moduleScope: "editing",
            manuscriptTypes: ["clinical_study"],
          }) as TResponse,
        };
      }

      if (input.url === "/api/v1/knowledge/revisions/knowledge-1-revision-2/approve") {
        return {
          status: 200,
          body: buildReviewDetail({
            assetId: "knowledge-1",
            revisionId: "knowledge-1-revision-2",
            status: "approved",
            title: "Case report privacy guardrail",
            moduleScope: "proofreading",
            manuscriptTypes: ["case_report"],
          }) as TResponse,
        };
      }

      if (input.url === "/api/v1/knowledge/revisions/knowledge-2-revision-1/review-actions") {
        return {
          status: 200,
          body: [
            {
              id: "history-2",
              knowledge_item_id: "knowledge-2",
              revision_id: "knowledge-2-revision-1",
              action: "submitted_for_review",
              actor_role: "knowledge_reviewer",
              created_at: "2026-04-08T08:25:00.000Z",
            },
          ] as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const seedDesk = await controller.loadDesk({
    activeItemId: "knowledge-1-revision-2",
  });
  const result = await controller.approveItem({
    revisionId: "knowledge-1-revision-2",
    actorRole: "knowledge_reviewer",
    reviewNote: "Approved after revision review.",
    state: createKnowledgeReviewWorkbenchState({
      queue: seedDesk.queue,
      activeItemId: seedDesk.selectedItem?.id ?? null,
    }),
  });

  assert.equal(result.status, "success");
  if (result.status !== "success") {
    return;
  }

  assert.equal(result.desk.selectedItem?.id, "knowledge-2-revision-1");
  assert.equal(result.desk.selectedItem?.asset_id, "knowledge-2");
  assert.equal(result.historyRevisionId, "knowledge-2-revision-1");
  assert.equal(result.history?.revisionId, "knowledge-2-revision-1");
  assert.equal(
    requests.some(
      (request) =>
        request.method === "POST" &&
        request.url === "/api/v1/knowledge/revisions/knowledge-1-revision-2/approve",
    ),
    true,
  );
});

function buildReviewDetail(input: {
  assetId: string;
  revisionId: string;
  status: "pending_review" | "approved";
  title: string;
  moduleScope: "editing" | "proofreading";
  manuscriptTypes: string[];
}) {
  return {
    asset: {
      id: input.assetId,
      status: "active",
      current_revision_id: input.revisionId,
      current_approved_revision_id:
        input.status === "approved" ? input.revisionId : undefined,
      created_at: "2026-04-08T08:00:00.000Z",
      updated_at: "2026-04-08T08:30:00.000Z",
    },
    selected_revision: {
      id: input.revisionId,
      asset_id: input.assetId,
      revision_no: 1,
      status: input.status,
      title: input.title,
      canonical_text: input.title,
      knowledge_kind: "rule",
      routing: {
        module_scope: input.moduleScope,
        manuscript_types: input.manuscriptTypes,
      },
      bindings: [],
      created_at: "2026-04-08T08:30:00.000Z",
      updated_at: "2026-04-08T08:30:00.000Z",
    },
    revisions: [],
  };
}
