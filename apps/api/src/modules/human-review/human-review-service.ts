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
      aiReplacements: buildKeptTextReplacements(items),
    });

    const job: JobRecord = {
      id: jobId,
      manuscript_id: input.manuscriptId,
      module: "manual",
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
      assetType: "human_final_docx",
      storageKey: outputStorageKey,
      mimeType: DOCX_MIME_TYPE,
      createdBy: requestedBy,
      fileName: outputFileName,
      parentAssetId: baselineAssetId,
      sourceModule: "manual",
      sourceJobId: jobId,
    });

    const completedJob = {
      ...job,
      payload: {
        ...job.payload,
        outputAssetId: asset.id,
        outputAssetType: asset.asset_type,
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

    return {
      job: completedJob,
      asset,
      preflight,
      backflow,
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
