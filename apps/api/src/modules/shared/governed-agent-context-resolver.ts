import type { AgentProfileRecord } from "../agent-profiles/agent-profile-record.ts";
import {
  AgentProfileNotFoundError,
  type AgentProfileService,
} from "../agent-profiles/agent-profile-service.ts";
import type { AgentRuntimeRecord } from "../agent-runtime/agent-runtime-record.ts";
import {
  AgentRuntimeNotFoundError,
  type AgentRuntimeService,
} from "../agent-runtime/agent-runtime-service.ts";
import type { RuntimeBindingRecord } from "../runtime-bindings/runtime-binding-record.ts";
import type { RuntimeBindingReadinessReport } from "../runtime-bindings/runtime-binding-readiness.ts";
import type { RuntimeBindingReadinessService } from "../runtime-bindings/runtime-binding-readiness-service.ts";
import {
  RuntimeBindingNotFoundError,
  type RuntimeBindingService,
} from "../runtime-bindings/runtime-binding-service.ts";
import type { SandboxProfileRecord } from "../sandbox-profiles/sandbox-profile-record.ts";
import {
  SandboxProfileNotFoundError,
  type SandboxProfileService,
} from "../sandbox-profiles/sandbox-profile-service.ts";
import type { ToolPermissionPolicyRecord } from "../tool-permission-policies/tool-permission-policy-record.ts";
import {
  ToolPermissionPolicyNotFoundError,
  type ToolPermissionPolicyService,
} from "../tool-permission-policies/tool-permission-policy-service.ts";
import type { KnowledgeRetrievalService } from "../knowledge-retrieval/knowledge-retrieval-service.ts";
import type {
  AiProviderRuntimeSelectionRecord,
} from "../ai-provider-runtime/ai-provider-runtime-record.ts";
import type { AiProviderRuntimeService } from "../ai-provider-runtime/ai-provider-runtime-service.ts";
import {
  type GovernedModuleContext,
  type ResolveGovernedModuleContextInput,
  resolveGovernedModuleContext,
} from "./governed-module-context-resolver.ts";

export interface GovernedAgentVerificationExpectations {
  verification_check_profile_ids: string[];
  evaluation_suite_ids: string[];
  release_check_profile_id?: string;
}

export interface GovernedAgentRetrievalContext {
  status: "recorded" | "failed_open" | "skipped";
  retrieval_snapshot_id?: string;
  failure_reason?: string;
}

export interface GovernedAgentRuntimeBindingReadinessObservation {
  observation_status: "reported" | "failed_open";
  report?: RuntimeBindingReadinessReport;
  error?: string;
}

export interface GovernedAgentContext {
  moduleContext: GovernedModuleContext;
  manuscript: GovernedModuleContext["manuscript"];
  executionProfile: GovernedModuleContext["executionProfile"];
  aiProviderRuntime?: AiProviderRuntimeSelectionRecord;
  runtimeBinding: RuntimeBindingRecord;
  runtime: AgentRuntimeRecord;
  sandboxProfile: SandboxProfileRecord;
  agentProfile: AgentProfileRecord;
  toolPolicy: ToolPermissionPolicyRecord;
  verificationExpectations: GovernedAgentVerificationExpectations;
  retrievalContext: GovernedAgentRetrievalContext;
  runtimeBindingReadiness: GovernedAgentRuntimeBindingReadinessObservation;
}

export interface ResolveGovernedAgentContextInput
  extends ResolveGovernedModuleContextInput {
  sandboxProfileService: SandboxProfileService;
  agentProfileService: AgentProfileService;
  agentRuntimeService: AgentRuntimeService;
  runtimeBindingService: RuntimeBindingService;
  toolPermissionPolicyService: ToolPermissionPolicyService;
  knowledgeRetrievalService?: Pick<
    KnowledgeRetrievalService,
    "recordRetrievalSnapshot"
  >;
  runtimeBindingReadinessService?: Pick<
    RuntimeBindingReadinessService,
    "getBindingReadiness"
  >;
  aiProviderRuntimeService?: Pick<AiProviderRuntimeService, "resolveSelectionRuntime">;
  aiProviderRuntimeCutoverEnabled?: boolean;
}

export class ActiveRuntimeBindingNotFoundError extends Error {
  constructor(module: string, manuscriptType: string, templateFamilyId: string) {
    super(
      `No active runtime binding exists for ${module}/${manuscriptType}/${templateFamilyId}.`,
    );
    this.name = "ActiveRuntimeBindingNotFoundError";
  }
}

export class GovernedAgentContextConsistencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GovernedAgentContextConsistencyError";
  }
}

