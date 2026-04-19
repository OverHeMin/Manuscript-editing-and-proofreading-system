import { createHash } from "node:crypto";
import type { HumanFeedbackRecord } from "../feedback-governance/feedback-governance-record.ts";
import type {
  LearningCandidateRecord,
  LearningCandidateType,
} from "../learning/learning-record.ts";
import type { LearningService } from "../learning/learning-service.ts";
import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { ResidualIssueRecord } from "../residual-learning/residual-learning-record.ts";
import type { ResidualLearningService } from "../residual-learning/residual-learning-service.ts";
import type { EditorialRuleActivationMetricsService } from "../editorial-rules/editorial-rule-activation-metrics-service.ts";
import {
  compareReviewItems,
  isGovernedHitQueueable,
  isLearningCandidateQueueable,
  isResidualIssueQueueable,
  mapGovernedHitToReviewItem,
  mapLearningCandidateToReviewItem,
  mapResidualIssueToReviewItem,
} from "./review-item-mapper.ts";
import type {
  GovernedHitFeedbackCategory,
  GovernedHitReviewItemRecord,
  ReviewItemDecisionResult,
  ReviewItemRecord,
  ReviewItemReviewStatus,
  ReviewItemSourceKind,
} from "./review-item-record.ts";
import type { ReviewItemsRepository } from "./review-items-repository.ts";

export interface SubmitGovernedHitInput {
  reviewItemId?: string;
  manuscriptId: string;
  manuscriptType: ManuscriptType;
  module: "screening" | "editing" | "proofreading";
  snapshotId: string;
  sourceAssetId: string;
  feedbackCategory: GovernedHitFeedbackCategory;
  feedbackText?: string;
  title?: string;
  excerpt?: string;
  location?: Record<string, unknown>;
  riskLevel?: NonNullable<ReviewItemRecord["risk_level"]>;
  suggestion?: string;
  rationale?: string;
  candidatePosture?: GovernedHitReviewItemRecord["candidate_posture"];
  decisionSource?: GovernedHitReviewItemRecord["decision_source"];
  evidencePack?: GovernedHitReviewItemRecord["evidence_pack"];
  relatedRuleIds?: string[];
  relatedKnowledgeItemIds?: string[];
  originPayload?: Record<string, unknown>;
  createdBy: string;
}

export interface SubmitGovernedHitResult {
  feedback: HumanFeedbackRecord;
  item: GovernedHitReviewItemRecord;
}

export interface RecordExecutionGovernedHitInput {
  sourceKey: string;
  feedbackCategory?: GovernedHitFeedbackCategory;
  title?: string;
  summary?: string;
  excerpt?: string;
  location?: Record<string, unknown>;
  riskLevel?: NonNullable<ReviewItemRecord["risk_level"]>;
  suggestion?: string;
  rationale?: string;
  candidate_posture?: GovernedHitReviewItemRecord["candidate_posture"];
  evidence_pack?: GovernedHitReviewItemRecord["evidence_pack"];
  relatedRuleIds?: string[];
  relatedKnowledgeItemIds?: string[];
  recommendedRoute?: GovernedHitReviewItemRecord["recommended_route"];
  originPayload?: Record<string, unknown>;
}

export interface RecordExecutionGovernedHitsInput {
  manuscriptId: string;
  manuscriptType: ManuscriptType;
  module: "screening" | "editing" | "proofreading";
  snapshotId: string;
  sourceAssetId: string;
  createdBy: string;
  items: readonly RecordExecutionGovernedHitInput[];
}

export interface RecordedExecutionGovernedHitResult {
  sourceKey: string;
  item: GovernedHitReviewItemRecord;
}

export interface ListReviewItemsInput {
  sourceKind?: ReviewItemSourceKind;
  module?: ReviewItemRecord["module"];
  manuscriptId?: string;
  riskLevel?: NonNullable<ReviewItemRecord["risk_level"]>;
  reviewStatus?: ReviewItemReviewStatus;
}

