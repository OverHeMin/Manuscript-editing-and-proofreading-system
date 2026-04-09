import test from "node:test";
import assert from "node:assert/strict";
import {
  createApiHttpServer,
  type ApiHttpServer,
} from "../../src/http/api-http-server.ts";
import {
  startHttpTestServer,
  stopHttpTestServer,
} from "./support/http-test-server.ts";

async function startServer(): Promise<{
  server: ApiHttpServer;
  baseUrl: string;
}> {
  const server = createApiHttpServer({
    appEnv: "local",
    allowedOrigins: ["http://127.0.0.1:4173"],
    seedDemoKnowledgeReviewData: true,
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

test("http server rejects protected review routes without a trusted session", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/v1/knowledge/review-queue`, {
      headers: {
        Origin: "http://127.0.0.1:4173",
      },
    });

    assert.equal(response.status, 401);
    assert.equal(
      response.headers.get("access-control-allow-origin"),
      "http://127.0.0.1:4173",
    );
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
    const body = (await response.json()) as { error: string };
    assert.equal(body.error, "unauthorized");
  } finally {
    await stopServer(server);
  }
});

test("http server returns 401 for invalid login credentials", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/v1/auth/local/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "dev.editor",
        password: "wrong-password",
      }),
    });
    const body = (await response.json()) as { error: string };

    assert.equal(response.status, 401);
    assert.equal(body.error, "invalid_credentials");
  } finally {
    await stopServer(server);
  }
});

test("http server exposes the current demo auth session and clears it on logout", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.knowledge-reviewer");
    const sessionResponse = await fetch(`${baseUrl}/api/v1/auth/session`, {
      headers: {
        Cookie: cookie,
      },
    });
    const sessionBody = (await sessionResponse.json()) as {
      user: {
        id: string;
        username: string;
        displayName: string;
        role: string;
      };
    };

    assert.equal(sessionResponse.status, 200);
    assert.deepEqual(sessionBody.user, {
      id: "dev-knowledge-reviewer",
      username: "dev.knowledge-reviewer",
      displayName: "Knowledge Reviewer",
      role: "knowledge_reviewer",
    });

    const logoutResponse = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: {
        Cookie: cookie,
      },
    });

    assert.equal(logoutResponse.status, 204);
    assert.match(logoutResponse.headers.get("set-cookie") ?? "", /Max-Age=0/i);

    const afterLogoutResponse = await fetch(`${baseUrl}/api/v1/auth/session`, {
      headers: {
        Cookie: cookie,
      },
    });
    const afterLogoutBody = (await afterLogoutResponse.json()) as { error: string };

    assert.equal(afterLogoutResponse.status, 401);
    assert.equal(afterLogoutBody.error, "unauthorized");
  } finally {
    await stopServer(server);
  }
});

test("http server uses the authenticated session role instead of a forged actorRole body", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.editor");
    const approveResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/knowledge-demo-1/approve`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "admin",
          reviewNote: "forged admin attempt",
        }),
      },
    );
    const approveBody = (await approveResponse.json()) as { error: string };

    assert.equal(approveResponse.status, 403);
    assert.equal(approveBody.error, "forbidden");
  } finally {
    await stopServer(server);
  }
});

test("http server auto-assigns the seeded template family on upload so admins can screen the new manuscript", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const userCookie = await loginAsDemoUser(baseUrl, "dev.user");
    const adminCookie = await loginAsDemoUser(baseUrl, "dev.admin");

    const uploadResponse = await fetch(`${baseUrl}/api/v1/manuscripts/upload`, {
      method: "POST",
      headers: {
        Cookie: userCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "HTTP Upload Screening Mainline",
        manuscriptType: "clinical_study",
        createdBy: "forged-user",
        fileName: "http-upload-screening.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        storageKey: "uploads/http-upload-screening.docx",
      }),
    });
    const uploaded = (await uploadResponse.json()) as {
      manuscript: {
        id: string;
        current_template_family_id?: string;
      };
      asset: { id: string };
    };

    assert.equal(uploadResponse.status, 201);
    assert.equal(uploaded.manuscript.current_template_family_id, "family-seeded-1");

    const screeningResponse = await fetch(`${baseUrl}/api/v1/modules/screening/run`, {
      method: "POST",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        manuscriptId: uploaded.manuscript.id,
        parentAssetId: uploaded.asset.id,
        requestedBy: "forged-admin",
        actorRole: "user",
        storageKey: "runs/http-upload-screening/report.md",
        fileName: "http-upload-screening.md",
      }),
    });
    const screening = (await screeningResponse.json()) as {
      asset?: { asset_type: string };
      job?: { module: string };
      error?: string;
      message?: string;
    };

    assert.equal(
      screeningResponse.status,
      201,
      `Expected screening to succeed, received ${screeningResponse.status}: ${JSON.stringify(screening)}`,
    );
    assert.equal(screening.asset?.asset_type, "screening_report");
    assert.equal(screening.job?.module, "screening");
  } finally {
    await stopServer(server);
  }
});

test("http server keeps the seeded base editing rule set publishable after publishing a journal override", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const userCookie = await loginAsDemoUser(baseUrl, "dev.user");
    const adminCookie = await loginAsDemoUser(baseUrl, "dev.admin");
    const abstractObjectiveSource = "\u6458\u8981 \u76ee\u7684";
    const journalObjectiveNormalized = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09\uff1a";
    const uploadResponse = await fetch(`${baseUrl}/api/v1/manuscripts/upload`, {
      method: "POST",
      headers: {
        Cookie: userCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "HTTP Upload Editing Journal Override",
        manuscriptType: "clinical_study",
        createdBy: "forged-user",
        fileName: "http-upload-editing-journal-override.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        storageKey: "uploads/http-upload-editing-journal-override.docx",
      }),
    });
    const uploaded = (await uploadResponse.json()) as {
      manuscript: {
        id: string;
        current_template_family_id?: string;
      };
      asset: { id: string };
    };

    assert.equal(uploadResponse.status, 201);
    assert.equal(uploaded.manuscript.current_template_family_id, "family-seeded-1");

    const journalTemplateResponse = await fetch(
      `${baseUrl}/api/v1/templates/journal-templates`,
      {
        method: "POST",
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateFamilyId: "family-seeded-1",
          manuscriptType: "clinical_study",
          journalKey: `http-journal-${Date.now()}`,
          journalName: `HTTP Journal ${Date.now()}`,
        }),
      },
    );
    const journalTemplate = (await journalTemplateResponse.json()) as { id: string };

    assert.equal(journalTemplateResponse.status, 201);

    const activateJournalTemplateResponse = await fetch(
      `${baseUrl}/api/v1/templates/journal-templates/${journalTemplate.id}/activate`,
      {
        method: "POST",
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
        }),
      },
    );

    assert.equal(activateJournalTemplateResponse.status, 200);

    const ruleSetResponse = await fetch(`${baseUrl}/api/v1/editorial-rules/rule-sets`, {
      method: "POST",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorRole: "editor",
        templateFamilyId: "family-seeded-1",
        journalTemplateId: journalTemplate.id,
        module: "editing",
      }),
    });
    const ruleSet = (await ruleSetResponse.json()) as { id: string };

    assert.equal(ruleSetResponse.status, 201);

    const createRuleResponse = await fetch(
      `${baseUrl}/api/v1/editorial-rules/rule-sets/${ruleSet.id}/rules`,
      {
        method: "POST",
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          orderNo: 10,
          ruleObject: "abstract",
          ruleType: "format",
          executionMode: "apply_and_inspect",
          scope: {
            sections: ["abstract"],
            block_kind: "heading",
          },
          selector: {
            section_selector: "abstract",
            label_selector: {
              text: abstractObjectiveSource,
            },
          },
          trigger: {
            kind: "exact_text",
            text: abstractObjectiveSource,
          },
          action: {
            kind: "replace_heading",
            to: journalObjectiveNormalized,
          },
          authoringPayload: {
            label_role: "objective",
            source_label_text: abstractObjectiveSource,
            normalized_label_text: journalObjectiveNormalized,
          },
          evidenceLevel: "high",
          confidencePolicy: "always_auto",
          severity: "error",
          enabled: true,
          exampleBefore: abstractObjectiveSource,
          exampleAfter: journalObjectiveNormalized,
        }),
      },
    );

    assert.equal(createRuleResponse.status, 201);

    const publishRuleSetResponse = await fetch(
      `${baseUrl}/api/v1/editorial-rules/rule-sets/${ruleSet.id}/publish`,
      {
        method: "POST",
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
        }),
      },
    );

    assert.equal(publishRuleSetResponse.status, 200);

    const listedRuleSetsResponse = await fetch(
      `${baseUrl}/api/v1/editorial-rules/rule-sets`,
      {
        headers: {
          Cookie: adminCookie,
        },
      },
    );
    const listedRuleSets = (await listedRuleSetsResponse.json()) as Array<{
      id: string;
      status: string;
      journal_template_id?: string;
    }>;

    assert.equal(listedRuleSetsResponse.status, 200);
    assert.equal(
      listedRuleSets.find((record) => record.id === "rule-set-editing-1")?.status,
      "published",
    );
    assert.equal(
      listedRuleSets.find((record) => record.id === ruleSet.id)?.status,
      "published",
    );
    assert.equal(
      listedRuleSets.find((record) => record.id === ruleSet.id)?.journal_template_id,
      journalTemplate.id,
    );

    const updateTemplateSelectionResponse = await fetch(
      `${baseUrl}/api/v1/manuscripts/${uploaded.manuscript.id}/template-selection`,
      {
        method: "POST",
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          journalTemplateId: journalTemplate.id,
        }),
      },
    );
    const updatedManuscript = (await updateTemplateSelectionResponse.json()) as {
      current_journal_template_id?: string;
    };

    assert.equal(updateTemplateSelectionResponse.status, 200);
    assert.equal(updatedManuscript.current_journal_template_id, journalTemplate.id);

    const editingResponse = await fetch(`${baseUrl}/api/v1/modules/editing/run`, {
      method: "POST",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        manuscriptId: uploaded.manuscript.id,
        parentAssetId: uploaded.asset.id,
        requestedBy: "forged-admin",
        actorRole: "user",
        storageKey: "runs/http-journal-editing/final.docx",
        fileName: "http-journal-editing-final.docx",
      }),
    });
    const editing = (await editingResponse.json()) as {
      asset?: { asset_type: string };
      job?: { module: string };
      error?: string;
      message?: string;
    };

    assert.equal(
      editingResponse.status,
      201,
      `Expected editing to succeed, received ${editingResponse.status}: ${JSON.stringify(editing)}`,
    );
    assert.equal(editing.asset?.asset_type, "edited_docx");
    assert.equal(editing.job?.module, "editing");
  } finally {
    await stopServer(server);
  }
});

