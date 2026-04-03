import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");

export function buildPredeploySteps() {
  return [
    { label: "Workspace lint", command: "pnpm lint" },
    { label: "Workspace typecheck", command: "pnpm typecheck" },
    { label: "Workspace test", command: "pnpm test" },
    { label: "API smoke boot", command: "pnpm --filter @medical/api run smoke:boot" },
    { label: "Web smoke boot", command: "pnpm --filter @medsys/web run smoke:boot" },
    { label: "Worker smoke boot", command: "pnpm --filter @medical/worker-py run smoke:boot" },
    { label: "Manuscript workbench release gate", command: "pnpm verify:manuscript-workbench" },
  ];
}

export function runPredeployVerification({
  cwd = repoRoot,
  env = process.env,
  output = console,
} = {}) {
  for (const step of buildPredeploySteps()) {
    output.log(`\n==> ${step.label}`);
    runShellCommand(step.command, { cwd, env });
  }

  output.log("\nProduction predeploy contract passed.");
}

export async function verifyPostdeployHealth({
  baseUrl,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!baseUrl) {
    throw new Error("Missing required --base-url for postdeploy verification.");
  }

  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required for postdeploy verification.");
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const healthz = await fetchHealthEndpoint({
    baseUrl: normalizedBaseUrl,
    endpointPath: "/healthz",
    fetchImpl,
  });
  const readyz = await fetchHealthEndpoint({
    baseUrl: normalizedBaseUrl,
    endpointPath: "/readyz",
    fetchImpl,
  });

  if (healthz.statusCode !== 200) {
    throw new Error(formatEndpointFailure("healthz", healthz));
  }

  if (readyz.statusCode !== 200) {
    throw new Error(formatEndpointFailure("readyz", readyz));
  }

  return {
    status: readyz.body?.status === "ready" ? "ready" : "not_ready",
    baseUrl: normalizedBaseUrl,
    healthz,
    readyz,
  };
}

export function printPostdeploySummary(result, output = console) {
  output.log(
    JSON.stringify(
      {
        status: result.status,
        baseUrl: result.baseUrl,
        healthz: result.healthz,
        readyz: result.readyz,
      },
      null,
      2,
    ),
  );
}

async function fetchHealthEndpoint({ baseUrl, endpointPath, fetchImpl }) {
  const endpointUrl = `${baseUrl}${endpointPath}`;

  let response;
  try {
    response = await fetchImpl(endpointUrl, {
      headers: { accept: "application/json" },
    });
  } catch (error) {
    throw new Error(
      `Failed to fetch ${endpointPath} from ${baseUrl}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return {
    statusCode: response.status,
    body: await parseResponseBody(response),
  };
}

async function parseResponseBody(response) {
  const rawText = await response.text();
  const contentType = response.headers?.get?.("content-type") ?? "";

  if (!rawText.trim()) {
    return {};
  }

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(rawText);
    } catch {
      return { raw: summarizeText(rawText) };
    }
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return { raw: summarizeText(rawText) };
  }
}

function formatEndpointFailure(endpointName, result) {
  return `${endpointName} returned ${result.statusCode}: ${JSON.stringify(toCompactPayload(result.body))}`;
}

function toCompactPayload(body) {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return body;
  }

  return { raw: summarizeText(body == null ? "" : String(body)) };
}

function summarizeText(value) {
  return value.replace(/\s+/g, " ").trim().slice(0, 200);
}

function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/u, "");
}

function runShellCommand(command, { cwd, env }) {
  const result = spawnSync(command, {
    cwd,
    env,
    stdio: "inherit",
    shell: true,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main(argv) {
  const [subcommand, ...args] = argv;

  if (subcommand === "predeploy") {
    runPredeployVerification();
    return;
  }

  if (subcommand === "postdeploy") {
    const options = parseCliOptions(args);
    const result = await verifyPostdeployHealth({ baseUrl: options.baseUrl });
    printPostdeploySummary(result);
    return;
  }

  printUsage();
  process.exit(1);
}

function parseCliOptions(args) {
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (current === "--base-url") {
      options.baseUrl = args[index + 1];
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${current}`);
  }

  return options;
}

function printUsage() {
  console.error(
    "Usage: node ./scripts/production-release-contract.mjs <predeploy|postdeploy> [--base-url http://127.0.0.1:3001]",
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
