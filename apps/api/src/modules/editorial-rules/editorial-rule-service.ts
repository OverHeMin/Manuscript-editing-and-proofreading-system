import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { TableEvidenceService } from "../table-evidence/table-evidence-service.ts";
import type { TemplateFamilyRepository } from "../templates/template-repository.ts";
import type { VerificationOpsRepository } from "../verification-ops/verification-ops-repository.ts";
import type { EditorialRuleProjectionService } from "./editorial-rule-projection-service.ts";
import type { EditorialRuleRepository } from "./editorial-rule-repository.ts";
import {
  DEFAULT_EDITORIAL_RULE_PRIORITY,
} from "./editorial-rule-record.ts";
import type {
  EditorialRuleAction,
  EditorialRuleConfidencePolicy,
  EditorialRuleEvidenceLevel,
  EditorialRuleExecutionMode,
  EditorialRuleRecord,
  EditorialRuleReleaseComparisonSummary,
  EditorialRuleScope,
  EditorialRuleSeverity,
  EditorialRuleSetRecord,
  EditorialRuleSetReleaseScope,
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
  priority?: number;
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

export type TransitionEditorialRuleSetTargetStatus = Extract<
  EditorialRuleSetRecord["status"],
  "candidate" | "canary" | "active" | "rolled_back"
>;

export interface TransitionEditorialRuleSetInput {
  ruleSetId: string;
  targetStatus: TransitionEditorialRuleSetTargetStatus;
  releaseScope?: EditorialRuleSetReleaseScope;
  candidateValidationRunId?: string;
  candidateValidationEvidencePackId?: string;
  onlineRegressionRunId?: string;
  onlineRegressionEvidencePackId?: string;
}

export interface EditorialRuleServiceOptions {
  repository: EditorialRuleRepository;
  templateFamilyRepository: TemplateFamilyRepository;
  verificationOpsRepository?: Pick<
    VerificationOpsRepository,
    | "findEvaluationRunById"
    | "findEvaluationEvidencePackById"
    | "findLatestEvaluationPromotionRecommendationByRunId"
  >;
  projectionService?: Pick<
    EditorialRuleProjectionService,
    "archiveRuleSetProjections" | "refreshPublishedRuleSet"
  >;
  activationMetricsService?: {
    buildReleaseComparison: (
      ruleSetId: string,
    ) => Promise<EditorialRuleReleaseComparisonSummary>;
  };
  tableEvidenceService?: Pick<TableEvidenceService, "assertConfirmedRevision">;
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
  readonly failure_code?: string;
  readonly failures?: Array<{ code: string; revision_id?: string }>;

  constructor(
    ruleSetId: string,
    fromStatus: string,
    toStatus: string,
    options?: {
      failureCode?: string;
      failures?: Array<{ code: string; revision_id?: string }>;
    },
  ) {
    super(
      `Editorial rule set ${ruleSetId} cannot transition from ${fromStatus} to ${toStatus}.`,
    );
    this.name = "EditorialRuleSetStatusTransitionError";
    this.failure_code = options?.failureCode;
    this.failures = options?.failures;
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

export class EditorialRuleSetPromotionEvidenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EditorialRuleSetPromotionEvidenceError";
  }
}

export class EditorialRuleService {
  private readonly repository: EditorialRuleRepository;
  private readonly templateFamilyRepository: TemplateFamilyRepository;
  private readonly verificationOpsRepository?: Pick<
    VerificationOpsRepository,
    | "findEvaluationRunById"
    | "findEvaluationEvidencePackById"
    | "findLatestEvaluationPromotionRecommendationByRunId"
  >;
  private readonly projectionService?: Pick<
    EditorialRuleProjectionService,
    "archiveRuleSetProjections" | "refreshPublishedRuleSet"
  >;
  private readonly activationMetricsService?: {
    buildReleaseComparison: (
      ruleSetId: string,
    ) => Promise<EditorialRuleReleaseComparisonSummary>;
  };
  private readonly tableEvidenceService?: Pick<
    TableEvidenceService,
    "assertConfirmedRevision"
  >;
  private readonly permissionGuard: PermissionGuard;
  private readonly createId: () => string;

  constructor(options: EditorialRuleServiceOptions) {
    this.repository = options.repository;
    this.templateFamilyRepository = options.templateFamilyRepository;
    this.verificationOpsRepository = options.verificationOpsRepository;
    this.projectionService = options.projectionService;
    this.activationMetricsService = options.activationMetricsService;
    this.tableEvidenceService = options.tableEvidenceService;
    this.permissionGuard = options.permissionGuard ?? new PermissionGuard();
    this.createId = options.createId ?? (() => randomUUID());
  }

  async createRuleSet(
    actorRole: RoleKey,
    input: CreateEditorialRuleSetInput,
  ): Promise<EditorialRuleSetRecord> {
    this.permissionGuard.assert(actorRole, "template-governance.manage");

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
    this.permissionGuard.assert(actorRole, "template-governance.manage");

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

    await this.assertLinkedTableEvidenceRevisionsConfirmed(ruleSet, "published");
    await this.archiveRelatedRuleSets(ruleSet, ["published", "active"]);

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
    this.permissionGuard.assert(actorRole, "template-governance.manage");

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
      priority: normalizeRulePriority(input.priority),
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

  async transitionRuleSet(
    actorRole: RoleKey,
    input: TransitionEditorialRuleSetInput,
  ): Promise<EditorialRuleSetRecord> {
    this.permissionGuard.assert(actorRole, "template-governance.manage");

    const ruleSet = await this.repository.findRuleSetById(input.ruleSetId);
    if (!ruleSet) {
      throw new EditorialRuleSetNotFoundError(input.ruleSetId);
    }

    switch (input.targetStatus) {
      case "candidate":
        return this.transitionToCandidate(ruleSet, input);
      case "canary":
        return this.transitionToCanary(ruleSet, input);
      case "active":
        return this.transitionToActive(ruleSet, input);
      case "rolled_back":
        return this.transitionToRolledBack(ruleSet);
      default:
        throw new EditorialRuleSetStatusTransitionError(
          input.ruleSetId,
          ruleSet.status,
          input.targetStatus,
        );
    }
  }

  async listRules(ruleSetId: string): Promise<EditorialRuleRecord[]> {
    const ruleSet = await this.repository.findRuleSetById(ruleSetId);
    if (!ruleSet) {
      throw new EditorialRuleSetNotFoundError(ruleSetId);
    }

    return this.repository.listRulesByRuleSetId(ruleSetId);
  }

  private async transitionToCandidate(
    ruleSet: EditorialRuleSetRecord,
    input: TransitionEditorialRuleSetInput,
  ): Promise<EditorialRuleSetRecord> {
    if (ruleSet.status !== "draft") {
      throw new EditorialRuleSetStatusTransitionError(
        ruleSet.id,
        ruleSet.status,
        "candidate",
      );
    }

    const next: EditorialRuleSetRecord = {
      ...ruleSet,
      status: "candidate",
      ...(input.releaseScope ? { release_scope: cloneReleaseScope(input.releaseScope) } : {}),
    };
    await this.repository.saveRuleSet(next);
    return next;
  }

  private async transitionToCanary(
    ruleSet: EditorialRuleSetRecord,
    input: TransitionEditorialRuleSetInput,
  ): Promise<EditorialRuleSetRecord> {
    if (ruleSet.status !== "candidate") {
      throw new EditorialRuleSetStatusTransitionError(
        ruleSet.id,
        ruleSet.status,
        "canary",
      );
    }

    await this.assertPromotionEvidence({
      gateLabel: "candidate validation",
      runId: input.candidateValidationRunId,
      evidencePackId: input.candidateValidationEvidencePackId,
    });

    const next: EditorialRuleSetRecord = {
      ...ruleSet,
      status: "canary",
      candidate_validation_run_id: input.candidateValidationRunId,
      candidate_validation_evidence_pack_id:
        input.candidateValidationEvidencePackId,
    };
    await this.repository.saveRuleSet(next);
    return next;
  }

  private async transitionToActive(
    ruleSet: EditorialRuleSetRecord,
    input: TransitionEditorialRuleSetInput,
  ): Promise<EditorialRuleSetRecord> {
    if (ruleSet.status !== "canary") {
      throw new EditorialRuleSetStatusTransitionError(
        ruleSet.id,
        ruleSet.status,
        "active",
      );
    }

    await this.assertPromotionEvidence({
      gateLabel: "online execution regression",
      runId: input.onlineRegressionRunId,
      evidencePackId: input.onlineRegressionEvidencePackId,
    });
    if (this.activationMetricsService) {
      const releaseComparison =
        await this.activationMetricsService.buildReleaseComparison(ruleSet.id);
      if (releaseComparison.status === "degraded") {
        throw new EditorialRuleSetPromotionEvidenceError(
          releaseComparison.reasons.join(" "),
        );
      }
    }

    await this.assertLinkedTableEvidenceRevisionsConfirmed(ruleSet, "active");
    const rollbackTarget = await this.findLatestRollbackTarget(ruleSet);
    await this.archiveRelatedRuleSets(ruleSet, ["published", "active"]);

    const next: EditorialRuleSetRecord = {
      ...ruleSet,
      status: "active",
      online_regression_run_id: input.onlineRegressionRunId,
      online_regression_evidence_pack_id: input.onlineRegressionEvidencePackId,
      ...(rollbackTarget ? { rollback_rule_set_id: rollbackTarget.id } : {}),
    };
    await this.repository.saveRuleSet(next);
    await this.projectionService?.refreshPublishedRuleSet(next.id);
    return next;
  }

  private async transitionToRolledBack(
    ruleSet: EditorialRuleSetRecord,
  ): Promise<EditorialRuleSetRecord> {
    if (ruleSet.status !== "active") {
      throw new EditorialRuleSetStatusTransitionError(
        ruleSet.id,
        ruleSet.status,
        "rolled_back",
      );
    }

    const rollbackTarget = await this.findRollbackTarget(ruleSet);
    if (rollbackTarget) {
      await this.assertLinkedTableEvidenceRevisionsConfirmed(
        rollbackTarget,
        "active",
      );
      const restored: EditorialRuleSetRecord = {
        ...rollbackTarget,
        status: "active",
      };
      await this.repository.saveRuleSet(restored);
      await this.projectionService?.refreshPublishedRuleSet(restored.id);
    }

    const next: EditorialRuleSetRecord = {
      ...ruleSet,
      status: "rolled_back",
      ...(rollbackTarget ? { rollback_rule_set_id: rollbackTarget.id } : {}),
    };
    await this.repository.saveRuleSet(next);
    await this.projectionService?.archiveRuleSetProjections(next.id);
    return next;
  }

  private async archiveRelatedRuleSets(
    ruleSet: EditorialRuleSetRecord,
    statuses: EditorialRuleSetRecord["status"][],
  ): Promise<void> {
    const relatedRuleSets =
      await this.repository.listRuleSetsByTemplateFamilyAndModule(
        ruleSet.template_family_id,
        ruleSet.module,
      );
    for (const existing of relatedRuleSets) {
      if (
        existing.id === ruleSet.id ||
        !statuses.includes(existing.status) ||
        !sameEditorialRuleSetScope(existing, ruleSet)
      ) {
        continue;
      }

      await this.repository.saveRuleSet({
        ...existing,
        status: "archived",
      });
      await this.projectionService?.archiveRuleSetProjections(existing.id);
    }
  }

  private async findRollbackTarget(
    ruleSet: EditorialRuleSetRecord,
  ): Promise<EditorialRuleSetRecord | undefined> {
    if (ruleSet.rollback_rule_set_id) {
      const target = await this.repository.findRuleSetById(ruleSet.rollback_rule_set_id);
      if (target) {
        return target;
      }
    }

    return this.findLatestRollbackTarget(ruleSet);
  }

  private async findLatestRollbackTarget(
    ruleSet: EditorialRuleSetRecord,
  ): Promise<EditorialRuleSetRecord | undefined> {
    const relatedRuleSets =
      await this.repository.listRuleSetsByTemplateFamilyAndModule(
        ruleSet.template_family_id,
        ruleSet.module,
      );

    return relatedRuleSets
      .filter(
        (candidate) =>
          candidate.id !== ruleSet.id &&
          sameEditorialRuleSetScope(candidate, ruleSet) &&
          (candidate.status === "published" ||
            candidate.status === "active" ||
            candidate.status === "archived"),
      )
      .sort(compareRuleSetsDescending)[0];
  }

  private async assertPromotionEvidence(input: {
    gateLabel: string;
    runId: string | undefined;
    evidencePackId: string | undefined;
  }): Promise<void> {
    if (!input.runId || !input.evidencePackId) {
      throw new EditorialRuleSetPromotionEvidenceError(
        `Missing ${input.gateLabel} evidence.`,
      );
    }

    if (!this.verificationOpsRepository) {
      return;
    }

    const run = await this.verificationOpsRepository.findEvaluationRunById(input.runId);
    if (!run || run.status !== "passed") {
      throw new EditorialRuleSetPromotionEvidenceError(
        `Missing ${input.gateLabel} evidence.`,
      );
    }

    const evidencePack =
      await this.verificationOpsRepository.findEvaluationEvidencePackById(
        input.evidencePackId,
      );
    if (
      !evidencePack ||
      evidencePack.experiment_run_id !== run.id ||
      evidencePack.summary_status !== "recommended"
    ) {
      throw new EditorialRuleSetPromotionEvidenceError(
        `Missing ${input.gateLabel} evidence.`,
      );
    }

    const recommendation =
      await this.verificationOpsRepository.findLatestEvaluationPromotionRecommendationByRunId(
        run.id,
      );
    if (
      !recommendation ||
      recommendation.evidence_pack_id !== evidencePack.id ||
      recommendation.status !== "recommended"
    ) {
      throw new EditorialRuleSetPromotionEvidenceError(
        `Missing ${input.gateLabel} evidence.`,
      );
    }
  }

  private async assertLinkedTableEvidenceRevisionsConfirmed(
    ruleSet: EditorialRuleSetRecord,
    targetStatus: "published" | "active",
  ): Promise<void> {
    const rules = await this.repository.listRulesByRuleSetId(ruleSet.id);
    const normalized = normalizeTableEvidenceRevisionIds(
      rules.flatMap(
        (rule) => rule.linkage_payload?.table_evidence_revision_ids ?? [],
      ),
    );
    if (normalized.hasInvalid) {
      throw createTableEvidenceRevisionTransitionError(
        ruleSet,
        targetStatus,
        undefined,
        "table_evidence_revision_id_invalid",
      );
    }
    const revisionIds = normalized.revisionIds;
    if (revisionIds.length === 0) {
      return;
    }

    if (!this.tableEvidenceService) {
      throw createTableEvidenceRevisionTransitionError(
        ruleSet,
        targetStatus,
        revisionIds[0],
        "table_evidence_revision_not_confirmed",
      );
    }

    for (const revisionId of revisionIds) {
      try {
        await this.tableEvidenceService.assertConfirmedRevision(revisionId);
      } catch {
        throw createTableEvidenceRevisionTransitionError(
          ruleSet,
          targetStatus,
          revisionId,
          "table_evidence_revision_not_confirmed",
        );
      }
    }
  }
}

function createTableEvidenceRevisionTransitionError(
  ruleSet: EditorialRuleSetRecord,
  targetStatus: "published" | "active",
  revisionId: string | undefined,
  failureCode:
    | "table_evidence_revision_not_confirmed"
    | "table_evidence_revision_id_invalid",
): EditorialRuleSetStatusTransitionError {
  return new EditorialRuleSetStatusTransitionError(
    ruleSet.id,
    ruleSet.status,
    targetStatus,
    {
      failureCode,
      failures: [
        {
          code: failureCode,
          ...(revisionId ? { revision_id: revisionId } : {}),
        },
      ],
    },
  );
}

function normalizeTableEvidenceRevisionIds(
  revisionIds: string[],
): { revisionIds: string[]; hasInvalid: boolean } {
  const normalizedRevisionIds: string[] = [];
  for (const revisionId of revisionIds) {
    const normalizedRevisionId = revisionId.trim();
    if (!normalizedRevisionId) {
      return { revisionIds: [], hasInvalid: true };
    }
    normalizedRevisionIds.push(normalizedRevisionId);
  }

  return { revisionIds: [...new Set(normalizedRevisionIds)], hasInvalid: false };
}

function sameEditorialRuleSetScope(
  left: EditorialRuleSetRecord,
  right: EditorialRuleSetRecord,
): boolean {
  return (
    (left.journal_template_id ?? undefined) ===
      (right.journal_template_id ?? undefined) &&
    stableSerializeReleaseScope(left.release_scope) ===
      stableSerializeReleaseScope(right.release_scope)
  );
}

function stableSerializeReleaseScope(
  value: EditorialRuleSetReleaseScope | undefined,
): string {
  if (!value) {
    return "{}";
  }

  const entries = Object.entries(value).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  return JSON.stringify(
    Object.fromEntries(
      entries.map(([key, entryValue]) => [
        key,
        Array.isArray(entryValue) ? [...entryValue] : entryValue,
      ]),
    ),
  );
}

function cloneReleaseScope(
  value: EditorialRuleSetReleaseScope,
): EditorialRuleSetReleaseScope {
  return JSON.parse(JSON.stringify(value)) as EditorialRuleSetReleaseScope;
}

function compareRuleSetsDescending(
  left: EditorialRuleSetRecord,
  right: EditorialRuleSetRecord,
): number {
  if (left.version_no !== right.version_no) {
    return right.version_no - left.version_no;
  }

  return right.id.localeCompare(left.id);
}

function normalizeRulePriority(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_EDITORIAL_RULE_PRIORITY;
  }

  return Math.max(0, Math.trunc(value));
}
