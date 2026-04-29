import assert from "node:assert/strict";
import test from "node:test";
import type {
  ConfirmedAiTablePackage,
} from "@medical/contracts";
import {
  OpenAiRuleAiParsingGenerator,
  RuleAiParsingService,
} from "../../src/modules/editorial-rules/rule-ai-parsing-service.ts";

test("rule AI parsing reports consistent manual rules", async () => {
  const service = new RuleAiParsingService({
    generator: {
      async parseRule() {
        return {
          ai_understanding_summary: "摘要英文缩写首次出现需要中文全称。",
          consistency: "consistent" as const,
          findings: [],
          requires_human_confirmation: false,
        };
      },
    },
  });

  const result = await service.parseRule({
    rule_fields: {
      title: "摘要缩写规范",
      rule_body: "摘要首次出现英文缩写时使用中文全称（英文缩写）。",
      module_scope: "proofreading",
      manuscript_types: ["clinical_study"],
      sections: ["abstract"],
    },
  });

  assert.equal(result.consistency, "consistent");
  assert.equal(result.requires_human_confirmation, false);
});

test("rule AI parsing rejects empty rule bodies", async () => {
  const service = new RuleAiParsingService({
    generator: {
      async parseRule() {
        throw new Error("should not call generator");
      },
    },
  });

  await assert.rejects(
    service.parseRule({ rule_fields: { rule_body: " " } }),
    /rule body is required/u,
  );
});

test("rule AI parsing prompt includes confirmed table package fidelity rules", async () => {
  let requestBody: {
    messages: Array<{ role: string; content: string }>;
  } | undefined;
  const generator = new OpenAiRuleAiParsingGenerator({
    aiGatewayService: {
      async resolveModelSelection() {
        return {
          layer: "legacy_system_default",
          model: {
            id: "model-1",
            provider: "openai",
            model_name: "model-1",
            model_version: "2026-04-29",
            allowed_modules: ["proofreading"],
            is_prod_allowed: true,
            connection_id: "connection-1",
          },
          fallback_chain: [],
          warnings: [],
        };
      },
    },
    aiProviderRuntimeService: {
      async resolveSelectionRuntime() {
        return {
          primary: {
            adapter: "openai_chat_compatible",
            model_id: "model-1",
            model_version: "2026-04-29",
            connection_id: "connection-1",
            connection_name: "Connection 1",
            provider_kind: "openai",
            compatibility_mode: "openai_chat_compatible",
            base_url: "https://example.test",
            request_url: "https://example.test/v1/chat/completions",
            model_name: "model-1",
            headers: {},
          },
          fallback_chain: [],
        };
      },
    },
    fetch: (async (_url, init) => {
      requestBody = JSON.parse(String(init?.body)) as typeof requestBody;
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  ai_understanding_summary: "Table units retain exact run style.",
                  consistency: "consistent",
                  findings: [],
                  requires_human_confirmation: false,
                  warnings: [],
                }),
              },
            },
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch,
  });

  await generator.parseRule({
    rule_fields: {
      rule_body: "Hcy units in table headers must preserve exact minus and script formatting.",
      evidence: [
        {
          kind: "confirmed_table_package",
          source_id: "rev-1",
          authority: "authoritative",
          confirmed_table_package: buildConfirmedTablePackage({
            revisionId: "rev-1",
            assetId: "asset-1",
            authority: "authoritative",
          }),
        },
      ],
    },
  });

  const userContent = requestBody?.messages.find((message) => message.role === "user")
    ?.content;
  assert.ok(userContent);
  assert.match(userContent, /Confirmed table package:/u);
  assert.match(userContent, /"revision_id":"rev-1"/u);
  assert.match(
    userContent,
    /Treat confirmed_table_package as authoritative only when authority is authoritative/u,
  );
  assert.match(userContent, /Do not collapse U\+002D, U\+2013, U\+2014, U\+2212/u);
  assert.match(userContent, /Do not collapse U\+0020, U\+3000, U\+00A0, tabs/u);
  assert.match(userContent, /runs\.style\.superscript and runs\.style\.subscript/u);
});

