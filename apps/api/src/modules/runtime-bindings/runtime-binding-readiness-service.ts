import type { AgentProfileRepository } from "../agent-profiles/agent-profile-repository.ts";
import type { AgentRuntimeRepository } from "../agent-runtime/agent-runtime-repository.ts";
import type { ExecutionGovernanceRepository } from "../execution-governance/execution-governance-repository.ts";
import type { ModuleExecutionProfileRecord } from "../execution-governance/execution-governance-record.ts";
import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { PromptSkillRegistryRepository } from "../prompt-skill-registry/prompt-skill-repository.ts";
import type { SandboxProfileRepository } from "../sandbox-profiles/sandbox-profile-repository.ts";
import type { TemplateModule } from "../templates/template-record.ts";
import type { ToolPermissionPolicyRepository } from "../tool-permission-policies/tool-permission-policy-repository.ts";
import type { VerificationOpsRepository } from "../verification-ops/verification-ops-repository.ts";
import type { RuntimeBindingRecord } from "./runtime-binding-record.ts";
import type { RuntimeBindingService } from "./runtime-binding-service.ts";
import type {
  RuntimeBindingExecutionProfileAlignment,
  RuntimeBindingReadinessIssue,
  RuntimeBindingReadinessReport,
  RuntimeBindingReadinessScope,
} from "./runtime-binding-readiness.ts";

export interface RuntimeBindingReadinessServiceOptions {
  runtimeBindingService: RuntimeBindingService;
  agentRuntimeRepository: AgentRuntimeRepository;
  sandboxProfileRepository: SandboxProfileRepository;
  agentProfileRepository: AgentProfileRepository;
  toolPermissionPolicyRepository: ToolPermissionPolicyRepository;
  promptSkillRegistryRepository: PromptSkillRegistryRepository;
  executionGovernanceRepository: ExecutionGovernanceRepository;
  verificationOpsRepository: VerificationOpsRepository;
}

export class RuntimeBindingReadinessService {
  private readonly runtimeBindingService: RuntimeBindingService;
  private readonly agentRuntimeRepository: AgentRuntimeRepository;
  private readonly sandboxProfileRepository: SandboxProfileRepository;
  private readonly agentProfileRepository: AgentProfileRepository;
  private readonly toolPermissionPolicyRepository: ToolPermissionPolicyRepository;
  private readonly promptSkillRegistryRepository: PromptSkillRegistryRepository;
  private readonly executionGovernanceRepository: ExecutionGovernanceRepository;
  private readonly verificationOpsRepository: VerificationOpsRepository;

  constructor(options: RuntimeBindingReadinessServiceOptions) {
    this.runtimeBindingService = options.runtimeBindingService;
    this.agentRuntimeRepository = options.agentRuntimeRepository;
    this.sandboxProfileRepository = options.sandboxProfileRepository;
    this.agentProfileRepository = options.agentProfileRepository;
    this.toolPermissionPolicyRepository = options.toolPermissionPolicyRepository;
    this.promptSkillRegistryRepository = options.promptSkillRegistryRepository;
    this.executionGovernanceRepository = options.executionGovernanceRepository;
    this.verificationOpsRepository = options.verificationOpsRepository;
  }

  async getBindingReadiness(
    bindingId: string,
  ): Promise<RuntimeBindingReadinessReport> {
    const binding = await this.runtimeBindingService.getBinding(bindingId);
    return this.buildReport(binding);
  }

  async getActiveBindingReadinessForScope(
    scope: RuntimeBindingReadinessScope,
  ): Promise<RuntimeBindingReadinessReport> {
    const binding = await this.runtimeBindingService.getActiveBindingForScope(scope);
    if (!binding) {
      return {
        status: "missing",
        scope,
        issues: [
          {
            code: "missing_active_binding",
            message: `No active runtime binding exists for ${scope.module}/${scope.manuscriptType}/${scope.templateFamilyId}.`,
          },
        ],
        execution_profile_alignment: {
          status: "missing_active_profile",
        },
      };
    }

    return this.buildReport(binding);
  }

