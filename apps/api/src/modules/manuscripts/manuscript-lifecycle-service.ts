import { randomUUID } from "node:crypto";
import { ManuscriptNotFoundError } from "../assets/document-asset-service.ts";
import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";
import type { DocumentAssetRecord } from "../assets/document-asset-record.ts";
import type { JobRecord } from "../jobs/job-record.ts";
import type { JobRepository } from "../jobs/job-repository.ts";
import {
  createWriteTransactionManager,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import type { TemplateFamilyRepository } from "../templates/template-repository.ts";
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

export interface UpdateManuscriptTemplateSelectionInput {
  manuscriptId: string;
  journalTemplateId?: string | null;
}

export interface ManuscriptLifecycleServiceOptions {
  manuscriptRepository: ManuscriptRepository;
  assetRepository: DocumentAssetRepository;
  jobRepository: JobRepository;
  templateFamilyRepository?: TemplateFamilyRepository;
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

export class ManuscriptLifecycleService {
  private readonly manuscriptRepository: ManuscriptRepository;
  private readonly assetRepository: DocumentAssetRepository;
  private readonly jobRepository: JobRepository;
  private readonly templateFamilyRepository?: TemplateFamilyRepository;
  private readonly transactionManager: WriteTransactionManager;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: ManuscriptLifecycleServiceOptions) {
    this.manuscriptRepository = options.manuscriptRepository;
    this.assetRepository = options.assetRepository;
    this.jobRepository = options.jobRepository;
    this.templateFamilyRepository = options.templateFamilyRepository;
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
    const templateFamilyId = await this.resolveDefaultTemplateFamilyId(
      input.manuscriptType,
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
          manuscript_type: input.manuscriptType,
          status: "uploaded",
          created_by: input.createdBy,
          current_screening_asset_id: undefined,
          current_editing_asset_id: undefined,
          current_proofreading_asset_id: undefined,
          current_template_family_id: templateFamilyId,
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
    if (input.journalTemplateId === null || input.journalTemplateId === undefined) {
      const updated: ManuscriptRecord = {
        ...manuscript,
        current_journal_template_id: undefined,
        updated_at: timestamp,
      };
      await this.manuscriptRepository.save(updated);
      return updated;
    }

    const templateFamilyRepository = this.templateFamilyRepository;
    if (!templateFamilyRepository) {
      throw new Error("Template family repository is required for journal template selection.");
    }

    if (!manuscript.current_template_family_id) {
      throw new ManuscriptTemplateFamilyNotConfiguredError(input.manuscriptId);
    }

    const journalTemplate =
      await templateFamilyRepository.findJournalTemplateProfileById(
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

    if (journalTemplate.template_family_id !== manuscript.current_template_family_id) {
      throw new ManuscriptJournalTemplateFamilyMismatchError(
        input.journalTemplateId,
        manuscript.current_template_family_id,
        journalTemplate.template_family_id,
      );
    }

    const updated: ManuscriptRecord = {
      ...manuscript,
      current_journal_template_id: input.journalTemplateId,
      updated_at: timestamp,
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
}
