import {
  getAgentExecutionLog,
  listAgentExecutionLogs,
} from "../agent-execution/index.ts";
import type { AgentExecutionLogViewModel } from "../agent-execution/index.ts";
import {
  createAgentProfile,
  listAgentProfiles,
  publishAgentProfile,
} from "../agent-profiles/index.ts";
import type {
  AgentProfileViewModel,
  CreateAgentProfileInput,
} from "../agent-profiles/index.ts";
import {
  createAgentRuntime,
  listAgentRuntimes,
  publishAgentRuntime,
} from "../agent-runtime/index.ts";
import type {
  AgentRuntimeViewModel,
  CreateAgentRuntimeInput,
} from "../agent-runtime/index.ts";
import {
  listExecutionProfiles,
  resolveExecutionBundlePreview,
} from "../execution-governance/index.ts";
import type {
  ManualReviewPolicyViewModel,
  ModuleExecutionProfileViewModel,
  RetrievalPresetViewModel,
  ResolvedExecutionBundleViewModel,
  ResolveExecutionBundlePreviewInput,
} from "../execution-governance/index.ts";
import {
  getExecutionSnapshot,
  listKnowledgeHitLogsBySnapshotId,
} from "../execution-tracking/index.ts";
import type {
  KnowledgeHitLogViewModel,
  ModuleExecutionSnapshotViewModel,
} from "../execution-tracking/index.ts";
import {
  type DocumentAssetViewModel,
  getJob,
  getManuscript,
  type JobViewModel,
  listManuscriptAssets,
  type ManuscriptViewModel,
} from "../manuscripts/index.ts";
import {
  createModelRegistryEntry,
  getModelRoutingPolicy,
  listModelRegistryEntries,
  updateModelRegistryEntry,
  updateModelRoutingPolicy,
} from "../model-registry/index.ts";
import {
  activateModelRoutingPolicyVersion,
  approveModelRoutingPolicyVersion,
  createModelRoutingPolicy,
  createModelRoutingPolicyDraftVersion,
  listModelRoutingPolicies,
  rollbackModelRoutingPolicy,
  saveModelRoutingPolicyDraft,
  submitModelRoutingPolicyVersion,
} from "../model-routing-governance/index.ts";
import {
  createManuscriptQualityPackageDraft,
  listManuscriptQualityPackages,
  publishManuscriptQualityPackageVersion,
} from "../manuscript-quality-packages/index.ts";
import {
  activateRuntimeBinding,
  createRuntimeBinding,
  listRuntimeBindings,
} from "../runtime-bindings/index.ts";
import type {
  CreateRuntimeBindingInput,
  RuntimeBindingViewModel,
} from "../runtime-bindings/index.ts";
import {
  listHarnessAdapters,
  listHarnessExecutionsByAdapterId,
} from "../harness-integrations/index.ts";
import type {
  HarnessAdapterHealthViewModel,
  HarnessAdapterViewModel,
  HarnessExecutionViewModel,
  HarnessJudgeCalibrationOutcomeViewModel,
} from "../harness-integrations/index.ts";
import {
  activateSandboxProfile,
  createSandboxProfile,
  listSandboxProfiles,
} from "../sandbox-profiles/index.ts";
import type {
  CreateSandboxProfileInput,
  SandboxProfileViewModel,
} from "../sandbox-profiles/index.ts";
import {
  createModuleTemplateDraft,
  listModuleTemplatesByTemplateFamilyId,
  listTemplateFamilies,
  publishModuleTemplate,
} from "../templates/index.ts";
import {
  createToolGatewayTool,
  listToolGatewayTools,
} from "../tool-gateway/index.ts";
import type {
  CreateToolGatewayToolInput,
  ToolGatewayToolViewModel,
} from "../tool-gateway/index.ts";
import {
  activateToolPermissionPolicy,
  createToolPermissionPolicy,
  listToolPermissionPolicies,
} from "../tool-permission-policies/index.ts";
import type {
  CreateToolPermissionPolicyInput,
  ToolPermissionPolicyViewModel,
} from "../tool-permission-policies/index.ts";
import { listPromptTemplates, listSkillPackages } from "../prompt-skill-registry/index.ts";
import type { AuthRole } from "../auth/index.ts";
import type {
  CreateModelRegistryEntryInput,
  ModelRegistryEntryViewModel,
  ModelRoutingPolicyViewModel,
  UpdateModelRegistryEntryInput,
  UpdateModelRoutingPolicyInput,
} from "../model-registry/index.ts";
import type {
  CreateManuscriptQualityPackageDraftInput,
  ManuscriptQualityPackageViewModel,
} from "../manuscript-quality-packages/index.ts";
import type {
  CreateModelRoutingPolicyInput,
  CreateModelRoutingPolicyDraftVersionInput,
  ModelRoutingPolicyViewModel as GovernedModelRoutingPolicyViewModel,
  ModelRoutingPolicyVersionEnvelopeViewModel,
  RollbackModelRoutingPolicyInput,
  SaveModelRoutingPolicyDraftInput,
} from "../model-routing-governance/index.ts";
import type { PromptTemplateViewModel, SkillPackageViewModel } from "../prompt-skill-registry/index.ts";
import {
  createEvaluationRun,
  getVerificationEvidence,
  listEvaluationSuites,
  listReleaseCheckProfiles,
  listVerificationCheckProfiles,
} from "../verification-ops/index.ts";
import { listSystemSettingsAiProviders } from "../system-settings/system-settings-api.ts";
import type {
  EvaluationRunViewModel,
  EvaluationSuiteViewModel,
  FrozenExperimentBindingInput,
  ReleaseCheckProfileViewModel,
  VerificationCheckProfileViewModel,
  VerificationEvidenceViewModel,
} from "../verification-ops/index.ts";
import type { SystemSettingsAiProviderConnectionViewModel } from "../system-settings/types.ts";
import type {
  CreateModuleTemplateDraftInput,
  ModuleTemplateViewModel,
  TemplateFamilyViewModel,
} from "../templates/index.ts";

