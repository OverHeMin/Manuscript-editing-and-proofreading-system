import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import {
  InMemoryKnowledgeRepository,
  InMemoryKnowledgeReviewActionRepository,
} from "../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import {
  KnowledgeAiAssistService,
  KnowledgeAiAssistUnavailableError,
  OpenAiKnowledgeAiAssistGenerator,
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

test("knowledge ai assist passes confirmed table evidence packages to the generator", async () => {
  const { repository, knowledgeService } = createKnowledgeAiAssistHarness();
  const created = await knowledgeService.createLibraryDraft({
    title: "Three-line table rule",
    canonicalText: "Clinical tables should preserve confirmed rich table evidence.",
    knowledgeKind: "reference",
    moduleScope: "editing",
    manuscriptTypes: ["clinical_study"],
  });
  const confirmedPackage = {
    authority: "authoritative",
    table_evidence_revision_id: "rev-confirmed",
    facts: {
      layout: {
        preserve_boundaries: true,
      },
    },
  };
  let capturedInput: Record<string, unknown> | undefined;

  const service = new KnowledgeAiAssistService({
    repository,
    tableEvidenceService: {
      async assertConfirmedRevision() {
        throw new Error("not used in this test");
      },
      async resolveConfirmedPackagesForTarget(targetType, targetId) {
        assert.equal(targetType, "knowledge_revision");
        assert.equal(targetId, created.selected_revision.id);
        return [confirmedPackage] as never;
      },
    },
    generator: {
      async createIntakeSuggestion() {
        throw new Error("not used in this test");
      },
      async assistSemanticLayer(input) {
        capturedInput = input as unknown as Record<string, unknown>;
        return {
          suggestedSemanticLayer: {
            pageSummary: "Use confirmed package evidence only.",
          },
          warnings: [],
        };
      },
    },
  });

  await service.assistSemanticLayer({
    revisionId: created.selected_revision.id,
    instructionText: "Summarize confirmed table handling.",
  });

  assert.deepEqual(capturedInput?.confirmedTablePackages, [confirmedPackage]);
  assert.match(
    String(capturedInput?.tableEvidenceInstruction ?? ""),
    /Use confirmed_table_packages as authoritative table evidence/u,
  );
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

test("openai knowledge ai assist includes confirmed table evidence packages in semantic requests", async () => {
  let capturedBody: Record<string, unknown> | null = null;
  const confirmedPackage = {
    authority: "authoritative",
    table_evidence_revision_id: "rev-confirmed",
    facts: {
      typography: {
        preserve_superscript: true,
      },
    },
  };
  const generator = new OpenAiKnowledgeAiAssistGenerator({
    aiGatewayService: {
      async resolveModelSelection() {
        return {} as never;
      },
    },
    aiProviderRuntimeService: {
      async resolveSelectionRuntime() {
        return {
          primary: {
            request_url: "http://example.test/v1/chat/completions",
            headers: {
              Authorization: "Bearer test-key",
              "Content-Type": "application/json",
            },
            model_name: "gpt-4o-mini",
          },
        } as never;
      },
    },
    fetch: async (_url, init) => {
      capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<
        string,
        unknown
      >;
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestedSemanticLayer: {
                    pageSummary: "Operator-ready semantic summary",
                  },
                  warnings: [],
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    },
  });

  await generator.assistSemanticLayer({
    revision: {
      id: "revision-1",
      asset_id: "knowledge-1",
      revision_no: 1,
      status: "draft",
      title: "Three-line table rule",
      canonical_text: "Clinical tables should preserve confirmed rich table evidence.",
      knowledge_kind: "reference",
      routing: {
        module_scope: "editing",
        manuscript_types: ["clinical_study"],
      },
      created_at: "2026-04-13T09:00:00.000Z",
      updated_at: "2026-04-13T09:00:00.000Z",
    },
    contentBlocks: [],
    instructionText: "Analyze confirmed table evidence.",
    confirmedTablePackages: [confirmedPackage] as never,
    tableEvidenceInstruction:
      "Use confirmed_table_packages as authoritative table evidence.",
  });

  if (!capturedBody) {
    throw new Error("Expected AI request payload to be captured.");
  }
  const messages = (capturedBody as { messages: Array<Record<string, unknown>> })
    .messages;
  const userPayload = JSON.parse(String(messages[1]?.content ?? "{}")) as Record<
    string,
    unknown
  >;

  assert.deepEqual(userPayload.confirmed_table_packages, [confirmedPackage]);
  assert.match(
    String(userPayload.table_evidence_instruction ?? ""),
    /Use confirmed_table_packages as authoritative table evidence/u,
  );
});

test("openai knowledge ai assist inlines uploaded images into multimodal semantic requests", async () => {
  const uploadRootDir = await mkdtemp(
    path.join(os.tmpdir(), "knowledge-ai-assist-images-"),
  );

  try {
    const storageKey = "uploads/2026/04/22/figure-1.png";
    const absolutePath = path.join(
      uploadRootDir,
      "uploads",
      "2026",
      "04",
      "22",
      "figure-1.png",
    );
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, Buffer.from("fake-image-payload"));

    let capturedBody: Record<string, unknown> | null = null;
    const generator = new OpenAiKnowledgeAiAssistGenerator({
      aiGatewayService: {
        async resolveModelSelection() {
          return {} as never;
        },
      },
      aiProviderRuntimeService: {
        async resolveSelectionRuntime() {
          return {
            primary: {
              request_url: "http://example.test/v1/chat/completions",
              headers: {
                Authorization: "Bearer test-key",
                "Content-Type": "application/json",
              },
              model_name: "gpt-4o-mini",
            },
          } as never;
        },
      },
      uploadRootDir,
      fetch: async (_url, init) => {
        capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    suggestedSemanticLayer: {
                      pageSummary: "Operator-ready semantic summary",
                      retrievalTerms: ["primary endpoint"],
                      retrievalSnippets: ["Use when endpoint wording is vague."],
                    },
                    warnings: [],
                  }),
                },
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      },
    });

    const result = await generator.assistSemanticLayer({
      revision: {
        id: "revision-1",
        asset_id: "knowledge-1",
        revision_no: 1,
        status: "draft",
        title: "Primary endpoint rule",
        canonical_text: "Clinical studies must define the primary endpoint.",
        knowledge_kind: "reference",
        routing: {
          module_scope: "screening",
          manuscript_types: ["clinical_study"],
        },
        created_at: "2026-04-13T09:00:00.000Z",
        updated_at: "2026-04-13T09:00:00.000Z",
      },
      contentBlocks: [
        {
          id: "image-block-1",
          revision_id: "revision-1",
          block_type: "image_block",
          order_no: 0,
          status: "active",
          content_payload: {
            storage_key: storageKey,
            file_name: "figure-1.png",
            mime_type: "image/png",
            caption: "Primary endpoint flowchart",
          },
          created_at: "2026-04-13T09:00:00.000Z",
          updated_at: "2026-04-13T09:00:00.000Z",
        },
      ],
      instructionText: "Analyze the image alongside the draft.",
      targetScopes: ["semantic_layer"],
    });

    assert.equal(
      result.suggestedSemanticLayer.pageSummary,
      "Operator-ready semantic summary",
    );
    if (!capturedBody) {
      throw new Error("Expected AI request payload to be captured.");
    }
    const requestPayload = capturedBody as {
      messages: Array<Record<string, unknown>>;
    };
    const messages = requestPayload.messages;
    assert.ok(Array.isArray(messages));
    const userMessage = messages[1] as Record<string, unknown>;
    assert.ok(Array.isArray(userMessage.content));
    const content = userMessage.content as Array<Record<string, unknown>>;
    const imagePart = content.find((part) => part.type === "image_url");
    assert.ok(imagePart);
    assert.match(
      String((imagePart as { image_url?: { url?: string } }).image_url?.url ?? ""),
      /^data:image\/png;base64,/u,
    );
  } finally {
    await rm(uploadRootDir, { recursive: true, force: true });
  }
});
