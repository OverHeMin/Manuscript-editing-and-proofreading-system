import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";
import type { TableEvidenceSnapshot } from "./table-evidence-record.ts";

export interface TableEvidenceRepository {
  findByAssetHash(input: {
    assetId: string;
    docxHash: string;
    parserVersion: string;
  }): Promise<TableEvidenceSnapshot | undefined>;
  save(snapshot: TableEvidenceSnapshot): Promise<TableEvidenceSnapshot>;
}

export interface TableEvidenceWorker {
  extract(input: {
    manuscriptId: string;
    assetId: string;
    sourcePath: string;
    sourceStorageKey: string;
    docxHash: string;
    parserVersion: string;
    snapshotId: string;
    createdAt: string;
  }): Promise<TableEvidenceSnapshot>;
}

export interface TableEvidenceCenterOptions {
  rootDir: string;
  assetRepository: Pick<DocumentAssetRepository, "findById">;
  repository?: TableEvidenceRepository;
  worker: TableEvidenceWorker;
  parserVersion?: string;
  now?: () => Date;
  createId?: () => string;
}

export class TableEvidenceCenter {
  private readonly rootDir: string;
  private readonly assetRepository: Pick<DocumentAssetRepository, "findById">;
  private readonly repository: TableEvidenceRepository;
  private readonly worker: TableEvidenceWorker;
  private readonly parserVersion: string;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: TableEvidenceCenterOptions) {
    this.rootDir = path.resolve(options.rootDir);
    this.assetRepository = options.assetRepository;
    this.repository = options.repository ?? new InMemoryTableEvidenceRepository();
    this.worker = options.worker;
    this.parserVersion = options.parserVersion ?? "lossless-table-evidence-v1";
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? (() => randomUUID());
  }

  async getOrCreateSnapshot(input: {
    manuscriptId: string;
    assetId: string;
  }): Promise<TableEvidenceSnapshot> {
    const asset = await this.assetRepository.findById(input.assetId);
    if (!asset) {
      return buildFailedSnapshot({
        manuscriptId: input.manuscriptId,
        assetId: input.assetId,
        sourceStorageKey: input.assetId,
        parserVersion: this.parserVersion,
        snapshotId: this.createId(),
        createdAt: this.now().toISOString(),
        message: `The source asset ${input.assetId} could not be found for table evidence extraction.`,
      });
    }

    const sourcePath = resolveStoragePath(this.rootDir, asset.storage_key);
    let sourceBytes: Buffer;
    try {
      sourceBytes = await readFile(sourcePath);
    } catch (error) {
      return buildFailedSnapshot({
        manuscriptId: input.manuscriptId,
        assetId: asset.id,
        sourceStorageKey: asset.storage_key,
        parserVersion: this.parserVersion,
        snapshotId: this.createId(),
        createdAt: this.now().toISOString(),
        code: "source_read_failed",
        message: `The source DOCX could not be read for table evidence extraction: ${formatErrorMessage(error)}`,
      });
    }
    const docxHash = sha256Buffer(sourceBytes);
    const cached = await this.repository.findByAssetHash({
      assetId: asset.id,
      docxHash,
      parserVersion: this.parserVersion,
    });
    if (cached) {
      return cached;
    }

    const snapshotId = this.createId();
    const createdAt = this.now().toISOString();
    let snapshot: TableEvidenceSnapshot;
    try {
      snapshot = await this.worker.extract({
        manuscriptId: input.manuscriptId,
        assetId: asset.id,
        sourcePath,
        sourceStorageKey: asset.storage_key,
        docxHash,
        parserVersion: this.parserVersion,
        snapshotId,
        createdAt,
      });
    } catch (error) {
      snapshot = buildFailedSnapshot({
        manuscriptId: input.manuscriptId,
        assetId: asset.id,
        sourceStorageKey: asset.storage_key,
        docxHash,
        parserVersion: this.parserVersion,
        snapshotId,
        createdAt,
        code: "worker_failed",
        message: `The table evidence worker failed: ${formatErrorMessage(error)}`,
      });
    }

    if (snapshot.status === "failed") {
      return snapshot;
    }

    return this.repository.save(snapshot);
  }
}

