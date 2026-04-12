import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { AgentProfileRepository } from "../agent-profiles/agent-profile-repository.ts";
import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { PromptSkillRegistryRepository } from "../prompt-skill-registry/prompt-skill-repository.ts";
import type { SandboxProfileRepository } from "../sandbox-profiles/sandbox-profile-repository.ts";
import type { TemplateModule } from "../templates/template-record.ts";
import type { ToolPermissionPolicyRepository } from "../tool-permission-policies/tool-permission-policy-repository.ts";
import type { VerificationOpsRepository } from "../verification-ops/verification-ops-repository.ts";
import type { AgentRuntimeRepository } from "../agent-runtime/agent-runtime-repository.ts";
import type { ManuscriptQualityPackageRepository } from "../manuscript-quality-packages/manuscript-quality-package-repository.ts";
import type { RuntimeBindingRecord } from "./runtime-binding-record.ts";
import type { RuntimeBindingRepository } from "./runtime-binding-repository.ts";

export interface CreateRuntimeBindingInput {
  module: TemplateModule;
  manuscriptType: ManuscriptType;
  templateFamilyId: string;
  runtimeId: string;
  sandboxProfileId: string;
  agentProfileId: string;
  toolPermissionPolicyId: string;
  promptTemplateId: string;
  skillPackageIds: string[];
  qualityPackageVersionIds?: string[];
  executionProfileId?: string;
  verificationCheckProfileIds?: string[];
  evaluationSuiteIds?: string[];
  releaseCheckProfileId?: string;
}

export interface RuntimeBindingServiceOptions {
  repository: RuntimeBindingRepository;
  agentRuntimeRepository: AgentRuntimeRepository;
  sandboxProfileRepository: SandboxProfileRepository;
  agentProfileRepository: AgentProfileRepository;
  toolPermissionPolicyRepository: ToolPermissionPolicyRepository;
  promptSkillRegistryRepository: PromptSkillRegistryRepository;
  verificationOpsRepository: VerificationOpsRepository;
  manuscriptQualityPackageRepository?: ManuscriptQualityPackageRepository;
  permissionGuard?: PermissionGuard;
  createId?: () => string;
}

export class RuntimeBindingNotFoundError extends Error {
  constructor(bindingId: string) {
    super(`Runtime binding ${bindingId} was not found.`);
    this.name = "RuntimeBindingNotFoundError";
  }
}

export class RuntimeBindingDependencyStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeBindingDependencyStateError";
  }
}

export class RuntimeBindingCompatibilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeBindingCompatibilityError";
  }
}

export class RuntimeBindingService {
  private readonly repository: RuntimeBindingRepository;
  private readonly agentRuntimeRepository: AgentRuntimeRepository;
  private readonly sandboxProfileRepository: SandboxProfileRepository;
  private readonly agentProfileRepository: AgentProfileRepository;
  private readonly toolPermissionPolicyRepository: ToolPermissionPolicyRepository;
  private readonly promptSkillRegistryRepository: PromptSkillRegistryRepository;
  private readonly verificationOpsRepository: VerificationOpsRepository;
  private readonly manuscriptQualityPackageRepository?: ManuscriptQualityPackageRepository;
  private readonly permissionGuard: PermissionGuard;
  private readonly createId: () => string;

  constructor(options: RuntimeBindingServiceOptions) {
    this.repository = options.repository;
    this.agentRuntimeRepository = options.agentRuntimeRepository;
    this.sandboxProfileRepository = options.sandboxProfileRepository;
    this.agentProfileRepository = options.agentProfileRepository;
    this.toolPermissionPolicyRepository = options.toolPermissionPolicyRepository;
    this.promptSkillRegistryRepository = options.promptSkillRegistryRepository;
    this.verificationOpsRepository = options.verificationOpsRepository;
    this.manuscriptQualityPackageRepository =
      options.manuscriptQualityPackageRepository;
    this.permissionGuard = options.permissionGuard ?? new PermissionGuard();
    this.createId = options.createId ?? (() => randomUUID());
  }

