import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyLedgerComposer } from "../src/features/knowledge-library/knowledge-library-ledger-composer.ts";
import {
  applyKnowledgeLibrarySemanticSuggestion,
  buildKnowledgeLibrarySemanticAnalysisNotes,
  generateKnowledgeLibrarySemanticSuggestion,
} from "../src/features/knowledge-library/knowledge-library-semantic-generation.ts";

test("new local knowledge entries generate semantic suggestions through the intake flow", async () => {
  const composer = createEmptyLedgerComposer();
  const requests: Array<Record<string, unknown>> = [];

  const result = await generateKnowledgeLibrarySemanticSuggestion({
    controller: {
      async createAiIntakeSuggestion(input) {
        requests.push({
          route: "intake",
          input,
        });

        return {
          suggestedDraft: {
            title: "Primary endpoint rule",
            canonicalText: "Clinical studies must define the primary endpoint.",
            knowledgeKind: "reference",
            moduleScope: "screening",
            manuscriptTypes: ["clinical_study"],
            summary: "Screening summary",
            aliases: ["endpoint definition"],
            riskTags: ["endpoint"],
          },
          suggestedContentBlocks: [],
          suggestedSemanticLayer: {
            revision_id: "local-draft",
            status: "pending_confirmation",
            page_summary: "Semantic summary",
            retrieval_terms: ["primary endpoint"],
            retrieval_snippets: ["Use when endpoint wording is vague."],
          },
          warnings: ["Generated from intake flow."],
        };
      },
      async assistSemanticLayer() {
        throw new Error("semantic assist should not be used for local-only drafts");
      },
    },
    composer,
    sourceText: "Clinical studies must define the primary endpoint.",
  });

  assert.equal(result.kind, "intake");
  assert.deepEqual(requests, [
    {
      route: "intake",
      input: {
        sourceText: "Clinical studies must define the primary endpoint.",
        operatorHints:
          "请重点返回语义摘要、检索词、适用场景，以及必要的摘要、别名和风险标签建议，不要改写标题。",
      },
    },
  ]);
});

test("persisted knowledge drafts generate semantic suggestions through semantic assist", async () => {
  const composer = {
    ...createEmptyLedgerComposer(),
    persistedAssetId: "knowledge-1",
    persistedRevisionId: "revision-1",
    draft: {
      ...createEmptyLedgerComposer().draft,
      title: "Primary endpoint rule",
      canonicalText: "Clinical studies must define the primary endpoint.",
      summary: "Original summary",
    },
  };
  const requests: Array<Record<string, unknown>> = [];

  const result = await generateKnowledgeLibrarySemanticSuggestion({
    controller: {
      async createAiIntakeSuggestion() {
        throw new Error("intake should not be used once a revision exists");
      },
      async assistSemanticLayer(input) {
        requests.push({
          route: "assist",
          input,
        });

        return {
          suggestedSemanticLayer: {
            pageSummary: "Operator-ready semantic summary",
            retrievalTerms: ["primary endpoint", "screening"],
            retrievalSnippets: ["Prefer this rule when endpoint wording is vague."],
          },
          suggestedFieldPatch: {
            summary: "Updated summary",
            aliases: ["endpoint definition"],
          },
          warnings: ["Generated from semantic assist."],
        };
      },
    },
    composer,
    sourceText: "This source text should be ignored once the draft is persisted.",
  });

  assert.equal(result.kind, "assist");
  assert.deepEqual(requests, [
    {
      route: "assist",
      input: {
        revisionId: "revision-1",
        instructionText:
          "请基于当前知识草稿补全语义摘要、检索词与适用场景；必要时补充摘要、别名、风险标签和学科标签，但不要改写标题。",
        targetScopes: ["semantic_layer", "metadata_patch"],
      },
    },
  ]);
});

