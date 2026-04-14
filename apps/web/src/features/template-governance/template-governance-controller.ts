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
  listLearningCandidates,
  type LearningCandidateViewModel,
  type LearningReviewHttpClient,
} from "../learning-review/index.ts";
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
  compileRulePackagesToDraft as requestCompileRulePackagesToDraft,
  createExtractionTask as requestCreateExtractionTask,
  createRulePackageExampleSourceSession as requestCreateRulePackageExampleSourceSession,
  createEditorialRule,
  createEditorialRuleSet,
  getExtractionTask as requestExtractionTask,
  listEditorialRulesByRuleSetId,
  listEditorialRuleSets,
  listExtractionTasks as requestExtractionTasks,
  loadRulePackageWorkspace as requestRulePackageWorkspace,
  previewRulePackageCompile as requestRulePackageCompilePreview,
  previewRulePackageDraft as requestRulePackagePreview,
  publishEditorialRuleSet,
  updateExtractionTaskCandidate as requestUpdateExtractionTaskCandidate,
  type CompileRulePackagesToDraftInputViewModel,
  type CreateExtractionTaskInputViewModel,
  type CreateEditorialRuleInput,
  type CreateEditorialRuleSetInput,
  type CreateRulePackageExampleSourceSessionInput,
  type EditorialRulesHttpClient,
  type EditorialRuleSetViewModel,
  type EditorialRuleViewModel,
  type ExtractionTaskDetailViewModel,
  type ExtractionTaskViewModel,
  type PreviewCompileRulePackagesInputViewModel,
  type RulePackageCandidateViewModel,
  type RulePackageCompilePreviewViewModel,
  type RulePackageCompileToDraftResultViewModel,
  type RulePackageDraftViewModel,
  type RulePackageExampleSourceSessionViewModel,
  type RulePackagePreviewViewModel,
  type RulePackageWorkspaceSourceInputViewModel,
  type RulePackageWorkspaceViewModel,
  type UpdateExtractionTaskCandidateInputViewModel,
} from "../editorial-rules/index.ts";
import {
  createContentModuleDraft,
  createContentModuleDraftFromCandidate,
  activateJournalTemplateProfile,
  archiveJournalTemplateProfile,
  createTemplateCompositionDraft,
  createTemplateCompositionDraftFromCandidate,
  createJournalTemplateProfile,
  createModuleTemplateDraft,
  createTemplateFamily,
  listContentModules,
  listJournalTemplateProfilesByTemplateFamilyId,
  listModuleTemplatesByTemplateFamilyId,
  listTemplateCompositions,
  listTemplateFamilies,
  publishModuleTemplate,
  updateContentModuleDraft,
  updateModuleTemplateDraft,
  updateTemplateCompositionDraft,
  updateTemplateFamily,
  type CreateContentModuleDraftFromCandidateInput,
  type CreateContentModuleDraftInput,
  type CreateJournalTemplateProfileInput,
  type JournalTemplateProfileViewModel,
  type GovernedContentModuleClass,
  type GovernedContentModuleViewModel,
  type CreateModuleTemplateDraftInput,
  type CreateTemplateCompositionDraftFromCandidateInput,
  type CreateTemplateCompositionDraftInput,
  type CreateTemplateFamilyInput,
  type ModuleTemplateViewModel,
  type TemplateCompositionViewModel,
  type TemplateFamilyViewModel,
  type TemplateHttpClient,
  type UpdateContentModuleDraftInput,
  type UpdateModuleTemplateDraftInput,
  type UpdateTemplateCompositionDraftInput,
  type UpdateTemplateFamilyInput,
} from "../templates/index.ts";
import {
  formatTemplateGovernanceFamilyStatusLabel,
  formatTemplateGovernanceGovernedAssetStatusLabel,
  formatTemplateGovernanceManuscriptTypeLabel,
  formatTemplateGovernanceModuleLabel,
} from "./template-governance-display.ts";
import type {
  TemplateGovernanceRuleLedgerCategory,
  TemplateGovernanceRuleLedgerRow,
  TemplateGovernanceRuleLedgerViewModel,
} from "./template-governance-ledger-types.ts";
import { createTemplateGovernanceRuleLedgerViewModel } from "./template-governance-rule-ledger-state.ts";

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
  loadRuleLedger(input?: {
    category?: TemplateGovernanceRuleLedgerCategory;
    searchQuery?: string;
    selectedRowId?: string | null;
  }): Promise<TemplateGovernanceRuleLedgerViewModel>;
  loadExtractionLedger(input?: {
    selectedTaskId?: string | null;
  }): Promise<TemplateGovernanceExtractionLedgerViewModel>;
  loadContentModuleLedger(input: {
    moduleClass: GovernedContentModuleClass;
    selectedModuleId?: string | null;
  }): Promise<TemplateGovernanceContentModuleLedgerViewModel>;
  loadTemplateLedger(input?: {
    selectedTemplateId?: string | null;
  }): Promise<TemplateGovernanceTemplateLedgerViewModel>;
  loadRulePackageWorkspace(
    input: RulePackageWorkspaceSourceInputViewModel,
  ): Promise<RulePackageWorkspaceViewModel>;
  createExtractionTaskAndReload(input: CreateExtractionTaskInputViewModel): Promise<{
    task: ExtractionTaskDetailViewModel;
    ledger: TemplateGovernanceExtractionLedgerViewModel;
  }>;
  updateExtractionTaskCandidateAndReload(input: {
    taskId: string;
    candidateId: string;
    input: UpdateExtractionTaskCandidateInputViewModel;
  }): Promise<{
    task: ExtractionTaskDetailViewModel;
    ledger: TemplateGovernanceExtractionLedgerViewModel;
  }>;
  createContentModuleDraftAndReload(input: CreateContentModuleDraftInput & {
    selectedModuleId?: string | null;
  }): Promise<{
    contentModule: GovernedContentModuleViewModel;
    ledger: TemplateGovernanceContentModuleLedgerViewModel;
  }>;
  updateContentModuleDraftAndReload(input: {
    contentModuleId: string;
    input: UpdateContentModuleDraftInput;
    moduleClass: GovernedContentModuleClass;
    selectedModuleId?: string | null;
  }): Promise<{
    contentModule: GovernedContentModuleViewModel;
    ledger: TemplateGovernanceContentModuleLedgerViewModel;
  }>;
  createContentModuleDraftFromCandidateAndReload(
    input: CreateContentModuleDraftFromCandidateInput & {
      selectedModuleId?: string | null;
    },
  ): Promise<{
    contentModule: GovernedContentModuleViewModel;
    ledger: TemplateGovernanceContentModuleLedgerViewModel;
  }>;
  createTemplateCompositionDraftAndReload(input: CreateTemplateCompositionDraftInput & {
    selectedTemplateId?: string | null;
  }): Promise<{
    templateComposition: TemplateCompositionViewModel;
    ledger: TemplateGovernanceTemplateLedgerViewModel;
  }>;
  updateTemplateCompositionDraftAndReload(input: {
    templateCompositionId: string;
    input: UpdateTemplateCompositionDraftInput;
    selectedTemplateId?: string | null;
  }): Promise<{
    templateComposition: TemplateCompositionViewModel;
    ledger: TemplateGovernanceTemplateLedgerViewModel;
  }>;
  createTemplateCompositionDraftFromCandidateAndReload(
    input: CreateTemplateCompositionDraftFromCandidateInput & {
      selectedTemplateId?: string | null;
    },
  ): Promise<{
    templateComposition: TemplateCompositionViewModel;
    ledger: TemplateGovernanceTemplateLedgerViewModel;
  }>;
  createRulePackageExampleSourceSession(
    input: CreateRulePackageExampleSourceSessionInput,
  ): Promise<RulePackageExampleSourceSessionViewModel>;
  previewRulePackageDraft(input: {
    packageDraft: RulePackageDraftViewModel | RulePackageCandidateViewModel;
    sampleText: string;
  }): Promise<RulePackagePreviewViewModel>;
  previewRulePackageCompile(
    input: PreviewCompileRulePackagesInputViewModel,
  ): Promise<RulePackageCompilePreviewViewModel>;
  compileRulePackagesToDraft(
    input: CompileRulePackagesToDraftInputViewModel,
  ): Promise<RulePackageCompileToDraftResultViewModel>;
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

