import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";
import type { DocumentAssetRecord } from "../assets/document-asset-record.ts";
import { DocumentAssetService } from "../assets/document-asset-service.ts";

const DOC_MIME_TYPES = new Set(["application/msword"]);
const DOCX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type SourceDocumentType = "doc" | "docx";
export type DocumentConversionStatus =
  | "queued"
  | "completed"
  | "not_required"
  | "tool_unavailable";
export type DocumentPreviewStatus = "ready" | "pending_normalization";

export interface DocumentNormalizationRequest {
  manuscriptId: string;
  sourceAssetId: string;
  fileName: string;
  mimeType: string;
  storageKey: string;
}

export interface DocumentPipelineToolingStatus {
  libreOfficeAvailable: boolean;
}

export type DocumentConversionResult =
  | {
      status: "converted";
    }
  | {
      status: "failed" | "tool_unavailable";
      error?: string;
    };

export interface DocumentToDocxConverter {
  convertDocToDocx(input: {
    sourceStorageKey: string;
    targetStorageKey: string;
  }): Promise<DocumentConversionResult>;
}

export interface DocumentNormalizationPlan {
  manuscript_id: string;
  source_asset_id: string;
  source_type: SourceDocumentType;
  current_type: SourceDocumentType;
  target_type: "docx";
  derived_asset: {
    asset_type: "normalized_docx";
    parent_asset_id: string;
    file_name: string;
    mime_type: string;
    storage_key: string;
  };
  conversion: {
    required: boolean;
    backend: "libreoffice" | null;
    status: DocumentConversionStatus;
    audit?: DocumentNormalizationAudit;
  };
  preview: {
    viewer: "onlyoffice";
    status: DocumentPreviewStatus;
    source_asset_type: "normalized_docx";
    mime_type: string;
  };
  warnings: string[];
}

export interface DocumentNormalizationWorkflowInput
  extends DocumentNormalizationRequest {
  createdBy: string;
  sourceJobId?: string;
}

export interface DocumentNormalizationExecutionResult {
  plan: DocumentNormalizationPlan;
  normalized_asset?: DocumentAssetRecord;
  preview: {
    viewer: "onlyoffice";
    status: DocumentPreviewStatus;
    source_asset_type: "normalized_docx";
    source_asset_id?: string;
    mime_type: string;
    warnings: string[];
  };
}

export interface DocumentNormalizationAudit {
  backend: "libreoffice" | "copy";
  status: "completed" | "tool_unavailable" | "failed";
  sourceStorageKey: string;
  targetStorageKey: string;
  sourceSha256?: string;
  normalizedSha256?: string;
  command?: string;
  args?: string[];
  libreOfficeVersion?: string;
  stdoutSummary?: string;
  stderrSummary?: string;
  outputPath?: string;
  failureMessage?: string;
}

export class UnsupportedDocumentFormatError extends Error {
  constructor(fileName: string, mimeType: string) {
    super(`Unsupported document format for ${fileName} (${mimeType}).`);
    this.name = "UnsupportedDocumentFormatError";
  }
}

function sniffDocumentType(fileName: string, mimeType: string): SourceDocumentType {
  const normalizedFileName = fileName.toLowerCase();

  if (normalizedFileName.endsWith(".docx")) {
    return "docx";
  }

  if (normalizedFileName.endsWith(".doc")) {
    return "doc";
  }

  if (DOCX_MIME_TYPES.has(mimeType)) {
    return "docx";
  }

  if (DOC_MIME_TYPES.has(mimeType)) {
    return "doc";
  }

  throw new UnsupportedDocumentFormatError(fileName, mimeType);
}

function buildNormalizedFileName(fileName: string): string {
  const extensionIndex = fileName.lastIndexOf(".");
  const baseName =
    extensionIndex >= 0 ? fileName.slice(0, extensionIndex) : fileName;

  return `${baseName}.normalized.docx`;
}

function buildNormalizedStorageKey(
  manuscriptId: string,
  sourceAssetId: string,
  fileName: string,
): string {
  return `normalized/${manuscriptId}/${sourceAssetId}/${buildNormalizedFileName(fileName)}`;
}