  async createBinding(
    actorRole: RoleKey,
    input: CreateRuntimeBindingInput,
  ): Promise<RuntimeBindingRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    await this.assertReferencesAreActiveOrPublished(input);

    const version = await this.repository.reserveNextVersion(
      input.module,
      input.manuscriptType,
      input.templateFamilyId,
    );

    const record: RuntimeBindingRecord = {
      id: this.createId(),
      module: input.module,
      manuscript_type: input.manuscriptType,
      template_family_id: input.templateFamilyId,
      runtime_id: input.runtimeId,
      sandbox_profile_id: input.sandboxProfileId,
      agent_profile_id: input.agentProfileId,
      tool_permission_policy_id: input.toolPermissionPolicyId,
      prompt_template_id: input.promptTemplateId,
      skill_package_ids: [...new Set(input.skillPackageIds)],
      quality_package_version_ids: dedupePreserveOrder(
        input.qualityPackageVersionIds ?? [],
      ),
      execution_profile_id: input.executionProfileId,
      verification_check_profile_ids: dedupePreserveOrder(
        input.verificationCheckProfileIds ?? [],
      ),
      evaluation_suite_ids: dedupePreserveOrder(input.evaluationSuiteIds ?? []),
      release_check_profile_id: input.releaseCheckProfileId,
      status: "draft",
      version,
    };

