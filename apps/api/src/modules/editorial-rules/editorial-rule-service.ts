import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { TemplateFamilyRepository } from "../templates/template-repository.ts";
import type { EditorialRuleProjectionService } from "./editorial-rule-projection-service.ts";
import type { EditorialRuleRepository } from "./editorial-rule-repository.ts";
import type {
  EditorialRuleAction,
  EditorialRuleConfidencePolicy,
  EditorialRuleExecutionMode,
  EditorialRuleRecord,
  EditorialRuleScope,
  EditorialRuleSeverity,
  EditorialRuleSetRecord,
  EditorialRuleTrigger,
  EditorialRuleType,
} from "./editorial-rule-record.ts";

export interface CreateEditorialRuleSetInput {
  templateFamilyId: string;
  module: EditorialRuleSetRecord["module"];
}

export interface CreateEditorialRuleInput {
  ruleSetId: string;
  orderNo: number;
  ruleType: EditorialRuleType;
  executionMode: EditorialRuleExecutionMode;
  scope: EditorialRuleScope;
  trigger: EditorialRuleTrigger;
  action: EditorialRuleAction;
  confidencePolicy: EditorialRuleConfidencePolicy;
  severity: EditorialRuleSeverity;
  enabled?: boolean;
  exampleBefore?: string;
  exampleAfter?: string;
  manualReviewReasonTemplate?: string;
}

export interface EditorialRuleServiceOptions {
  repository: EditorialRuleRepository;
  templateFamilyRepository: TemplateFamilyRepository;
  projectionService?: Pick<
    EditorialRuleProjectionService,
    "archiveRuleSetProjections" | "refreshPublishedRuleSet"
  >;
  permissionGuard?: PermissionGuard;
  createId?: () => string;
}

export class EditorialRuleTemplateFamilyNotFoundError extends Error {
  constructor(templateFamilyId: string) {
    super(`Template family ${templateFamilyId} was not found.`);
    this.name = "EditorialRuleTemplateFamilyNotFoundError";
  }
}

export class EditorialRuleSetNotFoundError extends Error {
  constructor(ruleSetId: string) {
    super(`Editorial rule set ${ruleSetId} was not found.`);
    this.name = "EditorialRuleSetNotFoundError";
  }
}

export class EditorialRuleSetStatusTransitionError extends Error {
  constructor(ruleSetId: string, fromStatus: string, toStatus: string) {
    super(
      `Editorial rule set ${ruleSetId} cannot transition from ${fromStatus} to ${toStatus}.`,
    );
    this.name = "EditorialRuleSetStatusTransitionError";
  }
}

export class EditorialRuleSetNotEditableError extends Error {
  constructor(ruleSetId: string, status: string) {
    super(
      `Editorial rule set ${ruleSetId} is ${status} and can only be edited while in draft status.`,
    );
    this.name = "EditorialRuleSetNotEditableError";
  }
}

export class EditorialRuleService {
  private readonly repository: EditorialRuleRepository;
  private readonly templateFamilyRepository: TemplateFamilyRepository;
  private readonly projectionService?: Pick<
    EditorialRuleProjectionService,
    "archiveRuleSetProjections" | "refreshPublishedRuleSet"
  >;
  private readonly permissionGuard: PermissionGuard;
  private readonly createId: () => string;

  constructor(options: EditorialRuleServiceOptions) {
    this.repository = options.repository;
    this.templateFamilyRepository = options.templateFamilyRepository;
    this.projectionService = options.projectionService;
    this.permissionGuard = options.permissionGuard ?? new PermissionGuard();
    this.createId = options.createId ?? (() => randomUUID());
  }

  async createRuleSet(
    actorRole: RoleKey,
    input: CreateEditorialRuleSetInput,
  ): Promise<EditorialRuleSetRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const templateFamily = await this.templateFamilyRepository.findById(
      input.templateFamilyId,
    );
    if (!templateFamily) {
      throw new EditorialRuleTemplateFamilyNotFoundError(input.templateFamilyId);
    }

    const record: EditorialRuleSetRecord = {
      id: this.createId(),
      template_family_id: input.templateFamilyId,
      module: input.module,
      version_no: await this.repository.reserveNextRuleSetVersion(
        input.templateFamilyId,
        input.module,
      ),
      status: "draft",
    };

    await this.repository.saveRuleSet(record);
    return record;
  }

  async publishRuleSet(
    actorRole: RoleKey,
    ruleSetId: string,
  ): Promise<EditorialRuleSetRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const ruleSet = await this.repository.findRuleSetById(ruleSetId);
    if (!ruleSet) {
      throw new EditorialRuleSetNotFoundError(ruleSetId);
    }

    if (ruleSet.status !== "draft") {
      throw new EditorialRuleSetStatusTransitionError(
        ruleSetId,
        ruleSet.status,
        "published",
      );
    }

    const relatedRuleSets =
      await this.repository.listRuleSetsByTemplateFamilyAndModule(
        ruleSet.template_family_id,
        ruleSet.module,
      );
    for (const existing of relatedRuleSets) {
      if (existing.id !== ruleSet.id && existing.status === "published") {
        await this.repository.saveRuleSet({
          ...existing,
          status: "archived",
        });
        await this.projectionService?.archiveRuleSetProjections(existing.id);
      }
    }

    const published: EditorialRuleSetRecord = {
      ...ruleSet,
      status: "published",
    };
    await this.repository.saveRuleSet(published);
    await this.projectionService?.refreshPublishedRuleSet(published.id);
    return published;
  }

  listRuleSets(): Promise<EditorialRuleSetRecord[]> {
    return this.repository.listRuleSets();
  }

  async createRule(
    actorRole: RoleKey,
    input: CreateEditorialRuleInput,
  ): Promise<EditorialRuleRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const ruleSet = await this.repository.findRuleSetById(input.ruleSetId);
    if (!ruleSet) {
      throw new EditorialRuleSetNotFoundError(input.ruleSetId);
    }

    if (ruleSet.status !== "draft") {
      throw new EditorialRuleSetNotEditableError(
        input.ruleSetId,
        ruleSet.status,
      );
    }

    const record: EditorialRuleRecord = {
      id: this.createId(),
      rule_set_id: input.ruleSetId,
      order_no: input.orderNo,
      rule_type: input.ruleType,
      execution_mode: input.executionMode,
      scope: input.scope,
      trigger: input.trigger,
      action: input.action,
      confidence_policy: input.confidencePolicy,
      severity: input.severity,
      enabled: input.enabled ?? true,
      ...(input.exampleBefore
        ? {
            example_before: input.exampleBefore,
          }
        : {}),
      ...(input.exampleAfter
        ? {
            example_after: input.exampleAfter,
          }
        : {}),
      ...(input.manualReviewReasonTemplate
        ? {
            manual_review_reason_template: input.manualReviewReasonTemplate,
          }
        : {}),
    };

    await this.repository.saveRule(record);
    return record;
  }

  async listRules(ruleSetId: string): Promise<EditorialRuleRecord[]> {
    const ruleSet = await this.repository.findRuleSetById(ruleSetId);
    if (!ruleSet) {
      throw new EditorialRuleSetNotFoundError(ruleSetId);
    }

    return this.repository.listRulesByRuleSetId(ruleSetId);
  }
}
