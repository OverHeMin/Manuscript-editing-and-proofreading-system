import test from "node:test";
import assert from "node:assert/strict";

import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import { InMemoryAuditService } from "../../src/audit/audit-service.ts";
import { AiProviderCredentialCrypto } from "../../src/modules/ai-provider-connections/ai-provider-credential-crypto.ts";
import { InMemoryAiProviderConnectionRepository } from "../../src/modules/ai-provider-connections/in-memory-ai-provider-connection-repository.ts";
import type { AiProviderConnectionTestStatus } from "../../src/modules/ai-provider-connections/ai-provider-connection-record.ts";
import { createAiProviderConnectionService } from "../../src/modules/ai-provider-connections/ai-provider-connection-service.ts";
import type { RoleKey } from "../../src/users/roles.ts";

const TEST_MASTER_KEY = Buffer.alloc(32, 0x42).toString("base64");
const FIXED_NOW = new Date("2026-04-10T00:00:00Z");

const adminActor = { id: "admin-actor", role: "admin" as RoleKey };
const editorActor = { id: "editor-actor", role: "editor" as RoleKey };

interface ConnectionDraft {
  id: string;
  name: string;
  provider_kind: string;
  compatibility_mode?: string;
  base_url?: string;
  connection_metadata?: Record<string, unknown>;
  credentials?: { apiKey: string };
  enabled?: boolean;
}

interface ConnectionUpdateDraft {
  connectionId: string;
  changes: Partial<Pick<ConnectionDraft, "name" | "base_url" | "connection_metadata" | "enabled">>;
}

interface CredentialRotationInput {
  connectionId: string;
  apiKey: string;
}

interface ConnectionTestInput {
  connectionId: string;
  metadata?: Record<string, unknown>;
  status: AiProviderConnectionTestStatus;
  errorSummary?: string;
  testedAt?: Date;
}

function createTestService() {
  const repository = new InMemoryAiProviderConnectionRepository();
  const auditService = new InMemoryAuditService();
  const credentialCrypto = new AiProviderCredentialCrypto({
    AI_PROVIDER_MASTER_KEY: TEST_MASTER_KEY,
  } as NodeJS.ProcessEnv);

  const service = createAiProviderConnectionService({
    repository,
    auditService,
    credentialCrypto,
    now: () => new Date(FIXED_NOW),
  });

  return { service, repository, auditService, credentialCrypto };
}

function buildConnectionDraft(overrides: Partial<ConnectionDraft> = {}): ConnectionDraft {
  return {
    id: overrides.id ?? "connection-123",
    name: overrides.name ?? "Edge Bridge",
    provider_kind: overrides.provider_kind ?? "openai_compatible",
    compatibility_mode: overrides.compatibility_mode,
    base_url: overrides.base_url ?? "https://api.openai.com",
    connection_metadata: overrides.connection_metadata ?? { test_model_name: "gpt-4" },
    credentials: overrides.credentials ?? { apiKey: "secret-api-key" },
    enabled: overrides.enabled ?? true,
  };
}

async function createConnection(
  service: Awaited<ReturnType<typeof createAiProviderConnectionService>>,
  draft: ConnectionDraft,
) {
  return service.createConnection({
    actorId: adminActor.id,
    actorRole: adminActor.role,
    connection: draft,
  });
}

test("only admins may create, update, rotate, and test ai provider connections", async () => {
  const { service, repository } = createTestService();
  const baseDraft = buildConnectionDraft({ id: "role-check" });

  await assert.rejects(
    () =>
      service.createConnection({
        actorId: editorActor.id,
        actorRole: editorActor.role,
        connection: baseDraft,
      }),
    AuthorizationError,
  );

  await service.createConnection({
    actorId: adminActor.id,
    actorRole: adminActor.role,
    connection: baseDraft,
  });

  const updateInput: ConnectionUpdateDraft = {
    connectionId: baseDraft.id,
    changes: { name: "Edge Bridge Updated" },
  };

  const rotationInput: CredentialRotationInput = {
    connectionId: baseDraft.id,
    apiKey: "rotate-secret",
  };

  const testInput: ConnectionTestInput = {
    connectionId: baseDraft.id,
    metadata: { test_model_name: "gpt-4" },
    status: "passed",
    testedAt: new Date(FIXED_NOW),
  };

  await assert.rejects(
    () => service.updateConnection({ actorId: editorActor.id, actorRole: editorActor.role, update: updateInput }),
    AuthorizationError,
  );
  await assert.rejects(
    () => service.rotateCredential({ actorId: editorActor.id, actorRole: editorActor.role, rotation: rotationInput }),
    AuthorizationError,
  );
  await assert.rejects(
    () => service.testConnection({ actorId: editorActor.id, actorRole: editorActor.role, test: testInput }),
    AuthorizationError,
  );

  const stored = await repository.findById(baseDraft.id);
  assert.ok(stored);
  assert.equal(stored?.name, baseDraft.name);
});

