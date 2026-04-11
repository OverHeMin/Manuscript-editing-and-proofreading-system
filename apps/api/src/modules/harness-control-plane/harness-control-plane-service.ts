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
import type {
  ModelRoutingGovernanceService,
} from "../model-routing-governance/model-routing-governance-service.ts";
import type {
  RetrievalPresetService,
} from "../retrieval-presets/retrieval-preset-service.ts";
import type { RuntimeBindingService } from "../runtime-bindings/runtime-binding-service.ts";
import type { TemplateModule } from "../templates/template-record.ts";

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
  >;
  manualReviewPolicyService: Pick<
    ManualReviewPolicyService,
    "getActivePolicyForScope" | "listPoliciesForScope" | "getPolicy" | "activatePolicy"
  >;
}

interface ScopeKeyInput {
  module: TemplateModule;
  manuscriptType: ManuscriptType;
  templateFamilyId: string;
}

export class HarnessControlPlaneService {
  private readonly executionGovernanceService: HarnessControlPlaneServiceOptions["executionGovernanceService"];
  private readonly runtimeBindingService: HarnessControlPlaneServiceOptions["runtimeBindingService"];
  private readonly modelRoutingGovernanceService: HarnessControlPlaneServiceOptions["modelRoutingGovernanceService"];
  private readonly retrievalPresetService: HarnessControlPlaneServiceOptions["retrievalPresetService"];
  private readonly manualReviewPolicyService: HarnessControlPlaneServiceOptions["manualReviewPolicyService"];
  private readonly rollbackHistory = new Map<string, HarnessEnvironmentRecord[]>();

  constructor(options: HarnessControlPlaneServiceOptions) {
    this.executionGovernanceService = options.executionGovernanceService;
    this.runtimeBindingService = options.runtimeBindingService;
    this.modelRoutingGovernanceService = options.modelRoutingGovernanceService;
    this.retrievalPresetService = options.retrievalPresetService;
    this.manualReviewPolicyService = options.manualReviewPolicyService;
  }

  async getActiveEnvironment(
    input: ScopeKeyInput,
  ): Promise<HarnessEnvironmentRecord> {
    const modelRoutingPolicyVersion = await this.resolveRoutingVersion(input);

    return {
      execution_profile: await this.executionGovernanceService.resolveActiveProfile(input),
      runtime_binding: await this.requireActiveRuntimeBinding(input),
      model_routing_policy_version: modelRoutingPolicyVersion,
      retrieval_preset: await this.retrievalPresetService.getActivePresetForScope(input),
      manual_review_policy:
        await this.manualReviewPolicyService.getActivePolicyForScope(input),
    };
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
    this.pushRollbackSnapshot(input, activeEnvironment);

    const targetEnvironment = await this.resolveEnvironment(input);

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
      { reason: input.reason },
    );
    await this.retrievalPresetService.activatePreset(
      targetEnvironment.retrieval_preset.id,
      actorRole,
    );
    await this.manualReviewPolicyService.activatePolicy(
      targetEnvironment.manual_review_policy.id,
      actorRole,
    );

    return this.getActiveEnvironment(input);
  }

  async rollbackEnvironment(
    actorRole: RoleKey,
    input: RollbackHarnessEnvironmentInput,
  ): Promise<HarnessEnvironmentRecord> {
    const scopeKey = toScopeKey(input);
    const history = this.rollbackHistory.get(scopeKey) ?? [];
    const previousEnvironment = history.pop();
    if (!previousEnvironment) {
      return this.getActiveEnvironment(input);
    }
    this.rollbackHistory.set(scopeKey, history);

    await this.activateExecutionProfile(
      previousEnvironment.execution_profile.id,
      actorRole,
    );
    await this.runtimeBindingService.activateBinding(
      previousEnvironment.runtime_binding.id,
      actorRole,
    );
    await this.modelRoutingGovernanceService.activateVersion(
      previousEnvironment.model_routing_policy_version.id,
      actorRole,
      { reason: input.reason },
    );
    await this.retrievalPresetService.activatePreset(
      previousEnvironment.retrieval_preset.id,
      actorRole,
    );
    await this.manualReviewPolicyService.activatePolicy(
      previousEnvironment.manual_review_policy.id,
      actorRole,
    );

    return this.getActiveEnvironment(input);
  }

  private async resolveEnvironment(
    input: ResolveHarnessEnvironmentPreviewInput,
  ): Promise<HarnessEnvironmentRecord> {
    const activeEnvironment = await this.getActiveEnvironment(input);

    return {
      execution_profile: input.executionProfileId
        ? await this.requireExecutionProfile(input.executionProfileId)
        : activeEnvironment.execution_profile,
      runtime_binding: input.runtimeBindingId
        ? await this.runtimeBindingService.getBinding(input.runtimeBindingId)
        : activeEnvironment.runtime_binding,
      model_routing_policy_version: input.modelRoutingPolicyVersionId
        ? await this.requireRoutingVersionById(input.modelRoutingPolicyVersionId)
        : activeEnvironment.model_routing_policy_version,
      retrieval_preset: input.retrievalPresetId
        ? await this.retrievalPresetService.getPreset(input.retrievalPresetId)
        : activeEnvironment.retrieval_preset,
      manual_review_policy: input.manualReviewPolicyId
        ? await this.manualReviewPolicyService.getPolicy(input.manualReviewPolicyId)
        : activeEnvironment.manual_review_policy,
    };
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

  private pushRollbackSnapshot(
    input: ScopeKeyInput,
    activeEnvironment: HarnessEnvironmentRecord,
  ): void {
    const scopeKey = toScopeKey(input);
    const history = this.rollbackHistory.get(scopeKey) ?? [];
    history.push(activeEnvironment);
    this.rollbackHistory.set(scopeKey, history);
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
}

function toScopeKey(input: ScopeKeyInput): string {
  return `${input.module}::${input.manuscriptType}::${input.templateFamilyId}`;
}

function diffEnvironment(
  activeEnvironment: HarnessEnvironmentRecord,
  candidateEnvironment: HarnessEnvironmentRecord,
): HarnessEnvironmentComponent[] {
  const changed: HarnessEnvironmentComponent[] = [];

  if (activeEnvironment.execution_profile.id !== candidateEnvironment.execution_profile.id) {
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
  if (activeEnvironment.retrieval_preset.id !== candidateEnvironment.retrieval_preset.id) {
    changed.push("retrieval_preset");
  }
  if (
    activeEnvironment.manual_review_policy.id !==
    candidateEnvironment.manual_review_policy.id
  ) {
    changed.push("manual_review_policy");
  }

  return changed;
}
