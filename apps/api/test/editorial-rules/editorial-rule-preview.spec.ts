import test from "node:test";
import assert from "node:assert/strict";
import { createEditorialRuleApi } from "../../src/modules/editorial-rules/editorial-rule-api.ts";
import { InMemoryEditorialRuleRepository } from "../../src/modules/editorial-rules/in-memory-editorial-rule-repository.ts";
import { EditorialRulePreviewService } from "../../src/modules/editorial-rules/editorial-rule-preview-service.ts";
import { EditorialRuleResolutionService } from "../../src/modules/editorial-rules/editorial-rule-resolution-service.ts";
import { EditorialRuleService } from "../../src/modules/editorial-rules/editorial-rule-service.ts";
import { InMemoryTemplateFamilyRepository } from "../../src/modules/templates/in-memory-template-family-repository.ts";

const BEFORE_HEADING = "\u6458\u8981 \u76ee\u7684";
const AFTER_HEADING = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09";
const AFTER_HEADING_WITH_COLON = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09\uff1a";

function createPreviewHarness() {
  const repository = new InMemoryEditorialRuleRepository();
  const templateFamilyRepository = new InMemoryTemplateFamilyRepository();
  const resolutionService = new EditorialRuleResolutionService({
    repository,
  });
  const previewService = new EditorialRulePreviewService({
    repository,
    resolutionService,
  });
  const editorialRuleService = new EditorialRuleService({
    repository,
    templateFamilyRepository,
    createId: (() => {
      const ids = [
        "rule-set-1",
        "rule-1",
        "rule-set-2",
        "rule-2",
      ];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a preview harness id.");
        return value;
      };
    })(),
  });
  const api = createEditorialRuleApi({
    editorialRuleService,
    editorialRulePreviewService: previewService,
  });

  return {
    api,
    templateFamilyRepository,
  };
}

test("previewing a single rule returns transformed output, reasons, and guarded posture", async () => {
  const { api, templateFamilyRepository } = createPreviewHarness();

  await templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical study family",
    status: "active",
  });

  const ruleSet = await api.createRuleSet({
    actorRole: "admin",
    input: {
      templateFamilyId: "family-1",
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
      },
      trigger: {
        kind: "exact_text",
        text: BEFORE_HEADING,
      },
      action: {
        kind: "replace_heading",
        to: AFTER_HEADING,
      },
      explanationPayload: {
        rationale:
          "Abstract headings should normalize to full-width parentheses and full-width spacing.",
      },
      confidencePolicy: "always_auto",
      severity: "error",
    },
  });

  const preview = await api.previewRule({
    ruleId: createdRule.body.id,
    sampleText: `前文。\n${BEFORE_HEADING}\n后文。`,
  });

  assert.deepEqual(preview.body.matched_rule_ids, ["rule-1"]);
  assert.equal(preview.body.output, `前文。\n${AFTER_HEADING}\n后文。`);
  assert.equal(preview.body.execution_posture, "guarded");
  assert.equal(preview.body.inspect_only, false);
  assert.match(preview.body.reasons.join(" "), /full-width parentheses/i);
  assert.match(preview.body.reasons.join(" "), /exact_text/i);
});

test("previewing resolved rules reports journal overrides and uses the journal-specific output", async () => {
  const { api, templateFamilyRepository } = createPreviewHarness();

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

  const baseRuleSet = await api.createRuleSet({
    actorRole: "admin",
    input: {
      templateFamilyId: "family-1",
      module: "editing",
    },
  });
  await api.createRule({
    actorRole: "admin",
    input: {
      ruleSetId: baseRuleSet.body.id,
      orderNo: 10,
      ruleObject: "abstract",
      ruleType: "format",
      executionMode: "apply_and_inspect",
      scope: {
        sections: ["abstract"],
      },
      selector: {
        section_selector: "abstract",
        label_selector: { text: BEFORE_HEADING },
      },
      trigger: {
        kind: "exact_text",
        text: BEFORE_HEADING,
      },
      action: {
        kind: "replace_heading",
        to: AFTER_HEADING,
      },
      confidencePolicy: "always_auto",
      severity: "error",
    },
  });
  await api.publishRuleSet({
    actorRole: "admin",
    ruleSetId: baseRuleSet.body.id,
  });

  const journalRuleSet = await api.createRuleSet({
    actorRole: "admin",
    input: {
      templateFamilyId: "family-1",
      journalTemplateId: "journal-template-1",
      module: "editing",
    },
  });
  await api.createRule({
    actorRole: "admin",
    input: {
      ruleSetId: journalRuleSet.body.id,
      orderNo: 10,
      ruleObject: "abstract",
      ruleType: "format",
      executionMode: "apply_and_inspect",
      scope: {
        sections: ["abstract"],
      },
      selector: {
        section_selector: "abstract",
        label_selector: { text: BEFORE_HEADING },
      },
      trigger: {
        kind: "exact_text",
        text: BEFORE_HEADING,
      },
      action: {
        kind: "replace_heading",
        to: AFTER_HEADING_WITH_COLON,
      },
      explanationPayload: {
        rationale: "Journal Alpha adds a full-width colon after the normalized heading.",
      },
      confidencePolicy: "always_auto",
      severity: "error",
    },
  });
  await api.publishRuleSet({
    actorRole: "admin",
    ruleSetId: journalRuleSet.body.id,
  });

  const preview = await api.previewResolvedRules({
    templateFamilyId: "family-1",
    journalTemplateId: "journal-template-1",
    module: "editing",
    ruleObject: "abstract",
    sampleText: BEFORE_HEADING,
  });

  assert.deepEqual(preview.body.matched_rule_ids, ["rule-2"]);
  assert.deepEqual(preview.body.overridden_rule_ids, ["rule-1"]);
  assert.equal(preview.body.output, AFTER_HEADING_WITH_COLON);
  assert.equal(preview.body.execution_posture, "guarded");
  assert.match(preview.body.reasons.join(" "), /journal template override/i);
  assert.deepEqual(preview.body.matched_rules, [
    {
      rule_id: "rule-2",
      rule_object: "abstract",
      coverage_key: 'abstract::{"label_selector":{"text":"摘要 目的"},"section_selector":"abstract"}::{"kind":"exact_text","text":"摘要 目的"}',
      execution_posture: "guarded",
      overridden_rule_ids: ["rule-1"],
      reason: 'Journal template override matched coverage key "abstract::{"label_selector":{"text":"摘要 目的"},"section_selector":"abstract"}::{"kind":"exact_text","text":"摘要 目的"}".',
    },
  ]);
});
