import type {
  ExtractionTaskCandidateRecord,
  ExtractionTaskRecord,
} from "./extraction-task-record.ts";

export interface ExtractionTaskRepository {
  saveTask(record: ExtractionTaskRecord): Promise<void>;
  findTaskById(id: string): Promise<ExtractionTaskRecord | undefined>;
  listTasks(): Promise<ExtractionTaskRecord[]>;
  saveCandidate(record: ExtractionTaskCandidateRecord): Promise<void>;
  findCandidateById(id: string): Promise<ExtractionTaskCandidateRecord | undefined>;
  listCandidatesByTaskId(taskId: string): Promise<ExtractionTaskCandidateRecord[]>;
}
