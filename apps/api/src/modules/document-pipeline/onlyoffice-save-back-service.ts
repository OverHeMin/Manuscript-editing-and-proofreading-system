import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DocumentAssetService } from "../assets/document-asset-service.ts";
import type {
  DocumentAssetRecord,
  DocumentAssetType,
} from "../assets/document-asset-record.ts";
import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";
import type {
  EditorialSourceBlockResolver,
  EditorialTextBlock,
} from "../editorial-execution/types.ts";
import {
  HumanReviewDiffService,
  type HumanReviewComparableBlock,
  type HumanReviewComparableBlockKind,
} from "../human-review/human-review-diff-service.ts";
import type { HumanReviewRepository } from "../human-review/human-review-repository.ts";
import type { JobRecord, ManuscriptModule } from "../jobs/job-record.ts";
import type { JobRepository } from "../jobs/job-repository.ts";
import type { ManuscriptRepository } from "../manuscripts/manuscript-repository.ts";
import {
  createWriteTransactionManager,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import {
  type OnlyOfficeSaveBackOutputAssetType,
  type OnlyOfficeSaveBackPurpose,
  type SurfaceSessionAccessTokenClaims,
  verifySurfaceSessionAccessToken,
} from "./onlyoffice-session-service.ts";

const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_ONLYOFFICE_SAVE_BACK_BYTES = 50 * 1024 * 1024;
const SAVEABLE_CALLBACK_STATUSES = new Set([2, 6]);
const ACK_ONLY_CALLBACK_STATUSES = new Set([1, 3, 7]);

export interface OnlyOfficeSaveBackCallbackInput {
  sessionId?: string;
  surfaceAccessToken?: string;
  saveBackModule?: "editing" | "proofreading";
  baselineAssetId?: string;
  body: unknown;
}

export interface OnlyOfficeSaveBackCallbackResult {
  error: 0;
}

export interface OnlyOfficeSaveBackServiceOptions {
  manuscriptRepository: ManuscriptRepository;
  assetRepository: DocumentAssetRepository;
  jobRepository: JobRepository;
  assetService: DocumentAssetService;
  uploadRootDir: string;
  surfaceSessionSecret?: string;
  transactionManager?: WriteTransactionManager;
  humanReviewRepository?: Pick<HumanReviewRepository, "saveDiffItems">;
  humanReviewDiffService?: Pick<HumanReviewDiffService, "extractDiffItems">;
  sourceBlockResolver?: Pick<EditorialSourceBlockResolver, "resolveBlocks">;
  createId?: () => string;
  now?: () => Date;
  fetchDocument?: (url: string) => Promise<Buffer>;
}

export class OnlyOfficeSaveBackInvalidCallbackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OnlyOfficeSaveBackInvalidCallbackError";
  }
}

export class OnlyOfficeSaveBackUnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OnlyOfficeSaveBackUnauthorizedError";
  }
}

export class OnlyOfficeSaveBackAssetNotFoundError extends Error {
  constructor(assetId: string) {
    super(`OnlyOffice save-back baseline asset ${assetId} was not found.`);
    this.name = "OnlyOfficeSaveBackAssetNotFoundError";
  }
}

export class OnlyOfficeSaveBackDownloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OnlyOfficeSaveBackDownloadError";
  }
}

export class OnlyOfficeSaveBackService {
  private readonly manuscriptRepository: ManuscriptRepository;
  private readonly assetRepository: DocumentAssetRepository;
  private readonly jobRepository: JobRepository;
  private readonly assetService: DocumentAssetService;
  private readonly humanReviewRepository?: Pick<HumanReviewRepository, "saveDiffItems">;
  private readonly humanReviewDiffService?: Pick<HumanReviewDiffService, "extractDiffItems">;
  private readonly sourceBlockResolver?: Pick<EditorialSourceBlockResolver, "resolveBlocks">;
  private readonly uploadRootDir: string;
  private readonly surfaceSessionSecret: string;
  private readonly transactionManager: WriteTransactionManager;
  private readonly createId: () => string;
  private readonly now: () => Date;
  private readonly fetchDocument: (url: string) => Promise<Buffer>;

