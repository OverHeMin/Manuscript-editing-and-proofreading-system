import type {
  KnowledgeHitLogViewModel,
  ModuleExecutionSnapshotViewModel,
  RecordExecutionSnapshotInput,
} from "./types.ts";

export interface ExecutionTrackingHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function recordExecutionSnapshot(
  client: ExecutionTrackingHttpClient,
  input: RecordExecutionSnapshotInput,
) {
  return client.request<ModuleExecutionSnapshotViewModel>({
    method: "POST",
    url: "/api/v1/execution-tracking/snapshots",
    body: {
      input,
    },
  });
}

export function getExecutionSnapshot(
  client: ExecutionTrackingHttpClient,
  snapshotId: string,
) {
  return client.request<ModuleExecutionSnapshotViewModel | undefined>({
    method: "GET",
    url: `/api/v1/execution-tracking/snapshots/${snapshotId}`,
  });
}

export function listKnowledgeHitLogsBySnapshotId(
  client: ExecutionTrackingHttpClient,
  snapshotId: string,
) {
  return client.request<KnowledgeHitLogViewModel[]>({
    method: "GET",
    url: `/api/v1/execution-tracking/snapshots/${snapshotId}/knowledge-hit-logs`,
  });
}
