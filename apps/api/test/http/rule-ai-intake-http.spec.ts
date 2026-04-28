import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createApiHttpServer,
  createInMemoryApiRuntime,
} from "../../src/http/api-http-server.ts";
import {
  startHttpTestServer,
  stopHttpTestServer,
} from "./support/http-test-server.ts";

async function startServer() {
  const uploadRootDir = await mkdtemp(path.join(os.tmpdir(), "rule-ai-http-"));
  const runtime = createInMemoryApiRuntime({
    appEnv: "local",
    seedDemoData: true,
    uploadRootDir,
  });
  const server = createApiHttpServer({
    appEnv: "local",
    allowedOrigins: ["http://127.0.0.1:4173"],
    runtime,
    uploadRootDir,
  });
  const started = await startHttpTestServer(server);
  return {
    ...started,
    runtime,
    cleanup: async () => {
      await rm(uploadRootDir, { recursive: true, force: true });
    },
  };
}

async function loginAsDemoUser(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/v1/auth/local/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: "dev.admin",
      password: "demo-password",
    }),
  });

  assert.equal(response.status, 200);
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie);
  return setCookie.split(";")[0] ?? "";
}

test("workbench runtime exposes rule AI intake draft endpoint", async () => {
  const { server, baseUrl, runtime, cleanup } = await startServer();

  try {
    (runtime.editorialRuleApi as Record<string, unknown>).createRuleAiIntakeDraft =
      async () => ({
        status: 200,
        body: {
          draft: {
            source_kind: "manual_description",
            ai_understanding_summary: "摘要缩写首次出现需要中文全称。",
            recommended_governance_layer: "journal_template",
            target_object: "abstract_abbreviation",
            trigger: "first_abbreviation_occurrence",
            action: "manual_review_or_replace",
            scope: { module_scope: "proofreading", sections: ["abstract"] },
            evidence: [{ kind: "user_description", text: "摘要缩写规范。" }],
            confidence: { overall: 0.82 },
            uncertainties: [],
          },
          template_match: {
            status: "matched",
            template_id: "abstract_rule_template",
          },
          similar_rule_matches: [],
          warnings: [],
        },
      });
    const cookie = await loginAsDemoUser(baseUrl);

    const response = await fetch(
      `${baseUrl}/api/v1/editorial-rules/ai-intake/drafts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie,
        },
        body: JSON.stringify({
          source_kind: "manual_description",
          description: "摘要首次出现英文缩写时使用中文全称（英文缩写）。",
          context: {
            module_scope: "proofreading",
            manuscript_types: ["clinical_study"],
            sections: ["abstract"],
          },
        }),
      },
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      draft?: { source_kind?: string; target_object?: string };
      template_match?: { status?: string };
    };
    assert.equal(body.draft?.source_kind, "manual_description");
    assert.equal(body.draft?.target_object, "abstract_abbreviation");
    assert.equal(body.template_match?.status, "matched");
  } finally {
    await stopHttpTestServer(server);
    await cleanup();
  }
});

test("workbench runtime checks AI draft similarity against existing rule ledger", async () => {
  const { server, baseUrl, runtime, cleanup } = await startServer();

  try {
    const ruleSet = (
      await runtime.editorialRuleApi.createRuleSet({
        actorRole: "admin",
        input: {
          templateFamilyId: "family-seeded-1",
          module: "proofreading",
        },
      })
    ).body;
    const existingRule = (
      await runtime.editorialRuleApi.createRule({
        actorRole: "admin",
        input: {
          ruleSetId: ruleSet.id,
          orderNo: 10,
          ruleObject: "abstract_rule",
          ruleType: "content",
          executionMode: "inspect",
          scope: { sections: ["abstract"] },
          trigger: { kind: "manual_description_match" },
          action: { kind: "manual_review_or_replace" },
          confidencePolicy: "manual_only",
          severity: "warning",
        },
      })
    ).body;
    const cookie = await loginAsDemoUser(baseUrl);

    const response = await fetch(
      `${baseUrl}/api/v1/editorial-rules/ai-intake/drafts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie,
        },
        body: JSON.stringify({
          source_kind: "manual_description",
          description: "摘要首次出现英文缩写时使用中文全称（英文缩写）。",
        }),
      },
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      similar_rule_matches?: Array<{
        kind?: string;
        rule_id?: string;
      }>;
    };
    const duplicate = body.similar_rule_matches?.find(
      (match) => match.rule_id === existingRule.id,
    );
    assert.equal(duplicate?.kind, "duplicate");
  } finally {
    await stopHttpTestServer(server);
    await cleanup();
  }
});

test("workbench runtime exposes manual rule AI parsing endpoint", async () => {
  const { server, baseUrl, runtime, cleanup } = await startServer();

  try {
    (runtime.editorialRuleApi as Record<string, unknown>).parseManualRuleWithAi =
      async () => ({
        status: 200,
        body: {
          ai_understanding_summary: "摘要英文缩写首次出现需要补全中文全称。",
          consistency: "consistent",
          findings: [],
          requires_human_confirmation: false,
          warnings: [],
        },
      });
    const cookie = await loginAsDemoUser(baseUrl);

    const response = await fetch(
      `${baseUrl}/api/v1/editorial-rules/ai-intake/parse-manual-rule`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie,
        },
        body: JSON.stringify({
          rule_fields: {
            title: "摘要缩写规范",
            rule_body: "摘要首次出现英文缩写时使用中文全称（英文缩写）。",
            module_scope: "proofreading",
          },
        }),
      },
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      consistency?: string;
      requires_human_confirmation?: boolean;
    };
    assert.equal(body.consistency, "consistent");
    assert.equal(body.requires_human_confirmation, false);
  } finally {
    await stopHttpTestServer(server);
    await cleanup();
  }
});
