import type {
  KnowledgeContentBlockInput,
  ReplaceKnowledgeRevisionContentBlocksInput,
} from "./knowledge-service.ts";
import type { KnowledgeUploadService } from "./knowledge-upload-service.ts";

export class KnowledgeContentBlockPayloadInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnowledgeContentBlockPayloadInvalidError";
  }
}

export async function normalizeKnowledgeContentBlocksInput(
  value: unknown,
  dependencies: {
    uploadService?: Pick<KnowledgeUploadService, "getUploadById">;
  } = {},
): Promise<ReplaceKnowledgeRevisionContentBlocksInput> {
  const body = asRecord(value);
  const rawBlocks = Array.isArray(body.blocks) ? body.blocks : [];
  const blocks: KnowledgeContentBlockInput[] = [];

  for (const rawBlock of rawBlocks) {
    blocks.push(await normalizeKnowledgeContentBlock(rawBlock, dependencies));
  }

  return { blocks };
}

async function normalizeKnowledgeContentBlock(
  value: unknown,
  dependencies: {
    uploadService?: Pick<KnowledgeUploadService, "getUploadById">;
  },
): Promise<KnowledgeContentBlockInput> {
  const body = asRecord(value);
  const blockType = asBlockType(body.blockType);
  const orderNo = asOrderNo(body.orderNo);
  const contentPayload = asRecord(body.contentPayload);
  let normalizedPayload: Record<string, unknown> = {
    ...contentPayload,
  };

  if (
    blockType === "image_block" &&
    typeof contentPayload.uploadId === "string" &&
    dependencies.uploadService
  ) {
    const upload = dependencies.uploadService.getUploadById(contentPayload.uploadId);
    normalizedPayload = {
      upload_id: upload.upload_id,
      storage_key: upload.storage_key,
      file_name: upload.file_name,
      mime_type: upload.mime_type,
      byte_length: upload.byte_length,
      uploaded_at: upload.uploaded_at,
    };
  }

  return {
    blockType,
    orderNo,
    contentPayload: normalizedPayload,
    tableSemantics: asOptionalRecord(body.tableSemantics),
    imageUnderstanding: asOptionalRecord(body.imageUnderstanding),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function asOptionalRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  if (value == null) {
    return undefined;
  }

  return asRecord(value);
}

function asBlockType(value: unknown): KnowledgeContentBlockInput["blockType"] {
  if (
    value === "text_block" ||
    value === "table_block" ||
    value === "image_block"
  ) {
    return value;
  }

  throw new KnowledgeContentBlockPayloadInvalidError(
    `Unknown knowledge content block type: ${String(value)}.`,
  );
}

function asOrderNo(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  throw new KnowledgeContentBlockPayloadInvalidError(
    `Knowledge content block orderNo must be an integer; received ${String(value)}.`,
  );
}
