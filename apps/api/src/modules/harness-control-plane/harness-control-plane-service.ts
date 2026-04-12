import type { RoleKey } from "../../users/roles.ts";
import type {
  ExecutionGovernanceService,
} from "../execution-governance/execution-governance-service.ts";
import type {
  HarnessEnvironmentPreviewRecord,
  HarnessEnvironmentRecord,
  HarnessEnvironmentComponent,
} from "./harness-control-plane-record.ts";
import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type {
  ManualReviewPolicyService,
} from "../manual-review-policies/manual-review-policy-service.ts";
import {
  ActiveManualReviewPolicyNotFoundError,
} from "../manual-review-policies/manual-review-policy-service.ts";
import type {
  ModelRoutingGovernanceService,
} from "../model-routing-governance/model-routing-governance-service.ts";
import type {
  RetrievalPresetService,
} from "../retrieval-presets/retrieval-preset-service.ts";
import {
  ActiveRetrievalPresetNotFoundError,
} from "../retrieval-presets/retrieval-preset-service.ts";
import type { RuntimeBindingService } from "../runtime-bindings/runtime-binding-service.ts";
import type { TemplateModule } from "../templates/template-record.ts";
import type {
  HarnessControlPlaneRollbackRepository,
  HarnessEnvironmentRollbackScopeInput,
  HarnessEnvironmentRollbackSnapshotRecord,
} from "./harness-control-plane-rollback-repository.ts";
import { InMemoryHarnessControlPlaneRollbackRepository } from "./in-memory-harness-control-plane-rollback-repository.ts";

export interface ResolveHarnessEnvironmentPreviewInput {
  module: TemplateModule;
  manuscriptType: ManuscriptType;
  templateFamilyId: string;
  executionProfileId?: string;
  runtimeBindingId?: string;
  modelRoutingPolicyVersionId?: string;
  retrievalPresetId?: string;
  manualReviewPolicyId?: string;
}

export interface ActivateHarnessEnvironmentInput
  extends ResolveHarnessEnvironmentPreviewInput {
  reason?: string;
}

export interface RollbackHarnessEnvironmentInput {
  module: TemplateModule;
  manuscriptType: ManuscriptType;
  templateFamilyId: string;
  reason?: string;
}

export interface HarnessControlPlaneServiceOptions {
  executionGovernanceService: Pick<
    ExecutionGovernanceService,
    "resolveActiveProfile" | "listProfiles"
  > & {
    getProfile?: (
      profileId: string,
    ) => Promise<HarnessEnvironmentRecord["execution_profile"]>;
    activateProfile?: (
      profileId: string,
      actorRole: RoleKey,
    ) => Promise<HarnessEnvironmentRecord["execution_profile"]>;
    publishProfile?: (
      profileId: string,
      actorRole: RoleKey,
    ) => Promise<HarnessEnvironmentRecord["execution_profile"]>;
  };
  runtimeBindingService: Pick<
    RuntimeBindingService,
    "getActiveBindingForScope" | "listBindingsForScope" | "getBinding" | "activateBinding"
  >;
  modelRoutingGovernanceService: Pick<
    ModelRoutingGovernanceService,
    "findActivePolicy" | "listPolicies" | "activateVersion"
  >;
  retrievalPresetService: Pick<
    RetrievalPresetService,
    "getActivePresetForScope" | "listPresetsForScope" | "getPreset" | "activatePreset"
  > & {
    archivePreset?: (
      presetId: string,
      actorRole: RoleKey,
    ) => Promise<NonNullable<HarnessEnvironmentRecord["retrieval_preset"]>>;
  };
  manualReviewPolicyService: Pick<
    ManualReviewPolicyService,
    "getActivePolicyForScope" | "listPoliciesForScope" | "getPolicy" | "activatePolicy"
  > & {
    archivePolicy?: (
      policyId: string,
      actorRole: RoleKey,
    ) => Promise<NonNullable<HarnessEnvironmentRecord["manual_review_policy"]>>;
  };
  rollbackHistoryRepository?: HarnessControlPlaneRollbackRepository;
}

interface ScopeKeyInput {
  module: TemplateModule;
  manuscriptType: ManuscriptType;
  templateFamilyId: string;
}