export interface TemplateGovernanceExtractionLedgerSummary {
  totalTaskCount: number;
  candidateCount: number;
  awaitingConfirmationCount: number;
}

export interface TemplateGovernanceExtractionLedgerViewModel {
  tasks: ExtractionTaskViewModel[];
  selectedTaskId: string | null;
  selectedTask: ExtractionTaskDetailViewModel | null;
  summary: TemplateGovernanceExtractionLedgerSummary;
}

export interface TemplateGovernanceContentModuleLedgerSummary {
  totalCount: number;
  draftCount: number;
  publishedCount: number;
}

export interface TemplateGovernanceContentModuleLedgerViewModel {
  modules: GovernedContentModuleViewModel[];
  selectedModuleId: string | null;
  selectedModule: GovernedContentModuleViewModel | null;
  summary: TemplateGovernanceContentModuleLedgerSummary;
}

export interface TemplateGovernanceTemplateLedgerSummary {
  templateCount: number;
  draftCount: number;
  publishedCount: number;
}

export interface TemplateGovernanceTemplateLedgerViewModel {
  templates: TemplateCompositionViewModel[];
  generalModules: GovernedContentModuleViewModel[];
  medicalModules: GovernedContentModuleViewModel[];
  selectedTemplateId: string | null;
  selectedTemplate: TemplateCompositionViewModel | null;
  summary: TemplateGovernanceTemplateLedgerSummary;
}

