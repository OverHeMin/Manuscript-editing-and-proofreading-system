import test from "node:test";
import assert from "node:assert/strict";
import {
  createV2TemplateFormValues,
  toV2TemplateFormValues,
  validateV2TemplateFormValues,
} from "../src/features/template-governance/template-governance-v2-workbench-state.ts";
import type { GovernedContentModuleViewModel, TemplateCompositionViewModel } from "../src/features/templates/index.ts";
import type { TemplateGovernanceTemplateLedgerViewModel } from "../src/features/template-governance/template-governance-controller.ts";

test("rule center V2 template form defaults preserve multi-select fields as arrays", () => {
  const values = createV2TemplateFormValues();

  assert.deepEqual(values.executionModuleScope, []);
  assert.deepEqual(values.generalModuleIds, []);
  assert.deepEqual(values.medicalModuleIds, []);
});

test("rule center V2 template validation accepts multi-select module values", () => {
  const ledger = createTemplateLedger();

  const result = validateV2TemplateFormValues(
    {
      name: "肿瘤临床研究模板",
      manuscriptType: "clinical_study",
      journalScope: "Oncology",
      executionModuleScope: ["editing", "proofreading"],
      generalModuleIds: ["general-1"],
      medicalModuleIds: ["medical-1"],
      notes: "聚焦统计和术语一致性。",
    },
    ledger,
  );

  assert.ok(!("error" in result));
  assert.deepEqual(result.createInput.executionModuleScope, ["editing", "proofreading"]);
  assert.deepEqual(result.createInput.generalModuleIds, ["general-1"]);
  assert.deepEqual(result.createInput.medicalModuleIds, ["medical-1"]);
});

test("rule center V2 template form mapping keeps selected ids as arrays", () => {
  const values = toV2TemplateFormValues(
    {
      id: "template-1",
      name: "肿瘤临床研究模板",
      manuscript_type: "clinical_study",
      journal_scope: "Oncology",
      execution_module_scope: ["editing", "proofreading"],
      general_module_ids: ["general-1"],
      medical_module_ids: ["medical-1"],
      notes: "聚焦统计和术语一致性。",
    } as TemplateCompositionViewModel,
    [createModule("general-1", "通用编辑规则包")],
    [createModule("medical-1", "肿瘤专用规则包")],
  );

  assert.deepEqual(values.executionModuleScope, ["editing", "proofreading"]);
  assert.deepEqual(values.generalModuleIds, ["general-1"]);
  assert.deepEqual(values.medicalModuleIds, ["medical-1"]);
});

function createTemplateLedger(): TemplateGovernanceTemplateLedgerViewModel {
  return {
    templates: [],
    generalModules: [createModule("general-1", "通用编辑规则包")],
    medicalModules: [createModule("medical-1", "肿瘤专用规则包")],
    selectedTemplateId: null,
    selectedTemplate: null,
    summary: {
      templateCount: 0,
      draftCount: 0,
      publishedCount: 0,
    },
  };
}

function createModule(id: string, name: string): GovernedContentModuleViewModel {
  return {
    id,
    name,
    category: "医学编辑",
    status: "draft",
    module_class: "general",
    manuscript_type_scope: ["clinical_study"],
    execution_module_scope: ["editing"],
    summary: `${name}摘要`,
    updated_at: "2026-04-30T00:00:00.000Z",
  } as GovernedContentModuleViewModel;
}
