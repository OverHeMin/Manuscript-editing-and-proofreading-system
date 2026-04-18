import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";
import {
  DocumentAssetService,
  ManuscriptNotFoundError,
} from "../assets/document-asset-service.ts";
import {
  EditorialRuleCandidateExtractionService,
} from "../editorial-rules/editorial-rule-candidate-extraction-service.ts";
import type { ManuscriptRepository } from "../manuscripts/manuscript-repository.ts";
import {
  createDirectWriteTransactionManager,
  createScopedWriteTransactionManager,
  type SnapshotCapableRepository,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import type { LearningCandidateSourceLinkRecord } from "../feedback-governance/feedback-governance-record.ts";
import type { LinkLearningCandidateSourceInput } from "../feedback-governance/feedback-governance-service.ts";
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
  requestedByRole?: RoleKey;
  deidentificationPassed: boolean;
  candidatePayload?: Record<string, unknown>;
  suggestedRuleObject?: string;
  suggestedTemplateFamilyId?: string;
  suggestedJournalTemplateId?: string;
}

export interface AttachGovernedSourceInput {
  candidateId: string;
  sourceKind?: "human_feedback";
  snapshotId: string;
  feedbackRecordId: string;
  sourceAssetId: string;
  actorRole?: RoleKey;
}

export interface AttachEvaluationGovernedSourceInput {
  candidateId: string;
  sourceKind: "evaluation_experiment";
  reviewedCaseSnapshotId: string;
  evaluationRunId: string;
  evidencePackId: string;
  sourceAssetId: string;
  actorRole?: RoleKey;
}

export interface AttachReviewedSnapshotGovernedSourceInput {
  candidateId: string;
  sourceKind: "reviewed_case_snapshot";
  reviewedCaseSnapshotId: string;
  sourceAssetId?: string;
  actorRole?: RoleKey;
}

export interface AttachResidualIssueGovernedSourceInput {
  candidateId: string;
  sourceKind: "residual_issue";
  residualIssueId: string;
  snapshotId: string;
  sourceAssetId: string;
  actorRole?: RoleKey;
}

export type AttachLearningGovernedSourceInput =
  | AttachGovernedSourceInput
  | AttachEvaluationGovernedSourceInput
  | AttachReviewedSnapshotGovernedSourceInput
  | AttachResidualIssueGovernedSourceInput;

export type CreateGovernedLearningCandidateSourceInput =
  | Omit<AttachGovernedSourceInput, "candidateId">
  | Omit<AttachEvaluationGovernedSourceInput, "candidateId">
  | Omit<AttachReviewedSnapshotGovernedSourceInput, "candidateId">
  | Omit<AttachResidualIssueGovernedSourceInput, "candidateId">;

export interface ExtractReviewedSnapshotRuleCandidateInput {
  source: {
    kind: "reviewed_case_snapshot";
    reviewedCaseSnapshotId: string;
    beforeFragment: string;
    afterFragment: string;
    evidenceSummary: string;
  };
  requestedBy: string;
  requestedByRole?: RoleKey;
  deidentificationPassed: boolean;
  suggestedTemplateFamilyId?: string;
  suggestedJournalTemplateId?: string;
}

export interface ExtractFeedbackRuleCandidateInput {
  source: {
    kind: "human_feedback";
    reviewedCaseSnapshotId: string;
    executionSnapshotId: string;
    feedbackRecordId: string;
    sourceAssetId: string;
    beforeFragment: string;
    afterFragment: string;
    evidenceSummary: string;
  };
  requestedBy: string;
  requestedByRole?: RoleKey;
  deidentificationPassed: boolean;
  suggestedTemplateFamilyId?: string;
  suggestedJournalTemplateId?: string;
}

export type ExtractRuleCandidateInput =
  | ExtractReviewedSnapshotRuleCandidateInput
  | ExtractFeedbackRuleCandidateInput;

export interface CreateGovernedLearningCandidateInput
  extends CreateLearningCandidateInput {
  governedSource: CreateGovernedLearningCandidateSourceInput;
}

