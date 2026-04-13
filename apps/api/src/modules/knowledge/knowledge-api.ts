import type { RoleKey } from "../../users/roles.ts";
import type {
  CreateHarnessDatasetDraftCandidateFromHumanFinalAssetInput,
  HarnessDatasetDraftCandidateRecord,
  HarnessDatasetService,
} from "../harness-datasets/harness-dataset-service.ts";
import type {
  KnowledgeAiAssistService,
  KnowledgeAiIntakeSuggestionInput,
  KnowledgeAiIntakeSuggestionRecord,
  KnowledgeSemanticAssistInput,
  KnowledgeSemanticAssistSuggestionRecord,
} from "./knowledge-ai-assist-service.ts";
import { normalizeKnowledgeContentBlocksInput } from "./knowledge-content-block-normalizer.ts";
import type { KnowledgeSemanticLayerService } from "./knowledge-semantic-layer-service.ts";
import { KnowledgeAssetNotFoundError, KnowledgeService } from "./knowledge-service.ts";
import type {
  ConfirmKnowledgeSemanticLayerInput,
  CreateKnowledgeLibraryDraftInput,
  GovernedRetrievalContextRecord,
  KnowledgeContentBlockInput,
  SubmitKnowledgeForReviewInput,
  SubmitKnowledgeRevisionForReviewInput,
  KnowledgeAssetDetailRecord,
  KnowledgeRevisionDetailRecord,
  RegenerateKnowledgeSemanticLayerInput,
  ReplaceKnowledgeRevisionContentBlocksInput,
  ResolveGovernedRetrievalContextInput,
  CreateKnowledgeDraftInput,
  UpdateKnowledgeRevisionDraftInput,
  UpdateKnowledgeDraftInput,
} from "./knowledge-service.ts";
import type { KnowledgeRetrievalSnapshotRecord } from "../knowledge-retrieval/knowledge-retrieval-record.ts";
import type { CreateKnowledgeUploadInput, KnowledgeUploadRecord, KnowledgeUploadService } from "./knowledge-upload-service.ts";
import type {
  KnowledgeDuplicateAcknowledgementRecord,
  KnowledgeDuplicateCheckInput,
  KnowledgeDuplicateMatchRecord,
  KnowledgeRecord,
  KnowledgeSemanticLayerRecord,
  KnowledgeReviewActionRecord,
} from "./knowledge-record.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export type KnowledgeLibraryQueryMode = "keyword" | "semantic";

export interface KnowledgeLibraryListItemRecord {
  asset_id: string;
  title: string;
  summary?: string;
  knowledge_kind: KnowledgeRecord["knowledge_kind"];
  status: KnowledgeRecord["status"] | KnowledgeRevisionDetailRecord["status"];
  module_scope: KnowledgeRecord["routing"]["module_scope"];
  manuscript_types: KnowledgeRecord["routing"]["manuscript_types"];
  selected_revision_id?: string;
  semantic_status?: KnowledgeSemanticLayerRecord["status"];
  content_block_count: number;
  updated_at?: string;
}

export interface KnowledgeLibraryListResponse {
  query_mode: KnowledgeLibraryQueryMode;
  search?: string;
  items: KnowledgeLibraryListItemRecord[];
}

export interface CreateKnowledgeApiOptions {
  knowledgeService: KnowledgeService;
  harnessDatasetService?: HarnessDatasetService;
  aiAssistService?: KnowledgeAiAssistService;
  semanticLayerService?: KnowledgeSemanticLayerService;
  uploadService?: KnowledgeUploadService;
}

