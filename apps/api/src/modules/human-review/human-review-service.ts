import { randomUUID } from "node:crypto";
import type {
  HumanReviewContentDecision,
  HumanReviewGovernanceIntent,
} from "@medical/contracts";
import type { DocumentAssetRecord } from "../assets/document-asset-record.ts";
import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";
import type { DocumentAssetService } from "../assets/document-asset-service.ts";
import type { ApplyDeterministicDocxRulesInput } from "../editorial-execution/types.ts";
import type { JobRecord } from "../jobs/job-record.ts";
import type { JobRepository } from "../jobs/job-repository.ts";
import type { ManuscriptRepository } from "../manuscripts/manuscript-repository.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { EditorialDocxTransformService } from "../document-pipeline/editorial-docx-transform-service.ts";
import type { ReviewItemsService } from "../review-items/review-items-service.ts";
import type {
  HumanReviewBackflowAttemptRecord,
  HumanReviewBackflowTarget,
  HumanReviewDiffRecord,
} from "./human-review-record.ts";
import type {
  HumanReviewDiffItemPatch,
  HumanReviewRepository,
} from "./human-review-repository.ts";

const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type HumanReviewPublishModule = "proofreading" | "editing";

export interface HumanReviewServiceOptions {
  repository: HumanReviewRepository;
  manuscriptRepository: ManuscriptRepository;
  assetRepository: DocumentAssetRepository;
  jobRepository: JobRepository;
  documentAssetService: DocumentAssetService;
  editorialDocxTransformService: Pick<
    EditorialDocxTransformService,
    "applyDeterministicRules"
  >;
  reviewItemsService?: Pick<
    ReviewItemsService,
    "submitGovernedHit" | "decideReviewItem"
  >;
  createId?: () => string;
  now?: () => Date;
}

export interface ListHumanReviewDiffItemsInput {
  manuscriptId: string;
  module: HumanReviewPublishModule;
}

export interface UpdateHumanReviewDiffDecisionInput {
  diffItemId: string;
  contentDecision: HumanReviewContentDecision;
  governanceIntents?: HumanReviewGovernanceIntent;
  note?: string;
  updatedAt?: string;
}

export interface BatchUpdateHumanReviewDiffDecisionsInput {
  updates: readonly UpdateHumanReviewDiffDecisionInput[];
}

export interface HumanReviewPublishPreflightInput {
  manuscriptId: string;
  module: HumanReviewPublishModule;
}

export interface HumanReviewPublishPreflightResult {
  can_publish: boolean;
  blocking_reasons: string[];
  summary: {
    total_count: number;
    unconfirmed_count: number;
    deferred_count: number;
    unsafe_count: number;
    kept_count: number;
    rejected_count: number;
  };
}

export interface PublishHumanReviewFinalInput
  extends HumanReviewPublishPreflightInput {
  requestedBy?: string;
  actorRole?: RoleKey;
  outputStorageKey?: string;
  outputFileName?: string;
  proofreadingConfirmationDecisions?: readonly HumanReviewProofreadingConfirmationDecisionInput[];
  proofreadingConfirmationItemCount?: number;
}

export interface HumanReviewBackflowResult {
  attempts: HumanReviewBackflowAttemptRecord[];
  summary: {
    attempted_count: number;
    succeeded_count: number;
    failed_count: number;
  };
}

export interface PublishHumanReviewFinalResult {
  job: JobRecord;
  asset: DocumentAssetRecord;
  preflight: HumanReviewPublishPreflightResult;
  backflow: HumanReviewBackflowResult;
}

export interface RetryHumanReviewBackflowInput {
  diffItemId: string;
  requestedBy?: string;
  actorRole?: RoleKey;
}

export class HumanReviewDiffItemNotFoundError extends Error {
  constructor(diffItemId: string) {
    super(`Human review diff item ${diffItemId} was not found.`);
    this.name = "HumanReviewDiffItemNotFoundError";
  }
}

export class HumanReviewPublishGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HumanReviewPublishGateError";
  }
}

export type HumanReviewProofreadingConfirmationDecisionAction =
  | "accepted"
  | "accepted_with_manual_edit"
  | "rejected"
  | "accept"
  | "accept_and_edit"
  | "reject"
  | "manual_only"
  | "escalated"
  | "route_to_rule_candidate"
  | "route_to_knowledge_candidate";

export interface HumanReviewProofreadingConfirmationDecisionInput {
  itemId: string;
  targetText: string;
  replacementText: string;
  action: HumanReviewProofreadingConfirmationDecisionAction;
  finalReplacementText?: string;
  editedReplacementText?: string;
  routeToRuleCandidate?: boolean;
  routeToKnowledgeCandidate?: boolean;
  blocksFinal?: boolean;
  severity?: "critical" | "high" | "medium" | "low";
  note?: string;
}

interface ProofreadingConfirmationBackflowAttempt {
  itemId: string;
  target: HumanReviewBackflowTarget;
  status: "succeeded" | "failed";
  learningCandidateId?: string;
  errorMessage?: string;
}

