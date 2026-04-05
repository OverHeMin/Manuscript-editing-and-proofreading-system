import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import {
  type AgentExecutionOrchestrationRecoveryOptions,
  type AgentExecutionOrchestrationScopeOptions,
  type AgentExecutionOrchestrationInspectionOptions,
  AgentExecutionOrchestrationService,
  AgentExecutionService,
  type AgentExecutionOrchestrationInspectionItem,
  type AgentExecutionOrchestrationInspectionReport,
  type AgentExecutionOrchestrationRecoverySummary,
  PostgresAgentExecutionRepository,
} from "../modules/agent-execution/index.ts";
import {
  ExecutionTrackingService,
  PostgresExecutionTrackingRepository,
} from "../modules/execution-tracking/index.ts";
import { PostgresToolGatewayRepository } from "../modules/tool-gateway/index.ts";
import {
  PostgresVerificationOpsRepository,
  VerificationOpsService,
} from "../modules/verification-ops/index.ts";
import { loadAppEnvDefaults } from "./env-defaults.ts";
import {
  formatPersistentStartupPreflightFailure,
  runPersistentStartupPreflight,
} from "./persistent-startup-preflight.ts";
import { resolvePersistentRuntimeContract } from "./persistent-runtime-contract.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

export interface GovernedExecutionOrchestrationRecoveryRunner {
  recoverPending(
    options?: AgentExecutionOrchestrationRecoveryOptions,
  ): Promise<AgentExecutionOrchestrationRecoverySummary>;
}

export interface GovernedExecutionOrchestrationInspectionRunner {
  inspectBacklog(
    options?: AgentExecutionOrchestrationInspectionOptions,
  ): Promise<AgentExecutionOrchestrationInspectionReport>;
}

export interface RunGovernedExecutionOrchestrationRecoveryOptions {
  orchestrationService: GovernedExecutionOrchestrationRecoveryRunner;
  recoveryOptions?: AgentExecutionOrchestrationRecoveryOptions;
}

export interface RunGovernedExecutionOrchestrationInspectionOptions {
  orchestrationService: GovernedExecutionOrchestrationInspectionRunner;
}

export interface RunGovernedExecutionOrchestrationRecoveryCliOptions {
  args?: string[];
  env?: NodeJS.ProcessEnv;
  loadEnvDefaults?: () => void;
  createRecoveryRunner?: (input: {
    env: NodeJS.ProcessEnv;
    recoveryOptions: AgentExecutionOrchestrationRecoveryOptions;
  }) => Promise<AgentExecutionOrchestrationRecoverySummary>;
  createInspectionRunner?: (input: {
    env: NodeJS.ProcessEnv;
    inspectionOptions: AgentExecutionOrchestrationInspectionOptions;
  }) => Promise<AgentExecutionOrchestrationInspectionReport>;
  log?: (message: string) => void;
}

const appRoot = path.resolve(import.meta.dirname, "../..");

export type {
  AgentExecutionOrchestrationInspectionReport,
  AgentExecutionOrchestrationRecoveryOptions,
  AgentExecutionOrchestrationRecoverySummary,
};

export async function runGovernedExecutionOrchestrationRecovery(
  options: RunGovernedExecutionOrchestrationRecoveryOptions,
): Promise<AgentExecutionOrchestrationRecoverySummary> {
  return options.orchestrationService.recoverPending(options.recoveryOptions);
}

export async function runGovernedExecutionOrchestrationInspection(
  options: RunGovernedExecutionOrchestrationInspectionOptions,
  inspectionOptions?: AgentExecutionOrchestrationInspectionOptions,
): Promise<AgentExecutionOrchestrationInspectionReport> {
  return options.orchestrationService.inspectBacklog(inspectionOptions);
}

export function formatGovernedExecutionOrchestrationRecoverySummary(
  summary: AgentExecutionOrchestrationRecoverySummary,
): string {
  const deferredCount = summary.deferred_count ?? 0;

  return (
    "[api] governed execution orchestration recovery " +
    `processed=${summary.processed_count} ` +
    `completed=${summary.completed_count} ` +
    `retryable=${summary.retryable_count} ` +
    `failed=${summary.failed_count} ` +
    `deferred=${deferredCount}` +
    formatGovernedExecutionOrchestrationRecoveryBudgetDetails(summary)
  );
}

