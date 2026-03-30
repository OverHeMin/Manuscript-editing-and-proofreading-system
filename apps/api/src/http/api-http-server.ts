import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { AuthorizationError } from "../auth/permission-guard.ts";
import {
  DocumentAssetService,
  InMemoryDocumentAssetRepository,
  ManuscriptNotFoundError,
  type DocumentAssetRecord,
} from "../modules/assets/index.ts";
import {
  FeedbackGovernanceService,
  FeedbackGovernanceReviewedSnapshotNotFoundError,
  FeedbackSourceAssetMismatchError,
  FeedbackSourceAssetNotFoundError,
  InMemoryFeedbackGovernanceRepository,
  type LearningCandidateSourceLinkRecord,
} from "../modules/feedback-governance/index.ts";
import { InMemoryExecutionTrackingRepository } from "../modules/execution-tracking/index.ts";
import {
  createKnowledgeApi,
  InMemoryKnowledgeRepository,
  InMemoryKnowledgeReviewActionRepository,
  KnowledgeItemNotFoundError,
  KnowledgeService,
  KnowledgeStatusTransitionError,
  type CreateKnowledgeDraftInput,
  type KnowledgeRecord,
  type KnowledgeReviewActionRecord,
  type UpdateKnowledgeDraftInput,
} from "../modules/knowledge/index.ts";
import {
  createLearningApi,
  InMemoryLearningCandidateRepository,
  InMemoryReviewedCaseSnapshotRepository,
  LearningCandidateGovernedProvenanceRequiredError,
  LearningCandidateNotFoundError,
  LearningDeidentificationRequiredError,
  LearningHumanFinalAssetRequiredError,
  LearningService,
  LearningSnapshotDeidentificationRequiredError,
  ReviewedCaseSnapshotNotFoundError,
  type CreateGovernedLearningCandidateInput,
  type CreateLearningCandidateInput,
  type CreateReviewedCaseSnapshotInput,
  type LearningCandidateRecord,
  type ReviewedCaseSnapshotRecord,
} from "../modules/learning/index.ts";
import {
  createLearningGovernanceApi,
  InMemoryLearningGovernanceRepository,
  LearningGovernanceConflictError,
  LearningGovernanceService,
  LearningWritebackNotFoundError,
  LearningWritebackStatusTransitionError,
  LearningWritebackTargetMismatchError,
} from "../modules/learning-governance/index.ts";
import { InMemoryManuscriptRepository, type ManuscriptRecord } from "../modules/manuscripts/index.ts";
import {
  InMemoryPromptSkillRegistryRepository,
  PromptSkillRegistryService,
} from "../modules/prompt-skill-registry/index.ts";
import {
  InMemoryModuleTemplateRepository,
  InMemoryTemplateFamilyRepository,
  TemplateFamilyNotFoundError,
  TemplateFamilyManuscriptTypeMismatchError,
  TemplateGovernanceService,
} from "../modules/templates/index.ts";

type RouteResponse<TBody> = {
  status: number;
  body: TBody;
};

type AppEnv = "local" | "test" | "production";

type HttpRouteMatch =
  | {
      route: "healthz";
    }
  | {
      route: "knowledge-create-draft";
    }
  | {
      route: "knowledge-list";
    }
  | {
      route: "knowledge-review-queue";
    }
  | {
      route: "knowledge-submit";
      knowledgeItemId: string;
    }
  | {
      route: "knowledge-approve";
      knowledgeItemId: string;
    }
  | {
      route: "knowledge-reject";
      knowledgeItemId: string;
    }
  | {
      route: "knowledge-update-draft";
      knowledgeItemId: string;
    }
  | {
      route: "knowledge-review-actions";
      knowledgeItemId: string;
    }
  | {
      route: "knowledge-archive";
      knowledgeItemId: string;
    }
  | {
      route: "learning-list-candidates";
    }
  | {
      route: "learning-review-queue";
    }
  | {
      route: "learning-get-candidate";
      candidateId: string;
    }
  | {
      route: "learning-create-reviewed-case-snapshot";
    }
  | {
      route: "learning-create-candidate";
    }
  | {
      route: "learning-create-governed-candidate";
    }
  | {
      route: "learning-approve-candidate";
      candidateId: string;
    }
  | {
      route: "learning-governance-create-writeback";
    }
  | {
      route: "learning-governance-apply-writeback";
      writebackId: string;
    }
  | {
      route: "learning-governance-list-writebacks";
      candidateId: string;
    };

