import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { Pool } from "pg";
import {
  createApiHttpServer,
  type ApiHttpServer,
} from "../../src/http/api-http-server.ts";
import { createPersistentGovernanceRuntime } from "../../src/http/persistent-governance-runtime.ts";
import { createPersistentHttpAuthRuntime } from "../../src/http/persistent-auth-runtime.ts";
import {
  PostgresAgentProfileRepository,
} from "../../src/modules/agent-profiles/index.ts";
import {
  PostgresAgentRuntimeRepository,
} from "../../src/modules/agent-runtime/index.ts";
import {
  PostgresExecutionGovernanceRepository,
} from "../../src/modules/execution-governance/index.ts";
import {
  PostgresKnowledgeRepository,
} from "../../src/modules/knowledge/index.ts";
import {
  PostgresModelRegistryRepository,
  PostgresModelRoutingPolicyRepository,
} from "../../src/modules/model-registry/index.ts";
import {
  PostgresPromptSkillRegistryRepository,
} from "../../src/modules/prompt-skill-registry/index.ts";
import {
  PostgresRuntimeBindingRepository,
} from "../../src/modules/runtime-bindings/index.ts";
import {
  PostgresSandboxProfileRepository,
} from "../../src/modules/sandbox-profiles/index.ts";
import {
  PostgresModuleTemplateRepository,
  PostgresTemplateFamilyRepository,
} from "../../src/modules/templates/index.ts";
import {
  PostgresToolPermissionPolicyRepository,
} from "../../src/modules/tool-permission-policies/index.ts";
import { PostgresUserRepository } from "../../src/users/postgres-user-repository.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";

interface PersistentWorkbenchSeededIds {
  manuscriptId: string;
  originalAssetId: string;
  screeningKnowledgeId: string;
  screeningModelId: string;
}

const seededIds: PersistentWorkbenchSeededIds = {
  manuscriptId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  originalAssetId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  screeningKnowledgeId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  screeningModelId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
};

