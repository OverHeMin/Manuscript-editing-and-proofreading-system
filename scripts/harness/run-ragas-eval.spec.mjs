import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildRagasDatasetDocument,
  writeRagasDataset,
} from "./export-ragas-dataset.mjs";
import {
  buildRunRagasEvalCommand,
  normalizeRunnerResult,
  runRagasEval,
} from "./run-ragas-eval.mjs";

test("buildRagasDatasetDocument converts a published gold set into a retrieval eval dataset", () => {
  const dataset = buildRagasDatasetDocument(buildPublishedGoldSetDocument());

  assert.equal(dataset.schema_version, "retrieval_eval_dataset.v1");
  assert.equal(dataset.gold_set_version.id, "gold-version-1");
  assert.equal(dataset.module, "editing");
  assert.equal(dataset.sample_count, 2);
  assert.equal(dataset.items[0]?.item_id, "gold-version-1:1");
  assert.equal(
    dataset.items[0]?.question,
    "How should the editing agent ground endpoint rules?",
  );
  assert.deepEqual(dataset.items[0]?.reference_context_ids, ["knowledge-1"]);
});

test("buildRunRagasEvalCommand keeps evaluation local-first and file-based", () => {
  const command = buildRunRagasEvalCommand({
    pythonBinary: "python",
    inputPath: "C:/tmp/gold-set.json",
    outputPath: "C:/tmp/ragas-run.json",
    embeddingProvider: "local_stub",
    embeddingModel: "text-embedding-local",
    llmProvider: "local_stub",
    llmModel: "judge-local",
  });

  assert.deepEqual(command, [
    "python",
    "-m",
    "harness_runners.ragas_runner",
    "--input",
    "C:/tmp/gold-set.json",
    "--output",
    "C:/tmp/ragas-run.json",
    "--embedding-provider",
    "local_stub",
    "--embedding-model",
    "text-embedding-local",
    "--llm-provider",
    "local_stub",
    "--llm-model",
    "judge-local",
  ]);
});

test("normalizeRunnerResult returns a stable retrieval-quality envelope", () => {
  const normalized = normalizeRunnerResult({
    schema_version: "retrieval_quality_run.v1",
    status: "completed",
    dataset: {
      gold_set_version_id: "gold-version-1",
      sample_count: 2,
    },
    metric_summary: {
      answer_relevancy: 0.88,
    },
    sample_results: [
      {
        item_id: "gold-version-1:1",
      },
    ],
  });

  assert.deepEqual(normalized, {
    schema_version: "retrieval_quality_run.v1",
    status: "completed",
    dataset: {
      gold_set_version_id: "gold-version-1",
      sample_count: 2,
    },
    metric_summary: {
      answer_relevancy: 0.88,
    },
    sample_results: [
      {
        item_id: "gold-version-1:1",
      },
    ],
  });
});

test("writeRagasDataset tolerates UTF-8 BOM input from local exports", async () => {
  let capturedWrite = null;

  const { dataset, outputPath } = await writeRagasDataset({
    inputPath: "./fixtures/gold-set.json",
    outputDir: "./fixtures/output",
    readFileImpl: async () =>
      `\uFEFF${JSON.stringify(buildPublishedGoldSetDocument())}`,
    writeFileImpl: async (filePath, content) => {
      capturedWrite = { filePath, content };
    },
    mkdirImpl: async () => {},
  });

  assert.equal(dataset.schema_version, "retrieval_eval_dataset.v1");
  assert.match(outputPath, /ragas-dataset-gold-version-1-v2\.json$/);
  assert.ok(capturedWrite);
  assert.match(capturedWrite.content, /"schema_version": "retrieval_eval_dataset\.v1"/);
});

test("runRagasEval resolves its default worker root relative to the harness script", async () => {
  const previousCwd = process.cwd();
  const isolatedCwd = mkdtempSync(path.join(os.tmpdir(), "ragas-eval-cwd-"));
  const expectedWorkerRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "apps",
    "worker-py",
  );
  let execOptions = null;

  try {
    process.chdir(isolatedCwd);

    await runRagasEval({
      inputPath: "./input.json",
      outputPath: "./output.json",
      execFileImpl: async (_file, _args, options) => {
        execOptions = options;
      },
      readFileImpl: async () =>
        JSON.stringify({
          schema_version: "retrieval_quality_run.v1",
          status: "completed",
          dataset: {
            gold_set_version_id: "gold-version-1",
            sample_count: 1,
          },
          metric_summary: {},
          sample_results: [],
        }),
    });
  } finally {
    process.chdir(previousCwd);
  }

  assert.ok(execOptions);
  assert.equal(execOptions.cwd, expectedWorkerRoot);
  assert.equal(
    execOptions.env.PYTHONPATH,
    path.join(expectedWorkerRoot, "src"),
  );
});

function buildPublishedGoldSetDocument() {
  return {
    family: {
      id: "family-1",
      name: "Editing retrieval gold set",
      scope: {
        module: "editing",
        manuscript_types: ["clinical_study"],
        measure_focus: "grounding",
        template_family_id: "template-family-1",
      },
    },
    gold_set_version: {
      id: "gold-version-1",
      version_no: 2,
      status: "published",
      items: [
        {
          source_kind: "reviewed_case_snapshot",
          source_id: "snapshot-1",
          manuscript_id: "manuscript-1",
          manuscript_type: "clinical_study",
          deidentification_passed: true,
          human_reviewed: true,
          expected_structured_output: {
            question: "How should the editing agent ground endpoint rules?",
            reference_answer: "Use the approved endpoint disclosure rule.",
            reference_context_ids: ["knowledge-1"],
          },
        },
        {
          source_kind: "human_final_asset",
          source_id: "asset-2",
          manuscript_id: "manuscript-2",
          manuscript_type: "clinical_study",
          deidentification_passed: true,
          human_reviewed: true,
          expected_structured_output: {
            question: "Which checklist should drive terminology cleanup?",
            reference_answer: "Use the published terminology checklist.",
            reference_context_ids: ["knowledge-2"],
          },
        },
      ],
    },
    rubric: {
      id: "rubric-1",
      name: "Editing retrieval rubric",
      status: "published",
      version_no: 1,
    },
  };
}
