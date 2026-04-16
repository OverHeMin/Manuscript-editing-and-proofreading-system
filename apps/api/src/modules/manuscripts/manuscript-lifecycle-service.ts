import { randomUUID } from "node:crypto";
import type { ManuscriptTypeDetectionSummary } from "@medical/contracts";
import { MAX_MANUSCRIPT_BATCH_UPLOAD_COUNT } from "@medical/contracts";
import { ManuscriptNotFoundError } from "../assets/document-asset-service.ts";
import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";
import type { DocumentAssetRecord } from "../assets/document-asset-record.ts";
import type {
  JobBatchItemRecord,
  JobBatchItemStatus,
  JobBatchLifecycleStatus,
  JobBatchRestartPostureRecord,
  JobBatchStateRecord,
  JobBatchSettlementStatus,
  JobRecord,
} from "../jobs/job-record.ts";
import type { JobRepository } from "../jobs/job-repository.ts";
import {
  createWriteTransactionManager,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import type { TemplateFamilyRepository } from "../templates/template-repository.ts";
import type { ManuscriptRecord, ManuscriptType } from "./manuscript-record.ts";
import {
  HeuristicManuscriptTypeRecognitionService,
  type ManuscriptTypeRecognitionService,
} from "./manuscript-type-recognition-service.ts";
import type { ManuscriptRepository } from "./manuscript-repository.ts";

export interface UploadManuscriptInput {
  title: string;
  manuscriptType?: ManuscriptType;
  createdBy: string;
  fileName: string;
  mimeType: string;
  storageKey: string;
  fileContentBase64?: string;
}

export interface UploadManuscriptResult {
  manuscript: ManuscriptRecord;
  asset: DocumentAssetRecord;
  job: JobRecord;
}

export interface UploadManuscriptBatchInput {
  createdBy: string;
  items: Array<Omit<UploadManuscriptInput, "createdBy">>;
}

export interface UploadManuscriptBatchResult {
  batch_job: JobRecord;
  items: UploadManuscriptResult[];
}

export interface UpdateManuscriptTemplateSelectionInput {
  manuscriptId: string;
  templateFamilyId?: string | null;
  journalTemplateId?: string | null;
}

export interface ManuscriptLifecycleServiceOptions {
  manuscriptRepository: ManuscriptRepository;
  assetRepository: DocumentAssetRepository;
  jobRepository: JobRepository;
  templateFamilyRepository?: TemplateFamilyRepository;
  manuscriptTypeRecognitionService?: ManuscriptTypeRecognitionService;
  transactionManager?: WriteTransactionManager;
  createId?: () => string;
  now?: () => Date;
}

export class ManuscriptTemplateFamilyNotConfiguredError extends Error {
  constructor(manuscriptId: string) {
    super(
      `Manuscript ${manuscriptId} does not have a base template family configured.`,
    );
    this.name = "ManuscriptTemplateFamilyNotConfiguredError";
  }
}

export class ManuscriptJournalTemplateNotFoundError extends Error {
  constructor(journalTemplateId: string) {
    super(`Journal template ${journalTemplateId} was not found.`);
    this.name = "ManuscriptJournalTemplateNotFoundError";
  }
}

export class ManuscriptJournalTemplateNotActiveError extends Error {
  constructor(journalTemplateId: string, status: string) {
    super(`Journal template ${journalTemplateId} is ${status} and cannot be selected.`);
    this.name = "ManuscriptJournalTemplateNotActiveError";
  }
}

export class ManuscriptJournalTemplateFamilyMismatchError extends Error {
  constructor(
    journalTemplateId: string,
    expectedTemplateFamilyId: string,
    actualTemplateFamilyId: string,
  ) {
    super(
      `Journal template ${journalTemplateId} belongs to template family ${actualTemplateFamilyId}, expected ${expectedTemplateFamilyId}.`,
    );
    this.name = "ManuscriptJournalTemplateFamilyMismatchError";
  }
}

export class ManuscriptBatchJobNotFoundError extends Error {
  constructor(batchJobId: string) {
    super(`Batch job ${batchJobId} was not found.`);
    this.name = "ManuscriptBatchJobNotFoundError";
  }
}

export class ManuscriptBatchItemNotFoundError extends Error {
  constructor(batchJobId: string, itemId: string) {
    super(`Batch job ${batchJobId} does not contain item ${itemId}.`);
    this.name = "ManuscriptBatchItemNotFoundError";
  }
}

export class ManuscriptTemplateFamilyNotFoundError extends Error {
  constructor(templateFamilyId: string) {
    super(`Template family ${templateFamilyId} was not found.`);
    this.name = "ManuscriptTemplateFamilyNotFoundError";
  }
}

export class ManuscriptTemplateFamilyNotActiveError extends Error {
  constructor(templateFamilyId: string, status: string) {
    super(`Template family ${templateFamilyId} is ${status} and cannot be selected.`);
    this.name = "ManuscriptTemplateFamilyNotActiveError";
  }
}

export class ManuscriptBatchUploadLimitExceededError extends Error {
  constructor(itemCount: number) {
    super(
      `Batch uploads cannot exceed ${MAX_MANUSCRIPT_BATCH_UPLOAD_COUNT} manuscripts. Received ${itemCount}.`,
    );
    this.name = "ManuscriptBatchUploadLimitExceededError";
  }
}

export class ManuscriptLifecycleService {
  private readonly manuscriptRepository: ManuscriptRepository;
  private readonly assetRepository: DocumentAssetRepository;
  private readonly jobRepository: JobRepository;
  private readonly templateFamilyRepository?: TemplateFamilyRepository;
  private readonly manuscriptTypeRecognitionService: ManuscriptTypeRecognitionService;
  private readonly transactionManager: WriteTransactionManager;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: ManuscriptLifecycleServiceOptions) {
    this.manuscriptRepository = options.manuscriptRepository;
    this.assetRepository = options.assetRepository;
    this.jobRepository = options.jobRepository;
    this.templateFamilyRepository = options.templateFamilyRepository;
    this.manuscriptTypeRecognitionService =
      options.manuscriptTypeRecognitionService ??
      new HeuristicManuscriptTypeRecognitionService();
    this.transactionManager =
      options.transactionManager ??
      createWriteTransactionManager({
        manuscriptRepository: this.manuscriptRepository,
        assetRepository: this.assetRepository,
        jobRepository: this.jobRepository,
      });
    this.createId = options.createId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  async upload(input: UploadManuscriptInput): Promise<UploadManuscriptResult> {
    const resolvedType = await this.resolveUploadManuscriptType(input);
    const templateFamilyId = await this.resolveDefaultTemplateFamilyId(
      resolvedType.manuscriptType,
    );

    return this.transactionManager.withTransaction(
      async ({ manuscriptRepository, assetRepository, jobRepository }) => {
        if (!jobRepository) {
          throw new Error("Manuscript lifecycle uploads require a job repository.");
        }

        const timestamp = this.now().toISOString();
        const manuscriptId = this.createId();
        const assetId = this.createId();
        const jobId = this.createId();

        const manuscript: ManuscriptRecord = {
          id: manuscriptId,
          title: input.title,
          manuscript_type: resolvedType.manuscriptType,
          status: "uploaded",
          created_by: input.createdBy,
          current_screening_asset_id: undefined,
          current_editing_asset_id: undefined,
          current_proofreading_asset_id: undefined,
          current_template_family_id: templateFamilyId,
          ...(resolvedType.detectionSummary
            ? {
                manuscript_type_detection_summary: resolvedType.detectionSummary,
              }
            : {}),
          created_at: timestamp,
          updated_at: timestamp,
        };
        const asset: DocumentAssetRecord = {
          id: assetId,
          manuscript_id: manuscriptId,
          asset_type: "original",
          status: "active",
          storage_key: input.storageKey,
          mime_type: input.mimeType,
          parent_asset_id: undefined,
          source_module: "upload",
          source_job_id: jobId,
          created_by: input.createdBy,
          version_no: 1,
          is_current: true,
          file_name: input.fileName,
          created_at: timestamp,
          updated_at: timestamp,
        };
        const job: JobRecord = {
          id: jobId,
          manuscript_id: manuscriptId,
          module: "upload",
          job_type: "manuscript_upload",
          status: "queued",
          requested_by: input.createdBy,
          payload: {
            assetId,
            fileName: input.fileName,
            mimeType: input.mimeType,
          },
          attempt_count: 0,
          started_at: undefined,
          finished_at: undefined,
          error_message: undefined,
          created_at: timestamp,
          updated_at: timestamp,
        };

        await manuscriptRepository.save(manuscript);
        await jobRepository.save(job);
        await assetRepository.save(asset);

        return {
          manuscript,
          asset,
          job,
        };
      },
    );
  }

  async uploadBatch(
    input: UploadManuscriptBatchInput,
  ): Promise<UploadManuscriptBatchResult> {
    if (input.items.length === 0) {
      throw new Error("Batch uploads require at least one item.");
    }

    if (input.items.length > MAX_MANUSCRIPT_BATCH_UPLOAD_COUNT) {
      throw new ManuscriptBatchUploadLimitExceededError(input.items.length);
    }

    const resolvedItems = await Promise.all(
      input.items.map(async (item) => {
        const resolvedType = await this.resolveUploadManuscriptType({
          ...item,
          createdBy: input.createdBy,
        });

        return {
          item,
          resolvedType,
          templateFamilyId: await this.resolveDefaultTemplateFamilyId(
            resolvedType.manuscriptType,
          ),
        };
      }),
    );

    return this.transactionManager.withTransaction(
      async ({ manuscriptRepository, assetRepository, jobRepository }) => {
        if (!jobRepository) {
          throw new Error("Manuscript lifecycle uploads require a job repository.");
        }

        const timestamp = this.now().toISOString();
        const batchJobId = this.createId();
        const uploadedItems: UploadManuscriptResult[] = [];
        const batchItems: JobBatchItemRecord[] = [];

        for (const [index, resolvedItem] of resolvedItems.entries()) {
          const { item, resolvedType, templateFamilyId } = resolvedItem;
          const manuscriptId = this.createId();
          const assetId = this.createId();
          const jobId = this.createId();
          const manuscript: ManuscriptRecord = {
            id: manuscriptId,
            title: item.title,
            manuscript_type: resolvedType.manuscriptType,
            status: "uploaded",
            created_by: input.createdBy,
            current_screening_asset_id: undefined,
            current_editing_asset_id: undefined,
            current_proofreading_asset_id: undefined,
            current_template_family_id: templateFamilyId,
            ...(resolvedType.detectionSummary
              ? {
                  manuscript_type_detection_summary: resolvedType.detectionSummary,
                }
              : {}),
            created_at: timestamp,
            updated_at: timestamp,
          };
          const asset: DocumentAssetRecord = {
            id: assetId,
            manuscript_id: manuscriptId,
            asset_type: "original",
            status: "active",
            storage_key: item.storageKey,
            mime_type: item.mimeType,
            parent_asset_id: undefined,
            source_module: "upload",
            source_job_id: jobId,
            created_by: input.createdBy,
            version_no: 1,
            is_current: true,
            file_name: item.fileName,
            created_at: timestamp,
            updated_at: timestamp,
          };
          const job: JobRecord = {
            id: jobId,
            manuscript_id: manuscriptId,
            module: "upload",
            job_type: "manuscript_upload",
            status: "queued",
            requested_by: input.createdBy,
            payload: {
              assetId,
              fileName: item.fileName,
              mimeType: item.mimeType,
              batchJobId,
              batchItemId: buildBatchItemId(index),
            },
            attempt_count: 0,
            started_at: undefined,
            finished_at: undefined,
            error_message: undefined,
            created_at: timestamp,
            updated_at: timestamp,
          };

          await manuscriptRepository.save(manuscript);
          await jobRepository.save(job);
          await assetRepository.save(asset);

          uploadedItems.push({
            manuscript,
            asset,
            job,
          });
          batchItems.push({
            item_id: buildBatchItemId(index),
            title: item.title,
            file_name: item.fileName,
            manuscript_id: manuscriptId,
            upload_job_id: jobId,
            status: "queued",
            attempt_count: 0,
            updated_at: timestamp,
          });
        }

        const batchJob: JobRecord = {
          id: batchJobId,
          module: "upload",
          job_type: "manuscript_upload_batch",
          status: "queued",
          requested_by: input.createdBy,
          payload: {
            batch: {
              items: batchItems,
              restart_posture: buildFreshBatchRestartPosture(timestamp),
            } satisfies JobBatchStateRecord,
          },
          attempt_count: 0,
          started_at: undefined,
          finished_at: undefined,
          error_message: undefined,
          created_at: timestamp,
          updated_at: timestamp,
        };

        await jobRepository.save(batchJob);

        return {
          batch_job: batchJob,
          items: uploadedItems,
        };
      },
    );
  }

  private async resolveDefaultTemplateFamilyId(
    manuscriptType: ManuscriptType,
  ): Promise<string | undefined> {
    if (!this.templateFamilyRepository) {
      return undefined;
    }

    const matchingFamilies = (await this.templateFamilyRepository.list()).filter(
      (family) =>
        family.manuscript_type === manuscriptType && family.status === "active",
    );

    if (matchingFamilies.length !== 1) {
      return undefined;
    }

    return matchingFamilies[0]?.id;
  }

  private async resolveUploadManuscriptType(input: UploadManuscriptInput): Promise<{
    manuscriptType: ManuscriptType;
    detectionSummary?: ManuscriptTypeDetectionSummary;
  }> {
    if (input.manuscriptType) {
      return {
        manuscriptType: input.manuscriptType,
      };
    }

    const detectionSummary = await this.manuscriptTypeRecognitionService.detect({
      title: input.title,
      fileName: input.fileName,
      fileContentBase64: input.fileContentBase64,
    });

    return {
      manuscriptType: detectionSummary.final_type,
      detectionSummary,
    };
  }

  getManuscript(manuscriptId: string): Promise<ManuscriptRecord | undefined> {
    return this.manuscriptRepository.findById(manuscriptId);
  }

  async updateTemplateSelection(
    input: UpdateManuscriptTemplateSelectionInput,
  ): Promise<ManuscriptRecord> {
    const manuscript = await this.manuscriptRepository.findById(input.manuscriptId);
    if (!manuscript) {
      throw new ManuscriptNotFoundError(input.manuscriptId);
    }

    const timestamp = this.now().toISOString();
    const templateFamilyRepository = this.templateFamilyRepository;
    if (
      (input.templateFamilyId !== undefined || input.journalTemplateId !== undefined) &&
      !templateFamilyRepository
    ) {
      throw new Error("Template family repository is required for template selection.");
    }

    let updated: ManuscriptRecord = {
      ...manuscript,
      updated_at: timestamp,
    };

    if (input.templateFamilyId !== undefined && input.templateFamilyId !== null) {
      const templateFamily = await templateFamilyRepository?.findById(
        input.templateFamilyId,
      );
      if (!templateFamily) {
        throw new ManuscriptTemplateFamilyNotFoundError(input.templateFamilyId);
      }

      if (templateFamily.status !== "active") {
        throw new ManuscriptTemplateFamilyNotActiveError(
          input.templateFamilyId,
          templateFamily.status,
        );
      }

      updated = {
        ...updated,
        manuscript_type: templateFamily.manuscript_type,
        manuscript_type_detection_summary: reconcileDetectionSummaryWithTemplateFamily(
          updated.manuscript_type_detection_summary,
          templateFamily.manuscript_type,
        ),
        current_template_family_id: templateFamily.id,
      };

      if (updated.current_journal_template_id) {
        const currentJournalTemplate =
          await templateFamilyRepository?.findJournalTemplateProfileById(
            updated.current_journal_template_id,
          );
        if (
          !currentJournalTemplate ||
          currentJournalTemplate.template_family_id !== templateFamily.id
        ) {
          updated = {
            ...updated,
            current_journal_template_id: undefined,
          };
        }
      }
    }

    if (input.journalTemplateId === null) {
      updated = {
        ...updated,
        current_journal_template_id: undefined,
      };
      await this.manuscriptRepository.save(updated);
      return updated;
    }

    if (input.journalTemplateId === undefined) {
      await this.manuscriptRepository.save(updated);
      return updated;
    }

    if (!updated.current_template_family_id) {
      throw new ManuscriptTemplateFamilyNotConfiguredError(input.manuscriptId);
    }

    const journalTemplate =
      await templateFamilyRepository?.findJournalTemplateProfileById(
        input.journalTemplateId,
      );
    if (!journalTemplate) {
      throw new ManuscriptJournalTemplateNotFoundError(input.journalTemplateId);
    }

    if (journalTemplate.status !== "active") {
      throw new ManuscriptJournalTemplateNotActiveError(
        input.journalTemplateId,
        journalTemplate.status,
      );
    }

    if (journalTemplate.template_family_id !== updated.current_template_family_id) {
      throw new ManuscriptJournalTemplateFamilyMismatchError(
        input.journalTemplateId,
        updated.current_template_family_id,
        journalTemplate.template_family_id,
      );
    }

    updated = {
      ...updated,
      current_journal_template_id: input.journalTemplateId,
    };
    await this.manuscriptRepository.save(updated);
    return updated;
  }

  getJob(jobId: string): Promise<JobRecord | undefined> {
    return this.jobRepository.findById(jobId);
  }

  listJobsByManuscriptId(manuscriptId: string): Promise<JobRecord[]> {
    return this.jobRepository.listByManuscriptId(manuscriptId);
  }

  async markBatchItemRunning(input: {
    batchJobId: string;
    itemId: string;
  }): Promise<JobRecord> {
    return this.updateBatchJob(input.batchJobId, (batch, timestamp) =>
      updateBatchItem(batch, input.itemId, (item) => ({
        ...item,
        status: "running",
        attempt_count: item.status === "running" ? item.attempt_count : item.attempt_count + 1,
        error_message: undefined,
        resumed_after_restart: false,
        updated_at: timestamp,
      })),
    );
  }

  async markBatchItemSucceeded(input: {
    batchJobId: string;
    itemId: string;
  }): Promise<JobRecord> {
    return this.updateBatchJob(input.batchJobId, (batch, timestamp) =>
      updateBatchItem(batch, input.itemId, (item) => ({
        ...item,
        status: "succeeded",
        error_message: undefined,
        resumed_after_restart: false,
        updated_at: timestamp,
      })),
    );
  }

  async markBatchItemFailed(input: {
    batchJobId: string;
    itemId: string;
    errorMessage: string;
  }): Promise<JobRecord> {
    return this.updateBatchJob(input.batchJobId, (batch, timestamp) =>
      updateBatchItem(batch, input.itemId, (item) => ({
        ...item,
        status: "failed",
        error_message: input.errorMessage,
        updated_at: timestamp,
      })),
    );
  }

  async retryBatchItem(input: {
    batchJobId: string;
    itemId: string;
  }): Promise<JobRecord> {
    return this.updateBatchJob(input.batchJobId, (batch, timestamp) =>
      updateBatchItem(batch, input.itemId, (item) => ({
        ...item,
        status: "queued",
        error_message: undefined,
        resumed_after_restart: false,
        updated_at: timestamp,
      })),
    );
  }

  async resumeBatchAfterRestart(input: {
    batchJobId: string;
  }): Promise<JobRecord> {
    return this.updateBatchJob(input.batchJobId, (batch, timestamp) => {
      let resumedCount = 0;
      const items = batch.items.map((item) => {
        if (item.status !== "running") {
          return item;
        }

        resumedCount += 1;
        return {
          ...item,
          status: "queued" as const,
          resumed_after_restart: true,
          updated_at: timestamp,
        };
      });

      if (resumedCount === 0) {
        return batch;
      }

      return {
        ...batch,
        items,
        restart_posture: {
          status: "resumed_after_restart",
          reason: `Resumed ${resumedCount} running batch item(s) after server restart.`,
          resumed_item_count: resumedCount,
          observed_at: timestamp,
        },
      };
    });
  }

  async cancelBatch(input: {
    batchJobId: string;
    reason?: string;
  }): Promise<JobRecord> {
    return this.updateBatchJob(input.batchJobId, (batch, timestamp) => ({
      ...batch,
      items: batch.items.map((item) =>
        item.status === "queued" || item.status === "running"
          ? {
              ...item,
              status: "cancelled",
              error_message: input.reason,
              updated_at: timestamp,
            }
          : item
      ),
      restart_posture:
        batch.restart_posture.status === "resumed_after_restart"
          ? batch.restart_posture
          : {
              ...batch.restart_posture,
              observed_at: timestamp,
            },
    }));
  }

  private async updateBatchJob(
    batchJobId: string,
    update: (
      batch: JobBatchStateRecord,
      timestamp: string,
    ) => JobBatchStateRecord,
  ): Promise<JobRecord> {
    const batchJob = await this.jobRepository.findById(batchJobId);
    if (!batchJob) {
      throw new ManuscriptBatchJobNotFoundError(batchJobId);
    }

    const batch = readBatchState(batchJob);
    const timestamp = this.now().toISOString();
    const nextBatch = update(batch, timestamp);
    const lifecycleStatus = deriveBatchLifecycleStatus(nextBatch.items);
    const settlementStatus = deriveBatchSettlementStatus(
      lifecycleStatus,
      nextBatch.items,
    );
    const nextJob: JobRecord = {
      ...batchJob,
      status: mapBatchLifecycleStatusToJobStatus(
        lifecycleStatus,
        settlementStatus,
      ),
      payload: {
        ...(batchJob.payload ?? {}),
        batch: nextBatch,
      },
      updated_at: timestamp,
      finished_at:
        lifecycleStatus === "completed" || lifecycleStatus === "cancelled"
          ? timestamp
          : undefined,
    };

    await this.jobRepository.save(nextJob);
    return nextJob;
  }
}

function buildBatchItemId(index: number): string {
  return `item-${index + 1}`;
}

function buildFreshBatchRestartPosture(
  observedAt: string,
): JobBatchRestartPostureRecord {
  return {
    status: "fresh",
    reason: "Batch has not required restart recovery.",
    observed_at: observedAt,
  };
}

function readBatchState(job: JobRecord): JobBatchStateRecord {
  const batch = job.payload?.batch;
  if (!batch || typeof batch !== "object") {
    throw new Error(`Job ${job.id} does not carry batch state.`);
  }

  return JSON.parse(JSON.stringify(batch)) as JobBatchStateRecord;
}

function updateBatchItem(
  batch: JobBatchStateRecord,
  itemId: string,
  update: (item: JobBatchItemRecord) => JobBatchItemRecord,
): JobBatchStateRecord {
  let found = false;
  const items = batch.items.map((item) => {
    if (item.item_id !== itemId) {
      return item;
    }

    found = true;
    return update(item);
  });

  if (!found) {
    throw new ManuscriptBatchItemNotFoundError("unknown-batch", itemId);
  }

  return {
    ...batch,
    items,
  };
}

function deriveBatchLifecycleStatus(
  items: readonly JobBatchItemRecord[],
): JobBatchLifecycleStatus {
  if (items.every((item) => item.status === "queued")) {
    return "queued";
  }

  if (
    items.some((item) => item.status === "queued") ||
    items.some((item) => item.status === "running")
  ) {
    return "running";
  }

  if (items.some((item) => item.status === "cancelled")) {
    return "cancelled";
  }

  return "completed";
}

export function deriveBatchSettlementStatus(
  lifecycleStatus: JobBatchLifecycleStatus,
  items: readonly JobBatchItemRecord[],
): JobBatchSettlementStatus {
  if (lifecycleStatus === "queued" || lifecycleStatus === "running") {
    return "in_progress";
  }

  const succeededCount = items.filter((item) => item.status === "succeeded").length;
  const failedCount = items.filter((item) => item.status === "failed").length;
  const cancelledCount = items.filter((item) => item.status === "cancelled").length;

  if (lifecycleStatus === "cancelled") {
    if (succeededCount > 0) {
      return "partial_success";
    }

    return cancelledCount === items.length ? "cancelled" : "failed";
  }

  if (succeededCount === items.length) {
    return "succeeded";
  }

  if (succeededCount === 0 && failedCount > 0) {
    return "failed";
  }

  return "partial_success";
}

function mapBatchLifecycleStatusToJobStatus(
  lifecycleStatus: JobBatchLifecycleStatus,
  settlementStatus: JobBatchSettlementStatus,
): JobRecord["status"] {
  if (settlementStatus === "failed") {
    return "failed";
  }

  switch (lifecycleStatus) {
    case "queued":
      return "queued";
    case "running":
      return "running";
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
  }
}

function reconcileDetectionSummaryWithTemplateFamily(
  detectionSummary: ManuscriptTypeDetectionSummary | undefined,
  manuscriptType: ManuscriptType,
): ManuscriptTypeDetectionSummary | undefined {
  if (!detectionSummary) {
    return undefined;
  }

  return {
    ...detectionSummary,
    final_type: manuscriptType,
  };
}
