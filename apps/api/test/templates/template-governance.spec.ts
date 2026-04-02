import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError, PermissionGuard } from "../../src/auth/permission-guard.ts";
import { InMemoryLearningCandidateRepository } from "../../src/modules/learning/in-memory-learning-repository.ts";
import { createTemplateApi } from "../../src/modules/templates/template-api.ts";
import {
  InMemoryModuleTemplateRepository,
  InMemoryTemplateFamilyRepository,
} from "../../src/modules/templates/in-memory-template-family-repository.ts";
import { TemplateGovernanceService } from "../../src/modules/templates/template-governance-service.ts";
import type { ModuleTemplateRecord } from "../../src/modules/templates/template-record.ts";

class FailingModuleTemplateRepository extends InMemoryModuleTemplateRepository {
  constructor(
    private readonly shouldFail: (record: ModuleTemplateRecord) => boolean,
  ) {
    super();
  }

  override async save(record: ModuleTemplateRecord): Promise<void> {
    if (this.shouldFail(record)) {
      throw new Error(`Injected template write failure for ${record.id}.`);
    }

    await super.save(record);
  }
}

function createTemplateHarness(
  moduleTemplateRepository: InMemoryModuleTemplateRepository = new InMemoryModuleTemplateRepository(),
  options: {
    issuedIds?: string[];
  } = {},
) {
  const templateFamilyRepository = new InMemoryTemplateFamilyRepository();
  const learningCandidateRepository = new InMemoryLearningCandidateRepository();
  const issuedIds = [...(options.issuedIds ?? ["family-1", "template-1", "template-2"])];
  const nextId = () => {
    const value = issuedIds.shift();
    assert.ok(value, "Expected a template test id to be available.");
    return value;
  };
  const service = new TemplateGovernanceService({
    templateFamilyRepository,
    moduleTemplateRepository,
    learningCandidateRepository,
    permissionGuard: new PermissionGuard(),
    now: () => new Date("2026-03-27T06:10:00.000Z"),
    createId: nextId,
  });
  const api = createTemplateApi({
    templateService: service,
  });

  return {
    api,
    service,
    learningCandidateRepository,
    moduleTemplateRepository,
  };
}

test("module template draft revisions can be created from an approved learning candidate", async () => {
  const { api, service, learningCandidateRepository } = createTemplateHarness();

  await learningCandidateRepository.save({
    id: "candidate-approved-1",
    type: "template_update_candidate",
    status: "approved",
    module: "editing",
    manuscript_type: "review",
    title: "综述编加模板修订",
    proposal_text: "补充结果与讨论衔接检查项。",
    created_by: "editor-1",
    created_at: "2026-03-27T06:00:00.000Z",
    updated_at: "2026-03-27T06:05:00.000Z",
  });

  const family = await api.createTemplateFamily({
    manuscriptType: "review",
    name: "综述模板族",
  });

  const template = await service.createModuleTemplateDraftFromLearningCandidate(
    "admin",
    {
      sourceLearningCandidateId: "candidate-approved-1",
      templateFamilyId: family.body.id,
      module: "editing",
      manuscriptType: "review",
      prompt: "统一医学术语并补充结果与讨论衔接检查。",
      checklist: ["结果段完整性", "讨论段衔接性"],
    },
  );

  assert.equal(template.status, "draft");
  assert.equal(template.source_learning_candidate_id, "candidate-approved-1");
});

test("create template family and module template draft for a manuscript type", async () => {
  const { api } = createTemplateHarness();

  const family = await api.createTemplateFamily({
    manuscriptType: "review",
    name: "综述稿基础模板族",
  });
  const template = await api.createModuleTemplateDraft({
    templateFamilyId: family.body.id,
    module: "editing",
    manuscriptType: "review",
    prompt: "统一医学术语并优化结构。",
    checklist: ["术语统一", "标题层级检查"],
    sectionRequirements: ["results", "discussion"],
  });

  assert.equal(family.status, 201);
  assert.deepEqual(family.body, {
    id: "family-1",
    manuscript_type: "review",
    name: "综述稿基础模板族",
    status: "draft",
  });

  assert.equal(template.status, 201);
  assert.deepEqual(template.body, {
    id: "template-1",
    template_family_id: "family-1",
    module: "editing",
    manuscript_type: "review",
    version_no: 1,
    status: "draft",
    prompt: "统一医学术语并优化结构。",
    checklist: ["术语统一", "标题层级检查"],
    section_requirements: ["results", "discussion"],
  });
});