  constructor(options: OnlyOfficeSaveBackServiceOptions) {
    this.manuscriptRepository = options.manuscriptRepository;
    this.assetRepository = options.assetRepository;
    this.jobRepository = options.jobRepository;
    this.assetService = options.assetService;
    this.humanReviewRepository = options.humanReviewRepository;
    this.humanReviewDiffService = options.humanReviewDiffService;
    this.sourceBlockResolver = options.sourceBlockResolver;
    this.uploadRootDir = path.resolve(options.uploadRootDir);
    this.surfaceSessionSecret =
      options.surfaceSessionSecret?.trim() ??
      process.env.ONLYOFFICE_JWT_SECRET?.trim() ??
      "";
    this.transactionManager =
      options.transactionManager ??
      createWriteTransactionManager({
        manuscriptRepository: this.manuscriptRepository,
        assetRepository: this.assetRepository,
        jobRepository: this.jobRepository,
      });
    this.createId = options.createId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
    this.fetchDocument = options.fetchDocument ?? fetchOnlyOfficeDocument;
  }

  async handleCallback(
    input: OnlyOfficeSaveBackCallbackInput,
  ): Promise<OnlyOfficeSaveBackCallbackResult> {
    const callbackBody = parseCallbackBody(input.body);
    if (!SAVEABLE_CALLBACK_STATUSES.has(callbackBody.status)) {
      if (ACK_ONLY_CALLBACK_STATUSES.has(callbackBody.status)) {
        return { error: 0 };
      }

      throw new OnlyOfficeSaveBackInvalidCallbackError(
        `Unsupported OnlyOffice callback status: ${callbackBody.status}.`,
      );
    }

    const scope = this.verifySaveBackScope(input, callbackBody);
    const baselineAsset = await this.requireBaselineAsset(scope);
    const idempotencyKey = createSaveBackIdempotencyKey(scope);
    const existing = await this.findExistingSaveBack(scope.manuscriptId, idempotencyKey);
    if (existing) {
      return { error: 0 };
    }

    const bytes = await this.fetchDocument(callbackBody.url);
    const storageKey = createSaveBackStorageKey({
      manuscriptId: scope.manuscriptId,
      module: scope.module,
      sessionId: scope.sessionId,
      documentKey: scope.documentKey,
    });
    await writeBufferToUploadRoot({
      rootDir: this.uploadRootDir,
      storageKey,
      bytes,
    });

    let savedWorkingState:
      | {
          scope: VerifiedSaveBackScope;
          outputAsset: DocumentAssetRecord;
          job: JobRecord;
        }
      | undefined;

    await this.transactionManager.withTransaction(async (context) => {
      const repeatedJob = await findExistingSaveBackJob(
        context.jobRepository ?? this.jobRepository,
        scope.manuscriptId,
        idempotencyKey,
      );
      if (repeatedJob) {
        return;
      }

      const timestamp = this.now().toISOString();
      const jobId = this.createId();
      const outputAssetType = scope.outputAssetType;
      const sourceModule = resolveOutputSourceModule(scope);
      const job: JobRecord = {
        id: jobId,
        manuscript_id: scope.manuscriptId,
        module: scope.module,
        job_type: resolveSaveBackJobType(scope),
        status: "completed",
        requested_by: `onlyoffice:${scope.actorRole}`,
        payload: {
          source: "onlyoffice_save_back",
          idempotencyKey,
          sessionId: scope.sessionId,
          documentKey: scope.documentKey,
          saveBackModule: scope.module,
          saveBackPurpose: scope.purpose,
          baselineAssetId: scope.baselineAssetId,
          outputAssetType,
          callbackStatus: callbackBody.status,
          humanReviewStage: "ai_output_human_review",
          storageKey,
          contentHash: createSha256(bytes),
          contentByteLength: bytes.byteLength,
          callbackReceivedAt: timestamp,
          learningSignal: {
            kind:
              scope.purpose === "human_review_working_state"
                ? "human_review_working_state"
                : "human_final_merge",
            status:
              scope.purpose === "human_review_working_state"
                ? "pending_diff_extraction"
                : "pending_semantic_diff",
            reason:
              scope.purpose === "human_review_working_state"
                ? "OnlyOffice saved a human-review working DOCX for diff extraction."
                : "OnlyOffice saved final DOCX; semantic diff extraction is deferred.",
          },
        },
        attempt_count: 1,
        started_at: timestamp,
        finished_at: timestamp,
        created_at: timestamp,
        updated_at: timestamp,
      };
      await (context.jobRepository ?? this.jobRepository).save(job);

      const scopedAssetService = this.assetService.createScoped({
        assetRepository: context.assetRepository,
        manuscriptRepository: context.manuscriptRepository,
      });
      const outputAsset = await scopedAssetService.createAsset({
        manuscriptId: scope.manuscriptId,
        assetType: outputAssetType,
        storageKey,
        mimeType: DOCX_MIME_TYPE,
        createdBy: `onlyoffice:${scope.actorRole}`,
        fileName: createSaveBackFileName(scope, baselineAsset),
        parentAssetId: scope.baselineAssetId,
        sourceModule,
        sourceJobId: jobId,
      });
      const storedOutputAsset =
        scope.purpose === "human_review_working_state"
          ? {
              ...outputAsset,
              is_current: false,
            }
          : outputAsset;
      if (storedOutputAsset !== outputAsset) {
        await context.assetRepository.save(storedOutputAsset);
      }

      const savedJob = {
        ...job,
        payload: {
          ...job.payload,
          outputAssetId: storedOutputAsset.id,
        },
      };
      await (context.jobRepository ?? this.jobRepository).save(savedJob);

      if (scope.purpose === "human_review_working_state") {
        savedWorkingState = {
          scope,
          outputAsset: storedOutputAsset,
          job: savedJob,
        };
      }
    });

    if (savedWorkingState) {
      await this.extractAndPersistHumanReviewDiffs(savedWorkingState);
    }

    return { error: 0 };
  }

