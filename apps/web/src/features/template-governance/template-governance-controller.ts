import {
  archiveKnowledgeItem,
  createKnowledgeDraft,
  listKnowledgeItems,
  submitKnowledgeForReview,
  updateKnowledgeDraft,
  type CreateKnowledgeDraftInput,
  type KnowledgeHttpClient,
  type KnowledgeItemStatus,
  type KnowledgeItemViewModel,
  type UpdateKnowledgeDraftInput,
} from "../knowledge/index.ts";
import {
  createModuleTemplateDraft,
  createTemplateFamily,
  listModuleTemplatesByTemplateFamilyId,
  listTemplateFamilies,
  publishModuleTemplate,
  updateModuleTemplateDraft,
  updateTemplateFamily,
  type CreateModuleTemplateDraftInput,
  type CreateTemplateFamilyInput,
  type ModuleTemplateViewModel,
  type TemplateFamilyViewModel,
  type TemplateHttpClient,
  type UpdateModuleTemplateDraftInput,
  type UpdateTemplateFamilyInput,
} from "../templates/index.ts";
import type { AuthRole } from "../auth/index.ts";

export interface TemplateGovernanceWorkbenchFilters {
  searchText: string;
  knowledgeStatus: KnowledgeItemStatus | "all";
}

export interface TemplateGovernanceWorkbenchOverview {
  templateFamilies: TemplateFamilyViewModel[];
  selectedTemplateFamilyId: string | null;
  selectedTemplateFamily: TemplateFamilyViewModel | null;
  moduleTemplates: ModuleTemplateViewModel[];
  knowledgeItems: KnowledgeItemViewModel[];
  visibleKnowledgeItems: KnowledgeItemViewModel[];
  boundKnowledgeItems: KnowledgeItemViewModel[];
  selectedKnowledgeItemId: string | null;
  selectedKnowledgeItem: KnowledgeItemViewModel | null;
  filters: TemplateGovernanceWorkbenchFilters;
}

export interface TemplateGovernanceReloadContext {
  selectedTemplateFamilyId?: string | null;
  selectedKnowledgeItemId?: string | null;
  filters?: Partial<TemplateGovernanceWorkbenchFilters>;
}

export interface TemplateGovernanceWorkbenchController {
  loadOverview(
    input?: TemplateGovernanceReloadContext,
  ): Promise<TemplateGovernanceWorkbenchOverview>;
  createTemplateFamilyAndReload(input: CreateTemplateFamilyInput): Promise<{
    templateFamily: TemplateFamilyViewModel;
    overview: TemplateGovernanceWorkbenchOverview;
  }>;
  updateTemplateFamilyAndReload(input: {
    templateFamilyId: string;
    input: UpdateTemplateFamilyInput;
  } & TemplateGovernanceReloadContext): Promise<{
    templateFamily: TemplateFamilyViewModel;
    overview: TemplateGovernanceWorkbenchOverview;
  }>;
  createModuleTemplateDraftAndReload(
    input: CreateModuleTemplateDraftInput & TemplateGovernanceReloadContext,
  ): Promise<{
    moduleTemplate: ModuleTemplateViewModel;
    overview: TemplateGovernanceWorkbenchOverview;
  }>;
  updateModuleTemplateDraftAndReload(input: {
    moduleTemplateId: string;
    input: UpdateModuleTemplateDraftInput;
  } & TemplateGovernanceReloadContext): Promise<{
    moduleTemplate: ModuleTemplateViewModel;
    overview: TemplateGovernanceWorkbenchOverview;
  }>;
  publishModuleTemplateAndReload(input: {
    moduleTemplateId: string;
    actorRole: AuthRole;
  } & TemplateGovernanceReloadContext): Promise<{
    moduleTemplate: ModuleTemplateViewModel;
    overview: TemplateGovernanceWorkbenchOverview;
  }>;
  createKnowledgeDraftAndReload(
    input: CreateKnowledgeDraftInput & TemplateGovernanceReloadContext,
  ): Promise<{
    knowledgeItem: KnowledgeItemViewModel;
    overview: TemplateGovernanceWorkbenchOverview;
  }>;
  updateKnowledgeDraftAndReload(input: {
    knowledgeItemId: string;
    input: UpdateKnowledgeDraftInput;
  } & TemplateGovernanceReloadContext): Promise<{
    knowledgeItem: KnowledgeItemViewModel;
    overview: TemplateGovernanceWorkbenchOverview;
  }>;
  submitKnowledgeDraftAndReload(input: {
    knowledgeItemId: string;
  } & TemplateGovernanceReloadContext): Promise<{
    knowledgeItem: KnowledgeItemViewModel;
    overview: TemplateGovernanceWorkbenchOverview;
  }>;
  archiveKnowledgeItemAndReload(input: {
    knowledgeItemId: string;
  } & TemplateGovernanceReloadContext): Promise<{
    knowledgeItem: KnowledgeItemViewModel;
    overview: TemplateGovernanceWorkbenchOverview;
  }>;
}

