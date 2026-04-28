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
import type { EditorialDocxTransformService } from "../document-pipeline/editorial-docx-transform-service.ts";
import type { HumanReviewDiffRecord } from "./human-review-record.ts";
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
  outputStorageKey?: string;
  outputFileName?: string;
}

export interface PublishHumanReviewFinalResult {
  job: JobRecord;
  asset: DocumentAssetRecord;
  preflight: HumanReviewPublishPreflightResult;
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
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: HumanReviewServiceOptions) {
    this.repository = options.repository;
    this.manuscriptRepository = options.manuscriptRepository;
    this.assetRepository = options.assetRepository;
    this.jobRepository = options.jobRepository;
    this.documentAssetService = options.documentAssetService;
    this.editorialDocxTransformService = options.editorialDocxTransformService;
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

    return {
      job: completedJob,
      asset,
      preflight,
    };
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
  const blockingReasons: string[] = [];

  if (unconfirmedCount > 0 || deferredCount > 0) {
    blockingReasons.push("all human review differences must be confirmed");
  }
  if (unsafeCount > 0) {
    blockingReasons.push("unsafe human review differences require manual review");
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
