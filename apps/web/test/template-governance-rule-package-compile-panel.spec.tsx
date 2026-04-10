import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RulePackageCompilePanel } from "../src/features/template-governance/rule-package-compile-panel.tsx";

test("rule-package compile panel renders readiness, preview action, and compile action without exposing a second publish system", () => {
  const markup = renderToStaticMarkup(
    <RulePackageCompilePanel
      targetModule="editing"
      compilePreview={{
        packages: [
          {
            package_id: "package-front-matter",
            readiness: {
              status: "ready",
              reasons: [],
            },
            draft_rule_seeds: [
              {
                package_id: "package-front-matter",
                coverage_key: "author_line::demo",
                rule_object: "author_line",
                rule_type: "format",
                execution_mode: "apply_and_inspect",
                confidence_policy: "high_confidence_only",
                severity: "warning",
                scope: {
                  sections: ["front_matter"],
                },
                selector: {
                  section_selector: "front_matter",
                },
                trigger: {
                  kind: "author_line_pattern",
                },
                action: {
                  kind: "inspect_author_line",
                },
                authoring_payload: {
                  source: "rule_package_compile",
                },
              },
            ],
            overrides_published_coverage_keys: [],
            warnings: ["Operator review required before publish."],
          },
        ],
      }}
      compileResult={{
        rule_set_id: "rule-set-draft-1",
        target_mode: "reused_selected_draft",
        created_rule_ids: ["rule-1"],
        replaced_rule_ids: ["rule-2"],
        skipped_packages: [],
        publish_readiness: {
          status: "review_before_publish",
          reasons: ["Overrides existing published coverage."],
          blocked_package_count: 0,
          override_count: 1,
          guarded_rule_count: 1,
          inspect_rule_count: 0,
        },
        projection_readiness: {
          projected_kinds: ["rule", "checklist", "prompt_snippet"],
          confirmed_semantic_fields: [
            "summary",
            "applicability",
            "evidence",
            "boundaries",
          ],
          withheld_semantic_fields: [],
          reasons: [
            "Confirmed semantic fields will project after publish through the existing rule-set flow.",
          ],
        },
      }}
      canPreview
      canCompile
      isPreviewBusy={false}
      isCompileBusy={false}
      onPreview={() => undefined}
      onCompile={() => undefined}
      onOpenDraftRuleSet={() => undefined}
      onOpenAdvancedRuleEditor={() => undefined}
      onGoToPublishArea={() => undefined}
    />,
  );

  assert.match(markup, /Compile Preview/);
  assert.match(markup, /Compile To Draft Rule Set/);
  assert.match(markup, /author_line/);
  assert.match(markup, /Reused selected draft/);
  assert.match(markup, /review_before_publish/);
  assert.match(markup, /Knowledge Projection Preview/);
  assert.match(markup, /rule, checklist, prompt_snippet/);
  assert.match(markup, /confirmed semantic fields/i);
  assert.match(markup, /Go To Publish Area/);
  assert.doesNotMatch(markup, /Publish Knowledge/);
  assert.doesNotMatch(markup, /Publish Rule Package/);
});
