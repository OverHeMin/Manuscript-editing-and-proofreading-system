import test from "node:test";
import assert from "node:assert/strict";
import {
  InMemoryKnowledgeRepository,
  InMemoryKnowledgeReviewActionRepository,
} from "../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import {
  KnowledgeRevisionReviewGateError,
  KnowledgeService,
} from "../../src/modules/knowledge/knowledge-service.ts";
import { normalizeKnowledgeContentBlocksInput } from "../../src/modules/knowledge/knowledge-content-block-normalizer.ts";

function createKnowledgeTableEvidenceHarness(input?: {
  confirmedRevisionIds?: readonly string[];
  boundRevisionIds?: readonly string[];
  revisionAssetIds?: Record<string, string>;
}) {
  const repository = new InMemoryKnowledgeRepository();
  const reviewActionRepository = new InMemoryKnowledgeReviewActionRepository();
  const confirmedRevisionIds = new Set(input?.confirmedRevisionIds ?? []);
  const boundRevisionIds = new Set(input?.boundRevisionIds ?? []);
  let nextId = 1;

  const service = new KnowledgeService({
    repository,
    reviewActionRepository,
    createId: () => `knowledge-${nextId++}`,
    now: () => new Date("2026-04-29T08:00:00.000Z"),
    tableEvidenceService: {
      async assertConfirmedRevision(revisionId: string) {
        if (!confirmedRevisionIds.has(revisionId)) {
          throw new Error(
            `Table evidence revision ${revisionId} is not confirmed.`,
          );
        }
        return {
          id: revisionId,
          table_evidence_asset_id:
            input?.revisionAssetIds?.[revisionId] ?? "table-asset-1",
        } as never;
      },
      async resolveConfirmedPackagesForTarget(targetType, targetId) {
        assert.equal(targetType, "knowledge_revision");
        assert.ok(targetId.length > 0);
        return [...boundRevisionIds].map((revisionId) => ({
          revision_id: revisionId,
          asset_id: input?.revisionAssetIds?.[revisionId] ?? "table-asset-1",
          authority: "authoritative",
        })) as never;
      },
    },
  });

  return {
    repository,
    reviewActionRepository,
    service,
  };
}

async function createDraftWithTableEvidenceBlock(
  service: KnowledgeService,
  payload: Record<string, unknown>,
) {
  const created = await service.createLibraryDraft({
    title: "Confirmed table evidence gate",
    canonicalText:
      "Table-backed knowledge can only enter review with confirmed table evidence.",
    knowledgeKind: "reference",
    moduleScope: "editing",
    manuscriptTypes: ["clinical_study"],
  });

  await service.replaceRevisionContentBlocks(created.selected_revision.id, {
    blocks: [
      {
        blockType: "table_evidence_block",
        orderNo: 0,
        contentPayload: payload,
      },
    ],
  });

  return created;
}

test("unconfirmed table evidence revision cannot be submitted for review", async () => {
  const { service } = createKnowledgeTableEvidenceHarness();
  const created = await createDraftWithTableEvidenceBlock(service, {
    table_evidence_asset_id: "table-asset-1",
    table_evidence_revision_id: "rev-pending",
  });

  await assert.rejects(
    () =>
      service.submitRevisionForReview({
        revisionId: created.selected_revision.id,
      }),
    (error: unknown) => {
      assert.ok(error instanceof KnowledgeRevisionReviewGateError);
      assert.deepEqual(
        error.failures.map((failure) => failure.code),
        ["table_evidence_revision_not_confirmed"],
      );
      return true;
    },
  );
});

test("confirmed table evidence revision passes submit and approve gates", async () => {
  const { service } = createKnowledgeTableEvidenceHarness({
    confirmedRevisionIds: ["rev-confirmed"],
    boundRevisionIds: ["rev-confirmed"],
  });
  const created = await createDraftWithTableEvidenceBlock(service, {
    table_evidence_asset_id: "table-asset-1",
    table_evidence_revision_id: "rev-confirmed",
  });

  const submitted = await service.submitRevisionForReview({
    revisionId: created.selected_revision.id,
  });
  const approved = await service.approveRevision(
    created.selected_revision.id,
    "knowledge_reviewer",
  );

  assert.equal(submitted.selected_revision.status, "pending_review");
  assert.equal(approved.selected_revision.status, "approved");
});

test("confirmed table evidence revision without a knowledge revision binding blocks review gates", async () => {
  const { service } = createKnowledgeTableEvidenceHarness({
    confirmedRevisionIds: ["rev-confirmed"],
  });
  const created = await createDraftWithTableEvidenceBlock(service, {
    table_evidence_asset_id: "table-asset-1",
    table_evidence_revision_id: "rev-confirmed",
  });

  await assert.rejects(
    () =>
      service.submitRevisionForReview({
        revisionId: created.selected_revision.id,
      }),
    (error: unknown) => {
      assert.ok(error instanceof KnowledgeRevisionReviewGateError);
      assert.deepEqual(
        error.failures.map((failure) => failure.code),
        ["table_evidence_binding_missing"],
      );
      assert.equal(error.failures[0]?.revision_id, "rev-confirmed");
      assert.equal(
        error.failures[0]?.block_id,
        `${created.selected_revision.id}-content-block-1`,
      );
      return true;
    },
  );
});