export interface AdminGovernanceHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export interface AdminGovernanceLandingOverview {
  aiAccess: {
    totalConnections: number;
    enabledConnections: number;
    prodReadyModels: number;
    connections: Array<
      Pick<
        SystemSettingsAiProviderConnectionViewModel,
        "id" | "name" | "provider_kind" | "compatibility_mode" | "enabled" | "last_test_status"
      >
    >;
  };
  harness: {
    evaluationSuiteCount: number;
    runtimeBindingCount: number;
    adapterHealthCount: number;
    adapterHealth: HarnessAdapterHealthViewModel[];
    latestJudgeCalibrationBatchOutcome: HarnessJudgeCalibrationOutcomeViewModel | null;
  };
  warnings: string[];
}

export interface AdminGovernanceOverview {
  landing: AdminGovernanceLandingOverview;
  templateFamilies: TemplateFamilyViewModel[];
  selectedTemplateFamilyId: string | null;
  moduleTemplates: ModuleTemplateViewModel[];
  promptTemplates: PromptTemplateViewModel[];
  skillPackages: SkillPackageViewModel[];
  executionProfiles: ModuleExecutionProfileViewModel[];
  qualityPackages: ManuscriptQualityPackageViewModel[];
  modelRegistryEntries: ModelRegistryEntryViewModel[];
  modelRoutingPolicy: ModelRoutingPolicyViewModel;
  routingPolicies: GovernedModelRoutingPolicyViewModel[];
  toolGatewayTools: ToolGatewayToolViewModel[];
  sandboxProfiles: SandboxProfileViewModel[];
  agentProfiles: AgentProfileViewModel[];
  agentRuntimes: AgentRuntimeViewModel[];
  toolPermissionPolicies: ToolPermissionPolicyViewModel[];
  verificationCheckProfiles: VerificationCheckProfileViewModel[];
  releaseCheckProfiles: ReleaseCheckProfileViewModel[];
  evaluationSuites: EvaluationSuiteViewModel[];
  runtimeBindings: RuntimeBindingViewModel[];
  harnessAdapters: HarnessAdapterViewModel[];
  harnessAdapterHealth: HarnessAdapterHealthViewModel[];
  latestJudgeCalibrationBatchOutcome: HarnessJudgeCalibrationOutcomeViewModel | null;
  agentExecutionLogs: AgentExecutionLogViewModel[];
  aiProviderConnections: SystemSettingsAiProviderConnectionViewModel[];
}

export interface AdminGovernanceExecutionEvidence {
  log: AgentExecutionLogViewModel;
  manuscript: ManuscriptViewModel | null;
  job: JobViewModel | null;
  createdAssets: DocumentAssetViewModel[];
  snapshot: ModuleExecutionSnapshotViewModel | null;
  knowledgeHitLogs: KnowledgeHitLogViewModel[];
  verificationEvidence: VerificationEvidenceViewModel[];
  unresolvedVerificationEvidenceIds: string[];
}

export interface HarnessEnvironmentViewModel {
  execution_profile: ModuleExecutionProfileViewModel;
  runtime_binding: RuntimeBindingViewModel;
  model_routing_policy_version: GovernedModelRoutingPolicyViewModel["versions"][number];
  retrieval_preset: RetrievalPresetViewModel;
  manual_review_policy: ManualReviewPolicyViewModel;
}

export interface HarnessEnvironmentPreviewViewModel {
  active_environment: HarnessEnvironmentViewModel;
  candidate_environment: HarnessEnvironmentViewModel;
  diff: {
    changed_components: Array<
      | "execution_profile"
      | "runtime_binding"
      | "model_routing_policy_version"
      | "retrieval_preset"
      | "manual_review_policy"
    >;
  };
}

export interface AdminHarnessScopeViewModel {
  activeEnvironment: HarnessEnvironmentViewModel;
  retrievalPresets: RetrievalPresetViewModel[];
  manualReviewPolicies: ManualReviewPolicyViewModel[];
}

