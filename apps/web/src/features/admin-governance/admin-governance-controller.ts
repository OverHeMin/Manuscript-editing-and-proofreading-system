import {
  createModuleTemplateDraft,
  listModuleTemplatesByTemplateFamilyId,
  listTemplateFamilies,
  publishModuleTemplate,
} from "../templates/index.ts";
import { listPromptTemplates, listSkillPackages } from "../prompt-skill-registry/index.ts";
import type { AuthRole } from "../auth/index.ts";
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
  const [familyResponse, promptResponse, skillResponse] = await Promise.all([
    listTemplateFamilies(client),
    listPromptTemplates(client),
    listSkillPackages(client),
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
