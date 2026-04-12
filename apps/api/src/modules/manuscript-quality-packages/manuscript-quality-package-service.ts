import { randomUUID } from "node:crypto";
import type {
  ManuscriptQualityPackageKind,
  ManuscriptQualityPackageStatus,
  ManuscriptQualityScope,
} from "@medical/contracts";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type {
  ListManuscriptQualityPackagesByScopeInput,
  ManuscriptQualityPackageRepository,
} from "./manuscript-quality-package-repository.ts";
import type { ManuscriptQualityPackageRecord } from "./manuscript-quality-package-record.ts";
import {
  isLegacyGeneralStylePackageManifest,
  parseGeneralStylePackageManifest,
} from "./general-style-package-schema.ts";
import {
  isLegacyMedicalAnalyzerPackageManifest,
  parseMedicalAnalyzerPackageManifest,
} from "./medical-analyzer-package-schema.ts";

export interface CreateManuscriptQualityPackageDraftInput {
  packageName: string;
  packageKind: ManuscriptQualityPackageKind;
  targetScopes: ManuscriptQualityScope[];
  manifest: Record<string, unknown>;
}

export interface ListManuscriptQualityPackageVersionsInput
  extends ListManuscriptQualityPackagesByScopeInput {}

export interface ManuscriptQualityPackageServiceOptions {
  repository: ManuscriptQualityPackageRepository;
  permissionGuard?: PermissionGuard;
  createId?: () => string;
}

export class ManuscriptQualityPackageNotFoundError extends Error {
  constructor(packageVersionId: string) {
    super(`Manuscript quality package version ${packageVersionId} was not found.`);
    this.name = "ManuscriptQualityPackageNotFoundError";
  }
}

export class ManuscriptQualityPackageStatusTransitionError extends Error {
  constructor(
    packageVersionId: string,
    from: ManuscriptQualityPackageStatus,
    to: ManuscriptQualityPackageStatus,
  ) {
    super(
      `Manuscript quality package version ${packageVersionId} cannot transition from ${from} to ${to}.`,
    );
    this.name = "ManuscriptQualityPackageStatusTransitionError";
  }
}

export { ManuscriptQualityPackageValidationError } from "./general-style-package-schema.ts";

export class ManuscriptQualityPackageService {
  private readonly repository: ManuscriptQualityPackageRepository;
  private readonly permissionGuard: PermissionGuard;
  private readonly createId: () => string;

  constructor(options: ManuscriptQualityPackageServiceOptions) {
    this.repository = options.repository;
    this.permissionGuard = options.permissionGuard ?? new PermissionGuard();
    this.createId = options.createId ?? (() => randomUUID());
  }

  async createDraftVersion(
    actorRole: RoleKey,
    input: CreateManuscriptQualityPackageDraftInput,
  ): Promise<ManuscriptQualityPackageRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");
    validatePackageManifest(input.packageKind, input.manifest);

    const version = await this.repository.reserveNextVersion(
      input.packageKind,
      input.packageName,
      [...input.targetScopes],
    );
    const draft: ManuscriptQualityPackageRecord = {
      id: this.createId(),
      package_name: input.packageName,
      package_kind: input.packageKind,
      target_scopes: normalizeScopes(input.targetScopes),
      version,
      status: "draft",
      manifest: structuredClone(input.manifest),
    };

    await this.repository.save(draft);
    return cloneRecord(draft);
  }

  async publishVersion(
    packageVersionId: string,
    actorRole: RoleKey,
  ): Promise<ManuscriptQualityPackageRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const record = await this.repository.findById(packageVersionId);
    if (!record) {
      throw new ManuscriptQualityPackageNotFoundError(packageVersionId);
    }

    if (record.status !== "draft") {
      throw new ManuscriptQualityPackageStatusTransitionError(
        packageVersionId,
        record.status,
        "published",
      );
    }

    const related = await this.repository.listByScope({
      packageKind: record.package_kind,
      packageName: record.package_name,
    });
    for (const existing of related) {
      if (
        existing.id !== record.id &&
        existing.status === "published" &&
        sameScopes(existing.target_scopes, record.target_scopes)
      ) {
        await this.repository.save({
          ...existing,
          status: "archived",
          target_scopes: [...existing.target_scopes],
          manifest: structuredClone(existing.manifest),
        });
      }
    }

    const published: ManuscriptQualityPackageRecord = {
      ...record,
      status: "published",
      target_scopes: [...record.target_scopes],
      manifest: structuredClone(record.manifest),
    };
    await this.repository.save(published);
    return cloneRecord(published);
  }

  async listPackageVersions(
    input: ListManuscriptQualityPackageVersionsInput = {},
  ): Promise<ManuscriptQualityPackageRecord[]> {
    return (await this.repository.listByScope(input)).map(cloneRecord);
  }
}

function validatePackageManifest(
  packageKind: ManuscriptQualityPackageKind,
  manifest: Record<string, unknown>,
): void {
  if (packageKind === "general_style_package") {
    if (isLegacyGeneralStylePackageManifest(manifest)) {
      return;
    }

    parseGeneralStylePackageManifest(manifest);
    return;
  }

  if (packageKind === "medical_analyzer_package") {
    if (isLegacyMedicalAnalyzerPackageManifest(manifest)) {
      return;
    }

    parseMedicalAnalyzerPackageManifest(manifest);
  }
}

function normalizeScopes(
  scopes: readonly ManuscriptQualityScope[],
): ManuscriptQualityScope[] {
  return [...scopes].sort((left, right) => left.localeCompare(right));
}

function sameScopes(
  left: readonly ManuscriptQualityScope[],
  right: readonly ManuscriptQualityScope[],
): boolean {
  const normalizedLeft = normalizeScopes(left);
  const normalizedRight = normalizeScopes(right);
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index])
  );
}

function cloneRecord(
  record: ManuscriptQualityPackageRecord,
): ManuscriptQualityPackageRecord {
  return {
    ...record,
    target_scopes: [...record.target_scopes],
    manifest: structuredClone(record.manifest),
  };
}
