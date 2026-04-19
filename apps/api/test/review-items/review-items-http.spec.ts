import test from "node:test";
import assert from "node:assert/strict";
import {
  createApiHttpServer,
  createInMemoryApiRuntime,
  type ApiHttpServer,
  type ApiServerRuntime,
} from "../../src/http/api-http-server.ts";
import type { ReviewItemRecord } from "../../src/modules/review-items/review-item-record.ts";
import {
  startHttpTestServer,
  stopHttpTestServer,
} from "../http/support/http-test-server.ts";

type ReviewItemsApi = ApiServerRuntime["reviewItemsApi"];
type ReviewItemDecisionInput = Parameters<ReviewItemsApi["decideReviewItem"]>[0];
type ReviewItemSubmitInput = Parameters<ReviewItemsApi["submitGovernedHit"]>[0];

async function startServer(
  options: {
    runtime?: ApiServerRuntime;
  } = {},
): Promise<{
  server: ApiHttpServer;
  baseUrl: string;
}> {
  const server = createApiHttpServer({
    appEnv: "local",
    allowedOrigins: ["http://127.0.0.1:4173"],
    seedDemoKnowledgeReviewData: true,
    runtime: options.runtime,
  });

  return startHttpTestServer(server);
}

const stopServer = stopHttpTestServer;

async function loginAsDemoUser(baseUrl: string, username: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/v1/auth/local/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password: "demo-password",
    }),
  });

  assert.equal(response.status, 200);
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, "Expected auth login to return a session cookie.");
  return setCookie.split(";")[0] ?? "";
}

