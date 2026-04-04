import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const migrationDoctorCommand =
  "pnpm --filter @medical/api exec node --import tsx ./src/database/scripts/migration-doctor.ts --json";

const REQUIRED_RELEASE_SUMMARY_FIELDS = [
  "Release Summary.Environment",
  "Release Summary.Operator",
  "Release Summary.Date",
  "Release Summary.Commit SHA",
  "Release Summary.Release branch / tag",
];
const REQUIRED_CHANGE_SCOPE_FIELDS = [
  "Change Scope.Release purpose",
  "Change Scope.Services touched",
  "Change Scope.Schema change required",
  "Change Scope.Upload root or object storage impact",
  "Change Scope.Secret rotation required",
];

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

export function validateReleaseManifest(manifestMarkdown, { manifestPath } = {}) {
  const fields = parseReleaseManifest(manifestMarkdown);
  const missingFields = [];

  for (const fieldKey of REQUIRED_RELEASE_SUMMARY_FIELDS) {
    if (!fields.get(fieldKey)) {
      missingFields.push(fieldKey);
    }
  }

  for (const fieldKey of REQUIRED_CHANGE_SCOPE_FIELDS) {
    if (!fields.get(fieldKey)) {
      missingFields.push(fieldKey);
    }
  }

  const schemaChangeRequired = parseManifestBoolean(fields.get("Change Scope.Schema change required"));
  if (schemaChangeRequired == null) {
    addMissingField(missingFields, "Change Scope.Schema change required");
  }

  const storageImpactRequired = parseManifestBoolean(
    fields.get("Change Scope.Upload root or object storage impact"),
  );
  if (storageImpactRequired == null) {
    addMissingField(missingFields, "Change Scope.Upload root or object storage impact");
  }

  const secretRotationRequired = parseManifestBoolean(
    fields.get("Change Scope.Secret rotation required"),
  );
  if (secretRotationRequired == null) {
    addMissingField(missingFields, "Change Scope.Secret rotation required");
  }

  if (schemaChangeRequired) {
    for (const fieldKey of [
      "Backup And Restore Point.PostgreSQL backup artifact",
      "Backup And Restore Point.Restore point / snapshot ID",
      "Backup And Restore Point.Backup verified by",
    ]) {
      if (!fields.get(fieldKey)) {
        addMissingField(missingFields, fieldKey);
      }
    }
  }

  if (storageImpactRequired) {
    const objectStorageBackupArtifact = fields.get(
      "Backup And Restore Point.Object storage backup artifact",
    );
    const uploadRootSnapshot = fields.get("Backup And Restore Point.Upload root snapshot");

    if (!objectStorageBackupArtifact && !uploadRootSnapshot) {
      addMissingField(missingFields, "Backup And Restore Point.Storage snapshot metadata");
    }
  }

  return {
    status: missingFields.length === 0 ? "ok" : "error",
    manifestPath: manifestPath ?? null,
    schemaChangeRequired: schemaChangeRequired === true,
    storageImpactRequired: storageImpactRequired === true,
    secretRotationRequired: secretRotationRequired === true,
    missingFields,
  };
}

export function enforceManifestMigrationConsistency({ manifestValidation, migrationAudit }) {
  if (!manifestValidation || !migrationAudit) {
    return;
  }

  if (
    manifestValidation.schemaChangeRequired === false &&
    migrationAudit.pendingMigrations.length > 0
  ) {
    throw new Error(
      `Release manifest declares schema change = no, but pending migrations exist: ${migrationAudit.pendingMigrations.join(", ")}`,
    );
  }
}