export interface CreateHumanFeedbackGovernedLearningCandidateInput {
  snapshotId: string;
  feedbackRecordId: string;
  sourceAssetId: string;
  type: LearningCandidateType;
  module: LearningCandidateRecord["module"];
  manuscriptType: LearningCandidateRecord["manuscript_type"];
  title?: string;
  proposalText?: string;
  requestedBy: string;
  requestedByRole?: RoleKey;
  candidatePayload?: Record<string, unknown>;
  suggestedRuleObject?: string;
  suggestedTemplateFamilyId?: string;
  suggestedJournalTemplateId?: string;
}

export interface CreateResidualGovernedLearningCandidateInput {
  type: LearningCandidateType;
  module: LearningCandidateRecord["module"];
  manuscriptType: LearningCandidateRecord["manuscript_type"];
  title?: string;
  proposalText?: string;
  requestedBy: string;
  requestedByRole?: RoleKey;
  candidatePayload?: Record<string, unknown>;
  suggestedRuleObject?: string;
  suggestedTemplateFamilyId?: string;
  suggestedJournalTemplateId?: string;
  governedSource: Omit<
    AttachResidualIssueGovernedSourceInput,
    "candidateId" | "actorRole"
  >;
}

export interface LearningFeedbackGovernanceService {
  linkLearningCandidateSource(
    input: LinkLearningCandidateSourceInput,
  ): Promise<LearningCandidateSourceLinkRecord>;
  listLearningCandidateSourceLinksByCandidateId(
    learningCandidateId: string,
  ): Promise<LearningCandidateSourceLinkRecord[]>;
}

export interface LearningServiceOptions {
  manuscriptRepository: ManuscriptRepository;
  assetRepository: DocumentAssetRepository;
  snapshotRepository: ReviewedCaseSnapshotRepository;
  candidateRepository: LearningCandidateRepository;
  documentAssetService: DocumentAssetService;
  feedbackGovernanceService: LearningFeedbackGovernanceService;
  candidateExtractionService?: EditorialRuleCandidateExtractionService;
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

export class LearningCandidateEvidenceRequiredError extends Error {
  constructor() {
    super("Rule candidate extraction requires a non-empty evidence summary.");
    this.name = "LearningCandidateEvidenceRequiredError";
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
  private readonly feedbackGovernanceService: LearningFeedbackGovernanceService;
  private readonly candidateExtractionService: EditorialRuleCandidateExtractionService;
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
    this.feedbackGovernanceService = options.feedbackGovernanceService;
    this.candidateExtractionService =
      options.candidateExtractionService ??
      new EditorialRuleCandidateExtractionService();
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
      status: "draft",
      module: snapshot.module,
      manuscript_type: snapshot.manuscript_type,
      human_final_asset_id: snapshot.human_final_asset_id,
      annotated_asset_id: snapshot.annotated_asset_id,
      snapshot_asset_id: snapshot.snapshot_asset_id,
      title: input.title,
      proposal_text: input.proposalText,
      candidate_payload: input.candidatePayload,
      suggested_rule_object: input.suggestedRuleObject,
      suggested_template_family_id: input.suggestedTemplateFamilyId,
      suggested_journal_template_id: input.suggestedJournalTemplateId,
      created_by: input.requestedBy,
      created_at: timestamp,
      updated_at: timestamp,
      review_actions: [],
    };

    await this.candidateRepository.save(candidate);
    return candidate;
  }

