import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRulePackageDraftStorageKey,
  loadRulePackageDraft,
  saveRulePackageDraft,
} from "../src/features/template-governance/rule-package-draft-storage.ts";

function createMemoryStorage() {
  const map = new Map<string, string>();

  return {
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
}

test("rule-package draft storage saves and restores drafts by source identity", () => {
  const storage = createMemoryStorage();
  const source = {
    sourceKind: "uploaded_example_pair" as const,
    exampleSourceSessionId: "session-demo-1",
  };

  saveRulePackageDraft(storage, {
    version: 1,
    source,
    selectedPackageId: "package-front-matter",
    editableDraftById: {
      "package-front-matter": {
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
      },
    },
    previewById: {},
    savedAt: "2026-04-10T10:00:00.000Z",
  });

  const restored = loadRulePackageDraft(storage, source);

  assert.equal(
    buildRulePackageDraftStorageKey(source),
    "rule-package-workspace-draft::uploaded_example_pair::session-demo-1",
  );
  assert.equal(restored?.selectedPackageId, "package-front-matter");
  assert.equal(
    restored?.editableDraftById["package-front-matter"]?.title,
    "前置信息包",
  );
});
