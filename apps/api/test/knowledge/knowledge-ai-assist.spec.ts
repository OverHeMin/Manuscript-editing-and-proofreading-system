import test from "node:test";
import assert from "node:assert/strict";
import {
  InMemoryKnowledgeRepository,
  InMemoryKnowledgeReviewActionRepository,
} from "../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import {
  KnowledgeAiAssistService,
  KnowledgeAiAssistUnavailableError,
} from "../../src/modules/knowledge/knowledge-ai-assist-service.ts";
import { KnowledgeService } from "../../src/modules/knowledge/knowledge-service.ts";

function createKnowledgeAiAssistHarness() {
  const repository = new InMemoryKnowledgeRepository();
  const reviewActionRepository = new InMemoryKnowledgeReviewActionRepository();
  let nextId = 1;

  const knowledgeService = new KnowledgeService({
    repository,
    reviewActionRepository,
    createId: () => `knowledge-${nextId++}`,
    now: () => new Date("2026-04-13T09:00:00.000Z"),
  });

  return {
    repository,
    reviewActionRepository,
    knowledgeService,
  };
}

test("knowledge ai assist returns intake suggestions without persisting a draft", async () => {
  const { repository } = createKnowledgeAiAssistHarness();
  const service = new KnowledgeAiAssistService({
    repository,
    generator: {
      async createIntakeSuggestion() {
        return {
          suggestedDraft: {
            title: "Primary endpoint rule",
            canonicalText: "Clinical studies must define the primary endpoint.",
            knowledgeKind: "rule",
            moduleScope: "screening",
            manuscriptTypes: ["clinical_study"],
          },
          suggestedContentBlocks: [],
          warnings: ["No evidence level found in the source text."],
        };
      },
      async assistSemanticLayer() {
        throw new Error("not used in this test");
      },
    },
  });

  const beforeAssets = await repository.listAssets();
  const result = await service.createIntakeSuggestion({
    sourceText:
      "Clinical studies must define the primary endpoint before screening sign-off.",
    sourceLabel: "Guideline excerpt",
  });
  const afterAssets = await repository.listAssets();

  assert.equal(result.suggestedDraft.title, "Primary endpoint rule");
  assert.deepEqual(result.suggestedContentBlocks, []);
  assert.equal(beforeAssets.length, 0);
  assert.equal(afterAssets.length, 0);
});

test("knowledge ai assist returns semantic patch suggestions without mutating the revision", async () => {
  const { repository, knowledgeService } = createKnowledgeAiAssistHarness();
  const created = await knowledgeService.createLibraryDraft({
    title: "Primary endpoint rule",
    canonicalText: "Clinical studies must define the primary endpoint.",
    summary: "Initial summary",
    knowledgeKind: "rule",
    moduleScope: "screening",
    manuscriptTypes: ["clinical_study"],
  });

  const service = new KnowledgeAiAssistService({
    repository,
    generator: {
      async createIntakeSuggestion() {
        throw new Error("not used in this test");
      },
      async assistSemanticLayer() {
        return {
          suggestedSemanticLayer: {
            pageSummary: "Operator-ready semantic summary",
            retrievalTerms: ["primary endpoint", "screening"],
            retrievalSnippets: ["Prefer this rule when endpoint wording is vague."],
          },
          suggestedFieldPatch: {
            summary: "Updated summary for semantic retrieval.",
            aliases: ["endpoint definition"],
          },
          warnings: ["Title remains user-owned in semantic assist."],
        };
      },
    },
  });

  const beforeRevision = await knowledgeService.getKnowledgeAsset(
    created.asset.id,
    created.selected_revision.id,
  );
  const result = await service.assistSemanticLayer({
    revisionId: created.selected_revision.id,
    instructionText: "Broaden retrieval language without changing title ownership.",
    targetScopes: ["semantic_layer", "metadata_patch"],
  });
  const afterRevision = await knowledgeService.getKnowledgeAsset(
    created.asset.id,
    created.selected_revision.id,
  );

  assert.equal(
    result.suggestedSemanticLayer.pageSummary,
    "Operator-ready semantic summary",
  );
  assert.deepEqual(result.suggestedFieldPatch?.aliases, ["endpoint definition"]);
  assert.equal(beforeRevision.selected_revision.summary, "Initial summary");
  assert.equal(afterRevision.selected_revision.summary, "Initial summary");
});

test("knowledge ai assist fails with an explicit unavailable error when no generator is configured", async () => {
  const { repository } = createKnowledgeAiAssistHarness();
  const service = new KnowledgeAiAssistService({
    repository,
  });

  await assert.rejects(
    () =>
      service.createIntakeSuggestion({
        sourceText: "Primary endpoint text",
      }),
    (error: unknown) => {
      assert.ok(error instanceof KnowledgeAiAssistUnavailableError);
      return true;
    },
  );
});
