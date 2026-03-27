import { randomUUID } from "node:crypto";
import type { DocumentAssetRecord } from "../assets/document-asset-record.ts";
import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";
import { DocumentAssetService } from "../assets/document-asset-service.ts";
import type { ManuscriptRepository } from "../manuscripts/manuscript-repository.ts";
import {
  createDirectWriteTransactionManager,
  createScopedWriteTransactionManager,
  type SnapshotCapableRepository,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import { InMemoryPdfConsistencyIssueRepository } from "./in-memory-pdf-consistency-repository.ts";
import type {
  PdfConsistencyIssueContent,
  PdfConsistencyIssueRecord,
} from "./pdf-consistency-record.ts";
import type { PdfConsistencyIssueRepository } from "./pdf-consistency-repository.ts";

export interface CreatePdfConsistencyReportInput {
  manuscriptId: string;
  parentAssetId: string;
  requestedBy: string;
  storageKey: string;
  fileName?: string;
  issues: PdfConsistencyIssueContent[];
}

export interface PdfConsistencyServiceOptions {
  manuscriptRepository: ManuscriptRepository;
  assetRepository: DocumentAssetRepository;
  issueRepository: PdfConsistencyIssueRepository;
  documentAssetService: DocumentAssetService;
  transactionManager?: WriteTransactionManager<PdfConsistencyWriteContext>;
  createId?: () => string;
  now?: () => Date;
}

export interface PdfConsistencyReportResult {
  asset: DocumentAssetRecord;
  issues: PdfConsistencyIssueRecord[];
}

interface PdfConsistencyWriteContext {
  manuscriptRepository: ManuscriptRepository;
  assetRepository: DocumentAssetRepository;
  issueRepository: PdfConsistencyIssueRepository;
}

export class PdfConsistencyService {
  private readonly assetRepository: DocumentAssetRepository;
  private readonly issueRepository: PdfConsistencyIssueRepository;
  private readonly documentAssetService: DocumentAssetService;
  private readonly transactionManager: WriteTransactionManager<PdfConsistencyWriteContext>;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: PdfConsistencyServiceOptions) {
    this.assetRepository = options.assetRepository;
    this.issueRepository = options.issueRepository;
    this.documentAssetService = options.documentAssetService;
    this.transactionManager =
      options.transactionManager ??
      createPdfConsistencyWriteTransactionManager({
        manuscriptRepository: options.manuscriptRepository,
        assetRepository: options.assetRepository,
        issueRepository: options.issueRepository,
      });
    this.createId = options.createId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  async createReport(
    input: CreatePdfConsistencyReportInput,
  ): Promise<PdfConsistencyReportResult> {
    return this.transactionManager.withTransaction(async (context) => {
      const reportAsset = await this.documentAssetService
        .createScoped({
          manuscriptRepository: context.manuscriptRepository,
          assetRepository: context.assetRepository,
        })
        .createAsset({
        manuscriptId: input.manuscriptId,
        assetType: "pdf_consistency_report",
        storageKey: input.storageKey,
        mimeType: "application/json",
        createdBy: input.requestedBy,
        fileName: input.fileName,
        parentAssetId: input.parentAssetId,
        sourceModule: "pdf_consistency",
      });

      const timestamp = this.now().toISOString();
      const issueRecords = input.issues.map((issue, index) => ({
        id: this.createId(),
        manuscript_id: input.manuscriptId,
        report_asset_id: reportAsset.id,
        sequence_no: index + 1,
        created_at: timestamp,
        ...issue,
      }));

      await context.issueRepository.saveMany(issueRecords);

      return {
        asset: reportAsset,
        issues: issueRecords,
      };
    });
  }

  async listCurrentIssues(
    manuscriptId: string,
  ): Promise<PdfConsistencyIssueContent[]> {
    const currentReport = await this.findCurrentReportAsset(manuscriptId);
    if (!currentReport) {
      return [];
    }

    const issueRecords = await this.issueRepository.listByReportAssetId(
      currentReport.id,
    );

    return issueRecords.map(toIssueContent);
  }

  private async findCurrentReportAsset(
    manuscriptId: string,
  ): Promise<DocumentAssetRecord | undefined> {
    const reportAssets = await this.assetRepository.listByManuscriptIdAndType(
      manuscriptId,
      "pdf_consistency_report",
    );

    return reportAssets
      .filter((asset) => asset.is_current)
      .sort((left, right) => right.version_no - left.version_no)[0];
  }
}

function isSnapshotCapableRepository<T extends object>(
  repository: T,
): repository is T & SnapshotCapableRepository {
  return (
    typeof (repository as SnapshotCapableRepository).snapshotState === "function" &&
    typeof (repository as SnapshotCapableRepository).restoreState === "function"
  );
}

function createPdfConsistencyWriteTransactionManager(
  context: PdfConsistencyWriteContext,
): WriteTransactionManager<PdfConsistencyWriteContext> {
  if (context.issueRepository instanceof InMemoryPdfConsistencyIssueRepository) {
    const repositories = [
      context.manuscriptRepository,
      context.assetRepository,
      context.issueRepository,
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

function toIssueContent(
  record: PdfConsistencyIssueContent,
): PdfConsistencyIssueContent {
  return {
    issue_type: record.issue_type,
    ...(record.toc_heading ? { toc_heading: record.toc_heading } : {}),
    ...(record.body_heading ? { body_heading: record.body_heading } : {}),
  };
}