export interface CreateApiHttpServerOptions {
  appEnv?: AppEnv;
  allowedOrigins?: string[];
  seedDemoKnowledgeReviewData?: boolean;
}

export type ApiHttpServer = Server;

interface AppRuntime {
  knowledgeApi: ReturnType<typeof createKnowledgeApi>;
  learningApi: ReturnType<typeof createLearningApi>;
  learningGovernanceApi: ReturnType<typeof createLearningGovernanceApi>;
}

export function createApiHttpServer(
  options: CreateApiHttpServerOptions = {},
): ApiHttpServer {
  const appEnv = options.appEnv ?? "production";
  const runtime = createAppRuntime({
    seedDemoData: options.seedDemoKnowledgeReviewData ?? appEnv === "local",
  });
  const allowedOrigins =
    options.allowedOrigins?.filter((origin) => origin.trim().length > 0) ?? [];

  return createServer(async (req, res) => {
    const corsHeaders = createCorsHeaders(req, allowedOrigins);

    try {
      if (req.method === "OPTIONS") {
        writeResponse(res, 204, null, corsHeaders);
        return;
      }

      const routeMatch = matchRoute(req);
      if (!routeMatch) {
        writeResponse(
          res,
          404,
          {
            error: "not_found",
            method: req.method ?? "UNKNOWN",
            path: readRequestPath(req),
          },
          corsHeaders,
        );
        return;
      }

      const routeResponse = await handleRoute(routeMatch, req, runtime);
      writeResponse(res, routeResponse.status, routeResponse.body, corsHeaders);
    } catch (error) {
      const [status, body, extraHeaders = {}] = mapErrorToHttpResponse(error);
      writeResponse(res, status, body, {
        ...corsHeaders,
        ...extraHeaders,
      });
    }
  });
}

function createAppRuntime(input: { seedDemoData: boolean }): AppRuntime {
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const assetRepository = new InMemoryDocumentAssetRepository();
  const reviewedCaseSnapshotRepository = new InMemoryReviewedCaseSnapshotRepository();
  const learningCandidateRepository = new InMemoryLearningCandidateRepository();
  const knowledgeRepository = new InMemoryKnowledgeRepository();
  const knowledgeReviewActionRepository =
    new InMemoryKnowledgeReviewActionRepository();
  const feedbackGovernanceRepository = new InMemoryFeedbackGovernanceRepository();
  const executionTrackingRepository = new InMemoryExecutionTrackingRepository();
  const learningGovernanceRepository = new InMemoryLearningGovernanceRepository();
  const templateFamilyRepository = new InMemoryTemplateFamilyRepository();
  const moduleTemplateRepository = new InMemoryModuleTemplateRepository();
  const promptSkillRegistryRepository =
    new InMemoryPromptSkillRegistryRepository();

  const documentAssetService = new DocumentAssetService({
    assetRepository,
    manuscriptRepository,
  });
  const feedbackGovernanceService = new FeedbackGovernanceService({
    repository: feedbackGovernanceRepository,
    executionTrackingRepository,
    assetRepository,
    reviewedCaseSnapshotRepository,
  });
  const learningService = new LearningService({
    manuscriptRepository,
    assetRepository,
    snapshotRepository: reviewedCaseSnapshotRepository,
    candidateRepository: learningCandidateRepository,
    documentAssetService,
    feedbackGovernanceService,
  });
  const knowledgeService = new KnowledgeService({
    repository: knowledgeRepository,
    reviewActionRepository: knowledgeReviewActionRepository,
    learningCandidateRepository,
  });
  const templateService = new TemplateGovernanceService({
    templateFamilyRepository,
    moduleTemplateRepository,
    learningCandidateRepository,
  });
  const promptSkillRegistryService = new PromptSkillRegistryService({
    repository: promptSkillRegistryRepository,
    learningCandidateRepository,
  });
  const learningGovernanceService = new LearningGovernanceService({
    repository: learningGovernanceRepository,
    learningCandidateRepository,
    knowledgeService,
    templateService,
    promptSkillRegistryService,
  });

  if (input.seedDemoData) {
    seedDemoKnowledgeReviewData({
      repository: knowledgeRepository,
      reviewActionRepository: knowledgeReviewActionRepository,
    });
    seedDemoLearningData({
      manuscriptRepository,
      assetRepository,
      snapshotRepository: reviewedCaseSnapshotRepository,
      candidateRepository: learningCandidateRepository,
      feedbackGovernanceRepository,
    });
  }

  return {
    knowledgeApi: createKnowledgeApi({ knowledgeService }),
    learningApi: createLearningApi({ learningService }),
    learningGovernanceApi: createLearningGovernanceApi({
      learningGovernanceService,
    }),
  };
}

