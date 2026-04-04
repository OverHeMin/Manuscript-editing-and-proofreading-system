import type {
  KnowledgeRetrievalIndexEntryRecord,
  KnowledgeRetrievalQualityRunRecord,
  KnowledgeRetrievalSnapshotRecord,
} from "./knowledge-retrieval-record.ts";
import type {
  KnowledgeRetrievalService,
  RecordKnowledgeRetrievalQualityRunInput,
  RecordKnowledgeRetrievalSnapshotInput,
  UpsertKnowledgeRetrievalIndexEntryInput,
} from "./knowledge-retrieval-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateKnowledgeRetrievalApiOptions {
  knowledgeRetrievalService: KnowledgeRetrievalService;
}

export function createKnowledgeRetrievalApi(
  options: CreateKnowledgeRetrievalApiOptions,
) {
  const { knowledgeRetrievalService } = options;

  return {
    async upsertIndexEntry({
      input,
    }: {
      input: UpsertKnowledgeRetrievalIndexEntryInput;
    }): Promise<RouteResponse<KnowledgeRetrievalIndexEntryRecord>> {
      return {
        status: 201,
        body: await knowledgeRetrievalService.upsertIndexEntry(input),
      };
    },

    async recordRetrievalSnapshot({
      input,
    }: {
      input: RecordKnowledgeRetrievalSnapshotInput;
    }): Promise<RouteResponse<KnowledgeRetrievalSnapshotRecord>> {
      return {
        status: 201,
        body: await knowledgeRetrievalService.recordRetrievalSnapshot(input),
      };
    },

    async recordRetrievalQualityRun({
      input,
    }: {
      input: RecordKnowledgeRetrievalQualityRunInput;
    }): Promise<RouteResponse<KnowledgeRetrievalQualityRunRecord>> {
      return {
        status: 201,
        body: await knowledgeRetrievalService.recordRetrievalQualityRun(input),
      };
    },
  };
}
