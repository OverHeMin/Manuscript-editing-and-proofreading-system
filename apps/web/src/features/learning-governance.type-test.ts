import {
  applyLearningWriteback,
  createLearningWriteback,
  listLearningWritebacksByCandidate,
  type ApplyLearningWritebackInput,
  type CreateLearningWritebackInput,
  type LearningWritebackTarget,
  type LearningWritebackViewModel,
} from "./learning-governance/index.ts";
import type { LearningCandidateViewModel } from "./learning-review/types.ts";

const writebackTargetCheck: LearningWritebackTarget = "prompt_template";

const writebackViewModelCheck: LearningWritebackViewModel = {
  id: "writeback-1",
  learning_candidate_id: "candidate-1",
  target_type: writebackTargetCheck,
  status: "applied",
  created_draft_asset_id: "prompt-1",
  created_by: "admin-1",
  created_at: "2026-03-28T08:05:00.000Z",
  applied_by: "admin-1",
  applied_at: "2026-03-28T08:06:00.000Z",
};

const candidateViewModelCheck: LearningCandidateViewModel = {
  id: "candidate-1",
  type: "skill_update_candidate",
  status: "approved",
  module: "editing",
  manuscript_type: "clinical_study",
  title: "editing skill package update",
  proposal_text: "Add terminology normalization and risk paragraph checks.",
  created_by: "editor-1",
  created_at: "2026-03-28T08:00:00.000Z",
  updated_at: "2026-03-28T08:01:00.000Z",
  writeback_summaries: [writebackViewModelCheck],
};

const createWritebackInputCheck: CreateLearningWritebackInput = {
  actorRole: "admin",
  learningCandidateId: "candidate-1",
  targetType: "prompt_template",
  createdBy: "admin-1",
};

const applyWritebackInputCheck: ApplyLearningWritebackInput = {
  actorRole: "admin",
  writebackId: "writeback-1",
  targetType: "prompt_template",
  appliedBy: "admin-1",
  name: "proofreading_mainline",
  version: "1.1.0",
  module: "proofreading",
  manuscriptTypes: ["review"],
};

const client = {
  async request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }) {
    void input;
    return {
      status: 200,
      body: undefined as TResponse,
    };
  },
};

void createLearningWriteback(client, createWritebackInputCheck);
void applyLearningWriteback(client, applyWritebackInputCheck);
void listLearningWritebacksByCandidate(client, "candidate-1");

export {
  applyWritebackInputCheck,
  candidateViewModelCheck,
  createWritebackInputCheck,
  writebackTargetCheck,
  writebackViewModelCheck,
};
