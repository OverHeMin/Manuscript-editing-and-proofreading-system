import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");

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
const SECRET_ROTATION_SECTION = "Secret Rotation And Upgrade Rehearsal";
const AI_RELEASE_GATE_SECTION = "AI Release Gate";
const REQUIRED_AI_RELEASE_GATE_FIELDS = [
  `${AI_RELEASE_GATE_SECTION}.Gold set versions covered`,
  `${AI_RELEASE_GATE_SECTION}.Evaluation suites covered`,
  `${AI_RELEASE_GATE_SECTION}.Finalized run IDs`,
  `${AI_RELEASE_GATE_SECTION}.Recommendation statuses`,
  `${AI_RELEASE_GATE_SECTION}.Manual promotion decision`,
  `${AI_RELEASE_GATE_SECTION}.Approved by`,
];
const NON_PROMOTABLE_AI_RECOMMENDATION_STATUSES = new Set([
  "needs_review",
  "rejected",
]);

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
  const blockingFields = [];

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

  const upgradeRehearsalRequired = parseManifestBoolean(
    fields.get(`${SECRET_ROTATION_SECTION}.Upgrade rehearsal required`),
  );

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

  if (secretRotationRequired) {
    for (const fieldKey of [
      `${SECRET_ROTATION_SECTION}.Secret rotation notes`,
      `${SECRET_ROTATION_SECTION}.Secret rotation verified by`,
    ]) {
      if (!fields.get(fieldKey)) {
        addMissingField(missingFields, fieldKey);
      }
    }
  }

  const rehearsalIsMandatory =
    schemaChangeRequired === true ||
    storageImpactRequired === true ||
    secretRotationRequired === true;

  if (rehearsalIsMandatory && upgradeRehearsalRequired !== true) {
    addMissingField(missingFields, `${SECRET_ROTATION_SECTION}.Upgrade rehearsal required`);
  }

  if (upgradeRehearsalRequired === true) {
    for (const fieldKey of [
      `${SECRET_ROTATION_SECTION}.Upgrade rehearsal environment`,
      `${SECRET_ROTATION_SECTION}.Upgrade rehearsal evidence`,
      `${SECRET_ROTATION_SECTION}.Upgrade rehearsal verified by`,
    ]) {
      if (!fields.get(fieldKey)) {
        addMissingField(missingFields, fieldKey);
      }
    }
  }

  const aiReleaseGateRequired = parseManifestBoolean(
    fields.get(`${AI_RELEASE_GATE_SECTION}.Harness release gate required`),
  );
  if (aiReleaseGateRequired == null) {
    addMissingField(
      missingFields,
      `${AI_RELEASE_GATE_SECTION}.Harness release gate required`,
    );
  }

  if (aiReleaseGateRequired === true) {
    for (const fieldKey of REQUIRED_AI_RELEASE_GATE_FIELDS) {
      if (!fields.get(fieldKey)) {
        addMissingField(missingFields, fieldKey);
      }
    }

    const recommendationStatuses = parseDelimitedManifestValues(
      fields.get(`${AI_RELEASE_GATE_SECTION}.Recommendation statuses`),
    );
    if (
      recommendationStatuses.some((status) =>
        NON_PROMOTABLE_AI_RECOMMENDATION_STATUSES.has(status),
      )
    ) {
      addBlockingField(blockingFields, `${AI_RELEASE_GATE_SECTION}.Recommendation statuses`);
    }

    const manualPromotionDecision =
      fields.get(`${AI_RELEASE_GATE_SECTION}.Manual promotion decision`)?.toLowerCase() ?? "";
    if (manualPromotionDecision && manualPromotionDecision !== "approved") {
      addBlockingField(blockingFields, `${AI_RELEASE_GATE_SECTION}.Manual promotion decision`);
    }
  }

  return {
    status: missingFields.length === 0 && blockingFields.length === 0 ? "ok" : "error",
    manifestPath: manifestPath ?? null,
    schemaChangeRequired: schemaChangeRequired === true,
    storageImpactRequired: storageImpactRequired === true,
    secretRotationRequired: secretRotationRequired === true,
    upgradeRehearsalRequired: upgradeRehearsalRequired === true,
    aiReleaseGateRequired: aiReleaseGateRequired === true,
    missingFields,
    blockingFields,
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
  apiPackageRoot = path.join(cwd, "apps", "api"),
  migrationDoctorScriptPath = path.join(
    apiPackageRoot,
    "src",
    "database",
    "scripts",
    "migration-doctor.ts",
  ),
  spawnSyncImpl = spawnSync,
} = {}) {
  const result = spawnSyncImpl(process.execPath, ["--import", "tsx", migrationDoctorScriptPath, "--json"], {
    cwd: apiPackageRoot,
    env,
    encoding: "utf8",
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

export function buildUpgradeRehearsalPlan({
  manifestPath,
  manifestMarkdown,
  cwd = repoRoot,
  readFileImpl = readFileSync,
} = {}) {
  if (!manifestPath) {
    throw new Error("Upgrade rehearsal planning requires --manifest <path>.");
  }

  const resolvedManifestPath = path.resolve(cwd, manifestPath);
  const markdown = manifestMarkdown ?? readFileImpl(resolvedManifestPath, "utf8");
  const manifestValidation = validateReleaseManifest(markdown, {
    manifestPath: resolvedManifestPath,
  });

  if (manifestValidation.status !== "ok") {
    throw new Error(
      `Upgrade rehearsal manifest is incomplete or blocked: ${formatManifestValidationProblems(manifestValidation)}`,
    );
  }

  const steps = [
    {
      label: "Manifest-aware predeploy verification",
      command: `pnpm verify:production-preflight -- --manifest ${manifestPath}`,
    },
    {
      label: "Strict predeploy reliability guard",
      command: "pnpm verify:production-preflight:strict",
    },
    {
      label: "Migration doctor snapshot",
      command: "pnpm --filter @medical/api run db:migration-doctor -- --json",
    },
  ];

  if (
    manifestValidation.schemaChangeRequired ||
    manifestValidation.storageImpactRequired ||
    manifestValidation.secretRotationRequired
  ) {
    steps.push(
      {
        label: "Persistent startup preflight in rehearsal environment",
        command: "pnpm --filter @medical/api run preflight:persistent",
      },
      {
        label: "Migration execution in rehearsal environment",
        command: "pnpm --filter @medical/api run db:migrate",
      },
      {
        label: "Postdeploy readiness verification in rehearsal environment",
        command: "pnpm verify:production-postdeploy -- --base-url <rehearsal-base-url>",
      },
    );
  }

  return {
    status: "ready",
    manifestPath,
    resolvedManifestPath,
    manifestValidation,
    steps,
    notes: [
      "Operator-owned and local-first: this command does not deploy, rollback, or mutate secrets.",
      "Replace <rehearsal-base-url> with the actual rehearsal environment URL before running postdeploy verification.",
    ],
  };
}

export function runUpgradeRehearsalGuard({
  manifestPath,
  cwd = repoRoot,
  readFileImpl = readFileSync,
  output = console,
} = {}) {
  const plan = buildUpgradeRehearsalPlan({
    manifestPath,
    cwd,
    readFileImpl,
  });

  output.log(JSON.stringify(plan, null, 2));
  return plan;
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

function addBlockingField(blockingFields, fieldKey) {
  if (!blockingFields.includes(fieldKey)) {
    blockingFields.push(fieldKey);
  }
}

function parseDelimitedManifestValues(value) {
  if (!value) {
    return [];
  }

  return value
    .split(/[,\n;]/u)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function formatManifestValidationFailure(validation) {
  return `Release manifest is incomplete or blocked: ${formatManifestValidationProblems(validation)}`;
}

function formatManifestValidationProblems(validation) {
  const problems = [];

  if (validation.missingFields?.length) {
    problems.push(`missing: ${validation.missingFields.join(", ")}`);
  }

  if (validation.blockingFields?.length) {
    problems.push(`blocked: ${validation.blockingFields.join(", ")}`);
  }

  return problems.join("; ");
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

  if (subcommand === "rehearsal") {
    const options = parseCliOptions(args);
    runUpgradeRehearsalGuard({ manifestPath: options.manifestPath });
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
    "Usage: node ./scripts/production-release-contract.mjs predeploy [--manifest docs/operations/release-manifest.md] [--check-migrations]\n       node ./scripts/production-release-contract.mjs rehearsal --manifest docs/operations/release-manifest.md\n       node ./scripts/production-release-contract.mjs postdeploy --base-url http://127.0.0.1:3001",
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