export interface AdminGovernanceWorkbenchController {
  loadOverview(input?: {
    selectedTemplateFamilyId?: string | null;
  }): Promise<AdminGovernanceOverview>;
  createTemplateFamilyAndReload(input: {
    manuscriptType: TemplateFamilyViewModel["manuscript_type"];
    name: string;
  }): Promise<{
    createdFamily: TemplateFamilyViewModel;
    overview: AdminGovernanceOverview;
  }>;
  createModuleTemplateDraftAndReload(input: {
    selectedTemplateFamilyId: string;
    draft: CreateModuleTemplateDraftInput;
  }): Promise<{
    createdDraft: ModuleTemplateViewModel;
    overview: AdminGovernanceOverview;
  }>;
  createModelEntryAndReload(input: CreateModelRegistryEntryInput): Promise<{
    createdModel: ModelRegistryEntryViewModel;
    overview: AdminGovernanceOverview;
  }>;
  updateModelEntryAndReload(
    input: { modelId: string } & UpdateModelRegistryEntryInput,
  ): Promise<{
    updatedModel: ModelRegistryEntryViewModel;
    overview: AdminGovernanceOverview;
  }>;
  createRoutingPolicyAndReload(input: CreateModelRoutingPolicyInput): Promise<{
    createdPolicy: ModelRoutingPolicyVersionEnvelopeViewModel;
    overview: AdminGovernanceOverview;
  }>;
  createRoutingPolicyDraftVersionAndReload(
    input: CreateModelRoutingPolicyDraftVersionInput,
  ): Promise<AdminGovernanceOverview>;
  saveRoutingPolicyDraftAndReload(
    input: SaveModelRoutingPolicyDraftInput,
  ): Promise<AdminGovernanceOverview>;
  submitRoutingPolicyVersionAndReload(input: {
    actorRole: AuthRole;
    versionId: string;
    actorId?: string;
    reason?: string;
  }): Promise<AdminGovernanceOverview>;
  approveRoutingPolicyVersionAndReload(input: {
    actorRole: AuthRole;
    versionId: string;
    actorId?: string;
    reason?: string;
  }): Promise<AdminGovernanceOverview>;
  activateRoutingPolicyVersionAndReload(input: {
    actorRole: AuthRole;
    versionId: string;
    actorId?: string;
    reason?: string;
  }): Promise<AdminGovernanceOverview>;
  rollbackRoutingPolicyAndReload(
    input: RollbackModelRoutingPolicyInput,
  ): Promise<AdminGovernanceOverview>;
  createToolGatewayToolAndReload(input: CreateToolGatewayToolInput): Promise<{
    createdTool: ToolGatewayToolViewModel;
    overview: AdminGovernanceOverview;
  }>;
  createSandboxProfileAndReload(input: CreateSandboxProfileInput): Promise<{
    createdProfile: SandboxProfileViewModel;
    overview: AdminGovernanceOverview;
  }>;
  activateSandboxProfileAndReload(input: {
    actorRole: AuthRole;
    profileId: string;
    selectedTemplateFamilyId?: string | null;
  }): Promise<AdminGovernanceOverview>;
  createAgentProfileAndReload(input: CreateAgentProfileInput): Promise<{
    createdProfile: AgentProfileViewModel;
    overview: AdminGovernanceOverview;
  }>;
  publishAgentProfileAndReload(input: {
    actorRole: AuthRole;
    profileId: string;
    selectedTemplateFamilyId?: string | null;
  }): Promise<AdminGovernanceOverview>;
  createAgentRuntimeAndReload(input: CreateAgentRuntimeInput): Promise<{
    createdRuntime: AgentRuntimeViewModel;
    overview: AdminGovernanceOverview;
  }>;
  publishAgentRuntimeAndReload(input: {
    actorRole: AuthRole;
    runtimeId: string;
    selectedTemplateFamilyId?: string | null;
  }): Promise<AdminGovernanceOverview>;
  createToolPermissionPolicyAndReload(input: CreateToolPermissionPolicyInput): Promise<{
    createdPolicy: ToolPermissionPolicyViewModel;
    overview: AdminGovernanceOverview;
  }>;
  activateToolPermissionPolicyAndReload(input: {
    actorRole: AuthRole;
    policyId: string;
    selectedTemplateFamilyId?: string | null;
  }): Promise<AdminGovernanceOverview>;
  createRuntimeBindingAndReload(input: CreateRuntimeBindingInput): Promise<{
    createdBinding: RuntimeBindingViewModel;
    overview: AdminGovernanceOverview;
  }>;
  createQualityPackageDraftAndReload(
    input: CreateManuscriptQualityPackageDraftInput,
  ): Promise<{
    createdPackage: ManuscriptQualityPackageViewModel;
    overview: AdminGovernanceOverview;
  }>;
  publishQualityPackageVersionAndReload(input: {
    actorRole: AuthRole;
    packageVersionId: string;
    selectedTemplateFamilyId?: string | null;
  }): Promise<AdminGovernanceOverview>;
  activateRuntimeBindingAndReload(input: {
    actorRole: AuthRole;
    bindingId: string;
    selectedTemplateFamilyId?: string | null;
  }): Promise<AdminGovernanceOverview>;
  loadHarnessScope(input: {
    module: ModuleExecutionProfileViewModel["module"];
    manuscriptType: ModuleExecutionProfileViewModel["manuscript_type"];
    templateFamilyId: string;
  }): Promise<AdminHarnessScopeViewModel>;
  previewHarnessEnvironment(
    input: ResolveExecutionBundlePreviewInput,
  ): Promise<HarnessEnvironmentPreviewViewModel>;
  activateHarnessEnvironment(input: {
    actorRole: AuthRole;
    module: ModuleExecutionProfileViewModel["module"];
    manuscriptType: ModuleExecutionProfileViewModel["manuscript_type"];
    templateFamilyId: string;
    executionProfileId?: string;
    runtimeBindingId?: string;
    modelRoutingPolicyVersionId?: string;
    retrievalPresetId?: string;
    manualReviewPolicyId?: string;
    reason?: string;
  }): Promise<HarnessEnvironmentViewModel>;
  rollbackHarnessEnvironment(input: {
    actorRole: AuthRole;
    module: ModuleExecutionProfileViewModel["module"];
    manuscriptType: ModuleExecutionProfileViewModel["manuscript_type"];
    templateFamilyId: string;
    reason?: string;
  }): Promise<HarnessEnvironmentViewModel>;
  createHarnessRun(input: {
    actorRole: AuthRole;
    suiteId: string;
    sampleSetId?: string;
    baselineBinding?: FrozenExperimentBindingInput;
    candidateBinding?: FrozenExperimentBindingInput;
    releaseCheckProfileId?: string;
  }): Promise<EvaluationRunViewModel>;
  loadExecutionEvidence(logId: string): Promise<AdminGovernanceExecutionEvidence>;
  updateRoutingPolicyAndReload(
    input: UpdateModelRoutingPolicyInput,
  ): Promise<AdminGovernanceOverview>;
  resolveExecutionBundlePreview(
    input: ResolveExecutionBundlePreviewInput,
  ): Promise<ResolvedExecutionBundleViewModel>;
  publishModuleTemplateAndReload(input: {
    selectedTemplateFamilyId: string;
    moduleTemplateId: string;
    actorRole: AuthRole;
  }): Promise<AdminGovernanceOverview>;
}

