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

export interface GovernedAgentContext {
  moduleContext: GovernedModuleContext;
  manuscript: GovernedModuleContext["manuscript"];
  executionProfile: GovernedModuleContext["executionProfile"];
  runtimeBinding: RuntimeBindingRecord;
  runtime: AgentRuntimeRecord;
  sandboxProfile: SandboxProfileRecord;
  agentProfile: AgentProfileRecord;
  toolPolicy: ToolPermissionPolicyRecord;
  verificationExpectations: GovernedAgentVerificationExpectations;
}

export interface ResolveGovernedAgentContextInput
  extends ResolveGovernedModuleContextInput {
  sandboxProfileService: SandboxProfileService;
  agentProfileService: AgentProfileService;
  agentRuntimeService: AgentRuntimeService;
  runtimeBindingService: RuntimeBindingService;
  toolPermissionPolicyService: ToolPermissionPolicyService;
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

  return {
    moduleContext,
    manuscript: moduleContext.manuscript,
    executionProfile: moduleContext.executionProfile,
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
