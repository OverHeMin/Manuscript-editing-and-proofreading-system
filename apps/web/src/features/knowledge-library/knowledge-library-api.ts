import type { KnowledgeHttpClient } from "../knowledge/index.ts";
import type {
  CreateKnowledgeLibraryDraftInput,
  DuplicateKnowledgeCheckInput,
  DuplicateKnowledgeMatchViewModel,
  DuplicateKnowledgeSeverity,
  KnowledgeAssetDetailViewModel,
  KnowledgeLibrarySummaryViewModel,
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

export function listKnowledgeLibraryAssets(client: KnowledgeLibraryHttpClient) {
  return client.request<KnowledgeLibrarySummaryViewModel[]>({
    method: "GET",
    url: "/api/v1/knowledge/library",
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