export type DecideReviewItemInput =
  | {
      sourceKind: "governed_hit";
      id: string;
      action:
        | "accept_change_only"
        | "reject_as_false_positive"
        | "route_to_rule_candidate"
        | "route_to_knowledge_candidate"
        | "route_to_prompt_candidate"
        | "archive_as_evidence_only";
      requestedBy?: string;
      requestedByRole?: Parameters<LearningService["approveLearningCandidate"]>[1];
      title?: string;
      proposalText?: string;
    }
  | {
      sourceKind: "residual_issue";
      id: string;
      action:
        | "validate"
        | "accept_change_only"
        | "reject_as_false_positive"
        | "route_to_rule_candidate"
        | "route_to_knowledge_candidate"
        | "route_to_prompt_candidate"
        | "archive_as_evidence_only";
      actorRole?: Parameters<LearningService["approveLearningCandidate"]>[1];
      suiteIds?: string[];
      releaseCheckProfileId?: string;
      requestedBy?: string;
      requestedByRole?: Parameters<LearningService["approveLearningCandidate"]>[1];
      title?: string;
      proposalText?: string;
    }
  | {
      sourceKind: "learning_candidate";
      id: string;
      action: "approve" | "reject";
      actorRole: Parameters<LearningService["approveLearningCandidate"]>[1];
      reviewNote?: string;
    };

export interface ReviewItemsServiceOptions {
  reviewItemsRepository: Pick<
    ReviewItemsRepository,
    "listGovernedHits" | "findGovernedHitById" | "saveGovernedHit"
  >;
  residualLearningService: Pick<ResidualLearningService, "listIssues">;
  learningService: Pick<
    LearningService,
    | "listPendingReviewCandidates"
    | "createHumanFeedbackGovernedLearningCandidate"
    | "approveLearningCandidate"
    | "rejectLearningCandidate"
  >;
  feedbackGovernanceService?: {
    recordHumanFeedback(input: {
      manuscriptId: string;
      module: "screening" | "editing" | "proofreading";
      snapshotId: string;
      feedbackType: "manual_confirmation" | "manual_correction" | "manual_rejection";
      feedbackText?: string;
      createdBy: string;
    }): Promise<HumanFeedbackRecord>;
  };
  residualReviewCoordinator?: {
    validateIssue(input: {
      issueId: string;
      actorRole: NonNullable<
        Extract<DecideReviewItemInput, { sourceKind: "residual_issue" }>["actorRole"]
      >;
      suiteIds: string[];
      releaseCheckProfileId?: string;
    }): Promise<{ issue: ResidualIssueRecord }>;
    createLearningCandidate(input: {
      issueId: string;
      requestedBy: string;
      requestedByRole?: Extract<
        DecideReviewItemInput,
        { sourceKind: "residual_issue" }
      >["requestedByRole"];
      title?: string;
      proposalText?: string;
      route?: "rule_candidate" | "knowledge_candidate" | "prompt_template_candidate";
    }): Promise<LearningCandidateRecord>;
    resolveIssueDecision(input: {
      issueId: string;
      resolution: "manual_only" | "evidence_only" | "archived";
    }): Promise<ResidualIssueRecord>;
  };
  activationMetricsService?: Pick<
    EditorialRuleActivationMetricsService,
    "recordGovernedDecision" | "recordGovernedHit"
  >;
  createId?: () => string;
  now?: () => Date;
}

export class ReviewItemNotFoundError extends Error {
  constructor(sourceKind: string, id: string) {
    super(`Review item ${sourceKind}:${id} was not found.`);
    this.name = "ReviewItemNotFoundError";
  }
}

export class ReviewItemsServiceDependencyRequiredError extends Error {
  constructor(dependency: string) {
    super(`Review items service requires ${dependency} for this operation.`);
    this.name = "ReviewItemsServiceDependencyRequiredError";
  }
}

export class ReviewItemDecisionActionNotSupportedError extends Error {
  constructor(sourceKind: string, action: string) {
    super(`Review item action ${action} is not supported for source ${sourceKind}.`);
    this.name = "ReviewItemDecisionActionNotSupportedError";
  }
}

export class ReviewItemDecisionInputInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewItemDecisionInputInvalidError";
  }
}

