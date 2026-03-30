import { AsyncLocalStorage } from "node:async_hooks";
import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";
import { InMemoryDocumentAssetRepository } from "../assets/in-memory-document-asset-repository.ts";
import { InMemoryJobRepository } from "../jobs/in-memory-job-repository.ts";
import type { JobRepository } from "../jobs/job-repository.ts";
import { InMemoryManuscriptRepository } from "../manuscripts/in-memory-manuscript-repository.ts";
import type { ManuscriptRepository } from "../manuscripts/manuscript-repository.ts";

export interface WriteTransactionContext {
  manuscriptRepository: ManuscriptRepository;
  assetRepository: DocumentAssetRepository;
  jobRepository?: JobRepository;
}

export interface SnapshotCapableRepository<TSnapshot = unknown> {
  snapshotState(): TSnapshot;
  restoreState(snapshot: TSnapshot): void;
}

export interface WriteTransactionManager<TContext = WriteTransactionContext> {
  withTransaction<TResult>(
    work: (context: TContext) => Promise<TResult>,
  ): Promise<TResult>;
}

export interface TransactionalQueryableClient {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
  release?: () => void;
}

class DirectWriteTransactionManager<TContext>
  implements WriteTransactionManager<TContext>
{
  constructor(private readonly context: TContext) {}

  withTransaction<TResult>(
    work: (context: TContext) => Promise<TResult>,
  ): Promise<TResult> {
    return work(this.context);
  }
}

const inMemoryTransactionQueues = new WeakMap<object, Promise<void>>();
const inMemoryTransactionScope = new AsyncLocalStorage<Set<object>>();

class InMemoryWriteTransactionManager<TContext>
  implements WriteTransactionManager<TContext>
{
  constructor(
    private readonly options: {
      queueKey: object;
      context: TContext;
      repositories: SnapshotCapableRepository[];
    },
  ) {}

  async withTransaction<TResult>(
    work: (context: TContext) => Promise<TResult>,
  ): Promise<TResult> {
    const activeRepositories = inMemoryTransactionScope.getStore();
    if (activeRepositories?.has(this.options.queueKey)) {
      return work(this.options.context);
    }

    const previous =
      inMemoryTransactionQueues.get(this.options.queueKey) ?? Promise.resolve();
    let releaseQueue!: () => void;
    const currentQueue = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });
    inMemoryTransactionQueues.set(this.options.queueKey, currentQueue);

    await previous;

    const snapshots = this.options.repositories.map((repository) => ({
      repository,
      snapshot: repository.snapshotState(),
    }));
    const nextScope = new Set(activeRepositories ?? []);
    nextScope.add(this.options.queueKey);

    try {
      return await inMemoryTransactionScope.run(nextScope, () =>
        work(this.options.context),
      );
    } catch (error) {
      for (const { repository, snapshot } of snapshots.reverse()) {
        repository.restoreState(snapshot);
      }
      throw error;
    } finally {
      releaseQueue();
    }
  }
}

function isInMemoryManuscriptRepository(
  repository: ManuscriptRepository,
): repository is InMemoryManuscriptRepository {
  return repository instanceof InMemoryManuscriptRepository;
}

function isInMemoryDocumentAssetRepository(
  repository: DocumentAssetRepository,
): repository is InMemoryDocumentAssetRepository {
  return repository instanceof InMemoryDocumentAssetRepository;
}

function isInMemoryJobRepository(
  repository: JobRepository | undefined,
): repository is InMemoryJobRepository | undefined {
  return (
    repository === undefined || repository instanceof InMemoryJobRepository
  );
}

export function createWriteTransactionManager(
  context: WriteTransactionContext,
): WriteTransactionManager {
  if (
    isInMemoryManuscriptRepository(context.manuscriptRepository) &&
    isInMemoryDocumentAssetRepository(context.assetRepository) &&
    isInMemoryJobRepository(context.jobRepository)
  ) {
    const manuscriptRepository = context.manuscriptRepository;
    const assetRepository = context.assetRepository;
    const jobRepository = context.jobRepository;

    return new InMemoryWriteTransactionManager({
      queueKey: manuscriptRepository,
      context,
      repositories: [
        manuscriptRepository,
        assetRepository,
        ...(jobRepository ? [jobRepository] : []),
      ],
    });
  }

  return new DirectWriteTransactionManager(context);
}

export function createScopedWriteTransactionManager<TContext>(options: {
  queueKey: object;
  context: TContext;
  repositories: SnapshotCapableRepository[];
}): WriteTransactionManager<TContext> {
  return new InMemoryWriteTransactionManager(options);
}

export function createDirectWriteTransactionManager<TContext>(
  context: TContext,
): WriteTransactionManager<TContext> {
  return new DirectWriteTransactionManager(context);
}

export function createPostgresWriteTransactionManager<TContext>(options: {
  getClient: () => Promise<TransactionalQueryableClient>;
  createContext: (client: TransactionalQueryableClient) => TContext;
}): WriteTransactionManager<TContext> {
  return {
    async withTransaction<TResult>(
      work: (context: TContext) => Promise<TResult>,
    ): Promise<TResult> {
      const client = await options.getClient();
      await client.query("begin");

      try {
        const result = await work(options.createContext(client));
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release?.();
      }
    },
  };
}
