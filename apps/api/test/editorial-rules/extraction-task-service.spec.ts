import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { EditorialRulePackageService } from "../../src/modules/editorial-rules/editorial-rule-package-service.ts";
import { ExampleSourceSessionService } from "../../src/modules/editorial-rules/example-source-session-service.ts";
import { ExtractionTaskService } from "../../src/modules/editorial-rules/extraction-task-service.ts";
import { InMemoryExtractionTaskRepository } from "../../src/modules/editorial-rules/in-memory-extraction-task-repository.ts";
import { buildRealSampleFixture } from "./fixtures/example-rule-package-fixtures.ts";

async function createExtractionTaskHarness() {
  const uploadRootDir = await mkdtemp(
    path.join(os.tmpdir(), "rule-package-extraction-task-"),
  );
  const extractionTaskRepository = new InMemoryExtractionTaskRepository();
  const exampleSourceSessionService = new ExampleSourceSessionService({
    uploadRootDir,
    now: () => new Date("2026-04-13T09:00:00.000Z"),
    createId: (() => {
      const ids = [
        "session-demo-1",
        "upload-original",
        "upload-edited",
        "task-demo-1",
        "candidate-demo-1",
        "candidate-demo-2",
        "candidate-demo-3",
        "candidate-demo-4",
        "candidate-demo-5",
        "candidate-demo-6",
      ];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected an extraction-task harness id.");
        return value;
      };
    })(),
  });
  const rulePackageService = new EditorialRulePackageService({
    exampleSourceSessionService,
  });
  const extractionTaskService = new ExtractionTaskService({
    repository: extractionTaskRepository,
    rulePackageService,
    createId: (() => {
      const ids = [
        "task-demo-1",
        "candidate-demo-1",
        "candidate-demo-2",
        "candidate-demo-3",
        "candidate-demo-4",
        "candidate-demo-5",
        "candidate-demo-6",
      ];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected an extraction-task service id.");
        return value;
      };
    })(),
    now: () => new Date("2026-04-13T09:30:00.000Z"),
  });

  return {
    extractionTaskRepository,
    extractionTaskService,
    cleanup: async () => {
      await rm(uploadRootDir, { recursive: true, force: true });
    },
  };
}

function buildUploadedPairInput() {
  const fixture = buildRealSampleFixture();

  return {
    manuscriptType: fixture.context.manuscript_type,
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

test("extraction task service creates a task and persists generated candidates", async () => {
  const { extractionTaskRepository, extractionTaskService, cleanup } =
    await createExtractionTaskHarness();

  try {
    const task = await extractionTaskService.createTask({
      taskName: "Clinical heading extraction",
      ...buildUploadedPairInput(),
    });

    assert.equal(task.id, "task-demo-1");
    assert.equal(task.status, "awaiting_confirmation");
    assert.ok(task.candidate_count > 0);
    assert.equal(task.pending_confirmation_count, task.candidate_count);
    assert.equal(task.candidates.length, task.candidate_count);
    assert.equal(task.candidates[0]?.confirmation_status, "ai_semantic_ready");
    assert.ok(
      (task.candidates[0]?.semantic_draft_payload.semantic_summary ?? "").length > 0,
    );

    const persistedTasks = await extractionTaskRepository.listTasks();
    const persistedCandidates = await extractionTaskRepository.listCandidatesByTaskId(
      task.id,
    );

    assert.equal(persistedTasks.length, 1);
    assert.equal(persistedTasks[0]?.id, task.id);
    assert.equal(persistedCandidates.length, task.candidate_count);
    assert.equal(
      persistedCandidates.every(
        (candidate) => candidate.confirmation_status === "ai_semantic_ready",
      ),
      true,
    );
  } finally {
    await cleanup();
  }
});
