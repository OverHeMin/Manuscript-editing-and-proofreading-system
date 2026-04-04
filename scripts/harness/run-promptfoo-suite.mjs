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

export function buildRunPromptfooSuiteCommand({
  pythonBinary,
  inputPath,
  outputPath,
  provider,
  grader,
}) {
  return [
    pythonBinary,
    "-m",
    "harness_runners.promptfoo_runner",
    "--input",
    inputPath,
    "--output",
    outputPath,
    "--provider",
    provider,
    "--grader",
    grader,
  ];
}

export function normalizePromptfooResult(result) {
  return {
    schema_version: result.schema_version,
    status: result.status,
    suite: structuredClone(result.suite ?? {}),
    summary: structuredClone(result.summary ?? {}),
    case_results: Array.isArray(result.case_results)
      ? structuredClone(result.case_results)
      : [],
    ...(result.engine ? { engine: structuredClone(result.engine) } : {}),
    ...(result.config ? { config: structuredClone(result.config) } : {}),
  };
}

export async function runPromptfooSuite({
  inputPath,
  outputPath,
  pythonBinary = "python",
  workerRoot = defaultWorkerRoot,
  provider = "local_stub",
  grader = "local_stub",
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
  const command = buildRunPromptfooSuiteCommand({
    pythonBinary,
    inputPath: resolvedInputPath,
    outputPath: resolvedOutputPath,
    provider,
    grader,
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
    result: normalizePromptfooResult(JSON.parse(stripUtf8Bom(raw))),
  };
}

function parseArgs(argv) {
  const options = {
    inputPath: undefined,
    outputPath: undefined,
    pythonBinary: "python",
    workerRoot: defaultWorkerRoot,
    provider: "local_stub",
    grader: "local_stub",
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
    if (value === "--provider") {
      options.provider = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--grader") {
      options.grader = argv[index + 1];
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
      "Usage: node scripts/harness/run-promptfoo-suite.mjs --input <path> --output <path>",
      "",
      "Executes the local Promptfoo-style Python runner and writes a normalized JSON envelope.",
      "",
      "Options:",
      "  --input        Path to the Promptfoo suite or governed gold-set export JSON file",
      "  --output       Path to the normalized Promptfoo JSON result",
      "  --python       Override the Python binary (default: python)",
      "  --worker-root  Override the apps/worker-py root directory",
      "  --provider     Local provider label",
      "  --grader       Local grader label",
      "  --help         Show this help text",
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

  const { outputPath } = await runPromptfooSuite({
    inputPath: options.inputPath,
    outputPath: options.outputPath,
    pythonBinary: options.pythonBinary,
    workerRoot: options.workerRoot,
    provider: options.provider,
    grader: options.grader,
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
