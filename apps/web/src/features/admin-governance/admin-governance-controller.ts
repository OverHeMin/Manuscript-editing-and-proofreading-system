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
  createModelRegistryEntry,
  getModelRoutingPolicy,
  listModelRegistryEntries,
  updateModelRoutingPolicy,
} from "../model-registry/index.ts";
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
import type { PromptTemplateViewModel, SkillPackageViewModel } from "../prompt-skill-registry/index.ts";
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
  toolGatewayTools: ToolGatewayToolViewModel[];
  sandboxProfiles: SandboxProfileViewModel[];
  agentProfiles: AgentProfileViewModel[];
  agentRuntimes: AgentRuntimeViewModel[];
  toolPermissionPolicies: ToolPermissionPolicyViewModel[];
  runtimeBindings: RuntimeBindingViewModel[];
  agentExecutionLogs: AgentExecutionLogViewModel[];
}

export interface AdminGovernanceExecutionEvidence {
  log: AgentExecutionLogViewModel;
  snapshot: ModuleExecutionSnapshotViewModel | null;
  knowledgeHitLogs: KnowledgeHitLogViewModel[];
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
    executionProfileResponse,
    toolGatewayResponse,
    sandboxProfileResponse,
    agentProfileResponse,
    agentRuntimeResponse,
    toolPermissionPolicyResponse,
    runtimeBindingResponse,
    agentExecutionResponse,
  ] = await Promise.all([
    listTemplateFamilies(client),
    listPromptTemplates(client),
    listSkillPackages(client),
    listModelRegistryEntries(client),
    getModelRoutingPolicy(client),
    listExecutionProfiles(client),
    listToolGatewayTools(client),
    listSandboxProfiles(client),
    listAgentProfiles(client),
    listAgentRuntimes(client),
    listToolPermissionPolicies(client),
    listRuntimeBindings(client),
    listAgentExecutionLogs(client),
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

  return {
    templateFamilies,
    selectedTemplateFamilyId,
    moduleTemplates,
    promptTemplates: promptResponse.body,
    skillPackages: skillResponse.body,
    executionProfiles: executionProfileResponse.body,
    modelRegistryEntries: modelRegistryResponse.body,
    modelRoutingPolicy: modelRoutingPolicyResponse.body,
    toolGatewayTools: toolGatewayResponse.body,
    sandboxProfiles: sandboxProfileResponse.body,
    agentProfiles: agentProfileResponse.body,
    agentRuntimes: agentRuntimeResponse.body,
    toolPermissionPolicies: toolPermissionPolicyResponse.body,
    runtimeBindings: runtimeBindingResponse.body,
    agentExecutionLogs: agentExecutionResponse.body,
  };
}

export async function loadAdminGovernanceExecutionEvidence(
  client: AdminGovernanceHttpClient,
  logId: string,
): Promise<AdminGovernanceExecutionEvidence> {
  const log = (await getAgentExecutionLog(client, logId)).body;
  const snapshotId = log.execution_snapshot_id;

  if (!snapshotId) {
    return {
      log,
      snapshot: null,
      knowledgeHitLogs: [],
    };
  }

  const [snapshotResponse, knowledgeHitResponse] = await Promise.all([
    getExecutionSnapshot(client, snapshotId),
    listKnowledgeHitLogsBySnapshotId(client, snapshotId),
  ]);

  return {
    log,
    snapshot: snapshotResponse.body ?? null,
    knowledgeHitLogs: knowledgeHitResponse.body,
  };
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