export function createAdminGovernanceWorkbenchController(
  client: AdminGovernanceHttpClient,
): AdminGovernanceWorkbenchController {
  return {
    loadOverview(input) {
      return loadAdminGovernanceOverview(client, input);
    },
    async createTemplateFamilyAndReload(input) {
      const createdFamily = (
        await client.request<TemplateFamilyViewModel>({
          method: "POST",
          url: "/api/v1/templates/families",
          body: input,
        })
      ).body;

      return {
        createdFamily,
        overview: await loadAdminGovernanceOverview(client, {
          selectedTemplateFamilyId: createdFamily.id,
        }),
      };
    },
    async createModuleTemplateDraftAndReload(input) {
      const createdDraft = (await createModuleTemplateDraft(client, input.draft)).body;

      return {
        createdDraft,
        overview: await loadAdminGovernanceOverview(client, {
          selectedTemplateFamilyId: input.selectedTemplateFamilyId,
        }),
      };
    },
    async createModelEntryAndReload(input) {
      const createdModel = (await createModelRegistryEntry(client, input)).body;

      return {
        createdModel,
        overview: await loadAdminGovernanceOverview(client),
      };
    },
    async updateModelEntryAndReload(input) {
      const updateInput: UpdateModelRegistryEntryInput = {
        actorRole: input.actorRole,
        ...(input.allowedModules ? { allowedModules: input.allowedModules } : {}),
        ...(input.isProdAllowed !== undefined
          ? { isProdAllowed: input.isProdAllowed }
          : {}),
        ...(input.costProfile ? { costProfile: input.costProfile } : {}),
        ...(input.rateLimit ? { rateLimit: input.rateLimit } : {}),
        ...(input.fallbackModelId !== undefined
          ? { fallbackModelId: input.fallbackModelId }
          : {}),
        ...(input.connectionId !== undefined
          ? { connectionId: input.connectionId }
          : {}),
      };
      const updatedModel = (
        await updateModelRegistryEntry(client, input.modelId, updateInput)
      ).body;

      return {
        updatedModel,
        overview: await loadAdminGovernanceOverview(client),
      };
    },
    async createRoutingPolicyAndReload(input) {
      const createdPolicy = (await createModelRoutingPolicy(client, input)).body;

      return {
        createdPolicy,
        overview: await loadAdminGovernanceOverview(client),
      };
    },
    async createRoutingPolicyDraftVersionAndReload(input) {
      await createModelRoutingPolicyDraftVersion(client, input);
      return loadAdminGovernanceOverview(client);
    },
    async saveRoutingPolicyDraftAndReload(input) {
      await saveModelRoutingPolicyDraft(client, input);
      return loadAdminGovernanceOverview(client);
    },
    async submitRoutingPolicyVersionAndReload(input) {
      await submitModelRoutingPolicyVersion(client, input);
      return loadAdminGovernanceOverview(client);
    },
    async approveRoutingPolicyVersionAndReload(input) {
      await approveModelRoutingPolicyVersion(client, input);
      return loadAdminGovernanceOverview(client);
    },
    async activateRoutingPolicyVersionAndReload(input) {
      await activateModelRoutingPolicyVersion(client, input);
      return loadAdminGovernanceOverview(client);
    },
    async rollbackRoutingPolicyAndReload(input) {
      await rollbackModelRoutingPolicy(client, input);
      return loadAdminGovernanceOverview(client);
    },
    async createToolGatewayToolAndReload(input) {
      const createdTool = (await createToolGatewayTool(client, input)).body;

      return {
        createdTool,
        overview: await loadAdminGovernanceOverview(client),
      };
    },
    async createSandboxProfileAndReload(input) {
      const createdProfile = (await createSandboxProfile(client, input)).body;

      return {
        createdProfile,
        overview: await loadAdminGovernanceOverview(client),
      };
    },
    async activateSandboxProfileAndReload(input) {
      await activateSandboxProfile(client, input.profileId, {
        actorRole: input.actorRole,
      });
      return loadAdminGovernanceOverview(client, {
        selectedTemplateFamilyId: input.selectedTemplateFamilyId ?? null,
      });
    },
    async createAgentProfileAndReload(input) {
      const createdProfile = (await createAgentProfile(client, input)).body;

      return {
        createdProfile,
        overview: await loadAdminGovernanceOverview(client),
      };
    },
    async publishAgentProfileAndReload(input) {
      await publishAgentProfile(client, input.profileId, {
        actorRole: input.actorRole,
      });
      return loadAdminGovernanceOverview(client, {
        selectedTemplateFamilyId: input.selectedTemplateFamilyId ?? null,
      });
    },
    async createAgentRuntimeAndReload(input) {
      const createdRuntime = (await createAgentRuntime(client, input)).body;

      return {
        createdRuntime,
        overview: await loadAdminGovernanceOverview(client),
      };
    },
    async publishAgentRuntimeAndReload(input) {
      await publishAgentRuntime(client, input.runtimeId, {
        actorRole: input.actorRole,
      });
      return loadAdminGovernanceOverview(client, {
        selectedTemplateFamilyId: input.selectedTemplateFamilyId ?? null,
      });
    },
    async createToolPermissionPolicyAndReload(input) {
      const createdPolicy = (await createToolPermissionPolicy(client, input)).body;

      return {
        createdPolicy,
        overview: await loadAdminGovernanceOverview(client),
      };
    },
    async activateToolPermissionPolicyAndReload(input) {
      await activateToolPermissionPolicy(client, input.policyId, {
        actorRole: input.actorRole,
      });
      return loadAdminGovernanceOverview(client, {
        selectedTemplateFamilyId: input.selectedTemplateFamilyId ?? null,
      });
    },
    async createRuntimeBindingAndReload(input) {
      const createdBinding = (await createRuntimeBinding(client, input)).body;

      return {
        createdBinding,
        overview: await loadAdminGovernanceOverview(client, {
          selectedTemplateFamilyId: input.templateFamilyId,
        }),
      };
    },
    async createQualityPackageDraftAndReload(input) {
      const createdPackage = (
        await createManuscriptQualityPackageDraft(client, input)
      ).body;

      return {
        createdPackage,
        overview: await loadAdminGovernanceOverview(client),
      };
    },
    async publishQualityPackageVersionAndReload(input) {
      await publishManuscriptQualityPackageVersion(client, input.packageVersionId, {
        actorRole: input.actorRole,
      });
      return loadAdminGovernanceOverview(client, {
        selectedTemplateFamilyId: input.selectedTemplateFamilyId ?? null,
      });
    },
    async activateRuntimeBindingAndReload(input) {
      await activateRuntimeBinding(client, input.bindingId, {
        actorRole: input.actorRole,
      });
      return loadAdminGovernanceOverview(client, {
        selectedTemplateFamilyId: input.selectedTemplateFamilyId ?? null,
      });
    },
    async loadHarnessScope(input) {
      const [scopeResponse, retrievalPresets, manualReviewPolicies] = await Promise.all([
        getHarnessScopeEnvironment(client, input),
        listRetrievalPresetsForScope(client, input),
        listManualReviewPoliciesForScope(client, input),
      ]);

      return {
        activeEnvironment: scopeResponse.body.active_environment,
        retrievalPresets: retrievalPresets.body,
        manualReviewPolicies: manualReviewPolicies.body,
      };
    },
    async previewHarnessEnvironment(input) {
      return (await requestHarnessEnvironmentPreview(client, input)).body;
    },
    async activateHarnessEnvironment(input) {
      return (
        await requestHarnessEnvironmentActivation(client, {
          actorRole: input.actorRole,
          input: {
            module: input.module,
            manuscriptType: input.manuscriptType,
            templateFamilyId: input.templateFamilyId,
            executionProfileId: input.executionProfileId,
            runtimeBindingId: input.runtimeBindingId,
            modelRoutingPolicyVersionId: input.modelRoutingPolicyVersionId,
            retrievalPresetId: input.retrievalPresetId,
            manualReviewPolicyId: input.manualReviewPolicyId,
            reason: input.reason,
          },
        })
      ).body;
    },
    async rollbackHarnessEnvironment(input) {
      return (
        await requestHarnessEnvironmentRollback(client, {
          actorRole: input.actorRole,
          input: {
            module: input.module,
            manuscriptType: input.manuscriptType,
            templateFamilyId: input.templateFamilyId,
            reason: input.reason,
          },
        })
      ).body;
    },
    async createHarnessRun(input) {
      return (
        await createEvaluationRun(client, {
          actorRole: input.actorRole,
          suiteId: input.suiteId,
          sampleSetId: input.sampleSetId,
          baselineBinding: input.baselineBinding,
          candidateBinding: input.candidateBinding,
          releaseCheckProfileId: input.releaseCheckProfileId,
        })
      ).body;
    },
    loadExecutionEvidence(logId) {
      return loadAdminGovernanceExecutionEvidence(client, logId);
    },
    async updateRoutingPolicyAndReload(input) {
      await updateModelRoutingPolicy(client, input);
      return loadAdminGovernanceOverview(client);
    },
    async resolveExecutionBundlePreview(input) {
      return (await resolveExecutionBundlePreview(client, input)).body;
    },
    async publishModuleTemplateAndReload(input) {
      await publishModuleTemplate(client, input.moduleTemplateId, input.actorRole);
      return loadAdminGovernanceOverview(client, {
        selectedTemplateFamilyId: input.selectedTemplateFamilyId,
      });
    },
  };
}

