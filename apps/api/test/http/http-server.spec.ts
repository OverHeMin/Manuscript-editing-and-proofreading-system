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

    assert.equal(healthResponse.status, 200);
    assert.deepEqual(healthBody, {
      status: "ok",
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
    };

    assert.equal(resolveResponse.status, 200);
    assert.equal(resolved.profile.id, profile.id);
    assert.equal(resolved.resolved_model.id, model.id);
    assert.deepEqual(
      resolved.skill_packages.map((record) => record.id),
      [skillPackage.id],
    );

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
    const snapshot = (await snapshotResponse.json()) as { id: string; model_id: string };

    assert.equal(snapshotResponse.status, 201);
    assert.equal(snapshot.model_id, model.id);

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
    const loadedSnapshot = (await loadedSnapshotResponse.json()) as { id: string };
    const hitLogs = (await hitLogsResponse.json()) as Array<{ match_source: string }>;

    assert.equal(loadedSnapshotResponse.status, 200);
    assert.equal(hitLogsResponse.status, 200);
    assert.equal(loadedSnapshot.id, snapshot.id);
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
            templateFamilyId: "family-agent-tooling-1",
            runtimeId: runtimeDraft.id,
            sandboxProfileId: sandboxDraft.id,
            agentProfileId: agentProfileDraft.id,
            toolPermissionPolicyId: policyDraft.id,
            promptTemplateId: promptDraft.id,
            skillPackageIds: [skillDraft.id],
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
      `${baseUrl}/api/v1/runtime-bindings/by-scope/editing/clinical_study/family-agent-tooling-1?activeOnly=true`,
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
    };

    assert.equal(createExecutionLogResponse.status, 201);
    assert.equal(executionLog.status, "running");
    assert.deepEqual(executionLog.knowledge_item_ids, ["knowledge-demo-1"]);

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
  } finally {
    await stopServer(server);
  }
});
