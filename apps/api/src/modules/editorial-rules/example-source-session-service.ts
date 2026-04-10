import { randomUUID } from "node:crypto";
import type {
  CreateRulePackageExampleSourceSessionInput,
  ExamplePairUploadInput,
  RulePackageExampleSourceSession,
  RulePackageGenerationContext,
} from "@medical/contracts";
import { storeInlineUpload } from "../../http/local-upload-storage.ts";
import { InMemoryDocumentAssetRepository } from "../assets/in-memory-document-asset-repository.ts";
import { InMemoryReviewedCaseSnapshotRepository } from "../learning/in-memory-learning-repository.ts";
import { ReviewedCaseRulePackageSourceService } from "./reviewed-case-rule-package-source-service.ts";

const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredExampleSourceAsset {
  file_name: string;
  mime_type: string;
}

interface ExampleSourceSessionRecord {
  session_id: string;
  source_kind: "uploaded_example_pair";
  original_asset: StoredExampleSourceAsset;
  edited_asset: StoredExampleSourceAsset;
  journal_key?: string;
  created_at: string;
  expires_at: string;
  context: RulePackageGenerationContext;
  pair_input: ExamplePairUploadInput;
}

export class RulePackageExampleSourceSessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Rule-package example source session "${sessionId}" was not found.`);
    this.name = "RulePackageExampleSourceSessionNotFoundError";
  }
}

export interface ExampleSourceSessionServiceOptions {
  uploadRootDir: string;
  now?: () => Date;
  createId?: () => string;
  ttlMs?: number;
  defaultContext?: RulePackageGenerationContext;
}

export class ExampleSourceSessionService {
  private readonly uploadRootDir: string;
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly ttlMs: number;
  private readonly defaultContext: RulePackageGenerationContext;
  private readonly sessions = new Map<string, ExampleSourceSessionRecord>();

  constructor(options: ExampleSourceSessionServiceOptions) {
    this.uploadRootDir = options.uploadRootDir;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? (() => randomUUID());
    this.ttlMs = options.ttlMs ?? DEFAULT_SESSION_TTL_MS;
    this.defaultContext = options.defaultContext ?? {
      manuscript_type: "other",
      module: "editing",
    };
  }

  async createSession(
    input: CreateRulePackageExampleSourceSessionInput,
  ): Promise<RulePackageExampleSourceSession> {
    const sessionId = this.createId();
    const createdAt = this.now();
    const expiresAt = new Date(createdAt.getTime() + this.ttlMs);
    const manuscriptId = `example-source-session-${sessionId}`;
    const originalAssetId = `original-${sessionId}`;
    const editedAssetId = `edited-${sessionId}`;
    const originalUpload = await storeInlineUpload({
      rootDir: this.uploadRootDir,
      fileName: input.originalFile.fileName,
      fileContentBase64: input.originalFile.fileContentBase64,
      now: this.now,
      createId: this.createId,
    });
    const editedUpload = await storeInlineUpload({
      rootDir: this.uploadRootDir,
      fileName: input.editedFile.fileName,
      fileContentBase64: input.editedFile.fileContentBase64,
      now: this.now,
      createId: this.createId,
    });

    const assetRepository = new InMemoryDocumentAssetRepository();
    const snapshotRepository = new InMemoryReviewedCaseSnapshotRepository();
    await assetRepository.save({
      id: originalAssetId,
      manuscript_id: manuscriptId,
      asset_type: "original",
      status: "active",
      storage_key: originalUpload.storageKey,
      mime_type: input.originalFile.mimeType,
      source_module: this.defaultContext.module,
      created_by: "example-source-session-service",
      version_no: 1,
      is_current: true,
      file_name: input.originalFile.fileName,
      created_at: createdAt.toISOString(),
      updated_at: createdAt.toISOString(),
    });
    await assetRepository.save({
      id: editedAssetId,
      manuscript_id: manuscriptId,
      asset_type: "human_final_docx",
      status: "active",
      storage_key: editedUpload.storageKey,
      mime_type: input.editedFile.mimeType,
      source_module: this.defaultContext.module,
      created_by: "example-source-session-service",
      version_no: 1,
      is_current: true,
      file_name: input.editedFile.fileName,
      created_at: createdAt.toISOString(),
      updated_at: createdAt.toISOString(),
    });
    await snapshotRepository.save({
      id: sessionId,
      manuscript_id: manuscriptId,
      module: this.defaultContext.module,
      manuscript_type: this.defaultContext.manuscript_type,
      human_final_asset_id: editedAssetId,
      deidentification_passed: true,
      snapshot_asset_id: originalAssetId,
      created_by: "example-source-session-service",
      created_at: createdAt.toISOString(),
    });

    const pairInput = await new ReviewedCaseRulePackageSourceService({
      snapshotRepository,
      assetRepository,
      rootDir: this.uploadRootDir,
    }).buildExamplePair({
      reviewedCaseSnapshotId: sessionId,
      ...(input.journalKey?.trim().length
        ? { journalKey: input.journalKey.trim() }
        : {}),
    });

    const record: ExampleSourceSessionRecord = {
      session_id: sessionId,
      source_kind: "uploaded_example_pair",
      original_asset: {
        file_name: input.originalFile.fileName,
        mime_type: input.originalFile.mimeType,
      },
      edited_asset: {
        file_name: input.editedFile.fileName,
        mime_type: input.editedFile.mimeType,
      },
      ...(input.journalKey?.trim().length ? { journal_key: input.journalKey.trim() } : {}),
      created_at: createdAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      context: pairInput.context,
      pair_input: pairInput,
    };

    this.sessions.set(sessionId, record);
    return toSessionViewModel(record);
  }

  async resolveCandidateInput(input: {
    exampleSourceSessionId: string;
    journalKey?: string;
  }): Promise<ExamplePairUploadInput> {
    const record = this.readActiveRecord(input.exampleSourceSessionId);
    return {
      context: {
        ...record.context,
        ...(input.journalKey?.trim().length
          ? { journal_key: input.journalKey.trim() }
          : record.journal_key?.trim().length
            ? { journal_key: record.journal_key.trim() }
            : {}),
      },
      original: record.pair_input.original,
      edited: record.pair_input.edited,
    };
  }

  private readActiveRecord(sessionId: string): ExampleSourceSessionRecord {
    const record = this.sessions.get(sessionId);
    if (!record) {
      throw new RulePackageExampleSourceSessionNotFoundError(sessionId);
    }
    if (Date.parse(record.expires_at) <= this.now().getTime()) {
      this.sessions.delete(sessionId);
      throw new RulePackageExampleSourceSessionNotFoundError(sessionId);
    }
    return record;
  }
}

function toSessionViewModel(
  record: ExampleSourceSessionRecord,
): RulePackageExampleSourceSession {
  return {
    session_id: record.session_id,
    source_kind: record.source_kind,
    original_asset: {
      file_name: record.original_asset.file_name,
      mime_type: record.original_asset.mime_type,
    },
    edited_asset: {
      file_name: record.edited_asset.file_name,
      mime_type: record.edited_asset.mime_type,
    },
    ...(record.journal_key ? { journal_key: record.journal_key } : {}),
    created_at: record.created_at,
    expires_at: record.expires_at,
  };
}