function seedDemoKnowledgeReviewData(input: {
  repository: InMemoryKnowledgeRepository;
  reviewActionRepository: InMemoryKnowledgeReviewActionRepository;
}): void {
  const records: KnowledgeRecord[] = [
    {
      id: "knowledge-demo-1",
      title: "Clinical study endpoint rule",
      canonical_text:
        "Clinical study submissions must state the primary endpoint and analysis method.",
      summary:
        "Used by screening reviewers to verify endpoint and statistics coverage.",
      knowledge_kind: "rule",
      status: "pending_review",
      routing: {
        module_scope: "screening",
        manuscript_types: ["clinical_study"],
        sections: ["methods"],
        risk_tags: ["statistics"],
        discipline_tags: ["cardiology"],
      },
      evidence_level: "high",
      source_type: "guideline",
      source_link: "https://example.org/guideline",
      aliases: ["endpoint-statistics rule"],
      template_bindings: ["clinical-study-screening-core"],
    },
    {
      id: "knowledge-demo-2",
      title: "Case report privacy checklist",
      canonical_text:
        "Case report submissions must remove direct patient identifiers before proofreading.",
      summary: "Used by proofreading reviewers to confirm privacy coverage.",
      knowledge_kind: "checklist",
      status: "pending_review",
      routing: {
        module_scope: "proofreading",
        manuscript_types: ["case_report"],
        sections: ["appendix"],
        risk_tags: ["privacy"],
        discipline_tags: ["general"],
      },
      evidence_level: "medium",
      source_type: "guideline",
      source_link: "https://example.org/privacy",
      aliases: ["case privacy checklist"],
      template_bindings: ["case-report-proofreading-core"],
    },
  ];

  const reviewActions: KnowledgeReviewActionRecord[] = [
    {
      id: "knowledge-demo-action-1",
      knowledge_item_id: "knowledge-demo-1",
      action: "submitted_for_review",
      actor_role: "user",
      created_at: "2026-03-28T08:00:00.000Z",
    },
    {
      id: "knowledge-demo-action-2",
      knowledge_item_id: "knowledge-demo-2",
      action: "submitted_for_review",
      actor_role: "user",
      created_at: "2026-03-28T09:00:00.000Z",
    },
  ];

  for (const record of records) {
    void input.repository.save(record);
  }

  for (const action of reviewActions) {
    void input.reviewActionRepository.save(action);
  }
}