  private async extractAndPersistHumanReviewDiffs(input: {
    scope: VerifiedSaveBackScope;
    outputAsset: DocumentAssetRecord;
    job: JobRecord;
  }): Promise<void> {
    if (
      !this.humanReviewRepository ||
      !this.humanReviewDiffService ||
      !this.sourceBlockResolver
    ) {
      return;
    }

    const [baselineBlocks, workingBlocks] = await Promise.all([
      this.sourceBlockResolver.resolveBlocks({
        manuscriptId: input.scope.manuscriptId,
        assetId: input.scope.baselineAssetId,
      }),
      this.sourceBlockResolver.resolveBlocks({
        manuscriptId: input.scope.manuscriptId,
        assetId: input.outputAsset.id,
      }),
    ]);
    const result = this.humanReviewDiffService.extractDiffItems({
      manuscriptId: input.scope.manuscriptId,
      module: input.scope.module,
      baselineAssetId: input.scope.baselineAssetId,
      workingAssetId: input.outputAsset.id,
      baselineBlocks: mapHumanReviewComparableBlocks(baselineBlocks),
      workingBlocks: mapHumanReviewComparableBlocks(workingBlocks),
    });
    await this.humanReviewRepository.saveDiffItems(result.items);

    await this.jobRepository.save({
      ...input.job,
      payload: {
        ...input.job.payload,
        humanReviewDiffItemIds: result.items.map((item) => item.id),
        humanReviewDiffItemCount: result.items.length,
        learningSignal: {
          ...asRecord(input.job.payload?.learningSignal),
          status: result.items.length > 0 ? "diff_extracted" : "no_diff_detected",
        },
      },
      updated_at: this.now().toISOString(),
    });
  }

  private verifySaveBackScope(
    input: OnlyOfficeSaveBackCallbackInput,
    body: SaveBackCallbackBody,
  ): VerifiedSaveBackScope {
    const token = input.surfaceAccessToken?.trim() ?? "";
    if (!token || !this.surfaceSessionSecret) {
      throw new OnlyOfficeSaveBackUnauthorizedError(
        "OnlyOffice save-back callback requires a signed surface access token.",
      );
    }

    const claims = verifySurfaceSessionAccessToken({
      token,
      secret: this.surfaceSessionSecret,
    });
    if (!claims?.save_back) {
      throw new OnlyOfficeSaveBackUnauthorizedError(
        "OnlyOffice save-back callback token is invalid or not scoped for save-back.",
      );
    }

    const sessionId = input.sessionId?.trim() ?? "";
    const module = input.saveBackModule;
    const baselineAssetId = input.baselineAssetId?.trim() ?? "";
    if (sessionId !== claims.session_id) {
      throw new OnlyOfficeSaveBackUnauthorizedError(
        "OnlyOffice save-back session does not match the signed scope.",
      );
    }
    if (!module || module !== claims.save_back.module) {
      throw new OnlyOfficeSaveBackUnauthorizedError(
        "OnlyOffice save-back module does not match the signed scope.",
      );
    }
    if (baselineAssetId !== claims.save_back.baseline_asset_id) {
      throw new OnlyOfficeSaveBackUnauthorizedError(
        "OnlyOffice save-back baseline asset does not match the signed scope.",
      );
    }
    if (!claims.document_key || body.key !== claims.document_key) {
      throw new OnlyOfficeSaveBackUnauthorizedError(
        "OnlyOffice save-back document key does not match the signed scope.",
      );
    }
    if (claims.preview_status !== "ready") {
      throw new OnlyOfficeSaveBackUnauthorizedError(
        "OnlyOffice save-back is only allowed for ready preview sessions.",
      );
    }

    return {
      sessionId: claims.session_id,
      manuscriptId: claims.manuscript_id,
      assetId: claims.asset_id,
      actorRole: claims.actor_role,
      module,
      baselineAssetId,
      documentKey: claims.document_key,
      purpose: claims.save_back.purpose,
      outputAssetType: claims.save_back.output_asset_type,
    };
  }

