import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import { createEditorialRuleApi } from "../../src/modules/editorial-rules/editorial-rule-api.ts";
import { InMemoryEditorialRuleRepository } from "../../src/modules/editorial-rules/in-memory-editorial-rule-repository.ts";
import {
  EditorialRuleService,
  EditorialRuleSetNotEditableError,
} from "../../src/modules/editorial-rules/editorial-rule-service.ts";
import { InMemoryTemplateFamilyRepository } from "../../src/modules/templates/in-memory-template-family-repository.ts";

function createEditorialRuleHarness() {
  const repository = new InMemoryEditorialRuleRepository();
  const templateFamilyRepository = new InMemoryTemplateFamilyRepository();
  const service = new EditorialRuleService({
    repository,
    templateFamilyRepository,
    createId: (() => {
      const ids = ["rule-set-1", "rule-1", "rule-set-2", "rule-2"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected an editorial rule id to be available.");
        return value;
      };
    })(),
  });
  const api = createEditorialRuleApi({
    editorialRuleService: service,
  });

  return {
    api,
    templateFamilyRepository,
  };
}

test("rule sets are versioned, rules preserve structured actions, and earlier published versions are archived", async () => {
  const { api, templateFamilyRepository } = createEditorialRuleHarness();

  await templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical study family",
    status: "active",
  });

  await assert.rejects(
    () =>
      api.createRuleSet({
        actorRole: "editor",
        input: {
          templateFamilyId: "family-1",
          module: "editing",
        },
      }),
    AuthorizationError,
  );

  const firstRuleSet = await api.createRuleSet({
    actorRole: "admin",
    input: {
      templateFamilyId: "family-1",
      module: "editing",
    },
  });

  assert.deepEqual(firstRuleSet.body, {
    id: "rule-set-1",
    template_family_id: "family-1",
    module: "editing",
    version_no: 1,
    status: "draft",
  });

  const createdRule = await api.createRule({
    actorRole: "admin",
    input: {
      ruleSetId: firstRuleSet.body.id,
      orderNo: 10,
      ruleType: "format",
      executionMode: "apply_and_inspect",
      scope: {
        sections: ["abstract"],
        block_kind: "heading",
      },
      trigger: {
        kind: "exact_text",
        text: "摘要 目的",
      },
      action: {
        kind: "replace_heading",
        to: "（摘要　目的）",
      },
      confidencePolicy: "always_auto",
      severity: "error",
      enabled: true,
      exampleBefore: "摘要 目的",
      exampleAfter: "（摘要　目的）",
      manualReviewReasonTemplate: "medical_meaning_risk",
    },
  });

  assert.equal(createdRule.body.action.kind, "replace_heading");
  assert.equal(createdRule.body.action.to, "（摘要　目的）");
  assert.equal(createdRule.body.example_before, "摘要 目的");
  assert.equal(createdRule.body.example_after, "（摘要　目的）");

  const secondRuleSet = await api.createRuleSet({
    actorRole: "admin",
    input: {
      templateFamilyId: "family-1",
      module: "editing",
    },
  });

  assert.equal(secondRuleSet.body.version_no, 2);

  const publishedFirst = await api.publishRuleSet({
    actorRole: "admin",
    ruleSetId: firstRuleSet.body.id,
  });
  const publishedSecond = await api.publishRuleSet({
    actorRole: "admin",
    ruleSetId: secondRuleSet.body.id,
  });
  const listedRuleSets = await api.listRuleSets();
  const listedRules = await api.listRules({
    ruleSetId: firstRuleSet.body.id,
  });

  assert.equal(publishedFirst.body.status, "published");
  assert.equal(publishedSecond.body.status, "published");
  assert.equal(
    listedRuleSets.body.find((record) => record.id === firstRuleSet.body.id)?.status,
    "archived",
  );
  assert.equal(
    listedRuleSets.body.find((record) => record.id === secondRuleSet.body.id)?.status,
    "published",
  );
  assert.deepEqual(listedRules.body.map((record) => record.id), ["rule-1"]);

  await assert.rejects(
    () =>
      api.createRule({
        actorRole: "admin",
        input: {
          ruleSetId: firstRuleSet.body.id,
          orderNo: 20,
          ruleType: "format",
          executionMode: "apply",
          scope: {
            sections: ["abstract"],
          },
          trigger: {
            kind: "exact_text",
            text: "摘要 结果",
          },
          action: {
            kind: "replace_heading",
            to: "（摘要　结果）",
          },
          confidencePolicy: "always_auto",
          severity: "warning",
        },
      }),
    EditorialRuleSetNotEditableError,
  );
});
