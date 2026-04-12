import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import { createManuscriptQualityPackageApi } from "../../src/modules/manuscript-quality-packages/manuscript-quality-package-api.ts";
import { InMemoryManuscriptQualityPackageRepository } from "../../src/modules/manuscript-quality-packages/in-memory-manuscript-quality-package-repository.ts";
import { ManuscriptQualityPackageService } from "../../src/modules/manuscript-quality-packages/manuscript-quality-package-service.ts";

function createHarness() {
  const repository = new InMemoryManuscriptQualityPackageRepository();
  const service = new ManuscriptQualityPackageService({
    repository,
    createId: (() => {
      const ids = ["quality-package-1", "quality-package-2", "quality-package-3"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a manuscript quality package id.");
        return value;
      };
    })(),
  });
  const api = createManuscriptQualityPackageApi({
    manuscriptQualityPackageService: service,
  });

  return {
    api,
    service,
  };
}

test("manuscript quality packages can create, publish, and filter scoped governed versions", async () => {
  const { api } = createHarness();

  const created = await api.createDraftVersion({
    actorRole: "admin",
    input: {
      packageName: "Medical Research Style",
      packageKind: "general_style_package",
      targetScopes: ["general_proofreading"],
      manifest: {
        punctuation_profile: "medical_research_cn_v1",
      },
    },
  });

  assert.equal(created.status, 201);
  assert.equal(created.body.id, "quality-package-1");
  assert.equal(created.body.version, 1);
  assert.equal(created.body.status, "draft");

  const published = await api.publishVersion({
    actorRole: "admin",
    packageVersionId: created.body.id,
  });

  assert.equal(published.status, 200);
  assert.equal(published.body.status, "published");

  const createdNext = await api.createDraftVersion({
    actorRole: "admin",
    input: {
      packageName: "Medical Research Style",
      packageKind: "general_style_package",
      targetScopes: ["general_proofreading"],
      manifest: {
        punctuation_profile: "medical_research_cn_v2",
      },
    },
  });

  assert.equal(createdNext.body.version, 2);
  assert.equal(createdNext.body.status, "draft");

  const publishedNext = await api.publishVersion({
    actorRole: "admin",
    packageVersionId: createdNext.body.id,
  });

  assert.equal(publishedNext.body.status, "published");

  const listedPublished = await api.listPackageVersions({
    packageKind: "general_style_package",
    targetScope: "general_proofreading",
    status: "published",
  });
  const listedScoped = await api.listPackageVersions({
    packageKind: "general_style_package",
    targetScope: "general_proofreading",
  });

  assert.equal(listedPublished.status, 200);
  assert.deepEqual(
    listedPublished.body.map((record) => record.id),
    ["quality-package-2"],
  );
  assert.deepEqual(
    listedScoped.body.map((record) => ({
      id: record.id,
      version: record.version,
      status: record.status,
    })),
    [
      {
        id: "quality-package-1",
        version: 1,
        status: "archived",
      },
      {
        id: "quality-package-2",
        version: 2,
        status: "published",
      },
    ],
  );
});

test("manuscript quality package governance stays behind manage permissions", async () => {
  const { api } = createHarness();

  await assert.rejects(
    () =>
      api.createDraftVersion({
        actorRole: "editor",
        input: {
          packageName: "Medical Research Style",
          packageKind: "general_style_package",
          targetScopes: ["general_proofreading"],
          manifest: {},
        },
      }),
    AuthorizationError,
  );
});
