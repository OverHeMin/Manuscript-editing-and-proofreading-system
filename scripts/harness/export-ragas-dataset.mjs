#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function buildRagasDatasetDocument(document) {
  assertPublishedGoldSetDocument(document);

  const family = document.family ?? {};
  const familyScope = family.scope ?? {};
  const goldSetVersion = document.gold_set_version;
  const items = goldSetVersion.items.map((item, index) => {
    const expected = item.expected_structured_output ?? {};

    return {
      item_id: `${goldSetVersion.id}:${index + 1}`,
      question:
        expected.question ??
        `Retrieve grounding context for manuscript ${item.manuscript_id}.`,
      reference_answer: expected.reference_answer ?? "",
      reference_context_ids: Array.isArray(expected.reference_context_ids)
        ? [...expected.reference_context_ids]
        : [],
      metadata: {
        source_kind: item.source_kind,
        source_id: item.source_id,
        manuscript_id: item.manuscript_id,
        manuscript_type: item.manuscript_type,
        risk_tags: Array.isArray(item.risk_tags) ? [...item.risk_tags] : [],
      },
    };
  });

  return {
    schema_version: "retrieval_eval_dataset.v1",
    family: {
      id: family.id,
      name: family.name,
      scope: structuredClone(familyScope),
    },
    gold_set_version: {
      id: goldSetVersion.id,
      version_no: goldSetVersion.version_no,
      status: goldSetVersion.status,
    },
    module: familyScope.module,
    template_family_id: familyScope.template_family_id,
    sample_count: items.length,
    items,
  };
}

export async function writeRagasDataset({
  inputPath,
  outputDir,
  readFileImpl = readFile,
  writeFileImpl = writeFile,
  mkdirImpl = mkdir,
}) {
  if (!inputPath) {
    throw new Error("Missing required inputPath option.");
  }

  const resolvedInputPath = path.resolve(process.cwd(), inputPath);
  const raw = await readFileImpl(resolvedInputPath, "utf8");
  const document = JSON.parse(stripUtf8Bom(raw));
  const dataset = buildRagasDatasetDocument(document);

  const resolvedOutputDir = path.resolve(
    process.cwd(),
    outputDir ?? path.join(".local-data", "harness-exports", "manual"),
  );
  await mkdirImpl(resolvedOutputDir, { recursive: true });

  const outputPath = path.join(
    resolvedOutputDir,
    `ragas-dataset-${dataset.gold_set_version.id}-v${dataset.gold_set_version.version_no}.json`,
  );
  await writeFileImpl(
    outputPath,
    `${JSON.stringify(dataset, null, 2)}\n`,
    "utf8",
  );

  return {
    outputPath,
    dataset,
  };
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

function stripUtf8Bom(text) {
  return typeof text === "string" && text.charCodeAt(0) === 0xfeff
    ? text.slice(1)
    : text;
}

function assertPublishedGoldSetDocument(document) {
  if (!document || typeof document !== "object") {
    throw new Error("Expected a JSON object input document.");
  }
  if (!document.gold_set_version || typeof document.gold_set_version !== "object") {
    throw new Error("Input document must contain a gold_set_version object.");
  }
  if (!Array.isArray(document.gold_set_version.items)) {
    throw new Error("Input document must contain a gold_set_version.items array.");
  }
  if (document.gold_set_version.status !== "published") {
    throw new Error("Only published gold-set versions can be exported.");
  }
}

function printHelp() {
  process.stdout.write(
    [
      "Usage: node scripts/harness/export-ragas-dataset.mjs --input <path> [--output-dir <path>]",
      "",
      "Reads a local governed gold-set JSON export and converts it into a retrieval",
      "evaluation dataset document for the local retrieval-quality runner.",
      "",
      "Options:",
      "  --input       Path to a published gold-set JSON document",
      "  --output-dir  Override the default .local-data/harness-exports/manual directory",
      "  --help        Show this help text",
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

  const result = await writeRagasDataset({
    inputPath: options.inputPath,
    outputDir: options.outputDir,
  });
  process.stdout.write(`${result.outputPath}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