  async extractRuleCandidate(
    input: ExtractRuleCandidateInput,
  ): Promise<LearningCandidateRecord> {
    if (!input.deidentificationPassed) {
      throw new LearningDeidentificationRequiredError();
    }

    const reviewedSnapshot = await this.snapshotRepository.findById(
      input.source.reviewedCaseSnapshotId,
    );
    if (!reviewedSnapshot) {
      throw new ReviewedCaseSnapshotNotFoundError(
        input.source.reviewedCaseSnapshotId,
      );
    }

    if (!reviewedSnapshot.deidentification_passed) {
      throw new LearningDeidentificationRequiredError();
    }

    const evidenceSummary = input.source.evidenceSummary.trim();
    if (!evidenceSummary) {
      throw new LearningCandidateEvidenceRequiredError();
    }

    const extractedCandidate = this.candidateExtractionService.extract({
      sourceKind: input.source.kind,
      module: reviewedSnapshot.module,
      manuscriptType: reviewedSnapshot.manuscript_type,
      beforeFragment: input.source.beforeFragment,
      afterFragment: input.source.afterFragment,
      evidenceSummary,
    });

    const candidate = await this.createLearningCandidate({
      snapshotId: reviewedSnapshot.id,
      type: "rule_candidate",
      title: extractedCandidate.title,
      proposalText: extractedCandidate.proposalText,
      requestedBy: input.requestedBy,
      deidentificationPassed: true,
      candidatePayload: extractedCandidate.candidatePayload,
      suggestedRuleObject: extractedCandidate.suggestedRuleObject,
      suggestedTemplateFamilyId: input.suggestedTemplateFamilyId,
      suggestedJournalTemplateId: input.suggestedJournalTemplateId,
    });

    await this.attachGovernedSource(
      input.source.kind === "human_feedback"
        ? {
            candidateId: candidate.id,
            snapshotId: input.source.executionSnapshotId,
            feedbackRecordId: input.source.feedbackRecordId,
            sourceAssetId: input.source.sourceAssetId,
            actorRole: input.requestedByRole,
          }
        : {
            candidateId: candidate.id,
            sourceKind: "reviewed_case_snapshot",
            reviewedCaseSnapshotId: reviewedSnapshot.id,
            sourceAssetId: reviewedSnapshot.snapshot_asset_id,
            actorRole: input.requestedByRole,
          },
    );

    const updatedCandidate = await this.candidateRepository.findById(candidate.id);
    if (!updatedCandidate) {
      throw new LearningCandidateNotFoundError(candidate.id);
    }

    return updatedCandidate;
  }

  async attachGovernedSource(
    input: AttachLearningGovernedSourceInput,
  ): Promise<LearningCandidateSourceLinkRecord> {
    const candidate = await this.candidateRepository.findById(input.candidateId);
    if (!candidate) {
      throw new LearningCandidateNotFoundError(input.candidateId);
    }

    const sourceLink =
      await this.feedbackGovernanceService.linkLearningCandidateSource(
        "sourceKind" in input && input.sourceKind === "evaluation_experiment"
          ? {
              sourceKind: "evaluation_experiment",
              learningCandidateId: input.candidateId,
              reviewedCaseSnapshotId: input.reviewedCaseSnapshotId,
              evaluationRunId: input.evaluationRunId,
              evidencePackId: input.evidencePackId,
              sourceAssetId: input.sourceAssetId,
            }
            : "sourceKind" in input && input.sourceKind === "reviewed_case_snapshot"
            ? {
                sourceKind: "reviewed_case_snapshot",
                learningCandidateId: input.candidateId,
                reviewedCaseSnapshotId: input.reviewedCaseSnapshotId,
                sourceAssetId: input.sourceAssetId,
              }
            : "sourceKind" in input && input.sourceKind === "residual_issue"
              ? {
                  sourceKind: "residual_issue",
                  learningCandidateId: input.candidateId,
                  residualIssueId: input.residualIssueId,
                  snapshotId: input.snapshotId,
                  sourceAssetId: input.sourceAssetId,
                }
            : {
                learningCandidateId: input.candidateId,
                snapshotId: input.snapshotId,
                feedbackRecordId: input.feedbackRecordId,
                sourceAssetId: input.sourceAssetId,
              },
      );
    const nextStatus =
      candidate.status === "draft" ? "pending_review" : candidate.status;
    const nextReviewActions =
      nextStatus === "pending_review" && candidate.status !== "pending_review"
        ? appendLearningReviewAction(candidate.review_actions, {
            action: "submitted_for_review",
            actor_role: input.actorRole ?? "knowledge_reviewer",
            created_at: this.now().toISOString(),
          })
        : candidate.review_actions;
    await this.candidateRepository.save({
      ...candidate,
      status: nextStatus,
      governed_provenance_kind: sourceLink.source_kind,
      governed_feedback_record_id: sourceLink.feedback_record_id,
      governed_evaluation_run_id: sourceLink.evaluation_run_id,
      governed_evidence_pack_id: sourceLink.evidence_pack_id,
      updated_at: this.now().toISOString(),
      review_actions: nextReviewActions,
    });

    return sourceLink;
  }

