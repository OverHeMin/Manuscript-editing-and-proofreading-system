import type { DocumentAssetRecord } from "../assets/document-asset-record.ts";
import type { RoleKey } from "../../users/roles.ts";

export interface DocumentPreviewComment {
  id: string;
  author?: string;
  body: string;
  anchor_text?: string;
  created_at?: string;
}

export interface CreateOnlyOfficeViewSessionInput {
  manuscriptId: string;
  asset: DocumentAssetRecord;
  actorRole: RoleKey;
  previewStatus: "ready" | "pending_normalization";
  comments?: DocumentPreviewComment[];
}

export interface OnlyOfficeViewSession {
  manuscript_id: string;
  source_asset_id: string;
  source_asset_type: "original" | "normalized_docx";
  viewer: "onlyoffice";
  mode: "view";
  status: "ready" | "pending_normalization";
  mime_type: string;
  comment_source: "onlyoffice";
  comments: DocumentPreviewComment[];
  save_back_enabled: false;
  warnings: string[];
}

export class OnlyOfficeSessionService {
  createViewSession(
    input: CreateOnlyOfficeViewSessionInput,
  ): OnlyOfficeViewSession {
    return {
      manuscript_id: input.manuscriptId,
      source_asset_id: input.asset.id,
      source_asset_type:
        input.asset.asset_type === "normalized_docx" ? "normalized_docx" : "original",
      viewer: "onlyoffice",
      mode: "view",
      status: input.previewStatus,
      mime_type: input.asset.mime_type,
      comment_source: "onlyoffice",
      comments: [...(input.comments ?? [])],
      save_back_enabled: false,
      warnings: [],
    };
  }
}