test("semantic assist suggestions merge semantic and metadata patches back into the composer", () => {
  const composer = {
    ...createEmptyLedgerComposer(),
    persistedAssetId: "knowledge-1",
    persistedRevisionId: "revision-1",
    draft: {
      ...createEmptyLedgerComposer().draft,
      title: "Primary endpoint rule",
      canonicalText: "Clinical studies must define the primary endpoint.",
      summary: "Original summary",
      aliases: ["legacy alias"],
      riskTags: ["legacy risk"],
      sections: ["methods"],
      disciplineTags: ["oncology"],
    },
    semanticLayerDraft: {
      revision_id: "revision-1",
      status: "confirmed" as const,
      page_summary: "Old semantic summary",
      retrieval_terms: ["old term"],
      retrieval_snippets: ["old snippet"],
    },
    warnings: ["existing warning"],
  };

  const nextComposer = applyKnowledgeLibrarySemanticSuggestion(composer, {
    kind: "assist",
    suggestion: {
      suggestedSemanticLayer: {
        pageSummary: "Operator-ready semantic summary",
        retrievalTerms: ["primary endpoint", "screening"],
        retrievalSnippets: ["Prefer this rule when endpoint wording is vague."],
      },
      suggestedFieldPatch: {
        summary: "Updated summary",
        aliases: ["endpoint definition"],
        riskTags: ["endpoint"],
        sections: ["methods", "results"],
        disciplineTags: ["cardiology"],
      },
      warnings: ["Generated from semantic assist."],
    },
  });

  assert.equal(nextComposer.draft.summary, "Updated summary");
  assert.deepEqual(nextComposer.draft.aliases, ["endpoint definition"]);
  assert.deepEqual(nextComposer.draft.riskTags, ["endpoint"]);
  assert.deepEqual(nextComposer.draft.sections, ["methods", "results"]);
  assert.deepEqual(nextComposer.draft.disciplineTags, ["cardiology"]);
  assert.equal(nextComposer.semanticLayerDraft?.status, "pending_confirmation");
  assert.equal(
    nextComposer.semanticLayerDraft?.page_summary,
    "Operator-ready semantic summary",
  );
  assert.deepEqual(nextComposer.semanticLayerDraft?.retrieval_terms, [
    "primary endpoint",
    "screening",
  ]);
  assert.deepEqual(nextComposer.warnings, [
    "existing warning",
    "Generated from semantic assist.",
  ]);
});

test("semantic analysis notes explain which materials were sent to AI", () => {
  const composer = {
    ...createEmptyLedgerComposer(),
    draft: {
      ...createEmptyLedgerComposer().draft,
      title: "Primary endpoint rule",
      canonicalText: "Clinical studies must define the primary endpoint.",
      summary: "Original summary",
      aliases: ["endpoint definition"],
      riskTags: ["endpoint"],
    },
    contentBlocksDraft: [
      {
        id: "text-1",
        revision_id: "local-draft",
        block_type: "text_block" as const,
        order_no: 0,
        status: "active" as const,
        content_payload: {
          text: "Supporting note",
        },
      },
      {
        id: "table-1",
        revision_id: "local-draft",
        block_type: "table_block" as const,
        order_no: 1,
        status: "active" as const,
        content_payload: {
          rows: [["A", "B"]],
        },
      },
      {
        id: "image-1",
        revision_id: "local-draft",
        block_type: "image_block" as const,
        order_no: 2,
        status: "active" as const,
        content_payload: {
          file_name: "figure-1.png",
          caption: "Primary endpoint flowchart",
        },
      },
    ],
  };

  const notes = buildKnowledgeLibrarySemanticAnalysisNotes({
    composer,
    autoPersistedDraft: true,
  });

  assert.deepEqual(notes, [
    "本次分析已带入：标题、标准答案、补充说明、别名、风险标签。",
    "本次分析同步参考了：1个文本块、1个表格块、1张图片。",
    "图片附件：figure-1.png。",
    "系统已先保存当前草稿，以便把材料块和附件一起带入 AI 分析。",
  ]);
});
