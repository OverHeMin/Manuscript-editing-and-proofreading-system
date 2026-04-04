#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function normalizeSimpleEvalInput(document) {
  const cases = Array.isArray(document?.cases) ? document.cases : [];
  return {
    schema_version: "simple_evals_suite.v1",
    suite: structuredClone(document?.suite ?? {}),
    case_count: cases.length,
    cases: cases.map((item, index) => ({
      case_id: item?.case_id ?? `case-${index + 1}`,
      prompt: item?.prompt ?? "",
      expected_label: item?.expected_label ?? "pass",
      metadata: structuredClone(item?.metadata ?? {}),
    })),
  };
}

export function runSimpleEvalsLocal(document) {
  const normalized = normalizeSimpleEvalInput(document);
  const caseResults = normalized.cases.map((item) => ({
    case_id: item.case_id,
    status: item.expected_label === "pass" ? "pass" : "fail",
    score: item.expected_label === "pass" ? 1 : 0,
    metadata: structuredClone(item.metadata),
  }));
  const passCount = caseResults.filter((item) => item.status === "pass").length;

  return {
    schema_version: "simple_evals_run.v1",
    status: "completed",
    engine: {
      name: "simple_evals_local",
      mode: "node_stub",
    },
    suite: {
      ...structuredClone(normalized.suite),
      case_count: normalized.case_count,
    },
    summary: {
      pass_count: passCount,
      fail_count: caseResults.length - passCount,
      pass_rate:
        normalized.case_count === 0
          ? 0
          : Number((passCount / normalized.case_count).toFixed(4)),
    },
    case_results: caseResults,
  };
}

export async function runSimpleEvals({
  inputPath,
  outputPath,
  readFileImpl = readFile,
  writeFileImpl = writeFile,
  mkdirImpl = mkdir,
}) {
  if (!inputPath) {
    throw new Error("Missing required inputPath option.");
  }
  if (!outputPath) {
    throw new Error("Missing required outputPath option.");
  }

  const resolvedInputPath = path.resolve(process.cwd(), inputPath);
  const resolvedOutputPath = path.resolve(process.cwd(), outputPath);
  const raw = await readFileImpl(resolvedInputPath, "utf8");
  const result = runSimpleEvalsLocal(JSON.parse(stripUtf8Bom(raw)));

  await mkdirImpl(path.dirname(resolvedOutputPath), { recursive: true });
  await writeFileImpl(
    resolvedOutputPath,
    `${JSON.stringify(result, null, 2)}\n`,
    "utf8",
  );

  return {
    outputPath: resolvedOutputPath,
    result,
  };
}

function parseArgs(argv) {
  const options = {
    inputPath: undefined,
    outputPath: undefined,
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
      "Usage: node scripts/harness/run-simple-evals.mjs --input <path> --output <path>",
      "",
      "Runs a bounded local simple-evals-style stub over JSON input cases.",
      "",
      "Options:",
      "  --input   Path to the simple-evals suite JSON file",
      "  --output  Path to the normalized simple-evals JSON result",
      "  --help    Show this help text",
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

  const { outputPath } = await runSimpleEvals({
    inputPath: options.inputPath,
    outputPath: options.outputPath,
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
