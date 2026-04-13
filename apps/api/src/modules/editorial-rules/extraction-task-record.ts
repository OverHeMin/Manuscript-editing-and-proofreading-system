import type {
  AiRuleUnderstandingPayload,
  CreateRulePackageExampleSourceSessionInput,
  ManuscriptType,
  RulePackageCandidate,
} from "@medical/contracts";

export type ExtractionTaskStatus =
  | "awaiting_confirmation"
  | "partially_confirmed"
  | "completed"
  | "failed";

export type ExtractionCandidateConfirmationStatus =
  | "ai_semantic_ready"
  | "held"
  | "confirmed"
  | "rejected";

export type ExtractionCandidateSuggestedDestination =
  | "template"
  | "general_module"
  | "medical_module";

export interface ExtractionTaskRecord {
  id: string;
  task_name: string;
  manuscript_type: ManuscriptType;
  original_file_name: string;
  edited_file_name: string;
  journal_key?: string;
  source_session_id: string;
  status: ExtractionTaskStatus;
  candidate_count: number;
  pending_confirmation_count: number;
  created_at: string;
  updated_at: string;
}

export interface ExtractionTaskCandidateRecord {
  id: string;
  task_id: string;
  package_id: string;
  package_kind: RulePackageCandidate["package_kind"];
  title: string;
  confirmation_status: ExtractionCandidateConfirmationStatus;
  suggested_destination: ExtractionCandidateSuggestedDestination;
  candidate_payload: RulePackageCandidate;
  semantic_draft_payload: AiRuleUnderstandingPayload;
  intake_payload?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ExtractionTaskDetailRecord extends ExtractionTaskRecord {
  candidates: ExtractionTaskCandidateRecord[];
}

export interface CreateExtractionTaskInput {
  taskName: string;
  manuscriptType: ManuscriptType;
  originalFile: CreateRulePackageExampleSourceSessionInput["originalFile"];
  editedFile: CreateRulePackageExampleSourceSessionInput["editedFile"];
  journalKey?: string;
}

export interface UpdateExtractionTaskCandidateInput {
  taskId: string;
  candidateId: string;
  confirmationStatus?: ExtractionCandidateConfirmationStatus;
  suggestedDestination?: ExtractionCandidateSuggestedDestination;
  semanticDraftPayload?: AiRuleUnderstandingPayload;
  intakePayload?: Record<string, unknown>;
}
