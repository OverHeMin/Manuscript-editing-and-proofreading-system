import type { RoleKey } from "../../users/roles.ts";
import type {
  KnowledgeBindingRuleRecord,
  ModuleExecutionProfileRecord,
} from "./execution-governance-record.ts";
import type {
  CreateExecutionProfileInput,
  CreateKnowledgeBindingRuleInput,
  ExecutionGovernanceService,
} from "./execution-governance-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateExecutionGovernanceApiOptions {
  executionGovernanceService: ExecutionGovernanceService;
}

export function createExecutionGovernanceApi(
  options: CreateExecutionGovernanceApiOptions,
) {
  const { executionGovernanceService } = options;

  return {
    async createProfile({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreateExecutionProfileInput;
    }): Promise<RouteResponse<ModuleExecutionProfileRecord>> {
      return {
        status: 201,
        body: await executionGovernanceService.createProfile(actorRole, input),
      };
    },

    async publishProfile({
      actorRole,
      profileId,
    }: {
      actorRole: RoleKey;
      profileId: string;
    }): Promise<RouteResponse<ModuleExecutionProfileRecord>> {
      return {
        status: 200,
        body: await executionGovernanceService.publishProfile(profileId, actorRole),
      };
    },

    async archiveProfile({
      actorRole,
      profileId,
    }: {
      actorRole: RoleKey;
      profileId: string;
    }): Promise<RouteResponse<ModuleExecutionProfileRecord>> {
      return {
        status: 200,
        body: await executionGovernanceService.archiveProfile(profileId, actorRole),
      };
    },

    async listProfiles(): Promise<RouteResponse<ModuleExecutionProfileRecord[]>> {
      return {
        status: 200,
        body: await executionGovernanceService.listProfiles(),
      };
    },

    async createKnowledgeBindingRule({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreateKnowledgeBindingRuleInput;
    }): Promise<RouteResponse<KnowledgeBindingRuleRecord>> {
      return {
        status: 201,
        body: await executionGovernanceService.createKnowledgeBindingRule(
          actorRole,
          input,
        ),
      };
    },

    async activateKnowledgeBindingRule({
      actorRole,
      ruleId,
    }: {
      actorRole: RoleKey;
      ruleId: string;
    }): Promise<RouteResponse<KnowledgeBindingRuleRecord>> {
      return {
        status: 200,
        body: await executionGovernanceService.activateKnowledgeBindingRule(
          ruleId,
          actorRole,
        ),
      };
    },

    async listKnowledgeBindingRules(): Promise<
      RouteResponse<KnowledgeBindingRuleRecord[]>
    > {
      return {
        status: 200,
        body: await executionGovernanceService.listKnowledgeBindingRules(),
      };
    },
  };
}