export class DocumentNormalizationService {
  planNormalization(
    request: DocumentNormalizationRequest,
    tooling: DocumentPipelineToolingStatus,
  ): DocumentNormalizationPlan {
    const sourceType = sniffDocumentType(request.fileName, request.mimeType);
    const conversionRequired = sourceType === "doc";
    const warnings: string[] = [];

    let conversionStatus: DocumentConversionStatus;
    let conversionBackend: "libreoffice" | null;

    if (conversionRequired && tooling.libreOfficeAvailable) {
      conversionStatus = "queued";
      conversionBackend = "libreoffice";
    } else if (conversionRequired) {
      conversionStatus = "tool_unavailable";
      conversionBackend = "libreoffice";
      warnings.push(
        "LibreOffice unavailable; doc to docx normalization deferred.",
      );
    } else {
      conversionStatus = "not_required";
      conversionBackend = null;
    }

    return {
      manuscript_id: request.manuscriptId,
      source_asset_id: request.sourceAssetId,
      source_type: sourceType,
      current_type: sourceType,
      target_type: "docx",
      derived_asset: {
        asset_type: "normalized_docx",
        parent_asset_id: request.sourceAssetId,
        file_name: buildNormalizedFileName(request.fileName),
        mime_type: DOCX_MIME_TYPE,
        storage_key: buildNormalizedStorageKey(
          request.manuscriptId,
          request.sourceAssetId,
          request.fileName,
        ),
      },
      conversion: {
        required: conversionRequired,
        backend: conversionBackend,
        status: conversionStatus,
        ...(conversionStatus === "tool_unavailable"
          ? {
              audit: {
                backend: "libreoffice",
                status: "tool_unavailable",
                sourceStorageKey: request.storageKey,
                targetStorageKey: buildNormalizedStorageKey(
                  request.manuscriptId,
                  request.sourceAssetId,
                  request.fileName,
                ),
              } satisfies DocumentNormalizationAudit,
            }
          : {}),
      },
      preview: {
        viewer: "onlyoffice",
        status: conversionRequired ? "pending_normalization" : "ready",
        source_asset_type: "normalized_docx",
        mime_type: DOCX_MIME_TYPE,
      },
      warnings,
    };
  }
}

export interface DocumentNormalizationWorkflowServiceOptions {
  normalizationService: DocumentNormalizationService;
  assetService: DocumentAssetService;
  toolingStatus: DocumentPipelineToolingStatus;
  converter?: DocumentNormalizationConverter;
}

export class DocumentNormalizationWorkflowService {
  private readonly normalizationService: DocumentNormalizationService;
  private readonly assetService: DocumentAssetService;
  private readonly toolingStatus: DocumentPipelineToolingStatus;
  private readonly converter?: DocumentNormalizationConverter;

  constructor(options: DocumentNormalizationWorkflowServiceOptions) {
    this.normalizationService = options.normalizationService;
    this.assetService = options.assetService;
    this.toolingStatus = options.toolingStatus;
    this.converter = options.converter;
  }

