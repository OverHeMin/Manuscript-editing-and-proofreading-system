import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  DocumentAssetRecord,
  DocumentAssetRepository,
} from "../modules/assets/index.ts";
import type { ManuscriptRecord } from "../modules/manuscripts/index.ts";
import type { ManuscriptRepository } from "../modules/manuscripts/manuscript-repository.ts";

const DOCX_ASSET_TYPES = new Set<DocumentAssetRecord["asset_type"]>([
  "original",
  "normalized_docx",
  "edited_docx",
  "final_proof_annotated_docx",
  "human_final_docx",
]);

const REPORT_ASSET_TYPES = new Set<DocumentAssetRecord["asset_type"]>([
  "screening_report",
  "proofreading_draft_report",
  "final_proof_issue_report",
  "pdf_consistency_report",
  "learning_snapshot_attachment",
]);

const MATERIALIZE_DOCX_SCRIPT = path.resolve(
  import.meta.dirname,
  "../../../worker-py/src/document_pipeline/materialize_docx.py",
);

export class DocumentAssetDownloadNotFoundError extends Error {
  constructor(assetId: string) {
    super(`Document asset ${assetId} was not found.`);
    this.name = "DocumentAssetDownloadNotFoundError";
  }
}

export class DocumentAssetDownloadUnsupportedError extends Error {
  constructor(assetId: string, assetType: string) {
    super(`Document asset ${assetId} with type ${assetType} is not downloadable in V1.`);
    this.name = "DocumentAssetDownloadUnsupportedError";
  }
}

export interface DownloadableDocumentAsset {
  asset: DocumentAssetRecord;
  fileName: string;
  mimeType: string;
  storageKey: string;
  absolutePath: string;
  bytes: Buffer;
}

export interface LocalAssetMaterializationServiceOptions {
  assetRepository: DocumentAssetRepository;
  manuscriptRepository: ManuscriptRepository;
  rootDir: string;
}

export class LocalAssetMaterializationService {
  private readonly assetRepository: DocumentAssetRepository;
  private readonly manuscriptRepository: ManuscriptRepository;
  private readonly rootDir: string;

  constructor(options: LocalAssetMaterializationServiceOptions) {
    this.assetRepository = options.assetRepository;
    this.manuscriptRepository = options.manuscriptRepository;
    this.rootDir = path.resolve(options.rootDir);
  }

  async downloadAsset(assetId: string): Promise<DownloadableDocumentAsset> {
    const asset = await this.assetRepository.findById(assetId);
    if (!asset) {
      throw new DocumentAssetDownloadNotFoundError(assetId);
    }

    const manuscript = await this.manuscriptRepository.findById(asset.manuscript_id);
    if (!manuscript) {
      throw new DocumentAssetDownloadNotFoundError(assetId);
    }

    const absolutePath = resolveStoragePath(this.rootDir, asset.storage_key);
    const bytes = await this.ensureMaterialized(asset, manuscript, absolutePath);

    return {
      asset,
      fileName: resolveDownloadFileName(asset),
      mimeType: asset.mime_type,
      storageKey: asset.storage_key,
      absolutePath,
      bytes,
    };
  }

  private async ensureMaterialized(
    asset: DocumentAssetRecord,
    manuscript: ManuscriptRecord,
    absolutePath: string,
  ): Promise<Buffer> {
    try {
      return await readFile(absolutePath);
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }

    if (DOCX_ASSET_TYPES.has(asset.asset_type)) {
      return this.materializeDocxAsset(asset, manuscript, absolutePath);
    }

    if (REPORT_ASSET_TYPES.has(asset.asset_type)) {
      return this.materializeReportAsset(asset, manuscript, absolutePath);
    }

    throw new DocumentAssetDownloadUnsupportedError(asset.id, asset.asset_type);
  }

  private async materializeDocxAsset(
    asset: DocumentAssetRecord,
    manuscript: ManuscriptRecord,
    absolutePath: string,
  ): Promise<Buffer> {
    await mkdir(path.dirname(absolutePath), { recursive: true });

    const sourcePath = await this.resolveNearestSourceDocxPath(asset);
    await runDocxMaterializer({
      outputPath: absolutePath,
      title: manuscript.title,
      manuscriptId: manuscript.id,
      assetType: asset.asset_type,
      sourcePath,
    });

    return readFile(absolutePath);
  }

