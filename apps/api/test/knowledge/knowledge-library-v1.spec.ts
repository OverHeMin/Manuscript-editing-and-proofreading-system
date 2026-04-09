import test from "node:test";
import assert from "node:assert/strict";
import {
  InMemoryKnowledgeRepository,
  InMemoryKnowledgeReviewActionRepository,
} from "../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import { KnowledgeService } from "../../src/modules/knowledge/knowledge-service.ts";

function createKnowledgeLibraryHarness() {
  const repository = new InMemoryKnowledgeRepository();
  const reviewActionRepository = new InMemoryKnowledgeReviewActionRepository();
  const issuedIds = [
    "asset-1",
    "review-action-1",
    "review-action-2",
    "asset-2",
    "review-action-3",
    "review-action-4",
  ];
  const nextId = () => {
    const value = issuedIds.shift();
    assert.ok(value, "Expected a knowledge-library test id to be available.");
    return value;
  };

  const service = new KnowledgeService({
    repository,
    reviewActionRepository,
    createId: nextId,
    now: () => new Date("2026-04-08T10:00:00.000Z"),
  });

  return {
    repository,
    reviewActionRepository,
    service,
  };
}

test("knowledge library creates a draft asset with revision detail and structured bindings", async () => {
  const { service } = createKnowledgeLibraryHarness();

  const created = await service.createLibraryDraft({
    title: "Primary endpoint disclosure rule",
    canonicalText: "Clinical studies must disclose the primary endpoint.",
    summary: "Used during screening for endpoint completeness checks.",
    knowledgeKind: "rule",
    moduleScope: "screening",
    manuscriptTypes: ["clinical_study"],
    sections: ["methods"],
    riskTags: ["statistics"],
    disciplineTags: ["oncology"],
    evidenceLevel: "high",
    sourceType: "guideline",
    sourceLink: "https://example.org/endpoint-guideline",
    aliases: ["endpoint disclosure"],
    bindings: [
      {
        bindingKind: "module_template",
        bindingTargetId: "template-screening-core",
        bindingTargetLabel: "Screening Core Template",
      },
    ],
  });

  assert.equal(created.asset.id, "asset-1");
  assert.equal(created.asset.status, "active");
  assert.equal(created.asset.current_revision_id, "asset-1-revision-1");
  assert.equal(created.asset.current_approved_revision_id, undefined);
  assert.equal(created.selected_revision.id, "asset-1-revision-1");
  assert.equal(created.selected_revision.asset_id, "asset-1");
  assert.equal(created.selected_revision.revision_no, 1);
  assert.equal(created.selected_revision.status, "draft");
  assert.deepEqual(created.selected_revision.bindings, [
    {
      id: "asset-1-revision-1-binding-1",
      revision_id: "asset-1-revision-1",
      binding_kind: "module_template",
      binding_target_id: "template-screening-core",
      binding_target_label: "Screening Core Template",
      created_at: "2026-04-08T10:00:00.000Z",
    },
  ]);
});

test("editing an approved asset derives a new draft revision and keeps runtime approval pinned", async () => {
  const { service, repository } = createKnowledgeLibraryHarness();

  const created = await service.createLibraryDraft({
    title: "Privacy checklist",
    canonicalText: "Case reports must remove patient identifiers.",
    knowledgeKind: "checklist",
    moduleScope: "proofreading",
    manuscriptTypes: ["case_report"],
    bindings: [
      {
        bindingKind: "template_family",
        bindingTargetId: "family-case-report",
        bindingTargetLabel: "Case Report Family",
      },
    ],
  });

  await service.submitRevisionForReview(created.selected_revision.id);
  await service.approveRevision(
    created.selected_revision.id,
    "knowledge_reviewer",
    "Approved for operator use.",
  );

  const derived = await service.createDraftRevisionFromApprovedAsset(created.asset.id);

  await service.updateRevisionDraft(derived.selected_revision.id, {
    title: "Privacy checklist updated",
    canonicalText: "Case reports must remove patient identifiers before proofreading.",
    bindings: [
      {
        bindingKind: "template_family",
        bindingTargetId: "family-case-report",
        bindingTargetLabel: "Case Report Family",
      },
    ],
  });

  const detail = await service.getKnowledgeAsset(
    created.asset.id,
    derived.selected_revision.id,
  );
  const runtimeProjection = await repository.findApprovedById(created.asset.id);

  assert.equal(detail.asset.current_revision_id, "asset-1-revision-2");
  assert.equal(detail.asset.current_approved_revision_id, "asset-1-revision-1");
  assert.equal(detail.selected_revision.id, "asset-1-revision-2");
  assert.equal(detail.selected_revision.status, "draft");
  assert.equal(detail.current_approved_revision?.id, "asset-1-revision-1");
  assert.deepEqual(
    detail.revisions.map((revision) => ({
      id: revision.id,
      revision_no: revision.revision_no,
      status: revision.status,
    })),
    [
      {
        id: "asset-1-revision-2",
        revision_no: 2,
        status: "draft",
      },
      {
        id: "asset-1-revision-1",
        revision_no: 1,
        status: "approved",
      },
    ],
  );
  assert.equal(runtimeProjection?.id, "asset-1");
  assert.equal(runtimeProjection?.status, "approved");
  assert.equal(runtimeProjection?.title, "Privacy checklist");
});