export class ReviewItemsService {
  private readonly reviewItemsRepository: Pick<
    ReviewItemsRepository,
    "listGovernedHits" | "findGovernedHitById" | "saveGovernedHit"
  >;
  private readonly residualLearningService: Pick<ResidualLearningService, "listIssues">;
  private readonly learningService: Pick<
    LearningService,
    | "listPendingReviewCandidates"
    | "createHumanFeedbackGovernedLearningCandidate"
    | "approveLearningCandidate"
    | "rejectLearningCandidate"
  >;
  private readonly feedbackGovernanceService?: ReviewItemsServiceOptions["feedbackGovernanceService"];
  private readonly residualReviewCoordinator?: ReviewItemsServiceOptions["residualReviewCoordinator"];
  private readonly activationMetricsService?: ReviewItemsServiceOptions["activationMetricsService"];
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: ReviewItemsServiceOptions) {
    this.reviewItemsRepository = options.reviewItemsRepository;
    this.residualLearningService = options.residualLearningService;
    this.learningService = options.learningService;
    this.feedbackGovernanceService = options.feedbackGovernanceService;
    this.residualReviewCoordinator = options.residualReviewCoordinator;
    this.activationMetricsService = options.activationMetricsService;
    this.createId = options.createId ?? crypto.randomUUID;
    this.now = options.now ?? (() => new Date());
  }

  async listReviewItems(input: ListReviewItemsInput = {}): Promise<ReviewItemRecord[]> {
    const [governedHits, residualIssues, learningCandidates] = await Promise.all([
      this.reviewItemsRepository.listGovernedHits(),
      this.residualLearningService.listIssues(),
      this.learningService.listPendingReviewCandidates(),
    ]);

    return [
      ...governedHits
        .filter((item) => isGovernedHitQueueable(item))
        .map((item) => mapGovernedHitToReviewItem(item)),
      ...residualIssues
        .filter((issue) => isResidualIssueQueueable(issue))
        .map((issue) => mapResidualIssueToReviewItem(issue)),
      ...learningCandidates
        .filter((candidate) => isLearningCandidateQueueable(candidate))
        .map((candidate) => mapLearningCandidateToReviewItem(candidate)),
    ]
      .filter((item) => matchesReviewItemsFilter(item, input))
      .sort(compareReviewItems);
  }

  async submitGovernedHit(
    input: SubmitGovernedHitInput,
  ): Promise<SubmitGovernedHitResult> {
    if (!this.feedbackGovernanceService) {
      throw new ReviewItemsServiceDependencyRequiredError(
        "feedbackGovernanceService",
      );
    }

    const existingItem = normalizeOptionalText(input.reviewItemId)
      ? await this.reviewItemsRepository.findGovernedHitById(
          normalizeOptionalText(input.reviewItemId)!,
        )
      : undefined;
    if (existingItem && existingItem.review_status !== "pending") {
      throw new ReviewItemDecisionInputInvalidError(
        "Only pending governed hits can receive submitted human feedback.",
      );
    }

    const timestamp = this.now().toISOString();
    const feedback = await this.feedbackGovernanceService.recordHumanFeedback({
      manuscriptId: input.manuscriptId,
      module: input.module,
      snapshotId: input.snapshotId,
      feedbackType: mapManualFeedbackCategoryToFeedbackType(input.feedbackCategory),
      feedbackText: normalizeOptionalText(input.feedbackText),
      createdBy: input.createdBy,
    });

    const item: GovernedHitReviewItemRecord = {
      id: existingItem?.id ?? normalizeOptionalText(input.reviewItemId) ?? this.createId(),
      source_kind: "governed_hit",
      source_status: existingItem?.source_status ?? "submitted",
      review_status: existingItem?.review_status ?? "pending",
      module: input.module,
      manuscript_id: input.manuscriptId,
      manuscript_type: input.manuscriptType,
      snapshot_id: input.snapshotId,
      source_asset_id: input.sourceAssetId,
      title:
        normalizeOptionalText(input.title) ??
        existingItem?.title ??
        buildGovernedHitTitle(input.feedbackCategory),
      summary:
        normalizeOptionalText(input.feedbackText) ??
        existingItem?.summary ??
        buildDefaultGovernedHitSummary(input.feedbackCategory, input.module),
      excerpt: normalizeOptionalText(input.excerpt) ?? existingItem?.excerpt,
      location:
        normalizeReviewItemObject(input.location) ?? existingItem?.location,
      risk_level: input.riskLevel ?? existingItem?.risk_level,
      suggestion:
        normalizeOptionalText(input.suggestion) ?? existingItem?.suggestion,
      rationale:
        normalizeOptionalText(input.rationale) ?? existingItem?.rationale,
      candidate_posture: input.candidatePosture ?? existingItem?.candidate_posture,
      decision_source:
        input.decisionSource ??
        existingItem?.decision_source ??
        "manual_feedback",
      evidence_pack:
        buildEvidencePack({
          location:
            normalizeReviewItemObject(input.evidencePack?.location) ??
            normalizeReviewItemObject(input.location) ??
            existingItem?.location,
          excerpt:
            normalizeOptionalText(input.evidencePack?.excerpt) ??
            normalizeOptionalText(input.excerpt) ??
            existingItem?.excerpt,
          suggestion:
            normalizeOptionalText(input.evidencePack?.suggestion) ??
            normalizeOptionalText(input.suggestion) ??
            existingItem?.suggestion,
          rationale:
            normalizeOptionalText(input.evidencePack?.rationale) ??
            normalizeOptionalText(input.rationale) ??
            existingItem?.rationale,
        }) ??
        cloneEvidencePack(existingItem?.evidence_pack),
      related_rule_ids:
        normalizeOptionalStringArray(input.relatedRuleIds) ??
        existingItem?.related_rule_ids,
      related_knowledge_item_ids: normalizeOptionalStringArray(
        input.relatedKnowledgeItemIds,
      ) ?? existingItem?.related_knowledge_item_ids,
      created_at: existingItem?.created_at ?? timestamp,
      updated_at: timestamp,
      available_actions: [],
      feedback_category: input.feedbackCategory,
      feedback_record_id: feedback.id,
      recommended_route: mapFeedbackCategoryToRoute(input.feedbackCategory),
      harness_validation_status: "not_required",
      created_by: existingItem?.created_by ?? input.createdBy,
      ...(existingItem?.learning_candidate_id
        ? {
            learning_candidate_id: existingItem.learning_candidate_id,
          }
        : {}),
      origin_payload: {
        ...(existingItem?.origin_payload ?? {}),
        ...(normalizeReviewItemObject(input.originPayload) ?? {}),
        feedbackCategory: input.feedbackCategory,
        manuscriptId: input.manuscriptId,
        module: input.module,
      },
    };

    await this.reviewItemsRepository.saveGovernedHit(item);
    return {
      feedback,
      item: mapGovernedHitToReviewItem(item),
    };
  }

  async recordExecutionGovernedHits(
    input: RecordExecutionGovernedHitsInput,
  ): Promise<RecordedExecutionGovernedHitResult[]> {
    const timestamp = this.now().toISOString();
    const results: RecordedExecutionGovernedHitResult[] = [];

    for (const executionHit of input.items) {
      const sourceKey = normalizeOptionalText(executionHit.sourceKey);
      if (!sourceKey) {
        continue;
      }

      const itemId = buildExecutionGovernedHitReviewItemId({
        module: input.module,
        snapshotId: input.snapshotId,
        sourceKey,
      });
      const existingItem = await this.reviewItemsRepository.findGovernedHitById(itemId);
      if (existingItem) {
        results.push({
          sourceKey,
          item: mapGovernedHitToReviewItem(existingItem),
        });
        continue;
      }

      const feedbackCategory = executionHit.feedbackCategory ?? "incorrect_hit";
      const item: GovernedHitReviewItemRecord = {
        id: itemId,
        source_kind: "governed_hit",
        source_status: "submitted",
        review_status: "pending",
        module: input.module,
        manuscript_id: input.manuscriptId,
        manuscript_type: input.manuscriptType,
        snapshot_id: input.snapshotId,
        source_asset_id: input.sourceAssetId,
        title:
          normalizeOptionalText(executionHit.title) ??
          buildGovernedHitTitle(feedbackCategory),
        summary:
          normalizeOptionalText(executionHit.summary) ??
          buildDefaultGovernedHitSummary(feedbackCategory, input.module),
        excerpt: normalizeOptionalText(executionHit.excerpt),
        location: normalizeReviewItemObject(executionHit.location),
        risk_level: executionHit.riskLevel,
        suggestion: normalizeOptionalText(executionHit.suggestion),
        rationale: normalizeOptionalText(executionHit.rationale),
        candidate_posture: executionHit.candidate_posture,
        decision_source: "execution_hit",
        evidence_pack:
          cloneEvidencePack(executionHit.evidence_pack) ??
          buildEvidencePack({
            location: normalizeReviewItemObject(executionHit.location),
            excerpt: normalizeOptionalText(executionHit.excerpt),
            suggestion: normalizeOptionalText(executionHit.suggestion),
            rationale: normalizeOptionalText(executionHit.rationale),
          }),
        related_rule_ids: normalizeOptionalStringArray(executionHit.relatedRuleIds),
        related_knowledge_item_ids: normalizeOptionalStringArray(
          executionHit.relatedKnowledgeItemIds,
        ),
        created_at: timestamp,
        updated_at: timestamp,
        available_actions: [],
        feedback_category: feedbackCategory,
        recommended_route:
          executionHit.recommendedRoute ??
          mapFeedbackCategoryToRoute(feedbackCategory),
        harness_validation_status: "not_required",
        created_by: input.createdBy,
        origin_payload: {
          ...(normalizeReviewItemObject(executionHit.originPayload) ?? {}),
          autoRecorded: true,
          executionSourceKey: sourceKey,
          feedbackCategory,
          manuscriptId: input.manuscriptId,
          module: input.module,
        },
      };

      await this.reviewItemsRepository.saveGovernedHit(item);
      await this.activationMetricsService?.recordGovernedHit(item.related_rule_ids);
      results.push({
        sourceKey,
        item: mapGovernedHitToReviewItem(item),
      });
    }

    return results;
  }

  async decideReviewItem(
    input: DecideReviewItemInput,
  ): Promise<ReviewItemDecisionResult> {
    switch (input.sourceKind) {
      case "governed_hit":
        return this.decideGovernedHit(input);
      case "residual_issue":
        return this.decideResidualIssue(input);
      case "learning_candidate":
        return this.decideLearningCandidate(input);
      default:
        throw new ReviewItemDecisionActionNotSupportedError(
          "unknown",
          (input as { action: string }).action,
        );
    }
  }

  private async decideGovernedHit(
    input: Extract<DecideReviewItemInput, { sourceKind: "governed_hit" }>,
  ): Promise<ReviewItemDecisionResult> {
    const item = await this.reviewItemsRepository.findGovernedHitById(input.id);
    if (!item) {
      throw new ReviewItemNotFoundError(input.sourceKind, input.id);
    }

    if (input.action === "route_to_rule_candidate" ||
      input.action === "route_to_knowledge_candidate" ||
      input.action === "route_to_prompt_candidate") {
      if (!input.requestedBy) {
        throw new ReviewItemDecisionInputInvalidError(
          "Routed review item decisions require requestedBy.",
        );
      }

      const itemWithFeedback = await this.ensureGovernedHitFeedbackRecord(
        item,
        input.requestedBy,
      );
      const candidate = await this.learningService.createHumanFeedbackGovernedLearningCandidate(
        {
          snapshotId: itemWithFeedback.snapshot_id,
          feedbackRecordId: itemWithFeedback.feedback_record_id ?? "",
          sourceAssetId: itemWithFeedback.source_asset_id ?? "",
          type: mapDecisionRouteToCandidateType(input.action),
          module: itemWithFeedback.module,
          manuscriptType: itemWithFeedback.manuscript_type,
          requestedBy: input.requestedBy,
          requestedByRole: input.requestedByRole,
          title: input.title ?? itemWithFeedback.title,
          proposalText:
            input.proposalText ??
            itemWithFeedback.summary ??
            itemWithFeedback.excerpt,
          candidatePayload: {
            ...(itemWithFeedback.origin_payload ?? {}),
            reviewItemId: itemWithFeedback.id,
            feedbackCategory: itemWithFeedback.feedback_category,
            sourceKind: itemWithFeedback.source_kind,
            ...(itemWithFeedback.candidate_posture
              ? { candidate_posture: itemWithFeedback.candidate_posture }
              : {}),
            ...(itemWithFeedback.decision_source
              ? { decision_source: itemWithFeedback.decision_source }
              : {}),
            ...(itemWithFeedback.evidence_pack
              ? { evidence_pack: cloneEvidencePack(itemWithFeedback.evidence_pack) }
              : {}),
            ...(itemWithFeedback.location ? { location: itemWithFeedback.location } : {}),
            ...(itemWithFeedback.excerpt ? { excerpt: itemWithFeedback.excerpt } : {}),
            ...(itemWithFeedback.suggestion
              ? { suggestion: itemWithFeedback.suggestion }
              : {}),
            ...(itemWithFeedback.rationale
              ? { rationale: itemWithFeedback.rationale }
              : {}),
            ...(itemWithFeedback.related_rule_ids
              ? { related_rule_ids: [...itemWithFeedback.related_rule_ids] }
              : {}),
            ...(itemWithFeedback.related_knowledge_item_ids
              ? {
                  related_knowledge_item_ids: [
                    ...itemWithFeedback.related_knowledge_item_ids,
                  ],
                }
              : {}),
          },
        },
      );
      await this.activationMetricsService?.recordGovernedDecision(
        itemWithFeedback.related_rule_ids,
        input.action,
      );

      const routedItem: GovernedHitReviewItemRecord = {
        ...itemWithFeedback,
        source_status:
          input.action === "route_to_rule_candidate"
            ? "routed_rule_candidate"
            : input.action === "route_to_knowledge_candidate"
              ? "routed_knowledge_candidate"
              : "routed_prompt_candidate",
        review_status: "routed",
        learning_candidate_id: candidate.id,
        updated_at: this.now().toISOString(),
      };
      await this.reviewItemsRepository.saveGovernedHit(routedItem);

      return {
        action: input.action,
        item: mapLearningCandidateToReviewItem(candidate),
      };
    }

    const nextStatus =
      input.action === "accept_change_only"
        ? "accepted_change_only"
        : input.action === "reject_as_false_positive"
          ? "rejected_as_false_positive"
          : input.action === "archive_as_evidence_only"
            ? "archived_as_evidence_only"
            : null;
    if (!nextStatus) {
      throw new ReviewItemDecisionActionNotSupportedError(
        input.sourceKind,
        input.action,
      );
    }

    const decidedItem: GovernedHitReviewItemRecord = {
      ...item,
      source_status: nextStatus,
      review_status: "decided",
      updated_at: this.now().toISOString(),
    };
    await this.reviewItemsRepository.saveGovernedHit(decidedItem);
    await this.activationMetricsService?.recordGovernedDecision(
      decidedItem.related_rule_ids,
      input.action,
    );

    return {
      action: input.action,
      item: mapGovernedHitToReviewItem(decidedItem),
    };
  }

  private async ensureGovernedHitFeedbackRecord(
    item: GovernedHitReviewItemRecord,
    requestedBy: string,
  ): Promise<GovernedHitReviewItemRecord> {
    if (item.feedback_record_id) {
      return item;
    }

    if (!this.feedbackGovernanceService) {
      throw new ReviewItemsServiceDependencyRequiredError(
        "feedbackGovernanceService",
      );
    }

    if (!item.manuscript_id) {
      throw new ReviewItemDecisionInputInvalidError(
        "Auto-recorded governed hits require manuscript_id before routing.",
      );
    }

    const feedback = await this.feedbackGovernanceService.recordHumanFeedback({
      manuscriptId: item.manuscript_id,
      module: item.module,
      snapshotId: item.snapshot_id,
      feedbackType: mapManualFeedbackCategoryToFeedbackType(
        item.feedback_category,
      ),
      feedbackText: normalizeOptionalText(
        item.summary ?? item.excerpt ?? item.rationale,
      ),
      createdBy: requestedBy,
    });

    const updatedItem: GovernedHitReviewItemRecord = {
      ...item,
      feedback_record_id: feedback.id,
      updated_at: this.now().toISOString(),
    };
    await this.reviewItemsRepository.saveGovernedHit(updatedItem);
    return updatedItem;
  }

  private async decideResidualIssue(
    input: Extract<DecideReviewItemInput, { sourceKind: "residual_issue" }>,
  ): Promise<ReviewItemDecisionResult> {
    if (!this.residualReviewCoordinator) {
      throw new ReviewItemsServiceDependencyRequiredError(
        "residualReviewCoordinator",
      );
    }

    if (input.action === "validate") {
      if (!input.actorRole || !input.suiteIds) {
        throw new ReviewItemDecisionInputInvalidError(
          "Residual validation requires actorRole and suiteIds.",
        );
      }

      const response = await this.residualReviewCoordinator.validateIssue({
        issueId: input.id,
        actorRole: input.actorRole,
        suiteIds: input.suiteIds,
        releaseCheckProfileId: input.releaseCheckProfileId,
      });

      return {
        action: input.action,
        item: mapResidualIssueToReviewItem(response.issue),
      };
    }

    if (
      input.action === "route_to_rule_candidate" ||
      input.action === "route_to_knowledge_candidate" ||
      input.action === "route_to_prompt_candidate"
    ) {
      if (!input.requestedBy) {
        throw new ReviewItemDecisionInputInvalidError(
          "Routed review item decisions require requestedBy.",
        );
      }

      const candidate = await this.residualReviewCoordinator.createLearningCandidate({
        issueId: input.id,
        requestedBy: input.requestedBy,
        requestedByRole: input.requestedByRole,
        title: input.title,
        proposalText: input.proposalText,
        route: mapDecisionActionToRoute(input.action),
      });

      return {
        action: input.action,
        item: mapLearningCandidateToReviewItem(candidate),
      };
    }

    const resolution =
      input.action === "accept_change_only"
        ? "manual_only"
        : input.action === "reject_as_false_positive"
          ? "archived"
          : input.action === "archive_as_evidence_only"
            ? "evidence_only"
            : null;
    if (!resolution) {
      throw new ReviewItemDecisionActionNotSupportedError(
        input.sourceKind,
        input.action,
      );
    }

    const issue = await this.residualReviewCoordinator.resolveIssueDecision({
      issueId: input.id,
      resolution,
    });
    return {
      action: input.action,
      item: mapResidualIssueToReviewItem(issue),
    };
  }

  private async decideLearningCandidate(
    input: Extract<DecideReviewItemInput, { sourceKind: "learning_candidate" }>,
  ): Promise<ReviewItemDecisionResult> {
    const candidate =
      input.action === "approve"
        ? await this.learningService.approveLearningCandidate(
            input.id,
            input.actorRole,
            input.reviewNote,
          )
        : input.action === "reject"
          ? await this.learningService.rejectLearningCandidate(
              input.id,
              input.actorRole,
              input.reviewNote,
            )
          : null;
    if (!candidate) {
      throw new ReviewItemDecisionActionNotSupportedError(
        input.sourceKind,
        input.action,
      );
    }

    return {
      action: input.action,
      item: mapLearningCandidateToReviewItem(candidate),
    };
  }
}