type TemplateGovernanceHttpClient = KnowledgeHttpClient & TemplateHttpClient;

export function createTemplateGovernanceWorkbenchController(
  client: TemplateGovernanceHttpClient,
): TemplateGovernanceWorkbenchController {
  return {
    loadOverview(input) {
      return loadTemplateGovernanceOverview(client, input);
    },
    async createTemplateFamilyAndReload(input) {
      const templateFamily = (await createTemplateFamily(client, input)).body;

      return {
        templateFamily,
        overview: await loadTemplateGovernanceOverview(client, {
          selectedTemplateFamilyId: templateFamily.id,
        }),
      };
    },
    async updateTemplateFamilyAndReload(input) {
      const templateFamily = (
        await updateTemplateFamily(client, input.templateFamilyId, input.input)
      ).body;

      return {
        templateFamily,
        overview: await loadTemplateGovernanceOverview(client, {
          selectedTemplateFamilyId:
            input.selectedTemplateFamilyId ?? templateFamily.id,
          selectedKnowledgeItemId: input.selectedKnowledgeItemId,
          filters: input.filters,
        }),
      };
    },
    async createModuleTemplateDraftAndReload(input) {
      const { selectedKnowledgeItemId, selectedTemplateFamilyId, filters, ...draftInput } =
        input;
      const moduleTemplate = (await createModuleTemplateDraft(client, draftInput)).body;

      return {
        moduleTemplate,
        overview: await loadTemplateGovernanceOverview(client, {
          selectedTemplateFamilyId:
            selectedTemplateFamilyId ?? draftInput.templateFamilyId,
          selectedKnowledgeItemId,
          filters,
        }),
      };
    },
    async updateModuleTemplateDraftAndReload(input) {
      const moduleTemplate = (
        await updateModuleTemplateDraft(client, input.moduleTemplateId, input.input)
      ).body;

      return {
        moduleTemplate,
        overview: await loadTemplateGovernanceOverview(client, {
          selectedTemplateFamilyId:
            input.selectedTemplateFamilyId ?? moduleTemplate.template_family_id,
          selectedKnowledgeItemId: input.selectedKnowledgeItemId,
          filters: input.filters,
        }),
      };
    },
    async publishModuleTemplateAndReload(input) {
      const moduleTemplate = (
        await publishModuleTemplate(client, input.moduleTemplateId, input.actorRole)
      ).body;

      return {
        moduleTemplate,
        overview: await loadTemplateGovernanceOverview(client, {
          selectedTemplateFamilyId: input.selectedTemplateFamilyId,
          selectedKnowledgeItemId: input.selectedKnowledgeItemId,
          filters: input.filters,
        }),
      };
    },
    async createKnowledgeDraftAndReload(input) {
      const { selectedKnowledgeItemId, selectedTemplateFamilyId, filters, ...draftInput } =
        input;
      const knowledgeItem = (await createKnowledgeDraft(client, draftInput)).body;

      return {
        knowledgeItem,
        overview: await loadTemplateGovernanceOverview(client, {
          selectedTemplateFamilyId,
          selectedKnowledgeItemId: knowledgeItem.id,
          filters,
        }),
      };
    },
    async updateKnowledgeDraftAndReload(input) {
      const knowledgeItem = (
        await updateKnowledgeDraft(client, input.knowledgeItemId, input.input)
      ).body;

      return {
        knowledgeItem,
        overview: await loadTemplateGovernanceOverview(client, {
          selectedTemplateFamilyId: input.selectedTemplateFamilyId,
          selectedKnowledgeItemId: knowledgeItem.id,
          filters: input.filters,
        }),
      };
    },
    async submitKnowledgeDraftAndReload(input) {
      const knowledgeItem = (
        await submitKnowledgeForReview(client, input.knowledgeItemId)
      ).body;

      return {
        knowledgeItem,
        overview: await loadTemplateGovernanceOverview(client, {
          selectedTemplateFamilyId: input.selectedTemplateFamilyId,
          selectedKnowledgeItemId: knowledgeItem.id,
          filters: input.filters,
        }),
      };
    },
    async archiveKnowledgeItemAndReload(input) {
      const knowledgeItem = (await archiveKnowledgeItem(client, input.knowledgeItemId)).body;

      return {
        knowledgeItem,
        overview: await loadTemplateGovernanceOverview(client, {
          selectedTemplateFamilyId: input.selectedTemplateFamilyId,
          selectedKnowledgeItemId: knowledgeItem.id,
          filters: input.filters,
        }),
      };
    },
  };
}