test("http server dispatches unified review item routes with the correct session context", async () => {
  const runtime = createInMemoryApiRuntime({
    appEnv: "local",
    seedDemoData: true,
    uploadRootDir: process.cwd(),
  });
  const listCalls: string[] = [];
  const submitCalls: ReviewItemSubmitInput[] = [];
  const decideCalls: ReviewItemDecisionInput[] = [];

  runtime.reviewItemsApi.listReviewItems = async (input) => {
    listCalls.push(JSON.stringify(input ?? {}));
    return {
      status: 200,
      body: [
        {
          id: "governed-hit-1",
          source_kind: "governed_hit",
          source_status: "submitted",
          review_status: "pending",
          module: "editing",
          manuscript_id: "manuscript-1",
          manuscript_type: "clinical_study",
          snapshot_id: "snapshot-1",
          source_asset_id: "asset-1",
          title: "Submit missed governed hit for review",
          summary: "Route this governed hit through the unified review queue first.",
          created_at: "2026-04-18T07:58:00.000Z",
          updated_at: "2026-04-18T07:58:00.000Z",
          available_actions: [
            "accept_change_only",
            "reject_as_false_positive",
            "route_to_rule_candidate",
            "route_to_knowledge_candidate",
            "route_to_prompt_candidate",
            "archive_as_evidence_only",
          ],
          candidate_posture: "inspect_only",
          decision_source: "execution_hit",
          evidence_pack: {
            location: {
              paragraph_index: 4,
            },
            excerpt: "Original governed hit excerpt",
            rationale: "Execution evidence requires manual confirmation.",
          },
          feedback_category: "missed_hit",
          feedback_record_id: "feedback-1",
          recommended_route: "rule_candidate",
          harness_validation_status: "not_required",
          created_by: "dev.editor",
        },
      ],
    };
  };
  runtime.reviewItemsApi.submitGovernedHit = async (input) => {
    submitCalls.push(input);
    return {
      status: 201,
      body: {
        feedback: {
          id: "feedback-1",
          manuscript_id: input.manuscriptId,
          module: input.module,
          snapshot_id: input.snapshotId,
          feedback_type: "manual_rejection",
          feedback_text: input.feedbackText,
          created_by: input.createdBy,
          created_at: "2026-04-18T08:00:00.000Z",
        },
        item: {
          id: "governed-hit-2",
          source_kind: "governed_hit",
          source_status: "submitted",
          review_status: "pending",
          module: input.module,
          manuscript_id: input.manuscriptId,
          manuscript_type: input.manuscriptType,
          snapshot_id: input.snapshotId,
          source_asset_id: input.sourceAssetId,
          title: "Submit missing knowledge for review",
          summary: input.feedbackText,
          created_at: "2026-04-18T08:00:00.000Z",
          updated_at: "2026-04-18T08:00:00.000Z",
          available_actions: [
            "accept_change_only",
            "reject_as_false_positive",
            "route_to_rule_candidate",
            "route_to_knowledge_candidate",
            "route_to_prompt_candidate",
            "archive_as_evidence_only",
          ],
          candidate_posture: input.candidatePosture,
          decision_source: input.decisionSource,
          evidence_pack: input.evidencePack,
          feedback_category: input.feedbackCategory,
          feedback_record_id: "feedback-1",
          recommended_route: "knowledge_candidate",
          harness_validation_status: "not_required",
          created_by: input.createdBy,
        },
      },
    };
  };
  runtime.reviewItemsApi.decideReviewItem = async (input) => {
    decideCalls.push(input);
    const item: ReviewItemRecord =
      input.action === "validate"
        ? {
            id: input.id,
            source_kind: "residual_issue",
            source_status: "candidate_ready",
            module: "proofreading",
            manuscript_id: "manuscript-1",
            manuscript_type: "clinical_study",
            snapshot_id: "snapshot-1",
            title: "Residual terminology normalization",
            summary: "Normalize the governed terminology before reuse.",
            created_at: "2026-04-18T08:00:00.000Z",
            updated_at: "2026-04-18T08:00:00.000Z",
            review_status: "pending",
            available_actions: [
              "accept_change_only",
              "reject_as_false_positive",
              "route_to_rule_candidate",
              "route_to_knowledge_candidate",
              "route_to_prompt_candidate",
              "archive_as_evidence_only",
            ],
            issue_type: "terminology_gap",
            execution_snapshot_id: "snapshot-1",
            recommended_route: "knowledge_candidate",
            harness_validation_status: "passed",
          }
        : input.action === "route_to_knowledge_candidate"
          ? {
              id: input.id,
              source_kind: "learning_candidate",
              source_status: "pending_review",
              review_status: "pending",
              status: "pending_review",
              module: "proofreading",
              manuscript_id: "manuscript-1",
              manuscript_type: "clinical_study",
              title: "Residual terminology normalization",
              summary: "Normalize the governed terminology before reuse.",
              created_at: "2026-04-18T08:00:00.000Z",
              updated_at: "2026-04-18T08:00:00.000Z",
              available_actions: ["approve", "reject"],
              candidate_type: "knowledge_candidate",
              type: "knowledge_candidate",
              created_by: "dev-knowledge-reviewer",
            }
          : {
              id: input.id,
              source_kind: "learning_candidate",
              source_status: "approved",
              review_status: "decided",
              status: "approved",
              module: "proofreading",
              manuscript_type: "clinical_study",
              title: "Residual terminology normalization",
              summary: "Normalize the governed terminology before reuse.",
              created_at: "2026-04-18T08:00:00.000Z",
              updated_at: "2026-04-18T08:00:00.000Z",
              available_actions: [],
              candidate_type: "knowledge_candidate",
              type: "knowledge_candidate",
              created_by: "dev-knowledge-reviewer",
            };

    return {
      status: 200,
      body: {
        action: input.action,
        item,
      },
    };
  };

  const { server, baseUrl } = await startServer({ runtime });

  try {
    const reviewerCookie = await loginAsDemoUser(baseUrl, "dev.knowledge-reviewer");
    const adminCookie = await loginAsDemoUser(baseUrl, "dev.admin");

    const listResponse = await fetch(
      `${baseUrl}/api/v1/review-items?sourceKind=governed_hit&module=editing&reviewStatus=pending&riskLevel=high&manuscriptId=manuscript-1`,
      {
        headers: {
          Cookie: reviewerCookie,
        },
      },
    );
    const listBody = (await listResponse.json()) as Array<{
      id: string;
      candidate_posture?: string;
      decision_source?: string;
      evidence_pack?: {
        location?: Record<string, unknown>;
        excerpt?: string;
        rationale?: string;
      };
    }>;

    assert.equal(listResponse.status, 200);
    assert.deepEqual(
      listCalls.map((value) => JSON.parse(value) as Record<string, unknown>),
      [
        {
          sourceKind: "governed_hit",
          module: "editing",
          reviewStatus: "pending",
          riskLevel: "high",
          manuscriptId: "manuscript-1",
        },
      ],
    );
    assert.deepEqual(listBody.map((item) => item.id), ["governed-hit-1"]);
    assert.equal(listBody[0]?.candidate_posture, "inspect_only");
    assert.equal(listBody[0]?.decision_source, "execution_hit");
    assert.deepEqual(listBody[0]?.evidence_pack, {
      location: {
        paragraph_index: 4,
      },
      excerpt: "Original governed hit excerpt",
      rationale: "Execution evidence requires manual confirmation.",
    });

    const submitResponse = await fetch(`${baseUrl}/api/v1/review-items/governed-hits`, {
      method: "POST",
      headers: {
        Cookie: reviewerCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        manuscriptId: "manuscript-2",
        manuscriptType: "clinical_study",
        module: "proofreading",
        snapshotId: "snapshot-2",
        sourceAssetId: "asset-2",
        feedbackCategory: "missing_knowledge",
        feedbackText: "The proofreading run is still missing the governed knowledge basis.",
        candidatePosture: "inspect_only",
        decisionSource: "execution_hit",
        evidencePack: {
          location: {
            paragraph_index: 12,
          },
          excerpt: "Original evidence excerpt",
          suggestion: "Suggested governed rewrite",
          rationale: "Proofreading hit came from governed execution.",
        },
      }),
    });
    const submitBody = (await submitResponse.json()) as {
      item: {
        id: string;
        source_kind: string;
        recommended_route: string;
        candidate_posture?: string;
        decision_source?: string;
        evidence_pack?: {
          location?: Record<string, unknown>;
          excerpt?: string;
          suggestion?: string;
          rationale?: string;
        };
      };
    };

    assert.equal(submitResponse.status, 201);
    assert.equal(submitBody.item.id, "governed-hit-2");
    assert.equal(submitBody.item.source_kind, "governed_hit");
    assert.equal(submitBody.item.recommended_route, "knowledge_candidate");
    assert.equal(submitBody.item.candidate_posture, "inspect_only");
    assert.equal(submitBody.item.decision_source, "execution_hit");
    assert.deepEqual(submitBody.item.evidence_pack, {
      location: {
        paragraph_index: 12,
      },
      excerpt: "Original evidence excerpt",
      suggestion: "Suggested governed rewrite",
      rationale: "Proofreading hit came from governed execution.",
    });

    const forbiddenValidateResponse = await fetch(
      `${baseUrl}/api/v1/review-items/residual_issue/residual-7/decide`,
      {
        method: "POST",
        headers: {
        Cookie: reviewerCookie,
        "Content-Type": "application/json",
      },
        body: JSON.stringify({
          action: "validate",
          suiteIds: ["suite-1"],
        }),
      },
    );

    assert.equal(forbiddenValidateResponse.status, 403);

    const validateResponse = await fetch(
      `${baseUrl}/api/v1/review-items/residual_issue/residual-7/decide`,
      {
        method: "POST",
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "validate",
          suiteIds: ["suite-1"],
          releaseCheckProfileId: "release-check-1",
        }),
      },
    );
    const validateBody = (await validateResponse.json()) as {
      action: string;
      item: { source_status: string };
    };

    assert.equal(validateResponse.status, 200);
    assert.equal(validateBody.action, "validate");
    assert.equal(validateBody.item.source_status, "candidate_ready");

    const createCandidateResponse = await fetch(
      `${baseUrl}/api/v1/review-items/governed_hit/governed-hit-2/decide`,
      {
        method: "POST",
        headers: {
          Cookie: reviewerCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "route_to_knowledge_candidate",
          title: "Knowledge remediation candidate",
          proposalText: "Route the governed hit into the knowledge review lane.",
        }),
      },
    );

    assert.equal(createCandidateResponse.status, 200);

    const manualOnlyResponse = await fetch(
      `${baseUrl}/api/v1/review-items/governed-hit-2/decide`,
      {
        method: "POST",
        headers: {
          Cookie: reviewerCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceKind: "governed_hit",
          action: "accept_change_only",
        }),
      },
    );
    const manualOnlyBody = (await manualOnlyResponse.json()) as {
      action: string;
      item: { source_status: string };
    };

    assert.equal(manualOnlyResponse.status, 200);
    assert.equal(manualOnlyBody.action, "accept_change_only");
    assert.equal(manualOnlyBody.item.source_status, "approved");

    const approveResponse = await fetch(
      `${baseUrl}/api/v1/review-items/learning_candidate/candidate-1/decide`,
      {
        method: "POST",
        headers: {
          Cookie: reviewerCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "approve",
          reviewNote: "Evidence is strong enough to approve.",
        }),
      },
    );
    const approveBody = (await approveResponse.json()) as {
      action: string;
      item: { source_status: string };
    };

    assert.equal(approveResponse.status, 200);
    assert.equal(approveBody.action, "approve");
    assert.equal(approveBody.item.source_status, "approved");
    assert.deepEqual(decideCalls, [
      {
        sourceKind: "residual_issue",
        id: "residual-7",
        action: "validate",
        actorRole: "admin",
        suiteIds: ["suite-1"],
        releaseCheckProfileId: "release-check-1",
      },
      {
        sourceKind: "governed_hit",
        id: "governed-hit-2",
        action: "route_to_knowledge_candidate",
        requestedBy: "dev-knowledge-reviewer",
        requestedByRole: "knowledge_reviewer",
        title: "Knowledge remediation candidate",
        proposalText: "Route the governed hit into the knowledge review lane.",
      },
      {
        sourceKind: "governed_hit",
        id: "governed-hit-2",
        action: "accept_change_only",
      },
      {
        sourceKind: "learning_candidate",
        id: "candidate-1",
        action: "approve",
        actorRole: "knowledge_reviewer",
        reviewNote: "Evidence is strong enough to approve.",
      },
    ]);
    assert.deepEqual(submitCalls, [
      {
        manuscriptId: "manuscript-2",
        manuscriptType: "clinical_study",
        module: "proofreading",
        snapshotId: "snapshot-2",
        sourceAssetId: "asset-2",
        feedbackCategory: "missing_knowledge",
        feedbackText: "The proofreading run is still missing the governed knowledge basis.",
        candidatePosture: "inspect_only",
        decisionSource: "execution_hit",
        evidencePack: {
          location: {
            paragraph_index: 12,
          },
          excerpt: "Original evidence excerpt",
          suggestion: "Suggested governed rewrite",
          rationale: "Proofreading hit came from governed execution.",
        },
        createdBy: "dev-knowledge-reviewer",
      },
    ]);
  } finally {
    await stopServer(server);
  }
});