export function formatGovernedExecutionOrchestrationInspectionSummary(
  report: AgentExecutionOrchestrationInspectionReport,
): string {
  return (
    "[api] governed execution orchestration dry-run " +
    `total=${report.summary.total_count} ` +
    `recoverable_now=${report.summary.recoverable_now_count} ` +
    `stale_running=${report.summary.stale_running_count} ` +
    `deferred_retry=${report.summary.deferred_retry_count} ` +
    `attention_required=${report.summary.attention_required_count} ` +
    `not_recoverable=${report.summary.not_recoverable_count} ` +
    `actionable=${report.focus.actionable_count} ` +
    `displayed=${report.focus.displayed_count} ` +
    `omitted=${report.focus.omitted_count}` +
    formatGovernedExecutionOrchestrationInspectionPreviewDetails(report)
  );
}

export function formatGovernedExecutionOrchestrationInspectionItem(
  item: AgentExecutionOrchestrationInspectionItem,
): string {
  return (
    "[api] governed execution orchestration dry-run item " +
    `category=${item.category} ` +
    `log=${item.log_id} ` +
    `module=${item.module} ` +
    `reason=${item.reason}`
  );
}

export async function runGovernedExecutionOrchestrationRecoveryCli(
  options: RunGovernedExecutionOrchestrationRecoveryCliOptions = {},
): Promise<void> {
  const args = options.args ?? process.argv.slice(2);
  const env = options.env ?? process.env;
  const log = options.log ?? console.log;
  const isDryRun = args.includes("--dry-run");
  const recoveryOptions = resolveRecoveryCliOptions(args);
  const inspectionOptions = resolveInspectionCliOptions(args);

  if (isDryRun) {
    const report =
      options.createInspectionRunner != null
        ? await options.createInspectionRunner({
            env,
            inspectionOptions,
          })
        : await runPersistentGovernedExecutionOrchestrationInspection(env, {
            loadEnvDefaults: options.loadEnvDefaults,
          }, inspectionOptions);

    if (args.includes("--json")) {
      log(JSON.stringify(report, null, 2));
      return;
    }

    log(formatGovernedExecutionOrchestrationInspectionSummary(report));
    for (const item of report.items) {
      log(formatGovernedExecutionOrchestrationInspectionItem(item));
    }
    return;
  }

  const summary =
    options.createRecoveryRunner != null
      ? await options.createRecoveryRunner({
          env,
          recoveryOptions,
        })
      : await runPersistentGovernedExecutionOrchestrationRecovery(env, {
          loadEnvDefaults: options.loadEnvDefaults,
        }, recoveryOptions);

  if (args.includes("--json")) {
    log(JSON.stringify(summary, null, 2));
    return;
  }

  log(formatGovernedExecutionOrchestrationRecoverySummary(summary));
}