function seedDemoLearningData(input: {
  manuscriptRepository: InMemoryManuscriptRepository;
  assetRepository: InMemoryDocumentAssetRepository;
  snapshotRepository: InMemoryReviewedCaseSnapshotRepository;
  candidateRepository: InMemoryLearningCandidateRepository;
  feedbackGovernanceRepository: InMemoryFeedbackGovernanceRepository;
}): void {
  const manuscript: ManuscriptRecord = {
    id: "manuscript-demo-1",
    title: "Learning Demo Manuscript",
    manuscript_type: "clinical_study",
    status: "completed",
    created_by: "user-1",
    current_screening_asset_id: undefined,
    current_editing_asset_id: undefined,
    current_proofreading_asset_id: undefined,
    current_template_family_id: "family-demo-1",
    created_at: "2026-03-28T07:30:00.000Z",
    updated_at: "2026-03-28T07:30:00.000Z",
  };
  const assets: DocumentAssetRecord[] = [
    {
      id: "original-demo-1",
      manuscript_id: "manuscript-demo-1",
      asset_type: "original",
      status: "active",
      storage_key: "uploads/manuscript-demo-1/original.docx",
      mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      parent_asset_id: undefined,
      source_module: "upload",
      source_job_id: undefined,
      created_by: "user-1",
      version_no: 1,
      is_current: true,
      file_name: "original.docx",
      created_at: "2026-03-28T07:31:00.000Z",
      updated_at: "2026-03-28T07:31:00.000Z",
    },
    {
      id: "human-final-demo-1",
      manuscript_id: "manuscript-demo-1",
      asset_type: "human_final_docx",
      status: "active",
      storage_key: "learning/manuscript-demo-1/human-final.docx",
      mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      parent_asset_id: "original-demo-1",
      source_module: "manual",
      source_job_id: undefined,
      created_by: "editor-1",
      version_no: 1,
      is_current: true,
      file_name: "human-final.docx",
      created_at: "2026-03-28T07:32:00.000Z",
      updated_at: "2026-03-28T07:32:00.000Z",
    },
    {
      id: "learning-snapshot-demo-1",
      manuscript_id: "manuscript-demo-1",
      asset_type: "learning_snapshot_attachment",
      status: "active",
      storage_key: "learning/manuscript-demo-1/existing-snapshot.bin",
      mime_type: "application/octet-stream",
      parent_asset_id: "human-final-demo-1",
      source_module: "learning",
      source_job_id: undefined,
      created_by: "editor-1",
      version_no: 1,
      is_current: true,
      file_name: "snapshot.bin",
      created_at: "2026-03-28T07:33:00.000Z",
      updated_at: "2026-03-28T07:33:00.000Z",
    },
  ];
  const candidates: LearningCandidateRecord[] = [
    {
      id: "learning-approved-demo-1",
      type: "rule_candidate",
      status: "approved",
      module: "screening",
      manuscript_type: "clinical_study",
      governed_provenance_kind: "evaluation_experiment",
      governed_evaluation_run_id: "eval-demo-approved-1",
      governed_evidence_pack_id: "evidence-demo-approved-1",
      human_final_asset_id: "human-final-demo-1",
      snapshot_asset_id: "learning-snapshot-demo-1",
      title: "Approved learning candidate demo",
      proposal_text: "Promote reviewed endpoint guidance into the governed registry.",
      created_by: "editor-1",
      created_at: "2026-03-28T07:34:00.000Z",
      updated_at: "2026-03-28T07:35:00.000Z",
    },
    {
      id: "learning-pending-demo-1",
      type: "prompt_optimization_candidate",
      status: "pending_review",
      module: "editing",
      manuscript_type: "clinical_study",
      governed_provenance_kind: "evaluation_experiment",
      governed_evaluation_run_id: "eval-demo-pending-1",
      governed_evidence_pack_id: "evidence-demo-pending-1",
      human_final_asset_id: "human-final-demo-1",
      snapshot_asset_id: "learning-snapshot-demo-1",
      title: "Pending terminology normalization",
      proposal_text: "Tighten terminology normalization and endpoint wording for editing runs.",
      created_by: "editor-1",
      created_at: "2026-03-28T07:36:00.000Z",
      updated_at: "2026-03-28T07:40:00.000Z",
    },
    {
      id: "learning-pending-demo-2",
      type: "checklist_update_candidate",
      status: "pending_review",
      module: "proofreading",
      manuscript_type: "clinical_study",
      governed_provenance_kind: "evaluation_experiment",
      governed_evaluation_run_id: "eval-demo-pending-2",
      governed_evidence_pack_id: "evidence-demo-pending-2",
      human_final_asset_id: "human-final-demo-1",
      snapshot_asset_id: "learning-snapshot-demo-1",
      title: "Pending checklist update",
      proposal_text: "Add a final privacy and consistency checklist before proof handoff.",
      created_by: "editor-1",
      created_at: "2026-03-28T07:37:00.000Z",
      updated_at: "2026-03-28T07:39:00.000Z",
    },
  ];
  const reviewedSnapshots: ReviewedCaseSnapshotRecord[] = [
    {
      id: "reviewed-case-snapshot-demo-1",
      manuscript_id: "manuscript-demo-1",
      module: "editing",
      manuscript_type: "clinical_study",
      human_final_asset_id: "human-final-demo-1",
      deidentification_passed: true,
      snapshot_asset_id: "learning-snapshot-demo-1",
      created_by: "editor-1",
      created_at: "2026-03-28T07:33:30.000Z",
    },
  ];
  const sourceLinks: LearningCandidateSourceLinkRecord[] = [
    {
      id: "learning-source-approved-demo-1",
      learning_candidate_id: "learning-approved-demo-1",
      source_kind: "evaluation_experiment",
      snapshot_kind: "reviewed_case_snapshot",
      snapshot_id: "reviewed-case-snapshot-demo-1",
      evaluation_run_id: "eval-demo-approved-1",
      evidence_pack_id: "evidence-demo-approved-1",
      source_asset_id: "human-final-demo-1",
      created_at: "2026-03-28T07:34:30.000Z",
    },
    {
      id: "learning-source-pending-demo-1",
      learning_candidate_id: "learning-pending-demo-1",
      source_kind: "evaluation_experiment",
      snapshot_kind: "reviewed_case_snapshot",
      snapshot_id: "reviewed-case-snapshot-demo-1",
      evaluation_run_id: "eval-demo-pending-1",
      evidence_pack_id: "evidence-demo-pending-1",
      source_asset_id: "human-final-demo-1",
      created_at: "2026-03-28T07:36:30.000Z",
    },
    {
      id: "learning-source-pending-demo-2",
      learning_candidate_id: "learning-pending-demo-2",
      source_kind: "evaluation_experiment",
      snapshot_kind: "reviewed_case_snapshot",
      snapshot_id: "reviewed-case-snapshot-demo-1",
      evaluation_run_id: "eval-demo-pending-2",
      evidence_pack_id: "evidence-demo-pending-2",
      source_asset_id: "human-final-demo-1",
      created_at: "2026-03-28T07:37:30.000Z",
    },
  ];

  void input.manuscriptRepository.save(manuscript);
  for (const asset of assets) {
    void input.assetRepository.save(asset);
  }
  for (const snapshot of reviewedSnapshots) {
    void input.snapshotRepository.save(snapshot);
  }
  for (const candidate of candidates) {
    void input.candidateRepository.save(candidate);
  }
  for (const sourceLink of sourceLinks) {
    void input.feedbackGovernanceRepository.saveLearningCandidateSourceLink(
      sourceLink,
    );
  }
}