  async normalize(
    input: DocumentNormalizationWorkflowInput,
  ): Promise<DocumentNormalizationExecutionResult> {
    const plan = this.normalizationService.planNormalization(
      input,
      this.toolingStatus,
    );

    let normalizedAsset = await this.findExistingNormalizedAsset(input);
    const warnings = [...plan.warnings];

    if (!normalizedAsset && plan.conversion.status === "not_required" && this.converter) {
      const conversionResult = await this.converter.convert({
        sourceStorageKey: input.storageKey,
        targetStorageKey: plan.derived_asset.storage_key,
        sourceType: plan.source_type,
      });
      plan.conversion.audit = conversionResult.audit;
      normalizedAsset = await this.registerNormalizedAsset({
        manuscriptId: input.manuscriptId,
        sourceAssetId: input.sourceAssetId,
        storageKey: conversionResult.targetStorageKey,
        fileName: plan.derived_asset.file_name,
        mimeType: plan.derived_asset.mime_type,
        createdBy: input.createdBy,
        sourceJobId: input.sourceJobId,
      });
    }

    if (!normalizedAsset && plan.conversion.status === "not_required") {
      normalizedAsset = await this.registerNormalizedAsset({
        manuscriptId: input.manuscriptId,
        sourceAssetId: input.sourceAssetId,
        storageKey: input.storageKey,
        fileName: plan.derived_asset.file_name,
        mimeType: plan.derived_asset.mime_type,
        createdBy: input.createdBy,
        sourceJobId: input.sourceJobId,
      });
    }

    if (!normalizedAsset && plan.conversion.status === "queued") {
      if (!this.converter) {
        warnings.push(
          "Document conversion was queued but no converter is configured.",
        );
      } else {
        try {
          const conversionResult = await this.converter.convert({
            sourceStorageKey: input.storageKey,
            targetStorageKey: plan.derived_asset.storage_key,
            sourceType: plan.source_type,
          });
          plan.conversion.audit = conversionResult.audit;
          normalizedAsset = await this.registerNormalizedAsset({
            manuscriptId: input.manuscriptId,
            sourceAssetId: input.sourceAssetId,
            storageKey: conversionResult.targetStorageKey,
            fileName: plan.derived_asset.file_name,
            mimeType: plan.derived_asset.mime_type,
            createdBy: input.createdBy,
            sourceJobId: input.sourceJobId,
          });
          plan.conversion.status = "completed";
          plan.preview.status = "ready";
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          warnings.push(
            message ||
              "DOC to DOCX conversion failed; normalization remains pending.",
          );
          plan.conversion.audit = {
            backend: "libreoffice",
            status: "failed",
            sourceStorageKey: input.storageKey,
            targetStorageKey: plan.derived_asset.storage_key,
            failureMessage: message,
          };
        }
      }
    }

    return {
      plan,
      normalized_asset: normalizedAsset,
      preview: {
        viewer: "onlyoffice",
        status: normalizedAsset ? "ready" : "pending_normalization",
        source_asset_type: "normalized_docx",
        source_asset_id: normalizedAsset?.id ?? input.sourceAssetId,
        mime_type: plan.preview.mime_type,
        warnings,
      },
    };
  }

  private async findExistingNormalizedAsset(
    input: DocumentNormalizationWorkflowInput,
  ): Promise<DocumentAssetRecord | undefined> {
    const assets = await this.assetService.listAssets(input.manuscriptId);
    return assets.find(
      (asset) =>
        asset.asset_type === "normalized_docx" &&
        asset.parent_asset_id === input.sourceAssetId &&
        asset.status !== "archived",
    );
  }

  registerNormalizedAsset(input: {
    manuscriptId: string;
    sourceAssetId: string;
    storageKey: string;
    fileName: string;
    mimeType: string;
    createdBy: string;
    sourceJobId?: string;
  }): Promise<DocumentAssetRecord> {
    return this.assetService.createAsset({
      manuscriptId: input.manuscriptId,
      assetType: "normalized_docx",
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      createdBy: input.createdBy,
      fileName: input.fileName,
      parentAssetId: input.sourceAssetId,
      sourceModule: "upload",
      sourceJobId: input.sourceJobId,
    });
  }
}

export interface DocumentNormalizationConverter {
  convert(input: {
    sourceStorageKey: string;
    targetStorageKey: string;
    sourceType?: SourceDocumentType;
  }): Promise<{
    status: "completed";
    targetStorageKey: string;
    audit: DocumentNormalizationAudit;
  }>;
}

export interface LocalDocumentNormalizationCommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface LocalDocumentNormalizationConverterOptions {
  rootDir: string;
  libreOfficeAvailable: boolean;
  libreOfficeBinary?: string;
  libreOfficeVersion?: string;
  runCommand?: (input: {
    command: string;
    args: string[];
    outputDir: string;
  }) => Promise<LocalDocumentNormalizationCommandResult>;
}

