import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { ReviewedCaseSnapshotRepository } from "../learning/learning-repository.ts";
import type { ToolGatewayRepository } from "../tool-gateway/tool-gateway-repository.ts";
import {
  createDirectWriteTransactionManager,
  createScopedWriteTransactionManager,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import {
  InMemoryVerificationOpsRepository,
} from "./in-memory-verification-ops-repository.ts";
import {
  freezeExperimentBindings,
  type FrozenExperimentBindingInput,
} from "./experiment-binding-guard.ts";
import {
  requireEligibleReviewedCaseSnapshot,
} from "./sample-set-source-guard.ts";
import type {
  EvaluationRunRecord,
  EvaluationRunItemFailureKind,
  EvaluationRunItemRecord,
  EvaluationSampleSetItemRecord,
  EvaluationSampleSetRecord,
  EvaluationSuiteRecord,
  FrozenExperimentBindingRecord,
  ReleaseCheckProfileRecord,
  VerificationCheckProfileRecord,
  VerificationEvidenceRecord,
} from "./verification-ops-record.ts";
import type { VerificationOpsRepository } from "./verification-ops-repository.ts";

export interface CreateVerificationCheckProfileInput {
  name: string;
  checkType: VerificationCheckProfileRecord["check_type"];
  toolIds?: string[];
}

export interface CreateEvaluationSampleSetInput {
  name: string;
  module: EvaluationSampleSetRecord["module"];
  sampleItemInputs: Array<{
    reviewedCaseSnapshotId: string;
    riskTags?: string[];
  }>;
}

export interface CreateReleaseCheckProfileInput {
  name: string;
  checkType: ReleaseCheckProfileRecord["check_type"];
  verificationCheckProfileIds: string[];
}

export interface CreateEvaluationSuiteInput {
  name: string;
  suiteType: EvaluationSuiteRecord["suite_type"];
  verificationCheckProfileIds: string[];
  moduleScope: EvaluationSuiteRecord["module_scope"];
  requiresProductionBaseline?: boolean;
  supportsAbComparison?: boolean;
  hardGatePolicy?: {
    mustUseDeidentifiedSamples: boolean;
    requiresParsableOutput: boolean;
  };
  scoreWeights?: {
    structure: number;
    terminology: number;
    knowledgeCoverage: number;
    riskDetection: number;
    humanEditBurden: number;
    costAndLatency: number;
  };
}

export interface RecordVerificationEvidenceInput {
  kind: VerificationEvidenceRecord["kind"];
  label: string;
  uri?: string;
  artifactAssetId?: string;
  checkProfileId?: string;
}

export interface CreateEvaluationRunInput {
  suiteId: string;
  sampleSetId?: string;
  baselineBinding?: FrozenExperimentBindingInput;
  candidateBinding?: FrozenExperimentBindingInput;
  releaseCheckProfileId?: string;
}

export interface CompleteEvaluationRunInput {
  runId: string;
  status: Extract<EvaluationRunRecord["status"], "passed" | "failed">;
  evidenceIds: string[];
}

export interface RecordEvaluationRunItemResultInput {
  runItemId: string;
  resultAssetId?: string;
  hardGatePassed?: boolean;
  weightedScore?: number;
  failureKind?: EvaluationRunItemFailureKind;
  failureReason?: string;
  diffSummary?: string;
  requiresHumanReview?: boolean;
}

interface VerificationOpsWriteContext {
  repository: VerificationOpsRepository;
}

export interface VerificationOpsServiceOptions {
  repository: VerificationOpsRepository;
  reviewedCaseSnapshotRepository?: ReviewedCaseSnapshotRepository;
  toolGatewayRepository: ToolGatewayRepository;
  permissionGuard?: PermissionGuard;
  transactionManager?: WriteTransactionManager<VerificationOpsWriteContext>;
  createId?: () => string;
  now?: () => Date;
}

export class VerificationCheckProfileNotFoundError extends Error {
  constructor(profileId: string) {
    super(`Verification check profile ${profileId} was not found.`);
    this.name = "VerificationCheckProfileNotFoundError";
  }
}

export class ReleaseCheckProfileNotFoundError extends Error {
  constructor(profileId: string) {
    super(`Release check profile ${profileId} was not found.`);
    this.name = "ReleaseCheckProfileNotFoundError";
  }
}

export class EvaluationSuiteNotFoundError extends Error {
  constructor(suiteId: string) {
    super(`Evaluation suite ${suiteId} was not found.`);
    this.name = "EvaluationSuiteNotFoundError";
  }
}

export class EvaluationSampleSetNotFoundError extends Error {
  constructor(sampleSetId: string) {
    super(`Evaluation sample set ${sampleSetId} was not found.`);
    this.name = "EvaluationSampleSetNotFoundError";
  }
}

export class EvaluationRunNotFoundError extends Error {
  constructor(runId: string) {
    super(`Evaluation run ${runId} was not found.`);
    this.name = "EvaluationRunNotFoundError";
  }
}

export class EvaluationRunItemNotFoundError extends Error {
  constructor(runItemId: string) {
    super(`Evaluation run item ${runItemId} was not found.`);
    this.name = "EvaluationRunItemNotFoundError";
  }
}

export class VerificationEvidenceNotFoundError extends Error {
  constructor(evidenceId: string) {
    super(`Verification evidence ${evidenceId} was not found.`);
    this.name = "VerificationEvidenceNotFoundError";
  }
}

export class VerificationToolDependencyError extends Error {
  constructor(toolId: string) {
    super(`Verification profile dependency tool ${toolId} was not found.`);
    this.name = "VerificationToolDependencyError";
  }
}

export class VerificationCheckProfileDependencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VerificationCheckProfileDependencyError";
  }
}

