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
  saveBack?: {
    enabled: boolean;
    module: "editing" | "proofreading";
    baselineAssetId?: string;
  };
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

export class DocumentPreviewSaveBackNotAllowedError extends Error {
  constructor(assetId: string, reason: string) {
    super(`Asset ${assetId} does not support OnlyOffice save-back: ${reason}`);
    this.name = "DocumentPreviewSaveBackNotAllowedError";
  }
}

export class DocumentPreviewSaveBackTokenRequiredError extends Error {
  constructor() {
    super("OnlyOffice save-back requires ONLYOFFICE_JWT_SECRET to sign callback scope.");
    this.name = "DocumentPreviewSaveBackTokenRequiredError";
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
    const saveBack = this.resolveSaveBack(input, asset);

    return this.sessionService.createViewSession({
      manuscriptId: input.manuscriptId,
      asset,
      actorRole: input.actorRole,
      previewStatus: input.previewStatus ?? "ready",
      comments: input.comments,
      ...(saveBack ? { saveBack } : {}),
    });
  }

  private resolveSaveBack(
    input: CreateDocumentPreviewSessionInput,
    asset: DocumentAssetRecord,
  ): CreateDocumentPreviewSessionInput["saveBack"] & {
    baselineAssetId: string;
  } | undefined {
    if (input.saveBack?.enabled !== true) {
      return undefined;
    }

    if (!this.sessionService.hasSurfaceSessionSecret()) {
      throw new DocumentPreviewSaveBackTokenRequiredError();
    }

    if ((input.previewStatus ?? "ready") !== "ready") {
      throw new DocumentPreviewSaveBackNotAllowedError(
        asset.id,
        "pending normalization sessions are read-only",
      );
    }

    if (input.saveBack.module === "editing" && asset.asset_type !== "edited_docx") {
      throw new DocumentPreviewSaveBackNotAllowedError(
        asset.id,
        "editing save-back requires an edited DOCX asset",
      );
    }

    if (
      input.saveBack.module === "proofreading" &&
      asset.asset_type !== "edited_docx" &&
      asset.asset_type !== "final_proof_annotated_docx" &&
      asset.asset_type !== "human_final_docx"
    ) {
      throw new DocumentPreviewSaveBackNotAllowedError(
        asset.id,
        "proofreading save-back requires a DOCX manuscript asset",
      );
    }

    const baselineAssetId = input.saveBack.baselineAssetId?.trim() || asset.id;
    if (baselineAssetId !== asset.id) {
      throw new DocumentPreviewSaveBackNotAllowedError(
        asset.id,
        "baseline asset must match the editable preview asset",
      );
    }

    return {
      enabled: true,
      module: input.saveBack.module,
      baselineAssetId,
    };
  }

  private async requireAsset(assetId: string): Promise<DocumentAssetRecord> {
    const asset = await this.assetRepository.findById(assetId);

    if (!asset) {
      throw new DocumentPreviewAssetNotFoundError(assetId);
    }

    return asset;
  }
}