export async function runPersistentGovernedExecutionOrchestrationRecovery(
  env: NodeJS.ProcessEnv,
  options?: {
    loadEnvDefaults?: () => void;
  },
  recoveryOptions?: AgentExecutionOrchestrationRecoveryOptions,
): Promise<AgentExecutionOrchestrationRecoverySummary> {
  const loadDefaults = options?.loadEnvDefaults ?? (() => loadAppEnvDefaults(appRoot));
  loadDefaults();

  const contract = resolvePersistentRuntimeContract(env);
  const preflight = await runPersistentStartupPreflight({
    contract,
  });
  if (preflight.status !== "ready") {
    throw new Error(formatPersistentStartupPreflightFailure(preflight));
  }

  const pool = new Pool({
    connectionString: contract.databaseUrl,
  });

  try {
    const orchestrationService = createPersistentRecoveryService(pool);
    return await runGovernedExecutionOrchestrationRecovery({
      orchestrationService,
      recoveryOptions,
    });
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export async function runPersistentGovernedExecutionOrchestrationInspection(
  env: NodeJS.ProcessEnv,
  options?: {
    loadEnvDefaults?: () => void;
  },
  inspectionOptions?: AgentExecutionOrchestrationInspectionOptions,
): Promise<AgentExecutionOrchestrationInspectionReport> {
  const loadDefaults = options?.loadEnvDefaults ?? (() => loadAppEnvDefaults(appRoot));
  loadDefaults();

  const contract = resolvePersistentRuntimeContract(env);
  const preflight = await runPersistentStartupPreflight({
    contract,
  });
  if (preflight.status !== "ready") {
    throw new Error(formatPersistentStartupPreflightFailure(preflight));
  }

  const pool = new Pool({
    connectionString: contract.databaseUrl,
  });

  try {
    const orchestrationService = createPersistentRecoveryService(pool);
    return await runGovernedExecutionOrchestrationInspection({
      orchestrationService,
    }, inspectionOptions);
  } finally {
    await pool.end().catch(() => undefined);
  }
}

function createPersistentRecoveryService(
  client: QueryableClient,
): AgentExecutionOrchestrationService {
  const agentExecutionService = new AgentExecutionService({
    repository: new PostgresAgentExecutionRepository({ client }),
  });
  const executionTrackingService = new ExecutionTrackingService({
    repository: new PostgresExecutionTrackingRepository({ client }),
  });
  const verificationOpsService = new VerificationOpsService({
    repository: new PostgresVerificationOpsRepository({ client }),
    toolGatewayRepository: new PostgresToolGatewayRepository({ client }),
  });

  return new AgentExecutionOrchestrationService({
    agentExecutionService,
    executionTrackingService,
    verificationOpsService,
  });
}

if (isDirectExecution()) {
  runGovernedExecutionOrchestrationRecoveryCli().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

function isDirectExecution(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) {
    return false;
  }

  return fileURLToPath(import.meta.url) === path.resolve(entrypoint);
}

function resolveInspectionCliOptions(
  args: string[],
): AgentExecutionOrchestrationInspectionOptions {
  return {
    actionableOnly: args.includes("--actionable-only"),
    budget: readOptionalIntegerFlag(args, "--budget"),
    limit: readOptionalIntegerFlag(args, "--limit"),
    ...resolveScopeCliOptions(args),
  };
}

function resolveRecoveryCliOptions(
  args: string[],
): AgentExecutionOrchestrationRecoveryOptions {
  return {
    budget: readOptionalIntegerFlag(args, "--budget"),
    ...resolveScopeCliOptions(args),
  };
}

function resolveScopeCliOptions(
  args: string[],
): AgentExecutionOrchestrationScopeOptions {
  return {
    modules: readRepeatedModuleFlag(args, "--module"),
    logIds: readRepeatedStringFlag(args, "--log-id"),
  };
}

function formatGovernedExecutionOrchestrationInspectionPreviewDetails(
  report: AgentExecutionOrchestrationInspectionReport,
): string {
  const preview = report.replay_preview;
  if (preview == null) {
    return "";
  }

  return (
    ` preview_selected=${preview.selected_count}` +
    ` preview_eligible=${preview.eligible_count}` +
    ` preview_remaining=${preview.remaining_count}` +
    ` preview_budget=${preview.budget}`
  );
}

function readOptionalIntegerFlag(args: string[], flag: string): number | undefined {
  const index = args.indexOf(flag);
  if (index < 0) {
    return undefined;
  }

  const rawValue = args[index + 1];
  if (rawValue == null) {
    return undefined;
  }

  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readRepeatedStringFlag(args: string[], flag: string): string[] | undefined {
  const values: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== flag) {
      continue;
    }

    const rawValue = args[index + 1];
    if (rawValue == null) {
      continue;
    }

    values.push(rawValue);
    index += 1;
  }

  return values.length > 0 ? values : undefined;
}

function readRepeatedModuleFlag(
  args: string[],
  flag: string,
): AgentExecutionOrchestrationScopeOptions["modules"] {
  const values = readRepeatedStringFlag(args, flag);
  return values as AgentExecutionOrchestrationScopeOptions["modules"];
}

function formatGovernedExecutionOrchestrationRecoveryBudgetDetails(
  summary: AgentExecutionOrchestrationRecoverySummary,
): string {
  if (summary.budget == null) {
    return "";
  }

  return (
    ` eligible=${summary.eligible_count ?? 0}` +
    ` remaining=${summary.remaining_count ?? 0}` +
    ` budget=${summary.budget}`
  );
}
