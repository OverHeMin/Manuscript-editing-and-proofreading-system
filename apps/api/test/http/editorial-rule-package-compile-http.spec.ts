import { once } from "node:events";
import type { AddressInfo } from "node:net";
import assert from "node:assert/strict";
import test from "node:test";
import type { RulePackageDraft } from "@medical/contracts";
import {
  createApiHttpServer,
  type ApiHttpServer,
} from "../../src/http/api-http-server.ts";
import { loginAsDemoUser } from "./support/workbench-runtime.ts";

function buildReadyFrontMatterPackageDraft(): RulePackageDraft {
  return {
    package_id: "package-front-matter",
    package_kind: "front_matter",
    title: "Front matter package",
    rule_object: "front_matter",
    suggested_layer: "journal_template",
    automation_posture: "guarded_auto",
    status: "draft",
    cards: {
      rule_what: {
        title: "Front matter package",
        object: "front_matter",
        publish_layer: "journal_template",
      },
      ai_understanding: {
        summary: "Normalize author and corresponding-author blocks.",
        hit_objects: ["author_line", "corresponding_author"],
        hit_locations: ["front_matter"],
      },
      applicability: {
        manuscript_types: ["clinical_study"],
        modules: ["editing"],
        sections: ["front_matter"],
        table_targets: [],
      },
      evidence: {
        examples: [
          {
            before: "First author: Zhang San",
            after: "Author: Zhang San",
          },
        ],
      },
      exclusions: {
        not_applicable_when: ["Source metadata is missing."],
        human_review_required_when: ["A corresponding author is added."],
        risk_posture: "guarded_auto",
      },
    },
    semantic_draft: {
      semantic_summary: "Normalize author and corresponding-author blocks.",
      hit_scope: ["author_line:text_style_normalization"],
      applicability: ["front_matter"],
      evidence_examples: [
        {
          before: "First author: Zhang San",
          after: "Author: Zhang San",
        },
      ],
      failure_boundaries: ["Source metadata is missing."],
      normalization_recipe: ["Normalize author labels and markers."],
      review_policy: ["Review when adding a corresponding author."],
      confirmed_fields: ["summary", "applicability", "evidence", "boundaries"],
    },
    supporting_signals: [],
  };
}

test("editorial rule package compile routes preview and compile package drafts over HTTP", async () => {
  const server = createApiHttpServer({
    appEnv: "local",
    allowedOrigins: ["http://127.0.0.1:4173"],
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  assert.ok(address && typeof address !== "string", "Expected a tcp server address.");
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.admin");

    const previewResponse = await fetch(
      `${baseUrl}/api/v1/editorial-rules/rule-packages/compile-preview`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: {
            source: {
              sourceKind: "uploaded_example_pair",
              exampleSourceSessionId: "session-demo-1",
            },
            packageDrafts: [buildReadyFrontMatterPackageDraft()],
            templateFamilyId: "family-seeded-1",
            module: "editing",
          },
        }),
      },
    );

    assert.equal(previewResponse.status, 200);
    const preview = (await previewResponse.json()) as {
      packages: Array<{
        readiness: { status: string };
        draft_rule_seeds: Array<{ rule_object: string }>;
      }>;
    };
    assert.equal(preview.packages[0]?.readiness.status, "ready");
    assert.equal(preview.packages[0]?.draft_rule_seeds[0]?.rule_object, "author_line");

    const compileResponse = await fetch(
      `${baseUrl}/api/v1/editorial-rules/rule-packages/compile-to-draft`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: {
            actorRole: "admin",
            source: {
              sourceKind: "uploaded_example_pair",
              exampleSourceSessionId: "session-demo-1",
            },
            packageDrafts: [buildReadyFrontMatterPackageDraft()],
            templateFamilyId: "family-seeded-1",
            module: "editing",
          },
        }),
      },
    );

    assert.equal(compileResponse.status, 200);
    const compileResult = (await compileResponse.json()) as {
      rule_set_id: string;
      created_rule_ids: string[];
      skipped_packages: Array<{ package_id: string }>;
    };
    assert.ok(compileResult.rule_set_id.length > 0);
    assert.equal(compileResult.created_rule_ids.length, 1);
    assert.equal(compileResult.skipped_packages.length, 0);
  } finally {
    await stopServer(server);
  }
});

async function stopServer(server: ApiHttpServer): Promise<void> {
  if (!server.listening) {
    return;
  }

  server.close();
  await once(server, "close");
}
