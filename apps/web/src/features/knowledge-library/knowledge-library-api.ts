import type { KnowledgeHttpClient } from "../knowledge/index.ts";
import type {
  CreateKnowledgeLibraryDraftInput,
  DuplicateKnowledgeCheckInput,
  DuplicateKnowledgeMatchViewModel,
  DuplicateKnowledgeSeverity,
  KnowledgeAssetDetailViewModel,
  KnowledgeContentBlockViewModel,
  KnowledgeLibraryFilterState,
  KnowledgeLibraryQueryMode,
  KnowledgeRevisionViewModel,
  KnowledgeLibrarySummaryViewModel,
  KnowledgeSemanticLayerInput,
  KnowledgeSemanticStatus,
  KnowledgeUploadInput,
  KnowledgeUploadViewModel,
  UpdateKnowledgeLibraryDraftInput,
} from "./types.ts";

export type KnowledgeLibraryHttpClient = KnowledgeHttpClient;

export interface DuplicateKnowledgeAcknowledgementPayload {
  matched_asset_id: string;
  matched_revision_id?: string;
  severity?: DuplicateKnowledgeSeverity;
  note?: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
}

export interface SubmitKnowledgeRevisionForReviewInput {
  duplicateAcknowledgements?: DuplicateKnowledgeAcknowledgementPayload[];
}

interface DuplicateKnowledgeCheckRequestBody {
  currentAssetId?: string;
  currentRevisionId?: string;
  title: string;
  canonicalText: string;
  summary?: string;
  knowledgeKind: DuplicateKnowledgeCheckInput["knowledgeKind"];
  moduleScope: DuplicateKnowledgeCheckInput["moduleScope"];
  manuscriptTypes: DuplicateKnowledgeCheckInput["manuscriptTypes"];
  sections?: string[];
  riskTags?: string[];
  disciplineTags?: string[];
  aliases?: string[];
  bindings?: string[];
}

export interface KnowledgeLibraryListItemResponseBody {
  asset_id: string;
  title: string;
  summary?: string;
  knowledge_kind: KnowledgeLibrarySummaryViewModel["knowledge_kind"];
  status: KnowledgeLibrarySummaryViewModel["status"];
  module_scope: KnowledgeLibrarySummaryViewModel["module_scope"];
  manuscript_types: KnowledgeLibrarySummaryViewModel["manuscript_types"];
  selected_revision_id?: string;
  semantic_status?: KnowledgeSemanticStatus;
  content_block_count: number;
  updated_at?: string;
}

export interface KnowledgeLibraryListResponseBody {
  query_mode: KnowledgeLibraryQueryMode;
  search?: string;
  items: KnowledgeLibraryListItemResponseBody[];
}

export interface ListKnowledgeLibraryAssetsInput {
  searchText?: string;
  queryMode?: KnowledgeLibraryFilterState["queryMode"];
}

export interface ReplaceKnowledgeRevisionContentBlocksInput {
  blocks: readonly KnowledgeContentBlockViewModel[];
}

export function listKnowledgeLibraryAssets(
  client: KnowledgeLibraryHttpClient,
  input: ListKnowledgeLibraryAssetsInput = {},
) {
  const query = createKnowledgeLibraryListQuery(input);

  return client.request<KnowledgeLibraryListResponseBody>({
    method: "GET",
    url: `/api/v1/knowledge/library${query}`,
  });
}

export function getKnowledgeAssetDetail(
  client: KnowledgeLibraryHttpClient,
  assetId: string,
  revisionId?: string,
) {
  const query =
    revisionId && revisionId.trim().length > 0
      ? `?revisionId=${encodeURIComponent(revisionId.trim())}`
      : "";

  return client.request<KnowledgeAssetDetailViewModel>({
    method: "GET",
    url: `/api/v1/knowledge/assets/${assetId}${query}`,
  });
}

export function createKnowledgeLibraryDraft(
  client: KnowledgeLibraryHttpClient,
  input: CreateKnowledgeLibraryDraftInput,
) {
  return client.request<KnowledgeAssetDetailViewModel>({
    method: "POST",
    url: "/api/v1/knowledge/assets/drafts",
    body: input,
  });
}

export function createKnowledgeDraftRevision(
  client: KnowledgeLibraryHttpClient,
  assetId: string,
) {
  return client.request<KnowledgeAssetDetailViewModel>({
    method: "POST",
    url: `/api/v1/knowledge/assets/${assetId}/revisions`,
  });
}

export function updateKnowledgeRevisionDraft(
  client: KnowledgeLibraryHttpClient,
  revisionId: string,
  input: UpdateKnowledgeLibraryDraftInput,
) {
  return client.request<KnowledgeAssetDetailViewModel>({
    method: "POST",
    url: `/api/v1/knowledge/revisions/${revisionId}/draft`,
    body: input,
  });
}