test("persistent workbench upload routes keep manuscripts, assets, jobs, and exports across server restarts", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for the temporary persistent workbench database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const seedPool = new Pool({ connectionString: databaseUrl });
    try {
      await seedPersistentWorkbenchData(seedPool);

      const firstServer = await startPersistentWorkbenchServer(databaseUrl);
      try {
        const cookie = await loginAsPersistentUser(
          firstServer.baseUrl,
          "persistent.user",
        );
        const uploadResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/manuscripts/upload`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: "Persistent HTTP Upload",
              manuscriptType: "clinical_study",
              createdBy: "forged-user",
              fileName: "persistent-http-upload.docx",
              mimeType:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              storageKey: "persistent/uploads/persistent-http-upload.docx",
            }),
          },
        );
        const uploaded = (await uploadResponse.json()) as {
          manuscript: { id: string; created_by: string };
          asset: { id: string; created_by: string; asset_type: string };
          job: { id: string; requested_by: string; module: string };
        };

        assert.equal(
          uploadResponse.status,
          201,
          `Expected upload to succeed, received ${uploadResponse.status}: ${JSON.stringify(uploaded)}`,
        );
        assert.equal(uploaded.manuscript.created_by, "persistent-user");
        assert.equal(uploaded.asset.created_by, "persistent-user");
        assert.equal(uploaded.job.requested_by, "persistent-user");

        await stopServer(firstServer.server);

        const secondServer = await startPersistentWorkbenchServer(databaseUrl);
        try {
          const manuscriptResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/manuscripts/${uploaded.manuscript.id}`,
            {
              headers: { Cookie: cookie },
            },
          );
          const manuscript = (await manuscriptResponse.json()) as { id: string };

          const assetsResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/manuscripts/${uploaded.manuscript.id}/assets`,
            {
              headers: { Cookie: cookie },
            },
          );
          const assets = (await assetsResponse.json()) as Array<{
            id: string;
            asset_type: string;
          }>;

          const jobResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/jobs/${uploaded.job.id}`,
            {
              headers: { Cookie: cookie },
            },
          );
          const job = (await jobResponse.json()) as {
            id: string;
            requested_by: string;
            module: string;
          };

          const exportResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/document-pipeline/export-current-asset`,
            {
              method: "POST",
              headers: {
                Cookie: cookie,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                manuscriptId: uploaded.manuscript.id,
                preferredAssetType: "original",
              }),
            },
          );
          const exported = (await exportResponse.json()) as {
            manuscript_id: string;
            asset: { id: string };
          };

          assert.equal(manuscriptResponse.status, 200);
          assert.equal(assetsResponse.status, 200);
          assert.equal(jobResponse.status, 200);
          assert.equal(exportResponse.status, 200);
          assert.equal(manuscript.id, uploaded.manuscript.id);
          assert.deepEqual(
            assets.map((asset) => ({
              id: asset.id,
              asset_type: asset.asset_type,
            })),
            [
              {
                id: uploaded.asset.id,
                asset_type: "original",
              },
            ],
          );
          assert.equal(job.id, uploaded.job.id);
          assert.equal(job.requested_by, "persistent-user");
          assert.equal(job.module, "upload");
          assert.equal(exported.manuscript_id, uploaded.manuscript.id);
          assert.equal(exported.asset.id, uploaded.asset.id);
        } finally {
          await stopServer(secondServer.server);
        }
      } finally {
        await stopServer(firstServer.server).catch(() => undefined);
      }
    } finally {
      await seedPool.end();
    }
  });
});

test("persistent workbench screening routes keep governed execution evidence across server restarts", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for the temporary persistent workbench database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const seedPool = new Pool({ connectionString: databaseUrl });
    try {
      await seedPersistentWorkbenchData(seedPool);

      const firstServer = await startPersistentWorkbenchServer(databaseUrl);
      try {
        const cookie = await loginAsPersistentUser(
          firstServer.baseUrl,
          "persistent.screener",
        );
        const screeningResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/modules/screening/run`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              manuscriptId: seededIds.manuscriptId,
              parentAssetId: seededIds.originalAssetId,
              requestedBy: "forged-screener",
              actorRole: "admin",
              storageKey: "persistent/runs/screening/report.md",
              fileName: "persistent-screening-report.md",
            }),
          },
        );
        const screening = (await screeningResponse.json()) as {
          job: { id: string; requested_by: string; module: string };
          asset: {
            id: string;
            asset_type: string;
            created_by: string;
            parent_asset_id?: string;
          };
          knowledge_item_ids: string[];
          model_id: string;
          snapshot_id?: string;
          agent_execution_log_id?: string;
        };

        assert.equal(
          screeningResponse.status,
          201,
          `Expected screening to succeed, received ${screeningResponse.status}: ${JSON.stringify(screening)}`,
        );
        assert.equal(screening.job.requested_by, "persistent-screener");
        assert.equal(screening.job.module, "screening");
        assert.equal(screening.asset.asset_type, "screening_report");
        assert.equal(screening.asset.created_by, "persistent-screener");
        assert.equal(screening.asset.parent_asset_id, seededIds.originalAssetId);
        assert.deepEqual(screening.knowledge_item_ids, [
          seededIds.screeningKnowledgeId,
        ]);
        assert.equal(screening.model_id, seededIds.screeningModelId);
        assert.ok(screening.snapshot_id);
        assert.ok(screening.agent_execution_log_id);

        await stopServer(firstServer.server);

        const secondServer = await startPersistentWorkbenchServer(databaseUrl);
        try {
          const manuscriptResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/manuscripts/${seededIds.manuscriptId}`,
            {
              headers: { Cookie: cookie },
            },
          );
          const manuscript = (await manuscriptResponse.json()) as {
            current_screening_asset_id?: string;
          };

          const assetsResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/manuscripts/${seededIds.manuscriptId}/assets`,
            {
              headers: { Cookie: cookie },
            },
          );
          const assets = (await assetsResponse.json()) as Array<{
            id: string;
            asset_type: string;
          }>;

          const jobResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/jobs/${screening.job.id}`,
            {
              headers: { Cookie: cookie },
            },
          );
          const job = (await jobResponse.json()) as {
            id: string;
            payload?: Record<string, unknown>;
          };

          const exportResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/document-pipeline/export-current-asset`,
            {
              method: "POST",
              headers: {
                Cookie: cookie,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                manuscriptId: seededIds.manuscriptId,
                preferredAssetType: "screening_report",
              }),
            },
          );
          const exported = (await exportResponse.json()) as {
            asset: { id: string };
          };

          assert.equal(manuscriptResponse.status, 200);
          assert.equal(assetsResponse.status, 200);
          assert.equal(jobResponse.status, 200);
          assert.equal(exportResponse.status, 200);
          assert.equal(manuscript.current_screening_asset_id, screening.asset.id);
          assert.deepEqual(
            [...assets.map((asset) => asset.id)].sort(),
            [seededIds.originalAssetId, screening.asset.id].sort(),
          );
          assert.equal(job.id, screening.job.id);
          assert.equal(job.payload?.outputAssetId, screening.asset.id);
          assert.equal(exported.asset.id, screening.asset.id);
        } finally {
          await stopServer(secondServer.server);
        }
      } finally {
        await stopServer(firstServer.server).catch(() => undefined);
      }
    } finally {
      await seedPool.end();
    }
  });
});