export class EvaluationSuiteNotActiveError extends Error {
  constructor(suiteId: string) {
    super(`Evaluation suite ${suiteId} is not active.`);
    this.name = "EvaluationSuiteNotActiveError";
  }
}

export class ReleaseCheckProfileDependencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReleaseCheckProfileDependencyError";
  }
}

export class VerificationOpsService {
  private readonly repository: VerificationOpsRepository;
  private readonly reviewedCaseSnapshotRepository?: ReviewedCaseSnapshotRepository;
  private readonly toolGatewayRepository: ToolGatewayRepository;
  private readonly permissionGuard: PermissionGuard;
  private readonly transactionManager: WriteTransactionManager<VerificationOpsWriteContext>;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: VerificationOpsServiceOptions) {
    this.repository = options.repository;
    this.reviewedCaseSnapshotRepository = options.reviewedCaseSnapshotRepository;
    this.toolGatewayRepository = options.toolGatewayRepository;
    this.permissionGuard = options.permissionGuard ?? new PermissionGuard();
    this.transactionManager =
      options.transactionManager ??
      createVerificationOpsTransactionManager({
        repository: this.repository,
      });
    this.createId = options.createId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  async createEvaluationSampleSet(
    actorRole: RoleKey,
    input: CreateEvaluationSampleSetInput,
  ): Promise<EvaluationSampleSetRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    return this.transactionManager.withTransaction(async ({ repository }) => {
      const sampleSetId = this.createId();
      const sampleItems: EvaluationSampleSetItemRecord[] = [];

      for (const itemInput of input.sampleItemInputs) {
        const snapshot = await requireEligibleReviewedCaseSnapshot(
          this.reviewedCaseSnapshotRepository,
          itemInput.reviewedCaseSnapshotId,
          input.module,
        );

        sampleItems.push({
          id: this.createId(),
          sample_set_id: sampleSetId,
          manuscript_id: snapshot.manuscript_id,
          snapshot_asset_id: snapshot.snapshot_asset_id,
          reviewed_case_snapshot_id: snapshot.id,
          module: snapshot.module,
          manuscript_type: snapshot.manuscript_type,
          risk_tags: itemInput.riskTags
            ? dedupePreserveOrder(itemInput.riskTags)
            : undefined,
        });
      }

      const sampleSet: EvaluationSampleSetRecord = {
        id: sampleSetId,
        name: input.name,
        module: input.module,
        manuscript_types: dedupePreserveOrder(
          sampleItems.map((item) => item.manuscript_type),
        ),
        risk_tags: flattenOptionalTags(sampleItems),
        sample_count: sampleItems.length,
        source_policy: {
          source_kind: "reviewed_case_snapshot",
          requires_deidentification_pass: true,
          requires_human_final_asset: true,
        },
        status: "draft",
        admin_only: true,
      };

      await repository.saveEvaluationSampleSet(sampleSet);
      for (const item of sampleItems) {
        await repository.saveEvaluationSampleSetItem(item);
      }

      return sampleSet;
    });
  }

  async publishEvaluationSampleSet(
    sampleSetId: string,
    actorRole: RoleKey,
  ): Promise<EvaluationSampleSetRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const existing = await this.requireEvaluationSampleSet(sampleSetId);
    // Published sample sets become frozen experiment inputs; any future change
    // should fork a new draft instead of mutating this governed asset in place.
    const published: EvaluationSampleSetRecord = {
      ...existing,
      manuscript_types: [...existing.manuscript_types],
      risk_tags: existing.risk_tags ? [...existing.risk_tags] : undefined,
      source_policy: { ...existing.source_policy },
      status: "published",
    };
    await this.repository.saveEvaluationSampleSet(published);
    return published;
  }

  listEvaluationSampleSets(): Promise<EvaluationSampleSetRecord[]> {
    return this.repository.listEvaluationSampleSets();
  }

  async listEvaluationSampleSetItemsBySampleSetId(
    sampleSetId: string,
  ): Promise<EvaluationSampleSetItemRecord[]> {
    await this.requireEvaluationSampleSet(sampleSetId);
    return this.repository.listEvaluationSampleSetItemsBySampleSetId(sampleSetId);
  }

  async createVerificationCheckProfile(
    actorRole: RoleKey,
    input: CreateVerificationCheckProfileInput,
  ): Promise<VerificationCheckProfileRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");
    await this.assertToolsExist(input.toolIds ?? []);

    const record: VerificationCheckProfileRecord = {
      id: this.createId(),
      name: input.name,
      check_type: input.checkType,
      status: "draft",
      tool_ids: input.toolIds ? [...new Set(input.toolIds)] : undefined,
      admin_only: true,
    };

    await this.repository.saveVerificationCheckProfile(record);
    return record;
  }

  async publishVerificationCheckProfile(
    profileId: string,
    actorRole: RoleKey,
  ): Promise<VerificationCheckProfileRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const existing = await this.requireVerificationCheckProfile(profileId);
    await this.assertToolsExist(existing.tool_ids ?? []);

    const published: VerificationCheckProfileRecord = {
      ...existing,
      status: "published",
      tool_ids: existing.tool_ids ? [...existing.tool_ids] : undefined,
    };
    await this.repository.saveVerificationCheckProfile(published);
    return published;
  }

  listVerificationCheckProfiles(): Promise<VerificationCheckProfileRecord[]> {
    return this.repository.listVerificationCheckProfiles();
  }

  async createReleaseCheckProfile(
    actorRole: RoleKey,
    input: CreateReleaseCheckProfileInput,
  ): Promise<ReleaseCheckProfileRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const record: ReleaseCheckProfileRecord = {
      id: this.createId(),
      name: input.name,
      check_type: input.checkType,
      status: "draft",
      verification_check_profile_ids: dedupePreserveOrder(
        input.verificationCheckProfileIds,
      ),
      admin_only: true,
    };

    await this.repository.saveReleaseCheckProfile(record);
    return record;
  }

  async publishReleaseCheckProfile(
    profileId: string,
    actorRole: RoleKey,
  ): Promise<ReleaseCheckProfileRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const existing = await this.requireReleaseCheckProfile(profileId);
    // Release gates are composed from lower-level checks, so every referenced
    // check profile must already be published before the gate can be promoted.
    await this.assertVerificationCheckProfilesPublished(
      existing.verification_check_profile_ids,
    );

    const published: ReleaseCheckProfileRecord = {
      ...existing,
      status: "published",
      verification_check_profile_ids: [...existing.verification_check_profile_ids],
    };
    await this.repository.saveReleaseCheckProfile(published);
    return published;
  }

  listReleaseCheckProfiles(): Promise<ReleaseCheckProfileRecord[]> {
    return this.repository.listReleaseCheckProfiles();
  }

  async createEvaluationSuite(
    actorRole: RoleKey,
    input: CreateEvaluationSuiteInput,
  ): Promise<EvaluationSuiteRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const record: EvaluationSuiteRecord = {
      id: this.createId(),
      name: input.name,
      suite_type: input.suiteType,
      status: "draft",
      verification_check_profile_ids: dedupePreserveOrder(
        input.verificationCheckProfileIds,
      ),
      module_scope:
        input.moduleScope === "any" ? "any" : [...new Set(input.moduleScope)],
      requires_production_baseline: input.requiresProductionBaseline ?? false,
      supports_ab_comparison: input.supportsAbComparison ?? false,
      hard_gate_policy: {
        must_use_deidentified_samples:
          input.hardGatePolicy?.mustUseDeidentifiedSamples ?? false,
        requires_parsable_output:
          input.hardGatePolicy?.requiresParsableOutput ?? false,
      },
      score_weights: {
        structure: input.scoreWeights?.structure ?? 0,
        terminology: input.scoreWeights?.terminology ?? 0,
        knowledge_coverage: input.scoreWeights?.knowledgeCoverage ?? 0,
        risk_detection: input.scoreWeights?.riskDetection ?? 0,
        human_edit_burden: input.scoreWeights?.humanEditBurden ?? 0,
        cost_and_latency: input.scoreWeights?.costAndLatency ?? 0,
      },
      admin_only: true,
    };

    await this.repository.saveEvaluationSuite(record);
    return record;
  }

  async activateEvaluationSuite(
    suiteId: string,
    actorRole: RoleKey,
  ): Promise<EvaluationSuiteRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const existing = await this.requireEvaluationSuite(suiteId);
    // Suites should only become executable after their underlying verification
    // checks are stable, otherwise historical run comparisons become unreliable.
    await this.assertVerificationCheckProfilesPublished(
      existing.verification_check_profile_ids,
    );

    const active: EvaluationSuiteRecord = {
      ...existing,
      status: "active",
      verification_check_profile_ids: [...existing.verification_check_profile_ids],
      module_scope:
        existing.module_scope === "any" ? "any" : [...existing.module_scope],
      hard_gate_policy: { ...existing.hard_gate_policy },
      score_weights: { ...existing.score_weights },
    };
    await this.repository.saveEvaluationSuite(active);
    return active;
  }

  listEvaluationSuites(): Promise<EvaluationSuiteRecord[]> {
    return this.repository.listEvaluationSuites();
  }

  async recordVerificationEvidence(
    actorRole: RoleKey,
    input: RecordVerificationEvidenceInput,
  ): Promise<VerificationEvidenceRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    if (input.checkProfileId) {
      const profile = await this.requireVerificationCheckProfile(input.checkProfileId);
      if (profile.status !== "published") {
        throw new VerificationCheckProfileDependencyError(
          `Verification evidence requires published check profile ${profile.id}.`,
        );
      }
    }

    const record: VerificationEvidenceRecord = {
      id: this.createId(),
      kind: input.kind,
      label: input.label,
      uri: input.uri,
      artifact_asset_id: input.artifactAssetId,
      check_profile_id: input.checkProfileId,
      created_at: this.now().toISOString(),
    };
    await this.repository.saveVerificationEvidence(record);
    return record;
  }

  async createEvaluationRun(
    actorRole: RoleKey,
    input: CreateEvaluationRunInput,
  ): Promise<EvaluationRunRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const suite = await this.requireEvaluationSuite(input.suiteId);
    if (suite.status !== "active") {
      throw new EvaluationSuiteNotActiveError(input.suiteId);
    }

    if (input.releaseCheckProfileId) {
      const releaseProfile = await this.requireReleaseCheckProfile(
        input.releaseCheckProfileId,
      );
      if (releaseProfile.status !== "published") {
        throw new ReleaseCheckProfileDependencyError(
          `Evaluation runs require published release check profile ${releaseProfile.id}.`,
        );
      }
    }

    let sampleSetId: string | undefined;
    let baselineBinding: FrozenExperimentBindingRecord | undefined;
    let candidateBinding: FrozenExperimentBindingRecord | undefined;
    let runItemCount = 0;
    let sampleItems: EvaluationSampleSetItemRecord[] = [];

    if (input.sampleSetId) {
      const sampleSet = await this.requireEvaluationSampleSet(input.sampleSetId);
      sampleSetId = sampleSet.id;
      sampleItems = await this.repository.listEvaluationSampleSetItemsBySampleSetId(
        sampleSet.id,
      );
      runItemCount = sampleItems.length;

      const frozenBindings = freezeExperimentBindings({
        suite,
        baselineBinding: input.baselineBinding,
        candidateBinding: input.candidateBinding,
      });
      baselineBinding = frozenBindings.baselineBinding;
      candidateBinding = frozenBindings.candidateBinding;
    }

    const record: EvaluationRunRecord = {
      id: this.createId(),
      suite_id: input.suiteId,
      sample_set_id: sampleSetId,
      baseline_binding: baselineBinding,
      candidate_binding: candidateBinding,
      release_check_profile_id: input.releaseCheckProfileId,
      run_item_count: runItemCount,
      status: "queued",
      evidence_ids: [],
      started_at: this.now().toISOString(),
      finished_at: undefined,
    };
    await this.repository.saveEvaluationRun(record);

    for (const sampleItem of sampleItems) {
      await this.repository.saveEvaluationRunItem({
        id: this.createId(),
        evaluation_run_id: record.id,
        sample_set_item_id: sampleItem.id,
        lane: candidateBinding?.lane ?? "candidate",
      });
    }

    return record;
  }

  async completeEvaluationRun(
    actorRole: RoleKey,
    input: CompleteEvaluationRunInput,
  ): Promise<EvaluationRunRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    return this.transactionManager.withTransaction(async ({ repository }) => {
      const existing = await repository.findEvaluationRunById(input.runId);
      if (!existing) {
        throw new EvaluationRunNotFoundError(input.runId);
      }

      // A completed run must point to evidence that is already persisted so the
      // admin audit trail can replay the exact verification bundle later.
      for (const evidenceId of input.evidenceIds) {
        const evidence = await repository.findVerificationEvidenceById(evidenceId);
        if (!evidence) {
          throw new VerificationEvidenceNotFoundError(evidenceId);
        }
      }

      const completed: EvaluationRunRecord = {
        ...existing,
        evidence_ids: dedupePreserveOrder(input.evidenceIds),
        status: input.status,
        finished_at: this.now().toISOString(),
      };

      await repository.saveEvaluationRun(completed);
      return completed;
    });
  }

  listEvaluationRunsBySuiteId(suiteId: string): Promise<EvaluationRunRecord[]> {
    return this.repository.listEvaluationRunsBySuiteId(suiteId);
  }

  async recordEvaluationRunItemResult(
    actorRole: RoleKey,
    input: RecordEvaluationRunItemResultInput,
  ): Promise<EvaluationRunItemRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    return this.transactionManager.withTransaction(async ({ repository }) => {
      const existing = await repository.findEvaluationRunItemById(input.runItemId);
      if (!existing) {
        throw new EvaluationRunItemNotFoundError(input.runItemId);
      }

      const updated: EvaluationRunItemRecord = {
        ...existing,
        result_asset_id: input.resultAssetId ?? existing.result_asset_id,
        hard_gate_passed: input.hardGatePassed ?? existing.hard_gate_passed,
        weighted_score: input.weightedScore ?? existing.weighted_score,
        failure_kind: input.failureKind ?? existing.failure_kind,
        failure_reason: input.failureReason ?? existing.failure_reason,
        diff_summary: input.diffSummary ?? existing.diff_summary,
        requires_human_review:
          input.requiresHumanReview ?? existing.requires_human_review,
      };

      await repository.saveEvaluationRunItem(updated);
      return updated;
    });
  }

  async listEvaluationRunItemsByRunId(
    runId: string,
  ): Promise<EvaluationRunItemRecord[]> {
    await this.requireEvaluationRun(runId);
    return this.repository.listEvaluationRunItemsByRunId(runId);
  }

  private async assertToolsExist(toolIds: string[]): Promise<void> {
    for (const toolId of toolIds) {
      const tool = await this.toolGatewayRepository.findById(toolId);
      if (!tool) {
        throw new VerificationToolDependencyError(toolId);
      }
    }
  }

  private async assertVerificationCheckProfilesPublished(
    profileIds: string[],
  ): Promise<void> {
    for (const profileId of profileIds) {
      const profile = await this.repository.findVerificationCheckProfileById(profileId);
      if (!profile || profile.status !== "published") {
        throw new VerificationCheckProfileDependencyError(
          `Referenced verification check profile ${profileId} must be published.`,
        );
      }
    }
  }

  private async requireVerificationCheckProfile(
    profileId: string,
  ): Promise<VerificationCheckProfileRecord> {
    const record = await this.repository.findVerificationCheckProfileById(profileId);
    if (!record) {
      throw new VerificationCheckProfileNotFoundError(profileId);
    }

    return record;
  }

  private async requireReleaseCheckProfile(
    profileId: string,
  ): Promise<ReleaseCheckProfileRecord> {
    const record = await this.repository.findReleaseCheckProfileById(profileId);
    if (!record) {
      throw new ReleaseCheckProfileNotFoundError(profileId);
    }

    return record;
  }

  private async requireEvaluationSuite(
    suiteId: string,
  ): Promise<EvaluationSuiteRecord> {
    const record = await this.repository.findEvaluationSuiteById(suiteId);
    if (!record) {
      throw new EvaluationSuiteNotFoundError(suiteId);
    }

    return record;
  }

  private async requireEvaluationRun(runId: string): Promise<EvaluationRunRecord> {
    const record = await this.repository.findEvaluationRunById(runId);
    if (!record) {
      throw new EvaluationRunNotFoundError(runId);
    }

    return record;
  }

  private async requireEvaluationSampleSet(
    sampleSetId: string,
  ): Promise<EvaluationSampleSetRecord> {
    const record = await this.repository.findEvaluationSampleSetById(sampleSetId);
    if (!record) {
      throw new EvaluationSampleSetNotFoundError(sampleSetId);
    }

    return record;
  }
}

function createVerificationOpsTransactionManager(
  context: VerificationOpsWriteContext,
): WriteTransactionManager<VerificationOpsWriteContext> {
  if (context.repository instanceof InMemoryVerificationOpsRepository) {
    return createScopedWriteTransactionManager({
      queueKey: context.repository,
      context,
      repositories: [context.repository],
    });
  }

  return createDirectWriteTransactionManager(context);
}

function dedupePreserveOrder<T extends string>(values: T[]): T[] {
  const seen = new Set<T>();
  const result: T[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}

function flattenOptionalTags(
  items: Array<{ risk_tags?: string[] }>,
): string[] | undefined {
  const allTags = items.flatMap((item) => item.risk_tags ?? []);
  return allTags.length > 0 ? dedupePreserveOrder(allTags) : undefined;
}

export {
  EvaluationSampleSetSourceEligibilityError,
  EvaluationSampleSetSourceSnapshotNotFoundError,
  ReviewedCaseSnapshotRepositoryRequiredError,
} from "./sample-set-source-guard.ts";

export { EvaluationExperimentBindingError } from "./experiment-binding-guard.ts";