export function createKnowledgeApi(options: CreateKnowledgeApiOptions) {
  const {
    knowledgeService,
    harnessDatasetService,
    aiAssistService,
    semanticLayerService,
    uploadService,
  } = options;

  return {
    async checkDuplicates(
      input: KnowledgeDuplicateCheckInput,
    ): Promise<RouteResponse<KnowledgeDuplicateMatchRecord[]>> {
      return {
        status: 200,
        body: await knowledgeService.checkDuplicates(input),
      };
    },

    async createDraft(
      input: CreateKnowledgeDraftInput,
    ): Promise<RouteResponse<KnowledgeRecord>> {
      return {
        status: 201,
        body: await knowledgeService.createDraft(input),
      };
    },

    async createLibraryDraft(
      input: CreateKnowledgeLibraryDraftInput,
    ): Promise<RouteResponse<KnowledgeAssetDetailRecord>> {
      return {
        status: 201,
        body: await knowledgeService.createLibraryDraft(input),
      };
    },

    async createAiIntakeSuggestion(
      input: KnowledgeAiIntakeSuggestionInput,
    ): Promise<RouteResponse<KnowledgeAiIntakeSuggestionRecord>> {
      return {
        status: 200,
        body: await aiAssistService!.createIntakeSuggestion(input),
      };
    },

    async createDraftRevision({
      assetId,
    }: {
      assetId: string;
    }): Promise<RouteResponse<KnowledgeAssetDetailRecord>> {
      return {
        status: 201,
        body: await knowledgeService.createDraftRevisionFromApprovedAsset(assetId),
      };
    },

    async submitForReview({
      knowledgeItemId,
      duplicateAcknowledgements,
      actorRole,
    }: {
      knowledgeItemId: string;
      duplicateAcknowledgements?: readonly KnowledgeDuplicateAcknowledgementRecord[];
      actorRole?: RoleKey;
    }): Promise<RouteResponse<KnowledgeRecord>> {
      const submitInput: SubmitKnowledgeForReviewInput = {
        knowledgeItemId,
        duplicateAcknowledgements,
        acknowledgedByRole: actorRole ?? "user",
      };
      const record = await knowledgeService.submitForReview(submitInput);

      return {
        status: 200,
        body: record,
      };
    },

    async submitRevisionForReview({
      revisionId,
      duplicateAcknowledgements,
      actorRole,
    }: {
      revisionId: string;
      duplicateAcknowledgements?: readonly KnowledgeDuplicateAcknowledgementRecord[];
      actorRole?: RoleKey;
    }): Promise<RouteResponse<KnowledgeAssetDetailRecord>> {
      const submitInput: SubmitKnowledgeRevisionForReviewInput = {
        revisionId,
        duplicateAcknowledgements,
        acknowledgedByRole: actorRole ?? "user",
      };
      const record = await knowledgeService.submitRevisionForReview(submitInput);

      return {
        status: 200,
        body: record,
      };
    },

    async approve({
      knowledgeItemId,
      actorRole,
      reviewNote,
    }: {
      knowledgeItemId: string;
      actorRole: RoleKey;
      reviewNote?: string;
    }): Promise<RouteResponse<KnowledgeRecord>> {
      return {
        status: 200,
        body: await knowledgeService.approve(knowledgeItemId, actorRole, reviewNote),
      };
    },

    async approveRevision({
      revisionId,
      actorRole,
      reviewNote,
    }: {
      revisionId: string;
      actorRole: RoleKey;
      reviewNote?: string;
    }): Promise<RouteResponse<KnowledgeAssetDetailRecord>> {
      return {
        status: 200,
        body: await knowledgeService.approveRevision(
          revisionId,
          actorRole,
          reviewNote,
        ),
      };
    },

    async reject({
      knowledgeItemId,
      actorRole,
      reviewNote,
    }: {
      knowledgeItemId: string;
      actorRole: RoleKey;
      reviewNote?: string;
    }): Promise<RouteResponse<KnowledgeRecord>> {
      return {
        status: 200,
        body: await knowledgeService.reject(knowledgeItemId, actorRole, reviewNote),
      };
    },

    async rejectRevision({
      revisionId,
      actorRole,
      reviewNote,
    }: {
      revisionId: string;
      actorRole: RoleKey;
      reviewNote?: string;
    }): Promise<RouteResponse<KnowledgeAssetDetailRecord>> {
      return {
        status: 200,
        body: await knowledgeService.rejectRevision(
          revisionId,
          actorRole,
          reviewNote,
        ),
      };
    },

    async updateDraft({
      knowledgeItemId,
      input,
    }: {
      knowledgeItemId: string;
      input: UpdateKnowledgeDraftInput;
    }): Promise<RouteResponse<KnowledgeRecord>> {
      return {
        status: 200,
        body: await knowledgeService.updateDraft(knowledgeItemId, input),
      };
    },

    async updateRevisionDraft({
      revisionId,
      input,
    }: {
      revisionId: string;
      input: UpdateKnowledgeRevisionDraftInput;
    }): Promise<RouteResponse<KnowledgeAssetDetailRecord>> {
      return {
        status: 200,
        body: await knowledgeService.updateRevisionDraft(revisionId, input),
      };
    },

    async replaceRevisionContentBlocks({
      revisionId,
      input,
    }: {
      revisionId: string;
      input: ReplaceKnowledgeRevisionContentBlocksInput | { blocks?: unknown };
    }): Promise<RouteResponse<KnowledgeRevisionDetailRecord>> {
      return {
        status: 200,
        body: await knowledgeService.replaceRevisionContentBlocks(
          revisionId,
          await normalizeKnowledgeContentBlocksInput(input, { uploadService }),
        ),
      };
    },

    async regenerateSemanticLayer({
      revisionId,
      input,
    }: {
      revisionId: string;
      input?: RegenerateKnowledgeSemanticLayerInput;
    }): Promise<RouteResponse<KnowledgeRevisionDetailRecord>> {
      const generatedInput = semanticLayerService
        ? await semanticLayerService.buildSemanticLayerDraft(revisionId)
        : {};
      return {
        status: 200,
        body: await knowledgeService.regenerateSemanticLayer(revisionId, {
          ...generatedInput,
          ...input,
        }),
      };
    },

    async confirmSemanticLayer({
      revisionId,
      input,
    }: {
      revisionId: string;
      input?: ConfirmKnowledgeSemanticLayerInput;
    }): Promise<RouteResponse<KnowledgeRevisionDetailRecord>> {
      return {
        status: 200,
        body: await knowledgeService.confirmSemanticLayer(revisionId, input),
      };
    },

    async assistSemanticLayer({
      revisionId,
      input,
    }: {
      revisionId: string;
      input: Omit<KnowledgeSemanticAssistInput, "revisionId">;
    }): Promise<RouteResponse<KnowledgeSemanticAssistSuggestionRecord>> {
      return {
        status: 200,
        body: await aiAssistService!.assistSemanticLayer({
          revisionId,
          instructionText: input.instructionText,
          targetScopes: input.targetScopes,
        }),
      };
    },

    async listKnowledgeItems(): Promise<RouteResponse<KnowledgeRecord[]>> {
      return {
        status: 200,
        body: await knowledgeService.listKnowledgeItems(),
      };
    },

    async listLibrary({
      search,
      queryMode,
    }: {
      search?: string;
      queryMode?: KnowledgeLibraryQueryMode;
    }): Promise<RouteResponse<KnowledgeLibraryListResponse>> {
      const normalizedQueryMode = queryMode === "semantic" ? "semantic" : "keyword";
      const items = await buildKnowledgeLibraryListItems({
        knowledgeService,
        search,
        queryMode: normalizedQueryMode,
      });

      return {
        status: 200,
        body: {
          query_mode: normalizedQueryMode,
          ...(search ? { search } : {}),
          items,
        },
      };
    },

    async getKnowledgeAsset({
      assetId,
      revisionId,
    }: {
      assetId: string;
      revisionId?: string;
    }): Promise<RouteResponse<KnowledgeAssetDetailRecord>> {
      return {
        status: 200,
        body: await knowledgeService.getKnowledgeAsset(assetId, revisionId),
      };
    },

    async listPendingReviewItems(): Promise<RouteResponse<KnowledgeRecord[]>> {
      return {
        status: 200,
        body: await knowledgeService.listPendingReviewItems(),
      };
    },

    async listReviewActions({
      knowledgeItemId,
    }: {
      knowledgeItemId: string;
    }): Promise<RouteResponse<KnowledgeReviewActionRecord[]>> {
      return {
        status: 200,
        body: await knowledgeService.listReviewActions(knowledgeItemId),
      };
    },

    async listReviewActionsByRevision({
      revisionId,
    }: {
      revisionId: string;
    }): Promise<RouteResponse<KnowledgeReviewActionRecord[]>> {
      return {
        status: 200,
        body: await knowledgeService.listReviewActionsByRevision(revisionId),
      };
    },

    async resolveGovernedRetrievalContext({
      input,
    }: {
      input: ResolveGovernedRetrievalContextInput;
    }): Promise<RouteResponse<GovernedRetrievalContextRecord>> {
      return {
        status: 200,
        body: await knowledgeService.resolveGovernedRetrievalContext(input),
      };
    },

    async getRetrievalSnapshot({
      actorRole,
      snapshotId,
    }: {
      actorRole: RoleKey;
      snapshotId: string;
    }): Promise<RouteResponse<KnowledgeRetrievalSnapshotRecord>> {
      return {
        status: 200,
        body: await knowledgeService.getRetrievalSnapshot(actorRole, snapshotId),
      };
    },

    async archive({
      knowledgeItemId,
    }: {
      knowledgeItemId: string;
    }): Promise<RouteResponse<KnowledgeRecord>> {
      return {
        status: 200,
        body: await knowledgeService.archive(knowledgeItemId),
      };
    },

    async uploadImage({
      input,
    }: {
      input: CreateKnowledgeUploadInput;
    }): Promise<RouteResponse<KnowledgeUploadRecord>> {
      if (!uploadService) {
        throw new Error("Knowledge upload service is not configured.");
      }

      return {
        status: 201,
        body: await uploadService.createImageUpload(input),
      };
    },

    async createHarnessDatasetCandidateFromHumanFinalAsset({
      actorRole,
      humanFinalAssetId,
      input,
    }: {
      actorRole: RoleKey;
      humanFinalAssetId: string;
      input: CreateHarnessDatasetDraftCandidateFromHumanFinalAssetInput;
    }): Promise<RouteResponse<HarnessDatasetDraftCandidateRecord>> {
      if (!harnessDatasetService) {
        throw new Error(
          "Harness dataset service is not configured for knowledge handoffs.",
        );
      }

      return {
        status: 201,
        body: await harnessDatasetService.createDraftCandidateFromHumanFinalAsset(
          actorRole,
          humanFinalAssetId,
          input,
        ),
      };
    },
  };
}

