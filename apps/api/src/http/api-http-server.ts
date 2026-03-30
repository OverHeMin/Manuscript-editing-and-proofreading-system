import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import {
  AuthorizationError,
  PermissionGuard,
} from "../auth/permission-guard.ts";
import {
  AccountLockedError,
  InvalidCredentialsError,
} from "../auth/auth-service.ts";
import {
  AuthenticationRequiredError,
  createDemoHttpAuthRuntime,
  type HttpAuthRuntime,
  type HttpAuthenticatedSession,
} from "./demo-auth-runtime.ts";
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
  createModelRegistryApi,
  DuplicateModelRegistryEntryError,
  InMemoryModelRegistryRepository,
  InMemoryModelRoutingPolicyRepository,
  ModelRegistryEntryNotFoundError,
  ModelRegistryService,
  ModelRoutingPolicyValidationError,
  ModelRoutingReferenceNotFoundError,
} from "../modules/model-registry/index.ts";
import {
  createPromptSkillRegistryApi,
  InMemoryPromptSkillRegistryRepository,
  PromptTemplateNotFoundError,
  PromptSkillRegistryService,
  PromptSkillRegistryStatusTransitionError,
  SkillPackageNotFoundError,
} from "../modules/prompt-skill-registry/index.ts";
import {
  createTemplateApi,
  InMemoryModuleTemplateRepository,
  InMemoryTemplateFamilyRepository,
  ModuleTemplateNotFoundError,
  ModuleTemplateStatusTransitionError,
  TemplateFamilyNotFoundError,
  TemplateFamilyManuscriptTypeMismatchError,
  TemplateGovernanceService,
} from "../modules/templates/index.ts";

type RouteResponse<TBody> = {
  status: number;
  body: TBody;
  headers?: Record<string, string>;
};

export type AppEnv = "local" | "test" | "development" | "staging" | "production";

type HttpRouteMatch =
  | {
      route: "healthz";
    }
  | {
      route: "auth-local-login";
    }
  | {
      route: "auth-session";
    }
  | {
      route: "auth-logout";
    }
  | {
      route: "knowledge-create-draft";
    }
  | {
      route: "templates-create-family";
    }
  | {
      route: "templates-list-families";
    }
  | {
      route: "templates-update-family";
      templateFamilyId: string;
    }
  | {
      route: "templates-create-module-draft";
    }
  | {
      route: "templates-list-module-templates";
      templateFamilyId: string;
    }
  | {
      route: "templates-publish-module-template";
      moduleTemplateId: string;
    }
  | {
      route: "prompt-skill-create-skill-package";
    }
  | {
      route: "prompt-skill-list-skill-packages";
    }
  | {
      route: "prompt-skill-publish-skill-package";
      skillPackageId: string;
    }
  | {
      route: "prompt-skill-create-prompt-template";
    }
  | {
      route: "prompt-skill-list-prompt-templates";
    }
  | {
      route: "prompt-skill-publish-prompt-template";
      promptTemplateId: string;
    }
  | {
      route: "model-registry-create-entry";
    }
  | {
      route: "model-registry-list-entries";
    }
  | {
      route: "model-registry-update-entry";
      modelId: string;
    }
  | {
      route: "model-registry-get-routing-policy";
    }
  | {
      route: "model-registry-update-routing-policy";
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
  authRuntime?: HttpAuthRuntime;
  runtime?: ApiServerRuntime;
}

export type ApiHttpServer = Server;

export interface ApiServerRuntime {
  authRuntime: HttpAuthRuntime;
  knowledgeApi: ReturnType<typeof createKnowledgeApi>;
  learningApi: ReturnType<typeof createLearningApi>;
  learningGovernanceApi: ReturnType<typeof createLearningGovernanceApi>;
  templateApi: ReturnType<typeof createTemplateApi>;
  modelRegistryApi: ReturnType<typeof createModelRegistryApi>;
  promptSkillRegistryApi: ReturnType<typeof createPromptSkillRegistryApi>;
  permissionGuard: PermissionGuard;
}