test("creating a connection masks credentials and never emits plaintext", async () => {
  const { service, repository, credentialCrypto } = createTestService();
  const apiKey = "secret-api-key";
  const draft = buildConnectionDraft({ id: "mask-check", credentials: { apiKey } });

  const created = await createConnection(service, draft);
  const mask = credentialCrypto.maskApiKey(apiKey);

  assert.equal(created.credential_summary?.mask, mask);
  assert.ok(!Reflect.has(created, "credentials"));

  const credential = await repository.findCredentialByConnectionId(draft.id);
  assert.ok(credential);
  assert.equal(credential.credential_mask, mask);
  assert.notEqual(credential.credential_ciphertext, apiKey);
});

test("rotating credentials overwrites ciphertext and increments versions", async () => {
  const { service, repository } = createTestService();
  const draft = buildConnectionDraft({ id: "rotate-check" });

  await createConnection(service, draft);
  const credentialBeforeRotation = await repository.findCredentialByConnectionId(draft.id);
  assert.ok(credentialBeforeRotation);
  const oldCiphertext = credentialBeforeRotation.credential_ciphertext;

  const rotation = await service.rotateCredential({
    actorId: adminActor.id,
    actorRole: adminActor.role,
    rotation: {
      connectionId: draft.id,
      apiKey: "rotated-secret",
    },
  });

  const saved = await repository.findCredentialByConnectionId(draft.id);
  assert.ok(saved);
  assert.ok(rotation);
  assert.notEqual(saved.credential_ciphertext, oldCiphertext);
  assert.ok(saved.credential_version && saved.credential_version > 1);

  const connection = await repository.findById(draft.id);
  assert.equal(connection?.credential_summary?.version, saved.credential_version);
});

test("provider kinds map to the openai_chat_compatible execution path", async () => {
  const { service, repository } = createTestService();
  const providerKinds = ["qwen", "deepseek", "openai", "openai_compatible"];

  for (const providerKind of providerKinds) {
    const draft = buildConnectionDraft({ id: `map-${providerKind}`, provider_kind: providerKind });
    await createConnection(service, draft);
    const connection = await repository.findById(draft.id);
    assert.equal(connection?.compatibility_mode, "openai_chat_compatible");
    assert.equal(connection?.provider_kind, providerKind);
  }
});

test("listing connections exposes readiness, masked credentials, compatibility mode, and test metadata for system settings", async () => {
  const { service } = createTestService();

  await createConnection(
    service,
    buildConnectionDraft({
      id: "ready-connection",
      provider_kind: "qwen",
      connection_metadata: {
        test_model_name: "qwen-max",
      },
      credentials: { apiKey: "sk-ready-secret-1234" },
    }),
  );
  await createConnection(
    service,
    {
      id: "missing-credential-connection",
      name: "Disabled bridge",
      provider_kind: "openai_compatible",
      base_url: "https://api.openai.com",
      enabled: false,
      connection_metadata: {
        test_model_name: "gpt-4.1",
      },
    },
  );

  const listedConnections = await service.listConnections();
  const readyConnection = listedConnections.find((record) => record.id === "ready-connection");
  const disabledConnection = listedConnections.find(
    (record) => record.id === "missing-credential-connection",
  );

  assert.ok(readyConnection);
  assert.equal(readyConnection.compatibility_mode, "openai_chat_compatible");
  assert.equal(
    readyConnection.connection_metadata?.test_model_name,
    "qwen-max",
  );
  assert.equal(readyConnection.credential_summary?.mask.startsWith("sk-"), true);
  assert.equal(readyConnection.readiness?.status, "ready");
  assert.equal(readyConnection.readiness?.credential_configured, true);
  assert.ok(
    typeof readyConnection.readiness?.summary === "string" &&
      readyConnection.readiness.summary.length > 0,
  );

  assert.ok(disabledConnection);
  assert.equal(disabledConnection.readiness?.status, "disabled");
  assert.equal(disabledConnection.readiness?.credential_configured, false);
});

