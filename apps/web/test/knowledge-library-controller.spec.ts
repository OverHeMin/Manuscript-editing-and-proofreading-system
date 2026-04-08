import assert from "node:assert/strict";
import test from "node:test";
import {
  createKnowledgeLibraryWorkbenchController,
} from "../src/features/knowledge-library/knowledge-library-controller.ts";

test("knowledge library controller loads the authoring list and selected revision detail", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createKnowledgeLibraryWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.url === "/api/v1/knowledge/library") {
        return {
          status: 200,
          body: [
            {
              id: "knowledge-1",
              title: "Primary endpoint rule",
              canonical_text: "Clinical studies must define the primary endpoint.",
              summary: "Bind screening knowledge to the endpoint check.",
              knowledge_kind: "rule",
              status: "draft",
              routing: {
                module_scope: "screening",
                manuscript_types: ["clinical_study"],
                sections: ["methods"],
              },
              template_bindings: ["template-screening-1"],
            },
          ] as TResponse,
        };
      }

      if (
        input.url ===
        "/api/v1/knowledge/assets/knowledge-1?revisionId=knowledge-1-revision-2"
      ) {
        return {
          status: 200,
          body: {
            asset: {
              id: "knowledge-1",
              status: "active",
              current_revision_id: "knowledge-1-revision-2",
              current_approved_revision_id: "knowledge-1-revision-1",
              created_at: "2026-04-08T08:00:00.000Z",
              updated_at: "2026-04-08T08:30:00.000Z",
            },
            selected_revision: {
              id: "knowledge-1-revision-2",
              asset_id: "knowledge-1",
              revision_no: 2,
              status: "draft",
              title: "Primary endpoint rule draft",
              canonical_text:
                "Clinical studies must define the primary endpoint before screening sign-off.",
              summary: "Draft revision for screening workflow.",
              knowledge_kind: "rule",
              routing: {
                module_scope: "screening",
                manuscript_types: ["clinical_study"],
                sections: ["methods"],
              },
              evidence_level: "high",
              source_type: "guideline",
              source_link: "https://example.test/guideline",
              aliases: ["endpoint"],
              effective_at: "2026-04-08T00:00:00.000Z",
              bindings: [
                {
                  id: "knowledge-1-revision-2-binding-1",
                  revision_id: "knowledge-1-revision-2",
                  binding_kind: "module_template",
                  binding_target_id: "template-screening-1",
                  binding_target_label: "Screening Template",
                  created_at: "2026-04-08T08:30:00.000Z",
                },
              ],
              created_at: "2026-04-08T08:30:00.000Z",
              updated_at: "2026-04-08T08:30:00.000Z",
            },
            current_approved_revision: {
              id: "knowledge-1-revision-1",
              asset_id: "knowledge-1",
              revision_no: 1,
              status: "approved",
              title: "Primary endpoint rule",
              canonical_text: "Clinical studies must define the primary endpoint.",
              knowledge_kind: "rule",
              routing: {
                module_scope: "screening",
                manuscript_types: ["clinical_study"],
              },
              bindings: [],
              created_at: "2026-04-08T08:00:00.000Z",
              updated_at: "2026-04-08T08:10:00.000Z",
            },
            revisions: [],
          } as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const result = await controller.loadWorkbench({
    selectedAssetId: "knowledge-1",
    selectedRevisionId: "knowledge-1-revision-2",
  });

  assert.equal(result.library.length, 1);
  assert.equal(result.selectedAssetId, "knowledge-1");
  assert.equal(result.selectedRevisionId, "knowledge-1-revision-2");
  assert.equal(result.selectedSummary?.title, "Primary endpoint rule");
  assert.equal(result.detail?.selected_revision.id, "knowledge-1-revision-2");
  assert.equal(
    result.detail?.current_approved_revision?.id,
    "knowledge-1-revision-1",
  );
  assert.equal(
    result.detail?.selected_revision.bindings[0]?.binding_target_label,
    "Screening Template",
  );
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "GET /api/v1/knowledge/library",
      "GET /api/v1/knowledge/assets/knowledge-1?revisionId=knowledge-1-revision-2",
    ],
  );
});

