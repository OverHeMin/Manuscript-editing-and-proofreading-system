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

const BEFORE_HEADING = "\u6458\u8981 \u76ee\u7684";
const AFTER_HEADING = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09";

function createEditorialRuleHarness() {
  const repository = new InMemoryEditorialRuleRepository();
  const templateFamilyRepository = new InMemoryTemplateFamilyRepository();
  const service = new EditorialRuleService({
    repository,
    templateFamilyRepository,
    createId: (() => {
      const ids = [
        "rule-set-1",
        "rule-1",
        "rule-set-2",
        "rule-2",
        "rule-set-3",
        "rule-3",
        "rule-set-4",
        "rule-4",
        "rule-set-5",
        "rule-5",
        "rule-set-6",
        "rule-6",
      ];
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

test("journal-scoped rule sets preserve rule objects, selectors, and authoring payloads end-to-end", async () => {
  const { api, templateFamilyRepository } = createEditorialRuleHarness();

  await templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical study family",
    status: "active",
  });
  await templateFamilyRepository.saveJournalTemplateProfile({
    id: "journal-template-1",
    template_family_id: "family-1",
    journal_key: "journal-alpha",
    journal_name: "Journal Alpha",
    status: "active",
  });

  const ruleSet = await api.createRuleSet({
    actorRole: "admin",
    input: {
      templateFamilyId: "family-1",
      journalTemplateId: "journal-template-1",
      module: "editing",
    },
  });

  const createdRule = await api.createRule({
    actorRole: "admin",
    input: {
      ruleSetId: ruleSet.body.id,
      orderNo: 10,
      ruleObject: "abstract",
      ruleType: "format",
      executionMode: "apply_and_inspect",
      scope: {
        sections: ["abstract"],
        block_kind: "heading",
      },
      selector: {
        section_selector: "abstract",
        label_selector: {
          text: BEFORE_HEADING,
        },
      },
      trigger: {
        kind: "exact_text",
        text: BEFORE_HEADING,
      },
      action: {
        kind: "replace_heading",
        to: AFTER_HEADING,
      },
      authoringPayload: {
        normalized_example: AFTER_HEADING,
        source: "manual_authoring",
      },
      confidencePolicy: "always_auto",
      severity: "error",
      enabled: true,
    },
  });
  const listedRules = await api.listRules({
    ruleSetId: ruleSet.body.id,
  });

  assert.deepEqual(ruleSet.body, {
    id: "rule-set-1",
    template_family_id: "family-1",
    journal_template_id: "journal-template-1",
    module: "editing",
    version_no: 1,
    status: "draft",
  });
  assert.equal(createdRule.body.rule_object, "abstract");
  assert.deepEqual(createdRule.body.selector, {
    section_selector: "abstract",
    label_selector: {
      text: BEFORE_HEADING,
    },
  });
  assert.deepEqual(createdRule.body.authoring_payload, {
    normalized_example: AFTER_HEADING,
    source: "manual_authoring",
  });
  assert.equal(listedRules.body[0]?.rule_object, "abstract");
  assert.deepEqual(listedRules.body[0]?.selector, {
    section_selector: "abstract",
    label_selector: {
      text: BEFORE_HEADING,
    },
  });
  assert.deepEqual(listedRules.body[0]?.authoring_payload, {
    normalized_example: AFTER_HEADING,
    source: "manual_authoring",
  });
});

test("creating a rule preserves explainability, linkage, and projection payloads for the exact abstract normalization example", async () => {
  const { api, templateFamilyRepository } = createEditorialRuleHarness();

  await templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical study family",
    status: "active",
  });
  await templateFamilyRepository.saveJournalTemplateProfile({
    id: "journal-template-1",
    template_family_id: "family-1",
    journal_key: "journal-alpha",
    journal_name: "Journal Alpha",
    status: "active",
  });

  const ruleSet = await api.createRuleSet({
    actorRole: "admin",
    input: {
      templateFamilyId: "family-1",
      journalTemplateId: "journal-template-1",
      module: "editing",
    },
  });

  const createdRule = await api.createRule({
    actorRole: "admin",
    input: {
      ruleSetId: ruleSet.body.id,
      orderNo: 10,
      ruleObject: "abstract",
      ruleType: "format",
      executionMode: "apply_and_inspect",
      scope: {
        sections: ["abstract"],
        block_kind: "heading",
      },
      selector: {
        section_selector: "abstract",
        label_selector: {
          text: BEFORE_HEADING,
        },
      },
      trigger: {
        kind: "exact_text",
        text: BEFORE_HEADING,
      },
      action: {
        kind: "replace_heading",
        to: AFTER_HEADING,
      },
      authoringPayload: {
        normalized_example: AFTER_HEADING,
        common_error_text: BEFORE_HEADING,
      },
      explanationPayload: {
        rationale:
          "Abstract headings should normalize to full-width parentheses and full-width spacing.",
        applies_when: ["Chinese medical abstract heading labels require journal normalization."],
        correct_example: AFTER_HEADING,
        incorrect_example: BEFORE_HEADING,
        review_prompt: "Check whether the abstract heading uses journal punctuation and spacing.",
      },
      linkagePayload: {
        source_learning_candidate_id: "candidate-1",
        source_snapshot_asset_id: "snapshot-1",
        overrides_rule_ids: ["base-rule-abstract"],
      },
      projectionPayload: {
        projection_kind: "rule",
        summary: "Normalize abstract objective headings to the journal house style.",
        standard_example: AFTER_HEADING,
        incorrect_example: BEFORE_HEADING,
      },
      confidencePolicy: "always_auto",
      severity: "error",
      enabled: true,
      exampleBefore: BEFORE_HEADING,
      exampleAfter: AFTER_HEADING,
    },
  });
  const listedRules = await api.listRules({
    ruleSetId: ruleSet.body.id,
  });

  assert.equal(createdRule.body.example_before, BEFORE_HEADING);
  assert.equal(createdRule.body.example_after, AFTER_HEADING);
  assert.deepEqual(createdRule.body.explanation_payload, {
    rationale:
      "Abstract headings should normalize to full-width parentheses and full-width spacing.",
    applies_when: ["Chinese medical abstract heading labels require journal normalization."],
    correct_example: AFTER_HEADING,
    incorrect_example: BEFORE_HEADING,
    review_prompt: "Check whether the abstract heading uses journal punctuation and spacing.",
  });
  assert.deepEqual(createdRule.body.linkage_payload, {
    source_learning_candidate_id: "candidate-1",
    source_snapshot_asset_id: "snapshot-1",
    overrides_rule_ids: ["base-rule-abstract"],
  });
  assert.deepEqual(createdRule.body.projection_payload, {
    projection_kind: "rule",
    summary: "Normalize abstract objective headings to the journal house style.",
    standard_example: AFTER_HEADING,
    incorrect_example: BEFORE_HEADING,
  });
  assert.deepEqual(listedRules.body[0]?.explanation_payload, createdRule.body.explanation_payload);
  assert.deepEqual(listedRules.body[0]?.linkage_payload, createdRule.body.linkage_payload);
  assert.deepEqual(listedRules.body[0]?.projection_payload, createdRule.body.projection_payload);
});

test("publishing a journal-scoped rule set only archives published rule sets in the same scope", async () => {
  const { api, templateFamilyRepository } = createEditorialRuleHarness();

  await templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical study family",
    status: "active",
  });
  await templateFamilyRepository.saveJournalTemplateProfile({
    id: "journal-template-1",
    template_family_id: "family-1",
    journal_key: "journal-alpha",
    journal_name: "Journal Alpha",
    status: "active",
  });
  await templateFamilyRepository.saveJournalTemplateProfile({
    id: "journal-template-2",
    template_family_id: "family-1",
    journal_key: "journal-beta",
    journal_name: "Journal Beta",
    status: "active",
  });

  const baseRuleSet = await api.createRuleSet({
    actorRole: "admin",
    input: {
      templateFamilyId: "family-1",
      module: "editing",
    },
  });
  const journalAlphaV1 = await api.createRuleSet({
    actorRole: "admin",
    input: {
      templateFamilyId: "family-1",
      journalTemplateId: "journal-template-1",
      module: "editing",
    },
  });
  const journalBetaV1 = await api.createRuleSet({
    actorRole: "admin",
    input: {
      templateFamilyId: "family-1",
      journalTemplateId: "journal-template-2",
      module: "editing",
    },
  });

  await api.publishRuleSet({
    actorRole: "admin",
    ruleSetId: baseRuleSet.body.id,
  });
  await api.publishRuleSet({
    actorRole: "admin",
    ruleSetId: journalAlphaV1.body.id,
  });
  await api.publishRuleSet({
    actorRole: "admin",
    ruleSetId: journalBetaV1.body.id,
  });

  const journalAlphaV2 = await api.createRuleSet({
    actorRole: "admin",
    input: {
      templateFamilyId: "family-1",
      journalTemplateId: "journal-template-1",
      module: "editing",
    },
  });
  await api.publishRuleSet({
    actorRole: "admin",
    ruleSetId: journalAlphaV2.body.id,
  });

  const listedRuleSets = await api.listRuleSets();
  const statusesById = new Map(
    listedRuleSets.body.map((record) => [record.id, record.status]),
  );

  assert.equal(statusesById.get(baseRuleSet.body.id), "published");
  assert.equal(statusesById.get(journalAlphaV1.body.id), "archived");
  assert.equal(statusesById.get(journalAlphaV2.body.id), "published");
  assert.equal(statusesById.get(journalBetaV1.body.id), "published");
});

test("creating a journal-scoped rule set rejects a journal template from a different template family", async () => {
  const { api, templateFamilyRepository } = createEditorialRuleHarness();

  await templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical study family",
    status: "active",
  });
  await templateFamilyRepository.save({
    id: "family-2",
    manuscript_type: "review",
    name: "Review family",
    status: "active",
  });
  await templateFamilyRepository.saveJournalTemplateProfile({
    id: "journal-template-2",
    template_family_id: "family-2",
    journal_key: "review-journal",
    journal_name: "Review Journal",
    status: "active",
  });

  await assert.rejects(
    () =>
      api.createRuleSet({
        actorRole: "admin",
        input: {
          templateFamilyId: "family-1",
          journalTemplateId: "journal-template-2",
          module: "editing",
        },
      }),
    /journal template/i,
  );
});
