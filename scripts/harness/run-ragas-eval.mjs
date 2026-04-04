#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultWorkerRoot = path.resolve(
  scriptDirectory,
  "..",
  "..",
  "apps",
  "worker-py",
);

export function buildRunRagasEvalCommand({
  pythonBinary,
  inputPath,
  outputPath,
  embeddingProvider,
  embeddingModel,
  llmProvider,
  llmModel,
}) {
  return [
    pythonBinary,
    "-m",
    "harness_runners.ragas_runner",
    "--input",
    inputPath,
    "--output",
    outputPath,
    "--embedding-provider",
    embeddingProvider,
    "--embedding-model",
    embeddingModel,
    "--llm-provider",
    llmProvider,
    "--llm-model",
    llmModel,
  ];
}

export function normalizeRunnerResult(result) {
  return {
    schema_version: result.schema_version,
    status: result.status,
    dataset: structuredClone(result.dataset ?? {}),
    metric_summary: structuredClone(result.metric_summary ?? {}),
    sample_results: Array.isArray(result.sample_results)
      ? structuredClone(result.sample_results)
      : [],
    ...(result.engine ? { engine: structuredClone(result.engine) } : {}),
    ...(result.config ? { config: structuredClone(result.config) } : {}),
  };
}

export async function runRagasEval({
  inputPath,
  outputPath,
  pythonBinary = "python",
  workerRoot = defaultWorkerRoot,
  embeddingProvider = "local_stub",
  embeddingModel = "text-embedding-local",
  llmProvider = "local_stub",
  llmModel = "judge-local",
  execFileImpl = execFileAsync,
  readFileImpl = readFile,
}) {
  if (!inputPath) {
    throw new Error("Missing required inputPath option.");
  }
  if (!outputPath) {
    throw new Error("Missing required outputPath option.");
  }

  const resolvedInputPath = path.resolve(process.cwd(), inputPath);
  const resolvedOutputPath = path.resolve(process.cwd(), outputPath);
  const command = buildRunRagasEvalCommand({
    pythonBinary,
    inputPath: resolvedInputPath,
    outputPath: resolvedOutputPath,
    embeddingProvider,
    embeddingModel,
    llmProvider,
    llmModel,
  });

  const pythonPath = path.join(workerRoot, "src");
  await execFileImpl(command[0], command.slice(1), {
    cwd: workerRoot,
    env: {
      ...process.env,
      PYTHONPATH: process.env.PYTHONPATH
        ? `${pythonPath}${path.delimiter}${process.env.PYTHONPATH}`
        : pythonPath,
    },
  });

  const raw = await readFileImpl(resolvedOutputPath, "utf8");
  return {
    outputPath: resolvedOutputPath,
    result: normalizeRunnerResult(JSON.parse(stripUtf8Bom(raw))),
  };
}

function parseArgs(argv) {
  const options = {
    inputPath: undefined,
    outputPath: undefined,
    pythonBinary: "python",
    workerRoot: defaultWorkerRoot,
    embeddingProvider: "local_stub",
    embeddingModel: "text-embedding-local",
    llmProvider: "local_stub",
    llmModel: "judge-local",
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") {
      options.help = true;
      continue;
    }
    if (value === "--input") {
      options.inputPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--output") {
      options.outputPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--python") {
      options.pythonBinary = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--worker-root") {
      options.workerRoot = path.resolve(process.cwd(), argv[index + 1]);
      index += 1;
      continue;
    }
    if (value === "--embedding-provider") {
      options.embeddingProvider = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--embedding-model") {
      options.embeddingModel = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--llm-provider") {
      options.llmProvider = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--llm-model") {
      options.llmModel = argv[index + 1];
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${value}`);
  }

  return options;
}

function stripUtf8Bom(text) {
  return typeof text === "string" && text.charCodeAt(0) === 0xfeff
    ? text.slice(1)
    : text;
}

function printHelp() {
  process.stdout.write(
    [
      "Usage: node scripts/harness/run-ragas-eval.mjs --input <path> --output <path>",
      "",
      "Executes the local retrieval-quality Python runner with local-first defaults",
      "and writes a normalized retrieval-quality JSON envelope.",
      "",
      "Options:",
      "  --input               Path to a gold-set export or retrieval dataset JSON file",
      "  --output              Path to the normalized retrieval-quality JSON result",
      "  --python              Override the Python binary (default: python)",
      "  --worker-root         Override the apps/worker-py root directory",
      "  --embedding-provider  Local embedding provider label",
      "  --embedding-model     Local embedding model label",
      "  --llm-provider        Local evaluation LLM provider label",
      "  --llm-model           Local evaluation LLM model label",
      "  --help                Show this help text",
      "",
    ].join("\n"),
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const { outputPath } = await runRagasEval({
    inputPath: options.inputPath,
    outputPath: options.outputPath,
    pythonBinary: options.pythonBinary,
    workerRoot: options.workerRoot,
    embeddingProvider: options.embeddingProvider,
    embeddingModel: options.embeddingModel,
    llmProvider: options.llmProvider,
    llmModel: options.llmModel,
  });

  process.stdout.write(`${outputPath}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