function matchesReviewItemsFilter(
  item: ReviewItemRecord,
  input: ListReviewItemsInput,
): boolean {
  if (input.sourceKind && item.source_kind !== input.sourceKind) {
    return false;
  }

  if (input.module && item.module !== input.module) {
    return false;
  }

  if (input.manuscriptId && item.manuscript_id !== input.manuscriptId) {
    return false;
  }

  if (input.reviewStatus && item.review_status !== input.reviewStatus) {
    return false;
  }

  if (input.riskLevel && item.risk_level !== input.riskLevel) {
    return false;
  }

  return true;
}

function mapManualFeedbackCategoryToFeedbackType(
  category: GovernedHitFeedbackCategory,
): "manual_confirmation" | "manual_correction" | "manual_rejection" {
  switch (category) {
    case "incorrect_hit":
      return "manual_correction";
    case "missed_hit":
    case "missing_knowledge":
      return "manual_rejection";
  }
}

function mapFeedbackCategoryToRoute(
  category: GovernedHitFeedbackCategory,
): GovernedHitReviewItemRecord["recommended_route"] {
  return category === "missing_knowledge"
    ? "knowledge_candidate"
    : "rule_candidate";
}

function buildGovernedHitTitle(category: GovernedHitFeedbackCategory): string {
  switch (category) {
    case "missed_hit":
      return "Submit missed governed hit for review";
    case "incorrect_hit":
      return "Submit incorrect governed hit for review";
    case "missing_knowledge":
      return "Submit missing knowledge for review";
  }
}