export class HarnessEnvironmentScopeMismatchError extends Error {
  constructor(
    component: HarnessEnvironmentComponent,
    recordId: string,
    scope: ScopeKeyInput,
  ) {
    super(
      `Harness ${component} ${recordId} does not belong to scope ${formatScope(scope)}.`,
    );
    this.name = "HarnessEnvironmentScopeMismatchError";
  }
}

export class HarnessControlPlaneService {
  private readonly executionGovernanceService: HarnessControlPlaneServiceOptions["executionGovernanceService"];
  private readonly runtimeBindingService: HarnessControlPlaneServiceOptions["runtimeBindingService"];
  private readonly modelRoutingGovernanceService: HarnessControlPlaneServiceOptions["modelRoutingGovernanceService"];
  private readonly retrievalPresetService: HarnessControlPlaneServiceOptions["retrievalPresetService"];
  private readonly manualReviewPolicyService: HarnessControlPlaneServiceOptions["manualReviewPolicyService"];
  private readonly rollbackHistoryRepository: HarnessControlPlaneRollbackRepository;

  constructor(options: HarnessControlPlaneServiceOptions) {
    this.executionGovernanceService = options.executionGovernanceService;
    this.runtimeBindingService = options.runtimeBindingService;
    this.modelRoutingGovernanceService = options.modelRoutingGovernanceService;
    this.retrievalPresetService = options.retrievalPresetService;
    this.manualReviewPolicyService = options.manualReviewPolicyService;
    this.rollbackHistoryRepository =
      options.rollbackHistoryRepository ??
      new InMemoryHarnessControlPlaneRollbackRepository();
  }

  async getActiveEnvironment(
    input: ScopeKeyInput,
  ): Promise<HarnessEnvironmentRecord> {
    const modelRoutingPolicyVersion = await this.resolveRoutingVersion(input);
    const retrievalPreset = await this.resolveActiveRetrievalPreset(input);
    const manualReviewPolicy = await this.resolveActiveManualReviewPolicy(input);

    return buildEnvironment({
      execution_profile: await this.executionGovernanceService.resolveActiveProfile(input),
      runtime_binding: await this.requireActiveRuntimeBinding(input),
      model_routing_policy_version: modelRoutingPolicyVersion,
      ...(retrievalPreset ? { retrieval_preset: retrievalPreset } : {}),
      ...(manualReviewPolicy ? { manual_review_policy: manualReviewPolicy } : {}),
    });
  }

  async previewEnvironment(
    input: ResolveHarnessEnvironmentPreviewInput,
  ): Promise<HarnessEnvironmentPreviewRecord> {
    const activeEnvironment = await this.getActiveEnvironment(input);
    const candidateEnvironment = await this.resolveEnvironment(input);

    return {
      active_environment: activeEnvironment,
      candidate_environment: candidateEnvironment,
      diff: {
        changed_components: diffEnvironment(activeEnvironment, candidateEnvironment),
      },
    };
  }

  async activateEnvironment(
    actorRole: RoleKey,
    input: ActivateHarnessEnvironmentInput,
  ): Promise<HarnessEnvironmentRecord> {
    const activeEnvironment = await this.getActiveEnvironment(input);
    const targetEnvironment = await this.resolveEnvironment(input);
    const rollbackSnapshot = await this.rollbackHistoryRepository.appendSnapshot({
      scope: toRollbackScope(input),
      snapshot: toRollbackSnapshot(activeEnvironment),
    });

    try {
      await this.applyEnvironment(actorRole, input, targetEnvironment, input.reason);
    } catch (error) {
      await this.restoreEnvironmentOrThrow({
        actorRole,
        scope: input,
        targetEnvironment: activeEnvironment,
        reason: input.reason,
        originalError: error,
        action: "activation",
      });
      await this.rollbackHistoryRepository.deleteSnapshot(rollbackSnapshot.id);
      throw error;
    }

    return this.getActiveEnvironment(input);
  }