  private async materializeReportAsset(
    asset: DocumentAssetRecord,
    manuscript: ManuscriptRecord,
    absolutePath: string,
  ): Promise<Buffer> {
    await mkdir(path.dirname(absolutePath), { recursive: true });
    const content = buildReportContent(asset, manuscript);
    await writeFile(absolutePath, content, "utf8");
    return Buffer.from(content, "utf8");
  }

  private async resolveNearestSourceDocxPath(
    asset: DocumentAssetRecord,
  ): Promise<string | undefined> {
    const manuscriptAssets = await this.assetRepository.listByManuscriptId(asset.manuscript_id);
    const assetsById = new Map(manuscriptAssets.map((record) => [record.id, record]));
    const visited = new Set<string>();
    let current: DocumentAssetRecord | undefined = asset;

    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      const parentId: string | undefined = current.parent_asset_id;
      current = parentId ? assetsById.get(parentId) : undefined;

      if (current && DOCX_ASSET_TYPES.has(current.asset_type)) {
        const candidatePath = resolveStoragePath(this.rootDir, current.storage_key);
        try {
          await readFile(candidatePath);
          return candidatePath;
        } catch (error) {
          if (!isMissingFileError(error)) {
            throw error;
          }
        }
      }
    }

    return undefined;
  }
}

function resolveStoragePath(rootDir: string, storageKey: string): string {
  const normalizedSegments = storageKey
    .replaceAll("\\", "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  const absolutePath = path.resolve(rootDir, ...normalizedSegments);
  const relativePath = path.relative(rootDir, absolutePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Resolved asset path escaped the configured root: "${storageKey}".`);
  }

  return absolutePath;
}

function resolveDownloadFileName(asset: DocumentAssetRecord): string {
  if (asset.file_name?.trim()) {
    return asset.file_name.trim();
  }

  if (asset.mime_type === "text/markdown") {
    return `${asset.asset_type}.md`;
  }

  if (
    asset.mime_type ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return `${asset.asset_type}.docx`;
  }

  return `${asset.asset_type}.bin`;
}

function buildReportContent(
  asset: DocumentAssetRecord,
  manuscript: ManuscriptRecord,
): string {
  return [
    `# ${asset.asset_type}`,
    "",
    `- Manuscript: ${manuscript.id}`,
    `- Title: ${manuscript.title}`,
    `- Asset: ${asset.id}`,
    `- Source Module: ${asset.source_module}`,
    `- Generated By: ${asset.created_by}`,
    "",
    "This report artifact was materialized from the current V1 governance record.",
  ].join("\n");
}

function buildPythonCandidates(): string[] {
  const configured = process.env.PYTHON_BIN?.trim();
  const candidates = [configured, "python", "python3"].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  return [...new Set(candidates)];
}

async function runDocxMaterializer(input: {
  outputPath: string;
  title: string;
  manuscriptId: string;
  assetType: string;
  sourcePath?: string;
}): Promise<void> {
  let lastError: Error | undefined;

  for (const pythonBin of buildPythonCandidates()) {
    try {
      await runPythonScript(pythonBin, input);
      return;
    } catch (error) {
      if (isCommandMissing(error)) {
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  throw lastError ?? new Error("No usable Python interpreter was found for DOCX materialization.");
}

function runPythonScript(
  pythonBin: string,
  input: {
    outputPath: string;
    title: string;
    manuscriptId: string;
    assetType: string;
    sourcePath?: string;
  },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      MATERIALIZE_DOCX_SCRIPT,
      "--output-path",
      input.outputPath,
      "--title",
      input.title,
      "--manuscript-id",
      input.manuscriptId,
      "--asset-type",
      input.assetType,
    ];

    if (input.sourcePath) {
      args.push("--source-path", input.sourcePath);
    }

    const child = spawn(pythonBin, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `DOCX materializer failed with exit code ${code ?? "unknown"}: ${stderr.trim() || "No stderr output."}`,
        ),
      );
    });
  });
}

function isCommandMissing(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