function buildDefaultGovernedHitSummary(
  category: GovernedHitFeedbackCategory,
  module: SubmitGovernedHitInput["module"],
): string {
  switch (category) {
    case "missed_hit":
      return `The ${module} output missed a governed hit that should enter review.`;
    case "incorrect_hit":
      return `The ${module} output raised a governed hit that should be corrected.`;
    case "missing_knowledge":
      return `The ${module} output still lacks the governed knowledge basis.`;
  }
}

function mapDecisionRouteToCandidateType(
  action:
    | "route_to_rule_candidate"
    | "route_to_knowledge_candidate"
    | "route_to_prompt_candidate",
): LearningCandidateType {
  switch (action) {
    case "route_to_rule_candidate":
      return "rule_candidate";
    case "route_to_knowledge_candidate":
      return "knowledge_candidate";
    case "route_to_prompt_candidate":
      return "prompt_optimization_candidate";
  }
}

function mapDecisionActionToRoute(
  action:
    | "route_to_rule_candidate"
    | "route_to_knowledge_candidate"
    | "route_to_prompt_candidate",
): "rule_candidate" | "knowledge_candidate" | "prompt_template_candidate" {
  switch (action) {
    case "route_to_rule_candidate":
      return "rule_candidate";
    case "route_to_knowledge_candidate":
      return "knowledge_candidate";
    case "route_to_prompt_candidate":
      return "prompt_template_candidate";
  }
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeOptionalStringArray(
  value: readonly string[] | undefined,
): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = [...new Set(
    value
      .map((item) => normalizeOptionalText(item))
      .filter((item): item is string => Boolean(item)),
  )];

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeReviewItemObject(
  value: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value;
}

function buildEvidencePack(input: {
  location?: Record<string, unknown>;
  excerpt?: string;
  suggestion?: string;
  rationale?: string;
}): GovernedHitReviewItemRecord["evidence_pack"] | undefined {
  const evidencePack = {
    ...(input.location ? { location: normalizeReviewItemObject(input.location) } : {}),
    ...(normalizeOptionalText(input.excerpt)
      ? { excerpt: normalizeOptionalText(input.excerpt) }
      : {}),
    ...(normalizeOptionalText(input.suggestion)
      ? { suggestion: normalizeOptionalText(input.suggestion) }
      : {}),
    ...(normalizeOptionalText(input.rationale)
      ? { rationale: normalizeOptionalText(input.rationale) }
      : {}),
  };

  return Object.keys(evidencePack).length > 0 ? evidencePack : undefined;
}

function cloneEvidencePack(
  evidencePack: GovernedHitReviewItemRecord["evidence_pack"] | undefined,
): GovernedHitReviewItemRecord["evidence_pack"] | undefined {
  if (!evidencePack) {
    return undefined;
  }

  return {
    ...(evidencePack.location
      ? {
          location: normalizeReviewItemObject(evidencePack.location),
        }
      : {}),
    ...(typeof evidencePack.excerpt === "string"
      ? { excerpt: evidencePack.excerpt }
      : {}),
    ...(typeof evidencePack.suggestion === "string"
      ? { suggestion: evidencePack.suggestion }
      : {}),
    ...(typeof evidencePack.rationale === "string"
      ? { rationale: evidencePack.rationale }
      : {}),
  };
}

function buildExecutionGovernedHitReviewItemId(input: {
  module: "screening" | "editing" | "proofreading";
  snapshotId: string;
  sourceKey: string;
}): string {
  const digest = createHash("sha256")
    .update(`${input.module}:${input.snapshotId}:${input.sourceKey}`)
    .digest("hex")
    .slice(0, 20);
  return `governed-hit:${input.module}:${input.snapshotId}:${digest}`;
}
