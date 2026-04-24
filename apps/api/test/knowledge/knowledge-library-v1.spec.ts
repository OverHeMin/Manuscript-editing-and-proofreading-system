import test from "node:test";
import assert from "node:assert/strict";
import {
  InMemoryKnowledgeRepository,
  InMemoryKnowledgeReviewActionRepository,
} from "../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import {
  KnowledgeService,
  type KnowledgeAssetDetailRecord,
  KnowledgeRevisionReviewGateError,
} from "../../src/modules/knowledge/knowledge-service.ts";

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

const NON_AUTHORITATIVE_TABLE_FAILURE_CODES = [
  "missing_required_clipboard_flavor",
  "merged_cell_map_incomplete",
  "caption_or_note_position_unknown",
  "border_profile_incomplete",
  "alignment_profile_incomplete",
  "run_style_incomplete",
  "exact_capture_not_authoritative",
];

function buildNonAuthoritativeTableBlock() {
  return {
    blockType: "table_block" as const,
    orderNo: 1,
    contentPayload: {
      rows: [
        ["指标", "值"],
        ["年龄", "12"],
      ],
      capture_mode: "plain_text_grid",
      clipboard_types: ["text/plain"],
      exact_capture_failure_codes: NON_AUTHORITATIVE_TABLE_FAILURE_CODES,
    },
    tableSemantics: {
      snapshot_type: "table_style_snapshot",
      capture_mode: "plain_text_grid",
      exact_capture_authoritative: false,
      exact_capture_failure_codes: NON_AUTHORITATIVE_TABLE_FAILURE_CODES,
      row_count: 2,
      column_count: 2,
    },
  };
}

function buildAuthoritativeTableBlock() {
  return {
    blockType: "table_block" as const,
    orderNo: 1,
    contentPayload: {
      rows: [
        ["指标", "值"],
        ["年龄", "12"],
      ],
      capture_mode: "html_table_clipboard",
      capture_environment: "windows_chromium",
      source_application: "word",
      clipboard_types: ["text/html", "text/plain", "text/rtf"],
      merged_cell_state: "none",
      caption_position: "above",
      note_position: "below",
      border_profile: "顶线，表头分隔线，底线，无竖线",
      alignment_profile: "表头居中，正文左对齐/右对齐",
      run_style_signals: "斜体, 上标",
      exact_capture_failure_codes: [],
    },
    tableSemantics: {
      snapshot_type: "table_style_snapshot",
      capture_mode: "html_table_clipboard",
      capture_environment: "windows_chromium",
      source_application: "word",
      exact_capture_authoritative: true,
      exact_capture_failure_codes: [],
      row_count: 2,
      column_count: 2,
      merged_cell_state: "none",
      caption: {
        text: "表 1 基线特征",
        position: "above",
      },
      note: {
        text: "注：年龄单位为岁。",
        position: "below",
      },
      header_depth: "1",
      stub_column_count: "0",
      border_profile: "顶线，表头分隔线，底线，无竖线",
      alignment_profile: "表头居中，正文左对齐/右对齐",
      run_style_signals: ["斜体", "上标"],
    },
  };
}

function buildVisualSymbolImageBlock(reviewState: "pending_review" | "confirmed") {
  return {
    blockType: "image_block" as const,
    orderNo: 1,
    contentPayload: {
      upload_id: "upload-chi-square",
      storage_key: "knowledge/rich-space/chi-square.png",
      file_name: "chi-square.png",
      source_kind: "inline_symbol_image",
      normalized_candidate_symbol: "χ²",
      local_context: "统计方法段落",
      nearby_text: "采用 χ² 检验比较组间差异。",
      review_state: reviewState,
    },
    imageUnderstanding: {
      snapshot_type: "visual_symbol_snapshot",
      source_kind: "inline_symbol_image",
      normalized_candidate_symbol: "χ²",
      local_context: "统计方法段落",
      nearby_text: "采用 χ² 检验比较组间差异。",
      review_state: reviewState,
      image_id: "upload-chi-square",
    },
  };
}

