import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { extname } from "node:path";
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
  saveBack?: {
    enabled: boolean;
    module: "editing" | "proofreading";
    baselineAssetId: string;
  };
}

export type OnlyOfficePreviewSourceAssetType =
  | "original"
  | "normalized_docx"
  | "edited_docx"
  | "final_proof_annotated_docx"
  | "human_final_docx";

export interface OnlyOfficeViewSession {
  manuscript_id: string;
  source_asset_id: string;
  source_asset_type: OnlyOfficePreviewSourceAssetType;
  session_id: string;
  correlation_id: string;
  viewer: "onlyoffice";
  mode: "view" | "edit";
  surface_mode: "read_only_review" | "editable_review";
  status: "ready" | "pending_normalization";
  mime_type: string;
  comment_source: "onlyoffice";
  document: {
    document_key: string;
    file_name: string;
    file_extension: string;
    mime_type: string;
    download_path: string;
    permissions: {
      edit: boolean;
      comment: boolean;
      review: boolean;
      download: true;
      print: true;
    };
  };
  authorization: {
    kind: "surface_session";
    requires_surface_session: true;
    token_scheme: "none" | "surface_session_jwt";
    access_token?: string;
  };
  event_bridge: {
    provider: "onlyoffice";
    transport: "window_post_message";
    capabilities: {
      ready_event: true;
      locate_to_anchor: true;
      selection_from_document: true;
      visible_issue_marks: boolean;
      bi_directional_sync: true;
    };
  };
  embed: {
    provider: "onlyoffice";
    provider_origin: string;
    api_js_url: string;
    document_type: "word";
    ui_type: "desktop";
    editor_config: {
      mode: "view" | "edit";
      lang: "zh-CN";
      customization: {
        autosave: boolean;
        chat: false;
        comments: boolean;
        compactHeader: true;
        compactToolbar: true;
        feedback: false;
        forcesave: boolean;
        help: false;
        submitForm: false;
      };
    };
  };
  comments: DocumentPreviewComment[];
  save_back_enabled: boolean;
  save_back?: {
    module: "editing" | "proofreading";
    baseline_asset_id: string;
    output_asset_type: "edited_docx" | "human_final_docx";
    callback_token: string;
  };
  warnings: string[];
}

export interface OnlyOfficeSessionServiceOptions {
  createId?: () => string;
  documentServerPublicUrl?: string;
  surfaceSessionSecret?: string;
}

export interface SurfaceSessionAccessTokenClaims {
  session_id: string;
  manuscript_id: string;
  asset_id: string;
  actor_role: RoleKey;
  preview_status: "ready" | "pending_normalization";
  document_key?: string;
  save_back?: {
    module: "editing" | "proofreading";
    baseline_asset_id: string;
    output_asset_type: "edited_docx" | "human_final_docx";
  };
}

export class OnlyOfficeSessionService {
  private readonly createId: () => string;
  private readonly documentServerPublicUrl: string;
  private readonly surfaceSessionSecret: string;

  constructor(options: OnlyOfficeSessionServiceOptions = {}) {
    this.createId = options.createId ?? (() => randomUUID());
    this.documentServerPublicUrl = normalizeDocumentServerPublicUrl(
      options.documentServerPublicUrl ?? process.env.ONLYOFFICE_URL,
    );
    this.surfaceSessionSecret = options.surfaceSessionSecret?.trim() ??
      process.env.ONLYOFFICE_JWT_SECRET?.trim() ??
      "";
  }

  hasSurfaceSessionSecret(): boolean {
    return this.surfaceSessionSecret.length > 0;
  }

