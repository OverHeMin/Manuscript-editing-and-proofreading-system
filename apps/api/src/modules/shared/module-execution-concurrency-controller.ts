import type { JobRecord } from "../jobs/job-record.ts";
import type { JobRepository } from "../jobs/job-repository.ts";

export type ModuleExecutionConcurrencyControlledModule =
  | "screening"
  | "editing"
  | "proofreading";

export interface ModuleExecutionConcurrencyLimits {
  global: number;
  screening: number;
  editing: number;
  proofreading: number;
}

export interface ModuleExecutionConcurrencySnapshot {
  active: ModuleExecutionConcurrencyLimits;
  queued: ModuleExecutionConcurrencyLimits;
  limits: ModuleExecutionConcurrencyLimits;
}

export interface ModuleExecutionConcurrencyControllerOptions {
  limits?: Partial<ModuleExecutionConcurrencyLimits>;
}

interface QueueEntry<T = unknown> {
  module: ModuleExecutionConcurrencyControlledModule;
  task: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

export const DEFAULT_MODULE_EXECUTION_CONCURRENCY_LIMITS: ModuleExecutionConcurrencyLimits =
  {
    global: 2,
    screening: 2,
    editing: 1,
    proofreading: 1,
  };

export function resolveModuleExecutionConcurrencyLimitsFromEnv(
  env: Record<string, string | undefined>,
): ModuleExecutionConcurrencyLimits {
  return {
    global: normalizeConfiguredLimit(
      env["MODULE_EXECUTION_MAX_CONCURRENT_TOTAL"],
      DEFAULT_MODULE_EXECUTION_CONCURRENCY_LIMITS.global,
    ),
    screening: normalizeConfiguredLimit(
      env["MODULE_EXECUTION_MAX_CONCURRENT_SCREENING"],
      DEFAULT_MODULE_EXECUTION_CONCURRENCY_LIMITS.screening,
    ),
    editing: normalizeConfiguredLimit(
      env["MODULE_EXECUTION_MAX_CONCURRENT_EDITING"],
      DEFAULT_MODULE_EXECUTION_CONCURRENCY_LIMITS.editing,
    ),
    proofreading: normalizeConfiguredLimit(
      env["MODULE_EXECUTION_MAX_CONCURRENT_PROOFREADING"],
      DEFAULT_MODULE_EXECUTION_CONCURRENCY_LIMITS.proofreading,
    ),
  };
}

export class ModuleExecutionConcurrencyController {
  private readonly limits: ModuleExecutionConcurrencyLimits;
  private readonly active: ModuleExecutionConcurrencyLimits = {
    global: 0,
    screening: 0,
    editing: 0,
    proofreading: 0,
  };
  private readonly queue: QueueEntry<unknown>[] = [];
  private drainScheduled = false;

  constructor(options: ModuleExecutionConcurrencyControllerOptions = {}) {
    this.limits = {
      global: normalizeLimit(
        options.limits?.global,
        DEFAULT_MODULE_EXECUTION_CONCURRENCY_LIMITS.global,
      ),
      screening: normalizeLimit(
        options.limits?.screening,
        DEFAULT_MODULE_EXECUTION_CONCURRENCY_LIMITS.screening,
      ),
      editing: normalizeLimit(
        options.limits?.editing,
        DEFAULT_MODULE_EXECUTION_CONCURRENCY_LIMITS.editing,
      ),
      proofreading: normalizeLimit(
        options.limits?.proofreading,
        DEFAULT_MODULE_EXECUTION_CONCURRENCY_LIMITS.proofreading,
      ),
    };
  }

  async run<T>(input: {
    module: ModuleExecutionConcurrencyControlledModule;
    task: () => Promise<T>;
  }): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        module: input.module,
        task: input.task as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.scheduleDrain();
    });
  }

  getSnapshot(): ModuleExecutionConcurrencySnapshot {
    return {
      active: {
        ...this.active,
      },
      queued: {
        global: this.queue.length,
        screening: countQueuedItems(this.queue, "screening"),
        editing: countQueuedItems(this.queue, "editing"),
        proofreading: countQueuedItems(this.queue, "proofreading"),
      },
      limits: {
        ...this.limits,
      },
    };
  }

  private scheduleDrain(): void {
    if (this.drainScheduled) {
      return;
    }

    this.drainScheduled = true;
    queueMicrotask(() => {
      this.drainScheduled = false;
      this.drainQueue();
    });
  }

  private drainQueue(): void {
    let startedWork = false;

    for (let index = 0; index < this.queue.length; index += 1) {
      const entry = this.queue[index];
      if (!this.canStart(entry.module)) {
        continue;
      }

      this.queue.splice(index, 1);
      index -= 1;
      this.active.global += 1;
      this.active[entry.module] += 1;
      startedWork = true;
      void this.executeEntry(entry);
    }

    if (startedWork && this.queue.length > 0) {
      this.scheduleDrain();
    }
  }

  private async executeEntry(entry: QueueEntry<unknown>): Promise<void> {
    try {
      entry.resolve(await entry.task());
    } catch (error) {
      entry.reject(error);
    } finally {
      this.active.global = Math.max(0, this.active.global - 1);
      this.active[entry.module] = Math.max(0, this.active[entry.module] - 1);
      this.scheduleDrain();
    }
  }

  private canStart(
    module: ModuleExecutionConcurrencyControlledModule,
  ): boolean {
    return (
      this.active.global < this.limits.global &&
      this.active[module] < this.limits[module]
    );
  }
}

export async function runControlledModuleJob<TResult>(input: {
  controller: ModuleExecutionConcurrencyController;
  module: ModuleExecutionConcurrencyControlledModule;
  jobRepository: JobRepository;
  queuedJob: JobRecord;
  run: (runningJob: JobRecord) => Promise<TResult>;
  now?: () => Date;
}): Promise<TResult> {
  const now = input.now ?? (() => new Date());
  await input.jobRepository.save(input.queuedJob);

  return input.controller.run({
    module: input.module,
    task: async () => {
      const runningTimestamp = now().toISOString();
      const runningJob: JobRecord = {
        ...input.queuedJob,
        status: "running",
        attempt_count: Math.max(1, input.queuedJob.attempt_count),
        started_at: runningTimestamp,
        finished_at: undefined,
        error_message: undefined,
        updated_at: runningTimestamp,
      };
      await input.jobRepository.save(runningJob);

      try {
        return await input.run(runningJob);
      } catch (error) {
        const failedTimestamp = now().toISOString();
        const currentJob =
          (await input.jobRepository.findById(runningJob.id)) ?? runningJob;
        const failedJob: JobRecord = {
          ...currentJob,
          status: "failed",
          attempt_count: Math.max(1, currentJob.attempt_count),
          started_at: currentJob.started_at ?? runningTimestamp,
          finished_at: failedTimestamp,
          error_message: normalizeErrorMessage(error),
          updated_at: failedTimestamp,
        };
        await input.jobRepository.save(failedJob);
        throw error;
      }
    },
  });
}

function normalizeLimit(value: number | undefined, fallback: number): number {
  const normalized = Number.isFinite(value) ? Math.trunc(value as number) : fallback;
  return Math.max(1, normalized);
}

function normalizeConfiguredLimit(
  value: string | undefined,
  fallback: number,
): number {
  if (value == null || value.trim().length === 0) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return normalizeLimit(parsed, fallback);
}

function countQueuedItems(
  queue: readonly QueueEntry<unknown>[],
  module: ModuleExecutionConcurrencyControlledModule,
): number {
  return queue.filter((entry) => entry.module === module).length;
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return String(error);
}