test("http server exposes the seeded knowledge review queue with CORS for authenticated users", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.knowledge-reviewer");
    const response = await fetch(`${baseUrl}/api/v1/knowledge/review-queue`, {
      headers: {
        Origin: "http://127.0.0.1:4173",
        Cookie: cookie,
      },
    });

    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("access-control-allow-origin"),
      "http://127.0.0.1:4173",
    );
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");

    const body = (await response.json()) as Array<{ title: string; status: string }>;

    assert.deepEqual(
      body.map((item) => ({
        title: item.title,
        status: item.status,
      })),
      [
        {
          title: "Clinical study endpoint rule",
          status: "pending_review",
        },
        {
          title: "Case report privacy checklist",
          status: "pending_review",
        },
      ],
    );
  } finally {
    await stopServer(server);
  }
});

test("http server exposes asset-backed detail for seeded knowledge review queue items", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.knowledge-reviewer");
    const queueResponse = await fetch(`${baseUrl}/api/v1/knowledge/review-queue`, {
      headers: {
        Cookie: cookie,
      },
    });
    const queue = (await queueResponse.json()) as Array<{ id: string }>;

    assert.equal(queueResponse.status, 200);
    assert.ok(queue[0]?.id);

    const detailResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/assets/${queue[0]?.id}`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const detail = (await detailResponse.json()) as {
      asset: {
        id: string;
        current_revision_id?: string;
      };
      selected_revision: {
        id: string;
        asset_id: string;
        status: string;
      };
    };

    assert.equal(detailResponse.status, 200);
    assert.equal(detail.asset.id, queue[0]?.id);
    assert.equal(detail.selected_revision.asset_id, queue[0]?.id);
    assert.equal(detail.selected_revision.id, `${queue[0]?.id}-revision-1`);
    assert.equal(detail.asset.current_revision_id, detail.selected_revision.id);
    assert.equal(detail.selected_revision.status, "pending_review");
  } finally {
    await stopServer(server);
  }
});

test("http server returns review history and updates queue state after approve and reject", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.knowledge-reviewer");
    const queueResponse = await fetch(`${baseUrl}/api/v1/knowledge/review-queue`, {
      headers: {
        Cookie: cookie,
      },
    });
    const queue = (await queueResponse.json()) as Array<{ id: string }>;

    assert.equal(queue.length, 2);

    const initialHistoryResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/${queue[0]?.id}/review-actions`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const initialHistory = (await initialHistoryResponse.json()) as Array<{
      action: string;
      review_note?: string;
    }>;

    assert.deepEqual(
      initialHistory.map((record) => ({
        action: record.action,
        review_note: record.review_note,
      })),
      [
        {
          action: "submitted_for_review",
          review_note: undefined,
        },
      ],
    );

    const approveResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/${queue[0]?.id}/approve`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviewNote: "Approved in browser validation.",
        }),
      },
    );
    const approveBody = (await approveResponse.json()) as { status: string };

    assert.equal(approveResponse.status, 200);
    assert.equal(approveBody.status, "approved");

    const rejectResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/${queue[1]?.id}/reject`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviewNote: "Needs stronger privacy evidence.",
        }),
      },
    );
    const rejectBody = (await rejectResponse.json()) as { status: string };

    assert.equal(rejectResponse.status, 200);
    assert.equal(rejectBody.status, "draft");

    const finalQueueResponse = await fetch(`${baseUrl}/api/v1/knowledge/review-queue`, {
      headers: {
        Cookie: cookie,
      },
    });
    const finalQueue = (await finalQueueResponse.json()) as Array<unknown>;

    assert.equal(finalQueue.length, 0);

    const approvedHistoryResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/${queue[0]?.id}/review-actions`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const approvedHistory = (await approvedHistoryResponse.json()) as Array<{
      action: string;
      review_note?: string;
    }>;

    assert.deepEqual(
      approvedHistory.map((record) => ({
        action: record.action,
        review_note: record.review_note,
      })),
      [
        {
          action: "submitted_for_review",
          review_note: undefined,
        },
        {
          action: "approved",
          review_note: "Approved in browser validation.",
        },
      ],
    );
  } finally {
    await stopServer(server);
  }
});

test("http server answers preflight and health checks", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const optionsResponse = await fetch(`${baseUrl}/api/v1/knowledge/review-queue`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:4173",
        "Access-Control-Request-Method": "GET",
      },
    });

    assert.equal(optionsResponse.status, 204);
    assert.equal(
      optionsResponse.headers.get("access-control-allow-origin"),
      "http://127.0.0.1:4173",
    );

    const healthResponse = await fetch(`${baseUrl}/healthz`);
    const healthBody = (await healthResponse.json()) as { status: string };
    const readyResponse = await fetch(`${baseUrl}/readyz`);
    const readyBody = (await readyResponse.json()) as {
      status: string;
      components: Record<string, string>;
    };

    assert.equal(healthResponse.status, 200);
    assert.deepEqual(healthBody, {
      status: "ok",
    });
    assert.equal(readyResponse.status, 200);
    assert.deepEqual(readyBody, {
      status: "ready",
      components: {
        runtimeContract: "ok",
      },
    });
  } finally {
    await stopServer(server);
  }
});

test("http server creates and approves a governed learning candidate", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.knowledge-reviewer");
    const snapshotResponse = await fetch(
      `${baseUrl}/api/v1/learning/reviewed-case-snapshots`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          manuscriptId: "manuscript-demo-1",
          module: "editing",
          manuscriptType: "clinical_study",
          humanFinalAssetId: "human-final-demo-1",
          deidentificationPassed: true,
          requestedBy: "forged-requested-by",
          storageKey: "learning/manuscript-demo-1/snapshot.bin",
        }),
      },
    );
    const snapshot = (await snapshotResponse.json()) as {
      id: string;
      created_by: string;
    };

    assert.equal(snapshotResponse.status, 201);
    assert.ok(snapshot.id);
    assert.equal(snapshot.created_by, "dev-knowledge-reviewer");

    const candidateResponse = await fetch(
      `${baseUrl}/api/v1/learning/candidates/governed`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snapshotId: snapshot.id,
          type: "rule_candidate",
          title: "Terminology normalization candidate",
          proposalText: "Normalize core endpoint terminology across the manuscript.",
          requestedBy: "forged-requested-by",
          deidentificationPassed: true,
          governedSource: {
            sourceKind: "evaluation_experiment",
            reviewedCaseSnapshotId: snapshot.id,
            evaluationRunId: "eval-demo-1",
            evidencePackId: "evidence-demo-1",
            sourceAssetId: "human-final-demo-1",
          },
        }),
      },
    );
    const candidate = (await candidateResponse.json()) as {
      id: string;
      status: string;
      created_by: string;
      governed_provenance_kind?: string;
    };

    assert.equal(candidateResponse.status, 201);
    assert.equal(candidate.status, "pending_review");
    assert.equal(candidate.created_by, "dev-knowledge-reviewer");
    assert.equal(candidate.governed_provenance_kind, "evaluation_experiment");

    const approveResponse = await fetch(
      `${baseUrl}/api/v1/learning/candidates/${candidate.id}/approve`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "admin",
        }),
      },
    );
    const approved = (await approveResponse.json()) as { status: string };

    assert.equal(approveResponse.status, 200);
    assert.equal(approved.status, "approved");
  } finally {
    await stopServer(server);
  }
});

test("http server preserves CORS headers on learning approval permission errors", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.editor");
    const response = await fetch(
      `${baseUrl}/api/v1/learning/candidates/learning-pending-demo-1/approve`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: "http://127.0.0.1:4173",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
        }),
      },
    );
    const body = (await response.json()) as { error: string; message: string };

    assert.equal(response.status, 403);
    assert.equal(
      response.headers.get("access-control-allow-origin"),
      "http://127.0.0.1:4173",
    );
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
    assert.equal(body.error, "forbidden");
  } finally {
    await stopServer(server);
  }
});

test("http server seeded pending learning candidates can be approved by admin", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.admin");
    const approveResponse = await fetch(
      `${baseUrl}/api/v1/learning/candidates/learning-pending-demo-1/approve`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "user",
        }),
      },
    );
    const approved = (await approveResponse.json()) as { status: string };

    assert.equal(approveResponse.status, 200);
    assert.equal(approved.status, "approved");
  } finally {
    await stopServer(server);
  }
});

test("http server lets admin create template governance and prompt skill drafts", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.admin");
    const familyResponse = await fetch(`${baseUrl}/api/v1/templates/families`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        manuscriptType: "review",
        name: "Review governance family",
      }),
    });
    const family = (await familyResponse.json()) as { id: string; name: string };

    assert.equal(familyResponse.status, 201);
    assert.equal(family.name, "Review governance family");

    const moduleDraftResponse = await fetch(`${baseUrl}/api/v1/templates/module-drafts`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        templateFamilyId: family.id,
        module: "proofreading",
        manuscriptType: "review",
        prompt: "Create a proofreading draft before final handoff.",
        checklist: ["Consistency"],
        sectionRequirements: ["discussion"],
      }),
    });
    const moduleDraft = (await moduleDraftResponse.json()) as {
      id: string;
      status: string;
      version_no: number;
    };

    assert.equal(moduleDraftResponse.status, 201);
    assert.equal(moduleDraft.status, "draft");
    assert.equal(moduleDraft.version_no, 1);

    const promptTemplateResponse = await fetch(
      `${baseUrl}/api/v1/prompt-skill-registry/prompt-templates`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "user",
          name: "proofreading_mainline",
          version: "1.0.0",
          module: "proofreading",
          manuscriptTypes: ["review"],
        }),
      },
    );
    const promptTemplate = (await promptTemplateResponse.json()) as {
      id: string;
      status: string;
      module: string;
    };

    assert.equal(promptTemplateResponse.status, 201);
    assert.equal(promptTemplate.status, "draft");
    assert.equal(promptTemplate.module, "proofreading");

    const skillPackageResponse = await fetch(
      `${baseUrl}/api/v1/prompt-skill-registry/skill-packages`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          name: "editing_skills",
          version: "1.0.0",
          appliesToModules: ["editing"],
          dependencyTools: ["python-docx"],
        }),
      },
    );
    const skillPackage = (await skillPackageResponse.json()) as {
      id: string;
      status: string;
      scope: string;
    };

    assert.equal(skillPackageResponse.status, 201);
    assert.equal(skillPackage.status, "draft");
    assert.equal(skillPackage.scope, "admin_only");

    const moduleListResponse = await fetch(
      `${baseUrl}/api/v1/templates/families/${family.id}/module-templates`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const moduleList = (await moduleListResponse.json()) as Array<{ id: string }>;
    const familyListResponse = await fetch(`${baseUrl}/api/v1/templates/families`, {
      headers: {
        Cookie: cookie,
      },
    });
    const familyList = (await familyListResponse.json()) as Array<{ id: string }>;
    const promptListResponse = await fetch(
      `${baseUrl}/api/v1/prompt-skill-registry/prompt-templates`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const promptList = (await promptListResponse.json()) as Array<{ id: string }>;
    const skillListResponse = await fetch(
      `${baseUrl}/api/v1/prompt-skill-registry/skill-packages`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const skillList = (await skillListResponse.json()) as Array<{ id: string }>;

    assert.equal(moduleListResponse.status, 200);
    assert.equal(familyListResponse.status, 200);
    assert.equal(promptListResponse.status, 200);
    assert.equal(skillListResponse.status, 200);
    assert.equal(moduleList.some((record) => record.id === moduleDraft.id), true);
    assert.equal(familyList.some((record) => record.id === family.id), true);
    assert.equal(promptList.some((record) => record.id === promptTemplate.id), true);
    assert.equal(skillList.some((record) => record.id === skillPackage.id), true);
  } finally {
    await stopServer(server);
  }
});

test("http server rejects activating a second template family for the same manuscript type", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.admin");
    const firstFamilyResponse = await fetch(`${baseUrl}/api/v1/templates/families`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        manuscriptType: "review",
        name: "Review governance family A",
      }),
    });
    const firstFamily = (await firstFamilyResponse.json()) as { id: string };

    const secondFamilyResponse = await fetch(`${baseUrl}/api/v1/templates/families`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        manuscriptType: "review",
        name: "Review governance family B",
      }),
    });
    const secondFamily = (await secondFamilyResponse.json()) as { id: string };

    const activateFirstResponse = await fetch(
      `${baseUrl}/api/v1/templates/families/${firstFamily.id}`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "active",
        }),
      },
    );

    const activateSecondResponse = await fetch(
      `${baseUrl}/api/v1/templates/families/${secondFamily.id}`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "active",
        }),
      },
    );
    const activateSecondBody = (await activateSecondResponse.json()) as {
      error: string;
      message: string;
    };

    assert.equal(activateFirstResponse.status, 200);
    assert.equal(activateSecondResponse.status, 409);
    assert.equal(activateSecondBody.error, "state_conflict");
    assert.match(activateSecondBody.message, /already active/i);
  } finally {
    await stopServer(server);
  }
});

test("http server lets admin manage model registry entries and routing policy", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.admin");
    const createResponse = await fetch(`${baseUrl}/api/v1/model-registry`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorRole: "editor",
        provider: "openai",
        modelName: "gpt-5.4",
        modelVersion: "2026-03-01",
        allowedModules: ["screening", "editing", "proofreading"],
        isProdAllowed: true,
        costProfile: {
          currency: "USD",
          unit: "per_1m_tokens",
          input: 5,
          output: 15,
        },
      }),
    });
    const createdModel = (await createResponse.json()) as {
      id: string;
      provider: string;
      model_name: string;
      allowed_modules: string[];
      is_prod_allowed: boolean;
    };

    assert.equal(createResponse.status, 201);
    assert.equal(createdModel.provider, "openai");
    assert.equal(createdModel.model_name, "gpt-5.4");
    assert.deepEqual(createdModel.allowed_modules, [
      "screening",
      "editing",
      "proofreading",
    ]);
    assert.equal(createdModel.is_prod_allowed, true);

    const updateResponse = await fetch(
      `${baseUrl}/api/v1/model-registry/${createdModel.id}`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "knowledge_reviewer",
          allowedModules: ["editing", "proofreading"],
          fallbackModelId: null,
        }),
      },
    );
    const updatedModel = (await updateResponse.json()) as {
      id: string;
      allowed_modules: string[];
    };

    assert.equal(updateResponse.status, 200);
    assert.equal(updatedModel.id, createdModel.id);
    assert.deepEqual(updatedModel.allowed_modules, ["editing", "proofreading"]);

    const listResponse = await fetch(`${baseUrl}/api/v1/model-registry`, {
      headers: {
        Cookie: cookie,
      },
    });
    const models = (await listResponse.json()) as Array<{
      id: string;
      model_name: string;
      allowed_modules: string[];
    }>;

    assert.equal(listResponse.status, 200);
    const modelsById = new Map(
      models.map((record) => [
        record.id,
        {
          model_name: record.model_name,
          allowed_modules: record.allowed_modules,
        },
      ]),
    );
    assert.deepEqual(modelsById.get(createdModel.id), {
      model_name: "gpt-5.4",
      allowed_modules: ["editing", "proofreading"],
    });

    const policyUpdateResponse = await fetch(
      `${baseUrl}/api/v1/model-registry/routing-policy`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          moduleDefaults: {
            editing: createdModel.id,
            proofreading: createdModel.id,
          },
          templateOverrides: {
            "template-review-proofreading-v1": createdModel.id,
          },
        }),
      },
    );
    const updatedPolicy = (await policyUpdateResponse.json()) as {
      system_default_model_id?: string;
      module_defaults: Record<string, string>;
      template_overrides: Record<string, string>;
    };

    assert.equal(policyUpdateResponse.status, 200);
    assert.equal(updatedPolicy.system_default_model_id, undefined);
    assert.equal(updatedPolicy.module_defaults.editing, createdModel.id);
    assert.equal(updatedPolicy.module_defaults.proofreading, createdModel.id);
    assert.deepEqual(updatedPolicy.template_overrides, {
      "template-review-proofreading-v1": createdModel.id,
    });

    const policyResponse = await fetch(`${baseUrl}/api/v1/model-registry/routing-policy`, {
      headers: {
        Cookie: cookie,
      },
    });
    const policy = (await policyResponse.json()) as {
      module_defaults: Record<string, string>;
      template_overrides: Record<string, string>;
    };

    assert.equal(policyResponse.status, 200);
    assert.equal(policy.module_defaults.editing, createdModel.id);
    assert.equal(policy.module_defaults.proofreading, createdModel.id);
    assert.deepEqual(policy.template_overrides, {
      "template-review-proofreading-v1": createdModel.id,
    });
  } finally {
    await stopServer(server);
  }
});

test("http server lets admin manage the model routing governance lifecycle", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.admin");

    const createModel = async (input: {
      provider: string;
      modelName: string;
      modelVersion: string;
      allowedModules: string[];
    }) => {
      const response = await fetch(`${baseUrl}/api/v1/model-registry`, {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          provider: input.provider,
          modelName: input.modelName,
          modelVersion: input.modelVersion,
          allowedModules: input.allowedModules,
          isProdAllowed: true,
        }),
      });
      const body = (await response.json()) as { id: string };

      assert.equal(response.status, 201);
      return body;
    };

    const primaryModel = await createModel({
      provider: "openai",
      modelName: "gpt-5-routing-primary",
      modelVersion: "2026-04-01",
      allowedModules: ["screening", "editing", "proofreading"],
    });
    const fallbackModel = await createModel({
      provider: "google",
      modelName: "gemini-routing-fallback",
      modelVersion: "2026-04-01",
      allowedModules: ["screening", "editing", "proofreading"],
    });
    const alternateModel = await createModel({
      provider: "anthropic",
      modelName: "claude-routing-alternate",
      modelVersion: "2026-04-01",
      allowedModules: ["screening", "editing", "proofreading"],
    });

    const createPolicyResponse = await fetch(
      `${baseUrl}/api/v1/model-routing-governance/policies`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          input: {
            scopeKind: "template_family",
            scopeValue: "family-http-routing-1",
            primaryModelId: primaryModel.id,
            fallbackModelIds: [fallbackModel.id],
            evidenceLinks: [{ kind: "evaluation_run", id: "run-http-routing-1" }],
            notes: "Create the initial routing governance draft.",
          },
        }),
      },
    );
    const createdDraft = (await createPolicyResponse.json()) as {
      policy_id: string;
      scope: {
        scope_kind: string;
        scope_value: string;
      };
      version: {
        id: string;
        status: string;
        primary_model_id: string;
        fallback_model_ids: string[];
      };
    };

    assert.equal(createPolicyResponse.status, 201);
    assert.equal(createdDraft.scope.scope_kind, "template_family");
    assert.equal(createdDraft.scope.scope_value, "family-http-routing-1");
    assert.equal(createdDraft.version.status, "draft");
    assert.equal(createdDraft.version.primary_model_id, primaryModel.id);
    assert.deepEqual(createdDraft.version.fallback_model_ids, [fallbackModel.id]);

    const updateDraftResponse = await fetch(
      `${baseUrl}/api/v1/model-routing-governance/versions/${createdDraft.version.id}/draft`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          input: {
            fallbackModelIds: [fallbackModel.id],
            notes: "Keep a single approved fallback in the draft.",
          },
        }),
      },
    );
    const updatedDraft = (await updateDraftResponse.json()) as {
      version: {
        status: string;
        fallback_model_ids: string[];
        notes?: string;
      };
    };

    assert.equal(updateDraftResponse.status, 200);
    assert.equal(updatedDraft.version.status, "draft");
    assert.deepEqual(updatedDraft.version.fallback_model_ids, [fallbackModel.id]);
    assert.equal(
      updatedDraft.version.notes,
      "Keep a single approved fallback in the draft.",
    );

    const activateBeforeApprovalResponse = await fetch(
      `${baseUrl}/api/v1/model-routing-governance/versions/${createdDraft.version.id}/activate`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          reason: "This should fail before approval.",
        }),
      },
    );
    const activateBeforeApproval = (await activateBeforeApprovalResponse.json()) as {
      error: string;
      message: string;
    };

    assert.equal(activateBeforeApprovalResponse.status, 409);
    assert.equal(activateBeforeApproval.error, "state_conflict");
    assert.match(activateBeforeApproval.message, /cannot transition/i);

    const submitResponse = await fetch(
      `${baseUrl}/api/v1/model-routing-governance/versions/${createdDraft.version.id}/submit`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          reason: "Route the policy into review.",
        }),
      },
    );
    const submittedDraft = (await submitResponse.json()) as {
      version: {
        status: string;
      };
    };

    assert.equal(submitResponse.status, 200);
    assert.equal(submittedDraft.version.status, "pending_review");

    const approveResponse = await fetch(
      `${baseUrl}/api/v1/model-routing-governance/versions/${createdDraft.version.id}/approve`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          reason: "Evidence supports approval.",
        }),
      },
    );
    const approvedDraft = (await approveResponse.json()) as {
      version: {
        status: string;
      };
    };

    assert.equal(approveResponse.status, 200);
    assert.equal(approvedDraft.version.status, "approved");

    const activateResponse = await fetch(
      `${baseUrl}/api/v1/model-routing-governance/versions/${createdDraft.version.id}/activate`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          reason: "Promote the approved version to active.",
        }),
      },
    );
    const activeDraft = (await activateResponse.json()) as {
      version: {
        id: string;
        status: string;
      };
    };

    assert.equal(activateResponse.status, 200);
    assert.equal(activeDraft.version.id, createdDraft.version.id);
    assert.equal(activeDraft.version.status, "active");

    const listResponse = await fetch(
      `${baseUrl}/api/v1/model-routing-governance/policies`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const policies = (await listResponse.json()) as Array<{
      policy_id: string;
      scope_kind: string;
      scope_value: string;
      active_version?: {
        status: string;
        primary_model_id: string;
        scope_kind: string;
        fallback_model_ids: string[];
      };
    }>;
    const listedPolicy = policies.find(
      (policy) => policy.policy_id === createdDraft.policy_id,
    );

    assert.equal(listResponse.status, 200);
    assert.equal(listedPolicy?.scope_kind, "template_family");
    assert.equal(listedPolicy?.scope_value, "family-http-routing-1");
    assert.equal(listedPolicy?.active_version?.status, "active");
    assert.equal(listedPolicy?.active_version?.primary_model_id, primaryModel.id);
    assert.equal(listedPolicy?.active_version?.scope_kind, "template_family");
    assert.deepEqual(listedPolicy?.active_version?.fallback_model_ids, [
      fallbackModel.id,
    ]);

    const createDraftVersionResponse = await fetch(
      `${baseUrl}/api/v1/model-routing-governance/policies/${createdDraft.policy_id}/versions`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          input: {
            primaryModelId: alternateModel.id,
            fallbackModelIds: [fallbackModel.id],
            evidenceLinks: [{ kind: "evaluation_run", id: "run-http-routing-2" }],
            notes: "Prepare a superseding draft version.",
          },
        }),
      },
    );
    const nextDraft = (await createDraftVersionResponse.json()) as {
      version: {
        id: string;
        version_no: number;
        status: string;
        primary_model_id: string;
      };
    };

    assert.equal(createDraftVersionResponse.status, 201);
    assert.equal(nextDraft.version.version_no, 2);
    assert.equal(nextDraft.version.status, "draft");
    assert.equal(nextDraft.version.primary_model_id, alternateModel.id);

    const submitNextDraftResponse = await fetch(
      `${baseUrl}/api/v1/model-routing-governance/versions/${nextDraft.version.id}/submit`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          reason: "Submit the superseding draft.",
        }),
      },
    );
    const approveNextDraftResponse = await fetch(
      `${baseUrl}/api/v1/model-routing-governance/versions/${nextDraft.version.id}/approve`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          reason: "Approve the superseding draft.",
        }),
      },
    );
    const activateNextDraftResponse = await fetch(
      `${baseUrl}/api/v1/model-routing-governance/versions/${nextDraft.version.id}/activate`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          reason: "Activate the superseding draft.",
        }),
      },
    );
    const activeNextDraft = (await activateNextDraftResponse.json()) as {
      version: {
        id: string;
        status: string;
        primary_model_id: string;
      };
    };

    assert.equal(submitNextDraftResponse.status, 200);
    assert.equal(approveNextDraftResponse.status, 200);
    assert.equal(activateNextDraftResponse.status, 200);
    assert.equal(activeNextDraft.version.id, nextDraft.version.id);
    assert.equal(activeNextDraft.version.status, "active");
    assert.equal(activeNextDraft.version.primary_model_id, alternateModel.id);

    const rollbackResponse = await fetch(
      `${baseUrl}/api/v1/model-routing-governance/policies/${createdDraft.policy_id}/rollback`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          reason: "Return this scope to the legacy fallback path.",
        }),
      },
    );
    const rolledBack = (await rollbackResponse.json()) as {
      version: {
        status: string;
      };
    };

    assert.equal(rollbackResponse.status, 200);
    assert.equal(rolledBack.version.status, "rolled_back");
  } finally {
    await stopServer(server);
  }
});

test("http server rejects routing governance approval without evidence links", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.admin");

    const createModelResponse = await fetch(`${baseUrl}/api/v1/model-registry`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorRole: "editor",
        provider: "openai",
        modelName: "gpt-5-routing-without-evidence",
        modelVersion: "2026-04-02",
        allowedModules: ["editing"],
        isProdAllowed: true,
      }),
    });
    const createdModel = (await createModelResponse.json()) as { id: string };

    assert.equal(createModelResponse.status, 201);

    const createPolicyResponse = await fetch(
      `${baseUrl}/api/v1/model-routing-governance/policies`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          input: {
            scopeKind: "module",
            scopeValue: "editing",
            primaryModelId: createdModel.id,
            fallbackModelIds: [],
            evidenceLinks: [],
            notes: "Create a draft without evidence to prove validation.",
          },
        }),
      },
    );
    const createdDraft = (await createPolicyResponse.json()) as {
      version: {
        id: string;
        status: string;
      };
    };

    assert.equal(createPolicyResponse.status, 201);
    assert.equal(createdDraft.version.status, "draft");

    const submitResponse = await fetch(
      `${baseUrl}/api/v1/model-routing-governance/versions/${createdDraft.version.id}/submit`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          reason: "Submit the no-evidence draft.",
        }),
      },
    );

    assert.equal(submitResponse.status, 200);

    const approveResponse = await fetch(
      `${baseUrl}/api/v1/model-routing-governance/versions/${createdDraft.version.id}/approve`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          reason: "Approval should fail without evidence.",
        }),
      },
    );
    const approvalError = (await approveResponse.json()) as {
      error: string;
      message: string;
    };

    assert.equal(approveResponse.status, 400);
    assert.equal(approvalError.error, "invalid_request");
    assert.match(approvalError.message, /requires evidence links/i);
  } finally {
    await stopServer(server);
  }
});

test("http server resolves governed execution bundles and records execution snapshots", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.admin");
    const familyResponse = await fetch(`${baseUrl}/api/v1/templates/families`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        manuscriptType: "clinical_study",
        name: "Execution family",
      }),
    });
    const family = (await familyResponse.json()) as { id: string };

    const moduleTemplateDraftResponse = await fetch(
      `${baseUrl}/api/v1/templates/module-drafts`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateFamilyId: family.id,
          module: "editing",
          manuscriptType: "clinical_study",
          prompt: "Execution editing template",
          checklist: ["Consistency"],
        }),
      },
    );
    const moduleTemplateDraft = (await moduleTemplateDraftResponse.json()) as {
      id: string;
      version_no: number;
    };
    await fetch(`${baseUrl}/api/v1/templates/module-templates/${moduleTemplateDraft.id}/publish`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorRole: "editor",
      }),
    });

    const ruleSetResponse = await fetch(
      `${baseUrl}/api/v1/editorial-rules/rule-sets`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          templateFamilyId: family.id,
          module: "editing",
        }),
      },
    );
    const ruleSet = (await ruleSetResponse.json()) as { id: string };

    assert.equal(ruleSetResponse.status, 201);

    const publishRuleSetResponse = await fetch(
      `${baseUrl}/api/v1/editorial-rules/rule-sets/${ruleSet.id}/publish`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
        }),
      },
    );

    assert.equal(publishRuleSetResponse.status, 200);

    const promptTemplateResponse = await fetch(
      `${baseUrl}/api/v1/prompt-skill-registry/prompt-templates`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          name: "editing_mainline",
          version: "1.0.0",
          module: "editing",
          manuscriptTypes: ["clinical_study"],
        }),
      },
    );
    const promptTemplate = (await promptTemplateResponse.json()) as { id: string };
    await fetch(
      `${baseUrl}/api/v1/prompt-skill-registry/prompt-templates/${promptTemplate.id}/publish`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
        }),
      },
    );

    const skillPackageResponse = await fetch(
      `${baseUrl}/api/v1/prompt-skill-registry/skill-packages`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          name: "editing_skills",
          version: "1.0.0",
          appliesToModules: ["editing"],
        }),
      },
    );
    const skillPackage = (await skillPackageResponse.json()) as { id: string };
    await fetch(
      `${baseUrl}/api/v1/prompt-skill-registry/skill-packages/${skillPackage.id}/publish`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
        }),
      },
    );

    const modelResponse = await fetch(`${baseUrl}/api/v1/model-registry`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorRole: "editor",
        provider: "openai",
        modelName: "gpt-5.4",
        allowedModules: ["editing"],
        isProdAllowed: true,
      }),
    });
    const model = (await modelResponse.json()) as { id: string };

    await fetch(`${baseUrl}/api/v1/model-registry/routing-policy`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorRole: "editor",
        moduleDefaults: {
          editing: model.id,
        },
      }),
    });

    const profileResponse = await fetch(
      `${baseUrl}/api/v1/execution-governance/profiles`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          input: {
            module: "editing",
            manuscriptType: "clinical_study",
            templateFamilyId: family.id,
            moduleTemplateId: moduleTemplateDraft.id,
            ruleSetId: ruleSet.id,
            promptTemplateId: promptTemplate.id,
            skillPackageIds: [skillPackage.id],
            knowledgeBindingMode: "profile_plus_dynamic",
          },
        }),
      },
    );
    const profile = (await profileResponse.json()) as { id: string };

    const publishProfileResponse = await fetch(
      `${baseUrl}/api/v1/execution-governance/profiles/${profile.id}/publish`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
        }),
      },
    );
    const publishedProfile = (await publishProfileResponse.json()) as { status: string };

    assert.equal(profileResponse.status, 201);
    assert.equal(publishProfileResponse.status, 200);
    assert.equal(publishedProfile.status, "active");

    const resolveResponse = await fetch(`${baseUrl}/api/v1/execution-governance/resolve`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        module: "editing",
        manuscriptType: "clinical_study",
        templateFamilyId: family.id,
      }),
    });
    const resolved = (await resolveResponse.json()) as {
      profile: { id: string };
      resolved_model: { id: string };
      skill_packages: Array<{ id: string }>;
      runtime_binding_readiness: {
        observation_status: string;
        report?: {
          status: string;
          issues: Array<{ code: string }>;
        };
      };
    };

    assert.equal(resolveResponse.status, 200);
    assert.equal(resolved.profile.id, profile.id);
    assert.equal(resolved.resolved_model.id, model.id);
    assert.deepEqual(
      resolved.skill_packages.map((record) => record.id),
      [skillPackage.id],
    );
    assert.equal(
      resolved.runtime_binding_readiness.observation_status,
      "reported",
    );
    assert.equal(resolved.runtime_binding_readiness.report?.status, "missing");
    assert.ok(
      resolved.runtime_binding_readiness.report?.issues.some(
        (issue) => issue.code === "missing_active_binding",
      ),
    );

    const createExecutionLogResponse = await fetch(
      `${baseUrl}/api/v1/agent-execution`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: {
            manuscriptId: "manuscript-demo-1",
            module: "editing",
            triggeredBy: "dev-admin",
            runtimeId: "runtime-http-1",
            sandboxProfileId: "sandbox-http-1",
            agentProfileId: "agent-profile-http-1",
            runtimeBindingId: "binding-http-1",
            toolPermissionPolicyId: "policy-http-1",
            knowledgeItemIds: ["knowledge-demo-1"],
            evaluationSuiteIds: ["suite-http-1"],
          },
        }),
      },
    );
    const executionLog = (await createExecutionLogResponse.json()) as {
      id: string;
    };

    assert.equal(createExecutionLogResponse.status, 201);

    const completeExecutionLogResponse = await fetch(
      `${baseUrl}/api/v1/agent-execution/${executionLog.id}/complete`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          executionSnapshotId: "snapshot-http-link-placeholder",
        }),
      },
    );

    assert.equal(completeExecutionLogResponse.status, 200);

    const snapshotResponse = await fetch(
      `${baseUrl}/api/v1/execution-tracking/snapshots`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: {
            manuscriptId: "manuscript-demo-1",
            module: "editing",
            jobId: "job-demo-1",
            executionProfileId: profile.id,
            moduleTemplateId: moduleTemplateDraft.id,
            moduleTemplateVersionNo: moduleTemplateDraft.version_no,
            promptTemplateId: promptTemplate.id,
            promptTemplateVersion: "1.0.0",
            skillPackageIds: [skillPackage.id],
            skillPackageVersions: ["1.0.0"],
            modelId: model.id,
            agentExecutionLogId: executionLog.id,
            knowledgeHits: [
              {
                knowledgeItemId: "knowledge-demo-1",
                matchSource: "dynamic_routing",
                matchReasons: ["demo"],
              },
            ],
          },
        }),
      },
    );
    const snapshot = (await snapshotResponse.json()) as {
      id: string;
      model_id: string;
      agent_execution_log_id?: string;
      agent_execution: {
        observation_status: string;
        log_id?: string;
        log?: {
          id: string;
          status: string;
          orchestration_status: string;
          completion_summary: {
            derived_status: string;
          };
          recovery_summary: {
            category: string;
            recovery_readiness: string;
          };
        };
      };
      runtime_binding_readiness: {
        observation_status: string;
        report?: {
          status: string;
          issues: Array<{ code: string }>;
        };
      };
    };

    assert.equal(snapshotResponse.status, 201);
    assert.equal(snapshot.model_id, model.id);
    assert.equal(snapshot.agent_execution_log_id, executionLog.id);
    assert.equal(snapshot.agent_execution.observation_status, "reported");
    assert.equal(snapshot.agent_execution.log_id, executionLog.id);
    assert.equal(snapshot.agent_execution.log?.id, executionLog.id);
    assert.equal(snapshot.agent_execution.log?.status, "completed");
    assert.equal(snapshot.agent_execution.log?.orchestration_status, "pending");
    assert.equal(
      snapshot.agent_execution.log?.completion_summary.derived_status,
      "business_completed_follow_up_pending",
    );
    assert.equal(
      snapshot.agent_execution.log?.recovery_summary.category,
      "recoverable_now",
    );
    assert.equal(
      snapshot.agent_execution.log?.recovery_summary.recovery_readiness,
      "ready_now",
    );
    assert.equal(snapshot.runtime_binding_readiness.observation_status, "reported");
    assert.equal(snapshot.runtime_binding_readiness.report?.status, "missing");
    assert.ok(
      snapshot.runtime_binding_readiness.report?.issues.some(
        (issue) => issue.code === "missing_active_binding",
      ),
    );

    const loadedSnapshotResponse = await fetch(
      `${baseUrl}/api/v1/execution-tracking/snapshots/${snapshot.id}`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const hitLogsResponse = await fetch(
      `${baseUrl}/api/v1/execution-tracking/snapshots/${snapshot.id}/knowledge-hit-logs`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const loadedSnapshot = (await loadedSnapshotResponse.json()) as {
      id: string;
      agent_execution_log_id?: string;
      agent_execution: {
        observation_status: string;
        log_id?: string;
        log?: {
          id: string;
          status: string;
          orchestration_status: string;
          completion_summary: {
            derived_status: string;
          };
          recovery_summary: {
            category: string;
            recovery_readiness: string;
          };
        };
      };
      runtime_binding_readiness: {
        observation_status: string;
        report?: {
          status: string;
          issues: Array<{ code: string }>;
        };
      };
    };
    const hitLogs = (await hitLogsResponse.json()) as Array<{ match_source: string }>;

    assert.equal(loadedSnapshotResponse.status, 200);
    assert.equal(hitLogsResponse.status, 200);
    assert.equal(loadedSnapshot.id, snapshot.id);
    assert.equal(loadedSnapshot.agent_execution_log_id, executionLog.id);
    assert.equal(loadedSnapshot.agent_execution.observation_status, "reported");
    assert.equal(loadedSnapshot.agent_execution.log_id, executionLog.id);
    assert.equal(loadedSnapshot.agent_execution.log?.id, executionLog.id);
    assert.equal(
      loadedSnapshot.agent_execution.log?.completion_summary.derived_status,
      "business_completed_follow_up_pending",
    );
    assert.equal(
      loadedSnapshot.agent_execution.log?.recovery_summary.category,
      "recoverable_now",
    );
    assert.equal(
      loadedSnapshot.runtime_binding_readiness.observation_status,
      "reported",
    );
    assert.equal(
      loadedSnapshot.runtime_binding_readiness.report?.status,
      "missing",
    );
    assert.ok(
      loadedSnapshot.runtime_binding_readiness.report?.issues.some(
        (issue) => issue.code === "missing_active_binding",
      ),
    );
    assert.deepEqual(hitLogs.map((record) => record.match_source), ["dynamic_routing"]);
  } finally {
    await stopServer(server);
  }
});

test("http server creates, applies, and lists learning governance writebacks", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.admin");
    const createResponse = await fetch(
      `${baseUrl}/api/v1/learning-governance/writebacks`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "admin",
          input: {
            learningCandidateId: "learning-approved-demo-1",
            targetType: "knowledge_item",
            createdBy: "forged-created-by",
          },
        }),
      },
    );
    const created = (await createResponse.json()) as {
      id: string;
      status: string;
      created_by: string;
    };

    assert.equal(createResponse.status, 201);
    assert.equal(created.status, "draft");
    assert.equal(created.created_by, "dev-admin");

    const applyResponse = await fetch(
      `${baseUrl}/api/v1/learning-governance/writebacks/${created.id}/apply`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "admin",
          input: {
            targetType: "knowledge_item",
            appliedBy: "forged-applied-by",
            title: "Screening endpoint governance rule",
            canonicalText:
              "Clinical study submissions must disclose the primary endpoint and analysis method.",
            knowledgeKind: "rule",
            moduleScope: "screening",
            manuscriptTypes: ["clinical_study"],
          },
        }),
      },
    );
    const applied = (await applyResponse.json()) as {
      status: string;
      created_draft_asset_id?: string;
      applied_by?: string;
    };

    assert.equal(applyResponse.status, 200);
    assert.equal(applied.status, "applied");
    assert.ok(applied.created_draft_asset_id);
    assert.equal(applied.applied_by, "dev-admin");

    const listResponse = await fetch(
      `${baseUrl}/api/v1/learning-governance/candidates/learning-approved-demo-1/writebacks`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const writebacks = (await listResponse.json()) as Array<{
      id: string;
      status: string;
      created_draft_asset_id?: string;
    }>;

    assert.equal(listResponse.status, 200);
    assert.equal(writebacks.length, 1);
    assert.equal(writebacks[0]?.status, "applied");
    assert.equal(writebacks[0]?.id, created.id);
    assert.ok(writebacks[0]?.created_draft_asset_id);
  } finally {
    await stopServer(server);
  }
});

test("http server lists seeded learning review candidates and exposes candidate detail", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.knowledge-reviewer");
    const queueResponse = await fetch(`${baseUrl}/api/v1/learning/candidates/review-queue`, {
      headers: {
        Cookie: cookie,
      },
    });
    const queue = (await queueResponse.json()) as Array<{
      id: string;
      title?: string;
      status: string;
    }>;

    assert.equal(queueResponse.status, 200);
    assert.deepEqual(
      queue.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
      })),
      [
        {
          id: "learning-pending-demo-1",
          title: "Pending terminology normalization",
          status: "pending_review",
        },
        {
          id: "learning-pending-demo-2",
          title: "Pending checklist update",
          status: "pending_review",
        },
      ],
    );

    const detailResponse = await fetch(
      `${baseUrl}/api/v1/learning/candidates/learning-approved-demo-1`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const detail = (await detailResponse.json()) as {
      id: string;
      status: string;
      title?: string;
      governed_provenance_kind?: string;
    };

    assert.equal(detailResponse.status, 200);
    assert.deepEqual(
      {
        id: detail.id,
        status: detail.status,
        title: detail.title,
        governed_provenance_kind: detail.governed_provenance_kind,
      },
      {
      id: "learning-approved-demo-1",
      status: "approved",
      title: "Approved learning candidate demo",
      governed_provenance_kind: "evaluation_experiment",
      },
    );
  } finally {
    await stopServer(server);
  }
});

test("http server exposes admin agent-tooling governance routes and execution logging", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.admin");

    const createKnowledgeToolResponse = await fetch(`${baseUrl}/api/v1/tool-gateway`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorRole: "editor",
        input: {
          name: "knowledge.search",
          scope: "knowledge",
        },
      }),
    });
    const knowledgeTool = (await createKnowledgeToolResponse.json()) as {
      id: string;
      access_mode: string;
    };

    const createAssetToolResponse = await fetch(`${baseUrl}/api/v1/tool-gateway`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorRole: "knowledge_reviewer",
        input: {
          name: "assets.write",
          scope: "assets",
          accessMode: "write",
        },
      }),
    });
    const assetTool = (await createAssetToolResponse.json()) as {
      id: string;
      access_mode: string;
    };

    assert.equal(createKnowledgeToolResponse.status, 201);
    assert.equal(createAssetToolResponse.status, 201);
    assert.equal(knowledgeTool.access_mode, "read");
    assert.equal(assetTool.access_mode, "write");

    const policyDraftResponse = await fetch(
      `${baseUrl}/api/v1/tool-permission-policies`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          input: {
            name: "Editing Agent Policy",
            allowedToolIds: [knowledgeTool.id, assetTool.id],
            highRiskToolIds: [assetTool.id],
          },
        }),
      },
    );
    const policyDraft = (await policyDraftResponse.json()) as {
      id: string;
      status: string;
    };

    assert.equal(policyDraftResponse.status, 201);
    assert.equal(policyDraft.status, "draft");

    const activatePolicyResponse = await fetch(
      `${baseUrl}/api/v1/tool-permission-policies/${policyDraft.id}/activate`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "user",
        }),
      },
    );
    const activePolicy = (await activatePolicyResponse.json()) as {
      id: string;
      status: string;
    };

    assert.equal(activatePolicyResponse.status, 200);
    assert.equal(activePolicy.status, "active");

    const sandboxDraftResponse = await fetch(`${baseUrl}/api/v1/sandbox-profiles`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorRole: "editor",
        input: {
          name: "Editing Workspace",
          sandboxMode: "workspace_write",
          networkAccess: false,
          approvalRequired: true,
          allowedToolIds: [knowledgeTool.id, assetTool.id],
        },
      }),
    });
    const sandboxDraft = (await sandboxDraftResponse.json()) as {
      id: string;
      status: string;
    };

    assert.equal(sandboxDraftResponse.status, 201);
    assert.equal(sandboxDraft.status, "draft");

    const activateSandboxResponse = await fetch(
      `${baseUrl}/api/v1/sandbox-profiles/${sandboxDraft.id}/activate`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "proofreader",
        }),
      },
    );
    const activeSandbox = (await activateSandboxResponse.json()) as {
      id: string;
      status: string;
    };

    assert.equal(activateSandboxResponse.status, 200);
    assert.equal(activeSandbox.status, "active");

    const runtimeDraftResponse = await fetch(`${baseUrl}/api/v1/agent-runtime`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorRole: "editor",
        input: {
          name: "Deep Editing Runtime",
          adapter: "deepagents",
          sandboxProfileId: sandboxDraft.id,
          allowedModules: ["editing"],
          runtimeSlot: "editing",
        },
      }),
    });
    const runtimeDraft = (await runtimeDraftResponse.json()) as {
      id: string;
      status: string;
    };

    assert.equal(runtimeDraftResponse.status, 201);
    assert.equal(runtimeDraft.status, "draft");

    const publishRuntimeResponse = await fetch(
      `${baseUrl}/api/v1/agent-runtime/${runtimeDraft.id}/publish`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "user",
        }),
      },
    );
    const activeRuntime = (await publishRuntimeResponse.json()) as {
      id: string;
      status: string;
    };

    assert.equal(publishRuntimeResponse.status, 200);
    assert.equal(activeRuntime.status, "active");

    const runtimeByModuleResponse = await fetch(
      `${baseUrl}/api/v1/agent-runtime/by-module/editing?activeOnly=true`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const runtimesByModule = (await runtimeByModuleResponse.json()) as Array<{
      id: string;
    }>;

    assert.equal(runtimeByModuleResponse.status, 200);
    assert.deepEqual(runtimesByModule.map((record) => record.id), [runtimeDraft.id]);

    const agentProfileDraftResponse = await fetch(
      `${baseUrl}/api/v1/agent-profiles`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          input: {
            name: "Editing Executor",
            roleKey: "subagent",
            moduleScope: ["editing"],
            manuscriptTypes: ["clinical_study"],
            description: "Executes editing plans in the approved runtime.",
          },
        }),
      },
    );
    const agentProfileDraft = (await agentProfileDraftResponse.json()) as {
      id: string;
      status: string;
    };

    assert.equal(agentProfileDraftResponse.status, 201);
    assert.equal(agentProfileDraft.status, "draft");

    const publishAgentProfileResponse = await fetch(
      `${baseUrl}/api/v1/agent-profiles/${agentProfileDraft.id}/publish`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "user",
        }),
      },
    );
    const publishedAgentProfile = (await publishAgentProfileResponse.json()) as {
      id: string;
      status: string;
    };

    assert.equal(publishAgentProfileResponse.status, 200);
    assert.equal(publishedAgentProfile.status, "published");

    const familyResponse = await fetch(`${baseUrl}/api/v1/templates/families`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        manuscriptType: "clinical_study",
        name: "Agent tooling family",
      }),
    });
    const family = (await familyResponse.json()) as { id: string };

    assert.equal(familyResponse.status, 201);

    const moduleTemplateDraftResponse = await fetch(
      `${baseUrl}/api/v1/templates/module-drafts`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateFamilyId: family.id,
          module: "editing",
          manuscriptType: "clinical_study",
          prompt: "Agent tooling editing template",
        }),
      },
    );
    const moduleTemplateDraft = (await moduleTemplateDraftResponse.json()) as {
      id: string;
    };

    assert.equal(moduleTemplateDraftResponse.status, 201);

    const publishModuleTemplateResponse = await fetch(
      `${baseUrl}/api/v1/templates/module-templates/${moduleTemplateDraft.id}/publish`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
        }),
      },
    );

    assert.equal(publishModuleTemplateResponse.status, 200);

    const ruleSetResponse = await fetch(
      `${baseUrl}/api/v1/editorial-rules/rule-sets`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          templateFamilyId: family.id,
          module: "editing",
        }),
      },
    );
    const ruleSet = (await ruleSetResponse.json()) as { id: string };

    assert.equal(ruleSetResponse.status, 201);

    const publishRuleSetResponse = await fetch(
      `${baseUrl}/api/v1/editorial-rules/rule-sets/${ruleSet.id}/publish`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
        }),
      },
    );

    assert.equal(publishRuleSetResponse.status, 200);

    const promptDraftResponse = await fetch(
      `${baseUrl}/api/v1/prompt-skill-registry/prompt-templates`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          name: "editing_runtime_prompt",
          version: "1.0.0",
          module: "editing",
          manuscriptTypes: ["clinical_study"],
        }),
      },
    );
    const promptDraft = (await promptDraftResponse.json()) as { id: string };

    assert.equal(promptDraftResponse.status, 201);

    const publishPromptResponse = await fetch(
      `${baseUrl}/api/v1/prompt-skill-registry/prompt-templates/${promptDraft.id}/publish`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
        }),
      },
    );

    assert.equal(publishPromptResponse.status, 200);

    const skillDraftResponse = await fetch(
      `${baseUrl}/api/v1/prompt-skill-registry/skill-packages`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          name: "editing_runtime_skills",
          version: "1.0.0",
          appliesToModules: ["editing"],
          dependencyTools: ["knowledge.search", "assets.write"],
        }),
      },
    );
    const skillDraft = (await skillDraftResponse.json()) as { id: string };

    assert.equal(skillDraftResponse.status, 201);

    const publishSkillResponse = await fetch(
      `${baseUrl}/api/v1/prompt-skill-registry/skill-packages/${skillDraft.id}/publish`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
        }),
      },
    );

    assert.equal(publishSkillResponse.status, 200);

    const executionProfileResponse = await fetch(
      `${baseUrl}/api/v1/execution-governance/profiles`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          input: {
            module: "editing",
            manuscriptType: "clinical_study",
            templateFamilyId: family.id,
            moduleTemplateId: moduleTemplateDraft.id,
            ruleSetId: ruleSet.id,
            promptTemplateId: promptDraft.id,
            skillPackageIds: [skillDraft.id],
            knowledgeBindingMode: "profile_only",
          },
        }),
      },
    );
    const executionProfile = (await executionProfileResponse.json()) as {
      id: string;
    };

    assert.equal(executionProfileResponse.status, 201);

    const publishExecutionProfileResponse = await fetch(
      `${baseUrl}/api/v1/execution-governance/profiles/${executionProfile.id}/publish`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
        }),
      },
    );

    assert.equal(publishExecutionProfileResponse.status, 200);

    const bindingDraftResponse = await fetch(
      `${baseUrl}/api/v1/runtime-bindings`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
          input: {
            module: "editing",
            manuscriptType: "clinical_study",
            templateFamilyId: family.id,
            runtimeId: runtimeDraft.id,
            sandboxProfileId: sandboxDraft.id,
            agentProfileId: agentProfileDraft.id,
            toolPermissionPolicyId: policyDraft.id,
            promptTemplateId: promptDraft.id,
            skillPackageIds: [skillDraft.id],
            executionProfileId: executionProfile.id,
          },
        }),
      },
    );
    const bindingDraft = (await bindingDraftResponse.json()) as {
      id: string;
      status: string;
      version: number;
    };

    assert.equal(bindingDraftResponse.status, 201);
    assert.equal(bindingDraft.status, "draft");
    assert.equal(bindingDraft.version, 1);

    const activateBindingResponse = await fetch(
      `${baseUrl}/api/v1/runtime-bindings/${bindingDraft.id}/activate`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "user",
        }),
      },
    );
    const activeBinding = (await activateBindingResponse.json()) as {
      id: string;
      status: string;
    };

    assert.equal(activateBindingResponse.status, 200);
    assert.equal(activeBinding.status, "active");

    const bindingScopeResponse = await fetch(
      `${baseUrl}/api/v1/runtime-bindings/by-scope/editing/clinical_study/${family.id}?activeOnly=true`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const bindingsByScope = (await bindingScopeResponse.json()) as Array<{
      id: string;
    }>;

    assert.equal(bindingScopeResponse.status, 200);
    assert.deepEqual(bindingsByScope.map((record) => record.id), [bindingDraft.id]);

    const bindingReadinessResponse = await fetch(
      `${baseUrl}/api/v1/runtime-bindings/${bindingDraft.id}/readiness`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const bindingReadiness = (await bindingReadinessResponse.json()) as {
      status: string;
      execution_profile_alignment: {
        status: string;
      };
      issues: Array<{ code: string }>;
    };

    assert.equal(bindingReadinessResponse.status, 200);
    assert.equal(bindingReadiness.status, "ready");
    assert.equal(bindingReadiness.execution_profile_alignment.status, "aligned");
    assert.deepEqual(bindingReadiness.issues, []);

    const activeReadinessResponse = await fetch(
      `${baseUrl}/api/v1/runtime-bindings/by-scope/editing/clinical_study/${family.id}/active-readiness`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const activeReadiness = (await activeReadinessResponse.json()) as {
      status: string;
      binding?: {
        id: string;
      };
    };

    assert.equal(activeReadinessResponse.status, 200);
    assert.equal(activeReadiness.status, "ready");
    assert.equal(activeReadiness.binding?.id, bindingDraft.id);

    const unauthorizedReadinessResponse = await fetch(
      `${baseUrl}/api/v1/runtime-bindings/${bindingDraft.id}/readiness`,
    );

    assert.equal(unauthorizedReadinessResponse.status, 401);

    const createExecutionLogResponse = await fetch(
      `${baseUrl}/api/v1/agent-execution`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: {
            manuscriptId: "manuscript-demo-1",
            module: "editing",
            triggeredBy: "dev-admin",
            runtimeId: runtimeDraft.id,
            sandboxProfileId: sandboxDraft.id,
            agentProfileId: agentProfileDraft.id,
            runtimeBindingId: bindingDraft.id,
            toolPermissionPolicyId: policyDraft.id,
            knowledgeItemIds: ["knowledge-demo-1", "knowledge-demo-1"],
          },
        }),
      },
    );
    const executionLog = (await createExecutionLogResponse.json()) as {
      id: string;
      status: string;
      knowledge_item_ids: string[];
      completion_summary: {
        derived_status: string;
        business_completed: boolean;
        follow_up_required: boolean;
        fully_settled: boolean;
        attention_required: boolean;
      };
      recovery_summary: {
        category: string;
        recovery_readiness: string;
        recovery_ready_at?: string;
        reason: string;
      };
      runtime_binding_readiness: {
        observation_status: string;
        report?: {
          status: string;
          binding?: { id: string };
        };
      };
    };

    assert.equal(createExecutionLogResponse.status, 201);
    assert.equal(executionLog.status, "running");
    assert.deepEqual(executionLog.knowledge_item_ids, ["knowledge-demo-1"]);
    assert.equal(
      executionLog.completion_summary.derived_status,
      "business_in_progress",
    );
    assert.equal(executionLog.completion_summary.business_completed, false);
    assert.equal(executionLog.completion_summary.follow_up_required, false);
    assert.equal(executionLog.completion_summary.fully_settled, false);
    assert.equal(executionLog.completion_summary.attention_required, false);
    assert.equal(executionLog.recovery_summary.category, "not_recoverable");
    assert.equal(
      executionLog.recovery_summary.recovery_readiness,
      "not_recoverable",
    );
    assert.equal(
      executionLog.recovery_summary.reason,
      "Business execution is running, so governed follow-up is not recoverable yet.",
    );
    assert.equal(
      executionLog.runtime_binding_readiness.observation_status,
      "reported",
    );
    assert.equal(executionLog.runtime_binding_readiness.report?.status, "ready");
    assert.equal(
      executionLog.runtime_binding_readiness.report?.binding?.id,
      bindingDraft.id,
    );

    const completeExecutionLogResponse = await fetch(
      `${baseUrl}/api/v1/agent-execution/${executionLog.id}/complete`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          executionSnapshotId: "snapshot-agent-tooling-1",
          verificationEvidenceIds: ["evidence-1", "evidence-1", "evidence-2"],
        }),
      },
    );
    const completedExecutionLog = (await completeExecutionLogResponse.json()) as {
      id: string;
      status: string;
      execution_snapshot_id?: string;
      verification_evidence_ids: string[];
      completion_summary: {
        derived_status: string;
        business_completed: boolean;
        follow_up_required: boolean;
        fully_settled: boolean;
        attention_required: boolean;
      };
      recovery_summary: {
        category: string;
        recovery_readiness: string;
        recovery_ready_at?: string;
        reason: string;
      };
      runtime_binding_readiness: {
        observation_status: string;
        report?: {
          status: string;
        };
      };
    };

    assert.equal(completeExecutionLogResponse.status, 200);
    assert.equal(completedExecutionLog.status, "completed");
    assert.equal(
      completedExecutionLog.execution_snapshot_id,
      "snapshot-agent-tooling-1",
    );
    assert.deepEqual(completedExecutionLog.verification_evidence_ids, [
      "evidence-1",
      "evidence-2",
    ]);
    assert.equal(
      completedExecutionLog.completion_summary.derived_status,
      "business_completed_settled",
    );
    assert.equal(completedExecutionLog.completion_summary.business_completed, true);
    assert.equal(completedExecutionLog.completion_summary.follow_up_required, false);
    assert.equal(completedExecutionLog.completion_summary.fully_settled, true);
    assert.equal(completedExecutionLog.completion_summary.attention_required, false);
    assert.equal(
      completedExecutionLog.recovery_summary.category,
      "not_recoverable",
    );
    assert.equal(
      completedExecutionLog.recovery_summary.recovery_readiness,
      "not_recoverable",
    );
    assert.equal(
      completedExecutionLog.recovery_summary.reason,
      "No governed follow-up orchestration is required for this execution.",
    );
    assert.equal(
      completedExecutionLog.runtime_binding_readiness.observation_status,
      "reported",
    );
    assert.equal(
      completedExecutionLog.runtime_binding_readiness.report?.status,
      "ready",
    );

    const listExecutionLogsResponse = await fetch(
      `${baseUrl}/api/v1/agent-execution`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const executionLogs = (await listExecutionLogsResponse.json()) as Array<{
      id: string;
      status: string;
      completion_summary: {
        derived_status: string;
        business_completed: boolean;
        follow_up_required: boolean;
        fully_settled: boolean;
        attention_required: boolean;
      };
      recovery_summary: {
        category: string;
        recovery_readiness: string;
        recovery_ready_at?: string;
        reason: string;
      };
      runtime_binding_readiness: {
        observation_status: string;
        report?: {
          status: string;
        };
      };
    }>;

    assert.equal(listExecutionLogsResponse.status, 200);
    assert.deepEqual(executionLogs.map((record) => ({
      id: record.id,
      status: record.status,
    })), [
      {
        id: executionLog.id,
        status: "completed",
      },
    ]);
    assert.equal(
      executionLogs[0]?.runtime_binding_readiness.observation_status,
      "reported",
    );
    assert.equal(executionLogs[0]?.runtime_binding_readiness.report?.status, "ready");
    assert.equal(
      executionLogs[0]?.completion_summary.derived_status,
      "business_completed_settled",
    );
    assert.equal(executionLogs[0]?.completion_summary.business_completed, true);
    assert.equal(executionLogs[0]?.completion_summary.follow_up_required, false);
    assert.equal(executionLogs[0]?.completion_summary.fully_settled, true);
    assert.equal(executionLogs[0]?.completion_summary.attention_required, false);
    assert.equal(executionLogs[0]?.recovery_summary.category, "not_recoverable");
    assert.equal(
      executionLogs[0]?.recovery_summary.recovery_readiness,
      "not_recoverable",
    );
    assert.equal(
      executionLogs[0]?.recovery_summary.reason,
      "No governed follow-up orchestration is required for this execution.",
    );

    const archiveRuntimeResponse = await fetch(
      `${baseUrl}/api/v1/agent-runtime/${runtimeDraft.id}/archive`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
        }),
      },
    );

    assert.equal(archiveRuntimeResponse.status, 200);

    const degradedReadinessResponse = await fetch(
      `${baseUrl}/api/v1/runtime-bindings/${bindingDraft.id}/readiness`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const degradedReadiness = (await degradedReadinessResponse.json()) as {
      status: string;
      issues: Array<{ code: string }>;
    };

    assert.equal(degradedReadinessResponse.status, 200);
    assert.equal(degradedReadiness.status, "degraded");
    assert.ok(
      degradedReadiness.issues.some((issue) => issue.code === "runtime_not_active"),
    );
  } finally {
    await stopServer(server);
  }
});
