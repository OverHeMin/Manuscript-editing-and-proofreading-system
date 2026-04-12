import { randomUUID } from "node:crypto";
import {
  MANUSCRIPT_QUALITY_ACTION_LADDER,
  type ManuscriptQualityAction,
  type ManuscriptQualityFindingSummary,
  type ManuscriptQualityIssue,
  type ManuscriptQualityPackageVersionRef,
  type ManuscriptQualityScope,
  type ManuscriptQualitySeverity,
} from "@medical/contracts";
import type { ManuscriptQualityPackageRepository } from "../manuscript-quality-packages/manuscript-quality-package-repository.ts";
import type {
  ManuscriptQualityRunInput,
  ManuscriptQualityRunResult,
  ManuscriptQualityRuntimePackage,
  ManuscriptQualityWorkerAdapter,
} from "./manuscript-quality-types.ts";

const GENERAL_PROOFREADING_SCOPE = "general_proofreading";
const MEDICAL_SPECIALIZED_SCOPE = "medical_specialized";
const DEFAULT_REQUESTED_SCOPES: ManuscriptQualityScope[] = [
  GENERAL_PROOFREADING_SCOPE,
];

export interface ManuscriptQualityServiceOptions {
  workerAdapter: ManuscriptQualityWorkerAdapter;
  manuscriptQualityPackageRepository?: ManuscriptQualityPackageRepository;
  createId?: () => string;
}

export class ManuscriptQualityService {
  private readonly workerAdapter: ManuscriptQualityWorkerAdapter;
  private readonly manuscriptQualityPackageRepository?: ManuscriptQualityPackageRepository;
  private readonly createId: () => string;

  constructor(options: ManuscriptQualityServiceOptions) {
    this.workerAdapter = options.workerAdapter;
    this.manuscriptQualityPackageRepository =
      options.manuscriptQualityPackageRepository;
    this.createId = options.createId ?? (() => randomUUID());
  }

  async runChecks(input: ManuscriptQualityRunInput): Promise<ManuscriptQualityRunResult> {
    const requestedScopes = normalizeRequestedScopes(input.requestedScopes);
    const resolvedQualityPackages = await this.resolveQualityPackages(
      input.qualityPackageVersionIds ?? [],
    );
    const completedScopes: ManuscriptQualityScope[] = [];
    const issues: ManuscriptQualityIssue[] = [];

    for (const scope of requestedScopes) {
      try {
        const scopedIssues = await this.runScope(scope, input, resolvedQualityPackages);
        completedScopes.push(scope);
        issues.push(...scopedIssues);
      } catch (error) {
        issues.push(
          buildWorkerFallbackIssue({
            createId: this.createId,
            scope,
            error,
          }),
        );
      }
    }

    return {
      requested_scopes: requestedScopes,
      completed_scopes: completedScopes,
      issues,
      quality_findings_summary: summarizeIssues(issues),
      resolved_quality_packages: resolvedQualityPackages.map(toPackageVersionRef),
    };
  }

  private async runScope(
    scope: ManuscriptQualityScope,
    input: ManuscriptQualityRunInput,
    qualityPackages: ManuscriptQualityRuntimePackage[],
  ): Promise<ManuscriptQualityIssue[]> {
    const blocks = input.blocks.map((block) => ({ ...block }));
    const tableSnapshots = input.tableSnapshots?.map((table) =>
      structuredClone(table),
    );

    if (scope === GENERAL_PROOFREADING_SCOPE) {
      const workerResult = await this.workerAdapter.runGeneralProofreading({
        blocks,
        ...(tableSnapshots ? { tableSnapshots } : {}),
        ...(qualityPackages.length > 0
          ? {
              qualityPackages: qualityPackages.map((entry) => cloneQualityPackage(entry)),
            }
          : {}),
      });
      return workerResult.issues.map((issue) => structuredClone(issue));
    }

    if (!this.workerAdapter.runMedicalSpecialized) {
      throw new Error("Medical specialized quality worker is not configured.");
    }

    const workerResult = await this.workerAdapter.runMedicalSpecialized({
      blocks,
      ...(tableSnapshots ? { tableSnapshots } : {}),
      ...(qualityPackages.length > 0
        ? {
            qualityPackages: qualityPackages.map((entry) => cloneQualityPackage(entry)),
          }
        : {}),
    });
    return workerResult.issues.map((issue) =>
      applyTargetModulePolicy(structuredClone(issue), input.targetModule),
    );
  }

  private async resolveQualityPackages(
    qualityPackageVersionIds: string[],
  ): Promise<ManuscriptQualityRuntimePackage[]> {
    const dedupedIds = [...new Set(qualityPackageVersionIds)];
    if (dedupedIds.length === 0) {
      return [];
    }

    if (!this.manuscriptQualityPackageRepository) {
      throw new Error(
        "Manuscript quality package repository is unavailable for resolving quality packages.",
      );
    }

    const result: ManuscriptQualityRuntimePackage[] = [];
    for (const qualityPackageVersionId of dedupedIds) {
      const record = await this.manuscriptQualityPackageRepository.findById(
        qualityPackageVersionId,
      );
      if (!record || record.status !== "published") {
        throw new Error(
          `Published manuscript quality package ${qualityPackageVersionId} was not found.`,
        );
      }

      result.push({
        package_id: record.id,
        package_name: record.package_name,
        package_kind: record.package_kind,
        target_scopes: [...record.target_scopes],
        version: record.version,
        manifest: structuredClone(record.manifest),
      });
    }

    return result;
  }
}