test("table evidence asset id mismatch blocks submit with an inspectable failure code", async () => {
  const { service } = createKnowledgeTableEvidenceHarness({
    confirmedRevisionIds: ["rev-confirmed"],
    revisionAssetIds: {
      "rev-confirmed": "other-table-asset",
    },
  });
  const created = await createDraftWithTableEvidenceBlock(service, {
    table_evidence_asset_id: "table-asset-1",
    table_evidence_revision_id: "rev-confirmed",
  });

  await assert.rejects(
    () =>
      service.submitRevisionForReview({
        revisionId: created.selected_revision.id,
      }),
    (error: unknown) => {
      assert.ok(error instanceof KnowledgeRevisionReviewGateError);
      assert.deepEqual(
        error.failures.map((failure) => failure.code),
        ["table_evidence_asset_mismatch"],
      );
      assert.equal(error.failures[0]?.revision_id, "rev-confirmed");
      assert.equal(
        error.failures[0]?.block_id,
        `${created.selected_revision.id}-content-block-1`,
      );
      return true;
    },
  );
});

test("table evidence block with confirmed revision but missing asset id is rejected", async () => {
  for (const payload of [
    { table_evidence_revision_id: "rev-confirmed" },
    {
      table_evidence_asset_id: " ",
      table_evidence_revision_id: "rev-confirmed",
    },
  ]) {
    const { service } = createKnowledgeTableEvidenceHarness({
      confirmedRevisionIds: ["rev-confirmed"],
    });
    const created = await createDraftWithTableEvidenceBlock(service, payload);

    await assert.rejects(
      () =>
        service.submitRevisionForReview({
          revisionId: created.selected_revision.id,
        }),
      (error: unknown) => {
        assert.ok(error instanceof KnowledgeRevisionReviewGateError);
        assert.deepEqual(
          error.failures.map((failure) => failure.code),
          ["table_evidence_asset_missing"],
        );
        assert.equal(error.failures[0]?.revision_id, "rev-confirmed");
        assert.equal(
          error.failures[0]?.block_id,
          `${created.selected_revision.id}-content-block-1`,
        );
        return true;
      },
    );
  }
});

test("table evidence block without revision id reports missing revision failure code", async () => {
  const { service } = createKnowledgeTableEvidenceHarness();
  const created = await createDraftWithTableEvidenceBlock(service, {
    table_evidence_asset_id: "table-asset-1",
  });

  await assert.rejects(
    () =>
      service.submitRevisionForReview({
        revisionId: created.selected_revision.id,
      }),
    (error: unknown) => {
      assert.ok(error instanceof KnowledgeRevisionReviewGateError);
      assert.deepEqual(
        error.failures.map((failure) => failure.code),
        ["table_evidence_revision_missing"],
      );
      return true;
    },
  );
});

test("table evidence block normalizer trims ids and drops empty binding id", async () => {
  const normalized = await normalizeKnowledgeContentBlocksInput({
    blocks: [
      {
        blockType: "table_evidence_block",
        orderNo: 0,
        contentPayload: {
          table_evidence_asset_id: " table-asset-1 ",
          table_evidence_revision_id: " rev-confirmed ",
          binding_id: " ",
        },
        tableSemantics: {
          exact_capture_authoritative: true,
        },
      },
    ],
  });

  assert.deepEqual(normalized.blocks[0]?.contentPayload, {
    table_evidence_asset_id: "table-asset-1",
    table_evidence_revision_id: "rev-confirmed",
    binding_id: undefined,
  });
  assert.equal(normalized.blocks[0]?.tableSemantics, undefined);
});

test("legacy authoritative table blocks cannot bypass confirmed table evidence gates", async () => {
  const { service } = createKnowledgeTableEvidenceHarness();
  const created = await service.createLibraryDraft({
    title: "Legacy table block cannot claim authority",
    canonicalText:
      "Client-side exact capture flags must not replace confirmed Word table evidence.",
    knowledgeKind: "reference",
    moduleScope: "editing",
    manuscriptTypes: ["clinical_study"],
  });

  await service.replaceRevisionContentBlocks(created.selected_revision.id, {
    blocks: [
      {
        blockType: "table_block",
        orderNo: 0,
        contentPayload: {
          rows: [["指标", "值"]],
          capture_mode: "html_table_clipboard",
          exact_capture_failure_codes: [],
        },
        tableSemantics: {
          snapshot_type: "table_style_snapshot",
          exact_capture_authoritative: true,
          exact_capture_failure_codes: [],
        },
      },
    ],
  });

  await assert.rejects(
    () =>
      service.submitRevisionForReview({
        revisionId: created.selected_revision.id,
      }),
    (error: unknown) => {
      assert.ok(error instanceof KnowledgeRevisionReviewGateError);
      assert.equal(error.failures.length, 1);
      assert.match(error.failures[0]?.message ?? "", /confirmed Word table evidence/i);
      return true;
    },
  );
});