  private async buildReport(
    binding: RuntimeBindingRecord,
  ): Promise<RuntimeBindingReadinessReport> {
    const scope = {
      module: binding.module,
      manuscriptType: binding.manuscript_type,
      templateFamilyId: binding.template_family_id,
    } satisfies RuntimeBindingReadinessScope;
    const issues: RuntimeBindingReadinessIssue[] = [];
    const profiles = await this.executionGovernanceRepository.listProfiles();
    const activeExecutionProfile = selectActiveExecutionProfile(profiles, scope);

    const runtime = await this.agentRuntimeRepository.findById(binding.runtime_id);
    if (!runtime) {
      issues.push({
        code: "runtime_missing",
        message: `Runtime ${binding.runtime_id} is missing.`,
      });
    } else {
      if (runtime.status !== "active") {
        issues.push({
          code: "runtime_not_active",
          message: `Runtime ${runtime.id} is not active.`,
        });
      }
      if (!runtime.allowed_modules.includes(binding.module)) {
        issues.push({
          code: "runtime_module_incompatible",
          message: `Runtime ${runtime.id} is incompatible with module ${binding.module}.`,
        });
      }
      if (
        runtime.sandbox_profile_id &&
        runtime.sandbox_profile_id !== binding.sandbox_profile_id
      ) {
        issues.push({
          code: "runtime_sandbox_mismatch",
          message: `Runtime ${runtime.id} is configured for sandbox profile ${runtime.sandbox_profile_id}, not ${binding.sandbox_profile_id}.`,
        });
      }
    }

    const sandboxProfile = await this.sandboxProfileRepository.findById(
      binding.sandbox_profile_id,
    );
    if (!sandboxProfile) {
      issues.push({
        code: "sandbox_missing",
        message: `Sandbox profile ${binding.sandbox_profile_id} is missing.`,
      });
    } else if (sandboxProfile.status !== "active") {
      issues.push({
        code: "sandbox_not_active",
        message: `Sandbox profile ${sandboxProfile.id} is not active.`,
      });
    }

    const agentProfile = await this.agentProfileRepository.findById(
      binding.agent_profile_id,
    );
    if (!agentProfile) {
      issues.push({
        code: "agent_profile_missing",
        message: `Agent profile ${binding.agent_profile_id} is missing.`,
      });
    } else {
      if (agentProfile.status !== "published") {
        issues.push({
          code: "agent_profile_not_published",
          message: `Agent profile ${agentProfile.id} is not published.`,
        });
      }
      if (
        (agentProfile.module_scope !== "any" &&
          !agentProfile.module_scope.includes(binding.module)) ||
        (agentProfile.manuscript_types !== "any" &&
          !agentProfile.manuscript_types.includes(binding.manuscript_type))
      ) {
        issues.push({
          code: "agent_profile_scope_mismatch",
          message: `Agent profile ${agentProfile.id} is incompatible with the runtime binding scope.`,
        });
      }
    }

    const toolPermissionPolicy =
      await this.toolPermissionPolicyRepository.findById(
        binding.tool_permission_policy_id,
      );
    if (!toolPermissionPolicy) {
      issues.push({
        code: "tool_permission_policy_missing",
        message: `Tool permission policy ${binding.tool_permission_policy_id} is missing.`,
      });
    } else if (toolPermissionPolicy.status !== "active") {
      issues.push({
        code: "tool_permission_policy_not_active",
        message: `Tool permission policy ${toolPermissionPolicy.id} is not active.`,
      });
    }

    const promptTemplate =
      await this.promptSkillRegistryRepository.findPromptTemplateById(
        binding.prompt_template_id,
      );
    if (!promptTemplate) {
      issues.push({
        code: "prompt_template_missing",
        message: `Prompt template ${binding.prompt_template_id} is missing.`,
      });
    } else {
      if (promptTemplate.status !== "published") {
        issues.push({
          code: "prompt_template_not_published",
          message: `Prompt template ${promptTemplate.id} is not published.`,
        });
      }
      if (
        promptTemplate.module !== binding.module ||
        !matchesManuscriptType(
          promptTemplate.manuscript_types,
          binding.manuscript_type,
        )
      ) {
        issues.push({
          code: "prompt_template_scope_mismatch",
          message: `Prompt template ${promptTemplate.id} is incompatible with the runtime binding scope.`,
        });
      }
    }

    for (const skillPackageId of binding.skill_package_ids) {
      const skillPackage =
        await this.promptSkillRegistryRepository.findSkillPackageById(
          skillPackageId,
        );
      if (!skillPackage) {
        issues.push({
          code: "skill_package_missing",
          message: `Skill package ${skillPackageId} is missing.`,
        });
        continue;
      }

      if (skillPackage.status !== "published") {
        issues.push({
          code: "skill_package_not_published",
          message: `Skill package ${skillPackage.id} is not published.`,
        });
      }

      if (!skillPackage.applies_to_modules.includes(binding.module)) {
        issues.push({
          code: "skill_package_scope_mismatch",
          message: `Skill package ${skillPackage.id} is incompatible with module ${binding.module}.`,
        });
      }
    }

    for (const verificationCheckProfileId of binding.verification_check_profile_ids) {
      const profile =
        await this.verificationOpsRepository.findVerificationCheckProfileById(
          verificationCheckProfileId,
        );
      if (!profile) {
        issues.push({
          code: "verification_check_profile_missing",
          message: `Verification check profile ${verificationCheckProfileId} is missing.`,
        });
        continue;
      }

      if (profile.status !== "published") {
        issues.push({
          code: "verification_check_profile_not_published",
          message: `Verification check profile ${profile.id} is not published.`,
        });
      }
    }

    for (const evaluationSuiteId of binding.evaluation_suite_ids) {
      const suite = await this.verificationOpsRepository.findEvaluationSuiteById(
        evaluationSuiteId,
      );
      if (!suite) {
        issues.push({
          code: "evaluation_suite_missing",
          message: `Evaluation suite ${evaluationSuiteId} is missing.`,
        });
        continue;
      }

      if (suite.status !== "active") {
        issues.push({
          code: "evaluation_suite_not_active",
          message: `Evaluation suite ${suite.id} is not active.`,
        });
      }

      if (suite.module_scope !== "any" && !suite.module_scope.includes(binding.module)) {
        issues.push({
          code: "evaluation_suite_scope_mismatch",
          message: `Evaluation suite ${suite.id} is incompatible with module ${binding.module}.`,
        });
      }
    }

    if (binding.release_check_profile_id) {
      const profile =
        await this.verificationOpsRepository.findReleaseCheckProfileById(
          binding.release_check_profile_id,
        );
      if (!profile) {
        issues.push({
          code: "release_check_profile_missing",
          message: `Release check profile ${binding.release_check_profile_id} is missing.`,
        });
      } else if (profile.status !== "published") {
        issues.push({
          code: "release_check_profile_not_published",
          message: `Release check profile ${profile.id} is not published.`,
        });
      }
    }

    const executionProfileAlignment = await this.buildExecutionProfileAlignment({
      binding,
      activeExecutionProfile,
      issues,
    });

    return {
      status: issues.length === 0 ? "ready" : "degraded",
      scope,
      binding: {
        id: binding.id,
        status: binding.status,
        version: binding.version,
        runtime_id: binding.runtime_id,
        sandbox_profile_id: binding.sandbox_profile_id,
        agent_profile_id: binding.agent_profile_id,
        tool_permission_policy_id: binding.tool_permission_policy_id,
        prompt_template_id: binding.prompt_template_id,
        skill_package_ids: [...binding.skill_package_ids],
        execution_profile_id: binding.execution_profile_id,
        verification_check_profile_ids: [
          ...binding.verification_check_profile_ids,
        ],
        evaluation_suite_ids: [...binding.evaluation_suite_ids],
        release_check_profile_id: binding.release_check_profile_id,
      },
      issues,
      execution_profile_alignment: executionProfileAlignment,
    };
  }

