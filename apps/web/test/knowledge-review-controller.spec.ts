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

test("knowledge review controller keeps legacy queue items reviewable when no governed asset exists", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const queuePasses = [
    [
      {
        id: "knowledge-demo-1",
        title: "Clinical study endpoint rule",
        canonical_text:
          "Clinical study submissions must state the primary endpoint and analysis method.",
        summary:
          "Used by screening reviewers to verify endpoint and statistics coverage.",
        knowledge_kind: "rule",
        status: "pending_review",
        routing: {
          module_scope: "screening",
          manuscript_types: ["clinical_study"],
          sections: ["methods"],
          risk_tags: ["statistics"],
          discipline_tags: ["cardiology"],
        },
        evidence_level: "high",
        source_type: "guideline",
        source_link: "https://example.org/guideline",
        aliases: ["endpoint-statistics rule"],
        template_bindings: ["clinical-study-screening-core"],
      },
    ],
    [],
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

      if (input.url === "/api/v1/knowledge/assets/knowledge-demo-1") {
        throw createNotFoundError(input.method, input.url);
      }

      if (
        input.url === "/api/v1/knowledge/revisions/knowledge-demo-1/review-actions"
      ) {
        throw createNotFoundError(input.method, input.url);
      }

      if (input.url === "/api/v1/knowledge/knowledge-demo-1/review-actions") {
        return {
          status: 200,
          body: [
            {
              id: "knowledge-demo-action-1",
              knowledge_item_id: "knowledge-demo-1",
              action: "submitted_for_review",
              actor_role: "user",
              created_at: "2026-03-28T08:00:00.000Z",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/knowledge/revisions/knowledge-demo-1/approve") {
        throw createNotFoundError(input.method, input.url);
      }

      if (input.url === "/api/v1/knowledge/knowledge-demo-1/approve") {
        return {
          status: 200,
          body: {
            id: "knowledge-demo-1",
            title: "Clinical study endpoint rule",
            canonical_text:
              "Clinical study submissions must state the primary endpoint and analysis method.",
            summary:
              "Used by screening reviewers to verify endpoint and statistics coverage.",
            knowledge_kind: "rule",
            status: "approved",
            routing: {
              module_scope: "screening",
              manuscript_types: ["clinical_study"],
              sections: ["methods"],
              risk_tags: ["statistics"],
              discipline_tags: ["cardiology"],
            },
            evidence_level: "high",
            source_type: "guideline",
            source_link: "https://example.org/guideline",
            aliases: ["endpoint-statistics rule"],
            template_bindings: ["clinical-study-screening-core"],
          } as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const desk = await controller.loadDesk({
    activeItemId: "knowledge-demo-1",
  });
  const history = await controller.loadHistory({
    revisionId: "knowledge-demo-1",
  });
  const result = await controller.approveItem({
    revisionId: "knowledge-demo-1",
    actorRole: "knowledge_reviewer",
    reviewNote: "Legacy path still works.",
    state: createKnowledgeReviewWorkbenchState({
      queue: desk.queue,
      activeItemId: desk.selectedItem?.id ?? null,
    }),
  });

  assert.equal(desk.selectedItem?.id, "knowledge-demo-1");
  assert.equal(desk.selectedItem?.asset_id, "knowledge-demo-1");
  assert.equal(desk.selectedItem?.revision_id, "knowledge-demo-1");
  assert.equal(history.actions[0]?.knowledge_item_id, "knowledge-demo-1");
  assert.equal(result.status, "success");
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "GET /api/v1/knowledge/review-queue",
      "GET /api/v1/knowledge/assets/knowledge-demo-1",
      "GET /api/v1/knowledge/revisions/knowledge-demo-1/review-actions",
      "GET /api/v1/knowledge/knowledge-demo-1/review-actions",
      "POST /api/v1/knowledge/revisions/knowledge-demo-1/approve",
      "POST /api/v1/knowledge/knowledge-demo-1/approve",
      "GET /api/v1/knowledge/review-queue",
    ],
  );
});

test("knowledge review controller accepts an asset id as the prefilled active item", async () => {
  const controller = createKnowledgeReviewWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      if (input.url === "/api/v1/knowledge/review-queue") {
        return {
          status: 200,
          body: [
            {
              id: "knowledge-asset-2",
              title: "Secondary governed asset",
              canonical_text: "Secondary governed asset",
              knowledge_kind: "rule",
              status: "pending_review",
              routing: {
                module_scope: "editing",
                manuscript_types: ["clinical_study"],
              },
            },
            {
              id: "knowledge-asset-1",
              title: "Primary governed asset",
              canonical_text: "Primary governed asset",
              knowledge_kind: "rule",
              status: "pending_review",
              routing: {
                module_scope: "editing",
                manuscript_types: ["clinical_study"],
              },
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/knowledge/assets/knowledge-asset-1") {
        return {
          status: 200,
          body: buildReviewDetail({
            assetId: "knowledge-asset-1",
            revisionId: "knowledge-asset-1-revision-2",
            status: "pending_review",
            title: "Primary governed asset",
            moduleScope: "editing",
            manuscriptTypes: ["clinical_study"],
          }) as TResponse,
        };
      }

      if (input.url === "/api/v1/knowledge/assets/knowledge-asset-2") {
        return {
          status: 200,
          body: buildReviewDetail({
            assetId: "knowledge-asset-2",
            revisionId: "knowledge-asset-2-revision-1",
            status: "pending_review",
            title: "Secondary governed asset",
            moduleScope: "editing",
            manuscriptTypes: ["clinical_study"],
          }) as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const desk = await controller.loadDesk({
    activeItemId: "knowledge-asset-1",
  });

  assert.equal(desk.selectedItem?.id, "knowledge-asset-1-revision-2");
  assert.equal(desk.selectedItem?.asset_id, "knowledge-asset-1");
  assert.equal(desk.selectedItem?.revision_id, "knowledge-asset-1-revision-2");
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

test("knowledge review controller rejects by revision id and advances to the next pending revision", async () => {
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

      if (input.url === "/api/v1/knowledge/revisions/knowledge-1-revision-2/reject") {
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
  const result = await controller.rejectItem({
    revisionId: "knowledge-1-revision-2",
    actorRole: "knowledge_reviewer",
    reviewNote: "Need stronger source coverage.",
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
        request.url === "/api/v1/knowledge/revisions/knowledge-1-revision-2/reject",
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

function createNotFoundError(method: "GET" | "POST", url: string) {
  return Object.assign(new Error(`HTTP 404 ${method} ${url}`), {
    status: 404,
  });
}
