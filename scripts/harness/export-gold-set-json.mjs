#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  if (!options.inputPath) {
    throw new Error("Missing required --input <path> argument.");
  }

  const inputPath = path.resolve(process.cwd(), options.inputPath);
  const raw = await readFile(inputPath, "utf8");
  const document = JSON.parse(raw);
  assertPublishedGoldSetDocument(document);

  const outputDir = path.resolve(
    process.cwd(),
    options.outputDir ?? path.join(".local-data", "harness-exports", "manual"),
  );
  await mkdir(outputDir, { recursive: true });

  const outputPath = path.join(
    outputDir,
    `gold-set-${document.gold_set_version.id}-v${document.gold_set_version.version_no}.json`,
  );
  await writeFile(`${outputPath}`, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  process.stdout.write(`${outputPath}\n`);
}

function parseArgs(argv) {
  const options = {
    inputPath: undefined,
    outputDir: undefined,
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

    if (value === "--output-dir") {
      options.outputDir = argv[index + 1];
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${value}`);
  }

  return options;
}

function assertPublishedGoldSetDocument(document) {
  if (!document || typeof document !== "object") {
    throw new Error("Expected a JSON object input document.");
  }

  if (!document.gold_set_version || typeof document.gold_set_version !== "object") {
    throw new Error("Input document must contain a gold_set_version object.");
  }

  if (document.gold_set_version.status !== "published") {
    throw new Error("Only published gold-set versions can be exported.");
  }
}

function printHelp() {
  process.stdout.write(
    [
      "Usage: node scripts/harness/export-gold-set-json.mjs --input <path> [--output-dir <path>]",
      "",
      "Reads a local governed gold-set JSON document and rewrites it into the bounded",
      "harness export directory. The input document must contain a published",
      "gold_set_version payload.",
      "",
      "Options:",
      "  --input       Path to a governed gold-set JSON document",
      "  --output-dir  Override the default .local-data/harness-exports/manual directory",
      "  --help        Show this help text",
      "",
    ].join("\n"),
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
