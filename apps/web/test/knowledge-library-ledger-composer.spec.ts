import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAiIntakeSuggestion,
  buildCreateDraftInput,
  createLedgerComposerFromDraftPrefill,
  createEmptyLedgerComposer,
} from "../src/features/knowledge-library/knowledge-library-ledger-composer.ts";

test("knowledge ledger composer starts as an unsaved local draft with stable defaults", () => {
  const composer = createEmptyLedgerComposer();

  assert.equal(composer.mode, "new_local");
  assert.equal(composer.persistedAssetId, null);
  assert.equal(composer.persistedRevisionId, null);
  assert.equal(composer.draft.title, "");
  assert.equal(composer.draft.canonicalText, "");
  assert.equal(composer.draft.knowledgeKind, "reference");
  assert.equal(composer.draft.moduleScope, "any");
  assert.equal(composer.draft.manuscriptTypes, "any");
  assert.equal(composer.draft.evidenceLevel, "unknown");
  assert.equal(composer.draft.sourceType, "other");
  assert.deepEqual(composer.contentBlocksDraft, []);
  assert.equal(composer.semanticLayerDraft, undefined);
});

test("knowledge ledger composer applies AI intake suggestions into the local working draft", () => {
  const composer = createEmptyLedgerComposer();

  const nextComposer = applyAiIntakeSuggestion(composer, {
    suggestedDraft: {
      title: "Primary endpoint rule",
      canonicalText: "Clinical studies must define the primary endpoint.",
      summary: "Screening-facing primary endpoint requirement.",
      knowledgeKind: "rule",
      moduleScope: "screening",
      manuscriptTypes: ["clinical_study"],
      sections: ["methods"],
      aliases: ["endpoint definition"],
    },
    suggestedContentBlocks: [
      {
        id: "suggested-block-1",
        revision_id: "local-only",
        block_type: "text_block",
        order_no: 0,
        status: "active",
        content_payload: {
          text: "AI-curated intake explanation for the endpoint requirement.",
        },
      },
    ],
    suggestedSemanticLayer: {
      revision_id: "local-only",
      status: "pending_confirmation",
      page_summary: "Use this rule while screening endpoint reporting.",
      retrieval_terms: ["primary endpoint", "screening"],
      retrieval_snippets: ["Flag manuscripts that omit the primary endpoint."],
    },
    warnings: ["Source text did not include an evidence level."],
  });

  assert.equal(nextComposer.mode, "new_local");
  assert.equal(nextComposer.draft.title, "Primary endpoint rule");
  assert.deepEqual(nextComposer.draft.manuscriptTypes, ["clinical_study"]);
  assert.equal(nextComposer.contentBlocksDraft.length, 1);
  assert.equal(
    nextComposer.semanticLayerDraft?.page_summary,
    "Use this rule while screening endpoint reporting.",
  );
});

test("knowledge ledger composer builds a create-draft payload from the current local state", () => {
  const composer = applyAiIntakeSuggestion(createEmptyLedgerComposer(), {
    suggestedDraft: {
      title: "Primary endpoint rule",
      canonicalText: "Clinical studies must define the primary endpoint.",
      knowledgeKind: "rule",
      moduleScope: "screening",
      manuscriptTypes: ["clinical_study"],
      sections: ["methods"],
      riskTags: ["completeness"],
      disciplineTags: ["oncology"],
    },
    suggestedContentBlocks: [],
    warnings: [],
  });

  assert.deepEqual(buildCreateDraftInput(composer), {
    title: "Primary endpoint rule",
    canonicalText: "Clinical studies must define the primary endpoint.",
    knowledgeKind: "rule",
    moduleScope: "screening",
    manuscriptTypes: ["clinical_study"],
    evidenceLevel: "unknown",
    sourceType: "other",
    sections: ["methods"],
    riskTags: ["completeness"],
    disciplineTags: ["oncology"],
  });
});

test("knowledge ledger composer can start from a structured draft prefill", () => {
  const composer = createLedgerComposerFromDraftPrefill({
    title: "\u671f\u520a\u8868\u683c\u6837\u5f0f\u4f9d\u636e",
    canonicalText:
      "\u8bf7\u6574\u7406\u671f\u520a\u6216\u79d1\u7ea6\u5bf9\u8868\u9898\u4f4d\u7f6e\u3001\u8868\u6ce8\u4f4d\u7f6e\u3001\u7ebf\u578b\u4e0e\u7f16\u53f7\u6837\u5f0f\u7684\u4f9d\u636e\u3002",
    summary:
      "\u7528\u4e8e\u6c89\u6dc0\u8868\u683c\u6821\u5bf9\u6240\u9700\u7684\u671f\u520a\u6837\u5f0f\u4f9d\u636e\u3002",
    knowledgeKind: "reference",
    moduleScope: "proofreading",
    manuscriptTypes: "any",
    sections: ["tables"],
    riskTags: ["table-style", "layout"],
    evidenceLevel: "high",
    sourceType: "guideline",
  });

  assert.equal(composer.mode, "new_local");
  assert.equal(composer.persistedAssetId, null);
  assert.equal(composer.persistedRevisionId, null);
  assert.equal(composer.draft.title, "\u671f\u520a\u8868\u683c\u6837\u5f0f\u4f9d\u636e");
  assert.equal(composer.draft.knowledgeKind, "reference");
  assert.equal(composer.draft.moduleScope, "proofreading");
  assert.deepEqual(composer.draft.sections, ["tables"]);
  assert.deepEqual(composer.draft.riskTags, ["table-style", "layout"]);
  assert.equal(composer.draft.evidenceLevel, "high");
  assert.equal(composer.draft.sourceType, "guideline");
});