  private async requireBaselineAsset(
    scope: VerifiedSaveBackScope,
  ): Promise<DocumentAssetRecord> {
    const asset = await this.assetRepository.findById(scope.baselineAssetId);
    if (!asset) {
      throw new OnlyOfficeSaveBackAssetNotFoundError(scope.baselineAssetId);
    }
    if (
      asset.id !== scope.assetId ||
      asset.manuscript_id !== scope.manuscriptId ||
      !isAllowedBaselineForModule(scope.module, asset.asset_type)
    ) {
      throw new OnlyOfficeSaveBackUnauthorizedError(
        "OnlyOffice save-back baseline asset is not valid for the signed module.",
      );
    }

    return asset;
  }

  private async findExistingSaveBack(
    manuscriptId: string,
    idempotencyKey: string,
  ): Promise<JobRecord | undefined> {
    return findExistingSaveBackJob(
      this.jobRepository,
      manuscriptId,
      idempotencyKey,
    );
  }
}

interface SaveBackCallbackBody {
  status: number;
  key: string;
  url: string;
}

interface VerifiedSaveBackScope {
  sessionId: string;
  manuscriptId: string;
  assetId: string;
  actorRole: SurfaceSessionAccessTokenClaims["actor_role"];
  module: "editing" | "proofreading";
  baselineAssetId: string;
  documentKey: string;
  purpose: OnlyOfficeSaveBackPurpose;
  outputAssetType: Extract<
    DocumentAssetType,
    OnlyOfficeSaveBackOutputAssetType
  >;
}

function parseCallbackBody(body: unknown): SaveBackCallbackBody {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new OnlyOfficeSaveBackInvalidCallbackError(
      "OnlyOffice callback body must be a JSON object.",
    );
  }

  const record = body as Record<string, unknown>;
  const status = record.status;
  const key = record.key;
  const url = record.url;
  if (typeof status !== "number" || !Number.isInteger(status)) {
    throw new OnlyOfficeSaveBackInvalidCallbackError(
      "OnlyOffice callback status must be an integer.",
    );
  }

  if (!SAVEABLE_CALLBACK_STATUSES.has(status)) {
    return {
      status,
      key: typeof key === "string" ? key : "",
      url: typeof url === "string" ? url : "",
    };
  }

  if (typeof key !== "string" || key.trim().length === 0) {
    throw new OnlyOfficeSaveBackInvalidCallbackError(
      "OnlyOffice save-back callback requires a document key.",
    );
  }
  if (typeof url !== "string" || url.trim().length === 0) {
    throw new OnlyOfficeSaveBackInvalidCallbackError(
      "OnlyOffice save-back callback requires a saved document URL.",
    );
  }

  return {
    status,
    key: key.trim(),
    url: url.trim(),
  };
}

async function fetchOnlyOfficeDocument(url: string): Promise<Buffer> {
  const resolvedUrl = parseSafeHttpUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(resolvedUrl, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new OnlyOfficeSaveBackDownloadError(
        `OnlyOffice saved document download failed with HTTP ${response.status}.`,
      );
    }

    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_ONLYOFFICE_SAVE_BACK_BYTES
    ) {
      throw new OnlyOfficeSaveBackDownloadError(
        "OnlyOffice saved document exceeds the save-back size limit.",
      );
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > MAX_ONLYOFFICE_SAVE_BACK_BYTES) {
      throw new OnlyOfficeSaveBackDownloadError(
        "OnlyOffice saved document exceeds the save-back size limit.",
      );
    }
    if (bytes.byteLength === 0) {
      throw new OnlyOfficeSaveBackDownloadError(
        "OnlyOffice saved document download was empty.",
      );
    }

    return bytes;
  } catch (error) {
    if (error instanceof OnlyOfficeSaveBackDownloadError) {
      throw error;
    }

    throw new OnlyOfficeSaveBackDownloadError(
      error instanceof Error
        ? error.message
        : "OnlyOffice saved document download failed.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

function parseSafeHttpUrl(url: string): string {
  let resolved: URL;
  try {
    resolved = new URL(url);
  } catch {
    throw new OnlyOfficeSaveBackInvalidCallbackError(
      "OnlyOffice save-back callback URL is invalid.",
    );
  }

  if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
    throw new OnlyOfficeSaveBackInvalidCallbackError(
      "OnlyOffice save-back callback URL must use HTTP or HTTPS.",
    );
  }

  return resolved.toString();
}

async function writeBufferToUploadRoot(input: {
  rootDir: string;
  storageKey: string;
  bytes: Buffer;
}): Promise<void> {
  const rootDir = path.resolve(input.rootDir);
  const absolutePath = path.resolve(rootDir, ...input.storageKey.split("/"));
  const relativePath = path.relative(rootDir, absolutePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new OnlyOfficeSaveBackInvalidCallbackError(
      `OnlyOffice save-back storage path escaped the upload root: "${input.storageKey}".`,
    );
  }

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.bytes);
}

