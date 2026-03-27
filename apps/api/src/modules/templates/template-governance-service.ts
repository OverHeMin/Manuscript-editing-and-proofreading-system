import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import {
  createDirectWriteTransactionManager,
  createScopedWriteTransactionManager,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import {
  InMemoryModuleTemplateRepository,
  InMemoryTemplateFamilyRepository,
} from "./in-memory-template-family-repository.ts";
import type {
  ModuleTemplateRepository,
  TemplateFamilyRepository,
} from "./template-repository.ts";
import type {
  ModuleTemplateRecord,
  TemplateFamilyRecord,
  TemplateModule,
} from "./template-record.ts";

export interface CreateTemplateFamilyInput {
  manuscriptType: TemplateFamilyRecord["manuscript_type"];
  name: string;
}

export interface UpdateTemplateFamilyInput {
  name?: string;
  status?: TemplateFamilyRecord["status"];
}

export interface CreateModuleTemplateDraftInput {
  templateFamilyId: string;
  module: TemplateModule;
  manuscriptType: ModuleTemplateRecord["manuscript_type"];
  prompt: string;
  checklist?: string[];
  sectionRequirements?: string[];
}

export interface TemplateGovernanceServiceOptions {
  templateFamilyRepository: TemplateFamilyRepository;
  moduleTemplateRepository: ModuleTemplateRepository;
  transactionManager?: WriteTransactionManager<TemplateWriteContext>;
  permissionGuard?: PermissionGuard;
  createId?: () => string;
  now?: () => Date;
}

interface TemplateWriteContext {
  templateFamilyRepository: TemplateFamilyRepository;
  moduleTemplateRepository: ModuleTemplateRepository;
}

export class TemplateFamilyNotFoundError extends Error {
  constructor(templateFamilyId: string) {
    super(`Template family ${templateFamilyId} was not found.`);
    this.name = "TemplateFamilyNotFoundError";
  }
}

export class ModuleTemplateNotFoundError extends Error {
  constructor(moduleTemplateId: string) {
    super(`Module template ${moduleTemplateId} was not found.`);
    this.name = "ModuleTemplateNotFoundError";
  }
}

export class ModuleTemplateStatusTransitionError extends Error {
  constructor(moduleTemplateId: string, fromStatus: string, toStatus: string) {
    super(
      `Module template ${moduleTemplateId} cannot transition from ${fromStatus} to ${toStatus}.`,
    );
    this.name = "ModuleTemplateStatusTransitionError";
  }
}

export class TemplateFamilyManuscriptTypeMismatchError extends Error {
  constructor(
    templateFamilyId: string,
    familyType: string,
    templateType: string,
  ) {
    super(
      `Template family ${templateFamilyId} expects manuscript type ${familyType}, received ${templateType}.`,
    );
    this.name = "TemplateFamilyManuscriptTypeMismatchError";
  }
}

export class TemplateGovernanceService {
  private readonly templateFamilyRepository: TemplateFamilyRepository;
  private readonly moduleTemplateRepository: ModuleTemplateRepository;
  private readonly transactionManager: WriteTransactionManager<TemplateWriteContext>;
  private readonly permissionGuard: PermissionGuard;
  private readonly createId: () => string;

  constructor(options: TemplateGovernanceServiceOptions) {
    this.templateFamilyRepository = options.templateFamilyRepository;
    this.moduleTemplateRepository = options.moduleTemplateRepository;
    this.transactionManager =
      options.transactionManager ??
      createTemplateWriteTransactionManager({
        templateFamilyRepository: this.templateFamilyRepository,
        moduleTemplateRepository: this.moduleTemplateRepository,
      });
    this.permissionGuard = options.permissionGuard ?? new PermissionGuard();
    this.createId = options.createId ?? (() => randomUUID());
  }

  async createTemplateFamily(
    input: CreateTemplateFamilyInput,
  ): Promise<TemplateFamilyRecord> {
    const record: TemplateFamilyRecord = {
      id: this.createId(),
      manuscript_type: input.manuscriptType,
      name: input.name,
      status: "draft",
    };

    await this.templateFamilyRepository.save(record);
    return record;
  }

  async createModuleTemplateDraft(
    input: CreateModuleTemplateDraftInput,
  ): Promise<ModuleTemplateRecord> {
    return this.transactionManager.withTransaction(
      async ({ templateFamilyRepository, moduleTemplateRepository }) => {
        const templateFamily = await templateFamilyRepository.findById(
          input.templateFamilyId,
        );

        if (!templateFamily) {
          throw new TemplateFamilyNotFoundError(input.templateFamilyId);
        }

        if (templateFamily.manuscript_type !== input.manuscriptType) {
          throw new TemplateFamilyManuscriptTypeMismatchError(
            input.templateFamilyId,
            templateFamily.manuscript_type,
            input.manuscriptType,
          );
        }

        const record: ModuleTemplateRecord = {
          id: this.createId(),
          template_family_id: input.templateFamilyId,
          module: input.module,
          manuscript_type: input.manuscriptType,
          version_no: await moduleTemplateRepository.reserveNextVersionNumber(
            input.templateFamilyId,
            input.module,
          ),
          status: "draft",
          prompt: input.prompt,
          checklist: input.checklist,
          section_requirements: input.sectionRequirements,
        };

        await moduleTemplateRepository.save(record);
        return record;
      },
    );
  }

  async publishModuleTemplate(
    moduleTemplateId: string,
    actorRole: RoleKey,
  ): Promise<ModuleTemplateRecord> {
    this.permissionGuard.assert(actorRole, "templates.publish");

    return this.transactionManager.withTransaction(
      async ({ moduleTemplateRepository }) => {
        const template = await moduleTemplateRepository.findById(moduleTemplateId);

        if (!template) {
          throw new ModuleTemplateNotFoundError(moduleTemplateId);
        }

        if (template.status !== "draft") {
          throw new ModuleTemplateStatusTransitionError(
            moduleTemplateId,
            template.status,
            "published",
          );
        }

        const existingTemplates =
          await moduleTemplateRepository.listByTemplateFamilyIdAndModule(
            template.template_family_id,
            template.module,
          );

        for (const existingTemplate of existingTemplates) {
          if (
            existingTemplate.id !== template.id &&
            existingTemplate.status === "published"
          ) {
            await moduleTemplateRepository.save({
              ...existingTemplate,
              status: "archived",
            });
          }
        }

        const publishedTemplate: ModuleTemplateRecord = {
          ...template,
          status: "published",
        };

        await moduleTemplateRepository.save(publishedTemplate);
        return publishedTemplate;
      },
    );
  }

  async updateTemplateFamily(
    templateFamilyId: string,
    input: UpdateTemplateFamilyInput,
  ): Promise<TemplateFamilyRecord> {
    const templateFamily = await this.templateFamilyRepository.findById(
      templateFamilyId,
    );

    if (!templateFamily) {
      throw new TemplateFamilyNotFoundError(templateFamilyId);
    }

    const updatedFamily: TemplateFamilyRecord = {
      ...templateFamily,
      name: input.name ?? templateFamily.name,
      status: input.status ?? templateFamily.status,
    };

    await this.templateFamilyRepository.save(updatedFamily);
    return updatedFamily;
  }

  listTemplateFamilies(): Promise<TemplateFamilyRecord[]> {
    return this.templateFamilyRepository.list();
  }
}

function createTemplateWriteTransactionManager(
  context: TemplateWriteContext,
): WriteTransactionManager<TemplateWriteContext> {
  if (
    context.templateFamilyRepository instanceof InMemoryTemplateFamilyRepository &&
    context.moduleTemplateRepository instanceof InMemoryModuleTemplateRepository
  ) {
    return createScopedWriteTransactionManager({
      queueKey: context.moduleTemplateRepository,
      context,
      repositories: [
        context.templateFamilyRepository,
        context.moduleTemplateRepository,
      ],
    });
  }

  return createDirectWriteTransactionManager(context);
}
