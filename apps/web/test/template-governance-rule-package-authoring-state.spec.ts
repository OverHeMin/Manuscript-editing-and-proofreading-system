import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRulePackagePreviewSampleText,
  createRulePackageAuthoringWorkspaceState,
  getSelectedRulePackageDraft,
  restoreRulePackageAuthoringWorkspaceState,
  serializeRulePackageAuthoringWorkspaceState,
  setRulePackagePreview,
  updateRulePackageSemanticDraft,
} from "../src/features/template-governance/rule-package-authoring-state.ts";

function buildWorkspace() {
  return {
    source: {
      sourceKind: "reviewed_case" as const,
      reviewedCaseSnapshotId: "reviewed-case-snapshot-demo-1",
    },
    selectedPackageId: "package-front-matter",
    candidates: [
      {
        package_id: "package-front-matter",
        package_kind: "front_matter",
        title: "前置信息包",
        rule_object: "front_matter",
        suggested_layer: "journal_template",
        automation_posture: "guarded_auto",
        status: "draft",
        cards: {
          rule_what: {
            title: "前置信息包",
            object: "front_matter",
            publish_layer: "journal_template",
          },
          ai_understanding: {
            summary: "统一作者、单位与通信作者块。",
            hit_objects: ["author_line", "corresponding_author"],
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
                before: "第一作者：张三",
                after: "（作者简介）张三",
              },
            ],
          },
          exclusions: {
            not_applicable_when: ["原稿作者元数据缺失"],
            human_review_required_when: ["新增通信作者"],
            risk_posture: "guarded_auto",
          },
        },
        preview: {
          hit_summary: "命中前置信息块",
          hits: [],
          misses: [],
          decision: {
            automation_posture: "guarded_auto",
            needs_human_review: true,
            reason: "作者元数据变更需要人工复核。",
          },
        },
        semantic_draft: {
          semantic_summary: "统一作者、单位与通信作者块。",
          hit_scope: ["author_line:text_style_normalization"],
          applicability: ["front_matter"],
          evidence_examples: [
            {
              before: "第一作者：张三",
              after: "（作者简介）张三",
            },
          ],
          failure_boundaries: ["原稿作者元数据缺失"],
          normalization_recipe: ["统一作者与通信作者标签"],
          review_policy: ["新增通信作者时人工复核"],
          confirmed_fields: ["summary", "applicability"],
        },
        supporting_signals: [],
      },
    ],
  } as const;
}

test("semantic draft edits stay local and provide the refreshed preview input", () => {
  const initialState = createRulePackageAuthoringWorkspaceState(buildWorkspace());
  const updatedState = updateRulePackageSemanticDraft(
    initialState,
    "package-front-matter",
    (draft) => ({
      ...draft,
      semantic_draft: {
        ...draft.semantic_draft,
        semantic_summary: "统一中英文作者与通信作者标签。",
        evidence_examples: [
          {
            before: "通信作者：李四",
            after: "通信作者 李四",
          },
        ],
      },
    }),
  );

  const updatedDraft = getSelectedRulePackageDraft(updatedState);

  assert.equal(
    updatedDraft?.semantic_draft?.semantic_summary,
    "统一中英文作者与通信作者标签。",
  );
  assert.equal(buildRulePackagePreviewSampleText(updatedDraft), "通信作者：李四");
  assert.equal(
    initialState.candidates[0]?.semantic_draft?.semantic_summary,
    "统一作者、单位与通信作者块。",
  );
});

test("preview refresh stores the latest preview without mutating the candidate seed", () => {
  const initialState = createRulePackageAuthoringWorkspaceState(buildWorkspace());
  const refreshedState = setRulePackagePreview(initialState, "package-front-matter", {
    hit_summary: "命中作者与通信作者块",
    hits: [
      {
        target: "corresponding_author",
        reason: "通信作者标签已标准化。",
      },
    ],
    misses: [],
    decision: {
      automation_posture: "guarded_auto",
      needs_human_review: true,
      reason: "通信作者变更需要人工复核。",
    },
  });

  assert.equal(
    refreshedState.previewById["package-front-matter"]?.hit_summary,
    "命中作者与通信作者块",
  );
  assert.equal(initialState.candidates[0]?.preview.hit_summary, "命中前置信息块");
});

test("stored drafts can be restored onto a freshly loaded workspace", () => {
  const initialState = createRulePackageAuthoringWorkspaceState(buildWorkspace());
  const editedState = updateRulePackageSemanticDraft(
    initialState,
    "package-front-matter",
    (draft) => ({
      ...draft,
      semantic_draft: {
        ...draft.semantic_draft,
        semantic_summary: "已自动恢复上次草稿",
      },
    }),
  );
  const storedDraft = serializeRulePackageAuthoringWorkspaceState(
    editedState,
    "2026-04-10T10:00:00.000Z",
  );

  const restoredState = restoreRulePackageAuthoringWorkspaceState(
    buildWorkspace(),
    storedDraft,
  );

  assert.equal(
    restoredState.editableDraftById["package-front-matter"]?.semantic_draft
      ?.semantic_summary,
    "已自动恢复上次草稿",
  );
});
