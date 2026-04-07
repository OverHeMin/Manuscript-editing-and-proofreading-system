import test from "node:test";
import assert from "node:assert/strict";
import { executeDeterministicFormatRules } from "../../src/modules/editorial-execution/deterministic-format-rule-executor.ts";

const BEFORE_HEADING = "\u6458\u8981 \u76ee\u7684";
const AFTER_HEADING = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09";
const AI_ONLY_TEXT =
  "\u9700\u8981\u540e\u7eed AI \u6539\u5199\u7684\u6bb5\u843d";

test("deterministic executor applies exact heading replacements and ignores non-deterministic rules", () => {
  const result = executeDeterministicFormatRules({
    blocks: [
      {
        section: "abstract",
        block_kind: "heading",
        text: BEFORE_HEADING,
      },
      {
        section: "discussion",
        block_kind: "paragraph",
        text: AI_ONLY_TEXT,
      },
    ],
    rules: [
      {
        id: "rule-abstract-objective",
        rule_set_id: "rule-set-1",
        order_no: 10,
        rule_object: "generic",
        rule_type: "format",
        execution_mode: "apply_and_inspect",
        scope: {
          sections: ["abstract"],
          block_kind: "heading",
        },
        selector: {},
        trigger: {
          kind: "exact_text",
          text: BEFORE_HEADING,
        },
        action: {
          kind: "replace_heading",
          to: AFTER_HEADING,
        },
        authoring_payload: {},
        confidence_policy: "always_auto",
        severity: "error",
        enabled: true,
      },
      {
        id: "rule-discussion-reshape",
        rule_set_id: "rule-set-1",
        order_no: 20,
        rule_object: "generic",
        rule_type: "content",
        execution_mode: "apply",
        scope: {
          sections: ["discussion"],
          block_kind: "paragraph",
        },
        selector: {},
        trigger: {
          kind: "semantic_pattern",
          tag: "needs_clarity",
        },
        action: {
          kind: "rewrite_content",
        },
        authoring_payload: {},
        confidence_policy: "high_confidence_only",
        severity: "warning",
        enabled: true,
      },
    ],
  });

  assert.deepEqual(result.appliedRuleIds, ["rule-abstract-objective"]);
  assert.deepEqual(result.appliedChanges, [
    {
      ruleId: "rule-abstract-objective",
      blockIndex: 0,
      before: BEFORE_HEADING,
      after: AFTER_HEADING,
    },
  ]);
  assert.equal(result.blocks[0]?.text, AFTER_HEADING);
  assert.equal(result.blocks[1]?.text, AI_ONLY_TEXT);
});