export async function resolveGovernedAgentContext(
  input: ResolveGovernedAgentContextInput,
): Promise<GovernedAgentContext> {
  const moduleContext = await resolveGovernedModuleContext(input);
  const aiProviderRuntime = await maybeResolveAiProviderRuntime({
    aiProviderRuntimeService: input.aiProviderRuntimeService,
    cutoverEnabled: input.aiProviderRuntimeCutoverEnabled ?? false,
    modelSelection: moduleContext.modelSelection,
  });

  const activeBinding = await findActiveRuntimeBinding({
    runtimeBindingService: input.runtimeBindingService,
    module: input.module,
    manuscriptType: moduleContext.manuscript.manuscript_type,
    templateFamilyId: moduleContext.executionProfile.template_family_id,
  });

  const runtime = await requireActiveRuntime(
    input.agentRuntimeService,
    activeBinding.runtime_id,
  );
  const sandboxProfile = await requireActiveSandboxProfile(
    input.sandboxProfileService,
    activeBinding.sandbox_profile_id,
  );
  const agentProfile = await requirePublishedAgentProfile(
    input.agentProfileService,
    activeBinding.agent_profile_id,
  );
  const toolPolicy = await requireActiveToolPermissionPolicy(
    input.toolPermissionPolicyService,
    activeBinding.tool_permission_policy_id,
  );

  assertBindingMatchesGovernedModuleContext({
    binding: activeBinding,
    runtime,
    moduleContext,
  });

  const retrievalContext = await maybeRecordGovernedRetrievalSnapshot({
    moduleContext,
    knowledgeRetrievalService: input.knowledgeRetrievalService,
  });
  const runtimeBindingReadiness = await observeRuntimeBindingReadiness({
    bindingId: activeBinding.id,
    runtimeBindingReadinessService: input.runtimeBindingReadinessService,
  });

  return {
    moduleContext,
    manuscript: moduleContext.manuscript,
    executionProfile: moduleContext.executionProfile,
    ...(aiProviderRuntime ? { aiProviderRuntime } : {}),
    runtimeBinding: activeBinding,
    runtime,
    sandboxProfile,
    agentProfile,
    toolPolicy,
    verificationExpectations: {
      verification_check_profile_ids: [
        ...activeBinding.verification_check_profile_ids,
      ],
      evaluation_suite_ids: [...activeBinding.evaluation_suite_ids],
      release_check_profile_id: activeBinding.release_check_profile_id,
    },
    retrievalContext,
    runtimeBindingReadiness,
  };
}

async function findActiveRuntimeBinding(input: {
  runtimeBindingService: RuntimeBindingService;
  module: RuntimeBindingRecord["module"];
  manuscriptType: RuntimeBindingRecord["manuscript_type"];
  templateFamilyId: RuntimeBindingRecord["template_family_id"];
}): Promise<RuntimeBindingRecord> {
  const bindings = await input.runtimeBindingService.listBindingsForScope({
    module: input.module,
    manuscriptType: input.manuscriptType,
    templateFamilyId: input.templateFamilyId,
    activeOnly: true,
  });

  const binding = [...bindings].sort((left, right) => right.version - left.version)[0];
  if (!binding) {
    throw new ActiveRuntimeBindingNotFoundError(
      input.module,
      input.manuscriptType,
      input.templateFamilyId,
    );
  }

  try {
    return await input.runtimeBindingService.getBinding(binding.id);
  } catch (error) {
    if (error instanceof RuntimeBindingNotFoundError) {
      throw new ActiveRuntimeBindingNotFoundError(
        input.module,
        input.manuscriptType,
        input.templateFamilyId,
      );
    }

    throw error;
  }
}

async function requireActiveRuntime(
  agentRuntimeService: AgentRuntimeService,
  runtimeId: string,
): Promise<AgentRuntimeRecord> {
  let runtime: AgentRuntimeRecord;
  try {
    runtime = await agentRuntimeService.getRuntime(runtimeId);
  } catch (error) {
    if (error instanceof AgentRuntimeNotFoundError) {
      throw new GovernedAgentContextConsistencyError(
        `Active runtime binding references missing runtime ${runtimeId}.`,
      );
    }

    throw error;
  }

  if (runtime.status !== "active") {
    throw new GovernedAgentContextConsistencyError(
      `Runtime ${runtime.id} is no longer active for governed agent resolution.`,
    );
  }

  return runtime;
}

async function requireActiveSandboxProfile(
  sandboxProfileService: SandboxProfileService,
  profileId: string,
): Promise<SandboxProfileRecord> {
  let profile: SandboxProfileRecord;
  try {
    profile = await sandboxProfileService.getProfile(profileId);
  } catch (error) {
    if (error instanceof SandboxProfileNotFoundError) {
      throw new GovernedAgentContextConsistencyError(
        `Active runtime binding references missing sandbox profile ${profileId}.`,
      );
    }

    throw error;
  }

  if (profile.status !== "active") {
    throw new GovernedAgentContextConsistencyError(
      `Sandbox profile ${profile.id} is no longer active for governed agent resolution.`,
    );
  }

  return profile;
}

