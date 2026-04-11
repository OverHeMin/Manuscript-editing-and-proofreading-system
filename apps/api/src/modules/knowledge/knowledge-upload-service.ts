import { randomUUID } from "node:crypto";
import { storeInlineUpload } from "../../http/local-upload-storage.ts";

export interface CreateKnowledgeUploadInput {
  fileName: string;
  mimeType: string;
  fileContentBase64: string;
}

export interface KnowledgeUploadRecord {
  upload_id: string;
  storage_key: string;
  file_name: string;
  mime_type: string;
  byte_length: number;
  uploaded_at: string;
}

export class KnowledgeUploadNotFoundError extends Error {
  constructor(uploadId: string) {
    super(`Knowledge upload ${uploadId} was not found.`);
    this.name = "KnowledgeUploadNotFoundError";
  }
}

export class KnowledgeUploadService {
  private readonly uploads = new Map<string, KnowledgeUploadRecord>();
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(
    private readonly dependencies: {
      rootDir: string;
      createId?: () => string;
      now?: () => Date;
    },
  ) {
    this.createId = dependencies.createId ?? (() => randomUUID());
    this.now = dependencies.now ?? (() => new Date());
  }

  async createImageUpload(
    input: CreateKnowledgeUploadInput,
  ): Promise<KnowledgeUploadRecord> {
    const uploadedAt = this.now().toISOString();
    const id = this.createId();
    const stored = await storeInlineUpload({
      rootDir: this.dependencies.rootDir,
      fileName: input.fileName,
      fileContentBase64: input.fileContentBase64,
      now: this.now,
      createId: this.createId,
    });

    const record: KnowledgeUploadRecord = {
      upload_id: id,
      storage_key: stored.storageKey,
      file_name: input.fileName,
      mime_type: input.mimeType,
      byte_length: stored.byteLength,
      uploaded_at: uploadedAt,
    };
    this.uploads.set(record.upload_id, record);
    return { ...record };
  }

  getUploadById(uploadId: string): KnowledgeUploadRecord {
    const record = this.uploads.get(uploadId);
    if (!record) {
      throw new KnowledgeUploadNotFoundError(uploadId);
    }

    return { ...record };
  }
}
