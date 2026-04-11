import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import {
  createPostgresWriteTransactionManager,
} from "../../src/modules/shared/write-transaction-manager.ts";
import { KnowledgeService } from "../../src/modules/knowledge/knowledge-service.ts";
import type { KnowledgeReviewActionRecord } from "../../src/modules/knowledge/knowledge-record.ts";
import {
  PostgresKnowledgeRepository,
  PostgresKnowledgeReviewActionRepository,
} from "../../src/modules/knowledge/postgres-knowledge-repository.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";

class FailingPostgresKnowledgeReviewActionRepository
  extends PostgresKnowledgeReviewActionRepository
{
  constructor(
    dependencies: { client: Client },
    private readonly shouldFail: (record: KnowledgeReviewActionRecord) => boolean,
  ) {
    super(dependencies);
  }

  override async save(record: KnowledgeReviewActionRecord): Promise<void> {
    if (this.shouldFail(record)) {
      throw new Error(`Injected review action write failure for ${record.action}.`);
    }

    await super.save(record);
  }
}

test("postgres knowledge repositories persist routing arrays, any scope, and provenance", async () => {
  await withMigratedKnowledgeClient(async (client) => {
    await seedLearningCandidate(client, "11111111-1111-1111-1111-111111111111");
    const repository = new PostgresKnowledgeRepository({ client });

    await repository.save({
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      title: "Persistent knowledge draft",
      canonical_text: "Clinical studies must disclose the primary endpoint.",
      knowledge_kind: "rule",
      status: "draft",
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
      aliases: ["endpoint rule"],
      template_bindings: ["clinical-study-screening-core"],
      source_learning_candidate_id: "11111111-1111-1111-1111-111111111111",
    });
    await repository.save({
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      title: "Any-scope privacy checklist",
      canonical_text: "Case report patient identifiers must be removed.",
      knowledge_kind: "checklist",
      status: "pending_review",
      routing: {
        module_scope: "any",
        manuscript_types: "any",
      },
    });

    const loaded = await repository.findById("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    const pending = await repository.listByStatus("pending_review");

    assert.deepEqual(loaded, {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      title: "Persistent knowledge draft",
      canonical_text: "Clinical studies must disclose the primary endpoint.",
      knowledge_kind: "rule",
      status: "draft",
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
      aliases: ["endpoint rule"],
      template_bindings: ["clinical-study-screening-core"],
      source_learning_candidate_id: "11111111-1111-1111-1111-111111111111",
    });
    assert.deepEqual(pending, [
      {
        id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        title: "Any-scope privacy checklist",
        canonical_text: "Case report patient identifiers must be removed.",
        knowledge_kind: "checklist",
        status: "pending_review",
        routing: {
          module_scope: "any",
          manuscript_types: "any",
        },
      },
    ]);
  });
});

test("postgres knowledge review action repository returns note-aware history in created order", async () => {
  await withMigratedKnowledgeClient(async (client) => {
    const knowledgeRepository = new PostgresKnowledgeRepository({ client });
    const repository = new PostgresKnowledgeReviewActionRepository({ client });

    await knowledgeRepository.save({
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      title: "History target item",
      canonical_text: "History target text.",
      knowledge_kind: "rule",
      status: "pending_review",
      routing: {
        module_scope: "screening",
        manuscript_types: ["clinical_study"],
      },
    });

    await repository.save({
      id: "cccccccc-cccc-cccc-cccc-ccccccccccc1",
      knowledge_item_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      action: "submitted_for_review",
      actor_role: "user",
      created_at: "2026-03-30T08:00:00.000Z",
    });
    await repository.save({
      id: "cccccccc-cccc-cccc-cccc-ccccccccccc2",
      knowledge_item_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      action: "approved",
      actor_role: "knowledge_reviewer",
      review_note: "Looks good.",
      created_at: "2026-03-30T08:05:00.000Z",
    });

    const history = await repository.listByKnowledgeItemId(
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    );

    assert.deepEqual(history, [
      {
        id: "cccccccc-cccc-cccc-cccc-ccccccccccc1",
        knowledge_item_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        action: "submitted_for_review",
        actor_role: "user",
        created_at: "2026-03-30T08:00:00.000Z",
      },
      {
        id: "cccccccc-cccc-cccc-cccc-ccccccccccc2",
        knowledge_item_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        action: "approved",
        actor_role: "knowledge_reviewer",
        review_note: "Looks good.",
        created_at: "2026-03-30T08:05:00.000Z",
      },
    ]);
  });
});

test("postgres knowledge repository round-trips rich content blocks and semantic layer payloads", async () => {
  await withMigratedKnowledgeClient(async (client) => {
    const repository = new PostgresKnowledgeRepository({ client });
    const revisionId = "asset-rich-1-revision-1";

    await repository.saveAsset({
      id: "asset-rich-1",
      status: "active",
      current_revision_id: revisionId,
      created_at: "2026-04-11T09:00:00.000Z",
      updated_at: "2026-04-11T09:00:00.000Z",
    });
    await repository.saveRevision({
      id: revisionId,
      asset_id: "asset-rich-1",
      revision_no: 1,
      status: "draft",
      title: "Rich payload target",
      canonical_text: "Round-trip content blocks and semantic layer payloads.",
      knowledge_kind: "reference",
      routing: {
        module_scope: "editing",
        manuscript_types: ["review"],
      },
      created_at: "2026-04-11T09:00:00.000Z",
      updated_at: "2026-04-11T09:00:00.000Z",
    });

    await repository.replaceRevisionContentBlocks(revisionId, [
      {
        id: `${revisionId}-content-block-1`,
        revision_id: revisionId,
        block_type: "text_block",
        order_no: 1,
        status: "active",
        content_payload: {
          text: "Narrative rich-space content.",
        },
        created_at: "2026-04-11T09:00:00.000Z",
        updated_at: "2026-04-11T09:00:00.000Z",
      },
      {
        id: `${revisionId}-content-block-2`,
        revision_id: revisionId,
        block_type: "table_block",
        order_no: 2,
        status: "active",
        content_payload: {
          rows: [
            ["Check", "Result"],
            ["Primary endpoint", "Present"],
          ],
        },
        table_semantics: {
          tableId: "table-1",
          meaning: "screening_matrix",
        },
        created_at: "2026-04-11T09:00:00.000Z",
        updated_at: "2026-04-11T09:00:00.000Z",
      },
      {
        id: `${revisionId}-content-block-3`,
        revision_id: revisionId,
        block_type: "image_block",
        order_no: 3,
        status: "active",
        content_payload: {
          imageAssetId: "knowledge-image-1",
        },
        image_understanding: {
          imageId: "knowledge-image-1",
          summary: "Enrollment flowchart",
        },
        created_at: "2026-04-11T09:00:00.000Z",
        updated_at: "2026-04-11T09:00:00.000Z",
      },
    ]);
    await repository.saveSemanticLayer({
      revision_id: revisionId,
      status: "confirmed",
      page_summary: "Operator confirmed semantic payload.",
      retrieval_terms: ["primary endpoint", "flowchart"],
      retrieval_snippets: ["Use this revision during editing."],
      table_semantics: {
        tables: [{ tableId: "table-1", meaning: "screening_matrix" }],
      },
      image_understanding: {
        images: [{ imageId: "knowledge-image-1", summary: "Enrollment flowchart" }],
      },
      created_at: "2026-04-11T09:00:00.000Z",
      updated_at: "2026-04-11T09:05:00.000Z",
    });

    const blocks = await repository.listContentBlocksByRevisionId(revisionId);
    const semanticLayer = await repository.findSemanticLayerByRevisionId(revisionId);

    assert.deepEqual(blocks, [
      {
        id: `${revisionId}-content-block-1`,
        revision_id: revisionId,
        block_type: "text_block",
        order_no: 1,
        status: "active",
        content_payload: {
          text: "Narrative rich-space content.",
        },
        created_at: "2026-04-11T09:00:00.000Z",
        updated_at: "2026-04-11T09:00:00.000Z",
      },
      {
        id: `${revisionId}-content-block-2`,
        revision_id: revisionId,
        block_type: "table_block",
        order_no: 2,
        status: "active",
        content_payload: {
          rows: [
            ["Check", "Result"],
            ["Primary endpoint", "Present"],
          ],
        },
        table_semantics: {
          tableId: "table-1",
          meaning: "screening_matrix",
        },
        created_at: "2026-04-11T09:00:00.000Z",
        updated_at: "2026-04-11T09:00:00.000Z",
      },
      {
        id: `${revisionId}-content-block-3`,
        revision_id: revisionId,
        block_type: "image_block",
        order_no: 3,
        status: "active",
        content_payload: {
          imageAssetId: "knowledge-image-1",
        },
        image_understanding: {
          imageId: "knowledge-image-1",
          summary: "Enrollment flowchart",
        },
        created_at: "2026-04-11T09:00:00.000Z",
        updated_at: "2026-04-11T09:00:00.000Z",
      },
    ]);
    assert.deepEqual(semanticLayer, {
      revision_id: revisionId,
      status: "confirmed",
      page_summary: "Operator confirmed semantic payload.",
      retrieval_terms: ["primary endpoint", "flowchart"],
      retrieval_snippets: ["Use this revision during editing."],
      table_semantics: {
        tables: [{ tableId: "table-1", meaning: "screening_matrix" }],
      },
      image_understanding: {
        images: [{ imageId: "knowledge-image-1", summary: "Enrollment flowchart" }],
      },
      created_at: "2026-04-11T09:00:00.000Z",
      updated_at: "2026-04-11T09:05:00.000Z",
    });
  });
});

test("postgres knowledge service rolls back status changes when review action persistence fails", async () => {
  await withMigratedKnowledgeClient(async (client) => {
    const repository = new PostgresKnowledgeRepository({ client });

    await repository.save({
      id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
      title: "Rollback draft",
      canonical_text: "Rollback test text.",
      knowledge_kind: "rule",
      status: "draft",
      routing: {
        module_scope: "screening",
        manuscript_types: ["clinical_study"],
      },
    });

    const service = new KnowledgeService({
      repository,
      reviewActionRepository: new PostgresKnowledgeReviewActionRepository({ client }),
      transactionManager: createPostgresWriteTransactionManager({
        getClient: async () => client,
        createContext: (transactionClient) => ({
          repository: new PostgresKnowledgeRepository({
            client: transactionClient,
          }),
          reviewActionRepository: new FailingPostgresKnowledgeReviewActionRepository(
            { client: transactionClient as Client },
            (record) => record.action === "submitted_for_review",
          ),
        }),
      }),
      now: () => new Date("2026-03-30T09:00:00.000Z"),
      createId: (() => {
        const ids = ["eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"];
        return () => {
          const value = ids.shift();
          assert.ok(value, "Expected a review action id.");
          return value;
        };
      })(),
    });

    await assert.rejects(
      () => service.submitForReview("dddddddd-dddd-dddd-dddd-dddddddddddd"),
      /review action write failure/i,
    );

    const stored = await repository.findById("dddddddd-dddd-dddd-dddd-dddddddddddd");
    const reviewActions = await new PostgresKnowledgeReviewActionRepository({
      client,
    }).listByKnowledgeItemId("dddddddd-dddd-dddd-dddd-dddddddddddd");

    assert.equal(stored?.status, "draft");
    assert.deepEqual(reviewActions, []);
  });
});

test("postgres knowledge repository persists revision-governed assets and approved projections", async () => {
  await withMigratedKnowledgeClient(async (client) => {
    const repository = new PostgresKnowledgeRepository({ client });

    await repository.save({
      id: "aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb",
      title: "Legacy approved knowledge",
      canonical_text: "Legacy approved flat record remains readable.",
      knowledge_kind: "reference",
      status: "approved",
      routing: {
        module_scope: "editing",
        manuscript_types: ["review"],
      },
    });

    await repository.saveAsset({
      id: "asset-knowledge-1",
      status: "active",
      current_revision_id: "asset-knowledge-1-revision-2",
      current_approved_revision_id: "asset-knowledge-1-revision-1",
      created_at: "2026-04-08T10:00:00.000Z",
      updated_at: "2026-04-08T10:30:00.000Z",
    });
    await repository.saveRevision({
      id: "asset-knowledge-1-revision-1",
      asset_id: "asset-knowledge-1",
      revision_no: 1,
      status: "approved",
      title: "Approved knowledge revision",
      canonical_text: "Approved revision is still the runtime source.",
      knowledge_kind: "rule",
      routing: {
        module_scope: "screening",
        manuscript_types: ["clinical_study"],
        sections: ["methods"],
      },
      evidence_level: "high",
      source_type: "guideline",
      source_link: "https://example.org/revision-approved",
      aliases: ["approved revision"],
      created_at: "2026-04-08T10:00:00.000Z",
      updated_at: "2026-04-08T10:00:00.000Z",
    });
    await repository.replaceRevisionBindings("asset-knowledge-1-revision-1", [
      {
        id: "asset-knowledge-1-revision-1-binding-1",
        revision_id: "asset-knowledge-1-revision-1",
        binding_kind: "module_template",
        binding_target_id: "template-screening-core",
        binding_target_label: "Screening Core Template",
        created_at: "2026-04-08T10:00:00.000Z",
      },
    ]);
    await repository.saveRevision({
      id: "asset-knowledge-1-revision-2",
      asset_id: "asset-knowledge-1",
      revision_no: 2,
      status: "draft",
      title: "Draft knowledge revision",
      canonical_text: "Draft revision is the authoring source.",
      knowledge_kind: "rule",
      routing: {
        module_scope: "screening",
        manuscript_types: ["clinical_study"],
        sections: ["methods"],
      },
      evidence_level: "high",
      source_type: "guideline",
      source_link: "https://example.org/revision-draft",
      aliases: ["draft revision"],
      based_on_revision_id: "asset-knowledge-1-revision-1",
      created_at: "2026-04-08T10:30:00.000Z",
      updated_at: "2026-04-08T10:30:00.000Z",
    });
    await repository.replaceRevisionBindings("asset-knowledge-1-revision-2", [
      {
        id: "asset-knowledge-1-revision-2-binding-1",
        revision_id: "asset-knowledge-1-revision-2",
        binding_kind: "module_template",
        binding_target_id: "template-screening-core-v2",
        binding_target_label: "Screening Core Template V2",
        created_at: "2026-04-08T10:30:00.000Z",
      },
    ]);

    const projectedAuthoring = await repository.findById("asset-knowledge-1");
    const projectedApproved = await repository.findApprovedById("asset-knowledge-1");
    const approvedList = await repository.listApproved();
    const revisions = await repository.listRevisionsByAssetId("asset-knowledge-1");
    const bindings = await repository.listBindingsByRevisionId(
      "asset-knowledge-1-revision-2",
    );

    assert.deepEqual(projectedAuthoring, {
      id: "asset-knowledge-1",
      title: "Draft knowledge revision",
      canonical_text: "Draft revision is the authoring source.",
      knowledge_kind: "rule",
      status: "draft",
      routing: {
        module_scope: "screening",
        manuscript_types: ["clinical_study"],
        sections: ["methods"],
      },
      evidence_level: "high",
      source_type: "guideline",
      source_link: "https://example.org/revision-draft",
      aliases: ["draft revision"],
      template_bindings: ["template-screening-core-v2"],
    });
    assert.deepEqual(projectedApproved, {
      id: "asset-knowledge-1",
      title: "Approved knowledge revision",
      canonical_text: "Approved revision is still the runtime source.",
      knowledge_kind: "rule",
      status: "approved",
      routing: {
        module_scope: "screening",
        manuscript_types: ["clinical_study"],
        sections: ["methods"],
      },
      evidence_level: "high",
      source_type: "guideline",
      source_link: "https://example.org/revision-approved",
      aliases: ["approved revision"],
      template_bindings: ["template-screening-core"],
    });
    assert.deepEqual(
      approvedList.map((record) => record.id).sort(),
      ["aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb", "asset-knowledge-1"].sort(),
    );
    assert.deepEqual(
      revisions.map((record) => ({
        id: record.id,
        revision_no: record.revision_no,
        status: record.status,
        based_on_revision_id: record.based_on_revision_id,
      })),
      [
        {
          id: "asset-knowledge-1-revision-2",
          revision_no: 2,
          status: "draft",
          based_on_revision_id: "asset-knowledge-1-revision-1",
        },
        {
          id: "asset-knowledge-1-revision-1",
          revision_no: 1,
          status: "approved",
          based_on_revision_id: undefined,
        },
      ],
    );
    assert.deepEqual(bindings, [
      {
        id: "asset-knowledge-1-revision-2-binding-1",
        revision_id: "asset-knowledge-1-revision-2",
        binding_kind: "module_template",
        binding_target_id: "template-screening-core-v2",
        binding_target_label: "Screening Core Template V2",
        created_at: "2026-04-08T10:30:00.000Z",
      },
    ]);
  });
});

test("postgres approved projections ignore future and expired revisions while keeping the current runtime revision", async () => {
  await withMigratedKnowledgeClient(async (client) => {
    const repository = new PostgresKnowledgeRepository({ client });

    await repository.saveAsset({
      id: "asset-runtime-active-1",
      status: "active",
      current_revision_id: "asset-runtime-active-1-revision-1",
      current_approved_revision_id: "asset-runtime-active-1-revision-1",
      created_at: "2026-04-08T10:00:00.000Z",
      updated_at: "2026-04-08T10:00:00.000Z",
    });
    await repository.saveRevision({
      id: "asset-runtime-active-1-revision-1",
      asset_id: "asset-runtime-active-1",
      revision_no: 1,
      status: "approved",
      title: "Active runtime revision",
      canonical_text: "This revision is active right now.",
      knowledge_kind: "rule",
      routing: {
        module_scope: "screening",
        manuscript_types: ["clinical_study"],
      },
      created_at: "2026-04-08T10:00:00.000Z",
      updated_at: "2026-04-08T10:00:00.000Z",
    });

    await repository.saveAsset({
      id: "asset-runtime-future-1",
      status: "active",
      current_revision_id: "asset-runtime-future-1-revision-1",
      current_approved_revision_id: "asset-runtime-future-1-revision-1",
      created_at: "2026-04-08T10:00:00.000Z",
      updated_at: "2026-04-08T10:00:00.000Z",
    });
    await repository.saveRevision({
      id: "asset-runtime-future-1-revision-1",
      asset_id: "asset-runtime-future-1",
      revision_no: 1,
      status: "approved",
      title: "Future runtime revision",
      canonical_text: "This revision should stay inactive until its schedule opens.",
      knowledge_kind: "rule",
      routing: {
        module_scope: "screening",
        manuscript_types: ["clinical_study"],
      },
      effective_at: "2099-01-01T00:00:00.000Z",
      created_at: "2026-04-08T10:00:00.000Z",
      updated_at: "2026-04-08T10:00:00.000Z",
    });

    await repository.saveAsset({
      id: "asset-runtime-expired-1",
      status: "active",
      current_revision_id: "asset-runtime-expired-1-revision-1",
      current_approved_revision_id: "asset-runtime-expired-1-revision-1",
      created_at: "2026-04-08T10:00:00.000Z",
      updated_at: "2026-04-08T10:00:00.000Z",
    });
    await repository.saveRevision({
      id: "asset-runtime-expired-1-revision-1",
      asset_id: "asset-runtime-expired-1",
      revision_no: 1,
      status: "approved",
      title: "Expired runtime revision",
      canonical_text: "This revision should no longer be returned.",
      knowledge_kind: "rule",
      routing: {
        module_scope: "screening",
        manuscript_types: ["clinical_study"],
      },
      expires_at: "2000-01-01T00:00:00.000Z",
      created_at: "2026-04-08T10:00:00.000Z",
      updated_at: "2026-04-08T10:00:00.000Z",
    });

    await repository.saveAsset({
      id: "asset-runtime-scheduled-1",
      status: "active",
      current_revision_id: "asset-runtime-scheduled-1-revision-2",
      current_approved_revision_id: "asset-runtime-scheduled-1-revision-2",
      created_at: "2026-04-08T10:00:00.000Z",
      updated_at: "2026-04-08T10:05:00.000Z",
    });
    await repository.saveRevision({
      id: "asset-runtime-scheduled-1-revision-1",
      asset_id: "asset-runtime-scheduled-1",
      revision_no: 1,
      status: "approved",
      title: "Current runtime revision",
      canonical_text: "This revision should remain the runtime source until the schedule changes.",
      knowledge_kind: "rule",
      routing: {
        module_scope: "screening",
        manuscript_types: ["clinical_study"],
      },
      created_at: "2026-04-08T10:00:00.000Z",
      updated_at: "2026-04-08T10:00:00.000Z",
    });
    await repository.saveRevision({
      id: "asset-runtime-scheduled-1-revision-2",
      asset_id: "asset-runtime-scheduled-1",
      revision_no: 2,
      status: "approved",
      title: "Scheduled runtime revision",
      canonical_text: "This revision should not replace the runtime source yet.",
      knowledge_kind: "rule",
      routing: {
        module_scope: "screening",
        manuscript_types: ["clinical_study"],
      },
      effective_at: "2099-01-01T00:00:00.000Z",
      created_at: "2026-04-08T10:05:00.000Z",
      updated_at: "2026-04-08T10:05:00.000Z",
    });

    const approvedList = await repository.listApproved();

    assert.deepEqual(
      approvedList.map((record) => record.id).sort(),
      ["asset-runtime-active-1", "asset-runtime-scheduled-1"].sort(),
    );
    assert.equal(
      (await repository.findApprovedById("asset-runtime-active-1"))?.title,
      "Active runtime revision",
    );
    assert.equal(await repository.findApprovedById("asset-runtime-future-1"), undefined);
    assert.equal(await repository.findApprovedById("asset-runtime-expired-1"), undefined);
    assert.equal(
      (await repository.findApprovedById("asset-runtime-scheduled-1"))?.title,
      "Current runtime revision",
    );
  });
});

test("postgres knowledge review action repository can filter history by revision id", async () => {
  await withMigratedKnowledgeClient(async (client) => {
    const knowledgeRepository = new PostgresKnowledgeRepository({ client });
    const repository = new PostgresKnowledgeReviewActionRepository({ client });

    await knowledgeRepository.saveAsset({
      id: "asset-knowledge-2",
      status: "active",
      current_revision_id: "asset-knowledge-2-revision-1",
      created_at: "2026-04-08T10:00:00.000Z",
      updated_at: "2026-04-08T10:00:00.000Z",
    });
    await knowledgeRepository.saveRevision({
      id: "asset-knowledge-2-revision-1",
      asset_id: "asset-knowledge-2",
      revision_no: 1,
      status: "pending_review",
      title: "Revision history target",
      canonical_text: "Revision history target text.",
      knowledge_kind: "rule",
      routing: {
        module_scope: "screening",
        manuscript_types: ["clinical_study"],
      },
      created_at: "2026-04-08T10:00:00.000Z",
      updated_at: "2026-04-08T10:00:00.000Z",
    });

    await repository.save({
      id: "11111111-2222-3333-4444-555555555551",
      knowledge_item_id: "asset-knowledge-2",
      revision_id: "asset-knowledge-2-revision-1",
      action: "submitted_for_review",
      actor_role: "user",
      created_at: "2026-04-08T10:00:00.000Z",
    });
    await repository.save({
      id: "11111111-2222-3333-4444-555555555552",
      knowledge_item_id: "asset-knowledge-2",
      revision_id: "asset-knowledge-2-revision-1",
      action: "rejected",
      actor_role: "knowledge_reviewer",
      review_note: "Please strengthen the citation.",
      created_at: "2026-04-08T10:05:00.000Z",
    });

    const history = await repository.listByRevisionId("asset-knowledge-2-revision-1");

    assert.deepEqual(history, [
      {
        id: "11111111-2222-3333-4444-555555555551",
        knowledge_item_id: "asset-knowledge-2",
        revision_id: "asset-knowledge-2-revision-1",
        action: "submitted_for_review",
        actor_role: "user",
        created_at: "2026-04-08T10:00:00.000Z",
      },
      {
        id: "11111111-2222-3333-4444-555555555552",
        knowledge_item_id: "asset-knowledge-2",
        revision_id: "asset-knowledge-2-revision-1",
        action: "rejected",
        actor_role: "knowledge_reviewer",
        review_note: "Please strengthen the citation.",
        created_at: "2026-04-08T10:05:00.000Z",
      },
    ]);
  });
});

test("postgres knowledge repository persists duplicate acknowledgement audit rows per revision", async () => {
  await withMigratedKnowledgeClient(async (client) => {
    const repository = new PostgresKnowledgeRepository({ client });
    const revisionId = "asset-duplicate-1-revision-2";
    const acknowledgementsRepository = repository as {
      saveDuplicateAcknowledgement?: (record: {
        id: string;
        revision_id: string;
        matched_asset_ids: string[];
        highest_severity: "exact" | "high" | "possible";
        acknowledged_by_role: string;
        created_at: string;
      }) => Promise<void>;
      listDuplicateAcknowledgementsByRevisionId?: (
        revisionId: string,
      ) => Promise<
        {
          id: string;
          revision_id: string;
          matched_asset_ids: string[];
          highest_severity: "exact" | "high" | "possible";
          acknowledged_by_role: string;
          created_at: string;
        }[]
      >;
    };

    await repository.saveAsset({
      id: "asset-duplicate-1",
      status: "active",
      current_revision_id: revisionId,
      created_at: "2026-04-08T10:00:00.000Z",
      updated_at: "2026-04-08T10:00:00.000Z",
    });
    await repository.saveRevision({
      id: revisionId,
      asset_id: "asset-duplicate-1",
      revision_no: 2,
      status: "draft",
      title: "Duplicate acknowledgement target revision",
      canonical_text: "Duplicate acknowledgement target text.",
      knowledge_kind: "rule",
      routing: {
        module_scope: "screening",
        manuscript_types: ["clinical_study"],
      },
      created_at: "2026-04-08T10:00:00.000Z",
      updated_at: "2026-04-08T10:00:00.000Z",
    });

    assert.equal(
      typeof acknowledgementsRepository.saveDuplicateAcknowledgement,
      "function",
      "Postgres repository should expose duplicate acknowledgement persistence.",
    );
    assert.equal(
      typeof acknowledgementsRepository.listDuplicateAcknowledgementsByRevisionId,
      "function",
      "Postgres repository should expose duplicate acknowledgement history lookup.",
    );

    await acknowledgementsRepository.saveDuplicateAcknowledgement?.({
      id: "ack-duplicate-1",
      revision_id: revisionId,
      matched_asset_ids: ["asset-duplicate-2", "asset-duplicate-3"],
      highest_severity: "high",
      acknowledged_by_role: "knowledge_reviewer",
      created_at: "2026-04-08T10:05:00.000Z",
    });
    await assert.rejects(
      () =>
        acknowledgementsRepository.saveDuplicateAcknowledgement?.({
          id: "ack-duplicate-1",
          revision_id: revisionId,
          matched_asset_ids: ["asset-duplicate-9"],
          highest_severity: "exact",
          acknowledged_by_role: "admin",
          created_at: "2026-04-08T10:06:00.000Z",
        }) ?? Promise.reject(new Error("Expected acknowledgement save method.")),
      (error: unknown) => {
        assert.equal((error as { code?: string }).code, "23505");
        return true;
      },
      "Duplicate acknowledgement ids should not be mutable via upsert.",
    );

    const rows =
      await acknowledgementsRepository.listDuplicateAcknowledgementsByRevisionId?.(
        revisionId,
      );

    assert.deepEqual(rows, [
      {
        id: "ack-duplicate-1",
        revision_id: revisionId,
        matched_asset_ids: ["asset-duplicate-2", "asset-duplicate-3"],
        highest_severity: "high",
        acknowledged_by_role: "knowledge_reviewer",
        created_at: "2026-04-08T10:05:00.000Z",
      },
    ]);
  });
});

test("postgres duplicate candidates select approved representative revision per asset when available", async () => {
  await withMigratedKnowledgeClient(async (client) => {
    const repository = new PostgresKnowledgeRepository({ client });
    const duplicateCandidateRepository = repository as {
      listDuplicateCheckCandidatesByAsset?: () => Promise<
        {
          asset: { id: string };
          representative_revision: { id: string; status: string; title: string };
          bindings: string[];
        }[]
      >;
    };

    await repository.saveAsset({
      id: "asset-duplicate-approved-1",
      status: "active",
      current_revision_id: "asset-duplicate-approved-1-revision-2",
      current_approved_revision_id: "asset-duplicate-approved-1-revision-1",
      created_at: "2026-04-09T09:00:00.000Z",
      updated_at: "2026-04-09T09:10:00.000Z",
    });
    await repository.saveRevision({
      id: "asset-duplicate-approved-1-revision-1",
      asset_id: "asset-duplicate-approved-1",
      revision_no: 1,
      status: "approved",
      title: "Approved representative revision",
      canonical_text: "Approved duplicate detection source.",
      knowledge_kind: "rule",
      routing: {
        module_scope: "screening",
        manuscript_types: ["clinical_study"],
      },
      created_at: "2026-04-09T09:00:00.000Z",
      updated_at: "2026-04-09T09:00:00.000Z",
    });
    await repository.replaceRevisionBindings("asset-duplicate-approved-1-revision-1", [
      {
        id: "asset-duplicate-approved-1-revision-1-binding-1",
        revision_id: "asset-duplicate-approved-1-revision-1",
        binding_kind: "module_template",
        binding_target_id: "template-approved-binding",
        binding_target_label: "Template Approved Binding",
        created_at: "2026-04-09T09:00:00.000Z",
      },
    ]);
    await repository.saveRevision({
      id: "asset-duplicate-approved-1-revision-2",
      asset_id: "asset-duplicate-approved-1",
      revision_no: 2,
      status: "draft",
      title: "Working revision should not represent duplicates",
      canonical_text: "Working duplicate detection source.",
      knowledge_kind: "rule",
      routing: {
        module_scope: "screening",
        manuscript_types: ["clinical_study"],
      },
      created_at: "2026-04-09T09:10:00.000Z",
      updated_at: "2026-04-09T09:10:00.000Z",
    });
    await repository.replaceRevisionBindings("asset-duplicate-approved-1-revision-2", [
      {
        id: "asset-duplicate-approved-1-revision-2-binding-1",
        revision_id: "asset-duplicate-approved-1-revision-2",
        binding_kind: "module_template",
        binding_target_id: "template-working-binding",
        binding_target_label: "Template Working Binding",
        created_at: "2026-04-09T09:10:00.000Z",
      },
    ]);

    await repository.saveAsset({
      id: "asset-duplicate-working-1",
      status: "active",
      current_revision_id: "asset-duplicate-working-1-revision-2",
      created_at: "2026-04-09T09:00:00.000Z",
      updated_at: "2026-04-09T09:10:00.000Z",
    });
    await repository.saveRevision({
      id: "asset-duplicate-working-1-revision-1",
      asset_id: "asset-duplicate-working-1",
      revision_no: 1,
      status: "superseded",
      title: "Superseded revision",
      canonical_text: "Superseded duplicate detection source.",
      knowledge_kind: "rule",
      routing: {
        module_scope: "screening",
        manuscript_types: ["clinical_study"],
      },
      created_at: "2026-04-09T09:00:00.000Z",
      updated_at: "2026-04-09T09:00:00.000Z",
    });
    await repository.saveRevision({
      id: "asset-duplicate-working-1-revision-2",
      asset_id: "asset-duplicate-working-1",
      revision_no: 2,
      status: "pending_review",
      title: "Pending review representative revision",
      canonical_text: "Pending review duplicate detection source.",
      knowledge_kind: "rule",
      routing: {
        module_scope: "screening",
        manuscript_types: ["clinical_study"],
      },
      created_at: "2026-04-09T09:10:00.000Z",
      updated_at: "2026-04-09T09:10:00.000Z",
    });
    await repository.replaceRevisionBindings("asset-duplicate-working-1-revision-2", [
      {
        id: "asset-duplicate-working-1-revision-2-binding-1",
        revision_id: "asset-duplicate-working-1-revision-2",
        binding_kind: "module_template",
        binding_target_id: "template-pending-binding",
        binding_target_label: "Template Pending Binding",
        created_at: "2026-04-09T09:10:00.000Z",
      },
    ]);
    await repository.save({
      id: "cccccccc-1111-2222-3333-444444444444",
      title: "Legacy duplicate candidate record",
      canonical_text: "Legacy duplicate candidate source.",
      knowledge_kind: "reference",
      status: "approved",
      routing: {
        module_scope: "editing",
        manuscript_types: ["review"],
      },
      template_bindings: ["legacy-template-binding"],
    });

    assert.equal(
      typeof duplicateCandidateRepository.listDuplicateCheckCandidatesByAsset,
      "function",
      "Postgres repository should expose duplicate candidate projection.",
    );

    const groups = await duplicateCandidateRepository.listDuplicateCheckCandidatesByAsset?.();

    assert.deepEqual(
      groups?.map((group) => ({
        asset: {
          id: group.asset.id,
        },
        representative_revision: {
          id: group.representative_revision.id,
          status: group.representative_revision.status,
          title: group.representative_revision.title,
        },
        bindings: group.bindings,
      })),
      [
      {
        asset: {
          id: "asset-duplicate-approved-1",
        },
        representative_revision: {
          id: "asset-duplicate-approved-1-revision-1",
          status: "approved",
          title: "Approved representative revision",
        },
        bindings: ["template-approved-binding"],
      },
      {
        asset: {
          id: "asset-duplicate-working-1",
        },
        representative_revision: {
          id: "asset-duplicate-working-1-revision-2",
          status: "pending_review",
          title: "Pending review representative revision",
        },
        bindings: ["template-pending-binding"],
      },
      {
        asset: {
          id: "cccccccc-1111-2222-3333-444444444444",
        },
        representative_revision: {
          id: "cccccccc-1111-2222-3333-444444444444",
          status: "approved",
          title: "Legacy duplicate candidate record",
        },
        bindings: ["legacy-template-binding"],
      },
      ],
    );
  });
});

async function withMigratedKnowledgeClient(
  run: (client: Client) => Promise<void>,
): Promise<void> {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for the temporary knowledge persistence database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      await run(client);
    } finally {
      await client.end();
    }
  });
}

async function seedLearningCandidate(client: Client, candidateId: string): Promise<void> {
  await client.query(
    `
      insert into learning_candidates (
        id,
        type,
        status,
        module,
        manuscript_type,
        created_by,
        title,
        proposal_text
      )
      values (
        $1,
        'rule_candidate',
        'approved',
        'screening',
        'clinical_study',
        'test-seed',
        'Seeded knowledge learning candidate',
        'Seeded provenance for knowledge persistence tests.'
      )
    `,
    [candidateId],
  );
}