function normalizeRequestedScopes(
  scopes: ManuscriptQualityRunInput["requestedScopes"],
): ManuscriptQualityScope[] {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    return [...DEFAULT_REQUESTED_SCOPES];
  }

  const normalized = scopes.filter(
    (scope): scope is ManuscriptQualityScope =>
      scope === GENERAL_PROOFREADING_SCOPE || scope === MEDICAL_SPECIALIZED_SCOPE,
  );

  return normalized.length > 0 ? [...new Set(normalized)] : [...DEFAULT_REQUESTED_SCOPES];
}

function summarizeIssues(
  issues: ManuscriptQualityIssue[],
): ManuscriptQualityFindingSummary {
  const issue_count_by_scope: Partial<Record<ManuscriptQualityScope, number>> = {};
  const issue_count_by_action: Partial<Record<ManuscriptQualityAction, number>> = {};
  const issue_count_by_severity: Partial<Record<ManuscriptQualitySeverity, number>> = {};

  for (const issue of issues) {
    issue_count_by_scope[issue.module_scope] =
      (issue_count_by_scope[issue.module_scope] ?? 0) + 1;
    issue_count_by_action[issue.action] =
      (issue_count_by_action[issue.action] ?? 0) + 1;
    issue_count_by_severity[issue.severity] =
      (issue_count_by_severity[issue.severity] ?? 0) + 1;
  }

  return {
    total_issue_count: issues.length,
    issue_count_by_scope,
    issue_count_by_action,
    issue_count_by_severity,
    highest_action: issues.length > 0 ? findHighestAction(issues) : undefined,
    representative_issue_ids: issues.slice(0, 5).map((issue) => issue.issue_id),
  };
}

function findHighestAction(
  issues: ManuscriptQualityIssue[],
): ManuscriptQualityAction {
  const rankings = new Map(
    MANUSCRIPT_QUALITY_ACTION_LADDER.map((action, index) => [action, index]),
  );

  return issues.reduce<ManuscriptQualityAction>((highest, issue) => {
    const currentRank = rankings.get(issue.action) ?? 0;
    const highestRank = rankings.get(highest) ?? 0;
    return currentRank > highestRank ? issue.action : highest;
  }, MANUSCRIPT_QUALITY_ACTION_LADDER[0]);
}

function buildWorkerFallbackIssue(input: {
  createId: () => string;
  scope: ManuscriptQualityScope;
  error: unknown;
}): ManuscriptQualityIssue {
  const message =
    input.error instanceof Error
      ? input.error.message
      : "Manuscript quality worker failed unexpectedly.";

  return {
    issue_id: input.createId(),
    module_scope: input.scope,
    issue_type: "system.worker_degraded",
    category: "system_fallback",
    severity: "high",
    action: "manual_review",
    confidence: 1,
    source_kind: "system_fallback",
    source_id: `manuscript-quality/${input.scope}/worker-fallback`,
    text_excerpt: input.scope,
    explanation: `${formatScopeLabel(input.scope)} worker degraded to manual review: ${message}`,
  };
}

function applyTargetModulePolicy(
  issue: ManuscriptQualityIssue,
  targetModule: ManuscriptQualityRunInput["targetModule"],
): ManuscriptQualityIssue {
  if (
    issue.module_scope !== MEDICAL_SPECIALIZED_SCOPE ||
    targetModule !== "screening"
  ) {
    return issue;
  }

  if (
    issue.action === "manual_review" ||
    issue.action === "block"
  ) {
    return issue;
  }

  return {
    ...issue,
    action: "manual_review",
    explanation: `${issue.explanation} Screening keeps medical findings at manual review or higher.`,
  };
}

function formatScopeLabel(scope: ManuscriptQualityScope): string {
  return scope === MEDICAL_SPECIALIZED_SCOPE
    ? "Medical specialized quality"
    : "General proofreading";
}

function cloneQualityPackage(
  input: ManuscriptQualityRuntimePackage,
): ManuscriptQualityRuntimePackage {
  return {
    package_id: input.package_id,
    package_name: input.package_name,
    package_kind: input.package_kind,
    target_scopes: [...input.target_scopes],
    version: input.version,
    manifest: structuredClone(input.manifest),
  };
}

function toPackageVersionRef(
  input: ManuscriptQualityRuntimePackage,
): ManuscriptQualityPackageVersionRef {
  return {
    package_id: input.package_id,
    package_name: input.package_name,
    package_kind: input.package_kind,
    target_scopes: [...input.target_scopes],
    version: input.version,
  };
}
