import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { ToolGatewayRepository } from "../tool-gateway/tool-gateway-repository.ts";
import {
  createDirectWriteTransactionManager,
  createScopedWriteTransactionManager,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import {
  InMemoryVerificationOpsRepository,
} from "./in-memory-verification-ops-repository.ts";
import type {
  EvaluationRunRecord,
  EvaluationSuiteRecord,
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
  releaseCheckProfileId?: string;
}

export interface CompleteEvaluationRunInput {
  runId: string;
  status: Extract<EvaluationRunRecord["status"], "passed" | "failed">;
  evidenceIds: string[];
}

interface VerificationOpsWriteContext {
  repository: VerificationOpsRepository;
}

export interface VerificationOpsServiceOptions {
  repository: VerificationOpsRepository;
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

export class EvaluationRunNotFoundError extends Error {
  constructor(runId: string) {
    super(`Evaluation run ${runId} was not found.`);
    this.name = "EvaluationRunNotFoundError";
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
  private readonly toolGatewayRepository: ToolGatewayRepository;
  private readonly permissionGuard: PermissionGuard;
  private readonly transactionManager: WriteTransactionManager<VerificationOpsWriteContext>;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: VerificationOpsServiceOptions) {
    this.repository = options.repository;
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

    const record: EvaluationRunRecord = {
      id: this.createId(),
      suite_id: input.suiteId,
      release_check_profile_id: input.releaseCheckProfileId,
      status: "queued",
      evidence_ids: [],
      started_at: this.now().toISOString(),
      finished_at: undefined,
    };
    await this.repository.saveEvaluationRun(record);
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

function dedupePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}