  async rollbackEnvironment(
    actorRole: RoleKey,
    input: RollbackHarnessEnvironmentInput,
  ): Promise<HarnessEnvironmentRecord> {
    const rollbackEntry = await this.rollbackHistoryRepository.getLatestSnapshot(
      toRollbackScope(input),
    );
    if (!rollbackEntry) {
      return this.getActiveEnvironment(input);
    }

    const previousEnvironment = await this.resolveRollbackEnvironment(
      rollbackEntry.snapshot,
      input,
    );
    const currentEnvironment = await this.getActiveEnvironment(input);

    try {
      await this.applyEnvironment(actorRole, input, previousEnvironment, input.reason);
      await this.rollbackHistoryRepository.deleteSnapshot(rollbackEntry.id);
    } catch (error) {
      await this.restoreEnvironmentOrThrow({
        actorRole,
        scope: input,
        targetEnvironment: currentEnvironment,
        reason: input.reason,
        originalError: error,
        action: "rollback",
      });
      throw error;
    }

    return this.getActiveEnvironment(input);
  }

  private async resolveEnvironment(
    input: ResolveHarnessEnvironmentPreviewInput,
  ): Promise<HarnessEnvironmentRecord> {
    const activeEnvironment = await this.getActiveEnvironment(input);
    const scope = toScopeInput(input);

    const executionProfile = input.executionProfileId
      ? this.assertExecutionProfileScope(
          await this.requireExecutionProfile(input.executionProfileId),
          scope,
        )
      : activeEnvironment.execution_profile;
    const runtimeBinding = input.runtimeBindingId
      ? this.assertRuntimeBindingScope(
          await this.runtimeBindingService.getBinding(input.runtimeBindingId),
          scope,
        )
      : activeEnvironment.runtime_binding;
    const modelRoutingPolicyVersion = input.modelRoutingPolicyVersionId
      ? this.assertRoutingVersionScope(
          await this.requireRoutingVersionById(input.modelRoutingPolicyVersionId),
          scope,
        )
      : activeEnvironment.model_routing_policy_version;
    const retrievalPreset = input.retrievalPresetId
      ? this.assertRetrievalPresetScope(
          await this.retrievalPresetService.getPreset(input.retrievalPresetId),
          scope,
        )
      : activeEnvironment.retrieval_preset;
    const manualReviewPolicy = input.manualReviewPolicyId
      ? this.assertManualReviewPolicyScope(
          await this.manualReviewPolicyService.getPolicy(input.manualReviewPolicyId),
          scope,
        )
      : activeEnvironment.manual_review_policy;

    return buildEnvironment({
      execution_profile: executionProfile,
      runtime_binding: runtimeBinding,
      model_routing_policy_version: modelRoutingPolicyVersion,
      ...(retrievalPreset ? { retrieval_preset: retrievalPreset } : {}),
      ...(manualReviewPolicy ? { manual_review_policy: manualReviewPolicy } : {}),
    });
  }

  private async resolveRollbackEnvironment(
    snapshot: HarnessEnvironmentRollbackSnapshotRecord,
    scope: ScopeKeyInput,
  ): Promise<HarnessEnvironmentRecord> {
    const executionProfile = this.assertExecutionProfileScope(
      await this.requireExecutionProfile(snapshot.execution_profile_id),
      scope,
    );
    const runtimeBinding = this.assertRuntimeBindingScope(
      await this.runtimeBindingService.getBinding(snapshot.runtime_binding_id),
      scope,
    );
    const modelRoutingPolicyVersion = this.assertRoutingVersionScope(
      await this.requireRoutingVersionById(snapshot.model_routing_policy_version_id),
      scope,
    );
    const retrievalPreset = snapshot.retrieval_preset_id
      ? this.assertRetrievalPresetScope(
          await this.retrievalPresetService.getPreset(snapshot.retrieval_preset_id),
          scope,
        )
      : undefined;
    const manualReviewPolicy = snapshot.manual_review_policy_id
      ? this.assertManualReviewPolicyScope(
          await this.manualReviewPolicyService.getPolicy(
            snapshot.manual_review_policy_id,
          ),
          scope,
        )
      : undefined;

    return buildEnvironment({
      execution_profile: executionProfile,
      runtime_binding: runtimeBinding,
      model_routing_policy_version: modelRoutingPolicyVersion,
      ...(retrievalPreset ? { retrieval_preset: retrievalPreset } : {}),
      ...(manualReviewPolicy ? { manual_review_policy: manualReviewPolicy } : {}),
    });
  }