test("rule AI draft parsing warns on non-authoritative confirmed table packages", async () => {
  const service = new RuleAiParsingService({
    generator: {
      async parseRule() {
        return {
          ai_understanding_summary: "Table evidence still needs review.",
          consistency: "uncertain" as const,
          findings: [],
          requires_human_confirmation: true,
          warnings: [],
        };
      },
    },
  });

  const result = await service.parseRule({
    parse_mode: "draft",
    rule_fields: {
      rule_body: "Use the table package to infer table header formatting.",
      evidence: [
        {
          kind: "confirmed_table_package",
          source_id: "rev-review",
          authority: "review_required",
          confirmed_table_package: buildConfirmedTablePackage({
            revisionId: "rev-review",
            assetId: "asset-review",
            authority: "review_required",
          }),
        },
      ],
    },
  });

  assert.deepEqual(result.warnings, ["table_evidence_not_authoritative"]);
  assert.equal(result.requires_human_confirmation, true);
});

for (const parseMode of ["publish", "final"] as const) {
  test(`rule AI ${parseMode} parsing rejects non-authoritative confirmed table packages`, async () => {
    const service = new RuleAiParsingService({
      generator: {
        async parseRule() {
          throw new Error(`${parseMode} parsing should reject before generator`);
        },
      },
    });

    await assert.rejects(
      () =>
        service.parseRule({
          parse_mode: parseMode,
          rule_fields: {
            rule_body: "Publish the table rule.",
            evidence: [
              {
                kind: "confirmed_table_package",
                source_id: "rev-review",
                authority: "review_required",
                confirmed_table_package: buildConfirmedTablePackage({
                  revisionId: "rev-review",
                  assetId: "asset-review",
                  authority: "review_required",
                }),
              },
            ],
          },
        }),
      /table_evidence_not_authoritative/u,
    );
  });
}

function buildConfirmedTablePackage(input: {
  revisionId: string;
  assetId: string;
  authority: ConfirmedAiTablePackage["authority"];
}): ConfirmedAiTablePackage {
  return {
    package_id: `pkg-${input.revisionId}`,
    asset_id: input.assetId,
    revision_id: input.revisionId,
    revision_no: 1,
    source_file_asset_id: "file-1",
    authority: input.authority,
    confirmation_status:
      input.authority === "authoritative" ? "confirmed" : "needs_review",
    fidelity_status:
      input.authority === "authoritative" ? "confirmed" : "needs_review",
    confirmed_by_human: input.authority === "authoritative",
    parser: "python_docx_ooxml",
    parser_version: "table-evidence-v1",
    source_snapshot_hash: "sha256-source",
    confirmed_snapshot_hash: "sha256-confirmed",
    ai_table_package_hash: "sha256-package",
    caption: {
      text: "Table 1 Hcy levels",
      runs: [
        {
          id: "run-1",
          kind: "text",
          text: "L-1",
          codepoints: ["004C", "002D", "0031"],
          style: { superscript: true },
          invisible_chars: [],
        },
      ],
    },
    notes: [],
    structure: {
      row_count: 1,
      column_count: 1,
      header_depth: 1,
      merged_cells: [],
    },
    cells: [
      {
        cell_id: "cell-1",
        row: 0,
        column: 0,
        rowspan: 1,
        colspan: 1,
        role: "header",
        text: "Hcy (umol L-1)",
        codepoints: [],
        paragraphs: [],
        runs: [],
        header_path: ["Hcy (umol L-1)"],
        row_header_path: [],
        column_header_path: ["Hcy (umol L-1)"],
        invisible_chars: [],
        style_summary: {
          script_positions: ["baseline", "superscript"],
        },
      },
    ],
    fidelity_report: {
      status: input.authority === "authoritative" ? "confirmed" : "needs_review",
      failure_codes: [],
      unsupported_fact_groups: [],
      required_confirmations: [],
      invisible_chars_confirmed: input.authority === "authoritative",
      special_symbols_confirmed: input.authority === "authoritative",
    },
  };
}
