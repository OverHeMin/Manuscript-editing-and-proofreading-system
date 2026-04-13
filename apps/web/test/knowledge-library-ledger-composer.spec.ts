import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAiIntakeSuggestion,
  buildCreateDraftInput,
  createEmptyLedgerComposer,
} from "../src/features/knowledge-library/knowledge-library-ledger-composer.ts";

test("knowledge ledger composer starts as an unsaved local draft with stable defaults", () => {
  const composer = createEmptyLedgerComposer();

  assert.equal(composer.mode, "new_local");
  assert.equal(composer.persistedAssetId, null);
  assert.equal(composer.persistedRevisionId, null);
  assert.equal(composer.draft.title, "");
  assert.equal(composer.draft.canonicalText, "");
  assert.equal(composer.draft.knowledgeKind, "rule");
  assert.equal(composer.draft.moduleScope, "any");
  assert.equal(composer.draft.manuscriptTypes, "any");
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
    sections: ["methods"],
    riskTags: ["completeness"],
    disciplineTags: ["oncology"],
  });
});
