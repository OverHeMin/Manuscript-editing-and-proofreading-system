import { BrowserHttpClientError } from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/index.ts";
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
  getLatestTemplateFamilyRetrievalQualityRun,
  getRetrievalSnapshot,
  type KnowledgeRetrievalHttpClient,
  type KnowledgeRetrievalQualityRunViewModel,
  type KnowledgeRetrievalSnapshotViewModel,
  type TemplateFamilyRetrievalInsightsViewModel,
  type TemplateFamilyRetrievalSignalViewModel,
  type TemplateFamilyRetrievalSnapshotSummaryViewModel,
} from "../knowledge-retrieval/index.ts";
import {
  createPromptTemplate,
  listPromptTemplates,
  publishPromptTemplate,
  type CreatePromptTemplateInput,
  type PromptSkillRegistryHttpClient,
  type PromptTemplateViewModel,
} from "../prompt-skill-registry/index.ts";
import {
  createEditorialRule,
  createEditorialRuleSet,
  listEditorialRulesByRuleSetId,
  listEditorialRuleSets,
  publishEditorialRuleSet,
  type CreateEditorialRuleInput,
  type CreateEditorialRuleSetInput,
  type EditorialRulesHttpClient,
  type EditorialRuleSetViewModel,
  type EditorialRuleViewModel,
} from "../editorial-rules/index.ts";
import {
  activateJournalTemplateProfile,
  archiveJournalTemplateProfile,
  createJournalTemplateProfile,
  createModuleTemplateDraft,
  createTemplateFamily,
  listJournalTemplateProfilesByTemplateFamilyId,
  listModuleTemplatesByTemplateFamilyId,
  listTemplateFamilies,
  publishModuleTemplate,
  updateModuleTemplateDraft,
  updateTemplateFamily,
  type CreateJournalTemplateProfileInput,
  type JournalTemplateProfileViewModel,
  type CreateModuleTemplateDraftInput,
  type CreateTemplateFamilyInput,
  type ModuleTemplateViewModel,
  type TemplateFamilyViewModel,
  type TemplateHttpClient,
  type UpdateModuleTemplateDraftInput,
  type UpdateTemplateFamilyInput,
} from "../templates/index.ts";

export interface TemplateGovernanceWorkbenchFilters {
  searchText: string;
  knowledgeStatus: KnowledgeItemStatus | "all";
}

export interface TemplateGovernanceWorkbenchOverview {
  templateFamilies: TemplateFamilyViewModel[];
  selectedTemplateFamilyId: string | null;
  selectedTemplateFamily: TemplateFamilyViewModel | null;
  journalTemplateProfiles: JournalTemplateProfileViewModel[];
  selectedJournalTemplateId: string | null;
  selectedJournalTemplateProfile: JournalTemplateProfileViewModel | null;
  moduleTemplates: ModuleTemplateViewModel[];
  ruleSets: EditorialRuleSetViewModel[];
  selectedRuleSetId: string | null;
  selectedRuleSet: EditorialRuleSetViewModel | null;
  rules: EditorialRuleViewModel[];
  instructionTemplates: PromptTemplateViewModel[];
  selectedInstructionTemplateId: string | null;
  selectedInstructionTemplate: PromptTemplateViewModel | null;
  retrievalInsights: TemplateFamilyRetrievalInsightsViewModel;
  knowledgeItems: KnowledgeItemViewModel[];
  visibleKnowledgeItems: KnowledgeItemViewModel[];
  boundKnowledgeItems: KnowledgeItemViewModel[];
  selectedKnowledgeItemId: string | null;
  selectedKnowledgeItem: KnowledgeItemViewModel | null;
  filters: TemplateGovernanceWorkbenchFilters;
}