    await this.repository.save(record);
    return record;
  }

  listBindings(): Promise<RuntimeBindingRecord[]> {
    return this.repository.list();
  }

  listBindingsForScope(input: {
    module: TemplateModule;
    manuscriptType: ManuscriptType;
    templateFamilyId: string;
    activeOnly?: boolean;
  }): Promise<RuntimeBindingRecord[]> {
    return this.repository.listByScope(
      input.module,
      input.manuscriptType,
      input.templateFamilyId,
      input.activeOnly,
    );
  }

  async getActiveBindingForScope(input: {
    module: TemplateModule;
    manuscriptType: ManuscriptType;
    templateFamilyId: string;
  }): Promise<RuntimeBindingRecord | undefined> {
    const bindings = await this.repository.listByScope(
      input.module,
      input.manuscriptType,
      input.templateFamilyId,
      true,
    );

    return [...bindings].sort((left, right) => right.version - left.version)[0];
  }

  async getBinding(bindingId: string): Promise<RuntimeBindingRecord> {
    return this.requireBinding(bindingId);
  }

  async activateBinding(
    bindingId: string,
    actorRole: RoleKey,
  ): Promise<RuntimeBindingRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const binding = await this.requireBinding(bindingId);
    if (binding.status === "active") {
      return binding;
    }

    await this.assertReferencesAreActiveOrPublished({
      module: binding.module,
      manuscriptType: binding.manuscript_type,
      templateFamilyId: binding.template_family_id,
      runtimeId: binding.runtime_id,
      sandboxProfileId: binding.sandbox_profile_id,
      agentProfileId: binding.agent_profile_id,
      toolPermissionPolicyId: binding.tool_permission_policy_id,
      promptTemplateId: binding.prompt_template_id,
      skillPackageIds: binding.skill_package_ids,
      qualityPackageVersionIds: binding.quality_package_version_ids ?? [],
      executionProfileId: binding.execution_profile_id,
      verificationCheckProfileIds: binding.verification_check_profile_ids,
      evaluationSuiteIds: binding.evaluation_suite_ids,
      releaseCheckProfileId: binding.release_check_profile_id,
    });

    const activeBindings = await this.repository.listByScope(
      binding.module,
      binding.manuscript_type,
      binding.template_family_id,
      true,
    );
    for (const existing of activeBindings) {
      if (existing.id !== binding.id) {
        await this.repository.save({
          ...existing,
          status: "archived",
          skill_package_ids: [...existing.skill_package_ids],
          quality_package_version_ids: [
            ...(existing.quality_package_version_ids ?? []),
          ],
        });
      }
    }

    const activeBinding: RuntimeBindingRecord = {
      ...binding,
      status: "active",
      skill_package_ids: [...binding.skill_package_ids],
      quality_package_version_ids: [...(binding.quality_package_version_ids ?? [])],
    };
    await this.repository.save(activeBinding);
    return activeBinding;
  }

  async archiveBinding(
    bindingId: string,
    actorRole: RoleKey,
  ): Promise<RuntimeBindingRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const binding = await this.requireBinding(bindingId);
    if (binding.status === "archived") {
      return binding;
    }

    const archived: RuntimeBindingRecord = {
      ...binding,
      status: "archived",
      skill_package_ids: [...binding.skill_package_ids],
      quality_package_version_ids: [...(binding.quality_package_version_ids ?? [])],
    };
    await this.repository.save(archived);
    return archived;
  }

  private async assertReferencesAreActiveOrPublished(
    input: CreateRuntimeBindingInput,
  ): Promise<void> {
    const runtime = await this.agentRuntimeRepository.findById(input.runtimeId);
    if (!runtime || runtime.status !== "active") {
      throw new RuntimeBindingDependencyStateError(
        `Runtime binding requires active runtime ${input.runtimeId}.`,
      );
    }

    if (!runtime.allowed_modules.includes(input.module)) {
      throw new RuntimeBindingCompatibilityError(
        `Runtime ${runtime.id} is incompatible with module ${input.module}.`,
      );
    }

    const sandboxProfile = await this.sandboxProfileRepository.findById(
      input.sandboxProfileId,
    );
    if (!sandboxProfile || sandboxProfile.status !== "active") {
      throw new RuntimeBindingDependencyStateError(
        `Runtime binding requires active sandbox profile ${input.sandboxProfileId}.`,
      );
    }

    if (
      runtime.sandbox_profile_id &&
      runtime.sandbox_profile_id !== input.sandboxProfileId
    ) {
      throw new RuntimeBindingCompatibilityError(
        `Runtime ${runtime.id} is not configured for sandbox profile ${input.sandboxProfileId}.`,
      );
    }

    const agentProfile = await this.agentProfileRepository.findById(
      input.agentProfileId,
    );
    if (!agentProfile || agentProfile.status !== "published") {
      throw new RuntimeBindingDependencyStateError(
        `Runtime binding requires published agent profile ${input.agentProfileId}.`,
      );
    }

    if (
      agentProfile.module_scope !== "any" &&
      !agentProfile.module_scope.includes(input.module)
    ) {
      throw new RuntimeBindingCompatibilityError(
        `Agent profile ${agentProfile.id} is incompatible with module ${input.module}.`,
      );
    }

    if (
      agentProfile.manuscript_types !== "any" &&
      !agentProfile.manuscript_types.includes(input.manuscriptType)
    ) {
      throw new RuntimeBindingCompatibilityError(
        `Agent profile ${agentProfile.id} is incompatible with manuscript type ${input.manuscriptType}.`,
      );
    }

    const toolPermissionPolicy =
      await this.toolPermissionPolicyRepository.findById(
        input.toolPermissionPolicyId,
      );
    if (!toolPermissionPolicy || toolPermissionPolicy.status !== "active") {
      throw new RuntimeBindingDependencyStateError(
        `Runtime binding requires active tool permission policy ${input.toolPermissionPolicyId}.`,
      );
    }

    const promptTemplate =
      await this.promptSkillRegistryRepository.findPromptTemplateById(
        input.promptTemplateId,
      );
    if (!promptTemplate || promptTemplate.status !== "published") {
      throw new RuntimeBindingDependencyStateError(
        `Runtime binding requires published prompt template ${input.promptTemplateId}.`,
      );
    }

    if (
      promptTemplate.module !== input.module ||
      !matchesManuscriptType(promptTemplate.manuscript_types, input.manuscriptType)
    ) {
      throw new RuntimeBindingCompatibilityError(
        `Prompt template ${promptTemplate.id} is incompatible with runtime binding scope.`,
      );
    }

    for (const skillPackageId of input.skillPackageIds) {
      const skillPackage =
        await this.promptSkillRegistryRepository.findSkillPackageById(
          skillPackageId,
        );
      if (!skillPackage || skillPackage.status !== "published") {
        throw new RuntimeBindingDependencyStateError(
          `Runtime binding requires published skill package ${skillPackageId}.`,
        );
      }

      if (!skillPackage.applies_to_modules.includes(input.module)) {
        throw new RuntimeBindingCompatibilityError(
          `Skill package ${skillPackage.id} is incompatible with module ${input.module}.`,
        );
      }
    }

    if ((input.qualityPackageVersionIds?.length ?? 0) > 0) {
      if (!this.manuscriptQualityPackageRepository) {
        throw new RuntimeBindingDependencyStateError(
          "Runtime binding requires a manuscript quality package repository when quality package refs are configured.",
        );
      }

      for (const qualityPackageVersionId of input.qualityPackageVersionIds ?? []) {
        const qualityPackage =
          await this.manuscriptQualityPackageRepository.findById(
            qualityPackageVersionId,
          );
        if (!qualityPackage || qualityPackage.status !== "published") {
          throw new RuntimeBindingDependencyStateError(
            `Runtime binding requires published quality package ${qualityPackageVersionId}.`,
          );
        }

        if (!isCompatibleQualityPackageRecord(qualityPackage)) {
          throw new RuntimeBindingCompatibilityError(
            `Quality package ${qualityPackage.id} is incompatible with runtime binding quality scopes.`,
          );
        }
      }
    }

    for (const verificationCheckProfileId of input.verificationCheckProfileIds ?? []) {
      const checkProfile =
        await this.verificationOpsRepository.findVerificationCheckProfileById(
          verificationCheckProfileId,
        );
      if (!checkProfile || checkProfile.status !== "published") {
        throw new RuntimeBindingDependencyStateError(
          `Runtime binding requires published verification check profile ${verificationCheckProfileId}.`,
        );
      }
    }

    for (const evaluationSuiteId of input.evaluationSuiteIds ?? []) {
      const suite = await this.verificationOpsRepository.findEvaluationSuiteById(
        evaluationSuiteId,
      );
      if (!suite || suite.status !== "active") {
        throw new RuntimeBindingDependencyStateError(
          `Runtime binding requires active evaluation suite ${evaluationSuiteId}.`,
        );
      }
    }

    if (input.releaseCheckProfileId) {
      const releaseCheckProfile =
        await this.verificationOpsRepository.findReleaseCheckProfileById(
          input.releaseCheckProfileId,
        );
      if (!releaseCheckProfile || releaseCheckProfile.status !== "published") {
        throw new RuntimeBindingDependencyStateError(
          `Runtime binding requires published release check profile ${input.releaseCheckProfileId}.`,
        );
      }
    }
  }

  private async requireBinding(bindingId: string): Promise<RuntimeBindingRecord> {
    const record = await this.repository.findById(bindingId);
    if (!record) {
      throw new RuntimeBindingNotFoundError(bindingId);
    }

    return record;
  }
}

function matchesManuscriptType(
  manuscriptTypes: ManuscriptType[] | "any",
  manuscriptType: ManuscriptType,
): boolean {
  return manuscriptTypes === "any" || manuscriptTypes.includes(manuscriptType);
}

function dedupePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}

function isCompatibleQualityPackageRecord(input: {
  package_kind: "general_style_package" | "medical_analyzer_package";
  target_scopes: string[];
}): boolean {
  const allowedScopesByKind = {
    general_style_package: ["general_proofreading"],
    medical_analyzer_package: ["medical_specialized"],
  } as const;
  const allowedScopes = allowedScopesByKind[input.package_kind];

  return (
    input.target_scopes.length > 0 &&
    input.target_scopes.every((scope) => allowedScopes.includes(scope as never))
  );
}