async function handleRoute(
  routeMatch: HttpRouteMatch,
  req: IncomingMessage,
  runtime: AppRuntime,
): Promise<RouteResponse<unknown>> {
  switch (routeMatch.route) {
    case "healthz":
      return {
        status: 200,
        body: {
          status: "ok",
        },
      };
    case "knowledge-create-draft":
      return runtime.knowledgeApi.createDraft(
        (await readJsonBody(req)) as CreateKnowledgeDraftInput,
      );
    case "knowledge-list":
      return runtime.knowledgeApi.listKnowledgeItems();
    case "knowledge-review-queue":
      return runtime.knowledgeApi.listPendingReviewItems();
    case "knowledge-submit":
      return runtime.knowledgeApi.submitForReview({
        knowledgeItemId: routeMatch.knowledgeItemId,
      });
    case "knowledge-approve": {
      const body = (await readJsonBody(req)) as {
        actorRole: Parameters<typeof runtime.knowledgeApi.approve>[0]["actorRole"];
        reviewNote?: string;
      };

      return runtime.knowledgeApi.approve({
        knowledgeItemId: routeMatch.knowledgeItemId,
        actorRole: body.actorRole,
        reviewNote: coalesceOptionalString(body.reviewNote),
      });
    }
    case "knowledge-reject": {
      const body = (await readJsonBody(req)) as {
        actorRole: Parameters<typeof runtime.knowledgeApi.reject>[0]["actorRole"];
        reviewNote?: string;
      };

      return runtime.knowledgeApi.reject({
        knowledgeItemId: routeMatch.knowledgeItemId,
        actorRole: body.actorRole,
        reviewNote: coalesceOptionalString(body.reviewNote),
      });
    }
    case "knowledge-update-draft":
      return runtime.knowledgeApi.updateDraft({
        knowledgeItemId: routeMatch.knowledgeItemId,
        input: (await readJsonBody(req)) as UpdateKnowledgeDraftInput,
      });
    case "knowledge-review-actions":
      return runtime.knowledgeApi.listReviewActions({
        knowledgeItemId: routeMatch.knowledgeItemId,
      });
    case "knowledge-archive":
      return runtime.knowledgeApi.archive({
        knowledgeItemId: routeMatch.knowledgeItemId,
      });
    case "learning-create-reviewed-case-snapshot":
      return runtime.learningApi.createReviewedCaseSnapshot(
        (await readJsonBody(req)) as CreateReviewedCaseSnapshotInput,
      );
    case "learning-list-candidates":
      return runtime.learningApi.listLearningCandidates();
    case "learning-review-queue":
      return runtime.learningApi.listPendingReviewCandidates();
    case "learning-get-candidate":
      return runtime.learningApi.getLearningCandidate({
        candidateId: routeMatch.candidateId,
      });
    case "learning-create-candidate":
      return runtime.learningApi.createLearningCandidate(
        (await readJsonBody(req)) as CreateLearningCandidateInput,
      );
    case "learning-create-governed-candidate":
      return runtime.learningApi.createGovernedLearningCandidate(
        (await readJsonBody(req)) as CreateGovernedLearningCandidateInput,
      );
    case "learning-approve-candidate": {
      const body = (await readJsonBody(req)) as {
        actorRole: Parameters<
          typeof runtime.learningApi.approveLearningCandidate
        >[0]["actorRole"];
      };

      return runtime.learningApi.approveLearningCandidate({
        candidateId: routeMatch.candidateId,
        actorRole: body.actorRole,
      });
    }
    case "learning-governance-create-writeback": {
      const body = (await readJsonBody(req)) as Parameters<
        typeof runtime.learningGovernanceApi.createWriteback
      >[0];

      return runtime.learningGovernanceApi.createWriteback(body);
    }
    case "learning-governance-apply-writeback": {
      const body = (await readJsonBody(req)) as {
        actorRole: Parameters<
          typeof runtime.learningGovernanceApi.applyWriteback
        >[0]["actorRole"];
        input: Omit<
          Parameters<typeof runtime.learningGovernanceApi.applyWriteback>[0]["input"],
          "writebackId"
        >;
      };

      return runtime.learningGovernanceApi.applyWriteback({
        actorRole: body.actorRole,
        input: {
          ...body.input,
          writebackId: routeMatch.writebackId,
        } as Parameters<typeof runtime.learningGovernanceApi.applyWriteback>[0]["input"],
      });
    }
    case "learning-governance-list-writebacks":
      return runtime.learningGovernanceApi.listWritebacksByCandidate({
        learningCandidateId: routeMatch.candidateId,
      });
  }
}