test("module template drafts can be updated before publish without changing their governed identity", async () => {
  const { api } = createTemplateHarness();

  const family = await api.createTemplateFamily({
    manuscriptType: "review",
    name: "Draft update family",
  });
  const template = await api.createModuleTemplateDraft({
    templateFamilyId: family.body.id,
    module: "editing",
    manuscriptType: "review",
    prompt: "Original editing prompt.",
    checklist: ["Terminology"],
    sectionRequirements: ["discussion"],
  });

  const updated = await api.updateModuleTemplateDraft({
    moduleTemplateId: template.body.id,
    input: {
      prompt: "Updated editing prompt.",
      checklist: ["Terminology", "Abbreviations"],
      sectionRequirements: ["results", "discussion"],
    },
  });

  assert.equal(updated.status, 200);
  assert.deepEqual(updated.body, {
    id: "template-1",
    template_family_id: "family-1",
    module: "editing",
    manuscript_type: "review",
    version_no: 1,
    status: "draft",
    prompt: "Updated editing prompt.",
    checklist: ["Terminology", "Abbreviations"],
    section_requirements: ["results", "discussion"],
  });
});

test("publishing a module template is admin only", async () => {
  const { api } = createTemplateHarness();

  const family = await api.createTemplateFamily({
    manuscriptType: "clinical_study",
    name: "临床研究模板族",
  });
  const template = await api.createModuleTemplateDraft({
    templateFamilyId: family.body.id,
    module: "screening",
    manuscriptType: "clinical_study",
    prompt: "检查研究设计与伦理合规。",
  });

  await assert.rejects(
    () =>
      api.publishModuleTemplate({
        moduleTemplateId: template.body.id,
        actorRole: "editor",
      }),
    AuthorizationError,
  );

  const published = await api.publishModuleTemplate({
    moduleTemplateId: template.body.id,
    actorRole: "admin",
  });

  assert.equal(published.status, 200);
  assert.equal(published.body.status, "published");
});

test("published module templates cannot be edited through the draft update flow", async () => {
  const { api } = createTemplateHarness();

  const family = await api.createTemplateFamily({
    manuscriptType: "clinical_study",
    name: "Published family",
  });
  const template = await api.createModuleTemplateDraft({
    templateFamilyId: family.body.id,
    module: "screening",
    manuscriptType: "clinical_study",
    prompt: "Review study design and ethics statements.",
  });
  await api.publishModuleTemplate({
    moduleTemplateId: template.body.id,
    actorRole: "admin",
  });

  await assert.rejects(
    () =>
      api.updateModuleTemplateDraft({
        moduleTemplateId: template.body.id,
        input: {
          prompt: "This should not be accepted for a published template.",
        },
      }),
    /draft/i,
  );
});

test("template families can be updated and listed while drafts are being prepared", async () => {
  const { api } = createTemplateHarness();

  const family = await api.createTemplateFamily({
    manuscriptType: "meta_analysis",
    name: "Meta 初始模板族",
  });

  const updated = await api.updateTemplateFamily({
    templateFamilyId: family.body.id,
    input: {
      name: "Meta 更新模板族",
      status: "active",
    },
  });
  const listed = await api.listTemplateFamilies();

  assert.equal(updated.status, 200);
  assert.equal(updated.body.name, "Meta 更新模板族");
  assert.equal(updated.body.status, "active");
  assert.equal(listed.status, 200);
  assert.equal(listed.body.length, 1);
  assert.equal(listed.body[0]?.id, family.body.id);
});

test("only one active template family is allowed per manuscript type", async () => {
  const { api } = createTemplateHarness(undefined, {
    issuedIds: ["family-1", "family-2"],
  });

  const firstFamily = await api.createTemplateFamily({
    manuscriptType: "review",
    name: "Review Family A",
  });
  const secondFamily = await api.createTemplateFamily({
    manuscriptType: "review",
    name: "Review Family B",
  });

  await api.updateTemplateFamily({
    templateFamilyId: firstFamily.body.id,
    input: {
      status: "active",
    },
  });

  await assert.rejects(
    () =>
      api.updateTemplateFamily({
        templateFamilyId: secondFamily.body.id,
        input: {
          status: "active",
        },
      }),
    /active/i,
  );

  const listed = await api.listTemplateFamilies();
  assert.deepEqual(
    listed.body.map((family) => ({
      id: family.id,
      status: family.status,
    })),
    [
      {
        id: firstFamily.body.id,
        status: "active",
      },
      {
        id: secondFamily.body.id,
        status: "draft",
      },
    ],
  );
});

