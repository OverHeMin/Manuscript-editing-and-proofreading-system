import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_INLINE_UPLOAD_BYTES = 20 * 1024 * 1024;

export class InlineUploadStorageReferenceRequiredError extends Error {
  constructor() {
    super("Manuscript upload requires either a storageKey or inline fileContentBase64.");
    this.name = "InlineUploadStorageReferenceRequiredError";
  }
}

export class InlineUploadPayloadInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InlineUploadPayloadInvalidError";
  }
}

export class InlineUploadPayloadTooLargeError extends Error {
  constructor(byteLength: number) {
    super(
      `Inline upload payload exceeds the V1 limit of ${MAX_INLINE_UPLOAD_BYTES} bytes. Received ${byteLength} bytes.`,
    );
    this.name = "InlineUploadPayloadTooLargeError";
  }
}

export interface StoreInlineUploadInput {
  rootDir: string;
  fileName: string;
  fileContentBase64: string;
  storageKey?: string;
  now?: () => Date;
  createId?: () => string;
}

export interface StoredInlineUploadResult {
  storageKey: string;
  absolutePath: string;
  byteLength: number;
}

export async function storeInlineUpload(
  input: StoreInlineUploadInput,
): Promise<StoredInlineUploadResult> {
  const normalizedBase64 = normalizeBase64Payload(input.fileContentBase64);
  const buffer = decodeBase64Payload(normalizedBase64);
  const storageKey =
    input.storageKey?.trim().length
      ? normalizeStorageKey(input.storageKey)
      : createGeneratedStorageKey(
          input.fileName,
          input.now ?? (() => new Date()),
          input.createId ?? (() => randomUUID()),
        );
  const rootDir = path.resolve(input.rootDir);
  const absolutePath = path.resolve(rootDir, ...storageKey.split("/"));

  if (!absolutePath.startsWith(rootDir)) {
    throw new InlineUploadPayloadInvalidError(
      `Resolved upload path escaped the configured root: "${storageKey}".`,
    );
  }

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  return {
    storageKey,
    absolutePath,
    byteLength: buffer.byteLength,
  };
}

function normalizeBase64Payload(payload: string): string {
  const trimmed = payload.trim();
  if (trimmed.length === 0) {
    throw new InlineUploadPayloadInvalidError("Inline upload payload was empty.");
  }

  const withoutDataUrlPrefix = trimmed.replace(/^data:[^;]+;base64,/i, "");
  return withoutDataUrlPrefix.replace(/\s+/g, "");
}

function decodeBase64Payload(payload: string): Buffer {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(payload) || payload.length % 4 === 1) {
    throw new InlineUploadPayloadInvalidError("Inline upload payload was not valid base64.");
  }

  const buffer = Buffer.from(payload, "base64");
  const normalizedInput = payload.replace(/=+$/, "");
  const normalizedRoundTrip = buffer.toString("base64").replace(/=+$/, "");

  if (normalizedInput !== normalizedRoundTrip) {
    throw new InlineUploadPayloadInvalidError("Inline upload payload was not valid base64.");
  }

  if (buffer.byteLength > MAX_INLINE_UPLOAD_BYTES) {
    throw new InlineUploadPayloadTooLargeError(buffer.byteLength);
  }

  return buffer;
}

function normalizeStorageKey(storageKey: string): string {
  const normalized = storageKey
    .replaceAll("\\", "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (normalized.length === 0) {
    throw new InlineUploadPayloadInvalidError("Upload storageKey cannot be empty.");
  }

  if (normalized.some((segment) => segment === "." || segment === "..")) {
    throw new InlineUploadPayloadInvalidError(
      `Upload storageKey cannot contain relative path segments: "${storageKey}".`,
    );
  }

  return normalized.join("/");
}

function createGeneratedStorageKey(
  fileName: string,
  now: () => Date,
  createId: () => string,
): string {
  const timestamp = now();
  const yyyy = String(timestamp.getUTCFullYear());
  const mm = String(timestamp.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(timestamp.getUTCDate()).padStart(2, "0");
  const safeFileName = sanitizeFileName(fileName);

  return `uploads/${yyyy}/${mm}/${dd}/${createId()}-${safeFileName}`;
}

function sanitizeFileName(fileName: string): string {
  const trimmed = fileName.trim();
  const fallback = trimmed.length > 0 ? trimmed : "upload.bin";
  return fallback.replace(/[^A-Za-z0-9._-]+/g, "-");
}
