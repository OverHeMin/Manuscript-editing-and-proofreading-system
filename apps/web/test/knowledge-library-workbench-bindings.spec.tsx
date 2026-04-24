import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

register(new URL("./helpers/ignore-css-loader.mjs", import.meta.url), import.meta.url);

const {
  KnowledgeLibraryWorkbenchPage,
  createKnowledgeLibraryDraftInput,
  createKnowledgeLibraryFormState,
} = await import("../src/features/knowledge-library/knowledge-library-workbench-page.tsx");

function createKnowledgeLibraryDetail() {
  const selectedRevision = {
    id: "knowledge-1-revision-2",
    asset_id: "knowledge-1",
    revision_no: 2,
    status: "draft" as const,
    title: "术语统一说明",
    canonical_text: "全文术语和缩写需要前后一致。",
    summary: "用于编辑和校对阶段的术语统一。",
    knowledge_kind: "reference" as const,
    routing: {
      module_scope: "editing" as const,
      manuscript_types: ["clinical_study"] as const,
      sections: ["abstract", "discussion"],
      risk_tags: ["terminology"],
      discipline_tags: ["oncology"],
    },
    evidence_level: "high" as const,
    source_type: "guideline" as const,
    source_link: "https://example.com/guideline",
    aliases: ["术语统一"],
    effective_at: "2026-04-01T00:00:00.000Z",
    expires_at: undefined,
    based_on_revision_id: "knowledge-1-revision-1",
    content_blocks: [],
    semantic_layer: undefined,
    bindings: [
      {
        id: "binding-1",
        revision_id: "knowledge-1-revision-2",
        binding_kind: "general_package" as const,
        binding_target_id: "general-package-1",
        binding_target_label: "通用包 A",
        created_at: "2026-04-01T00:00:00.000Z",
      },
      {
        id: "binding-2",
        revision_id: "knowledge-1-revision-2",
        binding_kind: "knowledge_item" as const,
        binding_target_id: "knowledge-2",
        binding_target_label: "统计学说明",
        created_at: "2026-04-01T00:00:00.000Z",
      },
    ],
    contributor_label: "editor.zh",
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
  };

  return {
    asset: {
      id: "knowledge-1",
      status: "active" as const,
      current_revision_id: "knowledge-1-revision-2",
      current_approved_revision_id: "knowledge-1-revision-1",
      contributor_label: "editor.zh",
      created_at: "2026-04-01T00:00:00.000Z",
      updated_at: "2026-04-01T00:00:00.000Z",
    },
    selected_revision: selectedRevision,
    current_approved_revision: {
      ...selectedRevision,
      id: "knowledge-1-revision-1",
      revision_no: 1,
      status: "approved" as const,
      bindings: [],
    },
    revisions: [
      {
        ...selectedRevision,
        id: "knowledge-1-revision-1",
        revision_no: 1,
        status: "approved" as const,
        bindings: [],
      },
      selectedRevision,
    ],
  };
}

function createWorkbenchViewModel() {
  const detail = createKnowledgeLibraryDetail();
  const selectedSummary = {
    id: "knowledge-1",
    title: "术语统一说明",
    summary: "用于编辑和校对阶段的术语统一。",
    knowledge_kind: "reference" as const,
    status: "draft" as const,
    module_scope: "editing" as const,
    manuscript_types: ["clinical_study"] as const,
    selected_revision_id: "knowledge-1-revision-2",
    semantic_status: "confirmed" as const,
    content_block_count: 0,
    contributor_label: "editor.zh",
    updated_at: "2026-04-01T00:00:00.000Z",
  };

  return {
    library: [
      selectedSummary,
      {
        id: "knowledge-2",
        title: "统计学说明",
        summary: "卡方检验符号与统计量格式。",
        knowledge_kind: "reference" as const,
        status: "approved" as const,
        module_scope: "proofreading" as const,
        manuscript_types: ["clinical_study"] as const,
        selected_revision_id: "knowledge-2-revision-1",
        semantic_status: "confirmed" as const,
        content_block_count: 0,
        contributor_label: "editor.zh",
        updated_at: "2026-04-02T00:00:00.000Z",
      },
    ],
    visibleLibrary: [selectedSummary],
    filters: {
      searchText: "",
      queryMode: "keyword" as const,
      knowledgeKind: "all" as const,
      moduleScope: "any" as const,
      semanticStatus: "all" as const,
      contributorText: "",
      assetStatus: "all" as const,
    },
    selectedAssetId: "knowledge-1",
    selectedRevisionId: "knowledge-1-revision-2",
    selectedSummary,
    detail,
  };
}

