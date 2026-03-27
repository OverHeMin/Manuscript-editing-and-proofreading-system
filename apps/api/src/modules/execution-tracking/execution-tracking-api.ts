import type {
  KnowledgeHitLogRecord,
  ModuleExecutionSnapshotRecord,
} from "./execution-tracking-record.ts";
import type {
  ExecutionTrackingService,
  RecordExecutionSnapshotInput,
} from "./execution-tracking-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateExecutionTrackingApiOptions {
  executionTrackingService: ExecutionTrackingService;
}

export function createExecutionTrackingApi(
  options: CreateExecutionTrackingApiOptions,
) {
  const { executionTrackingService } = options;

  return {
    async recordSnapshot({
      input,
    }: {
      input: RecordExecutionSnapshotInput;
    }): Promise<RouteResponse<ModuleExecutionSnapshotRecord>> {
      return {
        status: 201,
        body: await executionTrackingService.recordSnapshot(input),
      };
    },

    async getSnapshot({
      snapshotId,
    }: {
      snapshotId: string;
    }): Promise<RouteResponse<ModuleExecutionSnapshotRecord | undefined>> {
      return {
        status: 200,
        body: await executionTrackingService.getSnapshot(snapshotId),
      };
    },

    async listKnowledgeHitLogsBySnapshotId({
      snapshotId,
    }: {
      snapshotId: string;
    }): Promise<RouteResponse<KnowledgeHitLogRecord[]>> {
      return {
        status: 200,
        body: await executionTrackingService.listKnowledgeHitLogsBySnapshotId(
          snapshotId,
        ),
      };
    },
  };
}
