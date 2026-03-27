import type { RoleKey } from "../../users/roles.ts";
import { PromptSkillRegistryService } from "./prompt-skill-service.ts";
import type {
  CreatePromptTemplateInput,
  CreateSkillPackageInput,
} from "./prompt-skill-service.ts";
import type {
  PromptTemplateRecord,
  SkillPackageRecord,
} from "./prompt-skill-record.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreatePromptSkillRegistryApiOptions {
  promptSkillRegistryService: PromptSkillRegistryService;
}

export function createPromptSkillRegistryApi(
  options: CreatePromptSkillRegistryApiOptions,
) {
  const { promptSkillRegistryService } = options;

  return {
    async createSkillPackage({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreateSkillPackageInput;
    }): Promise<RouteResponse<SkillPackageRecord>> {
      return {
        status: 201,
        body: await promptSkillRegistryService.createSkillPackage(actorRole, input),
      };
    },

    async listSkillPackages(): Promise<RouteResponse<SkillPackageRecord[]>> {
      return {
        status: 200,
        body: await promptSkillRegistryService.listSkillPackages(),
      };
    },

    async publishSkillPackage({
      actorRole,
      skillPackageId,
    }: {
      actorRole: RoleKey;
      skillPackageId: string;
    }): Promise<RouteResponse<SkillPackageRecord>> {
      return {
        status: 200,
        body: await promptSkillRegistryService.publishSkillPackage(
          actorRole,
          skillPackageId,
        ),
      };
    },

    async createPromptTemplate({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreatePromptTemplateInput;
    }): Promise<RouteResponse<PromptTemplateRecord>> {
      return {
        status: 201,
        body: await promptSkillRegistryService.createPromptTemplate(
          actorRole,
          input,
        ),
      };
    },

    async listPromptTemplates(): Promise<RouteResponse<PromptTemplateRecord[]>> {
      return {
        status: 200,
        body: await promptSkillRegistryService.listPromptTemplates(),
      };
    },

    async publishPromptTemplate({
      actorRole,
      promptTemplateId,
    }: {
      actorRole: RoleKey;
      promptTemplateId: string;
    }): Promise<RouteResponse<PromptTemplateRecord>> {
      return {
        status: 200,
        body: await promptSkillRegistryService.publishPromptTemplate(
          actorRole,
          promptTemplateId,
        ),
      };
    },
  };
}