test("openai/deepseek reject custom base URLs while openai_compatible accepts them", async () => {
  const { service } = createTestService();
  const customBase = "https://custom.base";

  await assert.rejects(
    () =>
      createConnection(
        service,
        buildConnectionDraft({ id: "openai-custom", provider_kind: "openai", base_url: customBase }),
      ),
    Error,
  );

  await assert.rejects(
    () =>
      createConnection(
        service,
        buildConnectionDraft({ id: "openai-compatible-custom", provider_kind: "deepseek", base_url: customBase }),
      ),
    Error,
  );

  await createConnection(
    service,
    buildConnectionDraft({ id: "openai-compatible-ok", provider_kind: "openai_compatible", base_url: customBase }),
  );
});

test("connectivity tests require connection_metadata.test_model_name", async () => {
  const { service } = createTestService();
  const draft = buildConnectionDraft({ id: "metadata-check", connection_metadata: { region: "us" } });

  await createConnection(service, draft);

  await assert.rejects(
    () =>
      service.testConnection({
        actorId: adminActor.id,
        actorRole: adminActor.role,
        test: {
          connectionId: draft.id,
          metadata: { region: "us" },
          status: "failed",
          testedAt: new Date(FIXED_NOW),
          errorSummary: "missing model",
        },
      }),
    Error,
  );
});

test("connectivity tests update last test state and timestamps", async () => {
  const { service, repository } = createTestService();
  const draft = buildConnectionDraft({ id: "test-status" });
  await createConnection(service, draft);

  const testedAt = new Date(FIXED_NOW.getTime() + 1_000);
  await service.testConnection({
    actorId: adminActor.id,
    actorRole: adminActor.role,
    test: {
      connectionId: draft.id,
      metadata: { test_model_name: "gpt-4" },
      status: "failed",
      errorSummary: "timeout",
      testedAt,
    },
  });

  const connection = await repository.findById(draft.id);
  assert.equal(connection?.last_test_status, "failed");
  assert.equal(connection?.last_error_summary, "timeout");
  assert.equal(connection?.last_test_at?.getTime(), testedAt.getTime());
});

test("audit events record create, update, rotate, enable, disable, and test", async () => {
  const { service, auditService } = createTestService();
  const draft = buildConnectionDraft({ id: "audit-check" });

  await createConnection(service, draft);
  await service.updateConnection({
    actorId: adminActor.id,
    actorRole: adminActor.role,
    update: { connectionId: draft.id, changes: { name: "updated" } },
  });
  await service.rotateCredential({
    actorId: adminActor.id,
    actorRole: adminActor.role,
    rotation: { connectionId: draft.id, apiKey: "audit-rotate" },
  });
  await service.disableConnection({
    actorId: adminActor.id,
    actorRole: adminActor.role,
    connectionId: draft.id,
  });
  await service.enableConnection({
    actorId: adminActor.id,
    actorRole: adminActor.role,
    connectionId: draft.id,
  });
  await service.testConnection({
    actorId: adminActor.id,
    actorRole: adminActor.role,
    test: {
      connectionId: draft.id,
      metadata: { test_model_name: "gpt-4" },
      status: "passed",
      testedAt: new Date(FIXED_NOW),
    },
  });

  const recordedActions = new Set(auditService.list().map((event) => event.action));
  for (const action of [
    "ai-provider-connection.create",
    "ai-provider-connection.update",
    "ai-provider-connection.rotate-credential",
    "ai-provider-connection.disable",
    "ai-provider-connection.enable",
    "ai-provider-connection.test",
  ]) {
    assert.ok(recordedActions.has(action), `Expected audit event ${action} to be recorded.`);
  }
});