export async function loadAdminGovernanceOverview(
  client: AdminGovernanceHttpClient,
  input: {
    selectedTemplateFamilyId?: string | null;
  } = {},
): Promise<AdminGovernanceOverview> {
  const [
    templateFamiliesResponse,
    promptTemplatesResponse,
    skillPackagesResponse,
    modelRegistryResponse,
    modelRoutingPolicyResponse,
    routingPoliciesResponse,
    executionProfilesResponse,
    qualityPackagesResponse,
    toolGatewayResponse,
    sandboxProfileResponse,
    agentProfileResponse,
    agentRuntimeResponse,
    toolPermissionPolicyResponse,
    verificationCheckProfileResponse,
    releaseCheckProfileResponse,
    evaluationSuiteResponse,
    runtimeBindingResponse,
    harnessAdapters,
    agentExecutionResponse,
    aiProviderConnections,
  ] = await Promise.all([
    loadOptional(
      () => listTemplateFamilies(client).then((response) => response.body),
      [] as TemplateFamilyViewModel[],
    ),
    loadOptional(
      () => listPromptTemplates(client).then((response) => response.body),
      [] as PromptTemplateViewModel[],
    ),
    loadOptional(
      () => listSkillPackages(client).then((response) => response.body),
      [] as SkillPackageViewModel[],
    ),
    listModelRegistryEntries(client),
    getModelRoutingPolicy(client),
    listModelRoutingPolicies(client),
    loadOptional(
      () => listExecutionProfiles(client).then((response) => response.body),
      [] as ModuleExecutionProfileViewModel[],
    ),
    loadOptional(
      () => listManuscriptQualityPackages(client).then((response) => response.body),
      [] as ManuscriptQualityPackageViewModel[],
    ),
    listToolGatewayTools(client),
    listSandboxProfiles(client),
    listAgentProfiles(client),
    listAgentRuntimes(client),
    listToolPermissionPolicies(client),
    listVerificationCheckProfiles(client),
    listReleaseCheckProfiles(client),
    listEvaluationSuites(client),
    listRuntimeBindings(client),
    loadOptional(
      () => listHarnessAdapters(client).then((response) => response.body),
      [] as HarnessAdapterViewModel[],
    ),
    listAgentExecutionLogs(client),
    loadOptional(
      () => listSystemSettingsAiProviders(client).then((response) => response.body),
      [] as SystemSettingsAiProviderConnectionViewModel[],
    ),
  ]);

  const templateFamilies = templateFamiliesResponse ?? [];
  const aiProviderConnectionList = Array.isArray(aiProviderConnections)
    ? aiProviderConnections
    : [];
  const selectedTemplateFamilyId = resolveSelectedTemplateFamilyId(
    templateFamilies,
    input.selectedTemplateFamilyId ?? null,
  );
  const moduleTemplates =
    selectedTemplateFamilyId == null
      ? []
      : ((await loadOptional(
          () =>
            listModuleTemplatesByTemplateFamilyId(client, selectedTemplateFamilyId).then(
              (response) => response.body,
            ),
          [] as ModuleTemplateViewModel[],
        )) ?? []);
  const harnessAdapterHealth = await loadHarnessAdapterHealth(
    client,
    harnessAdapters ?? [],
  );
  const latestJudgeCalibrationBatchOutcome =
    selectLatestJudgeCalibrationBatchOutcome(harnessAdapterHealth);
  const landing = buildAdminGovernanceLandingOverview({
    aiProviderConnections: aiProviderConnectionList,
    modelRegistryEntries: modelRegistryResponse.body,
    evaluationSuites: evaluationSuiteResponse.body,
    runtimeBindings: runtimeBindingResponse.body,
    harnessAdapterHealth,
    latestJudgeCalibrationBatchOutcome,
    qualityPackages: qualityPackagesResponse ?? [],
  });

  return {
    landing,
    templateFamilies,
    selectedTemplateFamilyId,
    moduleTemplates,
    promptTemplates: promptTemplatesResponse ?? [],
    skillPackages: skillPackagesResponse ?? [],
    executionProfiles: executionProfilesResponse ?? [],
    qualityPackages: qualityPackagesResponse ?? [],
    modelRegistryEntries: modelRegistryResponse.body,
    modelRoutingPolicy: modelRoutingPolicyResponse.body,
    routingPolicies: routingPoliciesResponse.body,
    toolGatewayTools: toolGatewayResponse.body,
    sandboxProfiles: sandboxProfileResponse.body,
    agentProfiles: agentProfileResponse.body,
    agentRuntimes: agentRuntimeResponse.body,
    toolPermissionPolicies: toolPermissionPolicyResponse.body,
    verificationCheckProfiles: verificationCheckProfileResponse.body,
    releaseCheckProfiles: releaseCheckProfileResponse.body,
    evaluationSuites: evaluationSuiteResponse.body,
    runtimeBindings: runtimeBindingResponse.body,
    harnessAdapters: harnessAdapters ?? [],
    harnessAdapterHealth,
    latestJudgeCalibrationBatchOutcome,
    agentExecutionLogs: agentExecutionResponse.body,
    aiProviderConnections: aiProviderConnectionList,
  };
}

