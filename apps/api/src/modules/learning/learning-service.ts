import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";
import {
  DocumentAssetService,
  ManuscriptNotFoundError,
} from "../assets/document-asset-service.ts";
import type { ManuscriptRepository } from "../manuscripts/manuscript-repository.ts";
import {
  createDirectWriteTransactionManager,
  createScopedWriteTransactionManager,
  type SnapshotCapableRepository,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import {
  InMemoryLearningCandidateRepository,
  InMemoryReviewedCaseSnapshotRepository,
} from "./in-memory-learning-repository.ts";
import type {
  LearningCandidateRecord,
  LearningCandidateType,
  ReviewedCaseSnapshotRecord,
} from "./learning-record.ts";
import type {
  LearningCandidateRepository,
  ReviewedCaseSnapshotRepository,
} from "./learning-repository.ts";

export interface CreateReviewedCaseSnapshotInput {
  manuscriptId: string;
  module: ReviewedCaseSnapshotRecord["module"];
  manuscriptType: ReviewedCaseSnapshotRecord["manuscript_type"];
  humanFinalAssetId: string;
  deidentificationPassed: boolean;
  annotatedAssetId?: string;
  requestedBy: string;
  storageKey: string;
}

export interface CreateLearningCandidateInput {
  snapshotId: string;
  type: LearningCandidateType;
  title?: string;
  proposalText?: string;
  requestedBy: string;
  deidentificationPassed: boolean;
}

export interface LearningServiceOptions {
  manuscriptRepository: ManuscriptRepository;
  assetRepository: DocumentAssetRepository;
  snapshotRepository: ReviewedCaseSnapshotRepository;
  candidateRepository: LearningCandidateRepository;
  documentAssetService: DocumentAssetService;
  permissionGuard?: PermissionGuard;
  transactionManager?: WriteTransactionManager<LearningWriteContext>;
  createId?: () => string;
  now?: () => Date;
}

interface LearningWriteContext {
  manuscriptRepository: ManuscriptRepository;
  assetRepository: DocumentAssetRepository;
  snapshotRepository: ReviewedCaseSnapshotRepository;
  candidateRepository: LearningCandidateRepository;
}

export class LearningHumanFinalAssetRequiredError extends Error {
  constructor(assetId: string) {
    super(`Asset ${assetId} is not a human-final learning source asset.`);
    this.name = "LearningHumanFinalAssetRequiredError";
  }
}

export class LearningDeidentificationRequiredError extends Error {
  constructor() {
    super("Learning candidate creation requires a de-identification pass.");
    this.name = "LearningDeidentificationRequiredError";
  }
}

export class LearningSnapshotDeidentificationRequiredError extends Error {
  constructor() {
    super(
      "Reviewed case snapshot creation requires a de-identification pass.",
    );
    this.name = "LearningSnapshotDeidentificationRequiredError";
  }
}

export class LearningReviewRoleRequiredError extends Error {
  constructor(role: RoleKey) {
    super(`Role ${role} cannot approve learning candidates.`);
    this.name = "LearningReviewRoleRequiredError";
  }
}

export class LearningAnnotatedAssetNotFoundError extends Error {
  constructor(assetId: string) {
    super(`Annotated asset ${assetId} was not found.`);
    this.name = "LearningAnnotatedAssetNotFoundError";
  }
}

export class LearningAnnotatedAssetMismatchError extends Error {
  constructor(assetId: string, manuscriptId: string) {
    super(
      `Annotated asset ${assetId} does not belong to manuscript ${manuscriptId}.`,
    );
    this.name = "LearningAnnotatedAssetMismatchError";
  }
}

export class ReviewedCaseSnapshotNotFoundError extends Error {
  constructor(snapshotId: string) {
    super(`Reviewed case snapshot ${snapshotId} was not found.`);
    this.name = "ReviewedCaseSnapshotNotFoundError";
  }
}

export class LearningCandidateNotFoundError extends Error {
  constructor(candidateId: string) {
    super(`Learning candidate ${candidateId} was not found.`);
    this.name = "LearningCandidateNotFoundError";
  }
}

export class LearningService {
  private readonly manuscriptRepository: ManuscriptRepository;
  private readonly assetRepository: DocumentAssetRepository;
  private readonly snapshotRepository: ReviewedCaseSnapshotRepository;
  private readonly candidateRepository: LearningCandidateRepository;
  private readonly documentAssetService: DocumentAssetService;
  private readonly permissionGuard: PermissionGuard;
  private readonly transactionManager: WriteTransactionManager<LearningWriteContext>;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: LearningServiceOptions) {
    this.manuscriptRepository = options.manuscriptRepository;
    this.assetRepository = options.assetRepository;
    this.snapshotRepository = options.snapshotRepository;
    this.candidateRepository = options.candidateRepository;
    this.documentAssetService = options.documentAssetService;
    this.permissionGuard = options.permissionGuard ?? new PermissionGuard();
    this.transactionManager =
      options.transactionManager ??
      createLearningWriteTransactionManager({
        manuscriptRepository: this.manuscriptRepository,
        assetRepository: this.assetRepository,
        snapshotRepository: this.snapshotRepository,
        candidateRepository: this.candidateRepository,
      });
    this.createId = options.createId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  async createReviewedCaseSnapshot(
    input: CreateReviewedCaseSnapshotInput,
  ): Promise<ReviewedCaseSnapshotRecord> {
    return this.transactionManager.withTransaction(async (context) => {
      if (!input.deidentificationPassed) {
        throw new LearningSnapshotDeidentificationRequiredError();
      }

      const manuscript = await context.manuscriptRepository.findById(
        input.manuscriptId,
      );

      if (!manuscript) {
        throw new ManuscriptNotFoundError(input.manuscriptId);
      }

      const humanFinalAsset = await context.assetRepository.findById(
        input.humanFinalAssetId,
      );

      if (
        !humanFinalAsset ||
        humanFinalAsset.manuscript_id !== input.manuscriptId ||
        humanFinalAsset.asset_type !== "human_final_docx"
      ) {
        throw new LearningHumanFinalAssetRequiredError(input.humanFinalAssetId);
      }

      const annotatedAssetId = await this.resolveAnnotatedAssetId(
        input.annotatedAssetId,
        input.manuscriptId,
        context.assetRepository,
      );

      const snapshotId = this.createId();
      const timestamp = this.now().toISOString();
      const snapshotAsset = await this.documentAssetService
        .createScoped({
          manuscriptRepository: context.manuscriptRepository,
          assetRepository: context.assetRepository,
        })
        .createAsset({
        manuscriptId: input.manuscriptId,
        assetType: "learning_snapshot_attachment",
        storageKey: input.storageKey,
        mimeType: "application/octet-stream",
        createdBy: input.requestedBy,
        parentAssetId: input.humanFinalAssetId,
        sourceModule: "learning",
      });

      const snapshot: ReviewedCaseSnapshotRecord = {
        id: snapshotId,
        manuscript_id: input.manuscriptId,
        module: input.module,
        manuscript_type: manuscript.manuscript_type,
        human_final_asset_id: input.humanFinalAssetId,
        deidentification_passed: true,
        annotated_asset_id: annotatedAssetId,
        snapshot_asset_id: snapshotAsset.id,
        created_by: input.requestedBy,
        created_at: timestamp,
      };

      await context.snapshotRepository.save(snapshot);
      return snapshot;
    });
  }

  async createLearningCandidate(
    input: CreateLearningCandidateInput,
  ): Promise<LearningCandidateRecord> {
    if (!input.deidentificationPassed) {
      throw new LearningDeidentificationRequiredError();
    }

    const snapshot = await this.snapshotRepository.findById(input.snapshotId);
    if (!snapshot) {
      throw new ReviewedCaseSnapshotNotFoundError(input.snapshotId);
    }

    if (!snapshot.deidentification_passed || !input.deidentificationPassed) {
      throw new LearningDeidentificationRequiredError();
    }

    const timestamp = this.now().toISOString();
    const candidate: LearningCandidateRecord = {
      id: this.createId(),
      type: input.type,
      status: "pending_review",
      module: snapshot.module,
      manuscript_type: snapshot.manuscript_type,
      human_final_asset_id: snapshot.human_final_asset_id,
      annotated_asset_id: snapshot.annotated_asset_id,
      snapshot_asset_id: snapshot.snapshot_asset_id,
      title: input.title,
      proposal_text: input.proposalText,
      created_by: input.requestedBy,
      created_at: timestamp,
      updated_at: timestamp,
    };

    await this.candidateRepository.save(candidate);
    return candidate;
  }

  async approveLearningCandidate(
    candidateId: string,
    actorRole: RoleKey,
  ): Promise<LearningCandidateRecord> {
    this.permissionGuard.assert(actorRole, "learning.review");

    const candidate = await this.candidateRepository.findById(candidateId);
    if (!candidate) {
      throw new LearningCandidateNotFoundError(candidateId);
    }

    const approved: LearningCandidateRecord = {
      ...candidate,
      status: "approved",
      updated_at: this.now().toISOString(),
    };
    await this.candidateRepository.save(approved);
    return approved;
  }

  private async resolveAnnotatedAssetId(
    annotatedAssetId: string | undefined,
    manuscriptId: string,
    assetRepository: DocumentAssetRepository,
  ): Promise<string | undefined> {
    if (!annotatedAssetId) {
      return undefined;
    }

    const annotatedAsset = await assetRepository.findById(annotatedAssetId);
    if (!annotatedAsset) {
      throw new LearningAnnotatedAssetNotFoundError(annotatedAssetId);
    }

    if (annotatedAsset.manuscript_id !== manuscriptId) {
      throw new LearningAnnotatedAssetMismatchError(
        annotatedAssetId,
        manuscriptId,
      );
    }

    return annotatedAsset.id;
  }
}

function createLearningWriteTransactionManager(
  context: LearningWriteContext,
): WriteTransactionManager<LearningWriteContext> {
  if (
    context.snapshotRepository instanceof InMemoryReviewedCaseSnapshotRepository &&
    context.candidateRepository instanceof InMemoryLearningCandidateRepository
  ) {
    const repositories = [
      context.manuscriptRepository,
      context.assetRepository,
      context.snapshotRepository,
      context.candidateRepository,
    ];

    if (repositories.every(isSnapshotCapableRepository)) {
      return createScopedWriteTransactionManager({
        queueKey: context.manuscriptRepository,
        context,
        repositories,
      });
    }
  }

  return createDirectWriteTransactionManager(context);
}

function isSnapshotCapableRepository<T extends object>(
  repository: T,
): repository is T & SnapshotCapableRepository {
  return (
    typeof (repository as SnapshotCapableRepository).snapshotState === "function" &&
    typeof (repository as SnapshotCapableRepository).restoreState === "function"
  );
}
