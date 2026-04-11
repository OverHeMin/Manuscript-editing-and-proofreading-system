import test from "node:test";
import assert from "node:assert/strict";
import {
  InMemoryKnowledgeRepository,
  InMemoryKnowledgeReviewActionRepository,
} from "../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import { KnowledgeService } from "../../src/modules/knowledge/knowledge-service.ts";

function createKnowledgeSemanticHarness() {
  const repository = new InMemoryKnowledgeRepository();
  const reviewActionRepository = new InMemoryKnowledgeReviewActionRepository();
  let nextAssetNo = 1;

  const service = new KnowledgeService({
    repository,
    reviewActionRepository,
    createId: () => `asset-${nextAssetNo++}`,
    now: () => new Date("2026-04-11T09:00:00.000Z"),
  });

  return {
    repository,
    reviewActionRepository,
    service,
  };
}

test("regenerating and confirming a semantic layer persists revision detail", async () => {
  const { service } = createKnowledgeSemanticHarness();

  const created = await service.createLibraryDraft({
    title: "Primary endpoint rule",
    canonicalText: "Clinical studies must disclose the primary endpoint.",
    knowledgeKind: "rule",
    moduleScope: "screening",
    manuscriptTypes: ["clinical_study"],
  });

  const regenerated = await service.regenerateSemanticLayer(
    created.selected_revision.id,
    {
      pageSummary: "AI extracted a screening rule for primary endpoint disclosure.",
      retrievalTerms: ["primary endpoint", "methods"],
      retrievalSnippets: ["Use this rule to inspect methods and endpoints."],
      tableSemantics: {
        tables: [{ tableId: "table-1", role: "baseline_characteristics" }],
      },
      imageUnderstanding: {
        images: [{ imageId: "figure-1", summary: "Flow diagram of enrollment." }],
      },
    },
  );

  assert.equal(regenerated.semantic_layer?.status, "pending_confirmation");
  assert.equal(
    regenerated.semantic_layer?.page_summary,
    "AI extracted a screening rule for primary endpoint disclosure.",
  );
  assert.deepEqual(regenerated.semantic_layer?.retrieval_terms, [
    "primary endpoint",
    "methods",
  ]);

  const confirmed = await service.confirmSemanticLayer(created.selected_revision.id, {
    pageSummary: "Operator confirmed the primary-endpoint screening rule.",
    retrievalTerms: ["primary endpoint", "operator-confirmed"],
    retrievalSnippets: ["Prioritize this rule during screening."],
  });

  assert.equal(confirmed.semantic_layer?.status, "confirmed");
  assert.equal(
    confirmed.semantic_layer?.page_summary,
    "Operator confirmed the primary-endpoint screening rule.",
  );
  assert.deepEqual(confirmed.semantic_layer?.retrieval_terms, [
    "primary endpoint",
    "operator-confirmed",
  ]);

  const detail = await service.getKnowledgeAsset(
    created.asset.id,
    created.selected_revision.id,
  );
  assert.equal(detail.selected_revision.semantic_layer?.status, "confirmed");
  assert.equal(
    detail.selected_revision.semantic_layer?.page_summary,
    "Operator confirmed the primary-endpoint screening rule.",
  );
});

test("replacing revision content blocks marks a confirmed semantic layer stale", async () => {
  const { service } = createKnowledgeSemanticHarness();

  const created = await service.createLibraryDraft({
    title: "Image and table aware rule",
    canonicalText: "Capture tables and figures as structured review evidence.",
    knowledgeKind: "reference",
    moduleScope: "editing",
    manuscriptTypes: ["review"],
  });

  await service.regenerateSemanticLayer(created.selected_revision.id, {
    pageSummary: "AI generated an initial semantic layer.",
    retrievalTerms: ["table", "figure"],
    retrievalSnippets: ["Use structured blocks for rich review evidence."],
  });
  await service.confirmSemanticLayer(created.selected_revision.id);

  const revisionDetail = await service.replaceRevisionContentBlocks(
    created.selected_revision.id,
    {
      blocks: [
        {
          blockType: "text_block",
          orderNo: 1,
          contentPayload: {
            text: "This knowledge entry combines narrative, tables, and figures.",
          },
        },
        {
          blockType: "table_block",
          orderNo: 2,
          contentPayload: {
            rows: [
              ["Section", "Requirement"],
              ["Methods", "Describe dose adjustments"],
            ],
          },
          tableSemantics: {
            tableId: "table-1",
            meaning: "section_requirement_matrix",
          },
        },
        {
          blockType: "image_block",
          orderNo: 3,
          contentPayload: {
            imageAssetId: "knowledge-image-1",
          },
          imageUnderstanding: {
            imageId: "knowledge-image-1",
            summary: "Study flow diagram.",
          },
        },
      ],
    },
  );

  assert.equal(revisionDetail.semantic_layer?.status, "stale");
  assert.deepEqual(
    revisionDetail.content_blocks.map((block) => ({
      block_type: block.block_type,
      order_no: block.order_no,
      content_payload: block.content_payload,
      table_semantics: block.table_semantics,
      image_understanding: block.image_understanding,
    })),
    [
      {
        block_type: "text_block",
        order_no: 1,
        content_payload: {
          text: "This knowledge entry combines narrative, tables, and figures.",
        },
        table_semantics: undefined,
        image_understanding: undefined,
      },
      {
        block_type: "table_block",
        order_no: 2,
        content_payload: {
          rows: [
            ["Section", "Requirement"],
            ["Methods", "Describe dose adjustments"],
          ],
        },
        table_semantics: {
          tableId: "table-1",
          meaning: "section_requirement_matrix",
        },
        image_understanding: undefined,
      },
      {
        block_type: "image_block",
        order_no: 3,
        content_payload: {
          imageAssetId: "knowledge-image-1",
        },
        table_semantics: undefined,
        image_understanding: {
          imageId: "knowledge-image-1",
          summary: "Study flow diagram.",
        },
      },
    ],
  );

  const detail = await service.getKnowledgeAsset(
    created.asset.id,
    created.selected_revision.id,
  );
  assert.equal(detail.selected_revision.semantic_layer?.status, "stale");
  assert.equal(detail.selected_revision.content_blocks.length, 3);
  assert.equal(detail.selected_revision.content_blocks[1]?.block_type, "table_block");
});
