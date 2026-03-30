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
  createModelRegistryEntry,
  getModelRoutingPolicy,
  listModelRegistryEntries,
  updateModelRoutingPolicy,
} from "../model-registry/index.ts";
import {
  createModuleTemplateDraft,
  listModuleTemplatesByTemplateFamilyId,
  listTemplateFamilies,
  publishModuleTemplate,
} from "../templates/index.ts";
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
  ] = await Promise.all([
    listTemplateFamilies(client),
    listPromptTemplates(client),
    listSkillPackages(client),
    listModelRegistryEntries(client),
    getModelRoutingPolicy(client),
    listExecutionProfiles(client),
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