export class InMemoryTableEvidenceRepository implements TableEvidenceRepository {
  private readonly snapshots: TableEvidenceSnapshot[] = [];

  async findByAssetHash(input: {
    assetId: string;
    docxHash: string;
    parserVersion: string;
  }): Promise<TableEvidenceSnapshot | undefined> {
    return this.snapshots.find(
      (snapshot) =>
        snapshot.assetId === input.assetId &&
        snapshot.docxHash === input.docxHash &&
        snapshot.parserVersion === input.parserVersion,
    );
  }

  async save(snapshot: TableEvidenceSnapshot): Promise<TableEvidenceSnapshot> {
    const existingIndex = this.snapshots.findIndex(
      (entry) => entry.snapshotId === snapshot.snapshotId,
    );
    const stored = structuredClone(snapshot);
    if (existingIndex >= 0) {
      this.snapshots[existingIndex] = stored;
    } else {
      this.snapshots.push(stored);
    }
    return structuredClone(stored);
  }
}

export class LocalFileTableEvidenceRepository implements TableEvidenceRepository {
  private readonly rootDir: string;

  constructor(options: { rootDir: string; cacheDir?: string }) {
    this.rootDir = path.resolve(
      options.cacheDir ?? path.join(options.rootDir, ".table-evidence-cache"),
    );
  }

  async findByAssetHash(input: {
    assetId: string;
    docxHash: string;
    parserVersion: string;
  }): Promise<TableEvidenceSnapshot | undefined> {
    try {
      const content = await readFile(this.resolveSnapshotPath(input), "utf8");
      const parsed = JSON.parse(content) as TableEvidenceSnapshot;
      return parsed.assetId === input.assetId &&
        parsed.docxHash === input.docxHash &&
        parsed.parserVersion === input.parserVersion
        ? parsed
        : undefined;
    } catch (error) {
      if (isFileNotFoundError(error)) {
        return undefined;
      }
      throw error;
    }
  }

  async save(snapshot: TableEvidenceSnapshot): Promise<TableEvidenceSnapshot> {
    const snapshotPath = this.resolveSnapshotPath({
      assetId: snapshot.assetId,
      docxHash: snapshot.docxHash,
      parserVersion: snapshot.parserVersion,
    });
    await mkdir(path.dirname(snapshotPath), { recursive: true });
    await writeFile(snapshotPath, JSON.stringify(snapshot), "utf8");
    return structuredClone(snapshot);
  }

  private resolveSnapshotPath(input: {
    assetId: string;
    docxHash: string;
    parserVersion: string;
  }): string {
    return path.join(
      this.rootDir,
      sanitizePathSegment(input.assetId),
      sanitizePathSegment(input.parserVersion),
      `${sanitizePathSegment(input.docxHash || "unknown")}.json`,
    );
  }
}

function buildFailedSnapshot(input: {
  manuscriptId: string;
  assetId: string;
  sourceStorageKey: string;
  docxHash?: string;
  parserVersion: string;
  snapshotId: string;
  createdAt: string;
  code?: string;
  message: string;
}): TableEvidenceSnapshot {
  return {
    snapshotId: input.snapshotId,
    manuscriptId: input.manuscriptId,
    assetId: input.assetId,
    sourceStorageKey: input.sourceStorageKey,
    docxHash: input.docxHash ?? "",
    parserVersion: input.parserVersion,
    createdAt: input.createdAt,
    status: "failed",
    tables: [],
    warnings: [
      {
        code: input.code ?? "asset_not_found",
        message: input.message,
      },
    ],
  };
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
    throw new Error(`Resolved table evidence path escaped root: "${storageKey}".`);
  }
  return absolutePath;
}

function sha256Buffer(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function isFileNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}