function matchRoute(req: IncomingMessage): HttpRouteMatch | null {
  const method = req.method ?? "GET";
  const path = readRequestPath(req);

  if (method === "GET" && path === "/healthz") {
    return { route: "healthz" };
  }

  if (method === "POST" && path === "/api/v1/knowledge/drafts") {
    return { route: "knowledge-create-draft" };
  }

  if (method === "GET" && path === "/api/v1/knowledge") {
    return { route: "knowledge-list" };
  }

  if (method === "GET" && path === "/api/v1/knowledge/review-queue") {
    return { route: "knowledge-review-queue" };
  }

  if (method === "POST" && path === "/api/v1/learning/reviewed-case-snapshots") {
    return { route: "learning-create-reviewed-case-snapshot" };
  }

  if (method === "GET" && path === "/api/v1/learning/candidates") {
    return { route: "learning-list-candidates" };
  }

  if (method === "GET" && path === "/api/v1/learning/candidates/review-queue") {
    return { route: "learning-review-queue" };
  }

  if (method === "POST" && path === "/api/v1/learning/candidates") {
    return { route: "learning-create-candidate" };
  }

  if (method === "POST" && path === "/api/v1/learning/candidates/governed") {
    return { route: "learning-create-governed-candidate" };
  }

  const learningApproveMatch = path.match(
    /^\/api\/v1\/learning\/candidates\/([^/]+)\/approve$/,
  );
  if (method === "POST" && learningApproveMatch) {
    return {
      route: "learning-approve-candidate",
      candidateId: learningApproveMatch[1],
    };
  }

  const learningCandidateMatch = path.match(
    /^\/api\/v1\/learning\/candidates\/([^/]+)$/,
  );
  if (method === "GET" && learningCandidateMatch) {
    return {
      route: "learning-get-candidate",
      candidateId: learningCandidateMatch[1],
    };
  }

  if (method === "POST" && path === "/api/v1/learning-governance/writebacks") {
    return { route: "learning-governance-create-writeback" };
  }

  const learningApplyWritebackMatch = path.match(
    /^\/api\/v1\/learning-governance\/writebacks\/([^/]+)\/apply$/,
  );
  if (method === "POST" && learningApplyWritebackMatch) {
    return {
      route: "learning-governance-apply-writeback",
      writebackId: learningApplyWritebackMatch[1],
    };
  }

  const learningListWritebacksMatch = path.match(
    /^\/api\/v1\/learning-governance\/candidates\/([^/]+)\/writebacks$/,
  );
  if (method === "GET" && learningListWritebacksMatch) {
    return {
      route: "learning-governance-list-writebacks",
      candidateId: learningListWritebacksMatch[1],
    };
  }

  const reviewActionsMatch = path.match(
    /^\/api\/v1\/knowledge\/([^/]+)\/review-actions$/,
  );
  if (method === "GET" && reviewActionsMatch) {
    return {
      route: "knowledge-review-actions",
      knowledgeItemId: reviewActionsMatch[1],
    };
  }

  const submitMatch = path.match(/^\/api\/v1\/knowledge\/([^/]+)\/submit$/);
  if (method === "POST" && submitMatch) {
    return {
      route: "knowledge-submit",
      knowledgeItemId: submitMatch[1],
    };
  }

  const approveMatch = path.match(/^\/api\/v1\/knowledge\/([^/]+)\/approve$/);
  if (method === "POST" && approveMatch) {
    return {
      route: "knowledge-approve",
      knowledgeItemId: approveMatch[1],
    };
  }

  const rejectMatch = path.match(/^\/api\/v1\/knowledge\/([^/]+)\/reject$/);
  if (method === "POST" && rejectMatch) {
    return {
      route: "knowledge-reject",
      knowledgeItemId: rejectMatch[1],
    };
  }

  const draftMatch = path.match(/^\/api\/v1\/knowledge\/([^/]+)\/draft$/);
  if (method === "POST" && draftMatch) {
    return {
      route: "knowledge-update-draft",
      knowledgeItemId: draftMatch[1],
    };
  }

  const archiveMatch = path.match(/^\/api\/v1\/knowledge\/([^/]+)\/archive$/);
  if (method === "POST" && archiveMatch) {
    return {
      route: "knowledge-archive",
      knowledgeItemId: archiveMatch[1],
    };
  }

  return null;
}

