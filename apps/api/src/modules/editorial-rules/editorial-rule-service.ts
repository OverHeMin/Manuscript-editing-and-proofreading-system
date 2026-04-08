import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { TemplateFamilyRepository } from "../templates/template-repository.ts";
import type { EditorialRuleProjectionService } from "./editorial-rule-projection-service.ts";
import type { EditorialRuleRepository } from "./editorial-rule-repository.ts";
import type {
  EditorialRuleAction,
  EditorialRuleConfidencePolicy,
  EditorialRuleEvidenceLevel,
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
  journalTemplateId?: string;
  module: EditorialRuleSetRecord["module"];
}

export interface CreateEditorialRuleInput {
  ruleSetId: string;
  orderNo: number;
  ruleObject?: string;
  ruleType: EditorialRuleType;
  executionMode: EditorialRuleExecutionMode;
  scope: EditorialRuleScope;
  selector?: Record<string, unknown>;
  trigger: EditorialRuleTrigger;
  action: EditorialRuleAction;
  authoringPayload?: Record<string, unknown>;
  explanationPayload?: EditorialRuleRecord["explanation_payload"];
  linkagePayload?: EditorialRuleRecord["linkage_payload"];
  projectionPayload?: EditorialRuleRecord["projection_payload"];
  evidenceLevel?: EditorialRuleEvidenceLevel;
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

export class EditorialRuleJournalTemplateNotFoundError extends Error {
  constructor(journalTemplateId: string) {
    super(`Journal template ${journalTemplateId} was not found.`);
    this.name = "EditorialRuleJournalTemplateNotFoundError";
  }
}

export class EditorialRuleJournalTemplateFamilyMismatchError extends Error {
  constructor(
    journalTemplateId: string,
    expectedTemplateFamilyId: string,
    actualTemplateFamilyId: string,
  ) {
    super(
      `Journal template ${journalTemplateId} belongs to template family ${actualTemplateFamilyId}, expected ${expectedTemplateFamilyId}.`,
    );
    this.name = "EditorialRuleJournalTemplateFamilyMismatchError";
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

    if (input.journalTemplateId) {
      const journalTemplate =
        await this.templateFamilyRepository.findJournalTemplateProfileById(
          input.journalTemplateId,
        );
      if (!journalTemplate) {
        throw new EditorialRuleJournalTemplateNotFoundError(
          input.journalTemplateId,
        );
      }

      if (journalTemplate.template_family_id !== input.templateFamilyId) {
        throw new EditorialRuleJournalTemplateFamilyMismatchError(
          input.journalTemplateId,
          input.templateFamilyId,
          journalTemplate.template_family_id,
        );
      }
    }

    const record: EditorialRuleSetRecord = {
      id: this.createId(),
      template_family_id: input.templateFamilyId,
      ...(input.journalTemplateId
        ? { journal_template_id: input.journalTemplateId }
        : {}),
      module: input.module,
      version_no: await this.repository.reserveNextRuleSetVersion(
        input.templateFamilyId,
        input.module,
        input.journalTemplateId,
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
      if (
        existing.id !== ruleSet.id &&
        existing.status === "published" &&
        (existing.journal_template_id ?? undefined) ===
          (ruleSet.journal_template_id ?? undefined)
      ) {
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
      rule_object: input.ruleObject ?? "generic",
      rule_type: input.ruleType,
      execution_mode: input.executionMode,
      scope: input.scope,
      selector: input.selector ?? {},
      trigger: input.trigger,
      action: input.action,
      authoring_payload: input.authoringPayload ?? {},
      ...(input.explanationPayload
        ? { explanation_payload: input.explanationPayload }
        : {}),
      ...(input.linkagePayload
        ? { linkage_payload: input.linkagePayload }
        : {}),
      ...(input.projectionPayload
        ? { projection_payload: input.projectionPayload }
        : {}),
      ...(input.evidenceLevel ? { evidence_level: input.evidenceLevel } : {}),
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