  async createGovernedLearningCandidate(
    input: CreateGovernedLearningCandidateInput,
  ): Promise<LearningCandidateRecord> {
    const candidate = await this.createLearningCandidate(input);
    await this.attachGovernedSource({
      candidateId: candidate.id,
      actorRole: input.requestedByRole,
      ...input.governedSource,
    });

    const updatedCandidate = await this.candidateRepository.findById(candidate.id);
    if (!updatedCandidate) {
      throw new LearningCandidateNotFoundError(candidate.id);
    }

    return updatedCandidate;
  }

  async createHumanFeedbackGovernedLearningCandidate(
    input: CreateHumanFeedbackGovernedLearningCandidateInput,
  ): Promise<LearningCandidateRecord> {
    const timestamp = this.now().toISOString();
    const candidate: LearningCandidateRecord = {
      id: this.createId(),
      type: input.type,
      status: "draft",
      module: input.module,
      manuscript_type: input.manuscriptType,
      title: input.title,
      proposal_text: input.proposalText,
      candidate_payload: input.candidatePayload,
      suggested_rule_object: input.suggestedRuleObject,
      suggested_template_family_id: input.suggestedTemplateFamilyId,
      suggested_journal_template_id: input.suggestedJournalTemplateId,
      created_by: input.requestedBy,
      created_at: timestamp,
      updated_at: timestamp,
      review_actions: [],
    };

    await this.candidateRepository.save(candidate);
    await this.attachGovernedSource({
      candidateId: candidate.id,
      snapshotId: input.snapshotId,
      feedbackRecordId: input.feedbackRecordId,
      sourceAssetId: input.sourceAssetId,
      actorRole: input.requestedByRole,
    });

    const updatedCandidate = await this.candidateRepository.findById(candidate.id);
    if (!updatedCandidate) {
      throw new LearningCandidateNotFoundError(candidate.id);
    }

    return updatedCandidate;
  }

  async createResidualGovernedLearningCandidate(
    input: CreateResidualGovernedLearningCandidateInput,
  ): Promise<LearningCandidateRecord> {
    const timestamp = this.now().toISOString();
    const candidate: LearningCandidateRecord = {
      id: this.createId(),
      type: input.type,
      status: "draft",
      module: input.module,
      manuscript_type: input.manuscriptType,
      title: input.title,
      proposal_text: input.proposalText,
      candidate_payload: input.candidatePayload,
      suggested_rule_object: input.suggestedRuleObject,
      suggested_template_family_id: input.suggestedTemplateFamilyId,
      suggested_journal_template_id: input.suggestedJournalTemplateId,
      created_by: input.requestedBy,
      created_at: timestamp,
      updated_at: timestamp,
      review_actions: [],
    };

    await this.candidateRepository.save(candidate);
    await this.attachGovernedSource({
      candidateId: candidate.id,
      sourceKind: "residual_issue",
      residualIssueId: input.governedSource.residualIssueId,
      snapshotId: input.governedSource.snapshotId,
      sourceAssetId: input.governedSource.sourceAssetId,
      actorRole: input.requestedByRole,
    });

    const updatedCandidate = await this.candidateRepository.findById(candidate.id);
    if (!updatedCandidate) {
      throw new LearningCandidateNotFoundError(candidate.id);
    }

    return updatedCandidate;
  }

