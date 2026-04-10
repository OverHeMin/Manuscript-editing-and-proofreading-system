import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createEditorialRuleApi } from "../../src/modules/editorial-rules/editorial-rule-api.ts";
import { InMemoryEditorialRuleRepository } from "../../src/modules/editorial-rules/in-memory-editorial-rule-repository.ts";
import { EditorialRulePreviewService } from "../../src/modules/editorial-rules/editorial-rule-preview-service.ts";
import { EditorialRuleResolutionService } from "../../src/modules/editorial-rules/editorial-rule-resolution-service.ts";
import { EditorialRuleService } from "../../src/modules/editorial-rules/editorial-rule-service.ts";
import { EditorialRulePackageService } from "../../src/modules/editorial-rules/editorial-rule-package-service.ts";
import { ExampleSourceSessionService } from "../../src/modules/editorial-rules/example-source-session-service.ts";
import { InMemoryTemplateFamilyRepository } from "../../src/modules/templates/in-memory-template-family-repository.ts";
import { buildRealSampleFixture } from "./fixtures/example-rule-package-fixtures.ts";

async function createRulePackageHarness() {
  const uploadRootDir = await mkdtemp(
    path.join(os.tmpdir(), "rule-package-example-source-session-"),
  );
  const repository = new InMemoryEditorialRuleRepository();
  const templateFamilyRepository = new InMemoryTemplateFamilyRepository();
  const resolutionService = new EditorialRuleResolutionService({
    repository,
  });
  const previewService = new EditorialRulePreviewService({
    repository,
    resolutionService,
  });
  const editorialRuleService = new EditorialRuleService({
    repository,
    templateFamilyRepository,
    createId: (() => {
      const ids = ["rule-set-1", "rule-1", "rule-set-2", "rule-2"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a rule-package harness id.");
        return value;
      };
    })(),
  });
  const exampleSourceSessionService = new ExampleSourceSessionService({
    uploadRootDir,
    now: () => new Date("2026-04-10T10:00:00.000Z"),
    createId: (() => {
      const ids = ["session-demo-1", "upload-original", "upload-edited"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected an example-session harness id.");
        return value;
      };
    })(),
  });
  const api = createEditorialRuleApi({
    editorialRuleService,
    editorialRulePreviewService: previewService,
    editorialRulePackageService: new EditorialRulePackageService({
      exampleSourceSessionService,
    }),
  });

  return {
    api,
    cleanup: async () => {
      await rm(uploadRootDir, { recursive: true, force: true });
    },
  };
}

function buildUploadedPairInput() {
  const fixture = buildRealSampleFixture();

  return {
    originalFile: {
      fileName: "original-example.json",
      mimeType: "application/json",
      fileContentBase64: Buffer.from(
        JSON.stringify({ snapshot: fixture.original }),
        "utf8",
      ).toString("base64"),
    },
    editedFile: {
      fileName: "edited-example.json",
      mimeType: "application/json",
      fileContentBase64: Buffer.from(
        JSON.stringify({ snapshot: fixture.edited }),
        "utf8",
      ).toString("base64"),
    },
    journalKey: "journal-alpha",
  };
}

test("uploaded example-pair session can be created and resolved into rule-package workspace candidates", async () => {
  const { api, cleanup } = await createRulePackageHarness();

  try {
    const session = await api.createRulePackageExampleSourceSession({
      input: buildUploadedPairInput(),
    });

    assert.equal(session.status, 201);
    assert.equal(session.body.session_id, "session-demo-1");
    assert.equal(session.body.source_kind, "uploaded_example_pair");
    assert.equal(session.body.original_asset.file_name, "original-example.json");
    assert.equal(session.body.edited_asset.file_name, "edited-example.json");

    const workspace = await api.loadRulePackageWorkspace({
      input: {
        sourceKind: "uploaded_example_pair",
        exampleSourceSessionId: session.body.session_id,
      },
    });

    assert.equal(workspace.status, 200);
    assert.equal(workspace.body.source.sourceKind, "uploaded_example_pair");
    assert.equal(workspace.body.selectedPackageId, "package-front_matter");
    assert.deepEqual(
      workspace.body.candidates.map((candidate) => candidate.package_kind),
      [
        "front_matter",
        "abstract_keywords",
        "heading_hierarchy",
        "numeric_statistics",
        "three_line_table",
        "reference",
      ],
    );
  } finally {
    await cleanup();
  }
});
