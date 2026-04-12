import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RulePackageAuthoringShell } from "../src/features/template-governance/rule-package-authoring-shell.tsx";

test("package-first authoring shell renders compile preview results and draft-compile handoff", () => {
  const workspaceState = {
    source: {
      sourceKind: "reviewed_case" as const,
      reviewedCaseSnapshotId: "reviewed-case-snapshot-demo-1",
    },
    candidates: [
      {
        package_id: "package-front-matter",
        package_kind: "front_matter" as const,
        title: "Front matter package",
        rule_object: "front_matter",
        suggested_layer: "journal_template" as const,
        automation_posture: "guarded_auto" as const,
        status: "draft" as const,
        cards: {
          rule_what: {
            title: "Front matter package",
            object: "front_matter",
            publish_layer: "journal_template" as const,
          },
          ai_understanding: {
            summary: "Normalize front matter blocks.",
            hit_objects: ["author_line"],
            hit_locations: ["front_matter"],
          },
          applicability: {
            manuscript_types: ["clinical_study"],
            modules: ["editing"],
            sections: ["front_matter"],
            table_targets: [],
          },
          evidence: {
            examples: [
              {
                before: "First author: Zhang San",
                after: "Author: Zhang San",
              },
            ],
          },
          exclusions: {
            not_applicable_when: ["Source metadata is missing."],
            human_review_required_when: ["A corresponding author is added."],
            risk_posture: "guarded_auto" as const,
          },
        },
        preview: {
          hit_summary: "Previewed front matter package",
          hits: [],
          misses: [],
          decision: {
            automation_posture: "guarded_auto" as const,
            needs_human_review: true,
            reason: "Operator review is required.",
          },
        },
        semantic_draft: {
          semantic_summary: "Normalize front matter blocks.",
          hit_scope: ["author_line:text_style_normalization"],
          applicability: ["front_matter"],
          evidence_examples: [
            {
              before: "First author: Zhang San",
              after: "Author: Zhang San",
            },
          ],
          failure_boundaries: ["Source metadata is missing."],
          normalization_recipe: ["Normalize author labels."],
          review_policy: ["Review when a corresponding author is added."],
          confirmed_fields: ["summary", "applicability", "evidence", "boundaries"],
        },
        supporting_signals: [],
      },
    ],
    selectedPackageId: "package-front-matter",
    editableDraftById: {},
    previewById: {},
    isAdvancedEditorVisible: false,
  };

  const Shell = RulePackageAuthoringShell as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    <Shell
      workspaceState={workspaceState}
      isLoading={false}
      isPreviewRefreshing={false}
      isCompilePreviewBusy={false}
      isCompileBusy={false}
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
            warnings: [],
          },
        ],
      }}
      compileResult={{
        rule_set_id: "rule-set-draft-1",
        target_mode: "reused_selected_draft",
        created_rule_ids: ["rule-1"],
        replaced_rule_ids: [],
        skipped_packages: [],
        publish_readiness: {
          status: "review_before_publish",
          reasons: ["Operator review remains required before publish."],
          blocked_package_count: 0,
          override_count: 0,
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
      targetModule="editing"
      canCompile
      canPreviewCompile
      onSelectPackage={() => undefined}
      onRefreshPreview={() => undefined}
      onPreviewCompile={() => undefined}
      onCompileToDraft={() => undefined}
      onOpenDraftRuleSet={() => undefined}
      onGoToPublishArea={() => undefined}
      onToggleAdvancedEditor={() => undefined}
    />,
  );

  assert.match(markup, /编译预览/);
  assert.match(markup, /编译为规则草稿/);
  assert.match(markup, /规则草稿已就绪/);
  assert.match(markup, /打开规则草稿/);
  assert.match(markup, /打开高级规则编辑器/);
  assert.match(markup, /前往发布区/);
  assert.match(markup, /知识投影预览/);
  assert.doesNotMatch(markup, /Publish Rule Package/);
});
