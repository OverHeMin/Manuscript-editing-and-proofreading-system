import type { RoleKey } from "../../users/roles.ts";
import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";
import type { DocumentAssetRecord } from "../assets/document-asset-record.ts";
import {
  OnlyOfficeSessionService,
  type DocumentPreviewComment,
  type OnlyOfficeViewSession,
} from "./onlyoffice-session-service.ts";

export interface CreateDocumentPreviewSessionInput {
  manuscriptId: string;
  assetId: string;
  actorRole: RoleKey;
  previewStatus?: "ready" | "pending_normalization";
  comments?: DocumentPreviewComment[];
}

export interface DocumentPreviewServiceOptions {
  assetRepository: DocumentAssetRepository;
  sessionService: OnlyOfficeSessionService;
}

export class DocumentPreviewAssetNotFoundError extends Error {
  constructor(assetId: string) {
    super(`Document preview asset ${assetId} was not found.`);
    this.name = "DocumentPreviewAssetNotFoundError";
  }
}

export class DocumentPreviewService {
  private readonly assetRepository: DocumentAssetRepository;
  private readonly sessionService: OnlyOfficeSessionService;

  constructor(options: DocumentPreviewServiceOptions) {
    this.assetRepository = options.assetRepository;
    this.sessionService = options.sessionService;
  }

  async createPreviewSession(
    input: CreateDocumentPreviewSessionInput,
  ): Promise<OnlyOfficeViewSession> {
    const asset = await this.requireAsset(input.assetId);

    return this.sessionService.createViewSession({
      manuscriptId: input.manuscriptId,
      asset,
      actorRole: input.actorRole,
      previewStatus: input.previewStatus ?? "ready",
      comments: input.comments,
    });
  }

  private async requireAsset(assetId: string): Promise<DocumentAssetRecord> {
    const asset = await this.assetRepository.findById(assetId);

    if (!asset) {
      throw new DocumentPreviewAssetNotFoundError(assetId);
    }

    return asset;
  }
}