async function loadTemplateGovernanceOverview(
  client: TemplateGovernanceHttpClient,
  input: TemplateGovernanceReloadContext = {},
): Promise<TemplateGovernanceWorkbenchOverview> {
  const filters = createFilters(input.filters);
  const [templateFamiliesResponse, knowledgeItemsResponse] = await Promise.all([
    listTemplateFamilies(client),
    listKnowledgeItems(client),
  ]);

  const templateFamilies = templateFamiliesResponse.body;
  const knowledgeItems = knowledgeItemsResponse.body;
  const selectedTemplateFamilyId = resolveSelectedId(
    templateFamilies.map((family) => family.id),
    input.selectedTemplateFamilyId,
  );
  const selectedTemplateFamily =
    templateFamilies.find((family) => family.id === selectedTemplateFamilyId) ?? null;
  const moduleTemplates =
    selectedTemplateFamilyId == null
      ? []
      : (
          await listModuleTemplatesByTemplateFamilyId(client, selectedTemplateFamilyId)
        ).body;
  const visibleKnowledgeItems = filterKnowledgeItems(knowledgeItems, filters);
  const boundKnowledgeItems = visibleKnowledgeItems.filter((item) =>
    isKnowledgeItemBoundToFamily(item, selectedTemplateFamilyId, moduleTemplates),
  );
  const selectedKnowledgeItemId = resolveSelectedKnowledgeItemId({
    preferredId: input.selectedKnowledgeItemId,
    visibleKnowledgeItems,
    boundKnowledgeItems,
  });
  const selectedKnowledgeItem =
    visibleKnowledgeItems.find((item) => item.id === selectedKnowledgeItemId) ?? null;

  return {
    templateFamilies,
    selectedTemplateFamilyId,
    selectedTemplateFamily,
    moduleTemplates,
    knowledgeItems,
    visibleKnowledgeItems,
    boundKnowledgeItems,
    selectedKnowledgeItemId,
    selectedKnowledgeItem,
    filters,
  };
}

function createFilters(
  input: Partial<TemplateGovernanceWorkbenchFilters> | undefined,
): TemplateGovernanceWorkbenchFilters {
  return {
    searchText: input?.searchText?.trim() ?? "",
    knowledgeStatus: input?.knowledgeStatus ?? "all",
  };
}

function resolveSelectedId(
  ids: readonly string[],
  preferredId: string | null | undefined,
): string | null {
  if (preferredId && ids.includes(preferredId)) {
    return preferredId;
  }

  return ids[0] ?? null;
}

function filterKnowledgeItems(
  knowledgeItems: readonly KnowledgeItemViewModel[],
  filters: TemplateGovernanceWorkbenchFilters,
): KnowledgeItemViewModel[] {
  const searchNeedle = filters.searchText.toLowerCase();

  return knowledgeItems.filter((item) => {
    if (filters.knowledgeStatus !== "all" && item.status !== filters.knowledgeStatus) {
      return false;
    }

    if (searchNeedle.length === 0) {
      return true;
    }

    const haystacks = [
      item.title,
      item.summary ?? "",
      item.canonical_text,
      item.routing.module_scope,
      ...(item.routing.sections ?? []),
      ...(item.routing.risk_tags ?? []),
      ...(item.routing.discipline_tags ?? []),
      ...(item.aliases ?? []),
      ...(item.template_bindings ?? []),
    ];

    return haystacks.some((value) => value.toLowerCase().includes(searchNeedle));
  });
}

function isKnowledgeItemBoundToFamily(
  item: KnowledgeItemViewModel,
  selectedTemplateFamilyId: string | null,
  moduleTemplates: readonly ModuleTemplateViewModel[],
): boolean {
  if (selectedTemplateFamilyId == null) {
    return false;
  }

  const bindings = new Set(item.template_bindings ?? []);
  if (bindings.has(selectedTemplateFamilyId)) {
    return true;
  }

  return moduleTemplates.some((template) => bindings.has(template.id));
}

function resolveSelectedKnowledgeItemId(input: {
  preferredId: string | null | undefined;
  visibleKnowledgeItems: readonly KnowledgeItemViewModel[];
  boundKnowledgeItems: readonly KnowledgeItemViewModel[];
}): string | null {
  const visibleIds = new Set(input.visibleKnowledgeItems.map((item) => item.id));
  if (input.preferredId && visibleIds.has(input.preferredId)) {
    return input.preferredId;
  }

  return input.boundKnowledgeItems[0]?.id ?? input.visibleKnowledgeItems[0]?.id ?? null;
}