async function requirePublishedAgentProfile(
  agentProfileService: AgentProfileService,
  profileId: string,
): Promise<AgentProfileRecord> {
  let profile: AgentProfileRecord;
  try {
    profile = await agentProfileService.getProfile(profileId);
  } catch (error) {
    if (error instanceof AgentProfileNotFoundError) {
      throw new GovernedAgentContextConsistencyError(
        `Active runtime binding references missing agent profile ${profileId}.`,
      );
    }

    throw error;
  }

  if (profile.status !== "published") {
    throw new GovernedAgentContextConsistencyError(
      `Agent profile ${profile.id} is no longer published for governed agent resolution.`,
    );
  }

  return profile;
}

async function requireActiveToolPermissionPolicy(
  toolPermissionPolicyService: ToolPermissionPolicyService,
  policyId: string,
): Promise<ToolPermissionPolicyRecord> {
  let policy: ToolPermissionPolicyRecord;
  try {
    policy = await toolPermissionPolicyService.getPolicy(policyId);
  } catch (error) {
    if (error instanceof ToolPermissionPolicyNotFoundError) {
      throw new GovernedAgentContextConsistencyError(
        `Active runtime binding references missing tool permission policy ${policyId}.`,
      );
    }

    throw error;
  }

  if (policy.status !== "active") {
    throw new GovernedAgentContextConsistencyError(
      `Tool permission policy ${policy.id} is no longer active for governed agent resolution.`,
    );
  }

  return policy;
}

function assertBindingMatchesGovernedModuleContext(input: {
  binding: RuntimeBindingRecord;
  runtime: AgentRuntimeRecord;
  moduleContext: GovernedModuleContext;
}): void {
  const skillPackageIds = input.moduleContext.skillPackages.map((record) => record.id);

  if (
    input.binding.execution_profile_id &&
    input.binding.execution_profile_id !== input.moduleContext.executionProfile.id
  ) {
    throw new GovernedAgentContextConsistencyError(
      `Runtime binding ${input.binding.id} is pinned to execution profile ${input.binding.execution_profile_id}, but governed module context resolved ${input.moduleContext.executionProfile.id}.`,
    );
  }

  if (input.binding.prompt_template_id !== input.moduleContext.promptTemplate.id) {
    throw new GovernedAgentContextConsistencyError(
      `Runtime binding ${input.binding.id} is pinned to prompt template ${input.binding.prompt_template_id}, but governed module context resolved ${input.moduleContext.promptTemplate.id}.`,
    );
  }

  if (
    !sameOrderedIds(input.binding.skill_package_ids, skillPackageIds)
  ) {
    throw new GovernedAgentContextConsistencyError(
      `Runtime binding ${input.binding.id} is pinned to a different skill package set than the governed module context.`,
    );
  }

  if (
    input.runtime.sandbox_profile_id &&
    input.runtime.sandbox_profile_id !== input.binding.sandbox_profile_id
  ) {
    throw new GovernedAgentContextConsistencyError(
      `Runtime ${input.runtime.id} does not match sandbox profile ${input.binding.sandbox_profile_id} required by runtime binding ${input.binding.id}.`,
    );
  }
}

