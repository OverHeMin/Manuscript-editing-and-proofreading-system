import type { RoleKey } from "../../users/roles.ts";
import type {
  AiGatewayService,
  ResolvedModelSelection,
} from "../ai-gateway/ai-gateway-service.ts";
import type { ManuscriptRecord } from "../manuscripts/manuscript-record.ts";
import type { ManuscriptRepository } from "../manuscripts/manuscript-repository.ts";
import {
  ModuleManuscriptNotFoundError,
} from "./module-run-support.ts";
import {
  getBareModulePromptSkeleton,
  type BareModulePromptSkeleton,
} from "./bare-module-prompt-skeletons.ts";
import type { TemplateModule } from "../templates/template-record.ts";

export interface BareModuleKnowledgeHit {
  knowledgeItemId: string;
  matchSourceId?: string;
  bindingRuleId?: string;
  matchSource:
    | "binding_rule"
    | "template_binding"
    | "dynamic_routing"
    | "draft_snapshot_reuse";
  matchReasons: string[];
}

export interface ResolveBareModuleContextInput {
  manuscriptId: string;
  module: TemplateModule;
  jobId: string;
  actorId: string;
  actorRole: RoleKey;
  manuscriptRepository: ManuscriptRepository;
  aiGatewayService: Pick<AiGatewayService, "resolveModelSelection">;
}

export interface BareModuleContext {
  executionMode: "bare";
  manuscript: ManuscriptRecord;
  executionProfileId: string;
  moduleTemplateId: string;
  moduleTemplateVersionNo: number;
  promptTemplateId: string;
  promptTemplateVersion: string;
  promptSkeleton: BareModulePromptSkeleton;
  skillPackageIds: string[];
  skillPackageVersions: string[];
  knowledgeHits: BareModuleKnowledgeHit[];
  modelSelection: ResolvedModelSelection;
  verificationCheckProfileIds: string[];
  evaluationSuiteIds: string[];
  qualityPackageVersionIds: string[];
}

export async function resolveBareModuleContext(
  input: ResolveBareModuleContextInput,
): Promise<BareModuleContext> {
  const manuscript = await input.manuscriptRepository.findById(input.manuscriptId);
  if (!manuscript) {
    throw new ModuleManuscriptNotFoundError(input.manuscriptId);
  }

  const promptSkeleton = getBareModulePromptSkeleton(input.module);
  const modelSelection = await input.aiGatewayService.resolveModelSelection({
    module: input.module,
    taskId: input.jobId,
    actorId: input.actorId,
    actorRole: input.actorRole,
  });

  return {
    executionMode: "bare",
    manuscript,
    executionProfileId: promptSkeleton.executionProfileId,
    moduleTemplateId: promptSkeleton.templateId,
    moduleTemplateVersionNo: promptSkeleton.moduleTemplateVersionNo,
    promptTemplateId: promptSkeleton.id,
    promptTemplateVersion: promptSkeleton.promptTemplateVersion,
    promptSkeleton,
    skillPackageIds: [],
    skillPackageVersions: [],
    knowledgeHits: [],
    modelSelection,
    verificationCheckProfileIds: [],
    evaluationSuiteIds: [],
    qualityPackageVersionIds: [],
  };
}
