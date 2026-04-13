import type { RoleKey } from "../../users/roles.ts";
import { EditorialRuleService } from "./editorial-rule-service.ts";
import type {
  CreateEditorialRuleInput,
  CreateEditorialRuleSetInput,
} from "./editorial-rule-service.ts";
import type {
  EditorialRulePreviewService,
  PreviewEditorialRuleInput,
  PreviewResolvedEditorialRulesInput,
  EditorialRulePreviewResult,
} from "./editorial-rule-preview-service.ts";
import type {
  CompileRulePackagesToDraftInput,
  CompileRulePackagesToDraftResult,
  CreateRulePackageExampleSourceSessionInput,
  GenerateRulePackageCandidatesInput,
  GenerateRulePackageCandidatesFromReviewedCaseInput,
  LoadRulePackageWorkspaceInput,
  PreviewCompileRulePackagesInput,
  RulePackageCompilePreviewResult,
  PreviewRulePackageDraftInput,
} from "./editorial-rule-package-types.ts";
import type { EditorialRulePackageService } from "./editorial-rule-package-service.ts";
import type {
  ExtractionTaskDetailRecord,
  ExtractionTaskRecord,
} from "./extraction-task-record.ts";
import type { ExtractionTaskService } from "./extraction-task-service.ts";
import type { RulePackageCompileService } from "./rule-package-compile-service.ts";
import type {
  RulePackageCandidate,
  RulePackageExampleSourceSession,
  RulePackagePreview,
  RulePackageWorkspace,
} from "@medical/contracts";
import type {
  EditorialRuleRecord,
  EditorialRuleSetRecord,
} from "./editorial-rule-record.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateEditorialRuleApiOptions {
  editorialRuleService: EditorialRuleService;
  editorialRulePreviewService?: EditorialRulePreviewService;
  editorialRulePackageService?: Pick<
    EditorialRulePackageService,
    | "createExampleSourceSession"
    | "generateCandidates"
    | "loadWorkspace"
    | "previewCandidate"
    | "generateCandidatesFromReviewedCase"
  >;
  extractionTaskService?: Pick<
    ExtractionTaskService,
    "createTask" | "listTasks" | "getTask" | "updateCandidate"
  >;
  rulePackageCompileService?: Pick<
    RulePackageCompileService,
    "previewCompile" | "compileToDraft"
  >;
}