test("approved runtime projections filter out not-yet-effective and expired revisions", async () => {
  const repository = new InMemoryKnowledgeRepository();

  await repository.saveAsset({
    id: "asset-active-1",
    status: "active",
    current_revision_id: "asset-active-1-revision-1",
    current_approved_revision_id: "asset-active-1-revision-1",
    created_at: "2026-04-08T10:00:00.000Z",
    updated_at: "2026-04-08T10:00:00.000Z",
  });
  await repository.saveRevision({
    id: "asset-active-1-revision-1",
    asset_id: "asset-active-1",
    revision_no: 1,
    status: "approved",
    title: "Active runtime rule",
    canonical_text: "Applies right now.",
    knowledge_kind: "rule",
    routing: {
      module_scope: "screening",
      manuscript_types: ["clinical_study"],
    },
    created_at: "2026-04-08T10:00:00.000Z",
    updated_at: "2026-04-08T10:00:00.000Z",
  });

  await repository.saveAsset({
    id: "asset-future-1",
    status: "active",
    current_revision_id: "asset-future-1-revision-1",
    current_approved_revision_id: "asset-future-1-revision-1",
    created_at: "2026-04-08T10:00:00.000Z",
    updated_at: "2026-04-08T10:00:00.000Z",
  });
  await repository.saveRevision({
    id: "asset-future-1-revision-1",
    asset_id: "asset-future-1",
    revision_no: 1,
    status: "approved",
    title: "Future runtime rule",
    canonical_text: "Should stay inactive until scheduled.",
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
    id: "asset-expired-1",
    status: "active",
    current_revision_id: "asset-expired-1-revision-1",
    current_approved_revision_id: "asset-expired-1-revision-1",
    created_at: "2026-04-08T10:00:00.000Z",
    updated_at: "2026-04-08T10:00:00.000Z",
  });
  await repository.saveRevision({
    id: "asset-expired-1-revision-1",
    asset_id: "asset-expired-1",
    revision_no: 1,
    status: "approved",
    title: "Expired runtime rule",
    canonical_text: "Should no longer be returned.",
    knowledge_kind: "rule",
    routing: {
      module_scope: "screening",
      manuscript_types: ["clinical_study"],
    },
    expires_at: "2000-01-01T00:00:00.000Z",
    created_at: "2026-04-08T10:00:00.000Z",
    updated_at: "2026-04-08T10:00:00.000Z",
  });

  const approvedList = await repository.listApproved();

  assert.deepEqual(
    approvedList.map((record) => record.id),
    ["asset-active-1"],
  );
  assert.equal((await repository.findApprovedById("asset-active-1"))?.title, "Active runtime rule");
  assert.equal(await repository.findApprovedById("asset-future-1"), undefined);
  assert.equal(await repository.findApprovedById("asset-expired-1"), undefined);
});

test("approving a future-effective revision keeps the prior runtime projection active", async () => {
  const repository = new InMemoryKnowledgeRepository();
  const reviewActionRepository = new InMemoryKnowledgeReviewActionRepository();
  const issuedIds = [
    "asset-1",
    "review-action-1",
    "review-action-2",
    "review-action-3",
    "review-action-4",
  ];
  const service = new KnowledgeService({
    repository,
    reviewActionRepository,
    createId: () => {
      const value = issuedIds.shift();
      assert.ok(value, "Expected a knowledge-library test id to be available.");
      return value;
    },
    now: () => new Date("2026-04-08T10:00:00.000Z"),
  });

  const created = await service.createLibraryDraft({
    title: "Current runtime checklist",
    canonicalText: "Use the currently effective revision.",
    knowledgeKind: "checklist",
    moduleScope: "proofreading",
    manuscriptTypes: ["case_report"],
  });

  await service.submitRevisionForReview(created.selected_revision.id);
  await service.approveRevision(created.selected_revision.id, "knowledge_reviewer");

  const derived = await service.createDraftRevisionFromApprovedAsset(created.asset.id);
  await service.updateRevisionDraft(derived.selected_revision.id, {
    title: "Scheduled runtime checklist",
    canonicalText: "Use this revision after the scheduled date.",
    effectiveAt: "2099-01-01T00:00:00.000Z",
  });
  await service.submitRevisionForReview(derived.selected_revision.id);
  await service.approveRevision(derived.selected_revision.id, "knowledge_reviewer");

  const detail = await service.getKnowledgeAsset(created.asset.id, derived.selected_revision.id);
  const runtimeProjection = await repository.findApprovedById(created.asset.id);

  assert.equal(detail.asset.current_approved_revision_id, "asset-1-revision-2");
  assert.equal(detail.selected_revision.status, "approved");
  assert.equal(runtimeProjection?.title, "Current runtime checklist");
});

test("reject returns a pending revision to draft without erasing review history", async () => {
  const { service } = createKnowledgeLibraryHarness();

  const created = await service.createLibraryDraft({
    title: "Source-linked terminology note",
    canonicalText: "Use standard medical terminology in review manuscripts.",
    knowledgeKind: "reference",
    moduleScope: "editing",
    manuscriptTypes: ["review"],
    bindings: [
      {
        bindingKind: "module_template",
        bindingTargetId: "template-editing-review",
        bindingTargetLabel: "Review Editing Template",
      },
    ],
  });

  await service.submitRevisionForReview(created.selected_revision.id);
  await service.rejectRevision(
    created.selected_revision.id,
    "knowledge_reviewer",
    "Please attach a stronger source citation.",
  );

  const detail = await service.getKnowledgeAsset(
    created.asset.id,
    created.selected_revision.id,
  );
  const history = await service.listReviewActionsByRevision(created.selected_revision.id);

  assert.equal(detail.selected_revision.status, "draft");
  assert.equal(detail.asset.current_approved_revision_id, undefined);
  assert.deepEqual(
    history.map((record) => ({
      revision_id: record.revision_id,
      action: record.action,
      review_note: record.review_note,
    })),
    [
      {
        revision_id: "asset-1-revision-1",
        action: "submitted_for_review",
        review_note: undefined,
      },
      {
        revision_id: "asset-1-revision-1",
        action: "rejected",
        review_note: "Please attach a stronger source citation.",
      },
    ],
  );
});
