import type {
  DocumentNormalizationExecutionViewModel,
  DocumentPreviewLocateTargetViewModel,
  ProofreadingDocumentAnchorKind,
  ProofreadingIssueAnchorInputViewModel,
  DocumentPreviewViewModel,
  DocumentPreviewSessionViewModel,
} from "./types.ts";

export interface DocumentPreviewHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function mapNormalizationPlanToPreview(
  result: DocumentNormalizationExecutionViewModel,
): DocumentPreviewViewModel {
  return {
    manuscript_id: result.plan.manuscript_id,
    source_asset_id: result.preview.source_asset_id,
    normalized_asset_type:
      result.normalized_asset?.asset_type ?? result.plan.derived_asset.asset_type,
    viewer: result.preview.viewer,
    status: result.preview.status,
    mime_type: result.preview.mime_type,
    file_name:
      result.normalized_asset?.file_name ?? result.plan.derived_asset.file_name,
    storage_key:
      result.normalized_asset?.storage_key ?? result.plan.derived_asset.storage_key,
    warnings: [...result.preview.warnings],
  };
}

export function createPreviewSession(
  client: DocumentPreviewHttpClient,
  input: {
    manuscriptId: string;
    assetId: string;
    actorRole: string;
    previewStatus?: "ready" | "pending_normalization";
    comments?: Array<{
      id: string;
      author?: string;
      body: string;
      anchor_text?: string;
      created_at?: string;
    }>;
  },
) {
  return client.request<DocumentPreviewSessionViewModel>({
    method: "POST",
    url: "/api/v1/document-pipeline/preview-session",
    body: input,
  });
}

export function buildProofreadingLocateTarget(
  input: ProofreadingIssueAnchorInputViewModel,
): DocumentPreviewLocateTargetViewModel {
  const locator = normalizeLocateDocumentLocator(input);
  if (locator?.anchorKey && locator.anchorKind) {
    return {
      blockIndex: input.blockIndex,
      quote: input.quote,
      ...(input.sectionLabel
        ? {
            sectionLabel: input.sectionLabel,
          }
        : {}),
      anchorKey: locator.anchorKey,
      anchorKind: locator.anchorKind,
      confidence: locator.confidence ?? "provided",
      ...(locator.tableId
        ? {
            tableId: locator.tableId,
          }
        : {}),
      ...(locator.tableTarget
        ? {
            tableTarget: locator.tableTarget,
          }
        : {}),
      ...(locator.rowKey
        ? {
            rowKey: locator.rowKey,
          }
        : {}),
      ...(locator.columnKey
        ? {
            columnKey: locator.columnKey,
          }
        : {}),
      ...(locator.footnoteAnchor
        ? {
            footnoteAnchor: locator.footnoteAnchor,
          }
        : {}),
    };
  }

  return {
    blockIndex: input.blockIndex,
    quote: input.quote,
    ...(input.sectionLabel
      ? {
          sectionLabel: input.sectionLabel,
        }
      : {}),
    anchorKey: `block:${input.blockIndex}`,
    anchorKind: "block",
    confidence: "fallback",
  };
}

function normalizeLocateDocumentLocator(
  input: ProofreadingIssueAnchorInputViewModel,
): ProofreadingIssueAnchorInputViewModel["documentLocator"] {
  const locator = input.documentLocator;
  if (!locator?.anchorKey || !locator.anchorKind) {
    return locator;
  }

  const derivedAnchorKind = inferProofreadingAnchorKind(input.blockKind);
  if (locator.anchorKind !== "block" || derivedAnchorKind === "block") {
    return locator;
  }

  const ordinalWithinSection = locator.ordinalWithinSection ?? input.blockIndex;

  return {
    anchorKind: derivedAnchorKind,
    anchorKey: `${derivedAnchorKind}:${input.sectionLabel ?? "document"}:${ordinalWithinSection}`,
    confidence: "derived",
    blockIndex: input.blockIndex,
    ...(input.sectionLabel
      ? {
          sectionLabel: input.sectionLabel,
        }
      : {}),
    ordinalWithinSection,
  };
}

function inferProofreadingAnchorKind(
  blockKind: string | undefined,
): ProofreadingDocumentAnchorKind {
  switch (blockKind) {
    case "paragraph":
      return "paragraph";
    case "heading":
      return "heading";
    case "table":
      return "table";
    case "image":
      return "image";
    case "caption":
      return "caption";
    case "reference_entry":
      return "reference_entry";
    default:
      return "block";
  }
}