function buildAdminGovernanceLandingOverview(input: {
  aiProviderConnections: SystemSettingsAiProviderConnectionViewModel[];
  modelRegistryEntries: ModelRegistryEntryViewModel[];
  evaluationSuites: EvaluationSuiteViewModel[];
  runtimeBindings: RuntimeBindingViewModel[];
  harnessAdapterHealth: HarnessAdapterHealthViewModel[];
  latestJudgeCalibrationBatchOutcome: HarnessJudgeCalibrationOutcomeViewModel | null;
  qualityPackages: ManuscriptQualityPackageViewModel[];
}): AdminGovernanceLandingOverview {
  const enabledConnections = input.aiProviderConnections.filter(
    (connection) => connection.enabled,
  ).length;
  const prodReadyModels = input.modelRegistryEntries.filter(
    (model) => model.is_prod_allowed,
  ).length;
  const unknownConnections = input.aiProviderConnections.filter(
    (connection) => connection.last_test_status === "unknown",
  );
  const warnings: string[] = [];

  if (input.aiProviderConnections.length === 0) {
    warnings.push("尚未配置 AI 连接，需先在 AI 接入页完成接入。");
  }

  if (unknownConnections.length > 0) {
    warnings.push(`有 ${unknownConnections.length} 个 AI 连接尚未完成连通性测试。`);
  }

  if (input.qualityPackages.every((record) => record.status !== "published")) {
    warnings.push("还没有已发布质量包，Harness 对照结果的落地依据会偏弱。");
  }

  if (
    input.harnessAdapterHealth.some((record) => record.latest_degradation_reason)
  ) {
    warnings.push("Harness 适配器存在降级记录，建议进入 Harness 控制页进一步查看。");
  }

  return {
    aiAccess: {
      totalConnections: input.aiProviderConnections.length,
      enabledConnections,
      prodReadyModels,
      connections: input.aiProviderConnections.map((connection) => ({
        id: connection.id,
        name: connection.name,
        provider_kind: connection.provider_kind,
        compatibility_mode: connection.compatibility_mode,
        enabled: connection.enabled,
        last_test_status: connection.last_test_status,
      })),
    },
    harness: {
      evaluationSuiteCount: input.evaluationSuites.length,
      runtimeBindingCount: input.runtimeBindings.length,
      adapterHealthCount: input.harnessAdapterHealth.length,
      adapterHealth: input.harnessAdapterHealth,
      latestJudgeCalibrationBatchOutcome: input.latestJudgeCalibrationBatchOutcome,
    },
    warnings:
      warnings.length > 0 ? warnings : ["当前没有需要前台立刻处理的全局提醒。"],
  };
}

