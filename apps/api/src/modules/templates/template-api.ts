import type { RoleKey } from "../../users/roles.ts";
import { TemplateGovernanceService } from "./template-governance-service.ts";
import type {
  CreateContentModuleDraftFromCandidateInput,
  CreateContentModuleDraftInput,
  CreateJournalTemplateProfileInput,
  CreateTemplateCompositionDraftFromCandidateInput,
  CreateTemplateCompositionDraftInput,
  CreateTemplateRetrievalQualityRunInput,
  CreateModuleTemplateDraftInput,
  CreateTemplateFamilyInput,
  UpdateContentModuleDraftInput,
  UpdateModuleTemplateDraftInput,
  UpdateTemplateCompositionDraftInput,
  UpdateTemplateFamilyInput,
} from "./template-governance-service.ts";
import type { KnowledgeRetrievalQualityRunRecord } from "../knowledge-retrieval/knowledge-retrieval-record.ts";
import type {
  GovernedContentModuleRecord,
  JournalTemplateProfileRecord,
  ModuleTemplateRecord,
  TemplateCompositionRecord,
  TemplateFamilyRecord,
} from "./template-record.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateTemplateApiOptions {
  templateService: TemplateGovernanceService;
}

export function createTemplateApi(options: CreateTemplateApiOptions) {
  const { templateService } = options;

  return {
    async createTemplateFamily(
      input: CreateTemplateFamilyInput,
    ): Promise<RouteResponse<TemplateFamilyRecord>> {
      return {
        status: 201,
        body: await templateService.createTemplateFamily(input),
      };
    },

    async createModuleTemplateDraft(
      input: CreateModuleTemplateDraftInput,
    ): Promise<RouteResponse<ModuleTemplateRecord>> {
      return {
        status: 201,
        body: await templateService.createModuleTemplateDraft(input),
      };
    },

    async createContentModuleDraft(
      input: CreateContentModuleDraftInput,
    ): Promise<RouteResponse<GovernedContentModuleRecord>> {
      return {
        status: 201,
        body: await templateService.createContentModuleDraft(input),
      };
    },

    async createContentModuleDraftFromCandidate(
      input: CreateContentModuleDraftFromCandidateInput,
    ): Promise<RouteResponse<GovernedContentModuleRecord>> {
      return {
        status: 201,
        body: await templateService.createContentModuleDraftFromCandidate(input),
      };
    },

    async createTemplateCompositionDraft(
      input: CreateTemplateCompositionDraftInput,
    ): Promise<RouteResponse<TemplateCompositionRecord>> {
      return {
        status: 201,
        body: await templateService.createTemplateCompositionDraft(input),
      };
    },

    async createTemplateCompositionDraftFromCandidate(
      input: CreateTemplateCompositionDraftFromCandidateInput,
    ): Promise<RouteResponse<TemplateCompositionRecord>> {
      return {
        status: 201,
        body: await templateService.createTemplateCompositionDraftFromCandidate(
          input,
        ),
      };
    },

    async createJournalTemplateProfile(
      input: CreateJournalTemplateProfileInput,
    ): Promise<RouteResponse<JournalTemplateProfileRecord>> {
      return {
        status: 201,
        body: await templateService.createJournalTemplateProfile(input),
      };
    },

    async updateModuleTemplateDraft({
      moduleTemplateId,
      input,
    }: {
      moduleTemplateId: string;
      input: UpdateModuleTemplateDraftInput;
    }): Promise<RouteResponse<ModuleTemplateRecord>> {
      return {
        status: 200,
        body: await templateService.updateModuleTemplateDraft(
          moduleTemplateId,
          input,
        ),
      };
    },

    async publishModuleTemplate({
      moduleTemplateId,
      actorRole,
    }: {
      moduleTemplateId: string;
      actorRole: RoleKey;
    }): Promise<RouteResponse<ModuleTemplateRecord>> {
      return {
        status: 200,
        body: await templateService.publishModuleTemplate(
          moduleTemplateId,
          actorRole,
        ),
      };
    },

    async updateTemplateFamily({
      templateFamilyId,
      input,
    }: {
      templateFamilyId: string;
      input: UpdateTemplateFamilyInput;
    }): Promise<RouteResponse<TemplateFamilyRecord>> {
      return {
        status: 200,
        body: await templateService.updateTemplateFamily(templateFamilyId, input),
      };
    },

    async listTemplateFamilies(): Promise<RouteResponse<TemplateFamilyRecord[]>> {
      return {
        status: 200,
        body: await templateService.listTemplateFamilies(),
      };
    },

    async listContentModules({
      moduleClass,
    }: {
      moduleClass?: CreateContentModuleDraftInput["moduleClass"];
    }): Promise<
      RouteResponse<Array<GovernedContentModuleRecord & { template_usage_count: number }>>
    > {
      return {
        status: 200,
        body: await templateService.listContentModules({ moduleClass }),
      };
    },

    async listTemplateCompositions(): Promise<
      RouteResponse<TemplateCompositionRecord[]>
    > {
      return {
        status: 200,
        body: await templateService.listTemplateCompositions(),
      };
    },

    async listModuleTemplatesByTemplateFamilyId({
      templateFamilyId,
    }: {
      templateFamilyId: string;
    }): Promise<RouteResponse<ModuleTemplateRecord[]>> {
      return {
        status: 200,
        body: await templateService.listModuleTemplatesByTemplateFamilyId(
          templateFamilyId,
        ),
      };
    },

    async listJournalTemplateProfilesByTemplateFamilyId({
      templateFamilyId,
    }: {
      templateFamilyId: string;
    }): Promise<RouteResponse<JournalTemplateProfileRecord[]>> {
      return {
        status: 200,
        body: await templateService.listJournalTemplateProfilesByTemplateFamilyId(
          templateFamilyId,
        ),
      };
    },

    async activateJournalTemplateProfile({
      journalTemplateProfileId,
      actorRole,
    }: {
      journalTemplateProfileId: string;
      actorRole: RoleKey;
    }): Promise<RouteResponse<JournalTemplateProfileRecord>> {
      return {
        status: 200,
        body: await templateService.activateJournalTemplateProfile(
          journalTemplateProfileId,
          actorRole,
        ),
      };
    },

    async archiveJournalTemplateProfile({
      journalTemplateProfileId,
      actorRole,
    }: {
      journalTemplateProfileId: string;
      actorRole: RoleKey;
    }): Promise<RouteResponse<JournalTemplateProfileRecord>> {
      return {
        status: 200,
        body: await templateService.archiveJournalTemplateProfile(
          journalTemplateProfileId,
          actorRole,
        ),
      };
    },

    async updateContentModuleDraft({
      contentModuleId,
      input,
    }: {
      contentModuleId: string;
      input: UpdateContentModuleDraftInput;
    }): Promise<RouteResponse<GovernedContentModuleRecord>> {
      return {
        status: 200,
        body: await templateService.updateContentModuleDraft(
          contentModuleId,
          input,
        ),
      };
    },

    async updateTemplateCompositionDraft({
      templateCompositionId,
      input,
    }: {
      templateCompositionId: string;
      input: UpdateTemplateCompositionDraftInput;
    }): Promise<RouteResponse<TemplateCompositionRecord>> {
      return {
        status: 200,
        body: await templateService.updateTemplateCompositionDraft(
          templateCompositionId,
          input,
        ),
      };
    },

    async createRetrievalQualityRun({
      templateFamilyId,
      actorRole,
      input,
    }: {
      templateFamilyId: string;
      actorRole: RoleKey;
      input: CreateTemplateRetrievalQualityRunInput;
    }): Promise<RouteResponse<KnowledgeRetrievalQualityRunRecord>> {
      return {
        status: 201,
        body: await templateService.createRetrievalQualityRun(
          templateFamilyId,
          actorRole,
          input,
        ),
      };
    },

    async getLatestRetrievalQualityRun({
      templateFamilyId,
      actorRole,
    }: {
      templateFamilyId: string;
      actorRole: RoleKey;
    }): Promise<RouteResponse<KnowledgeRetrievalQualityRunRecord>> {
      return {
        status: 200,
        body: await templateService.getLatestRetrievalQualityRun(
          templateFamilyId,
          actorRole,
        ),
      };
    },
  };
}
