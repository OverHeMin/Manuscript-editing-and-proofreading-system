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