async function findExistingSaveBackJob(
  jobRepository: JobRepository,
  manuscriptId: string,
  idempotencyKey: string,
): Promise<JobRecord | undefined> {
  const jobs = await jobRepository.listByManuscriptId(manuscriptId);
  return jobs.find(
    (job) =>
      job.payload?.source === "onlyoffice_save_back" &&
      job.payload?.idempotencyKey === idempotencyKey &&
      typeof job.payload?.outputAssetId === "string",
  );
}

function createSaveBackIdempotencyKey(scope: VerifiedSaveBackScope): string {
  return [
    scope.sessionId,
    scope.documentKey,
    scope.module,
    scope.baselineAssetId,
  ].join(":");
}

function createSaveBackStorageKey(input: {
  manuscriptId: string;
  module: "editing" | "proofreading";
  sessionId: string;
  documentKey: string;
}): string {
  return [
    "runs",
    sanitizeStorageSegment(input.manuscriptId),
    input.module,
    "onlyoffice-save-back",
    `${sanitizeStorageSegment(input.sessionId)}-${createSha256(
      Buffer.from(input.documentKey),
    ).slice(0, 12)}.docx`,
  ].join("/");
}

function createSaveBackFileName(
  scope: VerifiedSaveBackScope,
  baselineAsset: DocumentAssetRecord,
): string {
  const baseName =
    baselineAsset.file_name?.replace(/\.docx$/iu, "") || scope.module;
  const suffix =
    scope.purpose === "human_review_working_state"
      ? "人工核验工作稿"
      : scope.module === "editing"
        ? "人工复核编辑"
        : "人工终稿";
  return `${baseName}-${suffix}.docx`;
}

function resolveSaveBackJobType(scope: VerifiedSaveBackScope): string {
  if (scope.purpose === "human_review_working_state") {
    return "onlyoffice_human_review_working_save_back";
  }

  return scope.module === "editing"
    ? "onlyoffice_editing_save_back"
    : "onlyoffice_proofreading_human_final_save_back";
}

function resolveOutputSourceModule(scope: VerifiedSaveBackScope): ManuscriptModule {
  if (scope.purpose === "human_review_working_state") {
    return "manual";
  }

  return scope.module === "editing" ? "editing" : "manual";
}

function isAllowedBaselineForModule(
  module: "editing" | "proofreading",
  assetType: DocumentAssetType,
): boolean {
  if (module === "editing") {
    return assetType === "edited_docx";
  }

  return (
    assetType === "edited_docx" ||
    assetType === "final_proof_annotated_docx" ||
    assetType === "human_final_docx"
  );
}

function mapHumanReviewComparableBlocks(
  blocks: readonly EditorialTextBlock[],
): HumanReviewComparableBlock[] {
  return blocks.map((block, index) => {
    const kind = normalizeHumanReviewBlockKind(block.block_kind);

    return {
      key: block.source_locator ?? `${kind}:${index}`,
      kind,
      text: block.text,
      block_index: index,
      ...(block.section ? { section_label: block.section } : {}),
    };
  });
}

function normalizeHumanReviewBlockKind(
  value: string | undefined,
): HumanReviewComparableBlockKind {
  switch (value) {
    case "heading":
    case "table_cell":
    case "table":
    case "image":
    case "caption":
    case "reference_entry":
      return value;
    default:
      return "paragraph";
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sanitizeStorageSegment(value: string): string {
  return value.trim().replace(/[^A-Za-z0-9._-]+/g, "-") || "unknown";
}

function createSha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
