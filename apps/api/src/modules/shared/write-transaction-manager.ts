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

export interface WriteTransactionManager {
  withTransaction<TResult>(
    work: (context: WriteTransactionContext) => Promise<TResult>,
  ): Promise<TResult>;
}

class DirectWriteTransactionManager implements WriteTransactionManager {
  constructor(private readonly context: WriteTransactionContext) {}

  withTransaction<TResult>(
    work: (context: WriteTransactionContext) => Promise<TResult>,
  ): Promise<TResult> {
    return work(this.context);
  }
}

const inMemoryTransactionQueues = new WeakMap<
  InMemoryManuscriptRepository,
  Promise<void>
>();
const inMemoryTransactionScope = new AsyncLocalStorage<
  Set<InMemoryManuscriptRepository>
>();

class InMemoryWriteTransactionManager implements WriteTransactionManager {
  constructor(
    private readonly context: {
      manuscriptRepository: InMemoryManuscriptRepository;
      assetRepository: InMemoryDocumentAssetRepository;
      jobRepository?: InMemoryJobRepository;
    },
  ) {}

  async withTransaction<TResult>(
    work: (context: WriteTransactionContext) => Promise<TResult>,
  ): Promise<TResult> {
    const activeRepositories = inMemoryTransactionScope.getStore();
    if (activeRepositories?.has(this.context.manuscriptRepository)) {
      return work(this.context);
    }

    const previous =
      inMemoryTransactionQueues.get(this.context.manuscriptRepository) ??
      Promise.resolve();
    let releaseQueue!: () => void;
    const currentQueue = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });
    inMemoryTransactionQueues.set(
      this.context.manuscriptRepository,
      currentQueue,
    );

    await previous;

    const manuscriptSnapshot = this.context.manuscriptRepository.snapshotState();
    const assetSnapshot = this.context.assetRepository.snapshotState();
    const jobSnapshot = this.context.jobRepository?.snapshotState();
    const nextScope = new Set(activeRepositories ?? []);
    nextScope.add(this.context.manuscriptRepository);

    try {
      return await inMemoryTransactionScope.run(nextScope, () =>
        work(this.context),
      );
    } catch (error) {
      this.context.manuscriptRepository.restoreState(manuscriptSnapshot);
      this.context.assetRepository.restoreState(assetSnapshot);
      if (jobSnapshot && this.context.jobRepository) {
        this.context.jobRepository.restoreState(jobSnapshot);
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
      manuscriptRepository,
      assetRepository,
      jobRepository,
    });
  }

  return new DirectWriteTransactionManager(context);
}