  private async buildExecutionProfileAlignment(input: {
    binding: RuntimeBindingRecord;
    activeExecutionProfile?: ModuleExecutionProfileRecord;
    issues: RuntimeBindingReadinessIssue[];
  }): Promise<RuntimeBindingExecutionProfileAlignment> {
    let status: RuntimeBindingExecutionProfileAlignment["status"] = "aligned";

    if (!input.activeExecutionProfile) {
      input.issues.push({
        code: "active_execution_profile_missing",
        message: `No active execution profile exists for ${input.binding.module}/${input.binding.manuscript_type}/${input.binding.template_family_id}.`,
      });
      return {
        status: "missing_active_profile",
        binding_execution_profile_id: input.binding.execution_profile_id,
      };
    }

    if (input.binding.execution_profile_id) {
      const boundExecutionProfile =
        await this.executionGovernanceRepository.findProfileById(
          input.binding.execution_profile_id,
        );
      if (!boundExecutionProfile) {
        input.issues.push({
          code: "execution_profile_missing",
          message: `Execution profile ${input.binding.execution_profile_id} is missing.`,
        });
        status = "drifted";
      } else {
        if (boundExecutionProfile.status !== "active") {
          input.issues.push({
            code: "execution_profile_not_active",
            message: `Execution profile ${boundExecutionProfile.id} is not active.`,
          });
          status = "drifted";
        }
        if (
          boundExecutionProfile.module !== input.binding.module ||
          boundExecutionProfile.manuscript_type !== input.binding.manuscript_type ||
          boundExecutionProfile.template_family_id !==
            input.binding.template_family_id
        ) {
          input.issues.push({
            code: "execution_profile_scope_mismatch",
            message: `Execution profile ${boundExecutionProfile.id} is incompatible with the runtime binding scope.`,
          });
          status = "drifted";
        }
      }

      if (input.binding.execution_profile_id !== input.activeExecutionProfile.id) {
        input.issues.push({
          code: "binding_execution_profile_drift",
          message: `Runtime binding ${input.binding.id} is pinned to execution profile ${input.binding.execution_profile_id}, but the active scope profile is ${input.activeExecutionProfile.id}.`,
        });
        status = "drifted";
      }
    }

    if (
      input.binding.prompt_template_id !== input.activeExecutionProfile.prompt_template_id
    ) {
      input.issues.push({
        code: "binding_prompt_drift",
        message: `Runtime binding ${input.binding.id} uses prompt template ${input.binding.prompt_template_id}, but the active execution profile uses ${input.activeExecutionProfile.prompt_template_id}.`,
      });
      status = "drifted";
    }

    if (
      !sameOrderedIds(
        input.binding.skill_package_ids,
        input.activeExecutionProfile.skill_package_ids,
      )
    ) {
      input.issues.push({
        code: "binding_skill_package_drift",
        message: `Runtime binding ${input.binding.id} uses a different skill package set than the active execution profile.`,
      });
      status = "drifted";
    }

    return {
      status,
      binding_execution_profile_id: input.binding.execution_profile_id,
      active_execution_profile_id: input.activeExecutionProfile.id,
    };
  }
}

function matchesManuscriptType(
  manuscriptTypes: ManuscriptType[] | "any",
  manuscriptType: ManuscriptType,
): boolean {
  return manuscriptTypes === "any" || manuscriptTypes.includes(manuscriptType);
}

function selectActiveExecutionProfile(
  profiles: ModuleExecutionProfileRecord[],
  scope: RuntimeBindingReadinessScope,
): ModuleExecutionProfileRecord | undefined {
  return profiles
    .filter(
      (profile) =>
        profile.status === "active" &&
        profile.module === scope.module &&
        profile.manuscript_type === scope.manuscriptType &&
        profile.template_family_id === scope.templateFamilyId,
    )
    .sort((left, right) => right.version - left.version)[0];
}

function sameOrderedIds(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}
