import { randomUUID } from "node:crypto";
import type {
  HarnessControlPlaneRollbackRepository,
  HarnessEnvironmentRollbackEntryRecord,
  HarnessEnvironmentRollbackScopeInput,
  HarnessEnvironmentRollbackSnapshotRecord,
} from "./harness-control-plane-rollback-repository.ts";

export interface InMemoryHarnessControlPlaneRollbackRepositoryOptions {
  createId?: () => string;
  now?: () => string;
}

export class InMemoryHarnessControlPlaneRollbackRepository
  implements HarnessControlPlaneRollbackRepository
{
  private readonly entriesByScope = new Map<
    string,
    HarnessEnvironmentRollbackEntryRecord[]
  >();
  private readonly createId: () => string;
  private readonly now: () => string;

  constructor(
    options: InMemoryHarnessControlPlaneRollbackRepositoryOptions = {},
  ) {
    this.createId = options.createId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async appendSnapshot(input: {
    scope: HarnessEnvironmentRollbackScopeInput;
    snapshot: HarnessEnvironmentRollbackSnapshotRecord;
  }): Promise<HarnessEnvironmentRollbackEntryRecord> {
    const entry: HarnessEnvironmentRollbackEntryRecord = {
      id: this.createId(),
      scope: cloneScope(input.scope),
      snapshot: cloneSnapshot(input.snapshot),
      created_at: this.now(),
    };
    const scopeKey = toScopeKey(input.scope);
    const history = this.entriesByScope.get(scopeKey) ?? [];
    history.push(entry);
    this.entriesByScope.set(scopeKey, history);
    return cloneEntry(entry);
  }

  async getLatestSnapshot(
    scope: HarnessEnvironmentRollbackScopeInput,
  ): Promise<HarnessEnvironmentRollbackEntryRecord | undefined> {
    const history = this.entriesByScope.get(toScopeKey(scope)) ?? [];
    const entry = history.at(-1);
    return entry ? cloneEntry(entry) : undefined;
  }

  async deleteSnapshot(snapshotId: string): Promise<void> {
    for (const [scopeKey, history] of this.entriesByScope.entries()) {
      const nextHistory = history.filter((entry) => entry.id !== snapshotId);
      if (nextHistory.length === history.length) {
        continue;
      }

      if (nextHistory.length === 0) {
        this.entriesByScope.delete(scopeKey);
      } else {
        this.entriesByScope.set(scopeKey, nextHistory);
      }
      return;
    }
  }
}

function toScopeKey(scope: HarnessEnvironmentRollbackScopeInput): string {
  return `${scope.module}::${scope.manuscriptType}::${scope.templateFamilyId}`;
}

function cloneEntry(
  entry: HarnessEnvironmentRollbackEntryRecord,
): HarnessEnvironmentRollbackEntryRecord {
  return {
    id: entry.id,
    scope: cloneScope(entry.scope),
    snapshot: cloneSnapshot(entry.snapshot),
    created_at: entry.created_at,
  };
}

function cloneScope(
  scope: HarnessEnvironmentRollbackScopeInput,
): HarnessEnvironmentRollbackScopeInput {
  return {
    module: scope.module,
    manuscriptType: scope.manuscriptType,
    templateFamilyId: scope.templateFamilyId,
  };
}

function cloneSnapshot(
  snapshot: HarnessEnvironmentRollbackSnapshotRecord,
): HarnessEnvironmentRollbackSnapshotRecord {
  return {
    execution_profile_id: snapshot.execution_profile_id,
    runtime_binding_id: snapshot.runtime_binding_id,
    model_routing_policy_version_id: snapshot.model_routing_policy_version_id,
    ...(snapshot.retrieval_preset_id
      ? { retrieval_preset_id: snapshot.retrieval_preset_id }
      : {}),
    ...(snapshot.manual_review_policy_id
      ? { manual_review_policy_id: snapshot.manual_review_policy_id }
      : {}),
  };
}