  private async requireActiveRuntimeBinding(
    input: ScopeKeyInput,
  ): Promise<HarnessEnvironmentRecord["runtime_binding"]> {
    const binding = await this.runtimeBindingService.getActiveBindingForScope(input);
    if (!binding) {
      throw new Error(
        `No active runtime binding exists for ${input.module}/${input.manuscriptType}/${input.templateFamilyId}.`,
      );
    }

    return binding;
  }

  private async resolveRoutingVersion(
    input: ScopeKeyInput,
  ): Promise<HarnessEnvironmentRecord["model_routing_policy_version"]> {
    const templateFamilyPolicy =
      await this.modelRoutingGovernanceService.findActivePolicy(
        "template_family",
        input.templateFamilyId,
      );
    if (templateFamilyPolicy?.active_version) {
      return templateFamilyPolicy.active_version;
    }

    const modulePolicy = await this.modelRoutingGovernanceService.findActivePolicy(
      "module",
      input.module,
    );
    if (modulePolicy?.active_version) {
      return modulePolicy.active_version;
    }

    throw new Error(
      `No active model routing policy version exists for ${input.module}/${input.templateFamilyId}.`,
    );
  }

  private async resolveActiveRetrievalPreset(
    scope: ScopeKeyInput,
  ): Promise<HarnessEnvironmentRecord["retrieval_preset"]> {
    try {
      return await this.retrievalPresetService.getActivePresetForScope(scope);
    } catch (error) {
      if (error instanceof ActiveRetrievalPresetNotFoundError) {
        return undefined;
      }

      throw error;
    }
  }

  private async resolveActiveManualReviewPolicy(
    scope: ScopeKeyInput,
  ): Promise<HarnessEnvironmentRecord["manual_review_policy"]> {
    try {
      return await this.manualReviewPolicyService.getActivePolicyForScope(scope);
    } catch (error) {
      if (error instanceof ActiveManualReviewPolicyNotFoundError) {
        return undefined;
      }

      throw error;
    }
  }

  private async requireRoutingVersionById(
    versionId: string,
  ): Promise<HarnessEnvironmentRecord["model_routing_policy_version"]> {
    const policies = await this.modelRoutingGovernanceService.listPolicies();
    const version = policies
      .flatMap((policy) => policy.versions)
      .find((record) => record.id === versionId);
    if (!version) {
      throw new Error(`Model routing policy version ${versionId} was not found.`);
    }

    return version;
  }

  private async requireExecutionProfile(
    profileId: string,
  ): Promise<HarnessEnvironmentRecord["execution_profile"]> {
    if (this.executionGovernanceService.getProfile) {
      return this.executionGovernanceService.getProfile(profileId);
    }

    const profiles = await this.executionGovernanceService.listProfiles();
    const profile = profiles.find((record) => record.id === profileId);
    if (!profile) {
      throw new Error(`Execution profile ${profileId} was not found.`);
    }

    return profile;
  }

  private async activateExecutionProfile(
    profileId: string,
    actorRole: RoleKey,
  ): Promise<void> {
    if (this.executionGovernanceService.activateProfile) {
      await this.executionGovernanceService.activateProfile(profileId, actorRole);
      return;
    }

    if (this.executionGovernanceService.publishProfile) {
      await this.executionGovernanceService.publishProfile(profileId, actorRole);
      return;
    }

    throw new Error("Execution governance activation is unavailable.");
  }

  private async applyEnvironment(
    actorRole: RoleKey,
    scope: ScopeKeyInput,
    targetEnvironment: HarnessEnvironmentRecord,
    reason?: string,
  ): Promise<void> {
    await this.activateExecutionProfile(
      targetEnvironment.execution_profile.id,
      actorRole,
    );
    await this.runtimeBindingService.activateBinding(
      targetEnvironment.runtime_binding.id,
      actorRole,
    );
    await this.modelRoutingGovernanceService.activateVersion(
      targetEnvironment.model_routing_policy_version.id,
      actorRole,
      { reason },
    );
    if (targetEnvironment.retrieval_preset) {
      await this.retrievalPresetService.activatePreset(
        targetEnvironment.retrieval_preset.id,
        actorRole,
      );
    } else {
      await this.clearActiveRetrievalPreset(scope, actorRole);
    }
    if (targetEnvironment.manual_review_policy) {
      await this.manualReviewPolicyService.activatePolicy(
        targetEnvironment.manual_review_policy.id,
        actorRole,
      );
    } else {
      await this.clearActiveManualReviewPolicy(scope, actorRole);
    }
  }

