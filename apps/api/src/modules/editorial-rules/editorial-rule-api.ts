import type { RoleKey } from "../../users/roles.ts";
import { EditorialRuleService } from "./editorial-rule-service.ts";
import type {
  CreateEditorialRuleInput,
  CreateEditorialRuleSetInput,
} from "./editorial-rule-service.ts";
import type {
  EditorialRulePreviewService,
  PreviewEditorialRuleInput,
  PreviewResolvedEditorialRulesInput,
  EditorialRulePreviewResult,
} from "./editorial-rule-preview-service.ts";
import type {
  EditorialRuleRecord,
  EditorialRuleSetRecord,
} from "./editorial-rule-record.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateEditorialRuleApiOptions {
  editorialRuleService: EditorialRuleService;
  editorialRulePreviewService?: EditorialRulePreviewService;
}

export function createEditorialRuleApi(options: CreateEditorialRuleApiOptions) {
  const { editorialRuleService, editorialRulePreviewService } = options;

  return {
    async createRuleSet({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreateEditorialRuleSetInput;
    }): Promise<RouteResponse<EditorialRuleSetRecord>> {
      return {
        status: 201,
        body: await editorialRuleService.createRuleSet(actorRole, input),
      };
    },

    async listRuleSets(): Promise<RouteResponse<EditorialRuleSetRecord[]>> {
      return {
        status: 200,
        body: await editorialRuleService.listRuleSets(),
      };
    },

    async publishRuleSet({
      actorRole,
      ruleSetId,
    }: {
      actorRole: RoleKey;
      ruleSetId: string;
    }): Promise<RouteResponse<EditorialRuleSetRecord>> {
      return {
        status: 200,
        body: await editorialRuleService.publishRuleSet(actorRole, ruleSetId),
      };
    },

    async createRule({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreateEditorialRuleInput;
    }): Promise<RouteResponse<EditorialRuleRecord>> {
      return {
        status: 201,
        body: await editorialRuleService.createRule(actorRole, input),
      };
    },

    async listRules({
      ruleSetId,
    }: {
      ruleSetId: string;
    }): Promise<RouteResponse<EditorialRuleRecord[]>> {
      return {
        status: 200,
        body: await editorialRuleService.listRules(ruleSetId),
      };
    },

    async previewRule(
      input: PreviewEditorialRuleInput,
    ): Promise<RouteResponse<EditorialRulePreviewResult>> {
      return {
        status: 200,
        body: await editorialRulePreviewService!.previewRule(input),
      };
    },

    async previewResolvedRules(
      input: PreviewResolvedEditorialRulesInput,
    ): Promise<RouteResponse<EditorialRulePreviewResult>> {
      return {
        status: 200,
        body: await editorialRulePreviewService!.previewResolvedRules(input),
      };
    },
  };
}
