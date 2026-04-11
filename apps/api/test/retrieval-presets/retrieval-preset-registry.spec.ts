import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import { InMemoryRetrievalPresetRepository } from "../../src/modules/retrieval-presets/in-memory-retrieval-preset-repository.ts";
import {
  RetrievalPresetService,
  RetrievalPresetValidationError,
} from "../../src/modules/retrieval-presets/retrieval-preset-service.ts";

function createRetrievalPresetHarness() {
  const repository = new InMemoryRetrievalPresetRepository();
  const ids = ["preset-1", "preset-2", "preset-3"];

  const service = new RetrievalPresetService({
    repository,
    createId: () => {
      const value = ids.shift();
      assert.ok(value, "Expected a retrieval preset id to be available.");
      return value;
    },
  });

  return {
    repository,
    service,
  };
}

test("only admin can create and activate retrieval presets, and newer activation archives the previous active preset in scope", async () => {
  const { repository, service } = createRetrievalPresetHarness();

  await assert.rejects(
    () =>
      service.createPreset("editor", {
        module: "editing",
        manuscriptType: "clinical_study",
        templateFamilyId: "family-1",
        name: "Editing retrieval v1",
        topK: 6,
        rerankEnabled: true,
        citationRequired: true,
      }),
    AuthorizationError,
  );

  const first = await service.createPreset("admin", {
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    name: "Editing retrieval v1",
    topK: 6,
    sectionFilters: ["discussion"],
    riskTagFilters: ["high_risk"],
    rerankEnabled: true,
    citationRequired: true,
    minRetrievalScore: 0.65,
  });
  const second = await service.createPreset("admin", {
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    name: "Editing retrieval v2",
    topK: 8,
    sectionFilters: ["methods", "discussion"],
    riskTagFilters: ["high_risk", "conflict"],
    rerankEnabled: true,
    citationRequired: false,
    minRetrievalScore: 0.72,
  });

  assert.equal(first.status, "draft");
  assert.equal(first.version, 1);
  assert.equal(second.status, "draft");
  assert.equal(second.version, 2);

  await service.activatePreset(first.id, "admin");
  const activatedSecond = await service.activatePreset(second.id, "admin");
  const reloadedFirst = await repository.findById(first.id);

  assert.equal(activatedSecond.status, "active");
  assert.equal(reloadedFirst?.status, "archived");
});

test("retrieval presets list by scope and resolve the active preset for that scope", async () => {
  const { service } = createRetrievalPresetHarness();

  const editingDraft = await service.createPreset("admin", {
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    name: "Editing retrieval v1",
    topK: 5,
    rerankEnabled: false,
    citationRequired: true,
  });
  await service.activatePreset(editingDraft.id, "admin");

  await service.createPreset("admin", {
    module: "proofreading",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    name: "Proofreading retrieval",
    topK: 3,
    rerankEnabled: false,
    citationRequired: false,
  });

  const scoped = await service.listPresetsForScope({
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
  });
  const active = await service.getActivePresetForScope({
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
  });

  assert.deepEqual(
    scoped.map((record) => record.id),
    [editingDraft.id],
  );
  assert.equal(active.id, editingDraft.id);
});

test("retrieval preset service rejects invalid retrieval values", async () => {
  const { service } = createRetrievalPresetHarness();

  await assert.rejects(
    () =>
      service.createPreset("admin", {
        module: "editing",
        manuscriptType: "clinical_study",
        templateFamilyId: "family-1",
        name: "Broken retrieval",
        topK: 0,
        rerankEnabled: true,
        citationRequired: true,
      }),
    RetrievalPresetValidationError,
  );
});