  private async restoreEnvironmentOrThrow(input: {
    actorRole: RoleKey;
    scope: ScopeKeyInput;
    targetEnvironment: HarnessEnvironmentRecord;
    reason?: string;
    originalError: unknown;
    action: "activation" | "rollback";
  }): Promise<void> {
    try {
      await this.applyEnvironment(
        input.actorRole,
        input.scope,
        input.targetEnvironment,
        input.reason,
      );
    } catch (restoreError) {
      const originalMessage =
        input.originalError instanceof Error
          ? input.originalError.message
          : String(input.originalError);
      const restoreMessage =
        restoreError instanceof Error ? restoreError.message : String(restoreError);
      throw new Error(
        `Harness ${input.action} failed and compensation could not restore the previous environment: ${originalMessage}; compensation error: ${restoreMessage}`,
        {
          cause:
            restoreError instanceof Error
              ? restoreError
              : input.originalError instanceof Error
                ? input.originalError
                : undefined,
        },
      );
    }
  }

  private async clearActiveRetrievalPreset(
    scope: ScopeKeyInput,
    actorRole: RoleKey,
  ): Promise<void> {
    const activePreset = await this.resolveActiveRetrievalPreset(scope);
    if (!activePreset) {
      return;
    }

    if (!this.retrievalPresetService.archivePreset) {
      throw new Error("Retrieval preset archive is unavailable.");
    }

    await this.retrievalPresetService.archivePreset(activePreset.id, actorRole);
  }

  private async clearActiveManualReviewPolicy(
    scope: ScopeKeyInput,
    actorRole: RoleKey,
  ): Promise<void> {
    const activePolicy = await this.resolveActiveManualReviewPolicy(scope);
    if (!activePolicy) {
      return;
    }

    if (!this.manualReviewPolicyService.archivePolicy) {
      throw new Error("Manual review policy archive is unavailable.");
    }

    await this.manualReviewPolicyService.archivePolicy(activePolicy.id, actorRole);
  }

  private assertExecutionProfileScope(
    profile: HarnessEnvironmentRecord["execution_profile"],
    scope: ScopeKeyInput,
  ): HarnessEnvironmentRecord["execution_profile"] {
    if (
      profile.module !== scope.module ||
      profile.manuscript_type !== scope.manuscriptType ||
      profile.template_family_id !== scope.templateFamilyId
    ) {
      throw new HarnessEnvironmentScopeMismatchError(
        "execution_profile",
        profile.id,
        scope,
      );
    }

    return profile;
  }

  private assertRuntimeBindingScope(
    binding: HarnessEnvironmentRecord["runtime_binding"],
    scope: ScopeKeyInput,
  ): HarnessEnvironmentRecord["runtime_binding"] {
    if (
      binding.module !== scope.module ||
      binding.manuscript_type !== scope.manuscriptType ||
      binding.template_family_id !== scope.templateFamilyId
    ) {
      throw new HarnessEnvironmentScopeMismatchError(
        "runtime_binding",
        binding.id,
        scope,
      );
    }

    return binding;
  }

  private assertRoutingVersionScope(
    version: HarnessEnvironmentRecord["model_routing_policy_version"],
    scope: ScopeKeyInput,
  ): HarnessEnvironmentRecord["model_routing_policy_version"] {
    const isCompatible =
      (version.scope_kind === "template_family" &&
        version.scope_value === scope.templateFamilyId) ||
      (version.scope_kind === "module" && version.scope_value === scope.module);
    if (!isCompatible) {
      throw new HarnessEnvironmentScopeMismatchError(
        "model_routing_policy_version",
        version.id,
        scope,
      );
    }

    return version;
  }

  private assertRetrievalPresetScope(
    preset: NonNullable<HarnessEnvironmentRecord["retrieval_preset"]>,
    scope: ScopeKeyInput,
  ): NonNullable<HarnessEnvironmentRecord["retrieval_preset"]> {
    if (
      preset.module !== scope.module ||
      preset.manuscript_type !== scope.manuscriptType ||
      preset.template_family_id !== scope.templateFamilyId
    ) {
      throw new HarnessEnvironmentScopeMismatchError(
        "retrieval_preset",
        preset.id,
        scope,
      );
    }

    return preset;
  }

