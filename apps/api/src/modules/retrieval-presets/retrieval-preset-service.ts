import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { TemplateModule } from "../templates/template-record.ts";
import type { RetrievalPresetRecord } from "./retrieval-preset-record.ts";
import type { RetrievalPresetRepository } from "./retrieval-preset-repository.ts";

export interface CreateRetrievalPresetInput {
  module: TemplateModule;
  manuscriptType: ManuscriptType;
  templateFamilyId: string;
  name: string;
  topK: number;
  sectionFilters?: string[];
  riskTagFilters?: string[];
  rerankEnabled: boolean;
  citationRequired: boolean;
  minRetrievalScore?: number;
}

export interface RetrievalPresetScopeInput {
  module: TemplateModule;
  manuscriptType: ManuscriptType;
  templateFamilyId: string;
}

export interface RetrievalPresetServiceOptions {
  repository: RetrievalPresetRepository;
  permissionGuard?: PermissionGuard;
  createId?: () => string;
}

export class RetrievalPresetNotFoundError extends Error {
  constructor(presetId: string) {
    super(`Retrieval preset ${presetId} was not found.`);
    this.name = "RetrievalPresetNotFoundError";
  }
}

export class RetrievalPresetStatusTransitionError extends Error {
  constructor(presetId: string, fromStatus: string, toStatus: string) {
    super(
      `Retrieval preset ${presetId} cannot transition from ${fromStatus} to ${toStatus}.`,
    );
    this.name = "RetrievalPresetStatusTransitionError";
  }
}

export class ActiveRetrievalPresetNotFoundError extends Error {
  constructor(module: string, manuscriptType: string, templateFamilyId: string) {
    super(
      `No active retrieval preset exists for ${module}/${manuscriptType}/${templateFamilyId}.`,
    );
    this.name = "ActiveRetrievalPresetNotFoundError";
  }
}

export class RetrievalPresetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetrievalPresetValidationError";
  }
}

export class RetrievalPresetService {
  private readonly repository: RetrievalPresetRepository;
  private readonly permissionGuard: PermissionGuard;
  private readonly createId: () => string;

  constructor(options: RetrievalPresetServiceOptions) {
    this.repository = options.repository;
    this.permissionGuard = options.permissionGuard ?? new PermissionGuard();
    this.createId = options.createId ?? (() => randomUUID());
  }

  async createPreset(
    actorRole: RoleKey,
    input: CreateRetrievalPresetInput,
  ): Promise<RetrievalPresetRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const record = await this.buildDraftRecord(input);
    this.assertValidRecord(record);
    await this.repository.save(record);
    return record;
  }

  async activatePreset(
    presetId: string,
    actorRole: RoleKey,
  ): Promise<RetrievalPresetRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const preset = await this.requirePreset(presetId);
    if (preset.status === "active") {
      this.assertValidRecord(preset);
      return preset;
    }
    if (preset.status !== "draft" && preset.status !== "archived") {
      throw new RetrievalPresetStatusTransitionError(
        presetId,
        preset.status,
        "active",
      );
    }

    this.assertValidRecord(preset);

    const activePresets = await this.repository.listByScope(
      preset.module,
      preset.manuscript_type,
      preset.template_family_id,
      true,
    );
    for (const existing of activePresets) {
      if (existing.id !== preset.id) {
        await this.repository.save({
          ...existing,
          status: "archived",
        });
      }
    }

    const activePreset: RetrievalPresetRecord = {
      ...preset,
      status: "active",
    };
    await this.repository.save(activePreset);
    return activePreset;
  }

  async archivePreset(
    presetId: string,
    actorRole: RoleKey,
  ): Promise<RetrievalPresetRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const preset = await this.requirePreset(presetId);
    if (preset.status === "archived") {
      return preset;
    }

    const archivedPreset: RetrievalPresetRecord = {
      ...preset,
      status: "archived",
    };
    await this.repository.save(archivedPreset);
    return archivedPreset;
  }

  async getPreset(presetId: string): Promise<RetrievalPresetRecord> {
    return this.requirePreset(presetId);
  }

  listPresetsForScope(
    input: RetrievalPresetScopeInput & { activeOnly?: boolean },
  ): Promise<RetrievalPresetRecord[]> {
    return this.repository.listByScope(
      input.module,
      input.manuscriptType,
      input.templateFamilyId,
      input.activeOnly,
    );
  }

  async getActivePresetForScope(
    input: RetrievalPresetScopeInput,
  ): Promise<RetrievalPresetRecord> {
    const match = (
      await this.repository.listByScope(
        input.module,
        input.manuscriptType,
        input.templateFamilyId,
        true,
      )
    )
      .sort((left, right) => right.version - left.version)[0];

    if (!match) {
      throw new ActiveRetrievalPresetNotFoundError(
        input.module,
        input.manuscriptType,
        input.templateFamilyId,
      );
    }

    return match;
  }

  private async buildDraftRecord(
    input: CreateRetrievalPresetInput,
  ): Promise<RetrievalPresetRecord> {
    const version = await this.repository.reserveNextVersion(
      input.module,
      input.manuscriptType,
      input.templateFamilyId,
    );

    const sectionFilters = normalizeStringArray(input.sectionFilters);
    const riskTagFilters = normalizeStringArray(input.riskTagFilters);

    return {
      id: this.createId(),
      module: input.module,
      manuscript_type: input.manuscriptType,
      template_family_id: input.templateFamilyId,
      name: input.name.trim(),
      top_k: input.topK,
      ...(sectionFilters.length > 0 ? { section_filters: sectionFilters } : {}),
      ...(riskTagFilters.length > 0 ? { risk_tag_filters: riskTagFilters } : {}),
      rerank_enabled: input.rerankEnabled,
      citation_required: input.citationRequired,
      ...(input.minRetrievalScore === undefined
        ? {}
        : { min_retrieval_score: input.minRetrievalScore }),
      status: "draft",
      version,
    };
  }

  private assertValidRecord(record: RetrievalPresetRecord): void {
    if (record.name.length === 0) {
      throw new RetrievalPresetValidationError("Retrieval preset name is required.");
    }
    if (!Number.isInteger(record.top_k) || record.top_k <= 0) {
      throw new RetrievalPresetValidationError(
        "Retrieval preset top_k must be a positive integer.",
      );
    }
    if (
      record.min_retrieval_score !== undefined &&
      (record.min_retrieval_score < 0 || record.min_retrieval_score > 1)
    ) {
      throw new RetrievalPresetValidationError(
        "Retrieval preset min_retrieval_score must be between 0 and 1.",
      );
    }
  }

  private async requirePreset(presetId: string): Promise<RetrievalPresetRecord> {
    const preset = await this.repository.findById(presetId);
    if (!preset) {
      throw new RetrievalPresetNotFoundError(presetId);
    }

    return preset;
  }
}

function normalizeStringArray(values?: string[]): string[] {
  if (!values) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (normalized.length === 0 || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}
