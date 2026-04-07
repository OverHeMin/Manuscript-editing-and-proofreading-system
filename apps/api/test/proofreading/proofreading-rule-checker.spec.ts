import test from "node:test";
import assert from "node:assert/strict";
import { assembleInstructionTemplate } from "../../src/modules/editorial-execution/instruction-template-assembler.ts";
import { inspectProofreadingRules } from "../../src/modules/editorial-execution/proofreading-rule-checker.ts";

const BEFORE_HEADING = "\u6458\u8981 \u76ee\u7684";
const AFTER_HEADING = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09";

function createRules() {
  return [
    {
      id: "rule-abstract-objective",
      rule_set_id: "rule-set-1",
      order_no: 10,
      rule_type: "format" as const,
      execution_mode: "apply_and_inspect" as const,
      scope: {
        sections: ["abstract"],
        block_kind: "heading",
      },
      trigger: {
        kind: "exact_text",
        text: BEFORE_HEADING,
      },
      action: {
        kind: "replace_heading",
        to: AFTER_HEADING,
      },
      confidence_policy: "always_auto" as const,
      severity: "error" as const,
      enabled: true,
      example_before: BEFORE_HEADING,
      example_after: AFTER_HEADING,
    },
    {
      id: "rule-discussion-reshape",
      rule_set_id: "rule-set-1",
      order_no: 20,
      rule_type: "content" as const,
      execution_mode: "apply" as const,
      scope: {
        sections: ["discussion"],
        block_kind: "paragraph",
      },
      trigger: {
        kind: "semantic_pattern",
        tag: "needs_clarity",
      },
      action: {
        kind: "rewrite_content",
      },
      confidence_policy: "high_confidence_only" as const,
      severity: "warning" as const,
      enabled: true,
    },
  ];
}

test("instruction assembler combines structured template fields, hard rules, and manual-review gating", () => {
  const instructionPayload = assembleInstructionTemplate({
    promptTemplate: {
      id: "prompt-editing-1",
      name: "editing_mainline",
      version: "1.0.0",
      status: "published",
      module: "editing",
      manuscript_types: ["clinical_study"],
      template_kind: "editing_instruction",
      system_instructions: "Apply editorial rules without changing medical meaning.",
      task_frame: "Apply deterministic rules first, then stage AI-only candidates.",
      allowed_content_operations: ["sentence_rewrite", "paragraph_reshape"],
      forbidden_operations: ["fabrication", "meaning_shift"],
      manual_review_policy: "Escalate any content rewrite with medical meaning risk.",
      output_contract: "Return applied changes and staged manual review items.",
    },
    ruleSet: {
      id: "rule-set-1",
      template_family_id: "family-1",
      module: "editing",
      version_no: 1,
      status: "published",
    },
    rules: createRules(),
    knowledgeSelections: [
      {
        knowledgeItem: {
          id: "knowledge-snippet-1",
          title: "Prompt snippet: abstract objective",
          canonical_text:
            'Instruction snippet: if you encounter "' +
            BEFORE_HEADING +
            '" in abstract section, change it to "' +
            AFTER_HEADING +
            '" and preserve the manuscript\'s medical meaning.',
          knowledge_kind: "prompt_snippet",
          status: "approved",
          routing: {
            module_scope: "any",
            manuscript_types: ["clinical_study"],
          },
          projection_source: {
            source_kind: "editorial_rule_projection",
            rule_set_id: "rule-set-1",
            rule_id: "rule-abstract-objective",
            projection_kind: "prompt_snippet",
          },
        },
        matchSource: "dynamic_routing",
        matchReasons: ["dynamic_routing"],
      },
    ],
  });

  assert.equal(instructionPayload.templateKind, "editing_instruction");
  assert.ok(instructionPayload.hardRuleSummary.includes(AFTER_HEADING));
  assert.deepEqual(instructionPayload.manualReviewItems, [
    {
      ruleId: "rule-discussion-reshape",
      reason: "medical_meaning_risk",
    },
  ]);
  assert.deepEqual(instructionPayload.contentRuleCandidates, [
    {
      ruleId: "rule-discussion-reshape",
      reason: "medical_meaning_risk",
      severity: "warning",
      actionKind: "rewrite_content",
    },
  ]);
});

test("proofreading checker reports failed rule checks without applying manuscript changes", () => {
  const findings = inspectProofreadingRules({
    blocks: [
      {
        section: "abstract",
        block_kind: "heading",
        text: BEFORE_HEADING,
      },
    ],
    rules: createRules(),
  });

  assert.equal(findings.failedChecks[0]?.expected, AFTER_HEADING);
  assert.equal(findings.failedChecks[0]?.actual, BEFORE_HEADING);
  assert.equal(findings.appliedChanges?.length ?? 0, 0);
  assert.deepEqual(findings.manualReviewItems, [
    {
      ruleId: "rule-discussion-reshape",
      reason: "medical_meaning_risk",
    },
  ]);
});