  private assertManualReviewPolicyScope(
    policy: NonNullable<HarnessEnvironmentRecord["manual_review_policy"]>,
    scope: ScopeKeyInput,
  ): NonNullable<HarnessEnvironmentRecord["manual_review_policy"]> {
    if (
      policy.module !== scope.module ||
      policy.manuscript_type !== scope.manuscriptType ||
      policy.template_family_id !== scope.templateFamilyId
    ) {
      throw new HarnessEnvironmentScopeMismatchError(
        "manual_review_policy",
        policy.id,
        scope,
      );
    }

    return policy;
  }
}

function toRollbackScope(
  input: ScopeKeyInput,
): HarnessEnvironmentRollbackScopeInput {
  return {
    module: input.module,
    manuscriptType: input.manuscriptType,
    templateFamilyId: input.templateFamilyId,
  };
}

function toScopeInput(input: ScopeKeyInput): ScopeKeyInput {
  return {
    module: input.module,
    manuscriptType: input.manuscriptType,
    templateFamilyId: input.templateFamilyId,
  };
}

function formatScope(input: ScopeKeyInput): string {
  return `${input.module}/${input.manuscriptType}/${input.templateFamilyId}`;
}

function diffEnvironment(
  activeEnvironment: HarnessEnvironmentRecord,
  candidateEnvironment: HarnessEnvironmentRecord,
): HarnessEnvironmentComponent[] {
  const changed: HarnessEnvironmentComponent[] = [];

  if (
    activeEnvironment.execution_profile.id !== candidateEnvironment.execution_profile.id
  ) {
    changed.push("execution_profile");
  }
  if (activeEnvironment.runtime_binding.id !== candidateEnvironment.runtime_binding.id) {
    changed.push("runtime_binding");
  }
  if (
    activeEnvironment.model_routing_policy_version.id !==
    candidateEnvironment.model_routing_policy_version.id
  ) {
    changed.push("model_routing_policy_version");
  }
  if (
    getOptionalComponentId(activeEnvironment.retrieval_preset) !==
    getOptionalComponentId(candidateEnvironment.retrieval_preset)
  ) {
    changed.push("retrieval_preset");
  }
  if (
    getOptionalComponentId(activeEnvironment.manual_review_policy) !==
    getOptionalComponentId(candidateEnvironment.manual_review_policy)
  ) {
    changed.push("manual_review_policy");
  }

  return changed;
}

function getOptionalComponentId(value?: { id: string }): string | undefined {
  return value?.id;
}

function buildEnvironment(input: {
  execution_profile: HarnessEnvironmentRecord["execution_profile"];
  runtime_binding: HarnessEnvironmentRecord["runtime_binding"];
  model_routing_policy_version: HarnessEnvironmentRecord["model_routing_policy_version"];
  retrieval_preset?: HarnessEnvironmentRecord["retrieval_preset"];
  manual_review_policy?: HarnessEnvironmentRecord["manual_review_policy"];
}): HarnessEnvironmentRecord {
  return {
    execution_profile: input.execution_profile,
    runtime_binding: input.runtime_binding,
    model_routing_policy_version: input.model_routing_policy_version,
    ...(input.retrieval_preset
      ? { retrieval_preset: input.retrieval_preset }
      : {}),
    ...(input.manual_review_policy
      ? { manual_review_policy: input.manual_review_policy }
      : {}),
  };
}

function toRollbackSnapshot(
  environment: HarnessEnvironmentRecord,
): HarnessEnvironmentRollbackSnapshotRecord {
  return {
    execution_profile_id: environment.execution_profile.id,
    runtime_binding_id: environment.runtime_binding.id,
    model_routing_policy_version_id: environment.model_routing_policy_version.id,
    ...(environment.retrieval_preset
      ? { retrieval_preset_id: environment.retrieval_preset.id }
      : {}),
    ...(environment.manual_review_policy
      ? { manual_review_policy_id: environment.manual_review_policy.id }
      : {}),
  };
}
