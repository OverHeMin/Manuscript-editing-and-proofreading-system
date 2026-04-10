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
  ModuleExecutionProfileViewModel,
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
  UpdateModelRoutingPolicyInput,
} from "../model-registry/index.ts";
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
  getVerificationEvidence,
  listEvaluationSuites,
  listReleaseCheckProfiles,
  listVerificationCheckProfiles,
} from "../verification-ops/index.ts";
import { listSystemSettingsAiProviders } from "../system-settings/system-settings-api.ts";
import type {
  EvaluationSuiteViewModel,
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

export interface AdminGovernanceOverview {
  templateFamilies: TemplateFamilyViewModel[];
  selectedTemplateFamilyId: string | null;
  moduleTemplates: ModuleTemplateViewModel[];
  promptTemplates: PromptTemplateViewModel[];
  skillPackages: SkillPackageViewModel[];
  executionProfiles: ModuleExecutionProfileViewModel[];
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
  activateRuntimeBindingAndReload(input: {
    actorRole: AuthRole;
    bindingId: string;
    selectedTemplateFamilyId?: string | null;
  }): Promise<AdminGovernanceOverview>;
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
    async activateRuntimeBindingAndReload(input) {
      await activateRuntimeBinding(client, input.bindingId, {
        actorRole: input.actorRole,
      });
      return loadAdminGovernanceOverview(client, {
        selectedTemplateFamilyId: input.selectedTemplateFamilyId ?? null,
      });
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
    familyResponse,
    promptResponse,
    skillResponse,
    modelRegistryResponse,
    modelRoutingPolicyResponse,
    routingPoliciesResponse,
    executionProfileResponse,
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
    listTemplateFamilies(client),
    listPromptTemplates(client),
    listSkillPackages(client),
    listModelRegistryEntries(client),
    getModelRoutingPolicy(client),
    listModelRoutingPolicies(client),
    listExecutionProfiles(client),
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

  const templateFamilies = familyResponse.body;
  const selectedTemplateFamilyId = resolveSelectedTemplateFamilyId(
    templateFamilies,
    input.selectedTemplateFamilyId ?? null,
  );
  const moduleTemplates =
    selectedTemplateFamilyId == null
      ? []
      : (
          await listModuleTemplatesByTemplateFamilyId(
            client,
            selectedTemplateFamilyId,
          )
        ).body;
  const harnessAdapterHealth = await loadHarnessAdapterHealth(
    client,
    harnessAdapters ?? [],
  );

  return {
    templateFamilies,
    selectedTemplateFamilyId,
    moduleTemplates,
    promptTemplates: promptResponse.body,
    skillPackages: skillResponse.body,
    executionProfiles: executionProfileResponse.body,
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
    latestJudgeCalibrationBatchOutcome:
      selectLatestJudgeCalibrationBatchOutcome(harnessAdapterHealth),
    agentExecutionLogs: agentExecutionResponse.body,
    aiProviderConnections: aiProviderConnections ?? [],
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
