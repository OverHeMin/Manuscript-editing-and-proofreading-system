import { randomUUID } from "node:crypto";
import type {
  AiRuleUnderstandingPayload,
  RulePackageCandidate,
} from "@medical/contracts";
import type { EditorialRulePackageService } from "./editorial-rule-package-service.ts";
import type {
  CreateExtractionTaskInput,
  ExtractionCandidateConfirmationStatus,
  ExtractionTaskCandidateRecord,
  ExtractionTaskDetailRecord,
  ExtractionTaskRecord,
  UpdateExtractionTaskCandidateInput,
} from "./extraction-task-record.ts";
import type { ExtractionTaskRepository } from "./extraction-task-repository.ts";

export interface ExtractionTaskServiceOptions {
  repository: ExtractionTaskRepository;
  rulePackageService: Pick<
    EditorialRulePackageService,
    "createExampleSourceSession" | "loadWorkspace"
  >;
  createId?: () => string;
  now?: () => Date;
}

export class ExtractionTaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Rule-package extraction task "${taskId}" was not found.`);
    this.name = "ExtractionTaskNotFoundError";
  }
}

export class ExtractionTaskCandidateNotFoundError extends Error {
  constructor(candidateId: string) {
    super(`Rule-package extraction candidate "${candidateId}" was not found.`);
    this.name = "ExtractionTaskCandidateNotFoundError";
  }
}

export class ExtractionTaskService {
  private readonly repository: ExtractionTaskRepository;
  private readonly rulePackageService: Pick<
    EditorialRulePackageService,
    "createExampleSourceSession" | "loadWorkspace"
  >;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: ExtractionTaskServiceOptions) {
    this.repository = options.repository;
    this.rulePackageService = options.rulePackageService;
    this.createId = options.createId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  listTasks(): Promise<ExtractionTaskRecord[]> {
    return this.repository.listTasks();
  }

  async getTask(taskId: string): Promise<ExtractionTaskDetailRecord> {
    const task = await this.repository.findTaskById(taskId);
    if (!task) {
      throw new ExtractionTaskNotFoundError(taskId);
    }

    return this.hydrateTask(task);
  }

  async createTask(
    input: CreateExtractionTaskInput,
  ): Promise<ExtractionTaskDetailRecord> {
    const createdAt = this.now().toISOString();
    const taskId = this.createId();
    const sourceSession = await this.rulePackageService.createExampleSourceSession({
      originalFile: input.originalFile,
      editedFile: input.editedFile,
      ...(input.journalKey ? { journalKey: input.journalKey } : {}),
    });
    const workspace = await this.rulePackageService.loadWorkspace({
      sourceKind: "uploaded_example_pair",
      exampleSourceSessionId: sourceSession.session_id,
      ...(input.journalKey ? { journalKey: input.journalKey } : {}),
    });
    const candidates = workspace.candidates.map((candidate) =>
      buildCandidateRecord({
        id: this.createId(),
        taskId,
        createdAt,
        manuscriptType: input.manuscriptType,
        candidate,
      }),
    );
    const task = buildTaskRecord({
      id: taskId,
      input,
      sourceSessionId: sourceSession.session_id,
      createdAt,
      candidates,
    });

    await this.repository.saveTask(task);
    for (const candidate of candidates) {
      await this.repository.saveCandidate(candidate);
    }

    return {
      ...task,
      candidates,
    };
  }

  async updateCandidate(
    input: UpdateExtractionTaskCandidateInput,
  ): Promise<ExtractionTaskDetailRecord> {
    const task = await this.repository.findTaskById(input.taskId);
    if (!task) {
      throw new ExtractionTaskNotFoundError(input.taskId);
    }

    const candidate = await this.repository.findCandidateById(input.candidateId);
    if (!candidate || candidate.task_id !== input.taskId) {
      throw new ExtractionTaskCandidateNotFoundError(input.candidateId);
    }

    const updatedAt = this.now().toISOString();
    const updatedCandidate: ExtractionTaskCandidateRecord = {
      ...candidate,
      confirmation_status:
        input.confirmationStatus ?? candidate.confirmation_status,
      suggested_destination:
        input.suggestedDestination ?? candidate.suggested_destination,
      semantic_draft_payload:
        input.semanticDraftPayload ?? candidate.semantic_draft_payload,
      ...(input.intakePayload
        ? { intake_payload: input.intakePayload }
        : candidate.intake_payload
          ? { intake_payload: candidate.intake_payload }
          : {}),
      updated_at: updatedAt,
    };
    await this.repository.saveCandidate(updatedCandidate);

    const currentCandidates = await this.repository.listCandidatesByTaskId(task.id);
    const nextCandidates = currentCandidates.map((currentCandidate) =>
      currentCandidate.id === updatedCandidate.id ? updatedCandidate : currentCandidate,
    );
    const nextTask: ExtractionTaskRecord = {
      ...task,
      status: resolveTaskStatus(nextCandidates),
      candidate_count: nextCandidates.length,
      pending_confirmation_count: countPendingCandidates(nextCandidates),
      updated_at: updatedAt,
    };
    await this.repository.saveTask(nextTask);

    return {
      ...nextTask,
      candidates: nextCandidates,
    };
  }

  private async hydrateTask(
    task: ExtractionTaskRecord,
  ): Promise<ExtractionTaskDetailRecord> {
    return {
      ...task,
      candidates: await this.repository.listCandidatesByTaskId(task.id),
    };
  }
}

function buildTaskRecord(input: {
  id: string;
  input: CreateExtractionTaskInput;
  sourceSessionId: string;
  createdAt: string;
  candidates: ExtractionTaskCandidateRecord[];
}): ExtractionTaskRecord {
  return {
    id: input.id,
    task_name: input.input.taskName,
    manuscript_type: input.input.manuscriptType,
    original_file_name: input.input.originalFile.fileName,
    edited_file_name: input.input.editedFile.fileName,
    ...(input.input.journalKey ? { journal_key: input.input.journalKey } : {}),
    source_session_id: input.sourceSessionId,
    status: resolveTaskStatus(input.candidates),
    candidate_count: input.candidates.length,
    pending_confirmation_count: countPendingCandidates(input.candidates),
    created_at: input.createdAt,
    updated_at: input.createdAt,
  };
}

function buildCandidateRecord(input: {
  id: string;
  taskId: string;
  createdAt: string;
  manuscriptType: CreateExtractionTaskInput["manuscriptType"];
  candidate: RulePackageCandidate;
}): ExtractionTaskCandidateRecord {
  return {
    id: input.id,
    task_id: input.taskId,
    package_id: input.candidate.package_id,
    package_kind: input.candidate.package_kind,
    title: input.candidate.title,
    confirmation_status: "ai_semantic_ready",
    suggested_destination: inferSuggestedDestination(
      input.candidate,
      input.manuscriptType,
    ),
    candidate_payload: cloneJsonValue(input.candidate),
    semantic_draft_payload: cloneJsonValue(
      input.candidate.semantic_draft ?? buildSemanticDraft(input.candidate),
    ),
    created_at: input.createdAt,
    updated_at: input.createdAt,
  };
}

function buildSemanticDraft(
  candidate: RulePackageCandidate,
): AiRuleUnderstandingPayload {
  return {
    semantic_summary: candidate.cards.ai_understanding.summary,
    hit_scope: candidate.cards.ai_understanding.hit_objects,
    applicability: [
      ...candidate.cards.applicability.sections,
      ...candidate.cards.applicability.table_targets,
    ],
    evidence_examples: candidate.cards.evidence.examples,
    failure_boundaries: candidate.cards.exclusions.not_applicable_when,
    normalization_recipe: candidate.cards.ai_understanding.hit_locations,
    review_policy: candidate.cards.exclusions.human_review_required_when,
    confirmed_fields: [],
  };
}

function inferSuggestedDestination(
  candidate: RulePackageCandidate,
  manuscriptType: CreateExtractionTaskInput["manuscriptType"],
): ExtractionTaskCandidateRecord["suggested_destination"] {
  switch (candidate.package_kind) {
    case "front_matter":
    case "abstract_keywords":
    case "heading_hierarchy":
    case "statement":
    case "manuscript_structure":
      return "template";
    case "terminology":
    case "numeric_statistics":
      return manuscriptType === "clinical_study" ||
        manuscriptType === "diagnostic_study" ||
        manuscriptType === "meta_analysis"
        ? "medical_module"
        : "general_module";
    case "three_line_table":
    case "reference":
    default:
      return "general_module";
  }
}

function countPendingCandidates(
  candidates: readonly ExtractionTaskCandidateRecord[],
): number {
  return candidates.filter((candidate) =>
    isPendingConfirmationStatus(candidate.confirmation_status),
  ).length;
}

function resolveTaskStatus(
  candidates: readonly ExtractionTaskCandidateRecord[],
): ExtractionTaskRecord["status"] {
  if (candidates.length === 0) {
    return "failed";
  }

  const pendingCount = countPendingCandidates(candidates);
  if (pendingCount === 0) {
    return "completed";
  }

  if (pendingCount === candidates.length) {
    return "awaiting_confirmation";
  }

  return "partially_confirmed";
}

function isPendingConfirmationStatus(
  status: ExtractionCandidateConfirmationStatus,
): boolean {
  return status === "ai_semantic_ready" || status === "held";
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