export function runMigrationDoctor({
  cwd = repoRoot,
  env = process.env,
} = {}) {
  const result = spawnSync(migrationDoctorCommand, {
    cwd,
    env,
    encoding: "utf8",
    shell: true,
  });

  if (result.error) {
    throw result.error;
  }

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";

  if (!stdout.trim()) {
    throw new Error(
      `Migration doctor did not emit JSON output.${stderr ? ` ${stderr.trim()}` : ""}`.trim(),
    );
  }

  let audit;
  try {
    audit = JSON.parse(stdout);
  } catch (error) {
    throw new Error(
      `Migration doctor emitted invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (result.status !== 0 && audit?.status !== "blocked") {
    throw new Error(
      `Migration doctor failed unexpectedly with exit code ${result.status ?? "unknown"}: ${stderr.trim() || stdout.trim()}`,
    );
  }

  return audit;
}

export function runPredeployVerification({
  cwd = repoRoot,
  env = process.env,
  output = console,
  manifestPath,
  checkMigrations = Boolean(manifestPath),
  readFileImpl = readFileSync,
  commandRunner = runShellCommand,
  migrationAuditRunner = runMigrationDoctor,
} = {}) {
  let manifestValidation = null;
  let migrationAudit = null;

  if (manifestPath) {
    output.log("\n==> Release manifest validation");

    const resolvedManifestPath = path.resolve(cwd, manifestPath);
    manifestValidation = validateReleaseManifest(readFileImpl(resolvedManifestPath, "utf8"), {
      manifestPath: resolvedManifestPath,
    });
    output.log(JSON.stringify(manifestValidation, null, 2));

    if (manifestValidation.status !== "ok") {
      throw new Error(formatManifestValidationFailure(manifestValidation));
    }
  }

  if (checkMigrations) {
    output.log("\n==> Migration doctor");

    migrationAudit = migrationAuditRunner({ cwd, env });
    output.log(JSON.stringify(migrationAudit, null, 2));

    if (migrationAudit.status === "blocked") {
      throw new Error(formatMigrationAuditFailure(migrationAudit));
    }

    enforceManifestMigrationConsistency({ manifestValidation, migrationAudit });
  }

  for (const step of buildPredeploySteps()) {
    output.log(`\n==> ${step.label}`);
    commandRunner(step.command, { cwd, env });
  }

  output.log("\nProduction predeploy contract passed.");

  return {
    manifestValidation,
    migrationAudit,
    steps: buildPredeploySteps(),
  };
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

function parseReleaseManifest(markdown) {
  const fields = new Map();
  let currentSection = "";

  for (const line of markdown.split(/\r?\n/u)) {
    const sectionMatch = line.match(/^##\s+(.+?)\s*$/u);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      continue;
    }

    const fieldMatch = line.match(/^- (.+?):\s*(.*)$/u);
    if (!fieldMatch || !currentSection) {
      continue;
    }

    const fieldName = fieldMatch[1].trim();
    const fieldValue = normalizeManifestFieldValue(fieldMatch[2]);
    fields.set(`${currentSection}.${fieldName}`, fieldValue);
  }

  return fields;
}

function normalizeManifestFieldValue(value) {
  return value.replace(/^`|`$/gu, "").trim();
}

function parseManifestBoolean(value) {
  const normalizedValue = value?.toLowerCase();

  if (normalizedValue === "yes") {
    return true;
  }

  if (normalizedValue === "no") {
    return false;
  }

  return null;
}

function addMissingField(missingFields, fieldKey) {
  if (!missingFields.includes(fieldKey)) {
    missingFields.push(fieldKey);
  }
}

function formatManifestValidationFailure(validation) {
  return `Release manifest is incomplete: ${validation.missingFields.join(", ")}`;
}

function formatMigrationAuditFailure(audit) {
  return `Migration doctor reported blocking drift: ${audit.blockingMigrations
    .map((finding) => `${finding.version} (${finding.reason})`)
    .join(", ")}`;
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
    throw new Error(`Command failed (${result.status ?? "unknown"}): ${command}`);
  }
}

async function main(argv) {
  const [subcommand, ...args] = argv;

  if (subcommand === "predeploy") {
    runPredeployVerification(parseCliOptions(args));
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

    if (current === "--manifest") {
      options.manifestPath = args[index + 1];
      index += 1;
      continue;
    }

    if (current === "--check-migrations") {
      options.checkMigrations = true;
      continue;
    }

    throw new Error(`Unknown option: ${current}`);
  }

  return options;
}

function printUsage() {
  console.error(
    "Usage: node ./scripts/production-release-contract.mjs predeploy [--manifest docs/operations/release-manifest.md] [--check-migrations]\n       node ./scripts/production-release-contract.mjs postdeploy --base-url http://127.0.0.1:3001",
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