test("knowledge library form state maps revision bindings into structured selections", () => {
  const state = createKnowledgeLibraryFormState(createKnowledgeLibraryDetail());

  assert.deepEqual(state.bindings, [
    {
      bindingKind: "general_package",
      bindingTargetId: "general-package-1",
      bindingTargetLabel: "通用包 A",
    },
    {
      bindingKind: "knowledge_item",
      bindingTargetId: "knowledge-2",
      bindingTargetLabel: "统计学说明",
    },
  ]);
});

test("knowledge library draft input submits normalized structured bindings", () => {
  const draftInput = createKnowledgeLibraryDraftInput({
    title: " 术语统一说明 ",
    canonicalText: " 全文术语和缩写需要前后一致。 ",
    summary: "",
    knowledgeKind: "reference",
    moduleScope: "editing",
    manuscriptTypes: ["clinical_study"],
    sections: [],
    riskTags: [],
    disciplineTags: [],
    aliases: [],
    evidenceLevel: "high",
    sourceType: "guideline",
    sourceLink: "",
    effectiveAt: "",
    expiresAt: "",
    bindings: [
      {
        bindingKind: "general_package",
        bindingTargetId: " general-package-1 ",
        bindingTargetLabel: " 通用包 A ",
      },
      {
        bindingKind: "general_package",
        bindingTargetId: "general-package-1",
        bindingTargetLabel: "重复标签不会覆盖首个绑定",
      },
      {
        bindingKind: "knowledge_item",
        bindingTargetId: "knowledge-2",
        bindingTargetLabel: "统计学说明",
      },
    ],
  });

  assert.deepEqual(draftInput.bindings, [
    {
      bindingKind: "general_package",
      bindingTargetId: "general-package-1",
      bindingTargetLabel: "通用包 A（锁定具体版本）",
    },
    {
      bindingKind: "knowledge_item",
      bindingTargetId: "knowledge-2",
      bindingTargetLabel: "统计学说明",
    },
  ]);
});

test("knowledge library draft input keeps package-kind fallback bindings intact", () => {
  const draftInput = createKnowledgeLibraryDraftInput({
    title: "规则依据",
    canonicalText: "当运行时质量包变化但种类不变时仍然适用。",
    summary: "",
    knowledgeKind: "reference",
    moduleScope: "editing",
    manuscriptTypes: ["clinical_study"],
    sections: [],
    riskTags: [],
    disciplineTags: [],
    aliases: [],
    evidenceLevel: "high",
    sourceType: "guideline",
    sourceLink: "",
    effectiveAt: "",
    expiresAt: "",
    bindings: [
      {
        bindingKind: "general_package",
        bindingTargetId: "general_style_package",
        bindingTargetLabel: "按通用包类型激活（不锁版本）",
      },
    ],
  });

  assert.deepEqual(draftInput.bindings, [
    {
      bindingKind: "general_package",
      bindingTargetId: "general_style_package",
      bindingTargetLabel: "按通用包类型激活（不锁版本）",
    },
  ]);
});

test("knowledge library workbench preserves selected bindings when catalog data is absent", () => {
  const Page = KnowledgeLibraryWorkbenchPage as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    <Page initialViewModel={createWorkbenchViewModel()} />,
  );

  assert.match(markup, /data-knowledge-binding-multi-select="binding-general-packages"/u);
  assert.match(markup, /通用包 A（锁定具体版本）/u);
  assert.match(markup, /已绑定但当前目录未返回/u);
  assert.match(markup, /统计学说明/u);
});
