import test from "node:test";
import assert from "node:assert/strict";
import {
  MainlineAiRuntimeExecutorError,
  OpenAiMainlineAiRuntimeExecutor,
} from "../../src/modules/shared/mainline-ai-runtime-executor.ts";

function createSelection() {
  return {
    layer: "legacy_module_default" as const,
    model: {
      id: "model-mainline-1",
      provider: "openai" as const,
      model_name: "gpt-5.4-mini",
      model_version: "2026-04",
      allowed_modules: ["screening", "editing", "proofreading"],
      is_prod_allowed: true,
      connection_id: "connection-mainline-1",
    },
    fallback_chain: [],
    warnings: [],
  };
}

function createRuntimeSelection() {
  return {
    primary: {
      adapter: "openai_chat_compatible" as const,
      model_id: "model-mainline-1",
      model_name: "gpt-5.4-mini",
      model_version: "2026-04",
      connection_id: "connection-mainline-1",
      connection_name: "Mainline Provider",
      provider_kind: "openai",
      compatibility_mode: "openai_chat_compatible",
      base_url: "https://ai.example.test/v1",
      request_url: "https://ai.example.test/v1/chat/completions",
      headers: {
        Authorization: "Bearer test-key",
        "Content-Type": "application/json",
      },
    },
    fallback_chain: [],
  };
}

test("mainline executor resolves runtime, sends OpenAI-compatible messages, and parses JSON responses", async () => {
  const selectionInputs: Array<Record<string, unknown>> = [];
  const runtimeInputs: unknown[] = [];
  const fetchCalls: Array<{
    url: unknown;
    init: RequestInit | undefined;
  }> = [];

  const executor = new OpenAiMainlineAiRuntimeExecutor({
    aiGatewayService: {
      async resolveModelSelection(input) {
        selectionInputs.push(input as Record<string, unknown>);
        return createSelection();
      },
    },
    aiProviderRuntimeService: {
      async resolveSelectionRuntime(selection) {
        runtimeInputs.push(selection);
        return createRuntimeSelection();
      },
    },
    fetch: async (url, init) => {
      fetchCalls.push({ url, init });
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: "Structured screening payload",
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

  const result = await executor.executeJson<{ summary: string }>({
    module: "screening",
    systemPrompt: "Return JSON only.",
    userPayload: {
      task: "screening_report",
      manuscriptId: "manuscript-1",
    },
  });

  assert.deepEqual(result, {
    summary: "Structured screening payload",
  });
  assert.deepEqual(selectionInputs, [
    {
      module: "screening",
    },
  ]);
  assert.equal(runtimeInputs.length, 1);
  assert.equal(fetchCalls.length, 1);
  assert.equal(
    fetchCalls[0]?.url,
    "https://ai.example.test/v1/chat/completions",
  );

  const requestBody = JSON.parse(String(fetchCalls[0]?.init?.body)) as {
    model: string;
    messages: Array<{ role: string; content: string }>;
    response_format?: { type: string };
  };
  assert.equal(requestBody.model, "gpt-5.4-mini");
  assert.deepEqual(requestBody.messages, [
    {
      role: "system",
      content: "Return JSON only.",
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "screening_report",
        manuscriptId: "manuscript-1",
      }),
    },
  ]);
  assert.deepEqual(requestBody.response_format, {
    type: "json_object",
  });
});

test("mainline executor extracts markdown content from OpenAI-compatible message arrays", async () => {
  const executor = new OpenAiMainlineAiRuntimeExecutor({
    aiGatewayService: {
      async resolveModelSelection() {
        return createSelection();
      },
    },
    aiProviderRuntimeService: {
      async resolveSelectionRuntime() {
        return createRuntimeSelection();
      },
    },
    fetch: async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: [
                  {
                    type: "output_text",
                    text: "# Proofreading Report",
                  },
                  {
                    type: "output_text",
                    text: "Corrections: 2",
                  },
                ],
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
      ),
  });

  const markdown = await executor.executeMarkdown({
    module: "proofreading",
    systemPrompt: "Return markdown only.",
    userPayload: {
      task: "proofreading_report",
    },
  });

  assert.equal(markdown, "# Proofreading Report\nCorrections: 2");
});

test("mainline executor surfaces invalid JSON with module-specific messaging", async () => {
  const executor = new OpenAiMainlineAiRuntimeExecutor({
    aiGatewayService: {
      async resolveModelSelection() {
        return createSelection();
      },
    },
    aiProviderRuntimeService: {
      async resolveSelectionRuntime() {
        return createRuntimeSelection();
      },
    },
    fetch: async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "{not-valid-json}",
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
      ),
  });

  await assert.rejects(
    () =>
      executor.executeJson({
        module: "editing",
        systemPrompt: "Return JSON only.",
        userPayload: {
          task: "editing_plan",
        },
      }),
    (error: unknown) =>
      error instanceof MainlineAiRuntimeExecutorError &&
      /Editing AI returned invalid JSON/u.test(error.message),
  );
});

test("mainline executor surfaces upstream status failures with module-specific error text", async () => {
  const executor = new OpenAiMainlineAiRuntimeExecutor({
    aiGatewayService: {
      async resolveModelSelection() {
        return createSelection();
      },
    },
    aiProviderRuntimeService: {
      async resolveSelectionRuntime() {
        return createRuntimeSelection();
      },
    },
    fetch: async () =>
      new Response("upstream unavailable", {
        status: 503,
        headers: {
          "Content-Type": "text/plain",
        },
      }),
  });

  await assert.rejects(
    () =>
      executor.executeMarkdown({
        module: "screening",
        systemPrompt: "Return markdown only.",
        userPayload: {
          task: "screening_report",
        },
      }),
    (error: unknown) =>
      error instanceof MainlineAiRuntimeExecutorError &&
      error.message === "Screening AI request failed with status 503.",
  );
});
