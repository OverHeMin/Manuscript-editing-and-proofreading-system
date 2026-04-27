import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRealProofreadingAcceptanceConfig,
  evaluateRealProofreadingAcceptanceReport,
  runRealProofreadingAcceptance,
} from "./run-real-proofreading-acceptance.mjs";

test("real proofreading acceptance config keeps provider secrets out of reportable output", () => {
  const config = buildRealProofreadingAcceptanceConfig({
    REAL_ACCEPTANCE_PROVIDER: "deepseek",
    REAL_ACCEPTANCE_BASE_URL: "https://api.deepseek.com/v1",
    REAL_ACCEPTANCE_MODEL: "deepseek-chat",
    REAL_ACCEPTANCE_API_KEY: "sk-test-secret",
  });

  assert.equal(config.provider, "deepseek");
  assert.equal(config.baseUrl, "https://api.deepseek.com/v1");
  assert.equal(config.model, "deepseek-chat");
  assert.equal(config.apiKey, "sk-test-secret");
  assert.equal(config.reportable.apiKey, "[redacted]");
});

test("real proofreading acceptance sends governed context layers and passes content gates", async () => {
  const requests = [];
  const report = await runRealProofreadingAcceptance({
    env: {
      REAL_ACCEPTANCE_PROVIDER: "deepseek",
      REAL_ACCEPTANCE_BASE_URL: "https://api.deepseek.com/v1",
      REAL_ACCEPTANCE_MODEL: "deepseek-chat",
      REAL_ACCEPTANCE_API_KEY: "sk-test-secret",
      REAL_ACCEPTANCE_PASS_LIMIT: "5",
      REAL_ACCEPTANCE_MIN_FINDINGS: "1",
    },
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return createJsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                role: "proofreader",
                summary: "Residual issues detected.",
                issues: [
                  {
                    itemId: `residual-${requests.length}`,
                    title: "Conclusion overstates the result",
                    description:
                      "The conclusion claims proven efficacy while results say the endpoint was not statistically significant.",
                    severity: "high",
                    source: "residual_ai",
                    issueType: "logic_consistency",
                    blocksFinal: false,
                    anchor: {
                      blockIndex: 4,
                      quote: "proves the treatment is effective",
                      sectionLabel: "conclusion",
                    },
                    suggestion: {
                      action: "verify_fact",
                      note: "Check conclusion strength against results.",
                    },
                  },
                ],
                manualReviewItems: ["Review conclusion strength."],
              }),
            },
          },
        ],
      });
    },
  });

  assert.equal(report.status, "passed");
  assert.equal(report.provider.provider, "deepseek");
  assert.equal(report.provider.apiKey, "[redacted]");
  assert.equal(report.passReports.length, 5);
  assert.equal(report.metrics.totalIssues, 5);
  assert.equal(report.gates.minFindings.status, "passed");
  assert.equal(report.gates.contextLayerEvidence.status, "passed");
  assert.equal(report.gates.governedCitationEvidence.status, "passed");
  assert.equal(report.gates.residualLayerEvidence.status, "passed");
  assert.equal(requests.length, 5);

  const requestBody = JSON.parse(String(requests[0].init.body));
  assert.equal(requests[0].url, "https://api.deepseek.com/v1/chat/completions");
  assert.equal(requestBody.model, "deepseek-chat");
  assert.ok(requests[0].init.headers.authorization.includes("sk-test-secret"));
  assert.equal(
    JSON.stringify(report).includes("sk-test-secret"),
    false,
  );

  const userPayload = JSON.parse(requestBody.messages[1].content);
  assert.equal(userPayload.contextMode, "full_text");
  assert.ok(userPayload.proofreadingContextLayers.localBlockContext.blockCount > 0);
  assert.deepEqual(
    userPayload.proofreadingContextLayers.ruleCitationContext.ruleIds,
    ["rule-unit-format-1", "rule-table-text-consistency-1"],
  );
  assert.deepEqual(
    userPayload.proofreadingContextLayers.knowledgeCitationContext.knowledgeItemIds,
    ["knowledge-stat-significance-1", "knowledge-table-consistency-1"],
  );
  assert.equal(
    userPayload.proofreadingContextLayers.residualAnalysisContext
      .runsAfterGovernedCoverage,
    true,
  );
});

test("real proofreading acceptance fails content gate when model returns too few findings", () => {
  const report = evaluateRealProofreadingAcceptanceReport({
    provider: {
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      apiKey: "[redacted]",
    },
    passReports: [
      {
        passNo: 1,
        passKind: "residual_synthesis",
        issueCount: 0,
        residualIssueCount: 0,
        contextEvidence: {
          hasLocalBlockContext: true,
          hasNeighborContext: true,
          hasSectionContext: true,
          hasGlobalConsistencyContext: true,
          ruleIds: ["rule-unit-format-1"],
          knowledgeItemIds: ["knowledge-stat-significance-1"],
          residualRunsAfterGovernedCoverage: true,
        },
      },
    ],
    minFindings: 1,
  });

  assert.equal(report.status, "failed");
  assert.equal(report.gates.minFindings.status, "failed");
});

function createJsonResponse(body) {
  return {
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify(body);
    },
    async json() {
      return body;
    },
  };
}