function sameOrderedIds(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

async function maybeResolveAiProviderRuntime(input: {
  modelSelection: GovernedModuleContext["modelSelection"];
  aiProviderRuntimeService?: Pick<AiProviderRuntimeService, "resolveSelectionRuntime">;
  cutoverEnabled: boolean;
}): Promise<AiProviderRuntimeSelectionRecord | undefined> {
  if (!input.cutoverEnabled) {
    return undefined;
  }

  if (!input.aiProviderRuntimeService) {
    throw new GovernedAgentContextConsistencyError(
      "AI provider runtime cutover is enabled but ai provider runtime service is unavailable.",
    );
  }

  return input.aiProviderRuntimeService.resolveSelectionRuntime(
    input.modelSelection,
  );
}

async function observeRuntimeBindingReadiness(input: {
  bindingId: string;
  runtimeBindingReadinessService?: Pick<
    RuntimeBindingReadinessService,
    "getBindingReadiness"
  >;
}): Promise<GovernedAgentRuntimeBindingReadinessObservation> {
  if (!input.runtimeBindingReadinessService) {
    return {
      observation_status: "failed_open",
      error: "Runtime binding readiness service is unavailable.",
    };
  }

  try {
    const report = await input.runtimeBindingReadinessService.getBindingReadiness(
      input.bindingId,
    );
    return {
      observation_status: "reported",
      report,
    };
  } catch (error) {
    return {
      observation_status: "failed_open",
      error:
        error instanceof Error
          ? error.message
          : "Unknown runtime binding readiness observation error.",
    };
  }
}

async function maybeRecordGovernedRetrievalSnapshot(input: {
  moduleContext: GovernedModuleContext;
  knowledgeRetrievalService?: Pick<
    KnowledgeRetrievalService,
    "recordRetrievalSnapshot"
  >;
}): Promise<GovernedAgentRetrievalContext> {
  if (!input.knowledgeRetrievalService) {
    return {
      status: "skipped",
    };
  }

  const knowledgeSelections = input.moduleContext.knowledgeSelections;
  const snapshotItems = knowledgeSelections.map((selection, index) =>
    buildSnapshotItem(selection.knowledgeItem.id, index, selection),
  );
  const retrievalPreset = input.moduleContext.retrievalPreset;
  const retrievalTopK =
    retrievalPreset?.top_k ?? Math.max(snapshotItems.length, 1);
  const retrievalFilters = {
    source: "governed_agent_context",
    ...(retrievalPreset?.section_filters?.length
      ? {
          section_filters: [...retrievalPreset.section_filters],
        }
      : {}),
    ...(retrievalPreset?.risk_tag_filters?.length
      ? {
          risk_tag_filters: [...retrievalPreset.risk_tag_filters],
        }
      : {}),
    ...(retrievalPreset?.min_retrieval_score !== undefined
      ? {
          min_retrieval_score: retrievalPreset.min_retrieval_score,
        }
      : {}),
    ...(retrievalPreset
      ? {
          retrieval_preset_id: retrievalPreset.id,
          citation_required: retrievalPreset.citation_required,
          rerank_enabled: retrievalPreset.rerank_enabled,
        }
      : {}),
  };

  try {
    const snapshot = await input.knowledgeRetrievalService.recordRetrievalSnapshot({
      module: input.moduleContext.moduleTemplate.module,
      manuscriptId: input.moduleContext.manuscript.id,
      manuscriptType: input.moduleContext.manuscript.manuscript_type,
      templateFamilyId: input.moduleContext.executionProfile.template_family_id,
      queryText: [
        `governed_agent_context:${input.moduleContext.moduleTemplate.module}`,
        `manuscript:${input.moduleContext.manuscript.title}`,
        `template_family:${input.moduleContext.executionProfile.template_family_id}`,
      ].join("\n"),
      queryContext: {
        source: "governed_agent_context",
        execution_profile_id: input.moduleContext.executionProfile.id,
        module_template_id: input.moduleContext.moduleTemplate.id,
        prompt_template_id: input.moduleContext.promptTemplate.id,
        retrieval_preset_id: retrievalPreset?.id,
        manual_review_policy_id: input.moduleContext.manualReviewPolicy?.id,
        knowledge_item_ids: knowledgeSelections.map(
          (selection) => selection.knowledgeItem.id,
        ),
      },
      retrieverConfig: {
        strategy: "template_pack",
        topK: retrievalTopK,
        filters: retrievalFilters,
      },
      retrievedItems: snapshotItems,
      rerankedItems: retrievalPreset?.rerank_enabled
        ? [...snapshotItems].sort(
            (left, right) =>
              (right.rerankScore ?? right.retrievalScore ?? 0) -
                (left.rerankScore ?? left.retrievalScore ?? 0) ||
              left.knowledgeItemId.localeCompare(right.knowledgeItemId),
          )
        : snapshotItems,
    });

    return {
      status: "recorded",
      retrieval_snapshot_id: snapshot.id,
    };
  } catch (error) {
    return {
      status: "failed_open",
      failure_reason:
        error instanceof Error ? error.message : "Unknown retrieval snapshot failure.",
    };
  }
}

function buildSnapshotItem(
  knowledgeItemId: string,
  index: number,
  selection: GovernedModuleContext["knowledgeSelections"][number],
): Parameters<
  NonNullable<ResolveGovernedAgentContextInput["knowledgeRetrievalService"]>["recordRetrievalSnapshot"]
>[0]["retrievedItems"][number] {
  return {
    knowledgeItemId,
    retrievalRank: index + 1,
    retrievalScore: selection.retrievalScore ?? Math.max(0, 1 - index * 0.05),
    rerankScore: selection.retrievalScore ?? Math.max(0, 1 - index * 0.05),
    metadata: {
      match_source: selection.matchSource,
      match_source_id: selection.matchSourceId,
      binding_rule_id: selection.bindingRuleId,
      match_reasons: [...selection.matchReasons],
      retrieval_score: selection.retrievalScore,
    },
  };
}