interface ProofreadingConfirmationBackflowResult {
  attempts: ProofreadingConfirmationBackflowAttempt[];
  summary: HumanReviewBackflowResult["summary"];
}

interface ProofreadingConfirmationGateItem {
  itemId: string;
  blocksFinal: boolean;
  severity?: "critical" | "high" | "medium" | "low";
}

export class HumanReviewService {
  private readonly repository: HumanReviewRepository;
  private readonly manuscriptRepository: ManuscriptRepository;
  private readonly assetRepository: DocumentAssetRepository;
  private readonly jobRepository: JobRepository;
  private readonly documentAssetService: DocumentAssetService;
  private readonly editorialDocxTransformService: Pick<
    EditorialDocxTransformService,
    "applyDeterministicRules"
  >;
  private readonly reviewItemsService?: Pick<
    ReviewItemsService,
    "submitGovernedHit" | "decideReviewItem"
  >;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: HumanReviewServiceOptions) {
    this.repository = options.repository;
    this.manuscriptRepository = options.manuscriptRepository;
    this.assetRepository = options.assetRepository;
    this.jobRepository = options.jobRepository;
    this.documentAssetService = options.documentAssetService;
    this.editorialDocxTransformService = options.editorialDocxTransformService;
    this.reviewItemsService = options.reviewItemsService;
    this.createId = options.createId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  listDiffItems(
    input: ListHumanReviewDiffItemsInput,
  ): Promise<HumanReviewDiffRecord[]> {
    return this.repository.listDiffItems({
      manuscriptId: input.manuscriptId,
      module: input.module,
    });
  }

  async updateDiffDecision(
    input: UpdateHumanReviewDiffDecisionInput,
  ): Promise<HumanReviewDiffRecord> {
    const current = await this.repository.findDiffItemById(input.diffItemId);
    if (!current) {
      throw new HumanReviewDiffItemNotFoundError(input.diffItemId);
    }

    const updatedAt = input.updatedAt ?? this.now().toISOString();
    const patch: HumanReviewDiffItemPatch = {
      content_decision: input.contentDecision,
      status: resolveStatusForDecision(current, input.contentDecision),
      updated_at: updatedAt,
      ...(input.governanceIntents
        ? { governance_intents: input.governanceIntents }
        : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
    };
    const updated = await this.repository.updateDiffItem(input.diffItemId, patch);
    if (!updated) {
      throw new HumanReviewDiffItemNotFoundError(input.diffItemId);
    }

    return updated;
  }

  async batchUpdateDiffDecisions(
    input: BatchUpdateHumanReviewDiffDecisionsInput,
  ): Promise<HumanReviewDiffRecord[]> {
    const updated: HumanReviewDiffRecord[] = [];
    for (const entry of input.updates) {
      updated.push(await this.updateDiffDecision(entry));
    }

    return updated;
  }

  async preflightPublish(
    input: HumanReviewPublishPreflightInput,
  ): Promise<HumanReviewPublishPreflightResult> {
    const items = await this.listDiffItems(input);
    return buildPublishPreflight(items);
  }

  async publishConfirmedFinal(
    input: PublishHumanReviewFinalInput,
  ): Promise<PublishHumanReviewFinalResult> {
    const items = await this.listDiffItems(input);
    const preflight = buildPublishPreflight(items);
    assertPublishable(preflight);
    const firstItem = items[0];
    if (!firstItem) {
      throw new HumanReviewPublishGateError(
        "No human review differences were available to publish.",
      );
    }
    const expectedProofreadingConfirmationItems =
      await this.resolveExpectedProofreadingConfirmationItems(input.module, firstItem);
    assertPublishableProofreadingConfirmationDecisions(
      input.proofreadingConfirmationDecisions,
      {
        expectedItems: expectedProofreadingConfirmationItems,
        fallbackExpectedItemCount: input.proofreadingConfirmationItemCount,
      },
    );

    const timestamp = this.now().toISOString();
    const jobId = this.createId();
    const requestedBy = input.requestedBy ?? "human-review";
    const baselineAssetId = firstItem.baseline_asset_id;
    const outputStorageKey =
      input.outputStorageKey ??
      createHumanReviewFinalStorageKey({
        manuscriptId: input.manuscriptId,
        module: input.module,
        timestamp,
      });
    const outputFileName =
      input.outputFileName ?? `${input.module}-human-review-final.docx`;

    await this.editorialDocxTransformService.applyDeterministicRules({
      manuscriptId: input.manuscriptId,
      sourceAssetId: baselineAssetId,
      outputStorageKey,
      outputFileName,
      tableAutoApplyMode: "editing_safe_apply",
      rules: [],
      resolvedRules: [],
      tableSnapshots: [],
      aiReplacements: [
        ...buildProofreadingConfirmationTextReplacements(
          input.proofreadingConfirmationDecisions,
        ),
        ...buildKeptTextReplacements(items),
      ],
    });

    const job: JobRecord = {
      id: jobId,
      manuscript_id: input.manuscriptId,
      module: input.module,
      job_type: "human_review_publish_final",
      status: "completed",
      requested_by: requestedBy,
      payload: {
        source: "human_review_publish",
        module: input.module,
        baselineAssetId,
        workingAssetId: firstItem.working_asset_id,
        diffItemIds: items.map((item) => item.id),
        keptDiffItemIds: items
          .filter((item) => item.content_decision === "keep")
          .map((item) => item.id),
        rejectedDiffItemIds: items
          .filter((item) => item.content_decision === "reject")
          .map((item) => item.id),
        ...(input.proofreadingConfirmationDecisions
          ? {
              proofreadingConfirmationDecisionIds:
                input.proofreadingConfirmationDecisions.map(
                  (decision) => decision.itemId,
                ),
              proofreadingConfirmationGovernanceIntents:
                buildProofreadingConfirmationGovernanceIntents(
                  input.proofreadingConfirmationDecisions,
                ),
            }
          : {}),
        outputStorageKey,
      },
      attempt_count: 1,
      started_at: timestamp,
      finished_at: timestamp,
      created_at: timestamp,
      updated_at: timestamp,
    };
    await this.jobRepository.save(job);

    const asset = await this.documentAssetService.createAsset({
      manuscriptId: input.manuscriptId,
      assetType: resolveHumanReviewFinalAssetType(input.module),
      storageKey: outputStorageKey,
      mimeType: DOCX_MIME_TYPE,
      createdBy: requestedBy,
      fileName: outputFileName,
      parentAssetId: baselineAssetId,
      sourceModule: resolveHumanReviewFinalSourceModule(input.module),
      sourceJobId: jobId,
    });
    const proofreadingConfirmationBackflow =
      await this.runProofreadingConfirmationBackflow({
        decisions: input.proofreadingConfirmationDecisions ?? [],
        module: input.module,
        manuscriptId: input.manuscriptId,
        finalAsset: asset,
        requestedBy,
        actorRole: input.actorRole,
        timestamp,
      });

    const completedJob = {
      ...job,
      payload: {
        ...job.payload,
        outputAssetId: asset.id,
        outputAssetType: asset.asset_type,
        ...(proofreadingConfirmationBackflow.attempts.length > 0
          ? {
              proofreadingConfirmationBackflow:
                proofreadingConfirmationBackflow.summary,
            }
          : {}),
      },
    };
    await this.jobRepository.save(completedJob);
    await markDiffItemsPublished({
      repository: this.repository,
      items,
      finalAssetId: asset.id,
      updatedAt: timestamp,
    });
    const backflow = await this.runBackflow({
      items,
      finalAsset: asset,
      requestedBy,
      actorRole: input.actorRole,
      timestamp,
      targets: "all",
    });
    const combinedBackflow = combineBackflowSummaries(
      backflow,
      proofreadingConfirmationBackflow,
    );

    return {
      job: completedJob,
      asset,
      preflight,
      backflow: combinedBackflow,
    };
  }

  async retryBackflow(
    input: RetryHumanReviewBackflowInput,
  ): Promise<HumanReviewBackflowResult> {
    const item = await this.repository.findDiffItemById(input.diffItemId);
    if (!item) {
      throw new HumanReviewDiffItemNotFoundError(input.diffItemId);
    }
    if (!item.final_asset_id) {
      throw new HumanReviewPublishGateError(
        "Human review backflow can only be retried after final publish.",
      );
    }

    const finalAsset = await this.assetRepository.findById(item.final_asset_id);
    if (!finalAsset) {
      throw new HumanReviewPublishGateError(
        "Human review final asset was not found for backflow retry.",
      );
    }

    const failedAttempts = (
      await this.repository.listBackflowAttemptsByDiffItemId(item.id)
    ).filter((attempt) => attempt.status === "failed");
    return this.runBackflow({
      items: [item],
      finalAsset,
      requestedBy: input.requestedBy ?? "human-review",
      actorRole: input.actorRole,
      timestamp: this.now().toISOString(),
      targets: failedAttempts.map((attempt) => attempt.target),
    });
  }

  private async runBackflow(input: {
    items: readonly HumanReviewDiffRecord[];
    finalAsset: DocumentAssetRecord;
    requestedBy: string;
    actorRole?: RoleKey;
    timestamp: string;
    targets: "all" | readonly HumanReviewBackflowTarget[];
  }): Promise<HumanReviewBackflowResult> {
    const attempts: HumanReviewBackflowAttemptRecord[] = [];
    for (const item of input.items) {
      for (const target of resolveBackflowTargets(item, input.targets)) {
        attempts.push(
          await this.runBackflowTarget({
            item,
            target,
            finalAsset: input.finalAsset,
            requestedBy: input.requestedBy,
            actorRole: input.actorRole,
            timestamp: input.timestamp,
          }),
        );
      }
    }

    return {
      attempts,
      summary: {
        attempted_count: attempts.length,
        succeeded_count: attempts.filter((attempt) => attempt.status === "succeeded")
          .length,
        failed_count: attempts.filter((attempt) => attempt.status === "failed")
          .length,
      },
    };
  }

  private async runBackflowTarget(input: {
    item: HumanReviewDiffRecord;
    target: HumanReviewBackflowTarget;
    finalAsset: DocumentAssetRecord;
    requestedBy: string;
    actorRole?: RoleKey;
    timestamp: string;
  }): Promise<HumanReviewBackflowAttemptRecord> {
    const attemptBase = {
      id: randomUUID(),
      diff_item_id: input.item.id,
      target: input.target,
      created_at: input.timestamp,
    };

    try {
      if (!this.reviewItemsService) {
        throw new Error("human review candidate backflow service is not configured");
      }

      const manuscript = await this.manuscriptRepository.findById(
        input.item.manuscript_id,
      );
      if (!manuscript) {
        throw new Error(`manuscript ${input.item.manuscript_id} was not found`);
      }

      const governedHit = await this.reviewItemsService.submitGovernedHit({
        manuscriptId: input.item.manuscript_id,
        manuscriptType: manuscript.manuscript_type,
        module: normalizeBackflowModule(input.item.module),
        snapshotId: `human-review:${input.finalAsset.id}`,
        sourceAssetId: input.finalAsset.id,
        feedbackCategory:
          input.target === "knowledge_candidate"
            ? "missing_knowledge"
            : "missed_hit",
        feedbackText:
          input.item.note ??
          input.item.summary ??
          `Human review diff ${input.item.id} requested ${input.target}.`,
        title: `Human review ${input.target} ${input.item.id}`,
        excerpt: input.item.before_text,
        suggestion: input.item.after_text,
        rationale: `Confirmed after human review final asset ${input.finalAsset.id}.`,
        candidatePosture: "candidate_change",
        decisionSource: "manual_feedback",
        originPayload: {
          source: "human_review_diff",
          diffItemId: input.item.id,
          finalAssetId: input.finalAsset.id,
          target: input.target,
        },
        createdBy: input.requestedBy,
      });

      const decision = await this.reviewItemsService.decideReviewItem({
        sourceKind: "governed_hit",
        id: governedHit.item.id,
        action:
          input.target === "knowledge_candidate"
            ? "route_to_knowledge_candidate"
            : "route_to_rule_candidate",
        requestedBy: input.requestedBy,
        requestedByRole: input.actorRole,
        title: `Human review ${input.target} ${input.item.id}`,
        proposalText:
          input.item.after_text ?? input.item.summary ?? input.item.before_text,
      });
      const learningCandidateId = decision.item?.id;
      if (!learningCandidateId) {
        throw new Error("human review candidate backflow did not return a candidate id");
      }

      const attempt: HumanReviewBackflowAttemptRecord = {
        ...attemptBase,
        status: "succeeded",
        learning_candidate_id: learningCandidateId,
        updated_at: this.now().toISOString(),
      };
      await this.repository.saveBackflowAttempt(attempt);
      return attempt;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "human review backflow failed";
      const attempt: HumanReviewBackflowAttemptRecord = {
        ...attemptBase,
        status: "failed",
        error_message: message,
        updated_at: this.now().toISOString(),
      };
      await this.repository.saveBackflowAttempt(attempt);
      await this.repository.updateDiffItem(input.item.id, {
        status: "writeback_failed",
        backflow_error: message,
        updated_at: attempt.updated_at,
      });
      return attempt;
    }
  }

  private async runProofreadingConfirmationBackflow(input: {
    decisions: readonly HumanReviewProofreadingConfirmationDecisionInput[];
    module: HumanReviewPublishModule;
    manuscriptId: string;
    finalAsset: DocumentAssetRecord;
    requestedBy: string;
    actorRole?: RoleKey;
    timestamp: string;
  }): Promise<ProofreadingConfirmationBackflowResult> {
    const attempts: ProofreadingConfirmationBackflowAttempt[] = [];

    if (input.module !== "proofreading") {
      return summarizeProofreadingConfirmationBackflow(attempts);
    }

    for (const decision of input.decisions) {
      for (const target of buildProofreadingConfirmationBackflowTargets(decision)) {
        attempts.push(
          await this.runProofreadingConfirmationBackflowTarget({
            decision,
            target,
            finalAsset: input.finalAsset,
            manuscriptId: input.manuscriptId,
            requestedBy: input.requestedBy,
            actorRole: input.actorRole,
          }),
        );
      }
    }

    return summarizeProofreadingConfirmationBackflow(attempts);
  }

  private async runProofreadingConfirmationBackflowTarget(input: {
    decision: HumanReviewProofreadingConfirmationDecisionInput;
    target: HumanReviewBackflowTarget;
    finalAsset: DocumentAssetRecord;
    manuscriptId: string;
    requestedBy: string;
    actorRole?: RoleKey;
  }): Promise<ProofreadingConfirmationBackflowAttempt> {
    try {
      if (!this.reviewItemsService) {
        throw new Error(
          "proofreading confirmation candidate backflow service is not configured",
        );
      }

      const manuscript = await this.manuscriptRepository.findById(input.manuscriptId);
      if (!manuscript) {
        throw new Error(`manuscript ${input.manuscriptId} was not found`);
      }

      const replacementText = resolveProofreadingConfirmationReplacementText(
        input.decision,
      );
      const routeAction =
        input.target === "knowledge_candidate"
          ? "route_to_knowledge_candidate"
          : "route_to_rule_candidate";
      const governedHit = await this.reviewItemsService.submitGovernedHit({
        manuscriptId: input.manuscriptId,
        manuscriptType: manuscript.manuscript_type,
        module: "proofreading",
        snapshotId: `human-review:${input.finalAsset.id}`,
        sourceAssetId: input.finalAsset.id,
        feedbackCategory:
          input.target === "knowledge_candidate"
            ? "missing_knowledge"
            : "missed_hit",
        feedbackText:
          input.decision.note ??
          `Human confirmed proofreading issue for ${input.decision.targetText}.`,
        title: `Proofreading confirmation ${input.decision.itemId}`,
        excerpt: input.decision.targetText,
        suggestion: replacementText,
        rationale: `Confirmed after human review final asset ${input.finalAsset.id}.`,
        candidatePosture: "candidate_change",
        decisionSource: "manual_feedback",
        originPayload: {
          source: "proofreading_confirmation",
          itemId: input.decision.itemId,
          finalAssetId: input.finalAsset.id,
          action: input.decision.action,
          routeAction,
        },
        createdBy: input.requestedBy,
      });

      const decision = await this.reviewItemsService.decideReviewItem({
        sourceKind: "governed_hit",
        id: governedHit.item.id,
        action: routeAction,
        requestedBy: input.requestedBy,
        requestedByRole: input.actorRole,
        title: governedHit.item.title,
        proposalText: replacementText,
      });
      const learningCandidateId = decision.item?.id;
      if (!learningCandidateId) {
        throw new Error(
          "proofreading confirmation candidate backflow did not return a candidate id",
        );
      }

      return {
        itemId: input.decision.itemId,
        target: input.target,
        status: "succeeded",
        learningCandidateId,
      };
    } catch (error) {
      return {
        itemId: input.decision.itemId,
        target: input.target,
        status: "failed",
        errorMessage:
          error instanceof Error
            ? error.message
            : "proofreading confirmation backflow failed",
      };
    }
  }

  private async resolveExpectedProofreadingConfirmationItems(
    module: HumanReviewPublishModule,
    firstItem: HumanReviewDiffRecord,
  ): Promise<ProofreadingConfirmationGateItem[]> {
    if (module !== "proofreading") {
      return [];
    }

    const baselineAsset = await this.assetRepository.findById(
      firstItem.baseline_asset_id,
    );
    if (!baselineAsset?.source_job_id) {
      return [];
    }

    const sourceJob = await this.jobRepository.findById(baselineAsset.source_job_id);
    return buildProofreadingConfirmationGateItems(sourceJob?.payload);
  }
}

function resolveStatusForDecision(
  item: HumanReviewDiffRecord,
  decision: HumanReviewContentDecision,
): HumanReviewDiffRecord["status"] {
  if (decision === "unconfirmed" || decision === "defer") {
    return "pending";
  }

  if (item.apply_capability === "unsafe_needs_manual_review") {
    return "blocks_publish";
  }

  return "confirmed";
}

function buildPublishPreflight(
  items: readonly HumanReviewDiffRecord[],
): HumanReviewPublishPreflightResult {
  const unconfirmedCount = items.filter(
    (item) => item.content_decision === "unconfirmed",
  ).length;
  const deferredCount = items.filter(
    (item) => item.content_decision === "defer",
  ).length;
  const unsafeCount = items.filter(
    (item) =>
      item.apply_capability === "unsafe_needs_manual_review" ||
      item.status === "blocks_publish",
  ).length;
  const unsafeMaterializationCount = items.filter(
    (item) =>
      item.content_decision === "keep" &&
      !canV1MaterializeKeptDiffItem(item),
  ).length;
  const blockingReasons: string[] = [];

  if (unconfirmedCount > 0 || deferredCount > 0) {
    blockingReasons.push("all human review differences must be confirmed");
  }
  if (unsafeCount > 0) {
    blockingReasons.push("unsafe human review differences require manual review");
  }
  if (unsafeMaterializationCount > 0) {
    blockingReasons.push(
      "kept human review differences cannot be safely written to the final manuscript",
    );
  }
  if (!shareSameAssetLineage(items)) {
    blockingReasons.push("human review differences must share one baseline and working asset");
  }

  return {
    can_publish: blockingReasons.length === 0,
    blocking_reasons: blockingReasons,
    summary: {
      total_count: items.length,
      unconfirmed_count: unconfirmedCount,
      deferred_count: deferredCount,
      unsafe_count: unsafeCount,
      kept_count: items.filter((item) => item.content_decision === "keep").length,
      rejected_count: items.filter((item) => item.content_decision === "reject")
        .length,
    },
  };
}

function canV1MaterializeKeptDiffItem(item: HumanReviewDiffRecord): boolean {
  return (
    item.apply_capability === "auto_apply_revert" &&
    Boolean(item.before_text?.trim()) &&
    Boolean(item.after_text?.trim())
  );
}

function assertPublishable(preflight: HumanReviewPublishPreflightResult): void {
  if (preflight.can_publish) {
    return;
  }

  throw new HumanReviewPublishGateError(preflight.blocking_reasons.join("; "));
}

function assertPublishableProofreadingConfirmationDecisions(
  decisions: readonly HumanReviewProofreadingConfirmationDecisionInput[] | undefined,
  options: {
    expectedItems: readonly ProofreadingConfirmationGateItem[];
    fallbackExpectedItemCount: number | undefined;
  },
): void {
  const decisionsByItemId = new Map(
    (decisions ?? []).map((decision) => [decision.itemId, decision]),
  );
  const confirmedItemIds = new Set(decisionsByItemId.keys());

  if (options.expectedItems.length > 0) {
    const missingItem = options.expectedItems.find(
      (item) => !confirmedItemIds.has(item.itemId),
    );
    if (missingItem) {
      throw new HumanReviewPublishGateError(
        "AI proofreading issues must all be confirmed before publication.",
      );
    }
  } else {
    const expectedItemCount = options.fallbackExpectedItemCount;
    if (expectedItemCount !== undefined) {
      if (!Number.isInteger(expectedItemCount) || expectedItemCount < 0) {
        throw new HumanReviewPublishGateError(
          "AI proofreading confirmation item count is invalid.",
        );
      }

      if (confirmedItemIds.size < expectedItemCount) {
        throw new HumanReviewPublishGateError(
          "AI proofreading issues must all be confirmed before publication.",
        );
      }
    }
  }

  const decisionsWithServerRiskMetadata =
    options.expectedItems.length > 0
      ? options.expectedItems.flatMap((item) => {
          const decision = decisionsByItemId.get(item.itemId);
          if (!decision) {
            return [];
          }

          return [
            {
              ...decision,
              blocksFinal: item.blocksFinal || decision.blocksFinal === true,
              severity: item.severity ?? decision.severity,
            },
          ];
        })
      : (decisions ?? []);

  for (const decision of decisionsWithServerRiskMetadata) {
    const normalizedAction = normalizeProofreadingConfirmationDecisionAction(
      decision.action,
    );

    if (normalizedAction === "escalated") {
      throw new HumanReviewPublishGateError(
        `AI proofreading issue ${decision.itemId} is escalated and must be resolved before publication.`,
      );
    }

    if (
      normalizedAction === "manual_only" &&
      (decision.blocksFinal === true ||
        decision.severity === "critical" ||
        decision.severity === "high")
    ) {
      throw new HumanReviewPublishGateError(
        `AI proofreading issue ${decision.itemId} still requires manual confirmation before publication.`,
      );
    }
  }
}

function buildProofreadingConfirmationGateItems(
  payload: Record<string, unknown> | undefined,
): ProofreadingConfirmationGateItem[] {
  const plan = asRecord(payload?.proofreadingPlan);
  const proofreadingFindings = asRecord(payload?.proofreadingFindings);
  const planIssueItems = Array.isArray(plan?.issues)
    ? plan.issues.flatMap((entry, index) => {
        const issue = asRecord(entry);
        const anchor = asRecord(issue?.anchor);
        const suggestion = asRecord(issue?.suggestion);
        const targetText =
          readOptionalString(anchor?.quote) ??
          readOptionalString(issue?.targetText);
        const replacementText =
          readOptionalString(suggestion?.replacementText) ??
          readOptionalString(issue?.replacementText) ??
          "";
        if (!targetText) {
          return [];
        }

        return [
          {
            itemId: readOptionalString(issue?.itemId) ?? `issue-${index + 1}`,
            blocksFinal: Boolean(issue?.blocksFinal),
            ...(normalizeProofreadingConfirmationSeverity(issue?.severity)
              ? {
                  severity: normalizeProofreadingConfirmationSeverity(
                    issue?.severity,
                  ),
                }
              : {}),
          },
        ];
      })
    : [];
  const correctionItems =
    planIssueItems.length === 0 && Array.isArray(plan?.corrections)
      ? plan.corrections.flatMap((entry, index) => {
          const correction = asRecord(entry);
          const targetText = readOptionalString(correction?.targetText);
          const replacementText = readOptionalString(correction?.replacementText);
          if (!targetText || !replacementText) {
            return [];
          }

          return [
            {
              itemId: `correction-${index + 1}`,
              blocksFinal: false,
            },
          ];
        })
      : [];
  const qualityFindingItems =
    buildProofreadingQualityFindingGateItems(proofreadingFindings);
  const failedCheckItems =
    buildProofreadingFailedCheckGateItems(proofreadingFindings);
  const baseItems = planIssueItems.length > 0 ? planIssueItems : correctionItems;

  return dedupeProofreadingConfirmationGateItems([
    ...baseItems,
    ...qualityFindingItems,
    ...failedCheckItems,
  ]);
}

function buildProofreadingQualityFindingGateItems(
  proofreadingFindings: Record<string, unknown> | undefined,
): ProofreadingConfirmationGateItem[] {
  const qualityFindings = Array.isArray(proofreadingFindings?.qualityFindings)
    ? proofreadingFindings.qualityFindings
    : [];

  return qualityFindings.flatMap((entry, index) => {
    const finding = asRecord(entry);
    if (!finding) {
      return [];
    }

    const evidencePack = asRecord(finding.evidence_pack);
    const targetText =
      readOptionalString(finding.excerpt) ??
      readOptionalString(evidencePack?.excerpt);
    if (!targetText) {
      return [];
    }

    const severity = normalizeProofreadingConfirmationSeverity(finding.severity);
    return [
      {
        itemId: readOptionalString(finding.id) ?? `quality-${index + 1}`,
        blocksFinal:
          Boolean(finding.blocksFinal) ||
          severity === "high" ||
          severity === "critical",
        ...(severity ? { severity } : {}),
      },
    ];
  });
}

function buildProofreadingFailedCheckGateItems(
  proofreadingFindings: Record<string, unknown> | undefined,
): ProofreadingConfirmationGateItem[] {
  const failedChecks = Array.isArray(proofreadingFindings?.failedChecks)
    ? proofreadingFindings.failedChecks
    : [];

  return failedChecks.flatMap((entry, index) => {
    const failedCheck = asRecord(entry);
    if (!failedCheck) {
      return [];
    }

    const targetText =
      readOptionalString(failedCheck.actual) ??
      readOptionalString(failedCheck.excerpt);
    if (!targetText) {
      return [];
    }

    const severity = normalizeProofreadingConfirmationSeverity(failedCheck.severity);
    return [
      {
        itemId: readOptionalString(failedCheck.ruleId) ?? `failed-check-${index + 1}`,
        blocksFinal:
          Boolean(failedCheck.blocksFinal) ||
          severity === "high" ||
          severity === "critical",
        ...(severity ? { severity } : {}),
      },
    ];
  });
}

function normalizeProofreadingConfirmationSeverity(
  value: unknown,
): ProofreadingConfirmationGateItem["severity"] {
  const severity = readOptionalString(value);
  switch (severity) {
    case "critical":
    case "high":
    case "medium":
    case "low":
      return severity;
    case "error":
      return "high";
    case "warning":
      return "medium";
    case "info":
      return "low";
    default:
      return undefined;
  }
}

function dedupeProofreadingConfirmationGateItems(
  items: readonly ProofreadingConfirmationGateItem[],
): ProofreadingConfirmationGateItem[] {
  const deduped = new Map<string, ProofreadingConfirmationGateItem>();

  for (const item of items) {
    if (!deduped.has(item.itemId)) {
      deduped.set(item.itemId, item);
    }
  }

  return [...deduped.values()];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function shareSameAssetLineage(items: readonly HumanReviewDiffRecord[]): boolean {
  const first = items[0];
  if (!first) {
    return true;
  }

  return items.every(
    (item) =>
      item.baseline_asset_id === first.baseline_asset_id &&
      item.working_asset_id === first.working_asset_id,
  );
}

function buildKeptTextReplacements(
  items: readonly HumanReviewDiffRecord[],
): NonNullable<ApplyDeterministicDocxRulesInput["aiReplacements"]> {
  return items
    .filter(
      (item) =>
        item.content_decision === "keep" &&
        item.apply_capability === "auto_apply_revert",
    )
    .flatMap((item) => {
      const targetText = item.before_text ?? "";
      const replacementText = item.after_text ?? "";
      if (!targetText && !replacementText) {
        return [];
      }

      return [
        {
          targetText,
          replacementText,
          reason: `Human review diff ${item.id} kept by reviewer.`,
        },
      ];
    });
}

function buildProofreadingConfirmationTextReplacements(
  decisions: readonly HumanReviewProofreadingConfirmationDecisionInput[] | undefined,
): NonNullable<ApplyDeterministicDocxRulesInput["aiReplacements"]> {
  return (decisions ?? []).flatMap((decision) => {
    const normalizedAction = normalizeProofreadingConfirmationDecisionAction(
      decision.action,
    );
    if (!isProofreadingConfirmationAcceptedIntoFinal(normalizedAction)) {
      return [];
    }

    const targetText = decision.targetText.trim();
    const replacementText = (
      decision.finalReplacementText ??
      decision.editedReplacementText ??
      decision.replacementText
    ).trim();
    if (!targetText || !replacementText) {
      return [];
    }

    return [
      {
        targetText,
        replacementText,
        reason: `Proofreading confirmation ${decision.itemId} kept by reviewer.`,
      },
    ];
  });
}

function buildProofreadingConfirmationGovernanceIntents(
  decisions: readonly HumanReviewProofreadingConfirmationDecisionInput[],
): Array<{
  itemId: string;
  ruleCandidate: boolean;
  knowledgeCandidate: boolean;
}> {
  return decisions
    .map((decision) => {
      const normalizedAction = normalizeProofreadingConfirmationDecisionAction(
        decision.action,
      );
      return {
        itemId: decision.itemId,
        ruleCandidate:
          decision.routeToRuleCandidate === true ||
          normalizedAction === "route_to_rule_candidate",
        knowledgeCandidate:
          decision.routeToKnowledgeCandidate === true ||
          normalizedAction === "route_to_knowledge_candidate",
      };
    })
    .filter((intent) => intent.ruleCandidate || intent.knowledgeCandidate);
}

function buildProofreadingConfirmationBackflowTargets(
  decision: HumanReviewProofreadingConfirmationDecisionInput,
): HumanReviewBackflowTarget[] {
  const normalizedAction = normalizeProofreadingConfirmationDecisionAction(
    decision.action,
  );
  const targets: HumanReviewBackflowTarget[] = [];

  if (
    decision.routeToRuleCandidate === true ||
    normalizedAction === "route_to_rule_candidate"
  ) {
    targets.push("rule_candidate");
  }

  if (
    decision.routeToKnowledgeCandidate === true ||
    normalizedAction === "route_to_knowledge_candidate"
  ) {
    targets.push("knowledge_candidate");
  }

  return targets;
}

function resolveProofreadingConfirmationReplacementText(
  decision: HumanReviewProofreadingConfirmationDecisionInput,
): string {
  return (
    decision.finalReplacementText ??
    decision.editedReplacementText ??
    decision.replacementText
  ).trim();
}

function summarizeProofreadingConfirmationBackflow(
  attempts: readonly ProofreadingConfirmationBackflowAttempt[],
): ProofreadingConfirmationBackflowResult {
  return {
    attempts: [...attempts],
    summary: {
      attempted_count: attempts.length,
      succeeded_count: attempts.filter((attempt) => attempt.status === "succeeded")
        .length,
      failed_count: attempts.filter((attempt) => attempt.status === "failed")
        .length,
    },
  };
}

function combineBackflowSummaries(
  diffBackflow: HumanReviewBackflowResult,
  proofreadingBackflow: ProofreadingConfirmationBackflowResult,
): HumanReviewBackflowResult {
  return {
    attempts: diffBackflow.attempts,
    summary: {
      attempted_count:
        diffBackflow.summary.attempted_count +
        proofreadingBackflow.summary.attempted_count,
      succeeded_count:
        diffBackflow.summary.succeeded_count +
        proofreadingBackflow.summary.succeeded_count,
      failed_count:
        diffBackflow.summary.failed_count +
        proofreadingBackflow.summary.failed_count,
    },
  };
}

function normalizeProofreadingConfirmationDecisionAction(
  action: HumanReviewProofreadingConfirmationDecisionAction,
):
  | "accepted"
  | "accepted_with_manual_edit"
  | "rejected"
  | "manual_only"
  | "escalated"
  | "route_to_rule_candidate"
  | "route_to_knowledge_candidate" {
  switch (action) {
    case "accept":
      return "accepted";
    case "accept_and_edit":
      return "accepted_with_manual_edit";
    case "reject":
      return "rejected";
    default:
      return action;
  }
}

function isProofreadingConfirmationAcceptedIntoFinal(
  action: ReturnType<typeof normalizeProofreadingConfirmationDecisionAction>,
): boolean {
  return (
    action === "accepted" ||
    action === "accepted_with_manual_edit" ||
    action === "route_to_rule_candidate" ||
    action === "route_to_knowledge_candidate"
  );
}

function resolveBackflowTargets(
  item: HumanReviewDiffRecord,
  requestedTargets: "all" | readonly HumanReviewBackflowTarget[],
): HumanReviewBackflowTarget[] {
  const targets: HumanReviewBackflowTarget[] = [];
  if (item.governance_intents.rule_candidate) {
    targets.push("rule_candidate");
  }
  if (item.governance_intents.knowledge_candidate) {
    targets.push("knowledge_candidate");
  }

  if (requestedTargets === "all") {
    return targets;
  }

  const requested = new Set(requestedTargets);
  return targets.filter((target) => requested.has(target));
}

function normalizeBackflowModule(
  module: HumanReviewDiffRecord["module"],
): "proofreading" | "editing" {
  return module === "editing" ? "editing" : "proofreading";
}

function resolveHumanReviewFinalAssetType(
  module: HumanReviewPublishModule,
): DocumentAssetRecord["asset_type"] {
  return module === "editing" ? "edited_docx" : "human_final_docx";
}

function resolveHumanReviewFinalSourceModule(
  module: HumanReviewPublishModule,
): DocumentAssetRecord["source_module"] {
  return module === "editing" ? "editing" : "manual";
}

async function markDiffItemsPublished(input: {
  repository: HumanReviewRepository;
  items: readonly HumanReviewDiffRecord[];
  finalAssetId: string;
  updatedAt: string;
}): Promise<void> {
  for (const item of input.items) {
    await input.repository.updateDiffItem(item.id, {
      final_asset_id: input.finalAssetId,
      status: "published_writeback_done",
      updated_at: input.updatedAt,
    });
  }
}

function createHumanReviewFinalStorageKey(input: {
  manuscriptId: string;
  module: HumanReviewPublishModule;
  timestamp: string;
}): string {
  return [
    "runs",
    sanitizeStorageSegment(input.manuscriptId),
    input.module,
    "human-review-final",
    `${sanitizeStorageSegment(input.timestamp)}.docx`,
  ].join("/");
}

function sanitizeStorageSegment(value: string): string {
  return value.trim().replace(/[^A-Za-z0-9._-]+/g, "-") || "unknown";
}
