import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { storeInlineUpload } from "../../http/local-upload-storage.ts";
import type { TableEvidenceSourceFile } from "./table-evidence-record.ts";
import type { TableEvidenceRepository } from "./table-evidence-repository.ts";

export const TABLE_EVIDENCE_DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface CreateTableEvidenceSourceFileInput {
  fileName: string;
  mimeType: string;
  fileContentBase64: string;
  actorId: string;
  storageKey?: string;
}

export interface TableEvidenceSourceFileService {
  createSourceFile(
    input: CreateTableEvidenceSourceFileInput,
  ): Promise<TableEvidenceSourceFile>;
  resolveSourcePath(sourceFile: TableEvidenceSourceFile): Promise<string>;
}

export class LocalTableEvidenceSourceFileService
  implements TableEvidenceSourceFileService
{
  private readonly repository: TableEvidenceRepository;
  private readonly rootDir: string;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: {
    repository: TableEvidenceRepository;
    rootDir: string;
    createId?: () => string;
    now?: () => Date;
  }) {
    this.repository = options.repository;
    this.rootDir = path.resolve(options.rootDir);
    this.createId = options.createId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  async createSourceFile(
    input: CreateTableEvidenceSourceFileInput,
  ): Promise<TableEvidenceSourceFile> {
    assertDocxUpload(input.fileName, input.mimeType);

    const normalizedBase64 = normalizeBase64Payload(input.fileContentBase64);
    const bytes = decodeBase64Payload(normalizedBase64);
    const stored = await storeInlineUpload({
      rootDir: this.rootDir,
      fileName: input.fileName,
      fileContentBase64: normalizedBase64,
      storageKey: input.storageKey,
      now: this.now,
      createId: this.createId,
    });
    const record: TableEvidenceSourceFile = {
      id: this.createId(),
      storage_key: stored.storageKey,
      file_name: input.fileName,
      mime_type: input.mimeType,
      byte_length: stored.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      uploaded_by: input.actorId,
      uploaded_at: this.now().toISOString(),
    };

    await this.repository.saveSourceFile(record);
    return record;
  }

  async resolveSourcePath(sourceFile: TableEvidenceSourceFile): Promise<string> {
    return resolveStoragePath(this.rootDir, sourceFile.storage_key);
  }
}

function assertDocxUpload(fileName: string, mimeType: string): void {
  if (path.extname(fileName).toLowerCase() !== ".docx") {
    throw new Error("Table evidence source files must use the .docx extension.");
  }

  if (mimeType !== TABLE_EVIDENCE_DOCX_MIME) {
    throw new Error(
      `Table evidence source files must use MIME ${TABLE_EVIDENCE_DOCX_MIME}.`,
    );
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
    throw new Error(`Resolved table evidence source path escaped root: "${storageKey}".`);
  }

  return absolutePath;
}

function normalizeBase64Payload(payload: string): string {
  const trimmed = payload.trim();
  if (!trimmed) {
    throw new Error("Inline DOCX payload was empty.");
  }

  return trimmed.replace(/^data:[^;]+;base64,/i, "").replace(/\s+/g, "");
}

function decodeBase64Payload(payload: string): Buffer {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(payload) || payload.length % 4 === 1) {
    throw new Error("Inline DOCX payload was not valid base64.");
  }

  const buffer = Buffer.from(payload, "base64");
  const normalizedInput = payload.replace(/=+$/, "");
  const normalizedRoundTrip = buffer.toString("base64").replace(/=+$/, "");
  if (normalizedInput !== normalizedRoundTrip) {
    throw new Error("Inline DOCX payload was not valid base64.");
  }

  return buffer;
}