test("knowledge library controller can create, update, derive, and submit a draft revision", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createKnowledgeLibraryWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.url === "/api/v1/knowledge/assets/drafts") {
        return {
          status: 201,
          body: createKnowledgeAssetDetail({
            assetId: "knowledge-1",
            revisionId: "knowledge-1-revision-1",
            revisionNo: 1,
            status: "draft",
            title: "Knowledge draft",
          }) as TResponse,
        };
      }

      if (input.url === "/api/v1/knowledge/revisions/knowledge-1-revision-1/draft") {
        return {
          status: 200,
          body: createKnowledgeAssetDetail({
            assetId: "knowledge-1",
            revisionId: "knowledge-1-revision-1",
            revisionNo: 1,
            status: "draft",
            title: "Knowledge draft updated",
          }) as TResponse,
        };
      }

      if (input.url === "/api/v1/knowledge/revisions/knowledge-1-revision-1/submit") {
        return {
          status: 200,
          body: createKnowledgeAssetDetail({
            assetId: "knowledge-1",
            revisionId: "knowledge-1-revision-1",
            revisionNo: 1,
            status: "pending_review",
            title: "Knowledge draft updated",
          }) as TResponse,
        };
      }

      if (input.url === "/api/v1/knowledge/assets/knowledge-1/revisions") {
        return {
          status: 201,
          body: createKnowledgeAssetDetail({
            assetId: "knowledge-1",
            revisionId: "knowledge-1-revision-2",
            revisionNo: 2,
            status: "draft",
            title: "Knowledge draft updated",
            approvedRevisionId: "knowledge-1-revision-1",
          }) as TResponse,
        };
      }

      if (input.url === "/api/v1/knowledge/library") {
        return {
          status: 200,
          body: [
            {
              id: "knowledge-1",
              title: "Knowledge draft updated",
              canonical_text: "Use consistent terminology.",
              knowledge_kind: "reference",
              status: "draft",
              routing: {
                module_scope: "editing",
                manuscript_types: ["review"],
              },
              template_bindings: ["template-editing-1"],
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/knowledge/assets/knowledge-1?revisionId=knowledge-1-revision-1") {
        return {
          status: 200,
          body: createKnowledgeAssetDetail({
            assetId: "knowledge-1",
            revisionId: "knowledge-1-revision-1",
            revisionNo: 1,
            status: "pending_review",
            title: "Knowledge draft updated",
          }) as TResponse,
        };
      }

      if (input.url === "/api/v1/knowledge/assets/knowledge-1?revisionId=knowledge-1-revision-2") {
        return {
          status: 200,
          body: createKnowledgeAssetDetail({
            assetId: "knowledge-1",
            revisionId: "knowledge-1-revision-2",
            revisionNo: 2,
            status: "draft",
            title: "Knowledge draft updated",
            approvedRevisionId: "knowledge-1-revision-1",
          }) as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const created = await controller.createDraftAndLoad({
    title: "Knowledge draft",
    canonicalText: "Use consistent terminology.",
    knowledgeKind: "reference",
    moduleScope: "editing",
    manuscriptTypes: ["review"],
    bindings: [
      {
        bindingKind: "module_template",
        bindingTargetId: "template-editing-1",
        bindingTargetLabel: "Editing Template",
      },
    ],
  });
  const updated = await controller.saveDraftAndLoad({
    revisionId: "knowledge-1-revision-1",
    input: {
      title: "Knowledge draft updated",
      bindings: [
        {
          bindingKind: "module_template",
          bindingTargetId: "template-editing-1",
          bindingTargetLabel: "Editing Template",
        },
      ],
    },
  });
  const submitted = await controller.submitDraftAndLoad({
    revisionId: "knowledge-1-revision-1",
  });
  const derived = await controller.createDerivedDraftAndLoad({
    assetId: "knowledge-1",
  });

  assert.equal(created.selectedRevisionId, "knowledge-1-revision-1");
  assert.equal(updated.detail?.selected_revision.title, "Knowledge draft updated");
  assert.equal(submitted.detail?.selected_revision.status, "pending_review");
  assert.equal(derived.selectedRevisionId, "knowledge-1-revision-2");
  assert.equal(derived.detail?.current_approved_revision?.id, "knowledge-1-revision-1");
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "POST /api/v1/knowledge/assets/drafts",
      "GET /api/v1/knowledge/library",
      "GET /api/v1/knowledge/assets/knowledge-1?revisionId=knowledge-1-revision-1",
      "POST /api/v1/knowledge/revisions/knowledge-1-revision-1/draft",
      "GET /api/v1/knowledge/library",
      "GET /api/v1/knowledge/assets/knowledge-1?revisionId=knowledge-1-revision-1",
      "POST /api/v1/knowledge/revisions/knowledge-1-revision-1/submit",
      "GET /api/v1/knowledge/library",
      "GET /api/v1/knowledge/assets/knowledge-1?revisionId=knowledge-1-revision-1",
      "POST /api/v1/knowledge/assets/knowledge-1/revisions",
      "GET /api/v1/knowledge/library",
      "GET /api/v1/knowledge/assets/knowledge-1?revisionId=knowledge-1-revision-2",
    ],
  );
});

function createKnowledgeAssetDetail(input: {
  assetId: string;
  revisionId: string;
  revisionNo: number;
  status: "draft" | "pending_review" | "approved";
  title: string;
  approvedRevisionId?: string;
}) {
  return {
    asset: {
      id: input.assetId,
      status: "active",
      current_revision_id: input.revisionId,
      current_approved_revision_id: input.approvedRevisionId,
      created_at: "2026-04-08T08:00:00.000Z",
      updated_at: "2026-04-08T08:40:00.000Z",
    },
    selected_revision: {
      id: input.revisionId,
      asset_id: input.assetId,
      revision_no: input.revisionNo,
      status: input.status,
      title: input.title,
      canonical_text: "Use consistent terminology.",
      knowledge_kind: "reference",
      routing: {
        module_scope: "editing",
        manuscript_types: ["review"],
      },
      bindings: [
        {
          id: `${input.revisionId}-binding-1`,
          revision_id: input.revisionId,
          binding_kind: "module_template",
          binding_target_id: "template-editing-1",
          binding_target_label: "Editing Template",
          created_at: "2026-04-08T08:40:00.000Z",
        },
      ],
      created_at: "2026-04-08T08:40:00.000Z",
      updated_at: "2026-04-08T08:40:00.000Z",
    },
    current_approved_revision: input.approvedRevisionId
      ? {
          id: input.approvedRevisionId,
          asset_id: input.assetId,
          revision_no: 1,
          status: "approved",
          title: "Knowledge draft updated",
          canonical_text: "Use consistent terminology.",
          knowledge_kind: "reference",
          routing: {
            module_scope: "editing",
            manuscript_types: ["review"],
          },
          bindings: [],
          created_at: "2026-04-08T08:10:00.000Z",
          updated_at: "2026-04-08T08:20:00.000Z",
        }
      : undefined,
    revisions: [],
  };
}
