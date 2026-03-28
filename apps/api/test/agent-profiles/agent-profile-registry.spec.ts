import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import { createAgentProfileApi } from "../../src/modules/agent-profiles/agent-profile-api.ts";
import { InMemoryAgentProfileRepository } from "../../src/modules/agent-profiles/in-memory-agent-profile-repository.ts";
import {
  AgentProfileService,
  type CreateAgentProfileInput,
} from "../../src/modules/agent-profiles/agent-profile-service.ts";

function createAgentProfileHarness() {
  const ids = ["agent-profile-1", "agent-profile-2", "agent-profile-3"];
  const service = new AgentProfileService({
    repository: new InMemoryAgentProfileRepository(),
    createId: () => {
      const value = ids.shift();
      assert.ok(value, "Expected an agent profile id to be available.");
      return value;
    },
  });
  const api = createAgentProfileApi({
    agentProfileService: service,
  });

  return {
    api,
  };
}

test("only admin can create publish and archive agent profiles for fixed platform roles", async () => {
  const { api } = createAgentProfileHarness();
  const input: CreateAgentProfileInput = {
    name: "Gstack Verification",
    roleKey: "gstack",
    moduleScope: ["screening", "editing", "proofreading"],
    manuscriptTypes: "any",
    description: "Runs verification-oriented checks for governed module execution.",
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
  assert.equal(created.body.role_key, "gstack");
  assert.deepEqual(created.body.module_scope, [
    "screening",
    "editing",
    "proofreading",
  ]);

  const published = await api.publishProfile({
    actorRole: "admin",
    profileId: created.body.id,
  });

  assert.equal(published.status, 200);
  assert.equal(published.body.status, "published");

  const archived = await api.archiveProfile({
    actorRole: "admin",
    profileId: created.body.id,
  });

  assert.equal(archived.status, 200);
  assert.equal(archived.body.status, "archived");
});

test("agent profiles support the fixed superpowers gstack and subagent role keys", async () => {
  const { api } = createAgentProfileHarness();

  const roles = [
    ["superpowers", "Planning Governor"],
    ["gstack", "Verification Operator"],
    ["subagent", "Bounded Executor"],
  ] as const;

  for (const [roleKey, name] of roles) {
    const created = await api.createProfile({
      actorRole: "admin",
      input: {
        name,
        roleKey,
        moduleScope: "any",
        manuscriptTypes: "any",
      },
    });
    const published = await api.publishProfile({
      actorRole: "admin",
      profileId: created.body.id,
    });

    assert.equal(published.body.role_key, roleKey);
    assert.equal(published.body.status, "published");
  }
});