async function seedPersistentWorkbenchData(pool: Pool): Promise<void> {
  const userRepository = new PostgresUserRepository({ client: pool });
  const knowledgeRepository = new PostgresKnowledgeRepository({ client: pool });
  const templateFamilyRepository = new PostgresTemplateFamilyRepository({
    client: pool,
  });
  const moduleTemplateRepository = new PostgresModuleTemplateRepository({
    client: pool,
  });
  const promptSkillRegistryRepository = new PostgresPromptSkillRegistryRepository({
    client: pool,
  });
  const executionGovernanceRepository = new PostgresExecutionGovernanceRepository({
    client: pool,
  });
  const sandboxProfileRepository = new PostgresSandboxProfileRepository({
    client: pool,
  });
  const agentProfileRepository = new PostgresAgentProfileRepository({
    client: pool,
  });
  const agentRuntimeRepository = new PostgresAgentRuntimeRepository({
    client: pool,
  });
  const runtimeBindingRepository = new PostgresRuntimeBindingRepository({
    client: pool,
  });
  const toolPermissionPolicyRepository =
    new PostgresToolPermissionPolicyRepository({
      client: pool,
    });
  const modelRegistryRepository = new PostgresModelRegistryRepository({
    client: pool,
  });
  const modelRoutingPolicyRepository = new PostgresModelRoutingPolicyRepository({
    client: pool,
  });

  await userRepository.save({
    id: "persistent-user",
    username: "persistent.user",
    displayName: "Persistent User",
    role: "user",
    passwordHash:
      "$2b$10$H4DZZv8KueEgqk1cjSAanewEhIoXTuGm2ixzaupe6QwfpA3Vr7HpW",
  });
  await userRepository.save({
    id: "persistent-screener",
    username: "persistent.screener",
    displayName: "Persistent Screener",
    role: "screener",
    passwordHash:
      "$2b$10$H4DZZv8KueEgqk1cjSAanewEhIoXTuGm2ixzaupe6QwfpA3Vr7HpW",
  });

  await templateFamilyRepository.save({
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    manuscript_type: "clinical_study",
    name: "Persistent Screening Family",
    status: "active",
  });
  await moduleTemplateRepository.save({
    id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    template_family_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    module: "screening",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Persistent screening prompt",
  });
  await promptSkillRegistryRepository.savePromptTemplate({
    id: "11111111-2222-4333-8444-555555555555",
    name: "persistent_screening_mainline",
    version: "1.0.0",
    status: "published",
    module: "screening",
    manuscript_types: ["clinical_study"],
  });
  await promptSkillRegistryRepository.saveSkillPackage({
    id: "66666666-7777-4888-8999-aaaaaaaaaaaa",
    name: "persistent_screening_skills",
    version: "1.0.0",
    scope: "admin_only",
    status: "published",
    applies_to_modules: ["screening"],
  });
  await knowledgeRepository.save({
    id: seededIds.screeningKnowledgeId,
    title: "Persistent screening knowledge",
    canonical_text: "Persistent screening knowledge for governed HTTP runs.",
    knowledge_kind: "rule",
    status: "approved",
    routing: {
      module_scope: "screening",
      manuscript_types: ["clinical_study"],
    },
    template_bindings: ["ffffffff-ffff-4fff-8fff-ffffffffffff"],
  });
  await executionGovernanceRepository.saveProfile({
    id: "bbbb1111-2222-4333-8444-555555555555",
    module: "screening",
    manuscript_type: "clinical_study",
    template_family_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    module_template_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    prompt_template_id: "11111111-2222-4333-8444-555555555555",
    skill_package_ids: ["66666666-7777-4888-8999-aaaaaaaaaaaa"],
    knowledge_binding_mode: "profile_plus_dynamic",
    status: "active",
    version: 1,
  });
  await sandboxProfileRepository.save({
    id: "bbbbbbbb-1111-4222-8333-444444444444",
    name: "Persistent Screening Sandbox",
    status: "active",
    sandbox_mode: "workspace_write",
    network_access: false,
    approval_required: true,
    allowed_tool_ids: [],
    admin_only: true,
  });
  await agentRuntimeRepository.save({
    id: "cccccccc-1111-4222-8333-444444444444",
    name: "Persistent Screening Runtime",
    adapter: "deepagents",
    status: "active",
    sandbox_profile_id: "bbbbbbbb-1111-4222-8333-444444444444",
    allowed_modules: ["screening"],
    runtime_slot: "screening",
    admin_only: true,
  });
  await agentProfileRepository.save({
    id: "dddddddd-1111-4222-8333-444444444444",
    name: "Persistent Screening Executor",
    role_key: "subagent",
    status: "published",
    module_scope: ["screening"],
    manuscript_types: ["clinical_study"],
    admin_only: true,
  });
  await toolPermissionPolicyRepository.save({
    id: "eeee1111-2222-4333-8444-555555555555",
    name: "Persistent Screening Policy",
    status: "active",
    default_mode: "read",
    allowed_tool_ids: [],
    high_risk_tool_ids: [],
    write_requires_confirmation: false,
    admin_only: true,
  });
  await modelRegistryRepository.save({
    id: seededIds.screeningModelId,
    provider: "openai",
    model_name: "persistent-screening-model",
    model_version: "2026-03-31",
    allowed_modules: ["screening"],
    is_prod_allowed: true,
  });
  await modelRoutingPolicyRepository.save({
    system_default_model_id: undefined,
    module_defaults: {
      screening: seededIds.screeningModelId,
    },
    template_overrides: {},
  });
  await pool.query(
    `
      insert into manuscripts (
        id,
        title,
        manuscript_type,
        status,
        created_by,
        current_template_family_id,
        created_at,
        updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8)
      on conflict (id) do update
      set
        title = excluded.title,
        manuscript_type = excluded.manuscript_type,
        status = excluded.status,
        created_by = excluded.created_by,
        current_template_family_id = excluded.current_template_family_id,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at
    `,
    [
      seededIds.manuscriptId,
      "Persistent Seeded Workbench Manuscript",
      "clinical_study",
      "uploaded",
      "persistent-user",
      "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      "2026-03-31T08:00:00.000Z",
      "2026-03-31T08:00:00.000Z",
    ],
  );
  await pool.query(
    `
      insert into document_assets (
        id,
        manuscript_id,
        asset_type,
        status,
        storage_key,
        mime_type,
        source_module,
        created_by,
        version_no,
        is_current,
        file_name,
        created_at,
        updated_at
      )
      values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13
      )
      on conflict (id) do update
      set
        manuscript_id = excluded.manuscript_id,
        asset_type = excluded.asset_type,
        status = excluded.status,
        storage_key = excluded.storage_key,
        mime_type = excluded.mime_type,
        source_module = excluded.source_module,
        created_by = excluded.created_by,
        version_no = excluded.version_no,
        is_current = excluded.is_current,
        file_name = excluded.file_name,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at
    `,
    [
      seededIds.originalAssetId,
      seededIds.manuscriptId,
      "original",
      "active",
      "persistent/uploads/seeded-original.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "upload",
      "persistent-user",
      1,
      true,
      "seeded-original.docx",
      "2026-03-31T08:01:00.000Z",
      "2026-03-31T08:01:00.000Z",
    ],
  );
  await runtimeBindingRepository.save({
    id: "ffff1111-2222-4333-8444-555555555555",
    module: "screening",
    manuscript_type: "clinical_study",
    template_family_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    runtime_id: "cccccccc-1111-4222-8333-444444444444",
    sandbox_profile_id: "bbbbbbbb-1111-4222-8333-444444444444",
    agent_profile_id: "dddddddd-1111-4222-8333-444444444444",
    tool_permission_policy_id: "eeee1111-2222-4333-8444-555555555555",
    prompt_template_id: "11111111-2222-4333-8444-555555555555",
    skill_package_ids: ["66666666-7777-4888-8999-aaaaaaaaaaaa"],
    execution_profile_id: "bbbb1111-2222-4333-8444-555555555555",
    status: "active",
    version: 1,
  });
}

async function loginAsPersistentUser(
  baseUrl: string,
  username: string,
): Promise<string> {
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
  assert.ok(setCookie, "Expected persistent workbench login to return a session cookie.");
  return setCookie.split(";")[0] ?? "";
}

async function startPersistentWorkbenchServer(databaseUrl: string): Promise<{
  server: ApiHttpServer;
  baseUrl: string;
}> {
  const pool = new Pool({ connectionString: databaseUrl });
  const authRuntime = createPersistentHttpAuthRuntime({
    client: pool,
  });
  const server = createApiHttpServer({
    appEnv: "development",
    allowedOrigins: ["http://127.0.0.1:4173"],
    seedDemoKnowledgeReviewData: false,
    runtime: createPersistentGovernanceRuntime({
      client: pool,
      authRuntime,
    }),
  });

  server.on("close", () => {
    void pool.end();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  assert.ok(address && typeof address !== "string", "Expected a tcp server address.");

  return {
    server,
    baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
  };
}

async function stopServer(server: ApiHttpServer): Promise<void> {
  if (!server.listening) {
    return;
  }

  server.close();
  await once(server, "close");
}