export class LocalDocumentNormalizationConverter
  implements DocumentNormalizationConverter
{
  private readonly rootDir: string;
  private readonly libreOfficeAvailable: boolean;
  private readonly libreOfficeBinary?: string;
  private readonly libreOfficeVersion?: string;
  private readonly runCommand: (
    input: {
      command: string;
      args: string[];
      outputDir: string;
    },
  ) => Promise<LocalDocumentNormalizationCommandResult>;

  constructor(options: LocalDocumentNormalizationConverterOptions) {
    this.rootDir = path.resolve(options.rootDir);
    this.libreOfficeAvailable = options.libreOfficeAvailable;
    this.libreOfficeBinary = options.libreOfficeBinary;
    this.libreOfficeVersion = options.libreOfficeVersion;
    this.runCommand = options.runCommand ?? runLocalCommand;
  }

  async convert(input: {
    sourceStorageKey: string;
    targetStorageKey: string;
    sourceType?: SourceDocumentType;
  }): Promise<{
    status: "completed";
    targetStorageKey: string;
    audit: DocumentNormalizationAudit;
  }> {
    const sourcePath = this.resolveStoragePath(input.sourceStorageKey);
    const targetPath = this.resolveStoragePath(input.targetStorageKey);
    await mkdir(path.dirname(targetPath), { recursive: true });
    const sourceSha256 = await sha256File(sourcePath);

    if (input.sourceType === "docx") {
      await copyFile(sourcePath, targetPath);
      return {
        status: "completed",
        targetStorageKey: input.targetStorageKey,
        audit: {
          backend: "copy",
          status: "completed",
          sourceStorageKey: input.sourceStorageKey,
          targetStorageKey: input.targetStorageKey,
          sourceSha256,
          normalizedSha256: await sha256File(targetPath),
          outputPath: targetPath,
        },
      };
    }

    if (!this.libreOfficeAvailable) {
      throw new Error("LibreOffice is unavailable for doc normalization.");
    }

    const binary = this.libreOfficeBinary ?? resolveLibreOfficeBinary();
    if (!binary) {
      throw new Error("LibreOffice binary could not be resolved for doc normalization.");
    }

    const outputDir = path.dirname(targetPath);
    const args = [
      "--headless",
      "--convert-to",
      "docx",
      "--outdir",
      outputDir,
      sourcePath,
    ];
    const result = await this.runCommand({
      command: binary,
      args,
      outputDir,
    });

    if (result.exitCode !== 0) {
      throw new Error(
        `LibreOffice doc normalization failed: ${result.stderr || result.stdout || "no output"}`,
      );
    }

    const convertedPath = path.join(
      outputDir,
      `${path.parse(sourcePath).name}.docx`,
    );
    await stat(convertedPath);
    if (path.resolve(convertedPath) !== targetPath) {
      await rename(convertedPath, targetPath);
    }

    return {
      status: "completed",
      targetStorageKey: input.targetStorageKey,
      audit: {
        backend: "libreoffice",
        status: "completed",
        sourceStorageKey: input.sourceStorageKey,
        targetStorageKey: input.targetStorageKey,
        sourceSha256,
        normalizedSha256: await sha256File(targetPath),
        command: binary,
        args,
        ...(this.libreOfficeVersion
          ? { libreOfficeVersion: this.libreOfficeVersion }
          : {}),
        stdoutSummary: summarizeCommandOutput(result.stdout),
        stderrSummary: summarizeCommandOutput(result.stderr),
        outputPath: targetPath,
      },
    };
  }

  private resolveStoragePath(storageKey: string): string {
    const segments = storageKey
      .replaceAll("\\", "/")
      .split("/")
      .filter((segment) => segment.length > 0);
    const resolved = path.resolve(this.rootDir, ...segments);

    if (!resolved.startsWith(this.rootDir)) {
      throw new Error(`Storage key escaped the upload root: ${storageKey}`);
    }

    return resolved;
  }
}

function resolveLibreOfficeBinary(): string | undefined {
  if (process.platform === "win32") {
    return "C:\\Program Files\\LibreOffice\\program\\soffice.exe";
  }

  return "libreoffice";
}

function summarizeCommandOutput(value: string, maxLength = 500): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength)}…`
    : normalized;
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });

  return hash.digest("hex");
}

async function runLocalCommand(input: {
  command: string;
  args: string[];
}): Promise<LocalDocumentNormalizationCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(input.command, input.args, {
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({
        exitCode,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}