export function replaceKnowledgeRevisionContentBlocks(
  client: KnowledgeLibraryHttpClient,
  revisionId: string,
  input: ReplaceKnowledgeRevisionContentBlocksInput,
) {
  return client.request<KnowledgeRevisionViewModel>({
    method: "POST",
    url: `/api/v1/knowledge/revisions/${revisionId}/content-blocks/replace`,
    body: {
      blocks: input.blocks.map((block) => ({
        blockType: block.block_type,
        orderNo: block.order_no,
        contentPayload: block.content_payload,
        ...(block.table_semantics ? { tableSemantics: block.table_semantics } : {}),
        ...(block.image_understanding ? { imageUnderstanding: block.image_understanding } : {}),
      })),
    },
  });
}

export function regenerateKnowledgeSemanticLayer(
  client: KnowledgeLibraryHttpClient,
  revisionId: string,
  input: KnowledgeSemanticLayerInput = {},
) {
  return client.request<KnowledgeRevisionViewModel>({
    method: "POST",
    url: `/api/v1/knowledge/revisions/${revisionId}/semantic-layer/regenerate`,
    body: input,
  });
}

export function confirmKnowledgeSemanticLayer(
  client: KnowledgeLibraryHttpClient,
  revisionId: string,
  input: KnowledgeSemanticLayerInput = {},
) {
  return client.request<KnowledgeRevisionViewModel>({
    method: "POST",
    url: `/api/v1/knowledge/revisions/${revisionId}/semantic-layer/confirm`,
    body: input,
  });
}

export function uploadKnowledgeImage(
  client: KnowledgeLibraryHttpClient,
  input: KnowledgeUploadInput,
) {
  return client.request<KnowledgeUploadViewModel>({
    method: "POST",
    url: "/api/v1/knowledge/uploads",
    body: input,
  });
}

export function submitKnowledgeRevisionForReview(
  client: KnowledgeLibraryHttpClient,
  revisionId: string,
  input?: SubmitKnowledgeRevisionForReviewInput,
) {
  const duplicateAcknowledgements = input?.duplicateAcknowledgements;

  return client.request<KnowledgeAssetDetailViewModel>({
    method: "POST",
    url: `/api/v1/knowledge/revisions/${revisionId}/submit`,
    ...(duplicateAcknowledgements
      ? {
          body: {
            duplicateAcknowledgements,
          },
        }
      : {}),
  });
}

export function checkKnowledgeDuplicates(
  client: KnowledgeLibraryHttpClient,
  input: DuplicateKnowledgeCheckInput,
) {
  return client.request<DuplicateKnowledgeMatchViewModel[]>({
    method: "POST",
    url: "/api/v1/knowledge/duplicate-check",
    body: toDuplicateKnowledgeCheckRequestBody(input),
  });
}

function toDuplicateKnowledgeCheckRequestBody(
  input: DuplicateKnowledgeCheckInput,
): DuplicateKnowledgeCheckRequestBody {
  return {
    currentAssetId: input.currentAssetId,
    currentRevisionId: input.currentRevisionId,
    title: input.title,
    canonicalText: input.canonicalText,
    summary: input.summary,
    knowledgeKind: input.knowledgeKind,
    moduleScope: input.moduleScope,
    manuscriptTypes: input.manuscriptTypes,
    sections: input.sections,
    riskTags: input.riskTags,
    disciplineTags: input.disciplineTags,
    aliases: input.aliases,
    bindings: toDuplicateCheckBindings(input.bindings),
  };
}

function toDuplicateCheckBindings(
  bindings: DuplicateKnowledgeCheckInput["bindings"],
): string[] | undefined {
  if (!bindings?.length) {
    return undefined;
  }

  const normalizedBindings = Array.from(
    new Set(
      bindings
        .map((binding) => binding.bindingTargetId.trim())
        .filter((bindingTargetId) => bindingTargetId.length > 0),
    ),
  );

  return normalizedBindings.length > 0 ? normalizedBindings : undefined;
}

function createKnowledgeLibraryListQuery(
  input: ListKnowledgeLibraryAssetsInput,
): string {
  const searchText = input.searchText?.trim() ?? "";
  const queryMode = input.queryMode === "semantic" ? "semantic" : "keyword";
  const searchParams = new URLSearchParams();

  if (searchText.length > 0) {
    searchParams.set("search", searchText);
  }

  if (queryMode !== "keyword") {
    searchParams.set("queryMode", queryMode);
  }

  const serialized = searchParams.toString();
  return serialized.length > 0 ? `?${serialized}` : "";
}