test("module template manuscript type must match its parent template family", async () => {
  const { api } = createTemplateHarness();

  const family = await api.createTemplateFamily({
    manuscriptType: "review",
    name: "综述模板族",
  });

  await assert.rejects(
    () =>
      api.createModuleTemplateDraft({
        templateFamilyId: family.body.id,
        module: "screening",
        manuscriptType: "clinical_study",
        prompt: "不应通过的稿件类型组合。",
      }),
    /manuscript type/i,
  );
});

test("concurrent module template drafts receive unique version numbers within a family and module", async () => {
  const { api } = createTemplateHarness();

  const family = await api.createTemplateFamily({
    manuscriptType: "review",
    name: "并发版本号测试",
  });

  const [firstDraft, secondDraft] = await Promise.all([
    api.createModuleTemplateDraft({
      templateFamilyId: family.body.id,
      module: "screening",
      manuscriptType: "review",
      prompt: "并发草稿 A",
    }),
    api.createModuleTemplateDraft({
      templateFamilyId: family.body.id,
      module: "screening",
      manuscriptType: "review",
      prompt: "并发草稿 B",
    }),
  ]);

  assert.deepEqual(
    [firstDraft.body.version_no, secondDraft.body.version_no].sort(
      (left, right) => left - right,
    ),
    [1, 2],
  );
});

test("publishing a newer module template archives the prior published version for the same family and module", async () => {
  const { api, moduleTemplateRepository } = createTemplateHarness();

  const family = await api.createTemplateFamily({
    manuscriptType: "clinical_study",
    name: "临床研究模板族",
  });
  const firstDraft = await api.createModuleTemplateDraft({
    templateFamilyId: family.body.id,
    module: "editing",
    manuscriptType: "clinical_study",
    prompt: "V1 编加规则",
  });
  await api.publishModuleTemplate({
    moduleTemplateId: firstDraft.body.id,
    actorRole: "admin",
  });

  const secondDraft = await api.createModuleTemplateDraft({
    templateFamilyId: family.body.id,
    module: "editing",
    manuscriptType: "clinical_study",
    prompt: "V2 编加规则",
  });
  const secondPublished = await api.publishModuleTemplate({
    moduleTemplateId: secondDraft.body.id,
    actorRole: "admin",
  });

  const templates = await moduleTemplateRepository.listByTemplateFamilyIdAndModule(
    family.body.id,
    "editing",
  );

  assert.equal(secondPublished.status, 200);
  assert.deepEqual(
    templates.map((template) => ({
      id: template.id,
      status: template.status,
      version_no: template.version_no,
    })),
    [
      {
        id: "template-1",
        status: "archived",
        version_no: 1,
      },
      {
        id: "template-2",
        status: "published",
        version_no: 2,
      },
    ],
  );
});

test("publishing a newer module template rolls back archived prior versions when the new publish write fails", async () => {
  const moduleTemplateRepository = new FailingModuleTemplateRepository(
    (record) => record.id === "template-2" && record.status === "published",
  );
  const { api } = createTemplateHarness(moduleTemplateRepository);

  const family = await api.createTemplateFamily({
    manuscriptType: "clinical_study",
    name: "模板发布回滚测试",
  });
  const firstDraft = await api.createModuleTemplateDraft({
    templateFamilyId: family.body.id,
    module: "editing",
    manuscriptType: "clinical_study",
    prompt: "V1 编加规则",
  });
  await api.publishModuleTemplate({
    moduleTemplateId: firstDraft.body.id,
    actorRole: "admin",
  });

  const secondDraft = await api.createModuleTemplateDraft({
    templateFamilyId: family.body.id,
    module: "editing",
    manuscriptType: "clinical_study",
    prompt: "V2 编加规则",
  });

  await assert.rejects(
    () =>
      api.publishModuleTemplate({
        moduleTemplateId: secondDraft.body.id,
        actorRole: "admin",
      }),
    /template write failure/i,
  );

  const templates = await moduleTemplateRepository.listByTemplateFamilyIdAndModule(
    family.body.id,
    "editing",
  );

  assert.deepEqual(
    templates.map((template) => ({
      id: template.id,
      status: template.status,
      version_no: template.version_no,
    })),
    [
      {
        id: "template-1",
        status: "published",
        version_no: 1,
      },
      {
        id: "template-2",
        status: "draft",
        version_no: 2,
      },
    ],
  );
});
