import type {
  ExtractionTaskCandidateRecord,
  ExtractionTaskRecord,
} from "./extraction-task-record.ts";
import type { ExtractionTaskRepository } from "./extraction-task-repository.ts";

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneTaskRecord(record: ExtractionTaskRecord): ExtractionTaskRecord {
  return { ...record };
}

function cloneCandidateRecord(
  record: ExtractionTaskCandidateRecord,
): ExtractionTaskCandidateRecord {
  return cloneJsonValue(record);
}

export class InMemoryExtractionTaskRepository implements ExtractionTaskRepository {
  private readonly taskRecords = new Map<string, ExtractionTaskRecord>();
  private readonly candidateRecords = new Map<string, ExtractionTaskCandidateRecord>();

  async saveTask(record: ExtractionTaskRecord): Promise<void> {
    this.taskRecords.set(record.id, cloneTaskRecord(record));
  }

  async findTaskById(id: string): Promise<ExtractionTaskRecord | undefined> {
    const record = this.taskRecords.get(id);
    return record ? cloneTaskRecord(record) : undefined;
  }

  async listTasks(): Promise<ExtractionTaskRecord[]> {
    return [...this.taskRecords.values()]
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
      .map(cloneTaskRecord);
  }

  async saveCandidate(record: ExtractionTaskCandidateRecord): Promise<void> {
    this.candidateRecords.set(record.id, cloneCandidateRecord(record));
  }

  async findCandidateById(
    id: string,
  ): Promise<ExtractionTaskCandidateRecord | undefined> {
    const record = this.candidateRecords.get(id);
    return record ? cloneCandidateRecord(record) : undefined;
  }

  async listCandidatesByTaskId(
    taskId: string,
  ): Promise<ExtractionTaskCandidateRecord[]> {
    return [...this.candidateRecords.values()]
      .filter((record) => record.task_id === taskId)
      .sort((left, right) => left.created_at.localeCompare(right.created_at))
      .map(cloneCandidateRecord);
  }
}
