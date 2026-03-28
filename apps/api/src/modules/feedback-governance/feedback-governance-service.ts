import { randomUUID } from "node:crypto";
import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";
import type { ExecutionTrackingRepository } from "../execution-tracking/execution-tracking-repository.ts";
import {
  createDirectWriteTransactionManager,
  createScopedWriteTransactionManager,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import type {
  TemplateModule,
} from "../templates/template-record.ts";
import {
  InMemoryFeedbackGovernanceRepository,
} from "./in-memory-feedback-governance-repository.ts";
import type {
  FeedbackGovernanceRepository,
} from "./feedback-governance-repository.ts";
import type {
  HumanFeedbackRecord,
  HumanFeedbackType,
  LearningCandidateSourceLinkRecord,
} from "./feedback-governance-record.ts";

interface FeedbackGovernanceWriteContext {
  repository: FeedbackGovernanceRepository;
}

export interface FeedbackGovernanceServiceOptions {
  repository: FeedbackGovernanceRepository;
  executionTrackingRepository: ExecutionTrackingRepository;
  assetRepository: DocumentAssetRepository;
  transactionManager?: WriteTransactionManager<FeedbackGovernanceWriteContext>;
  createId?: () => string;
  now?: () => Date;
}

export interface RecordHumanFeedbackInput {
  manuscriptId: string;
  module: TemplateModule;
  snapshotId: string;
  feedbackType: HumanFeedbackType;
  feedbackText?: string;
  createdBy: string;
}

export interface LinkLearningCandidateSourceInput {
  learningCandidateId: string;
  snapshotId: string;
  feedbackRecordId: string;
  sourceAssetId: string;
}

export class ModuleExecutionSnapshotNotFoundError extends Error {
  constructor(snapshotId: string) {
    super(`Module execution snapshot ${snapshotId} was not found.`);
    this.name = "ModuleExecutionSnapshotNotFoundError";
  }
}

export class HumanFeedbackRecordNotFoundError extends Error {
  constructor(feedbackRecordId: string) {
    super(`Human feedback record ${feedbackRecordId} was not found.`);
    this.name = "HumanFeedbackRecordNotFoundError";
  }
}

export class FeedbackSourceAssetNotFoundError extends Error {
  constructor(sourceAssetId: string) {
    super(`Source asset ${sourceAssetId} was not found.`);
    this.name = "FeedbackSourceAssetNotFoundError";
  }
}

export class HumanFeedbackSnapshotMismatchError extends Error {
  constructor(feedbackRecordId: string, snapshotId: string) {
    super(
      `Human feedback record ${feedbackRecordId} does not belong to snapshot ${snapshotId}.`,
    );
    this.name = "HumanFeedbackSnapshotMismatchError";
  }
}

export class HumanFeedbackScopeMismatchError extends Error {
  constructor(snapshotId: string, manuscriptId: string, module: string) {
    super(
      `Snapshot ${snapshotId} does not match manuscript ${manuscriptId} and module ${module}.`,
    );
    this.name = "HumanFeedbackScopeMismatchError";
  }
}

export class FeedbackSourceAssetMismatchError extends Error {
  constructor(sourceAssetId: string, manuscriptId: string) {
    super(`Source asset ${sourceAssetId} does not belong to manuscript ${manuscriptId}.`);
    this.name = "FeedbackSourceAssetMismatchError";
  }
}

export class FeedbackGovernanceService {
  private readonly repository: FeedbackGovernanceRepository;
  private readonly executionTrackingRepository: ExecutionTrackingRepository;
  private readonly assetRepository: DocumentAssetRepository;
  private readonly transactionManager: WriteTransactionManager<FeedbackGovernanceWriteContext>;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: FeedbackGovernanceServiceOptions) {
    this.repository = options.repository;
    this.executionTrackingRepository = options.executionTrackingRepository;
    this.assetRepository = options.assetRepository;
    this.transactionManager =
      options.transactionManager ??
      createFeedbackGovernanceTransactionManager({
        repository: this.repository,
      });
    this.createId = options.createId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  async recordHumanFeedback(
    input: RecordHumanFeedbackInput,
  ): Promise<HumanFeedbackRecord> {
    const snapshot = await this.requireSnapshot(input.snapshotId);

    if (
      snapshot.manuscript_id !== input.manuscriptId ||
      snapshot.module !== input.module
    ) {
      throw new HumanFeedbackScopeMismatchError(
        input.snapshotId,
        input.manuscriptId,
        input.module,
      );
    }

    const record: HumanFeedbackRecord = {
      id: this.createId(),
      manuscript_id: input.manuscriptId,
      module: input.module,
      snapshot_id: input.snapshotId,
      feedback_type: input.feedbackType,
      feedback_text: input.feedbackText,
      created_by: input.createdBy,
      created_at: this.now().toISOString(),
    };

    await this.repository.saveHumanFeedback(record);
    return record;
  }

  async linkLearningCandidateSource(
    input: LinkLearningCandidateSourceInput,
  ): Promise<LearningCandidateSourceLinkRecord> {
    return this.transactionManager.withTransaction(async ({ repository }) => {
      const snapshot = await this.requireSnapshot(input.snapshotId);
      const feedback = await repository.findHumanFeedbackById(input.feedbackRecordId);
      if (!feedback) {
        throw new HumanFeedbackRecordNotFoundError(input.feedbackRecordId);
      }

      if (feedback.snapshot_id !== input.snapshotId) {
        throw new HumanFeedbackSnapshotMismatchError(
          input.feedbackRecordId,
          input.snapshotId,
        );
      }

      const sourceAsset = await this.assetRepository.findById(input.sourceAssetId);
      if (!sourceAsset) {
        throw new FeedbackSourceAssetNotFoundError(input.sourceAssetId);
      }

      if (sourceAsset.manuscript_id !== snapshot.manuscript_id) {
        throw new FeedbackSourceAssetMismatchError(
          input.sourceAssetId,
          snapshot.manuscript_id,
        );
      }

      const link: LearningCandidateSourceLinkRecord = {
        id: this.createId(),
        learning_candidate_id: input.learningCandidateId,
        snapshot_id: input.snapshotId,
        feedback_record_id: input.feedbackRecordId,
        source_asset_id: input.sourceAssetId,
        created_at: this.now().toISOString(),
      };

      await repository.saveLearningCandidateSourceLink(link);
      return link;
    });
  }

  listHumanFeedbackBySnapshotId(snapshotId: string): Promise<HumanFeedbackRecord[]> {
    return this.repository.listHumanFeedbackBySnapshotId(snapshotId);
  }

  listLearningCandidateSourceLinksByCandidateId(
    learningCandidateId: string,
  ): Promise<LearningCandidateSourceLinkRecord[]> {
    return this.repository.listLearningCandidateSourceLinksByCandidateId(
      learningCandidateId,
    );
  }

  private async requireSnapshot(snapshotId: string) {
    const snapshot = await this.executionTrackingRepository.findSnapshotById(
      snapshotId,
    );
    if (!snapshot) {
      throw new ModuleExecutionSnapshotNotFoundError(snapshotId);
    }

    return snapshot;
  }
}

function createFeedbackGovernanceTransactionManager(
  context: FeedbackGovernanceWriteContext,
): WriteTransactionManager<FeedbackGovernanceWriteContext> {
  if (context.repository instanceof InMemoryFeedbackGovernanceRepository) {
    return createScopedWriteTransactionManager({
      queueKey: context.repository,
      context,
      repositories: [context.repository],
    });
  }

  return createDirectWriteTransactionManager(context);
}