export function createEditorialRuleApi(options: CreateEditorialRuleApiOptions) {
  const {
    editorialRuleService,
    editorialRulePreviewService,
    editorialRulePackageService,
    extractionTaskService,
    rulePackageCompileService,
  } = options;

  return {
    async createRuleSet({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreateEditorialRuleSetInput;
    }): Promise<RouteResponse<EditorialRuleSetRecord>> {
      return {
        status: 201,
        body: await editorialRuleService.createRuleSet(actorRole, input),
      };
    },

    async listRuleSets(): Promise<RouteResponse<EditorialRuleSetRecord[]>> {
      return {
        status: 200,
        body: await editorialRuleService.listRuleSets(),
      };
    },

    async publishRuleSet({
      actorRole,
      ruleSetId,
    }: {
      actorRole: RoleKey;
      ruleSetId: string;
    }): Promise<RouteResponse<EditorialRuleSetRecord>> {
      return {
        status: 200,
        body: await editorialRuleService.publishRuleSet(actorRole, ruleSetId),
      };
    },

    async createRule({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreateEditorialRuleInput;
    }): Promise<RouteResponse<EditorialRuleRecord>> {
      return {
        status: 201,
        body: await editorialRuleService.createRule(actorRole, input),
      };
    },

    async listRules({
      ruleSetId,
    }: {
      ruleSetId: string;
    }): Promise<RouteResponse<EditorialRuleRecord[]>> {
      return {
        status: 200,
        body: await editorialRuleService.listRules(ruleSetId),
      };
    },

    async previewRule(
      input: PreviewEditorialRuleInput,
    ): Promise<RouteResponse<EditorialRulePreviewResult>> {
      return {
        status: 200,
        body: await editorialRulePreviewService!.previewRule(input),
      };
    },

    async previewResolvedRules(
      input: PreviewResolvedEditorialRulesInput,
    ): Promise<RouteResponse<EditorialRulePreviewResult>> {
      return {
        status: 200,
        body: await editorialRulePreviewService!.previewResolvedRules(input),
      };
    },

    async generateRulePackageCandidates({
      input,
    }: {
      input: GenerateRulePackageCandidatesInput;
    }): Promise<RouteResponse<RulePackageCandidate[]>> {
      return {
        status: 200,
        body: editorialRulePackageService!.generateCandidates(input),
      };
    },

    async createRulePackageExampleSourceSession({
      input,
    }: {
      input: CreateRulePackageExampleSourceSessionInput;
    }): Promise<RouteResponse<RulePackageExampleSourceSession>> {
      return {
        status: 201,
        body: await editorialRulePackageService!.createExampleSourceSession(input),
      };
    },

    async listExtractionTasks(): Promise<RouteResponse<ExtractionTaskRecord[]>> {
      return {
        status: 200,
        body: await extractionTaskService!.listTasks(),
      };
    },

    async createExtractionTask({
      input,
    }: {
      input: Parameters<ExtractionTaskService["createTask"]>[0];
    }): Promise<RouteResponse<ExtractionTaskDetailRecord>> {
      return {
        status: 201,
        body: await extractionTaskService!.createTask(input),
      };
    },

    async getExtractionTask({
      taskId,
    }: {
      taskId: string;
    }): Promise<RouteResponse<ExtractionTaskDetailRecord>> {
      return {
        status: 200,
        body: await extractionTaskService!.getTask(taskId),
      };
    },

    async updateExtractionTaskCandidate({
      taskId,
      candidateId,
      input,
    }: {
      taskId: string;
      candidateId: string;
      input: Omit<Parameters<ExtractionTaskService["updateCandidate"]>[0], "taskId" | "candidateId">;
    }): Promise<RouteResponse<ExtractionTaskDetailRecord>> {
      return {
        status: 200,
        body: await extractionTaskService!.updateCandidate({
          taskId,
          candidateId,
          ...input,
        }),
      };
    },

    async loadRulePackageWorkspace({
      input,
    }: {
      input: LoadRulePackageWorkspaceInput;
    }): Promise<RouteResponse<RulePackageWorkspace>> {
      return {
        status: 200,
        body: await editorialRulePackageService!.loadWorkspace(input),
      };
    },

    async previewRulePackage(
      input: PreviewRulePackageDraftInput,
    ): Promise<RouteResponse<RulePackagePreview>> {
      return {
        status: 200,
        body: editorialRulePackageService!.previewCandidate(input),
      };
    },

    async previewRulePackageCompile({
      input,
    }: {
      input: PreviewCompileRulePackagesInput;
    }): Promise<RouteResponse<RulePackageCompilePreviewResult>> {
      return {
        status: 200,
        body: await rulePackageCompileService!.previewCompile(input),
      };
    },

    async compileRulePackagesToDraft({
      input,
    }: {
      input: CompileRulePackagesToDraftInput;
    }): Promise<RouteResponse<CompileRulePackagesToDraftResult>> {
      return {
        status: 200,
        body: await rulePackageCompileService!.compileToDraft(input),
      };
    },

    async generateRulePackageCandidatesFromReviewedCase({
      input,
    }: {
      input: GenerateRulePackageCandidatesFromReviewedCaseInput;
    }): Promise<RouteResponse<RulePackageCandidate[]>> {
      return {
        status: 200,
        body: await editorialRulePackageService!.generateCandidatesFromReviewedCase(
          input,
        ),
      };
    },
  };
}