  async approveLearningCandidate(
    candidateId: string,
    actorRole: RoleKey,
    reviewNote?: string,
  ): Promise<LearningCandidateRecord> {
    this.permissionGuard.assert(actorRole, "learning.review");

    const candidate = await this.candidateRepository.findById(candidateId);
    if (!candidate) {
      throw new LearningCandidateNotFoundError(candidateId);
    }

    const sourceLinks =
      await this.feedbackGovernanceService.listLearningCandidateSourceLinksByCandidateId(
        candidateId,
      );
    if (sourceLinks.length === 0) {
      throw new LearningCandidateGovernedProvenanceRequiredError(candidateId);
    }

    const approved: LearningCandidateRecord = {
      ...candidate,
      status: "approved",
      updated_at: this.now().toISOString(),
      review_actions: appendLearningReviewAction(
        candidate.review_actions,
        createLearningReviewAction({
          action: "approved",
          actorRole,
          reviewNote,
          createdAt: this.now().toISOString(),
        }),
      ),
    };
    await this.candidateRepository.save(approved);
    return approved;
  }

  async rejectLearningCandidate(
    candidateId: string,
    actorRole: RoleKey,
    reviewNote?: string,
  ): Promise<LearningCandidateRecord> {
    this.permissionGuard.assert(actorRole, "learning.review");

    const candidate = await this.candidateRepository.findById(candidateId);
    if (!candidate) {
      throw new LearningCandidateNotFoundError(candidateId);
    }

    const sourceLinks =
      await this.feedbackGovernanceService.listLearningCandidateSourceLinksByCandidateId(
        candidateId,
      );
    if (sourceLinks.length === 0) {
      throw new LearningCandidateGovernedProvenanceRequiredError(candidateId);
    }

    const rejected: LearningCandidateRecord = {
      ...candidate,
      status: "rejected",
      updated_at: this.now().toISOString(),
      review_actions: appendLearningReviewAction(
        candidate.review_actions,
        createLearningReviewAction({
          action: "rejected",
          actorRole,
          reviewNote,
          createdAt: this.now().toISOString(),
        }),
      ),
    };
    await this.candidateRepository.save(rejected);
    return rejected;
  }

  async getLearningCandidate(
    candidateId: string,
  ): Promise<LearningCandidateRecord> {
    const candidate = await this.candidateRepository.findById(candidateId);
    if (!candidate) {
      throw new LearningCandidateNotFoundError(candidateId);
    }

    return candidate;
  }

  listLearningCandidates(): Promise<LearningCandidateRecord[]> {
    return this.candidateRepository.list();
  }

  listPendingReviewCandidates(): Promise<LearningCandidateRecord[]> {
    return this.candidateRepository.listByStatus("pending_review");
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

export class LearningCandidateGovernedProvenanceRequiredError extends Error {
  constructor(candidateId: string) {
    super(
      `Learning candidate ${candidateId} requires governed provenance before approval.`,
    );
    this.name = "LearningCandidateGovernedProvenanceRequiredError";
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

function appendLearningReviewAction(
  actions: LearningCandidateRecord["review_actions"],
  nextAction: NonNullable<LearningCandidateRecord["review_actions"]>[number],
): LearningCandidateRecord["review_actions"] {
  return [...(actions ?? []), nextAction];
}

function createLearningReviewAction({
  action,
  actorRole,
  reviewNote,
  createdAt,
}: {
  action: NonNullable<LearningCandidateRecord["review_actions"]>[number]["action"];
  actorRole: RoleKey;
  reviewNote?: string;
  createdAt: string;
}): NonNullable<LearningCandidateRecord["review_actions"]>[number] {
  const normalizedReviewNote = normalizeReviewNote(reviewNote);
  return {
    action,
    actor_role: actorRole,
    created_at: createdAt,
    ...(normalizedReviewNote ? { review_note: normalizedReviewNote } : {}),
  };
}

function normalizeReviewNote(reviewNote: string | undefined): string | undefined {
  const normalized = reviewNote?.trim();
  return normalized ? normalized : undefined;
}

function isSnapshotCapableRepository<T extends object>(
  repository: T,
): repository is T & SnapshotCapableRepository {
  return (
    typeof (repository as SnapshotCapableRepository).snapshotState === "function" &&
    typeof (repository as SnapshotCapableRepository).restoreState === "function"
  );
}