function assertKnowledgeAssetDetailRecord(
  value: KnowledgeAssetDetailRecord | unknown,
): asserts value is KnowledgeAssetDetailRecord {
  assert.ok(
    value != null &&
      typeof value === "object" &&
      "asset" in value &&
      "selected_revision" in value,
    "Expected a knowledge asset detail record.",
  );
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

test("updating a draft revision marks a confirmed semantic layer stale", async () => {
  const { service } = createKnowledgeLibraryHarness();

  const created = await service.createLibraryDraft({
    title: "Dose reporting rule",
    canonicalText: "Clinical studies must report dose adjustments in methods.",
    knowledgeKind: "rule",
    moduleScope: "screening",
    manuscriptTypes: ["clinical_study"],
  });

  await service.regenerateSemanticLayer(created.selected_revision.id, {
    pageSummary: "AI extracted a screening rule about dose adjustments.",
    retrievalTerms: ["dose adjustment", "methods"],
    retrievalSnippets: ["Check whether dose adjustments are disclosed in methods."],
  });
  await service.confirmSemanticLayer(created.selected_revision.id);

  const updated = await service.updateRevisionDraft(created.selected_revision.id, {
    canonicalText:
      "Clinical studies must report dose adjustments and protocol deviations in methods.",
  });

  assert.equal(updated.selected_revision.semantic_layer?.status, "stale");

  const detail = await service.getKnowledgeAsset(
    created.asset.id,
    created.selected_revision.id,
  );
  assert.equal(detail.selected_revision.semantic_layer?.status, "stale");
  assert.equal(
    detail.selected_revision.semantic_layer?.page_summary,
    "AI extracted a screening rule about dose adjustments.",
  );
});

test("archived knowledge assets can be restored into a safe draft recovery state", async () => {
  const { service } = createKnowledgeLibraryHarness();

  const created = await service.createLibraryDraft({
    title: "Recoverable endpoint rule",
    canonicalText: "Clinical studies must disclose the primary endpoint.",
    knowledgeKind: "rule",
    moduleScope: "screening",
    manuscriptTypes: ["clinical_study"],
  });

  await service.submitRevisionForReview(created.selected_revision.id);
  await service.approveRevision(created.selected_revision.id, "knowledge_reviewer");
  await service.archive(created.asset.id);

  const restored = await service.restore(created.asset.id);
  assertKnowledgeAssetDetailRecord(restored);

  assert.equal(restored.asset.status, "active");
  assert.equal(restored.asset.current_revision_id, created.selected_revision.id);
  assert.equal(restored.asset.current_approved_revision_id, undefined);
  assert.equal(restored.selected_revision.id, created.selected_revision.id);
  assert.equal(restored.selected_revision.status, "draft");
  assert.equal(restored.current_approved_revision, undefined);
});

test("archive and restore actions are recorded for recycle-bin visibility", async () => {
  const { service } = createKnowledgeLibraryHarness();

  const created = await service.createLibraryDraft({
    title: "Recoverable terminology rule",
    canonicalText: "Review manuscripts should use standardized terminology.",
    knowledgeKind: "reference",
    moduleScope: "editing",
    manuscriptTypes: ["review"],
  });

  await service.archive(created.asset.id);
  await service.restore(created.asset.id);

  const history = await service.listReviewActions(created.asset.id);

  assert.deepEqual(
    history.map((record) => ({
      action: record.action,
      actor_role: record.actor_role,
    })),
    [
      {
        action: "archived",
        actor_role: "user",
      },
      {
        action: "restored",
        actor_role: "user",
      },
    ],
  );
});

test("non-authoritative table exact-capture evidence cannot be submitted for review", async () => {
  const { service } = createKnowledgeLibraryHarness();

  const created = await service.createLibraryDraft({
    title: "Table exact-capture gate",
    canonicalText: "Runtime table guidance must carry authoritative exact-capture evidence.",
    knowledgeKind: "reference",
    moduleScope: "editing",
    manuscriptTypes: ["review"],
  });

  await service.replaceRevisionContentBlocks(created.selected_revision.id, {
    blocks: [buildNonAuthoritativeTableBlock()],
  });

  await assert.rejects(
    () => service.submitRevisionForReview(created.selected_revision.id),
    (error) => {
      assert.ok(error instanceof KnowledgeRevisionReviewGateError);
      assert.match(error.message, /exact_capture_not_authoritative/);
      return true;
    },
  );

  const detail = await service.getKnowledgeAsset(
    created.asset.id,
    created.selected_revision.id,
  );
  assert.equal(detail.selected_revision.status, "draft");
});

test("authoritative table exact-capture evidence completes the review lifecycle", async () => {
  const { service } = createKnowledgeLibraryHarness();

  const created = await service.createLibraryDraft({
    title: "Authoritative table exact-capture",
    canonicalText: "Approved table knowledge must preserve exact formatting evidence.",
    knowledgeKind: "reference",
    moduleScope: "editing",
    manuscriptTypes: ["review"],
  });

  await service.replaceRevisionContentBlocks(created.selected_revision.id, {
    blocks: [buildAuthoritativeTableBlock()],
  });

  const submitted = await service.submitRevisionForReview(created.selected_revision.id);
  const approved = await service.approveRevision(
    created.selected_revision.id,
    "knowledge_reviewer",
  );

  assert.equal(submitted.selected_revision.status, "pending_review");
  assert.equal(approved.selected_revision.status, "approved");
});

test("pending visual-symbol evidence can be submitted but cannot be approved", async () => {
  const { service } = createKnowledgeLibraryHarness();

  const created = await service.createLibraryDraft({
    title: "Visual symbol gate",
    canonicalText: "Image-based symbol evidence must be reviewed before approval.",
    knowledgeKind: "reference",
    moduleScope: "proofreading",
    manuscriptTypes: ["clinical_study"],
  });

  await service.replaceRevisionContentBlocks(created.selected_revision.id, {
    blocks: [buildVisualSymbolImageBlock("pending_review")],
  });

  const submitted = await service.submitRevisionForReview(created.selected_revision.id);
  assert.equal(submitted.selected_revision.status, "pending_review");

  await assert.rejects(
    () => service.approveRevision(created.selected_revision.id, "knowledge_reviewer"),
    (error) => {
      assert.ok(error instanceof KnowledgeRevisionReviewGateError);
      assert.match(error.message, /review_state must be confirmed before approval/);
      return true;
    },
  );

  const detail = await service.getKnowledgeAsset(
    created.asset.id,
    created.selected_revision.id,
  );
  assert.equal(detail.selected_revision.status, "pending_review");
});

test("confirmed visual-symbol evidence can be approved", async () => {
  const { service } = createKnowledgeLibraryHarness();

  const created = await service.createLibraryDraft({
    title: "Confirmed visual symbol evidence",
    canonicalText: "Confirmed object-type symbol evidence may become runtime knowledge.",
    knowledgeKind: "reference",
    moduleScope: "proofreading",
    manuscriptTypes: ["clinical_study"],
  });

  await service.replaceRevisionContentBlocks(created.selected_revision.id, {
    blocks: [buildVisualSymbolImageBlock("confirmed")],
  });

  await service.submitRevisionForReview(created.selected_revision.id);
  const approved = await service.approveRevision(
    created.selected_revision.id,
    "knowledge_reviewer",
  );

  assert.equal(approved.selected_revision.status, "approved");
});