  createViewSession(
    input: CreateOnlyOfficeViewSessionInput,
  ): OnlyOfficeViewSession {
    const sessionId = this.createId();
    const fileName = resolveDocumentFileName(input.asset);
    const signedDocumentKey = createOnlyOfficeDocumentKey(input.asset.id, sessionId);
    const saveBack = input.saveBack?.enabled === true ? input.saveBack : undefined;
    const editable = Boolean(saveBack);
    const outputAssetType = saveBack
      ? resolveSaveBackOutputAssetType(saveBack.module)
      : undefined;
    const accessToken = this.surfaceSessionSecret
      ? createSurfaceSessionAccessToken({
          secret: this.surfaceSessionSecret,
          sessionId,
          manuscriptId: input.manuscriptId,
          assetId: input.asset.id,
          actorRole: input.actorRole,
          previewStatus: input.previewStatus,
          documentKey: signedDocumentKey,
          ...(saveBack && outputAssetType
            ? {
                saveBack: {
                  module: saveBack.module,
                  baselineAssetId: saveBack.baselineAssetId,
                  outputAssetType,
                },
              }
            : {}),
        })
      : undefined;

    return {
      manuscript_id: input.manuscriptId,
      source_asset_id: input.asset.id,
      source_asset_type: resolvePreviewSourceAssetType(input.asset),
      session_id: sessionId,
      correlation_id: sessionId,
      viewer: "onlyoffice",
      mode: editable ? "edit" : "view",
      surface_mode: editable ? "editable_review" : "read_only_review",
      status: input.previewStatus,
      mime_type: input.asset.mime_type,
      comment_source: "onlyoffice",
      document: {
        document_key: input.asset.id,
        file_name: fileName,
        file_extension: resolveDocumentFileExtension({
          fileName,
          mimeType: input.asset.mime_type,
        }),
        mime_type: input.asset.mime_type,
        download_path: `/api/v1/document-assets/${input.asset.id}/download`,
        permissions: {
          edit: editable,
          comment: editable,
          review: editable,
          download: true,
          print: true,
        },
      },
      authorization: {
        kind: "surface_session",
        requires_surface_session: true,
        token_scheme: accessToken ? "surface_session_jwt" : "none",
        ...(accessToken
          ? {
              access_token: accessToken,
            }
          : {}),
      },
      event_bridge: {
        provider: "onlyoffice",
        transport: "window_post_message",
        capabilities: {
          ready_event: true,
          locate_to_anchor: true,
          selection_from_document: true,
          visible_issue_marks: input.previewStatus === "ready",
          bi_directional_sync: true,
        },
      },
      embed: {
        provider: "onlyoffice",
        provider_origin: this.documentServerPublicUrl,
        api_js_url: `${this.documentServerPublicUrl}/web-apps/apps/api/documents/api.js`,
        document_type: "word",
        ui_type: "desktop",
        editor_config: {
          mode: editable ? "edit" : "view",
          lang: "zh-CN",
          customization: {
            autosave: editable,
            chat: false,
            comments: editable,
            compactHeader: true,
            compactToolbar: true,
            feedback: false,
            forcesave: editable,
            help: false,
            submitForm: false,
          },
        },
      },
      comments: [...(input.comments ?? [])],
      save_back_enabled: editable,
      ...(saveBack && outputAssetType && accessToken
        ? {
            save_back: {
              module: saveBack.module,
              baseline_asset_id: saveBack.baselineAssetId,
              output_asset_type: outputAssetType,
              callback_token: accessToken,
            },
          }
        : {}),
      warnings: [],
    };
  }
}

function createOnlyOfficeDocumentKey(assetId: string, sessionId: string): string {
  return `${assetId}-${sessionId}`;
}

function resolveSaveBackOutputAssetType(
  module: "editing" | "proofreading",
): "edited_docx" | "human_final_docx" {
  return module === "editing" ? "edited_docx" : "human_final_docx";
}

function resolvePreviewSourceAssetType(
  asset: DocumentAssetRecord,
): OnlyOfficePreviewSourceAssetType {
  switch (asset.asset_type) {
    case "normalized_docx":
    case "edited_docx":
    case "final_proof_annotated_docx":
    case "human_final_docx":
      return asset.asset_type;
    default:
      return "original";
  }
}