async function buildKnowledgeLibraryListItems(input: {
  knowledgeService: KnowledgeService;
  search?: string;
  queryMode: KnowledgeLibraryQueryMode;
}): Promise<KnowledgeLibraryListItemRecord[]> {
  const records = await input.knowledgeService.listKnowledgeItems();
  const normalizedSearch = normalizeSearchTerm(input.search);
  const items = await Promise.all(
    records.map(async (record) => {
      let detail: KnowledgeAssetDetailRecord | undefined;
      try {
        detail = await input.knowledgeService.getKnowledgeAsset(record.id);
      } catch (error) {
        if (!(error instanceof KnowledgeAssetNotFoundError)) {
          throw error;
        }
        detail = undefined;
      }

      const selectedRevision = detail?.selected_revision;
      const semanticLayer = selectedRevision?.semantic_layer;
      const searchHaystack =
        input.queryMode === "semantic"
          ? buildSemanticSearchHaystack(semanticLayer)
          : buildKeywordSearchHaystack(record, selectedRevision);

      if (
        normalizedSearch &&
        !searchHaystack.some((value) => value.includes(normalizedSearch))
      ) {
        return undefined;
      }

      return {
        asset_id: record.id,
        title: record.title,
        ...(record.summary ? { summary: record.summary } : {}),
        knowledge_kind: record.knowledge_kind,
        status: selectedRevision?.status ?? record.status,
        module_scope: record.routing.module_scope,
        manuscript_types: record.routing.manuscript_types,
        ...(selectedRevision ? { selected_revision_id: selectedRevision.id } : {}),
        ...(semanticLayer ? { semantic_status: semanticLayer.status } : {}),
        content_block_count: selectedRevision?.content_blocks.length ?? 0,
        ...(selectedRevision?.updated_at
          ? { updated_at: selectedRevision.updated_at }
          : {}),
      } satisfies KnowledgeLibraryListItemRecord;
    }),
  );

  return items.filter((item): item is KnowledgeLibraryListItemRecord => item != null);
}

function normalizeSearchTerm(search: string | undefined): string {
  return search?.trim().toLowerCase() ?? "";
}

function buildKeywordSearchHaystack(
  record: KnowledgeRecord,
  selectedRevision?: KnowledgeRevisionDetailRecord,
): string[] {
  return [
    record.title,
    record.canonical_text,
    record.summary ?? "",
    ...(selectedRevision?.content_blocks.flatMap((block) =>
      Object.values(block.content_payload).filter(
        (value): value is string => typeof value === "string",
      ),
    ) ?? []),
  ]
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

function buildSemanticSearchHaystack(
  semanticLayer: KnowledgeSemanticLayerRecord | undefined,
): string[] {
  if (!semanticLayer || semanticLayer.status !== "confirmed") {
    return [];
  }

  return [
    semanticLayer.page_summary ?? "",
    ...(semanticLayer.retrieval_terms ?? []),
    ...(semanticLayer.retrieval_snippets ?? []),
  ]
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}