export interface TemplateGovernanceReloadContext {
  selectedTemplateFamilyId?: string | null;
  selectedJournalTemplateId?: string | null;
  selectedRuleSetId?: string | null;
  selectedInstructionTemplateId?: string | null;
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
  createJournalTemplateProfileAndReload(
    input: CreateJournalTemplateProfileInput & TemplateGovernanceReloadContext,
  ): Promise<{
    journalTemplateProfile: JournalTemplateProfileViewModel;
    overview: TemplateGovernanceWorkbenchOverview;
  }>;
  activateJournalTemplateProfileAndReload(input: {
    journalTemplateProfileId: string;
    actorRole: AuthRole;
  } & TemplateGovernanceReloadContext): Promise<{
    journalTemplateProfile: JournalTemplateProfileViewModel;
    overview: TemplateGovernanceWorkbenchOverview;
  }>;
  archiveJournalTemplateProfileAndReload(input: {
    journalTemplateProfileId: string;
    actorRole: AuthRole;
  } & TemplateGovernanceReloadContext): Promise<{
    journalTemplateProfile: JournalTemplateProfileViewModel;
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
  createRuleSetAndReload(
    input: CreateEditorialRuleSetInput & TemplateGovernanceReloadContext,
  ): Promise<{
    ruleSet: EditorialRuleSetViewModel;
    overview: TemplateGovernanceWorkbenchOverview;
  }>;
  createRuleAndReload(input: {
    ruleSetId: string;
    input: CreateEditorialRuleInput;
  } & TemplateGovernanceReloadContext): Promise<{
    rule: EditorialRuleViewModel;
    overview: TemplateGovernanceWorkbenchOverview;
  }>;
  publishRuleSetAndReload(input: {
    ruleSetId: string;
    actorRole: AuthRole;
  } & TemplateGovernanceReloadContext): Promise<{
    ruleSet: EditorialRuleSetViewModel;
    overview: TemplateGovernanceWorkbenchOverview;
  }>;
  createInstructionTemplateAndReload(
    input: CreatePromptTemplateInput & TemplateGovernanceReloadContext,
  ): Promise<{
    instructionTemplate: PromptTemplateViewModel;
    overview: TemplateGovernanceWorkbenchOverview;
  }>;
  publishInstructionTemplateAndReload(input: {
    promptTemplateId: string;
    actorRole: AuthRole;
  } & TemplateGovernanceReloadContext): Promise<{
    instructionTemplate: PromptTemplateViewModel;
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

type TemplateGovernanceHttpClient =
  KnowledgeHttpClient &
  TemplateHttpClient &
  KnowledgeRetrievalHttpClient &
  PromptSkillRegistryHttpClient &
  EditorialRulesHttpClient;

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
          selectedRuleSetId: input.selectedRuleSetId,
          selectedInstructionTemplateId: input.selectedInstructionTemplateId,
          selectedKnowledgeItemId: input.selectedKnowledgeItemId,
          filters: input.filters,
        }),
      };
    },
    async createModuleTemplateDraftAndReload(input) {
      const {
        selectedJournalTemplateId,
        selectedKnowledgeItemId,
        selectedInstructionTemplateId,
        selectedRuleSetId,
        selectedTemplateFamilyId,
        filters,
        ...draftInput
      } = input;
      const moduleTemplate = (await createModuleTemplateDraft(client, draftInput)).body;

      return {
        moduleTemplate,
        overview: await loadTemplateGovernanceOverview(client, {
          selectedTemplateFamilyId:
            selectedTemplateFamilyId ?? draftInput.templateFamilyId,
          selectedJournalTemplateId,
          selectedRuleSetId,
          selectedInstructionTemplateId,
          selectedKnowledgeItemId,
          filters,
        }),
      };
    },
    async createJournalTemplateProfileAndReload(input) {
      const {
        selectedRuleSetId,
        selectedInstructionTemplateId,
        selectedKnowledgeItemId,
        selectedTemplateFamilyId,
        filters,
        ...journalTemplateInput
      } = input;
      const journalTemplateProfile = (
        await createJournalTemplateProfile(client, journalTemplateInput)
      ).body;

      return {
        journalTemplateProfile,
        overview: await loadTemplateGovernanceOverview(client, {
          selectedTemplateFamilyId:
            selectedTemplateFamilyId ?? journalTemplateInput.templateFamilyId,
          selectedJournalTemplateId: journalTemplateProfile.id,
          selectedRuleSetId,
          selectedInstructionTemplateId,
          selectedKnowledgeItemId,
          filters,
        }),
      };
    },
    async activateJournalTemplateProfileAndReload(input) {
      const journalTemplateProfile = (
        await activateJournalTemplateProfile(
          client,
          input.journalTemplateProfileId,
          input.actorRole,
        )
      ).body;

      return {
        journalTemplateProfile,
        overview: await loadTemplateGovernanceOverview(client, {
          selectedTemplateFamilyId:
            input.selectedTemplateFamilyId ?? journalTemplateProfile.template_family_id,
          selectedJournalTemplateId:
            input.selectedJournalTemplateId ?? journalTemplateProfile.id,
          selectedRuleSetId: input.selectedRuleSetId,
          selectedInstructionTemplateId: input.selectedInstructionTemplateId,
          selectedKnowledgeItemId: input.selectedKnowledgeItemId,
          filters: input.filters,
        }),
      };
    },
    async archiveJournalTemplateProfileAndReload(input) {
      const journalTemplateProfile = (
        await archiveJournalTemplateProfile(
          client,
          input.journalTemplateProfileId,
          input.actorRole,
        )
      ).body;

      return {
        journalTemplateProfile,
        overview: await loadTemplateGovernanceOverview(client, {
          selectedTemplateFamilyId:
            input.selectedTemplateFamilyId ?? journalTemplateProfile.template_family_id,
          selectedJournalTemplateId: null,
          selectedRuleSetId: input.selectedRuleSetId,
          selectedInstructionTemplateId: input.selectedInstructionTemplateId,
          selectedKnowledgeItemId: input.selectedKnowledgeItemId,
          filters: input.filters,
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
          selectedJournalTemplateId: input.selectedJournalTemplateId,
          selectedRuleSetId: input.selectedRuleSetId,
          selectedInstructionTemplateId: input.selectedInstructionTemplateId,
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
          selectedTemplateFamilyId:
            input.selectedTemplateFamilyId ?? moduleTemplate.template_family_id,
          selectedJournalTemplateId: input.selectedJournalTemplateId,
          selectedRuleSetId: input.selectedRuleSetId,
          selectedInstructionTemplateId: input.selectedInstructionTemplateId,
          selectedKnowledgeItemId: input.selectedKnowledgeItemId,
          filters: input.filters,
        }),
      };
    },
    async createRuleSetAndReload(input) {
      const {
        selectedJournalTemplateId,
        selectedKnowledgeItemId,
        selectedInstructionTemplateId,
        selectedRuleSetId: _selectedRuleSetId,
        selectedTemplateFamilyId,
        filters,
        ...ruleSetInput
      } = input;
      const ruleSet = (await createEditorialRuleSet(client, ruleSetInput)).body;

      return {
        ruleSet,
        overview: await loadTemplateGovernanceOverview(client, {
          selectedTemplateFamilyId:
            selectedTemplateFamilyId ?? ruleSet.template_family_id,
          selectedJournalTemplateId:
            ruleSet.journal_template_id ?? selectedJournalTemplateId ?? null,
          selectedRuleSetId: ruleSet.id,
          selectedInstructionTemplateId,
          selectedKnowledgeItemId,
          filters,
        }),
      };
    },
    async createRuleAndReload(input) {
      const rule = (await createEditorialRule(client, input.ruleSetId, input.input)).body;

      return {
        rule,
        overview: await loadTemplateGovernanceOverview(client, {
          selectedTemplateFamilyId: input.selectedTemplateFamilyId,
          selectedJournalTemplateId: input.selectedJournalTemplateId,
          selectedRuleSetId: input.selectedRuleSetId ?? rule.rule_set_id,
          selectedInstructionTemplateId: input.selectedInstructionTemplateId,
          selectedKnowledgeItemId: input.selectedKnowledgeItemId,
          filters: input.filters,
        }),
      };
    },
    async publishRuleSetAndReload(input) {
      const ruleSet = (
        await publishEditorialRuleSet(client, input.ruleSetId, {
          actorRole: input.actorRole,
        })
      ).body;

      return {
        ruleSet,
        overview: await loadTemplateGovernanceOverview(client, {
          selectedTemplateFamilyId:
            input.selectedTemplateFamilyId ?? ruleSet.template_family_id,
          selectedJournalTemplateId:
            ruleSet.journal_template_id ?? input.selectedJournalTemplateId ?? null,
          selectedRuleSetId: input.selectedRuleSetId ?? ruleSet.id,
          selectedInstructionTemplateId: input.selectedInstructionTemplateId,
          selectedKnowledgeItemId: input.selectedKnowledgeItemId,
          filters: input.filters,
        }),
      };
    },
    async createInstructionTemplateAndReload(input) {
      const {
        selectedJournalTemplateId,
        selectedKnowledgeItemId,
        selectedInstructionTemplateId: _selectedInstructionTemplateId,
        selectedRuleSetId,
        selectedTemplateFamilyId,
        filters,
        ...instructionInput
      } = input;
      const instructionTemplate = (
        await createPromptTemplate(client, instructionInput)
      ).body;

      return {
        instructionTemplate,
        overview: await loadTemplateGovernanceOverview(client, {
          selectedTemplateFamilyId,
          selectedJournalTemplateId,
          selectedRuleSetId,
          selectedInstructionTemplateId: instructionTemplate.id,
          selectedKnowledgeItemId,
          filters,
        }),
      };
    },
    async publishInstructionTemplateAndReload(input) {
      const instructionTemplate = (
        await publishPromptTemplate(client, input.promptTemplateId, {
          actorRole: input.actorRole,
        })
      ).body;

      return {
        instructionTemplate,
        overview: await loadTemplateGovernanceOverview(client, {
          selectedTemplateFamilyId: input.selectedTemplateFamilyId,
          selectedJournalTemplateId: input.selectedJournalTemplateId,
          selectedRuleSetId: input.selectedRuleSetId,
          selectedInstructionTemplateId:
            input.selectedInstructionTemplateId ?? instructionTemplate.id,
          selectedKnowledgeItemId: input.selectedKnowledgeItemId,
          filters: input.filters,
        }),
      };
    },
    async createKnowledgeDraftAndReload(input) {
      const {
        selectedJournalTemplateId,
        selectedInstructionTemplateId,
        selectedKnowledgeItemId,
        selectedRuleSetId,
        selectedTemplateFamilyId,
        filters,
        ...draftInput
      } = input;
      const knowledgeItem = (await createKnowledgeDraft(client, draftInput)).body;

      return {
        knowledgeItem,
        overview: await loadTemplateGovernanceOverview(client, {
          selectedTemplateFamilyId,
          selectedJournalTemplateId,
          selectedRuleSetId,
          selectedInstructionTemplateId,
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
          selectedJournalTemplateId: input.selectedJournalTemplateId,
          selectedRuleSetId: input.selectedRuleSetId,
          selectedInstructionTemplateId: input.selectedInstructionTemplateId,
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
          selectedJournalTemplateId: input.selectedJournalTemplateId,
          selectedRuleSetId: input.selectedRuleSetId,
          selectedInstructionTemplateId: input.selectedInstructionTemplateId,
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
          selectedJournalTemplateId: input.selectedJournalTemplateId,
          selectedRuleSetId: input.selectedRuleSetId,
          selectedInstructionTemplateId: input.selectedInstructionTemplateId,
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
  const [
    templateFamiliesResponse,
    knowledgeItemsResponse,
    ruleSetsResponse,
    promptTemplatesResponse,
  ] = await Promise.all([
    listTemplateFamilies(client),
    listKnowledgeItems(client),
    listEditorialRuleSets(client),
    listPromptTemplates(client),
  ]);

  const templateFamilies = templateFamiliesResponse.body;
  const knowledgeItems = knowledgeItemsResponse.body;
  const selectedTemplateFamilyId = resolveSelectedId(
    templateFamilies.map((family) => family.id),
    input.selectedTemplateFamilyId,
  );
  const selectedTemplateFamily =
    templateFamilies.find((family) => family.id === selectedTemplateFamilyId) ?? null;
  const journalTemplateProfiles =
    selectedTemplateFamilyId == null
      ? []
      : (
          await listJournalTemplateProfilesByTemplateFamilyId(
            client,
            selectedTemplateFamilyId,
          )
        ).body;
  const moduleTemplates =
    selectedTemplateFamilyId == null
      ? []
      : (
          await listModuleTemplatesByTemplateFamilyId(client, selectedTemplateFamilyId)
        ).body;
  const familyRuleSets =
    selectedTemplateFamilyId == null
      ? []
      : ruleSetsResponse.body.filter(
          (ruleSet) => ruleSet.template_family_id === selectedTemplateFamilyId,
        );
  const selectedJournalTemplateId = resolveSelectedJournalTemplateId({
    preferredJournalTemplateId: input.selectedJournalTemplateId,
    preferredRuleSetId: input.selectedRuleSetId,
    journalTemplateProfiles,
    familyRuleSets,
  });
  const selectedJournalTemplateProfile =
    journalTemplateProfiles.find((profile) => profile.id === selectedJournalTemplateId) ?? null;
  const ruleSets = familyRuleSets.filter((ruleSet) =>
    selectedJournalTemplateId == null
      ? ruleSet.journal_template_id == null
      : ruleSet.journal_template_id === selectedJournalTemplateId,
  );
  const selectedRuleSetId = resolveSelectedId(
    ruleSets.map((ruleSet) => ruleSet.id),
    input.selectedRuleSetId,
  );
  const selectedRuleSet =
    ruleSets.find((ruleSet) => ruleSet.id === selectedRuleSetId) ?? null;
  const rules =
    selectedRuleSetId == null
      ? []
      : (await listEditorialRulesByRuleSetId(client, selectedRuleSetId)).body;
  const instructionTemplates = filterInstructionTemplates(
    promptTemplatesResponse.body,
    selectedTemplateFamily,
  );
  const selectedInstructionTemplateId = resolveSelectedId(
    instructionTemplates.map((template) => template.id),
    input.selectedInstructionTemplateId,
  );
  const selectedInstructionTemplate =
    instructionTemplates.find(
      (template) => template.id === selectedInstructionTemplateId,
    ) ?? null;
  const retrievalInsights = await loadTemplateFamilyRetrievalInsights(
    client,
    selectedTemplateFamilyId,
  );
  const visibleKnowledgeItems = filterKnowledgeItems(knowledgeItems, filters);
  const boundKnowledgeItems = visibleKnowledgeItems.filter((item) =>
    isKnowledgeItemBoundToFamily(
      item,
      selectedTemplateFamilyId,
      moduleTemplates,
      selectedJournalTemplateId,
    ),
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
    journalTemplateProfiles,
    selectedJournalTemplateId,
    selectedJournalTemplateProfile,
    moduleTemplates,
    ruleSets,
    selectedRuleSetId,
    selectedRuleSet,
    rules,
    instructionTemplates,
    selectedInstructionTemplateId,
    selectedInstructionTemplate,
    retrievalInsights,
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

function filterInstructionTemplates(
  templates: readonly PromptTemplateViewModel[],
  selectedTemplateFamily: TemplateFamilyViewModel | null,
): PromptTemplateViewModel[] {
  if (!selectedTemplateFamily) {
    return [];
  }

  return templates.filter((template) => {
    if (
      template.template_kind !== "editing_instruction" &&
      template.template_kind !== "proofreading_instruction"
    ) {
      return false;
    }

    return template.manuscript_types === "any"
      ? true
      : template.manuscript_types.includes(selectedTemplateFamily.manuscript_type);
  });
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
  selectedJournalTemplateId: string | null,
): boolean {
  if (selectedTemplateFamilyId == null) {
    return false;
  }

  const bindings = new Set(item.template_bindings ?? []);
  if (bindings.has(selectedTemplateFamilyId)) {
    return true;
  }
  if (
    selectedJournalTemplateId != null &&
    bindings.has(`journal:${selectedJournalTemplateId}`)
  ) {
    return true;
  }

  return moduleTemplates.some((template) => bindings.has(template.id));
}

function resolveSelectedJournalTemplateId(input: {
  preferredJournalTemplateId: string | null | undefined;
  preferredRuleSetId: string | null | undefined;
  journalTemplateProfiles: readonly JournalTemplateProfileViewModel[];
  familyRuleSets: readonly EditorialRuleSetViewModel[];
}): string | null {
  const journalTemplateIds = new Set(
    input.journalTemplateProfiles.map((profile) => profile.id),
  );

  if (input.preferredRuleSetId) {
    const preferredRuleSet = input.familyRuleSets.find(
      (ruleSet) => ruleSet.id === input.preferredRuleSetId,
    );
    if (preferredRuleSet) {
      return preferredRuleSet.journal_template_id ?? null;
    }
  }

  if (
    input.preferredJournalTemplateId &&
    journalTemplateIds.has(input.preferredJournalTemplateId)
  ) {
    return input.preferredJournalTemplateId;
  }

  if (input.preferredJournalTemplateId === null) {
    return null;
  }

  return null;
}

function resolveSelectedKnowledgeItemId(input: {
  preferredId: string | null | undefined;
  visibleKnowledgeItems: readonly KnowledgeItemViewModel[];
  boundKnowledgeItems: readonly KnowledgeItemViewModel[];
}): string | null {
  if (input.preferredId === null) {
    return input.boundKnowledgeItems[0]?.id ?? null;
  }

  const visibleIds = new Set(input.visibleKnowledgeItems.map((item) => item.id));
  if (input.preferredId && visibleIds.has(input.preferredId)) {
    return input.preferredId;
  }

  return input.boundKnowledgeItems[0]?.id ?? input.visibleKnowledgeItems[0]?.id ?? null;
}

async function loadTemplateFamilyRetrievalInsights(
  client: TemplateGovernanceHttpClient,
  templateFamilyId: string | null,
): Promise<TemplateFamilyRetrievalInsightsViewModel> {
  if (templateFamilyId == null) {
    return {
      status: "idle",
      latestRun: null,
      latestSnapshot: null,
      signals: [],
      message: "Select a template family to inspect retrieval quality evidence.",
    };
  }

  try {
    const latestRun = (
      await getLatestTemplateFamilyRetrievalQualityRun(client, templateFamilyId)
    ).body;
    const latestSnapshotId =
      latestRun.retrieval_snapshot_ids.at(-1) ?? latestRun.retrieval_snapshot_ids[0];
    if (!latestSnapshotId) {
      const signals = createRetrievalSignals(latestRun, null);

      return {
        status: "partial",
        latestRun,
        latestSnapshot: null,
        signals,
        message:
          "A retrieval-quality run exists, but it does not expose a linked retrieval snapshot summary yet.",
      };
    }

    try {
      const latestSnapshot = (await getRetrievalSnapshot(client, latestSnapshotId)).body;
      const latestSnapshotSummary = summarizeRetrievalSnapshot(latestSnapshot);
      const signals = createRetrievalSignals(latestRun, latestSnapshotSummary);

      return {
        status: "available",
        latestRun,
        latestSnapshot: latestSnapshotSummary,
        signals,
        message:
          signals.length === 0
            ? "Latest retrieval-quality evidence is within the current operator thresholds."
            : `${signals.length} retrieval-quality signal(s) need operator review.`,
      };
    } catch {
      const signals = createRetrievalSignals(latestRun, null);

      return {
        status: "partial",
        latestRun,
        latestSnapshot: null,
        signals,
        message:
          "Latest retrieval snapshot evidence is unavailable, but the rest of template governance remains usable.",
      };
    }
  } catch (error) {
    if (isNotFoundHttpError(error)) {
      return {
        status: "not_started",
        latestRun: null,
        latestSnapshot: null,
        signals: [],
        message:
          "No retrieval-quality run has been recorded for this template family yet.",
      };
    }

    return {
      status: "unavailable",
      latestRun: null,
      latestSnapshot: null,
      signals: [],
      message:
        "Retrieval-quality read models are unavailable right now. Core template governance actions remain available.",
    };
  }
}

function summarizeRetrievalSnapshot(
  snapshot: KnowledgeRetrievalSnapshotViewModel,
): TemplateFamilyRetrievalSnapshotSummaryViewModel {
  const rankedItems =
    snapshot.reranked_items.length > 0 ? snapshot.reranked_items : snapshot.retrieved_items;

  return {
    id: snapshot.id,
    query_text: snapshot.query_text,
    retrieved_count: snapshot.retrieved_items.length,
    reranked_count: snapshot.reranked_items.length,
    top_knowledge_item_ids: rankedItems
      .slice(0, 3)
      .map((item) => item.knowledge_item_id),
    created_at: snapshot.created_at,
  };
}

function createRetrievalSignals(
  latestRun: KnowledgeRetrievalQualityRunViewModel,
  latestSnapshot: TemplateFamilyRetrievalSnapshotSummaryViewModel | null,
): TemplateFamilyRetrievalSignalViewModel[] {
  const signals: TemplateFamilyRetrievalSignalViewModel[] = [];
  const metricSummary = latestRun.metric_summary;

  if (
    metricSummary.answer_relevancy < 0.85 ||
    (metricSummary.context_precision != null &&
      metricSummary.context_precision < 0.75)
  ) {
    signals.push({
      kind: "retrieval_drift",
      severity: "warning",
      title: "Retrieval drift signal",
      body:
        "Latest answer relevancy or context precision has dropped below the current operator threshold.",
      evidence: {
        retrieval_run_id: latestRun.id,
        retrieval_snapshot_id: latestSnapshot?.id,
      },
    });
  }

  if (
    (metricSummary.context_recall != null && metricSummary.context_recall < 0.75) ||
    latestSnapshot?.retrieved_count === 0
  ) {
    signals.push({
      kind: "missing_knowledge",
      severity: "warning",
      title: "Missing knowledge signal",
      body:
        "Recall is weak or the latest retrieval snapshot returned no grounded knowledge items for review.",
      evidence: {
        retrieval_run_id: latestRun.id,
        retrieval_snapshot_id: latestSnapshot?.id,
      },
    });
  }

  return signals;
}

function isNotFoundHttpError(error: unknown): boolean {
  return error instanceof BrowserHttpClientError && error.status === 404;
}