export async function loadAdminGovernanceExecutionEvidence(
  client: AdminGovernanceHttpClient,
  logId: string,
): Promise<AdminGovernanceExecutionEvidence> {
  const log = (await getAgentExecutionLog(client, logId)).body;
  const [manuscript, manuscriptAssets, verificationEvidenceResults] = await Promise.all([
    loadOptional(() => getManuscript(client, log.manuscript_id).then((response) => response.body)),
    loadOptional(() =>
      listManuscriptAssets(client, log.manuscript_id).then((response) => response.body),
      [] as DocumentAssetViewModel[],
    ),
    Promise.all(
      log.verification_evidence_ids.map(async (evidenceId) => ({
        evidenceId,
        record: await loadOptional(() =>
          getVerificationEvidence(client, evidenceId).then((response) => response.body),
        ),
      })),
    ),
  ]);
  const snapshotId = log.execution_snapshot_id;

  if (!snapshotId) {
    return {
      log,
      manuscript,
      job: null,
      createdAssets: [],
      snapshot: null,
      knowledgeHitLogs: [],
      verificationEvidence: verificationEvidenceResults
        .map((result) => result.record)
        .filter((record): record is VerificationEvidenceViewModel => record != null),
      unresolvedVerificationEvidenceIds: verificationEvidenceResults
        .filter((result) => result.record == null)
        .map((result) => result.evidenceId),
    };
  }

  const [snapshotResponse, knowledgeHitResponse] = await Promise.all([
    getExecutionSnapshot(client, snapshotId),
    listKnowledgeHitLogsBySnapshotId(client, snapshotId),
  ]);
  const snapshot = snapshotResponse.body ?? null;
  const job =
    snapshot == null
      ? null
      : await loadOptional(
          () => getJob(client, snapshot.job_id).then((response) => response.body),
        );

  return {
    log,
    manuscript,
    job,
    createdAssets:
      snapshot == null
        ? []
        : (manuscriptAssets ?? []).filter((asset) =>
            snapshot.created_asset_ids.includes(asset.id),
          ),
    snapshot,
    knowledgeHitLogs: knowledgeHitResponse.body,
    verificationEvidence: verificationEvidenceResults
      .map((result) => result.record)
      .filter((record): record is VerificationEvidenceViewModel => record != null),
    unresolvedVerificationEvidenceIds: verificationEvidenceResults
      .filter((result) => result.record == null)
      .map((result) => result.evidenceId),
  };
}

async function loadOptional<TValue>(
  load: () => Promise<TValue>,
  fallback: TValue | null = null,
): Promise<TValue | null> {
  try {
    return await load();
  } catch {
    return fallback;
  }
}

function resolveSelectedTemplateFamilyId(
  templateFamilies: readonly TemplateFamilyViewModel[],
  requestedId: string | null,
): string | null {
  if (
    requestedId &&
    templateFamilies.some((family) => family.id === requestedId)
  ) {
    return requestedId;
  }

  return templateFamilies[0]?.id ?? null;
}

async function loadHarnessAdapterHealth(
  client: AdminGovernanceHttpClient,
  adapters: readonly HarnessAdapterViewModel[],
): Promise<HarnessAdapterHealthViewModel[]> {
  const executionResponses = await Promise.all(
    adapters.map(async (adapter) => ({
      adapter,
      executions:
        (await loadOptional(
          () =>
            listHarnessExecutionsByAdapterId(client, adapter.id).then(
              (response) => response.body,
            ),
          [] as HarnessExecutionViewModel[],
        )) ?? [],
    })),
  );

  return executionResponses.map(({ adapter, executions }) =>
    buildHarnessAdapterHealth(adapter, executions),
  );
}

function getHarnessScopeEnvironment(
  client: AdminGovernanceHttpClient,
  input: {
    module: ModuleExecutionProfileViewModel["module"];
    manuscriptType: ModuleExecutionProfileViewModel["manuscript_type"];
    templateFamilyId: string;
  },
) {
  return client.request<{ active_environment: HarnessEnvironmentViewModel }>({
    method: "GET",
    url: `/api/v1/harness-control-plane/scopes/${encodeURIComponent(input.module)}/${encodeURIComponent(input.manuscriptType)}/${encodeURIComponent(input.templateFamilyId)}`,
  });
}