type TemplateGovernanceHttpClient =
  KnowledgeHttpClient &
  TemplateHttpClient &
  KnowledgeRetrievalHttpClient &
  LearningReviewHttpClient &
  PromptSkillRegistryHttpClient &
  EditorialRulesHttpClient;

export function createTemplateGovernanceWorkbenchController(
  client: TemplateGovernanceHttpClient,
): TemplateGovernanceWorkbenchController {
  return {
    loadOverview(input) {
      return loadTemplateGovernanceOverview(client, input);
    },
    loadRuleLedger(input) {
      return loadTemplateGovernanceRuleLedger(client, input);
    },
    loadExtractionLedger(input) {
      return loadTemplateGovernanceExtractionLedger(client, input);
    },
    loadContentModuleLedger(input) {
      return loadTemplateGovernanceContentModuleLedger(client, input);
    },
    loadTemplateLedger(input) {
      return loadTemplateGovernanceTemplateLedger(client, input);
    },
    async loadRulePackageWorkspace(input) {
      return (await requestRulePackageWorkspace(client, input)).body;
    },
    async createExtractionTaskAndReload(input) {
      const task = (await requestCreateExtractionTask(client, input)).body;

      return {
        task,
        ledger: await loadTemplateGovernanceExtractionLedger(client, {
          selectedTaskId: task.id,
        }),
      };
    },
    async updateExtractionTaskCandidateAndReload(input) {
      const task = (
        await requestUpdateExtractionTaskCandidate(
          client,
          input.taskId,
          input.candidateId,
          input.input,
        )
      ).body;

      return {
        task,
        ledger: await loadTemplateGovernanceExtractionLedger(client, {
          selectedTaskId: task.id,
        }),
      };
    },
    async createContentModuleDraftAndReload(input) {
      const { selectedModuleId: _selectedModuleId, ...draftInput } = input;
      const contentModule = (await createContentModuleDraft(client, draftInput)).body;

      return {
        contentModule,
        ledger: await loadTemplateGovernanceContentModuleLedger(client, {
          moduleClass: contentModule.module_class,
          selectedModuleId: contentModule.id,
        }),
      };
    },
    async updateContentModuleDraftAndReload(input) {
      const contentModule = (
        await updateContentModuleDraft(client, input.contentModuleId, input.input)
      ).body;

      return {
        contentModule,
        ledger: await loadTemplateGovernanceContentModuleLedger(client, {
          moduleClass: input.moduleClass,
          selectedModuleId: input.selectedModuleId ?? contentModule.id,
        }),
      };
    },
    async createContentModuleDraftFromCandidateAndReload(input) {
      const { selectedModuleId: _selectedModuleId, ...draftInput } = input;
      const contentModule = (
        await createContentModuleDraftFromCandidate(client, draftInput)
      ).body;

      return {
        contentModule,
        ledger: await loadTemplateGovernanceContentModuleLedger(client, {
          moduleClass: contentModule.module_class,
          selectedModuleId: contentModule.id,
        }),
      };
    },
    async createTemplateCompositionDraftAndReload(input) {
      const { selectedTemplateId: _selectedTemplateId, ...draftInput } = input;
      const templateComposition = (
        await createTemplateCompositionDraft(client, draftInput)
      ).body;

      return {
        templateComposition,
        ledger: await loadTemplateGovernanceTemplateLedger(client, {
          selectedTemplateId: templateComposition.id,
        }),
      };
    },
    async updateTemplateCompositionDraftAndReload(input) {
      const templateComposition = (
        await updateTemplateCompositionDraft(
          client,
          input.templateCompositionId,
          input.input,
        )
      ).body;

      return {
        templateComposition,
        ledger: await loadTemplateGovernanceTemplateLedger(client, {
          selectedTemplateId: input.selectedTemplateId ?? templateComposition.id,
        }),
      };
    },
    async createTemplateCompositionDraftFromCandidateAndReload(input) {
      const { selectedTemplateId: _selectedTemplateId, ...draftInput } = input;
      const templateComposition = (
        await createTemplateCompositionDraftFromCandidate(client, draftInput)
      ).body;

      return {
        templateComposition,
        ledger: await loadTemplateGovernanceTemplateLedger(client, {
          selectedTemplateId: templateComposition.id,
        }),
      };
    },
    async createRulePackageExampleSourceSession(input) {
      return (await requestCreateRulePackageExampleSourceSession(client, input))
        .body;
    },
    async previewRulePackageDraft(input) {
      return (await requestRulePackagePreview(client, input)).body;
    },
    async previewRulePackageCompile(input) {
      return (await requestRulePackageCompilePreview(client, input)).body;
    },
    async compileRulePackagesToDraft(input) {
      return (await requestCompileRulePackagesToDraft(client, input)).body;
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

async function loadTemplateGovernanceRuleLedger(
  client: TemplateGovernanceHttpClient,
  input: {
    category?: TemplateGovernanceRuleLedgerCategory;
    searchQuery?: string;
    selectedRowId?: string | null;
  } = {},
): Promise<TemplateGovernanceRuleLedgerViewModel> {
  const [
    knowledgeItemsResponse,
    templateFamiliesResponse,
    templatesResponse,
    generalModulesResponse,
    medicalModulesResponse,
    learningCandidatesResponse,
  ] = await Promise.all([
    listKnowledgeItems(client),
    listTemplateFamilies(client),
    listTemplateCompositions(client),
    listContentModules(client, "general"),
    listContentModules(client, "medical_specialized"),
    listLearningCandidates(client),
  ]);

  const journalTemplateEntries = (
    await Promise.all(
      templateFamiliesResponse.body.map(async (family) => ({
        family,
        journalTemplates: (
          await listJournalTemplateProfilesByTemplateFamilyId(client, family.id)
        ).body,
      })),
    )
  ).flatMap(({ family, journalTemplates }) =>
    journalTemplates.map((journalTemplate) => ({
      family,
      journalTemplate,
    })),
  );

  const rows = [
    ...knowledgeItemsResponse.body
      .filter((item) => item.knowledge_kind === "rule")
      .map(mapKnowledgeItemToRuleLedgerRow),
    ...templatesResponse.body.map(mapTemplateCompositionToRuleLedgerRow),
    ...journalTemplateEntries.map(({ family, journalTemplate }) =>
      mapJournalTemplateToRuleLedgerRow(journalTemplate, family),
    ),
    ...generalModulesResponse.body.map((module) =>
      mapContentModuleToRuleLedgerRow(module, "general_package"),
    ),
    ...medicalModulesResponse.body.map((module) =>
      mapContentModuleToRuleLedgerRow(module, "medical_package"),
    ),
    ...learningCandidatesResponse.body
      .filter((candidate) => candidate.type === "rule_candidate")
      .map(mapLearningCandidateToRuleLedgerRow),
  ].sort(compareRuleLedgerRowsByUpdatedAt);

  return createTemplateGovernanceRuleLedgerViewModel({
    rows,
    category: input.category,
    searchQuery: input.searchQuery,
    selectedRowId: input.selectedRowId,
  });
}

async function loadTemplateGovernanceExtractionLedger(
  client: TemplateGovernanceHttpClient,
  input: {
    selectedTaskId?: string | null;
  } = {},
): Promise<TemplateGovernanceExtractionLedgerViewModel> {
  const tasks = (await requestExtractionTasks(client)).body;
  const selectedTaskId = resolveSelectedId(
    tasks.map((task) => task.id),
    input.selectedTaskId,
  );
  const selectedTask =
    selectedTaskId == null
      ? null
      : (await requestExtractionTask(client, selectedTaskId)).body;

  return {
    tasks,
    selectedTaskId,
    selectedTask,
    summary: {
      totalTaskCount: tasks.length,
      candidateCount: tasks.reduce(
        (total, task) => total + task.candidate_count,
        0,
      ),
      awaitingConfirmationCount: tasks.reduce(
        (total, task) => total + task.pending_confirmation_count,
        0,
      ),
    },
  };
}

async function loadTemplateGovernanceContentModuleLedger(
  client: TemplateGovernanceHttpClient,
  input: {
    moduleClass: GovernedContentModuleClass;
    selectedModuleId?: string | null;
  },
): Promise<TemplateGovernanceContentModuleLedgerViewModel> {
  const modules = (await listContentModules(client, input.moduleClass)).body;
  const selectedModuleId = resolveSelectedId(
    modules.map((module) => module.id),
    input.selectedModuleId,
  );
  const selectedModule =
    modules.find((module) => module.id === selectedModuleId) ?? null;

  return {
    modules,
    selectedModuleId,
    selectedModule,
    summary: {
      totalCount: modules.length,
      draftCount: modules.filter((module) => module.status === "draft").length,
      publishedCount: modules.filter((module) => module.status === "published")
        .length,
    },
  };
}

async function loadTemplateGovernanceTemplateLedger(
  client: TemplateGovernanceHttpClient,
  input: {
    selectedTemplateId?: string | null;
  } = {},
): Promise<TemplateGovernanceTemplateLedgerViewModel> {
  const [templatesResponse, generalModulesResponse, medicalModulesResponse] =
    await Promise.all([
      listTemplateCompositions(client),
      listContentModules(client, "general"),
      listContentModules(client, "medical_specialized"),
    ]);
  const templates = templatesResponse.body;
  const selectedTemplateId = resolveSelectedId(
    templates.map((template) => template.id),
    input.selectedTemplateId,
  );
  const selectedTemplate =
    templates.find((template) => template.id === selectedTemplateId) ?? null;

  return {
    templates,
    generalModules: generalModulesResponse.body,
    medicalModules: medicalModulesResponse.body,
    selectedTemplateId,
    selectedTemplate,
    summary: {
      templateCount: templates.length,
      draftCount: templates.filter((template) => template.status === "draft")
        .length,
      publishedCount: templates.filter(
        (template) => template.status === "published",
      ).length,
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
      message: "请选择模板族后查看检索质量证据。",
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
          "已有检索质量运行记录，但暂未关联可查看的检索快照摘要。",
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
            ? "最近一次检索质量证据处于当前运营阈值内。"
            : `有 ${signals.length} 条检索质量信号需要复核。`,
      };
    } catch {
      const signals = createRetrievalSignals(latestRun, null);

      return {
        status: "partial",
        latestRun,
        latestSnapshot: null,
        signals,
        message:
          "最近一次检索快照证据暂不可用，但其他规则治理功能仍可正常使用。",
      };
    }
  } catch (error) {
    if (isNotFoundHttpError(error)) {
      return {
        status: "not_started",
        latestRun: null,
        latestSnapshot: null,
        signals: [],
        message: "当前模板族还没有检索质量运行记录。",
      };
    }

    return {
      status: "unavailable",
      latestRun: null,
      latestSnapshot: null,
      signals: [],
      message: "检索质量只读模型暂不可用，但核心规则治理操作仍可继续。",
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
      title: "检索漂移信号",
      body: "最近一次答案相关性或上下文精确率已低于当前运营阈值。",
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
      title: "知识缺口信号",
      body: "召回偏弱，或最近一次检索快照没有返回可供复核的知识条目。",
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

function mapKnowledgeItemToRuleLedgerRow(
  item: KnowledgeItemViewModel,
): TemplateGovernanceRuleLedgerRow {
  return {
    id: item.id,
    asset_kind: "rule",
    title: item.title,
    module_label: formatRuleLedgerModuleLabel(item.routing.module_scope),
    manuscript_type_label: formatRuleLedgerManuscriptTypeLabel(
      item.routing.manuscript_types,
    ),
    semantic_status:
      item.status === "draft" || item.status === "pending_review"
        ? "待确认"
        : "已确认",
    publish_status: formatTemplateGovernanceGovernedAssetStatusLabel(item.status),
    contributor_label: item.source_type ? "知识规则" : "规则中心",
    updated_at: item.effective_at,
  };
}

function mapTemplateCompositionToRuleLedgerRow(
  template: TemplateCompositionViewModel,
): TemplateGovernanceRuleLedgerRow {
  return {
    id: template.id,
    asset_kind: "large_template",
    title: template.name,
    module_label: template.execution_module_scope
      .map((module) => formatTemplateGovernanceModuleLabel(module))
      .join(" / "),
    manuscript_type_label: formatTemplateGovernanceManuscriptTypeLabel(
      template.manuscript_type,
    ),
    semantic_status: "模板已整理",
    publish_status: formatTemplateGovernanceGovernedAssetStatusLabel(template.status),
    contributor_label: "大模板",
    updated_at: template.updated_at,
  };
}

function mapJournalTemplateToRuleLedgerRow(
  journalTemplate: JournalTemplateProfileViewModel,
  family: TemplateFamilyViewModel,
): TemplateGovernanceRuleLedgerRow {
  return {
    id: journalTemplate.id,
    asset_kind: "journal_template",
    title: journalTemplate.journal_name,
    module_label: "期刊模板",
    manuscript_type_label: formatTemplateGovernanceManuscriptTypeLabel(
      family.manuscript_type,
    ),
    semantic_status: "期刊定制",
    publish_status: formatTemplateGovernanceFamilyStatusLabel(journalTemplate.status),
    contributor_label: journalTemplate.journal_key,
  };
}

function mapContentModuleToRuleLedgerRow(
  module: GovernedContentModuleViewModel,
  assetKind: "general_package" | "medical_package",
): TemplateGovernanceRuleLedgerRow {
  return {
    id: module.id,
    asset_kind: assetKind,
    title: module.name,
    module_label: module.execution_module_scope
      .map((executionModule) => formatTemplateGovernanceModuleLabel(executionModule))
      .join(" / "),
    manuscript_type_label: module.manuscript_type_scope
      .map((manuscriptType) => formatTemplateGovernanceManuscriptTypeLabel(manuscriptType))
      .join(" / "),
    semantic_status: module.evidence_level === "unknown" ? "待补证据" : "已沉淀",
    publish_status: formatTemplateGovernanceGovernedAssetStatusLabel(module.status),
    contributor_label: module.category,
    updated_at: module.updated_at,
  };
}

function mapLearningCandidateToRuleLedgerRow(
  candidate: LearningCandidateViewModel,
): TemplateGovernanceRuleLedgerRow {
  return {
    id: candidate.id,
    asset_kind: "recycled_candidate",
    title: candidate.title?.trim() || candidate.proposal_text?.trim() || candidate.id,
    module_label: formatTemplateGovernanceModuleLabel(candidate.module),
    manuscript_type_label: formatTemplateGovernanceManuscriptTypeLabel(
      candidate.manuscript_type,
    ),
    semantic_status: "回流待收编",
    publish_status: formatLearningCandidateStatusLabel(candidate.status),
    contributor_label: candidate.created_by,
    updated_at: candidate.updated_at,
  };
}

function formatRuleLedgerModuleLabel(value: string): string {
  return value === "any" ? "全部模块" : formatTemplateGovernanceModuleLabel(value);
}

function formatRuleLedgerManuscriptTypeLabel(
  value: KnowledgeItemViewModel["routing"]["manuscript_types"],
): string {
  return value === "any"
    ? "全部稿件"
    : value.map((manuscriptType) => formatTemplateGovernanceManuscriptTypeLabel(manuscriptType)).join(" / ");
}

function formatLearningCandidateStatusLabel(value: LearningCandidateViewModel["status"]): string {
  switch (value) {
    case "draft":
      return "草稿";
    case "pending_review":
      return "待审核";
    case "approved":
      return "已通过";
    case "rejected":
      return "已驳回";
    case "archived":
      return "已归档";
    default:
      return value;
  }
}

function compareRuleLedgerRowsByUpdatedAt(
  left: TemplateGovernanceRuleLedgerRow,
  right: TemplateGovernanceRuleLedgerRow,
): number {
  if (left.updated_at == null && right.updated_at == null) {
    return left.title.localeCompare(right.title, "zh-CN");
  }

  if (left.updated_at == null) {
    return 1;
  }

  if (right.updated_at == null) {
    return -1;
  }

  return right.updated_at.localeCompare(left.updated_at);
}
