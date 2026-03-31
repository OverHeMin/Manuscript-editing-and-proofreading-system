import type { RoleKey } from "../../users/roles.ts";
import { TemplateGovernanceService } from "./template-governance-service.ts";
import type {
  CreateModuleTemplateDraftInput,
  CreateTemplateFamilyInput,
  UpdateTemplateFamilyInput,
} from "./template-governance-service.ts";
import type {
  ModuleTemplateRecord,
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
  };
}