export function createApiHttpServer(
  options: CreateApiHttpServerOptions = {},
): ApiHttpServer {
  const appEnv = options.appEnv ?? "production";
  const runtime =
    options.runtime ??
    createInMemoryApiRuntime({
      appEnv,
      authRuntime: options.authRuntime,
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
      writeResponse(res, routeResponse.status, routeResponse.body, {
        ...corsHeaders,
        ...(routeResponse.headers ?? {}),
      });
    } catch (error) {
      const [status, body, extraHeaders = {}] = mapErrorToHttpResponse(error);
      writeResponse(res, status, body, {
        ...corsHeaders,
        ...extraHeaders,
      });
    }
  });
}

export function createInMemoryApiRuntime(input: {
  appEnv: AppEnv;
  authRuntime?: HttpAuthRuntime;
  seedDemoData: boolean;
}): ApiServerRuntime {
  const authRuntime =
    input.authRuntime ??
    (input.appEnv === "local" ? createDemoHttpAuthRuntime() : undefined);
  if (!authRuntime) {
    throw new Error(
      `Persistent API runtime requires an explicit persistent auth runtime for APP_ENV="${input.appEnv}".`,
    );
  }

  const permissionGuard = new PermissionGuard();
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
  const modelRegistryRepository = new InMemoryModelRegistryRepository();
  const modelRoutingPolicyRepository = new InMemoryModelRoutingPolicyRepository();
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
  const modelRegistryService = new ModelRegistryService({
    repository: modelRegistryRepository,
    routingPolicyRepository: modelRoutingPolicyRepository,
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
    authRuntime,
    knowledgeApi: createKnowledgeApi({ knowledgeService }),
    learningApi: createLearningApi({ learningService }),
    learningGovernanceApi: createLearningGovernanceApi({
      learningGovernanceService,
    }),
    templateApi: createTemplateApi({ templateService }),
    modelRegistryApi: createModelRegistryApi({ modelRegistryService }),
    promptSkillRegistryApi: createPromptSkillRegistryApi({
      promptSkillRegistryService,
    }),
    permissionGuard,
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
  runtime: ApiServerRuntime,
): Promise<RouteResponse<unknown>> {
  switch (routeMatch.route) {
    case "healthz":
      return {
        status: 200,
        body: {
          status: "ok",
        },
      };
    case "auth-local-login": {
      const body = (await readJsonBody(req)) as {
        username: string;
        password: string;
      };
      const session = await runtime.authRuntime.authenticateLocal({
        username: body.username,
        password: body.password,
        ipAddress: readRemoteAddress(req),
        userAgent: readSingleHeader(req.headers["user-agent"]),
      });

      return {
        status: 200,
        body: {
          provider: session.provider,
          user: session.user,
          issuedAt: session.issuedAt,
          expiresAt: session.expiresAt,
          refreshAt: session.refreshAt,
        },
        headers: {
          "Set-Cookie": runtime.authRuntime.createSessionCookieHeader(session),
        },
      };
    }
    case "auth-session": {
      const session = await runtime.authRuntime.requireSession(req);

      return {
        status: 200,
        body: {
          provider: session.provider,
          user: session.user,
          issuedAt: session.issuedAt,
          expiresAt: session.expiresAt,
          refreshAt: session.refreshAt,
        },
      };
    }
    case "auth-logout":
      await runtime.authRuntime.clearSession(req);
      return {
        status: 204,
        body: null,
        headers: {
          "Set-Cookie": runtime.authRuntime.createClearedSessionCookieHeader(),
        },
      };
    case "templates-create-family":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.templateApi.createTemplateFamily(
        (await readJsonBody(req)) as Parameters<typeof runtime.templateApi.createTemplateFamily>[0],
      );
    case "templates-list-families":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.templateApi.listTemplateFamilies();
    case "templates-update-family":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.templateApi.updateTemplateFamily({
        templateFamilyId: routeMatch.templateFamilyId,
        input: (await readJsonBody(req)) as Parameters<
          typeof runtime.templateApi.updateTemplateFamily
        >[0]["input"],
      });
    case "templates-create-module-draft":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.templateApi.createModuleTemplateDraft(
        (await readJsonBody(req)) as Parameters<
          typeof runtime.templateApi.createModuleTemplateDraft
        >[0],
      );
    case "templates-list-module-templates":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.templateApi.listModuleTemplatesByTemplateFamilyId({
        templateFamilyId: routeMatch.templateFamilyId,
      });
    case "templates-publish-module-template": {
      const session = await requirePermission(req, runtime, "templates.publish");
      return runtime.templateApi.publishModuleTemplate({
        moduleTemplateId: routeMatch.moduleTemplateId,
        actorRole: session.user.role,
      });
    }
    case "prompt-skill-create-skill-package": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        actorRole?: string;
        name: string;
        version: string;
        appliesToModules: string[];
        dependencyTools?: string[];
      };

      return runtime.promptSkillRegistryApi.createSkillPackage({
        actorRole: session.user.role,
        input: {
          name: body.name,
          version: body.version,
          appliesToModules: body.appliesToModules as Parameters<
            typeof runtime.promptSkillRegistryApi.createSkillPackage
          >[0]["input"]["appliesToModules"],
          dependencyTools: body.dependencyTools,
        },
      });
    }
    case "prompt-skill-list-skill-packages":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.promptSkillRegistryApi.listSkillPackages();
    case "prompt-skill-publish-skill-package": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      return runtime.promptSkillRegistryApi.publishSkillPackage({
        actorRole: session.user.role,
        skillPackageId: routeMatch.skillPackageId,
      });
    }
    case "prompt-skill-create-prompt-template": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        actorRole?: string;
        name: string;
        version: string;
        module: string;
        manuscriptTypes: string[] | "any";
        rollbackTargetVersion?: string;
      };

      return runtime.promptSkillRegistryApi.createPromptTemplate({
        actorRole: session.user.role,
        input: {
          name: body.name,
          version: body.version,
          module: body.module as Parameters<
            typeof runtime.promptSkillRegistryApi.createPromptTemplate
          >[0]["input"]["module"],
          manuscriptTypes: body.manuscriptTypes as Parameters<
            typeof runtime.promptSkillRegistryApi.createPromptTemplate
          >[0]["input"]["manuscriptTypes"],
          rollbackTargetVersion: coalesceOptionalString(body.rollbackTargetVersion),
        },
      });
    }
    case "prompt-skill-list-prompt-templates":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.promptSkillRegistryApi.listPromptTemplates();
    case "prompt-skill-publish-prompt-template": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      return runtime.promptSkillRegistryApi.publishPromptTemplate({
        actorRole: session.user.role,
        promptTemplateId: routeMatch.promptTemplateId,
      });
    }
    case "model-registry-create-entry": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        actorRole?: string;
        provider: string;
        modelName: string;
        modelVersion?: string;
        allowedModules: string[];
        isProdAllowed: boolean;
        costProfile?: Parameters<
          typeof runtime.modelRegistryApi.createModelEntry
        >[0]["input"]["costProfile"];
        rateLimit?: Parameters<
          typeof runtime.modelRegistryApi.createModelEntry
        >[0]["input"]["rateLimit"];
        fallbackModelId?: string | null;
      };

      return runtime.modelRegistryApi.createModelEntry({
        actorRole: session.user.role,
        input: {
          provider: body.provider as Parameters<
            typeof runtime.modelRegistryApi.createModelEntry
          >[0]["input"]["provider"],
          modelName: body.modelName,
          modelVersion: coalesceOptionalString(body.modelVersion),
          allowedModules: body.allowedModules as Parameters<
            typeof runtime.modelRegistryApi.createModelEntry
          >[0]["input"]["allowedModules"],
          isProdAllowed: body.isProdAllowed,
          costProfile: body.costProfile,
          rateLimit: body.rateLimit,
          fallbackModelId:
            typeof body.fallbackModelId === "string"
              ? coalesceOptionalString(body.fallbackModelId)
              : undefined,
        },
      });
    }
    case "model-registry-list-entries":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.modelRegistryApi.listModelEntries();
    case "model-registry-update-entry": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        actorRole?: string;
        allowedModules?: string[];
        isProdAllowed?: boolean;
        costProfile?: Parameters<
          typeof runtime.modelRegistryApi.updateModelEntry
        >[0]["input"]["costProfile"];
        rateLimit?: Parameters<
          typeof runtime.modelRegistryApi.updateModelEntry
        >[0]["input"]["rateLimit"];
        fallbackModelId?: string | null;
      };

      return runtime.modelRegistryApi.updateModelEntry({
        actorRole: session.user.role,
        modelId: routeMatch.modelId,
        input: {
          allowedModules: body.allowedModules as Parameters<
            typeof runtime.modelRegistryApi.updateModelEntry
          >[0]["input"]["allowedModules"],
          isProdAllowed: body.isProdAllowed,
          costProfile: body.costProfile,
          rateLimit: body.rateLimit,
          fallbackModelId:
            typeof body.fallbackModelId === "string"
              ? coalesceOptionalString(body.fallbackModelId)
              : body.fallbackModelId === null
                ? null
                : undefined,
        },
      });
    }
    case "model-registry-get-routing-policy":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.modelRegistryApi.getRoutingPolicy();
    case "model-registry-update-routing-policy": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        actorRole?: string;
        systemDefaultModelId?: string | null;
        moduleDefaults?: Record<string, string | null>;
        templateOverrides?: Record<string, string | null>;
      };

      return runtime.modelRegistryApi.updateRoutingPolicy({
        actorRole: session.user.role,
        input: {
          systemDefaultModelId:
            typeof body.systemDefaultModelId === "string"
              ? coalesceOptionalString(body.systemDefaultModelId)
              : body.systemDefaultModelId === null
                ? null
                : undefined,
          moduleDefaults: body.moduleDefaults as Parameters<
            typeof runtime.modelRegistryApi.updateRoutingPolicy
          >[0]["input"]["moduleDefaults"],
          templateOverrides: body.templateOverrides,
        },
      });
    }
    case "knowledge-create-draft":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.knowledgeApi.createDraft(
        (await readJsonBody(req)) as CreateKnowledgeDraftInput,
      );
    case "knowledge-list":
      await requirePermission(req, runtime, "knowledge.review");
      return runtime.knowledgeApi.listKnowledgeItems();
    case "knowledge-review-queue":
      await requirePermission(req, runtime, "knowledge.review");
      return runtime.knowledgeApi.listPendingReviewItems();
    case "knowledge-submit":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.knowledgeApi.submitForReview({
        knowledgeItemId: routeMatch.knowledgeItemId,
      });
    case "knowledge-approve": {
      const session = await requirePermission(req, runtime, "knowledge.review");
      const body = (await readJsonBody(req)) as {
        reviewNote?: string;
      };

      return runtime.knowledgeApi.approve({
        knowledgeItemId: routeMatch.knowledgeItemId,
        actorRole: session.user.role,
        reviewNote: coalesceOptionalString(body.reviewNote),
      });
    }
    case "knowledge-reject": {
      const session = await requirePermission(req, runtime, "knowledge.review");
      const body = (await readJsonBody(req)) as {
        reviewNote?: string;
      };

      return runtime.knowledgeApi.reject({
        knowledgeItemId: routeMatch.knowledgeItemId,
        actorRole: session.user.role,
        reviewNote: coalesceOptionalString(body.reviewNote),
      });
    }
    case "knowledge-update-draft":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.knowledgeApi.updateDraft({
        knowledgeItemId: routeMatch.knowledgeItemId,
        input: (await readJsonBody(req)) as UpdateKnowledgeDraftInput,
      });
    case "knowledge-review-actions":
      await requirePermission(req, runtime, "knowledge.review");
      return runtime.knowledgeApi.listReviewActions({
        knowledgeItemId: routeMatch.knowledgeItemId,
      });
    case "knowledge-archive":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.knowledgeApi.archive({
        knowledgeItemId: routeMatch.knowledgeItemId,
      });
    case "learning-create-reviewed-case-snapshot": {
      const session = await requirePermission(req, runtime, "learning.review");
      return runtime.learningApi.createReviewedCaseSnapshot(
        {
          ...((await readJsonBody(req)) as Omit<
            CreateReviewedCaseSnapshotInput,
            "requestedBy"
          >),
          requestedBy: session.user.id,
        },
      );
    }
    case "learning-list-candidates":
      await requirePermission(req, runtime, "learning.review");
      return runtime.learningApi.listLearningCandidates();
    case "learning-review-queue":
      await requirePermission(req, runtime, "learning.review");
      return runtime.learningApi.listPendingReviewCandidates();
    case "learning-get-candidate":
      await requirePermission(req, runtime, "learning.review");
      return runtime.learningApi.getLearningCandidate({
        candidateId: routeMatch.candidateId,
      });
    case "learning-create-candidate": {
      const session = await requirePermission(req, runtime, "learning.review");
      return runtime.learningApi.createLearningCandidate(
        {
          ...((await readJsonBody(req)) as Omit<
            CreateLearningCandidateInput,
            "requestedBy"
          >),
          requestedBy: session.user.id,
        },
      );
    }
    case "learning-create-governed-candidate": {
      const session = await requirePermission(req, runtime, "learning.review");
      return runtime.learningApi.createGovernedLearningCandidate(
        {
          ...((await readJsonBody(req)) as Omit<
            CreateGovernedLearningCandidateInput,
            "requestedBy"
          >),
          requestedBy: session.user.id,
        },
      );
    }
    case "learning-approve-candidate": {
      const session = await requirePermission(req, runtime, "learning.review");

      return runtime.learningApi.approveLearningCandidate({
        candidateId: routeMatch.candidateId,
        actorRole: session.user.role,
      });
    }
    case "learning-governance-create-writeback": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        input: Omit<
          Parameters<typeof runtime.learningGovernanceApi.createWriteback>[0]["input"],
          "createdBy"
        >;
      };

      return runtime.learningGovernanceApi.createWriteback({
        actorRole: session.user.role,
        input: {
          ...body.input,
          createdBy: session.user.id,
        },
      });
    }
    case "learning-governance-apply-writeback": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        input: Omit<
          Parameters<typeof runtime.learningGovernanceApi.applyWriteback>[0]["input"],
          "writebackId" | "appliedBy"
        >;
      };

      return runtime.learningGovernanceApi.applyWriteback({
        actorRole: session.user.role,
        input: {
          ...body.input,
          writebackId: routeMatch.writebackId,
          appliedBy: session.user.id,
        } as Parameters<typeof runtime.learningGovernanceApi.applyWriteback>[0]["input"],
      });
    }
    case "learning-governance-list-writebacks":
      await requirePermission(req, runtime, "permissions.manage");
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

  if (method === "POST" && path === "/api/v1/auth/local/login") {
    return { route: "auth-local-login" };
  }

  if (method === "GET" && path === "/api/v1/auth/session") {
    return { route: "auth-session" };
  }

  if (method === "POST" && path === "/api/v1/auth/logout") {
    return { route: "auth-logout" };
  }

  if (method === "POST" && path === "/api/v1/templates/families") {
    return { route: "templates-create-family" };
  }

  if (method === "GET" && path === "/api/v1/templates/families") {
    return { route: "templates-list-families" };
  }

  if (method === "POST" && path === "/api/v1/templates/module-drafts") {
    return { route: "templates-create-module-draft" };
  }

  if (method === "POST" && path === "/api/v1/prompt-skill-registry/skill-packages") {
    return { route: "prompt-skill-create-skill-package" };
  }

  if (method === "GET" && path === "/api/v1/prompt-skill-registry/skill-packages") {
    return { route: "prompt-skill-list-skill-packages" };
  }

  if (method === "POST" && path === "/api/v1/prompt-skill-registry/prompt-templates") {
    return { route: "prompt-skill-create-prompt-template" };
  }

  if (method === "GET" && path === "/api/v1/prompt-skill-registry/prompt-templates") {
    return { route: "prompt-skill-list-prompt-templates" };
  }

  if (method === "POST" && path === "/api/v1/model-registry") {
    return { route: "model-registry-create-entry" };
  }

  if (method === "GET" && path === "/api/v1/model-registry") {
    return { route: "model-registry-list-entries" };
  }

  if (method === "GET" && path === "/api/v1/model-registry/routing-policy") {
    return { route: "model-registry-get-routing-policy" };
  }

  if (method === "POST" && path === "/api/v1/model-registry/routing-policy") {
    return { route: "model-registry-update-routing-policy" };
  }

  if (method === "POST" && path === "/api/v1/knowledge/drafts") {
    return { route: "knowledge-create-draft" };
  }

  const templateFamilyUpdateMatch = path.match(/^\/api\/v1\/templates\/families\/([^/]+)$/);
  if (method === "POST" && templateFamilyUpdateMatch) {
    return {
      route: "templates-update-family",
      templateFamilyId: templateFamilyUpdateMatch[1],
    };
  }

  const moduleTemplateListMatch = path.match(
    /^\/api\/v1\/templates\/families\/([^/]+)\/module-templates$/,
  );
  if (method === "GET" && moduleTemplateListMatch) {
    return {
      route: "templates-list-module-templates",
      templateFamilyId: moduleTemplateListMatch[1],
    };
  }

  const publishModuleTemplateMatch = path.match(
    /^\/api\/v1\/templates\/module-templates\/([^/]+)\/publish$/,
  );
  if (method === "POST" && publishModuleTemplateMatch) {
    return {
      route: "templates-publish-module-template",
      moduleTemplateId: publishModuleTemplateMatch[1],
    };
  }

  const publishSkillPackageMatch = path.match(
    /^\/api\/v1\/prompt-skill-registry\/skill-packages\/([^/]+)\/publish$/,
  );
  if (method === "POST" && publishSkillPackageMatch) {
    return {
      route: "prompt-skill-publish-skill-package",
      skillPackageId: publishSkillPackageMatch[1],
    };
  }

  const publishPromptTemplateMatch = path.match(
    /^\/api\/v1\/prompt-skill-registry\/prompt-templates\/([^/]+)\/publish$/,
  );
  if (method === "POST" && publishPromptTemplateMatch) {
    return {
      route: "prompt-skill-publish-prompt-template",
      promptTemplateId: publishPromptTemplateMatch[1],
    };
  }

  const updateModelRegistryEntryMatch = path.match(/^\/api\/v1\/model-registry\/([^/]+)$/);
  if (method === "POST" && updateModelRegistryEntryMatch) {
    return {
      route: "model-registry-update-entry",
      modelId: updateModelRegistryEntryMatch[1],
    };
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

function readRemoteAddress(req: IncomingMessage): string | undefined {
  return req.socket.remoteAddress ?? undefined;
}

async function requirePermission(
  req: IncomingMessage,
  runtime: ApiServerRuntime,
  permission: Parameters<PermissionGuard["assert"]>[1],
): Promise<HttpAuthenticatedSession> {
  const session = await runtime.authRuntime.requireSession(req);
  runtime.permissionGuard.assert(session.user.role, permission);
  return session;
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
    error instanceof TemplateFamilyNotFoundError ||
    error instanceof ModuleTemplateNotFoundError ||
    error instanceof ModelRegistryEntryNotFoundError ||
    error instanceof ModelRoutingReferenceNotFoundError ||
    error instanceof SkillPackageNotFoundError ||
    error instanceof PromptTemplateNotFoundError
  ) {
    return [404, { error: "not_found", message: error.message }];
  }

  if (
    error instanceof KnowledgeStatusTransitionError ||
    error instanceof LearningCandidateGovernedProvenanceRequiredError ||
    error instanceof LearningWritebackTargetMismatchError ||
    error instanceof LearningWritebackStatusTransitionError ||
    error instanceof LearningGovernanceConflictError ||
    error instanceof TemplateFamilyManuscriptTypeMismatchError ||
    error instanceof ModuleTemplateStatusTransitionError ||
    error instanceof DuplicateModelRegistryEntryError ||
    error instanceof PromptSkillRegistryStatusTransitionError
  ) {
    return [409, { error: "state_conflict", message: error.message }];
  }

  if (
    error instanceof LearningHumanFinalAssetRequiredError ||
    error instanceof LearningDeidentificationRequiredError ||
    error instanceof LearningSnapshotDeidentificationRequiredError ||
    error instanceof FeedbackSourceAssetNotFoundError ||
    error instanceof FeedbackSourceAssetMismatchError ||
    error instanceof ModelRoutingPolicyValidationError
  ) {
    return [400, { error: "invalid_request", message: error.message }];
  }

  if (error instanceof AuthorizationError) {
    return [403, { error: "forbidden", message: error.message }];
  }

  if (error instanceof InvalidCredentialsError) {
    return [401, { error: "invalid_credentials", message: error.message }];
  }

  if (error instanceof AccountLockedError) {
    return [423, { error: "account_locked", message: error.message }];
  }

  if (error instanceof AuthenticationRequiredError) {
    return [401, { error: "unauthorized", message: error.message }];
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