function readRequestPath(req: IncomingMessage): string {
  return new URL(req.url || "/", "http://127.0.0.1").pathname;
}

function createCorsHeaders(
  req: IncomingMessage,
  allowedOrigins: readonly string[],
): Record<string, string> {
  const requestOrigin = readSingleHeader(req.headers.origin);
  if (!requestOrigin || !allowedOrigins.includes(requestOrigin)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": requestOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Uint8Array[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  if (rawBody.trim().length === 0) {
    return {};
  }

  return JSON.parse(rawBody);
}

function writeResponse(
  res: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): void {
  if (status === 204) {
    res.writeHead(status, extraHeaders);
    res.end();
    return;
  }

  res.writeHead(status, {
    ...extraHeaders,
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(body));
}

function mapErrorToHttpResponse(
  error: unknown,
): [number, unknown, Record<string, string>?] {
  if (
    error instanceof KnowledgeItemNotFoundError ||
    error instanceof LearningCandidateNotFoundError ||
    error instanceof ReviewedCaseSnapshotNotFoundError ||
    error instanceof LearningWritebackNotFoundError ||
    error instanceof FeedbackGovernanceReviewedSnapshotNotFoundError ||
    error instanceof ManuscriptNotFoundError ||
    error instanceof TemplateFamilyNotFoundError
  ) {
    return [404, { error: "not_found", message: error.message }];
  }

  if (
    error instanceof KnowledgeStatusTransitionError ||
    error instanceof LearningCandidateGovernedProvenanceRequiredError ||
    error instanceof LearningWritebackTargetMismatchError ||
    error instanceof LearningWritebackStatusTransitionError ||
    error instanceof LearningGovernanceConflictError ||
    error instanceof TemplateFamilyManuscriptTypeMismatchError
  ) {
    return [409, { error: "state_conflict", message: error.message }];
  }

  if (
    error instanceof LearningHumanFinalAssetRequiredError ||
    error instanceof LearningDeidentificationRequiredError ||
    error instanceof LearningSnapshotDeidentificationRequiredError ||
    error instanceof FeedbackSourceAssetNotFoundError ||
    error instanceof FeedbackSourceAssetMismatchError
  ) {
    return [400, { error: "invalid_request", message: error.message }];
  }

  if (error instanceof AuthorizationError) {
    return [403, { error: "forbidden", message: error.message }];
  }

  if (error instanceof SyntaxError) {
    return [400, { error: "invalid_json", message: error.message }];
  }

  if (error instanceof Error) {
    return [500, { error: "internal_error", message: error.message }];
  }

  return [500, { error: "internal_error", message: "Unknown server error." }];
}

function readSingleHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function coalesceOptionalString(value: string | undefined): string | undefined {
  return value?.trim() ? value.trim() : undefined;
}