function resolveDocumentFileName(asset: DocumentAssetRecord): string {
  return asset.file_name ?? `${asset.id}.${resolveDocumentFileExtension({
    fileName: asset.file_name,
    mimeType: asset.mime_type,
  })}`;
}

function resolveDocumentFileExtension(input: {
  fileName?: string;
  mimeType: string;
}): string {
  const explicitExtension = input.fileName
    ? extname(input.fileName).replace(/^\./u, "").trim().toLowerCase()
    : "";
  if (explicitExtension) {
    return explicitExtension;
  }

  switch (input.mimeType) {
    case "application/msword":
      return "doc";
    case "application/pdf":
      return "pdf";
    default:
      return "docx";
  }
}

function normalizeDocumentServerPublicUrl(value: string | undefined): string {
  const normalized = value?.trim() || "http://127.0.0.1:58080";
  return normalized.replace(/\/$/u, "");
}

function createSurfaceSessionAccessToken(input: {
  secret: string;
  sessionId: string;
  manuscriptId: string;
  assetId: string;
  actorRole: RoleKey;
  previewStatus: "ready" | "pending_normalization";
  documentKey?: string;
  saveBack?: {
    module: "editing" | "proofreading";
    baselineAssetId: string;
    outputAssetType: "edited_docx" | "human_final_docx";
  };
}): string {
  const encodedHeader = Buffer.from(
    JSON.stringify({
      alg: "HS256",
      typ: "JWT",
    }),
  ).toString("base64url");
  const encodedPayload = Buffer.from(
    JSON.stringify({
      sub: "document-preview-surface-session",
      session_id: input.sessionId,
      manuscript_id: input.manuscriptId,
      asset_id: input.assetId,
      actor_role: input.actorRole,
      preview_status: input.previewStatus,
      ...(input.documentKey ? { document_key: input.documentKey } : {}),
      ...(input.saveBack
        ? {
            save_back: {
              module: input.saveBack.module,
              baseline_asset_id: input.saveBack.baselineAssetId,
              output_asset_type: input.saveBack.outputAssetType,
            },
          }
        : {}),
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", input.secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifySurfaceSessionAccessToken(input: {
  token: string;
  secret: string;
}): SurfaceSessionAccessTokenClaims | null {
  const token = input.token.trim();
  const secret = input.secret.trim();
  if (!token || !secret) {
    return null;
  }

  const tokenParts = token.split(".");
  if (tokenParts.length !== 3 || tokenParts.some((part) => part.trim().length === 0)) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = tokenParts;
  const expectedSignature = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  if (!safeCompareSignature(signature, expectedSignature)) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const previewStatus = record.preview_status;
  const documentKey =
    typeof record.document_key === "string" ? record.document_key : undefined;
  const saveBack = parseSaveBackClaims(record.save_back);
  if (
    record.sub !== "document-preview-surface-session" ||
    typeof record.session_id !== "string" ||
    typeof record.manuscript_id !== "string" ||
    typeof record.asset_id !== "string" ||
    typeof record.actor_role !== "string" ||
    (previewStatus !== "ready" && previewStatus !== "pending_normalization")
  ) {
    return null;
  }

  return {
    session_id: record.session_id,
    manuscript_id: record.manuscript_id,
    asset_id: record.asset_id,
    actor_role: record.actor_role as RoleKey,
    preview_status: previewStatus,
    ...(documentKey ? { document_key: documentKey } : {}),
    ...(saveBack ? { save_back: saveBack } : {}),
  };
}

function parseSaveBackClaims(value: unknown): SurfaceSessionAccessTokenClaims["save_back"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const module = record.module;
  const baselineAssetId = record.baseline_asset_id;
  const outputAssetType = record.output_asset_type;
  if (
    (module !== "editing" && module !== "proofreading") ||
    typeof baselineAssetId !== "string" ||
    (outputAssetType !== "edited_docx" && outputAssetType !== "human_final_docx")
  ) {
    return undefined;
  }

  return {
    module,
    baseline_asset_id: baselineAssetId,
    output_asset_type: outputAssetType,
  };
}

function safeCompareSignature(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}
