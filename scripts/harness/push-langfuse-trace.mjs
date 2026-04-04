#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function normalizeLangfuseTraceEnvelope(document) {
  if (document?.schema_version === "langfuse_trace_envelope.v1") {
    return structuredClone(document);
  }

  return {
    schema_version: "langfuse_trace_envelope.v1",
    trace: {
      id: document?.trace?.id ?? document?.run_id ?? "local-trace",
      name: document?.trace?.name ?? document?.trace_name ?? "local-harness-trace",
      input_reference: document?.input_reference,
      metadata: structuredClone(document?.metadata ?? {}),
      observations: Array.isArray(document?.observations)
        ? structuredClone(document.observations)
        : [],
    },
  };
}

export function isSelfHostedLangfuseEndpoint(endpoint) {
  if (!endpoint) {
    return false;
  }

  const url = new URL(endpoint);
  return !url.hostname.endsWith("langfuse.com");
}

export async function pushLangfuseTrace({
  inputPath,
  endpoint = process.env.LANGFUSE_ENDPOINT,
  publicKey = process.env.LANGFUSE_PUBLIC_KEY,
  secretKey = process.env.LANGFUSE_SECRET_KEY,
  fetchImpl = fetch,
  readFileImpl = readFile,
}) {
  if (!inputPath) {
    throw new Error("Missing required inputPath option.");
  }

  const resolvedInputPath = path.resolve(process.cwd(), inputPath);
  const raw = await readFileImpl(resolvedInputPath, "utf8");
  const envelope = normalizeLangfuseTraceEnvelope(JSON.parse(stripUtf8Bom(raw)));

  if (!endpoint) {
    return {
      status: "skipped",
      reason: "self-hosted endpoint not configured",
      envelope,
    };
  }
  if (!isSelfHostedLangfuseEndpoint(endpoint)) {
    throw new Error("Langfuse trace pushes must target a self-hosted endpoint.");
  }

  try {
    const response = await fetchImpl(new URL("/api/public/ingestion", endpoint), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(publicKey ? { "x-langfuse-public-key": publicKey } : {}),
        ...(secretKey ? { "x-langfuse-secret-key": secretKey } : {}),
      },
      body: JSON.stringify(envelope),
    });

    if (!response.ok) {
      return {
        status: "degraded",
        reason: `self-hosted trace sink unavailable (${response.status})`,
        envelope,
      };
    }

    return {
      status: "succeeded",
      endpoint,
      envelope,
    };
  } catch {
    return {
      status: "degraded",
      reason: "self-hosted trace sink unavailable",
      envelope,
    };
  }
}

function parseArgs(argv) {
  const options = {
    inputPath: undefined,
    endpoint: process.env.LANGFUSE_ENDPOINT,
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
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
    if (value === "--endpoint") {
      options.endpoint = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--public-key") {
      options.publicKey = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--secret-key") {
      options.secretKey = argv[index + 1];
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
      "Usage: node scripts/harness/push-langfuse-trace.mjs --input <path> [--endpoint <url>]",
      "",
      "Pushes a normalized trace envelope to a self-hosted Langfuse OSS endpoint.",
      "If no endpoint is configured, the script exits fail-open with a skipped result.",
      "",
      "Options:",
      "  --input       Path to the local trace envelope JSON file",
      "  --endpoint    Override LANGFUSE_ENDPOINT",
      "  --public-key  Override LANGFUSE_PUBLIC_KEY",
      "  --secret-key  Override LANGFUSE_SECRET_KEY",
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

  const result = await pushLangfuseTrace({
    inputPath: options.inputPath,
    endpoint: options.endpoint,
    publicKey: options.publicKey,
    secretKey: options.secretKey,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
