import { randomUUID } from "node:crypto";
import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";
import type { DocumentAssetRecord } from "../assets/document-asset-record.ts";
import type { JobRecord } from "../jobs/job-record.ts";
import type { JobRepository } from "../jobs/job-repository.ts";
import type { ManuscriptRecord, ManuscriptType } from "./manuscript-record.ts";
import type { ManuscriptRepository } from "./manuscript-repository.ts";

export interface UploadManuscriptInput {
  title: string;
  manuscriptType: ManuscriptType;
  createdBy: string;
  fileName: string;
  mimeType: string;
  storageKey: string;
}

export interface UploadManuscriptResult {
  manuscript: ManuscriptRecord;
  asset: DocumentAssetRecord;
  job: JobRecord;
}

export interface ManuscriptLifecycleServiceOptions {
  manuscriptRepository: ManuscriptRepository;
  assetRepository: DocumentAssetRepository;
  jobRepository: JobRepository;
  createId?: () => string;
  now?: () => Date;
}

export class ManuscriptLifecycleService {
  private readonly manuscriptRepository: ManuscriptRepository;
  private readonly assetRepository: DocumentAssetRepository;
  private readonly jobRepository: JobRepository;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: ManuscriptLifecycleServiceOptions) {
    this.manuscriptRepository = options.manuscriptRepository;
    this.assetRepository = options.assetRepository;
    this.jobRepository = options.jobRepository;
    this.createId = options.createId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  async upload(input: UploadManuscriptInput): Promise<UploadManuscriptResult> {
    const timestamp = this.now().toISOString();
    const manuscriptId = this.createId();
    const assetId = this.createId();
    const jobId = this.createId();

    const manuscript: ManuscriptRecord = {
      id: manuscriptId,
      title: input.title,
      manuscript_type: input.manuscriptType,
      status: "uploaded",
      created_by: input.createdBy,
      current_screening_asset_id: undefined,
      current_editing_asset_id: undefined,
      current_proofreading_asset_id: undefined,
      current_template_family_id: undefined,
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

    await this.manuscriptRepository.save(manuscript);
    await this.assetRepository.save(asset);
    await this.jobRepository.save(job);

    return {
      manuscript,
      asset,
      job,
    };
  }

  getManuscript(manuscriptId: string): Promise<ManuscriptRecord | undefined> {
    return this.manuscriptRepository.findById(manuscriptId);
  }

  getJob(jobId: string): Promise<JobRecord | undefined> {
    return this.jobRepository.findById(jobId);
  }
}
