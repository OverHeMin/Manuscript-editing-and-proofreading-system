import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import { createSandboxProfileApi } from "../../src/modules/sandbox-profiles/sandbox-profile-api.ts";
import { InMemorySandboxProfileRepository } from "../../src/modules/sandbox-profiles/in-memory-sandbox-profile-repository.ts";
import {
  SandboxProfileService,
  type CreateSandboxProfileInput,
} from "../../src/modules/sandbox-profiles/sandbox-profile-service.ts";

function createSandboxProfileHarness() {
  const ids = ["sandbox-1", "sandbox-2"];
  const service = new SandboxProfileService({
    repository: new InMemorySandboxProfileRepository(),
    createId: () => {
      const value = ids.shift();
      assert.ok(value, "Expected a sandbox profile id to be available.");
      return value;
    },
  });
  const api = createSandboxProfileApi({
    sandboxProfileService: service,
  });

  return {
    api,
  };
}

test("only admin can create activate and archive sandbox profiles", async () => {
  const { api } = createSandboxProfileHarness();
  const input: CreateSandboxProfileInput = {
    name: "Safe Workspace",
    sandboxMode: "workspace_write",
    networkAccess: false,
    approvalRequired: true,
    allowedToolIds: ["tool-knowledge-read", "tool-template-read"],
  };

  await assert.rejects(
    () =>
      api.createProfile({
        actorRole: "editor",
        input,
      }),
    AuthorizationError,
  );

  const created = await api.createProfile({
    actorRole: "admin",
    input,
  });

  assert.equal(created.status, 201);
  assert.equal(created.body.status, "draft");
  assert.equal(created.body.sandbox_mode, "workspace_write");
  assert.equal(created.body.network_access, false);
  assert.equal(created.body.approval_required, true);
  assert.deepEqual(created.body.allowed_tool_ids, [
    "tool-knowledge-read",
    "tool-template-read",
  ]);

  await assert.rejects(
    () =>
      api.activateProfile({
        actorRole: "editor",
        profileId: created.body.id,
      }),
    AuthorizationError,
  );

  const activated = await api.activateProfile({
    actorRole: "admin",
    profileId: created.body.id,
  });

  assert.equal(activated.status, 200);
  assert.equal(activated.body.status, "active");

  const archived = await api.archiveProfile({
    actorRole: "admin",
    profileId: created.body.id,
  });

  assert.equal(archived.status, 200);
  assert.equal(archived.body.status, "archived");
});

test("activating a newer sandbox profile archives the previous active profile without losing its risk posture", async () => {
  const { api } = createSandboxProfileHarness();

  const first = await api.createProfile({
    actorRole: "admin",
    input: {
      name: "Safe Workspace",
      sandboxMode: "read_only",
      networkAccess: false,
      approvalRequired: true,
      allowedToolIds: ["tool-knowledge-read"],
    },
  });
  await api.activateProfile({
    actorRole: "admin",
    profileId: first.body.id,
  });

  const second = await api.createProfile({
    actorRole: "admin",
    input: {
      name: "Safe Workspace",
      sandboxMode: "workspace_write",
      networkAccess: true,
      approvalRequired: true,
      allowedToolIds: ["tool-knowledge-read", "tool-asset-read"],
    },
  });
  const secondActivated = await api.activateProfile({
    actorRole: "admin",
    profileId: second.body.id,
  });

  const firstReloaded = await api.getProfile({
    profileId: first.body.id,
  });

  assert.equal(secondActivated.body.status, "active");
  assert.equal(firstReloaded.body.status, "archived");
  assert.equal(firstReloaded.body.sandbox_mode, "read_only");
  assert.equal(firstReloaded.body.network_access, false);
  assert.deepEqual(firstReloaded.body.allowed_tool_ids, [
    "tool-knowledge-read",
  ]);
});