function listRetrievalPresetsForScope(
  client: AdminGovernanceHttpClient,
  input: {
    module: ModuleExecutionProfileViewModel["module"];
    manuscriptType: ModuleExecutionProfileViewModel["manuscript_type"];
    templateFamilyId: string;
  },
) {
  return client.request<RetrievalPresetViewModel[]>({
    method: "GET",
    url: `/api/v1/retrieval-presets/by-scope/${encodeURIComponent(input.module)}/${encodeURIComponent(input.manuscriptType)}/${encodeURIComponent(input.templateFamilyId)}`,
  });
}

function listManualReviewPoliciesForScope(
  client: AdminGovernanceHttpClient,
  input: {
    module: ModuleExecutionProfileViewModel["module"];
    manuscriptType: ModuleExecutionProfileViewModel["manuscript_type"];
    templateFamilyId: string;
  },
) {
  return client.request<ManualReviewPolicyViewModel[]>({
    method: "GET",
    url: `/api/v1/manual-review-policies/by-scope/${encodeURIComponent(input.module)}/${encodeURIComponent(input.manuscriptType)}/${encodeURIComponent(input.templateFamilyId)}`,
  });
}

function requestHarnessEnvironmentPreview(
  client: AdminGovernanceHttpClient,
  input: ResolveExecutionBundlePreviewInput,
) {
  return client.request<HarnessEnvironmentPreviewViewModel>({
    method: "POST",
    url: "/api/v1/harness-control-plane/preview",
    body: {
      input: {
        module: input.module,
        manuscriptType: input.manuscriptType,
        templateFamilyId: input.templateFamilyId,
        executionProfileId: input.executionProfileId,
        runtimeBindingId: input.runtimeBindingId,
        modelRoutingPolicyVersionId: input.modelRoutingPolicyVersionId,
        retrievalPresetId: input.retrievalPresetId,
        manualReviewPolicyId: input.manualReviewPolicyId,
      },
    },
  });
}

function requestHarnessEnvironmentActivation(
  client: AdminGovernanceHttpClient,
  input: {
    actorRole: AuthRole;
    input: {
      module: ModuleExecutionProfileViewModel["module"];
      manuscriptType: ModuleExecutionProfileViewModel["manuscript_type"];
      templateFamilyId: string;
      executionProfileId?: string;
      runtimeBindingId?: string;
      modelRoutingPolicyVersionId?: string;
      retrievalPresetId?: string;
      manualReviewPolicyId?: string;
      reason?: string;
    };
  },
) {
  return client.request<HarnessEnvironmentViewModel>({
    method: "POST",
    url: "/api/v1/harness-control-plane/activate",
    body: {
      actorRole: input.actorRole,
      input: input.input,
    },
  });
}

function requestHarnessEnvironmentRollback(
  client: AdminGovernanceHttpClient,
  input: {
    actorRole: AuthRole;
    input: {
      module: ModuleExecutionProfileViewModel["module"];
      manuscriptType: ModuleExecutionProfileViewModel["manuscript_type"];
      templateFamilyId: string;
      reason?: string;
    };
  },
) {
  return client.request<HarnessEnvironmentViewModel>({
    method: "POST",
    url: "/api/v1/harness-control-plane/rollback",
    body: {
      actorRole: input.actorRole,
      input: input.input,
    },
  });
}

function buildHarnessAdapterHealth(
  adapter: HarnessAdapterViewModel,
  executions: readonly HarnessExecutionViewModel[],
): HarnessAdapterHealthViewModel {
  const latestExecution = [...executions].sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  )[0] ?? null;

  return {
    adapter,
    latest_execution: latestExecution,
    latest_status: latestExecution?.status ?? "never_run",
    trace_availability: resolveHarnessTraceAvailability(adapter, latestExecution),
    latest_degradation_reason: latestExecution?.degradation_reason,
  };
}

function resolveHarnessTraceAvailability(
  adapter: HarnessAdapterViewModel,
  latestExecution: HarnessAdapterHealthViewModel["latest_execution"],
): HarnessAdapterHealthViewModel["trace_availability"] {
  if (adapter.kind !== "langfuse_oss") {
    return "not_applicable";
  }

  if (!latestExecution) {
    return "unknown";
  }

  if (latestExecution.status === "succeeded") {
    return "available";
  }

  if (
    latestExecution.degradation_reason === "self-hosted trace sink unavailable" ||
    latestExecution.result_summary?.trace_sink_status === "unavailable"
  ) {
    return "unavailable";
  }

  return "unknown";
}

function selectLatestJudgeCalibrationBatchOutcome(
  records: readonly HarnessAdapterHealthViewModel[],
): HarnessJudgeCalibrationOutcomeViewModel | null {
  const latestRecord = [...records]
    .filter(
      (record) =>
        record.adapter.kind === "judge_reliability_local" &&
        record.latest_execution != null,
    )
    .sort((left, right) =>
      (right.latest_execution?.created_at ?? "").localeCompare(
        left.latest_execution?.created_at ?? "",
      ),
    )[0];
  const latestExecution = latestRecord?.latest_execution;

  if (!latestRecord || !latestExecution) {
    return null;
  }

  return {
    adapter_id: latestRecord.adapter.id,
    execution_id: latestExecution.id,
    status: latestExecution.status,
    exact_match_rate: coerceOptionalNumber(
      latestExecution.result_summary?.exact_match_rate,
    ),
    agreement_count: coerceOptionalNumber(
      latestExecution.result_summary?.agreement_count,
    ),
    disagreement_count: coerceOptionalNumber(
      latestExecution.result_summary?.disagreement_count,
    ),
    created_at: latestExecution.created_at,
  };
}

function coerceOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}
